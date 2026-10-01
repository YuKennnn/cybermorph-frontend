# Environment Configuration, CORS, & Network Latency Resilience

## Context & Problem Statement

CyberMorph developers often alternate between three execution environments:
1. **Offline Mock Mode**: Fast, disconnected UI development using `axios-mock-adapter`.
2. **Local Full-Stack**: Frontend on `http://localhost:5173` and local FastAPI on `http://127.0.0.1:8000`.
3. **Hosted Production/Staging**: Frontend connecting to a cloud-hosted backend on Render (`https://cybermorph-backend.onrender.com`).

Moving across these environments introduces common operational pitfalls:
- **Cached Environment Variables**: Vite reads `.env` files once on startup. Modifying `.env` while `npm run dev` is running does not immediately take effect until restarted.
- **Cross-Origin Resource Sharing (CORS) Drift**: Browsers treat `http://localhost:5173` and `http://127.0.0.1:5173` as distinct origins. If the backend only whitelists one, the other fails silently with a network error.
- **Render Cold-Start Latency**: Free-tier cloud instances spin down after 15 minutes of inactivity. The first wake-up request takes 30–50 seconds. Without clear visual feedback, users perceive the app as frozen or broken.

---

## Recommended Architecture & Best Practices

### 1. Environment Variable Architecture
Maintain `.env.example` in source control and keep local secrets and endpoints in `.env` (which is excluded by `.gitignore`):

```ini
# .env.example (template committed to git)
VITE_API_BASE_URL=https://cybermorph-backend.onrender.com
VITE_USE_MOCK=false
```

```ini
# .env (local override for local backend testing)
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false
```

To switch back to offline mock development, simply toggle:
```ini
VITE_USE_MOCK=true
```

In `src/main.js`, make mock loading strictly opt-in:
```javascript
// src/main.js
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
  import('./api/mock')
}
```

> [!IMPORTANT]
> **Vite Cache Invalidation**: Whenever you modify `.env`, restart the Vite development server (`Ctrl + C` followed by `npm run dev`).

---

### 2. Understanding Browser CORS Boundaries
FastAPI enforces CORS via `CORSMiddleware`. Ensure the backend includes both common loopback addresses in its `CORS_ORIGINS` configuration:

```python
# FastAPI backend configuration
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://cybermorph-portal.edu"
]
```

On the frontend, always use the consistent loopback address in your browser address bar matching your configuration.

---

### 3. Handling Cold Starts with Resilient UI Feedback
When calling remote endpoints hosted on sleeping cloud servers (such as Render or Fly.io), provide proactive feedback if the request duration exceeds 4 seconds:

```vue
<script setup>
import { ref, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { extractErrorMessage } from '@/api/client'

const authStore = useAuthStore()
const isLoading = ref(false)
const isServerWakingUp = ref(false)
const errorMessage = ref('')
let wakeUpTimer = null

const handleSubmit = async (credentials) => {
  isLoading.value = true
  isServerWakingUp.value = false
  errorMessage.value = ''

  // Notify user if waiting longer than 4s for a sleeping server to wake up
  wakeUpTimer = setTimeout(() => {
    if (isLoading.value) {
      isServerWakingUp.value = true
    }
  }, 4000)

  try {
    await authStore.login(credentials)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    if (wakeUpTimer) clearTimeout(wakeUpTimer)
    isLoading.value = false
    isServerWakingUp.value = false
  }
}

// Clean up timer to prevent memory leaks when user navigates away
onUnmounted(() => {
  if (wakeUpTimer) clearTimeout(wakeUpTimer)
})
</script>

<template>
  <div v-if="isServerWakingUp" class="info-banner" role="status">
    Connecting to backend... Free cloud instances take 30–45s to wake up on first request.
  </div>
</template>
```

---

## Verification Steps

1. **Verify Local Loopback**:
   Run `curl.exe -I http://127.0.0.1:8000/docs`. Ensure the local FastAPI server responds with `HTTP/1.1 200 OK`.
2. **Verify CORS Headers**:
   Run:
   ```powershell
   curl.exe -I -X OPTIONS http://127.0.0.1:8000/auth/login `
     -H "Origin: http://localhost:5173" `
     -H "Access-Control-Request-Method: POST"
   ```
   Confirm `access-control-allow-origin: http://localhost:5173` is present.
3. **Verify Timeout & Wake-Up Handling**:
   Simulate a slow network in browser DevTools ("Slow 3G") and ensure the `info-banner` appears smoothly after 4 seconds without errors.
