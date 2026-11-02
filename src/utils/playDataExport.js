/**
 * Utility functions for exporting research play data to CSV.
 * Follows C:/Cyber-Morph/cybermorph-backend/PLAY_DATA_GUIDE.md specification.
 */

export const PLAY_DATA_COLUMNS = Object.freeze([
  'participant_code',
  'session_id',
  'attack_log_id',
  'scenario_id',
  'threat_type',
  'is_legitimate_item',
  'scenario_difficulty',
  'player_action',
  'is_correct',
  'credits_affected',
  'response_time_ms',
  'logged_at',
  'order_in_session',
  'session_number',
  'is_tutorial',
  'is_baseline',
  'phase',
  'map_name',
  'skill_level_at_time',
  'selection_policy',
  'selection_probability',
  'build_version',
])

/**
 * Checks if native DecompressionStream is supported in the current environment.
 * @returns {boolean}
 */
export function isDecompressionSupported() {
  const scope =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? globalThis
        : null
  return (
    typeof scope?.DecompressionStream === 'function' &&
    typeof scope?.Blob === 'function' &&
    typeof scope?.Response === 'function'
  )
}

/**
 * Encodes a single cell value for CSV output according to RFC 4180 / guide rules.
 * - Booleans are converted to Python-style 'True' or 'False'
 * - Null and undefined are output as empty string
 * - Numbers and other primitives are converted to string (0 preserved)
 * - Fields containing commas, double quotes, or newlines are wrapped in double quotes
 *   with internal double quotes escaped as ""
 * @param {*} val - Cell value
 * @returns {string}
 */
export function formatCsvValue(val) {
  if (val === null || val === undefined) {
    return ''
  }
  if (typeof val === 'boolean') {
    return val ? 'True' : 'False'
  }
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Converts an array of game telemetry row objects into an RFC-compliant CSV string.
 * Always outputs the exact 22 columns in fixed order, even if rows is empty.
 * Never includes 'username'.
 * @param {Array<Object>} rows - Array of decoded answer rows
 * @returns {string} CSV text ending with \n
 */
export function formatPlayDataCsv(rows = []) {
  const header = PLAY_DATA_COLUMNS.join(',')
  if (!Array.isArray(rows) || rows.length === 0) {
    return `${header}\n`
  }
  const lines = rows.map((row) => {
    return PLAY_DATA_COLUMNS.map((col) => formatCsvValue(row?.[col])).join(',')
  })
  return `${header}\n${lines.join('\n')}\n`
}

/**
 * Decodes a CMLOG1: telemetry payload string in the browser using DecompressionStream.
 * Steps:
 * 1. Remove all whitespace and line breaks
 * 2. Check for CMLOG1: prefix
 * 3. Base64 decode to bytes
 * 4. Decompress with DecompressionStream('gzip')
 * 5. Parse UTF-8 JSON text
 * 6. Validate { participant_code, rows }
 * @param {string} payloadText - Raw payload string from backend
 * @returns {Promise<{ ok: boolean, participant_code?: string, rows?: Array<Object>, error?: string }>}
 */
export async function decodePlayDataPayload(payloadText) {
  if (typeof payloadText !== 'string') {
    return { ok: false, error: 'Play data payload must be a string' }
  }

  const clean = payloadText.replace(/\s+/g, '')
  if (!clean.startsWith('CMLOG1:')) {
    return { ok: false, error: 'Play data payload is missing required CMLOG1: prefix' }
  }

  const base64Part = clean.slice(7)
  if (!base64Part) {
    return { ok: false, error: 'Play data payload body is empty' }
  }

  try {
    const scope =
      typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? globalThis
          : null

    if (!isDecompressionSupported()) {
      return {
        ok: false,
        error:
          'Your web browser does not support native DecompressionStream. Please use a modern browser (Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+).',
      }
    }

    const bin = scope.atob(base64Part)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const stream = new scope.Blob([bytes])
      .stream()
      .pipeThrough(new scope.DecompressionStream('gzip'))
    const text = await new scope.Response(stream).text()
    const data = JSON.parse(text)

    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Decoded payload root is not an object' }
    }

    if (!Array.isArray(data.rows)) {
      return { ok: false, error: 'Decoded payload is missing a valid rows array' }
    }

    return {
      ok: true,
      participant_code: data.participant_code || '',
      rows: data.rows,
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Could not decompress or parse payload',
    }
  }
}

/**
 * Returns the standardized filename for a single participant's CSV export.
 * Format: play-data-<participant_code>-<yyyy-mm-dd>.csv
 * @param {string} participantCode
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getPlayDataFilename(participantCode, date = new Date()) {
  const safeCode =
    (participantCode ? String(participantCode).trim() : 'unknown').replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    ) || 'unknown'
  const dateStr =
    date instanceof Date && !isNaN(date.getTime())
      ? date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  return `play-data-${safeCode}-${dateStr}.csv`
}

/**
 * Returns the standardized filename for the bulk play data CSV export.
 * Format: play-data-all-<yyyy-mm-dd>.csv
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getAllPlayDataFilename(date = new Date()) {
  const dateStr =
    date instanceof Date && !isNaN(date.getTime())
      ? date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  return `play-data-all-${dateStr}.csv`
}

/**
 * Triggers a browser file download using a transient anchor tag.
 * @param {string} csvText - Full CSV content
 * @param {string} filename - Target file name
 */
export function triggerCsvDownload(csvText, filename) {
  if (typeof document === 'undefined') return
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}

/**
 * Executes the bulk "Download all" workflow:
 * 1. Paginates through all metadata records using page_size=100
 * 2. Fetches detail payloads with at most 3 concurrent requests
 * 3. Decodes payloads and checks decoded row counts
 * 4. Combines rows under one header, deduplicating by attack_log_id
 * 5. Returns combined CSV, count of processed/unreadable uploads, and details
 * @param {Object} options
 * @param {Function} options.fetchPage - async ({ page, page_size }, { signal }) => { items, total_count }
 * @param {Function} options.fetchDetail - async (uploadId, { signal }) => { payload, row_count, ... }
 * @param {Function} [options.onProgress] - ({ phase: string, current: number, total: number }) => void
 * @param {AbortSignal} [options.signal] - Cancellation signal
 * @returns {Promise<{
 *   ok: boolean,
 *   csv?: string,
 *   filename?: string,
 *   totalUploads: number,
 *   processedCount: number,
 *   unreadableUploads: Array<{ upload_id: string, participant_code: string, reason: string }>,
 *   mismatchedUploads: Array<{ upload_id: string, participant_code: string, expected: number, actual: number }>,
 *   totalRows: number,
 *   error?: string
 * }>}
 */
export async function processAllPlayDataExport({
  fetchPage,
  fetchDetail,
  onProgress = () => {},
  signal,
}) {
  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError')
  }

  // Phase 1: Retrieve all metadata records (page_size = 100)
  onProgress({ phase: 'listing', current: 0, total: 0 })

  const firstPage = await fetchPage({ page: 1, page_size: 100 }, { signal })
  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError')
  }

  const allItems = Array.isArray(firstPage?.items) ? [...firstPage.items] : []
  const totalCount = typeof firstPage?.total_count === 'number' ? firstPage.total_count : allItems.length
  const totalPages = Math.max(1, Math.ceil(totalCount / 100))

  for (let p = 2; p <= totalPages; p++) {
    if (signal?.aborted) {
      throw new DOMException('Export aborted', 'AbortError')
    }
    const pageRes = await fetchPage({ page: p, page_size: 100 }, { signal })
    if (Array.isArray(pageRes?.items)) {
      allItems.push(...pageRes.items)
    }
  }

  if (allItems.length === 0) {
    return {
      ok: false,
      error: 'No play data has been sent yet.',
      totalUploads: 0,
      processedCount: 0,
      unreadableUploads: [],
      mismatchedUploads: [],
      totalRows: 0,
    }
  }

  // Phase 2: Fetch details with concurrency <= 3
  const CONCURRENCY_LIMIT = 3
  const results = Array.from({ length: allItems.length })
  let nextIndex = 0
  let completedCount = 0

  onProgress({ phase: 'reading', current: 0, total: allItems.length })

  async function worker() {
    while (nextIndex < allItems.length) {
      if (signal?.aborted) {
        throw new DOMException('Export aborted', 'AbortError')
      }
      const currentIndex = nextIndex++
      const item = allItems[currentIndex]

      try {
        const detail = await fetchDetail(item.upload_id, { signal })
        results[currentIndex] = { item, detail, success: true }
      } catch (err) {
        if (signal?.aborted) throw err
        results[currentIndex] = {
          item,
          error: err?.message || 'Failed to fetch upload detail',
          success: false,
        }
      }

      completedCount++
      onProgress({ phase: 'reading', current: completedCount, total: allItems.length })
    }
  }

  const workerCount = Math.min(CONCURRENCY_LIMIT, allItems.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  await Promise.all(workers)

  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError')
  }

  // Phase 3: Decode payloads, deduplicate rows, verify row counts
  onProgress({ phase: 'processing', current: allItems.length, total: allItems.length })

  const combinedRows = []
  const seenAttackLogIds = new Set()
  const unreadableUploads = []
  const mismatchedUploads = []

  for (const entry of results) {
    if (!entry) continue
    const { item, detail, success, error } = entry

    if (!success || typeof detail?.payload !== 'string') {
      unreadableUploads.push({
        upload_id: item.upload_id,
        participant_code: item.participant_code || 'unknown',
        reason: error || 'Missing payload text in detail response',
      })
      continue
    }

    const decoded = await decodePlayDataPayload(detail.payload)
    if (!decoded.ok) {
      unreadableUploads.push({
        upload_id: item.upload_id,
        participant_code: item.participant_code || 'unknown',
        reason: decoded.error || 'Could not decode or decompress payload',
      })
      continue
    }

    // Check row count mismatch
    const expectedRows = typeof item.row_count === 'number' ? item.row_count : detail.row_count
    if (typeof expectedRows === 'number' && decoded.rows.length !== expectedRows) {
      mismatchedUploads.push({
        upload_id: item.upload_id,
        participant_code: item.participant_code || 'unknown',
        expected: expectedRows,
        actual: decoded.rows.length,
      })
    }

    // Deduplicate by attack_log_id
    for (const row of decoded.rows) {
      if (row?.attack_log_id) {
        if (seenAttackLogIds.has(row.attack_log_id)) {
          continue
        }
        seenAttackLogIds.add(row.attack_log_id)
      }
      combinedRows.push(row)
    }
  }

  // If every upload failed, do not claim success or produce CSV
  if (unreadableUploads.length === allItems.length) {
    return {
      ok: false,
      error: 'All play data uploads failed to download or decode.',
      totalUploads: allItems.length,
      processedCount: 0,
      unreadableUploads,
      mismatchedUploads,
      totalRows: 0,
    }
  }

  const csv = formatPlayDataCsv(combinedRows)
  const filename = getAllPlayDataFilename()

  return {
    ok: true,
    csv,
    filename,
    totalUploads: allItems.length,
    processedCount: allItems.length - unreadableUploads.length,
    unreadableUploads,
    mismatchedUploads,
    totalRows: combinedRows.length,
  }
}
