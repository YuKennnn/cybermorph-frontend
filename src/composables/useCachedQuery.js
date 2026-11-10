import { ref, isRef, unref, watch, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useApiCacheStore } from '../stores/apiCacheStore'

/**
 * Composable for cached, bounded queries adhering to CyberMorph caching baseline:
 * - Immediate return on fresh cache hit (0 network requests).
 * - Background revalidation for expired data while keeping UI stable.
 * - Guarded against obsolete completions (epoch, keyVersion, active key, requestId).
 * - Late response can populate its valid cache entry without mutating another filter's table.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>|string|(() => string)} options.key - Canonical cache key
 * @param {Function} options.fetcher - Async function returning data
 * @param {number} options.ttlMs - Freshness TTL in milliseconds
 * @param {boolean} [options.immediate=true] - Whether to fetch immediately on mount/watch
 */
export function useCachedQuery({ key, fetcher, ttlMs, immediate = true }) {
  const authStore = useAuthStore()
  const cacheStore = useApiCacheStore()

  const data = ref(null)
  const isLoading = ref(true)
  const isRefreshing = ref(false)
  const isError = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  let localRequestId = 0
  let latestRequestId = 0
  const activeSubscriptionKey = ref('')

  const getKey = () => {
    if (typeof key === 'function') return key()
    return isRef(key) ? unref(key) : key
  }

  const execute = async ({ force = false, checkFreshness = false } = {}) => {
    const targetKey = getKey()
    if (!targetKey) return null

    activeSubscriptionKey.value = targetKey
    const reqId = ++localRequestId
    latestRequestId = reqId

    const reqAuthEpoch = authStore.activeSessionEpoch
    const reqKeyVersion = cacheStore.getKeyVersion(targetKey)

    // 1. Check cache hit
    const cached = cacheStore.get(targetKey)
    if (cached && !force) {
      data.value = cached.data
      lastUpdated.value = cached.fetchedAt

      // If fresh or checkFreshness requested and not expired: return immediately with 0 network calls
      if (!cached.isExpired) {
        isLoading.value = false
        isRefreshing.value = false
        isError.value = false
        return cached.data
      }

      if (checkFreshness) {
        // Stale, but checkFreshness allows background refresh
        isLoading.value = false
        isRefreshing.value = true
      } else {
        // Expired; display cached data while refreshing
        isLoading.value = false
        isRefreshing.value = true
      }
    } else {
      if (reqId === latestRequestId) {
        isLoading.value = true
        isError.value = false
      }
    }

    // 2. Check in-flight deduplication
    let inFlight = cacheStore.getInFlight(targetKey)
    if (!inFlight || inFlight.authEpoch !== reqAuthEpoch || inFlight.keyVersion !== reqKeyVersion) {
      const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
      const fetchPromise = (async () => {
        try {
          return await fetcher({ signal: abortController?.signal, targetKey })
        } finally {
          cacheStore.clearInFlight(targetKey)
        }
      })()

      inFlight = {
        promise: fetchPromise,
        authEpoch: reqAuthEpoch,
        keyVersion: reqKeyVersion,
        abortController,
      }
      cacheStore.registerInFlight(targetKey, inFlight)
    }

    try {
      const result = await inFlight.promise

      // 3. Obsolete completion guard:
      // If epoch changed, or keyVersion bumped (invalidated/refreshed), discard completely!
      if (
        reqAuthEpoch !== authStore.activeSessionEpoch ||
        reqKeyVersion !== cacheStore.getKeyVersion(targetKey)
      ) {
        return null
      }

      // 4. Valid Cache Population:
      // Response matches its generation and keyVersion, so it populates its valid cache entry!
      cacheStore.set(targetKey, result, ttlMs)

      // 5. Mounted View Guard:
      // Only update view refs if the component is still actively subscribed to this exact key
      if (targetKey === activeSubscriptionKey.value) {
        data.value = result
        lastUpdated.value = Date.now()
        isError.value = false
        error.value = null
      }

      return result
    } catch (err) {
      if (
        reqAuthEpoch !== authStore.activeSessionEpoch ||
        reqKeyVersion !== cacheStore.getKeyVersion(targetKey)
      ) {
        return null
      }

      // Only set error on the mounted view if still subscribed
      if (targetKey === activeSubscriptionKey.value) {
        isError.value = true
        error.value = err
      }
      throw err
    } finally {
      // 6. Request-Identity Cleanup:
      // Only reset loading/refreshing flags if this was the latest request for the component
      if (reqId === latestRequestId) {
        isLoading.value = false
        isRefreshing.value = false
      }
    }
  }

  if (isRef(key) || typeof key === 'function') {
    watch(
      () => getKey(),
      (newKey, oldKey) => {
        if (newKey && newKey !== oldKey) {
          execute()
        }
      },
    )
  }

  if (immediate) {
    execute()
  }

  onUnmounted(() => {
    activeSubscriptionKey.value = ''
  })

  return {
    data,
    isLoading,
    isRefreshing,
    isError,
    error,
    lastUpdated,
    refresh: (opts) => execute({ force: true, ...opts }),
    revalidate: (opts) => execute({ force: false, ...opts }),
  }
}
