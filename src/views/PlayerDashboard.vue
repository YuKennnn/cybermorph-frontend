<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../api/client'

const router = useRouter()
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

const handleJoinClassroom = () => {
  router.push('/classroom/join')
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-text">
        <h3 class="title">Welcome back, {{ authStore.user?.username || 'Player' }}!</h3>
        <p class="subtitle">Simulation threat telemetry and progression status</p>
      </div>
      <button class="btn-outline" @click="handleJoinClassroom">+ Join Classroom</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.games_played }}</div>
        <div class="stat-label">Simulations Completed</div>
      </div>

      <div class="stat-card highlight-card">
        <div class="stat-value highlight-purple">{{ stats.best_score.toLocaleString() }}</div>
        <div class="stat-label">Best Threat Score</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-secondary">{{ stats.threat_index_progress }}</div>
        <div class="stat-label">Threat Index Progress</div>
      </div>
    </div>

    <div class="action-card">
      <div class="action-info">
        <h4>SIMULATION STATUS: READY</h4>
        <p>Active Sector: <strong>{{ stats.current_map }}</strong>. Launch Godot client to continue.</p>
      </div>
      <button class="btn-play" @click="handlePlayGame">▶ Launch Simulation</button>
    </div>

    <div v-if="gameLaunchMessage" class="notice-box">
      ⚡ {{ gameLaunchMessage }}
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
  flex-wrap: wrap;
  gap: 1rem;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.highlight-card {
  border-color: var(--color-secondary);
  background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin-bottom: 0.35rem;
}

.stat-value.highlight-purple {
  color: var(--color-primary);
}

.stat-value.highlight-secondary {
  color: var(--color-secondary);
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.action-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-purple);
  flex-wrap: wrap;
  gap: 1rem;
}

.action-info h4 {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 1.15rem;
  letter-spacing: 0.04em;
}

.action-info p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.action-info strong {
  color: var(--color-text-main);
}

.btn-play {
  padding: 0.75rem 1.6rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-play:hover {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.btn-outline {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-outline:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.notice-box {
  padding: 0.85rem 1.25rem;
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 500;
}
</style>
