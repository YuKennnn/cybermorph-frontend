# Reactivity & Computed Properties Optimization

## Context & Principles

In Vue 3 templates, unparameterized calculations should be defined as `computed()` properties rather than plain methods, because `computed()` caches results based on reactive dependencies.

However, **not every function in a template can or should be converted to a computed property**. Parameterized formatting helpers (e.g. `formatDate(item.timestamp)` or `isCurrentPlayer(entry)` inside a `v-for` loop) and event handlers must remain functions.

---

## When to Use Computed vs Functions

| Feature | `computed` Property | Parameterized Helper Function | Method / Action |
| :--- | :--- | :--- | :--- |
| **Purpose** | Derive, filter, or aggregate reactive state | Format or inspect a specific item passed as argument | Handle user interactions (`@click`, `@submit`) |
| **Parameters** | **No** (pure derived state) | **Yes** (`(item) => ...`) | **Optional** (`(event) => ...`) |
| **Caching** | **Yes** (cached until dependencies change) | **No** (runs on render) | N/A |
| **Template Usage** | Direct property: `{{ totalPages }}` | In loops: `{{ formatDate(row.date) }}` | Direct binding: `@click="save"` |
| **Side Effects?** | **No** (pure calculations only) | **No** (pure formatting only) | **Yes** (network, state mutation) |

---

## Implementation Patterns

### 1. Cached Derived State (`computed`)
Use `computed()` for values derived from reactive state that take no parameters:

```javascript
import { ref, computed } from 'vue'

const totalCount = ref(0)
const pageSize = ref(10)
const page = ref(1)

// Computed: Cached and only recalculated when totalCount or pageSize changes
const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})
```

In the template:
```vue
<span class="pagination-info">Page {{ page }} of {{ totalPages }}</span>
<button :disabled="page >= totalPages" @click="handleNextPage">Next</button>
```

### 2. Parameterized Formatting in Loops (Functions)
When formatting items inside a `v-for` loop where each item passes its own data, use a small, pure helper function:

```javascript
// Parameterized helper: correctly kept as a function because it depends on an argument
const formatTimestamp = (isoString) => {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString()
  } catch {
    return '—'
  }
}
```

In the template:
```vue
<tr v-for="session in sessions" :key="session.session_id">
  <td>{{ formatTimestamp(session.played_at) }}</td>
</tr>
```

---

## Verification Steps
1. Verify with non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that unparameterized derived calculations in templates use `computed` properties rather than function calls with parentheses.
3. Verify that computed properties remain pure and do not perform asynchronous calls or state mutations.
