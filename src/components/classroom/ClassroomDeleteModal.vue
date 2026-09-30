<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { deleteClassroom } from '../../api/classroom'

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

const emit = defineEmits(['close', 'deleted'])

const isDeleting = ref(false)
const errorMessage = ref('')

const handleKeyDown = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      errorMessage.value = ''
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

const handleDelete = async () => {
  if (!props.classroom) return

  isDeleting.value = true
  errorMessage.value = ''

  try {
    await deleteClassroom(props.classroom.id)
    emit('deleted', props.classroom)
    emit('close')
  } catch {
    errorMessage.value = 'Failed to delete classroom. Please verify connection.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    @click.self="emit('close')"
  >
    <div class="modal-card danger-modal">
      <div class="modal-header">
        <h3 id="delete-modal-title" class="modal-title danger-title">Confirm Deletion</h3>
        <button class="close-btn" aria-label="Close dialog" @click="emit('close')">✕</button>
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <p class="modal-desc">
        Are you sure you want to soft-delete <strong>"{{ classroom?.name }}"</strong>?
        Enrolled students will no longer synchronize progress to this classroom.
      </p>

      <div class="modal-buttons">
        <button type="button" class="btn-cancel" @click="emit('close')">
          Cancel
        </button>
        <button
          type="button"
          class="btn-danger"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete Classroom' }}
        </button>
      </div>
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

.danger-modal {
  border-color: var(--color-danger-border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-title {
  margin: 0;
  font-size: 1.35rem;
}

.danger-title {
  color: var(--color-danger);
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

.modal-desc {
  margin: 0 0 1.75rem 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
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

.btn-danger {
  padding: 0.65rem 1.25rem;
  background: var(--color-danger);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
