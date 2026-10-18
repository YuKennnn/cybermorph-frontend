<script setup>
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { openA11yModal } from '../../utils/accessibilityModal.js'

const buttonRef = ref(null)

const handleClick = () => {
  openA11yModal(buttonRef.value)
}
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    class="a11y-floating-trigger a11y-floating-btn"
    aria-label="Open accessibility preferences"
    @click="handleClick"
  >
    <AppIcon name="settings" :size="18" class="trigger-icon" />
    <span class="trigger-label">Accessibility</span>
  </button>
</template>

<style scoped>
.a11y-floating-trigger {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 90;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  background-color: var(--color-card, #ffffff);
  color: var(--color-text, #0f172a);
  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: 9999px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.a11y-floating-trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary, #0ea5e9);
  color: var(--color-primary, #0ea5e9);
}

.a11y-floating-trigger:focus-visible {
  outline: 2px solid var(--color-primary, #0ea5e9);
  outline-offset: 3px;
}

.trigger-icon {
  color: var(--color-primary, #0ea5e9);
}

/* Safe narrow-screen behavior:
   When screen width is narrow (<= 640px), suppress floating trigger so it never
   covers mobile buttons, forms, or content. Mobile navigation drawer & footer
   provide accessible entries. */
@media (max-width: 640px) {
  .a11y-floating-trigger {
    display: none;
  }
}
</style>
