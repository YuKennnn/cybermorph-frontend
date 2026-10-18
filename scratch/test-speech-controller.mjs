import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import assert from 'assert'
import process from 'process'

// ============================================================================
// SUITE 1: Controller Unit Tests & State Machine Invariants
// ============================================================================

async function runUnitTests() {
  console.log('=== Suite 1: Controller Unit Tests & State Machine Invariants ===')

  let utteranceCount = 0
  let lastUtterance = null
  let isSpeaking = false
  let isPaused = false

  class MockSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text
      this.rate = 1.0
      this.voice = null
      this.onstart = null
      this.onend = null
      this.onerror = null
      this.onpause = null
      this.onresume = null
      this.id = ++utteranceCount
      lastUtterance = this
    }
  }

  const mockVoices = [
    { name: 'Alex', lang: 'en-US', default: true },
    { name: 'Victoria', lang: 'en-GB', default: false },
  ]

  let currentVoices = []
  const registeredListeners = new Set()

  let suppressMockAutoStart = false
  const mockSpeechSynthesis = {
    speaking: false,
    pending: false,
    cancel() {
      isSpeaking = false
      isPaused = false
      this.speaking = false
      this.pending = false
    },
    speak(utterance) {
      isSpeaking = true
      isPaused = false
      this.speaking = true
      this.pending = false
      if (!suppressMockAutoStart && utterance && typeof utterance.onstart === 'function') {
        utterance.onstart()
      }
    },
    pause() {
      if (isSpeaking) isPaused = true
    },
    resume() {
      if (isSpeaking && isPaused) isPaused = false
    },
    getVoices() {
      return currentVoices
    },
    addEventListener(event, listener) {
      if (event === 'voiceschanged') {
        registeredListeners.add(listener)
      }
    },
    removeEventListener(event, listener) {
      if (event === 'voiceschanged') {
        registeredListeners.delete(listener)
      }
    },
  }

  // Attach global mocks
  globalThis.window = {
    speechSynthesis: mockSpeechSynthesis,
    SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  }

  const storageMap = new Map()
  globalThis.localStorage = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  }

  const {
    getStoredTheme,
    setStoredTheme,
    getStoredReadAloud,
    setStoredReadAloud,
    getStoredReadSpeed,
    setStoredReadSpeed,
    getStoredTextSize,
    getStoredMotionPreference,
    VALID_READ_SPEEDS,
    resetAccessibilityPreferences,
    isStoragePersistenceAvailable,
  } = await import('../src/utils/accessibility.js')

  const {
    isSpeechSynthesisSupported,
    getVoiceLoadingStatus,
    startVoiceLoadingTimeout,
    retryLoadingVoices,
    addVoicesChangedListener,
    normalizeReadingSpeed,
    getSpeechState,
    startNarration,
    stopNarration,
    pauseNarration,
    resumeNarration,
    changeNarrationSpeed,
    safelyRestoreFocus,
  } = await import('../src/utils/speech.js')

  const {
    isA11yModalOpen,
    a11yModalTriggerRef,
    openA11yModal,
    closeA11yModal,
  } = await import('../src/utils/accessibilityModal.js')

  // 1. Web Speech API detection
  console.log('1. Testing Web Speech API detection:')
  assert.strictEqual(isSpeechSynthesisSupported(), true, 'Speech synthesis must be supported')

  // 2. Light Default Theme and Theme Preferences
  console.log('2. Testing Theme defaults and preference handling:')
  storageMap.clear()
  assert.strictEqual(getStoredTheme(), 'light', 'Default theme must be light when no preference is saved')

  storageMap.set('cyber_pref_theme', 'invalid_theme')
  assert.strictEqual(getStoredTheme(), 'light', 'Invalid saved theme must fall back to light')

  setStoredTheme('dark')
  assert.strictEqual(getStoredTheme(), 'dark', 'Explicit dark theme must be preserved')
  setStoredTheme('system')
  assert.strictEqual(getStoredTheme(), 'system', 'Explicit system theme must be preserved')
  setStoredTheme('light')
  assert.strictEqual(getStoredTheme(), 'light', 'Explicit light theme must be preserved')

  // 3. Preferences Storage & Reading Speed Validation & Normalization
  console.log('3. Testing Reading Speed validation and preference storage:')
  storageMap.clear()
  assert.strictEqual(getStoredReadAloud(), 'off', 'Read aloud must default to off')
  setStoredReadAloud('on')
  assert.strictEqual(getStoredReadAloud(), 'on', 'Read aloud stored should be on')
  setStoredReadSpeed('1.25')
  assert.strictEqual(getStoredReadSpeed(), '1.25', 'Read speed stored should be 1.25')

  assert.deepStrictEqual(VALID_READ_SPEEDS, ['0.75', '1', '1.25', '1.5'])
  assert.strictEqual(normalizeReadingSpeed('0.75'), '0.75')
  assert.strictEqual(normalizeReadingSpeed('1'), '1')
  assert.strictEqual(normalizeReadingSpeed('1.25'), '1.25')
  assert.strictEqual(normalizeReadingSpeed('1.5'), '1.5')
  // Invalid speeds must normalize to '1'
  assert.strictEqual(normalizeReadingSpeed('2.5'), '1', 'Invalid high speed must normalize to 1')
  assert.strictEqual(normalizeReadingSpeed('fast'), '1', 'Non-numeric speed must normalize to 1')
  assert.strictEqual(normalizeReadingSpeed(NaN), '1', 'NaN speed must normalize to 1')
  assert.strictEqual(normalizeReadingSpeed(-1), '1', 'Negative speed must normalize to 1')
  assert.strictEqual(normalizeReadingSpeed(null), '1', 'Null speed must normalize to 1')

  // 4. Voice Loading Bounded Recovery & Retry Feedback
  console.log('4. Testing Voice Loading recovery and bounded timeout:')
  currentVoices = []
  assert.strictEqual(getVoiceLoadingStatus(), 'loading', 'Initial status with 0 voices must be loading')

  startVoiceLoadingTimeout(50)
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.strictEqual(getVoiceLoadingStatus(), 'unavailable', 'Status after timeout with 0 voices must be unavailable')

  const retryStatus = retryLoadingVoices(50)
  assert.strictEqual(retryStatus, 'loading', 'Retrying with 0 voices must return loading')
  assert.strictEqual(getVoiceLoadingStatus(), 'loading')

  currentVoices = mockVoices
  for (const listener of registeredListeners) {
    listener()
  }
  assert.strictEqual(getVoiceLoadingStatus(), 'ready', 'Status must transition to ready when voices populate')

  // 5. Removable voiceschanged listener cleanup
  console.log('5. Testing Removable voiceschanged listener registration and cleanup:')
  let listenerCalledCount = 0
  const removeListener = addVoicesChangedListener(() => {
    listenerCalledCount++
  })
  assert.ok(listenerCalledCount >= 1, 'Listener should be called immediately on registration')

  const initialCount = listenerCalledCount
  for (const listener of registeredListeners) {
    listener()
  }
  assert.strictEqual(listenerCalledCount, initialCount + 1, 'Active listener should receive voiceschanged')

  removeListener()
  const countAfterRemoval = listenerCalledCount
  for (const listener of registeredListeners) {
    listener()
  }
  assert.strictEqual(listenerCalledCount, countAfterRemoval, 'Removed listener must not receive further events')

  // 6. Starting a different section while paused
  console.log('6. Testing starting a different section while paused:')
  startNarration({
    ownerId: 'section-alpha',
    title: 'Section Alpha',
    text: 'Alpha content.',
    rate: '1',
  })
  assert.strictEqual(getSpeechState().activeOwnerId, 'section-alpha')
  assert.strictEqual(getSpeechState().status, 'playing')

  pauseNarration('section-alpha')
  assert.strictEqual(getSpeechState().status, 'paused', 'Section Alpha must be paused')

  // Now user clicks read on Section Beta
  startNarration({
    ownerId: 'section-beta',
    title: 'Section Beta',
    text: 'Beta content.',
    rate: '1.25',
  })
  assert.strictEqual(getSpeechState().activeOwnerId, 'section-beta', 'Active owner must switch to Section Beta')
  assert.strictEqual(getSpeechState().status, 'playing', 'Status must transition from paused to playing')
  assert.strictEqual(getSpeechState().currentRate, 1.25, 'Rate must reflect Section Beta rate')

  // Test Pause and Resume
  pauseNarration('section-beta')
  assert.strictEqual(getSpeechState().status, 'paused', 'Must pause')
  resumeNarration('section-beta')
  assert.strictEqual(getSpeechState().status, 'playing', 'Must resume')

  // Test speed change with invalid rate normalization
  changeNarrationSpeed('invalid-rate', 'section-beta')
  assert.strictEqual(getSpeechState().currentRate, 1.0, 'Invalid speed must be normalized to 1.0')

  // 7. Rapid Section Replacement & Stale Callback Discard
  console.log('7. Testing rapid section replacement and stale callback discard:')
  startNarration({ ownerId: 'rapid-1', title: 'R1', text: 'Text 1' })
  const op1 = getSpeechState().activeOperationId
  const utt1 = lastUtterance

  startNarration({ ownerId: 'rapid-2', title: 'R2', text: 'Text 2' })
  const op2 = getSpeechState().activeOperationId
  const utt2 = lastUtterance

  startNarration({ ownerId: 'rapid-3', title: 'R3', text: 'Text 3' })
  const op3 = getSpeechState().activeOperationId
  const utt3 = lastUtterance

  assert.ok(op3 > op2 && op2 > op1, 'Operation IDs must strictly increase')
  assert.strictEqual(getSpeechState().activeOwnerId, 'rapid-3')

  // Fire delayed callbacks for R1 and R2
  utt1.onstart?.()
  assert.strictEqual(getSpeechState().activeOwnerId, 'rapid-3', 'Late onstart for R1 must be ignored')
  utt2.onerror?.({ error: 'interrupted' })
  assert.strictEqual(getSpeechState().activeOwnerId, 'rapid-3', 'Late onerror for R2 must be ignored')
  utt1.onend?.()
  assert.strictEqual(getSpeechState().activeOwnerId, 'rapid-3', 'Late onend for R1 must be ignored')

  // Active R3 onstart works
  utt3.onstart?.()
  assert.strictEqual(getSpeechState().status, 'playing')

  // 8. Playback Failure Handling
  console.log('8. Testing Playback failure reporting:')
  utt3.onerror?.({ error: 'audio-busy' })
  assert.strictEqual(getSpeechState().status, 'error', 'Fatal error must set status to error')
  assert.ok(getSpeechState().errorMessage.includes('audio-busy'), 'Error message must specify cause')

  // 9. Late callbacks after stopping
  console.log('9. Testing late callbacks after stopNarration():')
  startNarration({ ownerId: 'stop-test', title: 'Stop Test', text: 'Stop text' })
  const stopUtt = lastUtterance
  stopNarration('stop-test')
  assert.strictEqual(getSpeechState().status, 'idle', 'State must be idle after stop')
  assert.strictEqual(getSpeechState().activeOwnerId, null, 'Active owner must be null')

  stopUtt.onend?.()
  assert.strictEqual(getSpeechState().status, 'idle')
  assert.strictEqual(getSpeechState().activeOwnerId, null)

  // 9B. Focused Controller Assertion: Speech cancellation upon disabling read aloud
  console.log('9B. Testing focused controller speech cancellation when read aloud is turned off:')
  setStoredReadAloud('on')
  startNarration({
    ownerId: 'cancel-target',
    title: 'Cancel Target Section',
    text: 'Narration text to be cancelled.',
  })
  assert.strictEqual(getSpeechState().status, 'playing', 'Controller must be in playing state')
  assert.strictEqual(getSpeechState().activeOwnerId, 'cancel-target', 'Active owner must be cancel-target')
  assert.strictEqual(mockSpeechSynthesis.speaking, true, 'Mock speech synthesis must report speaking: true')

  // Calling stopNarration upon disabling read aloud cancels speech in controller and engine
  setStoredReadAloud('off')
  stopNarration()
  assert.strictEqual(getSpeechState().status, 'idle', 'Focused assertion: controller status must be idle on speech cancellation')
  assert.strictEqual(getSpeechState().activeOwnerId, null, 'Focused assertion: controller activeOwnerId must be null on speech cancellation')
  assert.strictEqual(mockSpeechSynthesis.speaking, false, 'Focused assertion: speech engine speaking must be false on speech cancellation')

  // 10. Focus restoration safety
  console.log('10. Testing Focus restoration safety:')
  let focusInvoked = false
  const validEl = { focus: () => { focusInvoked = true } }
  globalThis.document = { body: { contains: (el) => el === validEl } }

  safelyRestoreFocus(validEl)
  assert.strictEqual(focusInvoked, true, 'Visible element in DOM must be focused')

  focusInvoked = false
  const unmountedEl = { focus: () => { focusInvoked = true } }
  safelyRestoreFocus(unmountedEl)
  assert.strictEqual(focusInvoked, false, 'Unmounted element must never be focused')

  // 11. Reset Accessibility Preferences (resets to light default and purges hover keys)
  console.log('11. Testing resetAccessibilityPreferences resets to Light and purges hover keys:')
  setStoredTheme('dark')
  setStoredReadAloud('on')
  setStoredReadSpeed('1.5')
  storageMap.set('cyber_pref_hover_narration', 'on')
  storageMap.set('cyber_pref_hover_delay', '0.5')

  resetAccessibilityPreferences()
  assert.strictEqual(getStoredTheme(), 'light', 'Reset must select light theme')
  assert.strictEqual(getStoredTextSize(), 'standard', 'Reset must select standard text size')
  assert.strictEqual(getStoredMotionPreference(), 'system', 'Reset must select motion system')
  assert.strictEqual(getStoredReadAloud(), 'off', 'Reset must select read aloud off')
  assert.strictEqual(getStoredReadSpeed(), '1', 'Reset must select read speed 1')
  assert.strictEqual(storageMap.has('cyber_pref_hover_narration'), false, 'Stale hover narration key must be purged')
  assert.strictEqual(storageMap.has('cyber_pref_hover_delay'), false, 'Stale hover delay key must be purged')

  // 11B. Testing Conditional Storage Persistence Availability
  console.log('11B. Testing conditional storage persistence availability:')
  assert.strictEqual(isStoragePersistenceAvailable(), true, 'Persistence must be available when storage writes succeed')

  // 12. Accessibility Modal State Helper Invariants
  console.log('12. Testing Accessibility Modal open/close helpers:')
  assert.strictEqual(isA11yModalOpen.value, false, 'Modal should initially be closed')
  const dummyTrigger = { id: 'trigger-btn' }
  openA11yModal(dummyTrigger)
  assert.strictEqual(isA11yModalOpen.value, true, 'Modal should be open')
  assert.strictEqual(a11yModalTriggerRef.value, dummyTrigger, 'Trigger ref should be captured')
  closeA11yModal()
  assert.strictEqual(isA11yModalOpen.value, false, 'Modal should be closed after closeA11yModal')

  // 13. Honest Starting State, Watchdog Timeout, and Browser Audio Policy Handling
  console.log('13. Testing honest starting state, watchdog timeout, and audio policy handling:')
  suppressMockAutoStart = true

  startNarration({
    ownerId: 'test-starting',
    title: 'Starting Test',
    text: 'Starting text.',
  })
  assert.strictEqual(getSpeechState().status, 'starting', 'Initial speech state must be honest "starting", not premature "playing"')
  assert.strictEqual(getSpeechState().activeOwnerId, 'test-starting')

  lastUtterance?.onstart?.()
  assert.strictEqual(getSpeechState().status, 'playing', 'Status must transition to "playing" once browser onstart fires')

  stopNarration()
  startNarration({
    ownerId: 'test-not-allowed',
    title: 'Policy Test',
    text: 'Policy text.',
  })
  assert.strictEqual(getSpeechState().status, 'starting')
  lastUtterance?.onerror?.({ error: 'not-allowed' })
  assert.strictEqual(getSpeechState().status, 'error', 'Status must be error on not-allowed')
  assert.ok(
    getSpeechState().errorMessage.includes('browser audio policy') || getSpeechState().errorMessage.includes('Click anywhere on the page'),
    'Error message must provide actionable advice on browser audio policy'
  )

  suppressMockAutoStart = false
  stopNarration()

  console.log('✓ Suite 1 Unit Tests & Controller Invariants Passed!\n')
}

// ============================================================================
// SUITE 2: Router Navigation Failure & Cancelled Route Invariant Tests
// ============================================================================

async function runRouterNavigationTests() {
  console.log('=== Suite 2: Router Navigation Failure & Cancelled Route Invariant Tests ===')

  const { startNarration, stopNarration, getSpeechState } = await import('../src/utils/speech.js')

  const afterEachHook = (to, from, failure) => {
    if (!failure && to.path !== from.path) {
      stopNarration()
    }
  }

  // 1. Successful navigation to new path stops narration
  startNarration({ ownerId: 'nav-test-1', title: 'Nav 1', text: 'Text 1' })
  assert.strictEqual(getSpeechState().activeOwnerId, 'nav-test-1')
  afterEachHook({ path: '/about' }, { path: '/faq' }, undefined)
  assert.strictEqual(getSpeechState().activeOwnerId, null, 'Successful route change must stop narration')

  // 2. Navigation to same path does NOT stop narration
  startNarration({ ownerId: 'nav-test-2', title: 'Nav 2', text: 'Text 2' })
  assert.strictEqual(getSpeechState().activeOwnerId, 'nav-test-2')
  afterEachHook({ path: '/about', query: { tab: '2' } }, { path: '/about', query: {} }, undefined)
  assert.strictEqual(getSpeechState().activeOwnerId, 'nav-test-2', 'Same path query change must not stop narration')

  // 3. Cancelled/Aborted navigation does NOT stop narration
  const mockNavigationFailure = {
    type: 4,
    message: 'Navigation cancelled by guard',
  }
  afterEachHook({ path: '/dashboard' }, { path: '/about' }, mockNavigationFailure)
  assert.strictEqual(getSpeechState().activeOwnerId, 'nav-test-2', 'Cancelled navigation with failure must NOT stop narration')

  stopNarration()
  console.log('✓ Suite 2 Router Navigation Invariants Passed!\n')
}

// ============================================================================
// SUITE 3: Isolated Browser Integration Tests via Chrome CDP
// ============================================================================

const ISOLATED_VITE_PORT = 5188
const ISOLATED_CDP_PORT = 9238
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-isolated-speech-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) rej(new Error(msg.error.message))
        else res(msg.result)
      }
    }
    await this.send('Page.enable')
    await this.send('Runtime.enable')
    await this.send('DOM.enable')
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

async function runBrowserIntegrationTests() {
  console.log('=== Suite 3: Isolated Browser Integration Tests (Port ' + ISOLATED_VITE_PORT + ') ===')

  fs.mkdirSync(USER_DATA_DIR, { recursive: true })

  console.log(`Starting isolated Vite test server on port ${ISOLATED_VITE_PORT}...`)
  const viteProcess = spawn(
    'npx.cmd',
    ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'],
    {
      cwd: 'c:\\Cyber-Morph\\cybermorph-frontend',
      env: { ...process.env, VITE_USE_MOCK: 'true' },
      shell: true,
      stdio: 'pipe',
    }
  )

  // Poll for Vite dev server readiness
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch(`http://localhost:${ISOLATED_VITE_PORT}/`)
      if (res.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  console.log('Launching isolated Chrome with CDP on port', ISOLATED_CDP_PORT)
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
  ])

  let cdp = null
  try {
    // Poll for Chrome CDP endpoint readiness
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const pagesRes = await fetch(`http://127.0.0.1:${ISOLATED_CDP_PORT}/json/list`)
        const pages = await pagesRes.json()
        const targetPage = pages.find((p) => p.type === 'page') || pages[0]
        if (targetPage && targetPage.webSocketDebuggerUrl) {
          cdp = new ChromeCDP(targetPage.webSocketDebuggerUrl)
          await cdp.connect()
          break
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }
    if (!cdp) {
      throw new Error('Failed to connect to isolated Chrome CDP on port ' + ISOLATED_CDP_PORT)
    }

    // 1. Verify Light Theme default on clean session
    console.log('1. Verifying default Light theme on landing page with empty storage:')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const rootTheme = await cdp.eval(`document.documentElement.getAttribute('data-theme')`)
    console.log('Initial document data-theme:', rootTheme)
    assert.strictEqual(rootTheme, 'light', 'Root data-theme must be light by default')

    // 2. Verify Floating Accessibility Button on public landing page
    console.log('2. Verifying floating accessibility button on landing page:')
    let hasFloatingBtn = false
    for (let i = 0; i < 20; i++) {
      hasFloatingBtn = await cdp.eval(`!!document.querySelector('.a11y-floating-btn')`)
      if (hasFloatingBtn) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    assert.strictEqual(hasFloatingBtn, true, 'Floating accessibility button must be mounted on public pages')

    // 3. Open Public Accessibility Preferences Modal
    console.log('3. Opening accessibility modal from floating button:')
    await cdp.eval(`document.querySelector('.a11y-floating-btn')?.click()`)
    let isModalVisible = false
    for (let i = 0; i < 15; i++) {
      isModalVisible = await cdp.eval(`!!document.querySelector('.a11y-modal')`)
      if (isModalVisible) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.strictEqual(isModalVisible, true, 'Accessibility modal dialog must open')

    const modalRole = await cdp.eval(`document.querySelector('.a11y-modal')?.getAttribute('role')`)
    assert.strictEqual(modalRole, 'dialog', 'Modal must have role="dialog"')

    // 4. Test Theme change inside Modal (Dark)
    console.log('4. Changing theme to Dark inside public modal:')
    await cdp.eval(`document.querySelector('#m-theme-dark')?.click()`)
    let themeAfterDark = ''
    for (let i = 0; i < 15; i++) {
      themeAfterDark = await cdp.eval(`document.documentElement.getAttribute('data-theme')`)
      if (themeAfterDark === 'dark') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.strictEqual(themeAfterDark, 'dark', 'Theme must switch to dark')

    // 5. Test Resetting to defaults inside Modal returns to Light
    console.log('5. Clicking Reset in modal returns to Light:')
    await cdp.eval(`document.querySelector('.btn-reset-a11y')?.click()`)
    let themeAfterReset = ''
    for (let i = 0; i < 15; i++) {
      themeAfterReset = await cdp.eval(`document.documentElement.getAttribute('data-theme')`)
      if (themeAfterReset === 'light') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.strictEqual(themeAfterReset, 'light', 'Reset must return theme to light')

    // 6. Test Escape key dismissal and focus restoration
    console.log('6. Dismissing modal with Escape key and verifying focus restoration:')
    await cdp.eval(`
      document.querySelector('.a11y-modal')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
    `)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const isModalClosed = await cdp.eval(`!document.querySelector('.a11y-modal')`)
    assert.strictEqual(isModalClosed, true, 'Modal must close on Escape')

    const isFloatingBtnFocused = await cdp.eval(`document.activeElement?.classList?.contains('a11y-floating-btn')`)
    assert.strictEqual(isFloatingBtnFocused, true, 'Focus must be restored to floating accessibility button')

    // 7. Verify Public Footer link opens modal
    console.log('7. Verifying public footer link opens modal:')
    await cdp.eval(`document.querySelector('.footer-a11y-btn')?.click()`)
    let isModalOpenedFromFooter = false
    for (let i = 0; i < 20; i++) {
      isModalOpenedFromFooter = await cdp.eval(`!!document.querySelector('.a11y-modal')`)
      if (isModalOpenedFromFooter) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.strictEqual(isModalOpenedFromFooter, true, 'Footer link must open modal')

    // 8. Enable Read Aloud inside modal and verify reading speed pills
    console.log('8. Enabling Read Aloud and selecting 1.25x speed inside modal:')
    await cdp.eval(`document.querySelector('#m-narration-on')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await cdp.eval(`
      const btn = Array.from(document.querySelectorAll('.speed-btn')).find(b => b.textContent.includes('1.25x'));
      btn?.click();
    `)
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.strictEqual(await cdp.eval(`localStorage.getItem('cyber_pref_read_aloud')`), 'on')
    assert.strictEqual(await cdp.eval(`localStorage.getItem('cyber_pref_read_speed')`), '1.25')

    // Check that Done button exists in modal footer
    const hasDoneBtn = await cdp.eval(`!!document.querySelector('.btn-modal-done')`)
    assert.strictEqual(hasDoneBtn, true, 'Done button must exist in modal footer')

    // Close modal via Done button
    await cdp.eval(`document.querySelector('.btn-modal-done')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.strictEqual(await cdp.eval(`!document.querySelector('.a11y-modal')`), true, 'Modal must close on Done button click')

    // 9. Verify Section Reading Controls on Landing Page (Home)
    console.log('9. Verifying Section Reading Controls on Landing Page:')
    let landingReadingBtns = 0
    for (let i = 0; i < 20; i++) {
      landingReadingBtns = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
      if (landingReadingBtns >= 3) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    console.log('Landing page read buttons count:', landingReadingBtns)
    assert.ok(landingReadingBtns >= 3, 'Landing page must show manual section reading buttons')

    // Verify enabling Read Aloud does NOT start speech automatically
    const isSpeechActiveAuto = await cdp.eval(`!!document.querySelector('.inline-speech-player')`)
    assert.strictEqual(isSpeechActiveAuto, false, 'Enabling Read Aloud must NOT start speech automatically')

    // Trigger Hero reading on Landing
    console.log('9A. Triggering manual section reading on Landing:')
    await cdp.eval(`document.querySelector('.btn-read-section')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const landingPlayerActive = await cdp.eval(`!!document.querySelector('.inline-speech-player')`)
    assert.strictEqual(landingPlayerActive, true, 'Inline speech player must appear for landing hero')

    // 9B. Disabling Read aloud immediately hides all buttons and stops active speech without refresh
    console.log('9B. Disabling Read aloud immediately hides reading buttons and stops active speech without refresh:')
    await cdp.eval(`document.querySelector('.a11y-floating-btn')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Verify introductory persistence message when storage is available
    const modalLead = await cdp.eval(`document.querySelector('.modal-lead')?.textContent.trim()`)
    assert.ok(
      modalLead.includes('saved in this browser for future visits'),
      'Introductory persistence message must indicate future visits saving when storage is available'
    )

    await cdp.eval(`document.querySelector('#m-narration-off')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await cdp.eval(`document.querySelector('.btn-modal-done')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Assert buttons are hidden immediately without refresh
    const buttonsAfterDisabled = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    assert.strictEqual(buttonsAfterDisabled, 0, 'Disabling read aloud must immediately hide all read section buttons without refresh')

    // Verification Reporting 1: Hiding the player confirms UI state
    const speechActiveAfterDisabled = await cdp.eval(`!!document.querySelector('.inline-speech-player')`)
    assert.strictEqual(speechActiveAfterDisabled, false, 'Hiding the player confirms UI state: player element removed from DOM')

    // Verification Reporting 2: Focused controller & speech engine cancellation assertion
    const engineState = await cdp.eval(`({
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending
    })`)
    assert.strictEqual(engineState.speaking, false, 'Focused assertion: speechSynthesis.speaking must be false upon speech cancellation')
    assert.strictEqual(engineState.pending, false, 'Focused assertion: speechSynthesis.pending must be false upon speech cancellation')

    // 9C. Re-enabling Read aloud restores buttons without starting speech
    console.log('9C. Re-enabling Read aloud shows buttons immediately without starting speech:')
    await cdp.eval(`document.querySelector('.a11y-floating-btn')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await cdp.eval(`document.querySelector('#m-narration-on')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await cdp.eval(`document.querySelector('.btn-modal-done')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    const buttonsAfterReenabled = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    assert.ok(buttonsAfterReenabled >= 3, 'Re-enabling read aloud must show section reading buttons immediately')

    const speechActiveAfterReenabled = await cdp.eval(`!!document.querySelector('.inline-speech-player')`)
    assert.strictEqual(speechActiveAfterReenabled, false, 'Re-enabling read aloud must NOT start speech automatically')

    // 9D. Reset to defaults in modal turns narration off and hides buttons
    console.log('9D. Reset in modal turns narration off and hides reading buttons immediately:')
    await cdp.eval(`document.querySelector('.a11y-floating-btn')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await cdp.eval(`document.querySelector('.btn-reset-a11y')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await cdp.eval(`document.querySelector('.btn-modal-done')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    const buttonsAfterReset = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    assert.strictEqual(buttonsAfterReset, 0, 'Reset must turn narration off and hide buttons immediately')

    // Re-enable Read aloud so subsequent page checks can verify section reading buttons
    await cdp.eval(`document.querySelector('.a11y-floating-btn')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await cdp.eval(`document.querySelector('#m-narration-on')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await cdp.eval(`document.querySelector('.btn-modal-done')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 10. Verify Section Reading Controls on About Page
    console.log('10. Verifying Section Reading Controls on About Page:')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/about` })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const aboutButtons = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    console.log('About page read buttons count:', aboutButtons)
    assert.strictEqual(aboutButtons, 4, 'About page must show 4 Read Section buttons')

    // 11. Verify Section Reading Controls on Gameplay Page
    console.log('11. Verifying Section Reading Controls on Gameplay Page:')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/gameplay` })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const gameplayButtons = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    console.log('Gameplay page read buttons count:', gameplayButtons)
    assert.strictEqual(gameplayButtons, 3, 'Gameplay page must show 3 Read Section buttons')

    // 12. Verify Section Reading Controls on Download Page
    console.log('12. Verifying Section Reading Controls on Download Page:')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/download` })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const downloadButtons = await cdp.eval(`document.querySelectorAll('.btn-read-section').length`)
    console.log('Download page read buttons count:', downloadButtons)
    assert.strictEqual(downloadButtons, 2, 'Download page must show 2 Read Section buttons')

    // 13. Verify Answer Reading Controls on FAQ Page
    console.log('13. Verifying Answer Reading Controls on FAQ Page:')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/faq` })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const faqButtons = await cdp.eval(`document.querySelectorAll('.btn-read-answer').length`)
    console.log('FAQ page read buttons count:', faqButtons)
    assert.strictEqual(faqButtons, 5, 'FAQ page must show 5 Read Answer buttons')

    // Trigger FAQ Answer 1 reading
    await cdp.eval(`document.querySelector('.btn-read-answer')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const faqPlayerActive = await cdp.eval(`!!document.querySelector('.inline-speech-player')`)
    assert.strictEqual(faqPlayerActive, true, 'Inline speech player must appear for FAQ answer')

    // Stop playback
    await cdp.eval(`document.querySelector('.btn-player-stop')?.click()`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 14. Verify Settings -> Accessibility as Dashboard Entry Point
    console.log('14. Verifying Settings -> Accessibility dashboard entry point:')
    await cdp.eval(`
      localStorage.setItem('cyber_token', 'mock-isolated-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({ username: 'IsolatedPlayer', role: 'player' }));
    `)
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/settings?section=accessibility` })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const isSettingsA11yActive = await cdp.eval(`!!document.querySelector('#read-aloud-heading')`)
    assert.strictEqual(isSettingsA11yActive, true, 'Settings accessibility tab must remain intact')

    // Confirm hover controls are absent in Settings
    const hasHoverCard = await cdp.eval(`!!document.querySelector('#hover-narration-heading')`)
    assert.strictEqual(hasHoverCard, false, 'Hover narration controls must NOT be present in Settings')

    // Confirm floating button is not present on dashboard pages
    const hasFloatingOnDashboard = await cdp.eval(`!!document.querySelector('.a11y-floating-btn')`)
    assert.strictEqual(hasFloatingOnDashboard, false, 'Floating button must NOT be present on dashboard layout')

    await cdp.close()
    console.log('✓ Suite 3 Isolated Browser Integration Tests Passed!\n')
  } finally {
    if (viteProcess) {
      viteProcess.kill()
    }
    if (chromeProcess) {
      chromeProcess.kill()
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

async function main() {
  try {
    await runUnitTests()
    await runRouterNavigationTests()
    await runBrowserIntegrationTests()

    console.log('================================================================')
    console.log('AUDIBLE VERIFICATION DISTINCTION NOTICE:')
    console.log('- Headless tests assert Web Speech API method invocations,')
    console.log('  state machine transitions, event callbacks, DOM visibility,')
    console.log('  and keyboard/focus containment.')
    console.log('- Mock/CDP assertions DO NOT constitute proof of audible sound.')
    console.log('- Actual audible output through system audio drivers and speakers')
    console.log('  must be verified by user listening with installed voices.')
    console.log('================================================================')
    process.exit(0)
  } catch (err) {
    console.error('Test Suite Failed:', err)
    process.exit(1)
  }
}

main()
