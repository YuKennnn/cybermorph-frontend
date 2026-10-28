<script setup>
import { onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/authStore.js'
import { useThreatIndexStore } from '../stores/threatIndexStore.js'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()
const threatIndexStore = useThreatIndexStore()

const loadData = async ({ force = false } = {}) => {
  try {
    await threatIndexStore.loadThreatIndex({ force })
  } catch {
    // Error state is managed in threatIndexStore
  }
}

const handleRefresh = () => {
  if (threatIndexStore.isLoading || threatIndexStore.isRefreshing) return
  loadData({ force: true })
}

onMounted(() => {
  loadData()
})

watch(
  () => [authStore.token, authStore.user?.user_id, authStore.user?.email],
  ([newToken], [oldToken]) => {
    if (!newToken) {
      threatIndexStore.reset()
      return
    }
    if (newToken !== oldToken || threatIndexStore.status === 'idle') {
      loadData({ force: true })
    } else {
      loadData()
    }
  },
)
</script>

<template>
  <div class="threat-index-page">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">Threat index</h1>
        <p class="page-subtitle">
          Track the types of threats unlocked in your CyberMorph game profile.
        </p>
      </div>

      <div class="header-actions">
        <router-link to="/dashboard" class="btn-secondary">
          Overview
        </router-link>
        <button
          type="button"
          class="btn-refresh"
          :disabled="threatIndexStore.isLoading || threatIndexStore.isRefreshing"
          :aria-busy="threatIndexStore.isLoading || threatIndexStore.isRefreshing ? 'true' : 'false'"
          @click="handleRefresh"
        >
          <AppIcon
            name="refresh"
            :size="16"
            :class="{ 'icon-spin': threatIndexStore.isLoading || threatIndexStore.isRefreshing }"
          />
          <span>{{
            threatIndexStore.isLoading || threatIndexStore.isRefreshing
              ? 'Refreshing...'
              : 'Refresh'
          }}</span>
        </button>
      </div>
    </header>

    <!-- Initial Loading State -->
    <div
      v-if="threatIndexStore.isLoading"
      class="state-card loading-state"
      role="status"
      aria-live="polite"
    >
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-message">Loading threat index...</p>
    </div>

    <!-- Error / Incomplete / Malformed State -->
    <div
      v-else-if="threatIndexStore.isUnavailable"
      class="state-card error-state"
      role="alert"
    >
      <div class="error-header">
        <AppIcon name="alert" :size="20" class="error-icon" />
        <h2 class="state-title">
          {{
            threatIndexStore.isIncomplete
              ? 'Incomplete threat-index data'
              : 'Threat index unavailable'
          }}
        </h2>
      </div>
      <p class="state-description">
        {{
          threatIndexStore.error ||
          'Unable to load threat index progress. Please try again.'
        }}
      </p>
      <button
        type="button"
        class="btn-retry"
        :disabled="threatIndexStore.isLoading || threatIndexStore.isRefreshing"
        @click="handleRefresh"
      >
        {{ threatIndexStore.isRefreshing ? 'Retrying...' : 'Try again' }}
      </button>
    </div>

    <!-- Empty Array State ([]) -->
    <div
      v-else-if="threatIndexStore.isEmpty"
      class="state-card empty-state"
      role="status"
    >
      <AppIcon name="shield" :size="28" class="empty-icon" />
      <h2 class="state-title">No threat-index entries available</h2>
      <p class="state-description">
        No threat-index records were returned for this account.
      </p>
      <button
        type="button"
        class="btn-retry"
        :disabled="threatIndexStore.isLoading || threatIndexStore.isRefreshing"
        @click="handleRefresh"
      >
        {{ threatIndexStore.isRefreshing ? 'Refreshing...' : 'Try again' }}
      </button>
    </div>

    <!-- Ready State (Validated 8 Canonical Threat Categories) -->
    <template v-else-if="threatIndexStore.isReady">
      <section class="summary-card" aria-label="Threat index summary">
        <div class="summary-top">
          <div class="summary-main">
            <span class="summary-label">Threat index progress</span>
            <strong class="summary-value">{{ threatIndexStore.progressText }}</strong>
          </div>
          <div class="summary-counts">
            <span class="count-pill count-unlocked">
              <AppIcon name="check" :size="14" />
              <span>{{ threatIndexStore.unlockedCount }} unlocked</span>
            </span>
            <span class="count-pill count-locked">
              <AppIcon name="lock" :size="14" />
              <span>{{ threatIndexStore.lockedCount }} locked</span>
            </span>
          </div>
        </div>

        <div
          class="progress-track"
          role="progressbar"
          aria-label="Threat index unlock progress"
          :aria-valuenow="threatIndexStore.unlockedCount"
          aria-valuemin="0"
          :aria-valuemax="threatIndexStore.totalCount"
        >
          <div
            class="progress-fill"
            :style="{ width: `${threatIndexStore.progressPercentage}%` }"
          ></div>
        </div>

        <p v-if="threatIndexStore.unlockedCount === 0" class="zero-unlocks-note">
          <AppIcon name="info" :size="16" class="note-icon" />
          <span>
            No unlocked threat categories were returned for your account. Progress updates when unlocked entries are synced from the CyberMorph game.
          </span>
        </p>
      </section>

      <ul class="threat-grid" aria-label="Cybersecurity threat categories">
        <li
          v-for="entry in threatIndexStore.entries"
          :key="entry.threat_name"
          :class="[
            'threat-card',
            entry.is_unlocked ? 'is-unlocked' : 'is-locked',
          ]"
        >
          <div class="card-top">
            <div class="category-heading">
              <span class="category-number">{{ entry.number }}</span>
              <h2 class="category-name">{{ entry.threat_name }}</h2>
            </div>

            <span
              :class="[
                'status-badge',
                entry.is_unlocked ? 'badge-unlocked' : 'badge-locked',
              ]"
            >
              <AppIcon
                :name="entry.is_unlocked ? 'check' : 'lock'"
                :size="14"
              />
              <span>{{ entry.is_unlocked ? 'Unlocked' : 'Locked' }}</span>
            </span>
          </div>

          <p v-if="entry.summary" class="category-summary">
            {{ entry.summary }}
          </p>

          <div class="card-footer">
            <span v-if="entry.is_unlocked" class="unlock-meta unlocked-meta">
              {{ entry.unlock_date_label }}
            </span>
            <span v-else class="unlock-meta locked-meta">
              Not unlocked
            </span>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.threat-index-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
  font-weight: 800;
}

.page-subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-secondary,
.btn-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0.5rem 1rem;
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-secondary:hover,
.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-secondary:focus-visible,
.btn-refresh:focus-visible,
.btn-retry:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-spin {
  animation: spin 0.9s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .icon-spin,
  .spinner {
    animation: none !important;
  }
}

.summary-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.35rem 1.5rem;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.summary-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-secondary);
}

.summary-counts {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.count-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--color-border);
}

.count-unlocked {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.count-locked {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.progress-track {
  width: 100%;
  height: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--btn-gradient);
  background-color: var(--color-primary);
  border-radius: 9999px;
  transition: width 0.25s ease;
}

.zero-unlocks-note {
  margin: 0;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.note-icon {
  color: var(--color-primary);
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.threat-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.15rem;
}

@media (min-width: 640px) {
  .threat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .threat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.threat-card {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem 1.35rem;
  box-shadow: var(--shadow-purple-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
}

.threat-card.is-unlocked {
  border-color: var(--color-secondary);
}

.threat-card.is-locked {
  background-color: var(--color-bg-subtle);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.category-heading {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
}

.category-number {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primary);
  flex-shrink: 0;
}

.category-name {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.35;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-unlocked {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.badge-locked {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.category-summary {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.card-footer {
  padding-top: 0.7rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
}

.unlock-meta {
  font-weight: 600;
}

.unlocked-meta {
  color: var(--color-text-main);
}

.locked-meta {
  color: var(--color-text-muted);
}

.state-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow: var(--shadow-purple-sm);
}

.error-state {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.state-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.state-description {
  margin: 0;
  font-size: 0.9rem;
  max-width: 520px;
  line-height: 1.5;
}

.empty-state .state-title {
  color: var(--color-text-main);
}

.empty-state .state-description {
  color: var(--color-text-muted);
}

.empty-icon {
  color: var(--color-primary);
}

.btn-retry {
  margin-top: 0.25rem;
  padding: 0.45rem 1rem;
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.error-state .btn-retry {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

.btn-retry:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.btn-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 34px;
  height: 34px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.state-message {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
