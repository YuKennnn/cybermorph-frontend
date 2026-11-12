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
import { setUnauthorizedSessionHandler } from '../api/client.js'
import { useClassroomStore } from './classroomStore.js'
import { useThreatIndexStore } from './threatIndexStore.js'
import { usePlayerClassroomStore } from './playerClassroomStore.js'
import { usePostTestStore } from './postTestStore.js'
import { useApiCacheStore } from './apiCacheStore.js'
import { stopNarration } from '../utils/speech.js'
import { stripDisplayNameWhitespace, validateDisplayName } from '../utils/displayName.js'

const WEB_ROLES = new Set(['educator', 'admin'])
const isDevMock = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'

export const isValidTokenFormat = (tok) => {
  if (!tok || typeof tok !== 'string') return false
  if (isDevMock) return true
  const parts = tok.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload && typeof payload.exp === 'number') {
      return Date.now() < payload.exp * 1000
    }
    return false
  } catch {
    return false
  }
}

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
  const isSessionReconciling = ref(false)
  const verificationError = ref(null)

  // Concurrency & account isolation guards
  const sessionEpoch = ref(0)
  const activeSessionEpoch = computed(() => sessionEpoch.value)
  let profileMutationVersion = 0
  let activeProfilePromise = null
  let activeProfileEpoch = 0

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
  const resolveProfile = (fallbackEmail = '') => {
    const epochAtStart = sessionEpoch.value
    const mutationAtStart = profileMutationVersion
    const expectedToken = token.value
    const expectedUserId = user.value?.user_id || null

    if (!expectedToken) {
      return Promise.resolve(null)
    }

    // Deduplicate equivalent profile resolution requests within the same authenticated session
    if (activeProfilePromise && activeProfileEpoch === epochAtStart) {
      return activeProfilePromise
    }

    const runResolve = async () => {
      isProfileLoading.value = true
      try {
        // 1. First test if token belongs to a web user (educator or admin)
        try {
          const webProfile = await fetchWebUserProfile()

          // Guard against logout or session/token switch while in-flight
          if (
            epochAtStart !== sessionEpoch.value ||
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
            epochAtStart !== sessionEpoch.value ||
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
          epochAtStart !== sessionEpoch.value ||
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
        if (epochAtStart === sessionEpoch.value) {
          isProfileLoading.value = false
        }
      }
    }

    const promise = runResolve().finally(() => {
      if (activeProfilePromise === promise) {
        activeProfilePromise = null
      }
    })

    activeProfilePromise = promise
    activeProfileEpoch = epochAtStart
    return promise
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

    const epochAtStart = sessionEpoch.value
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
      epochAtStart !== sessionEpoch.value ||
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
    sessionEpoch.value++
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
    try {
      usePostTestStore().reset()
    } catch {
      // Store may not be active yet
    }

    const loginEpoch = sessionEpoch.value
    const data = await loginUser(credentials)

    if (loginEpoch !== sessionEpoch.value) {
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
      if (loginEpoch === sessionEpoch.value) {
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
    sessionEpoch.value++
    profileMutationVersion++
    activeProfilePromise = null
    isProfileLoading.value = false
    isWebProfileVerified.value = false
    stopNarration()
    const currentToken = token.value
    token.value = null
    user.value = null
    userRole.value = null

    // Clear shared credentials only when they still match the rejected session
    if (currentToken && localStorage.getItem('cyber_token') === currentToken) {
      localStorage.removeItem('cyber_token')
      localStorage.removeItem('cyber_user')
      localStorage.removeItem('cyber_role')
    }

    try {
      useApiCacheStore().clearAll()
    } catch {
      // In case store is not yet active
    }
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
    try {
      usePostTestStore().reset()
    } catch {
      // In case store is not yet active
    }
  }

  /**
   * Handle admin endpoint 403 Forbidden:
   * Evicts admin cache, does NOT clear player/educator session, and re-verifies role.
   */
  const handleAdminForbidden = async () => {
    try {
      useApiCacheStore().invalidatePrefix('admin::')
    } catch {
      // In case store is not yet active
    }
    try {
      await resolveProfile()
    } catch {
      // Ignore background re-verification error
    }
  }

  /**
   * Startup session verification:
   * Always verifies stored session on startup even if in-memory and storage match.
   * Keeps private UI gated (isSessionReconciling = true) until verified.
   */
  const verifySessionOnStartup = async () => {
    if (!token.value) {
      isSessionReconciling.value = false
      return
    }

    if (!isValidTokenFormat(token.value)) {
      logout()
      isSessionReconciling.value = false
      return
    }

    isSessionReconciling.value = true
    verificationError.value = null
    try {
      await resolveProfile()
    } catch {
      // Transient verification failure: keep private UI gated with retry prompt, do not clear credentials
      verificationError.value = 'Failed to verify session'
    } finally {
      if (!verificationError.value) {
        isSessionReconciling.value = false
      }
    }
  }

  const retryStartupVerification = async () => {
    verificationError.value = null
    await verifySessionOnStartup()
  }

  // Cross-tab and browser restoration listeners
  if (typeof window !== 'undefined') {
    verifySessionOnStartup()

    window.addEventListener('storage', (e) => {
      if (e.key !== 'cyber_token') return
      const currentStored = localStorage.getItem('cyber_token')
      if (currentStored === token.value) return

      sessionEpoch.value++
      try {
        useApiCacheStore().clearAll()
      } catch {
        // Ignore
      }

      user.value = null
      userRole.value = null

      if (currentStored && isValidTokenFormat(currentStored)) {
        // Adopt replacement token preserved in storage
        token.value = currentStored
        isSessionReconciling.value = true
        verificationError.value = null
        resolveProfile()
          .catch(() => {
            verificationError.value = 'Failed to verify session'
          })
          .finally(() => {
            if (!verificationError.value) isSessionReconciling.value = false
          })
      } else {
        token.value = null
        logout()
      }
    })

    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return
      const currentStored = localStorage.getItem('cyber_token')
      if (currentStored !== token.value) {
        sessionEpoch.value++
        try {
          useApiCacheStore().clearAll()
        } catch {
          // Ignore
        }

        if (currentStored && isValidTokenFormat(currentStored)) {
          token.value = currentStored
          user.value = null
          userRole.value = null
          isSessionReconciling.value = true
          verificationError.value = null
          resolveProfile()
            .catch(() => {
              verificationError.value = 'Failed to verify session'
            })
            .finally(() => {
              if (!verificationError.value) isSessionReconciling.value = false
            })
        } else {
          logout()
        }
      }
    })
  }

  // Hook up client 401 session expiry handler to the store's logout action
  setUnauthorizedSessionHandler(() => {
    logout()
  })

  return {
    // State
    token,
    user,
    userRole,
    isProfileLoading,
    isWebProfileVerified,
    isSessionReconciling,
    verificationError,
    // Getters
    isAuthenticated,
    isEducator,
    isAdmin,
    isPlayer,
    displayName,
    hasEducatorDisplayName,
    isEducatorMissingDisplayName,
    activeSessionEpoch,
    // Actions
    login,
    logout,
    resolveProfile,
    ensureWebProfileLoaded,
    updateDisplayName,
    registerPlayer,
    registerWeb,
    handleAdminForbidden,
    verifySessionOnStartup,
    retryStartupVerification,
  }
})
