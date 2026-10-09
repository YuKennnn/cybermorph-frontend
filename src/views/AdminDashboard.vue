<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { fetchAdminStats } from '../api/admin'

const authStore = useAuthStore()

const adminStats = ref({
  total_users: 156,
  active_sessions: 23,
  pending_approvals: 4,
  threats_detected: 412,
  server_uptime: '99.9%',
  recent_logs: [
    { id: 1, action: 'User Registration', user: 'educator_smith@school.edu', status: 'Pending' },
    { id: 2, action: 'Threat Simulation Sync', user: 'AgentZero', status: 'Success' },
    { id: 3, action: 'Classroom Code Generated', user: 'prof_jones@univ.edu', status: 'Success' },
  ],
})

const isLoading = ref(true)
const actionNotice = ref('')

onMounted(async () => {
  try {
    const data = await fetchAdminStats()
    if (data) {
      adminStats.value = {
        ...adminStats.value,
        ...data,
        active_sessions: data.sessions_last_24h ?? adminStats.value.active_sessions,
      }
    }
  } catch {
    // Keep mock defaults on network error
  } finally {
    isLoading.value = false
  }
})

const handleAdminAction = (panelName) => {
  actionNotice.value = `[COMMAND ACKNOWLEDGED] ${panelName} module interface ready for connection.`
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-text">
        <h3 class="title">System Administration & Control Center</h3>
        <p class="subtitle">
          Signed in as Administrator: <strong>{{ authStore.user?.username || authStore.user?.email || 'Admin' }}</strong> (Level 0 Authority)
        </p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value highlight-purple">{{ adminStats.total_users }}</div>
        <div class="stat-label">Total Agents</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-secondary">{{ adminStats.active_sessions }}</div>
        <div class="stat-label">Active Uplinks</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-amber">{{ adminStats.pending_approvals }}</div>
        <div class="stat-label">Pending Verifications</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-danger">{{ adminStats.threats_detected }}</div>
        <div class="stat-label">Threats Neutralized</div>
      </div>
    </div>

    <div v-if="actionNotice" class="notice-box">
      [ NOTICE ] {{ actionNotice }}
    </div>

    <div class="content-section">
      <h4>System Operations & Administration</h4>
      <div class="actions-grid">
        <button class="action-tile" @click="handleAdminAction('Agent Management')">
          <span class="tile-tag">OPS 01</span>
          <span class="tile-title">Agent Management</span>
          <span class="tile-desc">Manage identities, RBAC scopes & security credentials</span>
        </button>

        <button class="action-tile highlight-tile" @click="handleAdminAction('Educator Approvals')">
          <span class="tile-tag">QUEUE 02</span>
          <span class="tile-title">Verification Queue ({{ adminStats.pending_approvals }})</span>
          <span class="tile-desc">Review and authorize institutional instructor requests</span>
        </button>

        <button class="action-tile" @click="handleAdminAction('System Logs')">
          <span class="tile-tag">AUDIT 03</span>
          <span class="tile-title">Audit Log Stream</span>
          <span class="tile-desc">Inspect real-time security events & sync transactions</span>
        </button>
      </div>
    </div>

    <div class="content-section">
      <h4>Real-time Telemetry & Event Stream</h4>
      <ul class="log-list">
        <li v-for="log in adminStats.recent_logs" :key="log.id" class="log-item">
          <div class="log-meta">
            <span class="log-action">{{ log.action }}</span>
            <span class="log-user">{{ log.user }}</span>
          </div>
          <span :class="['status-tag', log.status.toLowerCase()]">{{ log.status }}</span>
        </li>
      </ul>
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
  box-shadow: var(--shadow-purple);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple-hover);
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
  box-shadow: var(--shadow-purple);
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
  box-shadow: var(--shadow-purple);
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

.tile-tag {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.65rem;
  letter-spacing: 0.05em;
}

.highlight-tile .tile-tag {
  color: var(--color-warning);
  background-color: var(--color-bg-subtle);
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

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.15rem;
  background-color: var(--color-bg-subtle);
  border-radius: 8px;
  border-left: 3.5px solid var(--color-secondary);
  font-size: 0.9rem;
}

.log-meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.log-action {
  font-weight: 600;
  color: var(--color-text-main);
}

.log-user {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
}

.status-tag {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.status-tag.success {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-tag.pending {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
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
</style>
