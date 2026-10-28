import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchMyClassrooms } from '../api/classroom.js'

export const ALLOWED_CLASSROOM_RETURN_ROUTES = Object.freeze([
  '/dashboard',
  '/classroom/manage',
])

export const isAllowedClassroomReturnRoute = (routePath) =>
  typeof routePath === 'string' && ALLOWED_CLASSROOM_RETURN_ROUTES.includes(routePath)

export const useClassroomStore = defineStore('classroom', () => {
  // ==========================================
  // 1. STATE (In-Memory Only, Never Persisted)
  // ==========================================
  const classrooms = ref([])
  const currentClassroomId = ref(null)
  const isLoading = ref(false)
  const error = ref('')
  const isFetched = ref(false)

  // Classroom creation draft & missing display_name recovery state
  const createDraftName = ref('')
  const createConflictNeedsDisplayName = ref(false)
  const pendingCreateReturnRoute = ref(null)
  const shouldReopenCreateModal = ref(false)

  // Internal concurrency & promise deduplication guards
  let currentRequestId = 0
  let activeFetchPromise = null

  // ==========================================
  // 2. GETTERS
  // ==========================================
  const currentClassroom = computed(() => {
    if (!currentClassroomId.value) return null
    return (
      classrooms.value.find(
        (c) => String(c.code_id) === String(currentClassroomId.value),
      ) || null
    )
  })

  const activeClassrooms = computed(() =>
    classrooms.value.filter((c) => c.is_active === true),
  )

  const hasClassrooms = computed(() => classrooms.value.length > 0)

  // ==========================================
  // 3. ACTIONS
  // ==========================================

  /**
   * Fetch educator's classrooms from API.
   * - Caches successful results even when the list is empty ([]).
   * - Deduplicates simultaneous requests sharing a single ongoing promise.
   * - Ignores stale responses if reset() or logout occurred while pending.
   * - Supports deliberate force refresh via `force = true`.
   */
  const fetchClassrooms = async (force = false) => {
    // 1. Reuse existing completed result (even if empty []) when not forcing
    if (isFetched.value && !force) {
      return classrooms.value
    }

    // 2. Reuse ongoing in-flight request between simultaneous callers
    if (activeFetchPromise && !force) {
      return activeFetchPromise
    }

    const reqId = ++currentRequestId
    isLoading.value = true
    error.value = ''

    const fetchPromise = (async () => {
      try {
        const data = await fetchMyClassrooms()
        // Ignore stale completion if a newer request or reset was triggered
        if (reqId !== currentRequestId) {
          return classrooms.value
        }

        const list = Array.isArray(data) ? data : []
        classrooms.value = list
        isFetched.value = true
        error.value = ''
        return list
      } catch (err) {
        // Ignore stale error if reset occurred while pending
        if (reqId !== currentRequestId) {
          return classrooms.value
        }

        error.value =
          err?.response?.data?.detail ||
          'Failed to load classroom list. Please verify your connection.'
        throw err
      } finally {
        if (reqId === currentRequestId) {
          isLoading.value = false
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
   * Set the active classroom ID for the current workspace.
   */
  const setCurrentClassroomId = (codeId) => {
    currentClassroomId.value = codeId ? String(codeId) : null
  }

  /**
   * Update a classroom record in-memory.
   * Invoked after settings updates (PATCH /classroom/{codeId})
   * using documented fields (code_id, code_value, name, is_active).
   */
  const updateClassroomInState = (updated) => {
    const targetId = updated?.code_id
    if (!targetId) return
    const id = String(targetId)
    const index = classrooms.value.findIndex(
      (c) => String(c.code_id) === id,
    )
    if (index !== -1) {
      classrooms.value[index] = { ...classrooms.value[index], ...updated }
    } else {
      classrooms.value.push(updated)
    }
  }

  /**
   * Remove a deleted classroom from in-memory state.
   */
  const removeClassroomFromState = (codeId) => {
    if (!codeId) return
    const id = String(codeId)
    classrooms.value = classrooms.value.filter(
      (c) => String(c.code_id) !== id,
    )
    if (String(currentClassroomId.value) === id) {
      currentClassroomId.value = null
    }
  }

  /**
   * Classroom creation draft & 409 display_name recovery helpers.
   */
  const setCreateDraftName = (name) => {
    createDraftName.value = typeof name === 'string' ? name : ''
  }

  const markDisplayNameConflict = (returnRoute) => {
    createConflictNeedsDisplayName.value = true
    pendingCreateReturnRoute.value = isAllowedClassroomReturnRoute(returnRoute)
      ? returnRoute
      : null
  }

  const clearCreateConflict = () => {
    createConflictNeedsDisplayName.value = false
  }

  const prepareReturnToCreateModal = (fallbackRoute = null) => {
    const target = isAllowedClassroomReturnRoute(pendingCreateReturnRoute.value)
      ? pendingCreateReturnRoute.value
      : isAllowedClassroomReturnRoute(fallbackRoute)
        ? fallbackRoute
        : null
    if (target) {
      pendingCreateReturnRoute.value = target
      shouldReopenCreateModal.value = true
    }
    createConflictNeedsDisplayName.value = false
    return target
  }

  const consumeReopenCreateModal = (currentPath) => {
    if (!shouldReopenCreateModal.value) return false
    if (
      pendingCreateReturnRoute.value &&
      isAllowedClassroomReturnRoute(currentPath) &&
      pendingCreateReturnRoute.value !== currentPath
    ) {
      return false
    }
    shouldReopenCreateModal.value = false
    pendingCreateReturnRoute.value = null
    return true
  }

  const clearCreateDraft = () => {
    createDraftName.value = ''
    createConflictNeedsDisplayName.value = false
    pendingCreateReturnRoute.value = null
    shouldReopenCreateModal.value = false
  }

  /**
   * Reset all state. Called on user logout or session switch to prevent data leakage.
   * Increments currentRequestId so pending in-flight requests cannot update state after reset.
   */
  const reset = () => {
    currentRequestId++
    activeFetchPromise = null
    classrooms.value = []
    currentClassroomId.value = null
    isLoading.value = false
    error.value = ''
    isFetched.value = false
    clearCreateDraft()
  }

  return {
    // State
    classrooms,
    currentClassroomId,
    isLoading,
    error,
    isFetched,
    createDraftName,
    createConflictNeedsDisplayName,
    pendingCreateReturnRoute,
    shouldReopenCreateModal,
    // Getters
    currentClassroom,
    activeClassrooms,
    hasClassrooms,
    // Actions
    fetchClassrooms,
    setCurrentClassroomId,
    updateClassroomInState,
    removeClassroomFromState,
    setCreateDraftName,
    markDisplayNameConflict,
    clearCreateConflict,
    prepareReturnToCreateModal,
    consumeReopenCreateModal,
    clearCreateDraft,
    reset,
  }
})
