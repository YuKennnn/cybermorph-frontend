---
name: pinia-store
description: Load when creating, modifying, or refactoring Pinia state stores in CyberMorph. Enforces Pinia setup store syntax, state isolation, reactive getters/actions, safe auth session persistence, error containment, and separation of UI components from network logic.
metadata:
  category: frontend-architecture
---

# Pinia State Management for CyberMorph

This skill provides architectural rules, patterns, and security guidelines for designing Pinia stores in the CyberMorph frontend.

## Knowledge

### 1. Setup Store Pattern
In CyberMorph, all Pinia stores must use the modern Setup Store syntax (`defineStore('id', () => { ... })`), which mirrors the Vue 3 Composition API:
```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchFeatureItems } from '../api/feature.js'

export const useFeatureStore = defineStore('feature', () => {
  // 1. STATE (ref / reactive)
  const items = ref([])
  const isLoading = ref(false)

  // 2. GETTERS (computed)
  const activeCount = computed(() => items.value.filter(i => i.isActive).length)

  // 3. ACTIONS (functions)
  const loadItems = async () => {
    isLoading.value = true
    try {
      // Delegate network requests to imported API module
      const data = await fetchFeatureItems()
      items.value = data
    } finally {
      isLoading.value = false
    }
  }

  // 4. EXPOSURE
  return { items, isLoading, activeCount, loadItems }
})
```

### 2. Authentication & Authorization Invariants
- **Never Default an Unresolved Role to Player**: The backend is the sole authority for roles (`player`, `educator`, `admin`). If role information is absent, pending, or unverified, the role must remain `null` or unauthenticated. Never infer roles from client heuristics (e.g. email strings) and never default an unknown identity to `'player'`.
- **Authoritative Profile-Resolution Flow**: Follow the documented profile resolution pattern:
  1. Authenticate with `POST /auth/login` to obtain the bearer `access_token`.
  2. Query `GET /web-users/me` to check for educator or admin profile.
  3. If `GET /web-users/me` returns 403 or 404, query `GET /players/me` for player profile.
  4. If neither endpoint verifies the account, invalidate the session and redirect to `/login`.
- **Session Isolation & State Cleanup**: On `logout()` (and prior to resolving a new `login()`), thoroughly clean up all authentication and domain state:
  - Reset in-memory refs (`token.value = null`, `user.value = null`, `userRole.value = null`).
  - Clear persisted storage keys (`localStorage.removeItem('cyber_token')`, `'cyber_user'`, `'cyber_role'`).
  - Reset all active domain stores (e.g. `classroomStore.reset()`, `threatIndexStore.reset()`, `playerClassroomStore.reset()`) to prevent data leaking across sessions.
- **Stale-Response Protection**: Maintain session counters or epoch guards (e.g. `sessionEpoch`, mutation counters). When an asynchronous profile fetch or mutation resolves, ensure the current session epoch and token still match the in-flight request before updating reactive state, preventing delayed or out-of-order network responses from corrupting newer sessions.
- **Keep Page-Local State Local**: State that is only relevant to a single view (such as modal open/close flags, temporary form inputs, table filters, or search pagination) should remain inside component-level `ref`s. Use Pinia only when state must be shared across distinct views or maintained across routes.

### 3. Separation of Concerns
- Stores orchestrate application state and domain actions.
- Network communication inside actions must delegate to functions in `src/api/` rather than calling Axios or embedding request configurations directly.
- Components consume stores via `storeToRefs()` when destructuring reactive state and getters:
  ```javascript
  import { storeToRefs } from 'pinia'
  import { useAuthStore } from '@/stores/authStore'

  const authStore = useAuthStore()
  const { user, userRole, isAuthenticated } = storeToRefs(authStore)
  ```

### 4. Error Handling & Privacy
- Catch errors inside store actions to control side effects and avoid unhandled promise rejections.
- Do not log Axios error objects containing credentials, tokens, or sensitive user data to the console.

## Instructions

1. **Naming & Placement**: All stores live in `src/stores/<name>Store.js`.
2. **Setup Pattern**: Always use setup functions (`defineStore(name, () => { ... })`).
3. **API Delegation**: Call typed API modules from `src/api/`.
4. **Validation with Non-Fixing Commands**:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
5. **Learning Rule**: Explain what state, getters, and actions were introduced and why they belong in a global store rather than a local component ref.
