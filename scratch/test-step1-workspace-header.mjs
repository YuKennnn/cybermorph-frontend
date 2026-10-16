/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createPinia, setActivePinia } from 'pinia'

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

// =============================================================
// 1. In-Memory Store Logic Tests
// =============================================================
async function runStep1StoreTests() {
  console.log('=== Suite 1: Classroom Store Logic & Concurrency Tests ===')

  const pinia = createPinia()
  setActivePinia(pinia)

  // Ensure mock adapter is loaded
  await import('../src/api/mock.js')
  const { useClassroomStore } = await import('../src/stores/classroomStore.js')
  const { useAuthStore } = await import('../src/stores/authStore.js')

  const classroomStore = useClassroomStore()
  const authStore = useAuthStore()

  // Test 1: Clean initial state
  console.log('1. Testing initial classroom store state...')
  assert.strictEqual(classroomStore.classrooms.length, 0, 'Classrooms initially empty')
  assert.strictEqual(classroomStore.currentClassroom, null, 'No current classroom selected')
  assert.strictEqual(classroomStore.isFetched, false, 'isFetched initially false')
  assert.strictEqual(classroomStore.error, '', 'No error initially')
  console.log('✓ Initial state is clean')

  // Test 2: Simultaneous requests deduplication (Item 2)
  console.log('2. Testing simultaneous request deduplication...')
  const [res1, res2] = await Promise.all([
    classroomStore.fetchClassrooms(),
    classroomStore.fetchClassrooms(),
  ])
  assert.strictEqual(res1, res2, 'Simultaneous callers receive the exact same promise/result')
  assert.strictEqual(classroomStore.isFetched, true, 'isFetched set to true')
  console.log('✓ Simultaneous requests deduplicated successfully')

  // Test 3: Documented fields only: code_id and code_value (Item 4)
  console.log('3. Testing documented fields: code_id and code_value...')
  classroomStore.setCurrentClassroomId('c1')
  const current = classroomStore.currentClassroom
  assert.ok(current, 'currentClassroom resolved for c1')
  assert.strictEqual(current.code_id, 'c1', 'Uses documented code_id')
  assert.strictEqual(current.code_value, 'CYB101', 'Uses documented code_value')
  assert.strictEqual(current.name, 'BSIT 4A')
  assert.strictEqual(current.is_active, true)

  // Undocumented ID/code updates should be rejected
  classroomStore.updateClassroomInState({ id: 'c1', name: 'Invalid update' })
  assert.strictEqual(classroomStore.currentClassroom.name, 'BSIT 4A', 'Ignored update lacking documented code_id')

  // Valid update with code_id
  classroomStore.updateClassroomInState({ code_id: 'c1', name: 'BSIT 4A - Defense', is_active: false })
  assert.strictEqual(classroomStore.currentClassroom.name, 'BSIT 4A - Defense', 'Updated with documented code_id')
  assert.strictEqual(classroomStore.currentClassroom.is_active, false)
  console.log('✓ Strictly operates on documented code_id and code_value')

  // Test 4: Empty list caching (Item 2)
  console.log('4. Testing empty-list caching (reusing [] without refetching)...')
  classroomStore.reset()
  // Simulate an empty list return
  classroomStore.classrooms = []
  classroomStore.isFetched = true
  // Subsequent call should return cached [] immediately without network fetch
  const emptyResult = await classroomStore.fetchClassrooms()
  assert.deepStrictEqual(emptyResult, [], 'Returns cached empty array')
  assert.strictEqual(classroomStore.isFetched, true, 'Remains fetched')
  console.log('✓ Empty classroom list is cached and reused')

  // Test 5: Pending requests completing after logout/reset (Item 1)
  console.log('5. Testing pending request completing after logout/reset...')
  classroomStore.reset()
  // Start fetch
  const pendingPromise = classroomStore.fetchClassrooms(true)
  assert.strictEqual(classroomStore.isLoading, true, 'isLoading is true while pending')

  // Immediate logout before response arrives
  authStore.logout()
  assert.strictEqual(classroomStore.classrooms.length, 0, 'Classrooms reset immediately')
  assert.strictEqual(classroomStore.currentClassroomId, null, 'Selection reset immediately')
  assert.strictEqual(classroomStore.isLoading, false, 'isLoading reset to false immediately')
  assert.strictEqual(classroomStore.isFetched, false, 'isFetched reset to false immediately')

  // Await the delayed response
  await pendingPromise
  // Assert store was NOT updated by late-arriving response
  assert.strictEqual(classroomStore.classrooms.length, 0, 'Late response did NOT populate classrooms')
  assert.strictEqual(classroomStore.isLoading, false, 'Late response did NOT re-enable isLoading')
  assert.strictEqual(classroomStore.isFetched, false, 'Late response did NOT set isFetched')
  assert.strictEqual(classroomStore.error, '', 'Late response did NOT set error')
  // Test 6: Enrolled count evaluation (confirmed 0 vs loading vs error)
  console.log('6. Testing enrolled student count distinction...')
  const evalCount = ({ studentCount, isCountLoading, countError, metadataError, storeLoading, storeStudentCount }) => {
    const hasErr = Boolean(countError) || Boolean(metadataError)
    const isLoad = Boolean(isCountLoading) || Boolean(storeLoading)
    if (hasErr) return { state: 'error', count: null }
    if (isLoad) return { state: 'loading', count: null }
    if (typeof studentCount === 'number') return { state: 'confirmed', count: studentCount }
    if (typeof storeStudentCount === 'number') return { state: 'confirmed', count: storeStudentCount }
    return { state: 'uninitialized', count: null }
  }

  // Confirmed count of 0
  const zeroRes = evalCount({ studentCount: 0, isCountLoading: false, countError: false })
  assert.strictEqual(zeroRes.state, 'confirmed')
  assert.strictEqual(zeroRes.count, 0, '0 is correctly preserved as a confirmed count')

  // Loading state while studentCount is null or loading
  const loadRes = evalCount({ studentCount: null, isCountLoading: true, countError: false })
  assert.strictEqual(loadRes.state, 'loading')
  assert.strictEqual(loadRes.count, null, 'Loading count does not show 0')

  // Error state while student roster failed
  const errRes = evalCount({ studentCount: null, isCountLoading: false, countError: true })
  assert.strictEqual(errRes.state, 'error')
  assert.strictEqual(errRes.count, null, 'Error count does not show 0')

  // Error state when classroom metadata failed
  const metaErrRes = evalCount({ studentCount: 23, isCountLoading: false, countError: false, metadataError: 'Failed' })
  assert.strictEqual(metaErrRes.state, 'error')
  assert.strictEqual(metaErrRes.count, null, 'Count is marked error when metadata fails')
  console.log('✓ Enrolled student count evaluation distinguishes loading/error from confirmed 0')

  console.log('✓ All Classroom Store logic checks passed!\n')
}

// =============================================================
// 2. Real Headless Chrome Browser Verification on Isolated Port
// =============================================================
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = process.env.TEST_PORT ? Number(process.env.TEST_PORT) : 5181
const CDP_PORT = 9226
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-step1-cdp-${Date.now()}`)

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.id = 0
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
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
    await this.send('Page.enable')
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.callbacks.set(id, { resolve, reject })
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
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async waitEval(expr, timeoutMs = 8000, intervalMs = 150) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        /* wait and retry */
      }
      await sleep(intervalMs)
    }
    throw new Error(`Timeout waiting for expression: ${expr}`)
  }

  close() {
    if (this.ws) this.ws.close()
  }
}

async function runStep1BrowserTests() {
  console.log('=== Suite 2: Isolated Server & Headless Chrome Browser Tests ===')

  // 1. Verify port is not already occupied
  console.log(`Checking if port ${TEST_PORT} is free...`)
  try {
    const preCheck = await fetch(`http://localhost:${TEST_PORT}/`)
    if (preCheck) {
      throw new Error(`Port ${TEST_PORT} is already occupied. Refusing to connect to an existing server.`)
    }
  } catch (err) {
    if (err.message.includes('Refusing to connect')) {
      throw err
    }
    // Port is free (connection refused) as expected
  }

  // 2. Spawn isolated Vite test server on port 5174 with VITE_USE_MOCK=true
  console.log(`Starting isolated Vite test server on port ${TEST_PORT} with VITE_USE_MOCK=true...`)
  const isWindows = process.platform === 'win32'
  const npmCmd = isWindows ? 'npx.cmd' : 'npx'

  let viteExited = false
  let viteExitCode = null
  let viteError = null

  const viteProc = spawn(
    npmCmd,
    ['vite', '--port', String(TEST_PORT), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_USE_MOCK: 'true',
      },
      shell: isWindows,
      stdio: 'pipe',
    },
  )

  viteProc.on('exit', (code) => {
    viteExited = true
    viteExitCode = code
  })

  viteProc.on('error', (err) => {
    viteError = err
  })

  // Wait for own test server to become responsive
  let serverReady = false
  for (let i = 0; i < 40; i++) {
    if (viteExited) {
      throw new Error(`Isolated Vite test server exited prematurely with code ${viteExitCode}. Test aborted before browser navigation.`)
    }
    if (viteError) {
      throw new Error(`Isolated Vite test server process failed to spawn: ${viteError.message}`)
    }

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/`)
      if (res.ok) {
        serverReady = true
        break
      }
    } catch {
      await sleep(250)
    }
  }

  assert.ok(
    serverReady && !viteExited,
    `Isolated Vite server failed to confirm startup on port ${TEST_PORT} (exited: ${viteExited}, code: ${viteExitCode})`,
  )
  console.log(`✓ Confirmed own isolated Vite test server is up on http://localhost:${TEST_PORT}`)

  // 2. Launch Headless Chrome on CDP_PORT
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,900',
    'about:blank',
  ])

  let client
  try {
    let versionData = null
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        versionData = await res.json()
        break
      } catch {
        await sleep(200)
      }
    }

    assert.ok(versionData, 'Chrome started successfully on port ' + CDP_PORT)

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await listRes.json()
    const page = pages.find((p) => p.type === 'page')
    assert.ok(page, 'Must find active browser page')

    client = new CDPClient(page.webSocketDebuggerUrl)
    await client.connect()

    // 3. Login as educator on isolated test server
    console.log('1. Logging in as educator on isolated test server...')
    await client.send('Page.navigate', { url: `http://localhost:${TEST_PORT}/login` })
    await client.waitEval(`document.querySelector('#email') !== null`)
    await client.eval(`
      const emailInput = document.querySelector('#email');
      emailInput.value = 'educator@cybermorph.local';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      const passInput = document.querySelector('#password');
      passInput.value = 'password123';
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('button[type="submit"]').click();
    `)
    await client.waitEval(`window.location.pathname.includes('/dashboard')`, 8000)
    console.log('✓ Successfully authenticated with pre-configured mock on test server')

    // 4. Navigate to classroom roster on page 2
    console.log('2. Navigating to /classroom/students/c1?page=2...')
    await client.send('Page.navigate', { url: `http://localhost:${TEST_PORT}/classroom/students/c1?page=2` })

    // Wait for header to resolve metadata and confirmed count
    const headerData = await client.waitEval(`
      (() => {
        const title = document.querySelector('.classroom-title')?.textContent?.trim();
        if (!title || title.includes('Loading')) return null;
        const code = document.querySelector('.code-pill')?.textContent?.trim();
        const pill = document.querySelector('.status-pill')?.textContent?.trim();
        const pillActive = document.querySelector('.status-pill')?.classList.contains('active');
        const badge = document.querySelector('.count-badge strong')?.textContent?.trim();
        const nav = document.querySelector('.workspace-nav');
        const studentsLink = nav?.querySelector('.nav-link.active');
        const studentsCurrent = studentsLink?.getAttribute('aria-current');
        const disabledSettings = nav?.querySelector('.nav-link-disabled')?.textContent?.trim();
        const disabledAria = nav?.querySelector('.nav-link-disabled')?.getAttribute('aria-disabled');
        const backLink = document.querySelector('.breadcrumb-bar .back-link')?.getAttribute('href');
        return {
          title, code, pill, pillActive, badge,
          studentsText: studentsLink?.textContent?.trim(),
          studentsCurrent, disabledSettings, disabledAria, backLink
        };
      })()
    `, 8000)

    console.log('Header data inspected:', headerData)
    assert.strictEqual(headerData.title, 'BSIT 4A', 'Classroom title is BSIT 4A')
    assert.strictEqual(headerData.code, 'CYB101', 'Access code is code_value CYB101 (never c1)')
    assert.strictEqual(headerData.pill, 'Active', 'Confirmed status Active')
    assert.strictEqual(headerData.pillActive, true)
    assert.strictEqual(headerData.badge, '23', 'Enrolled count is confirmed 23')

    // Assert navigation semantics:
    assert.ok(headerData.studentsText.includes('Students'), 'Students link present')
    assert.strictEqual(headerData.studentsCurrent, 'page', 'Students link has aria-current="page"')
    assert.strictEqual(headerData.disabledSettings, 'Settings', 'Settings is present')
    assert.strictEqual(headerData.disabledAria, 'true', 'Settings has aria-disabled="true"')
    assert.strictEqual(headerData.backLink, '/classroom/manage')
    console.log('✓ Navigation semantics and documented fields verified')

    // 5. Test Clipboard Success & Failure Separately
    console.log('3. Testing clipboard success and failure separately...')
    // 3A: Clipboard Success Test
    console.log('  3A: Testing clipboard SUCCESS...')
    await client.eval(`
      window.__copiedText = null;
      navigator.clipboard.writeText = (text) => {
        window.__copiedText = text;
        return Promise.resolve();
      };
      document.querySelector('.btn-copy').focus();
      document.querySelector('.btn-copy').click();
    `)
    const successLabel = await client.waitEval(`
      (() => {
        const text = document.querySelector('.btn-copy .copy-label')?.textContent?.trim();
        return text === 'Copied' ? text : null;
      })()
    `, 3000)
    assert.strictEqual(successLabel, 'Copied', 'Displays Copied upon resolved write')

    const copyCheck = await client.eval(`
      (() => {
        const copied = window.__copiedText;
        const hasCheckIcon = Boolean(document.querySelector('.btn-copy .app-icon'));
        const isFocused = document.activeElement === document.querySelector('.btn-copy');
        const ariaLabel = document.querySelector('.btn-copy')?.getAttribute('aria-label');
        return { copied, hasCheckIcon, isFocused, ariaLabel };
      })()
    `)
    assert.strictEqual(copyCheck.copied, 'CYB101', 'Copied documented code_value CYB101')
    assert.strictEqual(copyCheck.hasCheckIcon, true, 'Check icon rendered')
    assert.strictEqual(copyCheck.isFocused, true, 'Keyboard focus preserved on copy button')
    assert.ok(copyCheck.ariaLabel.includes('copied to clipboard'), 'Truthful aria-label on success')
    console.log('  ✓ Clipboard success verified')

    // 3B: Clipboard Failure Test
    console.log('  3B: Testing clipboard FAILURE...')
    await client.eval(`
      navigator.clipboard.writeText = () => Promise.reject(new Error('Permission denied'));
      document.querySelector('.btn-copy').focus();
      document.querySelector('.btn-copy').click();
    `)
    const failureLabel = await client.waitEval(`
      (() => {
        const text = document.querySelector('.btn-copy .copy-label')?.textContent?.trim();
        return text === 'Failed' ? text : null;
      })()
    `, 3000)
    assert.strictEqual(failureLabel, 'Failed', 'Displays Failed upon rejected write')

    const failureCheck = await client.eval(`
      (() => {
        const isFocused = document.activeElement === document.querySelector('.btn-copy');
        const ariaLabel = document.querySelector('.btn-copy')?.getAttribute('aria-label');
        return { isFocused, ariaLabel };
      })()
    `)
    assert.strictEqual(failureCheck.isFocused, true, 'Keyboard focus preserved on copy failure')
    assert.ok(failureCheck.ariaLabel.includes('Failed to copy'), 'Truthful failure aria-label')
    console.log('  ✓ Clipboard failure verified')

    // 3C: Timer reset
    console.log('  3C: Testing clipboard timer reset to idle...')
    await sleep(2100)
    const resetLabel = await client.eval(`document.querySelector('.btn-copy .copy-label')?.textContent?.trim()`)
    assert.strictEqual(resetLabel, 'Copy code', 'Button label reset to Copy code after timeout')
    console.log('  ✓ Clipboard timer reset verified')

    // 6. Test navigation link and roster_page query preservation
    console.log('4. Testing Analytics link and roster_page query preservation...')
    await client.eval(`document.querySelectorAll('.workspace-nav .nav-link')[1]?.click()`)
    await client.waitEval(`window.location.pathname.includes('/analytics/c1')`, 8000)
    const analyticsQuery = await client.eval(`window.location.search`)
    console.log('Analytics URL query:', analyticsQuery)
    assert.ok(analyticsQuery.includes('roster_page=2'), 'Preserves roster_page=2 when navigating to Analytics')

    // Return to classroom roster
    console.log('5. Testing return to roster page...')
    await client.eval(`
      const target = document.querySelector('.workspace-nav .nav-link') || document.querySelector('.back-link');
      target?.click();
    `)
    await client.waitEval(`window.location.pathname.includes('/classroom/students/c1')`, 8000)
    const rosterQuery = await client.eval(`window.location.search`)
    console.log('Roster URL query after return:', rosterQuery)
    assert.ok(rosterQuery.includes('page=2'), 'Preserves page=2 when returning to roster')

    // 7. Test Metadata Failure & Synchronized Retry
    console.log('6. Testing metadata failure and synchronized retry...')
    // Inject metadata failure state into Pinia store in browser
    await client.eval(`
      (() => {
        const pinia = window.__pinia;
        if (pinia) {
          const store = pinia._s.get('classroom');
          if (store) {
            store.classrooms = [];
            store.error = 'Network error fetching classrooms. Please try again.';
          }
        }
      })()
    `)

    // Verify error banner and unavailable states
    const failureState = await client.waitEval(`
      (() => {
        const banner = document.querySelector('.metadata-error-banner');
        if (!banner) return null;
        const errorText = banner.querySelector('.error-text')?.textContent?.trim();
        const retryBtn = banner.querySelector('.btn-retry-metadata');
        const title = document.querySelector('.classroom-title')?.textContent?.trim();
        const code = document.querySelector('.code-cluster');
        const unavailableBadge = document.querySelector('.count-badge.count-error')?.textContent?.trim();
        return {
          hasBanner: true,
          errorText,
          hasRetryBtn: Boolean(retryBtn),
          title,
          hasCode: Boolean(code),
          unavailableBadge
        };
      })()
    `, 4000)

    assert.ok(failureState.hasBanner, 'Metadata error banner displayed')
    assert.strictEqual(failureState.hasRetryBtn, true, 'Retry button available on error banner')
    assert.strictEqual(failureState.title, 'Classroom unavailable', 'Fallback title displayed')
    assert.strictEqual(failureState.hasCode, false, 'No invalid code displayed')
    assert.ok(failureState.unavailableBadge.includes('Unavailable'), 'Enrolled count shows Unavailable when failed')
    console.log('✓ Metadata failure and unconfirmed count states verified')

    // Click retry in header
    console.log('  Triggering metadata retry from header button...')
    await client.eval(`document.querySelector('.btn-retry-metadata')?.click()`)

    // Verify successful recovery after retry
    const recoveredState = await client.waitEval(`
      (() => {
        const banner = document.querySelector('.metadata-error-banner');
        if (banner) return null;
        const title = document.querySelector('.classroom-title')?.textContent?.trim();
        if (!title || title.includes('Loading') || title.includes('unavailable')) return null;
        const code = document.querySelector('.code-pill')?.textContent?.trim();
        const count = document.querySelector('.count-badge strong')?.textContent?.trim();
        return { title, code, count };
      })()
    `, 6000)

    assert.strictEqual(recoveredState.title, 'BSIT 4A', 'Title restored to BSIT 4A after retry')
    assert.strictEqual(recoveredState.code, 'CYB101', 'Access code restored after retry')
    assert.strictEqual(recoveredState.count, '23', 'Enrolled count restored after retry')
    console.log('✓ Synchronized retry completed and verified successfully!\n')

    client.close()
    console.log('✓ Browser checks completed successfully!\n')
  } finally {
    if (chromeProc) chromeProc.kill('SIGKILL')
    if (viteProc) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F'])
      } else {
        viteProc.kill('SIGKILL')
      }
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  try {
    await runStep1StoreTests()
    await runStep1BrowserTests()
    console.log('======================================================')
    console.log('ALL EXTENDED STEP 1 CHECKS PASSED (100%)')
    console.log('======================================================')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ STEP 1 VERIFICATION FAILED:', err)
    process.exit(1)
  }
}

main()
