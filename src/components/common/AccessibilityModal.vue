<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'
import InlineSpeechPlayer from './InlineSpeechPlayer.vue'
import {
  isA11yModalOpen,
  a11yModalTriggerRef,
  closeA11yModal,
} from '../../utils/accessibilityModal.js'
import {
  getStoredTheme,
  setStoredTheme,
  getStoredTextSize,
  setStoredTextSize,
  getStoredMotionPreference,
  setStoredMotionPreference,
  getStoredReadAloud,
  setStoredReadAloud,
  getStoredReadSpeed,
  setStoredReadSpeed,
  resetAccessibilityPreferences,
  isStoragePersistenceAvailable,
  VALID_READ_SPEEDS,
} from '../../utils/accessibility.js'
import {
  startNarration,
  stopNarration,
  changeNarrationSpeed,
  getVoiceLoadingStatus,
  getAvailableVoices,
  addVoicesChangedListener,
} from '../../utils/speech.js'

const modalContainerRef = ref(null)
const closeBtnRef = ref(null)
const sampleBtnRef = ref(null)

const currentTheme = ref(getStoredTheme())
const currentTextSize = ref(getStoredTextSize())
const currentMotion = ref(getStoredMotionPreference())
const currentReadAloud = ref(getStoredReadAloud())
const currentReadSpeed = ref(getStoredReadSpeed())
const voiceEngineStatus = ref(getVoiceLoadingStatus())
const voiceCount = ref(getAvailableVoices().length)
const resetFeedbackMessage = ref('')
const isPersistenceAvailable = ref(isStoragePersistenceAvailable())

const SAMPLE_NARRATION_TEXT =
  'CyberMorph is an educational cybersecurity game designed for players and educators. Practice cybersecurity decisions through interactive scenarios.'

let removeVoicesListener = null

onMounted(() => {
  removeVoicesListener = addVoicesChangedListener((voices, status) => {
    voiceEngineStatus.value = status
    voiceCount.value = voices.length
  })
})

onUnmounted(() => {
  if (removeVoicesListener) {
    removeVoicesListener()
    removeVoicesListener = null
  }
  stopNarration('modal-sample')
})

const syncPreferencesFromStorage = () => {
  currentTheme.value = getStoredTheme()
  currentTextSize.value = getStoredTextSize()
  currentMotion.value = getStoredMotionPreference()
  currentReadAloud.value = getStoredReadAloud()
  currentReadSpeed.value = getStoredReadSpeed()
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleClose = () => {
  stopNarration('modal-sample')
  closeA11yModal()
}

// Watch modal open state for focus trap, body scroll lock, and focus restoration
watch(isA11yModalOpen, (isOpen) => {
  if (isOpen) {
    syncPreferencesFromStorage()
    resetFeedbackMessage.value = ''
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden'
    }
    nextTick(() => {
      closeBtnRef.value?.focus()
    })
  } else {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
    }
    const trigger = a11yModalTriggerRef.value
    if (trigger && typeof trigger.focus === 'function') {
      nextTick(() => {
        try {
          trigger.focus()
        } catch {
          // Ignore focus errors
        }
      })
    }
  }
})

// Focus Trap Implementation
const handleKeydown = (event) => {
  if (!isA11yModalOpen.value) return

  if (event.key === 'Escape') {
    event.stopPropagation()
    handleClose()
    return
  }

  if (event.key === 'Tab') {
    const container = modalContainerRef.value
    if (!container) return

    const focusables = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus()
        event.preventDefault()
      }
    } else {
      if (document.activeElement === last) {
        first.focus()
        event.preventDefault()
      }
    }
  }
}

const handleThemeChange = (theme) => {
  currentTheme.value = setStoredTheme(theme)
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleTextSizeChange = (size) => {
  currentTextSize.value = setStoredTextSize(size)
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleMotionChange = (motion) => {
  currentMotion.value = setStoredMotionPreference(motion)
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleReadAloudChange = (val) => {
  currentReadAloud.value = setStoredReadAloud(val)
  if (val === 'off') {
    stopNarration()
  }
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleReadSpeedChange = (speed) => {
  currentReadSpeed.value = setStoredReadSpeed(speed)
  changeNarrationSpeed(speed, 'modal-sample')
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
}

const handleTestSampleNarration = () => {
  startNarration({
    ownerId: 'modal-sample',
    title: 'Sample narration',
    text: SAMPLE_NARRATION_TEXT,
    rate: currentReadSpeed.value,
    triggerEl: sampleBtnRef.value,
  })
}

const handleResetPreferences = () => {
  stopNarration()
  const defaults = resetAccessibilityPreferences()
  currentTheme.value = defaults.theme
  currentTextSize.value = defaults.textSize
  currentMotion.value = defaults.motion || 'system'
  currentReadAloud.value = defaults.readAloud || 'off'
  currentReadSpeed.value = defaults.readSpeed || '1'
  isPersistenceAvailable.value = isStoragePersistenceAvailable()
  resetFeedbackMessage.value = 'Preferences reset to defaults (Light theme, Standard text, System motion).'
  setTimeout(() => {
    resetFeedbackMessage.value = ''
  }, 4000)
}
</script>

<template>
  <div
    v-if="isA11yModalOpen"
    class="a11y-modal-backdrop"
    @click="handleClose"
    @keydown="handleKeydown"
  >
    <div
      ref="modalContainerRef"
      class="a11y-modal-card a11y-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
      @click.stop
    >
      <header class="modal-header">
        <div class="header-title-wrap">
          <AppIcon name="settings" :size="20" class="header-icon" />
          <h2 id="a11y-modal-title" class="modal-title">Accessibility preferences</h2>
        </div>
        <button
          ref="closeBtnRef"
          type="button"
          class="btn-modal-close"
          aria-label="Close accessibility preferences"
          @click="handleClose"
        >
          <AppIcon name="x" :size="20" />
        </button>
      </header>

      <div class="modal-body">
        <p v-if="isPersistenceAvailable" class="modal-lead">
          Adjust display and reading preferences. Preferences apply immediately and are saved in this browser for future visits.
        </p>
        <p v-else class="modal-lead">
          Adjust display and reading preferences. Preferences apply immediately for this session.
        </p>

        <div v-if="!isPersistenceAvailable" class="persistence-warning-banner" role="status">
          <AppIcon name="alert-triangle" :size="16" />
          <span>Local storage is unavailable or restricted in this browser, so changes cannot be saved permanently.</span>
        </div>

        <!-- 1. Theme -->
        <section class="modal-section" aria-labelledby="modal-theme-heading">
          <h3 id="modal-theme-heading" class="section-title">Theme</h3>
          <div class="pref-grid" role="radiogroup" aria-labelledby="modal-theme-heading">
            <label :class="['pref-card', { active: currentTheme === 'light' }]" for="m-theme-light">
              <input
                id="m-theme-light"
                type="radio"
                name="modalTheme"
                value="light"
                :checked="currentTheme === 'light'"
                @change="handleThemeChange('light')"
              />
              <div class="pref-info">
                <span class="pref-name">Light (default)</span>
                <span class="pref-desc">High-contrast bright background for standard reading.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentTheme === 'dark' }]" for="m-theme-dark">
              <input
                id="m-theme-dark"
                type="radio"
                name="modalTheme"
                value="dark"
                :checked="currentTheme === 'dark'"
                @change="handleThemeChange('dark')"
              />
              <div class="pref-info">
                <span class="pref-name">Dark</span>
                <span class="pref-desc">Dark surface with luminous text for reduced eye strain.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentTheme === 'system' }]" for="m-theme-system">
              <input
                id="m-theme-system"
                type="radio"
                name="modalTheme"
                value="system"
                :checked="currentTheme === 'system'"
                @change="handleThemeChange('system')"
              />
              <div class="pref-info">
                <span class="pref-name">System</span>
                <span class="pref-desc">Synchronize with your operating system appearance automatically.</span>
              </div>
            </label>
          </div>
        </section>

        <!-- 2. Text Size -->
        <section class="modal-section" aria-labelledby="modal-text-size-heading">
          <h3 id="modal-text-size-heading" class="section-title">Text size</h3>
          <div class="pref-grid" role="radiogroup" aria-labelledby="modal-text-size-heading">
            <label :class="['pref-card', { active: currentTextSize === 'standard' }]" for="m-size-std">
              <input
                id="m-size-std"
                type="radio"
                name="modalSize"
                value="standard"
                :checked="currentTextSize === 'standard'"
                @change="handleTextSizeChange('standard')"
              />
              <div class="pref-info">
                <span class="pref-name">Standard (100%)</span>
                <span class="pref-desc">Default size for standard display densities.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentTextSize === 'large' }]" for="m-size-lg">
              <input
                id="m-size-lg"
                type="radio"
                name="modalSize"
                value="large"
                :checked="currentTextSize === 'large'"
                @change="handleTextSizeChange('large')"
              />
              <div class="pref-info">
                <span class="pref-name">Large (115%)</span>
                <span class="pref-desc">Enlarged body text for comfortable reading.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentTextSize === 'extra-large' }]" for="m-size-xl">
              <input
                id="m-size-xl"
                type="radio"
                name="modalSize"
                value="extra-large"
                :checked="currentTextSize === 'extra-large'"
                @change="handleTextSizeChange('extra-large')"
              />
              <div class="pref-info">
                <span class="pref-name">Extra large (130%)</span>
                <span class="pref-desc">Maximum scaling with responsive reflow.</span>
              </div>
            </label>
          </div>
        </section>

        <!-- 3. Reduced Motion -->
        <section class="modal-section" aria-labelledby="modal-motion-heading">
          <h3 id="modal-motion-heading" class="section-title">Motion & animations</h3>
          <div class="pref-grid two-col" role="radiogroup" aria-labelledby="modal-motion-heading">
            <label :class="['pref-card', { active: currentMotion === 'system' }]" for="m-motion-sys">
              <input
                id="m-motion-sys"
                type="radio"
                name="modalMotion"
                value="system"
                :checked="currentMotion === 'system'"
                @change="handleMotionChange('system')"
              />
              <div class="pref-info">
                <span class="pref-name">System default</span>
                <span class="pref-desc">Follow device setting automatically.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentMotion === 'reduced' }]" for="m-motion-red">
              <input
                id="m-motion-red"
                type="radio"
                name="modalMotion"
                value="reduced"
                :checked="currentMotion === 'reduced'"
                @change="handleMotionChange('reduced')"
              />
              <div class="pref-info">
                <span class="pref-name">Reduced motion</span>
                <span class="pref-desc">Minimize transitions and pause canvas animations.</span>
              </div>
            </label>
          </div>
        </section>

        <!-- 4. Read Aloud (Narration) -->
        <section class="modal-section" aria-labelledby="modal-narration-heading">
          <h3 id="modal-narration-heading" class="section-title">Read aloud (narration)</h3>
          <div class="pref-grid two-col" role="radiogroup" aria-labelledby="modal-narration-heading">
            <label :class="['pref-card', { active: currentReadAloud === 'off' }]" for="m-narration-off">
              <input
                id="m-narration-off"
                type="radio"
                name="modalNarration"
                value="off"
                :checked="currentReadAloud === 'off'"
                @change="handleReadAloudChange('off')"
              />
              <div class="pref-info">
                <span class="pref-name">Disabled (default)</span>
                <span class="pref-desc">Section narration buttons remain hidden.</span>
              </div>
            </label>

            <label :class="['pref-card', { active: currentReadAloud === 'on' }]" for="m-narration-on">
              <input
                id="m-narration-on"
                type="radio"
                name="modalNarration"
                value="on"
                :checked="currentReadAloud === 'on'"
                @change="handleReadAloudChange('on')"
              />
              <div class="pref-info">
                <span class="pref-name">Enabled</span>
                <span class="pref-desc">Show "Read section" buttons on public pages.</span>
              </div>
            </label>
          </div>

          <!-- Reading speed & sample button -->
          <div v-if="currentReadAloud === 'on'" class="modal-narration-details">
            <div class="speed-row">
              <span class="speed-row-label">Reading speed:</span>
              <div class="speed-pills" role="group" aria-label="Reading speed">
                <button
                  v-for="speed in VALID_READ_SPEEDS"
                  :key="speed"
                  type="button"
                  class="speed-btn"
                  :class="{ active: currentReadSpeed === speed }"
                  :aria-pressed="currentReadSpeed === speed"
                  :aria-label="`${speed} times normal speed`"
                  @click="handleReadSpeedChange(speed)"
                >
                  {{ speed }}x
                </button>
              </div>
            </div>

            <div class="sample-row">
              <button
                ref="sampleBtnRef"
                type="button"
                class="btn-test-sample"
                @click="handleTestSampleNarration"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Test sample narration</span>
              </button>

              <InlineSpeechPlayer
                owner-id="modal-sample"
                title="Sample narration"
                :trigger-ref="sampleBtnRef"
              />
            </div>
          </div>
        </section>

        <!-- Footer Actions (Reset to defaults & Done button) -->
        <footer class="modal-footer-actions">
          <div class="footer-left">
            <button
              type="button"
              class="btn-reset-defaults btn-reset-a11y"
              @click="handleResetPreferences"
            >
              <AppIcon name="refresh" :size="14" />
              <span>Reset to defaults</span>
            </button>
            <span
              v-if="resetFeedbackMessage"
              class="reset-feedback"
              role="status"
              aria-live="polite"
            >
              {{ resetFeedbackMessage }}
            </span>
          </div>

          <button
            type="button"
            class="btn-modal-done"
            aria-label="Close accessibility preferences"
            @click="handleClose"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.a11y-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.a11y-modal-card {
  width: 100%;
  max-width: 640px;
  max-height: calc(100vh - 3rem);
  display: flex;
  flex-direction: column;
  background-color: var(--color-card, #ffffff);
  color: var(--color-text, #0f172a);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: scaleIn 0.15s ease-out;
}

@keyframes scaleIn {
  from { transform: scale(0.97); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.header-icon {
  color: var(--color-primary, #0ea5e9);
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}

.btn-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.btn-modal-close:hover {
  background-color: var(--color-bg-alt, rgba(0, 0, 0, 0.05));
  color: var(--color-text, #0f172a);
}

.btn-modal-close:focus-visible {
  outline: 2px solid var(--color-primary, #0ea5e9);
  outline-offset: 2px;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.modal-lead {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.5;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.section-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text, #0f172a);
}

.pref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.625rem;
}

.pref-grid.two-col {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.pref-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background-color: var(--color-card, #ffffff);
  cursor: pointer;
  transition: all 0.15s ease;
}

.pref-card:hover {
  border-color: var(--color-primary, #0ea5e9);
  background-color: var(--color-bg-alt, rgba(0, 0, 0, 0.02));
}

.pref-card.active {
  border-color: var(--color-primary, #0ea5e9);
  background-color: rgba(14, 165, 233, 0.06);
}

.pref-card input[type='radio'] {
  margin-top: 0.1875rem;
  margin-right: 0.625rem;
  accent-color: var(--color-primary, #0ea5e9);
  cursor: pointer;
}

.pref-info {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
}

.pref-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text, #0f172a);
}

.pref-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.35;
}

.modal-narration-details {
  margin-top: 0.5rem;
  padding: 0.875rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background-color: var(--color-bg-alt, rgba(0, 0, 0, 0.02));
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.speed-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.speed-row-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #0f172a);
}

.speed-pills {
  display: flex;
  gap: 0.375rem;
}

.speed-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  background-color: var(--color-card, #ffffff);
  color: var(--color-text, #0f172a);
  cursor: pointer;
  transition: all 0.15s ease;
}

.speed-btn:hover {
  border-color: var(--color-primary, #0ea5e9);
}

.speed-btn.active {
  background-color: var(--color-primary, #0ea5e9);
  color: #ffffff;
  border-color: var(--color-primary, #0ea5e9);
}

.speed-btn:focus-visible {
  outline: 2px solid var(--color-primary, #0ea5e9);
  outline-offset: 2px;
}

.sample-row {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.btn-test-sample {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  background-color: var(--color-card, #ffffff);
  color: var(--color-primary, #0ea5e9);
  border: 1px solid var(--color-primary, #0ea5e9);
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.15s ease;
}

.btn-test-sample:hover {
  background-color: rgba(14, 165, 233, 0.08);
}

.btn-test-sample:focus-visible {
  outline: 2px solid var(--color-primary, #0ea5e9);
  outline-offset: 2px;
}

.persistence-warning-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: #fef3c7;
  border: 1px solid #fde047;
  color: #92400e;
  border-radius: 6px;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-modal-done {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background: var(--btn-gradient, linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%));
  background-color: var(--color-primary, #7c3aed);
  border: 1px solid var(--color-primary, #7c3aed);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 36px;
  margin-left: auto;
}

.btn-modal-done:hover {
  filter: brightness(1.08);
}

.btn-modal-done:focus-visible {
  outline: 2px solid var(--color-primary, #7c3aed);
  outline-offset: 2px;
}

.btn-reset-defaults {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: transparent;
  color: var(--color-text-muted, #64748b);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset-defaults:hover {
  color: var(--color-text, #0f172a);
  border-color: var(--color-text-muted, #64748b);
}

.btn-reset-defaults:focus-visible {
  outline: 2px solid var(--color-primary, #0ea5e9);
  outline-offset: 2px;
}

.reset-feedback {
  margin: 0;
  font-size: 0.8125rem;
  color: #16a34a;
  font-weight: 500;
}
</style>
