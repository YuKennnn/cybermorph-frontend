# Pinia State Architecture & API Decoupling

## Architecture Overview

Rule 3 of `AGENTS.md` specifies:
> *"API communication should be separated from Vue components."*
> *"Authentication state should be managed through Pinia."*

Pinia stores manage global application state, while all network calls are delegated to dedicated modules under `src/api/`.

---

## Recommended Store Architecture

### 1. Setup Store Pattern with Explicit State, Getters, and Actions
All Pinia stores in CyberMorph use the Setup Store syntax (`defineStore(id, () => { ... })`).

```javascript
// Example: src/stores/authStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginUser,
  fetchWebUserProfile,
  fetchPlayerProfile,
} from '../api/auth.js'
import { useClassroomStore } from './classroomStore.js'
import { useThreatIndexStore } from './threatIndexStore.js'
import { usePlayerClassroomStore } from './playerClassroomStore.js'

export const useAuthStore = defineStore('auth', () => {
  // 1. STATE
  const token = ref(localStorage.getItem('cyber_token') || null)
  const storedRole = localStorage.getItem('cyber_role') || null
  const user = ref(null)
  const userRole = ref(storedRole)
  const isProfileLoading = ref(false)

  // Concurrency & session isolation guards
  let sessionEpoch = 0

  // 2. GETTERS
  const isAuthenticated = computed(() => !!token.value)
  const isEducator = computed(() => userRole.value === 'educator')
  const isAdmin = computed(() => userRole.value === 'admin')
  const isPlayer = computed(() => userRole.value === 'player')
  const displayName = computed(() => {
    return user.value?.display_name || user.value?.username || user.value?.email || 'User'
  })

  // 3. ACTIONS
  const resolveProfile = async (fallbackEmail = '') => {
    const epochAtStart = sessionEpoch
    const expectedToken = token.value

    if (!expectedToken) return null
    isProfileLoading.value = true

    try {
      // Step A: Check if token belongs to educator or admin
      try {
        const webProfile = await fetchWebUserProfile()
        if (epochAtStart !== sessionEpoch || token.value !== expectedToken) return null

        user.value = webProfile
        userRole.value = webProfile.role
        localStorage.setItem('cyber_user', JSON.stringify(user.value))
        localStorage.setItem('cyber_role', userRole.value)
        return user.value
      } catch (webErr) {
        if (webErr.response?.status !== 403 && webErr.response?.status !== 404) {
          throw webErr
        }
      }

      // Step B: Check if token belongs to game player
      const playerProfile = await fetchPlayerProfile()
      if (epochAtStart !== sessionEpoch || token.value !== expectedToken) return null

      user.value = {
        ...playerProfile,
        email: fallbackEmail || '',
        role: 'player',
      }
      userRole.value = 'player'
      localStorage.setItem('cyber_user', JSON.stringify(user.value))
      localStorage.setItem('cyber_role', 'player')
      return user.value
    } finally {
      if (epochAtStart === sessionEpoch) {
        isProfileLoading.value = false
      }
    }
  }

  const login = async (credentials) => {
    sessionEpoch++
    // Reset domain stores on login to ensure clean state
    useThreatIndexStore().reset?.()
    usePlayerClassroomStore().reset?.()

    const loginEpoch = sessionEpoch
    const data = await loginUser(credentials)

    if (loginEpoch !== sessionEpoch) return data

    token.value = data.access_token
    user.value = null
    userRole.value = null
    localStorage.setItem('cyber_token', data.access_token)

    await resolveProfile(credentials.email)
    return data
  }

  const logout = () => {
    sessionEpoch++
    token.value = null
    user.value = null
    userRole.value = null
    localStorage.removeItem('cyber_token')
    localStorage.removeItem('cyber_user')
    localStorage.removeItem('cyber_role')

    // Reset domain stores on logout
    useClassroomStore().reset?.()
    useThreatIndexStore().reset?.()
    usePlayerClassroomStore().reset?.()
  }

  return {
    token,
    user,
    userRole,
    isProfileLoading,
    isAuthenticated,
    isEducator,
    isAdmin,
    isPlayer,
    displayName,
    login,
    logout,
    resolveProfile,
  }
})
```

### 2. Core Invariants for Pinia Stores
1. **Never default an unresolved role to player**: Do not guess roles or fallback to `player` when unverified. If an account cannot be resolved, clear authentication state or reject the session.
2. **Session Isolation & State Cleanup**: On `logout()` (and before `login()`), reset all related domain stores (`classroomStore`, `threatIndexStore`, `playerClassroomStore`) to prevent previous account data from leaking into the next session.
3. **Stale Response Protection**: Increment a `sessionEpoch` counter whenever logging in, logging out, or switching accounts. Asynchronous network responses must check `sessionEpoch` before committing state to avoid overwriting newer session data with stale responses.
4. **Keep Local State Local**: Component-specific UI state (modals, search input buffers, pagination indexes) belongs in component `ref()`s, not global stores, unless multiple distinct views share that state.

---

## Verification Steps
1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that logging in as one user, logging out, and logging in as another completely clears the previous account's classrooms, progress, and threat index entries.
