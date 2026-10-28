import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchThreatIndex } from '../api/player.js'
import { useAuthStore } from './authStore.js'

/**
 * Eight canonical DICT threat categories in exact backend order (`API_GUIDE.md` §Players),
 * paired with the existing documented educational summaries from `GameplayView.vue`.
 */
export const CANONICAL_THREAT_CATEGORIES = Object.freeze([
  Object.freeze({
    number: '01',
    threat_name: 'Phishing',
    summary:
      'Deceptive email messages and fraudulent login pages designed to trick people into surrendering usernames and passwords.',
  }),
  Object.freeze({
    number: '02',
    threat_name: 'Smishing',
    summary:
      'SMS-based text message scams using fake package delivery notices or urgent account suspensions to induce clicks.',
  }),
  Object.freeze({
    number: '03',
    threat_name: 'Vishing',
    summary:
      'Voice calls where attackers impersonate bank agents, technical support personnel, or government agencies.',
  }),
  Object.freeze({
    number: '04',
    threat_name: 'Social Engineering',
    summary:
      'Psychological manipulation techniques that exploit urgency, trust, or authority to bypass security procedures.',
  }),
  Object.freeze({
    number: '05',
    threat_name: 'Credential Theft / Weak Password Attack',
    summary:
      'Attacks targeting login credentials, including password reuse, keylogging, and weak password choices.',
  }),
  Object.freeze({
    number: '06',
    threat_name: 'Public Wi-Fi Attack',
    summary:
      'Rogue access points, "evil twin" networks, and packet interception on unencrypted public Wi-Fi connections.',
  }),
  Object.freeze({
    number: '07',
    threat_name: 'Malware Infection',
    summary:
      'Dangerous email attachments, malicious installers, and compromised download links that deploy harmful software.',
  }),
  Object.freeze({
    number: '08',
    threat_name: 'Ransomware',
    summary:
      'Malicious programs that lock or encrypt files, along with essential backup strategies and defensive habits.',
  }),
])

const CANONICAL_BY_NAME = new Map(
  CANONICAL_THREAT_CATEGORIES.map((category) => [category.threat_name, category]),
)

/**
 * Formats a threat unlock timestamp (`unlocked_at`) for display.
 * Missing unlock dates on unlocked records return "Unlock date unavailable".
 *
 * @param {string | null | undefined} unlockedAt
 * @returns {string}
 */
export const formatThreatUnlockDate = (unlockedAt) => {
  if (typeof unlockedAt !== 'string' || unlockedAt.trim() === '') {
    return 'Unlock date unavailable'
  }
  const parsedMs = Date.parse(unlockedAt)
  if (Number.isNaN(parsedMs)) {
    return 'Unlock date unavailable'
  }
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(parsedMs))
    return `Unlocked ${formatted}`
  } catch {
    return 'Unlock date unavailable'
  }
}

/**
 * Validates raw `GET /players/threat-index` payload strictly against the backend contract.
 * - Never manufactures locked entries for missing records.
 * - Distinguishes `[]` ("empty") from incomplete, duplicate, or malformed payloads.
 *
 * @param {unknown} rawData
 * @returns {{
 *   status: 'ready' | 'empty' | 'incomplete' | 'malformed',
 *   entries: Array<{
 *     number: string,
 *     threat_name: string,
 *     summary: string,
 *     is_unlocked: boolean,
 *     unlocked_at: string | null,
 *     unlock_date_label: string | null
 *   }>,
 *   error: string
 * }}
 */
export const validateThreatIndexResponse = (rawData) => {
  if (!Array.isArray(rawData)) {
    return {
      status: 'malformed',
      entries: [],
      error: 'Threat index data is malformed or unavailable.',
    }
  }

  if (rawData.length === 0) {
    return {
      status: 'empty',
      entries: [],
      error: '',
    }
  }

  const recordsByName = new Map()

  for (const item of rawData) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        status: 'malformed',
        entries: [],
        error: 'Threat index data is malformed or unavailable.',
      }
    }

    const { threat_name: threatName, is_unlocked: isUnlocked, unlocked_at: unlockedAt } = item

    if (typeof threatName !== 'string' || !CANONICAL_BY_NAME.has(threatName)) {
      return {
        status: 'malformed',
        entries: [],
        error: 'Threat index response contains unrecognized threat categories.',
      }
    }

    if (typeof isUnlocked !== 'boolean') {
      return {
        status: 'malformed',
        entries: [],
        error: 'Threat index response contains invalid unlock states.',
      }
    }

    if (unlockedAt !== null && unlockedAt !== undefined) {
      if (typeof unlockedAt !== 'string' || unlockedAt.trim() === '' || Number.isNaN(Date.parse(unlockedAt))) {
        return {
          status: 'malformed',
          entries: [],
          error: 'Threat index response contains invalid unlock dates.',
        }
      }
      if (!isUnlocked) {
        return {
          status: 'malformed',
          entries: [],
          error: 'Threat index response contains inconsistent unlock state and timestamp.',
        }
      }
    }

    if (recordsByName.has(threatName)) {
      return {
        status: 'malformed',
        entries: [],
        error: 'Threat index response contains duplicate threat categories.',
      }
    }

    recordsByName.set(threatName, {
      threat_name: threatName,
      is_unlocked: isUnlocked,
      unlocked_at: typeof unlockedAt === 'string' ? unlockedAt.trim() : null,
    })
  }

  if (recordsByName.size !== CANONICAL_THREAT_CATEGORIES.length) {
    return {
      status: 'incomplete',
      entries: [],
      error: 'Threat index data is incomplete. Not all threat categories were returned.',
    }
  }

  const entries = CANONICAL_THREAT_CATEGORIES.map((meta) => {
    const record = recordsByName.get(meta.threat_name)
    return {
      number: meta.number,
      threat_name: meta.threat_name,
      summary: meta.summary,
      is_unlocked: record.is_unlocked,
      unlocked_at: record.unlocked_at,
      unlock_date_label: record.is_unlocked
        ? formatThreatUnlockDate(record.unlocked_at)
        : null,
    }
  })

  return {
    status: 'ready',
    entries,
    error: '',
  }
}

const buildAccountScopeKey = (authStore) => {
  if (!authStore?.token) return null
  const identity =
    authStore.user?.user_id ||
    authStore.user?.profile_id ||
    authStore.user?.email ||
    authStore.user?.username ||
    'authenticated'
  return `${authStore.token}::${identity}`
}

export const useThreatIndexStore = defineStore('threatIndex', () => {
  // ==========================================
  // 1. STATE (In-Memory Only, Account-Isolated)
  // ==========================================
  const entries = ref([])
  const status = ref('idle') // 'idle' | 'loading' | 'ready' | 'empty' | 'incomplete' | 'malformed' | 'error'
  const error = ref('')
  const isRefreshing = ref(false)
  const loadedAccountKey = ref(null)

  let currentRequestId = 0
  let activeFetchPromise = null

  // ==========================================
  // 2. GETTERS
  // ==========================================
  const isLoading = computed(() => status.value === 'loading')
  const isReady = computed(() => status.value === 'ready')
  const isEmpty = computed(() => status.value === 'empty')
  const isIncomplete = computed(() => status.value === 'incomplete')
  const isMalformed = computed(() => status.value === 'malformed')
  const isUnavailable = computed(
    () =>
      status.value === 'error' ||
      status.value === 'incomplete' ||
      status.value === 'malformed',
  )

  const totalCount = computed(() =>
    status.value === 'ready' ? entries.value.length : null,
  )

  const unlockedCount = computed(() =>
    status.value === 'ready'
      ? entries.value.filter((entry) => entry.is_unlocked === true).length
      : null,
  )

  const lockedCount = computed(() =>
    status.value === 'ready'
      ? entries.value.filter((entry) => entry.is_unlocked === false).length
      : null,
  )

  const progressPercentage = computed(() => {
    if (status.value !== 'ready' || !totalCount.value) return 0
    return Math.round((unlockedCount.value / totalCount.value) * 100)
  })

  const progressText = computed(() => {
    if (status.value === 'ready') {
      return `${unlockedCount.value}/${totalCount.value} unlocked`
    }
    if (status.value === 'empty') {
      return 'No threat-index entries available'
    }
    return null
  })

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const clearState = () => {
    currentRequestId++
    activeFetchPromise = null
    entries.value = []
    status.value = 'idle'
    error.value = ''
    isRefreshing.value = false
  }

  const reset = () => {
    clearState()
    loadedAccountKey.value = null
  }

  const syncAccountScope = () => {
    const authStore = useAuthStore()
    const currentKey = buildAccountScopeKey(authStore)
    if (currentKey !== loadedAccountKey.value) {
      clearState()
      loadedAccountKey.value = currentKey
    }
    return currentKey
  }

  /**
   * Fetches and validates the player's threat index from `GET /players/threat-index`.
   * - Deduplicates concurrent requests for the same account unless `force` is true.
   * - Discards responses if the user logs out, switches accounts, or starts a newer forced fetch.
   * - Never fabricates locked entries when records are missing, malformed, or failed.
   */
  const loadThreatIndex = async ({ force = false } = {}) => {
    const authStore = useAuthStore()
    const scopeKeyAtStart = syncAccountScope()

    if (!scopeKeyAtStart || !authStore.token) {
      reset()
      return []
    }

    if (
      !force &&
      (status.value === 'ready' || status.value === 'empty') &&
      loadedAccountKey.value === scopeKeyAtStart
    ) {
      return entries.value
    }

    if (activeFetchPromise && !force) {
      return activeFetchPromise
    }

    const reqId = ++currentRequestId
    const hadPriorState = status.value !== 'idle'
    if (hadPriorState && force) {
      isRefreshing.value = true
    } else {
      status.value = 'loading'
      isRefreshing.value = false
    }
    error.value = ''

    const fetchPromise = (async () => {
      try {
        const rawData = await fetchThreatIndex()

        const currentKeyAfterFetch = buildAccountScopeKey(authStore)
        if (
          reqId !== currentRequestId ||
          !authStore.token ||
          currentKeyAfterFetch !== scopeKeyAtStart
        ) {
          return entries.value
        }

        const validation = validateThreatIndexResponse(rawData)
        status.value = validation.status
        entries.value = validation.entries
        error.value = validation.error
        loadedAccountKey.value = currentKeyAfterFetch
        return entries.value
      } catch (err) {
        const currentKeyOnError = buildAccountScopeKey(authStore)
        if (
          reqId !== currentRequestId ||
          !authStore.token ||
          currentKeyOnError !== scopeKeyAtStart
        ) {
          return entries.value
        }

        entries.value = []
        status.value = 'error'
        error.value =
          typeof err?.response?.data?.detail === 'string'
            ? err.response.data.detail
            : 'Unable to load threat index progress. Please try again.'
        throw err
      } finally {
        if (reqId === currentRequestId) {
          isRefreshing.value = false
        }
        if (activeFetchPromise === fetchPromise) {
          activeFetchPromise = null
        }
      }
    })()

    activeFetchPromise = fetchPromise
    return fetchPromise
  }

  return {
    // State
    entries,
    status,
    error,
    isRefreshing,
    loadedAccountKey,
    // Getters
    isLoading,
    isReady,
    isEmpty,
    isIncomplete,
    isMalformed,
    isUnavailable,
    totalCount,
    unlockedCount,
    lockedCount,
    progressPercentage,
    progressText,
    // Actions
    loadThreatIndex,
    syncAccountScope,
    reset,
  }
})
