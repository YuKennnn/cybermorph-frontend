<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
const errorMessage = ref('')

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
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    // Support both array and object { classrooms: [...] } shapes
    const list = Array.isArray(data) ? data : data.classrooms || []
    classrooms.value = list

    if (list.length > 0) {
      if (!selectedClassroomId.value) {
        selectedClassroomId.value =
          list[0].code_id || list[0].id || list[0].code_value || list[0].code
      }
      await loadClassroomData(selectedClassroomId.value)
    }
  } catch {
    errorMessage.value = 'Failed to load classroom deployments. Please verify your connection.'
  } finally {
    isClassroomsLoading.value = false
  }
}

// Load Aggregate Analytics & Student Roster for a Classroom
const loadClassroomData = async (codeId) => {
  if (!codeId) return
  isAnalyticsLoading.value = true
  isStudentsLoading.value = true
  errorMessage.value = ''

  try {
    const [analyticsData, rosterData] = await Promise.allSettled([
      fetchClassroomAnalytics(codeId),
      fetchClassroomStudents(codeId),
    ])

    if (analyticsData.status === 'fulfilled') {
      classroomAnalytics.value = analyticsData.value
    } else {
      console.warn('Classroom analytics fetch warning:', analyticsData.reason)
      classroomAnalytics.value = null
    }

    if (rosterData.status === 'fulfilled') {
      const r = rosterData.value
      students.value = Array.isArray(r) ? r : r.students || r.items || []
    } else {
      console.warn('Student roster fetch warning:', rosterData.reason)
      students.value = []
    }
  } catch (err) {
    console.error('Failed to load classroom analytics:', err)
    errorMessage.value = 'Could not load classroom telemetry summary.'
  } finally {
    isAnalyticsLoading.value = false
    isStudentsLoading.value = false
  }
}

// Watch Classroom Selection Change
watch(selectedClassroomId, (newCode) => {
  if (newCode) {
    router.replace({ path: `/analytics/${newCode}` })
    loadClassroomData(newCode)
  }
})

// ==========================================
// Level 2: Inspect Individual Student
// ==========================================
const openStudentAnalytics = async (student) => {
  selectedStudent.value = student
  isStudentModalOpen.value = true
  isStudentLoading.value = true
  studentErrorMessage.value = ''
  studentAnalytics.value = null

  try {
    const data = await fetchPlayerAnalytics(student.profile_id)
    studentAnalytics.value = data
  } catch (err) {
    console.error('Failed to load student analytics:', err)
    studentErrorMessage.value = 'Could not retrieve student telemetry breakdown.'
  } finally {
    isStudentLoading.value = false
  }
}

const closeStudentModal = () => {
  isStudentModalOpen.value = false
  selectedStudent.value = null
  studentAnalytics.value = null
}

// ==========================================
// Level 3: Inspect Session Attack Telemetry
// ==========================================
const openSessionTelemetry = async (session) => {
  selectedSession.value = session
  isSessionModalOpen.value = true
  isSessionLoading.value = true
  sessionErrorMessage.value = ''
  sessionTelemetry.value = null

  try {
    const data = await fetchSessionAnalytics(session.session_id)
    sessionTelemetry.value = data
  } catch (err) {
    console.error('Failed to load session telemetry:', err)
    sessionErrorMessage.value = 'Could not retrieve session attack telemetry.'
  } finally {
    isSessionLoading.value = false
  }
}

const closeSessionModal = () => {
  isSessionModalOpen.value = false
  selectedSession.value = null
  sessionTelemetry.value = null
}

// Helper: Format Date
const formatDate = (isoString) => {
  if (!isoString) return 'Not synced yet'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return 'Not synced yet'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  loadClassrooms()
})
</script>

<template>
  <div class="analytics-suite">
    <!-- Header Section -->
    <header class="suite-header">
      <div>
        <h2 class="title">Threat Telemetry & Security Analytics</h2>
        <p class="subtitle">
          Real-time classroom proficiency, threat defense failure rates, and student session attack logs
        </p>
      </div>

      <!-- Classroom Selector -->
      <div v-if="classrooms.length > 0" class="classroom-picker">
        <label for="classroomSelect" class="picker-label">Active Classroom:</label>
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

    <!-- Error Banner -->
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- Main Loading State -->
    <div v-if="isClassroomsLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Synchronizing classroom telemetry data...</p>
    </div>

    <!-- Empty Classrooms State -->
    <div v-else-if="classrooms.length === 0" class="empty-state">
      <h3>No Classrooms Deployed Yet</h3>
      <p>Create a classroom sector to enroll students and unlock automated threat telemetry insights.</p>
      <router-link to="/classroom/manage" class="btn-primary">
        + Create First Classroom
      </router-link>
    </div>

    <!-- Active Analytics Content -->
    <div v-else class="analytics-content">
      <!-- LEVEL 1: CLASSROOM AGGREGATE SUMMARY -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Classroom Performance Overview</h3>
            <span v-if="currentClassroom" class="meta-tag">
              Sector: {{ currentClassroom.name }} [{{ currentClassroom.code }}]
            </span>
          </div>
          <button
            class="refresh-btn"
            :disabled="isAnalyticsLoading"
            @click="loadClassroomData(selectedClassroomId)"
          >
            {{ isAnalyticsLoading ? 'Refreshing...' : 'Refresh Telemetry' }}
          </button>
        </div>

        <!-- KPI Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-value">{{ classroomAnalytics?.student_count ?? students.length }}</span>
              <span class="kpi-label">Enrolled Agents</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-value">
                {{
                  classroomAnalytics?.avg_map_progress !== undefined
                    ? `Level ${classroomAnalytics.avg_map_progress.toFixed(1)}`
                    : '1.0'
                }}
              </span>
              <span class="kpi-label">Average Map Progress</span>
            </div>
          </div>

          <div class="kpi-card map-scores-card">
            <div class="kpi-content">
              <span class="kpi-label-title">Average Best Score by Map</span>
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
            <h4>DICT 8 Threat Defense Vulnerability Index</h4>
            <span class="matrix-hint">
              Fail rate evaluates player response error frequency during simulated defense encounters
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
      </section>

      <!-- LEVEL 2: ENROLLED AGENT ROSTER & DRILL-DOWN -->
      <section class="section-card student-progress-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Student progress</h3>
            <p class="section-desc">View each student’s progress and performance.</p>
          </div>
        </div>

        <div v-if="isStudentsLoading" class="loading-state-sm">
          <div class="spinner-sm"></div>
          <p>Loading agent telemetry...</p>
        </div>

        <div v-else-if="students.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Map progress</th>
                <th scope="col">Last synced</th>
                <th scope="col" class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.profile_id">
                <td class="student-cell">
                  <span class="student-avatar" aria-hidden="true">
                    {{ student.username?.charAt(0).toUpperCase() || 'A' }}
                  </span>
                  <span class="student-name">{{ student.username }}</span>
                </td>
                <td class="progress-cell">
                  <span class="badge-progression">
                    {{ student.map_progress || 'Map 1: Home Baseline' }}
                  </span>
                </td>
                <td class="date-cell">
                  {{ formatDate(student.last_synced_at) }}
                </td>
                <td class="action-cell text-right">
                  <button
                    class="btn-view-performance"
                    type="button"
                    @click="openStudentAnalytics(student)"
                  >
                    View performance
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-note">
          No students currently enrolled in this sector code. Share code
          <strong>{{ currentClassroom?.code }}</strong> to begin tracking student gameplay.
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

    <!-- LEVEL 3 MODAL: GRANULAR SESSION ATTACK TELEMETRY -->
    <SessionTelemetryModal
      :is-open="isSessionModalOpen"
      :session="selectedSession"
      :session-telemetry="sessionTelemetry"
      :is-loading="isSessionLoading"
      :error-message="sessionErrorMessage"
      :student="selectedStudent"
      @close="closeSessionModal"
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

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 1.75rem;
  letter-spacing: 0.02em;
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
  background-color: #ffffff;
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
  background-color: #ede9fe;
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
  background-color: #ffffff;
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
  color: #ffffff;
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

/* Student Progress Table */
.section-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.table-container {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 8px;
  border: 1px solid var(--color-border-subtle);
}

.data-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.data-table td {
  padding: 0.875rem 1rem;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.875rem;
}

.data-table tbody tr {
  transition: background-color 0.15s ease;
}

.data-table tbody tr:hover {
  background-color: var(--color-bg-subtle);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.student-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #ede9fe;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.student-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.badge-progression {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-main);
  white-space: nowrap;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  white-space: nowrap;
}

.action-cell {
  white-space: nowrap;
}

.text-right {
  text-align: right;
}

.btn-view-performance {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-primary);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-view-performance:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-view-performance:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
