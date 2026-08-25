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
    errorMessage.value = 'Could not load student roster for this classroom.'
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
          <button class="back-link" @click="handleBack">← Back to Classrooms</button>
          <h2>{{ classroomInfo?.name || 'Classroom Roster' }}</h2>
          <p v-if="classroomInfo?.code" class="subtitle">
            Classroom Code: <strong>{{ classroomInfo.code }}</strong>
          </p>
        </div>
        <div class="badge-container">
          <span class="count-badge">Total Students: {{ students.length }}</span>
        </div>
      </div>
    </header>

    <main class="page-body">
      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading student roster...</p>
      </div>

      <div v-else-if="students.length > 0" class="table-container">
        <table class="roster-table">
          <thead>
            <tr>
              <th>Agent Username</th>
              <th>Simulation Map Progress</th>
              <th>Enrollment Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.profile_id">
              <td class="username-cell">
                <strong>{{ student.username }}</strong>
              </td>
              <td>
                <span class="progress-badge">{{ student.map_progress || 'Not Started' }}</span>
              </td>
              <td class="date-cell">{{ formatDate(student.joined_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <h4>No Students Enrolled Yet</h4>
        <p>
          Share your classroom code <strong>{{ classroomInfo?.code }}</strong> with players to have
          them join your security training.
        </p>
        <button class="btn-back" @click="handleBack">Return to Classrooms</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.roster-page {
  max-width: 860px;
  margin: 2rem auto;
  padding: 1rem;
}

.page-header {
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.back-link {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
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

h2 {
  margin: 0 0 0.25rem 0;
  color: #111827;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.count-badge {
  background-color: #d1fae5;
  color: #065f46;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.table-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.roster-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: #f9fafb;
  color: #4b5563;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  color: #1f2937;
  font-size: 0.95rem;
}

tr:last-child td {
  border-bottom: none;
}

.progress-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  background-color: #eff6ff;
  color: #1e40af;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.date-cell {
  color: #6b7280;
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.btn-back {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}

.loading-state {
  text-align: center;
  padding: 3rem 1rem;
}

.spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 1rem auto;
  border: 3px solid #e5e7eb;
  border-top-color: #059669;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  background-color: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
</style>
