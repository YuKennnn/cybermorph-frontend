<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
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
  VALID_READ_SPEEDS,
} from '../utils/accessibility'
import {
  getVoiceLoadingStatus,
  getAvailableVoices,
  startNarration,
  stopNarration,
  changeNarrationSpeed,
  addVoicesChangedListener,
  retryLoadingVoices,
} from '../utils/speech'
import AppIcon from '../components/common/AppIcon.vue'
import InlineSpeechPlayer from '../components/common/InlineSpeechPlayer.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Navigation Section State (account | accessibility)
const SECTIONS = ['account', 'accessibility']
const initialSection = SECTIONS.includes(route.query.section) ? route.query.section : 'account'
const activeSection = ref(initialSection)

watch(
  () => route.query.section,
  (newSection) => {
    if (SECTIONS.includes(newSection)) {
      activeSection.value = newSection
    } else {
      activeSection.value = 'account'
    }
  }
)

const selectSection = (section) => {
  activeSection.value = section
  router.replace({
    query: {
      ...route.query,
      section: section === 'account' ? undefined : section,
    },
  })
}

const tabAccountRef = ref(null)
const tabAccessibilityRef = ref(null)

const handleTabKeydown = (event, currentTab) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    if (currentTab === 'account') {
      selectSection('accessibility')
      tabAccessibilityRef.value?.focus()
    } else {
      selectSection('account')
      tabAccountRef.value?.focus()
    }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (currentTab === 'accessibility') {
      selectSection('account')
      tabAccountRef.value?.focus()
    } else {
      selectSection('accessibility')
      tabAccessibilityRef.value?.focus()
    }
  } else if (event.key === 'Home') {
    event.preventDefault()
    selectSection('account')
    tabAccountRef.value?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    selectSection('accessibility')
    tabAccessibilityRef.value?.focus()
  }
}

// Accessibility Preferences Reactive State
const currentTheme = ref(getStoredTheme())
const currentTextSize = ref(getStoredTextSize())
const currentMotion = ref(getStoredMotionPreference())
const currentReadAloud = ref(getStoredReadAloud())
const currentReadSpeed = ref(getStoredReadSpeed())
const voiceEngineStatus = ref(getVoiceLoadingStatus())
const voiceCount = ref(getAvailableVoices().length)
const sampleBtnRef = ref(null)
const resetFeedbackMessage = ref('')

const SAMPLE_NARRATION_TEXT =
  'CyberMorph is an educational cybersecurity game designed for players and educators. Practice cybersecurity decisions through interactive scenarios.'

let removeVoicesListener = null

onMounted(() => {
  removeVoicesListener = addVoicesChangedListener((voices, status) => {
    voiceEngineStatus.value = status
    voiceCount.value = voices.length
  })
})

const handleThemeChange = (theme) => {
  currentTheme.value = setStoredTheme(theme)
}

const handleTextSizeChange = (size) => {
  currentTextSize.value = setStoredTextSize(size)
}

const handleMotionChange = (motion) => {
  currentMotion.value = setStoredMotionPreference(motion)
}

const handleReadAloudChange = (val) => {
  currentReadAloud.value = setStoredReadAloud(val)
  if (val === 'off') {
    stopNarration()
  }
}

const handleReadSpeedChange = (speed) => {
  currentReadSpeed.value = setStoredReadSpeed(speed)
  changeNarrationSpeed(speed, 'settings-sample')
}

const handleTestSampleNarration = () => {
  startNarration({
    ownerId: 'settings-sample',
    title: 'Sample narration',
    text: SAMPLE_NARRATION_TEXT,
    rate: currentReadSpeed.value,
    triggerEl: sampleBtnRef.value,
  })
}

const handleRetryVoices = () => {
  retryLoadingVoices()
}

// Switching away from the Accessibility section counts as disposing the sample narration
watch(activeSection, (newSection) => {
  if (newSection !== 'accessibility') {
    stopNarration('settings-sample')
  }
})

onUnmounted(() => {
  if (removeVoicesListener) {
    removeVoicesListener()
    removeVoicesListener = null
  }
  stopNarration('settings-sample')
})

const handleResetPreferences = () => {
  stopNarration()
  const defaults = resetAccessibilityPreferences()
  currentTheme.value = defaults.theme
  currentTextSize.value = defaults.textSize
  currentMotion.value = defaults.motion || 'system'
  currentReadAloud.value = defaults.readAloud || 'off'
  currentReadSpeed.value = defaults.readSpeed || '1'
  resetFeedbackMessage.value = 'Accessibility preferences have been reset to defaults.'
  setTimeout(() => {
    resetFeedbackMessage.value = ''
  }, 4000)
}

// Verified Role Formatting
const formattedRole = computed(() => {
  const role = authStore.userRole?.toLowerCase()
  if (role === 'player') return 'Player'
  if (role === 'educator') return 'Educator'
  if (role === 'admin') return 'Administrator'
  return 'Unknown'
})

// Verified Approval Status Formatting (Educator / Admin)
const formattedApprovalStatus = computed(() => {
  const status = authStore.user?.approval_status
  if (!status || typeof status !== 'string') return 'Unavailable'
  const normalized = status.toLowerCase()
  if (normalized === 'approved') return 'Approved'
  if (normalized === 'pending') return 'Pending'
  if (normalized === 'rejected') return 'Rejected'
  return status
})

// Verified Portal Access Formatting (Educator / Admin)
const formattedPortalAccess = computed(() => {
  const access = authStore.user?.portal_access
  if (access === true) return 'Active'
  if (access === false) return 'Inactive'
  return 'Unavailable'
})

// Verified Player Username
const playerUsername = computed(() => {
  return authStore.user?.username || '—'
})

// Verified Player Email (from authenticated session)
const playerEmail = computed(() => {
  return authStore.user?.email || 'Not recorded in session'
})

// Verified Web User Email
const webUserEmail = computed(() => {
  return authStore.user?.email || '—'
})
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">
        Review account details and configure accessibility and display preferences.
      </p>
    </header>

    <!-- Navigation Tabs -->
    <div
      role="tablist"
      aria-label="Settings sections"
      class="settings-tabs"
    >
      <button
        id="tab-account"
        ref="tabAccountRef"
        role="tab"
        class="tab-btn"
        :aria-selected="activeSection === 'account'"
        :tabindex="activeSection === 'account' ? 0 : -1"
        aria-controls="panel-account"
        @click="selectSection('account')"
        @keydown="handleTabKeydown($event, 'account')"
      >
        Account
      </button>

      <button
        id="tab-accessibility"
        ref="tabAccessibilityRef"
        role="tab"
        class="tab-btn"
        :aria-selected="activeSection === 'accessibility'"
        :tabindex="activeSection === 'accessibility' ? 0 : -1"
        aria-controls="panel-accessibility"
        @click="selectSection('accessibility')"
        @keydown="handleTabKeydown($event, 'accessibility')"
      >
        Accessibility
      </button>
    </div>

    <div class="settings-content">
      <!-- PANEL 1: ACCOUNT DETAILS -->
      <div
        id="panel-account"
        role="tabpanel"
        aria-labelledby="tab-account"
        v-show="activeSection === 'account'"
        tabindex="0"
        class="tab-panel"
      >
        <!-- Account Details Card -->
        <section class="settings-card" aria-labelledby="account-details-heading">
          <div class="card-header">
            <h2 id="account-details-heading" class="card-title">Account details</h2>
          </div>

          <div class="read-only-notice" role="note">
            <AppIcon name="copy" :size="16" class="notice-icon" />
            <span>Account details are currently read-only. Profile editing is not currently supported.</span>
          </div>

          <!-- Player Role Details -->
          <div v-if="authStore.isPlayer" class="fields-grid">
            <div class="field-item">
              <span class="field-label">Username</span>
              <span class="field-value">{{ playerUsername }}</span>
            </div>

            <div class="field-item">
              <span class="field-label">Account role</span>
              <span class="field-value">
                <span class="role-badge player">{{ formattedRole }}</span>
              </span>
            </div>

            <div class="field-item">
              <span class="field-label">Email</span>
              <span class="field-value email-value">{{ playerEmail }}</span>
            </div>
          </div>

          <!-- Educator & Admin Role Details -->
          <div v-else-if="authStore.isEducator || authStore.isAdmin" class="fields-grid">
            <div class="field-item">
              <span class="field-label">Email address</span>
              <span class="field-value email-value">{{ webUserEmail }}</span>
            </div>

            <div class="field-item">
              <span class="field-label">Account role</span>
              <span class="field-value">
                <span :class="['role-badge', authStore.userRole]">{{ formattedRole }}</span>
              </span>
            </div>

            <div class="field-item">
              <span class="field-label">Approval status</span>
              <span class="field-value">{{ formattedApprovalStatus }}</span>
            </div>

            <div class="field-item">
              <span class="field-label">Portal access</span>
              <span class="field-value">{{ formattedPortalAccess }}</span>
            </div>
          </div>

          <!-- Fallback for unverified or unknown role -->
          <div v-else class="fields-grid">
            <div class="field-item">
              <span class="field-label">Account role</span>
              <span class="field-value">{{ formattedRole }}</span>
            </div>
            <div class="field-item">
              <span class="field-label">Email address</span>
              <span class="field-value">{{ webUserEmail }}</span>
            </div>
          </div>
        </section>

        <!-- Educator Classroom Context Pointer -->
        <section v-if="authStore.isEducator" class="settings-card context-card" aria-labelledby="classroom-mgmt-heading">
          <div class="card-header">
            <h2 id="classroom-mgmt-heading" class="card-title">Classrooms</h2>
            <p class="card-subtitle">
              To manage classroom names, descriptions, and student enrollment access, visit Classroom management.
            </p>
          </div>
          <div class="card-action">
            <router-link to="/classroom/manage" class="btn-outline">
              Classroom management
            </router-link>
          </div>
        </section>
      </div>

      <!-- PANEL 2: ACCESSIBILITY PREFERENCES -->
      <div
        id="panel-accessibility"
        role="tabpanel"
        aria-labelledby="tab-accessibility"
        v-show="activeSection === 'accessibility'"
        tabindex="0"
        class="tab-panel"
      >
        <!-- 1. Theme Selection Card -->
        <section class="settings-card" aria-labelledby="theme-preferences-heading">
          <div class="card-header">
            <h2 id="theme-preferences-heading" class="card-title">Theme</h2>
            <p class="card-subtitle">
              Choose your display theme or synchronize automatically with your device settings.
            </p>
          </div>

          <div class="pref-options-grid" role="radiogroup" aria-labelledby="theme-preferences-heading">
            <label
              :class="['pref-option-card', { active: currentTheme === 'light' }]"
              for="theme-pref-light"
            >
              <input
                id="theme-pref-light"
                type="radio"
                name="themePreference"
                value="light"
                :checked="currentTheme === 'light'"
                @change="handleThemeChange('light')"
              />
              <div class="option-content">
                <span class="option-title">Light (default)</span>
                <span class="option-desc">
                  Default high-contrast bright background for standard reading.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentTheme === 'dark' }]"
              for="theme-pref-dark"
            >
              <input
                id="theme-pref-dark"
                type="radio"
                name="themePreference"
                value="dark"
                :checked="currentTheme === 'dark'"
                @change="handleThemeChange('dark')"
              />
              <div class="option-content">
                <span class="option-title">Dark</span>
                <span class="option-desc">
                  Dark surface with luminous text for reduced eye strain.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentTheme === 'system' }]"
              for="theme-pref-system"
            >
              <input
                id="theme-pref-system"
                type="radio"
                name="themePreference"
                value="system"
                :checked="currentTheme === 'system'"
                @change="handleThemeChange('system')"
              />
              <div class="option-content">
                <span class="option-title">System</span>
                <span class="option-desc">
                  Match your operating system appearance automatically.
                </span>
              </div>
            </label>
          </div>
        </section>

        <!-- 2. Text Size Selection Card -->
        <section class="settings-card" aria-labelledby="text-size-heading">
          <div class="card-header">
            <h2 id="text-size-heading" class="card-title">Text size</h2>
            <p class="card-subtitle">
              Scale interface typography. Works together with browser zoom up to 200%.
            </p>
          </div>

          <div class="pref-options-grid" role="radiogroup" aria-labelledby="text-size-heading">
            <label
              :class="['pref-option-card', { active: currentTextSize === 'standard' }]"
              for="size-pref-standard"
            >
              <input
                id="size-pref-standard"
                type="radio"
                name="textSizePreference"
                value="standard"
                :checked="currentTextSize === 'standard'"
                @change="handleTextSizeChange('standard')"
              />
              <div class="option-content">
                <span class="option-title">Standard (100%)</span>
                <span class="option-desc">
                  Default text size optimized for standard display densities.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentTextSize === 'large' }]"
              for="size-pref-large"
            >
              <input
                id="size-pref-large"
                type="radio"
                name="textSizePreference"
                value="large"
                :checked="currentTextSize === 'large'"
                @change="handleTextSizeChange('large')"
              />
              <div class="option-content">
                <span class="option-title">Large (115%)</span>
                <span class="option-desc">
                  Enlarged body text and headings for comfortable reading.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentTextSize === 'extra-large' }]"
              for="size-pref-xlarge"
            >
              <input
                id="size-pref-xlarge"
                type="radio"
                name="textSizePreference"
                value="extra-large"
                :checked="currentTextSize === 'extra-large'"
                @change="handleTextSizeChange('extra-large')"
              />
              <div class="option-content">
                <span class="option-title">Extra large (130%)</span>
                <span class="option-desc">
                  Maximum text scaling with responsive content reflow.
                </span>
              </div>
            </label>
          </div>
        </section>

        <!-- 3. Reduced Motion Card -->
        <section class="settings-card" aria-labelledby="motion-preferences-heading">
          <div class="card-header">
            <h2 id="motion-preferences-heading" class="card-title">Motion & animations</h2>
            <p class="card-subtitle">
              Configure interface animations, simulation canvases, and smooth scrolling.
            </p>
          </div>

          <div class="pref-options-grid two-column" role="radiogroup" aria-labelledby="motion-preferences-heading">
            <label
              :class="['pref-option-card', { active: currentMotion === 'system' }]"
              for="motion-pref-system"
            >
              <input
                id="motion-pref-system"
                type="radio"
                name="motionPreference"
                value="system"
                :checked="currentMotion === 'system'"
                @change="handleMotionChange('system')"
              />
              <div class="option-content">
                <span class="option-title">System default</span>
                <span class="option-desc">
                  Follow your operating system setting for reduced motion automatically.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentMotion === 'reduced' }]"
              for="motion-pref-reduced"
            >
              <input
                id="motion-pref-reduced"
                type="radio"
                name="motionPreference"
                value="reduced"
                :checked="currentMotion === 'reduced'"
                @change="handleMotionChange('reduced')"
              />
              <div class="option-content">
                <span class="option-title">Reduced motion</span>
                <span class="option-desc">
                  Minimize transitions, pause preview canvas, and disable smooth scrolling.
                </span>
              </div>
            </label>
          </div>

          <p class="preference-persistence-note">
            Accessibility settings apply to this browser and are saved independently from your account session.
          </p>
        </section>

        <!-- 4. Read Aloud (Narration) Card -->
        <section class="settings-card" aria-labelledby="read-aloud-heading">
          <div class="card-header">
            <h2 id="read-aloud-heading" class="card-title">Read aloud (narration)</h2>
            <p class="card-subtitle">
              Enable explicit section reading on public pages and configure reading speed.
            </p>
          </div>

          <div class="pref-options-grid two-column" role="radiogroup" aria-labelledby="read-aloud-heading">
            <label
              :class="['pref-option-card', { active: currentReadAloud === 'off' }]"
              for="read-aloud-pref-off"
            >
              <input
                id="read-aloud-pref-off"
                type="radio"
                name="readAloudPreference"
                value="off"
                :checked="currentReadAloud === 'off'"
                @change="handleReadAloudChange('off')"
              />
              <div class="option-content">
                <span class="option-title">Disabled (default)</span>
                <span class="option-desc">
                  Section narration buttons remain hidden.
                </span>
              </div>
            </label>

            <label
              :class="['pref-option-card', { active: currentReadAloud === 'on' }]"
              for="read-aloud-pref-on"
            >
              <input
                id="read-aloud-pref-on"
                type="radio"
                name="readAloudPreference"
                value="on"
                :checked="currentReadAloud === 'on'"
                @change="handleReadAloudChange('on')"
              />
              <div class="option-content">
                <span class="option-title">Enabled</span>
                <span class="option-desc">
                  Show "Read section" buttons on public pages.
                </span>
              </div>
            </label>
          </div>

          <!-- Speed Controls, Engine Status & Sample Narration -->
          <div class="read-aloud-details">
            <div class="setting-subrow">
              <div class="subrow-info">
                <span class="subrow-title">Reading speed</span>
                <span class="subrow-desc">Controls speech rate for section reading.</span>
              </div>
              <div class="speed-selector" role="group" aria-label="Reading speed">
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

            <div class="engine-status-row">
              <span class="engine-label">Speech engine:</span>
              <span v-if="voiceEngineStatus === 'unsupported'" class="engine-badge unsupported">
                Web Speech is not supported in this browser
              </span>
              <span v-else-if="voiceEngineStatus === 'loading'" class="engine-badge loading">
                Loading browser voices...
              </span>
              <span v-else-if="voiceEngineStatus === 'ready'" class="engine-badge ready">
                Ready ({{ voiceCount }} voice{{ voiceCount === 1 ? '' : 's' }} available)
              </span>
              <span v-else class="engine-badge unavailable">
                No voice list loaded (browser default voice will be attempted if supported)
              </span>
              <button
                v-if="voiceEngineStatus === 'unavailable'"
                type="button"
                class="btn-retry-voices"
                aria-label="Retry loading browser voices"
                @click="handleRetryVoices"
              >
                Retry
              </button>
            </div>

            <div class="sample-narration-row">
              <button
                ref="sampleBtnRef"
                type="button"
                class="btn-sample-speech"
                :disabled="voiceEngineStatus === 'unsupported'"
                @click="handleTestSampleNarration"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Sample narration</span>
              </button>

              <InlineSpeechPlayer
                owner-id="settings-sample"
                title="Settings sample"
                :trigger-ref="sampleBtnRef"
              />
            </div>
          </div>
        </section>

        <!-- 5. Reset to Defaults Card -->
        <section class="settings-card reset-card" aria-labelledby="reset-preferences-heading">
          <div class="reset-info">
            <h2 id="reset-preferences-heading" class="card-title">Reset accessibility settings</h2>
            <p class="card-subtitle">
              Revert theme, text size, motion, read aloud, and reading speed settings to device defaults. This will not affect your account or sign you out.
            </p>
          </div>

          <div class="reset-actions">
            <button
              type="button"
              class="btn-reset"
              @click="handleResetPreferences"
            >
              Reset to defaults
            </button>
          </div>

          <div
            v-if="resetFeedbackMessage"
            class="reset-feedback"
            role="status"
            aria-live="polite"
          >
            {{ resetFeedbackMessage }}
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 840px;
  margin: 0 auto;
  padding: 1rem 0 3rem 0;
}

.settings-header {
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0 0 0.5rem 0;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.page-subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

/* Tabs Navigation */
.settings-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1.75rem;
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
}

.tab-btn:hover {
  color: var(--color-text-main);
  background-color: var(--color-bg-subtle);
}

.tab-btn[aria-selected="true"] {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.tab-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 4px 4px 0 0;
}

.tab-panel:focus {
  outline: none;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-sm);
  margin-bottom: 1.5rem;
}

.card-header {
  margin-bottom: 1.25rem;
}

.card-title {
  margin: 0 0 0.35rem 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.card-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

/* Read-only Notice Banner */
.read-only-notice {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.notice-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Fields Grid */
.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.field-value {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.email-value {
  word-break: break-all;
}

/* Role Badges */
.role-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
}

.role-badge.player {
  background-color: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.role-badge.educator {
  background-color: var(--color-purple-light);
  border-color: var(--color-violet-border);
  color: var(--color-primary);
}

.role-badge.admin {
  background-color: #fef3c7;
  border-color: #fde68a;
  color: #92400e;
}

/* Preference Option Cards Grid */
.pref-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
  margin-top: 1rem;
}

.pref-options-grid.two-column {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.pref-option-card {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  border: 1.5px solid var(--color-border-control);
  border-radius: 8px;
  background-color: var(--color-card);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.pref-option-card:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

.pref-option-card.active {
  border-color: var(--color-primary);
  background-color: var(--color-violet-subtle);
}

.pref-option-card input[type="radio"] {
  margin-top: 0.2rem;
  accent-color: var(--color-primary);
  cursor: pointer;
  min-width: 18px;
  min-height: 18px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.option-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.option-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.preference-persistence-note {
  margin: 1.25rem 0 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

/* Read Aloud Details */
.read-aloud-details {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.hover-narration-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.hover-options {
  margin-top: 0.25rem;
}

.hover-delay-subrow {
  padding-top: 0.5rem;
}

.setting-subrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.subrow-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.subrow-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.subrow-desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.speed-selector {
  display: flex;
  gap: 0.375rem;
}

.speed-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1.5px solid var(--color-border-control);
  background-color: var(--color-card);
  color: var(--color-text-main);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 36px;
}

.speed-btn:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

.speed-btn.active {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.speed-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.engine-status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.engine-label {
  font-weight: 600;
  color: var(--color-text-muted);
}

.engine-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.engine-badge.ready {
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.engine-badge.loading {
  background-color: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.engine-badge.unsupported,
.engine-badge.empty {
  background-color: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.engine-badge.unavailable {
  background-color: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

:root[data-theme="dark"] .engine-badge.ready {
  background-color: #052e16;
  border-color: #166534;
  color: #86efac;
}

:root[data-theme="dark"] .engine-badge.loading {
  background-color: #172554;
  border-color: #1e40af;
  color: #93c5fd;
}

:root[data-theme="dark"] .engine-badge.unsupported,
:root[data-theme="dark"] .engine-badge.empty {
  background-color: #450a0a;
  border-color: #991b1b;
  color: #fca5a5;
}

:root[data-theme="dark"] .engine-badge.unavailable {
  background-color: #451a03;
  border-color: #92400e;
  color: #fcd34d;
}

.btn-retry-voices {
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--color-border-control);
  background-color: var(--color-card);
  color: var(--color-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry-voices:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.btn-retry-voices:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.sample-narration-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  width: 100%;
}

.btn-sample-speech {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-main);
  background-color: var(--color-bg-subtle);
  border: 1.5px solid var(--color-border-control);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 40px;
}

.btn-sample-speech:hover:not(:disabled) {
  background-color: var(--color-card);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-sample-speech:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-sample-speech:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Reset Card */
.reset-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.25rem;
  background-color: transparent;
  border: 1.5px solid var(--color-border-control);
  color: var(--color-text-main);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 42px;
  transition: all 0.15s ease;
}

.btn-reset:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

.btn-reset:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.reset-feedback {
  padding: 0.65rem 0.85rem;
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
}

/* Context Card */
.context-card .card-action {
  margin-top: 1rem;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1.15rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border-control);
  color: var(--color-text-main);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  min-height: 42px;
  transition: all 0.15s ease;
}

.btn-outline:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

.btn-outline:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Dark Mode Overrides for Semantic Badges */
:root[data-theme="dark"] .role-badge.player {
  background-color: #052e16;
  border-color: #166534;
  color: #86efac;
}

:root[data-theme="dark"] .role-badge.educator {
  background-color: #2e1065;
  border-color: #7c3aed;
  color: #c4b5fd;
}

:root[data-theme="dark"] .role-badge.admin {
  background-color: #451a03;
  border-color: #92400e;
  color: #fcd34d;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) .role-badge.player {
    background-color: #052e16;
    border-color: #166534;
    color: #86efac;
  }

  :root:not([data-theme="light"]):not([data-theme="dark"]) .role-badge.educator {
    background-color: #2e1065;
    border-color: #7c3aed;
    color: #c4b5fd;
  }

  :root:not([data-theme="light"]):not([data-theme="dark"]) .role-badge.admin {
    background-color: #451a03;
    border-color: #92400e;
    color: #fcd34d;
  }
}
</style>
