# Environment Configuration, CORS, & Network Latency Resilience

## Context & Principles

CyberMorph developers alternate between three primary environments:
1. **Offline Mock Mode**: Fast, disconnected UI development using `axios-mock-adapter`.
2. **Local Full-Stack**: Frontend on `http://localhost:5173` and local FastAPI on `http://127.0.0.1:8000/v1`.
3. **Hosted Production/Staging**: Frontend connecting to a cloud-hosted backend on Render (`https://cybermorph-backend.onrender.com/v1`).

---

## Environment Variable Architecture

Maintain `.env.example` in source control and keep local configuration in `.env` (excluded by `.gitignore`):

```ini
# .env.example (template committed to git)
VITE_API_BASE_URL=https://cybermorph-backend.onrender.com/v1
VITE_USE_MOCK=false
```

```ini
# .env (local override for local backend testing)
VITE_API_BASE_URL=http://127.0.0.1:8000/v1
VITE_USE_MOCK=false
```

To switch to offline mock development:
```ini
VITE_USE_MOCK=true
```

In `src/main.js`, mock loading is active only in development mode when explicitly enabled:
```javascript
// src/main.js
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
  await import('./api/mock.js')
}
```

> [!IMPORTANT]
> **Vite Cache Invalidation**: Whenever you modify `.env`, restart the Vite development server (`Ctrl + C` followed by `npm run dev`).

---

## CORS Boundaries

FastAPI enforces CORS via `CORSMiddleware` using the `CORS_ORIGINS` environment variable on the backend. Browsers treat `http://localhost:5173` and `http://127.0.0.1:5173` as distinct origins.

If cross-origin errors occur, verify that your browser origin is explicitly included in the backend's `CORS_ORIGINS` configuration. Frontend headers cannot bypass server CORS restrictions.

---

## Network Resilience & Cloud Cold Starts

The hosted free-tier backend spins down after ~15 minutes of inactivity. When waking up, the first request may take 30–50 seconds.

However, **do not assume every network error is a hosting cold start**:
- Check for client offline state (`navigator.onLine === false`).
- Differentiate between connection timeouts (`ECONNABORTED`, request taking > 4s) and immediate connection refused errors (`ERR_CONNECTION_REFUSED`, e.g. local backend not running).
- Show clear, actionable status messages without technical jargon:

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

  // Provide notice only if request takes longer than 4s
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

onUnmounted(() => {
  if (wakeUpTimer) clearTimeout(wakeUpTimer)
})
</script>
```

---

## Verification Steps
1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that mock mode activates only when `import.meta.env.DEV` is true and `VITE_USE_MOCK === 'true'`.
3. Verify that network error messages clearly guide the user without exposing raw Axios error payloads.
