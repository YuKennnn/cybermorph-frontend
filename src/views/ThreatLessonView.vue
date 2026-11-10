<script setup>
import { computed, onMounted, onBeforeUnmount, watch, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThreatIndexStore } from '@/stores/threatIndexStore'
import { getThreatLessonBySlug } from '@/data/threatLessons'

const route = useRoute()
const router = useRouter()
const threatStore = useThreatIndexStore()
const headingRef = ref(null)
const enlargeTriggerRef = ref(null)
const dialogCloseBtnRef = ref(null)
const dialogPanelRef = ref(null)

const isLightboxOpen = ref(false)
const hasImageError = ref(false)

const currentSlug = computed(() => String(route.params.slug || '').trim().toLowerCase())

const lesson = computed(() => getThreatLessonBySlug(currentSlug.value))

/**
 * Look up the backend threat index entry matching this lesson's canonical threatName.
 * Never trust the route slug alone — unlock state must come from the backend store.
 */
const backendEntry = computed(() => {
  if (!lesson.value) return null
  return (
    threatStore.entries.find((item) => item.threat_name === lesson.value.threatName) || null
  )
})

const isUnlocked = computed(() => Boolean(backendEntry.value?.is_unlocked))
const isMapContextImage = computed(() => lesson.value?.screenshot?.kind === 'Map context')
const isPracticeExample = computed(() =>
  Boolean(lesson.value?.isPracticeExample || !lesson.value?.screenshot?.sourcePdf),
)
const hasSplitActions = computed(() =>
  Boolean(
    lesson.value?.recommendedAction?.inGameAction &&
      lesson.value?.recommendedAction?.realWorldAction,
  ),
)

function formatUnlockDate(isoString) {
  if (!isoString) return null
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch {
    return null
  }
}

const formattedUnlockedAt = computed(() => formatUnlockDate(backendEntry.value?.unlocked_at))

function syncDocumentTitle() {
  if (!lesson.value) {
    document.title = 'Threat Lesson Not Found | CyberMorph'
    return
  }
  if (threatStore.isReady && isUnlocked.value) {
    document.title = `${lesson.value.threatName} Lesson | CyberMorph`
  } else if (threatStore.isReady && !isUnlocked.value) {
    document.title = 'Locked Threat Lesson | CyberMorph'
  } else {
    document.title = 'Threat Index Lesson | CyberMorph'
  }
}

async function focusMainHeading() {
  await nextTick()
  if (headingRef.value && typeof headingRef.value.focus === 'function') {
    headingRef.value.focus()
  }
}

function handleImageError() {
  hasImageError.value = true
  if (isLightboxOpen.value) {
    isLightboxOpen.value = false
  }
}

async function openLightbox() {
  if (hasImageError.value || !lesson.value?.screenshot?.image) return
  isLightboxOpen.value = true
  await nextTick()
  if (dialogCloseBtnRef.value && typeof dialogCloseBtnRef.value.focus === 'function') {
    dialogCloseBtnRef.value.focus()
  }
}

async function closeLightbox() {
  if (!isLightboxOpen.value) return
  isLightboxOpen.value = false
  await nextTick()
  if (enlargeTriggerRef.value && typeof enlargeTriggerRef.value.focus === 'function') {
    enlargeTriggerRef.value.focus()
  }
}

function handleGlobalKeydown(event) {
  if (!isLightboxOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeLightbox()
    return
  }
  if (event.key === 'Tab' && dialogPanelRef.value) {
    const focusable = Array.from(
      dialogPanelRef.value.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

async function handleRetry() {
  try {
    await threatStore.loadThreatIndex(true)
  } catch {
    // Store captures and exposes error state safely
  }
}

function goBackToThreatIndex() {
  router.push({ name: 'threat-index' })
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  syncDocumentTitle()
  try {
    await threatStore.loadThreatIndex()
  } catch {
    // Store handles error state
  }
  syncDocumentTitle()
  await focusMainHeading()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch([currentSlug, () => threatStore.status, isUnlocked], async ([newSlug], [oldSlug]) => {
  if (newSlug !== oldSlug) {
    hasImageError.value = false
    isLightboxOpen.value = false
  }
  syncDocumentTitle()
  await focusMainHeading()
})
</script>

<template>
  <div class="threat-lesson-page">
    <!-- Top Back Navigation -->
      <nav class="lesson-breadcrumb" aria-label="Breadcrumb">
        <router-link :to="{ name: 'threat-index' }" class="btn-back">
          <svg
            class="icon-back"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Threat index</span>
        </router-link>
      </nav>

      <!-- State 1: Unknown / Invalid Slug -->
      <section
        v-if="!lesson"
        class="state-card not-found-state"
        aria-live="polite"
      >
        <div class="state-icon-box warning" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h1 ref="headingRef" tabindex="-1" class="state-title">
          Threat category not found
        </h1>
        <p class="state-desc">
          The requested threat lesson does not match any of the 8 canonical CyberMorph threat categories.
        </p>
        <button type="button" class="btn-primary" @click="goBackToThreatIndex">
          Return to Threat index
        </button>
      </section>

      <!-- State 2: Initial Loading Skeleton -->
      <section
        v-else-if="threatStore.isLoading"
        class="lesson-skeleton"
        aria-busy="true"
        aria-label="Loading threat lesson"
      >
        <div class="skeleton-header">
          <div class="skeleton-line badge-line"></div>
          <div class="skeleton-line title-line"></div>
          <div class="skeleton-line summary-line"></div>
        </div>
        <div class="skeleton-image"></div>
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
      </section>

      <!-- State 3: Error / Degraded Backend State -->
      <section
        v-else-if="threatStore.isUnavailable || threatStore.isIncomplete"
        class="state-card error-state"
        role="alert"
      >
        <div class="state-icon-box danger" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h1 ref="headingRef" tabindex="-1" class="state-title">
          Unable to verify lesson unlock status
        </h1>
        <p class="state-desc">
          {{
            threatStore.error ||
            'We could not verify your Threat Index progress with the server. Please retry.'
          }}
        </p>
        <div class="state-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="threatStore.isRefreshing"
            @click="handleRetry"
          >
            {{ threatStore.isRefreshing ? 'Retrying...' : 'Retry verification' }}
          </button>
          <button type="button" class="btn-secondary" @click="goBackToThreatIndex">
            Back to Threat index
          </button>
        </div>
      </section>

      <!-- State 4: Locked Threat Guard -->
      <section
        v-else-if="!isUnlocked"
        class="state-card locked-state"
        aria-live="polite"
      >
        <div class="state-icon-box locked" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <div class="locked-meta">
          <span class="threat-code">Category {{ lesson.code }}</span>
          <span class="status-badge locked">Locked</span>
        </div>
        <h1 ref="headingRef" tabindex="-1" class="state-title">
          This threat lesson is locked
        </h1>
        <p class="state-desc">
          Encounter and detect <strong>{{ lesson.threatName }}</strong> inside the CyberMorph mobile game and sync your session to unlock this reference lesson.
        </p>
        <button type="button" class="btn-primary" @click="goBackToThreatIndex">
          Return to Threat index
        </button>
      </section>

      <!-- State 5: Unlocked Full Lesson View -->
      <article v-else class="lesson-article">
        <!-- Hero Header -->
        <header class="lesson-hero">
          <div class="hero-meta-row">
            <span class="threat-code">Category {{ lesson.code }}</span>
            <span class="map-pill">{{ lesson.mapName }} map</span>
            <span class="status-badge unlocked">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Unlocked<template v-if="formattedUnlockedAt"> · {{ formattedUnlockedAt }}</template>
            </span>
          </div>

          <h1 ref="headingRef" tabindex="-1" class="lesson-title">
            {{ lesson.threatName }}
          </h1>
          <p class="lesson-summary">{{ lesson.summary }}</p>
        </header>

        <!-- Section 1: Game Encounter + Integrated Visual Evidence -->
        <section class="lesson-section encounter-section" aria-labelledby="section-encounter">
          <div class="section-header">
            <span class="section-kicker">
              {{ isPracticeExample ? '01 · Practice example' : '01 · Game encounter' }}
            </span>
            <h2 id="section-encounter" class="section-title">
              {{ lesson.gameScenario.setting }}
            </h2>
          </div>

          <p class="section-body">{{ lesson.gameScenario.description }}</p>

          <!-- Primary Screenshot / Map Context Figure placed directly inside the encounter section -->
          <figure class="lesson-figure">
            <div class="figure-toolbar">
              <div class="figure-badges">
                <span
                  class="evidence-badge"
                  :class="isMapContextImage ? 'is-map-context' : 'is-scenario'"
                >
                  {{ lesson.screenshot.kind }}
                </span>
                <span v-if="lesson.screenshot.mapLabel" class="figure-map-tag">
                  {{ lesson.screenshot.mapLabel }}
                </span>
              </div>

              <button
                v-if="!hasImageError"
                ref="enlargeTriggerRef"
                type="button"
                class="btn-enlarge"
                :aria-label="`Enlarge screenshot for ${lesson.threatName}`"
                aria-haspopup="dialog"
                :aria-expanded="isLightboxOpen ? 'true' : 'false'"
                @click="openLightbox"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
                <span>Enlarge screenshot</span>
              </button>
            </div>

            <div class="figure-frame">
              <img
                v-if="!hasImageError"
                :src="lesson.screenshot.image"
                :alt="lesson.screenshot.alt"
                class="lesson-image"
                loading="lazy"
                @error="handleImageError"
                @click="openLightbox"
              />
              <div v-else class="figure-fallback" role="status">
                <p class="fallback-title">Screenshot preview unavailable</p>
                <p class="fallback-desc">{{ lesson.screenshot.alt }}</p>
              </div>
            </div>

            <figcaption class="lesson-caption">
              <p class="caption-text">{{ lesson.screenshot.caption }}</p>
              <p v-if="lesson.screenshot.clue" class="caption-clue">
                <span class="clue-label">Clue to inspect:</span>
                <code class="inert-code clue-code">{{ lesson.screenshot.clue }}</code>
              </p>
            </figcaption>
          </figure>

          <!-- Warning Signs & Inert Suspicious Examples -->
          <div class="warning-signs-box">
            <h3 class="subsection-title">
              {{ isPracticeExample ? 'What to notice in this example' : 'Warning signs in this encounter' }}
            </h3>
            <ul class="warning-list">
              <li
                v-for="(sign, index) in lesson.gameScenario.warningSigns"
                :key="index"
                class="warning-item"
              >
                <span class="warning-bullet" aria-hidden="true">!</span>
                <span>{{ sign }}</span>
              </li>
            </ul>

            <div
              v-if="lesson.gameScenario.suspiciousExamples?.length"
              class="inert-examples"
            >
              <span class="inert-label">Examples to watch for</span>
              <div class="inert-code-list">
                <code
                  v-for="(example, idx) in lesson.gameScenario.suspiciousExamples"
                  :key="idx"
                  class="inert-code"
                >
                  {{ example }}
                </code>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: Recommended Action (In-game vs Real-world + Why it matters) -->
        <section class="lesson-section" aria-labelledby="section-action">
          <div class="section-header">
            <span class="section-kicker">02 · Recommended response</span>
            <h2 id="section-action" class="section-title">
              How to respond
            </h2>
          </div>

          <div class="action-grid">
            <div class="action-card do-card">
              <div class="action-card-header">
                <svg
                  class="action-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h3 class="action-subheading">What to do</h3>
              </div>
              <p
                v-if="!hasSplitActions && lesson.recommendedAction.whatToDo"
                class="action-body"
              >
                {{ lesson.recommendedAction.whatToDo }}
              </p>
              <dl
                v-if="lesson.recommendedAction.inGameAction || lesson.recommendedAction.realWorldAction"
                class="action-split-list"
                :class="{ 'is-standalone': hasSplitActions }"
              >
                <div v-if="lesson.recommendedAction.inGameAction" class="action-split-row">
                  <dt class="action-split-term">In CyberMorph</dt>
                  <dd class="action-split-def">{{ lesson.recommendedAction.inGameAction }}</dd>
                </div>
                <div v-if="lesson.recommendedAction.realWorldAction" class="action-split-row">
                  <dt class="action-split-term">In real life</dt>
                  <dd class="action-split-def">{{ lesson.recommendedAction.realWorldAction }}</dd>
                </div>
              </dl>
            </div>

            <div class="action-card why-card">
              <div class="action-card-header">
                <svg
                  class="reasoning-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <h3 class="action-subheading">Why it matters</h3>
              </div>
              <p class="action-body">{{ lesson.recommendedAction.whyItMatters }}</p>
            </div>
          </div>
        </section>

        <!-- Section 3: Prevention Checklist -->
        <section
          v-if="lesson.preventionTips?.length"
          class="lesson-section"
          aria-labelledby="section-prevention"
        >
          <div class="section-header">
            <span class="section-kicker">03 · Everyday defense</span>
            <h2 id="section-prevention" class="section-title">
              Prevention checklist
            </h2>
          </div>

          <ul class="prevention-list">
            <li
              v-for="(tip, idx) in lesson.preventionTips"
              :key="idx"
              class="prevention-item"
            >
              <span class="tip-bullet" aria-hidden="true">✓</span>
              <span class="tip-text">{{ tip }}</span>
            </li>
          </ul>
        </section>

        <!-- Section 4: Key Takeaway Callout -->
        <aside
          v-if="lesson.keyTakeaway"
          class="takeaway-card"
          aria-label="Key takeaway"
        >
          <div class="takeaway-badge">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Key takeaway</span>
          </div>
          <p class="takeaway-text">{{ lesson.keyTakeaway }}</p>
        </aside>

        <!-- Bottom Navigation -->
        <footer class="lesson-footer">
          <router-link :to="{ name: 'threat-index' }" class="btn-secondary">
            Back to Threat index
          </router-link>
        </footer>
      </article>

      <!-- Accessible Screenshot Lightbox Dialog -->
      <Transition name="lightbox-fade">
        <div
          v-if="isLightboxOpen && lesson && !hasImageError"
          class="lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`lightbox-title-${lesson.slug}`"
          @click.self="closeLightbox"
        >
          <div ref="dialogPanelRef" class="lightbox-dialog">
            <header class="lightbox-header">
              <div class="lightbox-title-group">
                <span
                  class="evidence-badge"
                  :class="isMapContextImage ? 'is-map-context' : 'is-scenario'"
                >
                  {{ lesson.screenshot.kind }}
                </span>
                <h2 :id="`lightbox-title-${lesson.slug}`" class="lightbox-title">
                  {{ lesson.threatName }} — {{ lesson.mapName }} map
                </h2>
              </div>
              <button
                ref="dialogCloseBtnRef"
                type="button"
                class="btn-lightbox-close"
                aria-label="Close enlarged screenshot"
                @click="closeLightbox"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Close</span>
              </button>
            </header>

            <div class="lightbox-body">
              <img
                :src="lesson.screenshot.image"
                :alt="lesson.screenshot.alt"
                class="lightbox-image"
              />
            </div>

            <footer class="lightbox-footer">
              <p class="lightbox-caption">{{ lesson.screenshot.caption }}</p>
              <p v-if="lesson.screenshot.clue" class="caption-clue">
                <span class="clue-label">Clue to inspect:</span>
                <code class="inert-code clue-code">{{ lesson.screenshot.clue }}</code>
              </p>
            </footer>
          </div>
        </div>
      </Transition>
  </div>
</template>

<style scoped>
.threat-lesson-page {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lesson-breadcrumb {
  display: flex;
  align-items: center;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  text-decoration: none;
  transition:
    color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.btn-back:hover {
  color: var(--color-primary);
  border-color: var(--color-primary-border);
  background-color: var(--color-primary-light);
}

.btn-back:active {
  transform: scale(0.98);
}

.btn-back:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* State Cards (Locked / Not Found / Error) */
.state-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.85rem;
}

.state-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-icon-box.locked {
  background-color: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.state-icon-box.warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.state-icon-box.danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.locked-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.state-desc {
  margin: 0;
  max-width: 480px;
  font-size: 0.925rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.55rem 1.15rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: var(--color-primary);
  color: #ffffff;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.55rem 1.15rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: var(--color-surface);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  cursor: pointer;
  text-decoration: none;
  transition:
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.btn-secondary:hover {
  border-color: var(--color-primary-border);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.btn-secondary:active {
  transform: scale(0.98);
}

/* Skeleton Loader */
.lesson-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skeleton-header {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background-color: var(--color-border);
}

.skeleton-line.badge-line {
  width: 140px;
}

.skeleton-line.title-line {
  width: 260px;
  height: 26px;
}

.skeleton-line.summary-line {
  width: 90%;
}

.skeleton-image {
  height: 260px;
  border-radius: 10px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
}

.skeleton-block {
  height: 160px;
  border-radius: 10px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
}

/* Full Lesson Article */
.lesson-article {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lesson-hero {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hero-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.threat-code {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.map-pill {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border: 1px solid var(--color-primary-border);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.status-badge.unlocked {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-badge.locked {
  background-color: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.lesson-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-text-main);
  letter-spacing: -0.02em;
}

.lesson-title:focus {
  outline: none;
}

.lesson-summary {
  margin: 0;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--color-text-muted);
  max-width: 70ch;
}

/* Lesson Sections */
.lesson-section {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.section-kicker {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary);
}

.section-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.section-body {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--color-text-main);
  max-width: 72ch;
}

/* Integrated Visual Figure inside Game Encounter */
.lesson-figure {
  margin: 0.25rem 0 0;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.figure-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.65rem 1rem;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.figure-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.evidence-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.evidence-badge.is-scenario {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-border);
}

.evidence-badge.is-map-context {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.figure-map-tag {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.btn-enlarge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border: 1px solid var(--color-primary-border);
  cursor: pointer;
  transition:
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.btn-enlarge:hover {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.btn-enlarge:active {
  transform: scale(0.98);
}

.btn-enlarge:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.figure-frame {
  background-color: #13111c;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.lesson-image {
  display: block;
  width: 100%;
  max-height: 460px;
  object-fit: contain;
  border-radius: 6px;
  cursor: zoom-in;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.figure-fallback {
  width: 100%;
  padding: 2rem 1.25rem;
  text-align: center;
  background-color: var(--color-surface);
  border-radius: 6px;
}

.fallback-title {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.fallback-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.lesson-caption {
  padding: 0.9rem 1.15rem;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.caption-text {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-main);
  line-height: 1.55;
}

.caption-clue {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.clue-label {
  font-weight: 700;
  color: var(--color-text-main);
}

/* Warning Signs Box */
.warning-signs-box {
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: 8px;
  padding: 1.15rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.subsection-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.warning-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text-main);
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.warning-item > span:not(.warning-bullet) {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.warning-bullet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--color-warning);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.inert-examples {
  border-top: 1px solid var(--color-warning-border);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.inert-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.inert-code-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.inert-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  background-color: var(--color-surface);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  word-break: break-all;
  user-select: all;
}

.clue-code {
  font-size: 0.78rem;
  padding: 0.15rem 0.45rem;
}

/* Action Grid */
.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 680px) {
  .action-grid {
    grid-template-columns: 1fr;
  }

  .lesson-section,
  .lesson-hero {
    padding: 1.25rem;
  }
}

.action-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.action-card-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.action-icon {
  color: var(--color-success);
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

.action-split-list {
  margin: 0.25rem 0 0;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.action-split-list.is-standalone {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.action-split-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.action-split-term {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.action-split-def {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
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
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
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
  background-color: var(--color-primary-light);
  border: 1px solid var(--color-primary-border);
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
  color: var(--color-text-main);
}

/* Footer Navigation */
.lesson-footer {
  border-top: 1px solid var(--color-border);
  padding-top: 1.5rem;
  display: flex;
  justify-content: flex-start;
}

/* Lightbox Modal Dialog */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background-color: rgba(15, 23, 42, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.lightbox-dialog {
  width: min(1080px, 100%);
  max-height: 92vh;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
}

.lightbox-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--color-border);
}

.lightbox-title-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.lightbox-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.btn-lightbox-close {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  background-color: var(--color-bg);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition:
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.btn-lightbox-close:hover {
  border-color: var(--color-primary-border);
  color: var(--color-primary);
}

.btn-lightbox-close:active {
  transform: scale(0.98);
}

.btn-lightbox-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.lightbox-body {
  background-color: #13111c;
  padding: 0.75rem;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-image {
  display: block;
  max-width: 100%;
  max-height: 68vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
}

.lightbox-footer {
  padding: 0.85rem 1.15rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.lightbox-caption {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--color-text-main);
}

/* Lightbox 180ms Transition */
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lightbox-fade-enter-active .lightbox-dialog,
.lightbox-fade-leave-active .lightbox-dialog {
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

.lightbox-fade-enter-from .lightbox-dialog,
.lightbox-fade-leave-to .lightbox-dialog {
  transform: scale(0.97);
}

/* Reduced Motion Compliance (OS + In-App Preference) */
@media (prefers-reduced-motion: reduce) {
  .btn-back,
  .btn-primary,
  .btn-secondary,
  .btn-enlarge,
  .btn-lightbox-close,
  .lesson-image,
  .lightbox-fade-enter-active,
  .lightbox-fade-leave-active,
  .lightbox-fade-enter-active .lightbox-dialog,
  .lightbox-fade-leave-active .lightbox-dialog {
    transition: none !important;
  }

  .btn-back:active,
  .btn-primary:active,
  .btn-secondary:active,
  .btn-enlarge:active,
  .btn-lightbox-close:active,
  .lightbox-fade-enter-from .lightbox-dialog,
  .lightbox-fade-leave-to .lightbox-dialog {
    transform: none !important;
  }
}

:global(:root[data-reduced-motion='true']) .btn-back,
:global(:root[data-reduced-motion='true']) .btn-primary,
:global(:root[data-reduced-motion='true']) .btn-secondary,
:global(:root[data-reduced-motion='true']) .btn-enlarge,
:global(:root[data-reduced-motion='true']) .btn-lightbox-close,
:global(:root[data-reduced-motion='true']) .lesson-image,
:global(:root[data-reduced-motion='true']) .lightbox-fade-enter-active,
:global(:root[data-reduced-motion='true']) .lightbox-fade-leave-active,
:global(:root[data-reduced-motion='true']) .lightbox-fade-enter-active .lightbox-dialog,
:global(:root[data-reduced-motion='true']) .lightbox-fade-leave-active .lightbox-dialog {
  transition: none !important;
}

:global(:root[data-reduced-motion='true']) .btn-back:active,
:global(:root[data-reduced-motion='true']) .btn-primary:active,
:global(:root[data-reduced-motion='true']) .btn-secondary:active,
:global(:root[data-reduced-motion='true']) .btn-enlarge:active,
:global(:root[data-reduced-motion='true']) .btn-lightbox-close:active,
:global(:root[data-reduced-motion='true']) .lightbox-fade-enter-from .lightbox-dialog,
:global(:root[data-reduced-motion='true']) .lightbox-fade-leave-to .lightbox-dialog {
  transform: none !important;
}
</style>
