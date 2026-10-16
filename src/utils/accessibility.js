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

import {
  getStoredMotionPreference,
  setStoredMotionPreference,
  applyMotionPreference,
  initMotionPreference,
  isReducedMotionActive,
  onMotionChange,
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

// In-memory fallbacks if localStorage is unavailable
let memoryTheme = 'system'
let memoryTextSize = 'standard'

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
 * Invalid or corrupted stored values default to 'system'.
 * @returns {'system' | 'light' | 'dark'}
 */
export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return 'system'
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
 * @param {'system' | 'light' | 'dark'} theme
 * @returns {'system' | 'light' | 'dark'}
 */
export const setStoredTheme = (theme) => {
  const validTheme = theme === 'light' || theme === 'dark' ? theme : 'system'
  memoryTheme = validTheme
  try {
    localStorage.setItem(THEME_KEY, validTheme)
  } catch {
    // localStorage unavailable, keep in memory
  }
  applyTheme(validTheme)
  return validTheme
}

/**
 * Retrieve text sizing preference from localStorage, falling back to memory.
 * Invalid or corrupted stored values default to 'standard'.
 * @returns {'standard' | 'large' | 'extra-large'}
 */
export const getStoredTextSize = () => {
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
 * @param {'standard' | 'large' | 'extra-large'} size
 * @returns {'standard' | 'large' | 'extra-large'}
 */
export const setStoredTextSize = (size) => {
  const validSize = size === 'large' || size === 'extra-large' ? size : 'standard'
  memoryTextSize = validSize
  try {
    localStorage.setItem(TEXT_SIZE_KEY, validSize)
  } catch {
    // localStorage unavailable, keep in memory
  }
  applyTextSize(validSize)
  return validSize
}

/**
 * Reset all accessibility preferences to defaults without modifying authentication storage.
 * Defaults: theme = 'system', textSize = 'standard', motion = 'system'.
 */
export const resetAccessibilityPreferences = () => {
  memoryTheme = 'system'
  memoryTextSize = 'standard'

  try {
    localStorage.removeItem(THEME_KEY)
    localStorage.removeItem(TEXT_SIZE_KEY)
  } catch {
    // ignore storage exceptions
  }

  setStoredTheme('system')
  setStoredTextSize('standard')
  setStoredMotionPreference('system')

  return {
    theme: 'system',
    textSize: 'standard',
    motion: 'system',
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

  applyTheme(theme)
  applyTextSize(textSize)
  applyMotionPreference(motion)

  return {
    theme,
    textSize,
    motion,
  }
}
