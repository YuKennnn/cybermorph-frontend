# Component Architecture & Decomposition Standards

## Context & Component Hierarchy

The CyberMorph frontend follows a domain-driven component structure under `src/components/`, separating reusable UI building blocks from page-level routing views (`src/views/`):

```
src/
├── components/
│   ├── analytics/
│   │   ├── ThreatPerformanceGauge.vue      # Reusable SVG telemetry dial gauge
│   │   ├── StudentProficiencyModal.vue     # Level 2 student telemetry breakdown modal
│   │   └── SessionTelemetryModal.vue       # Level 3 session attack event telemetry modal
│   ├── classroom/
│   │   ├── ClassroomCard.vue               # Reusable classroom deployment card with code copy
│   │   ├── ClassroomCreateModal.vue        # Generation flow modal for new classroom access codes
│   │   ├── ClassroomEditModal.vue          # Modal to update classroom metadata and active state
│   │   └── ClassroomDeleteModal.vue        # Soft-delete confirmation modal
│   ├── common/
│   │   └── AppIcon.vue                     # Zero-dependency accessible functional SVG icons
│   ├── landing/
│   │   ├── HeroSimulationCanvas.vue        # 2D procedural HTML5 canvas mini-game
│   │   ├── ThreatCurriculumCard.vue        # Modular threat category showcase card
│   │   └── MapShowcaseCard.vue             # Retro 4:3 simulation sector showcase card
│   └── SidebarNav.vue                      # Primary authenticated navigation sidebar with mobile drawer
```

### Component Principles
- **Maintainability First**: Keep Vue single-file components with `<script setup>`, `<template>`, and `<style scoped>`. Do not split single components into separate files solely to meet arbitrary line counts.
- **Component Reuse**: Reuse existing components (such as `ClassroomCard.vue` on both the dashboard and management views) with conditional props to avoid duplicating presentation logic.
- **Props and Emits**: Explicitly define interface contracts with `defineProps` and `defineEmits`.
- **API & State Boundaries**: Keep network communication in `src/api/` and global authentication in Pinia stores.


---

## Implementation Example: Extracting `BaseModal.vue`

### `src/components/common/BaseModal.vue`
```vue
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
1. Break down each monolith incrementally, verifying that props and emits (`defineProps`, `defineEmits`) are strictly typed.
2. Confirm that parent views handle state changes via emitted events (`@close`, `@success`).
3. Run `npm run lint` and `npm run build` after extracting each component.
