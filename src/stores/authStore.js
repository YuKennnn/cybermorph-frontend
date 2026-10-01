import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginUser,
  registerPlayerAccount,
  registerWebAccount,
  fetchWebUserProfile,
  fetchPlayerProfile,
} from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE (The Data)
  // ==========================================
  const token = ref(localStorage.getItem('cyber_token') || null)

  const getInitialUser = () => {
    try {
      const rawUser = localStorage.getItem('cyber_user')
      return rawUser ? JSON.parse(rawUser) : null
    } catch {
      return null
    }
  }

  const user = ref(getInitialUser())
  const userRole = ref(localStorage.getItem('cyber_role') || user.value?.role || null)
  const isProfileLoading = ref(false)

  // ==========================================
  // 2. GETTERS (Computed Properties)
  // ==========================================
  const isAuthenticated = computed(() => !!token.value)
  const isEducator = computed(() => userRole.value === 'educator')
  const isAdmin = computed(() => userRole.value === 'admin')
  const isPlayer = computed(() => userRole.value === 'player')
  const displayName = computed(
    () => user.value?.username || user.value?.display_name || user.value?.email || 'Agent',
  )

  // ==========================================
  // 3. ACTIONS
  // ==========================================

  /**
   * Resolve user profile and verified role after authentication.
   * Checks /web-users/me first (educator/admin), then /players/me (player).
   */
  const resolveProfile = async (fallbackEmail = '') => {
    isProfileLoading.value = true
    try {
      // 1. First test if token belongs to a web user (educator or admin)
      try {
        const webProfile = await fetchWebUserProfile()
        user.value = {
          ...webProfile,
          username: webProfile.display_name || webProfile.email?.split('@')[0] || 'Web Agent',
        }
        userRole.value = webProfile.role
        localStorage.setItem('cyber_user', JSON.stringify(user.value))
        localStorage.setItem('cyber_role', userRole.value)
        return user.value
      } catch (webErr) {
        // If 403 / "Not a web portal account", fall through to player profile
        const isNotWeb = webErr.response?.status === 403 || webErr.response?.status === 404
        if (!isNotWeb) throw webErr
      }

      // 2. Test if token belongs to a game player
      const playerProfile = await fetchPlayerProfile()
      user.value = {
        ...playerProfile,
        email: fallbackEmail || user.value?.email || '',
        role: 'player',
      }
      userRole.value = 'player'
      localStorage.setItem('cyber_user', JSON.stringify(user.value))
      localStorage.setItem('cyber_role', 'player')
      return user.value
    } finally {
      isProfileLoading.value = false
    }
  }

  /**
   * Log in user, store token, and resolve verified role from backend.
   */
  const login = async (credentials) => {
    const data = await loginUser(credentials)
    const authToken = data.access_token || data.token
    token.value = authToken
    localStorage.setItem('cyber_token', authToken)

    // If backend or mock provided user info directly:
    if (data.user?.role) {
      user.value = data.user
      userRole.value = data.user.role
      localStorage.setItem('cyber_user', JSON.stringify(data.user))
      localStorage.setItem('cyber_role', data.user.role)
      return data
    }

    // Otherwise resolve profile from authoritative endpoints
    try {
      await resolveProfile(credentials.email)
    } catch (profileError) {
      // If profile resolution fails completely, revoke session to avoid inconsistent state
      logout()
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
    token.value = null
    user.value = null
    userRole.value = null
    localStorage.removeItem('cyber_token')
    localStorage.removeItem('cyber_user')
    localStorage.removeItem('cyber_role')
  }

  return {
    // State
    token,
    user,
    userRole,
    isProfileLoading,
    // Getters
    isAuthenticated,
    isEducator,
    isAdmin,
    isPlayer,
    displayName,
    // Actions
    login,
    logout,
    resolveProfile,
    registerPlayer,
    registerWeb,
  }
})