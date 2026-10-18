import { ref, shallowRef } from 'vue'

export const isA11yModalOpen = ref(false)
export const a11yModalTriggerRef = shallowRef(null)

/**
 * Open the public accessibility preferences modal and remember
 * the element that triggered it for keyboard focus restoration.
 *
 * @param {HTMLElement|null} triggerEl
 */
export function openA11yModal(triggerEl = null) {
  a11yModalTriggerRef.value =
    triggerEl || (typeof document !== 'undefined' ? document.activeElement : null)
  isA11yModalOpen.value = true
}

/**
 * Close the public accessibility preferences modal.
 */
export function closeA11yModal() {
  isA11yModalOpen.value = false
}
