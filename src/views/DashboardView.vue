<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import AppIcon from '../components/common/AppIcon.vue'
import PlayerDashboard from './PlayerDashboard.vue'
import EducatorDashboard from './EducatorDashboard.vue'
import AdminDashboard from './AdminDashboard.vue'

const router = useRouter()
const authStore = useAuthStore()

const currentRoleComponent = computed(() => {
  const normalizedRole = authStore.userRole?.toLowerCase()
  switch (normalizedRole) {
    case 'player':
      return PlayerDashboard
    case 'educator':
      return EducatorDashboard
    case 'admin':
      return AdminDashboard
    default:
      return null
  }
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="dashboard-wrapper">
    <div
      v-if="authStore.dashboardNotice"
      class="status-banner"
      role="status"
      aria-live="polite"
    >
      <div class="status-banner-text">
        <AppIcon name="info" :size="18" />
        <span>{{ authStore.dashboardNotice }}</span>
      </div>
      <button
        type="button"
        class="banner-dismiss"
        aria-label="Dismiss notification"
        @click="authStore.clearDashboardNotice()"
      >
        <AppIcon name="x" :size="16" />
      </button>
    </div>

    <component :is="currentRoleComponent" v-if="currentRoleComponent" />

    <div v-else class="fallback-card">
      <h3>Role Undetermined</h3>
      <p>No specialized interface found for identity role: "{{ authStore.userRole || 'None' }}".</p>
      <button class="btn-primary" @click="handleLogout">Re-authenticate</button>
    </div>
  </div>
</template>

<style scoped>
.dashboard-wrapper {
  width: 100%;
}

.status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--color-violet-border);
  background-color: var(--color-violet-subtle);
  color: var(--color-text-main);
}

.status-banner-text {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-primary);
}

.banner-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
}

.banner-dismiss:hover {
  background-color: var(--color-card);
  border-color: var(--color-violet-border);
}

.fallback-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-purple);
}

.fallback-card h3 {
  color: var(--color-primary);
  margin-top: 0;
}

.btn-primary {
  padding: 0.65rem 1.5rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  cursor: pointer;
  margin-top: 1rem;
}
</style>
