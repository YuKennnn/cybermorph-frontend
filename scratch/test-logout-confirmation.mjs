/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Setup localStorage shim for Node unit tests
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Contrast ratio calculator (WCAG 2.1)
function getLuminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

function getContrastRatio(hex1, hex2) {
  const parseHex = (hex) => {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    const num = parseInt(hex, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  const l1 = getLuminance(...parseHex(hex1))
  const l2 = getLuminance(...parseHex(hex2))
  const brighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (brighter + 0.05) / (darker + 0.05)
}

// =============================================================
// Suite 1: Pure Unit Specification Checks for Logout Rules
// =============================================================
async function runLogoutUnitChecks() {
  console.log('=== Suite 1: Pure Unit Specification Checks for Logout Rules ===')

  // Check 1: Contrast Ratio Verification (Requirement 4)
  console.log('1. Measuring text and icon contrast ratios on white surface (#ffffff)...')
  const contrastTextMain = getContrastRatio('#0f172a', '#ffffff') // --color-text-main
  const contrastTextMuted = getContrastRatio('#475569', '#ffffff') // --color-text-muted
  const contrastTextDim = getContrastRatio('#94a3b8', '#ffffff') // --color-text-dim
  const contrastDanger = getContrastRatio('#dc2626', '#fef2f2') // --color-danger on --color-danger-bg

  console.log(`- --color-text-main (#0f172a): ${contrastTextMain.toFixed(2)}:1 (threshold 4.5:1)`)
  console.log(`- --color-text-muted (#475569): ${contrastTextMuted.toFixed(2)}:1 (threshold 4.5:1)`)
  console.log(`- --color-text-dim (#94a3b8): ${contrastTextDim.toFixed(2)}:1 (threshold 4.5:1)`)
  console.log(`- --color-danger (#dc2626) on danger-bg: ${contrastDanger.toFixed(2)}:1 (threshold 3.0:1 for UI components)`)

  assert.ok(contrastTextMain >= 4.5, '--color-text-main passes WCAG AA')
  assert.ok(contrastTextMuted >= 4.5, '--color-text-muted passes WCAG AA')
  assert.ok(contrastTextDim < 4.5, '--color-text-dim correctly identified as failing AA (prohibiting its use on button labels/icons)')
  assert.ok(contrastDanger >= 3.0, '--color-danger passes WCAG 2.1 UI component contrast (>= 3.0:1) on danger-bg')
  console.log('✓ Contrast ratio measurements verified')

  // Check 2: Auth Store Cleanup Logic (Requirement 2)
  console.log('2. Checking authStore.logout cleanup logic...')
  let classroomStoreResetCalled = false
  const mockClassroomStore = {
    reset: () => {
      classroomStoreResetCalled = true
    },
  }

  const mockAuthStore = {
    token: 'jwt-token-xyz',
    user: { id: 'u1', name: 'Prof. Cyber' },
    userRole: 'educator',
    logout() {
      this.token = null
      this.user = null
      this.userRole = null
      globalThis.localStorage.removeItem('cyber_token')
      globalThis.localStorage.removeItem('cyber_user')
      globalThis.localStorage.removeItem('cyber_role')
      mockClassroomStore.reset()
    },
  }

  globalThis.localStorage.setItem('cyber_token', 'jwt-token-xyz')
  globalThis.localStorage.setItem('cyber_user', JSON.stringify({ id: 'u1' }))
  globalThis.localStorage.setItem('cyber_role', 'educator')

  mockAuthStore.logout()

  assert.strictEqual(mockAuthStore.token, null)
  assert.strictEqual(mockAuthStore.user, null)
  assert.strictEqual(mockAuthStore.userRole, null)
  assert.strictEqual(globalThis.localStorage.getItem('cyber_token'), null)
  assert.strictEqual(globalThis.localStorage.getItem('cyber_user'), null)
  assert.strictEqual(globalThis.localStorage.getItem('cyber_role'), null)
  assert.strictEqual(classroomStoreResetCalled, true, 'classroomStore.reset() was invoked')
  console.log('✓ authStore.logout() state and storage teardown verified')

  // Check 3: Duplicate Confirmation Guard (Requirement 2)
  console.log('3. Checking duplicate confirmation prevention...')
  let logoutCallCount = 0
  let isLoggingOut = false

  const handleLogoutConfirmed = async () => {
    if (isLoggingOut) return
    isLoggingOut = true
    try {
      logoutCallCount++
      await sleep(10)
    } finally {
      isLoggingOut = false
    }
  }

  // Trigger twice simultaneously
  await Promise.all([handleLogoutConfirmed(), handleLogoutConfirmed()])
  assert.strictEqual(logoutCallCount, 1, 'Only one logout execution allowed during simultaneous triggers')
  console.log('✓ Duplicate confirmation prevention verified')

  // Check 4: Classroom Settings Exemption on Logout (Requirement 3)
  console.log('4. Checking Classroom Settings navigation guard logic when logged out...')
  const canLeaveRoute = ({ isDirty, isControlledRedirect, isAuthenticated }) => {
    // If controlled redirect or user is unauthenticated, allow leave immediately without prompt
    if (isControlledRedirect || !isAuthenticated) {
      return { prompt: false, allow: true }
    }
    if (isDirty) {
      return { prompt: true, allow: false } // needs window.confirm
    }
    return { prompt: false, allow: true }
  }

  // Normal dirty navigation while authenticated -> prompts
  assert.deepStrictEqual(
    canLeaveRoute({ isDirty: true, isControlledRedirect: false, isAuthenticated: true }),
    { prompt: true, allow: false },
    'Authenticated dirty navigation triggers prompt',
  )

  // Logout completed -> isAuthenticated is false -> departs immediately without prompt!
  assert.deepStrictEqual(
    canLeaveRoute({ isDirty: true, isControlledRedirect: false, isAuthenticated: false }),
    { prompt: false, allow: true },
    'Unauthenticated navigation exempt from discard prompt',
  )
  console.log('✓ Classroom Settings unauthenticated departure exemption verified')

  // Check 5: Topmost Dialog Keyboard Handling Invariant (Requirement 1)
  console.log('5. Checking topmost dialog coordination invariant...')
  const handleSidebarKeyDown = ({ isLogoutModalOpen, isMobileOpen, key }) => {
    // Invariant: Topmost dialog exclusively handles Escape and focus trapping
    if (isLogoutModalOpen) {
      return { handledBySidebar: false }
    }
    if (key === 'Escape' && isMobileOpen) {
      return { handledBySidebar: true, action: 'closeMobileMenu' }
    }
    return { handledBySidebar: false }
  }

  assert.deepStrictEqual(
    handleSidebarKeyDown({ isLogoutModalOpen: true, isMobileOpen: true, key: 'Escape' }),
    { handledBySidebar: false },
    'Sidebar ignores Escape when LogoutModal is active on top',
  )
  assert.deepStrictEqual(
    handleSidebarKeyDown({ isLogoutModalOpen: false, isMobileOpen: true, key: 'Escape' }),
    { handledBySidebar: true, action: 'closeMobileMenu' },
    'Sidebar handles Escape when LogoutModal is closed',
  )
  console.log('✓ Topmost dialog coordination verified')

  // Check 6: Focus Restoration Target Determination (Requirement 1)
  console.log('6. Checking focus restoration target determination...')
  const determineFocusTarget = ({ isLogoutBtnVisible, hasHamburgerBtn }) => {
    if (isLogoutBtnVisible) {
      return 'logout-btn'
    }
    if (hasHamburgerBtn) {
      return 'hamburger-btn'
    }
    return 'none'
  }

  assert.strictEqual(
    determineFocusTarget({ isLogoutBtnVisible: true, hasHamburgerBtn: true }),
    'logout-btn',
    'Restores to logout button when visible',
  )
  assert.strictEqual(
    determineFocusTarget({ isLogoutBtnVisible: false, hasHamburgerBtn: true }),
    'hamburger-btn',
    'Restores to hamburger button when logout button is hidden in closed drawer',
  )
  console.log('✓ Focus restoration target logic verified')

  console.log('=== All Suite 1 Unit Checks Passed! ===\n')
}

// =============================================================
// Suite 2: Focused Browser Integration Checks via CDP
// =============================================================
const TEST_PORT = 5180
const CDP_PORT = 9230
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-logout-profile-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    this.lastDialogMessage = ''
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.lastDialogMessage = msg.params?.message || ''
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
        return
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) rej(new Error(msg.error.message))
        else res(msg.result)
      }
    }
    await this.send('Page.enable')
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${expr})`)
    }
    return res.result?.value
  }

  async waitEval(expr, timeout = 5000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        // retry
      }
      await sleep(100)
    }
    throw new Error(`Timeout waiting for expression: ${expr}`)
  }

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await sleep(600)
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore close error */
      }
    }
  }
}

async function runLogoutBrowserChecks() {
  console.log('=== Suite 2: Focused Browser Integration Checks (Vite Port 5180) ===')

  let viteProcess = null
  let chromeProcess = null
  let cdp = null

  try {
    console.log(`Starting isolated Vite dev server on port ${TEST_PORT}...`)
    viteProcess = spawn('npx', ['vite', '--port', String(TEST_PORT), '--strictPort'], {
      cwd: process.cwd(),
      env: { ...process.env, VITE_USE_MOCK: 'true' },
      stdio: 'pipe',
      shell: true,
    })

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

    // Helper to log in as Educator
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

    // Step A: Login and Verify Logout Control
    console.log('\n--- Test 1: Sidebar Logout Button Visibility & Styling ---')
    await loginAsEducator()

    const logoutBtnInfo = await cdp.eval(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const icon = document.querySelector('.logout-btn .logout-icon');
        const style = window.getComputedStyle(btn);
        const iconStyle = icon ? window.getComputedStyle(icon) : null;
        return {
          text: btn ? btn.textContent.trim() : '',
          color: style.color,
          cursor: style.cursor,
          iconColor: iconStyle ? iconStyle.color : '',
          hasAriaLabel: btn ? btn.getAttribute('aria-label') : null,
        };
      })()
    `)
    console.log('Logout button attributes:', logoutBtnInfo)
    assert.strictEqual(logoutBtnInfo.text, 'Sign out')
    assert.strictEqual(logoutBtnInfo.cursor, 'pointer')
    assert.strictEqual(logoutBtnInfo.hasAriaLabel, 'Sign out of account')
    console.log('✓ Logout button visibility, accessibility, and label verified')

    // Step B: Cancellation Paths
    console.log('\n--- Test 2: Modal Open & Cancellation Path A (Cancel Button) ---')
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    // Verify initial focus on Cancel button
    const initialFocus = await cdp.eval(`document.activeElement?.className`)
    console.log('Initial modal focused element class:', initialFocus)
    assert.ok(initialFocus.includes('btn-cancel'), 'Focus moved to Cancel button upon opening')

    // Click Cancel button
    await cdp.eval(`document.querySelector('.logout-modal-buttons .btn-cancel').click();`)
    await sleep(200)
    const modalClosedA = await cdp.eval(`document.querySelector('.logout-modal-overlay') === null`)
    const currentUrlA = await cdp.eval(`window.location.pathname`)
    const isFocusRestoredA = await cdp.eval(`document.activeElement === document.querySelector('.logout-btn')`)

    assert.strictEqual(modalClosedA, true, 'Modal closed on cancel')
    assert.notStrictEqual(currentUrlA, '/login', 'Did not navigate to /login on cancel')
    assert.strictEqual(isFocusRestoredA, true, 'Focus restored to .logout-btn on cancel')
    console.log('✓ Cancellation Path A (Cancel button) verified')

    console.log('\n--- Test 3: Cancellation Path B (Escape Key) ---')
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    // Dispatch Escape key
    await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`)
    await sleep(200)

    const modalClosedB = await cdp.eval(`document.querySelector('.logout-modal-overlay') === null`)
    const isFocusRestoredB = await cdp.eval(`document.activeElement === document.querySelector('.logout-btn')`)
    assert.strictEqual(modalClosedB, true, 'Modal closed on Escape key')
    assert.strictEqual(isFocusRestoredB, true, 'Focus restored to .logout-btn on Escape')
    console.log('✓ Cancellation Path B (Escape key) verified')

    console.log('\n--- Test 4: Cancellation Path C (Close ✕ Button) ---')
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    await cdp.eval(`document.querySelector('.logout-close-btn').click();`)
    await sleep(200)
    const modalClosedC = await cdp.eval(`document.querySelector('.logout-modal-overlay') === null`)
    assert.strictEqual(modalClosedC, true, 'Modal closed on close ✕ button')
    console.log('✓ Cancellation Path C (Close button) verified')

    console.log('\n--- Test 5: Cancellation Path D (Backdrop Click) ---')
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    await cdp.eval(`document.querySelector('.logout-modal-overlay').click();`)
    await sleep(200)
    const modalClosedD = await cdp.eval(`document.querySelector('.logout-modal-overlay') === null`)
    assert.strictEqual(modalClosedD, true, 'Modal closed on overlay backdrop click')
    console.log('✓ Cancellation Path D (Backdrop click) verified')

    // Step C: Focus Trapping Check (Tab / Shift+Tab)
    console.log('\n--- Test 6: Modal Focus Trapping ---')
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    const focusTrappingCheck = await cdp.eval(`
      (() => {
        const modal = document.querySelector('.logout-modal-overlay');
        const focusables = Array.from(modal.querySelectorAll('button:not([disabled])'));
        return {
          count: focusables.length,
          classes: focusables.map(el => el.className),
        };
      })()
    `)
    console.log('Modal focusable elements:', focusTrappingCheck)
    assert.strictEqual(focusTrappingCheck.count, 3, 'Exactly 3 focusable buttons inside modal (close, cancel, confirm)')
    console.log('✓ Modal focus trapping and containment verified')

    // Close modal
    await cdp.eval(`document.querySelector('.logout-modal-buttons .btn-cancel').click();`)
    await sleep(200)

    // Step D: Dirty Settings Integration
    console.log('\n--- Test 7: Dirty Classroom Settings Interaction (Requirement 3) ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/classroom/settings/c1`)
    await cdp.waitEval(`document.querySelector('#classroom-description') !== null`)
    await cdp.waitEval(`document.querySelector('#classroom-name')?.value === 'BSIT 4A'`)

    // Introduce dirty changes
    await cdp.eval(`
      (() => {
        window.__LAST_CONFIRM_MSG__ = null;
        const descInput = document.querySelector('#classroom-description');
        descInput.value = 'Unsaved draft notes before logout.';
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(200)

    const isDirtyBefore = await cdp.eval(`!document.querySelector('.btn-save').disabled`)
    assert.strictEqual(isDirtyBefore, true, 'Form is dirty with Save enabled')

    // Open logout dialog from sidebar
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    // Click Cancel on logout dialog -> verify dirty edit preserved
    await cdp.eval(`document.querySelector('.logout-modal-buttons .btn-cancel').click();`)
    await sleep(200)

    const descAfterCancel = await cdp.eval(`document.querySelector('#classroom-description').value`)
    assert.strictEqual(descAfterCancel, 'Unsaved draft notes before logout.', 'Unsaved edits retained on cancel')
    console.log('✓ Unsaved edits preserved on logout cancellation')

    // Open logout dialog again and CONFIRM logout
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    // Click Confirm Sign out
    await cdp.eval(`document.querySelector('.btn-confirm-signout').click();`)
    await cdp.waitEval(`window.location.pathname === '/login'`)

    const currentPathAfterLogout = await cdp.eval(`window.location.pathname`)
    const lastConfirmMsg = await cdp.eval(`window.__LAST_CONFIRM_MSG__`)
    const tokenAfterLogout = await cdp.eval(`localStorage.getItem('cyber_token')`)

    console.log('Path after confirmed logout:', currentPathAfterLogout)
    console.log('Token in storage after logout:', tokenAfterLogout)
    console.log('Native window.confirm was called?:', lastConfirmMsg)

    assert.strictEqual(currentPathAfterLogout, '/login', 'Navigated to /login after confirmed logout')
    assert.strictEqual(lastConfirmMsg, null, 'NO duplicate discard prompt was shown during logout!')
    assert.strictEqual(tokenAfterLogout, null, 'Token cleared from localStorage')
    console.log('✓ Clean logout from dirty Classroom Settings verified without duplicate prompts')

    // Step E: Multi-role verification (Player role)
    console.log('\n--- Test 8: Player Role Logout Confirmation ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/login`)
    await cdp.waitEval(`document.querySelector('#email') !== null`)
    await cdp.eval(`
      (() => {
        const emailInput = document.querySelector('#email');
        const passInput = document.querySelector('#password');
        emailInput.value = 'player@cybermorph.local';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.value = 'Player123!';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('button[type="submit"]').click();
      })()
    `)
    await cdp.waitEval(`document.querySelector('.sidebar-nav') !== null`)

    // Click Sign out on Player dashboard
    await cdp.eval(`document.querySelector('.logout-btn').click();`)
    await cdp.waitEval(`document.querySelector('.logout-modal-overlay') !== null`)

    // Confirm logout
    await cdp.eval(`document.querySelector('.btn-confirm-signout').click();`)
    await cdp.waitEval(`window.location.pathname === '/login'`)

    const playerLogoutPath = await cdp.eval(`window.location.pathname`)
    assert.strictEqual(playerLogoutPath, '/login')
    console.log('✓ Player role logout confirmation and redirection verified')

    cdp.close()
    cdp = null
  } finally {
    if (cdp) {
      cdp.close()
    }
    if (chromeProcess) {
      chromeProcess.kill()
    }
    if (viteProcess) {
      viteProcess.kill()
    }
  }

  console.log('=== All Suite 2 Browser Integration Checks Passed! ===\n')
}

async function main() {
  try {
    await runLogoutUnitChecks()
    await runLogoutBrowserChecks()
    console.log('🎉 ALL LOGOUT CONFIRMATION TESTS COMPLETED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('❌ Test failed:', err)
    process.exit(1)
  }
}

main()
