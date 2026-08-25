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
const newDescription = ref('')
const isCreating = ref(false)

// Modal state: Edit
const isEditModalOpen = ref(false)
const editId = ref('')
const editName = ref('')
const editDescription = ref('')
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
  newDescription.value = ''
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
      description: newDescription.value.trim(),
    })
    successMessage.value = `Classroom "${response.data.name}" generated with code: ${response.data.code}`
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
  editDescription.value = classroom.description || ''
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
      description: editDescription.value.trim(),
      is_active: editIsActive.value,
    })
    successMessage.value = 'Classroom updated successfully.'
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

onMounted(() => {
  fetchClassrooms()
})
</script>

<template>
  <div class="management-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <h2>Classroom Management</h2>
          <p class="subtitle">Generate, configure, and oversee security simulation classrooms</p>
        </div>
        <div class="header-actions">
          <router-link to="/dashboard" class="nav-btn">← Back to Dashboard</router-link>
          <button class="primary-btn" @click="openCreateModal">+ Generate New Classroom</button>
        </div>
      </div>
    </header>

    <main class="page-body">
      <div v-if="successMessage" class="success-banner">
        {{ successMessage }}
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your classrooms...</p>
      </div>

      <div v-else-if="classrooms.length > 0" class="classroom-grid">
        <div v-for="c in classrooms" :key="c.id" class="classroom-card">
          <div class="card-top">
            <div class="code-tag">Code: {{ c.code }}</div>
            <span :class="['status-pill', c.is_active ? 'active' : 'inactive']">
              {{ c.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <h3 class="classroom-name">{{ c.name }}</h3>
          <p class="classroom-desc">{{ c.description || 'No description provided.' }}</p>

          <div class="card-meta">
            <span class="student-count">👥 {{ c.student_count || 0 }} Enrolled Students</span>
          </div>

          <div class="card-actions">
            <button class="btn-secondary" @click="handleViewStudents(c.id)">
              View Students
            </button>
            <div class="btn-group">
              <button class="btn-edit" @click="openEditModal(c)">Edit</button>
              <button class="btn-delete" @click="openDeleteModal(c)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <h4>No Classrooms Generated</h4>
        <p>You have not created any classrooms yet. Click "+ Generate New Classroom" to get started.</p>
        <button class="primary-btn" @click="openCreateModal">+ Generate Classroom</button>
      </div>
    </main>

    <!-- Create Classroom Modal -->
    <div v-if="isCreateModalOpen" class="modal-overlay" @click.self="isCreateModalOpen = false">
      <div class="modal-card">
        <h3>Generate New Classroom</h3>
        <p class="modal-desc">Create a new classroom and generate a 6-character joining code.</p>

        <form @submit.prevent="handleCreateClassroom">
          <div class="form-group">
            <label for="new-name">Classroom Name</label>
            <input
              id="new-name"
              v-model="newName"
              type="text"
              placeholder="e.g. Advanced Network Defense"
              required
            />
          </div>

          <div class="form-group">
            <label for="new-desc">Description</label>
            <textarea
              id="new-desc"
              v-model="newDescription"
              rows="3"
              placeholder="Brief overview of curriculum or focus areas..."
            ></textarea>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-cancel" @click="isCreateModalOpen = false">
              Cancel
            </button>
            <button type="submit" class="primary-btn" :disabled="isCreating">
              {{ isCreating ? 'Generating...' : 'Generate Code' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Classroom Modal -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-card">
        <h3>Edit Classroom</h3>

        <form @submit.prevent="handleUpdateClassroom">
          <div class="form-group">
            <label for="edit-name">Classroom Name</label>
            <input id="edit-name" v-model="editName" type="text" required />
          </div>

          <div class="form-group">
            <label for="edit-desc">Description</label>
            <textarea id="edit-desc" v-model="editDescription" rows="3"></textarea>
          </div>

          <div class="form-group-checkbox">
            <label>
              <input v-model="editIsActive" type="checkbox" />
              Active (allows players to join and synchronize records)
            </label>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-cancel" @click="isEditModalOpen = false">
              Cancel
            </button>
            <button type="submit" class="primary-btn" :disabled="isUpdating">
              {{ isUpdating ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click.self="isDeleteModalOpen = false">
      <div class="modal-card">
        <h3 class="danger-title">Confirm Classroom Deletion</h3>
        <p>
          Are you sure you want to soft-delete <strong>"{{ deleteTargetName }}"</strong>?
          Enrolled students will no longer see active assignments for this classroom.
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
  max-width: 960px;
  margin: 2rem auto;
  padding: 1rem;
}

.page-header {
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.nav-btn {
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
}

.primary-btn {
  padding: 0.5rem 1rem;
  background-color: #059669;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.primary-btn:hover {
  background-color: #047857;
}

.primary-btn:disabled {
  background-color: #a7f3d0;
  cursor: not-allowed;
}

.success-banner {
  background-color: #ecfdf5;
  border: 1px solid #10b981;
  color: #065f46;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
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

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1.25rem;
}

.classroom-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.code-tag {
  font-size: 0.85rem;
  font-weight: 700;
  background-color: #e0e7ff;
  color: #3730a3;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.status-pill {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  text-transform: uppercase;
}

.status-pill.active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-pill.inactive {
  background-color: #f3f4f6;
  color: #6b7280;
}

.classroom-name {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.15rem;
}

.classroom-desc {
  color: #6b7280;
  font-size: 0.9rem;
  flex: 1;
  margin: 0 0 1rem 0;
  line-height: 1.4;
}

.card-meta {
  padding: 0.5rem 0;
  border-top: 1px solid #f3f4f6;
  font-size: 0.85rem;
  color: #4b5563;
  margin-bottom: 1rem;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  padding: 0.4rem 0.75rem;
  background-color: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-group {
  display: flex;
  gap: 0.35rem;
}

.btn-edit {
  padding: 0.4rem 0.6rem;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-delete {
  padding: 0.4rem 0.6rem;
  background-color: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
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

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
}

.modal-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.modal-card h3 {
  margin: 0 0 0.25rem 0;
  color: #111827;
}

.danger-title {
  color: #dc2626 !important;
}

.modal-desc {
  margin: 0 0 1.25rem 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
}

.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
  color: #374151;
}

.form-group input,
.form-group textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}

.form-group-checkbox {
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  color: #374151;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  color: #374151;
}

.btn-danger {
  padding: 0.5rem 1rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-danger:hover {
  background-color: #b91c1c;
}
</style>
