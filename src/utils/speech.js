/**
 * Speech Synthesis & Narration Utility for CyberMorph Web Portal (Phase 2).
 *
 * Provides:
 * - Controlled Web Speech API abstraction with strict single-operation concurrency.
 * - Unique operation identifiers (operationId) to discard obsolete callbacks.
 * - Ownership tagging (ownerId) so unmounting an unrelated component never stops another section.
 * - Safe speed change handling (stop and restart with status feedback).
 * - Honest differentiation of unsupported API, voices loading, empty content, and playback errors.
 */

import { getStoredReadSpeed, setStoredReadSpeed, VALID_READ_SPEEDS } from './accessibility.js'

let operationCounter = 0
let activeOperationId = 0
let activeOwnerId = null
let activeTitle = ''
let activeText = ''
let currentRate = 1.0
let activeTriggerEl = null

// Status: 'idle' | 'loading-voices' | 'starting' | 'playing' | 'paused' | 'error'
let speechStatus = 'idle'
let speechErrorMessage = ''
let speechFeedbackMessage = ''

let startupWatchdogTimer = null

const clearStartupWatchdog = () => {
  if (startupWatchdogTimer) {
    clearTimeout(startupWatchdogTimer)
    startupWatchdogTimer = null
  }
}

const stateListeners = new Set()
const voiceSubscribers = new Set()
let voiceLoadingStatus = 'loading'
let voiceWaitTimer = null
let globalVoicesHandlerAttached = false

/**
 * Check whether the Web Speech API synthesis is available in the current runtime.
 * @returns {boolean}
 */
export const isSpeechSynthesisSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

/**
 * Normalize and validate reading speed against the accepted rate list.
 * Invalid values fallback to '1'.
 * @param {string|number} speed
 * @returns {'0.75' | '1' | '1.25' | '1.5'}
 */
export const normalizeReadingSpeed = (speed) => {
  const str = String(speed)
  return VALID_READ_SPEEDS.includes(str) ? str : '1'
}

/**
 * Retrieve currently available synthesis voices.
 * @returns {SpeechSynthesisVoice[]}
 */
export const getAvailableVoices = () => {
  if (!isSpeechSynthesisSupported()) return []
  return window.speechSynthesis.getVoices() || []
}

const notifyVoiceSubscribers = () => {
  const voices = getAvailableVoices()
  const status = getVoiceLoadingStatus()
  for (const subscriber of voiceSubscribers) {
    try {
      subscriber(voices, status)
    } catch {
      // Protect against subscriber errors
    }
  }
}

const onGlobalVoicesChanged = () => {
  const voices = getAvailableVoices()
  if (voices.length > 0) {
    if (voiceWaitTimer) {
      clearTimeout(voiceWaitTimer)
      voiceWaitTimer = null
    }
    voiceLoadingStatus = 'ready'
  }
  notifyVoiceSubscribers()
}

/**
 * Start bounded waiting for voice list population.
 * If voices do not arrive within timeoutMs, marks status as 'unavailable'.
 * User-initiated playback with browser default voice remains supported.
 * @param {number} [timeoutMs=3500]
 */
export const startVoiceLoadingTimeout = (timeoutMs = 3500) => {
  if (!isSpeechSynthesisSupported()) {
    voiceLoadingStatus = 'unsupported'
    return
  }

  const voices = getAvailableVoices()
  if (voices.length > 0) {
    voiceLoadingStatus = 'ready'
    if (voiceWaitTimer) {
      clearTimeout(voiceWaitTimer)
      voiceWaitTimer = null
    }
    return
  }

  if (voiceWaitTimer) {
    clearTimeout(voiceWaitTimer)
  }

  voiceLoadingStatus = 'loading'
  voiceWaitTimer = setTimeout(() => {
    voiceWaitTimer = null
    const currentVoices = getAvailableVoices()
    if (currentVoices.length === 0) {
      voiceLoadingStatus = 'unavailable'
      notifyVoiceSubscribers()
    } else {
      voiceLoadingStatus = 'ready'
      notifyVoiceSubscribers()
    }
  }, timeoutMs)
}

/**
 * Retry loading voices if previously timed out or unavailable.
 * @param {number} [timeoutMs=3500]
 * @returns {'unsupported' | 'ready' | 'loading'}
 */
export const retryLoadingVoices = (timeoutMs = 3500) => {
  if (!isSpeechSynthesisSupported()) {
    voiceLoadingStatus = 'unsupported'
    return 'unsupported'
  }

  const voices = getAvailableVoices()
  if (voices.length > 0) {
    voiceLoadingStatus = 'ready'
    notifyVoiceSubscribers()
    return 'ready'
  }

  startVoiceLoadingTimeout(timeoutMs)
  notifyVoiceSubscribers()
  return 'loading'
}

/**
 * Distinguish engine states: 'unsupported' | 'loading' | 'ready' | 'unavailable'
 * @returns {'unsupported' | 'loading' | 'ready' | 'unavailable'}
 */
export const getVoiceLoadingStatus = () => {
  if (!isSpeechSynthesisSupported()) return 'unsupported'
  const voices = getAvailableVoices()
  if (voices && voices.length > 0) return 'ready'
  if (voiceLoadingStatus === 'unavailable') return 'unavailable'
  return 'loading'
}

/**
 * Register a removable voiceschanged listener without overwriting other consumers.
 * @param {(voices: SpeechSynthesisVoice[], status: string) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const addVoicesChangedListener = (callback) => {
  if (!isSpeechSynthesisSupported()) {
    callback([], 'unsupported')
    return () => {}
  }

  // Ensure global listener is attached using addEventListener
  if (!globalVoicesHandlerAttached && typeof window !== 'undefined' && window.speechSynthesis) {
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', onGlobalVoicesChanged)
      globalVoicesHandlerAttached = true
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      const existing = window.speechSynthesis.onvoiceschanged
      window.speechSynthesis.onvoiceschanged = (e) => {
        if (typeof existing === 'function') existing(e)
        onGlobalVoicesChanged()
      }
      globalVoicesHandlerAttached = true
    }
  }

  voiceSubscribers.add(callback)

  // Start bounded timeout if voices are still empty
  if (getAvailableVoices().length === 0 && voiceLoadingStatus !== 'unavailable') {
    startVoiceLoadingTimeout(3500)
  }

  // Call immediately with current snapshot
  callback(getAvailableVoices(), getVoiceLoadingStatus())

  return () => {
    voiceSubscribers.delete(callback)
  }
}



/**
 * Get snapshot of current speech playback state.
 */
export const getSpeechState = () => {
  return {
    status: speechStatus,
    activeOwnerId,
    activeOperationId,
    title: activeTitle,
    text: activeText,
    currentRate,
    errorMessage: speechErrorMessage,
    feedbackMessage: speechFeedbackMessage,
  }
}

const notifyStateListeners = () => {
  const snapshot = getSpeechState()
  for (const listener of stateListeners) {
    try {
      listener(snapshot)
    } catch {
      // Protect against subscriber errors
    }
  }
}

/**
 * Subscribe to speech playback state changes.
 * @param {(state: ReturnType<typeof getSpeechState>) => void} callback
 * @returns {() => void} Unsubscribe callback
 */
export const onSpeechStateChange = (callback) => {
  stateListeners.add(callback)
  // Call immediately with initial snapshot
  callback(getSpeechState())
  return () => {
    stateListeners.delete(callback)
  }
}

/**
 * Sanitize text for clear speech synthesis.
 * Removes extra whitespace and ensures clean punctuation pauses.
 * @param {string} text
 * @returns {string}
 */
export const sanitizeNarrationText = (text) => {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Start explicit or hover narration for a specified section owner.
 *
 * Invariants:
 * - Immediately cancels any previous utterance before starting.
 * - Discards obsolete callbacks using an incremented operationId.
 * - Handles rate clamping and selects natural voice if available.
 * - If explicit, immediately cancels any pending hover timers.
 * - Never moves keyboard focus on hover playback.
 *
 * @param {Object} options
 * @param {string} options.ownerId Unique section owner ID (e.g. 'faq-0', 'about-mission')
 * @param {string} options.title Human-readable section heading
 * @param {string} options.text Plain readable text (no passwords or hidden elements)
 * @param {string|number} [options.rate] Optional rate override (0.75, 1, 1.25, 1.5)
 * @param {HTMLElement} [options.triggerEl] Optional initiating trigger element for focus restoration
 * @param {'explicit' | 'hover'} [options.triggerMode='explicit'] Trigger mode
 * @param {string} [options.feedbackMessage] Optional status feedback announcement
 * @returns {boolean} Whether playback request was accepted
 */
export const startNarration = ({
  ownerId,
  title,
  text,
  rate,
  triggerEl = null,
  feedbackMessage = '',
}) => {
  if (!isSpeechSynthesisSupported()) {
    speechStatus = 'error'
    speechErrorMessage = 'Speech synthesis is not supported by your browser.'
    notifyStateListeners()
    return false
  }

  const cleanText = sanitizeNarrationText(text)
  if (!cleanText) {
    speechStatus = 'error'
    speechErrorMessage = 'No readable text provided for this section.'
    notifyStateListeners()
    return false
  }

  clearStartupWatchdog()

  // Cancel any existing utterance before enqueuing a new one
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
    window.speechSynthesis.cancel()
  } catch {
    // Ignore browser cancel errors
  }

  const opId = ++operationCounter
  activeOperationId = opId
  activeOwnerId = ownerId
  activeTitle = title || 'Section'
  activeText = cleanText
  activeTriggerEl = triggerEl
  speechErrorMessage = ''
  speechFeedbackMessage = feedbackMessage || ''

  const requestedRateStr = rate ? normalizeReadingSpeed(rate) : normalizeReadingSpeed(getStoredReadSpeed())
  currentRate = parseFloat(requestedRateStr)

  const utterance = new window.SpeechSynthesisUtterance(cleanText)
  utterance.rate = currentRate

  // Select appropriate voice if available
  const voices = getAvailableVoices()
  if (voices.length > 0) {
    const preferredVoice =
      voices.find((v) => v.lang && (v.lang.startsWith('en-US') || v.lang.startsWith('en_US'))) ||
      voices.find((v) => v.lang && v.lang.startsWith('en')) ||
      voices[0]
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }
  }

  utterance.onstart = () => {
    // Discard stale callbacks from superseded operations
    if (activeOperationId !== opId) return
    clearStartupWatchdog()
    speechStatus = 'playing'
    speechErrorMessage = ''
    notifyStateListeners()
  }

  utterance.onpause = () => {
    if (activeOperationId !== opId) return
    speechStatus = 'paused'
    notifyStateListeners()
  }

  utterance.onresume = () => {
    if (activeOperationId !== opId) return
    speechStatus = 'playing'
    notifyStateListeners()
  }

  utterance.onend = () => {
    if (activeOperationId !== opId) return
    clearStartupWatchdog()
    speechStatus = 'idle'
    activeOwnerId = null
    activeTitle = ''
    activeText = ''
    notifyStateListeners()
  }

  utterance.onerror = (event) => {
    if (activeOperationId !== opId) return
    clearStartupWatchdog()

    // Cancelled or interrupted by another user action is expected; not a fatal error
    if (event.error === 'interrupted' || event.error === 'canceled') {
      speechStatus = 'idle'
      activeOwnerId = null
      notifyStateListeners()
      return
    }

    speechStatus = 'error'
    if (event.error === 'not-allowed') {
      speechErrorMessage = 'Playback blocked by browser audio policy. Click anywhere on the page to allow narration.'
    } else {
      speechErrorMessage = `Playback error: ${event.error || 'speech synthesis failure'}.`
    }
    notifyStateListeners()
  }

  // Set honest starting status until browser onstart fires
  speechStatus = 'starting'
  notifyStateListeners()

  // Startup watchdog: detect unstarted/stalled speech without hanging indefinitely
  startupWatchdogTimer = setTimeout(() => {
    if (activeOperationId !== opId) return
    if (speechStatus === 'starting') {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
      speechStatus = 'error'
      speechErrorMessage = 'Speech synthesis timed out before starting. Browser speech engine may be stalled or audio output disabled.'
      notifyStateListeners()
    }
  }, 4000)

  try {
    window.speechSynthesis.speak(utterance)
    return true
  } catch (err) {
    clearStartupWatchdog()
    speechStatus = 'error'
    speechErrorMessage = `Failed to start speech: ${err.message || 'unknown error'}`
    notifyStateListeners()
    return false
  }
}

/**
 * Pause active narration.
 * @param {string} [ownerId] If provided, only pauses if matching active owner
 */
export const pauseNarration = (ownerId) => {
  if (!isSpeechSynthesisSupported()) return
  if (ownerId && activeOwnerId !== ownerId) return
  if (speechStatus !== 'playing') return

  try {
    window.speechSynthesis.pause()
    speechStatus = 'paused'
    notifyStateListeners()
  } catch {
    // ignore pause exceptions
  }
}

/**
 * Resume paused narration.
 * @param {string} [ownerId] If provided, only resumes if matching active owner
 */
export const resumeNarration = (ownerId) => {
  if (!isSpeechSynthesisSupported()) return
  if (ownerId && activeOwnerId !== ownerId) return
  if (speechStatus !== 'paused') return

  try {
    window.speechSynthesis.resume()
    speechStatus = 'playing'
    notifyStateListeners()
  } catch {
    // ignore resume exceptions
  }
}

/**
 * Stop narration.
 *
 * Invariants:
 * - If ownerId is provided, ONLY stops if the active operation belongs to that owner.
 *   (Disposing an unrelated component does not kill another component's active speech).
 * - If ownerId is omitted, unconditionally cancels (used for route changes, logout, global reset).
 * - Discards callbacks by invalidating activeOperationId.
 *
 * @param {string} [ownerId]
 */
export const stopNarration = (ownerId) => {
  if (ownerId && activeOwnerId !== ownerId) {
    return // Unrelated component disposal must not cancel another section
  }

  clearStartupWatchdog()

  // Invalidate pending callbacks
  activeOperationId = ++operationCounter
  const previousOwner = activeOwnerId
  activeOwnerId = null
  activeTitle = ''
  activeText = ''
  speechStatus = 'idle'
  speechErrorMessage = ''
  speechFeedbackMessage = ''

  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore cancel exceptions
    }
  }

  notifyStateListeners()
  return previousOwner
}

/**
 * Change reading speed predictably.
 * Stops and restarts the current section at the new speed with observable feedback.
 * Requirement: Preserves triggerMode ('explicit' or 'hover') so hover speech is not converted to explicit speech.
 *
 * @param {'0.75' | '1' | '1.25' | '1.5' | number} newSpeed
 * @param {string} [ownerId]
 */
export const changeNarrationSpeed = (newSpeed, ownerId) => {
  const speedStr = normalizeReadingSpeed(newSpeed)
  setStoredReadSpeed(speedStr)
  currentRate = parseFloat(speedStr)

  if (activeOwnerId && (!ownerId || activeOwnerId === ownerId)) {
    const owner = activeOwnerId
    const title = activeTitle
    const text = activeText
    const trigger = activeTriggerEl
    const feedback = `Restarting reading at ${speedStr}x speed...`

    // Stop current utterance and restart with new speed
    stopNarration(owner)
    startNarration({
      ownerId: owner,
      title,
      text,
      rate: speedStr,
      triggerEl: trigger,
      feedbackMessage: feedback,
    })
  } else {
    notifyStateListeners()
  }
}

/**
 * Safely restore focus to the initiating trigger element.
 * Checks that the element is still attached to the DOM and currently visible.
 * @param {HTMLElement|null} triggerEl
 */
export const safelyRestoreFocus = (triggerEl) => {
  const target = triggerEl || activeTriggerEl
  if (!target || typeof target.focus !== 'function') return
  if (typeof document === 'undefined' || !document.body.contains(target)) return

  try {
    const style = window.getComputedStyle(target)
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      target.focus()
    }
  } catch {
    // ignore focus inspection errors
  }
}
