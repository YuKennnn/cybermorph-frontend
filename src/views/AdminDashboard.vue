<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useApiCacheStore } from '../stores/apiCacheStore'
import { fetchAdminStats, fetchAdminApprovals, fetchAdminLogs } from '../api/admin'
import { fetchAdminPostTestSummary } from '../api/adminPostTest'
import { formatAuditLogTimestamp } from '../utils/datetime'
import { getActionLabel, getActionBadgeClass } from '../utils/auditLogs'
import { usePageRecovery } from '../composables/usePageRecovery'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()
const cacheStore = useApiCacheStore()

const STATS_KEY = 'admin::stats::summary'
const STATS_TTL = 120000 // 120s

const APPROVALS_KEY = 'admin::approvals::preview::page_size=1&status=pending'
const APPROVALS_TTL = 60000 // 60s

const LOGS_KEY = 'admin::logs::preview::page_size=5'
const LOGS_TTL = 60000 // 60s

const POST_TEST_SUMMARY_KEY = 'admin::post-test::summary'
const POST_TEST_SUMMARY_TTL = 120000 // 120s

const adminGreetingName = computed(() => authStore.user?.display_name?.trim() || 'Admin')

// Metrics (System stats)
const totalUsers = ref(null)
const sessionsReceived = ref(null)
const statsLoading = ref(true)
const statsRefreshing = ref(false)
const statsError = ref(false)
const hasLoadedStatsOnce = ref(false)

// Pending educator approvals
const pendingApprovals = ref(null)
const approvalsLoading = ref(true)
const approvalsRefreshing = ref(false)
const approvalsError = ref(false)
const hasLoadedApprovalsOnce = ref(false)

// Recent activity (Preview up to 5 items)
const recentLogs = ref([])
const activityLoading = ref(true)
const activityRefreshing = ref(false)
const activityError = ref(false)
const hasLoadedActivityOnce = ref(false)

// Post-test summary
const postTestSummary = ref(null)
const postTestSummaryLoading = ref(true)
const postTestSummaryRefreshing = ref(false)
const postTestSummaryError = ref(false)
const hasLoadedPostTestSummaryOnce = ref(false)

const lastFetchedTimestamp = ref(null)

const lastUpdatedText = computed(() => {
  if (!lastFetchedTimestamp.value) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - lastFetchedTimestamp.value) / 1000))
  if (diffSec < 5) return 'Updated just now'
  if (diffSec < 60) return `Updated ${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  return `Updated ${diffMin}m ago`
})

const isRefreshingAny = computed(
  () =>
    statsRefreshing.value ||
    approvalsRefreshing.value ||
    activityRefreshing.value ||
    postTestSummaryRefreshing.value,
)

let currentSessionEpoch = 0
let latestStatsRequestId = 0
let latestApprovalsRequestId = 0
let latestActivityRequestId = 0
let latestPostTestSummaryRequestId = 0

const resetDashboardState = () => {
  totalUsers.value = null
  sessionsReceived.value = null
  statsLoading.value = false
  statsRefreshing.value = false
  statsError.value = false
  hasLoadedStatsOnce.value = false

  pendingApprovals.value = null
  approvalsLoading.value = false
  approvalsRefreshing.value = false
  approvalsError.value = false
  hasLoadedApprovalsOnce.value = false

  recentLogs.value = []
  activityLoading.value = false
  activityRefreshing.value = false
  activityError.value = false
  hasLoadedActivityOnce.value = false

  postTestSummary.value = null
  postTestSummaryLoading.value = false
  postTestSummaryRefreshing.value = false
  postTestSummaryError.value = false
  hasLoadedPostTestSummaryOnce.value = false

  lastFetchedTimestamp.value = null
}

const loadStats = async ({ force = false } = {}) => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  const reqId = ++latestStatsRequestId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch
  const reqKeyVersion = cacheStore.getKeyVersion(STATS_KEY)

  const cached = cacheStore.get(STATS_KEY)
  if (cached && !force) {
    totalUsers.value = typeof cached.data?.total_users === 'number' ? cached.data.total_users : null
    sessionsReceived.value = typeof cached.data?.sessions_last_24h === 'number' ? cached.data.sessions_last_24h : null
    hasLoadedStatsOnce.value = true
    statsLoading.value = false
    statsError.value = false
    lastFetchedTimestamp.value = cached.fetchedAt

    // Fresh hit: return immediately with 0 network calls
    if (!cached.isExpired) {
      statsRefreshing.value = false
      return
    }

    // Expired: keep cached UI stable, revalidate in background
    statsRefreshing.value = true
  } else {
    statsLoading.value = !hasLoadedStatsOnce.value
    statsError.value = false
  }

  try {
    const data = await fetchAdminStats()
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestStatsRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(STATS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    cacheStore.set(STATS_KEY, data, STATS_TTL)
    totalUsers.value = typeof data?.total_users === 'number' ? data.total_users : null
    sessionsReceived.value = typeof data?.sessions_last_24h === 'number' ? data.sessions_last_24h : null
    hasLoadedStatsOnce.value = true
    lastFetchedTimestamp.value = Date.now()
  } catch (err) {
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestStatsRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(STATS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    statsError.value = true
    if (!hasLoadedStatsOnce.value) {
      totalUsers.value = null
      sessionsReceived.value = null
    }
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestStatsRequestId) {
      statsLoading.value = false
      statsRefreshing.value = false
    }
  }
}

const loadApprovals = async ({ force = false } = {}) => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  const reqId = ++latestApprovalsRequestId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch
  const reqKeyVersion = cacheStore.getKeyVersion(APPROVALS_KEY)

  const cached = cacheStore.get(APPROVALS_KEY)
  if (cached && !force) {
    pendingApprovals.value = typeof cached.data?.total_count === 'number' ? cached.data.total_count : null
    hasLoadedApprovalsOnce.value = true
    approvalsLoading.value = false
    approvalsError.value = false

    if (!cached.isExpired) {
      approvalsRefreshing.value = false
      return
    }

    approvalsRefreshing.value = true
  } else {
    approvalsLoading.value = !hasLoadedApprovalsOnce.value
    approvalsError.value = false
  }

  try {
    const data = await fetchAdminApprovals({ status: 'pending', page_size: 1 })
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestApprovalsRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(APPROVALS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    cacheStore.set(APPROVALS_KEY, data, APPROVALS_TTL)
    pendingApprovals.value = typeof data?.total_count === 'number' ? data.total_count : null
    hasLoadedApprovalsOnce.value = true
  } catch (err) {
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestApprovalsRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(APPROVALS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    approvalsError.value = true
    if (!hasLoadedApprovalsOnce.value) {
      pendingApprovals.value = null
    }
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestApprovalsRequestId) {
      approvalsLoading.value = false
      approvalsRefreshing.value = false
    }
  }
}

const loadRecentActivity = async ({ force = false } = {}) => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  const reqId = ++latestActivityRequestId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch
  const reqKeyVersion = cacheStore.getKeyVersion(LOGS_KEY)

  const cached = cacheStore.get(LOGS_KEY)
  if (cached && !force) {
    recentLogs.value = Array.isArray(cached.data?.items) ? cached.data.items : []
    hasLoadedActivityOnce.value = true
    activityLoading.value = false
    activityError.value = false

    if (!cached.isExpired) {
      activityRefreshing.value = false
      return
    }

    activityRefreshing.value = true
  } else {
    activityLoading.value = !hasLoadedActivityOnce.value
    activityError.value = false
  }

  try {
    const data = await fetchAdminLogs({ page: 1, page_size: 5 })
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestActivityRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(LOGS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    cacheStore.set(LOGS_KEY, data, LOGS_TTL)
    recentLogs.value = Array.isArray(data?.items) ? data.items : []
    hasLoadedActivityOnce.value = true
  } catch (err) {
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestActivityRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(LOGS_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    activityError.value = true
    if (!hasLoadedActivityOnce.value) {
      recentLogs.value = []
    }
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestActivityRequestId) {
      activityLoading.value = false
      activityRefreshing.value = false
    }
  }
}

const loadPostTestSummary = async ({ force = false } = {}) => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  const reqId = ++latestPostTestSummaryRequestId
  const reqSession = currentSessionEpoch
  const reqAuthEpoch = authStore.activeSessionEpoch
  const reqKeyVersion = cacheStore.getKeyVersion(POST_TEST_SUMMARY_KEY)

  const cached = cacheStore.get(POST_TEST_SUMMARY_KEY)
  if (cached && !force) {
    postTestSummary.value = cached.data ?? null
    hasLoadedPostTestSummaryOnce.value = true
    postTestSummaryLoading.value = false
    postTestSummaryError.value = false

    if (!cached.isExpired) {
      postTestSummaryRefreshing.value = false
      return
    }

    postTestSummaryRefreshing.value = true
  } else {
    postTestSummaryLoading.value = !hasLoadedPostTestSummaryOnce.value
    postTestSummaryError.value = false
  }

  try {
    const data = await fetchAdminPostTestSummary()
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestPostTestSummaryRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(POST_TEST_SUMMARY_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }

    cacheStore.set(POST_TEST_SUMMARY_KEY, data, POST_TEST_SUMMARY_TTL)
    postTestSummary.value = data ?? null
    hasLoadedPostTestSummaryOnce.value = true
    postTestSummaryError.value = false
  } catch (err) {
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqSession !== currentSessionEpoch ||
      reqId !== latestPostTestSummaryRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(POST_TEST_SUMMARY_KEY) ||
      !authStore.isAuthenticated ||
      !authStore.isAdmin
    ) {
      return
    }
    postTestSummaryError.value = true
    if (!hasLoadedPostTestSummaryOnce.value) {
      postTestSummary.value = null
    }
  } finally {
    if (reqSession === currentSessionEpoch && reqId === latestPostTestSummaryRequestId) {
      postTestSummaryLoading.value = false
      postTestSummaryRefreshing.value = false
    }
  }
}

const refreshAll = ({ force = false } = {}) => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return Promise.resolve()
  return Promise.allSettled([
    loadStats({ force }),
    loadApprovals({ force }),
    loadRecentActivity({ force }),
    loadPostTestSummary({ force }),
  ])
}

const manualRefresh = () => {
  return refreshAll({ force: true })
}

usePageRecovery(async () => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) return
  if (
    statsLoading.value ||
    approvalsLoading.value ||
    activityLoading.value ||
    postTestSummaryLoading.value
  ) {
    return
  }
  // Passing force: false checks freshness; entries with age < TTL produce 0 API calls!
  await refreshAll({ force: false })
})

onMounted(() => {
  if (authStore.isAuthenticated && authStore.isAdmin) {
    loadStats()
    loadApprovals()
    loadRecentActivity()
    loadPostTestSummary()
  } else {
    resetDashboardState()
  }
})

onUnmounted(() => {
  currentSessionEpoch++
  latestStatsRequestId++
  latestApprovalsRequestId++
  latestActivityRequestId++
  latestPostTestSummaryRequestId++
})

watch(
  [() => authStore.isAuthenticated, () => authStore.token, () => authStore.user?.user_id],
  ([isAuth, token, userId], [, prevToken, prevUserId]) => {
    if (!isAuth || !authStore.isAdmin) {
      currentSessionEpoch++
      latestStatsRequestId++
      latestApprovalsRequestId++
      latestActivityRequestId++
      latestPostTestSummaryRequestId++
      resetDashboardState()
      return
    }
    if (token !== prevToken || userId !== prevUserId) {
      currentSessionEpoch++
      latestStatsRequestId++
      latestApprovalsRequestId++
      latestActivityRequestId++
      latestPostTestSummaryRequestId++
      resetDashboardState()
      loadStats()
      loadApprovals()
      loadRecentActivity()
      loadPostTestSummary()
    }
  },
)

const displayPassRate = (summary, loading, error) => {
  if (loading) return '…'
  if (error && !summary) return 'Unavailable'
  const rate = summary?.pass_rate_percent
  if (rate === null || rate === undefined) return '—'
  return `${rate}%`
}

const displayStat = (val, loading, error) => {
  if (loading) return '…'
  if ((error && (val === null || val === undefined)) || val === null || val === undefined) {
    return 'Unavailable'
  }
  return typeof val === 'number' ? val.toLocaleString() : String(val)
}
</script>

<template>
  <div class="role-dashboard">
    <!-- Welcome Header -->
    <div class="welcome-banner">
      <div class="banner-header">
        <div class="banner-text">
          <h2 class="title">Welcome back, {{ adminGreetingName }}</h2>
        </div>
        <div class="dashboard-refresh-bar">
          <span v-if="lastUpdatedText" class="dashboard-updated-meta">
            {{ lastUpdatedText }}
          </span>
          <button
            type="button"
            class="btn-subtle btn-refresh-data"
            :disabled="isRefreshingAny"
            aria-label="Refresh dashboard data"
            @click="manualRefresh"
          >
            <AppIcon
              name="refresh"
              :size="14"
              :class="{ spinning: isRefreshingAny }"
              aria-hidden="true"
            />
            <span>Refresh data</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Section-Specific Error: Metrics -->
    <div v-if="statsError" class="error-banner stats-error-banner" role="alert">
      <span>System metrics could not be loaded. Metric counts are currently unavailable.</span>
      <button type="button" class="btn-retry" @click="loadStats">
        Retry
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <!-- Total Users -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Total users</span>
          <AppIcon name="users" :size="20" class="stat-icon" aria-hidden="true" />
        </div>
        <div class="stat-value highlight-purple">
          {{ displayStat(totalUsers, statsLoading, statsError) }}
        </div>
      </div>

      <!-- Sessions Received (24h) -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Sessions received (24h)</span>
          <AppIcon name="analytics" :size="20" class="stat-icon" aria-hidden="true" />
        </div>
        <div class="stat-value highlight-secondary">
          {{ displayStat(sessionsReceived, statsLoading, statsError) }}
        </div>
        <div class="stat-help">Offline sessions count when uploaded</div>
      </div>

      <!-- Pending Educator Approvals Card (Clickable Link to /admin/approvals) -->
      <div
        class="stat-card"
        :class="{ 'has-attention': pendingApprovals !== null && pendingApprovals > 0 }"
      >
        <div class="stat-header">
          <span class="stat-label">Pending educator approvals</span>
          <AppIcon
            name="clock"
            :size="20"
            class="stat-icon"
            :class="{ 'icon-amber': pendingApprovals !== null && pendingApprovals > 0 }"
            aria-hidden="true"
          />
        </div>
        <div
          class="stat-value"
          :class="{
            'highlight-amber': pendingApprovals !== null && pendingApprovals > 0,
            'highlight-neutral': pendingApprovals === null || pendingApprovals === 0,
          }"
        >
          {{ displayStat(pendingApprovals, approvalsLoading, approvalsError) }}
        </div>
        <div class="stat-card-actions">
          <button
            v-if="approvalsError"
            type="button"
            class="btn-retry-sm"
            aria-label="Retry loading pending educator approvals count"
            @click="loadApprovals"
          >
            Retry
          </button>
          <router-link
            to="/admin/approvals"
            class="stat-link"
            aria-label="Review pending educator approvals"
          >
            Review approvals
          </router-link>
        </div>
      </div>
    </div>

    <!-- Post-test Summary Card (Independent from other Overview cards) -->
    <section class="content-section post-test-summary-card" aria-label="Post-test summary">
      <div class="section-header">
        <div class="post-test-summary-title-wrap">
          <AppIcon name="clipboard-check" :size="18" class="stat-icon" aria-hidden="true" />
          <h4 class="section-title">Post-test summary</h4>
        </div>
        <router-link to="/admin/post-test-results" class="link-view-all">
          <span>View post-test results</span>
          <AppIcon name="arrow-right" :size="15" aria-hidden="true" />
        </router-link>
      </div>

      <div v-if="postTestSummaryError && !postTestSummary" class="error-banner" role="alert">
        <span>Post-test summary could not be loaded.</span>
        <button type="button" class="btn-retry" @click="loadPostTestSummary({ force: true })">
          Retry
        </button>
      </div>

      <div v-else class="post-test-metrics-grid">
        <div class="post-test-metric">
          <span class="stat-label">Eligible players</span>
          <strong class="post-test-metric-value highlight-neutral">
            {{ displayStat(postTestSummary?.eligible_players, postTestSummaryLoading, postTestSummaryError) }}
          </strong>
        </div>

        <div class="post-test-metric">
          <span class="stat-label">Submitted</span>
          <strong class="post-test-metric-value highlight-purple">
            {{ displayStat(postTestSummary?.players_attempted, postTestSummaryLoading, postTestSummaryError) }}
          </strong>
        </div>

        <div class="post-test-metric">
          <span class="stat-label">Passed</span>
          <strong class="post-test-metric-value highlight-secondary">
            {{ displayStat(postTestSummary?.players_passed, postTestSummaryLoading, postTestSummaryError) }}
          </strong>
        </div>

        <div class="post-test-metric">
          <span class="stat-label">Pass rate</span>
          <strong class="post-test-metric-value highlight-neutral">
            {{ displayPassRate(postTestSummary, postTestSummaryLoading, postTestSummaryError) }}
          </strong>
        </div>
      </div>
    </section>

    <!-- Recent Activity Section -->
    <div class="content-section">
      <div class="section-header">
        <h4 class="section-title">Recent activity</h4>
        <router-link to="/admin/logs" class="link-view-all">
          <span>View all audit logs</span>
          <AppIcon name="arrow-right" :size="15" />
        </router-link>
      </div>

      <!-- Loading State -->
      <div
        v-if="activityLoading"
        class="activity-loading"
        role="status"
        aria-live="polite"
      >
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading recent activity…</p>
      </div>

      <!-- Error State with Retry -->
      <div
        v-else-if="activityError"
        class="error-banner activity-error-banner"
        role="alert"
      >
        <span>Recent activity could not be loaded.</span>
        <button type="button" class="btn-retry" @click="loadRecentActivity">
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="recentLogs.length === 0" class="activity-empty-state">
        <p>No activity recorded yet.</p>
      </div>

      <!-- Populated Activity Preview Table -->
      <div v-else class="activity-table-wrapper">
        <div class="table-scroll">
          <table class="activity-table">
            <thead>
              <tr>
                <th scope="col" class="th-actor">Actor</th>
                <th scope="col" class="th-action">Action</th>
                <th scope="col" class="th-time">Timestamp (PHT)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in recentLogs" :key="log.log_id" class="activity-row">
                <!-- Actor Email -->
                <td class="td-actor">
                  <span class="actor-email" :title="log.user_email">
                    {{ log.user_email || 'Not recorded' }}
                  </span>
                </td>

                <!-- Action Badge -->
                <td class="td-action">
                  <span class="action-badge" :class="getActionBadgeClass(log.action_type)">
                    {{ getActionLabel(log.action_type) }}
                  </span>
                </td>

                <!-- Timestamp -->
                <td class="td-time">
                  <div class="time-container">
                    <template v-if="formatAuditLogTimestamp(log.logged_at).isNull">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-status text-dim">Not recorded</span>
                    </template>
                    <template v-else-if="formatAuditLogTimestamp(log.logged_at).isInvalid">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-status text-dim">Date unavailable</span>
                    </template>
                    <template v-else>
                      <span class="time-formatted" :title="log.logged_at">
                        {{ formatAuditLogTimestamp(log.logged_at).formatted }}
                      </span>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.welcome-banner {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  color: var(--color-text-main);
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 auto;
}

.dashboard-refresh-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.dashboard-updated-meta {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.btn-refresh-data {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.84rem;
  font-weight: 500;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.title {
  margin: 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

@media (max-width: 860px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.05));
}

.stat-card.has-attention {
  border-color: var(--color-warning-border);
  background-color: var(--color-warning-bg);
}

.stat-card.has-attention:hover {
  border-color: var(--color-warning);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.stat-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.stat-icon.icon-amber {
  color: var(--color-warning);
}

.stat-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.stat-link {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s ease;
}

.stat-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.stat-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
  line-height: 1.15;
  font-feature-settings: 'tnum';
}

.stat-value.highlight-purple {
  color: var(--color-primary);
}

.stat-value.highlight-secondary {
  color: var(--color-secondary);
}

.stat-value.highlight-amber {
  color: var(--color-warning);
}

.stat-value.highlight-neutral {
  color: var(--color-text-main);
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.3;
}

.stat-help {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  margin-top: 0.4rem;
  line-height: 1.35;
}

.btn-retry-sm {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry-sm:hover {
  border-color: var(--color-primary);
  background-color: var(--color-bg-subtle);
}

/* Content Sections */
.content-section {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem 1.75rem;
  box-shadow: var(--shadow-sm);
  min-width: 0;
  box-sizing: border-box;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.link-view-all {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s ease;
}

.link-view-all:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.link-view-all:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Error Banners */
.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  color: var(--color-danger);
  font-size: 0.9rem;
  gap: 1rem;
}

.stats-error-banner {
  margin-bottom: 0.25rem;
}

.activity-error-banner {
  margin-top: 0.5rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-retry:hover {
  background-color: var(--color-danger-bg);
}

/* Activity Loading & Empty States */
.activity-loading,
.activity-empty-state {
  padding: 2.25rem 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 0.75rem auto;
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

/* Activity Table */
.activity-table-wrapper {
  margin-top: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  max-width: 100%;
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.activity-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  padding: 0.8rem 1.15rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

td {
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.88rem;
  vertical-align: middle;
}

.activity-row:last-child td {
  border-bottom: none;
}

.activity-row:hover {
  background-color: var(--color-bg-subtle);
}

.th-actor {
  width: 40%;
  min-width: 200px;
}

.th-action {
  width: 25%;
  min-width: 160px;
}

.th-time {
  width: 35%;
  min-width: 180px;
}

.actor-email {
  font-weight: 600;
  color: var(--color-text-main);
  overflow-wrap: break-word;
  word-break: normal;
  display: block;
}

/* Action Badges */
.action-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.badge-success {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.badge-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.badge-primary {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.badge-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.badge-neutral {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

/* Time formatting container */
.time-container {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.time-formatted {
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
}

.time-status {
  font-size: 0.75rem;
  line-height: 1.2;
}

.text-dim {
  color: var(--color-text-dim);
}

.text-muted {
  color: var(--color-text-muted);
}

.post-test-summary-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.post-test-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.post-test-metric {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.85rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  min-width: 0;
}

.post-test-metric-value {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 860px) {
  .post-test-metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .content-section {
    padding: 1.25rem 1rem;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .banner-header {
    padding: 1rem 1.15rem;
    gap: 0.85rem;
  }

  .title {
    font-size: 1.25rem;
  }
}
</style>
