const EDGE_UNICODE_WHITESPACE_RE = /^\p{White_Space}+|\p{White_Space}+$/gu
const SINGLE_LINE_DISALLOWED_RE = /[\p{Cc}\p{Zl}\p{Zp}]/u

export const DISPLAY_NAME_MAX_LENGTH = 100

/**
 * Strips leading and trailing characters with the Unicode White_Space property,
 * matching Pydantic's StringConstraints(strip_whitespace=True).
 *
 * @param {string} value
 * @returns {string}
 */
export function stripDisplayNameWhitespace(value) {
  if (typeof value !== 'string') return ''
  return value.replace(EDGE_UNICODE_WHITESPACE_RE, '')
}

/**
 * Counts Unicode code points (matching Python len() / Pydantic min_length & max_length).
 *
 * @param {string} value
 * @returns {number}
 */
export function countCodePoints(value) {
  if (typeof value !== 'string') return 0
  return Array.from(value).length
}

/**
 * Validates an educator display name using the exact backend contract order:
 * 1. Strip leading/trailing Unicode White_Space
 * 2. Enforce 1..100 Unicode code points
 * 3. Reject Unicode categories Cc, Zl, and Zp (single-line check)
 *
 * @param {unknown} rawValue
 * @returns {{ valid: boolean, trimmed: string, error: string, code: 'required' | 'too_long' | 'single_line' | null }}
 */
export function validateDisplayName(rawValue) {
  if (typeof rawValue !== 'string') {
    return {
      valid: false,
      trimmed: '',
      error: 'Display name is required.',
      code: 'required',
    }
  }

  const trimmed = stripDisplayNameWhitespace(rawValue)
  const length = countCodePoints(trimmed)

  if (length < 1) {
    return {
      valid: false,
      trimmed: '',
      error: 'Display name is required.',
      code: 'required',
    }
  }

  if (length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      valid: false,
      trimmed,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
      code: 'too_long',
    }
  }

  if (SINGLE_LINE_DISALLOWED_RE.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      error: 'Display name must be a single line.',
      code: 'single_line',
    }
  }

  return {
    valid: true,
    trimmed,
    error: '',
    code: null,
  }
}
