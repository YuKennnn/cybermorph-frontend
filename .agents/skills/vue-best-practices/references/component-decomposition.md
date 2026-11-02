# Component Architecture & Decomposition Standards

## Context & Component Hierarchy

The CyberMorph frontend follows a domain-driven component structure under `src/components/`, separating reusable UI building blocks from page-level routing views (`src/views/`):

```
src/
├── components/
│   ├── analytics/
│   │   ├── ThreatPerformanceGauge.vue      # Reusable SVG gauge for threat success rates
│   │   ├── StudentProficiencyModal.vue     # Student progress and attack breakdown modal
│   │   └── SessionTelemetryModal.vue       # Session attack events and decisions modal
│   ├── classroom/
│   │   ├── ClassroomCard.vue               # Reusable classroom card with code copy
│   │   ├── ClassroomCreateModal.vue        # Creation modal for new classroom join codes
│   │   ├── ClassroomEditModal.vue          # Modal to update classroom name, description, and status
│   │   └── ClassroomDeleteModal.vue        # Soft-delete confirmation modal
│   ├── common/
│   │   └── AppIcon.vue                     # Zero-dependency accessible functional SVG icons
│   ├── landing/
│   │   ├── HeroSimulationCanvas.vue        # 2D procedural HTML5 canvas preview
│   │   ├── ThreatCurriculumCard.vue        # Threat category showcase card
│   │   └── MapShowcaseCard.vue             # Game map showcase card
│   └── SidebarNav.vue                      # Primary navigation sidebar with responsive mobile drawer
```

---

## Component Design Principles

1. **Maintainability First**: Use Single-File Components (`.vue`) with `<script setup>`, `<template>`, and `<style scoped>`. Do not fragment single components into separate files solely to meet arbitrary line count thresholds.
2. **Component Reuse**: Reuse existing components (such as `ClassroomCard.vue` on both the dashboard and management views) with conditional props to avoid duplicating presentation logic.
3. **Explicit Props and Emits**: Explicitly define interface contracts with `defineProps` and `defineEmits`.
4. **API & State Boundaries**: Keep network communication in `src/api/` and global authentication in Pinia stores. Keep transient UI state (such as modal open/close states) local to the view or component.
5. **Approved Terminology**: Use academic and beginner-friendly terms (e.g. *classrooms*, *maps*, *student progress*, *types of threats*) instead of sci-fi or military jargon (*sectors*, *telemetry*, *attack vectors*).

---

## Implementation Example: Reusable Modal Pattern

```vue
<!-- src/components/common/BaseModal.vue -->
<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close'])

const handleKeyDown = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click.self="emit('close')"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <button class="modal-close-btn" aria-label="Close modal" @click="emit('close')">
          ✕
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
```

---

## Verification Steps
1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that extracted components communicate solely via props and emits without direct cross-component mutations.
