<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMyClassrooms } from '../api/classroom'
import { useAuthStore } from '../stores/authStore'
import { useClassroomStore } from '../stores/classroomStore'
import ClassroomCard from '../components/classroom/ClassroomCard.vue'
import ClassroomCreateModal from '../components/classroom/ClassroomCreateModal.vue'
import ClassroomEditModal from '../components/classroom/ClassroomEditModal.vue'
import ClassroomDeleteModal from '../components/classroom/ClassroomDeleteModal.vue'

const router = useRouter()
const authStore = useAuthStore()
const classroomStore = useClassroomStore()

const classrooms = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Search and filter state
const searchQuery = ref('')
const selectedStatus = ref('all') // 'all' | 'active' | 'inactive'

const isFilterActive = computed(() => {
  return searchQuery.value.trim().length > 0 || selectedStatus.value !== 'all'
})

const clearFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = 'all'
}

const filteredClassrooms = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const status = selectedStatus.value

  return classrooms.value.filter((c) => {
    // Status filter
    if (status === 'active' && c.is_active !== true) return false
    if (status === 'inactive' && c.is_active !== false) return false

    // Name or code search
    if (query) {
      const name = String(c.name || '').toLowerCase()
      const code = String(c.code_value || c.code || '').toLowerCase()
      if (!name.includes(query) && !code.includes(query)) {
        return false
      }
    }

    return true
  })
})

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
    classrooms.value = Array.isArray(data) ? data : []
  } catch {
    errorMessage.value = 'Failed to load classroom roster. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const handleCreated = (newClassroom) => {
  const code = newClassroom.code_value || newClassroom.code || 'GENERATED'
  successMessage.value = `Classroom "${newClassroom.name}" generated with access code: ${code}`
  classroomStore.updateClassroomInState(newClassroom)
  fetchClassrooms()
}

const handleOpenEdit = (classroom) => {
  selectedClassroom.value = classroom
  isEditModalOpen.value = true
}

const handleUpdated = (updated) => {
  if (updated) {
    classroomStore.updateClassroomInState(updated)
  }
  successMessage.value = 'Classroom configurations updated successfully.'
  fetchClassrooms()
}

const handleOpenDelete = (classroom) => {
  selectedClassroom.value = classroom
  isDeleteModalOpen.value = true
}

const handleDeleted = (classroom) => {
  if (classroom) {
    classroomStore.removeClassroomFromState(classroom.code_id)
  }
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
  authStore.ensureWebProfileLoaded().catch(() => {})
  fetchClassrooms()
  if (classroomStore.consumeReopenCreateModal('/classroom/manage')) {
    isCreateModalOpen.value = true
  }
  if (history.state?.flashMessage) {
    successMessage.value = history.state.flashMessage
    const cleanState = { ...history.state }
    delete cleanState.flashMessage
    history.replaceState(cleanState, '')
  }
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
      <div
        v-if="authStore.isEducatorMissingDisplayName"
        class="display-name-notice"
        role="status"
        aria-live="polite"
      >
        <div class="notice-text">
          <strong>Set your display name</strong>
          <span>
            Add the name players see as their teacher in Account settings before creating a classroom.
          </span>
        </div>
        <router-link
          :to="{ path: '/settings', query: { section: 'account', returnTo: '/classroom/manage' } }"
          class="btn-notice-action"
        >
          Set display name in Settings
        </router-link>
      </div>

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

      <!-- Classroom Toolbar -->
      <section
        v-if="!isLoading && !errorMessage && (classrooms.length > 0 || isFilterActive)"
        class="classroom-toolbar"
        aria-label="Classroom filters"
      >
        <div class="toolbar-controls">
          <div class="toolbar-field search-field">
            <label for="classroom-search" class="toolbar-label">Search classrooms</label>
            <input
              id="classroom-search"
              v-model="searchQuery"
              type="search"
              class="toolbar-input"
              placeholder="Search by name or access code..."
              autocomplete="off"
            />
          </div>

          <div class="toolbar-field status-field">
            <label for="classroom-status" class="toolbar-label">Status</label>
            <select
              id="classroom-status"
              v-model="selectedStatus"
              class="toolbar-select"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div v-if="isFilterActive" class="toolbar-actions">
            <button
              type="button"
              class="btn-clear-filters"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Fetching classroom roster...</p>
      </div>

      <div v-else-if="filteredClassrooms.length > 0" class="classroom-grid">
        <ClassroomCard
          v-for="c in filteredClassrooms"
          :key="c.code_id || c.id"
          :classroom="c"
          @view-students="handleViewStudents"
          @view-analytics="handleViewAnalytics"
          @edit="handleOpenEdit"
          @delete="handleOpenDelete"
        />
      </div>

      <div v-else-if="classrooms.length > 0 && isFilterActive" class="empty-state" role="status">
        <h4>No matching classrooms</h4>
        <p>No classrooms match your search criteria or status filter.</p>
        <button type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
      </div>

      <div v-else-if="!errorMessage" class="empty-state">
        <h4>No classrooms yet</h4>
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

@media (max-width: 640px) {
  .classroom-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1600px) {
  .classroom-grid {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .classroom-grid > * {
    max-width: 420px;
    width: 100%;
  }
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

.display-name-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.9rem 1.15rem;
  margin-bottom: 1.5rem;
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 10px;
  font-size: 0.9rem;
}

:root[data-theme="dark"] .display-name-notice {
  background-color: #451a03;
  border-color: #92400e;
  color: #fde68a;
}

.notice-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.btn-notice-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.9rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}

.btn-notice-action:hover {
  background-color: var(--color-primary-hover);
}

.btn-notice-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Classroom Toolbar */
.classroom-toolbar {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.15rem 1.25rem;
  margin-bottom: 1.75rem;
  box-shadow: var(--shadow-sm);
}

.toolbar-controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.search-field {
  flex: 1 1 260px;
  min-width: 200px;
}

.status-field {
  flex: 0 0 170px;
  min-width: 140px;
}

.toolbar-label {
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.toolbar-input,
.toolbar-select {
  width: 100%;
  min-height: 40px;
  padding: 0.55rem 0.85rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  color: var(--color-text-main);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.toolbar-input:focus,
.toolbar-select:focus,
.toolbar-input:focus-visible,
.toolbar-select:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

.toolbar-actions {
  display: flex;
  align-items: flex-end;
  min-height: 40px;
}

.btn-clear-filters {
  min-height: 40px;
  padding: 0.55rem 1rem;
  background-color: var(--color-card);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-clear-filters:hover {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

.btn-clear-filters:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

@media (max-width: 640px) {
  .toolbar-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 0.85rem;
  }

  .search-field,
  .status-field {
    flex: 1 1 100%;
    min-width: 100%;
  }

  .toolbar-actions {
    width: 100%;
  }

  .btn-clear-filters {
    width: 100%;
  }
}
</style>
