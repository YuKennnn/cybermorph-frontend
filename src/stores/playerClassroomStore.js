import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchMyClassroom, leaveMyClassroom } from '../api/classroom.js'
import { useAuthStore } from './authStore.js'

export const PLAYER_MAP_NAMES = Object.freeze([
  'Home',
  'Office',
  'Internet Cafe',
  'Public Park',
])

/**
 * Formats a player's numeric `map_progress` (0–3) using the documented map names.
 * Maps with index <= map_progress are unlocked:
 * 0 = Home; 1 = Office; 2 = Internet Cafe; 3 = Public Park.
 * Missing or invalid values return 'Map progress unavailable'.
 *
 * @param {unknown} mapProgress
 * @returns {string}
 */
export const formatMemberMapProgress = (mapProgress) => {
  if (
    typeof mapProgress !== 'number' ||
    !Number.isInteger(mapProgress) ||
    mapProgress < 0 ||
    mapProgress >= PLAYER_MAP_NAMES.length
  ) {
    return 'Map progress unavailable'
  }
  const mapNumber = mapProgress + 1
  return `Map ${mapNumber} of ${PLAYER_MAP_NAMES.length} · ${PLAYER_MAP_NAMES[mapProgress]}`
}

/**
 * Formats a classroom `joined_at` timestamp for display.
 * @param {string | null | undefined} joinedAt
 * @returns {string}
 */
export const formatClassroomJoinedDate = (joinedAt) => {
  if (typeof joinedAt !== 'string' || joinedAt.trim() === '') {
    return 'Join date unavailable'
  }
  const parsedMs = Date.parse(joinedAt)
  if (Number.isNaN(parsedMs)) {
    return 'Join date unavailable'
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(parsedMs))
  } catch {
    return 'Join date unavailable'
  }
}

/**
 * Checks whether an Axios error is the documented `404 {"detail": "You are not in a classroom"}`
 * from `GET /classroom/mine` or `DELETE /classroom/mine`.
 * @param {unknown} err
 * @returns {boolean}
 */
export const isNotEnrolledClassroom404 = (err) => {
  if (err?.response?.status !== 404) return false
  const detail = err?.response?.data?.detail
  return (
    typeof detail === 'string' &&
    detail.trim().toLowerCase() === 'you are not in a classroom'
  )
}

/**
 * Validates and normalizes `MyClassroomResponse` from `GET /classroom/mine`.
 * Documented shape: `{ code_id, name, educator_name, joined_at, member_count, members: [{ username, map_progress }] }`
 * @param {unknown} raw
 */
export const validateMyClassroomPayload = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      data: null,
      error: 'Classroom details could not be loaded.',
    }
  }

  const codeId = typeof raw.code_id === 'string' ? raw.code_id.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!codeId || !name || !Array.isArray(raw.members)) {
    return {
      valid: false,
      data: null,
      error: 'Classroom details are incomplete or unavailable.',
    }
  }

  const normalizedMembers = []
  for (const item of raw.members) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        valid: false,
        data: null,
        error: 'Classroom member list is malformed.',
      }
    }
    const username = typeof item.username === 'string' ? item.username.trim() : ''
    const isProgressValid =
      typeof item.map_progress === 'number' &&
      Number.isInteger(item.map_progress) &&
      item.map_progress >= 0 &&
      item.map_progress <= 3
    if (!username || !isProgressValid) {
      return {
        valid: false,
        data: null,
        error: 'Classroom member list contains invalid entries.',
      }
    }
    normalizedMembers.push({
      username,
      map_progress: item.map_progress,
      map_label: formatMemberMapProgress(item.map_progress),
    })
  }

  normalizedMembers.sort((a, b) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }),
  )

  const educatorName =
    typeof raw.educator_name === 'string' && raw.educator_name.trim() !== ''
      ? raw.educator_name.trim()
      : null

  const joinedAt =
    typeof raw.joined_at === 'string' && raw.joined_at.trim() !== ''
      ? raw.joined_at.trim()
      : null

  const memberCount =
    typeof raw.member_count === 'number' && Number.isFinite(raw.member_count)
      ? raw.member_count
      : normalizedMembers.length

  return {
    valid: true,
    data: {
      code_id: codeId,
      name,
      educator_name: educatorName,
      joined_at: joinedAt,
      joined_date_label: formatClassroomJoinedDate(joinedAt),
      member_count: memberCount,
      members: normalizedMembers,
    },
    error: '',
  }
}

const buildAccountScopeKey = (authStore) => {
  if (!authStore?.token) return null
  if (authStore.userRole && authStore.userRole !== 'player') return null
  const identity =
    authStore.user?.user_id ||
    authStore.user?.profile_id ||
    authStore.user?.email ||
    authStore.user?.username ||
    'authenticated'
  return `${authStore.token}::${identity}`
}

export const usePlayerClassroomStore = defineStore('playerClassroom', () => {
  // ==========================================
  // 1. STATE (In-Memory Only, Account-Isolated)
  // ==========================================
  const membership = ref(null)
  const status = ref('idle') // 'idle' | 'loading' | 'enrolled' | 'unenrolled' | 'error'
  const error = ref('')
  const isRefreshing = ref(false)
  const isLeaving = ref(false)
  const joinSucceededRefreshFailed = ref(false)
  const partialJoinInfo = ref(null)
  const flashMessage = ref('')
  const loadedAccountKey = ref(null)

  let currentRequestId = 0
  let mutationVersion = 0
  let activeFetchPromise = null
  let activeLeavePromise = null

  // ==========================================
  // 2. GETTERS
  // ==========================================
  const isLoading = computed(() => status.value === 'loading')
  const isEnrolled = computed(
    () => status.value === 'enrolled' && Boolean(membership.value),
  )
  const isUnenrolled = computed(() => status.value === 'unenrolled')
  const hasError = computed(
    () => status.value === 'error' || Boolean(error.value),
  )
  const isNeutralState = computed(
    () =>
      status.value === 'idle' ||
      status.value === 'loading' ||
      status.value === 'error',
  )

  /**
   * Sidebar navigation label:
   * - Confirmed enrolled: "My classroom"
   * - Confirmed unenrolled (404): "Join classroom"
   * - Unknown / loading / error (or post-join refresh error): neutral "Classroom"
   */
  const navLabel = computed(() => {
    if (isEnrolled.value) return 'My classroom'
    if (isUnenrolled.value) return 'Join classroom'
    return 'Classroom'
  })

  /**
   * Sidebar & dashboard target route:
   * - Confirmed unenrolled (404): "/classroom/join"
   * - Enrolled, unknown, loading, or error: "/classroom"
   */
  const navRoute = computed(() => {
    if (isUnenrolled.value) return '/classroom/join'
    return '/classroom'
  })

  /**
   * Dashboard action button label:
   * - Confirmed enrolled: "My classroom"
   * - Confirmed unenrolled (404): "+ Join classroom"
   * - Unknown / loading / error: "Classroom"
   */
  const dashboardActionLabel = computed(() => {
    if (isEnrolled.value) return 'My classroom'
    if (isUnenrolled.value) return '+ Join classroom'
    return 'Classroom'
  })

  /**
   * Centralized redirect decision for `/classroom` and `/classroom/join`.
   * Never redirects during `idle`, `loading`, or `error` (except routing `/classroom/join` -> `/classroom`
   * when join succeeded and details refresh failed), preventing redirect loops.
   * @param {string} currentPath
   * @returns {string | null}
   */
  const resolveRedirectForPath = (currentPath) => {
    if (currentPath === '/classroom/join') {
      if (isEnrolled.value || joinSucceededRefreshFailed.value) {
        return '/classroom'
      }
      return null
    }
    if (currentPath === '/classroom') {
      if (isUnenrolled.value && !joinSucceededRefreshFailed.value) {
        return '/classroom/join'
      }
      return null
    }
    return null
  }

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const clearState = () => {
    currentRequestId++
    mutationVersion++
    activeFetchPromise = null
    activeLeavePromise = null
    membership.value = null
    status.value = 'idle'
    error.value = ''
    isRefreshing.value = false
    isLeaving.value = false
    joinSucceededRefreshFailed.value = false
    partialJoinInfo.value = null
    flashMessage.value = ''
  }

  const reset = () => {
    clearState()
    loadedAccountKey.value = null
  }

  const clearFlashMessage = () => {
    flashMessage.value = ''
  }

  const setFlashMessage = (msg) => {
    flashMessage.value = typeof msg === 'string' ? msg : ''
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
   * Authoritative membership lookup via `GET /classroom/mine`.
   * - Deduplicates concurrent requests unless `force` is true.
   * - Only the documented `404 {"detail": "You are not in a classroom"}` sets `status = 'unenrolled'`.
   * - Never treats failed requests as unenrolled.
   */
  const loadMembership = async ({ force = false } = {}) => {
    const authStore = useAuthStore()
    const scopeKeyAtStart = syncAccountScope()

    if (!scopeKeyAtStart || !authStore.token) {
      reset()
      return null
    }

    if (
      !force &&
      (status.value === 'enrolled' || status.value === 'unenrolled') &&
      loadedAccountKey.value === scopeKeyAtStart
    ) {
      return membership.value
    }

    if (activeFetchPromise && !force) {
      return activeFetchPromise
    }

    const reqId = ++currentRequestId
    const mutationAtStart = mutationVersion
    const hadResolvedState =
      status.value === 'enrolled' ||
      status.value === 'unenrolled' ||
      status.value === 'error'

    if (hadResolvedState && force) {
      isRefreshing.value = true
    } else {
      status.value = 'loading'
      isRefreshing.value = false
    }
    if (!joinSucceededRefreshFailed.value) {
      error.value = ''
    }

    const fetchPromise = (async () => {
      try {
        const rawData = await fetchMyClassroom()

        const currentKeyAfterFetch = buildAccountScopeKey(authStore)
        if (
          reqId !== currentRequestId ||
          mutationAtStart !== mutationVersion ||
          !authStore.token ||
          currentKeyAfterFetch !== scopeKeyAtStart
        ) {
          return membership.value
        }

        const validation = validateMyClassroomPayload(rawData)
        if (!validation.valid) {
          if (status.value !== 'enrolled') {
            membership.value = null
            status.value = 'error'
          }
          error.value = joinSucceededRefreshFailed.value
            ? 'Joined successfully; classroom details could not load'
            : validation.error
          return membership.value
        }

        const wasPostJoinRetry = joinSucceededRefreshFailed.value
        membership.value = validation.data
        status.value = 'enrolled'
        error.value = ''
        joinSucceededRefreshFailed.value = false
        partialJoinInfo.value = null
        loadedAccountKey.value = currentKeyAfterFetch

        if (wasPostJoinRetry && !flashMessage.value) {
          flashMessage.value = `Joined classroom "${validation.data.name}".`
        }
        return membership.value
      } catch (err) {
        const currentKeyOnError = buildAccountScopeKey(authStore)
        if (
          reqId !== currentRequestId ||
          mutationAtStart !== mutationVersion ||
          !authStore.token ||
          currentKeyOnError !== scopeKeyAtStart
        ) {
          return membership.value
        }

        if (isNotEnrolledClassroom404(err) && !joinSucceededRefreshFailed.value) {
          membership.value = null
          status.value = 'unenrolled'
          error.value = ''
          partialJoinInfo.value = null
          loadedAccountKey.value = currentKeyOnError
          return null
        }

        // Preserve confirmed enrollment if a background refresh fails
        if (status.value !== 'enrolled' || !membership.value) {
          membership.value = null
          status.value = 'error'
        }

        if (joinSucceededRefreshFailed.value) {
          error.value = 'Joined successfully; classroom details could not load'
        } else {
          const detail = err?.response?.data?.detail
          error.value =
            typeof detail === 'string' && err?.response?.status !== 404
              ? detail
              : 'Unable to load classroom membership. Please try again.'
        }
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

  /**
   * Called after `POST /classroom/join` succeeds (`201`).
   * Refreshes membership from `GET /classroom/mine`.
   * If the refresh fails, records `joinSucceededRefreshFailed = true` with
   * `"Joined successfully; classroom details could not load"` so the UI can retry
   * `GET /classroom/mine` without resubmitting `POST /classroom/join`.
   */
  const completeJoin = async (joinResponse = null) => {
    const authStore = useAuthStore()
    const scopeKeyAtStart = syncAccountScope()
    if (!scopeKeyAtStart || !authStore.token) {
      return { ok: false, refreshFailed: false }
    }

    mutationVersion++
    currentRequestId++
    activeFetchPromise = null
    partialJoinInfo.value =
      joinResponse && typeof joinResponse === 'object' ? { ...joinResponse } : null
    joinSucceededRefreshFailed.value = false
    error.value = ''

    try {
      const loaded = await loadMembership({ force: true })
      const currentKey = buildAccountScopeKey(authStore)
      if (!authStore.token || currentKey !== scopeKeyAtStart) {
        return { ok: false, refreshFailed: false }
      }

      if (status.value === 'enrolled' && loaded) {
        flashMessage.value = loaded.name
          ? `Successfully joined "${loaded.name}".`
          : 'Successfully joined classroom.'
        return { ok: true, refreshFailed: false }
      }

      joinSucceededRefreshFailed.value = true
      status.value = 'error'
      error.value = 'Joined successfully; classroom details could not load'
      return { ok: true, refreshFailed: true }
    } catch {
      const currentKey = buildAccountScopeKey(authStore)
      if (!authStore.token || currentKey !== scopeKeyAtStart) {
        return { ok: false, refreshFailed: false }
      }
      joinSucceededRefreshFailed.value = true
      membership.value = null
      status.value = 'error'
      error.value = 'Joined successfully; classroom details could not load'
      return { ok: true, refreshFailed: true }
    }
  }

  /**
   * Leaves the current classroom via `DELETE /classroom/mine`.
   * - Prevents duplicate requests while `isLeaving` is true.
   * - Clears membership immediately on confirmed `204` (or `404` not-in-classroom).
   * - Preserves enrollment if `DELETE /classroom/mine` fails.
   */
  const leaveCurrentClassroom = async () => {
    if (isLeaving.value && activeLeavePromise) {
      return activeLeavePromise
    }

    const authStore = useAuthStore()
    const scopeKeyAtStart = syncAccountScope()
    if (!scopeKeyAtStart || !authStore.token) {
      throw new Error('You must be signed in to leave a classroom.')
    }

    const leaveMutationId = ++mutationVersion
    currentRequestId++
    activeFetchPromise = null
    isLeaving.value = true

    const previousMembership = membership.value
    const previousStatus = status.value

    const leavePromise = (async () => {
      try {
        await leaveMyClassroom()

        const currentKeyAfterLeave = buildAccountScopeKey(authStore)
        if (
          leaveMutationId !== mutationVersion ||
          !authStore.token ||
          currentKeyAfterLeave !== scopeKeyAtStart
        ) {
          return false
        }

        membership.value = null
        partialJoinInfo.value = null
        joinSucceededRefreshFailed.value = false
        status.value = 'unenrolled'
        error.value = ''
        flashMessage.value = 'You have left the classroom.'
        return true
      } catch (err) {
        const currentKeyOnError = buildAccountScopeKey(authStore)
        if (
          leaveMutationId !== mutationVersion ||
          !authStore.token ||
          currentKeyOnError !== scopeKeyAtStart
        ) {
          return false
        }

        if (isNotEnrolledClassroom404(err)) {
          membership.value = null
          partialJoinInfo.value = null
          joinSucceededRefreshFailed.value = false
          status.value = 'unenrolled'
          error.value = ''
          flashMessage.value = 'You have left the classroom.'
          return true
        }

        // Preserve enrollment when leaving fails
        membership.value = previousMembership
        status.value = previousStatus === 'enrolled' ? 'enrolled' : status.value
        throw err
      } finally {
        if (leaveMutationId === mutationVersion) {
          isLeaving.value = false
        }
        if (activeLeavePromise === leavePromise) {
          activeLeavePromise = null
        }
      }
    })()

    activeLeavePromise = leavePromise
    return leavePromise
  }

  return {
    // State
    membership,
    status,
    error,
    isRefreshing,
    isLeaving,
    joinSucceededRefreshFailed,
    partialJoinInfo,
    flashMessage,
    loadedAccountKey,
    // Getters
    isLoading,
    isEnrolled,
    isUnenrolled,
    hasError,
    isNeutralState,
    navLabel,
    navRoute,
    dashboardActionLabel,
    // Actions
    resolveRedirectForPath,
    loadMembership,
    completeJoin,
    leaveCurrentClassroom,
    clearFlashMessage,
    setFlashMessage,
    syncAccountScope,
    reset,
  }
})
