/**
 * Datetime and Timestamp Utilities for CyberMorph Frontend.
 *
 * Provides dependency-free parsing and formatting for backend UTC timestamps.
 */

// Strict ISO 8601 / RFC 3339 regex: YYYY-MM-DD[T ]HH:mm:ss[.fff...][Z|+HH:mm|-HH:mm]
const ISO_DATETIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:(Z)|([+-]\d{2}):?(\d{2}))?$/i

const isLeapYear = (year) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Parses a backend timestamp string into a valid JavaScript Date object representing the UTC instant.
 *
 * Rules:
 * - Timezone-free ISO datetime strings are interpreted as UTC.
 * - Explicit 'Z' or timezone offsets (e.g. +08:00, -05:00) preserve the exact instant.
 * - Backend fractional seconds (e.g. microseconds from PostgreSQL) are truncated to milliseconds
 *   without rounding up into another second.
 * - Rejects missing, blank, malformed, out-of-range, and impossible calendar dates (e.g. 2026-02-29).
 * - Never throws and never substitutes the current date; returns null on failure.
 *
 * @param {unknown} value - Raw value to parse
 * @returns {Date | null} Parsed Date object or null if invalid
 */
export const parseBackendUtcTimestamp = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = ISO_DATETIME_REGEX.exec(trimmed)
  if (!match) {
    return null
  }

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const hour = parseInt(match[4], 10)
  const minute = parseInt(match[5], 10)
  const second = parseInt(match[6], 10)
  const fractionStr = match[7]
  const tzSignAndHour = match[9]
  const tzMinStr = match[10]

  // Validate calendar bounds: reject year 0000 (Python datetime min year is 1)
  if (year < 1 || year > 9999) return null
  if (month < 1 || month > 12) return null
  const maxDays = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month]
  if (day < 1 || day > maxDays) return null

  // Validate time bounds
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  if (second < 0 || second > 59) return null

  // Calculate timezone offset adjustment in minutes
  let offsetMinutes = 0
  if (tzSignAndHour) {
    const sign = tzSignAndHour.charAt(0) === '-' ? -1 : 1
    const tzHour = parseInt(tzSignAndHour.slice(1), 10)
    const tzMin = parseInt(tzMinStr, 10)
    if (tzHour < 0 || tzHour > 23 || tzMin < 0 || tzMin > 59) return null
    offsetMinutes = sign * (tzHour * 60 + tzMin)
  }

  // Fractional seconds truncated to milliseconds (0..999) without rounding into another second
  let milliseconds = 0
  if (fractionStr) {
    const msDigits = fractionStr.slice(0, 3).padEnd(3, '0')
    milliseconds = parseInt(msDigits, 10)
  }

  // Date.UTC() interprets years 0000-0099 as 1900-1999.
  // Using setUTCFullYear() preserves historical calendar years exactly.
  const parsedDate = new Date(0)
  parsedDate.setUTCFullYear(year, month - 1, day)
  parsedDate.setUTCHours(hour, minute, second, milliseconds)
  if (offsetMinutes !== 0) {
    parsedDate.setTime(parsedDate.getTime() - offsetMinutes * 60 * 1000)
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }
  return parsedDate
}

/**
 * Formats a student's `last_synced_at` timestamp for truthful UI display.
 *
 * Rules:
 * - Confirmed `null` (student never synced) returns 'Not synced yet'.
 * - Missing (`undefined`), empty, or malformed/unparseable timestamps return 'Sync date unavailable'.
 * - Valid timestamps are formatted in browser-local date format.
 *
 * @param {string | null | undefined} lastSyncedAt
 * @returns {string} Formatted sync label
 */
export const formatLastSyncedDate = (lastSyncedAt) => {
  if (lastSyncedAt === null) {
    return 'Not synced yet'
  }
  if (typeof lastSyncedAt !== 'string' || !lastSyncedAt.trim()) {
    return 'Sync date unavailable'
  }
  const date = parseBackendUtcTimestamp(lastSyncedAt)
  if (!date) {
    return 'Sync date unavailable'
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a student's threat unlocked count for educator roster display.
 *
 * Rules:
 * - Confirmed `last_synced_at === null` (student never synced) returns 'Not synced yet'.
 * - Confirmed synced student with valid integer count 0–8 returns 'N of 8 unlocked'.
 * - Missing/invalid counts, missing `last_synced_at`, or unparseable sync dates return 'Unavailable'.
 * - Never manufactures zero for missing or invalid data.
 *
 * @param {unknown} count - Raw threat_unlocked_count from roster endpoint
 * @param {string | null | undefined} lastSyncedAt - Raw last_synced_at from roster endpoint
 * @returns {string} Formatted count string or 'Unavailable' / 'Not synced yet'
 */
export const formatThreatUnlockedCount = (count, lastSyncedAt) => {
  if (lastSyncedAt === null) {
    return 'Not synced yet'
  }
  if (typeof lastSyncedAt !== 'string' || !lastSyncedAt.trim() || !parseBackendUtcTimestamp(lastSyncedAt)) {
    return 'Unavailable'
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 8) {
    return 'Unavailable'
  }
  return `${count} of 8 unlocked`
}

/**
 * Formats a Date object in Philippine time (Asia/Manila, PHT, UTC+8).
 * Format: 'MMM D, YYYY, h:mm A' (e.g. 'Nov 3, 2026, 12:43 PM').
 *
 * @param {Date} date
 * @returns {string} Formatted Philippine date and time
 */
export const formatPhilippineDateTime = (date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\u202F/g, ' ')

/**
 * Resolves short timezone display name of browser environment.
 * @returns {string} e.g. "PHT", "UTC", "PST"
 */
export const getLocalTimeZoneName = () => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date())
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    if (tzPart?.value) return tzPart.value
  } catch {
    // fallback
  }
  return 'Local'
}

/**
 * Formats an activity log's `logged_at` timestamp in Asia/Manila (PHT, UTC+8).
 *
 * Rules:
 * - Timezone-free ISO strings (from backend database naive UTC) are interpreted as UTC.
 * - Explicit 'Z' or timezone offsets preserve the exact instant.
 * - Formatted in Asia/Manila regardless of browser/host timezone.
 * - Format: 'MMM D, YYYY, h:mm A' (e.g. 'Nov 3, 2026, 12:43 PM').
 * - Preserves distinct null and invalid states without substituting current time:
 *   - Null, undefined, or empty: { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
 *   - Malformed or impossible dates: { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
 *   - Valid timestamp: { formatted: 'Nov 3, 2026, 12:43 PM', statusText: '', isNull: false, isInvalid: false }
 *
 * @param {string | null | undefined} loggedAt
 * @returns {{
 *   formatted: string,
 *   statusText: string,
 *   isNull: boolean,
 *   isInvalid: boolean,
 * }}
 */
export const formatAuditLogTimestamp = (loggedAt) => {
  if (loggedAt === null || loggedAt === undefined) {
    return { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
  }
  if (typeof loggedAt !== 'string') {
    return { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
  }
  const trimmed = loggedAt.trim()
  if (!trimmed) {
    return { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
  }

  const parsedDate = parseBackendUtcTimestamp(trimmed)
  if (!parsedDate) {
    return { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
  }

  return {
    formatted: formatPhilippineDateTime(parsedDate),
    statusText: '',
    isNull: false,
    isInvalid: false,
  }
}

/**
 * Formats a Play data `uploaded_at` timestamp in Asia/Manila (PHT, UTC+8).
 *
 * Rules:
 * - Timezone-free ISO strings (from backend utc_now_naive()) are interpreted as UTC.
 * - Explicit 'Z' or timezone offsets preserve the exact instant.
 * - Formatted in Asia/Manila regardless of host/browser timezone.
 * - Format: 'MMM D, YYYY, h:mm A' (e.g. 'Nov 3, 2026, 12:43 PM').
 * - Preserves distinct null and invalid states without substituting current time:
 *   - Null, undefined, or empty: { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
 *   - Malformed or impossible dates: { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
 *   - Valid timestamp: { formatted: 'Nov 3, 2026, 12:43 PM', statusText: '', isNull: false, isInvalid: false }
 *
 * @param {string | null | undefined} uploadedAt
 * @returns {{
 *   formatted: string,
 *   statusText: string,
 *   isNull: boolean,
 *   isInvalid: boolean,
 * }}
 */
export const formatPlayDataUploadTimestamp = (uploadedAt) => {
  if (uploadedAt === null || uploadedAt === undefined) {
    return { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
  }
  if (typeof uploadedAt !== 'string') {
    return { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
  }
  const trimmed = uploadedAt.trim()
  if (!trimmed) {
    return { formatted: '—', statusText: 'Not recorded', isNull: true, isInvalid: false }
  }

  const parsedDate = parseBackendUtcTimestamp(trimmed)
  if (!parsedDate) {
    return { formatted: '—', statusText: 'Date unavailable', isNull: false, isInvalid: true }
  }

  return {
    formatted: formatPhilippineDateTime(parsedDate),
    statusText: '',
    isNull: false,
    isInvalid: false,
  }
}
