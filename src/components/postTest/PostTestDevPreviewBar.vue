<script setup>
import { computed } from 'vue'
import { usePostTestStore } from '../../stores/postTestStore.js'
import AppIcon from '../common/AppIcon.vue'

const postTestStore = usePostTestStore()

const PREVIEW_OPTIONS = Object.freeze([
  { id: 'auto', label: 'Auto (account)' },
  { id: 'locked', label: 'Locked' },
  { id: 'available', label: 'Available' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Failed' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Error' },
])

const activeMode = computed(() => postTestStore.previewMode)
</script>

<template>
  <aside
    class="dev-preview-bar"
    aria-label="Development-only post-test state preview"
  >
    <div class="dev-preview-header">
      <div class="dev-preview-badge-row">
        <span class="dev-preview-tag">
          <AppIcon name="info" :size="14" />
          Development preview only
        </span>
        <span class="dev-preview-note">
          Mock eligibility, scoring, and state controls stay local and are not saved to the backend.
        </span>
      </div>
    </div>

    <div class="dev-preview-controls" role="group" aria-label="Preview post-test states">
      <button
        v-for="option in PREVIEW_OPTIONS"
        :key="option.id"
        type="button"
        class="dev-preview-btn"
        :class="{ 'is-active': activeMode === option.id }"
        :aria-pressed="activeMode === option.id"
        :data-preview-state="option.id"
        @click="postTestStore.setDevPreviewMode(option.id)"
      >
        {{ option.label }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.dev-preview-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.95rem 1.15rem;
  border-radius: 12px;
  border: 1px dashed var(--color-violet-border);
  background-color: var(--color-violet-subtle);
}

.dev-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dev-preview-badge-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem 0.75rem;
}

.dev-preview-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background-color: var(--color-card);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  font-size: 0.76rem;
  font-weight: 700;
}

.dev-preview-note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.dev-preview-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.dev-preview-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-control);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.dev-preview-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.dev-preview-btn.is-active {
  background: var(--btn-gradient);
  border-color: var(--color-primary);
  color: #ffffff;
}

.dev-preview-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .dev-preview-btn {
    min-height: 44px;
    flex: 1 1 auto;
  }
}
</style>
