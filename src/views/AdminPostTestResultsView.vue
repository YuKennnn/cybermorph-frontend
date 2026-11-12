<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import {
  isAdminPostTestBackendSupported,
  isAdminPostTestMockEnabled,
  fetchAdminPostTestPlayers,
  fetchAdminPostTestPlayerHistory,
} from '../api/adminPostTest'
import { parseBackendUtcTimestamp } from '../utils/datetime'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()

const isBackendSupported = isAdminPostTestBackendSupported()
const isDevMock = isAdminPostTestMockEnabled()
const isFeatureAvailable = computed(() => isBackendSupported || isDevMock)

// Dev-only preview state ('default' | 'loading' | 'error' | 'empty')
const devPreviewState = ref('default')

const players = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(8)
const searchQuery = ref('')
const isLoading = ref(isFeatureAvailable.value)
const errorMessage = ref('')

// Attempt history drawer state
const selectedPlayerId = ref(null)
const historyDetail = ref(null)
const isHistoryLoading = ref(false)
const historyError = ref('')
const drawerCloseBtnRef = ref(null)
let lastTriggerEl = null

let currentSessionEpoch = 0
let latestListReqId = 0
let latestHistoryReqId = 0
let debounceTimer = null
let isResetting = false

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.max(1, Math.ceil(totalCount.value / pageSize.value))
})

const hasMixedPassFail = computed(() => {
  const player = historyDetail.value?.player
  if (!player || player.attemptCount < 2) return false
  return Boolean(player.bestPassed && player.latestPassed === false)
})

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

const formatScore = (score, percentage) => {
  if (score === null || score === undefined) return '—'
  const pctText = percentage !== null && percentage !== undefined ? ` (${percentage}%)` : ''
  return `${score}/30${pctText}`
}

const getStatusLabel = (player) => {
  if (!player || player.attemptCount === 0) return 'No attempts yet'
  return player.latestPassed ? 'Passed' : 'Failed'
}

const getStatusClass = (player) => {
  if (!player || player.attemptCount === 0) return 'status-none'
  return player.latestPassed ? 'status-passed' : 'status-failed'
}

const resetState = () => {
  isResetting = true
  latestListReqId++
  latestHistoryReqId++
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  players.value = []
  totalCount.value = 0
  page.value = 1
  searchQuery.value = ''
  isLoading.value = false
  errorMessage.value = ''
  selectedPlayerId.value = null
  historyDetail.value = null
  isHistoryLoading.value = false
  historyError.value = ''
  Promise.resolve().then(() => {
    isResetting = false
  })
}

const loadPlayers = async () => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) {
    isLoading.value = false
    return
  }

  if (!isFeatureAvailable.value) {
    isLoading.value = false
    players.value = []
    totalCount.value = 0
    errorMessage.value = ''
    return
  }

  if (isDevMock && devPreviewState.value === 'loading') {
    isLoading.value = true
    errorMessage.value = ''
    return
  }

  const reqId = ++latestListReqId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await fetchAdminPostTestPlayers({
      search: searchQuery.value.trim(),
      page: page.value,
      pageSize: pageSize.value,
      previewState: isDevMock ? devPreviewState.value : 'default',
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
    totalCount.value = typeof result?.totalCount === 'number' ? result.totalCount : players.value.length
    if (typeof result?.page === 'number') page.value = result.page
  } catch {
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
    }
  }
}

const openPlayerHistory = async (player, event) => {
  if (!player || !isFeatureAvailable.value) return
  if (event?.currentTarget instanceof HTMLElement) {
    lastTriggerEl = event.currentTarget
  }

  selectedPlayerId.value = player.playerId
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
    const detail = await fetchAdminPostTestPlayerHistory({
      playerId: player.playerId,
      previewState: isDevMock && devPreviewState.value === 'error' ? 'error' : 'default',
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
  } catch {
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestHistoryReqId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    historyError.value = 'Unable to load this player’s attempt history. Please try again.'
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestHistoryReqId) {
      isHistoryLoading.value = false
    }
  }
}

const closeHistoryDrawer = () => {
  latestHistoryReqId++
  selectedPlayerId.value = null
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
  if (event.key === 'Escape' && selectedPlayerId.value) {
    closeHistoryDrawer()
  }
}

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    page.value -= 1
    loadPlayers()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    page.value += 1
    loadPlayers()
  }
}

const handleClearSearch = () => {
  searchQuery.value = ''
}

const handlePreviewStateChange = (nextState) => {
  devPreviewState.value = nextState
  page.value = 1
  if (selectedPlayerId.value) {
    closeHistoryDrawer()
  }
  loadPlayers()
}

watch(searchQuery, () => {
  if (isResetting || !isFeatureAvailable.value) return
  latestListReqId++
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadPlayers()
  }, 250)
})

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
      loadPlayers()
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (authStore.isAuthenticated && authStore.isAdmin) {
    loadPlayers()
  } else {
    resetState()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  currentSessionEpoch++
  latestListReqId++
  latestHistoryReqId++
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>

<template>
  <div class="admin-post-test-view">
    <header class="view-header">
      <div class="header-text">
        <h2 class="title">Post-test results</h2>
        <p class="subtitle">
          Review submitted post-test outcomes across all player accounts, including independent players without a classroom.
        </p>
      </div>
    </header>

    <!-- Development-only Sample Data Banner & Preview Switcher -->
    <section
      v-if="isDevMock"
      class="dev-preview-bar"
      aria-label="Development preview controls"
    >
      <div class="dev-preview-copy">
        <AppIcon name="info" :size="16" class="dev-preview-icon" />
        <span>
          <strong>Sample data preview:</strong> Simulated results shown for development review only. Not connected to live backend records.
        </span>
      </div>
      <div class="dev-preview-controls" role="group" aria-label="Preview state">
        <button
          v-for="mode in [
            { id: 'default', label: 'Sample data' },
            { id: 'loading', label: 'Loading' },
            { id: 'error', label: 'Error' },
            { id: 'empty', label: 'Empty' },
          ]"
          :key="mode.id"
          type="button"
          :class="['preview-chip', { active: devPreviewState === mode.id }]"
          @click="handlePreviewStateChange(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>
    </section>

    <!-- Production Unavailable State -->
    <section v-if="!isFeatureAvailable" class="unavailable-card" aria-live="polite">
      <div class="unavailable-icon-wrap">
        <AppIcon name="clipboard-check" :size="24" />
      </div>
      <h3>Post-test results are not available yet</h3>
      <p>
        The backend service does not currently store or serve post-test assessment results.
        Once persisted assessment endpoints are added, administrators will be able to search players and inspect attempt histories here.
      </p>
    </section>

    <!-- Active View (Dev Mock or Future Backend) -->
    <template v-else>
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search by player name, username, or classroom..."
            class="search-input"
            aria-label="Search players"
          />
        </div>

        <div class="filter-controls">
          <button
            type="button"
            class="btn-refresh"
            :disabled="isLoading"
            aria-label="Refresh post-test results"
            @click="loadPlayers"
          >
            <AppIcon name="refresh" :size="16" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" @click="loadPlayers">Retry</button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading player post-test results...</p>
      </div>

      <!-- Results Table -->
      <div v-else-if="players.length > 0" class="table-card">
        <div class="table-scroll">
          <table class="results-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Assessment status</th>
                <th scope="col" class="num-col">Attempts</th>
                <th scope="col" class="num-col">Latest score</th>
                <th scope="col" class="num-col">Best score</th>
                <th scope="col">Last submission</th>
                <th scope="col" class="action-col">History</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in players" :key="player.playerId">
                <td class="player-cell">
                  <div class="player-name">{{ player.displayName || player.username }}</div>
                  <div class="player-meta">
                    <span class="player-username">{{ player.username }}</span>
                    <span v-if="player.classroomName" class="player-classroom">
                      {{ player.classroomName }}
                    </span>
                    <span v-else class="player-independent">
                      Independent player
                    </span>
                  </div>
                </td>

                <td>
                  <div class="status-cell">
                    <span :class="['status-pill', getStatusClass(player)]">
                      {{ getStatusLabel(player) }}
                    </span>
                    <span
                      v-if="player.bestPassed && player.latestPassed === false"
                      class="mixed-pill"
                      title="Passed an earlier attempt before failing the latest retake"
                    >
                      Passed earlier
                    </span>
                  </div>
                </td>

                <td class="num-col tabular-num">
                  {{ player.attemptCount }}
                </td>

                <td class="num-col tabular-num">
                  <span v-if="player.attemptCount === 0" class="muted-dash">—</span>
                  <span v-else :class="['score-text', player.latestPassed ? 'pass' : 'fail']">
                    {{ formatScore(player.latestScore, player.latestPercentage) }}
                  </span>
                </td>

                <td class="num-col tabular-num">
                  <span v-if="player.attemptCount === 0" class="muted-dash">—</span>
                  <span v-else class="score-text">
                    {{ formatScore(player.bestScore, player.bestPercentage) }}
                  </span>
                </td>

                <td class="date-cell tabular-num">
                  {{ formatDateTime(player.lastSubmittedAt) }}
                </td>

                <td class="action-col">
                  <button
                    type="button"
                    class="btn-history"
                    :aria-label="`View post-test attempt history for ${player.displayName || player.username}`"
                    @click="openPlayerHistory(player, $event)"
                  >
                    <AppIcon name="eye" :size="15" />
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
              <AppIcon name="chevron-left" :size="16" />
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
              <AppIcon name="chevron-right" :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!errorMessage" class="empty-state">
        <AppIcon name="clipboard-check" :size="28" class="empty-icon" />
        <h4>No matching players</h4>
        <p v-if="searchQuery.trim()">
          No players matched “{{ searchQuery.trim() }}”. Try searching by username, display name, or classroom.
        </p>
        <p v-else>
          No player post-test records are available in this view yet.
        </p>
        <button
          v-if="searchQuery.trim()"
          type="button"
          class="btn-clear"
          @click="handleClearSearch"
        >
          Clear search
        </button>
      </div>
    </template>

    <!-- Player Attempt History Drawer -->
    <div
      v-if="selectedPlayerId"
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
          <div>
            <h3 id="history-drawer-title" class="drawer-title">
              {{ historyDetail?.player?.displayName || historyDetail?.player?.username || 'Attempt history' }}
            </h3>
            <p v-if="historyDetail?.player" class="drawer-subtitle">
              <span>{{ historyDetail.player.username }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ historyDetail.player.classroomName || 'Independent player (no classroom)' }}</span>
            </p>
          </div>
          <button
            ref="drawerCloseBtnRef"
            type="button"
            class="drawer-close-btn"
            aria-label="Close attempt history"
            @click="closeHistoryDrawer"
          >
            <AppIcon name="x" :size="18" />
          </button>
        </div>

        <div class="drawer-body">
          <div v-if="isDevMock" class="drawer-sample-note">
            <AppIcon name="info" :size="15" />
            <span>Sample data preview — scores shown are simulated.</span>
          </div>

          <div v-if="isHistoryLoading" class="drawer-loading" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <p>Loading attempt history...</p>
          </div>

          <div v-else-if="historyError" class="error-banner" role="alert">
            <span>{{ historyError }}</span>
            <button
              type="button"
              class="btn-retry"
              @click="openPlayerHistory({ playerId: selectedPlayerId })"
            >
              Retry
            </button>
          </div>

          <template v-else-if="historyDetail?.player">
            <!-- Summary Strip -->
            <div class="summary-strip">
              <div class="summary-metric">
                <span class="metric-label">Completed attempts</span>
                <strong class="metric-value tabular-num">{{ historyDetail.player.attemptCount }}</strong>
              </div>
              <div class="summary-metric">
                <span class="metric-label">Latest score</span>
                <strong class="metric-value tabular-num">
                  {{ formatScore(historyDetail.player.latestScore, historyDetail.player.latestPercentage) }}
                </strong>
              </div>
              <div class="summary-metric">
                <span class="metric-label">Best score</span>
                <strong class="metric-value tabular-num">
                  {{ formatScore(historyDetail.player.bestScore, historyDetail.player.bestPercentage) }}
                </strong>
              </div>
            </div>

            <!-- Mixed Outcome Callout (Passed earlier, failed later retake) -->
            <div v-if="hasMixedPassFail" class="mixed-outcome-callout" role="note">
              <AppIcon name="warning" :size="17" class="callout-icon" />
              <div>
                <strong>Passed earlier, failed latest retake</strong>
                <p>
                  This player passed an earlier attempt ({{ formatScore(historyDetail.player.bestScore, historyDetail.player.bestPercentage) }}),
                  but their most recent retake ({{ formatScore(historyDetail.player.latestScore, historyDetail.player.latestPercentage) }}) was below the 23/30 (75%) passing threshold.
                </p>
              </div>
            </div>

            <!-- Attempt List -->
            <div v-if="historyDetail.attempts.length > 0" class="attempts-section">
              <div class="attempts-heading-row">
                <h4>Submitted attempts</h4>
                <span class="pass-rule">Passing score: 23/30 (75%)</span>
              </div>

              <ul class="attempts-list">
                <li
                  v-for="attempt in historyDetail.attempts"
                  :key="attempt.attemptId"
                  class="attempt-item"
                >
                  <div class="attempt-main">
                    <div class="attempt-title-row">
                      <span class="attempt-number tabular-num">Attempt #{{ attempt.attemptNumber }}</span>
                      <span :class="['status-pill', attempt.passed ? 'status-passed' : 'status-failed']">
                        {{ attempt.passed ? 'Passed' : 'Failed' }}
                      </span>
                    </div>
                    <div class="attempt-date tabular-num">
                      Submitted {{ formatDateTime(attempt.submittedAt) }}
                    </div>
                  </div>
                  <div class="attempt-score-block tabular-num">
                    <span class="attempt-score">{{ attempt.score }}/{{ attempt.totalQuestions }}</span>
                    <span class="attempt-percent">{{ attempt.percentage }}%</span>
                  </div>
                </li>
              </ul>

              <p class="privacy-note">
                Individual question choices and the assessment answer key are excluded from this admin view.
              </p>
            </div>

            <!-- No Attempts Yet -->
            <div v-else class="drawer-empty">
              <AppIcon name="clipboard-check" :size="24" class="empty-icon" />
              <h4>No attempts yet</h4>
              <p>
                This player has not submitted any post-test attempts. A score of 0/30 will appear only if an attempt is actually submitted.
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
  margin-bottom: 1.5rem;
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

/* Dev-only Preview Bar */
.dev-preview-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.8rem 1rem;
  margin-bottom: 1.25rem;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 12px;
  font-size: 0.86rem;
  color: var(--color-text-main);
}

.dev-preview-copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dev-preview-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.dev-preview-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.preview-chip {
  min-height: 34px;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid var(--color-violet-border);
  background-color: var(--color-card);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.preview-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.preview-chip.active {
  background: var(--btn-gradient);
  border-color: var(--nav-pill-border);
  color: #ffffff;
}

.preview-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Production Unavailable State */
.unavailable-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 2.5rem 1.75rem;
  text-align: center;
  max-width: 640px;
  box-shadow: var(--shadow-card);
}

.unavailable-icon-wrap {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem auto;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-violet-border);
}

.unavailable-card h3 {
  margin: 0 0 0.5rem 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--color-text-main);
}

.unavailable-card p {
  margin: 0 auto;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  max-width: 56ch;
  line-height: 1.55;
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

.search-input-wrapper {
  flex: 1;
  min-width: 240px;
}

.search-input {
  width: 100%;
  min-height: 42px;
  padding: 0.6rem 0.95rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  color: var(--color-text-main);
  transition: border-color 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-violet-subtle);
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
  min-height: 42px;
  padding: 0.6rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Error & Loading */
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.25rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  border-radius: 10px;
  font-size: 0.9rem;
}

.btn-retry {
  min-height: 36px;
  padding: 0.35rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-danger-border);
  background-color: var(--color-card);
  color: var(--color-danger);
  font-weight: 600;
  cursor: pointer;
}

.loading-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-card);
}

/* Table Card */
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
  -webkit-overflow-scrolling: touch;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 700px;
}

.results-table th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.85rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 700;
  border-bottom: 1.5px solid var(--color-border);
  white-space: nowrap;
}

.results-table td {
  padding: 0.85rem 0.8rem;
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

.player-meta {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.player-username {
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.player-independent {
  color: var(--color-text-muted);
}

.status-cell {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
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

.status-pill.status-none {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.mixed-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 600;
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
  white-space: nowrap;
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

.muted-dash {
  color: var(--color-text-dim);
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.84rem;
  white-space: nowrap;
}

.btn-history {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-violet-border);
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.btn-history:hover {
  background-color: var(--color-purple-light);
  border-color: var(--color-primary);
}

.btn-history:focus-visible,
.page-btn:focus-visible,
.btn-refresh:focus-visible,
.drawer-close-btn:focus-visible,
.btn-clear:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.85rem;
  padding: 0.9rem 1.1rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-card);
}

.pagination-info {
  font-size: 0.86rem;
  color: var(--color-text-muted);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 38px;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
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
  max-width: 500px;
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

.drawer-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.drawer-subtitle {
  margin: 0.25rem 0 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.84rem;
  color: var(--color-text-muted);
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

.drawer-sample-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--color-primary);
  font-weight: 500;
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
  font-size: 1rem;
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
  gap: 0.65rem;
}

.attempt-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-card);
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

  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-actions {
    justify-content: space-between;
  }

  .page-btn,
  .btn-refresh,
  .btn-history,
  .drawer-close-btn {
    min-height: 44px;
  }
}
</style>
