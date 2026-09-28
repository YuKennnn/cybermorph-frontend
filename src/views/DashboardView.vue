<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import PlayerDashboard from './PlayerDashboard.vue'
import EducatorDashboard from './EducatorDashboard.vue'
import AdminDashboard from './AdminDashboard.vue'

const router = useRouter()
const authStore = useAuthStore()

const currentRoleComponent = computed(() => {
  switch (authStore.userRole) {
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
