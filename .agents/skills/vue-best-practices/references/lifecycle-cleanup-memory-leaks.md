# Lifecycle Cleanup & Memory Leak Prevention

## Context & Problem Statement

In single-page applications (SPAs) like Vue 3, components mount and unmount dynamically as users navigate through routes. Any asynchronous operations, event listeners, intervals, or animation frames that are initiated within a component must be cancelled or removed when the component unmounts.

In `src/views/LeaderboardView.vue`:
```javascript
// src/views/LeaderboardView.vue (lines 21-60)
let debounceTimer = null

watch(searchQuery, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchLeaderboard()
  }, 300)
})
```

### The Bug & Vulnerability Mechanics
1. **Unmounted State Mutation**: If a user types into the search query input and navigates away to `/dashboard` within 300ms, the component unmounts. However, `debounceTimer` is still scheduled in the browser event loop.
2. When the 300ms timer triggers, the callback executes `page.value = 1` and calls `fetchLeaderboard()`, which sends an unnecessary HTTP request to `/leaderboard` and attempts to write results to unmounted reactive references (`leaderboardItems.value`).
3. In browser memory, this maintains dangling references to the unmounted component scope, preventing garbage collection and causing memory leaks.

---

## Remediation & Best Practice Pattern

### 1. Explicit Cleanup with `onUnmounted`
Always import and register cleanup hooks for timers, listeners, and intervals:

```javascript
import { ref, watch, onMounted, onUnmounted } from 'vue'

let debounceTimer = null

watch(searchQuery, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchLeaderboard()
  }, 300)
})

// Essential lifecycle cleanup
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
```

---

## Universal Checklist for CyberMorph Vue Components

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

## Verification Steps
1. In Chrome DevTools, open the **Performance** or **Memory** tab.
2. In `LeaderboardView.vue`, enter characters into the search field and rapidly click between navigation links.
3. Verify that zero network requests are dispatched after navigating away from the leaderboard page.
