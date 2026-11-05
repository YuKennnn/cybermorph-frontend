<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { useThreatIndexStore } from '../stores/threatIndexStore.js'
import { getThreatLessonBySlug } from '../data/threatLessons.js'
import AppIcon from '../components/common/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const threatIndexStore = useThreatIndexStore()

const headingRef = ref(null)
const lockedHeadingRef = ref(null)
const notFoundHeadingRef = ref(null)
const errorHeadingRef = ref(null)

const slug = computed(() => {
  const param = route.params.slug
  return typeof param === 'string' ? param.toLowerCase().trim() : ''
})

const lesson = computed(() => {
  return getThreatLessonBySlug(slug.value)
})

const currentEntry = computed(() => {
  if (!threatIndexStore.isReady || !slug.value) return null
  return (
    threatIndexStore.entries.find(
      (entry) =>
        entry.slug === slug.value ||
        entry.threat_name.toLowerCase() === lesson.value?.threatName?.toLowerCase(),
    ) || null
  )
})

const isUnlocked = computed(() => {
  return currentEntry.value?.is_unlocked === true
})

const loadData = async ({ force = false } = {}) => {
  try {
    await threatIndexStore.loadThreatIndex({ force })
  } catch {
    // Handled in store
  }
}

const handleRetry = () => {
  if (threatIndexStore.isLoading || threatIndexStore.isRefreshing) return
  loadData({ force: true })
}

const syncFocusAndTitle = () => {
  nextTick(() => {
    if (!lesson.value) {
      document.title = 'Threat Not Found | CyberMorph'
      notFoundHeadingRef.value?.focus()
    } else if (threatIndexStore.isUnavailable) {
      document.title = 'Lesson Unavailable | CyberMorph'
      errorHeadingRef.value?.focus()
    } else if (threatIndexStore.isReady && !isUnlocked.value) {
      document.title = `Locked: ${lesson.value.threatName} | CyberMorph`
      lockedHeadingRef.value?.focus()
    } else if (threatIndexStore.isReady && isUnlocked.value) {
      document.title = `${lesson.value.threatName} Lesson | CyberMorph`
      headingRef.value?.focus()
    }
  })
}

onMounted(async () => {
  await loadData()
  syncFocusAndTitle()
})

watch(
  () => slug.value,
  async () => {
    await loadData()
    syncFocusAndTitle()
  },
)

watch(
  () => [threatIndexStore.status, isUnlocked.value],
  () => {
    syncFocusAndTitle()
  },
)

watch(
  () => [authStore.token, authStore.user?.user_id],
  ([newToken]) => {
    if (!newToken) {
      router.replace('/login')
      return
    }
    loadData({ force: true })
  },
)
</script>

<template>
  <div class="lesson-page-container">
    <!-- Top Back Control -->
    <nav class="lesson-navigation" aria-label="Lesson navigation">
      <router-link to="/threat-index" class="btn-back">
        <AppIcon name="chevron-left" :size="16" />
        <span>Back to Threat index</span>
      </router-link>
    </nav>

    <!-- State 1: Invalid / Not Found Lesson Slug -->
    <div
      v-if="!lesson"
      class="state-card not-found-state"
      role="alert"
    >
      <div class="state-icon-wrapper">
        <AppIcon name="alert" :size="24" class="state-icon alert-icon" />
      </div>
      <h1 ref="notFoundHeadingRef" tabindex="-1" class="state-title">
        Threat category not found
      </h1>
      <p class="state-description">
        The requested threat category does not exist in CyberMorph.
      </p>
      <router-link to="/threat-index" class="btn-primary">
        Return to Threat index
      </router-link>
    </div>

    <!-- State 2: Store Loading State -->
    <div
      v-else-if="threatIndexStore.isLoading"
      class="state-card loading-state"
      role="status"
      aria-live="polite"
    >
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-message">Checking threat unlock status...</p>
    </div>

    <!-- State 3: Store Error / Unavailable State -->
    <div
      v-else-if="threatIndexStore.isUnavailable"
      class="state-card error-state"
      role="alert"
    >
      <div class="state-icon-wrapper">
        <AppIcon name="alert" :size="24" class="state-icon alert-icon" />
      </div>
      <h1 ref="errorHeadingRef" tabindex="-1" class="state-title">
        Unable to verify threat status
      </h1>
      <p class="state-description">
        {{ threatIndexStore.error || 'Could not load your unlocked threat progress. Please try again.' }}
      </p>
      <div class="state-actions">
        <button
          type="button"
          class="btn-primary"
          :disabled="threatIndexStore.isRefreshing"
          @click="handleRetry"
        >
          {{ threatIndexStore.isRefreshing ? 'Retrying...' : 'Try again' }}
        </button>
        <router-link to="/threat-index" class="btn-secondary">
          Back to Threat index
        </router-link>
      </div>
    </div>

    <!-- State 4: Confirmed Locked (or Empty Payload) State -->
    <div
      v-else-if="threatIndexStore.isReady && !isUnlocked"
      class="state-card locked-state"
      role="status"
    >
      <div class="state-icon-wrapper locked-icon-bg">
        <AppIcon name="lock" :size="26" class="state-icon locked-icon" />
      </div>
      <span class="locked-category-pill">
        Category {{ lesson.number }} &bull; {{ lesson.threatName }}
      </span>
      <h1 ref="lockedHeadingRef" tabindex="-1" class="state-title">
        This threat lesson is locked
      </h1>
      <p class="state-description">
        This educational lesson unlocks when you encounter and detect this threat type in the CyberMorph game.
        Play through the <strong>{{ lesson.mapName }}</strong> map to discover it.
      </p>
      <router-link to="/threat-index" class="btn-primary">
        Back to Threat index
      </router-link>
    </div>

    <!-- State 5: Unlocked Ready State (Full Educational Lesson) -->
    <article v-else-if="threatIndexStore.isReady && isUnlocked" class="lesson-article">
      <!-- Lesson Header Banner -->
      <header class="lesson-header">
        <div class="header-badges">
          <span class="badge-number">Threat {{ lesson.number }}</span>
          <span class="badge-map">Map: {{ lesson.mapName }}</span>
          <span v-if="currentEntry?.unlock_date_label" class="badge-unlocked-date">
            <AppIcon name="check" :size="13" />
            <span>{{ currentEntry.unlock_date_label }}</span>
          </span>
        </div>

        <h1 ref="headingRef" tabindex="-1" class="lesson-title">
          {{ lesson.threatName }}
        </h1>

        <p class="lesson-lead">
          {{ lesson.summary }}
        </p>
      </header>

      <!-- Section 1: In-Game Encounter & Warning Signs -->
      <section class="lesson-section" aria-labelledby="heading-encounter">
        <div class="section-header">
          <h2 id="heading-encounter" class="section-title">
            Game encounter: {{ lesson.gameScenario.setting }}
          </h2>
        </div>

        <p class="section-text">
          {{ lesson.gameScenario.description }}
        </p>

        <!-- Warning Signs Callout -->
        <div class="callout-box warning-box">
          <div class="callout-title">
            <AppIcon name="alert" :size="16" class="callout-icon" />
            <span>Warning signs</span>
          </div>
          <ul class="callout-list">
            <li v-for="(sign, index) in lesson.gameScenario.warningSigns" :key="index">
              {{ sign }}
            </li>
          </ul>
        </div>

        <!-- Inert Suspicious Sample Block -->
        <div
          v-if="lesson.gameScenario.suspiciousExamples?.length"
          class="inert-sample-box"
          aria-label="Example suspicious message details"
        >
          <div class="sample-label">
            <AppIcon name="info" :size="14" />
            <span>Example message:</span>
          </div>
          <div class="sample-content">
            <div
              v-for="(example, idx) in lesson.gameScenario.suspiciousExamples"
              :key="idx"
              class="sample-line"
            >
              <code class="inert-code">{{ example }}</code>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Visual Scene & Accessible Caption -->
      <section class="lesson-section visual-section" aria-label="Scene image">
        <figure class="lesson-figure">
          <img
            :src="lesson.screenshot.image"
            :alt="lesson.screenshot.alt"
            class="lesson-image"
            loading="lazy"
          />
          <figcaption class="lesson-caption">
            <AppIcon name="info" :size="14" class="caption-icon" />
            <span>{{ lesson.screenshot.caption }}</span>
          </figcaption>
        </figure>
      </section>

      <!-- Section 3: Recommended Action & Reasoning -->
      <section class="lesson-section" aria-labelledby="heading-action">
        <div class="section-header">
          <h2 id="heading-action" class="section-title">
            What you should do and why
          </h2>
        </div>

        <div class="action-grid">
          <div class="action-card action-step">
            <div class="action-card-header">
              <AppIcon name="shield" :size="18" class="action-icon" />
              <h3 class="action-subheading">Recommended action</h3>
            </div>
            <p class="action-body">
              {{ lesson.recommendedAction.whatToDo }}
            </p>
          </div>

          <div class="action-card reasoning-step">
            <div class="action-card-header">
              <AppIcon name="info" :size="18" class="reasoning-icon" />
              <h3 class="action-subheading">Security reasoning</h3>
            </div>
            <p class="action-body">
              {{ lesson.recommendedAction.whyItMatters }}
            </p>
          </div>
        </div>
      </section>

      <!-- Section 4: Prevention Tips & Key Takeaway -->
      <section class="lesson-section" aria-labelledby="heading-prevention">
        <div class="section-header">
          <h2 id="heading-prevention" class="section-title">
            Prevention tips
          </h2>
        </div>

        <ul class="prevention-list">
          <li v-for="(tip, idx) in lesson.preventionTips" :key="idx" class="prevention-item">
            <span class="tip-bullet" aria-hidden="true">&check;</span>
            <span class="tip-text">{{ tip }}</span>
          </li>
        </ul>

        <!-- Key Takeaway Card -->
        <div class="takeaway-card" role="note" aria-label="Key takeaway">
          <div class="takeaway-badge">
            <AppIcon name="check" :size="14" />
            <span>Key takeaway</span>
          </div>
          <p class="takeaway-text">
            {{ lesson.keyTakeaway }}
          </p>
        </div>
      </section>

      <!-- Bottom Navigation Footer -->
      <footer class="lesson-footer">
        <router-link to="/threat-index" class="btn-primary">
          <AppIcon name="chevron-left" :size="16" />
          <span>Back to Threat index</span>
        </router-link>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.lesson-page-container {
  max-width: 840px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 3rem;
}

/* Navigation */
.lesson-navigation {
  display: flex;
  align-items: center;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-back:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-subtle);
}

.btn-back:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* State Cards */
.state-card {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  box-shadow: var(--shadow-purple-sm);
}

.state-icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: var(--color-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-dim);
}

.state-icon.alert-icon {
  color: #d97706;
}

.locked-icon-bg {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
}

.locked-category-pill {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.state-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.state-title:focus {
  outline: none;
}

.state-description {
  margin: 0;
  max-width: 520px;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.state-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.5rem;
}

/* Shared Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.15rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background-color: #6d28d9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.15rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: var(--color-bg-subtle);
}

/* Spinner */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.state-message {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* Main Article */
.lesson-article {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem 2.25rem;
  box-shadow: var(--shadow-purple-sm);
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (max-width: 640px) {
  .lesson-article {
    padding: 1.25rem 1rem;
    gap: 1.5rem;
  }
}

/* Header */
.lesson-header {
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge-number {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: 9999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-map {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.badge-unlocked-date {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background-color: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 9999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.lesson-title {
  margin: 0;
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--color-text-main);
  line-height: 1.2;
}

.lesson-title:focus {
  outline: none;
}

.lesson-lead {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Sections */
.lesson-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.section-tag {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-primary);
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.section-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--color-text-muted);
}

/* Warning Signs Callout */
.callout-box {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.callout-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #92400e;
}

.callout-icon {
  color: #b45309;
}

.callout-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #78350f;
}

/* Inert Sample Block */
.inert-sample-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sample-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.sample-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sample-line {
  overflow-x: auto;
}

.inert-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.82rem;
  color: var(--color-text-main);
  background-color: var(--color-card);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  display: inline-block;
  user-select: text;
  word-break: break-all;
}

/* Visual Illustration */
.lesson-figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lesson-image {
  width: 100%;
  max-height: 380px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
}

.lesson-caption {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-text-dim);
  padding: 0 0.25rem;
}

.caption-icon {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

/* Action Grid */
.action-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .action-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.action-card {
  border-radius: 8px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-step {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.reasoning-step {
  background-color: var(--color-violet-subtle);
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.action-card-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.action-icon {
  color: #16a34a;
}

.reasoning-icon {
  color: var(--color-primary);
}

.action-subheading {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.action-body {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

/* Prevention Tips */
.prevention-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prevention-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.tip-bullet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.tip-text {
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Key Takeaway Card */
.takeaway-card {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.takeaway-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary);
}

.takeaway-text {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
  color: #4c1d95;
}

/* Footer Navigation */
.lesson-footer {
  border-top: 1px solid var(--color-border);
  padding-top: 1.5rem;
  display: flex;
  justify-content: flex-start;
}
</style>
