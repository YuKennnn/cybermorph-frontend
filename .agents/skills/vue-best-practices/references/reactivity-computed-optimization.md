# Reactivity & Computed Properties Optimization

## Context & Problem Statement

In Vue 3 templates, any method invoked in the template (e.g. `{{ totalPages() }}` or `:disabled="page >= totalPages()"`) is executed **every time the component renders or any reactive dependency in the component changes**.

In `src/views/LeaderboardView.vue`:
```javascript
// src/views/LeaderboardView.vue (line 67)
const totalPages = () => Math.ceil(totalCount.value / pageSize.value) || 1
```

In the template:
```vue
<span class="pagination-info">Page {{ page }} of {{ totalPages() }}</span>
...
<button :disabled="page >= totalPages()" @click="handleNextPage">Next</button>
```

### Why This is an Anti-Pattern
1. **No Caching / Memoization**: Methods do not cache their results. If another ref (such as `isLoading` or `searchQuery`) changes, Vue re-evaluates `totalPages()` repeatedly, even if `totalCount` and `pageSize` remain identical.
2. **Template Clutter**: Calling functions with parentheses `totalPages()` inside templates makes template expressions imperative rather than declarative.
3. **Performance Degradation**: While computing `Math.ceil` is fast, this anti-pattern scaled across complex calculations (e.g. data filtering, sorting, or graph analytics in `EducatorAnalyticsView.vue`) causes noticeable frame drops and CPU spikes.

---

## Remediation: Declarative `computed()` Properties

Convert derived state into cached `computed` properties:

```javascript
import { ref, computed } from 'vue'

const totalCount = ref(0)
const pageSize = ref(10)
const page = ref(1)

// Optimized: Cached and only recalculated when totalCount or pageSize changes
const totalPages = computed(() => {
  return Math.ceil(totalCount.value / pageSize.value) || 1
})
```

In the template:
```vue
<span class="pagination-info">Page {{ page }} of {{ totalPages }}</span>
...
<button :disabled="page >= totalPages" @click="handleNextPage">Next</button>
```

---

## When to Use Computed vs Methods vs Watchers

| Feature | `computed` | `method` | `watch` |
| :--- | :--- | :--- | :--- |
| **Purpose** | Derive and transform existing reactive state | Handle user actions / events (`@click`, `@submit`) | Perform side effects (network calls, localStorage) |
| **Caching** | **Yes** (cached by reactive dependencies) | **No** (re-executes on every invocation) | N/A |
| **Template Usage** | Property access: `{{ fullName }}` | Event binding: `@click="saveData"` | Never used in templates |
| **Side Effects Allowed?** | **No** (must be pure calculation) | **Yes** | **Yes** |

---

## Verification Steps
1. Inspect templates in `src/views/` and replace all function evaluations `fn()` with `computed` property bindings.
2. Ensure computed properties return values synchronously without modifying outside state.
3. Verify that `npm run lint` passes with 0 warnings.
