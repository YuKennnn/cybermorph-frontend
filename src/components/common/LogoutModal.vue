<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  isLoggingOut: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const modalRef = ref(null)
const cancelBtnRef = ref(null)

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
    if (!props.isLoggingOut) {
      emit('close')
    }
    return
  }
  trapFocus(event)
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        cancelBtnRef.value?.focus()
      })
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="modalRef"
      class="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-desc"
      @click.self="!isLoggingOut && emit('close')"
    >
      <div class="logout-modal-card">
        <div class="logout-modal-header">
          <h3 id="logout-dialog-title" class="logout-modal-title">Sign out</h3>
          <button
            type="button"
            class="logout-close-btn"
            aria-label="Close sign out dialog"
            :disabled="isLoggingOut"
            @click="!isLoggingOut && emit('close')"
          >
            ✕
          </button>
        </div>

        <p id="logout-dialog-desc" class="logout-modal-desc">
          Are you sure you want to sign out of your account? Any unsaved changes on the current page will be discarded.
        </p>

        <div class="logout-modal-buttons">
          <button
            ref="cancelBtnRef"
            type="button"
            class="btn-cancel"
            :disabled="isLoggingOut"
            @click="!isLoggingOut && emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-confirm-signout"
            :disabled="isLoggingOut"
            @click="emit('confirm')"
          >
            {{ isLoggingOut ? 'Signing out...' : 'Sign out' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.logout-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  animation: fadeIn 0.15s ease-out;
}

.logout-modal-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  max-width: 440px;
  width: 100%;
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  animation: scaleUp 0.15s ease-out;
}

.logout-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.logout-modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.logout-close-btn {
  background: transparent;
  border: none;
  font-size: 1.1rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  line-height: 1;
  transition: all 0.15s ease;
}

.logout-close-btn:hover:not(:disabled) {
  color: var(--color-text-main);
  background-color: var(--color-bg-subtle);
}

.logout-close-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.logout-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logout-modal-desc {
  margin: 0 0 1.5rem 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.logout-modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel {
  padding: 0.55rem 1rem;
  min-height: 38px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-main);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

.btn-cancel:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm-signout {
  padding: 0.55rem 1.15rem;
  min-height: 38px;
  background-color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-confirm-signout:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-confirm-signout:active:not(:disabled) {
  transform: scale(0.99);
}

.btn-confirm-signout:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-confirm-signout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
