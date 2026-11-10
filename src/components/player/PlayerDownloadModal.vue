<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAppVersion, extractErrorMessage } from '../../api/app.js'
import { useApiCacheStore } from '../../stores/apiCacheStore.js'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close'])

const router = useRouter()
const cacheStore = useApiCacheStore()
const VERSION_TTL = 300000 // 300s cache for public app release metadata

const modalRef = ref(null)
const cancelBtnRef = ref(null)
const confirmBtnRef = ref(null)

const isLoading = ref(false)
const releaseData = ref(null)
const validUrl = ref('')
const errorMessage = ref('')
const isUnavailable = ref(false)
const isFailure = ref(false)

let currentRequestId = 0
let abortController = null
let previouslyFocusedElement = null

const validateReleaseUrl = (urlString) => {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return { valid: false, empty: true, error: 'Release link is not available yet.' }
  }
  const trimmed = urlString.trim()
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, empty: false, error: 'Release link is not a valid URL.' }
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, empty: false, error: 'Release link must use a secure HTTPS connection.' }
  }

  const isSameOrigin = typeof window !== 'undefined' && parsed.origin.toLowerCase() === window.location.origin.toLowerCase()
  if (isSameOrigin) {
    try {
      const resolved = router.resolve(parsed.pathname + parsed.search + parsed.hash)
      if (resolved?.meta?.guestOnly) {
        return { valid: false, empty: false, error: 'Release link cannot point to a guest-only page.' }
      }
    } catch {
      // Ignored if resolve fails
    }
  }

  return { valid: true, empty: false, url: trimmed }
}

const applyReleaseData = (data) => {
  if (!data || typeof data !== 'object' || typeof data.latest_build !== 'number') {
    isFailure.value = true
    errorMessage.value = 'Invalid release metadata received from server.'
    return false
  }

  releaseData.value = data
  const urlValidation = validateReleaseUrl(data.download_url)
  if (!urlValidation.valid) {
    if (urlValidation.empty) {
      isUnavailable.value = true
      errorMessage.value = urlValidation.error
    } else {
      isFailure.value = true
      errorMessage.value = urlValidation.error
    }
    return false
  }

  validUrl.value = urlValidation.url
  return true
}

const loadReleaseInfo = async (force = false) => {
  const versionKey = 'public::app::version'
  if (!force) {
    const cached = cacheStore.get(versionKey)
    if (cached && !cached.isExpired) {
      const ok = applyReleaseData(cached.data)
      if (ok) {
        isLoading.value = false
        errorMessage.value = ''
        return
      }
    }
  }

  if (abortController) {
    abortController.abort()
  }
  abortController = new AbortController()
  const requestId = ++currentRequestId

  isLoading.value = true
  errorMessage.value = ''
  isUnavailable.value = false
  isFailure.value = false
  releaseData.value = null
  validUrl.value = ''

  try {
    const data = await fetchAppVersion({ signal: abortController.signal })
    if (requestId !== currentRequestId) return

    const ok = applyReleaseData(data)
    if (ok) {
      cacheStore.set(versionKey, data, VERSION_TTL)
    }
  } catch (err) {
    if (requestId !== currentRequestId) return
    if (err?.name === 'CanceledError' || err?.name === 'AbortError') return
    isFailure.value = true
    errorMessage.value = extractErrorMessage(
      err,
      'Unable to connect to the release server. Please try again.',
    )
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
      nextTick(() => {
        if (modalRef.value && !modalRef.value.contains(document.activeElement)) {
          cancelBtnRef.value?.focus()
        }
      })
    }
  }
}

const trapFocus = (event) => {
  if (event.key !== 'Tab' || !modalRef.value) return
  const focusables = modalRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === last) {
      first.focus()
      event.preventDefault()
    }
  }
}

const handleKeyDown = (event) => {
  if (!props.isOpen) return
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  trapFocus(event)
}

const handleConfirm = () => {
  if (!validUrl.value) return
  window.open(validUrl.value, '_blank', 'noopener,noreferrer')
  emit('close')
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      previouslyFocusedElement = document.activeElement
      loadReleaseInfo()
      nextTick(() => {
        cancelBtnRef.value?.focus()
      })
    } else {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
      currentRequestId++
      isLoading.value = false
      if (
        previouslyFocusedElement &&
        typeof previouslyFocusedElement.focus === 'function' &&
        document.body.contains(previouslyFocusedElement)
      ) {
        previouslyFocusedElement.focus()
      }
      previouslyFocusedElement = null
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (abortController) {
    abortController.abort()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="modalRef"
      class="download-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-dialog-title"
      aria-describedby="download-dialog-desc"
      @click.self="emit('close')"
    >
      <div class="download-modal-card">
        <div class="download-modal-header">
          <div class="header-title-wrap">
            <AppIcon name="download" :size="20" class="header-icon" />
            <h3 id="download-dialog-title" class="download-modal-title">
              Download Android Game
            </h3>
          </div>
          <button
            type="button"
            class="modal-close-btn"
            aria-label="Close download dialog"
            @click="emit('close')"
          >
            <AppIcon name="x" :size="18" />
          </button>
        </div>

        <div class="download-modal-body">
          <p id="download-dialog-desc" class="modal-desc">
            CyberMorph runs locally on Android devices. Confirm to open the external release page or package link.
          </p>

          <!-- State 1: Loading -->
          <div v-if="isLoading" class="state-box loading-box" aria-live="polite">
            <div class="spinner spinner-xs" aria-hidden="true"></div>
            <span>Checking latest release build...</span>
          </div>

          <!-- State 2: Failure / Network Error -->
          <div v-else-if="isFailure" class="state-box error-box" role="alert">
            <div class="error-text-row">
              <AppIcon name="alert" :size="16" class="alert-icon" />
              <span>{{ errorMessage }}</span>
            </div>
            <button
              type="button"
              class="btn-retry"
              :disabled="isLoading"
              @click="loadReleaseInfo"
            >
              <AppIcon name="refresh" :size="14" />
              <span>Retry</span>
            </button>
          </div>

          <!-- State 3: Unavailable (Empty download_url or awaiting release) -->
          <div v-else-if="isUnavailable" class="state-box info-box" role="status">
            <div class="error-text-row">
              <AppIcon name="info" :size="16" class="alert-icon" />
              <span>{{ errorMessage }}</span>
            </div>
          </div>

          <!-- State 4: Ready / Valid release -->
          <div v-else-if="releaseData" class="state-box ready-box">
            <div class="release-info-row">
              <span class="info-label">Build version:</span>
              <span class="build-badge">Build {{ releaseData.latest_build }}</span>
            </div>
            <p class="release-note">
              Selecting “Open release link” will open the external package or release page in a new tab.
            </p>
          </div>
        </div>

        <div class="download-modal-actions">
          <button
            ref="cancelBtnRef"
            type="button"
            class="btn-outline modal-btn"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            ref="confirmBtnRef"
            type="button"
            class="btn-primary modal-btn"
            :disabled="!validUrl || isLoading || isUnavailable || isFailure"
            aria-label="Open release link in a new tab"
            @click="handleConfirm"
          >
            <AppIcon name="external-link" :size="16" />
            <span>Open release link</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.download-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  padding: 0.5rem;
  overflow-y: auto;
  box-sizing: border-box;
}

.download-modal-card {
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 1rem);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto;
}

.download-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.header-icon {
  color: var(--color-primary);
}

.download-modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.modal-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-dim);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close-btn:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
}

.modal-close-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.download-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.modal-desc {
  margin: 0;
  font-size: 0.92rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.state-box {
  border-radius: 8px;
  padding: 0.875rem 1rem;
  font-size: 0.88rem;
  box-sizing: border-box;
}

.loading-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.error-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.info-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.error-text-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  line-height: 1.45;
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.btn-retry {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover {
  background-color: var(--color-danger-bg);
}

.ready-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-text-main);
}

.release-info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.build-badge {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-card);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--color-violet-border);
}

.release-note {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.download-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-subtle);
  flex-shrink: 0;
}

.modal-btn {
  min-height: 40px;
  font-size: 0.88rem;
}

@media (max-width: 480px) {
  .download-modal-actions {
    flex-direction: column-reverse;
  }

  .modal-btn {
    width: 100%;
  }
}
</style>
