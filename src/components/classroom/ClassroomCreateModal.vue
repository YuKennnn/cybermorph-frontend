<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { generateClassroomCode } from '../../api/classroom'
import { useAuthStore } from '../../stores/authStore'
import {
  useClassroomStore,
  isAllowedClassroomReturnRoute,
} from '../../stores/classroomStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  fallbackFocusSelector: {
    type: String,
    default: '.btn-primary',
  },
})

const emit = defineEmits(['close', 'created'])

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const classroomStore = useClassroomStore()

const modalRef = ref(null)
const inputRef = ref(null)
let previousActiveElement = null

const isCreating = ref(false)
const errorMessage = ref('')

const newName = computed({
  get: () => classroomStore.createDraftName,
  set: (val) => classroomStore.setCreateDraftName(val),
})

const currentReturnRoute = computed(() =>
  isAllowedClassroomReturnRoute(route.path) ? route.path : '/dashboard',
)

const showMissingDisplayNameNotice = computed(
  () =>
    classroomStore.createConflictNeedsDisplayName ||
    authStore.isEducatorMissingDisplayName,
)

const settingsRecoveryRoute = computed(() => ({
  path: '/settings',
  query: {
    section: 'account',
    from: 'classroom-create',
    returnTo: currentReturnRoute.value,
  },
}))

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
    emit('close')
    return
  }
  trapFocus(event)
}

watch(
  () => props.isOpen,
  (open, oldOpen) => {
    if (open) {
      errorMessage.value = ''
      if (authStore.hasEducatorDisplayName) {
        classroomStore.clearCreateConflict()
      }
      previousActiveElement = document.activeElement
      document.body.style.overflow = 'hidden'
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus()
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
  window.removeEventListener('keydown', handleKeyDown)
  if (!document.querySelector('.modal-backdrop')) {
    document.body.style.overflow = ''
  }
})

const handleGoToSettings = () => {
  classroomStore.markDisplayNameConflict(currentReturnRoute.value)
  emit('close')
  router.push(settingsRecoveryRoute.value)
}

const handleSubmit = async () => {
  const trimmedName = newName.value.trim()
  if (!trimmedName) return

  isCreating.value = true
  errorMessage.value = ''

  try {
    const data = await generateClassroomCode({
      name: trimmedName,
    })
    classroomStore.clearCreateDraft()
    emit('created', data)
    emit('close')
  } catch (err) {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail

    if (
      status === 409 &&
      detail &&
      typeof detail === 'object' &&
      detail.field === 'display_name'
    ) {
      classroomStore.markDisplayNameConflict(currentReturnRoute.value)
      authStore.ensureWebProfileLoaded({ force: true }).catch(() => {})
      return
    }

    if (typeof detail === 'string' && detail.trim()) {
      errorMessage.value = detail
    } else if (detail && typeof detail.message === 'string' && detail.message.trim()) {
      errorMessage.value = detail.message
    } else {
      errorMessage.value = 'Failed to generate classroom. Please verify connection.'
    }
  } finally {
    isCreating.value = false
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
    aria-labelledby="create-modal-title"
    @click.self="emit('close')"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="create-modal-title" class="modal-title">Create classroom</h3>
        <button class="close-btn" aria-label="Close dialog" @click="emit('close')">✕</button>
      </div>
      <p class="modal-desc">Create a classroom and generate an access code for your students.</p>

      <div
        v-if="showMissingDisplayNameNotice"
        class="display-name-conflict-banner"
        role="alert"
      >
        <p class="conflict-title">Set your display name before creating a classroom</p>
        <p class="conflict-desc">
          Players see your display name as their teacher. Your classroom draft is saved while you update your account settings.
        </p>
        <button
          type="button"
          class="btn-settings-link"
          @click="handleGoToSettings"
        >
          Set display name in Settings
        </button>
      </div>

      <div v-if="errorMessage" class="error-banner" role="alert">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="new-name">Classroom name</label>
          <input
            id="new-name"
            ref="inputRef"
            v-model="newName"
            type="text"
            placeholder="e.g. Introduction to Cybersecurity"
            required
            autocomplete="off"
          />
        </div>

        <div class="modal-buttons">
          <button type="button" class="btn-cancel" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="isCreating">
            {{ isCreating ? 'Creating...' : 'Create classroom' }}
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
  margin-bottom: 0.5rem;
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

.modal-desc {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.display-name-conflict-banner {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
  line-height: 1.45;
}

:root[data-theme="dark"] .display-name-conflict-banner {
  background-color: #451a03;
  border-color: #92400e;
  color: #fde68a;
}

.conflict-title {
  margin: 0 0 0.25rem 0;
  font-weight: 600;
}

.conflict-desc {
  margin: 0 0 0.65rem 0;
}

.btn-settings-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-settings-link:hover {
  background-color: var(--color-primary-hover);
}

.btn-settings-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
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
