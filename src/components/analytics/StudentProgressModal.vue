<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { classifyCategoryBreakdown, isValidErrorRate } from '../../utils/analyticsValidation.js'
import { CANONICAL_THREAT_CATEGORIES } from '../../stores/threatIndexStore.js'
import { formatLastSyncedDate } from '../../utils/datetime.js'

const CANONICAL_MAPS = ['Home', 'Office', 'Internet Cafe', 'Public Park']

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  studentId: {
    type: String,
    default: '',
  },
  studentIdentity: {
    type: Object,
    default: null,
  },
  identityLoading: {
    type: Boolean,
    default: false,
  },
  analytics: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  fullProgressRoute: {
    type: [Object, String],
    default: null,
  },
})

const emit = defineEmits(['close', 'retry'])

const dialogRef = ref(null)
const closeBtnRef = ref(null)

let previouslyFocusedElement = null
let lastOpenedStudentId = ''
let previousBodyOverflow = ''
let hasLockedBodyScroll = false
let hasKeyListener = false

const headingId = 'student-progress-modal-title'

// Defense in depth: only show identity/analytics matching props.studentId
const activeIdentity = computed(() => {
  if (!props.studentIdentity || !props.studentId) return null
  const identityId = props.studentIdentity.profile_id
  if (identityId !== undefined && identityId !== null && String(identityId) !== String(props.studentId)) {
    return null
  }
  return props.studentIdentity
})

const activeAnalytics = computed(() => {
  if (!props.analytics || !props.studentId) return null
  const payloadId = props.analytics.profile_id
  if (payloadId !== undefined && payloadId !== null && String(payloadId) !== String(props.studentId)) {
    return null
  }
  return props.analytics
})

const displayName = computed(() => {
  const username = activeIdentity.value?.username
  if (typeof username === 'string' && username.trim()) {
    return username.trim()
  }
  return props.identityLoading ? 'Loading student...' : 'Student profile'
})

const avatarInitial = computed(() => {
  const username = activeIdentity.value?.username
  if (typeof username === 'string' && username.trim()) {
    return username.trim().charAt(0).toUpperCase()
  }
  return 'S'
})

const numericMapIndex = computed(() => {
  const raw = activeAnalytics.value?.map_progress ?? activeIdentity.value?.map_progress
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < CANONICAL_MAPS.length) {
    return raw
  }
  return null
})

const formattedMapProgress = computed(() => {
  if (numericMapIndex.value !== null) {
    return `${CANONICAL_MAPS[numericMapIndex.value]} (${numericMapIndex.value + 1} of ${CANONICAL_MAPS.length})`
  }
  const raw = activeAnalytics.value?.map_progress ?? activeIdentity.value?.map_progress
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim()
  }
  return props.loading || props.identityLoading ? 'Loading...' : 'Unavailable'
})

const mapUnlockPercent = computed(() => {
  if (numericMapIndex.value === null) return 0
  return Math.round(((numericMapIndex.value + 1) / CANONICAL_MAPS.length) * 100)
})

const formattedLastSynced = computed(() => {
  if (props.identityLoading && !activeIdentity.value) {
    return 'Loading...'
  }
  return formatLastSyncedDate(activeIdentity.value?.last_synced_at)
})

const reportedWins = computed(() => {
  const wins = Number(activeAnalytics.value?.wins ?? 0)
  return Number.isFinite(wins) && wins >= 0 ? wins : 0
})

const otherResultsCount = computed(() => {
  const losses = Number(activeAnalytics.value?.losses ?? 0)
  return Number.isFinite(losses) && losses >= 0 ? losses : 0
})

const uploadedSessionsCount = computed(() => {
  return reportedWins.value + otherResultsCount.value
})

const hasNoUploadedSessions = computed(() => {
  if (!activeAnalytics.value) return false
  const recentCount = Array.isArray(activeAnalytics.value.recent_sessions)
    ? activeAnalytics.value.recent_sessions.length
    : 0
  return uploadedSessionsCount.value === 0 && recentCount === 0
})

const formattedAverageDuration = computed(() => {
  const raw = activeAnalytics.value?.avg_duration_seconds
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return '0s'
  }
  const totalSeconds = Math.round(raw)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
})

const bestScoreEntries = computed(() => {
  const mapScores =
    activeAnalytics.value?.best_score_by_map && typeof activeAnalytics.value.best_score_by_map === 'object'
      ? activeAnalytics.value.best_score_by_map
      : {}

  const playedValues = CANONICAL_MAPS
    .map((m) => mapScores[m])
    .filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
  const maxScore = playedValues.length > 0 ? Math.max(...playedValues, 0) : 0

  return CANONICAL_MAPS.map((mapName) => {
    const val = mapScores[mapName]
    const hasScore = typeof val === 'number' && Number.isFinite(val) && val >= 0
    const widthPct = hasScore && maxScore > 0 ? Math.round((val / maxScore) * 100) : 0
    return {
      mapName,
      hasScore,
      scoreLabel: hasScore ? `${Math.round(val)} pts` : 'Not played yet',
      widthStyle: hasScore ? { width: `${widthPct}%` } : null,
    }
  })
})

const categoryBreakdownState = computed(() => {
  return classifyCategoryBreakdown(activeAnalytics.value?.category_breakdown)
})

const threatRatesList = computed(() => {
  if (categoryBreakdownState.value.status !== 'ready') return []
  const raw = activeAnalytics.value?.category_breakdown || {}
  return CANONICAL_THREAT_CATEGORIES.map((category) => {
    const val = raw[category.name]
    const hasRate = isValidErrorRate(val)
    let severityClass = 'no-data'
    if (hasRate) {
      if (val >= 0.4) severityClass = 'risk-high'
      else if (val >= 0.2) severityClass = 'risk-moderate'
      else severityClass = 'risk-low'
    }
    return {
      name: category.name,
      hasRate,
      severityClass,
      pctNumber: hasRate ? Math.round(val * 1000) / 10 : null,
      rateLabel: hasRate ? `${(val * 100).toFixed(1)}% error` : 'No data',
      barWidthStyle: hasRate ? { width: `${val * 100}%` } : null,
    }
  })
})

const getFocusableElements = () => {
  const container = dialogRef.value
  if (!container) return []
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return Array.from(container.querySelectorAll(selector)).filter((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

const handleKeydown = (event) => {
  if (!props.isOpen) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusables = getFocusableElements()
  if (focusables.length === 0) {
    event.preventDefault()
    dialogRef.value?.focus({ preventScroll: true })
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !dialogRef.value?.contains(active)) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    }
    return
  }

  if (active === last || !dialogRef.value?.contains(active)) {
    event.preventDefault()
    first.focus({ preventScroll: true })
  }
}

const lockBodyScroll = () => {
  if (hasLockedBodyScroll || typeof document === 'undefined') return
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  hasLockedBodyScroll = true
}

const unlockBodyScroll = () => {
  if (!hasLockedBodyScroll || typeof document === 'undefined') return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = ''
  hasLockedBodyScroll = false
}

const attachKeyListener = () => {
  if (hasKeyListener || typeof document === 'undefined') return
  document.addEventListener('keydown', handleKeydown)
  hasKeyListener = true
}

const detachKeyListener = () => {
  if (!hasKeyListener || typeof document === 'undefined') return
  document.removeEventListener('keydown', handleKeydown)
  hasKeyListener = false
}

const restoreTriggerFocus = () => {
  if (typeof document === 'undefined') return

  const targetStudentId = lastOpenedStudentId || props.studentId
  if (targetStudentId) {
    const triggerButtons = document.querySelectorAll('[data-student-profile-id]')
    for (const btn of triggerButtons) {
      if (btn instanceof HTMLElement && btn.dataset.studentProfileId === targetStudentId) {
        btn.focus({ preventScroll: true })
        return
      }
    }
  }

  if (
    previouslyFocusedElement instanceof HTMLElement &&
    previouslyFocusedElement.isConnected
  ) {
    previouslyFocusedElement.focus({ preventScroll: true })
  }
}

watch(
  () => props.isOpen,
  async (open, prevOpen) => {
    if (open && !prevOpen) {
      previouslyFocusedElement =
        typeof document !== 'undefined' ? document.activeElement : null
      lastOpenedStudentId = String(props.studentId || '')
      lockBodyScroll()
      attachKeyListener()
      await nextTick()
      if (props.isOpen) {
        const target = closeBtnRef.value || dialogRef.value
        target?.focus({ preventScroll: true })
      }
    } else if (!open && prevOpen) {
      detachKeyListener()
      unlockBodyScroll()
      await nextTick()
      restoreTriggerFocus()
      previouslyFocusedElement = null
      lastOpenedStudentId = ''
    }
  },
  { immediate: true },
)

watch(
  () => props.studentId,
  (nextId) => {
    if (props.isOpen && nextId) {
      lastOpenedStudentId = String(nextId)
    }
  },
)

onUnmounted(() => {
  detachKeyListener()
  unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="student-modal-fade">
      <div
        v-if="isOpen"
        class="student-modal-backdrop"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          class="student-modal-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="headingId"
          tabindex="-1"
        >
          <!-- Modal Header & Student Identity -->
          <header class="modal-header">
            <div class="identity-row">
              <div class="avatar-badge" aria-hidden="true">
                {{ avatarInitial }}
              </div>
              <div class="identity-meta">
                <h2 :id="headingId" class="modal-title">{{ displayName }}</h2>
                <p class="identity-sub">
                  <span>Map progress: <strong>{{ formattedMapProgress }}</strong></span>
                  <span class="dot-sep" aria-hidden="true">·</span>
                  <span class="sync-inline">
                    <AppIcon name="clock" :size="14" />
                    <span>Last synced: <strong>{{ formattedLastSynced }}</strong></span>
                  </span>
                </p>
              </div>
            </div>

            <button
              ref="closeBtnRef"
              type="button"
              class="close-icon-btn"
              aria-label="Close student progress dialog"
              @click="emit('close')"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </header>

          <!-- Modal Body (Internal Scroll Container) -->
          <div class="modal-body">
            <!-- Loading State -->
            <div v-if="loading" class="loading-state" role="status" aria-live="polite">
              <div class="loading-bar-row">
                <div class="spinner" aria-hidden="true"></div>
                <p>Loading student progress...</p>
              </div>
              <div class="summary-grid skeleton-grid" aria-hidden="true">
                <div v-for="n in 4" :key="n" class="skeleton-box"></div>
              </div>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-banner" role="alert">
              <AppIcon name="alert" :size="18" class="error-icon" />
              <div class="error-content">
                <p class="error-text">{{ error }}</p>
                <button type="button" class="retry-btn" @click="emit('retry')">
                  <AppIcon name="refresh" :size="14" />
                  <span>Try again</span>
                </button>
              </div>
            </div>

            <!-- Empty State (0 Uploaded Sessions) -->
            <div v-else-if="activeAnalytics && hasNoUploadedSessions" class="empty-state-box">
              <AppIcon name="info" :size="20" class="empty-icon" />
              <div class="empty-copy">
                <p class="empty-title">No uploaded sessions yet</p>
                <p class="empty-desc">
                  Session counts, scores, and decision rates appear here after the student plays a run and uploads progress from the game.
                </p>
              </div>
            </div>

            <!-- Populated Summary -->
            <div v-else-if="activeAnalytics" class="summary-sections">
              <section class="summary-block">
                <h3 class="block-heading">Uploaded session summary</h3>
                <div class="summary-grid">
                  <div class="metric-box">
                    <span class="metric-label">Uploaded sessions</span>
                    <span class="metric-value">{{ uploadedSessionsCount }}</span>
                  </div>
                  <div class="metric-box">
                    <span class="metric-label">Reported wins</span>
                    <span class="metric-value metric-win">{{ reportedWins }}</span>
                  </div>
                  <div class="metric-box">
                    <span class="metric-label">Other results</span>
                    <span class="metric-value metric-other">{{ otherResultsCount }}</span>
                  </div>
                  <div class="metric-box">
                    <span class="metric-label">Average duration</span>
                    <span class="metric-value">{{ formattedAverageDuration }}</span>
                  </div>
                </div>
                <p class="summary-note">
                  Uploaded sessions = Reported wins + Other results.
                </p>
              </section>

              <section v-if="numericMapIndex !== null" class="summary-block">
                <div class="map-unlock-header">
                  <h3 class="block-heading">Map unlock progress</h3>
                  <span class="map-unlock-count">{{ numericMapIndex + 1 }} of {{ CANONICAL_MAPS.length }} maps unlocked</span>
                </div>
                <div
                  class="metric-track"
                  role="progressbar"
                  :aria-valuenow="numericMapIndex + 1"
                  aria-valuemin="1"
                  :aria-valuemax="CANONICAL_MAPS.length"
                  aria-label="Map unlock progress"
                >
                  <div class="metric-track-fill accent-fill" :style="{ width: `${mapUnlockPercent}%` }"></div>
                </div>
              </section>

              <section class="summary-block">
                <h3 class="block-heading">Best score by map</h3>
                <div class="score-bar-list">
                  <div
                    v-for="entry in bestScoreEntries"
                    :key="entry.mapName"
                    class="score-bar-row"
                  >
                    <div class="score-bar-top">
                      <span class="score-map">{{ entry.mapName }}</span>
                      <span v-if="entry.hasScore" class="score-pts">{{ entry.scoreLabel }}</span>
                      <span v-else class="score-none">{{ entry.scoreLabel }}</span>
                    </div>
                    <div
                      v-if="entry.hasScore"
                      class="metric-track"
                      aria-hidden="true"
                    >
                      <div class="metric-track-fill accent-fill" :style="entry.widthStyle"></div>
                    </div>
                    <div v-else class="metric-track metric-track-empty" aria-hidden="true"></div>
                  </div>
                </div>
              </section>

              <section class="summary-block">
                <h3 class="block-heading">Types of threats</h3>
                <div
                  v-if="categoryBreakdownState.status === 'empty'"
                  class="decision-note"
                >
                  <AppIcon name="info" :size="16" class="note-icon" />
                  <span>No decision data yet. Error rates appear after the game uploads decisions.</span>
                </div>
                <div
                  v-else-if="categoryBreakdownState.status === 'unavailable'"
                  class="decision-note decision-note-warn"
                >
                  <AppIcon name="alert" :size="16" />
                  <span>Decision data could not be validated.</span>
                </div>
                <div v-else class="threat-pill-grid">
                  <div
                    v-for="item in threatRatesList"
                    :key="item.name"
                    class="threat-pill"
                  >
                    <div class="threat-pill-top">
                      <span class="threat-name">{{ item.name }}</span>
                      <span :class="['threat-rate-label', item.hasRate ? item.severityClass : 'threat-empty']">
                        {{ item.rateLabel }}
                      </span>
                    </div>
                    <div
                      v-if="item.hasRate"
                      class="metric-track"
                      role="progressbar"
                      :aria-valuenow="item.pctNumber"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      :aria-label="`${item.name} decision error rate`"
                    >
                      <div :class="['metric-track-fill', item.severityClass]" :style="item.barWidthStyle"></div>
                    </div>
                    <div v-else class="metric-track metric-track-empty" aria-hidden="true"></div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Modal Footer -->
          <footer class="modal-footer">
            <button type="button" class="btn-close-footer" @click="emit('close')">
              Close
            </button>
            <router-link
              v-if="fullProgressRoute"
              :to="fullProgressRoute"
              class="btn-full-progress"
            >
              <span>Open full progress</span>
              <AppIcon name="arrow-right" :size="16" />
            </router-link>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.student-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 250;
}

.student-modal-dialog {
  width: 100%;
  max-width: 700px;
  max-height: calc(100dvh - 2rem);
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.5rem;
  background-color: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.identity-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}

.avatar-badge {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.identity-meta {
  min-width: 0;
}

.modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.identity-sub {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
}

.identity-sub strong {
  color: var(--color-text-main);
  font-weight: 600;
}

.dot-sep {
  color: var(--color-text-dim);
}

.sync-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.close-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-card);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease;
}

.close-icon-btn:hover {
  background-color: var(--color-bg-muted);
  color: var(--color-text-main);
  border-color: var(--color-border-hover);
}

.close-icon-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.modal-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 1.35rem 1.5rem;
  overflow-y: auto;
  background-color: var(--color-card);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-bar-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.loading-bar-row p {
  margin: 0;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: modalSpin 0.8s linear infinite;
}

@keyframes modalSpin {
  to {
    transform: rotate(360deg);
  }
}

.skeleton-grid .skeleton-box {
  height: 70px;
  border-radius: 8px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
}

/* Error State */
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.125rem;
  border-radius: 10px;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}

.error-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.65rem;
}

.error-text {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.retry-btn:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
}

/* Empty State */
.empty-state-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.125rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.empty-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.empty-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.empty-desc {
  margin: 0.25rem 0 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Populated Sections */
.summary-sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.summary-block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.block-heading {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.metric-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.76rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
}

.metric-win {
  color: var(--color-success);
}

.metric-other {
  color: var(--color-danger);
}

.summary-note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* Shared Labeled Progress Bars */
.map-unlock-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.map-unlock-count {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.metric-track {
  width: 100%;
  height: 7px;
  background-color: var(--color-bg-muted);
  border-radius: 9999px;
  overflow: hidden;
}

.metric-track-empty {
  opacity: 0.5;
}

.metric-track-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.metric-track-fill.accent-fill {
  background-color: var(--color-primary);
}

.metric-track-fill.risk-low {
  background-color: var(--color-success);
}

.metric-track-fill.risk-moderate {
  background-color: var(--color-warning);
}

.metric-track-fill.risk-high {
  background-color: var(--color-danger);
}

/* Map Score Comparison List */
.score-bar-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.score-bar-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.score-bar-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.score-map {
  font-weight: 600;
  color: var(--color-text-main);
}

.score-pts {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.score-none {
  color: var(--color-text-muted);
  font-style: italic;
}

/* Threat Error Rate Matrix inside Modal */
.decision-note {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.84rem;
  color: var(--color-text-muted);
}

.decision-note-warn {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.note-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.threat-pill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.threat-pill {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
}

.threat-pill-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.threat-name {
  font-weight: 600;
  color: var(--color-text-main);
  min-width: 0;
  overflow-wrap: anywhere;
}

.threat-rate-label {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.threat-rate-label.risk-low {
  color: var(--color-success);
}

.threat-rate-label.risk-moderate {
  color: var(--color-warning);
}

.threat-rate-label.risk-high {
  color: var(--color-danger);
}

.threat-empty {
  color: var(--color-text-muted);
  font-style: italic;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.95rem 1.5rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  flex-shrink: 0;
}

.btn-close-footer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0.55rem 1.05rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease;
}

.btn-close-footer:hover {
  background-color: var(--color-bg-muted);
  border-color: var(--color-border-hover);
}

.btn-full-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.55rem 1.15rem;
  border-radius: 8px;
  background: var(--btn-gradient);
  color: #ffffff;
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: background 180ms ease;
}

.btn-full-progress:hover {
  background: var(--btn-gradient-hover);
}

.btn-close-footer:focus-visible,
.btn-full-progress:focus-visible,
.retry-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Modal Entry/Exit Transitions */
.student-modal-fade-enter-active,
.student-modal-fade-leave-active {
  transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.student-modal-fade-enter-active .student-modal-dialog,
.student-modal-fade-leave-active .student-modal-dialog {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.student-modal-fade-enter-from,
.student-modal-fade-leave-to {
  opacity: 0;
}

.student-modal-fade-enter-from .student-modal-dialog,
.student-modal-fade-leave-to .student-modal-dialog {
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .student-modal-backdrop {
    padding: 0.65rem;
  }

  .student-modal-dialog {
    max-height: calc(100dvh - 1.3rem);
  }

  .modal-header {
    padding: 1rem 1.1rem;
  }

  .close-icon-btn {
    width: 44px;
    height: 44px;
  }

  .modal-body {
    padding: 1rem 1.1rem;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .score-bar-list,
  .threat-pill-grid {
    grid-template-columns: 1fr;
  }

  .modal-footer {
    flex-direction: column-reverse;
    align-items: stretch;
    padding: 0.9rem 1.1rem;
  }

  .btn-close-footer,
  .btn-full-progress {
    min-height: 44px;
    width: 100%;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }

  .metric-track-fill,
  .student-modal-fade-enter-active,
  .student-modal-fade-leave-active,
  .student-modal-fade-enter-active .student-modal-dialog,
  .student-modal-fade-leave-active .student-modal-dialog {
    transition: none;
  }

  .student-modal-fade-enter-from .student-modal-dialog,
  .student-modal-fade-leave-to .student-modal-dialog {
    transform: none;
  }
}
</style>
