<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { updateClassroom } from '../../api/classroom'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  classroom: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'updated'])

const editName = ref('')
const editIsActive = ref(true)
const isUpdating = ref(false)
const errorMessage = ref('')

const handleKeyDown = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

watch(
  () => props.classroom,
  (curr) => {
    if (curr) {
      editName.value = curr.name || ''
      editIsActive.value = curr.is_active ?? true
      errorMessage.value = ''
    }
  },
  { immediate: true },
)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const handleSubmit = async () => {
  if (!props.classroom || !editName.value.trim()) return

  isUpdating.value = true
  errorMessage.value = ''

  try {
    const targetId = props.classroom.code_id || props.classroom.id
    await updateClassroom(targetId, {
      name: editName.value.trim(),
      is_active: editIsActive.value,
    })
    emit('updated')
    emit('close')
  } catch {
    errorMessage.value = 'Failed to update classroom. Please verify connection.'
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-modal-title"
    @click.self="emit('close')"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="edit-modal-title" class="modal-title">Edit Classroom Configuration</h3>
        <button class="close-btn" aria-label="Close dialog" @click="emit('close')">✕</button>
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleSubmit">
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
          <button type="button" class="btn-cancel" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="isUpdating">
            {{ isUpdating ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
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
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(124, 58, 237, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.35rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-dim);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.form-group {
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
}

.form-group-checkbox {
  margin-bottom: 1.75rem;
}

.form-group-checkbox label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.88rem;
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1.4;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.4rem;
}

input[type='text'] {
  padding: 0.75rem 1rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s ease;
}

input[type='text']:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel {
  padding: 0.65rem 1.25rem;
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-main);
}
</style>
