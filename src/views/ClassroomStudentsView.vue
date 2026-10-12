<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchClassroomStudents } from '../api/classroom'

const route = useRoute()
const router = useRouter()

const codeId = route.params.code_id
const classroomInfo = ref(null)
const students = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const page = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)

const mapNames = ['Home', 'Office', 'Internet Cafe', 'Public Park']

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const formatMapProgress = (progress) => {
  if (typeof progress === 'number' && progress >= 1 && progress <= mapNames.length) {
    return mapNames[progress - 1]
  }
  if (typeof progress === 'string' && progress.trim()) {
    return progress
  }
  return 'Not Started'
}

const fetchStudents = async (targetPage = page.value) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchClassroomStudents(codeId, {
      page: targetPage,
      page_size: pageSize.value,
    })

    if (Array.isArray(data)) {
      students.value = data
      totalCount.value = data.length
      page.value = 1
    } else if (data && typeof data === 'object') {
      students.value = data.items || data.students || []
      totalCount.value = data.total_count ?? data.total ?? students.value.length
      page.value = data.page ?? targetPage
      pageSize.value = data.page_size ?? pageSize.value
      classroomInfo.value = data.classroom || classroomInfo.value || null
    } else {
      students.value = []
      totalCount.value = 0
    }
  } catch {
    errorMessage.value = 'Could not load the student list for this classroom.'
  } finally {
    isLoading.value = false
  }
}

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    fetchStudents(page.value - 1)
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    fetchStudents(page.value + 1)
  }
}

const handleBack = () => {
  router.push('/classroom/manage')
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
  fetchStudents()
})
</script>

<template>
  <div class="roster-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <button class="back-link" @click="handleBack">Return to Classrooms</button>
          <h2 class="title">{{ classroomInfo?.name || 'Classroom Roster' }}</h2>
          <p v-if="classroomInfo?.code" class="subtitle">
            Classroom Code: <strong class="code-highlight">{{ classroomInfo.code }}</strong>
          </p>
        </div>
        <div class="badge-container">
          <span class="count-badge">Enrolled Students: {{ totalCount }}</span>
          <router-link :to="'/analytics/' + codeId" class="btn-analytics-header">
            Classroom Analytics
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
        <p>Loading enrolled students...</p>
      </div>

      <div v-else-if="students.length > 0" class="table-card">
        <table class="roster-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Map Progress</th>
              <th>Last synced</th>
              <th class="text-right">Student Analytics</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.profile_id">
              <td class="username-cell">
                <span class="student-name">{{ student.username }}</span>
              </td>
              <td>
                <span class="progress-badge">{{ formatMapProgress(student.map_progress) }}</span>
              </td>
              <td class="date-cell">{{ formatLastSynced(student.last_synced_at) }}</td>
              <td class="text-right">
                <router-link :to="'/analytics/' + codeId" class="btn-inspect-link">
                  View Analytics
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination Controls -->
        <div v-if="totalCount > 0" class="pagination-bar">
          <div class="pagination-info">
            Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
            <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
            <strong>{{ totalCount }}</strong> students
          </div>
          <div class="pagination-actions">
            <button
              class="page-btn"
              :disabled="page <= 1 || isLoading"
              @click="handlePrevPage"
            >
              ◀ Previous
            </button>
            <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
            <button
              class="page-btn"
              :disabled="page >= totalPages || isLoading"
              @click="handleNextPage"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="!errorMessage" class="empty-state">
        <h4>No Students Enrolled Yet</h4>
        <p>
          Distribute your classroom code <strong class="code-highlight">{{ classroomInfo?.code }}</strong> to students to have them join this classroom.
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
</style>
