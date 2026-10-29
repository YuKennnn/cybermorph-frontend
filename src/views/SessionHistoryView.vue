<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchSessionHistory } from '../api/session'
import { normalizeSessionHistoryResponse } from '../utils/playerSessions'
import PlayerSessionsTable from '../components/player/PlayerSessionsTable.vue'
import AppIcon from '../components/common/AppIcon.vue'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const sessions = ref([])
const totalCount = ref(null)
const currentPage = ref(1)
const isLoading = ref(false)
const isRetrying = ref(false)
const errorMessage = ref('')

let sessionRequestId = 0

const getActiveAccountScope = () => {
  if (!authStore.token) return ''
  return `${authStore.token}::${authStore.user?.user_id || ''}::${authStore.user?.profile_id || ''}`
}

const totalPages = computed(() => {
  if (totalCount.value === null || totalCount.value <= 0) return 1
  return Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE))
})

const recordRangeLabel = computed(() => {
  if (totalCount.value === null || totalCount.value === 0 || sessions.value.length === 0) {
    return '0'
  }
  const start = (currentPage.value - 1) * PAGE_SIZE + 1
  const end = Math.min(totalCount.value, start + sessions.value.length - 1)
  return `${start}–${end}`
})

const totalRecordsLabel = computed(() => {
  if (totalCount.value === null) return 'unknown'
  return `${totalCount.value} session${totalCount.value === 1 ? '' : 's'}`
})

/**
 * Parses and validates raw page query.
 * Normalizes invalid values to 1 and indicates if URL sync is required.
 */
const parseQueryPage = (rawPage) => {
  if (rawPage === undefined || rawPage === null || rawPage === '') {
    return { page: 1, needsUrlSync: true }
  }
  const str = String(rawPage).trim()
  if (!/^\d+$/.test(str)) {
    return { page: 1, needsUrlSync: true }
  }
  const parsed = parseInt(str, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return { page: 1, needsUrlSync: true }
  }
  return { page: parsed, needsUrlSync: false }
}

const loadPage = async (targetPage, { isRetry = false } = {}) => {
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) {
    sessions.value = []
    totalCount.value = null
    isLoading.value = false
    return
  }

  const reqId = ++sessionRequestId
  if (isRetry) {
    isRetrying.value = true
  } else {
    isLoading.value = true
  }
  errorMessage.value = ''

  try {
    const rawRes = await fetchSessionHistory({
      page: targetPage,
      page_size: PAGE_SIZE,
    })

    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) {
      return
    }

    const norm = normalizeSessionHistoryResponse(rawRes, authStore.user?.profile_id)
    if (!norm.valid) {
      errorMessage.value = norm.error || 'Failed to parse session history.'
      sessions.value = []
      totalCount.value = null
      return
    }

    const resolvedTotal =
      norm.totalCount ?? norm.gamesPlayed ?? (norm.items ? norm.items.length : 0)
    totalCount.value = resolvedTotal

    // Check out-of-range recovery
    const computedTotalPages =
      resolvedTotal > 0 ? Math.max(1, Math.ceil(resolvedTotal / PAGE_SIZE)) : 1

    if (targetPage > computedTotalPages) {
      router.replace({
        query: {
          ...route.query,
          page: computedTotalPages,
        },
      })
      return
    }

    sessions.value = norm.items
    currentPage.value = targetPage
  } catch (err) {
    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) {
      return
    }
    errorMessage.value =
      err?.response?.data?.detail ||
      err?.message ||
      'Unable to load session history. Please try again.'
  } finally {
    if (reqId === sessionRequestId) {
      isLoading.value = false
      isRetrying.value = false
    }
  }
}

const handlePageChange = (newPage) => {
  if (newPage < 1 || newPage === currentPage.value) return
  router.push({
    query: {
      ...route.query,
      page: newPage,
    },
  })
}

// Watch route.query.page for direct links, browser Back/Forward, and manual entry
watch(
  () => route.query.page,
  (newRawPage) => {
    const { page, needsUrlSync } = parseQueryPage(newRawPage)
    if (needsUrlSync) {
      router.replace({
        query: {
          ...route.query,
          page: 1,
        },
      })
      return
    }
    loadPage(page)
  },
  { immediate: true },
)

// Watch active account scope (switching profiles / logout)
watch(
  () => getActiveAccountScope(),
  (newScope, oldScope) => {
    if (newScope === oldScope) return
    sessionRequestId++
    sessions.value = []
    totalCount.value = null
    currentPage.value = 1
    errorMessage.value = ''
    if (!newScope) {
      isLoading.value = false
      return
    }
    const { page } = parseQueryPage(route.query.page)
    loadPage(page)
  },
)

onUnmounted(() => {
  sessionRequestId++
})
</script>

<template>
  <div class="session-history-view">
    <div class="view-header">
      <div class="header-text">
        <h2 id="session-history-heading" class="title">Session history</h2>
        <p class="subtitle">Complete record of your CyberMorph gameplay sessions</p>
      </div>
      <div class="header-actions">
        <router-link to="/dashboard" class="btn-secondary">
          Overview
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading && !isRetrying"
      class="state-card loading-state"
      role="status"
      aria-live="polite"
    >
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-message">Loading session history...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage" class="state-card error-state" role="alert">
      <div class="error-header">
        <AppIcon name="alert" :size="20" class="error-icon" />
        <h3 class="state-title">Session history unavailable</h3>
      </div>
      <p class="state-description">{{ errorMessage }}</p>
      <button
        type="button"
        class="btn-retry"
        :disabled="isRetrying"
        @click="loadPage(currentPage, { isRetry: true })"
      >
        {{ isRetrying ? 'Retrying...' : 'Try again' }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="sessions.length === 0" class="state-card empty-state">
      <AppIcon name="clock" :size="36" class="empty-icon" />
      <h3 class="state-title">No gameplay sessions recorded yet</h3>
      <p class="state-description">
        Complete a session in the CyberMorph game to view your session history and performance details here.
      </p>
    </div>

    <!-- Populated State -->
    <div v-else class="history-content-card">
      <div class="history-card-header">
        <span class="history-count-note">
          Showing {{ recordRangeLabel }} of {{ totalRecordsLabel }}
        </span>
      </div>

      <PlayerSessionsTable
        :sessions="sessions"
        aria-labelledby="session-history-heading"
      />

      <!-- Pagination Navigation -->
      <nav
        class="pagination-bar"
        aria-label="Session history pagination"
      >
        <button
          type="button"
          class="btn-pagination"
          :disabled="currentPage <= 1 || isLoading || isRetrying"
          aria-label="Go to previous page"
          @click="handlePageChange(currentPage - 1)"
        >
          <AppIcon name="chevron-left" :size="16" />
          <span>Previous</span>
        </button>

        <span class="pagination-info" aria-live="polite">
          Page <strong>{{ currentPage }}</strong> of <strong>{{ totalPages }}</strong>
        </span>

        <button
          type="button"
          class="btn-pagination"
          :disabled="currentPage >= totalPages || isLoading || isRetrying"
          aria-label="Go to next page"
          @click="handlePageChange(currentPage + 1)"
        >
          <span>Next</span>
          <AppIcon name="chevron-right" :size="16" />
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.session-history-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

/* State Cards */
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  gap: 0.75rem;
}

.loading-state .spinner {
  width: 2.25rem;
  height: 2.25rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.state-message,
.state-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  max-width: 480px;
}

.error-state {
  border-color: var(--color-danger-border);
  background-color: var(--color-card);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-danger);
}

.error-icon {
  color: var(--color-danger);
}

.state-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.error-state .state-title {
  color: var(--color-danger);
}

.empty-icon {
  color: var(--color-text-dim);
}

.btn-retry {
  margin-top: 0.5rem;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* History Content Card */
.history-content-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
}

.history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-count-note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

/* Pagination Bar */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-pagination {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-pagination:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-pagination:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-text-main);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
