<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchClassroomStudents } from '../api/classroom.js'
import { fetchClassroomAnalytics } from '../api/analytics.js'
import { useClassroomStore } from '../stores/classroomStore.js'
import ClassroomWorkspaceHeader from '../components/classroom/ClassroomWorkspaceHeader.vue'
import ThreatPerformanceGauge from '../components/analytics/ThreatPerformanceGauge.vue'

const route = useRoute()
const router = useRouter()
const classroomStore = useClassroomStore()

// Canonical DICT Threat Categories
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

// Canonical Simulation Maps
const CANONICAL_MAPS = [
  { name: 'Home' },
  { name: 'Office' },
  { name: 'Internet Cafe' },
  { name: 'Public Park' },
]

// Concurrency & stale response request ID guards
let classroomRequestId = 0
let rosterRequestId = 0
let bareRouteSeq = 0
let isComponentMounted = true

const isCurrentBareAnalyticsContext = (seq) => {
  return (
    seq === bareRouteSeq &&
    isComponentMounted &&
    !route.params.code_id &&
    route.path === '/analytics'
  )
}

// ==========================================
// Level 1: Classroom Aggregate State
// ==========================================
const classroomAnalytics = ref(null)
const students = ref([])
const isAnalyticsLoading = ref(false)
const isStudentsLoading = ref(false)
const aggregateErrorMessage = ref('')
const rosterErrorMessage = ref('')
const hasConfirmedRoster = ref(false)

// Table Pagination
const parseQueryInt = (val, fallback = 1) => {
  const p = parseInt(val, 10)
  return !isNaN(p) && p > 0 ? p : fallback
}

const tablePage = ref(parseQueryInt(route.query.table_page, 1))
const tablePageSize = ref(10)
const tableTotalCount = ref(0)

const tableTotalPages = computed(() => {
  if (tableTotalCount.value <= 0) return 1
  return Math.ceil(tableTotalCount.value / tablePageSize.value)
})

const originatingRosterPage = computed(() => {
  return parseQueryInt(route.query.roster_page, 1)
})

// Current Classroom Context
const effectiveCodeId = computed(() => {
  return route.params.code_id ? String(route.params.code_id) : ''
})

// Documented matching: use only code_id. Never use id, code_value, or code as aliases.
const currentClassroom = computed(() => {
  if (!effectiveCodeId.value) return null
  return (
    classroomStore.classrooms.find(
      (c) => String(c.code_id) === String(effectiveCodeId.value),
    ) || null
  )
})

// ==========================================
// Data Fetching Operations
// ==========================================
const loadAggregateAnalytics = async (codeId) => {
  if (!codeId) return
  const reqId = ++classroomRequestId
  isAnalyticsLoading.value = true
  aggregateErrorMessage.value = ''

  try {
    const data = await fetchClassroomAnalytics(codeId)
    if (reqId !== classroomRequestId) return
    classroomAnalytics.value = data
  } catch {
    if (reqId !== classroomRequestId) return
    classroomAnalytics.value = null
    aggregateErrorMessage.value = 'Could not load classroom summary.'
  } finally {
    if (reqId === classroomRequestId) {
      isAnalyticsLoading.value = false
    }
  }
}

const loadStudentRoster = async (codeId, targetPage = tablePage.value) => {
  if (!codeId) return
  const reqId = ++rosterRequestId
  isStudentsLoading.value = true
  rosterErrorMessage.value = ''

  try {
    const r = await fetchClassroomStudents(codeId, {
      page: targetPage,
      page_size: tablePageSize.value,
    })
    if (reqId !== rosterRequestId) return

    if (Array.isArray(r)) {
      students.value = r
      tableTotalCount.value = r.length
      tablePage.value = 1
      hasConfirmedRoster.value = true
    } else if (r && typeof r === 'object') {
      students.value = r.items || r.students || []
      tableTotalCount.value = r.total_count ?? r.total ?? students.value.length
      tablePage.value = r.page ?? targetPage
      tablePageSize.value = r.page_size ?? tablePageSize.value
      hasConfirmedRoster.value = true
    } else {
      students.value = []
      tableTotalCount.value = 0
      hasConfirmedRoster.value = true
    }
  } catch {
    if (reqId !== rosterRequestId) return
    students.value = []
    hasConfirmedRoster.value = false
    rosterErrorMessage.value = 'Could not load student roster.'
  } finally {
    if (reqId === rosterRequestId) {
      isStudentsLoading.value = false
    }
  }
}

const loadClassroomData = (codeId, targetPage = tablePage.value) => {
  return Promise.allSettled([
    loadAggregateAnalytics(codeId),
    loadStudentRoster(codeId, targetPage),
  ])
}

// ==========================================
// Bare /analytics Redirection Handling
// ==========================================
const resolveBareAnalyticsRoute = async () => {
  const currentSeq = ++bareRouteSeq

  if (route.params.code_id) {
    classroomStore.setCurrentClassroomId(route.params.code_id)
    if (!classroomStore.isFetched && !classroomStore.isLoading) {
      classroomStore.fetchClassrooms().catch(() => {})
    }
    return
  }

  // Bare /analytics route: ensure classroom list is fetched
  if (!classroomStore.isFetched) {
    try {
      await classroomStore.fetchClassrooms()
    } catch {
      // List loading failed. classroomStore.error is set.
      // Distinguish list-loading failure from empty list.
      return
    }
  }

  // Guard against obsolete navigation:
  // After awaiting classroom loading, redirect only if this operation
  // is still current and the user is still on bare /analytics.
  if (!isCurrentBareAnalyticsContext(currentSeq)) {
    return
  }

  // Confirmed empty classrooms list
  if (classroomStore.classrooms.length === 0) {
    return
  }

  // Prefer valid classroom already selected in the shared store; otherwise choose the first available classroom
  const selectedId = classroomStore.currentClassroomId
  const hasValidSelection =
    selectedId &&
    classroomStore.classrooms.some((c) => String(c.code_id) === String(selectedId))

  const targetId = hasValidSelection
    ? String(selectedId)
    : String(classroomStore.classrooms[0].code_id)

  classroomStore.setCurrentClassroomId(targetId)

  // Verify context again before replacing route
  if (!isCurrentBareAnalyticsContext(currentSeq)) {
    return
  }

  // Preserve relevant query parameters during redirection
  router.replace({
    path: `/analytics/${targetId}`,
    query: { ...route.query },
  })
}

const retryClassroomList = async () => {
  const currentSeq = ++bareRouteSeq
  try {
    await classroomStore.fetchClassrooms(true)
    if (isCurrentBareAnalyticsContext(currentSeq)) {
      resolveBareAnalyticsRoute()
    }
  } catch {
    // Error is captured in classroomStore.error
  }
}

// ==========================================
// Metadata Retry (Condition 1)
// ==========================================
const handleRetryMetadata = () => {
  // ClassroomWorkspaceHeader already executed classroomStore.fetchClassrooms(true).
  // Do NOT trigger another fetchClassrooms call here.
  // Retry failed analytics or roster requests separately if they were in an error state.
  if (aggregateErrorMessage.value) {
    loadAggregateAnalytics(effectiveCodeId.value)
  }
  if (rosterErrorMessage.value) {
    loadStudentRoster(effectiveCodeId.value, tablePage.value)
  }
}

// ==========================================
// Student Navigation & Pagination
// ==========================================
const openStudentAnalytics = (student) => {
  const codeId = effectiveCodeId.value
  if (!codeId) return
  const query = {
    origin: 'analytics',
    table_page: tablePage.value,
  }
  if (route.query.roster_page) {
    query.roster_page = route.query.roster_page
  }
  router.push({
    path: `/classroom/students/${codeId}/progress/${student.profile_id}`,
    query,
  })
}

const goToTablePage = (targetPage) => {
  if (targetPage >= 1 && targetPage <= tableTotalPages.value && !isStudentsLoading.value) {
    tablePage.value = targetPage
    router.push({
      path: route.path,
      query: { ...route.query, table_page: targetPage },
    })
    loadStudentRoster(effectiveCodeId.value, targetPage)
  }
}

// Formatters
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

// ==========================================
// Watchers
// ==========================================
// Watch table_page from query (supports browser Back/Forward)
watch(
  () => route.query.table_page,
  (newPageQuery) => {
    const parsed = parseQueryInt(newPageQuery, 1)
    if (parsed !== tablePage.value) {
      tablePage.value = parsed
      if (effectiveCodeId.value) {
        loadStudentRoster(effectiveCodeId.value, parsed)
      }
    }
  },
)

// Watch path changes to invalidate obsolete bare /analytics resolution if user leaves
watch(
  () => route.path,
  (newPath) => {
    if (newPath !== '/analytics') {
      bareRouteSeq++
    }
  },
)

// Watch Classroom Route Param Change (supports browser Back/Forward & client-side navigation between classrooms)
watch(
  () => route.params.code_id,
  (newCode, oldCode) => {
    bareRouteSeq++
    if (newCode) {
      if (newCode !== oldCode) {
        // Invalidate in-flight requests from previous classroom
        classroomRequestId++
        rosterRequestId++
        classroomAnalytics.value = null
        students.value = []
        hasConfirmedRoster.value = false
        aggregateErrorMessage.value = ''
        rosterErrorMessage.value = ''

        classroomStore.setCurrentClassroomId(newCode)
        if (!classroomStore.isFetched && !classroomStore.isLoading) {
          classroomStore.fetchClassrooms().catch(() => {})
        }

        const targetPage = parseQueryInt(route.query.table_page, 1)
        tablePage.value = targetPage
        loadClassroomData(newCode, targetPage)
      }
    } else {
      resolveBareAnalyticsRoute()
    }
  },
  { immediate: true },
)

// Watch deep link student query (redirect legacy links to dedicated student progress view)
watch(
  [() => route.query.student, () => effectiveCodeId.value],
  ([newStudentId, codeId]) => {
    if (newStudentId && String(newStudentId).trim() && codeId) {
      // Resolve origin strictly:
      // - Preserve an explicit valid origin.
      // - Otherwise, roster_page means Students, even with table_page.
      // - Otherwise, table_page means Analytics.
      let resolvedOrigin
      if (route.query.origin === 'students' || route.query.origin === 'analytics') {
        resolvedOrigin = route.query.origin
      } else if (route.query.roster_page) {
        resolvedOrigin = 'students'
      } else {
        resolvedOrigin = 'analytics'
      }

      const query = { origin: resolvedOrigin }
      if (route.query.roster_page) {
        query.roster_page = route.query.roster_page
      }
      if (route.query.table_page) {
        query.table_page = route.query.table_page
      } else if (resolvedOrigin === 'analytics' && tablePage.value) {
        query.table_page = tablePage.value
      }
      if (route.query.session) {
        query.session = route.query.session
      }

      router.replace({
        path: `/classroom/students/${codeId}/progress/${String(newStudentId).trim()}`,
        query,
      })
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  isComponentMounted = false
  bareRouteSeq++
  classroomRequestId++
  rosterRequestId++
})
</script>

<template>
  <div class="analytics-suite">
    <!-- Header Section: Shared Classroom Workspace Header -->
    <ClassroomWorkspaceHeader
      v-if="effectiveCodeId"
      :code-id="effectiveCodeId"
      active-tab="analytics"
      :student-count="hasConfirmedRoster && !rosterErrorMessage && !isStudentsLoading ? tableTotalCount : null"
      :is-count-loading="isStudentsLoading"
      :count-error="Boolean(rosterErrorMessage)"
      :originating-roster-page="originatingRosterPage"
      @retry-metadata="handleRetryMetadata"
    />

    <!-- Header fallback when no classroom is selected yet (bare /analytics loading/error) -->
    <header v-else class="bare-header">
      <div class="breadcrumb-bar">
        <router-link to="/classroom/manage" class="back-link">
          ◀ Return to all classrooms
        </router-link>
      </div>
      <h2 class="title">Classroom analytics</h2>
      <p class="subtitle">
        Review overall classroom performance, common mistake areas, and student progress
      </p>
    </header>

    <!-- Error Banner for Bare /analytics List-Loading Failure -->
    <div v-if="classroomStore.error && !effectiveCodeId" class="error-banner" role="alert">
      <span>{{ classroomStore.error }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="classroomStore.isLoading"
        @click="retryClassroomList"
      >
        Try again
      </button>
    </div>

    <!-- Main Loading State for Bare /analytics initial resolution -->
    <div v-else-if="classroomStore.isLoading && !effectiveCodeId" class="loading-state">
      <div class="spinner"></div>
      <p>Loading classroom analytics...</p>
    </div>

    <!-- Empty Classrooms State: Confirmed 0 classrooms -->
    <div v-else-if="classroomStore.isFetched && classroomStore.classrooms.length === 0" class="empty-state">
      <h3>No classrooms created yet</h3>
      <p>Create a classroom to enroll students and review classroom analytics.</p>
      <router-link to="/classroom/manage" class="btn-primary">
        + Create classroom
      </router-link>
    </div>

    <!-- Active Analytics Content -->
    <div v-else-if="effectiveCodeId" class="analytics-content">
      <!-- Error Banner for Aggregate Metrics (separate from metadata and roster) -->
      <div v-if="aggregateErrorMessage" class="error-banner" role="alert">
        <span>{{ aggregateErrorMessage }}</span>
        <button
          type="button"
          class="btn-retry"
          :disabled="isAnalyticsLoading"
          @click="loadAggregateAnalytics(effectiveCodeId)"
        >
          Try again
        </button>
      </div>

      <!-- LEVEL 1: CLASSROOM AGGREGATE SUMMARY -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Classroom performance overview</h3>
            <span v-if="currentClassroom && currentClassroom.code_value" class="meta-tag">
              Classroom: {{ currentClassroom.name }} [Code: {{ currentClassroom.code_value }}]
            </span>
          </div>
          <button
            class="refresh-btn"
            :disabled="isAnalyticsLoading || isStudentsLoading"
            @click="loadClassroomData(effectiveCodeId, tablePage)"
          >
            {{ isAnalyticsLoading || isStudentsLoading ? 'Refreshing...' : 'Refresh data' }}
          </button>
        </div>

        <!-- If aggregate analytics failed, show truthful unavailable state with independent retry -->
        <div
          v-if="aggregateErrorMessage || (!classroomAnalytics && !isAnalyticsLoading)"
          class="overview-unavailable-card"
          role="alert"
        >
          <p class="unavailable-message">Classroom performance overview is currently unavailable.</p>
          <button
            type="button"
            class="btn-retry"
            :disabled="isAnalyticsLoading"
            @click="loadAggregateAnalytics(effectiveCodeId)"
          >
            Try again
          </button>
        </div>

        <template v-else>
          <!-- KPI Grid -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-content">
                <span class="kpi-value">{{ classroomAnalytics?.student_count ?? tableTotalCount }}</span>
                <span class="kpi-label">Enrolled students</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-content">
                <span class="kpi-value">
                  {{
                    classroomAnalytics?.avg_map_progress !== undefined && classroomAnalytics?.avg_map_progress !== null
                      ? `Level ${classroomAnalytics.avg_map_progress.toFixed(1)}`
                      : '—'
                  }}
                </span>
                <span class="kpi-label">Average map progress</span>
              </div>
            </div>

            <div class="kpi-card map-scores-card">
              <div class="kpi-content">
                <span class="kpi-label-title">Average best score by map</span>
                <div class="map-pills-row">
                  <div
                    v-for="m in CANONICAL_MAPS"
                    :key="m.name"
                    class="map-score-pill"
                  >
                    <span class="map-pill-name">{{ m.name }}:</span>
                    <span
                      v-if="classroomAnalytics?.avg_best_score_by_map?.[m.name] !== undefined"
                      class="map-pill-value"
                    >
                      {{ Math.round(classroomAnalytics.avg_best_score_by_map[m.name]) }} pts
                    </span>
                    <span v-else class="map-pill-unplayed">
                      Unplayed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 8 DICT Threat Category Vulnerability Matrix -->
          <div class="threat-matrix-section">
            <div class="matrix-header">
              <h4>Types of threats and error rates</h4>
              <span class="matrix-hint">
                Error rate evaluates common mistakes across simulated encounters
              </span>
            </div>

            <div class="threat-grid">
              <ThreatPerformanceGauge
                v-for="threat in CANONICAL_THREATS"
                :key="threat.name"
                :threat-name="threat.name"
                :fail-rate="classroomAnalytics?.category_fail_rates?.[threat.name]"
              />
            </div>
          </div>
        </template>
      </section>

      <!-- LEVEL 2: ENROLLED STUDENT ROSTER & DRILL-DOWN -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Student progress roster</h3>
            <span class="meta-tag">Select a student to inspect their detailed performance</span>
          </div>
        </div>

        <!-- Roster Error Banner with Independent Retry -->
        <div v-if="rosterErrorMessage" class="error-banner" role="alert">
          <span>{{ rosterErrorMessage }}</span>
          <button
            type="button"
            class="btn-retry"
            :disabled="isStudentsLoading"
            @click="loadStudentRoster(effectiveCodeId, tablePage)"
          >
            Try again
          </button>
        </div>

        <div v-if="isStudentsLoading" class="loading-state-sm">
          <div class="spinner-sm"></div>
          <p>Loading student roster...</p>
        </div>

        <div v-else-if="students.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student name</th>
                <th>Map progress</th>
                <th>Last synced</th>
                <th class="text-right">Student progress</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.profile_id">
                <td class="agent-cell">
                  <span class="agent-avatar">{{ student.username?.charAt(0).toUpperCase() || 'S' }}</span>
                  <div>
                    <span class="agent-name">{{ student.username }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge-progression">
                    {{ formatMapProgress(student.map_progress) }}
                  </span>
                </td>
                <td class="date-cell">
                  {{ formatLastSynced(student.last_synced_at) }}
                </td>
                <td class="text-right">
                  <button
                    class="btn-inspect"
                    @click="openStudentAnalytics(student)"
                  >
                    View analytics
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Table Pagination Controls -->
          <div v-if="tableTotalCount > 0" class="pagination-bar">
            <div class="pagination-info">
              Showing <strong>{{ (tablePage - 1) * tablePageSize + 1 }}</strong> to
              <strong>{{ Math.min(tablePage * tablePageSize, tableTotalCount) }}</strong> of
              <strong>{{ tableTotalCount }}</strong> students
            </div>
            <div class="pagination-actions">
              <button
                class="page-btn"
                :disabled="tablePage <= 1 || isStudentsLoading"
                @click="goToTablePage(tablePage - 1)"
              >
                ◀ Previous
              </button>
              <span class="page-indicator">Page {{ tablePage }} of {{ tableTotalPages }}</span>
              <button
                class="page-btn"
                :disabled="tablePage >= tableTotalPages || isStudentsLoading"
                @click="goToTablePage(tablePage + 1)"
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!rosterErrorMessage" class="empty-note">
          No students currently enrolled in this classroom. Share access code
          <strong>{{ currentClassroom?.code_value || '' }}</strong> with students to start tracking progress.
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.analytics-suite {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  width: 100%;
}

.analytics-content {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  width: 100%;
}

/* Bare Header */
.bare-header {
  padding-bottom: 0.5rem;
}

.breadcrumb-bar {
  margin-bottom: 0.75rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

/* Section Card */
.section-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.75rem;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.overview-unavailable-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
}

.unavailable-message {
  margin: 0;
  font-weight: 500;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: 1rem;
}

.header-titles h3 {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.25rem;
}

.meta-tag {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 600;
}

.refresh-btn {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  padding: 0.5rem 0.95rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.kpi-card.map-scores-card {
  grid-column: 1 / -1;
  align-items: flex-start;
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
}

.kpi-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-label-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}

.map-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  width: 100%;
}

.map-score-pill {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  box-shadow: 0 1px 4px rgba(124, 58, 237, 0.04);
}

.map-pill-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.map-pill-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
}

.map-pill-unplayed {
  font-size: 0.8rem;
  color: var(--color-text-dim);
  font-style: italic;
}

/* Threat Matrix */
.threat-matrix-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.matrix-header h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  color: var(--color-text-main);
}

.matrix-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.threat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

/* Student Roster Table */
.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.data-table th {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  padding: 0.85rem 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

.data-table td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover {
  background-color: var(--color-bg-subtle);
}

.agent-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
}

.agent-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.badge-progression {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.text-right {
  text-align: right;
}

.btn-inspect {
  padding: 0.4rem 0.85rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-inspect:hover {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
}

/* Generic States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-purple);
}

.loading-state-sm {
  text-align: center;
  padding: 2rem 1rem;
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

.spinner-sm {
  width: 24px;
  height: 24px;
  margin: 0 auto 0.5rem auto;
  border: 2.5px solid var(--color-border);
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
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
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

.btn-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-top: 1px solid var(--color-border);
  gap: 1rem;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-primary);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-primary);
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.empty-note {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
  font-size: 0.9rem;
}

.btn-primary {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.65rem 1.35rem;
  background: var(--btn-gradient);
  color: var(--color-card);
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--btn-gradient-hover);
  transform: translateY(-1px);
}
</style>
