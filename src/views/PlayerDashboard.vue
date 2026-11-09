<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useThreatIndexStore } from '../stores/threatIndexStore'
import { usePlayerClassroomStore } from '../stores/playerClassroomStore'
import { fetchPlayerProfile } from '../api/player'
import { fetchSessionHistory } from '../api/session'
import { classifyApiError } from '../api/client'
import { usePageRecovery } from '../composables/usePageRecovery'
import {
  CANONICAL_SESSION_MAPS,
  resolveCurrentMapName,
  isMapUnlocked,
  normalizeSessionHistoryResponse,
  filterSessionsByMap,
  buildChartSeries,
} from '../utils/playerSessions'
import AppIcon from '../components/common/AppIcon.vue'
import PlayerDownloadModal from '../components/player/PlayerDownloadModal.vue'
import homeMapImg from '../assets/maps/home.png'
import officeMapImg from '../assets/maps/office.png'
import cafeMapImg from '../assets/maps/internet-cafe.png'
import parkMapImg from '../assets/maps/public-park.png'

const MAP_PROGRESSION_METADATA = Object.freeze([
  { id: 'home', name: 'Home', index: 0, image: homeMapImg },
  { id: 'office', name: 'Office', index: 1, image: officeMapImg },
  { id: 'internet-cafe', name: 'Internet Cafe', index: 2, image: cafeMapImg },
  { id: 'public-park', name: 'Public Park', index: 3, image: parkMapImg },
])

const authStore = useAuthStore()
const threatIndexStore = useThreatIndexStore()
const playerClassroomStore = usePlayerClassroomStore()

const stats = ref({
  games_played: null, // null = unknown/unavailable; number = confirmed count
  best_score: null,
  current_map: null,
  map_progress: null, // null = unknown/unavailable; 0..3 = confirmed progression
})

const sessionItems = ref([])
const hasNoSessions = ref(false)
const bestScoreUnavailable = ref(false)
const selectedMapFilter = ref('All')

// Independent loading, refreshing, and failure states
const isProfileLoading = ref(true)
const isProfileRefreshing = ref(false)
const hasLoadedProfileOnce = ref(false)
const profileFailed = ref(false)

const isSessionLoading = ref(true)
const isSessionRefreshing = ref(false)
const hasLoadedSessionsOnce = ref(false)
const sessionFailed = ref(false)

const isRetryingSessions = ref(false)
const isRetryingThreats = ref(false)
const isRetryingProfile = ref(false)

const slowLoadingNotice = ref(false)
let slowTimer = null

const generalError = ref('')

const threatFailed = computed(() => threatIndexStore.isUnavailable)

const mapProgressionList = computed(() => {
  const progress = stats.value.map_progress
  if (
    progress === null ||
    typeof progress !== 'number' ||
    !Number.isInteger(progress) ||
    progress < 0 ||
    progress > 3
  ) {
    return []
  }
  return MAP_PROGRESSION_METADATA.map((map) => ({
    ...map,
    isUnlocked: isMapUnlocked(map.index, progress),
  }))
})

// Chart is restricted to the latest 10 sessions before applying the map filter
const chartSourceSessions = computed(() => sessionItems.value.slice(0, 10))

const filteredSessions = computed(() =>
  filterSessionsByMap(chartSourceSessions.value, selectedMapFilter.value),
)

const chartData = computed(() => buildChartSeries(filteredSessions.value))

const chartAriaLabel = computed(() => {
  const count = chartData.value.points.length
  return `Bar chart of ${count} recent session scores from oldest to newest within your latest 10 sessions. Plotted values are provided in the accessible data table.`
})

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

let activeAbortController = null

const resetSlowTimer = () => {
  if (slowTimer) clearTimeout(slowTimer)
  slowLoadingNotice.value = false
  slowTimer = setTimeout(() => {
    if (
      (!hasLoadedProfileOnce.value && isProfileLoading.value) ||
      (!hasLoadedSessionsOnce.value && isSessionLoading.value) ||
      (!threatIndexStore.isReady && threatIndexStore.isLoading)
    ) {
      slowLoadingNotice.value = true
    }
  }, 7000)
}

const resetLocalStats = () => {
  stats.value = {
    games_played: null,
    best_score: null,
    current_map: null,
    map_progress: null,
  }
  sessionItems.value = []
  hasNoSessions.value = false
  bestScoreUnavailable.value = false
  selectedMapFilter.value = 'All'
  profileFailed.value = false
  sessionFailed.value = false
  hasLoadedProfileOnce.value = false
  hasLoadedSessionsOnce.value = false
  isProfileLoading.value = false
  isProfileRefreshing.value = false
  isSessionLoading.value = false
  isSessionRefreshing.value = false
  generalError.value = ''
  slowLoadingNotice.value = false
  if (slowTimer) {
    clearTimeout(slowTimer)
    slowTimer = null
  }
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
let profileRequestId = 0

const loadProfile = async (scopeAtStart, signal) => {
  const reqId = ++profileRequestId
  isProfileLoading.value = !hasLoadedProfileOnce.value
  isProfileRefreshing.value = hasLoadedProfileOnce.value
  profileFailed.value = false

  try {
    const p = await fetchPlayerProfile({ signal })
    if (reqId !== profileRequestId || getActiveAccountScope() !== scopeAtStart) return

    const rawProgress = p ? p.map_progress : null
    const isValidProgress =
      typeof rawProgress === 'number' &&
      Number.isInteger(rawProgress) &&
      rawProgress >= 0 &&
      rawProgress <= 3

    if (isValidProgress) {
      stats.value.map_progress = rawProgress
      stats.value.current_map = resolveCurrentMapName(rawProgress)
      profileFailed.value = false
      hasLoadedProfileOnce.value = true
      generalError.value = ''
    } else {
      stats.value.map_progress = null
      stats.value.current_map = null
      profileFailed.value = true
    }
  } catch (err) {
    if (classifyApiError(err) === 'canceled') return
    if (reqId !== profileRequestId || getActiveAccountScope() !== scopeAtStart) return
    if (!hasLoadedProfileOnce.value) {
      stats.value.map_progress = null
      stats.value.current_map = null
    }
    profileFailed.value = true
  } finally {
    if (reqId === profileRequestId) {
      isProfileLoading.value = false
      isProfileRefreshing.value = false
    }
  }
}

const loadSessions = async (scopeAtStart, signal) => {
  const reqId = ++sessionRequestId
  isSessionLoading.value = !hasLoadedSessionsOnce.value
  isSessionRefreshing.value = hasLoadedSessionsOnce.value
  sessionFailed.value = false

  try {
    const s = await fetchSessionHistory({ page_size: 20 }, { signal })
    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) return

    let resolvedProfileId = authStore.user?.profile_id || null
    const ok = applySessionHistoryPayload(s, resolvedProfileId)
    if (ok) {
      hasLoadedSessionsOnce.value = true
      sessionFailed.value = false
      generalError.value = ''
    }
  } catch (err) {
    if (classifyApiError(err) === 'canceled') return
    if (reqId !== sessionRequestId || getActiveAccountScope() !== scopeAtStart) return
    if (!hasLoadedSessionsOnce.value) {
      sessionItems.value = []
      hasNoSessions.value = false
      bestScoreUnavailable.value = true
      stats.value.games_played = null
      stats.value.best_score = null
    }
    sessionFailed.value = true
  } finally {
    if (reqId === sessionRequestId) {
      isSessionLoading.value = false
      isSessionRefreshing.value = false
    }
  }
}

const loadDashboardData = async ({ forceThreatRefresh = false } = {}) => {
  const reqId = ++dashboardRequestId
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) {
    resetLocalStats()
    return
  }

  // Abort any obsolete in-flight requests from earlier calls
  activeAbortController?.abort()
  activeAbortController = new AbortController()
  const signal = activeAbortController.signal

  resetSlowTimer()
  generalError.value = ''

  // Dispatch all datasets in parallel; each updates immediately as it arrives
  const profileP = loadProfile(scopeAtStart, signal)
  const sessionP = loadSessions(scopeAtStart, signal)
  const threatP = threatIndexStore
    .loadThreatIndex({ force: forceThreatRefresh })
    .catch(() => {})
  const classroomP = playerClassroomStore
    .loadMembership({ force: forceThreatRefresh })
    .catch(() => {})

  await Promise.allSettled([profileP, sessionP, threatP, classroomP])

  if (reqId !== dashboardRequestId || getActiveAccountScope() !== scopeAtStart) {
    return
  }

  // Only surface general error if all core player data failed and nothing was previously loaded
  if (
    profileFailed.value &&
    sessionFailed.value &&
    threatFailed.value &&
    !hasLoadedProfileOnce.value &&
    !hasLoadedSessionsOnce.value
  ) {
    generalError.value =
      'Failed to load player progress. Please verify your connection or try again.'
  }
}

const retrySessions = async () => {
  if (isRetryingSessions.value || isSessionLoading.value) return
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingSessions.value = true
  try {
    await loadSessions(scopeAtStart, activeAbortController?.signal)
  } finally {
    isRetryingSessions.value = false
  }
}

const retryThreats = async () => {
  if (
    isRetryingThreats.value ||
    threatIndexStore.isLoading ||
    threatIndexStore.isRefreshing
  ) {
    return
  }
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingThreats.value = true
  try {
    await threatIndexStore.loadThreatIndex({ force: true })
    if (!threatIndexStore.isUnavailable) {
      generalError.value = ''
    }
  } finally {
    isRetryingThreats.value = false
  }
}

const retryProfile = async () => {
  if (isRetryingProfile.value || isProfileLoading.value) return
  const scopeAtStart = getActiveAccountScope()
  if (!scopeAtStart) return
  isRetryingProfile.value = true
  try {
    await loadProfile(scopeAtStart, activeAbortController?.signal)
  } finally {
    isRetryingProfile.value = false
  }
}

const isDownloadModalOpen = ref(false)
const downloadBtnRef = ref(null)

const openDownloadDialog = () => {
  isDownloadModalOpen.value = true
}

const closeDownloadDialog = () => {
  isDownloadModalOpen.value = false
  nextTick(() => {
    downloadBtnRef.value?.focus()
  })
}

// Register coordinated recovery hook for tab-switching, sleep/hibernation wake-up, or online events
usePageRecovery(async () => {
  if (!authStore.isAuthenticated || !authStore.isPlayer) return
  if (
    isProfileLoading.value ||
    isProfileRefreshing.value ||
    isSessionLoading.value ||
    isSessionRefreshing.value ||
    isRetryingProfile.value ||
    isRetryingSessions.value ||
    isRetryingThreats.value ||
    threatIndexStore.isLoading ||
    threatIndexStore.isRefreshing
  ) {
    return
  }
  await loadDashboardData({ forceThreatRefresh: true })
})

watch(
  () => getActiveAccountScope(),
  (newScope, oldScope) => {
    if (newScope === oldScope) return
    activeAbortController?.abort()
    dashboardRequestId++
    sessionRequestId++
    profileRequestId++
    resetLocalStats()
    if (!newScope) {
      threatIndexStore.reset()
      playerClassroomStore.reset()
      return
    }
    loadDashboardData({ forceThreatRefresh: true })
  },
)

onMounted(() => {
  loadDashboardData()
})

onUnmounted(() => {
  activeAbortController?.abort()
  dashboardRequestId++
  sessionRequestId++
  profileRequestId++
  if (slowTimer) {
    clearTimeout(slowTimer)
    slowTimer = null
  }
})
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-header">
        <div class="banner-text">
          <h2 class="title">Welcome back, {{ authStore.user?.username || 'Player' }}</h2>
        </div>
        <div class="banner-download-action">
          <button
            ref="downloadBtnRef"
            type="button"
            class="btn-outline download-trigger-btn"
            aria-haspopup="dialog"
            @click="openDownloadDialog"
          >
            <AppIcon name="download" :size="16" />
            <span>Download APK</span>
          </button>
        </div>
      </div>

      <!-- Map Progression Section -->
      <section class="map-progression-section" aria-label="Map progression">
        <div class="map-progression-header">
          <span class="map-progression-label">Map progression</span>
        </div>

        <!-- Loading State: never displays fabricated progression -->
        <div
          v-if="isProfileLoading && !hasLoadedProfileOnce"
          class="map-progression-status"
          aria-live="polite"
        >
          <div class="spinner spinner-xs" aria-hidden="true"></div>
          <span class="map-status-note">Loading map progression...</span>
          <span v-if="slowLoadingNotice" class="slow-hint">Taking longer than expected...</span>
        </div>

        <!-- Explicit Failure / Missing Progression State: never defaults to 0 or all locked (initial load only) -->
        <div
          v-else-if="!hasLoadedProfileOnce && (profileFailed || stats.map_progress === null)"
          class="map-progression-status map-progression-failed"
          role="status"
        >
          <span class="map-status-note">
            {{ isRetryingProfile ? 'Retrying map progression...' : 'Map progression unavailable' }}
          </span>
          <button
            type="button"
            class="btn-inline-retry"
            :disabled="isRetryingProfile"
            @click="retryProfile"
          >
            {{ isRetryingProfile ? 'Retrying...' : 'Retry' }}
          </button>
        </div>

        <!-- Canonical 4-Map Progression Grid (when loaded once) -->
        <template v-else-if="hasLoadedProfileOnce && stats.map_progress !== null">
          <!-- Refresh Warning Banner if background refresh failed -->
          <div v-if="profileFailed" class="map-refresh-warning" role="alert">
            <span class="map-status-note">Map progression could not be refreshed.</span>
            <button
              type="button"
              class="btn-inline-retry"
              :disabled="isRetryingProfile || isProfileRefreshing"
              @click="retryProfile"
            >
              {{ isRetryingProfile || isProfileRefreshing ? 'Retrying...' : 'Retry' }}
            </button>
          </div>

          <div class="map-progression-grid" role="list">
            <div
              v-for="map in mapProgressionList"
              :key="map.id"
              class="map-progression-card"
              :class="map.isUnlocked ? 'is-unlocked' : 'is-locked'"
              role="listitem"
            >
              <div class="map-card-thumb-wrap">
                <img
                  :src="map.image"
                  alt=""
                  class="map-card-thumb"
                  loading="lazy"
                />
              </div>
              <div class="map-card-info">
                <span class="map-card-name">{{ map.name }}</span>
                <span
                  class="map-status-badge"
                  :class="map.isUnlocked ? 'badge-unlocked' : 'badge-locked'"
                >
                  <AppIcon :name="map.isUnlocked ? 'check' : 'lock'" :size="12" />
                  <span class="map-status-text">{{ map.isUnlocked ? 'Unlocked' : 'Locked' }}</span>
                </span>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- Complete Failure State (only if all primary datasets failed with no prior data) -->
    <div v-if="generalError" class="error-banner" role="alert">
      <span>{{ generalError }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="isProfileLoading || isSessionLoading"
        @click="loadDashboardData"
      >
        Try again
      </button>
    </div>

    <!-- Dashboard Content with Partial Failure Resilience -->
    <div class="dashboard-content">
      <div class="stats-grid">
        <!-- Games Played Card -->
        <div class="stat-card">
          <AppIcon name="game" :size="20" class="stat-icon" aria-hidden="true" />
          <template v-if="isSessionLoading && !hasLoadedSessionsOnce">
            <div class="stat-loading" aria-live="polite">
              <div class="spinner spinner-xs" aria-hidden="true"></div>
              <span>Loading...</span>
            </div>
            <div class="stat-label">Games played</div>
          </template>
          <template v-else-if="!hasLoadedSessionsOnce && sessionFailed">
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
          <AppIcon name="trophy" :size="20" class="stat-icon" aria-hidden="true" />
          <template v-if="isSessionLoading && !hasLoadedSessionsOnce">
            <div class="stat-loading" aria-live="polite">
              <div class="spinner spinner-xs" aria-hidden="true"></div>
              <span>Loading...</span>
            </div>
            <div class="stat-label">Recent best score</div>
            <div class="stat-sublabel">Latest 20 sessions</div>
          </template>
          <template v-else-if="!hasLoadedSessionsOnce && sessionFailed">
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
          <AppIcon name="shield" :size="20" class="stat-icon" aria-hidden="true" />
          <template v-if="threatIndexStore.isLoading && !threatIndexStore.isReady">
            <div class="stat-loading" aria-live="polite">
              <div class="spinner spinner-xs" aria-hidden="true"></div>
              <span>Loading...</span>
            </div>
            <div class="stat-label">Threat index progress</div>
            <div class="stat-card-actions">
              <router-link to="/threat-index" class="stat-link">
                View threat index
              </router-link>
            </div>
          </template>
          <template v-else-if="!threatIndexStore.hasLoadedOnce && threatFailed">
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
              <span class="scope-badge">Latest 10 sessions</span>
            </div>
            <details class="scoring-disclosure">
              <summary class="scoring-disclosure-summary">How scoring works</summary>
              <p class="scoring-disclosure-text">
                Session score is earned credits minus lost credits and false-positive penalties
                (25 per false positive, minimum 0). Each map features different scenarios.
              </p>
            </details>
          </div>

          <router-link to="/session-history" class="btn-history-link">
            <span>View session history</span>
            <AppIcon name="arrow-right" :size="15" />
          </router-link>
        </div>

        <!-- Filter Row -->
        <div
          v-if="hasLoadedSessionsOnce && !hasNoSessions"
          class="panel-filter-row"
        >
          <div class="map-filter-control">
            <label for="overview-map-select" class="map-filter-label">Filter by map</label>
            <div class="map-filter-input-group">
              <select
                id="overview-map-select"
                v-model="selectedMapFilter"
                class="map-select"
              >
                <option value="All">All maps (latest 10)</option>
                <option v-for="mapName in CANONICAL_SESSION_MAPS" :key="mapName" :value="mapName">
                  {{ mapName }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Session History Refresh Warning (when previously loaded) -->
        <div
          v-if="hasLoadedSessionsOnce && sessionFailed"
          class="panel-refresh-warning"
          role="alert"
        >
          <span>Recent session history could not be refreshed.</span>
          <button
            type="button"
            class="btn-inline-retry"
            :disabled="isRetryingSessions || isSessionRefreshing"
            @click="retrySessions"
          >
            {{ isRetryingSessions || isSessionRefreshing ? 'Retrying...' : 'Retry' }}
          </button>
        </div>

        <!-- Session Loading State -->
        <div
          v-if="isSessionLoading && !hasLoadedSessionsOnce"
          class="panel-loading-state"
          aria-live="polite"
        >
          <div class="spinner"></div>
          <p>Loading recent session history...</p>
          <span v-if="slowLoadingNotice" class="slow-hint">Taking longer than expected...</span>
        </div>

        <!-- Session History Failed State (initial load only) -->
        <div v-else-if="!hasLoadedSessionsOnce && sessionFailed" class="panel-error-state" role="alert">
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

        <!-- Filtered Empty State (0 sessions for selected map in latest 10) -->
        <div v-else-if="filteredSessions.length === 0" class="panel-empty-state">
          <p class="panel-state-title">
            No {{ selectedMapFilter }} sessions in your latest 10 sessions
          </p>
          <p class="panel-state-desc">
            Select “All maps (latest 10)” or another map to view your recent recorded sessions.
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

              <div
                class="score-bars-wrapper"
                tabindex="0"
                role="region"
                aria-label="Performance score chart"
              >
                <div class="score-bars" role="img" :aria-label="chartAriaLabel">
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
              </div>
            </template>

            <div v-else-if="chartData.points.length === 1" class="chart-insufficient-notice">
              Only 1 scored session in this view ({{ chartData.points[0].map_name }}:
              <strong>{{ chartData.points[0].score_label }}</strong>). At least 2 scored sessions
              are needed to plot a performance comparison.
            </div>

            <div v-else class="chart-insufficient-notice">
              Score values are unavailable for the sessions in this view.
            </div>

            <!-- Screen-reader accessible equivalent for plotted sessions -->
            <div class="sr-only">
              <table>
                <caption>Recent performance score history (latest 10 sessions, oldest to newest)</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Map</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="point in chartData.points" :key="point.session_id">
                    <td>{{ point.played_date_label }}</td>
                    <td>{{ point.map_name }}</td>
                    <td>{{ point.score_label }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- In-place Accessible Download Modal -->
    <PlayerDownloadModal
      :is-open="isDownloadModalOpen"
      @close="closeDownloadDialog"
    />
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
  flex-direction: column;
  gap: 1.25rem;
}

.banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  color: var(--color-text-main);
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 auto;
}

.banner-download-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  max-width: 100%;
}

.banner-download-action .download-trigger-btn {
  max-width: 100%;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border-control);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.15rem;
  min-height: 40px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.banner-download-action .download-trigger-btn:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary-hover);
}

.banner-download-action .download-trigger-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.title {
  margin: 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: break-word;
  word-break: break-word;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.map-progression-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
}

.map-progression-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.map-progression-label {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.map-progression-status {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.map-progression-failed {
  color: var(--color-text-muted);
}

.map-status-note {
  font-weight: 500;
}

.spinner-xs {
  width: 16px;
  height: 16px;
  margin: 0;
  border-width: 2px;
  flex-shrink: 0;
}

.map-progression-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  width: 100%;
}

.map-progression-card {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  min-width: 0;
}

.map-progression-card.is-unlocked {
  border-color: var(--color-secondary);
}

.map-progression-card.is-locked {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border);
  opacity: 0.88;
}

.map-card-thumb-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: var(--color-bg-muted);
  overflow: hidden;
}

.map-card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  image-rendering: pixelated;
  display: block;
}

.map-progression-card.is-locked .map-card-thumb {
  filter: grayscale(75%) opacity(0.7);
}

.map-card-info {
  padding: 0.65rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  min-width: 0;
  flex: 1;
}

.map-card-name {
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
  line-height: 1.25;
  overflow-wrap: break-word;
  word-break: break-word;
}

.map-progression-card.is-locked .map-card-name {
  color: var(--color-text-muted);
}

.map-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  width: fit-content;
  line-height: 1.3;
  flex-shrink: 0;
  white-space: nowrap;
}

.map-status-badge.badge-unlocked {
  background-color: var(--color-purple-light);
  border: 1px solid var(--color-secondary);
  color: var(--color-primary);
}

.map-status-badge.badge-locked {
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
}

.map-status-text {
  font-size: 0.72rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .banner-header {
    padding: 1rem 1.15rem;
    gap: 0.85rem;
  }

  .title {
    font-size: 1.25rem;
  }

  .map-progression-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }
}

@media (max-width: 360px) {
  .map-progression-grid {
    grid-template-columns: 1fr;
  }
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
  position: relative;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.4rem 1.25rem;
  text-align: center;
  box-shadow: var(--shadow-purple);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-icon {
  position: absolute;
  top: 1.15rem;
  right: 1.15rem;
  color: var(--color-primary);
  pointer-events: none;
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
  gap: 1.25rem;
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

.scoring-disclosure {
  margin-top: 0.35rem;
  font-size: 0.85rem;
}

.scoring-disclosure-summary {
  cursor: pointer;
  font-weight: 500;
  font-size: 0.82rem;
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  user-select: none;
  padding: 0.15rem 0.35rem;
  margin-left: -0.35rem;
  border-radius: 4px;
}

.scoring-disclosure-summary:hover {
  text-decoration: underline;
  color: #6d28d9;
}

.scoring-disclosure-summary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.35);
}

.scoring-disclosure-text {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.45;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.panel-filter-row {
  display: flex;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-subtle);
}

.map-filter-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.map-filter-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.map-filter-input-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.map-select {
  padding: 0.5rem 0.85rem;
  min-height: 38px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  min-width: 200px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.map-select:focus,
.map-select:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

.map-filter-note {
  font-size: 0.78rem;
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

.score-bars-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.score-bars {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(38px, 1fr);
  gap: 0.45rem;
  align-items: end;
  min-height: 156px;
  padding-top: 0.35rem;
  padding-bottom: 0.25rem;
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
  background: var(--color-primary);
  transition: height 0.2s ease;
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

.btn-history-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  min-height: 44px;
  padding: 0 1.15rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.btn-history-link:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.btn-history-link:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

.loading-state {
  text-align: center;
  padding: 3.5rem 1rem;
  color: var(--color-text-muted);
}

.panel-loading-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
}

.map-refresh-warning,
.panel-refresh-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.85rem;
  margin-bottom: 0.75rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  color: var(--color-danger);
  font-size: 0.85rem;
}

.stat-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  min-height: 2.2rem;
}

.slow-hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.8rem;
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
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .btn-history-link {
    width: 100%;
  }

  .map-filter-control {
    align-items: stretch;
    width: 100%;
  }

  .map-filter-input-group {
    width: 100%;
  }

  .map-select {
    width: 100%;
  }

  .score-bars {
    gap: 0.35rem;
  }

  .bar-score-label {
    font-size: 0.65rem;
  }

  .bar-map-tag {
    font-size: 0.65rem;
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
