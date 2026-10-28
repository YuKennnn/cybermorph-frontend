<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/authStore'
import {
  fetchAdminClassrooms,
  updateAdminClassroomStatus,
  deleteAdminClassroom,
} from '../api/admin'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()

const classrooms = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')

const isLoading = ref(true)
const isRefreshing = ref(false)
const errorMessage = ref('')
const actionErrorMessage = ref('')
const successNotice = ref('')

// Per-classroom action lock: maps code_id -> 'status' | 'delete'
const pendingActionByCodeId = ref({})

// Close enrollment modal state
const closeEnrollmentTarget = ref(null)
const isClosingEnrollmentModal = ref(false)
const closeEnrollmentModalError = ref('')
const closeModalCardRef = ref(null)
const closeCancelButtonRef = ref(null)

// Delete modal state
const deleteTarget = ref(null)
const isDeletingModal = ref(false)
const deleteModalError = ref('')
const modalCardRef = ref(null)
const cancelButtonRef = ref(null)
const pageHeadingRef = ref(null)

let latestRequestId = 0
let debounceTimer = null
let noticeTimer = null
let initiatingTriggerElement = null

const getActiveAdminScope = () => {
  if (!authStore.token || authStore.userRole !== 'admin') return null
  const id =
    authStore.user?.user_id ||
    authStore.user?.web_profile_id ||
    authStore.user?.email ||
    'admin'
  return `${authStore.token}::${id}`
}

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const hasEducatorDisplayName = (classroom) =>
  typeof classroom?.owner_display_name === 'string' &&
  classroom.owner_display_name.trim().length > 0

const formatEducatorPrimary = (classroom) => {
  if (hasEducatorDisplayName(classroom)) {
    return classroom.owner_display_name.trim()
  }
  if (typeof classroom?.owner_email === 'string' && classroom.owner_email.trim().length > 0) {
    return classroom.owner_email.trim()
  }
  return 'Educator unavailable'
}

const formatEducatorSecondary = (classroom) => {
  if (hasEducatorDisplayName(classroom)) {
    return typeof classroom?.owner_email === 'string' && classroom.owner_email.trim().length > 0
      ? classroom.owner_email.trim()
      : 'Email unavailable'
  }
  return 'Display name not set'
}

const formatStudentCount = (val) => {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.trunc(val).toLocaleString()
  }
  return 'Unavailable'
}

const formatDate = (isoString) => {
  if (!isoString) return 'Unavailable'
  const date = new Date(isoString)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

const showSuccessNotice = (msg) => {
  if (noticeTimer) clearTimeout(noticeTimer)
  successNotice.value = msg
  actionErrorMessage.value = ''
  noticeTimer = setTimeout(() => {
    successNotice.value = ''
  }, 4500)
}

const isClassroomBusy = (codeId) => Boolean(pendingActionByCodeId.value[codeId])

const setClassroomBusy = (codeId, actionType) => {
  if (!codeId) return
  const next = { ...pendingActionByCodeId.value }
  if (actionType) {
    next[codeId] = actionType
  } else {
    delete next[codeId]
  }
  pendingActionByCodeId.value = next
}

const resetStateForAccountChange = () => {
  latestRequestId++
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  classrooms.value = []
  totalCount.value = 0
  page.value = 1
  searchQuery.value = ''
  errorMessage.value = ''
  actionErrorMessage.value = ''
  successNotice.value = ''
  pendingActionByCodeId.value = {}
  closeEnrollmentTarget.value = null
  isClosingEnrollmentModal.value = false
  closeEnrollmentModalError.value = ''
  deleteTarget.value = null
  isDeletingModal.value = false
  deleteModalError.value = ''
  isLoading.value = false
  isRefreshing.value = false
}

const loadClassrooms = async ({ preserveExisting = false } = {}) => {
  const scopeAtStart = getActiveAdminScope()
  if (!scopeAtStart) {
    resetStateForAccountChange()
    return false
  }

  const reqId = ++latestRequestId
  const hadRows = classrooms.value.length > 0
  if (preserveExisting && hadRows) {
    isRefreshing.value = true
  } else {
    isLoading.value = true
  }
  errorMessage.value = ''

  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    const trimmedSearch = searchQuery.value.trim()
    if (trimmedSearch) {
      params.search = trimmedSearch
    }

    const data = await fetchAdminClassrooms(params)

    // Discard stale responses or responses arriving after logout/account switch
    if (reqId !== latestRequestId || getActiveAdminScope() !== scopeAtStart) {
      return false
    }

    if (!data || !Array.isArray(data.items)) {
      errorMessage.value = 'Unable to load classroom records. Please try again.'
      return false
    }

    classrooms.value = data.items
    totalCount.value =
      typeof data.total_count === 'number' && Number.isFinite(data.total_count)
        ? data.total_count
        : data.items.length
    if (typeof data.page === 'number' && data.page >= 1) {
      page.value = data.page
    }
    if (typeof data.page_size === 'number' && data.page_size >= 1) {
      pageSize.value = data.page_size
    }
    return true
  } catch {
    if (reqId !== latestRequestId || getActiveAdminScope() !== scopeAtStart) {
      return false
    }
    errorMessage.value =
      'Failed to load classrooms. Please verify your connection and try again.'
    return false
  } finally {
    if (reqId === latestRequestId) {
      isLoading.value = false
      isRefreshing.value = false
    }
  }
}

watch(searchQuery, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadClassrooms()
  }, 300)
})

const handleClearSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (!searchQuery.value) return
  searchQuery.value = ''
  page.value = 1
  loadClassrooms()
}

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value && !isRefreshing.value) {
    page.value -= 1
    loadClassrooms()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value && !isRefreshing.value) {
    page.value += 1
    loadClassrooms()
  }
}

const executeStatusUpdate = async (classroom, targetActiveState, { fromModal = false } = {}) => {
  const codeId = classroom?.code_id
  if (!codeId || isClassroomBusy(codeId)) return false
  if (typeof targetActiveState !== 'boolean') return false

  const scopeAtStart = getActiveAdminScope()
  if (!scopeAtStart) return false

  setClassroomBusy(codeId, 'status')
  actionErrorMessage.value = ''
  if (fromModal) {
    isClosingEnrollmentModal.value = true
    closeEnrollmentModalError.value = ''
  }

  try {
    const updated = await updateAdminClassroomStatus(codeId, targetActiveState)
    if (getActiveAdminScope() !== scopeAtStart) return false

    if (fromModal) {
      closeEnrollmentTarget.value = null
      isClosingEnrollmentModal.value = false
    }

    // Update row in-place immediately while refreshing current page
    const rowIdx = classrooms.value.findIndex((c) => c.code_id === codeId)
    if (rowIdx !== -1 && updated && typeof updated === 'object') {
      classrooms.value[rowIdx] = {
        ...classrooms.value[rowIdx],
        ...updated,
      }
    }

    const actionWord = targetActiveState ? 'opened' : 'closed'
    showSuccessNotice(
      `Student enrollment ${actionWord} for "${classroom.name}" (${classroom.code_value}).`,
    )
    await loadClassrooms({ preserveExisting: true })
    if (fromModal) {
      restoreFocusToTrigger()
    }
    return true
  } catch (err) {
    if (getActiveAdminScope() !== scopeAtStart) return false
    if (fromModal) {
      isClosingEnrollmentModal.value = false
    }

    if (err?.response?.status === 404) {
      if (fromModal) {
        closeEnrollmentTarget.value = null
      }
      actionErrorMessage.value = `Classroom "${classroom.name}" was not found or has already been deleted. Refreshing list.`
      await loadClassrooms({ preserveExisting: true })
      if (fromModal) {
        restoreFocusAfterDeleteSuccess()
      }
    } else if (fromModal) {
      closeEnrollmentModalError.value = `Could not close enrollment for "${classroom.name}". Enrollment remains open; please try again.`
    } else {
      const intendedLabel = targetActiveState ? 'open' : 'close'
      actionErrorMessage.value = `Could not ${intendedLabel} enrollment for "${classroom.name}". Existing status was preserved; please try again.`
    }
    return false
  } finally {
    if (getActiveAdminScope() === scopeAtStart) {
      setClassroomBusy(codeId, null)
    }
  }
}

const openCloseEnrollmentModal = (classroom, event) => {
  const codeId = classroom?.code_id
  if (
    !codeId ||
    isClassroomBusy(codeId) ||
    isClosingEnrollmentModal.value ||
    isDeletingModal.value ||
    deleteTarget.value?.code_id === codeId
  ) {
    return
  }
  initiatingTriggerElement = event?.currentTarget || document.activeElement
  closeEnrollmentModalError.value = ''
  closeEnrollmentTarget.value = { ...classroom }
  nextTick(() => {
    closeCancelButtonRef.value?.focus()
  })
}

const closeCloseEnrollmentModal = () => {
  if (isClosingEnrollmentModal.value) return
  closeEnrollmentTarget.value = null
  closeEnrollmentModalError.value = ''
  restoreFocusToTrigger()
}

const confirmCloseEnrollment = async () => {
  const target = closeEnrollmentTarget.value
  if (!target || isClosingEnrollmentModal.value) return
  await executeStatusUpdate(target, false, { fromModal: true })
}

const handleToggleEnrollment = async (classroom, event) => {
  const codeId = classroom?.code_id
  if (
    !codeId ||
    isClassroomBusy(codeId) ||
    deleteTarget.value?.code_id === codeId ||
    closeEnrollmentTarget.value?.code_id === codeId
  ) {
    return
  }
  if (typeof classroom.is_active !== 'boolean') return

  if (classroom.is_active) {
    openCloseEnrollmentModal(classroom, event)
    return
  }

  await executeStatusUpdate(classroom, true)
}

const openDeleteModal = (classroom, event) => {
  const codeId = classroom?.code_id
  if (
    !codeId ||
    isClassroomBusy(codeId) ||
    isDeletingModal.value ||
    isClosingEnrollmentModal.value ||
    closeEnrollmentTarget.value?.code_id === codeId
  ) {
    return
  }
  initiatingTriggerElement = event?.currentTarget || document.activeElement
  deleteModalError.value = ''
  deleteTarget.value = { ...classroom }
  nextTick(() => {
    cancelButtonRef.value?.focus()
  })
}

const restoreFocusToTrigger = () => {
  nextTick(() => {
    if (
      initiatingTriggerElement &&
      typeof initiatingTriggerElement.focus === 'function' &&
      document.body.contains(initiatingTriggerElement)
    ) {
      initiatingTriggerElement.focus()
    } else {
      pageHeadingRef.value?.focus()
    }
    initiatingTriggerElement = null
  })
}

const restoreFocusAfterDeleteSuccess = () => {
  nextTick(() => {
    const firstActionBtn =
      typeof document !== 'undefined'
        ? document.querySelector('.admin-classrooms-view .btn-row-toggle')
        : null
    if (firstActionBtn && typeof firstActionBtn.focus === 'function') {
      firstActionBtn.focus()
    } else {
      pageHeadingRef.value?.focus()
    }
    initiatingTriggerElement = null
  })
}

const closeDeleteModal = () => {
  if (isDeletingModal.value) return
  deleteTarget.value = null
  deleteModalError.value = ''
  restoreFocusToTrigger()
}

const confirmDeleteClassroom = async () => {
  const target = deleteTarget.value
  const codeId = target?.code_id
  if (!target || !codeId || isDeletingModal.value || isClassroomBusy(codeId)) return

  const scopeAtStart = getActiveAdminScope()
  if (!scopeAtStart) return

  isDeletingModal.value = true
  deleteModalError.value = ''
  actionErrorMessage.value = ''
  setClassroomBusy(codeId, 'delete')

  try {
    await deleteAdminClassroom(codeId)
    if (getActiveAdminScope() !== scopeAtStart) return

    deleteTarget.value = null
    isDeletingModal.value = false
    setClassroomBusy(codeId, null)

    // If we deleted the final row on a page > 1, step back to the previous valid page
    const wasLastRowOnPage = classrooms.value.length <= 1 && page.value > 1
    if (wasLastRowOnPage) {
      page.value = Math.max(1, page.value - 1)
    }

    showSuccessNotice(`Classroom "${target.name}" (${target.code_value}) has been deleted.`)
    await loadClassrooms({ preserveExisting: true })
    restoreFocusAfterDeleteSuccess()
  } catch (err) {
    if (getActiveAdminScope() !== scopeAtStart) return
    isDeletingModal.value = false
    setClassroomBusy(codeId, null)

    if (err?.response?.status === 404) {
      deleteTarget.value = null
      actionErrorMessage.value = `Classroom "${target.name}" was already deleted. Refreshing list.`
      await loadClassrooms({ preserveExisting: true })
      restoreFocusAfterDeleteSuccess()
    } else {
      deleteModalError.value = `Failed to delete "${target.name}". The classroom was not removed; please try again.`
    }
  }
}

const handleModalKeydown = (event) => {
  const activeModalCard = deleteTarget.value
    ? modalCardRef.value
    : closeEnrollmentTarget.value
      ? closeModalCardRef.value
      : null
  if (!activeModalCard) return

  if (event.key === 'Escape') {
    if (deleteTarget.value && !isDeletingModal.value) {
      event.preventDefault()
      closeDeleteModal()
    } else if (closeEnrollmentTarget.value && !isClosingEnrollmentModal.value) {
      event.preventDefault()
      closeCloseEnrollmentModal()
    }
    return
  }

  if (event.key === 'Tab') {
    const focusables = activeModalCard.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusables.length) {
      event.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey) {
      if (document.activeElement === first || !activeModalCard.contains(document.activeElement)) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !activeModalCard.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
  }
}

watch([deleteTarget, closeEnrollmentTarget], ([delTarget, closeTarget]) => {
  if (typeof window === 'undefined') return
  if (delTarget || closeTarget) {
    window.addEventListener('keydown', handleModalKeydown)
  } else {
    window.removeEventListener('keydown', handleModalKeydown)
  }
})

watch(
  () => getActiveAdminScope(),
  (newScope, oldScope) => {
    if (newScope === oldScope) return
    resetStateForAccountChange()
    if (newScope) {
      loadClassrooms()
    }
  },
)

onMounted(() => {
  loadClassrooms()
})

onUnmounted(() => {
  latestRequestId++
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleModalKeydown)
  }
})
</script>

<template>
  <div class="admin-classrooms-view">
    <header class="view-header">
      <div class="header-content">
        <div>
          <h2 ref="pageHeadingRef" class="title" tabindex="-1">Classroom Management</h2>
          <p class="subtitle">
            Inspect classrooms across educators, manage student enrollment status, or remove
            classrooms
          </p>
        </div>
      </div>
    </header>

    <!-- Enrollment Policy Info Note -->
    <p class="policy-note">
      Closing enrollment prevents new students from joining a classroom with its code while keeping
      existing members enrolled.
    </p>

    <!-- Search & Refresh Bar -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search by classroom name, join code, or educator email..."
          class="search-input"
          aria-label="Search classrooms by name, join code, or educator email"
        />
      </div>

      <div class="filter-controls">
        <button
          v-if="searchQuery"
          type="button"
          class="btn-clear-inline"
          :disabled="isLoading || isRefreshing"
          @click="handleClearSearch"
        >
          Clear search
        </button>

        <button
          type="button"
          class="btn-refresh"
          :disabled="isLoading || isRefreshing"
          aria-label="Refresh classroom list"
          @click="loadClassrooms({ preserveExisting: true })"
        >
          <AppIcon name="refresh" :size="16" />
          <span>{{ isRefreshing ? 'Refreshing…' : 'Refresh' }}</span>
        </button>
      </div>
    </div>

    <!-- Feedback Banners -->
    <div v-if="successNotice" class="notice-banner success" role="status">
      {{ successNotice }}
    </div>

    <div v-if="actionErrorMessage" class="error-banner" role="alert">
      <span>{{ actionErrorMessage }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="isLoading || isRefreshing"
        @click="loadClassrooms({ preserveExisting: true })"
      >
        Refresh list
      </button>
    </div>

    <div v-if="errorMessage" class="error-banner" role="alert">
      <span>{{ errorMessage }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="isLoading || isRefreshing"
        @click="loadClassrooms({ preserveExisting: classrooms.length > 0 })"
      >
        Retry
      </button>
    </div>

    <!-- Initial Loading State -->
    <div v-if="isLoading && classrooms.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading classrooms...</p>
    </div>

    <!-- Classrooms Table Card -->
    <div v-else-if="classrooms.length > 0" class="table-card">
      <div class="table-scroll">
        <table class="classrooms-table" aria-label="Registered classrooms">
          <thead>
            <tr>
              <th scope="col">Classroom</th>
              <th scope="col">Educator</th>
              <th scope="col" class="col-num">Students</th>
              <th scope="col">Enrollment</th>
              <th scope="col">Created</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="classroom in classrooms" :key="classroom.code_id">
              <td data-label="Classroom" class="cell-classroom">
                <div class="classroom-cell-stack">
                  <div class="classroom-title-row">
                    <strong class="classroom-name">{{ classroom.name }}</strong>
                    <span class="code-badge">{{ classroom.code_value }}</span>
                  </div>
                  <span v-if="classroom.description" class="classroom-desc">
                    {{ classroom.description }}
                  </span>
                </div>
              </td>

              <td data-label="Educator" class="cell-educator">
                <div class="educator-cell-stack">
                  <span class="educator-primary">{{ formatEducatorPrimary(classroom) }}</span>
                  <span
                    :class="[
                      'educator-secondary',
                      { 'is-unset': !hasEducatorDisplayName(classroom) },
                    ]"
                  >
                    {{ formatEducatorSecondary(classroom) }}
                  </span>
                </div>
              </td>

              <td data-label="Students" class="col-num cell-students">
                {{ formatStudentCount(classroom.student_count) }}
              </td>

              <td data-label="Enrollment">
                <span :class="['status-badge', classroom.is_active ? 'open' : 'closed']">
                  {{ classroom.is_active ? 'Open' : 'Closed' }}
                </span>
              </td>

              <td data-label="Created" class="date-cell">
                {{ formatDate(classroom.created_at) }}
              </td>

              <td data-label="Actions" class="text-right actions-cell">
                <div class="row-actions">
                  <button
                    type="button"
                    :class="[
                      'btn-row-toggle',
                      classroom.is_active ? 'btn-close-enrollment' : 'btn-open-enrollment',
                    ]"
                    :disabled="
                      isClassroomBusy(classroom.code_id) ||
                      deleteTarget?.code_id === classroom.code_id ||
                      closeEnrollmentTarget?.code_id === classroom.code_id
                    "
                    :aria-label="`${classroom.is_active ? 'Close enrollment for' : 'Open enrollment for'} ${classroom.name}`"
                    @click="handleToggleEnrollment(classroom, $event)"
                  >
                    <template v-if="pendingActionByCodeId[classroom.code_id] === 'status'">
                      Saving…
                    </template>
                    <template v-else>
                      {{ classroom.is_active ? 'Close enrollment' : 'Open enrollment' }}
                    </template>
                  </button>

                  <button
                    type="button"
                    class="btn-row-delete"
                    :disabled="
                      isClassroomBusy(classroom.code_id) ||
                      deleteTarget?.code_id === classroom.code_id ||
                      closeEnrollmentTarget?.code_id === classroom.code_id
                    "
                    :aria-label="`Delete classroom ${classroom.name}`"
                    @click="openDeleteModal(classroom, $event)"
                  >
                    {{
                      pendingActionByCodeId[classroom.code_id] === 'delete'
                        ? 'Deleting…'
                        : 'Delete'
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> classrooms
        </div>
        <div class="pagination-actions">
          <button
            type="button"
            class="page-btn"
            :disabled="page <= 1 || isLoading || isRefreshing"
            @click="handlePrevPage"
          >
            ◀ Previous
          </button>
          <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
          <button
            type="button"
            class="page-btn"
            :disabled="page >= totalPages || isLoading || isRefreshing"
            @click="handleNextPage"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!errorMessage" class="empty-state">
      <h4>No classrooms found</h4>
      <p v-if="searchQuery.trim()">
        No classrooms match "{{ searchQuery.trim() }}". Try searching by another classroom name,
        6-character join code, or educator email.
      </p>
      <p v-else>There are currently no active or archived classrooms created by educators.</p>
      <button
        v-if="searchQuery.trim()"
        type="button"
        class="btn-clear"
        @click="handleClearSearch"
      >
        Clear search
      </button>
    </div>

    <!-- Accessible Close Enrollment Confirmation Modal -->
    <div
      v-if="closeEnrollmentTarget"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeCloseEnrollmentModal"
    >
      <div
        ref="closeModalCardRef"
        class="modal-card warning-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-close-enrollment-title"
        aria-describedby="admin-close-enrollment-desc"
        tabindex="-1"
      >
        <h3 id="admin-close-enrollment-title" class="modal-title warning-title">
          Close student enrollment
        </h3>

        <div v-if="closeEnrollmentModalError" class="modal-error-banner" role="alert">
          {{ closeEnrollmentModalError }}
        </div>

        <p class="modal-body">
          Are you sure you want to close enrollment for
          <strong class="target-name">"{{ closeEnrollmentTarget.name }}"</strong>
          (<span class="code-badge">{{ closeEnrollmentTarget.code_value }}</span>)?
        </p>

        <div id="admin-close-enrollment-desc" class="modal-consequences">
          <p class="modal-subtext">
            Closing enrollment blocks new students from joining this classroom with code
            <strong>{{ closeEnrollmentTarget.code_value }}</strong>.
          </p>
          <p class="modal-subtext">
            Currently enrolled students ({{
              formatStudentCount(closeEnrollmentTarget.student_count)
            }}) remain in the classroom and keep their progress. You can reopen enrollment at any
            time.
          </p>
        </div>

        <div class="modal-actions">
          <button
            ref="closeCancelButtonRef"
            type="button"
            class="btn-modal-cancel"
            :disabled="isClosingEnrollmentModal"
            @click="closeCloseEnrollmentModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-modal-warning"
            :disabled="isClosingEnrollmentModal"
            @click="confirmCloseEnrollment"
          >
            {{ isClosingEnrollmentModal ? 'Closing…' : 'Close enrollment' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Accessible Delete Confirmation Modal -->
    <div
      v-if="deleteTarget"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeDeleteModal"
    >
      <div
        ref="modalCardRef"
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-delete-classroom-title"
        aria-describedby="admin-delete-classroom-desc"
        tabindex="-1"
      >
        <h3 id="admin-delete-classroom-title" class="modal-title">Delete classroom</h3>

        <div v-if="deleteModalError" class="modal-error-banner" role="alert">
          {{ deleteModalError }}
        </div>

        <p class="modal-body">
          Are you sure you want to delete
          <strong class="target-name">"{{ deleteTarget.name }}"</strong>
          (<span class="code-badge">{{ deleteTarget.code_value }}</span>)?
        </p>

        <div id="admin-delete-classroom-desc" class="modal-consequences">
          <p class="modal-subtext">
            This classroom will disappear from every classroom list and its join code
            (<strong>{{ deleteTarget.code_value }}</strong>) will stop working immediately.
          </p>
          <p class="modal-subtext">
            Deleted classrooms no longer count as a player's active classroom, so currently enrolled
            students ({{ formatStudentCount(deleteTarget.student_count) }}) may join another
            classroom while their uploaded sessions remain stored. A record snapshot is kept on the
            server, though a restore interface is not yet available in the portal.
          </p>
        </div>

        <div class="modal-actions">
          <button
            ref="cancelButtonRef"
            type="button"
            class="btn-modal-cancel"
            :disabled="isDeletingModal"
            @click="closeDeleteModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-modal-confirm"
            :disabled="isDeletingModal"
            @click="confirmDeleteClassroom"
          >
            {{ isDeletingModal ? 'Deleting…' : 'Delete classroom' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-classrooms-view {
  width: 100%;
}

.view-header {
  margin-bottom: 1.5rem;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 1.65rem;
}

.title:focus {
  outline: none;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.policy-note {
  margin: 0 0 1.15rem 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input-wrapper {
  flex: 1;
  min-width: 260px;
}

.search-input {
  width: 100%;
  padding: 0.65rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  color: var(--color-text-main);
  transition: border-color 0.15s ease;
}

.search-input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-clear-inline,
.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-clear-inline:hover:not(:disabled),
.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-clear-inline:disabled,
.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notice-banner {
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.notice-banner.success {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}

.btn-retry {
  padding: 0.35rem 0.85rem;
  background-color: var(--color-danger);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.classrooms-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.95rem 1.25rem;
  font-size: 0.88rem;
  font-weight: 700;
  border-bottom: 1.5px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.92rem;
  vertical-align: middle;
}

tbody tr {
  background-color: var(--color-card);
  transition: background-color 0.15s ease;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover,
tbody tr:hover td {
  background-color: var(--color-bg-subtle);
}

th.col-num,
td.col-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

th.text-right,
td.text-right {
  text-align: right;
}

.classroom-cell-stack {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.classroom-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.classroom-name {
  font-weight: 700;
  color: var(--color-text-main);
}

.code-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.14rem 0.5rem;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-violet-border);
  letter-spacing: 0.04em;
}

.classroom-desc {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.educator-cell-stack {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.educator-primary {
  font-weight: 600;
  color: var(--color-text-main);
}

.educator-secondary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.educator-secondary.is-unset {
  color: var(--color-text-dim);
  font-style: italic;
}

.cell-students {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
}

.status-badge {
  display: inline-block;
  padding: 0.22rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
}

.status-badge.open {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-badge.closed {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.86rem;
  white-space: nowrap;
}

.actions-cell {
  white-space: nowrap;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-row-toggle,
.btn-row-delete {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-close-enrollment {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
}

.btn-close-enrollment:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-open-enrollment {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.btn-open-enrollment:hover:not(:disabled) {
  background-color: var(--color-success);
  color: #ffffff;
}

.btn-row-delete {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.btn-row-delete:hover:not(:disabled) {
  background-color: var(--color-danger);
  color: #ffffff;
}

.btn-row-toggle:disabled,
.btn-row-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-row-toggle:focus-visible,
.btn-row-delete:focus-visible,
.btn-clear-inline:focus-visible,
.btn-refresh:focus-visible,
.btn-retry:focus-visible,
.page-btn:focus-visible,
.btn-clear:focus-visible,
.btn-modal-cancel:focus-visible,
.btn-modal-warning:focus-visible,
.btn-modal-confirm:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.pagination-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-top: 1px solid var(--color-border);
  gap: 1rem;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-primary);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-primary);
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-card);
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
}

.btn-clear {
  margin-top: 1rem;
  padding: 0.55rem 1.2rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem auto;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  z-index: 1000;
}

.modal-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-danger-border);
  border-radius: 12px;
  padding: 1.75rem;
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-card-hover);
}

.modal-card.warning-card {
  border-color: var(--color-warning-border);
}

.modal-title {
  margin: 0 0 0.85rem 0;
  font-size: 1.25rem;
  color: var(--color-danger);
}

.modal-title.warning-title {
  color: var(--color-primary);
}

.modal-error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.7rem 0.95rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.86rem;
}

.modal-body {
  margin: 0 0 0.85rem 0;
  color: var(--color-text-main);
  font-size: 0.95rem;
  line-height: 1.5;
}

.target-name {
  color: var(--color-text-main);
}

.modal-consequences {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-bottom: 1.5rem;
  padding: 0.85rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.modal-subtext {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-modal-cancel {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-modal-cancel:hover:not(:disabled) {
  background-color: var(--color-bg-muted);
}

.btn-modal-warning {
  padding: 0.55rem 1.15rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-modal-warning:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
}

.btn-modal-confirm {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-danger);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-modal-confirm:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-modal-cancel:disabled,
.btn-modal-warning:disabled,
.btn-modal-confirm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Mobile Responsive Stacking without Horizontal Overflow */
@media (max-width: 768px) {
  .search-input-wrapper {
    min-width: 100%;
  }

  .filter-controls {
    width: 100%;
  }

  .classrooms-table thead {
    display: none;
  }

  .classrooms-table,
  .classrooms-table tbody,
  .classrooms-table tr,
  .classrooms-table td {
    display: block;
    width: 100%;
  }

  .classrooms-table tr {
    border-bottom: 1.5px solid var(--color-border);
    padding: 0.85rem 1rem;
  }

  .classrooms-table tr:last-child {
    border-bottom: none;
  }

  .classrooms-table td {
    border-bottom: none;
    padding: 0.35rem 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    text-align: right;
  }

  .classrooms-table td::before {
    content: attr(data-label);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    text-align: left;
    flex-shrink: 0;
  }

  .classroom-cell-stack,
  .educator-cell-stack {
    align-items: flex-end;
    text-align: right;
    min-width: 0;
  }

  .classroom-title-row {
    justify-content: flex-end;
  }
}
</style>
