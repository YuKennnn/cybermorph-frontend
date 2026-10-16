<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { deleteClassroom } from '../../api/classroom'
import { useAuthStore } from '../../stores/authStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  classroom: {
    type: Object,
    default: null,
  },
  fallbackFocusSelector: {
    type: String,
    default: '.btn-outline-sm',
  },
})

const emit = defineEmits(['close', 'deleted'])

const authStore = useAuthStore()
const modalRef = ref(null)
const cancelBtnRef = ref(null)
let previousActiveElement = null

const isDeleting = ref(false)
const errorMessage = ref('')
const isUnmounted = ref(false)

const trapFocus = (event) => {
  if (event.key !== 'Tab' || !modalRef.value) return
  const focusables = modalRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === last) {
      first.focus()
      event.preventDefault()
    }
  }
}

const handleKeyDown = (event) => {
  if (!props.isOpen) return
  if (event.key === 'Escape') {
    if (!isDeleting.value) {
      emit('close')
    }
    return
  }
  trapFocus(event)
}

watch(
  () => props.isOpen,
  (open, oldOpen) => {
    if (open) {
      errorMessage.value = ''
      previousActiveElement = document.activeElement
      document.body.style.overflow = 'hidden'
      nextTick(() => {
        if (cancelBtnRef.value) {
          cancelBtnRef.value.focus()
        }
      })
    } else if (oldOpen) {
      nextTick(() => {
        if (!document.querySelector('.modal-backdrop')) {
          document.body.style.overflow = ''
        }
      })
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === 'function' &&
        previousActiveElement !== document.body &&
        document.body.contains(previousActiveElement)
      ) {
        previousActiveElement.focus()
      } else if (props.fallbackFocusSelector) {
        const fallback = document.querySelector(props.fallbackFocusSelector)
        if (fallback && typeof fallback.focus === 'function') {
          fallback.focus()
        }
      }
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  isUnmounted.value = true
  window.removeEventListener('keydown', handleKeyDown)
  if (!document.querySelector('.modal-backdrop')) {
    document.body.style.overflow = ''
  }
})

const handleDelete = async () => {
  if (!props.classroom || isDeleting.value) return

  const targetCodeId = props.classroom.code_id
  if (!targetCodeId) return

  // Capture target classroom and auth-session context BEFORE the request
  const capturedClassroom = { ...props.classroom }
  const capturedSessionToken = authStore.token

  isDeleting.value = true
  errorMessage.value = ''

  try {
    await deleteClassroom(targetCodeId)

    // Ignore obsolete completion events after unmount, classroom change, or session change
    if (
      isUnmounted.value ||
      props.classroom?.code_id !== targetCodeId ||
      authStore.token !== capturedSessionToken
    ) {
      return
    }

    // Emit the captured classroom, not later props
    emit('deleted', capturedClassroom)
    emit('close')
  } catch {
    if (
      isUnmounted.value ||
      props.classroom?.code_id !== targetCodeId ||
      authStore.token !== capturedSessionToken
    ) {
      return
    }
    errorMessage.value = 'Failed to delete classroom. Please verify connection.'
  } finally {
    if (
      !isUnmounted.value &&
      props.classroom?.code_id === targetCodeId &&
      authStore.token === capturedSessionToken
    ) {
      isDeleting.value = false
    }
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    ref="modalRef"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    @click.self="!isDeleting && emit('close')"
  >
    <div class="modal-card danger-modal">
      <div class="modal-header">
        <h3 id="delete-modal-title" class="modal-title danger-title">Delete classroom</h3>
        <button
          class="close-btn"
          aria-label="Close dialog"
          :disabled="isDeleting"
          @click="!isDeleting && emit('close')"
        >
          ✕
        </button>
      </div>

      <div v-if="errorMessage" class="error-banner" role="alert">
        {{ errorMessage }}
      </div>

      <p class="modal-desc">
        Are you sure you want to delete <strong>"{{ classroom?.name }}"</strong>?
        This classroom will be removed from your classroom lists and its access code will be deactivated.
      </p>

      <div class="modal-buttons">
        <button
          ref="cancelBtnRef"
          type="button"
          class="btn-cancel"
          :disabled="isDeleting"
          @click="!isDeleting && emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-danger"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete classroom' }}
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
  color: var(--color-card);
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
