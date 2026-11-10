<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useApiCacheStore } from '../stores/apiCacheStore'
import { fetchAdminPlayData, fetchAdminPlayDataDetail } from '../api/admin'
import { extractErrorMessage } from '../api/client'
import { formatPlayDataUploadTimestamp } from '../utils/datetime'
import {
  isDecompressionSupported,
  decodePlayDataPayload,
  formatPlayDataCsv,
  getPlayDataFilename,
  triggerCsvDownload,
  processAllPlayDataExport,
} from '../utils/playDataExport'
import AppIcon from '../components/common/AppIcon.vue'

const authStore = useAuthStore()
const cacheStore = useApiCacheStore()

const PLAYDATA_TTL = 120000 // 120s

const buildPlayDataKey = (p, ps) =>
  `admin::play-data::page::page=${p}&page_size=${ps}`

const playData = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)

const isLoading = ref(true)
const errorMessage = ref('')

const downloadingUploadId = ref(null)
const downloadError = ref('')
const downloadWarning = ref('')
const downloadSuccess = ref('')

const isBulkDownloading = ref(false)
const bulkProgress = ref({ phase: '', current: 0, total: 0 })

const hasDecompressionSupport = ref(isDecompressionSupported())

let currentRequestId = 0
let activeRowAbortController = null
let activeBulkAbortController = null
let activeListAbortController = null

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const bulkProgressText = computed(() => {
  if (!isBulkDownloading.value) return ''
  const { phase, current, total } = bulkProgress.value
  if (phase === 'listing') return 'Reading upload list…'
  if (phase === 'reading' && total > 0) return `Reading ${current} of ${total}…`
  if (phase === 'processing') return 'Formatting CSV…'
  return 'Exporting…'
})

const bulkButtonText = computed(() => {
  if (isBulkDownloading.value) {
    return bulkProgressText.value
  }
  return 'Download all'
})

const cancelPendingWork = () => {
  currentRequestId++
  if (activeListAbortController) {
    activeListAbortController.abort()
    activeListAbortController = null
  }
  if (activeRowAbortController) {
    activeRowAbortController.abort()
    activeRowAbortController = null
  }
  if (activeBulkAbortController) {
    activeBulkAbortController.abort()
    activeBulkAbortController = null
  }
  downloadingUploadId.value = null
  isBulkDownloading.value = false
}

let activeSubscriptionKey = ''

const loadPlayData = async ({ force = false } = {}) => {
  cancelPendingWork()
  const reqId = ++currentRequestId
  activeListAbortController = new AbortController()

  const targetKey = buildPlayDataKey(page.value, pageSize.value)
  activeSubscriptionKey = targetKey

  const reqAuthEpoch = authStore.activeSessionEpoch
  const reqKeyVersion = cacheStore.getKeyVersion(targetKey)

  const cached = cacheStore.get(targetKey)
  if (cached && !force) {
    playData.value = Array.isArray(cached.data?.items) ? cached.data.items : []
    totalCount.value = typeof cached.data?.total_count === 'number' ? cached.data.total_count : 0
    isLoading.value = false
    errorMessage.value = ''
    downloadError.value = ''
    downloadWarning.value = ''

    if (!cached.isExpired) {
      return
    }
  } else {
    isLoading.value = true
    errorMessage.value = ''
    downloadError.value = ''
    downloadWarning.value = ''
  }

  try {
    const res = await fetchAdminPlayData(
      {
        page: page.value,
        page_size: pageSize.value,
      },
      { signal: activeListAbortController.signal },
    )

    if (
      reqId !== currentRequestId ||
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(targetKey)
    ) {
      return
    }

    cacheStore.set(targetKey, res, PLAYDATA_TTL)

    if (targetKey === activeSubscriptionKey) {
      playData.value = Array.isArray(res?.items) ? res.items : []
      totalCount.value = typeof res?.total_count === 'number' ? res.total_count : 0
    }
  } catch (err) {
    if (err?.name === 'AbortError' || reqId !== currentRequestId) return
    if (err?.response?.status === 403) {
      authStore.handleAdminForbidden()
      return
    }
    if (
      reqAuthEpoch !== authStore.activeSessionEpoch ||
      reqKeyVersion !== cacheStore.getKeyVersion(targetKey)
    ) {
      return
    }
    if (targetKey === activeSubscriptionKey) {
      playData.value = []
      totalCount.value = 0
      errorMessage.value = extractErrorMessage(
        err,
        'Unable to load play data. Please verify your connection or try again.',
      )
    }
  } finally {
    if (reqId === currentRequestId) {
      isLoading.value = false
      activeListAbortController = null
    }
  }
}

const goToPage = (newPage) => {
  if (newPage < 1 || newPage > totalPages.value || newPage === page.value || isLoading.value) {
    return
  }
  page.value = newPage
  loadPlayData()
}

const getDownloadAriaLabel = (item) => {
  const player = item?.username?.trim() ? item.username.trim() : 'unnamed player'
  const timeInfo = formatPlayDataUploadTimestamp(item?.uploaded_at)
  let timeStr = 'unknown time'
  if (!timeInfo.isNull && !timeInfo.isInvalid && timeInfo.formatted && timeInfo.formatted !== '-') {
    timeStr = timeInfo.formatted
  } else if (timeInfo.statusText) {
    timeStr = timeInfo.statusText.toLowerCase()
  }
  if (downloadingUploadId.value === item?.upload_id) {
    return `Downloading CSV for ${player}, uploaded ${timeStr}`
  }
  return `Download CSV for ${player}, uploaded ${timeStr}`
}

const handleDownloadRow = async (item) => {
  if (!item?.upload_id || downloadingUploadId.value || isBulkDownloading.value) return

  if (!hasDecompressionSupport.value) {
    downloadError.value =
      'Browser does not support native DecompressionStream. Please use a modern web browser to download CSV files.'
    return
  }

  downloadingUploadId.value = item.upload_id
  downloadError.value = ''
  downloadWarning.value = ''
  downloadSuccess.value = ''

  activeRowAbortController = new AbortController()
  const startingToken = authStore.token
  const startingUserId = authStore.user?.user_id

  try {
    const detail = await fetchAdminPlayDataDetail(item.upload_id, {
      signal: activeRowAbortController.signal,
    })

    // Session changed guard
    if (authStore.token !== startingToken || authStore.user?.user_id !== startingUserId) {
      return
    }

    if (typeof detail?.payload !== 'string') {
      throw new Error('Play data record is missing payload content')
    }

    const decoded = await decodePlayDataPayload(detail.payload)

    // Session changed guard
    if (authStore.token !== startingToken || authStore.user?.user_id !== startingUserId) {
      return
    }

    if (!decoded.ok) {
      downloadError.value = `Could not read play data for participant ${item.participant_code || item.upload_id}. ${decoded.error || 'Payload is corrupted or malformed.'}`
      return
    }

    // Check row count mismatch
    const expectedRows = typeof item.row_count === 'number' ? item.row_count : detail.row_count
    if (typeof expectedRows === 'number' && decoded.rows.length !== expectedRows) {
      downloadWarning.value = `Warning: Decoded ${decoded.rows.length} rows, but metadata indicated ${expectedRows} rows. Saved readable data.`
    }

    const csvContent = formatPlayDataCsv(decoded.rows)
    const filename = getPlayDataFilename(item.participant_code || decoded.participant_code)

    triggerCsvDownload(csvContent, filename)
  } catch (err) {
    if (err?.name === 'AbortError') return
    if (authStore.token !== startingToken || authStore.user?.user_id !== startingUserId) {
      return
    }
    downloadError.value = extractErrorMessage(
      err,
      'Failed to download play data CSV. Please try again.',
    )
  } finally {
    downloadingUploadId.value = null
    activeRowAbortController = null
  }
}

const handleDownloadAll = async () => {
  if (isBulkDownloading.value || downloadingUploadId.value || totalCount.value === 0) return

  if (!hasDecompressionSupport.value) {
    downloadError.value =
      'Browser does not support native DecompressionStream. Please use a modern web browser to download CSV files.'
    return
  }

  isBulkDownloading.value = true
  downloadError.value = ''
  downloadWarning.value = ''
  downloadSuccess.value = ''
  bulkProgress.value = { phase: 'listing', current: 0, total: totalCount.value }

  activeBulkAbortController = new AbortController()
  const startingToken = authStore.token
  const startingUserId = authStore.user?.user_id

  try {
    const res = await processAllPlayDataExport({
      fetchPage: (params, opts) => fetchAdminPlayData(params, { ...opts }),
      fetchDetail: (id, opts) => fetchAdminPlayDataDetail(id, { ...opts }),
      onProgress: (progress) => {
        bulkProgress.value = progress
      },
      signal: activeBulkAbortController.signal,
    })

    // Session changed guard
    if (authStore.token !== startingToken || authStore.user?.user_id !== startingUserId) {
      return
    }

    if (!res.ok) {
      downloadError.value = res.error || 'Failed to export play data.'
      return
    }

    triggerCsvDownload(res.csv, res.filename)

    if (res.unreadableUploads?.length > 0) {
      downloadWarning.value = `Export completed with partial results: ${res.processedCount} of ${res.totalUploads} uploads saved (${res.totalRows} rows). ${res.unreadableUploads.length} upload(s) could not be read.`
    } else if (res.mismatchedUploads?.length > 0) {
      downloadWarning.value = `Export completed: ${res.totalRows} rows saved from ${res.processedCount} uploads (${res.mismatchedUploads.length} uploads had row count differences).`
    } else {
      downloadSuccess.value = `Export completed: ${res.totalRows} rows saved from ${res.processedCount} uploads.`
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
    if (authStore.token !== startingToken || authStore.user?.user_id !== startingUserId) {
      return
    }
    downloadError.value = extractErrorMessage(
      err,
      'Bulk export failed. Please check your connection and try again.',
    )
  } finally {
    isBulkDownloading.value = false
    activeBulkAbortController = null
  }
}

// Watch actual account and session identity
watch(
  () => [authStore.user?.user_id, authStore.token],
  ([newId, newToken], [oldId, oldToken]) => {
    if (newId !== oldId || newToken !== oldToken) {
      cancelPendingWork()
      page.value = 1
      playData.value = []
      totalCount.value = 0
      if (newToken && authStore.isAdmin) {
        loadPlayData()
      }
    }
  },
)

onMounted(() => {
  hasDecompressionSupport.value = isDecompressionSupported()
  loadPlayData()
})

onUnmounted(() => {
  cancelPendingWork()
})
</script>

<template>
  <div class="admin-play-data-view">
    <!-- Header -->
    <header class="page-header">
      <div class="header-titles">
        <h2 class="title">Play data</h2>
        <p class="subtitle">
          Research telemetry logs uploaded from tester devices.
        </p>
      </div>

      <div class="header-actions">
        <!-- Download All Button -->
        <button
          type="button"
          class="btn-bulk-download"
          :disabled="isLoading || isBulkDownloading || Boolean(downloadingUploadId) || totalCount === 0 || !hasDecompressionSupport"
          :aria-busy="isBulkDownloading"
          :aria-label="isBulkDownloading ? `Exporting play data: ${bulkProgressText}` : 'Download all play data as CSV'"
          @click="handleDownloadAll"
        >
          <AppIcon
            :name="isBulkDownloading ? 'refresh' : 'download'"
            :size="16"
            :class="{ 'icon-spin': isBulkDownloading }"
          />
          <span>{{ bulkButtonText }}</span>
        </button>

        <!-- Refresh Button -->
        <button
          type="button"
          class="btn-refresh"
          :disabled="isLoading || isBulkDownloading || Boolean(downloadingUploadId)"
          aria-label="Refresh play data"
          @click="loadPlayData"
        >
          <AppIcon name="refresh" :size="16" :class="{ 'icon-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="page-body">
      <!-- Unsupported Browser Warning -->
      <div v-if="!hasDecompressionSupport" class="warning-banner" role="alert">
        <span>
          Your web browser does not support native <code>DecompressionStream</code>. CSV export requires a modern web browser (Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+).
        </span>
      </div>

      <!-- General Query Error Banner -->
      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" @click="loadPlayData">
          Retry
        </button>
      </div>

      <!-- Detail / Bulk Download Error Banner -->
      <div v-if="downloadError" class="error-banner download-error-banner" role="alert">
        <span>{{ downloadError }}</span>
        <button
          type="button"
          class="btn-dismiss"
          aria-label="Dismiss error notification"
          @click="downloadError = ''"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>

      <!-- Warning Banner (Row count mismatch, partial failures) -->
      <div v-if="downloadWarning" class="warning-banner" role="alert">
        <span>{{ downloadWarning }}</span>
        <button
          type="button"
          class="btn-dismiss"
          aria-label="Dismiss warning notification"
          @click="downloadWarning = ''"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>

      <!-- Success Banner -->
      <div v-if="downloadSuccess" class="success-banner" role="status">
        <span>{{ downloadSuccess }}</span>
        <button
          type="button"
          class="btn-dismiss"
          aria-label="Dismiss notification"
          @click="downloadSuccess = ''"
        >
          <AppIcon name="x" :size="14" />
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
        <p>Loading play data uploads…</p>
      </div>

      <!-- Populated State -->
      <div v-else-if="playData.length > 0" class="table-card">
        <div class="table-scroll">
          <table class="play-data-table">
            <thead>
              <tr>
                <th scope="col" class="th-user">Player</th>
                <th scope="col" class="th-rows">Rows</th>
                <th scope="col" class="th-time">Uploaded (PHT)</th>
                <th scope="col" class="th-action text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in playData" :key="item.upload_id" class="data-row">
                <!-- Player username -->
                <td class="td-user">
                  <span v-if="item.username" class="username-text">{{ item.username }}</span>
                  <span v-else class="text-dim">—</span>
                </td>

                <!-- Row count -->
                <td class="td-rows">
                  <span v-if="item.row_count != null" class="row-count-badge">
                    {{ item.row_count.toLocaleString() }} rows
                  </span>
                  <span v-else class="text-dim">—</span>
                </td>

                <!-- Uploaded timestamp -->
                <td class="td-time">
                  <div class="time-container">
                    <template v-if="formatPlayDataUploadTimestamp(item.uploaded_at).isNull">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-subtext text-dim">Not recorded</span>
                    </template>
                    <template v-else-if="formatPlayDataUploadTimestamp(item.uploaded_at).isInvalid">
                      <span class="time-formatted text-dim">—</span>
                      <span class="time-subtext text-dim">Date unavailable</span>
                    </template>
                    <template v-else>
                      <span class="time-formatted" :title="item.uploaded_at">
                        {{ formatPlayDataUploadTimestamp(item.uploaded_at).formatted }}
                      </span>
                    </template>
                  </div>
                </td>

                <!-- Action: Download CSV -->
                <td class="td-action text-right">
                  <button
                    type="button"
                    class="btn-download"
                    :disabled="Boolean(downloadingUploadId) || isBulkDownloading || !hasDecompressionSupport"
                    :aria-busy="downloadingUploadId === item.upload_id"
                    :aria-label="getDownloadAriaLabel(item)"
                    @click="handleDownloadRow(item)"
                  >
                    <AppIcon
                      :name="downloadingUploadId === item.upload_id ? 'refresh' : 'download'"
                      :size="14"
                      :class="{ 'icon-spin': downloadingUploadId === item.upload_id }"
                    />
                    <span>{{ downloadingUploadId === item.upload_id ? 'Downloading…' : 'Download CSV' }}</span>
                  </button>
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
            records
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

      <!-- Empty State -->
      <div v-else class="empty-card" role="status">
        <div class="empty-icon-wrap" aria-hidden="true">
          <AppIcon name="download" :size="28" />
        </div>
        <h3 class="empty-title">No play data uploads recorded yet</h3>
        <p class="empty-desc">
          Game research telemetry uploads will appear here when submitted by testers.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-play-data-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Page Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-main);
  letter-spacing: -0.02em;
  margin: 0;
}

.subtitle {
  font-family: var(--font-sans);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 640px;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Bulk Download Button */
.btn-bulk-download {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
  white-space: nowrap;
}

.btn-bulk-download:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-bulk-download:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-bulk-download:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Refresh Button */
.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-main);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
}

.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.btn-refresh:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Page Body */
.page-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Warning & Banner Styles */
.warning-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.45;
}

.warning-banner code {
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

.download-error-banner,
.success-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.btn-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  min-height: 44px;
  min-width: 44px;
  flex-shrink: 0;
}

.btn-dismiss:hover {
  opacity: 0.8;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  cursor: pointer;
  min-height: 44px;
}

.btn-retry:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Loading & Empty States */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.empty-icon-wrap {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.empty-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin: 0 0 0.5rem 0;
}

.empty-desc {
  font-family: var(--font-sans);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  max-width: 480px;
  margin: 0;
  line-height: 1.5;
}

/* Table Card */
.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.play-data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
  font-family: var(--font-sans);
}

.play-data-table th,
.play-data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.play-data-table th {
  background-color: var(--color-bg-subtle);
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.play-data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-row:hover td {
  background-color: var(--color-bg-subtle);
}

.text-right {
  text-align: right;
}

.text-dim {
  color: var(--color-text-dim);
}

.td-user {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.username-text {
  font-weight: 600;
  color: var(--color-text-main);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.row-count-badge {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-weight: 500;
  white-space: nowrap;
}

/* Timestamp container */
.time-container {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.time-formatted {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-main);
  white-space: nowrap;
}

.time-subtext {
  font-size: 0.75rem;
  line-height: 1.2;
}

/* Download Action Button */
.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
  white-space: nowrap;
}

.btn-download:hover:not(:disabled) {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary-hover);
}

.btn-download:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-download:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Pagination Bar */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background-color: var(--color-bg-subtle);
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-text-main);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-indicator {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.8rem;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-main);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .play-data-table th,
  .play-data-table td {
    padding: 0.75rem 0.625rem;
  }

  .pagination-bar {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .pagination-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
