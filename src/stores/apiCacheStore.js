import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const MAX_CACHE_ENTRIES = 100

export const useApiCacheStore = defineStore('apiCache', () => {
  // In-memory bounded cache map: key -> { data, expiresAt, fetchedAt }
  const cache = new Map()
  const cacheCount = ref(0)

  // Key versions map: canonicalKey -> number
  const keyVersions = new Map()

  // Prefix versions map: prefix -> number (ensures all pending/unseen keys under prefix advance)
  const prefixVersions = new Map()

  // In-flight request registry: key -> { promise, authEpoch, keyVersion, abortController }
  const inFlightRequests = new Map()

  const getPrefixVersion = (key) => {
    let sum = 0
    for (const [prefix, ver] of prefixVersions.entries()) {
      if (key.startsWith(prefix)) {
        sum += ver
      }
    }
    return sum
  }

  const getKeyVersion = (key) => {
    return (keyVersions.get(key) || 0) + getPrefixVersion(key)
  }

  const bumpKeyVersion = (key) => {
    const next = (keyVersions.get(key) || 0) + 1
    keyVersions.set(key, next)
    return next + getPrefixVersion(key)
  }

  const get = (key) => {
    const entry = cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now > entry.expiresAt) {
      return {
        data: entry.data,
        isExpired: true,
        fetchedAt: entry.fetchedAt,
      }
    }

    return {
      data: entry.data,
      isExpired: false,
      fetchedAt: entry.fetchedAt,
    }
  }

  const set = (key, data, ttlMs) => {
    // Evict oldest if reaching capacity
    if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
      const oldestKey = cache.keys().next().value
      if (oldestKey) {
        cache.delete(oldestKey)
      }
    }

    const now = Date.now()
    cache.set(key, {
      data,
      expiresAt: now + ttlMs,
      fetchedAt: now,
    })
    cacheCount.value = cache.size
  }

  const invalidateKey = (key) => {
    cache.delete(key)
    cacheCount.value = cache.size
    bumpKeyVersion(key)

    // Detach and abort in-flight request if present
    const inFlight = inFlightRequests.get(key)
    if (inFlight) {
      if (inFlight.abortController?.abort) {
        try {
          inFlight.abortController.abort()
        } catch {
          // ignore abort error
        }
      }
      inFlightRequests.delete(key)
    }
  }

  const invalidatePrefix = (prefix) => {
    // Advance prefix version counter so all pending/unseen keys under prefix advance
    const currentPrefixVer = prefixVersions.get(prefix) || 0
    prefixVersions.set(prefix, currentPrefixVer + 1)

    for (const key of Array.from(cache.keys())) {
      if (key.startsWith(prefix)) {
        cache.delete(key)
        bumpKeyVersion(key)
      }
    }
    cacheCount.value = cache.size

    // Detach and abort matching in-flight requests
    for (const [key, inFlight] of Array.from(inFlightRequests.entries())) {
      if (key.startsWith(prefix)) {
        bumpKeyVersion(key)
        if (inFlight.abortController?.abort) {
          try {
            inFlight.abortController.abort()
          } catch {
            // ignore abort error
          }
        }
        inFlightRequests.delete(key)
      }
    }
  }

  /**
   * Single Invalidation Rule for approve, reject, and approval 409:
   * Clears all approval variants, Users and user lookups, and audit logs.
   * System stats (admin::stats::summary) is intentionally left on its independent TTL.
   */
  const invalidateApprovalMutations = () => {
    invalidatePrefix('admin::approvals::')
    invalidatePrefix('admin::users::')
    invalidatePrefix('admin::logs::')
  }

  const registerInFlight = (key, entry) => {
    inFlightRequests.set(key, entry)
  }

  const getInFlight = (key) => {
    return inFlightRequests.get(key) || null
  }

  const clearInFlight = (key) => {
    inFlightRequests.delete(key)
  }

  const clearAll = () => {
    cache.clear()
    cacheCount.value = 0
    for (const inFlight of inFlightRequests.values()) {
      if (inFlight.abortController?.abort) {
        try {
          inFlight.abortController.abort()
        } catch {
          // ignore
        }
      }
    }
    inFlightRequests.clear()
    keyVersions.clear()
    prefixVersions.clear()
  }

  const size = computed(() => cacheCount.value)

  return {
    get,
    set,
    size,
    invalidateKey,
    invalidate: invalidateKey,
    invalidatePrefix,
    invalidateApprovalMutations,
    getKeyVersion,
    bumpKeyVersion,
    registerInFlight,
    getInFlight,
    clearInFlight,
    clearAll,
  }
})
