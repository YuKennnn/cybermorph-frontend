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
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="header-left">
        <h2>CyberMorph Portal</h2>
        <span v-if="authStore.userRole" :class="['role-badge', authStore.userRole]">
          {{ authStore.userRole }}
        </span>
      </div>
      <div class="header-actions">
        <router-link to="/leaderboard" class="nav-link">🏆 Leaderboard</router-link>
        <button class="logout-btn" @click="handleLogout">Log Out</button>
      </div>
    </header>

    <main class="dashboard-content">
      <component :is="currentRoleComponent" v-if="currentRoleComponent" />

      <div v-else class="fallback-card">
        <h3>Role Undetermined</h3>
        <p>No specific dashboard found for role: "{{ authStore.userRole || 'None' }}".</p>
        <p>Please log in again or contact system support.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

h2 {
  margin: 0;
  color: #111827;
}

.role-badge {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.role-badge.player {
  background-color: #dbeafe;
  color: #1e40af;
}

.role-badge.educator {
  background-color: #d1fae5;
  color: #065f46;
}

.role-badge.admin {
  background-color: #fef3c7;
  color: #92400e;
}

.nav-link {
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2563eb;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: #dbeafe;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background-color: #dc2626;
}

.fallback-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: #6b7280;
}
</style>
