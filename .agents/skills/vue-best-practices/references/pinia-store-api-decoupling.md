# Pinia State Architecture & API Decoupling

## Context & Problem Statement

Rule 3 of `AGENTS.md` explicitly specifies:
> *"API communication should be separated from Vue components."*
> *"Authentication state should be managed through Pinia."*

While views in CyberMorph now delegate to dedicated API modules (`src/api/classroom.js`, `src/api/leaderboard.js`, `src/api/admin.js`, `src/api/player.js`), the primary store **`src/stores/authStore.js` still directly imports and calls `apiClient`**:

```javascript
// src/stores/authStore.js (Current implementation)
import apiClient from '../api/client'

const login = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials)
  ...
}

const registerPlayer = async (playerData) => {
  const response = await apiClient.post('/auth/register', playerData)
  ...
}
```

### Architectural Deficiencies
1. **Direct Transport Coupling**: The store is tightly coupled to Axios and hardcoded endpoint paths (`/auth/login`, `/auth/register`, `/auth/register-web`), instead of consuming a clean service interface.
2. **Missing Getters / Computed Properties**: Views and components throughout the application repeatedly write ad-hoc expressions:
   - `authStore.user?.username || authStore.user?.email || 'Agent'`
   - `authStore.userRole === 'educator'`
   - `authStore.userRole === 'admin'`
   - `!!authStore.token`

---

## Recommended Architecture

Create a dedicated API client module `src/api/auth.js` and introduce reactive computed getters in `authStore.js`.

### 1. `src/api/auth.js` (Dedicated Auth API Module)
```javascript
import apiClient from './client'

/**
 * Authenticate user with credentials.
 * Endpoint: POST /auth/login
 */
export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials)
  return response.data
}

/**
 * Register a new player account.
 * Endpoint: POST /auth/register
 */
export const registerPlayerAccount = async (playerData) => {
  const response = await apiClient.post('/auth/register', playerData)
  return response.data
}

/**
 * Register a new web user (educator or admin).
 * Endpoint: POST /auth/register-web
 */
export const registerWebAccount = async (webUserData) => {
  const response = await apiClient.post('/auth/register-web', webUserData)
  return response.data
}
```

### 2. `src/stores/authStore.js` (Refactored Setup Store with Getters)
```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginUser,
  registerPlayerAccount,
  registerWebAccount,
} from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE
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
  const initialUser = getInitialUser()
  const user = ref(initialUser)

  const storedRole = localStorage.getItem('cyber_role') || initialUser?.role || null
  const userRole = ref(storedRole)

  // ==========================================
  // 2. GETTERS (Computed Properties)
  // ==========================================
  const isAuthenticated = computed(() => !!token.value)
  const isEducator = computed(() => userRole.value === 'educator')
  const isAdmin = computed(() => userRole.value === 'admin')
  const isPlayer = computed(() => userRole.value === 'player')
  const displayName = computed(() => user.value?.username || user.value?.email || 'Agent')

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const login = async (credentials) => {
    const data = await loginUser(credentials)

    const authToken = data.access_token || data.token
    token.value = authToken
    localStorage.setItem('cyber_token', authToken)

    const extractedUser = data.user || {
      email: credentials.email,
      username: credentials.email?.split('@')[0] || 'User',
    }
    const rawRole = data.user?.role || data.role || 'player'
    const validRoles = ['player', 'educator', 'admin']
    const extractedRole = validRoles.includes(rawRole.toLowerCase())
      ? rawRole.toLowerCase()
      : 'player'

    user.value = extractedUser
    userRole.value = extractedRole

    localStorage.setItem('cyber_user', JSON.stringify(extractedUser))
    localStorage.setItem('cyber_role', extractedRole)

    return data
  }

  const registerPlayer = async (playerData) => {
    return await registerPlayerAccount(playerData)
  }

  const registerWeb = async (webUserData) => {
    return await registerWebAccount(webUserData)
  }

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
    // Getters
    isAuthenticated,
    isEducator,
    isAdmin,
    isPlayer,
    displayName,
    // Actions
    login,
    logout,
    registerPlayer,
    registerWeb,
  }
})
```

---

## Verification Steps
1. In `src/components/SidebarNav.vue` and `src/views/DashboardView.vue`, consume the new getters `authStore.displayName` and `authStore.isAuthenticated`.
2. Confirm with `npm run lint` that all imports resolve cleanly without circular dependencies.
3. Test login and logout flows to confirm credentials and user states update reactively.
