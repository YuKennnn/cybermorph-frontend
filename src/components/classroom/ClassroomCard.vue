<script setup>
import { ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  classroom: {
    type: Object,
    required: true,
  },
  showUtilityActions: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['view-students', 'view-analytics', 'edit', 'delete'])

const copyStatus = ref('idle') // 'idle' | 'copied' | 'error'

const handleCopyCode = async () => {
  const code = props.classroom.code_value || props.classroom.code
  if (!code) return

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
      copyStatus.value = 'copied'
    } else {
      // Fallback for browsers with restricted clipboard
      const input = document.createElement('input')
      input.value = code
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      copyStatus.value = 'copied'
    }

    setTimeout(() => {
      copyStatus.value = 'idle'
    }, 2000)
  } catch {
    copyStatus.value = 'error'
    setTimeout(() => {
      copyStatus.value = 'idle'
    }, 2500)
  }
}

const formatDate = (isoString) => {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return null
  }
}
</script>

<template>
  <div class="classroom-card">
    <div class="card-header-row">
      <div class="code-cluster">
        <span class="code-pill">
          {{ classroom.code_value || classroom.code }}
        </span>
        <button
          type="button"
          class="btn-copy"
          :class="{ copied: copyStatus === 'copied', error: copyStatus === 'error' }"
          :aria-label="`Copy access code ${classroom.code_value || classroom.code}`"
          @click="handleCopyCode"
        >
          <AppIcon v-if="copyStatus === 'copied'" name="check" :size="14" />
          <AppIcon v-else-if="copyStatus === 'error'" name="alert" :size="14" />
          <AppIcon v-else name="copy" :size="14" />
          <span class="copy-label">
            {{ copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy' }}
          </span>
        </button>
      </div>

      <span :class="['status-pill', classroom.is_active ? 'active' : 'inactive']">
        <span class="badge-dot"></span>
        {{ classroom.is_active ? 'Active' : 'Inactive' }}
      </span>
    </div>

    <h3 class="classroom-name">{{ classroom.name }}</h3>

    <div class="card-meta">
      <div class="meta-item">
        <AppIcon name="users" :size="16" class="meta-icon" />
        <span class="student-count">{{ classroom.student_count || 0 }} enrolled students</span>
      </div>
      <div v-if="formatDate(classroom.created_at)" class="meta-date">
        Created {{ formatDate(classroom.created_at) }}
      </div>
    </div>

    <div class="card-actions">
      <div class="primary-actions">
        <button
          type="button"
          class="btn-action btn-roster"
          @click="$emit('view-students', classroom.code_id || classroom.id)"
        >
          <AppIcon name="users" :size="16" />
          <span>Students</span>
        </button>
        <button
          type="button"
          class="btn-action btn-analytics"
          @click="$emit('view-analytics', classroom.code_id || classroom.id || classroom.code_value)"
        >
          <AppIcon name="analytics" :size="16" />
          <span>Analytics</span>
        </button>
      </div>

      <!-- Utility actions (Edit / Delete) shown only when explicitly supported -->
      <div v-if="showUtilityActions" class="utility-actions">
        <button
          type="button"
          class="btn-utility edit"
          @click="$emit('edit', classroom)"
        >
          Edit
        </button>
        <span class="utility-divider" aria-hidden="true">·</span>
        <button
          type="button"
          class="btn-utility delete"
          @click="$emit('delete', classroom)"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classroom-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
  box-sizing: border-box;
}

.classroom-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-card-hover);
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.85rem;
  gap: 0.5rem;
}

.code-cluster {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.code-pill {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-copy:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border-color: var(--color-border-hover);
}

.btn-copy.copied {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.btn-copy.error {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.copy-label {
  line-height: 1;
}

.classroom-name {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.35;
}

.card-meta {
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border-subtle);
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.88rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.meta-icon {
  color: var(--color-primary);
}

.student-count {
  font-weight: 600;
  color: var(--color-text-main);
}

.meta-date {
  font-size: 0.8rem;
  color: var(--color-text-dim);
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
  width: 100%;
}

.btn-action {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-roster {
  background: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
}

.btn-roster:hover {
  background: var(--color-bg-muted);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.btn-analytics {
  background: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.btn-analytics:hover {
  background: var(--color-violet-subtle);
  border-color: var(--color-violet-border);
}

.utility-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn-utility {
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-utility.edit {
  color: var(--color-text-muted);
}

.btn-utility.edit:hover {
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
}

.btn-utility.delete {
  color: var(--color-text-muted);
}

.btn-utility.delete:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.utility-divider {
  color: var(--color-border);
  font-size: 0.8rem;
}

@media (max-width: 480px) {
  .primary-actions {
    grid-template-columns: 1fr;
  }
}
</style>
