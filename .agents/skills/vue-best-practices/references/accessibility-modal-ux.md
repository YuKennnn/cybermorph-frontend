# Accessibility (a11y) & Modal Dialog Standards

## Context & Problem Statement

CyberMorph is an educational platform intended for students and educators. Modal overlays and forms in views like `ClassroomManagementView.vue` and `EducatorAnalyticsView.vue` currently lack standard accessible markup:

1. **Missing ARIA Roles**:
   ```vue
   <!-- Current modal markup in ClassroomManagementView.vue -->
   <div v-if="isCreateModalOpen" class="modal-overlay" @click.self="isCreateModalOpen = false">
     <div class="modal-card">
   ```
   Screen readers cannot determine that a modal layer has taken over the interface.
2. **Missing Keyboard Dismissal (`Escape` Key)**:
   - When a modal opens, pressing the `Escape` key does not dismiss it. Users must use a mouse to find and click the close button or backdrop.
3. **No Focus Trapping**:
   - Tabbing moves focus behind the backdrop into the inactive document, disorienting keyboard-only users.

---

## Accessible Modal Pattern

All modal dialogs in CyberMorph should follow the WAI-ARIA Dialog (Modal) specification:

### Required Accessibility Features
1. **Container Attributes**:
   - `role="dialog"` or `role="alertdialog"` (for destructive confirmation modals).
   - `aria-modal="true"` to signal that background contents are inert.
   - `aria-labelledby="modal-title-id"` to announce the dialog title immediately upon focus.
2. **Keyboard Handlers**:
   - Listen for `keydown` on `window` and close when `event.key === 'Escape'`.
   - Remove the listener immediately in `onUnmounted`.
3. **Close Buttons**:
   - Provide an explicit `aria-label="Close dialog"` on any dismissal button.

### Implementation Pattern

```vue
<script setup>
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  titleId: {
    type: String,
    default: 'dialog-title',
  },
})

const emit = defineEmits(['close'])

const handleKeyDown = (e) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
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
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    @click.self="emit('close')"
  >
    <div class="modal-card">
      <header class="modal-header">
        <h3 :id="titleId" class="modal-title">
          <slot name="title" />
        </h3>
        <button
          type="button"
          class="modal-close-btn"
          aria-label="Close dialog"
          @click="emit('close')"
        >
          [ CLOSE ]
        </button>
      </header>
      <section class="modal-body">
        <slot />
      </section>
      <footer v-if="$slots.actions" class="modal-actions">
        <slot name="actions" />
      </footer>
    </div>
  </div>
</template>
```

---

## Form Input Accessibility Guidelines

1. **Associated Labels**: Every `<input>` or `<select>` must have a matching `<label>` with `for="element-id"`.
2. **Autocomplete Attributes**: Passwords, emails, and usernames must include appropriate `autocomplete` tokens (`email`, `current-password`, `new-password`, `username`).
3. **Descriptive Errors**: Form validation errors must be associated with the input using `aria-describedby="error-id"` or placed directly adjacent to the input field.

---

## Verification Steps
1. Open any modal dialog in the application.
2. Press the `Escape` key on your keyboard and confirm that the modal closes cleanly.
3. Test with Chrome DevTools **Accessibility** tree inspection to ensure the dialog announces its title and role.
