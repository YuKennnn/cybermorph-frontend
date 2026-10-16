<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMyClassrooms } from '../api/classroom'
import ClassroomCard from '../components/classroom/ClassroomCard.vue'
import ClassroomCreateModal from '../components/classroom/ClassroomCreateModal.vue'
import ClassroomEditModal from '../components/classroom/ClassroomEditModal.vue'
import ClassroomDeleteModal from '../components/classroom/ClassroomDeleteModal.vue'

const router = useRouter()

const classrooms = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Modal state
const isCreateModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const selectedClassroom = ref(null)

const fetchClassrooms = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    classrooms.value = Array.isArray(data) ? data : data.classrooms || []
  } catch {
    errorMessage.value = 'Failed to load classroom roster. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const handleCreated = (newClassroom) => {
  const code = newClassroom.code_value || newClassroom.code || 'GENERATED'
  successMessage.value = `Classroom "${newClassroom.name}" generated with access code: ${code}`
  fetchClassrooms()
}

const handleOpenEdit = (classroom) => {
  selectedClassroom.value = classroom
  isEditModalOpen.value = true
}

const handleUpdated = () => {
  successMessage.value = 'Classroom configurations updated successfully.'
  fetchClassrooms()
}

const handleOpenDelete = (classroom) => {
  selectedClassroom.value = classroom
  isDeleteModalOpen.value = true
}

const handleDeleted = (classroom) => {
  successMessage.value = `Classroom "${classroom.name}" was soft-deleted.`
  fetchClassrooms()
}

const handleViewStudents = (codeId) => {
  router.push(`/classroom/students/${codeId}`)
}

const handleViewAnalytics = (codeId) => {
  router.push(`/analytics/${codeId}`)
}

onMounted(() => {
  fetchClassrooms()
})
</script>

<template>
  <div class="management-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <h2 class="title">Classroom management</h2>
          <p class="subtitle">Generate codes, manage classroom settings, and inspect student progress</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" @click="isCreateModalOpen = true">+ Create classroom</button>
        </div>
      </div>
    </header>

    <main class="page-body">
      <div v-if="successMessage" class="success-banner" role="status">
        {{ successMessage }}
      </div>

      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button
          type="button"
          class="btn-retry"
          :disabled="isLoading"
          @click="fetchClassrooms"
        >
          Try again
        </button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Fetching classroom roster...</p>
      </div>

      <div v-else-if="classrooms.length > 0" class="classroom-grid">
        <ClassroomCard
          v-for="c in classrooms"
          :key="c.code_id || c.id"
          :classroom="c"
          @view-students="handleViewStudents"
          @view-analytics="handleViewAnalytics"
          @edit="handleOpenEdit"
          @delete="handleOpenDelete"
        />
      </div>

      <div v-else-if="!errorMessage" class="empty-state">
        <h4>No classrooms found</h4>
        <p>Create a classroom and generate a 6-character access code for your students.</p>
        <button class="btn-primary" @click="isCreateModalOpen = true">+ Create classroom</button>
      </div>
    </main>

    <!-- Modals -->
    <ClassroomCreateModal
      :is-open="isCreateModalOpen"
      @close="isCreateModalOpen = false"
      @created="handleCreated"
    />

    <ClassroomEditModal
      :is-open="isEditModalOpen"
      :classroom="selectedClassroom"
      @close="isEditModalOpen = false"
      @updated="handleUpdated"
    />

    <ClassroomDeleteModal
      :is-open="isDeleteModalOpen"
      :classroom="selectedClassroom"
      @close="isDeleteModalOpen = false"
      @deleted="handleDeleted"
    />
  </div>
</template>

<style scoped>
.management-page {
  width: 100%;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
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

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 1.25rem;
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

.loading-state {
  text-align: center;
  padding: 3.5rem 1rem;
  color: var(--color-text-muted);
}
</style>
