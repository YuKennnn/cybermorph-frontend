<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAdminLogs } from '../api/admin'
import { formatAuditLogTimestamp, getLocalTimeZoneName } from '../utils/datetime'
import { ACTION_OPTIONS, getActionLabel, getActionBadgeClass } from '../utils/auditLogs'
import AppIcon from '../components/common/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const logs = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectedAction = ref('')
const selectedUserId = ref('')
const actorInput = ref('')
const actorInputError = ref('')
const isLoading = ref(true)
const errorMessage = ref('')
const expandedDescriptions = ref(new Set())

const localTimeZoneLabel = computed(() => getLocalTimeZoneName())

let latestRequestId = 0

// Parse initial query params from route URL
const initFromQueryParams = () => {
  const queryPage = parseInt(route.query.page, 10)
  if (!Number.isNaN(queryPage) && queryPage >= 1) {
    page.value = queryPage
  } else {
    page.value = 1
  }

  const queryAction = String(route.query.action_type || '').trim()
  if (ACTION_OPTIONS.some((opt) => opt.value === queryAction)) {
    selectedAction.value = queryAction
  } else {
    selectedAction.value = ''
  }

  const queryUserId = String(route.query.user_id || '').trim()
  if (queryUserId && UUID_REGEX.test(queryUserId)) {
    selectedUserId.value = queryUserId
    actorInput.value = queryUserId
  } else {
    selectedUserId.value = ''
    actorInput.value = ''
  }
}

const syncUrlQuery = () => {
  const nextQuery = {}
  if (page.value > 1) {
    nextQuery.page = String(page.value)
  }
  if (selectedAction.value) {
    nextQuery.action_type = selectedAction.value
  }
  if (selectedUserId.value) {
    nextQuery.user_id = selectedUserId.value
  }

  const currentQuery = { ...route.query }
  const isDifferent =
    (currentQuery.page || '1') !== (nextQuery.page || '1') ||
    (currentQuery.action_type || '') !== (nextQuery.action_type || '') ||
    (currentQuery.user_id || '') !== (nextQuery.user_id || '')

  if (isDifferent) {
    router.replace({ query: nextQuery }).catch(() => {})
  }
}

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const hasActiveFilters = computed(() => {
  return Boolean(selectedAction.value || selectedUserId.value)
})

const formatTargetId = (targetId) => {
  if (!targetId || typeof targetId !== 'string') return ''
  if (targetId.length <= 16) return targetId
  return `${targetId.slice(0, 8)}…${targetId.slice(-4)}`
}

const toggleDescriptionExpand = (logId) => {
  const updated = new Set(expandedDescriptions.value)
  if (updated.has(logId)) {
    updated.delete(logId)
  } else {
    updated.add(logId)
  }
  expandedDescriptions.value = updated
}

const isDescriptionExpanded = (logId) => {
  return expandedDescriptions.value.has(logId)
}

const loadLogs = async () => {
  const reqId = ++latestRequestId
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (selectedAction.value) {
      params.action_type = selectedAction.value
    }
    if (selectedUserId.value) {
      params.user_id = selectedUserId.value
    }

    const data = await fetchAdminLogs(params)

    // Discard stale responses if a newer request was dispatched
    if (reqId !== latestRequestId) return

    logs.value = Array.isArray(data?.items) ? data.items : []
    totalCount.value = typeof data?.total_count === 'number' ? data.total_count : 0
    if (typeof data?.page === 'number') page.value = data.page
    if (typeof data?.page_size === 'number') pageSize.value = data.page_size
    syncUrlQuery()
  } catch {
    if (reqId !== latestRequestId) return
    errorMessage.value =
      'Unable to load audit logs. Please verify your connection or try again.'
  } finally {
    if (reqId === latestRequestId) {
      isLoading.value = false
    }
  }
}

const handleActionChange = () => {
  page.value = 1
  loadLogs()
}

const handleActorInputChange = () => {
  if (actorInputError.value) {
    const trimmed = actorInput.value.trim()
    if (!trimmed || UUID_REGEX.test(trimmed)) {
      actorInputError.value = ''
    }
  }
}

const applyActorFilter = () => {
  const trimmed = actorInput.value.trim()
  if (!trimmed) {
    actorInputError.value = ''
    if (selectedUserId.value) {
      selectedUserId.value = ''
      page.value = 1
      loadLogs()
    }
    return
  }

  if (!UUID_REGEX.test(trimmed)) {
    actorInputError.value = 'Actor filter requires a valid 36-character user UUID.'
    // Invalid input must not send a request
    return
  }

  actorInputError.value = ''
  selectedUserId.value = trimmed
  page.value = 1
  loadLogs()
}

const quickFilterByActor = (userId) => {
  if (!userId || !UUID_REGEX.test(userId)) return
  actorInput.value = userId
  actorInputError.value = ''
  selectedUserId.value = userId
  page.value = 1
  loadLogs()
}

const clearActorFilter = () => {
  selectedUserId.value = ''
  actorInput.value = ''
  actorInputError.value = ''
  page.value = 1
  loadLogs()
}

const clearFilters = () => {
  selectedAction.value = ''
  selectedUserId.value = ''
  actorInput.value = ''
  actorInputError.value = ''
  page.value = 1
  loadLogs()
}

const goToPage = (newPage) => {
  if (newPage < 1 || newPage > totalPages.value || newPage === page.value) return
  page.value = newPage
  loadLogs()
}

onMounted(() => {
  initFromQueryParams()
  loadLogs()
})

watch(
  () => route.query,
  () => {
    // Sync external navigation changes (e.g. browser back/forward)
    const queryPage = parseInt(route.query.page, 10) || 1
    const queryAction = String(route.query.action_type || '').trim()
    const queryUserId = String(route.query.user_id || '').trim()

    let hasChange = false
    if (page.value !== queryPage) {
      page.value = queryPage
      hasChange = true
    }
    if (selectedAction.value !== queryAction) {
      selectedAction.value = queryAction
      hasChange = true
    }
    if (selectedUserId.value !== queryUserId) {
      selectedUserId.value = queryUserId
      actorInput.value = queryUserId
      hasChange = true
    }

    if (hasChange) {
      loadLogs()
    }
  },
)
</script>

<template>
  <div class="audit-logs-view">
    <header class="page-header">
      <div class="header-titles">
        <h2 class="title">Audit logs</h2>
        <p class="subtitle">
          Trace recorded administrative actions, registrations, and classroom events
        </p>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="btn-refresh"
          :disabled="isLoading"
          aria-label="Refresh audit logs"
          @click="loadLogs"
        >
          <AppIcon name="refresh" :size="16" :class="{ 'icon-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </header>

    <main class="page-body">
      <!-- Filter Bar -->
      <section class="filter-card" aria-label="Audit log filters">
        <div class="filters-controls-row">
          <!-- Action Type Filter -->
          <div class="filter-field action-field">
            <label for="action-filter" class="filter-label">Action type</label>
            <select
              id="action-filter"
              v-model="selectedAction"
              class="filter-select"
              :disabled="isLoading"
              @change="handleActionChange"
            >
              <option
                v-for="opt in ACTION_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Actor User UUID Filter -->
          <div class="filter-field actor-field">
            <label for="actor-filter" class="filter-label">
              <span>Actor user ID</span>
              <span class="label-subtext">(UUID only)</span>
            </label>
            <div class="input-with-action">
              <input
                id="actor-filter"
                v-model="actorInput"
                type="text"
                class="filter-input"
                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                :class="{ 'has-error': Boolean(actorInputError) }"
                :aria-invalid="Boolean(actorInputError)"
                :aria-describedby="actorInputError ? 'actor-filter-error' : 'actor-filter-hint'"
                :disabled="isLoading"
                @input="handleActorInputChange"
                @keydown.enter.prevent="applyActorFilter"
              />
              <button
                type="button"
                class="btn-apply-actor"
                :disabled="isLoading"
                @click="applyActorFilter"
              >
                Apply
              </button>
            </div>
          </div>

          <!-- Clear Filters Action -->
          <div class="filter-actions">
            <button
              v-if="hasActiveFilters"
              type="button"
              class="btn-clear-filters"
              :disabled="isLoading"
              @click="clearFilters"
            >
              <AppIcon name="x" :size="14" />
              <span>Clear filters</span>
            </button>
          </div>
        </div>

        <!-- Feedback & Helper Text Row (Kept separate from control alignment) -->
        <div class="filters-feedback-row">
          <div
            v-if="actorInputError"
            id="actor-filter-error"
            class="field-error-text"
            role="alert"
          >
            {{ actorInputError }}
          </div>
          <div
            v-else
            id="actor-filter-hint"
            class="field-hint-text"
          >
            Filter recorded actions by actor user UUID (not by username or email).
          </div>
        </div>

        <!-- Active Filter Pill -->
        <div v-if="selectedUserId" class="active-filter-indicator">
          <span class="indicator-text">
            Filtering by actor UUID: <code>{{ selectedUserId }}</code>
          </span>
          <button
            type="button"
            class="btn-remove-pill"
            aria-label="Remove actor UUID filter"
            @click="clearActorFilter"
          >
            <AppIcon name="x" :size="12" />
          </button>
        </div>
      </section>

      <!-- Timezone Notice Above Table -->
      <div class="table-timezone-notice" role="note">
        <AppIcon name="info" :size="16" class="notice-icon" />
        <span class="notice-text">
          Timestamps with recorded offsets are shown in your local time ({{ localTimeZoneLabel }}). Timestamps recorded without offsets have an unspecified timezone and are displayed exactly as logged.
        </span>
      </div>

      <!-- Error State -->
      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" @click="loadLogs">
          Retry
        </button>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="loading-state"
        role="status"
        aria-live="polite"
      >
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading audit activity logs…</p>
      </div>

      <!-- Populated State -->
      <div v-else-if="logs.length > 0" class="table-card">
        <div class="table-scroll">
          <table class="logs-table">
            <thead>
              <tr>
                <th scope="col" class="th-time">Timestamp</th>
                <th scope="col" class="th-actor">Actor</th>
                <th scope="col" class="th-action">Action</th>
                <th scope="col" class="th-target">Affected resource</th>
                <th scope="col" class="th-desc">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.log_id" class="log-row">
                <!-- Timestamp -->
                <td class="td-time">
                  <div class="time-container">
                    <template v-if="formatAuditLogTimestamp(log.logged_at).isNull">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-status-subtext text-dim">Not recorded</span>
                    </template>
                    <template v-else-if="formatAuditLogTimestamp(log.logged_at).isInvalid">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-status-subtext text-dim">Date unavailable</span>
                    </template>
                    <template v-else-if="formatAuditLogTimestamp(log.logged_at).isTimezoneFree">
                      <span class="time-formatted" :title="log.logged_at">
                        {{ formatAuditLogTimestamp(log.logged_at).formatted }}
                      </span>
                      <span class="time-status-subtext text-muted">Timezone unspecified</span>
                    </template>
                    <template v-else>
                      <span class="time-formatted" :title="log.logged_at">
                        {{ formatAuditLogTimestamp(log.logged_at).formatted }}
                      </span>
                      <span class="time-status-subtext text-muted">
                        Local ({{ formatAuditLogTimestamp(log.logged_at).statusText }})
                      </span>
                    </template>
                  </div>
                </td>

                <!-- Actor Email -->
                <td class="td-actor">
                  <div class="actor-container">
                    <span class="actor-email" :title="log.user_email">
                      {{ log.user_email || 'Not recorded' }}
                    </span>
                    <button
                      v-if="log.user_id"
                      type="button"
                      class="btn-actor-filter"
                      :title="`Filter by actor UUID: ${log.user_id}`"
                      :aria-label="`Filter by actor ${log.user_email || log.user_id}`"
                      @click="quickFilterByActor(log.user_id)"
                    >
                      Filter
                    </button>
                  </div>
                </td>

                <!-- Action Type -->
                <td class="td-action">
                  <span
                    class="action-badge"
                    :class="getActionBadgeClass(log.action_type)"
                  >
                    {{ getActionLabel(log.action_type) }}
                  </span>
                </td>

                <!-- Affected Resource / Target -->
                <td class="td-target">
                  <div class="target-container">
                    <!-- Case 1: Both table and ID present -->
                    <template v-if="log.target_table && log.target_id">
                      <span class="target-table">{{ log.target_table }}</span>
                      <code class="target-id" :title="log.target_id">
                        {{ formatTargetId(log.target_id) }}
                      </code>
                    </template>
                    <!-- Case 2: Only target table present -->
                    <template v-else-if="log.target_table && !log.target_id">
                      <span class="target-table">{{ log.target_table }}</span>
                      <span class="resource-partial text-dim">(No ID recorded)</span>
                    </template>
                    <!-- Case 3: Only target ID present -->
                    <template v-else-if="!log.target_table && log.target_id">
                      <span class="resource-partial text-dim">(No table recorded)</span>
                      <code class="target-id" :title="log.target_id">
                        {{ formatTargetId(log.target_id) }}
                      </code>
                    </template>
                    <!-- Case 4: Neither present (valid for login, etc.) -->
                    <template v-else>
                      <span class="resource-missing text-dim">Not recorded</span>
                    </template>
                  </div>
                </td>

                <!-- Description -->
                <td class="td-desc">
                  <div v-if="log.description && log.description.trim()" class="desc-container">
                    <div
                      class="desc-text"
                      :class="{ 'desc-expanded': isDescriptionExpanded(log.log_id) }"
                    >
                      {{ log.description }}
                    </div>
                    <button
                      v-if="log.description.length > 85"
                      type="button"
                      class="btn-desc-toggle"
                      :aria-expanded="isDescriptionExpanded(log.log_id)"
                      @click="toggleDescriptionExpand(log.log_id)"
                    >
                      {{ isDescriptionExpanded(log.log_id) ? 'Show less' : 'Show full description' }}
                    </button>
                  </div>
                  <span v-else class="desc-missing text-dim">
                    No additional details recorded
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer -->
        <div class="table-card-footer pagination-bar">
          <div class="pagination-info">
            Showing
            <strong>{{ (page - 1) * pageSize + 1 }}</strong>
            to
            <strong>{{ Math.min(page * pageSize, totalCount) }}</strong>
            of
            <strong>{{ totalCount.toLocaleString() }}</strong>
            entries
          </div>

          <div class="pagination-actions">
            <button
              type="button"
              class="page-btn"
              :disabled="page <= 1 || isLoading"
              aria-label="Previous page"
              @click="goToPage(page - 1)"
            >
              Previous
            </button>
            <span class="page-indicator" aria-current="page">
              Page {{ page }} of {{ totalPages }}
            </span>
            <button
              type="button"
              class="page-btn"
              :disabled="page >= totalPages || isLoading"
              aria-label="Next page"
              @click="goToPage(page + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State: Filtered -->
      <div v-else-if="hasActiveFilters" class="empty-state">
        <h4>No matching activity logs</h4>
        <p>No recorded log entries match the selected action or actor filters.</p>
        <button type="button" class="btn-clear-empty" @click="clearFilters">
          Clear filters
        </button>
      </div>

      <!-- Empty State: Unfiltered -->
      <div v-else class="empty-state">
        <h4>No recorded activity</h4>
        <p>No administrative or classroom activity logs have been recorded yet.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.audit-logs-view {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.header-titles {
  flex: 1 1 300px;
}

.title {
  margin: 0 0 0.35rem 0;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-main);
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.9rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
}

.btn-refresh:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Filter Card */
.filter-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem 1.25rem 1rem 1.25rem;
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
}

/* Control Row: labels on top, inputs on bottom with identical baseline */
.filters-controls-row {
  display: flex;
  align-items: flex-end;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.action-field {
  flex: 0 1 240px;
  min-width: 200px;
}

.actor-field {
  flex: 1 1 340px;
  min-width: 260px;
}

.filter-label {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.label-subtext {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-dim);
  text-transform: none;
}

.filter-select {
  height: 42px;
  padding: 0 0.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.filter-select:focus-visible {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
}

.input-with-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 42px;
  width: 100%;
  min-width: 0;
}

.filter-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 42px;
  padding: 0 0.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.filter-input:focus-visible {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
}

.filter-input.has-error {
  border-color: var(--color-danger);
  background-color: #fef2f2;
}

.btn-apply-actor {
  height: 42px;
  padding: 0 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.btn-apply-actor:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-card);
}

.filter-actions {
  display: flex;
  align-items: center;
  height: 42px;
}

.btn-clear-filters {
  height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.95rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.btn-clear-filters:hover {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

/* Feedback Row: strictly below controls to never shift control vertical alignment */
.filters-feedback-row {
  margin-top: 0.5rem;
  min-height: 1.25rem;
}

.field-error-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-danger);
}

.field-hint-text {
  font-size: 0.78rem;
  color: var(--color-text-dim);
}

.active-filter-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding: 0.35rem 0.65rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  max-width: 100%;
  box-sizing: border-box;
}

.active-filter-indicator code {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.btn-remove-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.1rem;
}

.btn-remove-pill:hover {
  color: var(--color-danger);
}

/* Timezone Explanation Notice above Table */
.table-timezone-notice {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 1.25rem;
}

.notice-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.notice-text {
  font-size: 0.84rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

/* Table Card */
.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  max-width: 100%;
  width: 100%;
  min-width: 0;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  padding: 0.85rem 1.25rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

td {
  padding: 0.95rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.9rem;
  vertical-align: top;
}

.log-row:hover {
  background-color: var(--color-bg-subtle);
}

.th-time {
  width: 190px;
}

.th-actor {
  width: 270px;
  min-width: 240px;
}

.th-action {
  width: 180px;
}

.th-target {
  width: 190px;
}

.th-desc {
  min-width: 280px;
}

/* Column Renderers */
.time-container {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.time-formatted {
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
}

.time-status-subtext {
  font-size: 0.75rem;
  line-height: 1.2;
}

.actor-container {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.actor-email {
  font-weight: 600;
  color: var(--color-text-main);
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.4;
  flex: 1 1 auto;
}

.btn-actor-filter {
  padding: 0.15rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.btn-actor-filter:hover {
  border-color: var(--color-primary);
  background-color: var(--color-card);
}

.action-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.badge-success {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.badge-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.badge-primary {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.badge-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.badge-neutral {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.target-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.target-table {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.target-id {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  width: fit-content;
}

.resource-missing,
.resource-partial,
.desc-missing {
  font-size: 0.82rem;
  font-style: italic;
}

.desc-container {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.desc-text {
  font-size: 0.88rem;
  color: var(--color-text-main);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  max-width: 440px;
}

.desc-text:not(.desc-expanded) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.btn-desc-toggle {
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.btn-desc-toggle:hover {
  color: var(--color-primary-hover);
}

.text-dim {
  color: var(--color-text-dim);
}

.text-danger {
  color: var(--color-danger);
}

.text-muted {
  color: var(--color-text-muted);
}

/* Pagination Bar */
.table-card-footer {
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-card);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.pagination-info {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-text-main);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.page-btn {
  padding: 0.45rem 0.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text-main);
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* States */
.loading-state,
.empty-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3.5rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.92rem;
}

.btn-clear-empty {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-clear-empty:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 1rem auto;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  color: var(--color-danger);
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-retry:hover {
  background-color: var(--color-danger-bg);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .filter-card {
    padding: 1rem 0.85rem;
  }

  .filters-controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.85rem;
  }

  .action-field,
  .actor-field {
    width: 100%;
    min-width: 0;
  }

  .filter-actions {
    height: auto;
  }

  .btn-clear-filters {
    width: 100%;
    justify-content: center;
  }
}
</style>
