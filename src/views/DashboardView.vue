<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h2>CyberMorph Dashboard</h2>
      <button class="logout-btn" @click="handleLogout">Log Out</button>
    </header>

    <main class="dashboard-content">
      <div class="card">
        <h3>Welcome, {{ authStore.user?.username || authStore.user?.email || 'User' }}!</h3>
        <p><strong>Role:</strong> {{ authStore.userRole || 'Unknown' }}</p>
        <p><strong>Email:</strong> {{ authStore.user?.email || 'N/A' }}</p>
        <p class="placeholder-notice">
          This is a placeholder dashboard. Role-specific dashboards will be connected in future
          milestones.
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-container {
  max-width: 800px;
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

h2 {
  margin: 0;
  color: #111827;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.logout-btn:hover {
  background-color: #dc2626;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
}

.placeholder-notice {
  margin-top: 1.5rem;
  padding: 0.75rem;
  background-color: #f3f4f6;
  border-left: 4px solid #3b82f6;
  color: #4b5563;
  font-size: 0.9rem;
}
</style>
