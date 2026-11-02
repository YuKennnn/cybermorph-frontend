# Lifecycle Cleanup & Memory Leak Prevention

## Context & Principles

In single-page applications (SPAs) like Vue 3, components mount and unmount dynamically as users navigate through routes. Any asynchronous operations, event listeners, intervals, or animation frames that are initiated within a component must be cancelled or removed when the component unmounts.

Failing to dispose of asynchronous listeners or intervals can lead to:
1. **Unmounted State Mutation**: Callbacks attempting to mutate reactive references on unmounted components, causing runtime warnings or unexpected state corruption.
2. **Zombie Network Requests**: Stale debounced timers or polling intervals continuing to send HTTP requests after the user has navigated away.
3. **Memory Leaks**: Dangling event listener closures preventing unmounted component instances from being garbage collected.

---

## Universal Cleanup Checklist

Before finalizing any Vue component, verify whether any of the following patterns are present and properly disposed:

| Resource Type | Initialization Hook | Required Cleanup Hook | Disposal Function |
| :--- | :--- | :--- | :--- |
| **Debounce / Delay Timers** | `watch`, methods | `onUnmounted` | `clearTimeout(timerId)` |
| **Polling Intervals** | `onMounted` | `onUnmounted` | `clearInterval(intervalId)` |
| **Animation Loops** | `onMounted` | `onUnmounted` | `cancelAnimationFrame(rafId)` |
| **Global Window / DOM Listeners** | `onMounted` | `onUnmounted` | `window.removeEventListener(...)` |
| **WebSocket / EventSource** | `onMounted` | `onUnmounted` | `socket.close()` |
| **AbortController (In-flight HTTP)**| Component setup | `onUnmounted` | `abortController.abort()` |

---

## Implementation Patterns

### 1. Debounce Timer Cleanup
When implementing search or filter debouncing, always clean up the active timer on unmount:

```javascript
import { ref, watch, onUnmounted } from 'vue'

const searchQuery = ref('')
let debounceTimer = null

watch(searchQuery, (newQuery) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    executeSearch(newQuery)
  }, 300)
})

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
```

### 2. Window Event Listener Disposal
Global listeners (e.g. keyboard shortcuts, resize handlers) attached to `window` or `document` must be unregistered in `onUnmounted`:

```javascript
import { onMounted, onUnmounted } from 'vue'

const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
```

---

## Verification Steps
1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that initiating a delayed action or timer and immediately navigating to another route does not trigger console warnings or delayed network requests.
