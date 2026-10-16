<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchPlayerProfile, fetchThreatIndex } from '../api/player'
import { fetchSessionHistory } from '../api/session'

const router = useRouter()
const authStore = useAuthStore()

const mapNames = ['Home', 'Office', 'Internet Cafe', 'Public Park']

const stats = ref({
  games_played: null, // null = unknown/loading; number = confirmed count
  best_score: null,
  threat_index_progress: null,
  current_map: null,
})

const isLoading = ref(true)
const profileFailed = ref(false)
const threatFailed = ref(false)
const sessionFailed = ref(false)

const isRetryingSessions = ref(false)
const isRetryingThreats = ref(false)
const isRetryingProfile = ref(false)

const generalError = ref('')
const gameLaunchMessage = ref('')

let dashboardRequestId = 0
let sessionRequestId = 0
let threatRequestId = 0
let profileRequestId = 0

const loadDashboardData = async () => {
  const reqId = ++dashboardRequestId
  isLoading.value = true
  generalError.value = ''
  profileFailed.value = false
  threatFailed.value = false
  sessionFailed.value = false

  try {
    const [profileRes, threatRes, sessionRes] = await Promise.allSettled([
      fetchPlayerProfile(),
      fetchThreatIndex(),
      fetchSessionHistory({ page_size: 20 }),
    ])

    if (reqId !== dashboardRequestId) return // Discard obsolete response

    // Profile handling
    if (profileRes.status === 'fulfilled' && profileRes.value) {
      const p = profileRes.value
      const progressIdx = Math.max(0, (p.map_progress || 1) - 1)
      stats.value.current_map = mapNames[Math.min(progressIdx, mapNames.length - 1)]
    } else {
      profileFailed.value = true
    }

    // Threat Index handling
    if (threatRes.status === 'fulfilled' && Array.isArray(threatRes.value)) {
      const unlockedCount = threatRes.value.filter((t) => t.is_unlocked).length
      stats.value.threat_index_progress = `${unlockedCount}/${threatRes.value.length || 8} unlocked`
    } else {
      threatFailed.value = true
    }

    // Session History handling
    if (sessionRes.status === 'fulfilled' && sessionRes.value) {
      const s = sessionRes.value
      stats.value.games_played = s.total_count ?? s.items?.length ?? 0
      if (s.items && s.items.length > 0) {
        const scores = s.items.map((item) => (item.credits_earned || 0) - (item.credits_lost || 0))
        stats.value.best_score = Math.max(0, ...scores)
      } else {
        stats.value.best_score = 0
      }
    } else {
      sessionFailed.value = true
    }

    // If all requests failed, surface a general error
    if (profileFailed.value && threatFailed.value && sessionFailed.value) {
      generalError.value = 'Failed to load player progress. Please verify your connection or try again.'
    }
  } catch {
    if (reqId === dashboardRequestId) {
      generalError.value = 'An unexpected error occurred while loading dashboard data.'
    }
  } finally {
    if (reqId === dashboardRequestId) {
      isLoading.value = false
    }
  }
}

const retrySessions = async () => {
  if (isRetryingSessions.value) return // Prevent duplicate submissions
  isRetryingSessions.value = true
  const reqId = ++sessionRequestId

  try {
    const s = await fetchSessionHistory({ page_size: 20 })
    if (reqId !== sessionRequestId) return // Discard obsolete response

    stats.value.games_played = s.total_count ?? s.items?.length ?? 0
    if (s.items && s.items.length > 0) {
      const scores = s.items.map((item) => (item.credits_earned || 0) - (item.credits_lost || 0))
      stats.value.best_score = Math.max(0, ...scores)
    } else {
      stats.value.best_score = 0
    }
    sessionFailed.value = false
    generalError.value = ''
  } catch {
    if (reqId !== sessionRequestId) return
    sessionFailed.value = true
  } finally {
    if (reqId === sessionRequestId) {
      isRetryingSessions.value = false
    }
  }
}

const retryThreats = async () => {
  if (isRetryingThreats.value) return // Prevent duplicate submissions
  isRetryingThreats.value = true
  const reqId = ++threatRequestId

  try {
    const data = await fetchThreatIndex()
    if (reqId !== threatRequestId) return // Discard obsolete response

    if (Array.isArray(data)) {
      const unlockedCount = data.filter((t) => t.is_unlocked).length
      stats.value.threat_index_progress = `${unlockedCount}/${data.length || 8} unlocked`
    }
    threatFailed.value = false
    generalError.value = ''
  } catch {
    if (reqId !== threatRequestId) return
    threatFailed.value = true
  } finally {
    if (reqId === threatRequestId) {
      isRetryingThreats.value = false
    }
  }
}

const retryProfile = async () => {
  if (isRetryingProfile.value) return // Prevent duplicate submissions
  isRetryingProfile.value = true
  const reqId = ++profileRequestId

  try {
    const p = await fetchPlayerProfile()
    if (reqId !== profileRequestId) return // Discard obsolete response

    if (p) {
      const progressIdx = Math.max(0, (p.map_progress || 1) - 1)
      stats.value.current_map = mapNames[Math.min(progressIdx, mapNames.length - 1)]
    }
    profileFailed.value = false
    generalError.value = ''
  } catch {
    if (reqId !== profileRequestId) return
    profileFailed.value = true
  } finally {
    if (reqId === profileRequestId) {
      isRetryingProfile.value = false
    }
  }
}

const handlePlayGame = () => {
  gameLaunchMessage.value = 'Open the CyberMorph game application on your device to play.'
}

const handleJoinClassroom = () => {
  router.push('/classroom/join')
}

onMounted(() => {
  loadDashboardData()
})

onUnmounted(() => {
  dashboardRequestId++
  sessionRequestId++
  threatRequestId++
  profileRequestId++
})
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-text">
        <h2 class="title">Welcome back, {{ authStore.user?.username || 'Player' }}</h2>
        <p class="subtitle">Your gameplay progress and threat training status</p>
      </div>
      <button class="btn-outline" @click="handleJoinClassroom">+ Join classroom</button>
    </div>

    <!-- Main Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading your progress...</p>
    </div>

    <!-- Complete Failure State -->
    <div v-else-if="generalError" class="error-banner" role="alert">
      <span>{{ generalError }}</span>
      <button type="button" class="btn-retry" :disabled="isLoading" @click="loadDashboardData">
        Try again
      </button>
    </div>

    <!-- Dashboard Content with Partial Failure Resilience -->
    <div v-else class="dashboard-content">
      <div class="stats-grid">
        <!-- Games Played Card -->
        <div class="stat-card">
          <template v-if="sessionFailed">
            <div class="stat-unavailable">{{ isRetryingSessions ? 'Retrying...' : 'Unavailable' }}</div>
            <div class="stat-label">Games played</div>
            <button
              type="button"
              class="btn-stat-retry"
              :disabled="isRetryingSessions"
              @click="retrySessions"
            >
              {{ isRetryingSessions ? 'Retrying...' : 'Retry' }}
            </button>
          </template>
          <template v-else>
            <div class="stat-value">{{ stats.games_played !== null ? stats.games_played : '—' }}</div>
            <div class="stat-label">Games played</div>
          </template>
        </div>

        <!-- Best Score Card -->
        <div class="stat-card highlight-card">
          <template v-if="sessionFailed">
            <div class="stat-unavailable">{{ isRetryingSessions ? 'Retrying...' : 'Unavailable' }}</div>
            <div class="stat-label">Best score (latest 20 sessions)</div>
            <button
              type="button"
              class="btn-stat-retry"
              :disabled="isRetryingSessions"
              @click="retrySessions"
            >
              {{ isRetryingSessions ? 'Retrying...' : 'Retry' }}
            </button>
          </template>
          <template v-else>
            <div class="stat-value highlight-purple">
              {{ stats.best_score !== null ? stats.best_score.toLocaleString() : '—' }}
            </div>
            <div class="stat-label">Best score in latest 20 sessions</div>
          </template>
        </div>

        <!-- Threat Index Card -->
        <div class="stat-card">
          <template v-if="threatFailed">
            <div class="stat-unavailable">{{ isRetryingThreats ? 'Retrying...' : 'Unavailable' }}</div>
            <div class="stat-label">Threat index progress</div>
            <button
              type="button"
              class="btn-stat-retry"
              :disabled="isRetryingThreats"
              @click="retryThreats"
            >
              {{ isRetryingThreats ? 'Retrying...' : 'Retry' }}
            </button>
          </template>
          <template v-else>
            <div class="stat-value highlight-secondary">
              {{ stats.threat_index_progress || '—' }}
            </div>
            <div class="stat-label">Threat index progress</div>
          </template>
        </div>
      </div>

      <div class="action-card">
        <div class="action-info">
          <h4>Play CyberMorph</h4>
          <p v-if="profileFailed">
            Current map: <span class="text-muted">{{ isRetryingProfile ? 'Retrying...' : 'Unavailable' }}</span>
            <button
              type="button"
              class="btn-inline-retry"
              :disabled="isRetryingProfile"
              @click="retryProfile"
            >
              {{ isRetryingProfile ? 'Retrying...' : 'Retry' }}
            </button>
          </p>
          <p v-else>
            Current map: <strong>{{ stats.current_map || '—' }}</strong>. Open the CyberMorph game application on your device to play.
          </p>
        </div>
        <button class="btn-play" @click="handlePlayGame">How to play</button>
      </div>

      <div v-if="gameLaunchMessage" class="notice-box">
        {{ gameLaunchMessage }}
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
  background: linear-gradient(180deg, var(--color-card) 0%, var(--color-purple-light) 100%);
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
  background: linear-gradient(135deg, var(--color-purple-light) 0%, var(--color-violet-subtle) 100%);
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
  color: var(--color-card);
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

.loading-state {
  text-align: center;
  padding: 3.5rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem auto;
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

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover:not(:disabled) {
  background-color: var(--color-danger-bg);
}

.btn-retry:disabled,
.btn-stat-retry:disabled,
.btn-inline-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stat-unavailable {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-dim);
  margin-bottom: 0.35rem;
}

.btn-stat-retry {
  margin-top: 0.5rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-stat-retry:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.btn-inline-retry {
  margin-left: 0.5rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  vertical-align: middle;
}

.btn-inline-retry:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.text-muted {
  color: var(--color-text-muted);
}
</style>
