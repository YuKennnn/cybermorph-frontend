<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCanonicalBySlug, useThreatIndexStore } from '@/stores/threatIndexStore'
import { getThreatLessonBySlug } from '@/data/threatLessons'
import AppIcon from '@/components/common/AppIcon.vue'

const route = useRoute()
const threatStore = useThreatIndexStore()

const titleRef = ref(null)
const enlargeBtnRef = ref(null)
const lightboxCloseBtnRef = ref(null)

const isLightboxOpen = ref(false)
const isRetrying = ref(false)

const slug = computed(() => String(route.params.slug || '').trim().toLowerCase())

const canonicalThreat = computed(() => getCanonicalBySlug(slug.value))

const storeEntry = computed(() => {
  if (!Array.isArray(threatStore.entries)) return null
  return threatStore.entries.find((entry) => entry.slug === slug.value) || null
})

const hasCatalogEntries = computed(
  () => Array.isArray(threatStore.entries) && threatStore.entries.length > 0,
)

const isLoadingState = computed(() => threatStore.isLoading && !hasCatalogEntries.value)

const isErrorState = computed(
  () =>
    !threatStore.isLoading &&
    (threatStore.isUnavailable || threatStore.isMalformed || threatStore.isIncomplete) &&
    !hasCatalogEntries.value,
)

const isNotFoundState = computed(
  () => !isLoadingState.value && !isErrorState.value && !canonicalThreat.value,
)

const isUnlocked = computed(() =>
  Boolean(canonicalThreat.value && storeEntry.value && storeEntry.value.is_unlocked),
)

const isLockedState = computed(
  () =>
    !isLoadingState.value &&
    !isErrorState.value &&
    Boolean(canonicalThreat.value) &&
    !isUnlocked.value,
)

const lesson = computed(() => {
  if (!isUnlocked.value) return null
  return getThreatLessonBySlug(slug.value)
})

const unlockedEntries = computed(() => {
  if (!Array.isArray(threatStore.entries)) return []
  return threatStore.entries.filter((item) => item.is_unlocked)
})

const currentUnlockedPosition = computed(() =>
  unlockedEntries.value.findIndex((item) => item.slug === slug.value),
)

const prevUnlocked = computed(() => {
  if (currentUnlockedPosition.value <= 0) return null
  return unlockedEntries.value[currentUnlockedPosition.value - 1] || null
})

const nextUnlocked = computed(() => {
  if (
    currentUnlockedPosition.value < 0 ||
    currentUnlockedPosition.value >= unlockedEntries.value.length - 1
  ) {
    return null
  }
  return unlockedEntries.value[currentUnlockedPosition.value + 1] || null
})

function syncDocumentTitle() {
  if (isUnlocked.value && canonicalThreat.value) {
    document.title = `${canonicalThreat.value.threat_name} Lesson | CyberMorph`
    return
  }
  if (isLockedState.value && canonicalThreat.value) {
    document.title = `${canonicalThreat.value.threat_name} Locked | CyberMorph`
    return
  }
  if (isNotFoundState.value) {
    document.title = 'Threat Not Found | CyberMorph'
    return
  }
  document.title = 'Threat Lesson | CyberMorph'
}

async function focusLessonHeading() {
  if (!isUnlocked.value) return
  await nextTick()
  if (titleRef.value) {
    titleRef.value.focus({ preventScroll: true })
  }
}

function openLightbox() {
  if (!lesson.value?.screenshot?.image) return
  isLightboxOpen.value = true
  nextTick(() => {
    lightboxCloseBtnRef.value?.focus()
  })
}

function closeLightbox() {
  if (!isLightboxOpen.value) return
  isLightboxOpen.value = false
  nextTick(() => {
    enlargeBtnRef.value?.focus()
  })
}

function handleGlobalKeydown(event) {
  if (!isLightboxOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeLightbox()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    lightboxCloseBtnRef.value?.focus()
  }
}

async function handleRetry() {
  if (isRetrying.value) return
  isRetrying.value = true
  try {
    await threatStore.loadThreatIndex({ force: true })
  } finally {
    isRetrying.value = false
  }
}

onMounted(() => {
  threatStore.loadThreatIndex()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(
  [slug, isUnlocked, isLockedState, isNotFoundState],
  ([, unlocked], [prevSlug]) => {
    syncDocumentTitle()
    if (slug.value !== prevSlug) {
      isLightboxOpen.value = false
    }
    if (unlocked) {
      focusLessonHeading()
    }
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <div class="lesson-page">
    <!-- Slim Navigation Row -->
    <nav class="lesson-topbar" aria-label="Threat dossier navigation">
      <router-link to="/threat-index" class="btn-back">
        <AppIcon name="arrow-left" :size="16" />
        <span>Back to threat index</span>
      </router-link>

      <div v-if="isUnlocked && unlockedEntries.length > 1" class="lesson-pager">
        <router-link
          v-if="prevUnlocked"
          :to="`/threat-index/${prevUnlocked.slug}`"
          class="pager-btn"
          :title="`Previous: ${prevUnlocked.threat_name}`"
          :aria-label="`Previous threat: ${prevUnlocked.threat_name}`"
        >
          <AppIcon name="chevron-left" :size="16" />
        </router-link>
        <span v-else class="pager-btn is-disabled" aria-hidden="true">
          <AppIcon name="chevron-left" :size="16" />
        </span>

        <span class="pager-count">
          {{ currentUnlockedPosition + 1 }} / {{ unlockedEntries.length }}
        </span>

        <router-link
          v-if="nextUnlocked"
          :to="`/threat-index/${nextUnlocked.slug}`"
          class="pager-btn"
          :title="`Next: ${nextUnlocked.threat_name}`"
          :aria-label="`Next threat: ${nextUnlocked.threat_name}`"
        >
          <AppIcon name="chevron-right" :size="16" />
        </router-link>
        <span v-else class="pager-btn is-disabled" aria-hidden="true">
          <AppIcon name="chevron-right" :size="16" />
        </span>
      </div>
    </nav>

    <!-- Loading Skeleton -->
    <section
      v-if="isLoadingState"
      class="state-card loading-card"
      aria-busy="true"
      aria-label="Loading threat lesson"
    >
      <div class="skeleton-line short shimmer-box"></div>
      <div class="skeleton-line title shimmer-box"></div>
      <div class="skeleton-split">
        <div class="skeleton-media shimmer-box"></div>
        <div class="skeleton-panel shimmer-box"></div>
      </div>
    </section>

    <!-- Error State -->
    <section v-else-if="isErrorState" class="state-card error-state" role="alert">
      <div class="state-icon is-danger">
        <AppIcon name="warning" :size="24" />
      </div>
      <h1 class="state-title">Could not verify threat lesson access</h1>
      <p class="state-copy">
        Your unlocked threat index could not be loaded right now. Retry to check your progress.
      </p>
      <div class="state-actions">
        <button type="button" class="btn-primary" :disabled="isRetrying" @click="handleRetry">
          <AppIcon name="refresh" :size="15" :class="{ 'spin-icon': isRetrying }" />
          <span>{{ isRetrying ? 'Retrying...' : 'Retry loading' }}</span>
        </button>
        <router-link to="/threat-index" class="btn-secondary">Back to threat index</router-link>
      </div>
    </section>

    <!-- Not Found State -->
    <section v-else-if="isNotFoundState" class="state-card not-found-state">
      <div class="state-icon">
        <AppIcon name="info" :size="24" />
      </div>
      <h1 class="state-title">Threat category not found</h1>
      <p class="state-copy">
        That threat link does not match one of CyberMorph's eight threat categories.
      </p>
      <div class="state-actions">
        <router-link to="/threat-index" class="btn-primary">Return to threat index</router-link>
      </div>
    </section>

    <!-- Locked State (Never exposes lesson details or screenshot) -->
    <section v-else-if="isLockedState" class="state-card locked-state">
      <div class="state-icon">
        <AppIcon name="lock" :size="24" />
      </div>
      <h1 class="state-title">This threat lesson is locked</h1>
      <p class="state-copy">
        Encounter <strong>{{ canonicalThreat?.threat_name }}</strong> in the game and sync your
        session to unlock this dossier.
      </p>
      <div class="state-actions">
        <router-link to="/threat-index" class="btn-primary">Return to threat index</router-link>
      </div>
    </section>

    <!-- Unlocked Clean Visual Case File -->
    <article v-else-if="isUnlocked && lesson && canonicalThreat" class="lesson-article">
      <!-- Open Canvas Title Strip (Zero Extra Box) -->
      <header class="title-strip">
        <div class="meta-chips">
          <span class="badge-chip is-map">{{ lesson.mapName }} map</span>
          <span class="badge-chip is-code">#{{ String(canonicalThreat.number).padStart(2, '0') }}</span>
          <span v-if="storeEntry?.unlock_date_label" class="badge-chip is-unlocked">
            <AppIcon name="unlock" :size="12" />
            {{ storeEntry.unlock_date_label }}
          </span>
        </div>

        <h1 ref="titleRef" tabindex="-1" class="lesson-title">
          {{ canonicalThreat.threat_name }}
        </h1>

        <p class="lesson-takeaway">
          <AppIcon name="shield" :size="16" class="takeaway-icon" aria-hidden="true" />
          <span>{{ lesson.coreRule }}</span>
        </p>
      </header>

      <!-- Focused 2-Panel Visual Layout -->
      <div class="showcase-grid">
        <!-- Left Panel: Large Game Encounter Screenshot + Direct Action Pair -->
        <section class="visual-stage" aria-label="Encounter preview and response">
          <div class="visual-frame">
            <img
              :src="lesson.screenshot.image"
              :alt="lesson.screenshot.alt"
              class="lesson-image"
              @click="openLightbox"
            />
            <button
              ref="enlargeBtnRef"
              type="button"
              class="btn-enlarge"
              aria-label="Enlarge encounter screenshot"
              @click="openLightbox"
            >
              <AppIcon name="zoom-in" :size="15" />
              <span>Enlarge</span>
            </button>
          </div>

          <!-- Always-Visible 2-Column Decision Strip (No Tabs!) -->
          <div class="decision-duo">
            <div class="decision-item is-game">
              <div class="decision-head">
                <AppIcon name="game" :size="15" class="decision-icon" />
                <span class="decision-tag">In game</span>
              </div>
              <strong class="decision-action">{{ lesson.gameMove.badge }}</strong>
              <p class="decision-note">{{ lesson.gameMove.note }}</p>
            </div>

            <div class="decision-item is-real">
              <div class="decision-head">
                <AppIcon name="shield" :size="15" class="decision-icon is-success" />
                <span class="decision-tag is-success">Real life</span>
              </div>
              <strong class="decision-action">{{ lesson.realMove.badge }}</strong>
              <p class="decision-note">{{ lesson.realMove.note }}</p>
            </div>
          </div>
        </section>

        <!-- Right Panel: Instant Spot-The-Trap Signals + Exact Inert Tokens -->
        <section class="signals-stage" aria-label="What gives this attack away">
          <div class="signals-header">
            <AppIcon name="warning" :size="17" class="signals-warn-icon" />
            <h2 class="signals-title">What to spot</h2>
          </div>

          <ol class="signals-list">
            <li v-for="sig in lesson.spotSignals" :key="sig.id" class="signal-row">
              <span class="signal-num">{{ sig.index }}</span>
              <div class="signal-body">
                <strong class="signal-label">{{ sig.title }}</strong>
                <span class="signal-note">{{ sig.note }}</span>
              </div>
            </li>
          </ol>

          <div v-if="lesson.clueTokens.length > 0" class="clues-bar">
            <span class="clues-label">Clues in scene</span>
            <div class="inert-code-row">
              <code v-for="token in lesson.clueTokens" :key="token" class="inert-code">
                {{ token }}
              </code>
            </div>
          </div>
        </section>
      </div>
    </article>

    <!-- Accessible Opaque Screenshot Lightbox Modal -->
    <Teleport to="body">
      <div
        v-if="isLightboxOpen && lesson?.screenshot"
        class="lightbox-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="`${canonicalThreat?.threat_name || 'Threat'} screenshot enlarged`"
        @click.self="closeLightbox"
      >
        <div class="lightbox-dialog">
          <div class="lightbox-header">
            <div class="lightbox-title-wrap">
              <span class="badge-chip is-map">{{ lesson.screenshot.mapLabel }}</span>
              <span class="lightbox-heading">{{ canonicalThreat?.threat_name }}</span>
            </div>
            <button
              ref="lightboxCloseBtnRef"
              type="button"
              class="lightbox-close-btn"
              aria-label="Close enlarged screenshot"
              @click="closeLightbox"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </div>

          <div class="lightbox-media">
            <img
              :src="lesson.screenshot.image"
              :alt="lesson.screenshot.alt"
              class="lightbox-img"
            />
          </div>

          <div v-if="lesson.clueTokens.length > 0" class="lightbox-footer">
            <span class="lightbox-clue-label">Clues:</span>
            <div class="inert-code-row">
              <code v-for="token in lesson.clueTokens" :key="`lb-${token}`" class="inert-code">
                {{ token }}
              </code>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lesson-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  min-width: 0;
}

/* ============================================================================
 * Top Navigation & Compact Pager
 * ========================================================================== */
.lesson-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-back:hover {
  border-color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  transform: translateX(-2px);
}

.btn-back:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.lesson-pager {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.pager-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.pager-btn:hover:not(.is-disabled) {
  border-color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
}

.pager-btn.is-disabled {
  opacity: 0.35;
  cursor: default;
}

.pager-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.pager-count {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  padding: 0 0.25rem;
}

/* ============================================================================
 * Clean Open Canvas Header
 * ========================================================================== */
.lesson-article {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: lesson-enter 0.36s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes lesson-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title-strip {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.25rem 0.15rem;
}

.meta-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.badge-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-chip.is-map {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-violet-border);
}

.badge-chip.is-code {
  font-family: var(--font-mono);
  background-color: var(--color-card);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  font-variant-numeric: tabular-nums;
}

.badge-chip.is-unlocked {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.lesson-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 2.8vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--color-text-main);
  line-height: 1.15;
  outline: none;
}

.lesson-title:focus,
.lesson-title:focus-visible {
  outline: none;
}

.lesson-takeaway {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--color-text-muted);
  max-width: 72ch;
}

.takeaway-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

/* ============================================================================
 * Showcase 2-Column Stage
 * ========================================================================== */
.showcase-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.32fr) minmax(0, 0.95fr);
  gap: 1.25rem;
  align-items: stretch;
}

.visual-stage,
.signals-stage {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.15rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.visual-frame {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-muted);
  aspect-ratio: 16 / 9;
}

.lesson-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.visual-frame:hover .lesson-image {
  transform: scale(1.02);
}

.btn-enlarge {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0.35rem 0.78rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background-color: rgba(15, 23, 42, 0.85);
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-enlarge:hover {
  background-color: var(--color-primary);
  border-color: transparent;
  transform: translateY(-1px);
}

.btn-enlarge:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* Always-Visible Decision Duo */
.decision-duo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: auto;
}

.decision-item {
  padding: 0.8rem 0.95rem;
  border-radius: 11px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.decision-item.is-game {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-violet-border);
}

.decision-item.is-real {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
}

.decision-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.decision-icon {
  color: var(--color-primary);
}

.decision-icon.is-success {
  color: var(--color-success);
}

.decision-tag {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-primary);
}

.decision-tag.is-success {
  color: var(--color-success);
}

.decision-action {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.decision-note {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

/* Instant Scan Signals Card */
.signals-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.signals-warn-icon {
  color: var(--color-warning);
}

.signals-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.signals-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.signal-row {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.72rem 0.85rem;
  border-radius: 11px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.signal-row:hover {
  border-color: var(--color-violet-border);
  background-color: var(--color-violet-subtle);
}

.signal-num {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--btn-gradient);
  color: #ffffff;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}

.signal-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.signal-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.3;
}

.signal-note {
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.clues-bar {
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.clues-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--color-text-dim);
}

.inert-code-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.inert-code {
  display: inline-block;
  max-width: 100%;
  padding: 0.28rem 0.6rem;
  border-radius: 7px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  font-family: var(--font-mono);
  font-size: 0.77rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
  user-select: all;
}

/* ============================================================================
 * Opaque Lightbox Modal (Verified Tokens for Light & Dark Themes)
 * ========================================================================== */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(15, 23, 42, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.lightbox-dialog {
  width: min(960px, 100%);
  max-height: 92vh;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lightbox-in 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes lightbox-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.25rem;
  background-color: var(--color-card);
  border-bottom: 1px solid var(--color-border);
}

.lightbox-title-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.lightbox-heading {
  font-family: var(--font-display);
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.lightbox-close-btn {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.lightbox-close-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.lightbox-close-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.lightbox-media {
  padding: 1rem 1.25rem;
  background-color: var(--color-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  flex: 1;
}

.lightbox-img {
  max-width: 100%;
  max-height: 66vh;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  object-fit: contain;
  display: block;
}

.lightbox-footer {
  padding: 0.85rem 1.25rem;
  background-color: var(--color-card);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.lightbox-clue-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* ============================================================================
 * State Cards (Loading, Error, Not Found, Locked)
 * ========================================================================== */
.state-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 2.5rem 1.75rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
}

.loading-card {
  align-items: stretch;
  text-align: left;
  padding: 1.5rem;
}

.skeleton-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.skeleton-media,
.skeleton-panel {
  height: 260px;
  border-radius: 12px;
}

.skeleton-line {
  height: 14px;
  border-radius: 6px;
}

.skeleton-line.short {
  width: 24%;
}

.skeleton-line.title {
  width: 44%;
  height: 24px;
}

.shimmer-box {
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle) 25%,
    var(--color-bg-muted) 50%,
    var(--color-bg-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s infinite linear;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.error-state {
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

.state-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-icon.is-danger {
  background-color: var(--color-card);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.state-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.state-copy {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  max-width: 48ch;
}

.state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.4rem;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.55rem 1.15rem;
  border-radius: 9px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.btn-primary {
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
}

.btn-primary:focus-visible,
.btn-secondary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.spin-icon {
  animation: spin-rotate 0.8s linear infinite;
}

@keyframes spin-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* ============================================================================
 * Responsive Breakpoints
 * ========================================================================== */
@media (max-width: 920px) {
  .showcase-grid,
  .skeleton-split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .visual-stage,
  .signals-stage {
    padding: 1rem;
  }

  .decision-duo {
    grid-template-columns: 1fr;
  }

  .btn-back,
  .pager-btn,
  .btn-enlarge,
  .lightbox-close-btn {
    min-height: 44px;
  }

  .pager-btn {
    width: 44px;
    height: 44px;
  }
}

/* ============================================================================
 * Reduced Motion
 * ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  .lesson-article,
  .lightbox-dialog,
  .shimmer-box,
  .spin-icon {
    animation: none !important;
  }

  .btn-back,
  .pager-btn,
  .lesson-image,
  .btn-enlarge,
  .signal-row {
    transition: none !important;
  }

  .btn-back:hover,
  .visual-frame:hover .lesson-image,
  .btn-enlarge:hover {
    transform: none !important;
  }
}

:root[data-reduced-motion='true'] .lesson-article,
:root[data-reduced-motion='true'] .lightbox-dialog,
:root[data-reduced-motion='true'] .shimmer-box,
:root[data-reduced-motion='true'] .spin-icon {
  animation: none !important;
}

:root[data-reduced-motion='true'] .btn-back,
:root[data-reduced-motion='true'] .pager-btn,
:root[data-reduced-motion='true'] .lesson-image,
:root[data-reduced-motion='true'] .btn-enlarge,
:root[data-reduced-motion='true'] .signal-row {
  transition: none !important;
}

:root[data-reduced-motion='true'] .btn-back:hover,
:root[data-reduced-motion='true'] .visual-frame:hover .lesson-image,
:root[data-reduced-motion='true'] .btn-enlarge:hover {
  transform: none !important;
}
</style>
