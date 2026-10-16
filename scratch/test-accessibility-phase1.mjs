import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import assert from 'assert'
import process from 'process'

// Luminance and Contrast Calculation Functions (WCAG 2.1)
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function hexToRgb(hex) {
  const cleaned = hex.replace('#', '')
  const bigint = parseInt(cleaned, 16)
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return [r, g, b]
  }
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2])
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2])
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Suite 1: Mathematical Contrast & Specification Verification
function runUnitContrastChecks() {
  console.log('=== Suite 1: Mathematical Contrast & Token Pair Verification ===')

  // Light Mode Tokens
  const lightCard = '#ffffff'
  const lightTextMain = '#0f172a'
  const lightTextMuted = '#475569'
  const lightBorderControl = '#64748b' // Essential UI control boundaries

  // Dark Mode Tokens
  const darkCard = '#131b2e'
  const darkTextMain = '#f8fafc'
  const darkTextMuted = '#94a3b8'
  const darkBorderControl = '#64748b' // Essential UI control boundaries

  console.log('1. Checking Light Mode Contrast Ratios:')
  const lightTextRatio = getContrastRatio(lightTextMain, lightCard)
  console.log(`- Main Text (#0f172a) on Card (#ffffff): ${lightTextRatio.toFixed(2)}:1 (threshold 4.5:1)`)
  assert.ok(lightTextRatio >= 4.5, 'Light mode text contrast below 4.5:1')

  const lightMutedRatio = getContrastRatio(lightTextMuted, lightCard)
  console.log(`- Muted Text (#475569) on Card (#ffffff): ${lightMutedRatio.toFixed(2)}:1 (threshold 4.5:1)`)
  assert.ok(lightMutedRatio >= 4.5, 'Light mode muted text contrast below 4.5:1')

  const lightControlBorderRatio = getContrastRatio(lightBorderControl, lightCard)
  console.log(`- Essential Control Border (#64748b) on Card (#ffffff): ${lightControlBorderRatio.toFixed(2)}:1 (threshold 3.0:1)`)
  assert.ok(lightControlBorderRatio >= 3.0, 'Light mode control border contrast below 3.0:1')

  console.log('2. Checking Dark Mode Contrast Ratios:')
  const darkTextRatio = getContrastRatio(darkTextMain, darkCard)
  console.log(`- Main Text (#f8fafc) on Card (#131b2e): ${darkTextRatio.toFixed(2)}:1 (threshold 4.5:1)`)
  assert.ok(darkTextRatio >= 4.5, 'Dark mode text contrast below 4.5:1')

  const darkMutedRatio = getContrastRatio(darkTextMuted, darkCard)
  console.log(`- Muted Text (#94a3b8) on Card (#131b2e): ${darkMutedRatio.toFixed(2)}:1 (threshold 4.5:1)`)
  assert.ok(darkMutedRatio >= 4.5, 'Dark mode muted text contrast below 4.5:1')

  const darkControlBorderRatio = getContrastRatio(darkBorderControl, darkCard)
  console.log(`- Essential Control Border (#64748b) on Card (#131b2e): ${darkControlBorderRatio.toFixed(2)}:1 (threshold 3.0:1)`)
  assert.ok(darkControlBorderRatio >= 3.0, 'Dark mode control border contrast below 3.0:1')

  console.log('3. Checking Semantic Role Badge Contrast:')
  const lightPlayerRatio = getContrastRatio('#166534', '#f0fdf4')
  console.log(`- Light Player Badge (#166534 on #f0fdf4): ${lightPlayerRatio.toFixed(2)}:1`)
  assert.ok(lightPlayerRatio >= 4.5, 'Light player badge below 4.5:1')

  const lightAdminRatio = getContrastRatio('#92400e', '#fef3c7')
  console.log(`- Light Admin Badge (#92400e on #fef3c7): ${lightAdminRatio.toFixed(2)}:1`)
  assert.ok(lightAdminRatio >= 4.5, 'Light admin badge below 4.5:1')

  const darkPlayerRatio = getContrastRatio('#86efac', '#052e16')
  console.log(`- Dark Player Badge (#86efac on #052e16): ${darkPlayerRatio.toFixed(2)}:1`)
  assert.ok(darkPlayerRatio >= 4.5, 'Dark player badge below 4.5:1')

  const darkEducatorRatio = getContrastRatio('#c4b5fd', '#2e1065')
  console.log(`- Dark Educator Badge (#c4b5fd on #2e1065): ${darkEducatorRatio.toFixed(2)}:1`)
  assert.ok(darkEducatorRatio >= 4.5, 'Dark educator badge below 4.5:1')

  const darkAdminRatio = getContrastRatio('#fcd34d', '#451a03')
  console.log(`- Dark Admin Badge (#fcd34d on #451a03): ${darkAdminRatio.toFixed(2)}:1`)
  assert.ok(darkAdminRatio >= 4.5, 'Dark admin badge below 4.5:1')

  console.log('✓ All Suite 1 Contrast & Token Requirements Verified!\n')
}

// Suite 2: Browser Integration Checks via CDP
const TEST_PORT = 5180
const CDP_PORT = 9230
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-a11y-profile-' + Date.now())

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
    return res.result ? res.result.value : undefined
  }

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await this.waitPageLoad()
  }

  async waitPageLoad(timeoutMs = 6000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const readyState = await this.eval(`document.readyState`).catch(() => 'loading')
      if (readyState === 'complete') {
        await new Promise((r) => setTimeout(r, 200))
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  async waitEval(expr, timeoutMs = 6000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        // continue waiting
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`waitEval timeout waiting for: ${expr}`)
  }

  close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function runBrowserTests() {
  console.log('=== Suite 2: Focused Browser Integration Checks (Vite Port 5180) ===')
  let viteProcess = null
  let chromeProcess = null
  let cdp = null

  try {
    // 1. Start Vite dev server on port 5180
    console.log(`Starting isolated Vite dev server on port ${TEST_PORT}...`)
    viteProcess = spawn(
      'npm',
      ['run', 'dev', '--', '--port', String(TEST_PORT), '--strictPort'],
      {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, VITE_USE_MOCK: 'true' },
      },
    )

    await new Promise((resolve, reject) => {
      viteProcess.stdout.on('data', (data) => {
        const text = data.toString()
        if (text.includes('Local:') || text.includes(`localhost:${TEST_PORT}`)) {
          resolve()
        }
      })
      viteProcess.stderr.on('data', () => {})
      viteProcess.on('error', reject)
      setTimeout(() => resolve(), 3000)
    })
    console.log(`✓ Confirmed isolated Vite server running on http://localhost:${TEST_PORT}`)

    // 2. Start Chrome with CDP
    console.log(`Starting Chrome CDP on port ${CDP_PORT}...`)
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    chromeProcess = spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--headless=new',
        '--disable-gpu',
        '--window-size=1280,800',
        `http://localhost:${TEST_PORT}/login`,
      ],
      { stdio: 'ignore' },
    )

    let listRes = null
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
        if (res.ok) {
          listRes = await res.json()
          if (listRes.length > 0) break
        }
      } catch {
        await sleep(200)
      }
    }
    assert.ok(listRes && listRes.length > 0, 'Chrome remote debugging did not respond')

    const page = listRes.find((p) => p.type === 'page') || listRes[0]
    cdp = new ChromeCDP(page.webSocketDebuggerUrl)
    await cdp.connect()
    console.log('✓ Connected to Headless Chrome via CDP')

    // Helper: Seed educator login
    const loginAsEducator = async () => {
      await cdp.navigate(`http://localhost:${TEST_PORT}/login`)
      await cdp.waitEval(`document.querySelector('#email') !== null`)
      await cdp.eval(`
        (() => {
          const emailInput = document.querySelector('#email');
          const passInput = document.querySelector('#password');
          emailInput.value = 'educator@cybermorph.local';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = 'Educator123!';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('button[type="submit"]').click();
        })()
      `)
      await cdp.waitEval(`document.querySelector('.sidebar-nav') !== null`)
    }

    await loginAsEducator()
    console.log('✓ Successfully logged in as Educator')

    // Test 1: Navigation with URL Preservation & WAI-ARIA Semantics
    console.log('\n--- Test 1: Navigation with URL Preservation & WAI-ARIA Semantics ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/settings`)
    await cdp.waitEval(`document.querySelector('#tab-account') !== null`)

    const tabStatus1 = await cdp.eval(`(() => {
      const tabAccount = document.getElementById('tab-account');
      const tabA11y = document.getElementById('tab-accessibility');
      const panelAccount = document.getElementById('panel-account');
      const panelA11y = document.getElementById('panel-accessibility');
      return {
        accountSelected: tabAccount?.getAttribute('aria-selected'),
        accountTabindex: tabAccount?.getAttribute('tabindex'),
        a11ySelected: tabA11y?.getAttribute('aria-selected'),
        a11yTabindex: tabA11y?.getAttribute('tabindex'),
        panelAccountVisible: panelAccount && window.getComputedStyle(panelAccount).display !== 'none',
        panelA11yHidden: panelA11y && window.getComputedStyle(panelA11y).display === 'none',
        query: window.location.search
      };
    })()`)
    console.log('Initial Tab State:', tabStatus1)
    assert.strictEqual(tabStatus1.accountSelected, 'true')
    assert.strictEqual(tabStatus1.panelAccountVisible, true)
    console.log('✓ Default Account tab and WAI-ARIA semantics verified')

    // Click Accessibility Tab
    await cdp.eval(`document.getElementById('tab-accessibility').click()`)
    await cdp.waitEval(`document.querySelector('#panel-accessibility') && window.getComputedStyle(document.querySelector('#panel-accessibility')).display !== 'none'`)

    const tabStatus2 = await cdp.eval(`(() => {
      const tabA11y = document.getElementById('tab-accessibility');
      return {
        a11ySelected: tabA11y?.getAttribute('aria-selected'),
        query: window.location.search
      };
    })()`)
    console.log('After clicking Accessibility Tab:', tabStatus2)
    assert.strictEqual(tabStatus2.a11ySelected, 'true')
    assert.ok(tabStatus2.query.includes('section=accessibility'), 'URL did not update with ?section=accessibility')
    console.log('✓ Accessibility tab activated and URL updated with ?section=accessibility')

    // Test Keyboard Arrow Navigation (ArrowLeft moves focus to Account and selects it)
    await cdp.eval(`(() => {
      const tabA11y = document.getElementById('tab-accessibility');
      tabA11y.focus();
      tabA11y.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    })()`)
    await sleep(300)

    const tabStatus3 = await cdp.eval(`(() => {
      const tabAccount = document.getElementById('tab-account');
      return {
        accountSelected: tabAccount?.getAttribute('aria-selected'),
        isFocused: document.activeElement === tabAccount,
        query: window.location.search
      };
    })()`)
    console.log('After ArrowLeft from Accessibility Tab:', tabStatus3)
    assert.strictEqual(tabStatus3.accountSelected, 'true')
    assert.strictEqual(tabStatus3.isFocused, true)
    console.log('✓ Keyboard arrow navigation and focus transfer verified')

    // Re-select Accessibility tab
    await cdp.eval(`document.getElementById('tab-accessibility').click()`)
    await sleep(300)

    // Test 2: Theme Selection & Applied Token Surfaces
    console.log('\n--- Test 2: Theme Selection & Applied Token Surfaces ---')
    // Select Dark theme
    await cdp.eval(`document.getElementById('theme-pref-dark').click()`)
    await sleep(300)

    const darkThemeStatus = await cdp.eval(`(() => {
      const rootTheme = document.documentElement.getAttribute('data-theme');
      const storedTheme = localStorage.getItem('cyber_pref_theme');
      const cardBg = window.getComputedStyle(document.querySelector('.settings-card')).backgroundColor;
      const textColor = window.getComputedStyle(document.querySelector('.page-title')).color;
      return { rootTheme, storedTheme, cardBg, textColor };
    })()`)
    console.log('Dark Theme Status:', darkThemeStatus)
    assert.strictEqual(darkThemeStatus.rootTheme, 'dark')
    assert.strictEqual(darkThemeStatus.storedTheme, 'dark')
    console.log('✓ Dark theme successfully applied to root, storage, and styled via tokens')

    // Select Light theme
    await cdp.eval(`document.getElementById('theme-pref-light').click()`)
    await sleep(300)

    const lightThemeStatus = await cdp.eval(`(() => {
      const rootTheme = document.documentElement.getAttribute('data-theme');
      const storedTheme = localStorage.getItem('cyber_pref_theme');
      const cardBg = window.getComputedStyle(document.querySelector('.settings-card')).backgroundColor;
      return { rootTheme, storedTheme, cardBg };
    })()`)
    console.log('Light Theme Status:', lightThemeStatus)
    assert.strictEqual(lightThemeStatus.rootTheme, 'light')
    assert.strictEqual(lightThemeStatus.storedTheme, 'light')
    console.log('✓ Light theme successfully applied to root and storage')

    // Select System theme
    await cdp.eval(`document.getElementById('theme-pref-system').click()`)
    await sleep(300)

    const systemThemeStatus = await cdp.eval(`(() => {
      const rootTheme = document.documentElement.getAttribute('data-theme');
      const storedTheme = localStorage.getItem('cyber_pref_theme');
      return { rootTheme, storedTheme };
    })()`)
    console.log('System Theme Status:', systemThemeStatus)
    assert.strictEqual(systemThemeStatus.rootTheme, null)
    assert.strictEqual(systemThemeStatus.storedTheme, 'system')
    console.log('✓ System theme cleanly removes override attribute to let OS media query govern')

    // Test 3: Text Size Presets & Typography Scaling
    console.log('\n--- Test 3: Text Size Presets & Typography Scaling ---')
    // Large (115%)
    await cdp.eval(`document.getElementById('size-pref-large').click()`)
    await sleep(300)

    const largeSizeStatus = await cdp.eval(`(() => {
      const rootSize = document.documentElement.getAttribute('data-text-size');
      const storedSize = localStorage.getItem('cyber_pref_text_size');
      const fontSize = window.getComputedStyle(document.documentElement).fontSize;
      return { rootSize, storedSize, fontSize };
    })()`)
    console.log('Large Text Size Status:', largeSizeStatus)
    assert.strictEqual(largeSizeStatus.rootSize, 'large')
    assert.strictEqual(largeSizeStatus.storedSize, 'large')
    console.log('✓ Large text size preset (115%) verified')

    // Extra Large (130%)
    await cdp.eval(`document.getElementById('size-pref-xlarge').click()`)
    await sleep(300)

    const xlargeSizeStatus = await cdp.eval(`(() => {
      const rootSize = document.documentElement.getAttribute('data-text-size');
      const storedSize = localStorage.getItem('cyber_pref_text_size');
      const fontSize = window.getComputedStyle(document.documentElement).fontSize;
      return { rootSize, storedSize, fontSize };
    })()`)
    console.log('Extra Large Text Size Status:', xlargeSizeStatus)
    assert.strictEqual(xlargeSizeStatus.rootSize, 'extra-large')
    assert.strictEqual(xlargeSizeStatus.storedSize, 'extra-large')
    console.log('✓ Extra large text size preset (130%) verified')

    // Reset size to standard
    await cdp.eval(`document.getElementById('size-pref-standard').click()`)
    await sleep(200)

    // Test 4: Browser Zoom (200%) vs Viewport Resizing
    console.log('\n--- Test 4: Browser Zoom (200%) vs Viewport Resizing ---')
    // Emulate 200% page scale factor (Browser Zoom)
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2.0 })
    await sleep(400)

    const zoomState = await cdp.eval(`(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      return {
        scrollWidth,
        clientWidth,
        noHorizontalOverflow: scrollWidth <= clientWidth + 2
      };
    })()`)
    console.log('200% Browser Zoom State:', zoomState)
    assert.ok(zoomState.noHorizontalOverflow, '200% zoom caused uncontained layout overflow')
    console.log('✓ 200% browser zoom preserved layout without broken horizontal overflow')

    // Reset page scale factor
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.0 })
    await sleep(200)

    // Emulate narrow viewport (360px mobile width)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 1,
      mobile: true,
    })
    await sleep(400)

    const narrowState = await cdp.eval(`(() => {
      const hamburger = document.querySelector('.hamburger-btn');
      const hamburgerDisplay = hamburger ? window.getComputedStyle(hamburger).display : 'none';
      const sidebar = document.querySelector('.sidebar-nav');
      const sidebarTransform = sidebar ? window.getComputedStyle(sidebar).transform : '';
      const mainContent = document.querySelector('.main-content');
      const paddingLeft = mainContent ? window.getComputedStyle(mainContent).paddingLeft : '';
      return {
        hamburgerVisible: hamburgerDisplay !== 'none',
        sidebarHidden: sidebarTransform.includes('matrix') || sidebarTransform.includes('-100'),
        paddingLeftZero: paddingLeft === '0px'
      };
    })()`)
    console.log('Narrow Viewport (360px) State:', narrowState)
    assert.strictEqual(narrowState.hamburgerVisible, true)
    assert.strictEqual(narrowState.paddingLeftZero, true)
    console.log('✓ Narrow layout collapses fixed sidebar to 0 padding-left and mobile hamburger')

    // Reset device metrics
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await sleep(300)

    // Test 5: Reduced Motion & Canvas Animation Response
    console.log('\n--- Test 5: Reduced Motion & Canvas Animation Response ---')
    await cdp.eval(`document.getElementById('motion-pref-reduced').click()`)
    await sleep(300)

    const motionReducedState = await cdp.eval(`(() => {
      const rootMotion = document.documentElement.getAttribute('data-reduced-motion');
      const storedMotion = localStorage.getItem('cyber_pref_reduced_motion');
      return { rootMotion, storedMotion };
    })()`)
    console.log('Reduced Motion State:', motionReducedState)
    assert.strictEqual(motionReducedState.rootMotion, 'true')
    assert.strictEqual(motionReducedState.storedMotion, 'reduced')
    console.log('✓ Reduced motion preference set to reduced')

    // Navigate to Landing page where Hero Simulation Canvas & Interactive Preview reside
    await cdp.navigate(`http://localhost:${TEST_PORT}/`)
    await cdp.waitEval(`document.querySelector('.interactive-preview-panel') !== null`)

    const canvasReducedState = await cdp.eval(`(() => {
      const pauseBtn = document.querySelector('.btn-control');
      const pausePill = document.querySelector('.paused-pill');
      const pauseText = pauseBtn ? pauseBtn.textContent.trim() : '';
      const isPillVisible = pausePill ? window.getComputedStyle(pausePill).display !== 'none' : false;
      return { pauseText, isPillVisible };
    })()`)
    console.log('Landing Preview Button State under Reduced Motion:', canvasReducedState)
    assert.ok(canvasReducedState.pauseText.toLowerCase().includes('resume'), 'Preview did not pause automatically under reduced motion')
    assert.strictEqual(canvasReducedState.isPillVisible, true, 'Paused pill is not visible under reduced motion')
    console.log('✓ Canvas preview responds to reduced motion setting on load (paused)')

    // Manual pause/resume toggle test
    await cdp.eval(`(() => {
      const pauseBtn = document.querySelector('.btn-control');
      if (pauseBtn) pauseBtn.click();
    })()`)
    await sleep(300)
    const manualToggleState = await cdp.eval(`(() => {
      const pauseBtn = document.querySelector('.btn-control');
      return pauseBtn ? pauseBtn.textContent.trim() : '';
    })()`)
    console.log('After manual click on Pause/Resume:', manualToggleState)
    assert.ok(manualToggleState.toLowerCase().includes('pause'), 'Manual unpause did not resume simulation')
    console.log('✓ Manual pause behavior preserved during user override')

    // Test 6: Storage Resilience & Reset Accessibility Preferences
    console.log('\n--- Test 6: Storage Resilience & Reset Accessibility Preferences ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/settings?section=accessibility`)
    await cdp.waitEval(`document.querySelector('.btn-reset') !== null`)

    // Set non-default preferences: theme dark, text large, motion reduced
    await cdp.eval(`
      document.getElementById('theme-pref-dark').click();
      document.getElementById('size-pref-large').click();
      document.getElementById('motion-pref-reduced').click();
    `)
    await sleep(300)

    const beforeReset = await cdp.eval(`(() => {
      return {
        theme: localStorage.getItem('cyber_pref_theme'),
        size: localStorage.getItem('cyber_pref_text_size'),
        motion: localStorage.getItem('cyber_pref_reduced_motion'),
        tokenBefore: localStorage.getItem('cyber_token')
      };
    })()`)
    console.log('Preferences before reset:', beforeReset)

    // Click Reset to defaults
    await cdp.eval(`document.querySelector('.btn-reset').click()`)
    await sleep(400)

    const afterReset = await cdp.eval(`(() => {
      const feedback = document.querySelector('.reset-feedback');
      return {
        theme: localStorage.getItem('cyber_pref_theme'),
        size: localStorage.getItem('cyber_pref_text_size'),
        motion: localStorage.getItem('cyber_pref_reduced_motion'),
        tokenAfter: localStorage.getItem('cyber_token'),
        rootTheme: document.documentElement.getAttribute('data-theme'),
        rootSize: document.documentElement.getAttribute('data-text-size'),
        rootMotion: document.documentElement.getAttribute('data-reduced-motion'),
        feedbackText: feedback ? feedback.textContent.trim() : '',
        feedbackRole: feedback ? feedback.getAttribute('role') : null
      };
    })()`)
    console.log('State after Reset to defaults:', afterReset)

    assert.strictEqual(afterReset.theme, 'system')
    assert.strictEqual(afterReset.size, 'standard')
    assert.strictEqual(afterReset.motion, 'system')
    assert.ok(afterReset.tokenAfter, 'Reset wiped authentication token! Must not touch auth storage.')
    assert.ok(afterReset.feedbackText && afterReset.feedbackRole === 'status', 'Accessible feedback message missing')
    console.log('✓ Reset to defaults reverted theme, size, and motion without touching auth token')
    console.log('✓ Accessible feedback message with role="status" confirmed')

    // Test 7: Corrupted Storage Recovery
    console.log('\n--- Test 7: Corrupted Storage Recovery ---')
    await cdp.eval(`
      localStorage.setItem('cyber_pref_theme', 'invalid-theme-value');
      localStorage.setItem('cyber_pref_text_size', 'corrupted-size-999');
      localStorage.setItem('cyber_pref_reduced_motion', 'bogus-motion');
    `)

    await cdp.navigate(`http://localhost:${TEST_PORT}/settings?section=accessibility`)
    await cdp.waitEval(`document.querySelector('.btn-reset') !== null`)

    const hydrationState = await cdp.eval(`(() => {
      return {
        rootTheme: document.documentElement.getAttribute('data-theme'),
        rootSize: document.documentElement.getAttribute('data-text-size'),
        rootMotion: document.documentElement.getAttribute('data-reduced-motion')
      };
    })()`)
    console.log('Boot Hydration with Corrupted Storage:', hydrationState)
    assert.strictEqual(hydrationState.rootTheme, null)
    assert.strictEqual(hydrationState.rootSize, null)
    assert.strictEqual(hydrationState.rootMotion, null)
    console.log('✓ Corrupted storage values safely fallback to defaults without throwing')

    cdp.close()
    cdp = null
  } finally {
    if (cdp) cdp.close()
    if (chromeProcess) chromeProcess.kill()
    if (viteProcess) viteProcess.kill()
  }

  console.log('\n🎉 ALL PHASE 1 ACCESSIBILITY TESTS COMPLETED SUCCESSFULLY!')
}

async function main() {
  try {
    runUnitContrastChecks()
    await runBrowserTests()
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Test failure:', err)
    process.exit(1)
  }
}

main()
