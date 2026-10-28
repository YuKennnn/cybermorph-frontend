import {
  validateDisplayName,
  stripDisplayNameWhitespace,
  countCodePoints,
} from './displayName.js'
import { extractErrorMessage } from '../api/client.js'

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SINGLE_LINE_DISALLOWED_RE = /[\p{Cc}\p{Zl}\p{Zp}]/u
const UPPERCASE_RE = /[A-Z]/
const LOWERCASE_RE = /[a-z]/
const DIGIT_RE = /\d/
const SPECIAL_CHAR_RE = /[^A-Za-z0-9]/

export const SHARED_CREDENTIALS_ERROR = 'Incorrect email or password.'

/**
 * Joins non-empty DOM IDs into an aria-describedby attribute value,
 * preserving hint IDs alongside error IDs.
 *
 * @param  {...(string|null|undefined|false)} ids
 * @returns {string|undefined}
 */
export function joinDescribedBy(...ids) {
  const filtered = ids.filter((id) => typeof id === 'string' && id.trim().length > 0)
  return filtered.length > 0 ? filtered.join(' ') : undefined
}

/**
 * Validates an email address for Sign In or Registration.
 *
 * @param {string} rawEmail
 * @param {Object} [options]
 * @param {boolean} [options.requireEducatorDomain=false]
 * @returns {{ valid: boolean, trimmed: string, error: string }}
 */
export function validateEmailField(rawEmail, { requireEducatorDomain = false } = {}) {
  const trimmed = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  if (!trimmed) {
    return {
      valid: false,
      trimmed: '',
      error: 'Enter your email address.',
    }
  }

  if (SINGLE_LINE_DISALLOWED_RE.test(trimmed) || !EMAIL_FORMAT_RE.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      error: 'Enter a valid email address.',
    }
  }

  if (requireEducatorDomain && !trimmed.toLowerCase().endsWith('@dnsc.edu.ph')) {
    return {
      valid: false,
      trimmed,
      error: 'Use your institutional @dnsc.edu.ph email address.',
    }
  }

  return {
    valid: true,
    trimmed,
    error: '',
  }
}

/**
 * Validates the password field on Sign In (checks only whether it is empty).
 *
 * @param {string} rawPassword
 * @returns {{ valid: boolean, error: string }}
 */
export function validateLoginPasswordField(rawPassword) {
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    return {
      valid: false,
      error: 'Enter your password.',
    }
  }
  return {
    valid: true,
    error: '',
  }
}

/**
 * Validates the password field on Registration using the documented backend rules:
 * 12 characters minimum, 72 UTF-8 bytes maximum, uppercase, lowercase, digit, special character.
 *
 * @param {string} rawPassword
 * @returns {{ valid: boolean, error: string }}
 */
export function validateRegistrationPasswordField(rawPassword) {
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    return {
      valid: false,
      error: 'Enter a password.',
    }
  }

  const byteLength = new TextEncoder().encode(rawPassword).length
  if (byteLength > 72) {
    return {
      valid: false,
      error: 'Password must not exceed 72 bytes.',
    }
  }

  if (
    rawPassword.length < 12 ||
    !UPPERCASE_RE.test(rawPassword) ||
    !LOWERCASE_RE.test(rawPassword) ||
    !DIGIT_RE.test(rawPassword) ||
    !SPECIAL_CHAR_RE.test(rawPassword)
  ) {
    return {
      valid: false,
      error:
        'Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.',
    }
  }

  return {
    valid: true,
    error: '',
  }
}

/**
 * Validates a player username on Registration (3–50 characters, single line).
 *
 * @param {string} rawUsername
 * @returns {{ valid: boolean, trimmed: string, error: string }}
 */
export function validateUsernameField(rawUsername) {
  const trimmed =
    typeof rawUsername === 'string' ? stripDisplayNameWhitespace(rawUsername) : ''
  const length = countCodePoints(trimmed)

  if (length === 0) {
    return {
      valid: false,
      trimmed: '',
      error: 'Enter a username.',
    }
  }

  if (length < 3 || length > 50) {
    return {
      valid: false,
      trimmed,
      error: 'Username must be between 3 and 50 characters.',
    }
  }

  if (SINGLE_LINE_DISALLOWED_RE.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      error: 'Username must be a single line.',
    }
  }

  return {
    valid: true,
    trimmed,
    error: '',
  }
}

/**
 * Sanitizes a backend 422 validation message for a specific field into concise UI copy.
 *
 * @param {string} field
 * @param {string} rawMsg
 * @param {'player'|'educator'} [role='player']
 * @returns {string}
 */
function sanitizeFieldValidationMessage(field, rawMsg, role = 'player') {
  const cleaned = typeof rawMsg === 'string' ? rawMsg.replace(/^Value error,\s*/i, '').trim() : ''
  const lower = cleaned.toLowerCase()

  if (field === 'email') {
    if (lower.includes('@dnsc.edu.ph') || (role === 'educator' && lower.includes('domain'))) {
      return 'Use your institutional @dnsc.edu.ph email address.'
    }
    return 'Enter a valid email address.'
  }

  if (field === 'username') {
    if (lower.includes('single line')) {
      return 'Username must be a single line.'
    }
    return 'Username must be between 3 and 50 characters.'
  }

  if (field === 'displayName') {
    if (lower.includes('single line')) {
      return 'Display name must be a single line.'
    }
    if (lower.includes('100') || lower.includes(' at most ')) {
      return 'Display name must be 100 characters or fewer.'
    }
    return 'Display name is required.'
  }

  if (field === 'password') {
    if (lower.includes('72 bytes')) {
      return 'Password must not exceed 72 bytes.'
    }
    return 'Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.'
  }

  return cleaned || 'Please check this field.'
}

/**
 * Maps an API error from Sign In or Registration into structured field errors,
 * shared credentials error, or form-level error.
 *
 * @param {any} error
 * @param {Object} options
 * @param {'login'|'register'} options.mode
 * @param {'player'|'educator'} [options.role='player']
 * @returns {{
 *   credentialsError: string,
 *   fieldErrors: Partial<Record<'displayName'|'email'|'username'|'password', string>>,
 *   formError: string
 * }}
 */
export function mapAuthApiError(error, { mode, role = 'player' }) {
  const result = {
    credentialsError: '',
    fieldErrors: {},
    formError: '',
  }

  if (!error) {
    result.formError =
      mode === 'login'
        ? 'Unable to sign in right now. Please try again.'
        : 'Unable to create account right now. Please try again.'
    return result
  }

  const status = error.response?.status
  const detail = error.response?.data?.detail
  const requestUrl = String(error.config?.url || '')

  // 1. Handle Sign In responses
  if (mode === 'login') {
    const isLoginEndpoint =
      requestUrl.includes('/auth/login') || !requestUrl.includes('/me')
    const detailText = typeof detail === 'string' ? detail.trim() : ''
    const lowerDetail = detailText.toLowerCase()

    // Distinguish actual invalid-credentials 401 on /auth/login from profile/token 401
    if (
      status === 401 &&
      isLoginEndpoint &&
      lowerDetail !== 'could not validate credentials' &&
      (lowerDetail.includes('incorrect email or password') ||
        lowerDetail.includes('invalid credentials') ||
        detailText === '')
    ) {
      result.credentialsError = SHARED_CREDENTIALS_ERROR
      return result
    }

    // 401 during post-login profile resolution (/web-users/me or /players/me)
    if (status === 401) {
      result.formError =
        'Your session could not be verified. Please try signing in again.'
      return result
    }

    // 403 account access restriction (e.g. "Account is not active" for pending/rejected educator)
    if (status === 403) {
      if (lowerDetail === 'account is not active') {
        result.formError =
          'Account is not active. Educator accounts require administrator approval before signing in.'
      } else if (detailText) {
        result.formError = detailText
      } else {
        result.formError = 'Access to this account is currently restricted.'
      }
      return result
    }

    // 422 validation errors on /auth/login
    if (status === 422 && Array.isArray(detail)) {
      for (const item of detail) {
        const loc = Array.isArray(item?.loc) ? item.loc : []
        if (loc.includes('email') && !result.fieldErrors.email) {
          result.fieldErrors.email = 'Enter a valid email address.'
        } else if (loc.includes('password') && !result.fieldErrors.password) {
          result.fieldErrors.password = 'Enter your password.'
        }
      }
      if (Object.keys(result.fieldErrors).length > 0) {
        return result
      }
    }

    if (status >= 500) {
      result.formError = 'Server error while signing in. Please try again in a moment.'
      return result
    }

    result.formError = extractErrorMessage(
      error,
      'Unable to sign in. Please check your connection and try again.',
    )
    return result
  }

  // 2. Handle Registration responses (POST /auth/register & POST /auth/register-web)
  if (status === 409) {
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const conflictField = detail.field
      const conflictMsg =
        typeof detail.message === 'string' ? detail.message.trim() : ''

      if (conflictField === 'email') {
        result.fieldErrors.email =
          conflictMsg || 'This email address is already registered.'
        return result
      }
      if (conflictField === 'username') {
        result.fieldErrors.username =
          conflictMsg || 'This username is already taken.'
        return result
      }
      if (conflictField === 'display_name') {
        result.fieldErrors.displayName =
          conflictMsg || 'Please enter a valid display name.'
        return result
      }
      if (conflictMsg) {
        result.formError = conflictMsg
        return result
      }
    } else if (typeof detail === 'string' && detail.trim()) {
      const lower = detail.toLowerCase()
      if (lower.includes('username') && !lower.includes('email')) {
        result.fieldErrors.username = 'This username is already taken.'
        return result
      }
      if (lower.includes('email') && !lower.includes('username')) {
        result.fieldErrors.email = 'This email address is already registered.'
        return result
      }
      result.formError = detail.trim()
      return result
    }
  }

  if (status === 422 && Array.isArray(detail)) {
    for (const item of detail) {
      const loc = Array.isArray(item?.loc) ? item.loc : []
      const msg = typeof item?.msg === 'string' ? item.msg : ''

      if (loc.includes('display_name') && !result.fieldErrors.displayName) {
        result.fieldErrors.displayName = sanitizeFieldValidationMessage(
          'displayName',
          msg,
          role,
        )
      } else if (loc.includes('email') && !result.fieldErrors.email) {
        result.fieldErrors.email = sanitizeFieldValidationMessage('email', msg, role)
      } else if (loc.includes('username') && !result.fieldErrors.username) {
        result.fieldErrors.username = sanitizeFieldValidationMessage(
          'username',
          msg,
          role,
        )
      } else if (loc.includes('password') && !result.fieldErrors.password) {
        result.fieldErrors.password = sanitizeFieldValidationMessage(
          'password',
          msg,
          role,
        )
      }
    }

    if (Object.keys(result.fieldErrors).length > 0) {
      return result
    }
  }

  if (status >= 500) {
    result.formError =
      'Server error while creating your account. Please try again in a moment.'
    return result
  }

  result.formError = extractErrorMessage(
    error,
    'Registration request failed. Please check your connection and try again.',
  )
  return result
}

export { validateDisplayName }
