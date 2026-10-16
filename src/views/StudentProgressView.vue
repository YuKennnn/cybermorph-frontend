<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClassroomWorkspaceHeader from '../components/classroom/ClassroomWorkspaceHeader.vue'
import SessionTelemetryModal from '../components/analytics/SessionTelemetryModal.vue'
import AppIcon from '../components/common/AppIcon.vue'
import { fetchClassroomStudents } from '../api/classroom.js'
import { fetchPlayerAnalytics, fetchSessionAnalytics } from '../api/analytics.js'
import { useClassroomStore } from '../stores/classroomStore.js'

const route = useRoute()
const router = useRouter()
const classroomStore = useClassroomStore()

const syncClassroomMetadata = (force = false) => {
  if (codeId.value) {
    classroomStore.setCurrentClassroomId(codeId.value)
    classroomStore.fetchClassrooms(force).catch(() => {})
  }
}

// Documented Simulation Maps & Canonical Threats
const CANONICAL_MAPS = [
  { name: 'Home' },
  { name: 'Office' },
  { name: 'Internet Cafe' },
  { name: 'Public Park' },
]

const CANONICAL_THREATS = [
  { name: 'Phishing' },
  { name: 'Smishing' },
  { name: 'Vishing' },
  { name: 'Social Engineering' },
  { name: 'Credential Theft / Weak Password Attack' },
  { name: 'Public Wi-Fi Attack' },
  { name: 'Malware Infection' },
  { name: 'Ransomware' },
]

// Request ID Generation Guards (Condition 5: prevent stale updates)
let identityRequestId = 0
let analyticsRequestId = 0
let sessionRequestId = 0

// Route Parameters
const codeId = computed(() => String(route.params.code_id || ''))
const profileId = computed(() => String(route.params.profile_id || ''))

// Origin & Return Destination (Condition 4: explicit origin priority + legacy preservation)
const origin = computed(() => {
  if (route.query.origin === 'students') return 'students'
  if (route.query.origin === 'analytics') return 'analytics'

  // Legacy links fallback:
  // "A legacy link carrying roster_page must retain its Students return destination even when table_page is also present."
  if (route.query.roster_page) return 'students'
  if (route.query.table_page) return 'analytics'

  return 'students'
})

const originatingRosterPage = computed(() => {
  const p = parseInt(route.query.roster_page, 10)
  return !isNaN(p) && p > 0 ? p : 1
})

const originatingTablePage = computed(() => {
  const p = parseInt(route.query.table_page, 10)
  return !isNaN(p) && p > 0 ? p : 1
})

const returnDestination = computed(() => {
  if (origin.value === 'analytics') {
    const query = { table_page: originatingTablePage.value }
    if (route.query.roster_page) {
      query.roster_page = originatingRosterPage.value
    }
    return {
      path: `/analytics/${codeId.value}`,
      query,
      label: '◀ Return to analytics',
    }
  }

  return {
    path: `/classroom/students/${codeId.value}`,
    query: originatingRosterPage.value > 1 ? { page: originatingRosterPage.value } : {},
    label: '◀ Return to classroom roster',
  }
})

// ==========================================
// 1. Student Identity Resolution (Bounded Search)
// ==========================================
const studentIdentity = ref({
  username: '',
  map_progress: null,
  last_synced_at: null,
})
// 'loading' | 'found' | 'no_match' | 'limit_reached' | 'error'
const identityStatus = ref('loading')
const identityError = ref('')

const formatMapProgress = (progress) => {
  if (typeof progress === 'number' && progress >= 1 && progress <= CANONICAL_MAPS.length) {
    return CANONICAL_MAPS[progress - 1].name
  }
  if (typeof progress === 'string' && progress.trim()) {
    return progress
  }
  return 'Not started'
}

const formatLastSynced = (isoString) => {
  if (!isoString) return 'Not synced yet'
  const date = new Date(isoString)
  return isNaN(date.getTime())
    ? 'Not synced yet'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

const resolveStudentIdentity = async () => {
  const reqId = ++identityRequestId
  identityStatus.value = 'loading'
  identityError.value = ''

  try {
    const startPage = originatingRosterPage.value
    const firstRes = await fetchClassroomStudents(codeId.value, {
      page: startPage,
      page_size: 10,
    })

    if (reqId !== identityRequestId) return

    const items = firstRes?.items || firstRes?.students || (Array.isArray(firstRes) ? firstRes : [])
    const foundOnStart = items.find((s) => String(s.profile_id) === profileId.value)

    if (foundOnStart) {
      studentIdentity.value = {
        username: foundOnStart.username || '',
        map_progress: foundOnStart.map_progress ?? null,
        last_synced_at: foundOnStart.last_synced_at || null,
      }
      identityStatus.value = 'found'
      return
    }

    // Determine total pages to check if further search is possible
    const totalCount = firstRes?.total_count ?? items.length
    const pageSize = firstRes?.page_size ?? 10
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    if (totalPages <= 1) {
      identityStatus.value = 'no_match'
      return
    }

    // Bounded search across remaining pages (capped at 5 pages)
    const MAX_SEARCH_PAGES = 5
    let matchedStudent = null

    for (let p = 1; p <= Math.min(totalPages, MAX_SEARCH_PAGES); p++) {
      if (p === startPage) continue
      const pageRes = await fetchClassroomStudents(codeId.value, {
        page: p,
        page_size: pageSize,
      })

      if (reqId !== identityRequestId) return

      const pageItems = pageRes?.items || pageRes?.students || (Array.isArray(pageRes) ? pageRes : [])
      const found = pageItems.find((s) => String(s.profile_id) === profileId.value)
      if (found) {
        matchedStudent = found
        break
      }
    }

    if (reqId !== identityRequestId) return

    if (matchedStudent) {
      studentIdentity.value = {
        username: matchedStudent.username || '',
        map_progress: matchedStudent.map_progress ?? null,
        last_synced_at: matchedStudent.last_synced_at || null,
      }
      identityStatus.value = 'found'
    } else if (totalPages > MAX_SEARCH_PAGES) {
      identityStatus.value = 'limit_reached'
    } else {
      identityStatus.value = 'no_match'
    }
  } catch {
    if (reqId === identityRequestId) {
      identityStatus.value = 'error'
      identityError.value = 'Unable to verify student identity from classroom roster.'
    }
  }
}

// Displayed Student Title
const displayName = computed(() => {
  if (studentIdentity.value.username) return studentIdentity.value.username
  if (identityStatus.value === 'loading') return 'Loading student...'
  return 'Student'
})

// ==========================================
// 2. Player Analytics State & Computation
// ==========================================
const analyticsData = ref(null)
const isAnalyticsLoading = ref(true)
const analyticsError = ref('')

const loadPlayerAnalytics = async () => {
  const reqId = ++analyticsRequestId
  isAnalyticsLoading.value = true
  analyticsError.value = ''

  try {
    const data = await fetchPlayerAnalytics(profileId.value)
    if (reqId !== analyticsRequestId) return
    analyticsData.value = data
  } catch (err) {
    if (reqId !== analyticsRequestId) return
    analyticsError.value =
      err?.response?.data?.detail ||
      'Could not load student performance data. Please try again.'
  } finally {
    if (reqId === analyticsRequestId) {
      isAnalyticsLoading.value = false
    }
  }
}

// Win rate & completed sessions computation
const totalGamesPlayed = computed(() => {
  if (!analyticsData.value) return 0
  const w = Number(analyticsData.value.wins) || 0
  const l = Number(analyticsData.value.losses) || 0
  return w + l
})

const calculatedWinRate = computed(() => {
  if (!analyticsData.value) return 'No results yet'
  const w = Number(analyticsData.value.wins) || 0
  const l = Number(analyticsData.value.losses) || 0
  const total = w + l
  if (total === 0) return 'No results yet'
  return `${Math.round((w / total) * 100)}%`
})

const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

const formatSessionDate = (isoString) => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format error rate percentage (Condition 1: Category breakdown as Error rate, null as No data yet)
const formatErrorRate = (rate) => {
  if (rate === null || rate === undefined) return 'No data yet'
  if (typeof rate === 'number') {
    return `${Math.round(rate * 100)}%`
  }
  return String(rate)
}

// ==========================================
// 3. Session Telemetry Modal State
// ==========================================
const isSessionModalOpen = ref(false)
const selectedSession = ref(null)
const sessionTelemetry = ref(null)
const isSessionLoading = ref(false)
const sessionErrorMessage = ref('')

const openSession = async (sessionItem) => {
  if (!sessionItem?.session_id) return
  const reqId = ++sessionRequestId
  selectedSession.value = sessionItem
  isSessionModalOpen.value = true
  isSessionLoading.value = true
  sessionErrorMessage.value = ''
  sessionTelemetry.value = null

  // Reflect session ID in URL query without wiping existing query params
  router.push({
    query: { ...route.query, session: sessionItem.session_id },
  })

  try {
    const data = await fetchSessionAnalytics(sessionItem.session_id)
    if (reqId !== sessionRequestId) return

    // Requirement 4: Require returned session profile_id to match the page student.
    // Missing or mismatched profile_id must not display session details.
    if (!data?.profile_id || String(data.profile_id) !== profileId.value) {
      sessionErrorMessage.value = 'Session details do not belong to this student.'
      sessionTelemetry.value = null
      return
    }

    sessionTelemetry.value = data
  } catch (err) {
    if (reqId !== sessionRequestId) return
    sessionErrorMessage.value =
      err?.response?.data?.detail ||
      'Failed to load session details. Please try again.'
  } finally {
    if (reqId === sessionRequestId) {
      isSessionLoading.value = false
    }
  }
}

const closeSessionModal = () => {
  sessionRequestId++
  isSessionModalOpen.value = false
  selectedSession.value = null
  sessionTelemetry.value = null
  sessionErrorMessage.value = ''

  // Clean session query parameter from URL
  const nextQuery = { ...route.query }
  delete nextQuery.session
  router.push({ query: nextQuery })
}

// Watch direct session query on URL
watch(
  () => route.query.session,
  (sessionId) => {
    if (sessionId) {
      if (!selectedSession.value || selectedSession.value.session_id !== sessionId) {
        openSession({ session_id: String(sessionId) })
      }
    } else {
      // Removing ?session= through Back/Forward must also invalidate pending session requests
      sessionRequestId++
      isSessionModalOpen.value = false
      selectedSession.value = null
      sessionTelemetry.value = null
      isSessionLoading.value = false
      sessionErrorMessage.value = ''
    }
  },
)

// Watch profileId or codeId changes to refresh data
watch([codeId, profileId], ([newCode, newProfile], [oldCode]) => {
  if (newCode && newCode !== oldCode) {
    syncClassroomMetadata()
  }

  // Immediately invalidate pending requests
  identityRequestId++
  analyticsRequestId++
  sessionRequestId++

  // Immediately clear old student identity
  studentIdentity.value = {
    username: '',
    map_progress: null,
    last_synced_at: null,
  }
  identityStatus.value = 'loading'
  identityError.value = ''

  // Immediately clear analytics state
  analyticsData.value = null
  isAnalyticsLoading.value = true
  analyticsError.value = ''

  // Immediately clear session state
  isSessionModalOpen.value = false
  selectedSession.value = null
  sessionTelemetry.value = null
  isSessionLoading.value = false
  sessionErrorMessage.value = ''

  if (newCode && newProfile) {
    resolveStudentIdentity()
    loadPlayerAnalytics()

    // Handle any session query for the new context safely
    if (route.query.session) {
      openSession({ session_id: String(route.query.session) })
    }
  }
})

onMounted(() => {
  syncClassroomMetadata()
  resolveStudentIdentity()
  loadPlayerAnalytics()

  if (route.query.session) {
    openSession({ session_id: String(route.query.session) })
  }
})

onUnmounted(() => {
  identityRequestId++
  analyticsRequestId++
  sessionRequestId++
})
</script>

<template>
  <div class="student-progress-view">
    <ClassroomWorkspaceHeader
      :code-id="codeId"
      active-tab="students"
      :originating-roster-page="originatingRosterPage"
    />

    <main class="page-body">
      <!-- Return Navigation Link -->
      <div class="breadcrumb-container">
        <router-link :to="returnDestination" class="return-nav-link back-link">
          {{ returnDestination.label }}
        </router-link>
      </div>

      <!-- Identity Context Header -->
      <section class="identity-card" aria-label="Student overview">
        <div class="identity-header">
          <div class="identity-avatar" aria-hidden="true">
            {{ displayName.charAt(0).toUpperCase() }}
          </div>
          <div class="identity-text">
            <h2 class="student-title">{{ displayName }}</h2>
            <div class="identity-meta-row">
              <span class="meta-item">
                <AppIcon name="gameplay" :size="14" class="meta-icon" />
                Map progress: <strong>{{ formatMapProgress(studentIdentity.map_progress) }}</strong>
              </span>
              <span class="meta-divider">•</span>
              <span class="meta-item">
                <AppIcon name="clock" :size="14" class="meta-icon" />
                Last synced: <strong>{{ formatLastSynced(studentIdentity.last_synced_at) }}</strong>
              </span>
            </div>
          </div>
        </div>

        <!-- Identity Search Notes (Condition 2: Distinguish lookup failure, no match, limit reached) -->
        <div v-if="identityStatus === 'no_match'" class="identity-note note-info" role="status">
          <AppIcon name="alert" :size="14" />
          <span>Student was not found in this classroom's active roster.</span>
        </div>
        <div v-else-if="identityStatus === 'limit_reached'" class="identity-note note-warning" role="status">
          <AppIcon name="alert" :size="14" />
          <span>Roster search limit reached. Student details could not be verified from checked pages.</span>
        </div>
        <div v-else-if="identityStatus === 'error'" class="identity-note note-error" role="alert">
          <AppIcon name="alert" :size="14" />
          <span>{{ identityError }}</span>
          <button type="button" class="btn-retry-sm" @click="resolveStudentIdentity">
            Retry roster search
          </button>
        </div>
      </section>

      <!-- Analytics Loading State -->
      <div v-if="isAnalyticsLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading student progress...</p>
      </div>

      <!-- Analytics Error State -->
      <div v-else-if="analyticsError" class="error-banner" role="alert">
        <span>{{ analyticsError }}</span>
        <button type="button" class="btn-retry" @click="loadPlayerAnalytics">
          Try again
        </button>
      </div>

      <!-- Analytics Content -->
      <div v-else-if="analyticsData" class="analytics-content">
        <!-- 1. Documented Performance Summary -->
        <section class="section-card summary-section" aria-label="Performance summary">
          <div class="section-header">
            <h3>Student progress</h3>
            <span class="section-hint">Performance overview across completed simulations</span>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Win rate</span>
              <span class="kpi-value win-rate">{{ calculatedWinRate }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Wins</span>
              <span class="kpi-value win-count">{{ analyticsData.wins }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Losses</span>
              <span class="kpi-value loss-count">{{ analyticsData.losses }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Total completed sessions</span>
              <span class="kpi-value">{{ totalGamesPlayed }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Average duration</span>
              <span class="kpi-value">{{ formatDuration(analyticsData.avg_duration_seconds) }}</span>
            </div>
          </div>

          <!-- Best Score by Map (Documented canonical maps) -->
          <div class="map-scores-container">
            <h4 class="subheading">Best score by map</h4>
            <div class="map-pills-row">
              <div
                v-for="m in CANONICAL_MAPS"
                :key="m.name"
                class="map-score-pill"
              >
                <span class="map-pill-name">{{ m.name }}:</span>
                <span
                  v-if="analyticsData.best_score_by_map?.[m.name] !== undefined"
                  class="map-pill-value"
                >
                  {{ Math.round(analyticsData.best_score_by_map[m.name]) }} pts
                </span>
                <span v-else class="map-pill-unplayed">
                  Not played yet
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. Types of Threats & Error Rates (Condition 1) -->
        <section class="section-card" aria-label="Types of threats">
          <div class="section-header">
            <h3>Types of threats</h3>
            <span class="section-hint">Vulnerability evaluation across simulated threat encounters</span>
          </div>

          <div class="table-container">
            <table class="data-table threats-table">
              <thead>
                <tr>
                  <th>Type of threat</th>
                  <th class="text-right">Error rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="threat in CANONICAL_THREATS" :key="threat.name">
                  <td class="threat-name-cell">
                    {{ threat.name }}
                  </td>
                  <td class="text-right">
                    <span
                      class="error-rate-badge"
                      :class="{ 'no-data': analyticsData.category_breakdown?.[threat.name] === null }"
                    >
                      {{ formatErrorRate(analyticsData.category_breakdown?.[threat.name]) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 3. Recent Sessions Table (Condition 4) -->
        <section class="section-card" aria-label="Recent sessions">
          <div class="section-header">
            <h3>Recent sessions</h3>
            <span class="section-hint">Recent gameplay sessions (up to 10 records)</span>
          </div>

          <div
            v-if="analyticsData.recent_sessions && analyticsData.recent_sessions.length > 0"
            class="table-container"
          >
            <table class="data-table sessions-table">
              <thead>
                <tr>
                  <th>Map</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                  <th>Date</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in analyticsData.recent_sessions" :key="s.session_id">
                  <td class="map-cell">
                    {{ s.map_name }}
                  </td>
                  <td>
                    <span :class="['result-pill', s.result]">
                      {{ s.result?.toUpperCase() }}
                    </span>
                  </td>
                  <td>{{ formatDuration(s.duration_seconds) }}</td>
                  <td class="date-cell">{{ formatSessionDate(s.played_at) }}</td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="btn-inspect"
                      @click="openSession(s)"
                    >
                      View session details
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty-sessions">
            <p>No recent sessions recorded for this student.</p>
          </div>
        </section>
      </div>
    </main>

    <!-- Session Telemetry Modal (Reused Component) -->
    <SessionTelemetryModal
      :is-open="isSessionModalOpen"
      :session="selectedSession"
      :session-telemetry="sessionTelemetry"
      :is-loading="isSessionLoading"
      :error-message="sessionErrorMessage"
      :student="{ username: displayName, profile_id: profileId }"
      fallback-focus-selector=".student-title"
      @close="closeSessionModal"
      @back-to-student="closeSessionModal"
    />
  </div>
</template>

<style scoped>
.student-progress-view {
  width: 100%;
}

.page-body {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.breadcrumb-container {
  display: flex;
  align-items: center;
}

.back-link {
  color: var(--color-primary, #7c3aed);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;
  transition: opacity 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

/* Identity Card */
.identity-card {
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.identity-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.identity-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-primary-bg, #f5f3ff);
  color: var(--color-primary, #7c3aed);
  font-weight: 700;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e2e8f0);
}

.identity-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.student-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
}

.identity-meta-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-text-muted, #475569);
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-divider {
  color: var(--color-border, #cbd5e1);
}

.identity-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
}

.note-info {
  background-color: var(--color-bg-subtle, #f1f5f9);
  color: var(--color-text-muted, #475569);
  border: 1px solid var(--color-border, #e2e8f0);
}

.note-warning {
  background-color: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.note-error {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
}

.btn-retry-sm {
  background: none;
  border: 1px solid currentColor;
  color: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: auto;
}

/* Sections & Cards */
.analytics-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-card {
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
}

.section-hint {
  font-size: 0.82rem;
  color: var(--color-text-muted, #475569);
}

.subheading {
  margin: 0.5rem 0 0.5rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-main, #0f172a);
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.75rem;
}

.kpi-card {
  background-color: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted, #475569);
}

.kpi-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
}

.kpi-value.win-rate {
  color: var(--color-primary, #7c3aed);
}

.kpi-value.win-count {
  color: var(--color-success, #16a34a);
}

.kpi-value.loss-count {
  color: var(--color-danger, #dc2626);
}

/* Map Scores */
.map-scores-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-subtle, #f1f5f9);
}

.map-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.map-score-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.82rem;
}

.map-pill-name {
  font-weight: 600;
  color: var(--color-text-main, #0f172a);
}

.map-pill-value {
  font-weight: 700;
  color: var(--color-primary, #7c3aed);
}

.map-pill-unplayed {
  color: var(--color-text-dim, #94a3b8);
  font-style: italic;
}

/* Tables */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.data-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted, #475569);
  border-bottom: 2px solid var(--color-border, #e2e8f0);
  background-color: var(--color-bg-subtle, #f8fafc);
}

.data-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  color: var(--color-text-main, #0f172a);
}

.text-right {
  text-align: right;
}

.threat-name-cell {
  font-weight: 500;
}

.error-rate-badge {
  font-weight: 600;
  color: var(--color-danger, #dc2626);
}

.error-rate-badge.no-data {
  color: var(--color-text-dim, #94a3b8);
  font-weight: normal;
  font-style: italic;
}

.map-cell {
  font-weight: 600;
}

.date-cell {
  color: var(--color-text-muted, #475569);
  font-size: 0.82rem;
}

/* Result Pills */
.result-pill {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 4px;
  line-height: 1;
  text-transform: uppercase;
}

.result-pill.win {
  background-color: #dcfce7;
  color: #15803d;
}

.result-pill.lose {
  background-color: #fee2e2;
  color: #b91c1c;
}

.result-pill.timeout {
  background-color: #fef3c7;
  color: #b45309;
}

.btn-inspect {
  background-color: transparent;
  color: var(--color-primary, #7c3aed);
  border: 1px solid var(--color-primary, #7c3aed);
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-inspect:hover {
  background-color: var(--color-primary, #7c3aed);
  color: #ffffff;
}

.empty-sessions {
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-muted, #475569);
  font-style: italic;
}

/* Loading & Error States */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
  color: var(--color-text-muted, #475569);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e2e8f0);
  border-top-color: var(--color-primary, #7c3aed);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  background-color: var(--color-danger-bg, #fef2f2);
  border: 1px solid var(--color-danger-border, #fecaca);
  color: var(--color-danger, #dc2626);
  padding: 0.85rem 1rem;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.btn-retry {
  background-color: #ffffff;
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

.btn-retry:hover {
  background-color: #fee2e2;
}
</style>
