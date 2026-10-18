/**
 * Motion preference utility for CyberMorph Web Portal.
 * Manages reduced-motion accessibility preference, stored per browser in localStorage.
 * Keeps preference separate from authentication tokens and survives auth state changes.
 */

const PREFERENCE_KEY = 'cyber_pref_reduced_motion'

// Fallback in-memory state if localStorage is blocked (e.g. security sandbox, private mode)
let memoryPreference = 'system'
let motionWriteFailed = false

export const isMotionWriteFailed = () => motionWriteFailed

export const resetMotionWriteFailed = () => {
  motionWriteFailed = false
}

// Motion change listener subscribers
const motionListeners = new Set()
let systemMotionMediaQuery = null
let systemMotionListener = null

/**
 * Retrieve the current motion preference from localStorage, falling back to memory.
 * When writes fail in this browser session, returns the active in-memory choice.
 * Invalid or corrupted stored values safely default to 'system'.
 * @returns {'system' | 'reduced'}
 */
export const getStoredMotionPreference = () => {
  if (motionWriteFailed) {
    return memoryPreference
  }
  try {
    const stored = localStorage.getItem(PREFERENCE_KEY)
    if (stored === 'reduced' || stored === 'system') {
      return stored
    }
    return 'system'
  } catch {
    return memoryPreference
  }
}

/**
 * Check if reduced motion is actively in effect (either explicit override or OS setting).
 * @returns {boolean}
 */
export const isReducedMotionActive = () => {
  if (typeof document !== 'undefined' && document.documentElement) {
    if (document.documentElement.getAttribute('data-reduced-motion') === 'true') {
      return true
    }
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return false
}

const notifyMotionListeners = () => {
  const active = isReducedMotionActive()
  for (const listener of motionListeners) {
    try {
      listener(active)
    } catch {
      // Protect against rogue subscriber exceptions
    }
  }
}

/**
 * Apply the motion preference to the DOM.
 * When 'reduced', sets data-reduced-motion="true" on <html> (root).
 * When 'system', removes the attribute so standard CSS @media (prefers-reduced-motion: reduce) handles it natively.
 * @param {'system' | 'reduced'} pref
 */
export const applyMotionPreference = (pref) => {
  const validPref = pref === 'reduced' ? 'reduced' : 'system'
  if (typeof document !== 'undefined' && document.documentElement) {
    if (validPref === 'reduced') {
      document.documentElement.setAttribute('data-reduced-motion', 'true')
    } else {
      document.documentElement.removeAttribute('data-reduced-motion')
    }
  }
}

/**
 * Save and apply the motion preference.
 * Handles storage exceptions gracefully without crashing.
 * When writes fail, preserves the active choice in memory for this session.
 * @param {'system' | 'reduced'} pref
 * @returns {'system' | 'reduced'}
 */
export const setStoredMotionPreference = (pref) => {
  const validPref = pref === 'reduced' ? 'reduced' : 'system'
  memoryPreference = validPref
  try {
    localStorage.setItem(PREFERENCE_KEY, validPref)
    if (localStorage.getItem(PREFERENCE_KEY) === validPref) {
      motionWriteFailed = false
    } else {
      motionWriteFailed = true
    }
  } catch {
    motionWriteFailed = true
  }
  applyMotionPreference(validPref)
  notifyMotionListeners()
  return validPref
}

/**
 * Subscribe to motion state changes (explicit user choice or OS system setting).
 * @param {(reducedActive: boolean) => void} callback
 * @returns {() => void} Unsubscribe callback
 */
export const onMotionChange = (callback) => {
  motionListeners.add(callback)
  if (typeof window !== 'undefined' && window.matchMedia && !systemMotionListener) {
    systemMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    systemMotionListener = () => notifyMotionListeners()
    if (typeof systemMotionMediaQuery.addEventListener === 'function') {
      systemMotionMediaQuery.addEventListener('change', systemMotionListener)
    } else if (typeof systemMotionMediaQuery.addListener === 'function') {
      systemMotionMediaQuery.addListener(systemMotionListener)
    }
  }
  return () => {
    motionListeners.delete(callback)
  }
}

/**
 * Initialize motion preference on application mount.
 * Called synchronously in main.js to prevent animation flash.
 * @returns {'system' | 'reduced'}
 */
export const initMotionPreference = () => {
  const pref = getStoredMotionPreference()
  memoryPreference = pref
  applyMotionPreference(pref)
  return pref
}
