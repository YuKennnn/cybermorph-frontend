<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchAdminApprovals, approveEducator, rejectEducator } from '../api/admin'
import AdminSubNav from '../components/admin/AdminSubNav.vue'
import AppIcon from '../components/common/AppIcon.vue'

const approvals = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const currentStatus = ref('pending') // 'pending', 'approved', 'rejected'
const isLoading = ref(true)
const errorMessage = ref('')
const successNotice = ref('')
const conflictNotice = ref('')

const actionInProgressId = ref(null)
const rejectionTarget = ref(null)
const modalCardRef = ref(null)
const cancelButtonRef = ref(null)

let latestRequestId = 0
let noticeTimer = null
let initiatingControl = null

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const formatDate = (isoString) => {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return isNaN(date.getTime())
    ? 'N/A'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

const showNotice = (msg, isConflict = false) => {
  clearTimeout(noticeTimer)
  if (isConflict) {
    conflictNotice.value = msg
    successNotice.value = ''
  } else {
    successNotice.value = msg
    conflictNotice.value = ''
  }
  noticeTimer = setTimeout(() => {
    successNotice.value = ''
    conflictNotice.value = ''
  }, 4000)
}

const loadApprovals = async () => {
  const reqId = ++latestRequestId
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchAdminApprovals({
      status: currentStatus.value,
      page: page.value,
      page_size: pageSize.value,
    })

    if (reqId !== latestRequestId) return

    approvals.value = data?.items || []
    totalCount.value = data?.total_count ?? approvals.value.length
    if (data?.page) page.value = data.page
    if (data?.page_size) pageSize.value = data.page_size
  } catch {
    if (reqId !== latestRequestId) return
    errorMessage.value = 'Failed to load educator approval queue. Please try again.'
  } finally {
    if (reqId === latestRequestId) {
      isLoading.value = false
    }
  }
}

// Reset pagination when status filter tab changes
watch(currentStatus, () => {
  page.value = 1
  loadApprovals()
})

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    page.value -= 1
    loadApprovals()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    page.value += 1
    loadApprovals()
  }
}

const handleApprove = async (item) => {
  if (actionInProgressId.value) return
  actionInProgressId.value = item.user_id

  try {
    await approveEducator(item.user_id)
    showNotice(`Educator ${item.email} approved successfully.`)

    // Adjust page if current page became empty
    const remainingCount = Math.max(0, totalCount.value - 1)
    const maxPage = Math.max(1, Math.ceil(remainingCount / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
    }
    await loadApprovals()
  } catch (err) {
    if (err.response?.status === 409) {
      showNotice(`Registration for ${item.email} was already updated. Refreshing queue...`, true)
      await loadApprovals()
    } else {
      errorMessage.value = `Failed to approve educator ${item.email}.`
    }
  } finally {
    actionInProgressId.value = null
  }
}

const openRejectionModal = (item, event) => {
  initiatingControl = event?.currentTarget || document.activeElement
  rejectionTarget.value = item
  nextTick(() => {
    cancelButtonRef.value?.focus()
  })
}

const restoreFocus = () => {
  nextTick(() => {
    if (initiatingControl && typeof initiatingControl.focus === 'function' && document.body.contains(initiatingControl)) {
      initiatingControl.focus()
    }
    initiatingControl = null
  })
}

const cancelRejection = () => {
  rejectionTarget.value = null
  restoreFocus()
}

const confirmRejection = async () => {
  if (!rejectionTarget.value || actionInProgressId.value) return
  const item = rejectionTarget.value
  actionInProgressId.value = item.user_id
  rejectionTarget.value = null

  try {
    await rejectEducator(item.user_id)
    showNotice(`Educator ${item.email} rejected.`)

    // Adjust page if current page became empty
    const remainingCount = Math.max(0, totalCount.value - 1)
    const maxPage = Math.max(1, Math.ceil(remainingCount / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
    }
    await loadApprovals()
  } catch (err) {
    if (err.response?.status === 409) {
      showNotice(`Registration for ${item.email} was already updated. Refreshing queue...`, true)
      await loadApprovals()
    } else {
      errorMessage.value = `Failed to reject educator ${item.email}.`
    }
  } finally {
    actionInProgressId.value = null
    restoreFocus()
  }
}

const handleModalKeydown = (event) => {
  if (!rejectionTarget.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelRejection()
    return
  }

  if (event.key === 'Tab') {
    if (!modalCardRef.value) return
    const focusableElements = modalCardRef.value.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusableElements.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === firstElement || !modalCardRef.value.contains(document.activeElement)) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement || !modalCardRef.value.contains(document.activeElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}

watch(rejectionTarget, (target) => {
  if (target) {
    window.addEventListener('keydown', handleModalKeydown)
  } else {
    window.removeEventListener('keydown', handleModalKeydown)
  }
})

onMounted(() => {
  loadApprovals()
})

onUnmounted(() => {
  // Invalidate any pending in-flight requests and clear timers
  latestRequestId++
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  window.removeEventListener('keydown', handleModalKeydown)
  if (initiatingControl && typeof initiatingControl.focus === 'function' && document.body.contains(initiatingControl)) {
    initiatingControl.focus()
    initiatingControl = null
  }
})
</script>

<template>
  <div class="admin-approvals-view">
    <header class="view-header">
      <div class="header-content">
        <div>
          <h2 class="title">Educator Approvals</h2>
          <p class="subtitle">Review, authorize, and manage institutional instructor registrations</p>
        </div>
      </div>
    </header>

    <!-- Top Sub-Navigation Tabs -->
    <AdminSubNav :pending-count="currentStatus === 'pending' ? totalCount : null" />

    <!-- Status Tabs & Actions -->
    <div class="status-toolbar">
      <div class="status-tabs" role="tablist" aria-label="Approval Statuses">
        <button
          :class="['status-tab', { active: currentStatus === 'pending' }]"
          role="tab"
          :aria-selected="currentStatus === 'pending'"
          @click="currentStatus = 'pending'"
        >
          Pending Review
        </button>

        <button
          :class="['status-tab', { active: currentStatus === 'approved' }]"
          role="tab"
          :aria-selected="currentStatus === 'approved'"
          @click="currentStatus = 'approved'"
        >
          Approved
        </button>

        <button
          :class="['status-tab', { active: currentStatus === 'rejected' }]"
          role="tab"
          :aria-selected="currentStatus === 'rejected'"
          @click="currentStatus = 'rejected'"
        >
          Rejected
        </button>
      </div>

      <button class="btn-refresh" :disabled="isLoading" aria-label="Refresh approval list" @click="loadApprovals">
        <AppIcon name="refresh" :size="16" />
        <span>Refresh</span>
      </button>
    </div>

    <!-- Feedback Notices -->
    <div v-if="successNotice" class="notice-banner success" role="status">
      ✓ {{ successNotice }}
    </div>

    <div v-if="conflictNotice" class="notice-banner warning" role="status">
      ⚠️ {{ conflictNotice }}
    </div>

    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
      <button class="btn-retry" @click="loadApprovals">Retry</button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading educator approvals...</p>
    </div>

    <!-- Approvals Table Card -->
    <div v-else-if="approvals.length > 0" class="table-card">
      <table class="approvals-table">
        <thead>
          <tr>
            <th>Educator Email</th>
            <th>Requested Date</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in approvals" :key="item.user_id">
            <td class="email-cell">
              <strong>{{ item.email }}</strong>
            </td>
            <td class="date-cell">{{ formatDate(item.created_at) }}</td>
            <td>
              <span :class="['status-badge', item.approval_status]">
                {{ item.approval_status }}
              </span>
            </td>
            <td class="text-right actions-cell">
              <!-- When Status is Pending: Can Approve or Reject -->
              <template v-if="item.approval_status === 'pending'">
                <button
                  class="btn-action-approve"
                  :disabled="actionInProgressId === item.user_id"
                  @click="handleApprove(item)"
                >
                  {{ actionInProgressId === item.user_id ? 'Saving…' : 'Approve' }}
                </button>
                <button
                  class="btn-action-reject"
                  :disabled="actionInProgressId === item.user_id"
                  @click="openRejectionModal(item, $event)"
                >
                  Reject
                </button>
              </template>

              <!-- When Status is Rejected: Can Re-Approve -->
              <template v-else-if="item.approval_status === 'rejected'">
                <button
                  class="btn-action-approve"
                  :disabled="actionInProgressId === item.user_id"
                  @click="handleApprove(item)"
                >
                  {{ actionInProgressId === item.user_id ? 'Saving…' : 'Re-Approve' }}
                </button>
              </template>

              <!-- When Status is Approved: Read-only per contract rules -->
              <template v-else>
                <span class="text-muted-status">Authorized</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination Bar -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> registrations
        </div>
        <div class="pagination-actions">
          <button class="page-btn" :disabled="page <= 1 || isLoading" @click="handlePrevPage">
            ◀ Previous
          </button>
          <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages || isLoading" @click="handleNextPage">
            Next ▶
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!errorMessage" class="empty-state">
      <h4>No Registrations in this Queue</h4>
      <p v-if="currentStatus === 'pending'">
        There are currently no educator registrations pending administrative review.
      </p>
      <p v-else-if="currentStatus === 'approved'">
        There are currently no approved educator registrations recorded.
      </p>
      <p v-else>
        There are currently no rejected educator registrations recorded.
      </p>
    </div>

    <!-- Rejection Confirmation Modal -->
    <div
      v-if="rejectionTarget"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelRejection"
    >
      <div
        ref="modalCardRef"
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
        tabindex="-1"
      >
        <h3 id="modal-title" class="modal-title">Confirm Rejection</h3>
        <p class="modal-body">
          Are you sure you want to reject the registration for
          <strong class="target-email">{{ rejectionTarget.email }}</strong>?
        </p>
        <p id="modal-desc" class="modal-subtext">
          Rejecting prevents web portal access but keeps the account registered so the email address cannot be reused. You can approve this account later if needed.
        </p>
        <div class="modal-actions">
          <button ref="cancelButtonRef" class="btn-modal-cancel" @click="cancelRejection">Cancel</button>
          <button class="btn-modal-confirm" @click="confirmRejection">Confirm Rejection</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-approvals-view {
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

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.status-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-tabs {
  display: flex;
  gap: 0.5rem;
  background-color: var(--color-bg-subtle);
  padding: 0.25rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.status-tab {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-tab:hover {
  color: var(--color-text-main);
}

.status-tab.active {
  background-color: var(--color-card);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

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

.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border-color: var(--color-primary);
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

.notice-banner.warning {
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning);
}

.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.approvals-table {
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
}

td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.92rem;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background-color: var(--color-bg-subtle);
}

.email-cell strong {
  color: var(--color-text-main);
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge.pending {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.status-badge.approved {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-badge.rejected {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.actions-cell {
  white-space: nowrap;
}

.text-right {
  text-align: right;
}

.btn-action-approve {
  padding: 0.4rem 0.85rem;
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  margin-right: 0.5rem;
  transition: all 0.15s ease;
}

.btn-action-approve:hover:not(:disabled) {
  background-color: var(--color-success);
  color: #ffffff;
}

.btn-action-reject {
  padding: 0.4rem 0.85rem;
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-reject:hover:not(:disabled) {
  background-color: var(--color-danger);
  color: #ffffff;
}

.btn-action-approve:disabled,
.btn-action-reject:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-muted-status {
  color: var(--color-text-dim);
  font-size: 0.85rem;
  font-weight: 500;
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

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
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

/* Modal styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.modal-card {
  background-color: #ffffff;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  max-width: 460px;
  width: 100%;
  padding: 1.75rem;
}

.modal-title {
  margin: 0 0 0.75rem 0;
  color: var(--color-danger);
  font-size: 1.25rem;
}

.modal-body {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 0.95rem;
  line-height: 1.5;
}

.target-email {
  color: var(--color-primary);
}

.modal-subtext {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-modal-cancel {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-main);
  cursor: pointer;
}

.btn-modal-cancel:hover {
  background-color: var(--color-border);
}

.btn-modal-confirm {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
}

.btn-modal-confirm:hover {
  background-color: #b91c1c;
}
</style>
