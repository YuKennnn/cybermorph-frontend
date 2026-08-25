<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../api/client'

const authStore = useAuthStore()

const stats = ref({
  games_played: 14,
  best_score: 9200,
  threat_index_progress: '5/8 unlocked',
  current_map: 'Industrial Control Station',
})

const isLoading = ref(true)
const gameLaunchMessage = ref('')

onMounted(async () => {
  try {
    const response = await apiClient.get('/players/me')
    if (response.data) {
      stats.value = { ...stats.value, ...response.data }
    }
  } catch (error) {
    console.warn('Could not fetch player profile, using local state defaults:', error)
  } finally {
    isLoading.value = false
  }
})

const handlePlayGame = () => {
  gameLaunchMessage.value = 'Connecting to Godot game client... (Simulation mode)'
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <h3>Welcome back, {{ authStore.user?.username || 'Player' }}!</h3>
      <p class="subtitle">Your cybersecurity simulation progress and threat metrics.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.games_played }}</div>
        <div class="stat-label">Games Played</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight">{{ stats.best_score }}</div>
        <div class="stat-label">High Score</div>
      </div>

      <div class="stat-card">
        <div class="stat-value">{{ stats.threat_index_progress }}</div>
        <div class="stat-label">Threat Index</div>
      </div>
    </div>

    <div class="action-card">
      <div class="action-info">
        <h4>Simulation Status: Ready</h4>
        <p>Launch the Godot desktop simulation to continue your training.</p>
      </div>
      <button class="primary-btn" @click="handlePlayGame">Play Game</button>
    </div>

    <div v-if="gameLaunchMessage" class="notice-box">
      {{ gameLaunchMessage }}
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
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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

.stat-value.highlight {
  color: #2563eb;
}

.stat-label {
  font-size: 0.85rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.action-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 1.25rem;
}

.action-info h4 {
  margin: 0 0 0.25rem 0;
  color: #1e40af;
}

.action-info p {
  margin: 0;
  color: #3b82f6;
  font-size: 0.9rem;
}

.primary-btn {
  padding: 0.6rem 1.25rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.primary-btn:hover {
  background-color: #1d4ed8;
}

.notice-box {
  padding: 0.75rem 1rem;
  background-color: #ecfdf5;
  border: 1px solid #10b981;
  color: #065f46;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
