# Accessibility (a11y) & Modal Dialog Standards

## Context & Principles

CyberMorph is an educational platform intended for students, educators, and administrators. Modal overlays and dialogs must adhere to standard accessible dialog specifications (WAI-ARIA Dialog Modal).

---

## Accessible Modal Pattern

All modal dialogs in CyberMorph should follow the WAI-ARIA Dialog (Modal) specification:

### Required Accessibility Features
1. **Container Attributes**:
   - `role="dialog"` or `role="alertdialog"` (for destructive confirmation dialogs).
   - `aria-modal="true"` to signal that background contents are inert.
   - `aria-labelledby="modal-title-id"` to announce the dialog title immediately upon focus.
2. **Keyboard Handlers**:
   - Listen for `keydown` on `window` and close when `event.key === 'Escape'`.
   - Remove the listener immediately in `onUnmounted`.
3. **Close Buttons**:
   - Provide an explicit `aria-label="Close dialog"` on any dismissal button.
   - Use clean, accessible labels or functional SVG icons (`AppIcon`), avoiding decorative monospace text.

### Implementation Pattern

```vue
<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

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
          <AppIcon name="close" size="16" aria-hidden="true" />
          <span class="sr-only">Close</span>
        </button>
      </header>
      <div class="modal-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </footer>
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
2. Verify that pressing `Escape` dismisses an open modal.
3. Verify that screen readers announce the dialog title via `aria-labelledby`.
4. Verify that close buttons have accessible names (`aria-label` or visible text).
