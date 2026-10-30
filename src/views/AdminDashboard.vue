<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { fetchAdminStats, fetchAdminApprovals, fetchAdminLogs } from '../api/admin'
import { formatAuditLogTimestamp } from '../utils/datetime'
import { getActionLabel, getActionBadgeClass } from '../utils/auditLogs'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()

// Metrics (System stats)
const totalUsers = ref(null)
const sessionsReceived = ref(null)
const threatsDetected = ref(null)
const statsLoading = ref(true)
const statsError = ref(false)

// Pending educator approvals
const pendingApprovals = ref(null)
const approvalsLoading = ref(true)
const approvalsError = ref(false)

// Recent activity (Preview up to 5 items)
const recentLogs = ref([])
const activityLoading = ref(true)
const activityError = ref(false)

const loadStats = async () => {
  statsLoading.value = true
  statsError.value = false
  try {
    const data = await fetchAdminStats()
    totalUsers.value = typeof data?.total_users === 'number' ? data.total_users : null
    sessionsReceived.value = typeof data?.sessions_last_24h === 'number' ? data.sessions_last_24h : null
    threatsDetected.value = typeof data?.threats_detected === 'number' ? data.threats_detected : null
  } catch {
    statsError.value = true
    totalUsers.value = null
    sessionsReceived.value = null
    threatsDetected.value = null
  } finally {
    statsLoading.value = false
  }
}

const loadApprovals = async () => {
  approvalsLoading.value = true
  approvalsError.value = false
  try {
    const data = await fetchAdminApprovals({ status: 'pending', page_size: 1 })
    pendingApprovals.value = typeof data?.total_count === 'number' ? data.total_count : null
  } catch {
    approvalsError.value = true
    pendingApprovals.value = null
  } finally {
    approvalsLoading.value = false
  }
}

const loadRecentActivity = async () => {
  activityLoading.value = true
  activityError.value = false
  try {
    const data = await fetchAdminLogs({ page: 1, page_size: 5 })
    recentLogs.value = Array.isArray(data?.items) ? data.items : []
  } catch {
    activityError.value = true
    recentLogs.value = []
  } finally {
    activityLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadApprovals()
  loadRecentActivity()
})

const displayStat = (val, loading, error) => {
  if (loading) return '…'
  if (error || val === null || val === undefined) return 'Unavailable'
  return typeof val === 'number' ? val.toLocaleString() : String(val)
}
</script>

<template>
  <div class="role-dashboard">
    <!-- Welcome Header -->
    <div class="welcome-banner">
      <div class="banner-text">
        <h3 class="title">System administration</h3>
        <p class="subtitle">
          Signed in as administrator: <strong>{{ authStore.user?.username || authStore.user?.email || 'Admin' }}</strong>
        </p>
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
        <div class="stat-value highlight-purple">
          {{ displayStat(totalUsers, statsLoading, statsError) }}
        </div>
        <div class="stat-label">Total users</div>
      </div>

      <!-- Sessions Received (24h) -->
      <div class="stat-card">
        <div class="stat-value highlight-secondary">
          {{ displayStat(sessionsReceived, statsLoading, statsError) }}
        </div>
        <div class="stat-label">Sessions received (24h)</div>
        <div class="stat-help">Offline sessions count when uploaded</div>
      </div>

      <!-- Pending Educator Approvals Card (Clickable Link to /admin/approvals) -->
      <div
        class="stat-card"
        :class="{ 'has-attention': pendingApprovals !== null && pendingApprovals > 0 }"
      >
        <div
          class="stat-value"
          :class="{
            'highlight-amber': pendingApprovals !== null && pendingApprovals > 0,
            'highlight-neutral': pendingApprovals === null || pendingApprovals === 0,
          }"
        >
          {{ displayStat(pendingApprovals, approvalsLoading, approvalsError) }}
        </div>
        <div class="stat-label">Pending educator approvals</div>
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

      <!-- Threats Detected -->
      <div class="stat-card">
        <div class="stat-value highlight-danger">
          {{ displayStat(threatsDetected, statsLoading, statsError) }}
        </div>
        <div class="stat-label">Threats detected</div>
      </div>
    </div>

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
                <th scope="col" class="th-time">Timestamp</th>
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
                    <template v-else-if="formatAuditLogTimestamp(log.logged_at).isTimezoneFree">
                      <span class="time-formatted" :title="log.logged_at">
                        {{ formatAuditLogTimestamp(log.logged_at).formatted }}
                      </span>
                      <span class="time-status text-muted">Timezone unspecified</span>
                    </template>
                    <template v-else>
                      <span class="time-formatted" :title="log.logged_at">
                        {{ formatAuditLogTimestamp(log.logged_at).formatted }}
                      </span>
                      <span class="time-status text-muted">
                        Local ({{ formatAuditLogTimestamp(log.logged_at).statusText }})
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
  justify-content: space-between;
  align-items: center;
}

.title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  line-height: 1.45;
}

.subtitle strong {
  color: var(--color-primary);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem 1.25rem;
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  min-width: 0;
  box-sizing: border-box;
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

.stat-card-actions {
  display: flex;
  align-items: center;
  justify-content: center;
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

.stat-value.highlight-danger {
  color: var(--color-danger);
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
</style>
