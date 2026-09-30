# Component Decomposition & Monolithic Views

## Context & Problem Statement

In the CyberMorph frontend codebase, `src/components/` currently contains only a single shared component (`SidebarNav.vue`). In contrast, several view components have grown into massive monoliths exceeding several hundred to over a thousand lines of code:

1. **`src/views/EducatorAnalyticsView.vue` (1,686 lines)**:
   - Contains 3 levels of analytics drill-downs:
     - Level 1: Aggregate classroom overview, performance cards, and student roster table.
     - Level 2: Student proficiency breakdown modal with inline progress meters.
     - Level 3: Session telemetry detail modal with threat event lists and attack breakdowns.
   - Embeds complex inline SVG dial gauges and custom chart elements.
2. **`src/views/LandingView.vue` (1,501 lines)**:
   - Inlines approximately 450 lines of an interactive 2D HTML5 canvas procedural game engine (operative tracking, server rack breach collisions, crosshairs).
   - Inlines hero section, 3 core pillars, 8 threat curriculum cards, and 4-sector map showcase cards.
3. **`src/views/ClassroomManagementView.vue` (775 lines)**:
   - Inlines three modal dialogs (Create Classroom, Edit Configuration, Delete Confirmation) directly inside the main view markup.

### Architectural Risks
- **Poor Maintainability**: Difficult to isolate and test logic when state for three distinct user journeys lives in one file.
- **Merge Conflicts**: Multiple developers working on different modals or cards in the same file risk continuous merge conflicts.
- **No Reusability**: Gauges, cards, and modal shells cannot be reused in student or admin views.
- **Testing & Verification Complexity**: Impossible to mount and unit-test a modal dialog or dial gauge in isolation.

---

## Recommended Decomposition Plan

```
src/
├── components/
│   ├── analytics/
│   │   ├── ThreatPerformanceGauge.vue      # Reusable SVG telemetry dial
│   │   ├── StudentProficiencyModal.vue     # Level 2 drilldown modal
│   │   └── SessionTelemetryModal.vue       # Level 3 session event modal
│   ├── classroom/
│   │   ├── ClassroomCard.vue               # Roster card with 2-tier action buttons
│   │   ├── ClassroomCreateModal.vue        # Modal to generate new classroom code
│   │   ├── ClassroomEditModal.vue          # Modal to update name/active status
│   │   └── ClassroomDeleteModal.vue        # Modal for soft-delete confirmation
│   ├── landing/
│   │   ├── HeroSimulationCanvas.vue        # 2D canvas mini-game simulation
│   │   ├── ThreatCurriculumCard.vue        # Monospace threat card (THREAT 01-08)
│   │   └── MapShowcaseCard.vue             # Retro 4:3 simulation sector card
│   └── common/
│       └── BaseModal.vue                   # Reusable accessible dialog backdrop & shell
```

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
