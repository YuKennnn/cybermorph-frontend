<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import apiClient from '../api/client'

const router = useRouter()

const classrooms = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Modal state: Create
const isCreateModalOpen = ref(false)
const newName = ref('')
const isCreating = ref(false)

// Modal state: Edit
const isEditModalOpen = ref(false)
const editId = ref('')
const editName = ref('')
const editIsActive = ref(true)
const isUpdating = ref(false)

// Delete confirm state
const isDeleteModalOpen = ref(false)
const deleteTargetId = ref('')
const deleteTargetName = ref('')
const isDeleting = ref(false)

const fetchClassrooms = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await apiClient.get('/classroom/my-codes')
    classrooms.value = response.data.classrooms || []
  } catch (error) {
    console.error('Failed to load classrooms:', error)
    errorMessage.value = 'Failed to load classroom roster. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const openCreateModal = () => {
  newName.value = ''
  isCreateModalOpen.value = true
}

const handleCreateClassroom = async () => {
  if (!newName.value.trim()) return

  isCreating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiClient.post('/classroom/generate', {
      name: newName.value.trim(),
    })
    successMessage.value = `Classroom "${response.data.name}" generated with access code: ${response.data.code}`
    isCreateModalOpen.value = false
    await fetchClassrooms()
  } catch (error) {
    console.error('Failed to create classroom:', error)
    errorMessage.value = 'Failed to generate classroom. Please try again.'
  } finally {
    isCreating.value = false
  }
}

const openEditModal = (classroom) => {
  editId.value = classroom.id
  editName.value = classroom.name
  editIsActive.value = classroom.is_active
  isEditModalOpen.value = true
}

const handleUpdateClassroom = async () => {
  isUpdating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await apiClient.patch(`/classroom/${editId.value}`, {
      name: editName.value.trim(),
      is_active: editIsActive.value,
    })
    successMessage.value = 'Classroom configurations updated successfully.'
    isEditModalOpen.value = false
    await fetchClassrooms()
  } catch (error) {
    console.error('Failed to update classroom:', error)
    errorMessage.value = 'Failed to update classroom details.'
  } finally {
    isUpdating.value = false
  }
}

const openDeleteModal = (classroom) => {
  deleteTargetId.value = classroom.id
  deleteTargetName.value = classroom.name
  isDeleteModalOpen.value = true
}

const handleDeleteClassroom = async () => {
  isDeleting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await apiClient.delete(`/classroom/${deleteTargetId.value}`)
    successMessage.value = `Classroom "${deleteTargetName.value}" was soft-deleted.`
    isDeleteModalOpen.value = false
    await fetchClassrooms()
  } catch (error) {
    console.error('Failed to delete classroom:', error)
    errorMessage.value = 'Failed to delete classroom.'
  } finally {
    isDeleting.value = false
  }
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
          <div class="card-badge">
            <span class="badge-dot"></span>
            <span>INSTRUCTOR CONSOLE // SECTORS</span>
          </div>
          <h2 class="title">Classroom Management</h2>
          <p class="subtitle">Generate codes, manage sector configurations, and inspect enrolled student progression</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" @click="openCreateModal">+ Generate Classroom</button>
        </div>
      </div>
    </header>

    <main class="page-body">
      <div v-if="successMessage" class="success-banner">
        ✓ {{ successMessage }}
      </div>

      <div v-if="errorMessage" class="error-banner">
        ⚠️ {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Fetching classroom roster...</p>
      </div>

      <div v-else-if="classrooms.length > 0" class="classroom-grid">
        <div v-for="c in classrooms" :key="c.id" class="classroom-card">
          <div class="card-top">
            <div class="code-tag">CODE: {{ c.code }}</div>
            <span :class="['status-pill', c.is_active ? 'active' : 'inactive']">
              {{ c.is_active ? 'ACTIVE' : 'INACTIVE' }}
            </span>
          </div>

          <h3 class="classroom-name">{{ c.name }}</h3>
          <div class="card-meta">
            <span class="student-count">👥 {{ c.student_count || 0 }} Enrolled Agents</span>
          </div>

          <div class="card-actions">
            <div class="primary-actions">
              <button class="btn-roster" @click="handleViewStudents(c.id)">
                Students
              </button>
              <button class="btn-analytics" @click="handleViewAnalytics(c.id || c.code)">
                Analytics
              </button>
            </div>
            <div class="utility-actions">
              <button class="btn-utility edit" @click="openEditModal(c)">Edit</button>
              <span class="utility-divider">·</span>
              <button class="btn-utility delete" @click="openDeleteModal(c)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <h4>No Active Classrooms Found</h4>
        <p>Initialize a new security curriculum sector by generating a 6-character classroom code.</p>
        <button class="btn-primary" @click="openCreateModal">+ Generate Classroom</button>
      </div>
    </main>

    <!-- Create Classroom Modal -->
    <div v-if="isCreateModalOpen" class="modal-overlay" @click.self="isCreateModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Generate New Classroom</h3>
          <button class="close-btn" @click="isCreateModalOpen = false">✕</button>
        </div>
        <p class="modal-desc">Create a classroom deployment and issue an access key for your students.</p>

        <form @submit.prevent="handleCreateClassroom">
          <div class="form-group">
            <label for="new-name">Classroom Sector Name</label>
            <input
              id="new-name"
              v-model="newName"
              type="text"
              placeholder="e.g. Advanced Network Defense"
              required
            />
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-cancel" @click="isCreateModalOpen = false">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="isCreating">
              {{ isCreating ? 'Generating...' : 'Generate Code' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Classroom Modal -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Edit Classroom Configuration</h3>
          <button class="close-btn" @click="isEditModalOpen = false">✕</button>
        </div>

        <form @submit.prevent="handleUpdateClassroom">
          <div class="form-group">
            <label for="edit-name">Classroom Sector Name</label>
            <input id="edit-name" v-model="editName" type="text" required />
          </div>

          <div class="form-group-checkbox">
            <label>
              <input v-model="editIsActive" type="checkbox" />
              Active Status (Permit new students to join and synchronize session logs)
            </label>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-cancel" @click="isEditModalOpen = false">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="isUpdating">
              {{ isUpdating ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click.self="isDeleteModalOpen = false">
      <div class="modal-card danger-modal">
        <div class="modal-header">
          <h3 class="modal-title danger-title">Confirm Deletion</h3>
          <button class="close-btn" @click="isDeleteModalOpen = false">✕</button>
        </div>
        <p class="modal-desc">
          Are you sure you want to soft-delete <strong>"{{ deleteTargetName }}"</strong>?
          Enrolled students will no longer synchronize progress to this classroom.
        </p>

        <div class="modal-buttons">
          <button type="button" class="btn-cancel" @click="isDeleteModalOpen = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn-danger"
            :disabled="isDeleting"
            @click="handleDeleteClassroom"
          >
            {{ isDeleting ? 'Deleting...' : 'Delete Classroom' }}
          </button>
        </div>
      </div>
    </div>
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
  color: var(--color-primary);
  font-size: 1.65rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.btn-primary {
  padding: 0.65rem 1.35rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-banner {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.92rem;
  font-weight: 500;
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

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 1.25rem;
}

.classroom-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-purple);
  transition: all 0.2s ease;
}

.classroom-card:hover {
  box-shadow: var(--shadow-purple-hover);
  border-color: var(--color-secondary);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.code-tag {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  background-color: var(--color-bg-muted);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.status-pill {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.status-pill.active {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-pill.inactive {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.classroom-name {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 1.25rem;
}

.classroom-desc {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  flex: 1;
  margin: 0 0 1.25rem 0;
  line-height: 1.45;
}

.card-meta {
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.88rem;
  color: var(--color-primary);
  font-weight: 600;
  margin-bottom: 1rem;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: auto;
}

.primary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.btn-roster,
.btn-analytics {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-roster {
  background: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
}

.btn-roster:hover {
  background: #ede9fe;
  border-color: var(--color-primary);
}

.btn-analytics {
  background: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
}

.btn-analytics:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.utility-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn-utility {
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-utility.edit {
  color: var(--color-text-muted);
}

.btn-utility.edit:hover {
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
}

.btn-utility.delete {
  color: var(--color-text-dim);
}

.btn-utility.delete:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.utility-divider {
  color: var(--color-border);
  font-size: 0.8rem;
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

/* Modal Styling */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(30, 27, 75, 0.4);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 1000;
}

.modal-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(124, 58, 237, 0.2);
}

.danger-modal {
  border-color: var(--color-danger-border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.modal-title {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.35rem;
}

.danger-title {
  color: var(--color-danger) !important;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 1.25rem;
  cursor: pointer;
}

.close-btn:hover {
  color: var(--color-text-main);
}

.modal-desc {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.25rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--color-text-main);
}

.form-group input,
.form-group textarea {
  padding: 0.75rem 1rem;
  background-color: #ffffff;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text-main);
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.form-group-checkbox {
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.form-group-checkbox input {
  accent-color: var(--color-primary);
  margin-right: 0.5rem;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.85rem;
  margin-top: 1.75rem;
}

.btn-cancel {
  padding: 0.65rem 1.25rem;
  background: #ffffff;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-cancel:hover {
  background-color: var(--color-bg-subtle);
}

.btn-danger {
  padding: 0.65rem 1.25rem;
  background-color: var(--color-danger);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-danger:hover:not(:disabled) {
  background-color: #b91c1c;
}
</style>
