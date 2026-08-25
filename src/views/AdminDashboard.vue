<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../api/client'

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
    const response = await apiClient.get('/admin/stats')
    if (response.data) {
      adminStats.value = { ...adminStats.value, ...response.data }
    }
  } catch (error) {
    console.warn('Could not fetch admin stats, using mock defaults:', error)
  } finally {
    isLoading.value = false
  }
})

const handleAdminAction = (panelName) => {
  actionNotice.value = `${panelName} panel will be connected in future administrative milestones.`
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <h3>System Administration & Control Center</h3>
      <p class="subtitle">
        Signed in as Administrator: {{ authStore.user?.username || authStore.user?.email || 'Admin' }}
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ adminStats.total_users }}</div>
        <div class="stat-label">Total Users</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-blue">{{ adminStats.active_sessions }}</div>
        <div class="stat-label">Active Sessions</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-amber">{{ adminStats.pending_approvals }}</div>
        <div class="stat-label">Pending Approvals</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-red">{{ adminStats.threats_detected }}</div>
        <div class="stat-label">Threats Detected</div>
      </div>
    </div>

    <div v-if="actionNotice" class="notice-box">
      {{ actionNotice }}
    </div>

    <div class="section-container">
      <h4>Administrative Quick Actions</h4>
      <div class="actions-grid">
        <button class="action-btn" @click="handleAdminAction('User Management')">
          <span class="btn-title">User Management</span>
          <span class="btn-desc">Manage accounts, permissions & roles</span>
        </button>

        <button class="action-btn" @click="handleAdminAction('Educator Approvals')">
          <span class="btn-title">Approval Queue ({{ adminStats.pending_approvals }})</span>
          <span class="btn-desc">Review pending educator registrations</span>
        </button>

        <button class="action-btn" @click="handleAdminAction('System Logs')">
          <span class="btn-title">Activity & Audit Logs</span>
          <span class="btn-desc">View platform-wide security audit trails</span>
        </button>
      </div>
    </div>

    <div class="section-container">
      <h4>Recent System Activity</h4>
      <ul class="log-list">
        <li v-for="log in adminStats.recent_logs" :key="log.id" class="log-item">
          <div>
            <strong>{{ log.action }}</strong> — <span class="log-user">{{ log.user }}</span>
          </div>
          <span :class="['status-badge', log.status.toLowerCase()]">{{ log.status }}</span>
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

.welcome-banner h3 {
  margin: 0 0 0.25rem 0;
  color: #111827;
  font-size: 1.35rem;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.stat-card {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  text-align: center;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.stat-value.highlight-blue {
  color: #2563eb;
}

.stat-value.highlight-amber {
  color: #d97706;
}

.stat-value.highlight-red {
  color: #dc2626;
}

.stat-label {
  font-size: 0.85rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
}

.section-container h4 {
  margin: 0 0 1rem 0;
  color: #111827;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background-color 0.2s;
}

.action-btn:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.btn-title {
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.btn-desc {
  font-size: 0.8rem;
  color: #6b7280;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9rem;
}

.log-item:last-child {
  border-bottom: none;
}

.log-user {
  color: #4b5563;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.status-badge.success {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.pending {
  background-color: #fef3c7;
  color: #92400e;
}

.notice-box {
  padding: 0.75rem 1rem;
  background-color: #eff6ff;
  border: 1px solid #3b82f6;
  color: #1e40af;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
