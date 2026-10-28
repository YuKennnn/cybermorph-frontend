import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginUser,
  registerPlayerAccount,
  registerWebAccount,
  fetchWebUserProfile,
  updateWebUserProfile,
  fetchPlayerProfile,
} from '../api/auth.js'
import { useClassroomStore } from './classroomStore.js'
import { useThreatIndexStore } from './threatIndexStore.js'
import { usePlayerClassroomStore } from './playerClassroomStore.js'
import { stopNarration } from '../utils/speech.js'
import { stripDisplayNameWhitespace, validateDisplayName } from '../utils/displayName.js'

const WEB_ROLES = new Set(['educator', 'admin'])

const normalizeWebUser = (rawUser) => {
  if (!rawUser || typeof rawUser !== 'object') return null
  const { username: _syntheticUsername, ...rest } = rawUser
  const normalizedDisplayName =
    typeof rest.display_name === 'string'
      ? stripDisplayNameWhitespace(rest.display_name) || null
      : null
  return {
    ...rest,
    display_name: normalizedDisplayName,
  }
}

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE (The Data)
  // ==========================================
  const token = ref(localStorage.getItem('cyber_token') || null)
  const storedRole = localStorage.getItem('cyber_role') || null

  const getInitialUser = () => {
    try {
      const rawUser = localStorage.getItem('cyber_user')
      if (!rawUser) return null
      const parsed = JSON.parse(rawUser)
      const effectiveRole = storedRole || parsed?.role || null
      if (WEB_ROLES.has(effectiveRole)) {
        const cleaned = normalizeWebUser(parsed)
        if (cleaned && 'username' in parsed) {
          localStorage.setItem('cyber_user', JSON.stringify(cleaned))
        }
        return cleaned
      }
      return parsed
    } catch {
      return null
    }
  }

  const user = ref(getInitialUser())
  const userRole = ref(storedRole || user.value?.role || null)
  const isProfileLoading = ref(false)
  const isWebProfileVerified = ref(false)

  // Concurrency & account isolation guards
  let sessionEpoch = 0
  let profileMutationVersion = 0
  let activeProfilePromise = null

  // ==========================================
  // 2. GETTERS (Computed Properties)
  // ==========================================
  const isAuthenticated = computed(() => !!token.value)
  const isEducator = computed(() => userRole.value === 'educator')
  const isAdmin = computed(() => userRole.value === 'admin')
  const isPlayer = computed(() => userRole.value === 'player')

  const displayName = computed(() => {
    if (WEB_ROLES.has(userRole.value) || WEB_ROLES.has(user.value?.role)) {
      const cleanDisplay = stripDisplayNameWhitespace(user.value?.display_name || '')
      return cleanDisplay || user.value?.email || 'Agent'
    }
    return user.value?.username || user.value?.email || 'Agent'
  })

  const hasEducatorDisplayName = computed(
    () =>
      isEducator.value &&
      Boolean(stripDisplayNameWhitespace(user.value?.display_name || '')),
  )

  const isEducatorMissingDisplayName = computed(
    () =>
      isEducator.value &&
      isWebProfileVerified.value &&
      !hasEducatorDisplayName.value,
  )

  // ==========================================
  // 3. ACTIONS
  // ==========================================

  /**
   * Resolve user profile and verified role after authentication or on reload.
   * Checks /web-users/me first (educator/admin), then /players/me (player).
   * Guarded against logout, account switching, and overwriting newer saves.
   */
  const resolveProfile = async (fallbackEmail = '') => {
    const epochAtStart = sessionEpoch
    const mutationAtStart = profileMutationVersion
    const expectedToken = token.value
    const expectedUserId = user.value?.user_id || null

    if (!expectedToken) {
      return null
    }

    isProfileLoading.value = true
    try {
      // 1. First test if token belongs to a web user (educator or admin)
      try {
        const webProfile = await fetchWebUserProfile()

        // Guard against logout or session/token switch while in-flight
        if (
          epochAtStart !== sessionEpoch ||
          !token.value ||
          token.value !== expectedToken
        ) {
          return null
        }

        // Guard against cross-account response contamination
        if (
          expectedUserId &&
          webProfile?.user_id &&
          String(webProfile.user_id) !== String(expectedUserId)
        ) {
          return null
        }

        // Guard against overwriting a newer display_name save started/completed during fetch
        if (mutationAtStart !== profileMutationVersion) {
          isWebProfileVerified.value = true
          return user.value
        }

        const normalized = normalizeWebUser(webProfile)
        user.value = normalized
        userRole.value = webProfile.role
        isWebProfileVerified.value = true
        localStorage.setItem('cyber_user', JSON.stringify(user.value))
        localStorage.setItem('cyber_role', userRole.value)
        return user.value
      } catch (webErr) {
        if (
          epochAtStart !== sessionEpoch ||
          !token.value ||
          token.value !== expectedToken
        ) {
          return null
        }
        const isNotWeb =
          webErr.response?.status === 403 || webErr.response?.status === 404
        if (!isNotWeb) throw webErr
      }

      // 2. Test if token belongs to a game player
      const playerProfile = await fetchPlayerProfile()

      if (
        epochAtStart !== sessionEpoch ||
        !token.value ||
        token.value !== expectedToken
      ) {
        return null
      }

      if (
        expectedUserId &&
        playerProfile?.user_id &&
        String(playerProfile.user_id) !== String(expectedUserId)
      ) {
        return null
      }

      user.value = {
        ...playerProfile,
        email: fallbackEmail || user.value?.email || '',
        role: 'player',
      }
      userRole.value = 'player'
      localStorage.setItem('cyber_user', JSON.stringify(user.value))
      localStorage.setItem('cyber_role', 'player')
      try {
        usePlayerClassroomStore()
          .loadMembership({ force: true })
          .catch(() => {})
      } catch {
        // Store may not be active yet
      }
      return user.value
    } finally {
      if (epochAtStart === sessionEpoch) {
        isProfileLoading.value = false
      }
    }
  }

  /**
   * Ensures the current web user profile has been fetched from GET /web-users/me
   * in this browser session before deciding display_name is missing.
   */
  const ensureWebProfileLoaded = async ({ force = false } = {}) => {
    if (!token.value || isPlayer.value) {
      return user.value
    }
    if (isWebProfileVerified.value && !force) {
      return user.value
    }
    if (activeProfilePromise && !force) {
      return activeProfilePromise
    }

    const promise = resolveProfile(user.value?.email || '').finally(() => {
      if (activeProfilePromise === promise) {
        activeProfilePromise = null
      }
    })
    activeProfilePromise = promise
    return promise
  }

  /**
   * Updates the authenticated web user's display_name via PATCH /web-users/me.
   * Validates according to the backend DisplayName contract and prevents stale
   * or post-logout responses from corrupting state.
   */
  const updateDisplayName = async (rawDisplayName) => {
    const validation = validateDisplayName(rawDisplayName)
    if (!validation.valid) {
      const err = new Error(validation.error)
      err.isValidationError = true
      err.code = validation.code
      throw err
    }

    const epochAtStart = sessionEpoch
    const expectedToken = token.value
    const expectedUserId = user.value?.user_id || null

    if (!expectedToken) {
      throw new Error('You must be signed in to update your display name.')
    }

    // Invalidate any in-flight GET /web-users/me immediately when save begins
    const saveVersion = ++profileMutationVersion

    const updatedProfile = await updateWebUserProfile({
      display_name: validation.trimmed,
    })

    // Discard if user logged out or switched accounts while PATCH was in flight
    if (
      epochAtStart !== sessionEpoch ||
      !token.value ||
      token.value !== expectedToken
    ) {
      return null
    }

    if (
      expectedUserId &&
      updatedProfile?.user_id &&
      String(updatedProfile.user_id) !== String(expectedUserId)
    ) {
      return null
    }

    // Discard if a newer save was initiated after this one
    if (saveVersion !== profileMutationVersion) {
      return user.value
    }

    profileMutationVersion++
    const normalized = normalizeWebUser({
      ...user.value,
      ...updatedProfile,
      display_name: updatedProfile?.display_name ?? validation.trimmed,
    })

    user.value = normalized
    if (updatedProfile?.role) {
      userRole.value = updatedProfile.role
      localStorage.setItem('cyber_role', userRole.value)
    }
    isWebProfileVerified.value = true
    localStorage.setItem('cyber_user', JSON.stringify(user.value))

    try {
      useClassroomStore().clearCreateConflict()
    } catch {
      // Classroom store may not be initialized
    }

    return user.value
  }

  /**
   * Log in user, store token, and resolve verified role from backend.
   */
  const login = async (credentials) => {
    sessionEpoch++
    profileMutationVersion = 0
    activeProfilePromise = null
    isWebProfileVerified.value = false
    try {
      useThreatIndexStore().reset()
    } catch {
      // Store may not be active yet
    }
    try {
      usePlayerClassroomStore().reset()
    } catch {
      // Store may not be active yet
    }

    const loginEpoch = sessionEpoch
    const data = await loginUser(credentials)

    if (loginEpoch !== sessionEpoch) {
      return data
    }

    const authToken = data.access_token || data.token
    token.value = authToken
    user.value = null
    userRole.value = null
    localStorage.setItem('cyber_token', authToken)

    // If backend or mock provided user info directly:
    if (data.user?.role) {
      const normalized = WEB_ROLES.has(data.user.role)
        ? normalizeWebUser(data.user)
        : data.user
      user.value = normalized
      userRole.value = data.user.role
      isWebProfileVerified.value = WEB_ROLES.has(data.user.role)
      localStorage.setItem('cyber_user', JSON.stringify(normalized))
      localStorage.setItem('cyber_role', data.user.role)
      if (data.user.role === 'player') {
        try {
          usePlayerClassroomStore()
            .loadMembership({ force: true })
            .catch(() => {})
        } catch {
          // Store may not be active yet
        }
      }
      return data
    }

    // Otherwise resolve profile from authoritative endpoints
    try {
      await resolveProfile(credentials.email)
    } catch (profileError) {
      // If profile resolution fails completely, revoke session to avoid inconsistent state
      if (loginEpoch === sessionEpoch) {
        logout()
      }
      throw profileError
    }

    return data
  }

  /**
   * Register a new player account.
   */
  const registerPlayer = async (playerData) => {
    return await registerPlayerAccount(playerData)
  }

  /**
   * Register a new educator web account.
   */
  const registerWeb = async (webUserData) => {
    return await registerWebAccount(webUserData)
  }

  /**
   * Clear all auth session data and tokens.
   */
  const logout = () => {
    sessionEpoch++
    profileMutationVersion++
    activeProfilePromise = null
    isProfileLoading.value = false
    isWebProfileVerified.value = false
    stopNarration()
    token.value = null
    user.value = null
    userRole.value = null
    localStorage.removeItem('cyber_token')
    localStorage.removeItem('cyber_user')
    localStorage.removeItem('cyber_role')
    try {
      useClassroomStore().reset()
    } catch {
      // In case store is not yet active
    }
    try {
      useThreatIndexStore().reset()
    } catch {
      // In case store is not yet active
    }
    try {
      usePlayerClassroomStore().reset()
    } catch {
      // In case store is not yet active
    }
  }

  return {
    // State
    token,
    user,
    userRole,
    isProfileLoading,
    isWebProfileVerified,
    // Getters
    isAuthenticated,
    isEducator,
    isAdmin,
    isPlayer,
    displayName,
    hasEducatorDisplayName,
    isEducatorMissingDisplayName,
    // Actions
    login,
    logout,
    resolveProfile,
    ensureWebProfileLoaded,
    updateDisplayName,
    registerPlayer,
    registerWeb,
  }
})
