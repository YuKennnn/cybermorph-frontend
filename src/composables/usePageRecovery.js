import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'

/**
 * Shared recovery mechanism for returning to a visible page after a substantial
 * absence (laptop sleep, tab backgrounding) or network reconnection.
 *
 * Requirements:
 * - Coalesces overlapping resume/online events into a single coordinated refresh.
 * - Prevents duplicate active requests while a refresh is in flight.
 * - Detects sleep/hibernation clock jump without continuously polling the network.
 * - Active only while the consuming dashboard component is mounted and visible.
 * - Never replays writes (mutations). Only calls the supplied read refresh handler.
 *
 * @param {Function} onRecover - Async callback to refresh current view data
 * @param {Object} [options]
 * @param {number} [options.minAbsenceMs=30000] - Minimum absence duration (ms) to trigger recovery (default: 30s)
 * @param {number} [options.coalesceMs=1000] - Debounce window (ms) to merge simultaneous online/visibility events
 * @returns {{ isRecovering: import('vue').Ref<boolean>, triggerRecovery: () => void }}
 */
export function usePageRecovery(onRecover, { minAbsenceMs = 30000, coalesceMs = 1000 } = {}) {
  const isRecovering = ref(false)
  let lastActiveTime = Date.now()
  let lastHeartbeatTime = Date.now()
  let coalesceTimer = null
  let heartbeatInterval = null
  let activeRecoveryPromise = null

  const executeRecovery = async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }
    if (isRecovering.value) {
      return activeRecoveryPromise
    }

    isRecovering.value = true
    activeRecoveryPromise = (async () => {
      try {
        if (typeof onRecover === 'function') {
          await onRecover()
        }
      } catch {
        // Errors are handled by the dashboard's own section error states
      } finally {
        isRecovering.value = false
        activeRecoveryPromise = null
        lastActiveTime = Date.now()
        lastHeartbeatTime = Date.now()
      }
    })()

    return activeRecoveryPromise
  }

  const triggerRecovery = ({ immediate = false } = {}) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }

    // Repeated events during an active recovery must not start duplicate requests
    if (isRecovering.value) {
      return activeRecoveryPromise
    }

    if (coalesceTimer) {
      clearTimeout(coalesceTimer)
      coalesceTimer = null
    }

    if (immediate) {
      return executeRecovery()
    }

    coalesceTimer = setTimeout(() => {
      coalesceTimer = null
      executeRecovery()
    }, coalesceMs)
  }

  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') {
      const now = Date.now()
      const absenceDuration = now - lastActiveTime
      if (absenceDuration >= minAbsenceMs) {
        triggerRecovery()
      }
      lastActiveTime = now
      lastHeartbeatTime = now
    } else {
      lastActiveTime = Date.now()
    }
  }

  const handleOnline = () => {
    // Treat browser online status as a connectivity hint, not proof the API is reachable.
    // Trigger recovery if the current view is active and visible.
    triggerRecovery()
  }

  const handlePageShow = (event) => {
    // Handles page restored from bfcache or tab resumed
    if (event?.persisted || Date.now() - lastActiveTime >= minAbsenceMs) {
      triggerRecovery()
    }
    lastActiveTime = Date.now()
    lastHeartbeatTime = Date.now()
  }

  const setupLifecycle = () => {
    lastActiveTime = Date.now()
    lastHeartbeatTime = Date.now()

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('pageshow', handlePageShow)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    // Heartbeat check: detects sleep / hibernation clock jumps without making network calls
    heartbeatInterval = setInterval(() => {
      const now = Date.now()
      const timeJump = now - lastHeartbeatTime
      lastHeartbeatTime = now
      if (timeJump >= minAbsenceMs) {
        triggerRecovery()
      }
    }, 5000)
  }

  const cleanupLifecycle = () => {
    if (coalesceTimer) {
      clearTimeout(coalesceTimer)
      coalesceTimer = null
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pageshow', handlePageShow)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  if (getCurrentInstance()) {
    onMounted(setupLifecycle)
    onUnmounted(cleanupLifecycle)
  }

  return {
    isRecovering,
    triggerRecovery,
    cleanupLifecycle,
  }
}
