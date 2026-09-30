<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { generateClassroomCode } from '../../api/classroom'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close', 'created'])

const newName = ref('')
const isCreating = ref(false)
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
      newName.value = ''
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

const handleSubmit = async () => {
  if (!newName.value.trim()) return

  isCreating.value = true
  errorMessage.value = ''

  try {
    const data = await generateClassroomCode({
      name: newName.value.trim(),
    })
    emit('created', data)
    emit('close')
  } catch {
    errorMessage.value = 'Failed to generate classroom. Please verify connection.'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-modal-title"
    @click.self="emit('close')"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="create-modal-title" class="modal-title">Generate New Classroom</h3>
        <button class="close-btn" aria-label="Close dialog" @click="emit('close')">✕</button>
      </div>
      <p class="modal-desc">Create a classroom deployment and issue an access key for your students.</p>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="new-name">Classroom Sector Name</label>
          <input
            id="new-name"
            v-model="newName"
            type="text"
            placeholder="e.g. Advanced Network Defense"
            required
            autocomplete="off"
          />
        </div>

        <div class="modal-buttons">
          <button type="button" class="btn-cancel" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="isCreating">
            {{ isCreating ? 'Generating...' : 'Generate Code' }}
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
