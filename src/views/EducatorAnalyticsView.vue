<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMyClassrooms, fetchClassroomStudents } from '../api/classroom'
import {
  fetchClassroomAnalytics,
  fetchPlayerAnalytics,
  fetchSessionAnalytics,
} from '../api/analytics'
import ThreatPerformanceGauge from '../components/analytics/ThreatPerformanceGauge.vue'
import StudentProficiencyModal from '../components/analytics/StudentProficiencyModal.vue'
import SessionTelemetryModal from '../components/analytics/SessionTelemetryModal.vue'

const route = useRoute()
const router = useRouter()

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

// Request ID guards for concurrency / race conditions
let classroomRequestId = 0
let studentRequestId = 0
let sessionRequestId = 0

// ==========================================
// Level 1: Classroom Aggregate State
// ==========================================
const classrooms = ref([])
const selectedClassroomId = ref(route.params.code_id || '')
const classroomAnalytics = ref(null)
const students = ref([])
const isClassroomsLoading = ref(true)
const isAnalyticsLoading = ref(false)
const isStudentsLoading = ref(false)
const aggregateErrorMessage = ref('')
const rosterErrorMessage = ref('')

// Analytics Table Pagination
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

// ==========================================
// Level 2: Student Proficiency Modal State
// ==========================================
const selectedStudent = ref(null)
const studentAnalytics = ref(null)
const isStudentModalOpen = ref(false)
const isStudentLoading = ref(false)
const studentErrorMessage = ref('')

// ==========================================
// Level 3: Session Telemetry Modal State
// ==========================================
const selectedSession = ref(null)
const sessionTelemetry = ref(null)
const isSessionModalOpen = ref(false)
const isSessionLoading = ref(false)
const sessionErrorMessage = ref('')

// Selected Classroom Object
const currentClassroom = computed(() => {
  return (
    classrooms.value.find(
      (c) =>
        (c.code_id && c.code_id === selectedClassroomId.value) ||
        (c.id && c.id === selectedClassroomId.value) ||
        (c.code_value && c.code_value === selectedClassroomId.value) ||
        (c.code && c.code === selectedClassroomId.value),
    ) ||
    classrooms.value[0] ||
    null
  )
})

// Load All Classrooms for the Instructor
const loadClassrooms = async () => {
  isClassroomsLoading.value = true
  aggregateErrorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    const list = Array.isArray(data) ? data : data.classrooms || []
    classrooms.value = list

    if (list.length > 0) {
      if (!selectedClassroomId.value) {
        selectedClassroomId.value =
          list[0].code_id || list[0].id || list[0].code_value || list[0].code
      }
      await loadClassroomData(selectedClassroomId.value, tablePage.value)
    }
  } catch {
    aggregateErrorMessage.value = 'Failed to load classroom list. Please verify your connection.'
  } finally {
    isClassroomsLoading.value = false
  }
}

// Load Aggregate Analytics & Student Roster for a Classroom
const loadClassroomData = async (codeId, targetTablePage = tablePage.value) => {
  if (!codeId) return
  const reqId = ++classroomRequestId

  isAnalyticsLoading.value = true
  isStudentsLoading.value = true
  aggregateErrorMessage.value = ''
  rosterErrorMessage.value = ''

  try {
    const [analyticsResult, rosterResult] = await Promise.allSettled([
      fetchClassroomAnalytics(codeId),
      fetchClassroomStudents(codeId, {
        page: targetTablePage,
        page_size: tablePageSize.value,
      }),
    ])

    if (reqId !== classroomRequestId) return // stale response check

    if (analyticsResult.status === 'fulfilled') {
      classroomAnalytics.value = analyticsResult.value
    } else {
      classroomAnalytics.value = null
      aggregateErrorMessage.value = 'Could not load classroom summary.'
    }

    if (rosterResult.status === 'fulfilled') {
      const r = rosterResult.value
      if (Array.isArray(r)) {
        students.value = r
        tableTotalCount.value = r.length
        tablePage.value = 1
      } else if (r && typeof r === 'object') {
        students.value = r.items || r.students || []
        tableTotalCount.value = r.total_count ?? r.total ?? students.value.length
        tablePage.value = r.page ?? targetTablePage
        tablePageSize.value = r.page_size ?? tablePageSize.value
      } else {
        students.value = []
        tableTotalCount.value = 0
      }

      // If a student modal is currently open with unknown username, resolve it from roster
      if (selectedStudent.value && !selectedStudent.value.username) {
        const matched = students.value.find(
          (s) => String(s.profile_id) === String(selectedStudent.value.profile_id),
        )
        if (matched && matched.username) {
          selectedStudent.value = {
            ...selectedStudent.value,
            username: matched.username,
          }
        }
      }
    } else {
      students.value = []
      tableTotalCount.value = 0
      rosterErrorMessage.value = 'Could not load student roster.'
    }
  } catch {
    if (reqId === classroomRequestId) {
      aggregateErrorMessage.value = 'Could not load classroom data.'
    }
  } finally {
    if (reqId === classroomRequestId) {
      isAnalyticsLoading.value = false
      isStudentsLoading.value = false
    }
  }
}

const goToTablePage = (targetPage) => {
  if (targetPage >= 1 && targetPage <= tableTotalPages.value && !isStudentsLoading.value) {
    tablePage.value = targetPage
    router.push({
      path: route.path,
      query: { ...route.query, table_page: targetPage },
    })
    loadClassroomData(selectedClassroomId.value, targetPage)
  }
}

// Watch table_page from query (supports browser Back/Forward)
watch(
  () => route.query.table_page,
  (newPageQuery) => {
    const parsed = parseQueryInt(newPageQuery, 1)
    if (parsed !== tablePage.value) {
      tablePage.value = parsed
      if (selectedClassroomId.value) {
        loadClassroomData(selectedClassroomId.value, parsed)
      }
    }
  },
)

// Watch Classroom Route Param Change (supports browser Back/Forward between classrooms)
watch(
  () => route.params.code_id,
  (newCodeParam) => {
    if (newCodeParam && newCodeParam !== selectedClassroomId.value) {
      selectedClassroomId.value = newCodeParam
    }
  },
)

// Watch Classroom Selection Dropdown Change
watch(selectedClassroomId, (newCode, oldCode) => {
  if (newCode && newCode !== oldCode) {
    // Invalidate pending requests
    classroomRequestId++
    studentRequestId++
    sessionRequestId++

    // Dismiss open dialogs and clear student/session state to prevent incompatible selection
    isStudentModalOpen.value = false
    selectedStudent.value = null
    studentAnalytics.value = null
    isStudentLoading.value = false
    studentErrorMessage.value = ''

    isSessionModalOpen.value = false
    selectedSession.value = null
    sessionTelemetry.value = null
    isSessionLoading.value = false
    sessionErrorMessage.value = ''

    // Distinguish new classroom selection from history restoration
    const isHistoryRestoration = route.params.code_id === newCode
    const targetPage = isHistoryRestoration ? parseQueryInt(route.query.table_page, 1) : 1
    tablePage.value = targetPage

    // Clear incompatible student query param while preserving originating roster page
    const nextQuery = { ...route.query }
    delete nextQuery.student

    if (!isHistoryRestoration) {
      delete nextQuery.table_page
      if (route.params.code_id !== newCode) {
        router.push({
          path: `/analytics/${newCode}`,
          query: nextQuery,
        })
      }
    }
    loadClassroomData(newCode, targetPage)
  }
})

// ==========================================
// Level 2: Student Analytics Deep Links & Modal
// ==========================================
const openStudentAnalyticsByProfileId = async (profileId, initialStudentData = null) => {
  if (!profileId) return
  const reqId = ++studentRequestId

  isStudentModalOpen.value = true
  isStudentLoading.value = true
  studentErrorMessage.value = ''
  studentAnalytics.value = null

  // Resolve username from documented roster data if available; do not fabricate
  const matchedInRoster = students.value.find(
    (s) => String(s.profile_id) === String(profileId),
  )
  selectedStudent.value =
    initialStudentData || matchedInRoster || { profile_id: profileId, username: null }

  try {
    const data = await fetchPlayerAnalytics(profileId)
    if (reqId !== studentRequestId) return // stale response check
    studentAnalytics.value = data
  } catch {
    if (reqId !== studentRequestId) return
    studentErrorMessage.value = 'Could not retrieve student performance breakdown.'
  } finally {
    if (reqId === studentRequestId) {
      isStudentLoading.value = false
    }
  }
}

const openStudentAnalytics = (student) => {
  router.push({
    path: route.path,
    query: { ...route.query, student: student.profile_id },
  })
  openStudentAnalyticsByProfileId(student.profile_id, student)
}

const closeStudentModal = () => {
  // Invalidate any in-flight student request immediately
  studentRequestId++
  isStudentLoading.value = false
  studentErrorMessage.value = ''
  isStudentModalOpen.value = false
  selectedStudent.value = null
  studentAnalytics.value = null

  // Remove student selection query while preserving table_page and roster_page
  const nextQuery = { ...route.query }
  delete nextQuery.student
  router.push({
    path: route.path,
    query: nextQuery,
  })
}

// Watch deep link student query
watch(
  () => route.query.student,
  (newStudentId) => {
    if (newStudentId && String(newStudentId).trim()) {
      const cleanId = String(newStudentId).trim()
      if (selectedStudent.value?.profile_id !== cleanId || !isStudentModalOpen.value) {
        openStudentAnalyticsByProfileId(cleanId)
      }
    } else if (!newStudentId && isStudentModalOpen.value) {
      studentRequestId++
      isStudentLoading.value = false
      studentErrorMessage.value = ''
      isStudentModalOpen.value = false
      selectedStudent.value = null
      studentAnalytics.value = null
    }
  },
  { immediate: true },
)

// ==========================================
// Level 3: Inspect Session Breakdown
// ==========================================
const openSessionTelemetry = async (session) => {
  const reqId = ++sessionRequestId
  selectedSession.value = session
  isStudentModalOpen.value = false // Hide student modal so dialogs do NOT stack
  isSessionModalOpen.value = true
  isSessionLoading.value = true
  sessionErrorMessage.value = ''
  sessionTelemetry.value = null

  try {
    const data = await fetchSessionAnalytics(session.session_id)
    if (reqId !== sessionRequestId) return // stale response check
    sessionTelemetry.value = data
  } catch {
    if (reqId !== sessionRequestId) return
    sessionErrorMessage.value = 'Could not retrieve session details.'
  } finally {
    if (reqId === sessionRequestId) {
      isSessionLoading.value = false
    }
  }
}

const handleBackToStudentFromSession = () => {
  sessionRequestId++
  isSessionLoading.value = false
  sessionErrorMessage.value = ''
  isSessionModalOpen.value = false
  selectedSession.value = null
  sessionTelemetry.value = null
  isStudentModalOpen.value = true // Restore student context without stacking
}

// Helpers: Formatting
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

onMounted(() => {
  loadClassrooms()
})

onUnmounted(() => {
  classroomRequestId++
  studentRequestId++
  sessionRequestId++
})
</script>

<template>
  <div class="analytics-suite">
    <!-- Header Section -->
    <header class="suite-header">
      <div>
        <router-link
          :to="{
            path: `/classroom/students/${selectedClassroomId}`,
            query: { page: originatingRosterPage }
          }"
          class="back-link"
        >
          ◀ Return to classroom roster
        </router-link>
        <h2 class="title">Classroom analytics</h2>
        <p class="subtitle">
          Review overall classroom performance, common mistake areas, and student progress
        </p>
      </div>

      <!-- Classroom Selector -->
      <div v-if="classrooms.length > 0" class="classroom-picker">
        <label for="classroomSelect" class="picker-label">Classroom:</label>
        <select
          id="classroomSelect"
          v-model="selectedClassroomId"
          class="custom-select"
        >
          <option
            v-for="c in classrooms"
            :key="c.code_id || c.id || c.code_value || c.code"
            :value="c.code_id || c.id || c.code_value || c.code"
          >
            {{ c.name }} (Code: {{ c.code_value || c.code }})
          </option>
        </select>
      </div>
    </header>

    <!-- Error Banner for Aggregate Metrics -->
    <div v-if="aggregateErrorMessage" class="error-banner" role="alert">
      <span>{{ aggregateErrorMessage }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="isAnalyticsLoading"
        @click="loadClassroomData(selectedClassroomId, tablePage)"
      >
        Try again
      </button>
    </div>

    <!-- Main Loading State -->
    <div v-if="isClassroomsLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading classroom analytics...</p>
    </div>

    <!-- Empty Classrooms State -->
    <div v-else-if="classrooms.length === 0" class="empty-state">
      <h3>No classrooms created yet</h3>
      <p>Create a classroom to enroll students and review classroom analytics.</p>
      <router-link to="/classroom/manage" class="btn-primary">
        + Create classroom
      </router-link>
    </div>

    <!-- Active Analytics Content -->
    <div v-else class="analytics-content">
      <!-- LEVEL 1: CLASSROOM AGGREGATE SUMMARY -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Classroom performance overview</h3>
            <span v-if="currentClassroom" class="meta-tag">
              Classroom: {{ currentClassroom.name }} [Code: {{ currentClassroom.code_value || currentClassroom.code }}]
            </span>
          </div>
          <button
            class="refresh-btn"
            :disabled="isAnalyticsLoading"
            @click="loadClassroomData(selectedClassroomId, tablePage)"
          >
            {{ isAnalyticsLoading ? 'Refreshing...' : 'Refresh data' }}
          </button>
        </div>

        <!-- If aggregate analytics failed, show truthful unavailable state -->
        <div v-if="aggregateErrorMessage || (!classroomAnalytics && !isAnalyticsLoading)" class="overview-unavailable-card" role="alert">
          <p class="unavailable-message">Classroom performance overview is currently unavailable.</p>
          <button
            type="button"
            class="btn-retry"
            :disabled="isAnalyticsLoading"
            @click="loadClassroomData(selectedClassroomId, tablePage)"
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

        <div v-if="rosterErrorMessage" class="error-banner" role="alert">
          <span>{{ rosterErrorMessage }}</span>
          <button
            type="button"
            class="btn-retry"
            :disabled="isStudentsLoading"
            @click="loadClassroomData(selectedClassroomId, tablePage)"
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
                <th class="text-right">Student analytics</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.profile_id">
                <td class="agent-cell">
                  <span class="agent-avatar">{{ student.username?.charAt(0).toUpperCase() || 'S' }}</span>
                  <div>
                    <span class="agent-name">{{ student.username }}</span>
                    <span class="agent-id">ID: {{ student.profile_id }}</span>
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
          <strong>{{ currentClassroom?.code_value || currentClassroom?.code }}</strong> with students to start tracking progress.
        </div>
      </section>
    </div>

    <!-- LEVEL 2 MODAL: STUDENT PROFICIENCY DRILL-DOWN -->
    <StudentProficiencyModal
      :is-open="isStudentModalOpen"
      :student="selectedStudent"
      :student-analytics="studentAnalytics"
      :is-loading="isStudentLoading"
      :error-message="studentErrorMessage"
      :canonical-maps="CANONICAL_MAPS"
      :canonical-threats="CANONICAL_THREATS"
      @close="closeStudentModal"
      @inspect-session="openSessionTelemetry"
    />

    <!-- LEVEL 3 MODAL: SESSION DETAILS (NON-STACKING, DIRECT RETURN TO STUDENT) -->
    <SessionTelemetryModal
      :is-open="isSessionModalOpen"
      :session="selectedSession"
      :session-telemetry="sessionTelemetry"
      :is-loading="isSessionLoading"
      :error-message="sessionErrorMessage"
      :student="selectedStudent"
      @close="handleBackToStudentFromSession"
      @back-to-student="handleBackToStudentFromSession"
    />
  </div>
</template>

<style scoped>
.analytics-suite {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  width: 100%;
}

/* Header */
.suite-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding-bottom: 0.5rem;
}

.back-link {
  display: inline-block;
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.classroom-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.picker-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.custom-select {
  padding: 0.6rem 1.1rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-purple-sm);
  outline: none;
  transition: border-color 0.2s;
}

.custom-select:focus {
  border-color: var(--color-primary);
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

.kpi-icon {
  font-size: 2rem;
  flex-shrink: 0;
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

.empty-icon {
  font-size: 2.75rem;
  margin-bottom: 0.5rem;
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
