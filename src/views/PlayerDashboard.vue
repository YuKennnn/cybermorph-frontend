<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { useThreatIndexStore } from '../stores/threatIndexStore'
import { usePlayerClassroomStore } from '../stores/playerClassroomStore'
import { fetchPlayerProfile } from '../api/player'
import { fetchSessionHistory } from '../api/session'
import {
  CANONICAL_SESSION_MAPS,
  resolveCurrentMapName,
  normalizeSessionHistoryResponse,
  filterSessionsByMap,
  buildChartSeries,
} from '../utils/playerSessions'

const router = useRouter()
const authStore = useAuthStore()
const threatIndexStore = useThreatIndexStore()
const playerClassroomStore = usePlayerClassroomStore()

const stats = ref({
  games_played: null, // null = unknown/unavailable; number = confirmed count
  best_score: null,
  current_map: null,
})

const sessionItems = ref([])
const hasNoSessions = ref(false)
const bestScoreUnavailable = ref(false)
const selectedMapFilter = ref('All')

const isLoading = ref(true)
const profileFailed = ref(false)
const sessionFailed = ref(false)

const isRetryingSessions = ref(false)
const isRetryingThreats = ref(false)
const isRetryingProfile = ref(false)

const generalError = ref('')

const threatFailed = computed(() => threatIndexStore.isUnavailable)

const filteredSessions = computed(() =>
  filterSessionsByMap(sessionItems.value, selectedMapFilter.value),
)

const chartData = computed(() => buildChartSeries(filteredSessions.value))

const getActiveAccountScope = () => {
  if (!authStore.token) return null
  const id =
    authStore.user?.user_id ||
    authStore.user?.profile_id ||
    authStore.user?.email ||
    authStore.user?.username ||
    'authenticated'
  return `${authStore.token}::${id}`
}

const resetLocalStats = () => {
  stats.value = {
    games_played: null,
    best_score: null,
    current_map: null,
  }
  sessionItems.value = []
  hasNoSessions.value = false
  bestScoreUnavailable.value = false
  selectedMapFilter.value = 'All'
  profileFailed.value = false
  sessionFailed.value = false
  generalError.value = ''
}

const applySessionHistoryPayload = (rawPayload, expectedProfileId) => {
  const normalized = normalizeSessionHistoryResponse(rawPayload, expectedProfileId)
  if (!normalized.valid) {
    sessionItems.value = []
    hasNoSessions.value = false
    bestScoreUnavailable.value = true
    stats.value.games_played = null
    stats.value.best_score = null
    sessionFailed.value = true
    return false
  }

  sessionItems.value = normalized.items
  hasNoSessions.value = normalized.hasNoSessions
  bestScoreUnavailable.value = normalized.bestScoreUnavailable
  stats.value.games_played = normalized.gamesPlayed
  stats.value.best_score = normalized.bestScore
  sessionFailed.value = false
  return true
}

let dashboardRequestId = 0
let sessionRequestId = 0
let threatRequestId = 0
let profileRequestId = 0

const loadDashboardData = async ({ forceThreatRefresh = false } = {}) => {
  const reqId = ++dashboardRequestId
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) {
    resetLocalStats()
    isLoading.value = false
    return
  }

  isLoading.value = true
  generalError.value = ''
  profileFailed.value = false
  sessionFailed.value = false

  try {
    const [profileRes, , sessionRes] = await Promise.allSettled([
      fetchPlayerProfile(),
      threatIndexStore.loadThreatIndex({ force: forceThreatRefresh }),
      fetchSessionHistory({ page_size: 20 }),
      playerClassroomStore.loadMembership({ force: forceThreatRefresh }),
    ])

    if (reqId !== dashboardRequestId || getActiveAccountScope() !== scopeAtStart) {
      return // Discard obsolete or cross-account response
    }

    let resolvedProfileId = authStore.user?.profile_id || null

    // Profile handling
    if (profileRes.status === 'fulfilled' && profileRes.value) {
      const p = profileRes.value
      if (p.profile_id !== undefined && p.profile_id !== null) {
        resolvedProfileId = String(p.profile_id)
      }
      const mapName = resolveCurrentMapName(p.map_progress)
      if (mapName) {
        stats.value.current_map = mapName
      } else {
        stats.value.current_map = null
        profileFailed.value = true
      }
    } else {
      stats.value.current_map = null
      profileFailed.value = true
    }

    // Session History handling (single dataset reused for summary cards, chart, and list)
    if (sessionRes.status === 'fulfilled' && sessionRes.value) {
      applySessionHistoryPayload(sessionRes.value, resolvedProfileId)
    } else {
      sessionItems.value = []
      hasNoSessions.value = false
      bestScoreUnavailable.value = true
      stats.value.games_played = null
      stats.value.best_score = null
      sessionFailed.value = true
    }

    // If all requests failed, surface a general error
    if (profileFailed.value && threatFailed.value && sessionFailed.value) {
      generalError.value =
        'Failed to load player progress. Please verify your connection or try again.'
    }
  } catch {
    if (reqId === dashboardRequestId && getActiveAccountScope() === scopeAtStart) {
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
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingSessions.value = true
  const reqId = ++sessionRequestId

  try {
    const s = await fetchSessionHistory({ page_size: 20 })
    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) return

    const ok = applySessionHistoryPayload(s, authStore.user?.profile_id || null)
    if (ok) {
      generalError.value = ''
    }
  } catch {
    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) return
    sessionFailed.value = true
  } finally {
    if (reqId === sessionRequestId) {
      isRetryingSessions.value = false
    }
  }
}

const retryThreats = async () => {
  if (isRetryingThreats.value || threatIndexStore.isLoading || threatIndexStore.isRefreshing) return
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingThreats.value = true
  const reqId = ++threatRequestId

  try {
    await threatIndexStore.loadThreatIndex({ force: true })
    if (reqId !== threatRequestId || getActiveAccountScope() !== scopeAtStart) return
    if (!threatIndexStore.isUnavailable) {
      generalError.value = ''
    }
  } catch {
    // Error status is tracked in threatIndexStore
  } finally {
    if (reqId === threatRequestId) {
      isRetryingThreats.value = false
    }
  }
}

const retryProfile = async () => {
  if (isRetryingProfile.value) return // Prevent duplicate submissions
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingProfile.value = true
  const reqId = ++profileRequestId

  try {
    const p = await fetchPlayerProfile()
    if (reqId !== profileRequestId || getActiveAccountScope() !== scopeAtStart) return

    const mapName = p ? resolveCurrentMapName(p.map_progress) : null
    if (mapName) {
      stats.value.current_map = mapName
      profileFailed.value = false
      generalError.value = ''
    } else {
      stats.value.current_map = null
      profileFailed.value = true
    }
  } catch {
    if (reqId !== profileRequestId || getActiveAccountScope() !== scopeAtStart) return
    stats.value.current_map = null
    profileFailed.value = true
  } finally {
    if (reqId === profileRequestId) {
      isRetryingProfile.value = false
    }
  }
}

const handleClassroomAction = () => {
  router.push(playerClassroomStore.navRoute)
}

const handleRetryClassroomMembership = () => {
  if (playerClassroomStore.isLoading || playerClassroomStore.isRefreshing) return
  playerClassroomStore.loadMembership({ force: true }).catch(() => {})
}

watch(
  () => getActiveAccountScope(),
  (newScope, oldScope) => {
    if (newScope === oldScope) return
    dashboardRequestId++
    sessionRequestId++
    threatRequestId++
    profileRequestId++
    resetLocalStats()
    if (!newScope) {
      threatIndexStore.reset()
      playerClassroomStore.reset()
      isLoading.value = false
      return
    }
    loadDashboardData({ forceThreatRefresh: true })
  },
)

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
        <div class="current-map-detail">
          <span class="map-detail-label">Highest unlocked map:</span>
          <template v-if="profileFailed">
            <span class="map-detail-unavailable">{{
              isRetryingProfile ? 'Retrying...' : 'Unavailable'
            }}</span>
            <button
              type="button"
              class="btn-inline-retry"
              :disabled="isRetryingProfile"
              @click="retryProfile"
            >
              {{ isRetryingProfile ? 'Retrying...' : 'Retry' }}
            </button>
          </template>
          <template v-else>
            <strong class="map-detail-value">{{ stats.current_map || 'Unavailable' }}</strong>
          </template>
        </div>
      </div>
      <div class="banner-classroom-actions">
        <button type="button" class="btn-outline" @click="handleClassroomAction">
          {{ playerClassroomStore.dashboardActionLabel }}
        </button>
        <button
          v-if="playerClassroomStore.status === 'error'"
          type="button"
          class="btn-inline-retry"
          :disabled="playerClassroomStore.isLoading || playerClassroomStore.isRefreshing"
          @click="handleRetryClassroomMembership"
        >
          {{
            playerClassroomStore.isLoading || playerClassroomStore.isRefreshing
              ? 'Retrying...'
              : 'Retry'
          }}
        </button>
      </div>
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
            <div class="stat-unavailable">
              {{ isRetryingSessions ? 'Retrying...' : 'Unavailable' }}
            </div>
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
          <template v-else-if="stats.games_played === null">
            <div class="stat-unavailable">Unavailable</div>
            <div class="stat-label">Games played</div>
          </template>
          <template v-else>
            <div class="stat-value">{{ stats.games_played.toLocaleString() }}</div>
            <div class="stat-label">Games played</div>
          </template>
        </div>

        <!-- Recent Best Score Card -->
        <div class="stat-card highlight-card">
          <template v-if="sessionFailed">
            <div class="stat-unavailable">
              {{ isRetryingSessions ? 'Retrying...' : 'Unavailable' }}
            </div>
            <div class="stat-label">Recent best score</div>
            <div class="stat-sublabel">Latest 20 sessions</div>
            <button
              type="button"
              class="btn-stat-retry"
              :disabled="isRetryingSessions"
              @click="retrySessions"
            >
              {{ isRetryingSessions ? 'Retrying...' : 'Retry' }}
            </button>
          </template>
          <template v-else-if="hasNoSessions">
            <div class="stat-empty">No sessions yet</div>
            <div class="stat-label">Recent best score</div>
            <div class="stat-sublabel">Latest 20 sessions</div>
          </template>
          <template v-else-if="bestScoreUnavailable || stats.best_score === null">
            <div class="stat-unavailable">Unavailable</div>
            <div class="stat-label">Recent best score</div>
            <div class="stat-sublabel">Latest 20 sessions</div>
          </template>
          <template v-else>
            <div class="stat-value highlight-purple">
              {{ stats.best_score.toLocaleString() }}
            </div>
            <div class="stat-label">Recent best score</div>
            <div class="stat-sublabel">Latest 20 sessions</div>
          </template>
        </div>

        <!-- Threat Index Card -->
        <div class="stat-card">
          <template v-if="threatFailed">
            <div class="stat-unavailable">
              {{
                isRetryingThreats || threatIndexStore.isRefreshing
                  ? 'Retrying...'
                  : threatIndexStore.isIncomplete
                    ? 'Incomplete data'
                    : 'Unavailable'
              }}
            </div>
            <div class="stat-label">Threat index progress</div>
            <div class="stat-card-actions">
              <button
                type="button"
                class="btn-stat-retry"
                :disabled="isRetryingThreats || threatIndexStore.isRefreshing"
                @click="retryThreats"
              >
                {{ isRetryingThreats || threatIndexStore.isRefreshing ? 'Retrying...' : 'Retry' }}
              </button>
              <router-link to="/threat-index" class="stat-link">
                View threat index
              </router-link>
            </div>
          </template>
          <template v-else-if="threatIndexStore.isEmpty">
            <div class="stat-empty">No threat-index entries available</div>
            <div class="stat-label">Threat index progress</div>
            <div class="stat-card-actions">
              <router-link to="/threat-index" class="stat-link">
                View threat index
              </router-link>
            </div>
          </template>
          <template v-else>
            <div class="stat-value highlight-secondary">
              {{ threatIndexStore.progressText || '—' }}
            </div>
            <div class="stat-label">Threat index progress</div>
            <div class="stat-card-actions">
              <router-link to="/threat-index" class="stat-link">
                View threat index
              </router-link>
            </div>
          </template>
        </div>
      </div>

      <!-- Recent Performance & Sessions Section -->
      <section class="recent-progress-panel" aria-labelledby="recent-performance-heading">
        <div class="panel-header">
          <div class="panel-heading-group">
            <div class="panel-title-row">
              <h3 id="recent-performance-heading" class="panel-title">Recent performance</h3>
              <span class="scope-badge">Latest 20 sessions</span>
            </div>
            <p class="panel-subtitle">
              Session score is earned credits minus lost credits and false-positive penalties
              (25 per false positive, minimum 0). Each map features different scenarios.
            </p>
          </div>

          <div v-if="!sessionFailed && !hasNoSessions" class="map-filter-control">
            <label for="overview-map-select" class="map-filter-label">Map</label>
            <select
              id="overview-map-select"
              v-model="selectedMapFilter"
              class="map-select"
              aria-describedby="overview-map-filter-note"
            >
              <option value="All">All maps (latest 20)</option>
              <option v-for="mapName in CANONICAL_SESSION_MAPS" :key="mapName" :value="mapName">
                {{ mapName }}
              </option>
            </select>
            <span id="overview-map-filter-note" class="map-filter-note">
              Filters within your latest 20 sessions
            </span>
          </div>
        </div>

        <!-- Session History Failed State -->
        <div v-if="sessionFailed" class="panel-error-state" role="alert">
          <p class="panel-state-title">Recent session history is currently unavailable.</p>
          <p class="panel-state-desc">
            Your progress could not be loaded right now. Try refreshing your session history.
          </p>
          <button
            type="button"
            class="btn-retry"
            :disabled="isRetryingSessions"
            @click="retrySessions"
          >
            {{ isRetryingSessions ? 'Retrying...' : 'Retry' }}
          </button>
        </div>

        <!-- Empty History State (0 sessions total) -->
        <div v-else-if="hasNoSessions" class="panel-empty-state">
          <p class="panel-state-title">No gameplay sessions recorded yet</p>
          <p class="panel-state-desc">
            Complete a session in the CyberMorph game to view your recent scores and session history
            here.
          </p>
        </div>

        <!-- Filtered Empty State (0 sessions for selected map in latest 20) -->
        <div v-else-if="filteredSessions.length === 0" class="panel-empty-state">
          <p class="panel-state-title">
            No {{ selectedMapFilter }} sessions in your latest 20 sessions
          </p>
          <p class="panel-state-desc">
            Select “All maps (latest 20)” or another map to view your recent recorded sessions.
          </p>
        </div>

        <!-- Populated State: Chart + Accessible Session List -->
        <template v-else>
          <!-- Chart Block -->
          <div class="chart-container" aria-label="Recent session scores chart">
            <template v-if="chartData.points.length >= 2">
              <div class="chart-caption-row">
                <span class="chart-direction-note">
                  Oldest to newest ({{ chartData.points.length }} scored sessions shown)
                </span>
                <span v-if="chartData.invalidExcludedCount > 0" class="chart-excluded-note">
                  {{ chartData.invalidExcludedCount }} session(s) with unavailable score omitted
                  from chart
                </span>
              </div>

              <div class="score-bars" role="img" :aria-label="`Bar chart of ${chartData.points.length} recent session scores from oldest to newest. Detailed values are listed in the Recent sessions table below.`">
                <div
                  v-for="point in chartData.points"
                  :key="point.session_id"
                  class="score-bar-col"
                >
                  <span class="bar-score-label">{{ point.score_label }}</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      :data-map="point.map_name"
                      :style="{ height: `${point.height_percent}%` }"
                    ></div>
                  </div>
                  <span class="bar-map-tag" :data-map="point.map_name">
                    {{ point.short_map_tag }}
                  </span>
                </div>
              </div>
            </template>

            <div v-else-if="chartData.points.length === 1" class="chart-insufficient-notice">
              Only 1 scored session in this view ({{ chartData.points[0].map_name }}:
              <strong>{{ chartData.points[0].score_label }}</strong>). At least 2 scored sessions
              are needed to plot a performance comparison; full details are listed below.
            </div>

            <div v-else class="chart-insufficient-notice">
              Score values are unavailable for the sessions in this view. See the session list below
              for available details.
            </div>
          </div>

          <!-- Accessible Recent Sessions List / Table -->
          <div class="sessions-list-section">
            <div class="sessions-list-header">
              <h4 id="recent-sessions-heading" class="sessions-list-title">Recent sessions</h4>
              <span class="sessions-count-note">
                Showing {{ filteredSessions.length }} of {{ sessionItems.length }} in latest 20
              </span>
            </div>

            <div class="sessions-table-wrapper">
              <table class="sessions-table" aria-labelledby="recent-sessions-heading">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Map</th>
                    <th scope="col">Result</th>
                    <th scope="col" class="col-num">Score</th>
                    <th scope="col">Credit breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="session in filteredSessions" :key="session.session_id">
                    <td data-label="Date" class="cell-date">
                      <span class="date-primary">{{ session.played_date_label }}</span>
                      <span class="date-duration">Duration: {{ session.duration_label }}</span>
                    </td>
                    <td data-label="Map">
                      <span class="map-badge" :data-map="session.map_name">
                        {{ session.map_name }}
                      </span>
                    </td>
                    <td data-label="Result">
                      <span class="result-pill" :data-result="session.result">
                        {{ session.result_label }}
                      </span>
                    </td>
                    <td
                      data-label="Score"
                      class="col-num cell-score"
                      :class="{ 'is-unavailable': session.score === null }"
                    >
                      {{ session.score_label }}
                    </td>
                    <td
                      data-label="Credit breakdown"
                      class="cell-breakdown"
                      :class="{ 'is-unavailable': session.score === null }"
                    >
                      {{ session.credit_breakdown_label }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>
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
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.banner-classroom-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.current-map-detail {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.map-detail-label {
  font-weight: 500;
}

.map-detail-value {
  color: var(--color-primary);
  background-color: var(--color-purple-light);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.12rem 0.65rem;
  font-weight: 700;
  font-size: 0.82rem;
}

.map-detail-unavailable {
  color: var(--color-text-dim);
  font-weight: 600;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.4rem 1.25rem;
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

.stat-sublabel {
  margin-top: 0.2rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--color-text-dim);
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

.btn-outline:focus-visible,
.btn-retry:focus-visible,
.btn-stat-retry:focus-visible,
.btn-inline-retry:focus-visible,
.map-select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Recent Performance & Sessions Panel */
.recent-progress-panel {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.panel-heading-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-width: 64ch;
}

.panel-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.panel-title {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-text-main);
}

.scope-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-purple-light);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}

.panel-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.map-filter-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.map-filter-label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.map-select {
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  min-width: 185px;
  cursor: pointer;
}

.map-filter-note {
  font-size: 0.74rem;
  color: var(--color-text-dim);
}

/* Panel Empty & Error States */
.panel-error-state,
.panel-empty-state {
  padding: 1.75rem 1.25rem;
  border-radius: 10px;
  border: 1px dashed var(--color-border);
  background-color: var(--color-bg-subtle);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

.panel-error-state {
  border-style: solid;
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

.panel-state-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.98rem;
  color: var(--color-text-main);
}

.panel-error-state .panel-state-title {
  color: var(--color-danger);
}

.panel-state-desc {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
  max-width: 52ch;
}

/* Chart Area */
.chart-container {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chart-caption-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.76rem;
  color: var(--color-text-muted);
}

.chart-direction-note {
  font-weight: 600;
}

.chart-excluded-note {
  color: var(--color-text-dim);
}

.score-bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
  gap: 0.4rem;
  align-items: end;
  min-height: 156px;
  padding-top: 0.35rem;
}

.score-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.bar-score-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bar-track {
  width: 100%;
  max-width: 34px;
  height: 108px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  padding: 2px;
}

.bar-fill {
  width: 100%;
  border-radius: 4px;
  background: var(--btn-gradient);
  transition: height 0.2s ease;
}

.bar-fill[data-map='Home'] {
  background: var(--color-primary);
}

.bar-fill[data-map='Office'] {
  background: var(--color-secondary);
}

.bar-fill[data-map='Internet Cafe'] {
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-secondary) 100%);
}

.bar-fill[data-map='Public Park'] {
  background: var(--color-success);
}

.bar-map-tag {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.1;
  white-space: nowrap;
}

.chart-insufficient-notice {
  font-size: 0.86rem;
  color: var(--color-text-muted);
  line-height: 1.45;
  padding: 0.35rem 0.25rem;
}

/* Accessible Recent Sessions Table */
.sessions-list-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.sessions-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sessions-list-title {
  margin: 0;
  font-size: 0.98rem;
  color: var(--color-text-main);
}

.sessions-count-note {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.sessions-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.sessions-table th,
.sessions-table td {
  padding: 0.7rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.sessions-table th {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
}

.sessions-table th.col-num,
.sessions-table td.col-num {
  text-align: right;
}

.cell-date {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.date-primary {
  font-weight: 600;
  color: var(--color-text-main);
}

.date-duration {
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

.map-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  background-color: var(--color-purple-light);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.result-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.16rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
}

.result-pill[data-result='win'] {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.result-pill[data-result='lose'] {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.result-pill[data-result='timeout'] {
  background-color: var(--color-purple-light);
  border-color: var(--color-border);
  color: var(--color-primary);
}

.cell-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-primary);
  white-space: nowrap;
}

.cell-breakdown {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.cell-score.is-unavailable,
.cell-breakdown.is-unavailable {
  color: var(--color-text-dim);
  font-family: var(--font-sans);
  font-weight: 600;
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

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
  .stat-card,
  .bar-fill,
  .btn-outline {
    transition: none;
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

.stat-empty {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 0.35rem;
  line-height: 1.35;
}

.stat-card-actions {
  margin-top: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.stat-link {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
}

.stat-link:hover {
  text-decoration: underline;
}

.stat-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.btn-stat-retry {
  margin-top: 0.4rem;
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
  margin-left: 0.35rem;
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

/* Responsive layout for mobile and enlarged text without horizontal overflow */
@media (max-width: 720px) {
  .map-filter-control {
    align-items: flex-start;
    width: 100%;
  }

  .map-select {
    width: 100%;
  }

  .score-bars {
    grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
    gap: 0.25rem;
  }

  .bar-score-label {
    font-size: 0.62rem;
  }

  .bar-map-tag {
    font-size: 0.62rem;
  }

  .sessions-table thead {
    display: none;
  }

  .sessions-table,
  .sessions-table tbody,
  .sessions-table tr,
  .sessions-table td {
    display: block;
    width: 100%;
  }

  .sessions-table tr {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    margin-bottom: 0.65rem;
    background-color: var(--color-bg-subtle);
  }

  .sessions-table td {
    border-bottom: none;
    padding: 0.28rem 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    text-align: right;
  }

  .sessions-table td::before {
    content: attr(data-label);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    text-align: left;
    flex-shrink: 0;
  }

  .cell-date {
    align-items: flex-end;
  }
}

@media (min-width: 1600px) {
  .score-bars {
    min-height: 190px;
    gap: 0.6rem;
  }

  .chart-container {
    padding: 1.35rem 1.5rem;
  }
}
</style>
