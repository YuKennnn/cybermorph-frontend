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
      // Use imported API module, not direct apiClient
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
- **Never Infer Roles on the Client**: Do not assign user roles (e.g. `admin` or `educator`) based on client-side heuristics such as checking if an email contains `"admin"`. The backend is the sole authority for roles. If role information is absent or unverified, fallback strictly to `'player'`.
- **LocalStorage State Sanitization**: When storing tokens or profiles in `localStorage`, ensure that tampering with local storage values cannot escalate backend privileges. Frontend route guards are for UX only, not security boundaries.
- **Clean Session Termination (`logout`)**: The logout action must completely clear in-memory state (`ref(null)`) and remove all persisted keys (`cyber_token`, `cyber_user`, `cyber_role`).

### 3. Separation of Concerns
- Stores orchestrate application state and domain logic.
- Network requests inside actions should delegate to functions in `src/api/` rather than embedding raw Axios configurations.
- Components consume stores via `storeToRefs()` when destructuring state/getters to maintain reactivity:
  ```javascript
  import { storeToRefs } from 'pinia'
  import { useAuthStore } from '@/stores/authStore'

  const authStore = useAuthStore()
  const { user, userRole } = storeToRefs(authStore)
  ```

### 4. Error Handling & Privacy
- Catch errors inside store actions to control side effects and avoid unhandled promise rejections.
- Do not log Axios error objects containing credentials to `console.error`.

## Instructions

1. **Naming & Placement**: All stores live in `src/stores/<name>Store.js`.
2. **Setup Pattern**: Always use setup functions (`defineStore(name, () => { ... })`).
3. **API Delegation**: Call typed API modules from `src/api/`.
4. **Validation**: Check that stores pass oxlint and ESLint:
   ```powershell
   npm run lint
   ```
5. **Learning Rule**: Explain what state, getters, and actions were introduced and why they belong in the store rather than a local component ref.
