<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMyClassrooms, fetchClassroomStudents } from '../api/classroom'
import {
  fetchClassroomAnalytics,
  fetchPlayerAnalytics,
  fetchSessionAnalytics,
} from '../api/analytics'

const route = useRoute()
const router = useRouter()

// Canonical DICT Threat Categories
const CANONICAL_THREATS = [
  { name: 'Phishing', icon: '🎣' },
  { name: 'Smishing', icon: '📱' },
  { name: 'Vishing', icon: '📞' },
  { name: 'Social Engineering', icon: '🧠' },
  { name: 'Credential Theft / Weak Password Attack', icon: '🔑' },
  { name: 'Public Wi-Fi Attack', icon: '📶' },
  { name: 'Malware Infection', icon: '💀' },
  { name: 'Ransomware', icon: '💰' },
]

// Canonical Simulation Maps
const CANONICAL_MAPS = [
  { name: 'Home', icon: '🏠' },
  { name: 'Office', icon: '🏢' },
  { name: 'Internet Cafe', icon: '☕' },
  { name: 'Public Park', icon: '🌳' },
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
      (c) => c.id === selectedClassroomId.value || c.code === selectedClassroomId.value,
    ) || classrooms.value[0] || null
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
        selectedClassroomId.value = list[0].id || list[0].code
      }
      await loadClassroomData(selectedClassroomId.value)
    }
  } catch (err) {
    console.error('Failed to load classrooms:', err)
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

// Helper: Format Durations
const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// Helper: Format Date
const formatDate = (isoString) => {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Helper: Format Fail Rate
const formatFailRate = (rate) => {
  if (rate === null || rate === undefined) return null
  return `${(rate * 100).toFixed(1)}%`
}

// Helper: Risk Level Class
const getRiskLevelClass = (rate) => {
  if (rate === null || rate === undefined) return 'no-data'
  if (rate >= 0.4) return 'risk-high'
  if (rate >= 0.2) return 'risk-moderate'
  return 'risk-low'
}

// Helper: Risk Level Label
const getRiskLabel = (rate) => {
  if (rate === null || rate === undefined) return 'No Data Yet'
  if (rate >= 0.4) return 'High Fail Rate'
  if (rate >= 0.2) return 'Moderate Fail Rate'
  return 'Low Fail Rate'
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
            :key="c.id || c.code"
            :value="c.id || c.code"
          >
            {{ c.name }} (Code: {{ c.code }})
          </option>
        </select>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="errorMessage" class="error-banner">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Main Loading State -->
    <div v-if="isClassroomsLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Synchronizing classroom telemetry data...</p>
    </div>

    <!-- Empty Classrooms State -->
    <div v-else-if="classrooms.length === 0" class="empty-state">
      <div class="empty-icon">🏫</div>
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
            {{ isAnalyticsLoading ? 'Refreshing...' : '🔄 Refresh Telemetry' }}
          </button>
        </div>

        <!-- KPI Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-icon">👥</span>
            <div class="kpi-content">
              <span class="kpi-value">{{ classroomAnalytics?.student_count ?? students.length }}</span>
              <span class="kpi-label">Enrolled Agents</span>
            </div>
          </div>

          <div class="kpi-card">
            <span class="kpi-icon">🗺️</span>
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
            <span class="kpi-icon">🏆</span>
            <div class="kpi-content">
              <span class="kpi-label-title">Average Best Score by Map</span>
              <div class="map-pills-row">
                <div
                  v-for="m in CANONICAL_MAPS"
                  :key="m.name"
                  class="map-score-pill"
                >
                  <span class="map-pill-name">{{ m.icon }} {{ m.name }}:</span>
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
            <div
              v-for="threat in CANONICAL_THREATS"
              :key="threat.name"
              class="threat-card"
            >
              <div class="threat-top">
                <span class="threat-icon">{{ threat.icon }}</span>
                <span :class="['risk-badge', getRiskLevelClass(classroomAnalytics?.category_fail_rates?.[threat.name])]">
                  {{ getRiskLabel(classroomAnalytics?.category_fail_rates?.[threat.name]) }}
                </span>
              </div>

              <h5 class="threat-name">{{ threat.name }}</h5>

              <!-- Metric Value -->
              <div class="threat-rate-row">
                <template v-if="classroomAnalytics?.category_fail_rates?.[threat.name] !== null && classroomAnalytics?.category_fail_rates?.[threat.name] !== undefined">
                  <span class="rate-number">
                    {{ formatFailRate(classroomAnalytics.category_fail_rates[threat.name]) }}
                  </span>
                  <span class="rate-sub">fail frequency</span>
                </template>
                <template v-else>
                  <span class="rate-null">No Encounters Logged</span>
                </template>
              </div>

              <!-- Visual Progress Bar -->
              <div class="progress-bar-bg">
                <div
                  v-if="classroomAnalytics?.category_fail_rates?.[threat.name] !== null && classroomAnalytics?.category_fail_rates?.[threat.name] !== undefined"
                  :class="['progress-bar-fill', getRiskLevelClass(classroomAnalytics.category_fail_rates[threat.name])]"
                  :style="{ width: `${Math.min(classroomAnalytics.category_fail_rates[threat.name] * 100, 100)}%` }"
                ></div>
                <div v-else class="progress-bar-empty"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- LEVEL 2: ENROLLED AGENT ROSTER & DRILL-DOWN -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h3>Student Defense Proficiency Roster</h3>
            <span class="meta-tag">Select an agent codename to inspect deep threat telemetry</span>
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
                <th>Agent Codename</th>
                <th>Map Progression</th>
                <th>Enrolled / Synced</th>
                <th class="text-right">Threat Telemetry</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.profile_id">
                <td class="agent-cell">
                  <span class="agent-avatar">{{ student.username?.charAt(0).toUpperCase() || 'A' }}</span>
                  <div>
                    <span class="agent-name">{{ student.username }}</span>
                    <span class="agent-id">ID: {{ student.profile_id }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge-progression">
                    {{ student.map_progress || 'Map 1: Home Baseline' }}
                  </span>
                </td>
                <td class="date-cell">
                  {{ formatDate(student.last_synced_at || student.joined_at) }}
                </td>
                <td class="text-right">
                  <button
                    class="btn-inspect"
                    @click="openStudentAnalytics(student)"
                  >
                    Inspect Telemetry 🔍
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

    <!-- ==================================================== -->
    <!-- LEVEL 2 MODAL: STUDENT PROFICIENCY DRILL-DOWN        -->
    <!-- ==================================================== -->
    <div
      v-if="isStudentModalOpen"
      class="modal-backdrop"
      @click.self="closeStudentModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <div class="modal-title-box">
            <h4>Agent Proficiency: {{ selectedStudent?.username }}</h4>
            <span class="modal-profile-id">Profile ID: {{ selectedStudent?.profile_id }}</span>
          </div>
          <button class="modal-close-btn" @click="closeStudentModal">✕</button>
        </div>

        <div v-if="isStudentLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Compiling student telemetry breakdown...</p>
        </div>

        <div v-else-if="studentErrorMessage" class="error-banner">
          ⚠️ {{ studentErrorMessage }}
        </div>

        <div v-else-if="studentAnalytics" class="modal-body">
          <!-- Student Performance Highlights -->
          <div class="student-kpi-row">
            <div class="stat-box">
              <span class="stat-number stat-win">{{ studentAnalytics.wins }}</span>
              <span class="stat-tag">Missions Won</span>
            </div>
            <div class="stat-box">
              <span class="stat-number stat-loss">{{ studentAnalytics.losses }}</span>
              <span class="stat-tag">Missions Lost</span>
            </div>
            <div class="stat-box">
              <span class="stat-number stat-rate">
                {{
                  studentAnalytics.wins + studentAnalytics.losses > 0
                    ? `${Math.round((studentAnalytics.wins / (studentAnalytics.wins + studentAnalytics.losses)) * 100)}%`
                    : 'N/A'
                }}
              </span>
              <span class="stat-tag">Win Rate</span>
            </div>
            <div class="stat-box">
              <span class="stat-number stat-duration">
                {{ formatDuration(studentAnalytics.avg_duration_seconds) }}
              </span>
              <span class="stat-tag">Avg Duration</span>
            </div>
          </div>

          <!-- Best Score per Map -->
          <div class="subsection">
            <h5>Best Scores Across Simulation Maps</h5>
            <div class="map-scores-grid">
              <div
                v-for="m in CANONICAL_MAPS"
                :key="m.name"
                class="student-map-card"
              >
                <span class="s-map-icon">{{ m.icon }}</span>
                <div class="s-map-info">
                  <span class="s-map-name">{{ m.name }}</span>
                  <span
                    v-if="studentAnalytics.best_score_by_map?.[m.name] !== undefined"
                    class="s-map-score"
                  >
                    {{ studentAnalytics.best_score_by_map[m.name] }} pts
                  </span>
                  <span v-else class="s-map-unplayed">Not Attempted</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Student Individual Threat Category Breakdown -->
          <div class="subsection">
            <h5>Vulnerability by Threat Category</h5>
            <div class="student-threats-grid">
              <div
                v-for="threat in CANONICAL_THREATS"
                :key="threat.name"
                class="student-threat-pill"
              >
                <span class="st-icon">{{ threat.icon }}</span>
                <span class="st-name">{{ threat.name }}</span>
                <span
                  :class="[
                    'st-badge',
                    getRiskLevelClass(studentAnalytics.category_breakdown?.[threat.name]),
                  ]"
                >
                  {{
                    studentAnalytics.category_breakdown?.[threat.name] !== null &&
                    studentAnalytics.category_breakdown?.[threat.name] !== undefined
                      ? `${(studentAnalytics.category_breakdown[threat.name] * 100).toFixed(0)}% Fail`
                      : 'No Data'
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- Recent Sessions List -->
          <div class="subsection">
            <h5>Recent Missions (Up to 10)</h5>
            <div
              v-if="studentAnalytics.recent_sessions && studentAnalytics.recent_sessions.length > 0"
              class="table-container"
            >
              <table class="data-table sessions-table">
                <thead>
                  <tr>
                    <th>Map</th>
                    <th>Result</th>
                    <th>Duration</th>
                    <th>Credits Net</th>
                    <th>Played At</th>
                    <th class="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="s in studentAnalytics.recent_sessions"
                    :key="s.session_id"
                  >
                    <td>
                      <span class="session-map">{{ s.map_name }}</span>
                    </td>
                    <td>
                      <span :class="['result-pill', s.result]">
                        {{ s.result?.toUpperCase() }}
                      </span>
                    </td>
                    <td>{{ formatDuration(s.duration_seconds) }}</td>
                    <td>
                      <span class="credits-earned">+{{ s.credits_earned || 0 }}</span>
                      /
                      <span class="credits-lost">-{{ s.credits_lost || 0 }}</span>
                    </td>
                    <td class="date-cell">{{ formatDate(s.played_at) }}</td>
                    <td class="text-right">
                      <button
                        class="btn-telemetry"
                        @click="openSessionTelemetry(s)"
                      >
                        Telemetry 📡
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-note">No recent mission sessions recorded for this agent.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================================================== -->
    <!-- LEVEL 3 MODAL: GRANULAR SESSION ATTACK TELEMETRY     -->
    <!-- ==================================================== -->
    <div
      v-if="isSessionModalOpen"
      class="modal-backdrop sub-backdrop"
      @click.self="closeSessionModal"
    >
      <div class="modal-dialog modal-md">
        <div class="modal-header">
          <div class="modal-title-box">
            <h4>Session Attack Telemetry</h4>
            <span class="modal-profile-id">ID: {{ selectedSession?.session_id }}</span>
          </div>
          <button class="modal-close-btn" @click="closeSessionModal">✕</button>
        </div>

        <div v-if="isSessionLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Querying session telemetry stream...</p>
        </div>

        <div v-else-if="sessionErrorMessage" class="error-banner">
          ⚠️ {{ sessionErrorMessage }}
        </div>

        <div v-else-if="sessionTelemetry" class="modal-body">
          <!-- Session Context Header -->
          <div class="session-summary-box">
            <div class="summary-col">
              <span class="summary-label">Codename</span>
              <span class="summary-val">{{ sessionTelemetry.username || selectedStudent?.username || 'Agent' }}</span>
            </div>
            <div class="summary-col">
              <span class="summary-label">Map</span>
              <span class="summary-val">{{ sessionTelemetry.map_name }}</span>
            </div>
            <div class="summary-col">
              <span class="summary-label">Mission Outcome</span>
              <span :class="['result-pill', sessionTelemetry.result]">
                {{ sessionTelemetry.result?.toUpperCase() }}
              </span>
            </div>
          </div>

          <!-- Threat Events Table or Graceful Empty State -->
          <div class="subsection">
            <h5>Granular Attack & Defense Events</h5>

            <div
              v-if="sessionTelemetry.threat_events && sessionTelemetry.threat_events.length > 0"
              class="table-container"
            >
              <table class="data-table events-table">
                <thead>
                  <tr>
                    <th>Threat Category</th>
                    <th>Action Taken</th>
                    <th>Assessment</th>
                    <th>Legitimate?</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(event, idx) in sessionTelemetry.threat_events"
                    :key="idx"
                  >
                    <td>
                      <span class="event-threat">{{ event.threat_type }}</span>
                    </td>
                    <td>
                      <span class="event-action">{{ event.player_action }}</span>
                    </td>
                    <td>
                      <span
                        :class="['assessment-tag', event.is_correct ? 'correct' : 'incorrect']"
                      >
                        {{ event.is_correct ? '✓ Correct' : '✗ Mistake' }}
                      </span>
                    </td>
                    <td>
                      {{ event.is_legitimate_item ? 'Yes (Benign)' : 'No (Attack)' }}
                    </td>
                    <td>
                      <span
                        :class="['credit-val', event.credits_affected >= 0 ? 'gain' : 'loss']"
                      >
                        {{ event.credits_affected >= 0 ? `+${event.credits_affected}` : event.credits_affected }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Graceful Empty State for Telemetry Streaming -->
            <div v-else class="telemetry-pending-banner">
              <div class="pending-icon">🛰️</div>
              <div class="pending-text">
                <h6>Telemetry Event Stream Synchronization</h6>
                <p>
                  No granular attack events recorded for this session. Threat event streaming from the Godot
                  game client is currently pending telemetry synchronization. Summary outcome metrics remain fully validated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
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

.threat-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.threat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple);
}

.threat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.threat-icon {
  font-size: 1.4rem;
}

.threat-name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.3;
}

.threat-rate-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.rate-number {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-primary);
}

.rate-sub {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.rate-null {
  font-size: 0.82rem;
  color: var(--color-text-dim);
  font-style: italic;
}

/* Risk Badges */
.risk-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.risk-badge.risk-low {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.risk-badge.risk-moderate {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.risk-badge.risk-high {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.risk-badge.no-data {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

/* Progress Bars */
.progress-bar-bg {
  width: 100%;
  height: 6px;
  background-color: var(--color-border-subtle);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.progress-bar-fill.risk-low {
  background-color: var(--color-success);
}

.progress-bar-fill.risk-moderate {
  background-color: var(--color-warning);
}

.progress-bar-fill.risk-high {
  background-color: var(--color-danger);
}

.progress-bar-empty {
  height: 100%;
  background-color: transparent;
}

/* Tables */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

.data-table td {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 0.92rem;
  color: var(--color-text-main);
}

.data-table tr:hover td {
  background-color: var(--color-bg-subtle);
}

.text-right {
  text-align: right;
}

.agent-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--btn-gradient);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
}

.agent-name {
  display: block;
  font-weight: 600;
  color: var(--color-text-main);
}

.agent-id {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
}

.badge-progression {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.btn-inspect {
  padding: 0.45rem 0.9rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-inspect:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(30, 27, 75, 0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.sub-backdrop {
  z-index: 250;
  background-color: rgba(30, 27, 75, 0.7);
}

.modal-dialog {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(124, 58, 237, 0.2);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-lg {
  max-width: 820px;
}

.modal-md {
  max-width: 680px;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-subtle);
}

.modal-title-box h4 {
  margin: 0 0 0.15rem 0;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.modal-profile-id {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-dim);
  cursor: pointer;
}

.modal-close-btn:hover {
  color: var(--color-danger);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Student Modal KPI Row */
.student-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.stat-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
}

.stat-number {
  display: block;
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.stat-win {
  color: var(--color-success);
}

.stat-loss {
  color: var(--color-danger);
}

.stat-rate {
  color: var(--color-primary);
}

.stat-duration {
  color: var(--color-secondary);
}

.stat-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.subsection h5 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: var(--color-text-main);
  border-left: 3.5px solid var(--color-primary);
  padding-left: 0.5rem;
}

/* Student Map Scores */
.map-scores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.student-map-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.s-map-icon {
  font-size: 1.5rem;
}

.s-map-info {
  display: flex;
  flex-direction: column;
}

.s-map-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.s-map-score {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.s-map-unplayed {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  font-style: italic;
}

/* Student Threat Pills */
.student-threats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.65rem;
}

.student-threat-pill {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.st-icon {
  font-size: 1.1rem;
}

.st-name {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.st-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.st-badge.risk-low {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.st-badge.risk-moderate {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
}

.st-badge.risk-high {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.st-badge.no-data {
  background-color: #ffffff;
  color: var(--color-text-dim);
}

/* Session Result Pills */
.result-pill {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  display: inline-block;
}

.result-pill.win {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.result-pill.lose {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.result-pill.timeout {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.credits-earned {
  color: var(--color-success);
  font-weight: 600;
}

.credits-lost {
  color: var(--color-danger);
  font-weight: 600;
}

.btn-telemetry {
  padding: 0.35rem 0.75rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-telemetry:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
}

/* Session Modal Summary Box */
.session-summary-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.summary-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.summary-val {
  font-weight: 700;
  color: var(--color-text-main);
  font-size: 1rem;
}

.assessment-tag {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.assessment-tag.correct {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.assessment-tag.incorrect {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.credit-val.gain {
  color: var(--color-success);
  font-weight: 700;
}

.credit-val.loss {
  color: var(--color-danger);
  font-weight: 700;
}

/* Telemetry Pending Graceful Banner */
.telemetry-pending-banner {
  background-color: var(--color-bg-subtle);
  border: 1.5px dashed var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.pending-icon {
  font-size: 2.2rem;
  flex-shrink: 0;
}

.pending-text h6 {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.pending-text p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
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

@media (max-width: 768px) {
  .student-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .session-summary-box {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
