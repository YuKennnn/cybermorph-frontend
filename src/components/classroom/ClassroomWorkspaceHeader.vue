<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useClassroomStore } from '../../stores/classroomStore.js'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  codeId: {
    type: String,
    required: true,
  },
  activeTab: {
    type: String,
    default: 'students',
    validator: (val) => ['students', 'analytics', 'settings'].includes(val),
  },
  studentCount: {
    type: Number,
    default: null,
  },
  isCountLoading: {
    type: Boolean,
    default: false,
  },
  countError: {
    type: Boolean,
    default: false,
  },
  originatingRosterPage: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['retry-metadata'])

const classroomStore = useClassroomStore()

const activeClassroom = computed(() => {
  return classroomStore.currentClassroom
})

const isLoading = computed(() => {
  return classroomStore.isLoading && !activeClassroom.value
})

const metadataError = computed(() => {
  return classroomStore.error && !activeClassroom.value ? classroomStore.error : ''
})

const displayName = computed(() => {
  if (activeClassroom.value?.name) return activeClassroom.value.name
  if (isLoading.value) return 'Loading classroom...'
  if (metadataError.value) return 'Classroom unavailable'
  return 'Classroom'
})

// Documented access code: only code_value is valid. Never display code_id.
const accessCode = computed(() => {
  return activeClassroom.value?.code_value || ''
})

// Status is confirmed boolean only
const hasConfirmedStatus = computed(() => {
  return typeof activeClassroom.value?.is_active === 'boolean'
})

const isActive = computed(() => {
  return activeClassroom.value?.is_active === true
})

// Student count evaluation: strictly distinguish loading, error, and confirmed (including 0)
const hasCountError = computed(() => {
  return props.countError || Boolean(metadataError.value)
})

const isCountLoading = computed(() => {
  return props.isCountLoading || isLoading.value
})

const confirmedStudentCount = computed(() => {
  if (hasCountError.value || isCountLoading.value) {
    return null
  }
  if (typeof props.studentCount === 'number') {
    return props.studentCount
  }
  if (typeof activeClassroom.value?.student_count === 'number') {
    return activeClassroom.value.student_count
  }
  return null
})

// Truthful Clipboard Handling
const copyStatus = ref('idle') // 'idle' | 'copied' | 'error'
let copyTimeout = null

const copyButtonLabel = computed(() => {
  if (copyStatus.value === 'copied') {
    return `Access code ${accessCode.value} copied to clipboard`
  }
  if (copyStatus.value === 'error') {
    return `Failed to copy access code ${accessCode.value}`
  }
  return `Copy classroom access code ${accessCode.value}`
})

const handleCopyCode = async () => {
  const code = accessCode.value
  if (!code) return

  let success
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
      success = true
    } else {
      const input = document.createElement('input')
      input.value = code
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      success = document.execCommand('copy')
      document.body.removeChild(input)
    }
  } catch {
    success = false
  }

  copyStatus.value = success ? 'copied' : 'error'

  if (copyTimeout) clearTimeout(copyTimeout)
  copyTimeout = setTimeout(() => {
    copyStatus.value = 'idle'
  }, 2000)
}

const isRetryingMetadata = ref(false)
const handleRetry = async () => {
  if (isRetryingMetadata.value) return
  isRetryingMetadata.value = true
  try {
    await classroomStore.fetchClassrooms(true)
    emit('retry-metadata')
  } catch {
    // Error is captured in classroomStore.error
  } finally {
    isRetryingMetadata.value = false
  }
}

// Navigation links
const studentsRoute = computed(() => {
  return {
    path: `/classroom/students/${props.codeId}`,
    query: props.originatingRosterPage > 1 ? { page: props.originatingRosterPage } : {},
  }
})

const analyticsRoute = computed(() => {
  return {
    path: `/analytics/${props.codeId}`,
    query: props.originatingRosterPage > 1 ? { roster_page: props.originatingRosterPage } : {},
  }
})

const settingsRoute = computed(() => {
  return {
    path: `/classroom/settings/${props.codeId}`,
    query: props.originatingRosterPage > 1 ? { roster_page: props.originatingRosterPage } : {},
  }
})

onUnmounted(() => {
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
})
</script>

<template>
  <header class="workspace-header" aria-label="Classroom workspace">
    <!-- Breadcrumb -->
    <div class="breadcrumb-bar">
      <router-link to="/classroom/manage" class="back-link">
        ◀ Return to all classrooms
      </router-link>
    </div>

    <!-- Metadata Error Banner & Retry -->
    <div v-if="metadataError" class="metadata-error-banner" role="alert">
      <AppIcon name="alert" :size="16" class="error-icon" />
      <span class="error-text">{{ metadataError }}</span>
      <button
        type="button"
        class="btn-retry-metadata"
        :disabled="isRetryingMetadata"
        @click="handleRetry"
      >
        {{ isRetryingMetadata ? 'Retrying...' : 'Try again' }}
      </button>
    </div>

    <!-- Identity Banner -->
    <div class="identity-banner">
      <div class="identity-main">
        <div class="title-row">
          <h1 class="classroom-title" :class="{ 'loading-text': isLoading }">
            {{ displayName }}
          </h1>

          <!-- Confirmed Status Pill Only -->
          <span
            v-if="hasConfirmedStatus"
            class="status-pill"
            :class="isActive ? 'active' : 'inactive'"
          >
            <span class="badge-dot"></span>
            {{ isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <!-- Access Code Row: rendered only when code_value is available -->
        <div v-if="accessCode" class="code-cluster">
          <span class="code-label">Access code:</span>
          <span class="code-pill" aria-label="Classroom access code">{{ accessCode }}</span>

          <button
            type="button"
            class="btn-copy"
            :class="{ copied: copyStatus === 'copied', error: copyStatus === 'error' }"
            :aria-label="copyButtonLabel"
            @click="handleCopyCode"
          >
            <AppIcon v-if="copyStatus === 'copied'" name="check" :size="14" />
            <AppIcon v-else-if="copyStatus === 'error'" name="alert" :size="14" />
            <AppIcon v-else name="copy" :size="14" />
            <span class="copy-label">
              {{ copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy code' }}
            </span>
          </button>
        </div>

        <div v-else-if="isLoading" class="code-placeholder">
          <span class="placeholder-text">Loading access code...</span>
        </div>
      </div>

      <div class="identity-meta">
        <!-- Failed / Unavailable count state -->
        <span
          v-if="hasCountError"
          class="count-badge count-error"
          aria-live="polite"
        >
          <AppIcon name="users" :size="15" class="badge-icon" />
          Enrolled students: <span class="count-state">Unavailable</span>
        </span>

        <!-- Loading count state -->
        <span
          v-else-if="isCountLoading"
          class="count-badge count-loading"
          aria-live="polite"
        >
          <AppIcon name="users" :size="15" class="badge-icon" />
          Enrolled students: <span class="count-state">Loading...</span>
        </span>

        <!-- Confirmed student count (including confirmed 0) -->
        <span
          v-else-if="confirmedStudentCount !== null"
          class="count-badge"
          aria-label="Enrolled student count"
        >
          <AppIcon name="users" :size="15" class="badge-icon" />
          Enrolled students: <strong>{{ confirmedStudentCount }}</strong>
        </span>

        <!-- Uninitialized / Initial placeholder -->
        <span
          v-else
          class="count-badge count-loading"
          aria-live="polite"
        >
          <AppIcon name="users" :size="15" class="badge-icon" />
          Enrolled students: <span class="count-state">—</span>
        </span>
      </div>
    </div>

    <!-- Workspace Navigation Links (Not Tablist) -->
    <nav class="workspace-nav" aria-label="Classroom navigation">
      <router-link
        :to="studentsRoute"
        class="nav-link"
        :class="{ active: activeTab === 'students' }"
        :aria-current="activeTab === 'students' ? 'page' : undefined"
      >
        <AppIcon name="users" :size="16" />
        <span>Students</span>
      </router-link>

      <router-link
        :to="analyticsRoute"
        class="nav-link"
        :class="{ active: activeTab === 'analytics' }"
        :aria-current="activeTab === 'analytics' ? 'page' : undefined"
      >
        <AppIcon name="analytics" :size="16" />
        <span>Analytics</span>
      </router-link>

      <router-link
        :to="settingsRoute"
        class="nav-link"
        :class="{ active: activeTab === 'settings' }"
        :aria-current="activeTab === 'settings' ? 'page' : undefined"
      >
        <AppIcon name="settings" :size="16" />
        <span>Settings</span>
      </router-link>
    </nav>
  </header>
</template>

<style scoped>
.workspace-header {
  background-color: var(--color-card, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 1.5rem 1.75rem 0 1.75rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-card, 0 1px 3px 0 rgba(15, 23, 42, 0.06));
}

.breadcrumb-bar {
  margin-bottom: 0.85rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary, #7c3aed);
  text-decoration: none;
  transition: color 0.15s ease;
}

.back-link:hover {
  color: var(--color-primary-hover, #6d28d9);
  text-decoration: underline;
}

/* Metadata Error Banner */
.metadata-error-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background-color: var(--color-danger-bg, #fef2f2);
  border: 1px solid var(--color-danger-border, #fecaca);
  color: var(--color-danger, #dc2626);
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.error-text {
  flex: 1;
}

.btn-retry-metadata {
  background: var(--color-danger, #dc2626);
  color: #ffffff;
  border: none;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-retry-metadata:hover {
  opacity: 0.9;
}

.identity-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle, #f1f5f9);
}

.identity-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.classroom-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
  margin: 0;
  line-height: 1.2;
}

.classroom-title.loading-text {
  color: var(--color-text-muted, #475569);
  font-weight: 500;
}

/* Status Pill & Dot */
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  display: inline-block;
}

/* Access Code & Copy Cluster */
.code-cluster {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.code-label {
  color: var(--color-text-muted, #475569);
  font-weight: 500;
}

.code-pill {
  font-family: var(--font-mono, monospace);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-text-main, #0f172a);
  background-color: var(--color-bg-subtle, #f1f5f9);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--color-border, #e2e8f0);
}

.code-placeholder {
  font-size: 0.85rem;
  color: var(--color-text-dim, #94a3b8);
  font-style: italic;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.55rem;
  background-color: transparent;
  color: var(--color-text-muted, #475569);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  font-family: var(--font-sans, inherit);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-copy:hover {
  background-color: var(--color-bg-subtle, #f1f5f9);
  color: var(--color-text-main, #0f172a);
  border-color: var(--color-border-hover, #cbd5e1);
}

.btn-copy.copied {
  background-color: var(--color-success-bg, #ecfdf5);
  border-color: var(--color-success-border, #a7f3d0);
  color: var(--color-success, #059669);
}

.btn-copy.error {
  background-color: var(--color-danger-bg, #fef2f2);
  border-color: var(--color-danger-border, #fecaca);
  color: var(--color-danger, #dc2626);
}

.copy-label {
  line-height: 1;
}

/* Enrolled Students Badge */
.identity-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted, #475569);
  background-color: var(--color-bg-subtle, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.badge-icon {
  color: var(--color-primary, #7c3aed);
}

.count-badge strong {
  color: var(--color-text-main, #0f172a);
}

.count-badge.count-loading {
  color: var(--color-text-muted, #475569);
  font-style: italic;
  opacity: 0.85;
}

.count-badge.count-error {
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger-border, #fecaca);
  background-color: var(--color-danger-bg, #fef2f2);
}

.count-badge.count-error .badge-icon {
  color: var(--color-danger, #dc2626);
}

/* Workspace Navigation Links */
.workspace-nav {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.35rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.75rem 0.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-muted, #475569);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
}

.nav-link:hover:not(.nav-link-disabled) {
  color: var(--color-primary, #7c3aed);
}

.nav-link.active {
  color: var(--color-primary, #7c3aed);
  border-bottom-color: var(--color-primary, #7c3aed);
}

.nav-link.nav-link-disabled {
  color: var(--color-text-dim, #94a3b8);
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .workspace-header {
    padding: 1.25rem 1rem 0 1rem;
  }
  .identity-banner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
