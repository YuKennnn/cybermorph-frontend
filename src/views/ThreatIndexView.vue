<script setup>
import { computed, onMounted, ref } from 'vue'
import { useThreatIndexStore } from '@/stores/threatIndexStore'
import { getThreatLessonBySlug } from '@/data/threatLessons'
import AppIcon from '@/components/common/AppIcon.vue'

const threatStore = useThreatIndexStore()

const statusFilter = ref('all')
const isRetrying = ref(false)

onMounted(() => {
  threatStore.loadThreatIndex()
})

const hasCatalogEntries = computed(
  () => Array.isArray(threatStore.entries) && threatStore.entries.length > 0,
)

const isErrorState = computed(
  () =>
    !threatStore.isLoading &&
    (threatStore.isUnavailable || threatStore.isMalformed || threatStore.isIncomplete) &&
    !hasCatalogEntries.value,
)

const errorHeadline = computed(() => {
  if (threatStore.isIncomplete) return 'Threat index data was incomplete'
  if (threatStore.isMalformed) return 'Threat index response could not be read'
  return 'Could not load your threat index'
})

const errorBody = computed(() => {
  if (threatStore.isIncomplete || threatStore.isMalformed) {
    return 'Some threat categories were missing. Try reloading your progress.'
  }
  return 'Your connection or session may have been interrupted. Retry to load your dossiers.'
})

const enrichedEntries = computed(() => {
  const entries = Array.isArray(threatStore.entries) ? threatStore.entries : []
  return entries.map((entry) => {
    const lesson = getThreatLessonBySlug(entry.slug)
    return {
      ...entry,
      mapName: lesson?.mapName || 'CyberMorph',
      cardHook: lesson?.briefSummary || entry.summary,
      screenshot: entry.is_unlocked ? lesson?.screenshot || null : null,
    }
  })
})

const filteredEntries = computed(() => {
  if (statusFilter.value === 'unlocked') {
    return enrichedEntries.value.filter((entry) => entry.is_unlocked)
  }
  if (statusFilter.value === 'locked') {
    return enrichedEntries.value.filter((entry) => !entry.is_unlocked)
  }
  return enrichedEntries.value
})

function formatEntryNumber(num) {
  return String(num).padStart(2, '0')
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
</script>

<template>
  <div class="threat-index-page">
    <!-- Single Unified Header & Filter Bar -->
    <header class="index-header">
      <div class="header-left">
        <div class="header-badge" aria-hidden="true">
          <AppIcon name="shield" :size="20" />
        </div>
        <div class="header-copy">
          <div class="title-line">
            <h1 class="page-title">Threat index</h1>
            <span
              v-if="!threatStore.isLoading && !isErrorState && hasCatalogEntries"
              class="unlock-pill"
            >
              {{ threatStore.unlockedCount }}/{{ threatStore.totalCount }} unlocked
            </span>
          </div>
          <div
            v-if="!threatStore.isLoading && !isErrorState && hasCatalogEntries"
            class="progress-strip"
            role="progressbar"
            :aria-valuenow="threatStore.progressPercentage"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Threat index completion: ${threatStore.progressPercentage}%`"
          >
            <div
              class="progress-strip-fill"
              :style="{ width: `${threatStore.progressPercentage}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div
        v-if="!threatStore.isLoading && !isErrorState && hasCatalogEntries"
        class="segmented-filter"
        role="group"
        aria-label="Filter threats"
      >
        <button
          type="button"
          class="filter-pill"
          :class="{ 'is-active': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          All <span class="pill-count">{{ enrichedEntries.length }}</span>
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ 'is-active': statusFilter === 'unlocked' }"
          @click="statusFilter = 'unlocked'"
        >
          Unlocked <span class="pill-count">{{ threatStore.unlockedCount }}</span>
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ 'is-active': statusFilter === 'locked' }"
          @click="statusFilter = 'locked'"
        >
          Locked <span class="pill-count">{{ threatStore.lockedCount }}</span>
        </button>
      </div>
    </header>

    <!-- Loading Skeleton -->
    <section
      v-if="threatStore.isLoading && !hasCatalogEntries"
      class="loading-grid"
      aria-busy="true"
      aria-label="Loading threat index cards"
    >
      <div v-for="n in 8" :key="n" class="skeleton-card">
        <div class="skeleton-media shimmer-box"></div>
        <div class="skeleton-body">
          <div class="skeleton-line title shimmer-box"></div>
          <div class="skeleton-line desc shimmer-box"></div>
        </div>
      </div>
    </section>

    <!-- Error / Incomplete State -->
    <section v-else-if="isErrorState" class="status-panel error-panel" role="alert">
      <div class="status-icon-wrap is-danger">
        <AppIcon name="warning" :size="24" />
      </div>
      <h2 class="status-title">{{ errorHeadline }}</h2>
      <p class="status-desc">{{ errorBody }}</p>
      <button type="button" class="btn-retry-dossier" :disabled="isRetrying" @click="handleRetry">
        <AppIcon name="refresh" :size="16" :class="{ 'spin-icon': isRetrying }" />
        <span>{{ isRetrying ? 'Retrying...' : 'Retry loading' }}</span>
      </button>
    </section>

    <!-- Empty Catalog State -->
    <section v-else-if="threatStore.isEmpty || !hasCatalogEntries" class="status-panel">
      <div class="status-icon-wrap">
        <AppIcon name="shield" :size="24" />
      </div>
      <h2 class="status-title">No threat cards available</h2>
      <p class="status-desc">Play any CyberMorph map to unlock your first threat breakdown.</p>
    </section>

    <!-- Empty Filtered State -->
    <div v-else-if="filteredEntries.length === 0" class="status-panel">
      <div class="status-icon-wrap">
        <AppIcon name="info" :size="22" />
      </div>
      <h2 class="status-title">No threats in this filter</h2>
      <button type="button" class="btn-reset-filters" @click="statusFilter = 'all'">
        Show all 8 threats
      </button>
    </div>

    <!-- Visual Threat Deck -->
    <TransitionGroup v-else name="dossier-grid" tag="div" class="threat-grid">
      <article
        v-for="(entry, idx) in filteredEntries"
        :key="entry.slug"
        class="threat-card"
        :class="entry.is_unlocked ? 'is-unlocked' : 'is-locked'"
        :style="{ '--card-idx': idx }"
      >
        <!-- Unlocked Preview Cover -->
        <div v-if="entry.is_unlocked && entry.screenshot" class="card-cover">
          <img
            :src="entry.screenshot.image"
            :alt="entry.screenshot.alt"
            class="card-cover-img"
            loading="lazy"
          />
          <div class="card-cover-sheen" aria-hidden="true"></div>
          <span class="map-chip">{{ entry.mapName }}</span>
        </div>

        <!-- Locked Frosted Geometry Cover (Never leaks screenshots/clues) -->
        <div v-else class="card-cover is-classified">
          <svg viewBox="0 0 240 135" class="classified-rings" aria-hidden="true">
            <circle cx="120" cy="68" r="50" />
            <circle cx="120" cy="68" r="34" stroke-dasharray="4 4" />
          </svg>
          <div class="classified-seal" aria-hidden="true">
            <AppIcon name="lock" :size="20" />
          </div>
          <span class="map-chip is-muted">{{ entry.mapName }}</span>
        </div>

        <!-- Minimal Card Footer -->
        <div class="card-content">
          <div class="card-top-row">
            <div class="card-heading">
              <span class="card-code">#{{ formatEntryNumber(entry.number) }}</span>
              <h2 class="card-title">{{ entry.threat_name }}</h2>
            </div>

            <router-link
              v-if="entry.is_unlocked"
              :to="`/threat-index/${entry.slug}`"
              class="btn-lesson"
              :aria-label="`Inspect ${entry.threat_name}`"
            >
              <span>View</span>
              <AppIcon name="arrow-right" :size="14" class="btn-lesson-arrow" />
            </router-link>

            <span v-else class="locked-pill">
              <AppIcon name="lock" :size="12" />
              Locked
            </span>
          </div>

          <p class="card-hook">
            {{ entry.is_unlocked ? entry.cardHook : `Play ${entry.mapName} map to unlock.` }}
          </p>
        </div>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.threat-index-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  min-width: 0;
}

/* ============================================================================
 * Compact Unified Header & Filter
 * ========================================================================== */
.index-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  padding: 1.15rem 1.4rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  background-image: radial-gradient(
    ellipse at 0% 0%,
    color-mix(in srgb, var(--color-primary) 9%, transparent) 0%,
    transparent 55%
  );
  animation: header-enter 0.36s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes header-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  flex: 1 1 auto;
}

.header-badge {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  flex: 1;
}

.title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.page-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2vw, 1.65rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
  line-height: 1.15;
}

.unlock-pill {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  padding: 0.16rem 0.58rem;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

.progress-strip {
  width: 100%;
  max-width: 260px;
  height: 6px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  overflow: hidden;
}

.progress-strip-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--btn-gradient);
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.segmented-filter {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.25rem;
  border-radius: 12px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0.35rem 0.85rem;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.filter-pill:hover {
  color: var(--color-text-main);
}

.filter-pill.is-active {
  background: var(--btn-gradient);
  color: #ffffff;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 26%, transparent);
}

.filter-pill:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.pill-count {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.86;
}

/* ============================================================================
 * Visual Game-Deck Threat Cards
 * ========================================================================== */
.threat-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.15rem;
}

.threat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition:
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.22s ease;
  animation: card-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: calc(min(var(--card-idx, 0), 5) * 28ms);
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.threat-card.is-unlocked:hover {
  transform: translateY(-5px);
  border-color: var(--color-primary);
  box-shadow:
    var(--shadow-card-hover),
    0 10px 24px -6px color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.threat-card.is-unlocked:focus-within {
  border-color: var(--color-primary);
}

.threat-card.is-locked {
  background-color: var(--color-bg-subtle);
}

.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: var(--color-bg-muted);
  overflow: hidden;
}

.card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.threat-card.is-unlocked:hover .card-cover-img {
  transform: scale(1.045);
}

/* Signature diagonal hover highlight sheen */
.card-cover-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.16) 48%,
    transparent 65%
  );
  transform: translateX(-120%);
  transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.threat-card.is-unlocked:hover .card-cover-sheen {
  transform: translateX(120%);
}

.map-chip {
  position: absolute;
  left: 0.65rem;
  bottom: 0.65rem;
  z-index: 2;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background-color: rgba(15, 23, 42, 0.82);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  pointer-events: none;
}

.map-chip.is-muted {
  background-color: var(--color-card);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.card-cover.is-classified {
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--color-primary) 7%, transparent) 0%,
    transparent 65%
  );
}

.classified-rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--color-border);
  stroke-width: 1.15;
  opacity: 0.75;
  pointer-events: none;
}

.classified-seal {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

/* Minimal Card Body */
.card-content {
  padding: 1rem 1.15rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.card-heading {
  display: flex;
  align-items: baseline;
  gap: 0.42rem;
  min-width: 0;
}

.card-code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.threat-card.is-locked .card-code {
  color: var(--color-text-dim);
}

.card-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.04rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.25;
}

.btn-lesson {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.34rem 0.72rem;
  border-radius: 999px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  font-size: 0.76rem;
  font-weight: 700;
  text-decoration: none;
  flex-shrink: 0;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

/* Stretches click target smoothly over entire unlocked card while keeping semantics on link */
.btn-lesson::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.threat-card.is-unlocked:hover .btn-lesson {
  background: var(--btn-gradient);
  border-color: transparent;
  color: #ffffff;
}

.btn-lesson-arrow {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.threat-card.is-unlocked:hover .btn-lesson-arrow {
  transform: translateX(3px);
}

.btn-lesson:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.locked-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.24rem 0.6rem;
  border-radius: 999px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  font-size: 0.74rem;
  font-weight: 600;
  flex-shrink: 0;
}

.card-hook {
  margin: 0;
  font-size: 0.855rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.threat-card.is-locked .card-hook {
  color: var(--color-text-dim);
}

/* ============================================================================
 * Filter Transitions
 * ========================================================================== */
.dossier-grid-enter-active {
  transition:
    opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.dossier-grid-leave-active {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.dossier-grid-enter-from,
.dossier-grid-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(6px);
}

.dossier-grid-move {
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ============================================================================
 * Loading, Error, & Empty States
 * ========================================================================== */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.15rem;
}

.skeleton-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}

.skeleton-media {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.skeleton-body {
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
}

.skeleton-line.title {
  width: 55%;
  height: 16px;
}

.skeleton-line.desc {
  width: 88%;
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

.status-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.65rem;
  padding: 2.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}

.error-panel {
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

.status-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon-wrap.is-danger {
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.status-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.status-desc {
  margin: 0;
  font-size: 0.88rem;
  color: var(--color-text-muted);
  max-width: 46ch;
}

.btn-retry-dossier,
.btn-reset-filters {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.35rem;
  padding: 0.55rem 1.1rem;
  min-height: 40px;
  border-radius: 9px;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-retry-dossier:hover:not(:disabled),
.btn-reset-filters:hover {
  background: var(--btn-gradient-hover);
}

.btn-retry-dossier:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
@media (max-width: 1120px) {
  .threat-grid,
  .loading-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .index-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.9rem;
    padding: 1rem 1.05rem;
  }

  .header-left {
    flex: none;
    width: 100%;
  }

  .progress-strip {
    max-width: 100%;
  }

  .segmented-filter {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filter-pill {
    justify-content: center;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
  }

  .threat-grid,
  .loading-grid {
    grid-template-columns: 1fr;
  }
}

/* ============================================================================
 * Reduced Motion
 * ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  .index-header,
  .threat-card,
  .shimmer-box,
  .spin-icon {
    animation: none !important;
  }

  .threat-card,
  .card-cover-img,
  .card-cover-sheen,
  .progress-strip-fill,
  .filter-pill,
  .btn-lesson,
  .btn-lesson-arrow,
  .dossier-grid-enter-active,
  .dossier-grid-leave-active,
  .dossier-grid-move {
    transition: none !important;
  }

  .threat-card.is-unlocked:hover,
  .threat-card.is-unlocked:hover .card-cover-img,
  .threat-card.is-unlocked:hover .btn-lesson-arrow {
    transform: none !important;
  }

  .threat-card.is-unlocked:hover .card-cover-sheen {
    display: none;
  }
}

:root[data-reduced-motion='true'] .index-header,
:root[data-reduced-motion='true'] .threat-card,
:root[data-reduced-motion='true'] .shimmer-box,
:root[data-reduced-motion='true'] .spin-icon {
  animation: none !important;
}

:root[data-reduced-motion='true'] .threat-card,
:root[data-reduced-motion='true'] .card-cover-img,
:root[data-reduced-motion='true'] .card-cover-sheen,
:root[data-reduced-motion='true'] .progress-strip-fill,
:root[data-reduced-motion='true'] .filter-pill,
:root[data-reduced-motion='true'] .btn-lesson,
:root[data-reduced-motion='true'] .btn-lesson-arrow,
:root[data-reduced-motion='true'] .dossier-grid-enter-active,
:root[data-reduced-motion='true'] .dossier-grid-leave-active,
:root[data-reduced-motion='true'] .dossier-grid-move {
  transition: none !important;
}

:root[data-reduced-motion='true'] .threat-card.is-unlocked:hover,
:root[data-reduced-motion='true'] .threat-card.is-unlocked:hover .card-cover-img,
:root[data-reduced-motion='true'] .threat-card.is-unlocked:hover .btn-lesson-arrow {
  transform: none !important;
}

:root[data-reduced-motion='true'] .threat-card.is-unlocked:hover .card-cover-sheen {
  display: none;
}
</style>
