<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import {
  fetchAdminPostTestResults,
  fetchAdminPostTestPlayerResult,
} from '../api/adminPostTest'
import { parseBackendUtcTimestamp } from '../utils/datetime'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', passed: null },
  { id: 'passed', label: 'Passed', passed: true },
  { id: 'not_passed', label: 'Not passed', passed: false },
]

const players = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterMode = ref('all')
const isLoading = ref(false)
const errorMessage = ref('')

// Attempt history drawer state
const selectedProfileId = ref(null)
const selectedUsername = ref('')
const historyDetail = ref(null)
const isHistoryLoading = ref(false)
const historyError = ref('')
const drawerCloseBtnRef = ref(null)
let lastTriggerEl = null

let currentSessionEpoch = 0
let latestListReqId = 0
let latestHistoryReqId = 0
let listAbortController = null
let historyAbortController = null

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.max(1, Math.ceil(totalCount.value / pageSize.value))
})

const activePassedParam = computed(() => {
  const match = FILTER_OPTIONS.find((opt) => opt.id === filterMode.value)
  return match ? match.passed : null
})

const hasLaterFailedRetake = computed(() => {
  const detail = historyDetail.value
  if (!detail || !detail.passed) return false
  if (!Array.isArray(detail.attempts) || detail.attempts.length === 0) return false
  return detail.attempts[0].passed === false
})

const isAbortError = (err) =>
  err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError'

const formatDateTime = (isoString) => {
  if (!isoString) return '—'
  const date = parseBackendUtcTimestamp(isoString) || new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatScore = (correctCount, questionCount, scorePercent) => {
  if (
    correctCount === null ||
    correctCount === undefined ||
    questionCount === null ||
    questionCount === undefined ||
    questionCount <= 0
  ) {
    return '—'
  }
  const pctText =
    scorePercent !== null && scorePercent !== undefined ? ` (${scorePercent}%)` : ''
  return `${correctCount}/${questionCount}${pctText}`
}

const resetState = () => {
  latestListReqId++
  latestHistoryReqId++
  if (listAbortController) {
    listAbortController.abort()
    listAbortController = null
  }
  if (historyAbortController) {
    historyAbortController.abort()
    historyAbortController = null
  }
  players.value = []
  totalCount.value = 0
  page.value = 1
  filterMode.value = 'all'
  isLoading.value = false
  errorMessage.value = ''
  selectedProfileId.value = null
  selectedUsername.value = ''
  historyDetail.value = null
  isHistoryLoading.value = false
  historyError.value = ''
  lastTriggerEl = null
}

const loadResults = async () => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) {
    isLoading.value = false
    return
  }

  if (listAbortController) {
    listAbortController.abort()
  }
  const controller = new AbortController()
  listAbortController = controller

  const reqId = ++latestListReqId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await fetchAdminPostTestResults({
      passed: activePassedParam.value,
      page: page.value,
      pageSize: pageSize.value,
      signal: controller.signal,
    })

    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestListReqId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    players.value = Array.isArray(result?.items) ? result.items : []
    totalCount.value =
      typeof result?.total_count === 'number' ? result.total_count : players.value.length
    if (typeof result?.page === 'number') page.value = result.page
    if (typeof result?.page_size === 'number') pageSize.value = result.page_size
  } catch (err) {
    if (isAbortError(err)) return
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestListReqId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    players.value = []
    totalCount.value = 0
    errorMessage.value = 'Unable to load post-test results. Please try again.'
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestListReqId) {
      isLoading.value = false
      if (listAbortController === controller) {
        listAbortController = null
      }
    }
  }
}

const openPlayerHistory = async (row, event) => {
  if (!row?.profile_id || !authStore.isAuthenticated || !authStore.isAdmin) return
  if (event?.currentTarget instanceof HTMLElement) {
    lastTriggerEl = event.currentTarget
  }

  if (historyAbortController) {
    historyAbortController.abort()
  }
  const controller = new AbortController()
  historyAbortController = controller

  selectedProfileId.value = row.profile_id
  if (row.username) {
    selectedUsername.value = row.username
  }
  historyDetail.value = null
  historyError.value = ''
  isHistoryLoading.value = true

  const reqId = ++latestHistoryReqId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch

  nextTick(() => {
    drawerCloseBtnRef.value?.focus()
  })

  try {
    const detail = await fetchAdminPostTestPlayerResult(row.profile_id, {
      signal: controller.signal,
    })

    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestHistoryReqId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    historyDetail.value = detail
  } catch (err) {
    if (isAbortError(err)) return
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestHistoryReqId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    historyError.value =
      err?.response?.status === 404
        ? 'Player post-test record was not found.'
        : 'Unable to load this player’s attempt history. Please try again.'
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestHistoryReqId) {
      isHistoryLoading.value = false
      if (historyAbortController === controller) {
        historyAbortController = null
      }
    }
  }
}

const closeHistoryDrawer = () => {
  latestHistoryReqId++
  if (historyAbortController) {
    historyAbortController.abort()
    historyAbortController = null
  }
  selectedProfileId.value = null
  selectedUsername.value = ''
  historyDetail.value = null
  historyError.value = ''
  isHistoryLoading.value = false
  nextTick(() => {
    if (lastTriggerEl && document.body.contains(lastTriggerEl)) {
      lastTriggerEl.focus()
    }
    lastTriggerEl = null
  })
}

const handleKeyDown = (event) => {
  if (event.key === 'Escape' && selectedProfileId.value) {
    closeHistoryDrawer()
  }
}

const handleFilterChange = (nextMode) => {
  if (filterMode.value === nextMode && page.value === 1) return
  filterMode.value = nextMode
  page.value = 1
  loadResults()
}

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    page.value -= 1
    loadResults()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    page.value += 1
    loadResults()
  }
}

watch(
  [() => authStore.isAuthenticated, () => authStore.token, () => authStore.user?.user_id],
  ([isAuth, token, userId], [, prevToken, prevUserId]) => {
    if (!isAuth || !authStore.isAdmin) {
      currentSessionEpoch++
      resetState()
      return
    }
    if (token !== prevToken || userId !== prevUserId) {
      currentSessionEpoch++
      resetState()
      loadResults()
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (authStore.isAuthenticated && authStore.isAdmin) {
    loadResults()
  } else {
    resetState()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  currentSessionEpoch++
  latestListReqId++
  latestHistoryReqId++
  if (listAbortController) {
    listAbortController.abort()
    listAbortController = null
  }
  if (historyAbortController) {
    historyAbortController.abort()
    historyAbortController = null
  }
})
</script>

<template>
  <div class="admin-post-test-view">
    <header class="view-header">
      <div class="header-text">
        <h2 class="title">Post-test results</h2>
        <p class="subtitle">
          Submitted post-test results across all players, ordered by most recent submission.
        </p>
      </div>
    </header>

    <div class="filter-bar">
      <div class="filter-tabs" role="group" aria-label="Filter results by pass status">
        <button
          v-for="option in FILTER_OPTIONS"
          :key="option.id"
          type="button"
          :class="['filter-tab', { active: filterMode === option.id }]"
          :aria-pressed="filterMode === option.id"
          :disabled="isLoading"
          @click="handleFilterChange(option.id)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="filter-controls">
        <button
          type="button"
          class="btn-refresh"
          :disabled="isLoading"
          aria-label="Refresh post-test results"
          @click="loadResults"
        >
          <AppIcon name="refresh" :size="16" aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="errorMessage" class="error-banner" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="btn-retry" @click="loadResults">Retry</button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>Loading post-test results...</p>
    </div>

    <!-- Results Table -->
    <div v-else-if="players.length > 0" class="table-card">
      <div class="table-scroll">
        <table class="results-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Overall status</th>
              <th scope="col" class="num-col">Attempts</th>
              <th scope="col" class="num-col">Best score</th>
              <th scope="col">Last submission</th>
              <th scope="col" class="action-col">History</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in players" :key="row.profile_id">
              <td class="player-cell">
                <span class="player-name">{{ row.username }}</span>
              </td>

              <td>
                <span :class="['status-pill', row.passed ? 'status-passed' : 'status-failed']">
                  {{ row.passed ? 'Passed' : 'Not passed' }}
                </span>
              </td>

              <td class="num-col tabular-num">
                {{ row.attempts }}
              </td>

              <td class="num-col tabular-num">
                <span :class="['score-text', row.passed ? 'pass' : 'fail']">
                  {{ formatScore(row.best_correct_count, row.question_count, row.best_score_percent) }}
                </span>
              </td>

              <td class="date-cell tabular-num">
                {{ formatDateTime(row.last_submitted_at) }}
              </td>

              <td class="action-col">
                <button
                  type="button"
                  class="btn-history"
                  :aria-label="`View post-test attempt history for ${row.username}`"
                  @click="openPlayerHistory(row, $event)"
                >
                  <AppIcon name="eye" :size="15" aria-hidden="true" />
                  <span>View history</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Bar -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info tabular-num">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> players
        </div>
        <div class="pagination-actions">
          <button
            type="button"
            class="page-btn"
            :disabled="page <= 1 || isLoading"
            @click="handlePrevPage"
          >
            <AppIcon name="chevron-left" :size="16" aria-hidden="true" />
            <span>Previous</span>
          </button>
          <span class="page-indicator tabular-num">Page {{ page }} of {{ totalPages }}</span>
          <button
            type="button"
            class="page-btn"
            :disabled="page >= totalPages || isLoading"
            @click="handleNextPage"
          >
            <span>Next</span>
            <AppIcon name="chevron-right" :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!errorMessage" class="empty-state">
      <AppIcon name="clipboard-check" :size="28" class="empty-icon" aria-hidden="true" />
      <h4 v-if="filterMode !== 'all'">No matching players</h4>
      <h4 v-else>No submitted post-tests yet</h4>
      <p v-if="filterMode === 'passed'">
        No players have passed the post-test yet.
      </p>
      <p v-else-if="filterMode === 'not_passed'">
        No players are currently in the not-passed group.
      </p>
      <p v-else>
        Players will appear here once they submit a post-test attempt.
      </p>
      <button
        v-if="filterMode !== 'all'"
        type="button"
        class="btn-clear"
        @click="handleFilterChange('all')"
      >
        Show all players
      </button>
    </div>

    <!-- Player Attempt History Drawer -->
    <div
      v-if="selectedProfileId"
      class="drawer-backdrop"
      @click.self="closeHistoryDrawer"
    >
      <aside
        class="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-drawer-title"
      >
        <div class="drawer-header">
          <div class="drawer-title-group">
            <h3 id="history-drawer-title" class="drawer-title">
              {{ historyDetail?.username || selectedUsername || 'Attempt history' }}
            </h3>
            <div v-if="historyDetail" class="drawer-status-row">
              <span
                :class="[
                  'status-pill',
                  historyDetail.passed ? 'status-passed' : 'status-failed',
                ]"
              >
                {{ historyDetail.passed ? 'Overall passed' : 'Not passed' }}
              </span>
            </div>
          </div>
          <button
            ref="drawerCloseBtnRef"
            type="button"
            class="drawer-close-btn"
            aria-label="Close attempt history"
            @click="closeHistoryDrawer"
          >
            <AppIcon name="x" :size="18" aria-hidden="true" />
          </button>
        </div>

        <div class="drawer-body">
          <div v-if="isHistoryLoading" class="drawer-loading" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <p>Loading attempt history...</p>
          </div>

          <div v-else-if="historyError" class="error-banner" role="alert">
            <span>{{ historyError }}</span>
            <button
              type="button"
              class="btn-retry"
              @click="openPlayerHistory({ profile_id: selectedProfileId, username: selectedUsername })"
            >
              Retry
            </button>
          </div>

          <template v-else-if="historyDetail">
            <!-- Summary Strip -->
            <div class="summary-strip">
              <div class="summary-metric">
                <span class="metric-label">Overall status</span>
                <strong class="metric-value">
                  {{ historyDetail.passed ? 'Passed' : 'Not passed' }}
                </strong>
              </div>
              <div class="summary-metric">
                <span class="metric-label">Submitted attempts</span>
                <strong class="metric-value tabular-num">
                  {{ historyDetail.attempts.length }}
                </strong>
              </div>
              <div class="summary-metric">
                <span class="metric-label">Best score</span>
                <strong class="metric-value tabular-num">
                  {{
                    historyDetail.best
                      ? formatScore(
                          historyDetail.best.correct_count,
                          historyDetail.best.question_count,
                          historyDetail.best.score_percent,
                        )
                      : '—'
                  }}
                </strong>
              </div>
            </div>

            <!-- Distinction between overall pass and a later failed retake -->
            <div v-if="hasLaterFailedRetake" class="mixed-outcome-callout" role="note">
              <AppIcon name="warning" :size="17" class="callout-icon" aria-hidden="true" />
              <div>
                <strong>Overall passed — latest retake below {{ historyDetail.attempts[0].pass_mark_percent }}%</strong>
                <p>
                  This player’s overall pass stands from their best attempt ({{
                    formatScore(
                      historyDetail.best?.correct_count,
                      historyDetail.best?.question_count,
                      historyDetail.best?.score_percent,
                    )
                  }}), while their most recent retake ({{
                    formatScore(
                      historyDetail.attempts[0].correct_count,
                      historyDetail.attempts[0].question_count,
                      historyDetail.attempts[0].score_percent,
                    )
                  }}) did not meet the pass mark.
                </p>
              </div>
            </div>

            <!-- Attempt List (Newest First) -->
            <div v-if="historyDetail.attempts.length > 0" class="attempts-section">
              <div class="attempts-heading-row">
                <h4>Submitted attempts</h4>
                <span class="pass-rule">
                  Pass mark: {{ historyDetail.attempts[0].pass_mark_percent }}%
                </span>
              </div>

              <ul class="attempts-list">
                <li
                  v-for="(attempt, index) in historyDetail.attempts"
                  :key="attempt.attempt_id"
                  class="attempt-item"
                >
                  <div class="attempt-header-row">
                    <div class="attempt-main">
                      <div class="attempt-title-row">
                        <span class="attempt-number">
                          {{ index === 0 ? 'Latest submission' : 'Earlier submission' }}
                        </span>
                        <span
                          :class="[
                            'status-pill',
                            attempt.passed ? 'status-passed' : 'status-failed',
                          ]"
                        >
                          {{ attempt.passed ? 'Passed' : 'Failed' }}
                        </span>
                      </div>
                      <div class="attempt-date tabular-num">
                        Submitted {{ formatDateTime(attempt.submitted_at) }}
                      </div>
                    </div>
                    <div class="attempt-score-block tabular-num">
                      <span class="attempt-score">
                        {{ attempt.correct_count }}/{{ attempt.question_count }}
                      </span>
                      <span class="attempt-percent">{{ attempt.score_percent }}%</span>
                    </div>
                  </div>

                  <div
                    v-if="Array.isArray(attempt.topics) && attempt.topics.length > 0"
                    class="attempt-topics"
                    aria-label="Topic breakdown"
                  >
                    <div
                      v-for="topicItem in attempt.topics"
                      :key="topicItem.topic"
                      class="topic-chip"
                    >
                      <span class="topic-name">{{ topicItem.topic }}</span>
                      <span class="topic-score tabular-num">
                        {{ topicItem.correct }}/{{ topicItem.total }}
                      </span>
                    </div>
                  </div>
                </li>
              </ul>

              <p class="privacy-note">
                Individual question choices and answer keys are excluded from admin reporting.
              </p>
            </div>

            <!-- Empty Attempt List -->
            <div v-else class="drawer-empty">
              <AppIcon name="clipboard-check" :size="24" class="empty-icon" aria-hidden="true" />
              <h4>No submitted attempts.</h4>
              <p>
                A score of 0/{{ historyDetail.best?.question_count || 40 }} appears only when an attempt is actually submitted.
              </p>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.admin-post-test-view {
  width: 100%;
}

.view-header {
  margin-bottom: 1.35rem;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.94rem;
  max-width: 70ch;
}

.tabular-num {
  font-variant-numeric: tabular-nums;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}

.filter-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.25rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.filter-tab {
  min-height: 36px;
  padding: 0.38rem 0.9rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.filter-tab:hover:not(:disabled) {
  color: var(--color-text-main);
}

.filter-tab.active {
  background-color: var(--color-card);
  border-color: var(--color-border);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.filter-tab:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.filter-tab:focus-visible,
.btn-refresh:focus-visible,
.btn-history:focus-visible,
.page-btn:focus-visible,
.drawer-close-btn:focus-visible,
.btn-clear:focus-visible,
.btn-retry:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.5rem 0.95rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.btn-refresh:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-refresh:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.25rem;
  border-radius: 10px;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  font-size: 0.9rem;
}

.btn-retry {
  min-height: 36px;
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-danger-border);
  background-color: var(--color-card);
  color: var(--color-danger);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  flex-shrink: 0;
}

/* Loading State */
.loading-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
}

/* Results Table */
.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.results-table th {
  padding: 0.85rem 0.95rem;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.results-table td {
  padding: 0.85rem 0.95rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.88rem;
  vertical-align: middle;
}

.results-table tbody tr:last-child td {
  border-bottom: none;
}

.results-table tbody tr:hover {
  background-color: var(--color-bg-subtle);
}

.num-col {
  text-align: right;
  white-space: nowrap;
}

.action-col {
  text-align: right;
  white-space: nowrap;
}

.player-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.62rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.status-pill.status-passed {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-pill.status-failed {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.score-text {
  font-weight: 600;
  color: var(--color-text-main);
}

.score-text.pass {
  color: var(--color-success);
}

.score-text.fail {
  color: var(--color-danger);
}

.date-cell {
  color: var(--color-text-muted);
  white-space: nowrap;
}

.btn-history {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.btn-history:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
}

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
}

.pagination-info {
  font-size: 0.84rem;
  color: var(--color-text-muted);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.84rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

/* Empty State */
.empty-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3rem 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.empty-icon {
  color: var(--color-text-dim);
  margin-bottom: 0.75rem;
}

.empty-state h4 {
  margin: 0 0 0.4rem 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--color-text-main);
}

.empty-state p {
  margin: 0 auto 1.1rem auto;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  max-width: 48ch;
}

.btn-clear {
  min-height: 40px;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-violet-border);
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  font-weight: 600;
  font-size: 0.86rem;
  cursor: pointer;
}

/* Attempt History Drawer */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background-color: rgba(15, 23, 42, 0.48);
  display: flex;
  justify-content: flex-end;
}

.history-drawer {
  width: 100%;
  max-width: 520px;
  height: 100%;
  background-color: var(--color-card);
  border-left: 1px solid var(--color-border);
  box-shadow: -8px 0 28px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.4rem;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
}

.drawer-title-group {
  min-width: 0;
}

.drawer-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text-main);
  overflow-wrap: break-word;
}

.drawer-status-row {
  margin-top: 0.45rem;
}

.drawer-close-btn {
  min-width: 40px;
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.drawer-close-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.drawer-body {
  padding: 1.25rem 1.4rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.drawer-loading {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-metric {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.75rem 0.85rem;
}

.metric-label {
  display: block;
  font-size: 0.76rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
}

.metric-value {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.mixed-outcome-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-text-main);
  font-size: 0.85rem;
}

.callout-icon {
  color: var(--color-warning);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.mixed-outcome-callout p {
  margin: 0.25rem 0 0 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.attempts-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.attempts-heading-row h4 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.pass-rule {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.attempts-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attempt-item {
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-card);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attempt-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.attempt-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.attempt-number {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-main);
}

.attempt-date {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.attempt-score-block {
  text-align: right;
  flex-shrink: 0;
}

.attempt-score {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.attempt-percent {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.attempt-topics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border-subtle);
}

.topic-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background-color: var(--color-bg-subtle);
  font-size: 0.78rem;
}

.topic-name {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-score {
  font-weight: 600;
  color: var(--color-text-main);
  flex-shrink: 0;
}

.privacy-note {
  margin: 0.9rem 0 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.drawer-empty {
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

.drawer-empty h4 {
  margin: 0.4rem 0;
  font-size: 0.98rem;
  color: var(--color-text-main);
}

.drawer-empty p {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .summary-strip {
    grid-template-columns: 1fr;
  }

  .attempt-topics {
    grid-template-columns: 1fr;
  }

  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-actions {
    justify-content: space-between;
  }

  .filter-tab,
  .page-btn,
  .btn-refresh,
  .btn-history,
  .drawer-close-btn {
    min-height: 44px;
  }
}
</style>
