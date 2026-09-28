<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import apiClient from '../api/client'

const route = useRoute()
const router = useRouter()

const codeId = route.params.code_id
const classroomInfo = ref(null)
const students = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const fetchStudents = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await apiClient.get(`/classroom/${codeId}/students`)
    classroomInfo.value = response.data.classroom
    students.value = response.data.students || []
  } catch (error) {
    console.error('Failed to load student roster:', error)
    errorMessage.value = 'Could not load student roster telemetry for this classroom.'
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/classroom/manage')
}

const formatDate = (isoString) => {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(() => {
  fetchStudents()
})
</script>

<template>
  <div class="roster-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <button class="back-link" @click="handleBack">← Return to Classrooms</button>
          <h2 class="title">{{ classroomInfo?.name || 'Classroom Roster' }}</h2>
          <p v-if="classroomInfo?.code" class="subtitle">
            Sector Access Code: <strong class="code-highlight">{{ classroomInfo.code }}</strong>
          </p>
        </div>
        <div class="badge-container">
          <span class="count-badge">Enrolled Agents: {{ students.length }}</span>
          <router-link :to="'/analytics/' + codeId" class="btn-analytics-header">
            Sector Analytics
          </router-link>
        </div>
      </div>
    </header>

    <main class="page-body">
      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading student roster telemetry...</p>
      </div>

      <div v-else-if="students.length > 0" class="table-card">
        <table class="roster-table">
          <thead>
            <tr>
              <th>Agent Codename</th>
              <th>Simulation Map Progression</th>
              <th>Enrollment Timestamp</th>
              <th class="text-right">Threat Telemetry</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.profile_id">
              <td class="username-cell">
                <span class="student-name">{{ student.username }}</span>
              </td>
              <td>
                <span class="progress-badge">{{ student.map_progress || 'Not Started' }}</span>
              </td>
              <td class="date-cell">{{ formatDate(student.joined_at) }}</td>
              <td class="text-right">
                <router-link :to="'/analytics/' + codeId" class="btn-inspect-link">
                  Inspect Telemetry
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <h4>No Agents Enrolled Yet</h4>
        <p>
          Distribute your classroom access code <strong class="code-highlight">{{ classroomInfo?.code }}</strong> to students to begin telemetry tracking.
        </p>
        <button class="btn-outline" @click="handleBack">Return to Classrooms</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.roster-page {
  width: 100%;
}

.page-header {
  margin-bottom: 2rem;
}

.back-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.6rem;
  transition: all 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 1.65rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.code-highlight {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-size: 1rem;
}

.badge-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.count-badge {
  background-color: var(--color-bg-muted);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 700;
}

.btn-analytics-header {
  padding: 0.45rem 0.95rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.85rem;
  text-decoration: none;
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.25);
  transition: all 0.2s ease;
}

.btn-analytics-header:hover {
  background: var(--btn-gradient-hover);
  transform: translateY(-1px);
}

.text-right {
  text-align: right;
}

.btn-inspect-link {
  display: inline-block;
  padding: 0.4rem 0.85rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-inspect-link:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-purple);
}

.roster-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.95rem 1.25rem;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.95rem;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background-color: var(--color-bg-subtle);
}

.student-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.progress-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-purple);
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
}

.empty-state p {
  margin-bottom: 1.5rem;
}

.btn-outline {
  padding: 0.55rem 1.2rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-outline:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
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
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
</style>
