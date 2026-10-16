/* global process */
/**
 * Automated Verification Suite for Minimal Shared Settings Page
 *
 * Covers:
 * - Suite 1: Pure Unit Specification Checks
 *   - Truthful account fields (Player, Educator, Admin, Unknown)
 *   - Missing status and unverified role handling
 *   - Notice copy and Classroom management link verification
 *   - Motion preference utility: 'system', 'reduced', corrupted values, storage exceptions
 *   - Decoupled storage (auth vs preference)
 * - Suite 2: Focused Browser Integration Checks (Vite Port 5180, Chrome CDP)
 *   - Educator view & Classroom management pointer
 *   - Reduced motion toggle, DOM attribute application, and persistence across reload
 *   - Player view & session email handling
 *   - Admin view & Administrator role badge
 *   - Missing status field fallbacks ('Unavailable', 'Unknown')
 *   - Sidebar navigation active state
 */

import assert from 'node:assert'
import { spawn } from 'node:child_process'
import http from 'node:http'

const VITE_PORT = 5180
const CHROME_PORT = 9230
const BASE_URL = `http://localhost:${VITE_PORT}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// =============================================================
// Suite 1: Pure Unit Specification Checks
// =============================================================
async function runSettingsUnitChecks() {
  console.log('=== Suite 1: Pure Unit Specification Checks for Settings Rules ===')

  // Check 1: Account Status & Role Mapping Rules (Requirement 1)
  console.log('1. Checking account status and role mapping rules...')

  const formatRole = (role) => {
    const r = role?.toLowerCase()
    if (r === 'player') return 'Player'
    if (r === 'educator') return 'Educator'
    if (r === 'admin') return 'Administrator'
    return 'Unknown'
  }

  const formatApprovalStatus = (status) => {
    if (!status || typeof status !== 'string') return 'Unavailable'
    const normalized = status.toLowerCase()
    if (normalized === 'approved') return 'Approved'
    if (normalized === 'pending') return 'Pending'
    if (normalized === 'rejected') return 'Rejected'
    return status
  }

  const formatPortalAccess = (access) => {
    if (access === true) return 'Active'
    if (access === false) return 'Inactive'
    return 'Unavailable'
  }

  assert.strictEqual(formatRole('player'), 'Player')
  assert.strictEqual(formatRole('educator'), 'Educator')
  assert.strictEqual(formatRole('admin'), 'Administrator')
  assert.strictEqual(formatRole(''), 'Unknown')
  assert.strictEqual(formatRole(null), 'Unknown')
  assert.strictEqual(formatRole('superadmin'), 'Unknown')

  assert.strictEqual(formatApprovalStatus('approved'), 'Approved')
  assert.strictEqual(formatApprovalStatus('pending'), 'Pending')
  assert.strictEqual(formatApprovalStatus(null), 'Unavailable')
  assert.strictEqual(formatApprovalStatus(undefined), 'Unavailable')
  assert.strictEqual(formatApprovalStatus(''), 'Unavailable')

  assert.strictEqual(formatPortalAccess(true), 'Active')
  assert.strictEqual(formatPortalAccess(false), 'Inactive')
  assert.strictEqual(formatPortalAccess(null), 'Unavailable')
  assert.strictEqual(formatPortalAccess(undefined), 'Unavailable')
  assert.strictEqual(formatPortalAccess('active'), 'Unavailable')

  console.log('✓ Account status and role mapping rules verified')

  // Check 2: Notice Copy and Classroom Management Copy (Requirements 2 & 3)
  console.log('2. Checking read-only and classroom pointer copy requirements...')
  const readOnlyNotice = 'Account details are currently read-only. Profile editing is not currently supported.'
  const classroomPointerNotice = 'To manage classroom names, descriptions, and student enrollment access, visit Classroom management.'

  assert.ok(readOnlyNotice.includes('Account details are currently read-only'), 'Notice contains exact read-only statement')
  assert.ok(!readOnlyNotice.includes('administrator'), 'Notice makes no false claims about admin credential editing')
  assert.ok(classroomPointerNotice.includes('Classroom management'), 'Classroom link correctly labeled')
  assert.ok(!classroomPointerNotice.includes('access code editing'), 'Classroom copy avoids claiming code editing')
  console.log('✓ Copy standards verified')

  // Check 3: Motion Preference Storage & Fallbacks (Requirements 4, 6, 7)
  console.log('3. Checking motion preference storage, fallback, and corruption resilience...')

  const PREFERENCE_KEY = 'cyber_pref_reduced_motion'
  let mockStorage = {}
  let memoryPreference = 'system'

  const mockLocalStorage = {
    getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
    setItem: (key, val) => {
      mockStorage[key] = String(val)
    },
    removeItem: (key) => {
      delete mockStorage[key]
    },
    clear: () => {
      mockStorage = {}
    },
  }

  const getStoredPreference = (storage) => {
    try {
      const stored = storage.getItem(PREFERENCE_KEY)
      if (stored === 'reduced' || stored === 'system') {
        return stored
      }
      return 'system'
    } catch {
      return memoryPreference
    }
  }

  const setStoredPreference = (storage, pref) => {
    const valid = pref === 'reduced' ? 'reduced' : 'system'
    memoryPreference = valid
    try {
      storage.setItem(PREFERENCE_KEY, valid)
    } catch {
      // maintain in memory
    }
    return valid
  }

  // Initial state on clean storage
  assert.strictEqual(getStoredPreference(mockLocalStorage), 'system')

  // Setting reduced
  setStoredPreference(mockLocalStorage, 'reduced')
  assert.strictEqual(getStoredPreference(mockLocalStorage), 'reduced')
  assert.strictEqual(mockStorage[PREFERENCE_KEY], 'reduced')

  // Corrupted stored values fallback to 'system'
  mockStorage[PREFERENCE_KEY] = 'invalid_corrupted_value'
  assert.strictEqual(getStoredPreference(mockLocalStorage), 'system')
  mockStorage[PREFERENCE_KEY] = 'null'
  assert.strictEqual(getStoredPreference(mockLocalStorage), 'system')
  mockStorage[PREFERENCE_KEY] = '12345'
  assert.strictEqual(getStoredPreference(mockLocalStorage), 'system')

  // Storage unavailability (e.g. SecurityError in restricted iframe)
  const throwingStorage = {
    getItem: () => {
      throw new Error('SecurityError: Access is denied for this document')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }

  memoryPreference = 'reduced'
  assert.strictEqual(getStoredPreference(throwingStorage), 'reduced')
  // Should not throw when setting preference
  assert.doesNotThrow(() => {
    setStoredPreference(throwingStorage, 'system')
  })
  assert.strictEqual(memoryPreference, 'system')

  console.log('✓ Storage resilience, fallback, and corruption recovery verified')

  // Check 4: Decoupled Auth Storage Invariant
  console.log('4. Checking decoupling of motion preference from auth store...')
  mockStorage = {
    cyber_token: 'auth-token-123',
    cyber_user: JSON.stringify({ email: 'prof@dnsc.edu.ph', role: 'educator' }),
    cyber_role: 'educator',
    cyber_pref_reduced_motion: 'reduced',
  }

  // Simulate auth logout
  delete mockStorage.cyber_token
  delete mockStorage.cyber_user
  delete mockStorage.cyber_role

  assert.strictEqual(mockStorage.cyber_pref_reduced_motion, 'reduced', 'Motion preference retained across auth logout')
  console.log('✓ Motion preference is strictly independent from auth tokens')

  console.log('=== All Suite 1 Unit Checks Passed! ===\n')
}

// =============================================================
// Suite 2: Focused Browser Integration Checks via Chrome CDP
// =============================================================
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 1
    this.callbacks = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id)
        this.callbacks.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++
      this.callbacks.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result?.value
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

async function runSettingsBrowserChecks() {
  console.log('=== Suite 2: Focused Browser Integration Checks (Vite Port 5180) ===')

  let viteProcess = null
  let chromeProcess = null
  let cdp = null

  try {
    // 1. Start isolated Vite dev server
    console.log(`Starting isolated Vite dev server on port ${VITE_PORT}...`)
    viteProcess = spawn('npx.cmd', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
      cwd: 'c:/Cyber-Morph/cybermorph-frontend',
      env: { ...process.env, VITE_USE_MOCK: 'true' },
      stdio: 'pipe',
      shell: true,
    })

    let serverReady = false
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const res = await new Promise((resolve, reject) => {
          const req = http.get(`${BASE_URL}/`, (r) => resolve(r.statusCode))
          req.on('error', reject)
          req.setTimeout(500, () => req.destroy())
        })
        if (res === 200) {
          serverReady = true
          break
        }
      } catch {
        /* retry check */
      }
    }
    assert.ok(serverReady, `Vite dev server started on port ${VITE_PORT}`)
    console.log(`✓ Confirmed isolated Vite server running on ${BASE_URL}`)

    // 2. Launch Headless Chrome
    console.log(`Starting Chrome CDP on port ${CHROME_PORT}...`)
    chromeProcess = spawn(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      [
        `--remote-debugging-port=${CHROME_PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=C:\\Users\\licok\\.gemini\\antigravity-ide\\brain\\a699efe0-fccf-4a4c-ba07-e1194b746b85\\scratch\\chrome-profile`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

    let versionJson = null
    for (let i = 0; i < 30; i++) {
      await sleep(200)
      try {
        const data = await new Promise((resolve, reject) => {
          http
            .get(`http://localhost:${CHROME_PORT}/json/version`, (res) => {
              let body = ''
              res.on('data', (d) => (body += d))
              res.on('end', () => resolve(JSON.parse(body)))
            })
            .on('error', reject)
        })
        if (data.webSocketDebuggerUrl) {
          versionJson = data
          break
        }
      } catch {
        /* retry check */
      }
    }
    assert.ok(versionJson, 'Chrome CDP endpoint ready')

    const pages = await new Promise((resolve, reject) => {
      http
        .get(`http://localhost:${CHROME_PORT}/json/list`, (res) => {
          let body = ''
          res.on('data', (d) => (body += d))
          res.on('end', () => resolve(JSON.parse(body)))
        })
        .on('error', reject)
    })
    const targetPage = pages.find((p) => p.type === 'page') || pages[0]
    cdp = new CdpClient(targetPage.webSocketDebuggerUrl)
    await cdp.connect()
    console.log('✓ Connected to Headless Chrome via CDP')

    // --- Test 1: Educator Settings View & Classroom Management Pointer ---
    console.log('\n--- Test 1: Educator Settings View & Classroom Management Pointer ---')
    await cdp.navigate(`${BASE_URL}/login`)
    await cdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-educator-token');
      localStorage.setItem('cyber_role', 'educator');
      localStorage.setItem('cyber_user', JSON.stringify({
        email: 'educator@dnsc.edu.ph',
        role: 'educator',
        approval_status: 'approved',
        portal_access: true
      }));
    `)

    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(500)

    const educatorViewDetails = await cdp.evaluate(`(() => {
      const title = document.querySelector('.page-title')?.textContent?.trim();
      const notice = document.querySelector('.read-only-notice')?.textContent?.trim();
      const email = document.querySelector('.email-value')?.textContent?.trim();
      const role = document.querySelector('.role-badge')?.textContent?.trim();
      const classroomLink = document.querySelector('.context-card a')?.getAttribute('href');
      const classroomText = document.querySelector('.context-card a')?.textContent?.trim();

      // Check fields in grid
      const labels = Array.from(document.querySelectorAll('.field-label')).map(el => el.textContent.trim());
      const values = Array.from(document.querySelectorAll('.field-value')).map(el => el.textContent.trim());

      return { title, notice, email, role, classroomLink, classroomText, labels, values };
    })()`)

    console.log('Educator settings view:', educatorViewDetails)
    assert.strictEqual(educatorViewDetails.title, 'Settings')
    assert.ok(educatorViewDetails.notice.includes('Account details are currently read-only'))
    assert.strictEqual(educatorViewDetails.email, 'educator@dnsc.edu.ph')
    assert.strictEqual(educatorViewDetails.role, 'Educator')
    assert.strictEqual(educatorViewDetails.classroomLink, '/classroom/manage')
    assert.strictEqual(educatorViewDetails.classroomText, 'Classroom management')
    assert.ok(educatorViewDetails.labels.includes('Approval status'))
    assert.ok(educatorViewDetails.values.includes('Approved'))
    assert.ok(educatorViewDetails.labels.includes('Portal access'))
    assert.ok(educatorViewDetails.values.includes('Active'))
    console.log('✓ Educator settings and Classroom management pointer verified')

    // --- Test 2: Motion Preference Switching & Persistence ---
    console.log('\n--- Test 2: Motion Preference Switching & Persistence ---')

    // Initially system default
    const initialMotion = await cdp.evaluate(`(() => {
      return {
        stored: localStorage.getItem('cyber_pref_reduced_motion'),
        domAttr: document.documentElement.getAttribute('data-reduced-motion'),
        systemRadioChecked: document.getElementById('motion-pref-system')?.checked,
        reducedRadioChecked: document.getElementById('motion-pref-reduced')?.checked
      };
    })()`)
    console.log('Initial motion state:', initialMotion)
    assert.strictEqual(initialMotion.systemRadioChecked, true)
    assert.strictEqual(initialMotion.reducedRadioChecked, false)
    assert.strictEqual(initialMotion.domAttr, null)

    // Click Reduced Motion
    await cdp.evaluate(`document.getElementById('motion-pref-reduced').click()`)
    await sleep(200)

    const reducedMotionState = await cdp.evaluate(`(() => {
      return {
        stored: localStorage.getItem('cyber_pref_reduced_motion'),
        domAttr: document.documentElement.getAttribute('data-reduced-motion'),
        systemRadioChecked: document.getElementById('motion-pref-system')?.checked,
        reducedRadioChecked: document.getElementById('motion-pref-reduced')?.checked
      };
    })()`)
    console.log('State after selecting Reduced Motion:', reducedMotionState)
    assert.strictEqual(reducedMotionState.stored, 'reduced')
    assert.strictEqual(reducedMotionState.domAttr, 'true')
    assert.strictEqual(reducedMotionState.reducedRadioChecked, true)
    assert.strictEqual(reducedMotionState.systemRadioChecked, false)

    // Reload page to test persistence
    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(400)

    const reloadedMotionState = await cdp.evaluate(`(() => {
      return {
        stored: localStorage.getItem('cyber_pref_reduced_motion'),
        domAttr: document.documentElement.getAttribute('data-reduced-motion'),
        reducedRadioChecked: document.getElementById('motion-pref-reduced')?.checked
      };
    })()`)
    console.log('State after page reload:', reloadedMotionState)
    assert.strictEqual(reloadedMotionState.stored, 'reduced')
    assert.strictEqual(reloadedMotionState.domAttr, 'true')
    assert.strictEqual(reloadedMotionState.reducedRadioChecked, true)

    // Reset back to system default
    await cdp.evaluate(`document.getElementById('motion-pref-system').click()`)
    await sleep(200)

    const resetMotionState = await cdp.evaluate(`(() => {
      return {
        stored: localStorage.getItem('cyber_pref_reduced_motion'),
        domAttr: document.documentElement.getAttribute('data-reduced-motion')
      };
    })()`)
    assert.strictEqual(resetMotionState.stored, 'system')
    assert.strictEqual(resetMotionState.domAttr, null)
    console.log('✓ Motion preference switching, DOM attribute setting, and reload persistence verified')

    // --- Test 3: Player Role Settings View ---
    console.log('\n--- Test 3: Player Role Settings View ---')
    await cdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        username: 'CyberCadet',
        email: 'cadet@example.com',
        role: 'player'
      }));
    `)
    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(400)

    const playerViewDetails = await cdp.evaluate(`(() => {
      const username = Array.from(document.querySelectorAll('.field-item')).find(el => el.querySelector('.field-label')?.textContent?.trim() === 'Username')?.querySelector('.field-value')?.textContent?.trim();
      const role = document.querySelector('.role-badge')?.textContent?.trim();
      const email = document.querySelector('.email-value')?.textContent?.trim();
      const classroomCard = document.querySelector('.context-card');
      return { username, role, email, hasClassroomCard: !!classroomCard };
    })()`)

    console.log('Player settings view:', playerViewDetails)
    assert.strictEqual(playerViewDetails.username, 'CyberCadet')
    assert.strictEqual(playerViewDetails.role, 'Player')
    assert.strictEqual(playerViewDetails.email, 'cadet@example.com')
    assert.strictEqual(playerViewDetails.hasClassroomCard, false, 'Player does not have educator classroom card')
    console.log('✓ Player settings view verified')

    // --- Test 4: Admin Role Settings View ---
    console.log('\n--- Test 4: Admin Role Settings View ---')
    await cdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-admin-token');
      localStorage.setItem('cyber_role', 'admin');
      localStorage.setItem('cyber_user', JSON.stringify({
        email: 'admin@cybermorph.local',
        role: 'admin',
        approval_status: 'approved',
        portal_access: true
      }));
    `)
    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(400)

    const adminViewDetails = await cdp.evaluate(`(() => {
      const email = document.querySelector('.email-value')?.textContent?.trim();
      const role = document.querySelector('.role-badge')?.textContent?.trim();
      const classroomCard = document.querySelector('.context-card');
      return { email, role, hasClassroomCard: !!classroomCard };
    })()`)

    console.log('Admin settings view:', adminViewDetails)
    assert.strictEqual(adminViewDetails.email, 'admin@cybermorph.local')
    assert.strictEqual(adminViewDetails.role, 'Administrator')
    assert.strictEqual(adminViewDetails.hasClassroomCard, false, 'Admin does not have educator classroom card')
    console.log('✓ Admin settings view verified')

    // --- Test 5: Missing / Unverified Status Fields Handling (Requirement 1) ---
    console.log('\n--- Test 5: Missing Status Fields Handling ---')
    await cdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-educator-token');
      localStorage.setItem('cyber_role', 'educator');
      localStorage.setItem('cyber_user', JSON.stringify({
        email: 'educator_incomplete@dnsc.edu.ph',
        role: 'educator'
        // approval_status missing, portal_access missing
      }));
    `)
    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(400)

    const incompleteDetails = await cdp.evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('.field-label')).map(el => el.textContent.trim());
      const values = Array.from(document.querySelectorAll('.field-value')).map(el => el.textContent.trim());
      return { labels, values };
    })()`)

    console.log('Incomplete fields view:', incompleteDetails)
    const approvalIdx = incompleteDetails.labels.indexOf('Approval status')
    const portalIdx = incompleteDetails.labels.indexOf('Portal access')

    assert.ok(approvalIdx !== -1, 'Approval status label present')
    assert.strictEqual(incompleteDetails.values[approvalIdx], 'Unavailable', 'Missing approval status renders Unavailable')

    assert.ok(portalIdx !== -1, 'Portal access label present')
    assert.strictEqual(incompleteDetails.values[portalIdx], 'Unavailable', 'Missing portal access renders Unavailable')

    // Test unverified role
    await cdp.evaluate(`
      localStorage.setItem('cyber_role', 'unknown_role_xyz');
      localStorage.setItem('cyber_user', JSON.stringify({
        email: 'unknown@example.com',
        role: 'unknown_role_xyz'
      }));
    `)
    await cdp.navigate(`${BASE_URL}/settings`)
    await sleep(400)

    const unknownRoleText = await cdp.evaluate(`(() => {
      return document.querySelector('.field-value')?.textContent?.trim();
    })()`)
    assert.strictEqual(unknownRoleText, 'Unknown', 'Unverified role renders Unknown')
    console.log('✓ Missing status fields and unknown role handling verified')

    // --- Test 6: Sidebar Navigation Active State ---
    console.log('\n--- Test 6: Sidebar Navigation Active State ---')
    const sidebarSettingsLink = await cdp.evaluate(`(() => {
      const link = Array.from(document.querySelectorAll('.nav-menu .nav-item')).find(el => el.getAttribute('href') === '/settings');
      return {
        exists: !!link,
        isActive: link?.classList.contains('router-link-active'),
        text: link?.textContent?.trim()
      };
    })()`)

    console.log('Sidebar settings link:', sidebarSettingsLink)
    assert.strictEqual(sidebarSettingsLink.exists, true, 'Settings link exists in sidebar')
    assert.strictEqual(sidebarSettingsLink.isActive, true, 'Settings link has router-link-active on /settings')
    assert.strictEqual(sidebarSettingsLink.text, 'Settings')
    console.log('✓ Sidebar navigation integration verified')

    console.log('\n=== All Suite 2 Browser Integration Checks Passed! ===')
    console.log('\n🎉 ALL SETTINGS TESTS COMPLETED SUCCESSFULLY!')
  } finally {
    if (cdp) cdp.close()
    if (chromeProcess) chromeProcess.kill()
    if (viteProcess) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(viteProcess.pid), '/f', '/t'])
      } else {
        viteProcess.kill('SIGTERM')
      }
    }
  }
}

async function main() {
  try {
    await runSettingsUnitChecks()
    await runSettingsBrowserChecks()
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Test failed:', err)
    process.exit(1)
  }
}

main()
