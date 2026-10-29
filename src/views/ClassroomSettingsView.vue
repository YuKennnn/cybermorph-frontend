<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { updateClassroom } from '../api/classroom'
import { useClassroomStore } from '../stores/classroomStore'
import { useAuthStore } from '../stores/authStore'
import ClassroomWorkspaceHeader from '../components/classroom/ClassroomWorkspaceHeader.vue'
import ClassroomDeleteModal from '../components/classroom/ClassroomDeleteModal.vue'

const route = useRoute()
const router = useRouter()
const classroomStore = useClassroomStore()
const authStore = useAuthStore()

const codeId = computed(() => String(route.params.code_id || ''))
const originatingRosterPage = computed(() => {
  const p = parseInt(route.query.roster_page, 10)
  return !isNaN(p) && p > 1 ? p : 1
})

// Editable form state
const formName = ref('')
const formDescription = ref('')
const formIsActive = ref(true)

// Dirty state baseline
const initialState = ref(null)

// UI feedback & mutation state
const nameError = ref('')
const descriptionError = ref('')
const saveErrorMessage = ref('')
const saveSuccessMessage = ref('')
const isSaving = ref(false)
const isPageLoading = ref(true)

// Deletion modal and controlled redirect
const isDeleteModalOpen = ref(false)
const isControlledRedirect = ref(false)

// Lifecycle flags and operation identifiers to avoid race conditions
const isUnmounted = ref(false)
let currentLoadOpId = 0

// Validation rules matching backend contract
const hasControlCharacters = (str) => {
  if (typeof str !== 'string') return false
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    // 10: \n, 13: \r, 0-31: control chars, 127: DEL
    if (code === 10 || code === 13 || (code >= 0 && code <= 31) || code === 127) {
      return true
    }
  }
  return false
}

const handleNameInput = () => {
  nameError.value = ''
  const trimmed = formName.value.trim()
  if (hasControlCharacters(formName.value)) {
    nameError.value = 'Classroom name cannot contain line breaks or control characters.'
  } else if (trimmed.length > 100) {
    nameError.value = 'Classroom name must not exceed 100 characters.'
  }
}

const handleDescriptionInput = () => {
  descriptionError.value = ''
  if (formDescription.value.trim().length > 500) {
    descriptionError.value = 'Description must not exceed 500 characters.'
  }
}

const validateForm = () => {
  nameError.value = ''
  descriptionError.value = ''

  const trimmedName = formName.value.trim()
  if (!trimmedName) {
    nameError.value = 'Classroom name is required.'
    return false
  }

  if (hasControlCharacters(formName.value)) {
    nameError.value = 'Classroom name cannot contain line breaks or control characters.'
    return false
  }

  if (trimmedName.length > 100) {
    nameError.value = 'Classroom name must not exceed 100 characters.'
    return false
  }

  const trimmedDesc = formDescription.value.trim()
  if (trimmedDesc.length > 500) {
    descriptionError.value = 'Description must not exceed 500 characters.'
    return false
  }

  return true
}

const isValid = computed(() => {
  const trimmedName = formName.value.trim()
  if (!trimmedName || trimmedName.length > 100) return false
  if (hasControlCharacters(formName.value)) return false
  if (formDescription.value.trim().length > 500) return false
  return true
})

// Dirty tracking: enabled when any editable field changes, including description alone
const isDirty = computed(() => {
  if (!initialState.value) return false

  const nameChanged = formName.value.trim() !== (initialState.value.name || '').trim()
  const descChanged = formDescription.value.trim() !== (initialState.value.description || '').trim()
  const activeChanged = Boolean(formIsActive.value) !== Boolean(initialState.value.is_active)

  return nameChanged || descChanged || activeChanged
})

// Synchronize initial baseline from classroom record
const setInitialFromClassroom = (classroom) => {
  const name = classroom?.name || ''
  const desc = classroom?.description || ''
  const active = classroom?.is_active ?? true

  formName.value = name
  formDescription.value = desc
  formIsActive.value = active

  initialState.value = {
    name,
    description: desc,
    is_active: active,
  }

  nameError.value = ''
  descriptionError.value = ''
}

// Clear form baseline, feedback, and mutation state immediately on context change
const clearFormAndState = () => {
  formName.value = ''
  formDescription.value = ''
  formIsActive.value = true
  initialState.value = null
  nameError.value = ''
  descriptionError.value = ''
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  isSaving.value = false
  isPageLoading.value = true
}

// Classroom loading with operation identifier
const loadClassroom = async (force = false) => {
  const targetCodeId = codeId.value
  const opId = ++currentLoadOpId

  // Immediately clear previous baseline and state
  clearFormAndState()
  classroomStore.setCurrentClassroomId(targetCodeId)

  try {
    await classroomStore.fetchClassrooms(force)
  } catch {
    // metadata error tracked by classroomStore.error
  }

  // If stale operation, unmounted, or route changed, discard
  if (opId !== currentLoadOpId || isUnmounted.value || codeId.value !== targetCodeId) return

  const target = classroomStore.classrooms.find(
    (c) => String(c.code_id) === targetCodeId,
  )
  if (target) {
    setInitialFromClassroom(target)
  }
  isPageLoading.value = false
}

// Metadata retry owned by ClassroomWorkspaceHeader:
// Its success event initializes the form from the refreshed store without a second fetch
const handleMetadataRetry = () => {
  const target = classroomStore.classrooms.find(
    (c) => String(c.code_id) === codeId.value,
  )
  if (target) {
    setInitialFromClassroom(target)
    isPageLoading.value = false
  }
}

// Watchers for route context changes
watch(
  codeId,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      loadClassroom()
    }
  },
  { immediate: true },
)

watch(
  () => classroomStore.currentClassroom,
  (classroom) => {
    if (
      classroom &&
      !isDirty.value &&
      !isSaving.value &&
      String(classroom.code_id) === codeId.value
    ) {
      setInitialFromClassroom(classroom)
      isPageLoading.value = false
    }
  },
)

// Confirmation message for discard warnings
const confirmDiscard = (actionMessage = 'leave this page') => {
  return window.confirm(
    `You have unsaved changes. Are you sure you want to discard them and ${actionMessage}?`,
  )
}

// Navigation guards: Route departure
onBeforeRouteLeave((to, from, next) => {
  // Once authentication has ended (e.g. after confirmed logout) or controlled redirect, leave immediately
  if (isControlledRedirect.value || !authStore.isAuthenticated) {
    next()
    return
  }

  if (isDirty.value) {
    if (confirmDiscard('leave this page')) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})

// Navigation guards: Same-component classroom switching
onBeforeRouteUpdate((to, from, next) => {
  if (isControlledRedirect.value || !authStore.isAuthenticated) {
    next()
    return
  }

  if (isDirty.value) {
    if (confirmDiscard('switch classrooms')) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})

// Dynamic beforeunload listener: active only when form has unsaved edits
const handleBeforeUnload = (event) => {
  if (isDirty.value && authStore.isAuthenticated) {
    event.preventDefault()
    event.returnValue = ''
  }
}

watch(
  isDirty,
  (dirty) => {
    if (typeof window !== 'undefined') {
      if (dirty) {
        window.addEventListener('beforeunload', handleBeforeUnload)
      } else {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  isUnmounted.value = true
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
})

// Explicit save action: disables editable fields while saving and prevents overlapping delete
const handleSave = async () => {
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''

  if (
    !validateForm() ||
    !isDirty.value ||
    isSaving.value ||
    isDeleteModalOpen.value ||
    isPageLoading.value
  ) {
    return
  }

  const requestClassroomId = codeId.value
  const requestSessionToken = authStore.token

  isSaving.value = true

  try {
    const payload = {}
    const trimmedName = formName.value.trim()
    const trimmedDesc = formDescription.value.trim()

    if (trimmedName !== (initialState.value?.name || '').trim()) {
      payload.name = trimmedName
    }
    if (trimmedDesc !== (initialState.value?.description || '').trim()) {
      payload.description = trimmedDesc ? trimmedDesc : null
    }
    if (formIsActive.value !== initialState.value?.is_active) {
      payload.is_active = formIsActive.value
    }

    const updated = await updateClassroom(requestClassroomId, payload)

    // Protect against race conditions:
    // If classroom changed, component unmounted, or session changed while request was in-flight,
    // discard the response to prevent stale client-side UI corruption.
    // Note: Discarding the response does NOT undo the mutation already processed by the backend.
    if (
      isUnmounted.value ||
      codeId.value !== requestClassroomId ||
      authStore.token !== requestSessionToken
    ) {
      return
    }

    // Update shared Pinia store
    classroomStore.updateClassroomInState(updated)

    // Reset dirty baseline to current saved values
    setInitialFromClassroom(updated)
    saveSuccessMessage.value = 'Classroom settings saved successfully.'
  } catch (err) {
    if (
      isUnmounted.value ||
      codeId.value !== requestClassroomId ||
      authStore.token !== requestSessionToken
    ) {
      return
    }

    saveErrorMessage.value =
      err?.response?.data?.detail ||
      'Failed to save classroom settings. Please verify connection and try again.'
  } finally {
    if (
      !isUnmounted.value &&
      codeId.value === requestClassroomId &&
      authStore.token === requestSessionToken
    ) {
      isSaving.value = false
    }
  }
}

// Reset changes action
const handleReset = () => {
  if (initialState.value) {
    setInitialFromClassroom(initialState.value)
    saveSuccessMessage.value = ''
    saveErrorMessage.value = ''
  }
}

// Deletion handling: prevent opening delete modal while saving or loading
const openDeleteModal = () => {
  if (isSaving.value || isPageLoading.value) return
  isDeleteModalOpen.value = true
}

const handleClassroomDeleted = (deletedClassroom) => {
  const currentToken = authStore.token
  // Ignore obsolete completion events after unmount, classroom change, or session change
  if (
    isUnmounted.value ||
    codeId.value !== deletedClassroom?.code_id ||
    !currentToken
  ) {
    return
  }

  // Mark controlled redirect so discard prompt is exempt
  isControlledRedirect.value = true

  // Remove classroom from shared store using code_id only
  classroomStore.removeClassroomFromState(deletedClassroom.code_id)

  // Navigate to management page with one-time flash feedback
  router.push({
    path: '/classroom/manage',
    state: {
      flashMessage: `Classroom "${deletedClassroom?.name || 'Classroom'}" was soft-deleted.`,
    },
  })
}

// Check if classroom is confirmed not found
const isClassroomNotFound = computed(() => {
  if (classroomStore.isLoading || !classroomStore.isFetched || isPageLoading.value) return false
  return !classroomStore.classrooms.some(
    (c) => String(c.code_id) === codeId.value,
  )
})

onMounted(() => {
  loadClassroom()
})
</script>

<template>
  <div class="settings-workspace-page">
    <ClassroomWorkspaceHeader
      page-title="Classroom settings"
      page-description="Update classroom details and control enrollment availability."
      :code-id="codeId"
      :originating-roster-page="originatingRosterPage"
      active-tab="settings"
      @retry-metadata="handleMetadataRetry"
    />

    <!-- Classroom Not Found -->
    <div v-if="isClassroomNotFound" class="not-found-card" role="region" aria-label="Classroom not found">
      <div class="not-found-body">
        <h3 class="not-found-title">Classroom not found</h3>
        <p class="not-found-desc">
          The requested classroom could not be found or has been removed.
        </p>
        <router-link to="/classroom/manage" class="btn-return-link">
          ◀ Return to all classrooms
        </router-link>
      </div>
    </div>

    <!-- Main Settings Container -->
    <main v-else class="settings-container">
      <!-- General Settings Card -->
      <section class="settings-card" aria-labelledby="general-settings-title">
        <header class="card-header">
          <h3 id="general-settings-title" class="card-title">Classroom settings</h3>
          <p class="card-subtitle">
            Update classroom identification, descriptive details, and enrollment status.
          </p>
        </header>

        <!-- Feedback Banners -->
        <div v-if="saveSuccessMessage" class="feedback-banner success-banner" role="status">
          <span>{{ saveSuccessMessage }}</span>
        </div>

        <div v-if="saveErrorMessage" class="feedback-banner error-banner" role="alert">
          <span>{{ saveErrorMessage }}</span>
        </div>

        <form class="settings-form" @submit.prevent="handleSave">
          <!-- Classroom Name -->
          <div class="form-group">
            <div class="label-row">
              <label for="classroom-name" class="form-label">
                Classroom name <span class="required-star">*</span>
              </label>
              <span class="char-count" :class="{ 'char-count-error': formName.trim().length > 100 }">
                {{ formName.trim().length }}/100
              </span>
            </div>
            <input
              id="classroom-name"
              v-model="formName"
              type="text"
              class="form-input"
              :class="{ 'input-error': nameError }"
              placeholder="e.g. BSIT 4A - Cybersecurity"
              maxlength="105"
              required
              :disabled="isSaving || isDeleteModalOpen || isPageLoading"
              @input="handleNameInput"
            />
            <p v-if="nameError" class="field-error" role="alert">{{ nameError }}</p>
            <p v-else class="field-hint">
              Trimmed name must be between 1 and 100 single-line characters without control symbols.
            </p>
          </div>

          <!-- Description -->
          <div class="form-group">
            <div class="label-row">
              <label for="classroom-description" class="form-label">
                Description <span class="optional-tag">(optional)</span>
              </label>
              <span class="char-count" :class="{ 'char-count-error': formDescription.trim().length > 500 }">
                {{ formDescription.trim().length }}/500
              </span>
            </div>
            <textarea
              id="classroom-description"
              v-model="formDescription"
              class="form-textarea"
              :class="{ 'input-error': descriptionError }"
              rows="3"
              placeholder="Describe syllabus topics, learning goals, or cohort details..."
              maxlength="520"
              :disabled="isSaving || isDeleteModalOpen || isPageLoading"
              @input="handleDescriptionInput"
            />
            <p v-if="descriptionError" class="field-error" role="alert">{{ descriptionError }}</p>
            <p v-else class="field-hint">
              Optional cohort context up to 500 characters. Blanking or clearing this field removes the description.
            </p>
          </div>

          <!-- Active Status Toggle -->
          <div class="form-group checkbox-group">
            <label class="checkbox-container">
              <input
                id="classroom-is-active"
                v-model="formIsActive"
                type="checkbox"
                class="checkbox-input"
                :disabled="isSaving || isDeleteModalOpen || isPageLoading"
              />
              <span class="checkbox-custom" />
              <span class="checkbox-label-content">
                <span class="checkbox-title">Active classroom</span>
                <span class="checkbox-desc">
                  When active, students can join this classroom using its access code. When inactive, new enrollments are blocked.
                </span>
              </span>
            </label>
          </div>

          <!-- Form Action Bar -->
          <div class="form-actions">
            <button
              type="submit"
              class="btn-save"
              :disabled="!isDirty || !isValid || isSaving || isDeleteModalOpen || isPageLoading"
            >
              {{ isSaving ? 'Saving changes...' : 'Save changes' }}
            </button>

            <button
              v-if="isDirty"
              type="button"
              class="btn-reset"
              :disabled="isSaving || isDeleteModalOpen || isPageLoading"
              @click="handleReset"
            >
              Discard changes
            </button>
          </div>
        </form>
      </section>

      <!-- Danger Zone Card -->
      <section class="settings-card danger-card" aria-labelledby="danger-zone-title">
        <header class="card-header danger-header">
          <h3 id="danger-zone-title" class="card-title danger-title">Danger zone</h3>
          <p class="card-subtitle">
            Soft-delete classroom. Once soft-deleted, the classroom is removed from active educator views and its access code is deactivated.
          </p>
        </header>

        <div class="danger-action-row">
          <div class="danger-info">
            <strong class="danger-action-name">Delete classroom</strong>
            <p class="danger-action-desc">
              Soft-delete this classroom code. The classroom is removed from active views and its access code is deactivated.
            </p>
          </div>
          <button
            type="button"
            class="btn-delete"
            :disabled="isSaving || isDeleteModalOpen || isPageLoading"
            @click="openDeleteModal"
          >
            Delete classroom
          </button>
        </div>
      </section>
    </main>

    <!-- Delete Confirmation Modal -->
    <ClassroomDeleteModal
      :is-open="isDeleteModalOpen"
      :classroom="classroomStore.currentClassroom"
      @close="isDeleteModalOpen = false"
      @deleted="handleClassroomDeleted"
    />
  </div>
</template>

<style scoped>
.settings-workspace-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 0 2.5rem 0;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-card {
  background-color: var(--color-card, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 1.75rem 1.5rem;
  box-shadow: var(--shadow-card, 0 1px 3px 0 rgba(15, 23, 42, 0.06));
}

@media (max-width: 640px) {
  .settings-card {
    padding: 1.25rem 1rem;
  }
}

.card-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  padding-bottom: 1rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
  margin: 0 0 0.35rem 0;
}

.card-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-muted, #64748b);
  margin: 0;
  line-height: 1.45;
}

/* Feedback Banners */
.feedback-banner {
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.success-banner {
  background-color: var(--color-success-bg, #ecfdf5);
  color: var(--color-success, #059669);
  border: 1px solid var(--color-success-border, #a7f3d0);
}

.error-banner {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
}

/* Form Styles */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-main, #0f172a);
}

.required-star {
  color: var(--color-danger, #dc2626);
}

.optional-tag {
  font-weight: 400;
  color: var(--color-text-muted, #64748b);
  font-size: 0.8rem;
}

.char-count {
  font-size: 0.8rem;
  color: var(--color-text-muted, #64748b);
}

.char-count-error {
  color: var(--color-danger, #dc2626);
  font-weight: 600;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.65rem 0.85rem;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--color-text-main, #0f172a);
  background-color: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: 8px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #7c3aed);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.input-error {
  border-color: var(--color-danger, #dc2626) !important;
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15) !important;
}

.field-error {
  margin: 0.2rem 0 0 0;
  font-size: 0.825rem;
  color: var(--color-danger, #dc2626);
  font-weight: 500;
}

.field-hint {
  margin: 0.2rem 0 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.35;
}

/* Checkbox Toggle */
.checkbox-group {
  padding-top: 0.5rem;
}

.checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  height: 20px;
  width: 20px;
  min-width: 20px;
  background-color: var(--color-bg, #ffffff);
  border: 1.5px solid var(--color-border, #cbd5e1);
  border-radius: 4px;
  margin-top: 2px;
  transition: all 0.15s ease;
  position: relative;
}

.checkbox-container:hover .checkbox-input ~ .checkbox-custom {
  border-color: var(--color-primary, #7c3aed);
}

.checkbox-input:checked ~ .checkbox-custom {
  background-color: var(--color-primary, #7c3aed);
  border-color: var(--color-primary, #7c3aed);
}

.checkbox-input:checked ~ .checkbox-custom:after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-container:focus-within .checkbox-custom {
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
}

.checkbox-label-content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.checkbox-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main, #0f172a);
}

.checkbox-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.4;
}

/* Form Action Buttons */
.form-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.btn-save {
  padding: 0.65rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: var(--color-primary, #7c3aed);
  color: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.btn-save:hover:not(:disabled) {
  background-color: var(--color-primary-hover, #6d28d9);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-reset {
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--color-border, #cbd5e1);
  background-color: transparent;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset:hover:not(:disabled) {
  color: var(--color-text-main, #0f172a);
  border-color: var(--color-text-muted, #64748b);
}

/* Danger Zone Card */
.danger-card {
  border-color: var(--color-danger-border, #fecaca);
}

.danger-header {
  border-bottom-color: var(--color-danger-border, #fecaca);
}

.danger-title {
  color: var(--color-danger, #dc2626);
}

.danger-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.danger-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.danger-action-name {
  font-size: 0.95rem;
  color: var(--color-text-main, #0f172a);
}

.danger-action-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted, #64748b);
}

.btn-delete {
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid var(--color-danger, #dc2626);
  background-color: #ffffff;
  color: var(--color-danger, #dc2626);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-delete:hover {
  background-color: var(--color-danger, #dc2626);
  color: #ffffff;
}

/* Not Found Card */
.not-found-card {
  background-color: var(--color-card, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: var(--shadow-card, 0 1px 3px 0 rgba(15, 23, 42, 0.06));
}

.not-found-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
  margin-bottom: 0.5rem;
}

.not-found-desc {
  font-size: 0.95rem;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 1.5rem;
}

.btn-return-link {
  display: inline-flex;
  align-items: center;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary, #7c3aed);
  text-decoration: none;
}

.btn-return-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .settings-card {
    padding: 1.25rem 1.25rem;
  }

  .danger-action-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-delete {
    width: 100%;
    text-align: center;
  }
}
</style>
