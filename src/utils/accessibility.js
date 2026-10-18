/**
 * Unified Accessibility Preferences Utility for CyberMorph Web Portal (Phase 1).
 *
 * Manages:
 * 1. Theme: 'system' | 'light' | 'dark' (stored under 'cyber_pref_theme')
 * 2. Text Sizing: 'standard' | 'large' | 'extra-large' (stored under 'cyber_pref_text_size')
 * 3. Reduced Motion: 'system' | 'reduced' (stored under 'cyber_pref_reduced_motion')
 *
 * Guarantees:
 * - Decoupled from authentication storage (wiping auth does not erase accessibility).
 * - Full memory fallback if localStorage throws or is blocked.
 * - Corrupted or invalid stored values safely fallback to defaults.
 * - Applies early to document.documentElement before mount to avoid visual flashes.
 * - Backward compatibility with motion.js.
 */

import { ref } from 'vue'
import {
  getStoredMotionPreference,
  setStoredMotionPreference,
  applyMotionPreference,
  initMotionPreference,
  isReducedMotionActive,
  onMotionChange,
  isMotionWriteFailed,
  resetMotionWriteFailed,
} from './motion.js'

export {
  getStoredMotionPreference,
  setStoredMotionPreference,
  applyMotionPreference,
  initMotionPreference,
  isReducedMotionActive,
  onMotionChange,
}

const THEME_KEY = 'cyber_pref_theme'
const TEXT_SIZE_KEY = 'cyber_pref_text_size'
const READ_ALOUD_KEY = 'cyber_pref_read_aloud'
const READ_SPEED_KEY = 'cyber_pref_read_speed'

export {
  THEME_KEY,
  TEXT_SIZE_KEY,
  READ_ALOUD_KEY,
  READ_SPEED_KEY,
}

// In-memory fallbacks if localStorage is unavailable
let memoryTheme = 'light'
let memoryTextSize = 'standard'
let memoryReadAloud = 'off'
let memoryReadSpeed = '1'
let themeWriteFailed = false
let textSizeWriteFailed = false
let readAloudWriteFailed = false
let readSpeedWriteFailed = false

// Clean event listener reference for system theme changes
let systemThemeMediaQuery = null
let systemThemeListener = null

/**
 * Check if the browser's OS prefers dark mode.
 * @returns {boolean}
 */
export const getSystemPrefersDark = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Retrieve the current theme preference from localStorage, falling back to memory.
 * When writes fail in this browser session, returns the active in-memory choice.
 * Invalid or corrupted stored values default to 'system'.
 * @returns {'system' | 'light' | 'dark'}
 */
export const getStoredTheme = () => {
  if (themeWriteFailed) {
    return memoryTheme
  }
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return 'light'
  } catch {
    return memoryTheme
  }
}

/**
 * Apply theme to document.documentElement.
 * When 'system', removes data-theme attribute so CSS @media (prefers-color-scheme: dark) applies natively.
 * Sets data-theme="light" or data-theme="dark" for explicit overrides.
 * @param {'system' | 'light' | 'dark'} theme
 */
export const applyTheme = (theme) => {
  const validTheme = theme === 'light' || theme === 'dark' ? theme : 'system'
  if (typeof document !== 'undefined' && document.documentElement) {
    if (validTheme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', validTheme)
    }
  }

  // Manage system media query listener when in 'system' mode
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (validTheme === 'system' && !systemThemeListener) {
      systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      systemThemeListener = () => {
        // Force style re-calculation or attribute synchronization if needed
        if (getStoredTheme() === 'system') {
          // CSS handles the native @media query switch
        }
      }
      if (typeof systemThemeMediaQuery.addEventListener === 'function') {
        systemThemeMediaQuery.addEventListener('change', systemThemeListener)
      } else if (typeof systemThemeMediaQuery.addListener === 'function') {
        systemThemeMediaQuery.addListener(systemThemeListener)
      }
    } else if (validTheme !== 'system' && systemThemeListener && systemThemeMediaQuery) {
      if (typeof systemThemeMediaQuery.removeEventListener === 'function') {
        systemThemeMediaQuery.removeEventListener('change', systemThemeListener)
      } else if (typeof systemThemeMediaQuery.removeListener === 'function') {
        systemThemeMediaQuery.removeListener(systemThemeListener)
      }
      systemThemeListener = null
      systemThemeMediaQuery = null
    }
  }
}

/**
 * Store and apply theme preference.
 * When writes fail, preserves the active choice in memory for this session.
 * @param {'system' | 'light' | 'dark'} theme
 * @returns {'system' | 'light' | 'dark'}
 */
export const setStoredTheme = (theme) => {
  const validTheme = theme === 'light' || theme === 'dark' ? theme : 'system'
  memoryTheme = validTheme
  try {
    localStorage.setItem(THEME_KEY, validTheme)
    if (localStorage.getItem(THEME_KEY) === validTheme) {
      themeWriteFailed = false
    } else {
      themeWriteFailed = true
    }
  } catch {
    themeWriteFailed = true
  }
  applyTheme(validTheme)
  return validTheme
}

/**
 * Retrieve text sizing preference from localStorage, falling back to memory.
 * When writes fail in this browser session, returns the active in-memory choice.
 * Invalid or corrupted stored values default to 'standard'.
 * @returns {'standard' | 'large' | 'extra-large'}
 */
export const getStoredTextSize = () => {
  if (textSizeWriteFailed) {
    return memoryTextSize
  }
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY)
    if (stored === 'standard' || stored === 'large' || stored === 'extra-large') {
      return stored
    }
    return 'standard'
  } catch {
    return memoryTextSize
  }
}

/**
 * Apply text sizing to document.documentElement.
 * When 'standard', removes data-text-size attribute (100% font-size).
 * Sets data-text-size="large" (115%) or data-text-size="extra-large" (130%).
 * @param {'standard' | 'large' | 'extra-large'} size
 */
export const applyTextSize = (size) => {
  const validSize = size === 'large' || size === 'extra-large' ? size : 'standard'
  if (typeof document !== 'undefined' && document.documentElement) {
    if (validSize === 'standard') {
      document.documentElement.removeAttribute('data-text-size')
    } else {
      document.documentElement.setAttribute('data-text-size', validSize)
    }
  }
}

/**
 * Store and apply text size preference.
 * When writes fail, preserves the active choice in memory for this session.
 * @param {'standard' | 'large' | 'extra-large'} size
 * @returns {'standard' | 'large' | 'extra-large'}
 */
export const setStoredTextSize = (size) => {
  const validSize = size === 'large' || size === 'extra-large' ? size : 'standard'
  memoryTextSize = validSize
  try {
    localStorage.setItem(TEXT_SIZE_KEY, validSize)
    if (localStorage.getItem(TEXT_SIZE_KEY) === validSize) {
      textSizeWriteFailed = false
    } else {
      textSizeWriteFailed = true
    }
  } catch {
    textSizeWriteFailed = true
  }
  applyTextSize(validSize)
  return validSize
}

/**
 * Valid reading speed rates supported by the speech synthesis engine.
 */
export const VALID_READ_SPEEDS = ['0.75', '1', '1.25', '1.5']

/**
 * Reactive ref holding the active read-aloud state so Vue computeds/templates automatically update.
 */
export const activeReadAloud = ref('off')

/**
 * Retrieve the current read-aloud preference from localStorage, falling back to memory.
 * When writes fail in this browser session, returns the active in-memory choice.
 * Defaults to 'off'.
 * @returns {'off' | 'on'}
 */
export const getStoredReadAloud = () => {
  // Subscribe active Vue effect if present
  void activeReadAloud.value
  if (readAloudWriteFailed) {
    return memoryReadAloud
  }
  try {
    const stored = localStorage.getItem(READ_ALOUD_KEY)
    if (stored === 'on' || stored === 'off') {
      return stored
    }
    return 'off'
  } catch {
    return memoryReadAloud
  }
}

/**
 * Store read-aloud preference.
 * When writes fail, preserves the active choice in memory for this session.
 * @param {'off' | 'on'} val
 * @returns {'off' | 'on'}
 */
export const setStoredReadAloud = (val) => {
  const valid = val === 'on' ? 'on' : 'off'
  memoryReadAloud = valid
  try {
    localStorage.setItem(READ_ALOUD_KEY, valid)
    if (localStorage.getItem(READ_ALOUD_KEY) === valid) {
      readAloudWriteFailed = false
    } else {
      readAloudWriteFailed = true
    }
  } catch {
    readAloudWriteFailed = true
  }

  activeReadAloud.value = valid
  return valid
}

/**
 * Retrieve the current reading speed from localStorage, falling back to memory.
 * Defaults to '1'.
 * @returns {'0.75' | '1' | '1.25' | '1.5'}
 */
export const getStoredReadSpeed = () => {
  if (readSpeedWriteFailed) {
    return memoryReadSpeed
  }
  try {
    const stored = localStorage.getItem(READ_SPEED_KEY)
    if (stored && VALID_READ_SPEEDS.includes(stored)) {
      return stored
    }
    return '1'
  } catch {
    return memoryReadSpeed
  }
}

/**
 * Store reading speed preference.
 * When writes fail, preserves the active choice in memory for this session.
 * @param {'0.75' | '1' | '1.25' | '1.5' | number} speed
 * @returns {'0.75' | '1' | '1.25' | '1.5'}
 */
export const setStoredReadSpeed = (speed) => {
  const normalized = String(speed)
  const valid = VALID_READ_SPEEDS.includes(normalized) ? normalized : '1'
  memoryReadSpeed = valid
  try {
    localStorage.setItem(READ_SPEED_KEY, valid)
    if (localStorage.getItem(READ_SPEED_KEY) === valid) {
      readSpeedWriteFailed = false
    } else {
      readSpeedWriteFailed = true
    }
  } catch {
    readSpeedWriteFailed = true
  }
  return valid
}

/**
 * Test whether browser storage is available and functioning for persistence.
 * Returns false if localStorage threw an exception or writing failed.
 * @returns {boolean}
 */
export const isStoragePersistenceAvailable = () => {
  if (
    themeWriteFailed ||
    textSizeWriteFailed ||
    readAloudWriteFailed ||
    readSpeedWriteFailed ||
    isMotionWriteFailed()
  ) {
    return false
  }
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }
  try {
    const testKey = '__cyber_storage_test__'
    localStorage.setItem(testKey, '1')
    const item = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)
    return item === '1'
  } catch {
    return false
  }
}

/**
 * Reset all accessibility preferences to defaults without modifying authentication storage.
 * Defaults: theme = 'light', textSize = 'standard', motion = 'system', readAloud = 'off', readSpeed = '1'.
 */
export const resetAccessibilityPreferences = () => {
  memoryTheme = 'light'
  memoryTextSize = 'standard'
  memoryReadAloud = 'off'
  memoryReadSpeed = '1'
  themeWriteFailed = false
  textSizeWriteFailed = false
  readAloudWriteFailed = false
  readSpeedWriteFailed = false
  resetMotionWriteFailed()

  try {
    localStorage.removeItem(THEME_KEY)
    localStorage.removeItem(TEXT_SIZE_KEY)
    localStorage.removeItem(READ_ALOUD_KEY)
    localStorage.removeItem(READ_SPEED_KEY)
    localStorage.removeItem('cyber_pref_hover_narration')
    localStorage.removeItem('cyber_pref_hover_delay')
  } catch {
    // ignore storage exceptions
  }

  setStoredTheme('light')
  setStoredTextSize('standard')
  setStoredMotionPreference('system')
  setStoredReadAloud('off')
  setStoredReadSpeed('1')

  return {
    theme: 'light',
    textSize: 'standard',
    motion: 'system',
    readAloud: 'off',
    readSpeed: '1',
  }
}

/**
 * Initialize all accessibility preferences on application boot.
 * Applies theme, text size, and motion synchronously to document.documentElement.
 */
export const initAccessibilityPreferences = () => {
  const theme = getStoredTheme()
  const textSize = getStoredTextSize()
  const motion = getStoredMotionPreference()
  const readAloud = getStoredReadAloud()
  const readSpeed = getStoredReadSpeed()

  memoryTheme = theme
  memoryTextSize = textSize
  memoryReadAloud = readAloud
  memoryReadSpeed = readSpeed

  applyTheme(theme)
  applyTextSize(textSize)
  applyMotionPreference(motion)
  activeReadAloud.value = readAloud

  return {
    theme,
    textSize,
    motion,
    readAloud,
    readSpeed,
  }
}
