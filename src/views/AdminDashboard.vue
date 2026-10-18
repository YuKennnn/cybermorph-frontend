<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchAdminStats, fetchAdminApprovals } from '../api/admin'

const router = useRouter()
const authStore = useAuthStore()

const totalUsers = ref(null)
const recentSessions = ref(null)
const pendingApprovals = ref(null)
const threatsDetected = ref(null)

const isLoading = ref(true)
const statsError = ref(false)
const actionNotice = ref('')

onMounted(async () => {
  isLoading.value = true
  statsError.value = false

  const [statsRes, approvalsRes] = await Promise.allSettled([
    fetchAdminStats(),
    fetchAdminApprovals({ status: 'pending', page_size: 1 }),
  ])

  if (statsRes.status === 'fulfilled' && statsRes.value) {
    totalUsers.value = typeof statsRes.value.total_users === 'number' ? statsRes.value.total_users : null
    recentSessions.value = typeof statsRes.value.sessions_last_24h === 'number' ? statsRes.value.sessions_last_24h : null
    threatsDetected.value = typeof statsRes.value.threats_detected === 'number' ? statsRes.value.threats_detected : null
  } else {
    statsError.value = true
  }

  if (approvalsRes.status === 'fulfilled' && approvalsRes.value) {
    pendingApprovals.value = typeof approvalsRes.value.total_count === 'number' ? approvalsRes.value.total_count : null
  }

  isLoading.value = false
})

const displayStat = (val) => {
  if (isLoading.value) return '…'
  if (val === null || val === undefined) return '—'
  return typeof val === 'number' ? val.toLocaleString() : String(val)
}

const handleAdminAction = (action) => {
  if (action === 'User Management') {
    router.push('/admin/users')
  } else if (action === 'Educator Approvals') {
    router.push('/admin/approvals')
  } else {
    actionNotice.value = `${action} interface is not yet implemented. Audit log integration is planned for a separate task.`
  }
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-text">
        <h3 class="title">System Administration</h3>
        <p class="subtitle">
          Signed in as Administrator: <strong>{{ authStore.user?.username || authStore.user?.email || 'Admin' }}</strong>
        </p>
      </div>
    </div>

    <div v-if="statsError" class="error-banner">
      System metrics could not be loaded. Metric counts are currently unavailable.
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value highlight-purple">{{ displayStat(totalUsers) }}</div>
        <div class="stat-label">Total Users</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-secondary">{{ displayStat(recentSessions) }}</div>
        <div class="stat-label">Recent Sessions (24h)</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-amber">{{ displayStat(pendingApprovals) }}</div>
        <div class="stat-label">Pending Educator Approvals</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-danger">{{ displayStat(threatsDetected) }}</div>
        <div class="stat-label">Threats Detected</div>
      </div>
    </div>

    <div v-if="actionNotice" class="notice-box">
      {{ actionNotice }}
    </div>

    <div class="content-section">
      <h4>Administrative Actions</h4>
      <div class="actions-grid">
        <button class="action-tile" @click="handleAdminAction('User Management')">
          <span class="tile-title">User Management</span>
          <span class="tile-desc">Inspect registered accounts, roles, and user identifiers</span>
        </button>

        <button class="action-tile highlight-tile" @click="handleAdminAction('Educator Approvals')">
          <span class="tile-title">
            Educator Approvals
            <template v-if="pendingApprovals !== null && pendingApprovals > 0">
              ({{ pendingApprovals }})
            </template>
          </span>
          <span class="tile-desc">Review and authorize institutional instructor registrations</span>
        </button>

        <button class="action-tile" @click="handleAdminAction('System Logs')">
          <span class="tile-title">Audit Logs</span>
          <span class="tile-desc">Inspect administrative activity and system event logs (Planned)</span>
        </button>
      </div>
    </div>

    <div class="content-section">
      <h4>Recent Activity Logs</h4>
      <div class="logs-placeholder-card">
        <p class="placeholder-text">
          Activity logs are not yet integrated. Full administrative audit log streams (GET /admin/logs) are part of the documented contract, but frontend UI integration is currently deferred.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.welcome-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.subtitle strong {
  color: var(--color-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
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

.stat-value.highlight-danger {
  color: var(--color-danger);
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.content-section {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-card);
}

.content-section h4 {
  margin: 0 0 1.25rem 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
  letter-spacing: 0.02em;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.action-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.35rem;
  background-color: var(--color-bg-subtle);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.action-tile:hover {
  background-color: var(--color-bg-muted);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}

.highlight-tile {
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
}

.highlight-tile:hover {
  border-color: var(--color-warning);
  background: var(--color-warning-bg);
}


.tile-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin-bottom: 0.35rem;
}

.tile-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.logs-placeholder-card {
  padding: 2rem 1.5rem;
  background-color: var(--color-bg-subtle);
  border-radius: 8px;
  border: 1px dashed var(--color-border);
  text-align: center;
}

.placeholder-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.notice-box {
  padding: 0.85rem 1.25rem;
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .content-section {
    padding: 1.25rem 1rem;
  }

  .actions-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
