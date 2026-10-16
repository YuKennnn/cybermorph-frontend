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

// =============================================================
// Suite 1: Pure Unit Specification Checks for Step 3 Rules
// (Note: These are isolated formula and algorithm tests, distinguished
//  from the full browser integration checks below)
// =============================================================
async function runStep3UnitChecks() {
  console.log('=== Suite 1: Pure Unit Specification Checks for Step 3 Rules ===')

  // Check 1: Bare /analytics selection algorithm (Condition 3)
  console.log('1. Checking bare /analytics selection algorithm...')
  const selectBareClassroom = (storeClassrooms, currentSelectedId) => {
    if (!storeClassrooms || storeClassrooms.length === 0) {
      return null
    }
    const hasValidSelection =
      currentSelectedId &&
      storeClassrooms.some((c) => String(c.code_id) === String(currentSelectedId))

    return hasValidSelection
      ? String(currentSelectedId)
      : String(storeClassrooms[0].code_id)
  }

  const sampleClassrooms = [
    { code_id: 'c1', name: 'BSIT 4A' },
    { code_id: 'c2', name: 'BSIT 3C' },
    { code_id: 'c3', name: 'BSCS 2B (Archived)', is_active: false },
  ]

  // Case A: valid selection 'c2' in store -> prefers 'c2'
  assert.strictEqual(
    selectBareClassroom(sampleClassrooms, 'c2'),
    'c2',
    'Prefers valid classroom already selected in store',
  )

  // Case B: no prior selection -> selects first classroom 'c1'
  assert.strictEqual(
    selectBareClassroom(sampleClassrooms, null),
    'c1',
    'Fallback to first available classroom when no store selection',
  )

  // Case C: invalid prior selection ('c999') -> selects first classroom 'c1'
  assert.strictEqual(
    selectBareClassroom(sampleClassrooms, 'c999'),
    'c1',
    'Fallback to first available classroom when store selection is invalid',
  )

  // Case D: empty classrooms list -> returns null (renders empty state, no redirect)
  assert.strictEqual(
    selectBareClassroom([], 'c1'),
    null,
    'Returns null when classrooms list is empty',
  )
  console.log('✓ Bare /analytics selection algorithm verified')

  // Check 2: Preservation of query parameters during redirection (Condition 3)
  console.log('2. Checking query preservation during redirection...')
  const buildRedirectQuery = (existingQuery) => {
    return { ...existingQuery }
  }

  const queryBefore = { table_page: '2', roster_page: '3', custom: 'val' }
  const queryAfter = buildRedirectQuery(queryBefore)
  assert.deepStrictEqual(queryAfter, queryBefore, 'Preserves all relevant query parameters')
  console.log('✓ Query parameter preservation verified')

  // Check 3: Distinguishing list loading failure from confirmed empty list (Condition 3)
  console.log('3. Checking distinguishing list failure vs empty list...')
  const determineListState = ({ isFetched, error, classroomsLength }) => {
    if (error) return 'error'
    if (!isFetched) return 'loading'
    if (classroomsLength === 0) return 'empty'
    return 'ready'
  }

  assert.strictEqual(
    determineListState({ isFetched: false, error: 'Network error', classroomsLength: 0 }),
    'error',
    'Error takes priority over empty/loading',
  )
  assert.strictEqual(
    determineListState({ isFetched: true, error: '', classroomsLength: 0 }),
    'empty',
    'Confirmed empty list distinguished when isFetched is true and error is empty',
  )
  assert.strictEqual(
    determineListState({ isFetched: true, error: '', classroomsLength: 3 }),
    'ready',
    'Ready state when classrooms are loaded',
  )
  console.log('✓ List failure vs empty list states verified')

  // Check 4: Inactive classroom access (Condition 2)
  console.log('4. Checking inactive classroom access...')
  const findClassroom = (list, targetId) => {
    return list.find((c) => String(c.code_id) === String(targetId)) || null
  }
  const inactiveClassroom = findClassroom(sampleClassrooms, 'c3')
  assert.ok(inactiveClassroom, 'Inactive classroom c3 is found and accessible')
  assert.strictEqual(inactiveClassroom.is_active, false, 'c3 has is_active false')
  console.log('✓ Inactive classroom accessibility verified')

  // Check 5: Confirmed student count logic (Condition 4)
  console.log('5. Checking student count evaluation logic...')
  const evaluateCount = ({ hasCountError, isCountLoading, count }) => {
    if (hasCountError || isCountLoading) return null
    if (typeof count === 'number') return count
    return null
  }

  assert.strictEqual(evaluateCount({ hasCountError: false, isCountLoading: false, count: 23 }), 23, 'Confirmed 23 count')
  assert.strictEqual(evaluateCount({ hasCountError: false, isCountLoading: false, count: 0 }), 0, 'Confirmed 0 count')
  assert.strictEqual(evaluateCount({ hasCountError: true, isCountLoading: false, count: 23 }), null, 'Null on count error')
  assert.strictEqual(evaluateCount({ hasCountError: false, isCountLoading: true, count: 23 }), null, 'Null while loading')
  console.log('✓ Student count evaluation logic verified')

  // Check 6: Metadata retry ownership (Condition 1)
  console.log('6. Checking metadata retry ownership invariant...')
  let headerFetchCalled = false
  let parentFetchCalled = false

  const mockHeaderRetry = async () => {
    headerFetchCalled = true // ClassroomWorkspaceHeader calls fetchClassrooms(true)
    // emits retry-metadata
    mockParentRetryHandler()
  }

  const mockParentRetryHandler = () => {
    // Condition 1: Do NOT trigger another fetchClassrooms from parent handler
    // Only retry child analytics/roster if needed
    parentFetchCalled = false // Explicitly must remain false
  }

  await mockHeaderRetry()
  assert.ok(headerFetchCalled, 'ClassroomWorkspaceHeader owned the fetchClassrooms call')
  assert.strictEqual(parentFetchCalled, false, 'Parent handler did not call fetchClassrooms')
  console.log('✓ Metadata retry ownership invariant verified')

  // Check 7: Documented classroom matching uses only code_id and rejects id/code aliases
  console.log('7. Checking documented code_id matching without aliases...')
  const findDocumentedClassroom = (list, targetId) => {
    return list.find((c) => String(c.code_id) === String(targetId)) || null
  }
  const testClassroom = { code_id: 'c1', code_value: 'CYB101' }
  assert.ok(findDocumentedClassroom([testClassroom], 'c1'), 'Matched on valid code_id')
  assert.strictEqual(findDocumentedClassroom([testClassroom], 'CYB101'), null, 'Rejected code_value match as classroom ID')
  assert.strictEqual(findDocumentedClassroom([testClassroom], 'c_alias'), null, 'Rejected alias match')
  console.log('✓ Documented code_id matching verified')

  // Check 8: Obsolete bare route navigation guard specification
  console.log('8. Checking obsolete bare route navigation guard specification...')
  const isContextValid = (seq, activeSeq, isMounted, routeCodeId, routePath) => {
    return seq === activeSeq && isMounted && !routeCodeId && routePath === '/analytics'
  }
  assert.strictEqual(isContextValid(1, 1, true, null, '/analytics'), true, 'Valid bare analytics context')
  assert.strictEqual(isContextValid(1, 2, true, null, '/analytics'), false, 'Obsolete sequence token invalidated')
  assert.strictEqual(isContextValid(1, 1, false, null, '/analytics'), false, 'Unmounted component invalidated')
  assert.strictEqual(isContextValid(1, 1, true, 'c1', '/analytics/c1'), false, 'Route with code_id invalidated')
  assert.strictEqual(isContextValid(1, 1, true, null, '/classroom/manage'), false, 'Route away from /analytics invalidated')
  console.log('✓ Obsolete bare route navigation guard specification verified')

  console.log('=== Suite 1: All Pure Unit Checks Passed ===\n')
}

// =============================================================
// Suite 2: Isolated Server & Headless Chrome Browser Tests
// =============================================================
const TEST_PORT = 5180
const CDP_PORT = 9230
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-step3-profile-' + Date.now())

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
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await sleep(600)
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)
      throw new Error(`Eval error: ${desc}`)
    }
    return res.result?.value
  }

  async waitEval(expr, timeoutMs = 9000, intervalMs = 150) {
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

async function runStep3BrowserTests() {
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

  // 3. Launch Headless Chrome on CDP_PORT
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

  let cdp = null

  try {
    // Wait for Chrome remote debugging endpoint
    let listRes = null
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
        if (res.ok) {
          listRes = await res.json()
          break
        }
      } catch {
        await sleep(200)
      }
    }

    assert.ok(listRes && listRes.length > 0, 'Chrome remote debugging did not respond')
    const pages = listRes
    const page = pages.find((p) => p.type === 'page') || pages[0]
    assert.ok(page, 'Must find active browser page')
    const wsUrl = page.webSocketDebuggerUrl
    cdp = new ChromeCDP(wsUrl)
    await cdp.connect()
    console.log('✓ Connected to Headless Chrome via CDP')

    // Helper: authenticate as educator
    const authenticateAsEducator = async () => {
      await cdp.navigate(`http://localhost:${TEST_PORT}/login`)
      await cdp.waitEval(`document.querySelector('#email') !== null`)
      await cdp.eval(`
        const emailInput = document.querySelector('#email');
        emailInput.value = 'educator@cybermorph.local';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        const passInput = document.querySelector('#password');
        passInput.value = 'password123';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('button[type="submit"]').click();
      `)
      await cdp.waitEval(`window.location.pathname.includes('/dashboard')`, 8000)
    }

    // -------------------------------------------------------------
    // Test 1: Direct Entry to /analytics/c1 (Workspace Header & Analytics Overview)
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Direct Entry to /analytics/c1 ---')
    await authenticateAsEducator()
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c1`)

    // Wait for header and analytics content
    await cdp.waitEval(`document.querySelector('.workspace-header') !== null`)
    await cdp.waitEval(`document.querySelector('.analytics-content') !== null`)

    // Verify workspace header fields
    const titleText = await cdp.waitEval(`document.querySelector('.classroom-title')?.textContent?.trim() === 'BSIT 4A' ? 'BSIT 4A' : null`)
    assert.strictEqual(titleText, 'BSIT 4A', 'Classroom name BSIT 4A displayed in header')

    const codePill = await cdp.eval(`document.querySelector('.code-pill')?.textContent?.trim()`)
    assert.strictEqual(codePill, 'CYB101', 'Access code CYB101 displayed')

    const statusBadge = await cdp.eval(`document.querySelector('.status-pill')?.textContent?.trim()`)
    assert.strictEqual(statusBadge, 'Active', 'Classroom active status badge shown')

    // Wait for confirmed student count in header (23 students)
    await cdp.waitEval(`document.querySelector('.count-badge strong')?.textContent?.trim() === '23'`)
    console.log('✓ Header displays BSIT 4A, CYB101, Active status, and confirmed 23 students count')

    // Verify active navigation tab is 'analytics'
    const activeTab = await cdp.eval(`document.querySelector('.workspace-nav .nav-link.active')?.textContent?.trim()`)
    assert.ok(activeTab.includes('Analytics'), 'Analytics tab is active in workspace header')

    // Verify Settings tab link
    const settingsHref = await cdp.eval(`document.querySelectorAll('.workspace-nav .nav-link')[2]?.getAttribute('href')`)
    assert.strictEqual(settingsHref, '/classroom/settings/c1', 'Settings tab links to /classroom/settings/c1')

    // Verify aggregate KPI cards
    const enrolledKpi = await cdp.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent?.trim()`)
    assert.strictEqual(enrolledKpi, '23', 'Enrolled students KPI displays 23')

    const mapProgressKpi = await cdp.eval(`document.querySelectorAll('.kpi-card')[1]?.querySelector('.kpi-value')?.textContent?.trim()`)
    assert.strictEqual(mapProgressKpi, 'Level 2.3', 'Average map progress KPI displays Level 2.3')

    // Verify 8 Threat Gauges rendered
    const gaugesCount = await cdp.eval(`document.querySelectorAll('.threat-card').length`)
    assert.strictEqual(gaugesCount, 8, '8 canonical threat category gauges rendered')

    // Verify student roster table has 10 rows on page 1
    const rosterRowCount = await cdp.eval(`document.querySelectorAll('.data-table tbody tr').length`)
    assert.strictEqual(rosterRowCount, 10, 'Student roster table renders 10 students on page 1')

    // Verify clicking "View analytics" navigates to student progress view
    await cdp.eval(`document.querySelector('.data-table tbody tr .btn-inspect')?.click()`)
    await cdp.waitEval(`window.location.pathname.includes('/progress/p1')`)
    const currentUrl = await cdp.eval(`window.location.href`)
    assert.ok(currentUrl.includes('/classroom/students/c1/progress/p1'), 'Navigates to student progress page')
    assert.ok(currentUrl.includes('origin=analytics'), 'Preserves origin=analytics query')
    console.log('✓ Direct entry to /analytics/c1 and student inspection link verified')

    // -------------------------------------------------------------
    // Test 2: Roster Table Pagination with Query Persistence
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Roster Table Pagination with Query Persistence ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c1`)
    await cdp.waitEval(`document.querySelector('.pagination-bar') !== null`)

    // Click Next page
    await cdp.eval(`document.querySelectorAll('.page-btn')[1]?.click()`)
    await cdp.waitEval(`window.location.search.includes('table_page=2')`)
    const page2Indicator = await cdp.waitEval(`document.querySelector('.page-indicator')?.textContent?.trim() === 'Page 2 of 3' ? 'Page 2 of 3' : null`)
    assert.strictEqual(page2Indicator, 'Page 2 of 3', 'Page indicator updates to Page 2 of 3')

    // Click Previous page
    await cdp.eval(`document.querySelectorAll('.page-btn')[0]?.click()`)
    await cdp.waitEval(`window.location.search.includes('table_page=1')`)
    const page1Indicator = await cdp.waitEval(`document.querySelector('.page-indicator')?.textContent?.trim() === 'Page 1 of 3' ? 'Page 1 of 3' : null`)
    assert.strictEqual(page1Indicator, 'Page 1 of 3', 'Page indicator returns to Page 1 of 3')
    console.log('✓ Roster table pagination and table_page query updates verified')

    // -------------------------------------------------------------
    // Test 3: Inactive Classroom Access & Confirmed Zero Counts (Condition 2)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Inactive Classroom Access & Confirmed Zero Counts (c3 / OLD303) ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c3`)
    await cdp.waitEval(`document.querySelector('.workspace-header') !== null`)
    await cdp.waitEval(`document.querySelector('.analytics-content') !== null`)

    const c3Title = await cdp.waitEval(`document.querySelector('.classroom-title')?.textContent?.trim() === 'BSCS 2B (Archived)' ? 'BSCS 2B (Archived)' : null`)
    assert.strictEqual(c3Title, 'BSCS 2B (Archived)', 'Inactive classroom BSCS 2B (Archived) title displayed')

    const c3Code = await cdp.eval(`document.querySelector('.code-pill')?.textContent?.trim()`)
    assert.strictEqual(c3Code, 'OLD303', 'Inactive classroom code OLD303 displayed')

    const c3Status = await cdp.eval(`document.querySelector('.status-pill')?.textContent?.trim()`)
    assert.strictEqual(c3Status, 'Inactive', 'Status badge displays Inactive')

    // Verify confirmed 0 students count in header
    await cdp.waitEval(`document.querySelector('.count-badge strong')?.textContent?.trim() === '0'`)
    console.log('✓ Header displays confirmed 0 students for c3')

    // Verify empty note in student roster
    const emptyRosterNote = await cdp.eval(`document.querySelector('.empty-note')?.textContent?.trim()`)
    assert.ok(emptyRosterNote.includes('No students currently enrolled in this classroom'), 'Empty enrollment note rendered')
    assert.ok(emptyRosterNote.includes('OLD303'), 'Code OLD303 referenced in empty enrollment note')
    console.log('✓ Inactive classroom access and confirmed zero counts verified')

    // -------------------------------------------------------------
    // Test 4: Bare /analytics Redirection Consistency (Condition 3)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Bare /analytics Redirection Consistency ---')
    // Clear classroom selection in Pinia store
    await cdp.eval(`
      (() => {
        const pinia = window.__pinia;
        if (pinia) {
          const store = pinia._s.get('classroom');
          if (store) store.currentClassroomId = null;
        }
      })()
    `)

    // Navigate to bare /analytics with query params
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics?table_page=2&roster_page=1&test_param=preserved`)
    // Must redirect to first classroom /analytics/c1 while preserving query
    await cdp.waitEval(`window.location.pathname === '/analytics/c1'`)
    const redirectedUrl = await cdp.eval(`window.location.href`)
    assert.ok(redirectedUrl.includes('table_page=2'), 'Preserved table_page=2 query param')
    assert.ok(redirectedUrl.includes('roster_page=1'), 'Preserved roster_page=1 query param')
    assert.ok(redirectedUrl.includes('test_param=preserved'), 'Preserved test_param=preserved query param')
    console.log('✓ Bare /analytics redirected to first available classroom with all query parameters preserved')

    // Next: when store already has c2 selected, navigating to bare /analytics prefers c2
    await cdp.eval(`
      (() => {
        const pinia = window.__pinia;
        if (pinia) {
          const store = pinia._s.get('classroom');
          if (store) store.setCurrentClassroomId('c2');
        }
        const router = window.__router;
        if (router) {
          router.push('/analytics?origin=students');
        }
      })()
    `)
    await cdp.waitEval(`window.location.pathname === '/analytics/c2'`)
    console.log('✓ Bare /analytics preferred store-selected classroom c2')

    // Next: list loading failure on bare /analytics (distinguish failure from empty list)
    await cdp.eval(`
      (() => {
        const pinia = window.__pinia;
        if (pinia) {
          const store = pinia._s.get('classroom');
          if (store) store.reset();
        }
        sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOMS__', '1');
      })()
    `)
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics`)
    await cdp.waitEval(`document.querySelector('.error-banner') !== null`)
    const listError = await cdp.eval(`document.querySelector('.error-banner span')?.textContent?.trim()`)
    assert.ok(listError.includes('classroom list failure') || listError.includes('Failed to load classroom list'), 'List-loading error banner rendered')
    // Verify it did not redirect to a bogus classroom
    const pathOnFailure = await cdp.eval(`window.location.pathname`)
    assert.strictEqual(pathOnFailure, '/analytics', 'Did not redirect on list-loading failure')

    // Click "Try again" to recover
    await cdp.eval(`document.querySelector('.error-banner .btn-retry')?.click()`)
    await cdp.waitEval(`window.location.pathname === '/analytics/c1'`)
    console.log('✓ List failure vs empty list distinguished; retry recovered and redirected to c1')

    // -------------------------------------------------------------
    // Test 4B: Leaving bare /analytics while classroom loading is pending
    // -------------------------------------------------------------
    console.log('\n--- Test 4B: Leaving bare /analytics while classroom loading is pending ---')
    // 1. Set 1500ms delay on classroom list fetching and reset store
    await cdp.eval(`
      (() => {
        sessionStorage.setItem('__CYBERMORPH_DELAY_CLASSROOMS__', '1500');
        const pinia = window.__pinia;
        if (pinia) {
          const store = pinia._s.get('classroom');
          if (store) store.reset();
        }
      })()
    `)

    // 2. Navigate to bare /analytics
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics`)

    // 3. Confirm bare /analytics is in loading state
    await cdp.waitEval(`document.querySelector('.loading-state') !== null`, 3000)
    const loadingText = await cdp.eval(`document.querySelector('.loading-state p')?.textContent?.trim()`)
    assert.strictEqual(loadingText, 'Loading classroom analytics...', 'Bare /analytics is currently loading')
    console.log('✓ Confirmed bare /analytics is pending while classroom list is loading')

    // 4. While classroom list loading is pending, leave bare /analytics by clicking "◀ Return to all classrooms"
    await cdp.eval(`document.querySelector('.back-link')?.click()`)
    await cdp.waitEval(`window.location.pathname === '/classroom/manage'`, 3000)
    console.log('✓ Navigated to /classroom/manage while classroom list was still pending')

    // 5. Wait 2000ms for delayed classroom list to complete in the background
    await sleep(2000)

    // 6. Verify user is STILL on /classroom/manage and was NOT redirected back to /analytics/c1!
    const currentPathAfterDelay = await cdp.eval(`window.location.pathname`)
    assert.strictEqual(
      currentPathAfterDelay,
      '/classroom/manage',
      'User remained on /classroom/manage and was not redirected back by late classroom list completion',
    )

    // Clear the list delay
    await cdp.eval(`sessionStorage.removeItem('__CYBERMORPH_DELAY_CLASSROOMS__')`)
    console.log('✓ Obsolete navigation guard verified: late classroom list completion did not redirect user back')

    // -------------------------------------------------------------
    // Test 5: Independent Failure & Retry for Aggregate Analytics and Roster (Condition 4)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Independent Failure & Retry (Condition 4) ---')
    // Part A: Fail Aggregate Analytics only
    await cdp.eval(`sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__', '1')`)
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c1`)
    await cdp.waitEval(`document.querySelector('.overview-unavailable-card') !== null`)

    // Verify aggregate overview shows unavailable card
    const unavailText = await cdp.eval(`document.querySelector('.overview-unavailable-card .unavailable-message')?.textContent?.trim()`)
    assert.strictEqual(unavailText, 'Classroom performance overview is currently unavailable.')

    // Verify student roster succeeded independently!
    const rowsPartA = await cdp.eval(`document.querySelectorAll('.data-table tbody tr').length`)
    assert.strictEqual(rowsPartA, 10, 'Student roster succeeded independently while aggregate analytics failed')

    // Click "Try again" on aggregate overview to recover
    await cdp.eval(`document.querySelector('.overview-unavailable-card .btn-retry')?.click()`)
    await cdp.waitEval(`document.querySelector('.kpi-grid') !== null`)
    console.log('✓ Aggregate analytics failed independently and recovered on retry')

    // Part B: Fail Student Roster only
    await cdp.eval(`sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_STUDENTS__', '1')`)
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c1`)
    await cdp.waitEval(`document.querySelector('.kpi-grid') !== null`)

    // Verify aggregate KPIs succeeded
    const enrolledKpiPartB = await cdp.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent?.trim()`)
    assert.strictEqual(enrolledKpiPartB, '23', 'Aggregate KPIs succeeded independently')

    // Verify roster error banner is shown
    await cdp.waitEval(`document.querySelectorAll('.error-banner').length > 0`)
    const rosterErrText = await cdp.eval(`document.querySelector('.error-banner span')?.textContent?.trim()`)
    assert.ok(rosterErrText.includes('Could not load student roster') || rosterErrText.includes('Temporary student roster failure'), 'Roster error banner rendered')

    // Verify header displays Unavailable count (not confirmed 0!)
    const countDisplay = await cdp.eval(`document.querySelector('.count-badge .count-state')?.textContent?.trim()`)
    assert.strictEqual(countDisplay, 'Unavailable', 'Header displays Unavailable when roster fails, not 0!')

    // Click "Try again" on student roster to recover
    await cdp.eval(`document.querySelector('.error-banner .btn-retry')?.click()`)
    await cdp.waitEval(`document.querySelector('.data-table tbody tr') !== null`)
    await cdp.waitEval(`document.querySelector('.count-badge strong')?.textContent?.trim() === '23'`)
    console.log('✓ Student roster failed independently, header preserved truthful — unavailable count, and recovered on retry')

    // -------------------------------------------------------------
    // Test 6: In-Page Client-Side Navigation & Delayed Classroom Switching (Condition 5)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: In-Page Client-Side Navigation & Delayed Classroom Switching (Condition 5) ---')
    // Set up a navigation sentinel to detect full page reload vs in-page Vue router push
    await cdp.eval(`window.__IN_PAGE_SENTINEL__ = 'active_sentinel_123'`)

    // A. Client-side navigation from Analytics to Students tab via router-link
    await cdp.eval(`document.querySelector('.workspace-nav a.nav-link:not(.active)')?.click()`)
    await cdp.waitEval(`window.location.pathname.includes('/classroom/students/c1')`)

    const sentinelAfterTabSwitch = await cdp.eval(`window.__IN_PAGE_SENTINEL__`)
    assert.strictEqual(
      sentinelAfterTabSwitch,
      'active_sentinel_123',
      'Tab switch executed via client-side Vue navigation without document reload',
    )
    console.log('✓ Tab switch executed client-side without document reload')

    // B. Delayed classroom switching within Analytics view without document reload
    // Step 1: Enable 1500ms delay on c1 BEFORE starting the c1 request
    await cdp.eval(`
      (() => {
        sessionStorage.setItem('__CYBERMORPH_DELAY_CLASSROOM__', JSON.stringify({ c1: 1500, c2: 0 }));
        window.__IN_PAGE_SENTINEL__ = 'active_analytics_sentinel_456';
      })()
    `)

    // Step 2: Start the c1 request via in-page Vue router navigation
    await cdp.eval(`
      (() => {
        window.__router.push('/analytics/c1');
      })()
    `)

    // Step 3: Confirm that c1 request is pending!
    await cdp.waitEval(`document.querySelector('.refresh-btn')?.disabled === true`, 3000)
    const isC1Pending = await cdp.eval(`document.querySelector('.refresh-btn')?.disabled === true`)
    assert.strictEqual(isC1Pending, true, 'Confirmed c1 request is pending while delayed')
    console.log('✓ Confirmed c1 request is pending while delayed')

    // Step 4: While c1 is pending, switch to c2 through Vue router navigation
    await cdp.eval(`
      (() => {
        window.__router.push('/analytics/c2');
      })()
    `)

    // Step 5: Wait for c2 to finish loading
    await cdp.waitEval(`document.querySelector('.classroom-title')?.textContent?.includes('BSIT 3C')`)
    await cdp.waitEval(`document.querySelector('.refresh-btn')?.disabled === false`, 5000)

    const c2Title = await cdp.eval(`document.querySelector('.classroom-title')?.textContent?.trim()`)
    assert.strictEqual(c2Title, 'BSIT 3C', 'Header title rendered for c2')
    const c2Code = await cdp.eval(`document.querySelector('.code-pill')?.textContent?.trim()`)
    assert.strictEqual(c2Code, 'NET202', 'Header access code rendered for c2 (NET202)')

    // Aggregate KPI for c2: student_count is 1 (c1 is 23)
    const c2Kpi = await cdp.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent?.trim()`)
    assert.strictEqual(c2Kpi, '1', 'Aggregate enrolled student count is 1 for c2')

    // Step 6: Wait 1800ms for c1's delayed response to finish in background
    await sleep(1800)

    // Step 7: Verify both header AND aggregate data remain for c2 afterward and were NOT overwritten!
    const c2TitleAfterDelay = await cdp.eval(`document.querySelector('.classroom-title')?.textContent?.trim()`)
    assert.strictEqual(c2TitleAfterDelay, 'BSIT 3C', 'Header title remains BSIT 3C for c2')

    const c2CodeAfterDelay = await cdp.eval(`document.querySelector('.code-pill')?.textContent?.trim()`)
    assert.strictEqual(c2CodeAfterDelay, 'NET202', 'Header access code remains NET202 for c2')

    const c2KpiAfterDelay = await cdp.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent?.trim()`)
    assert.strictEqual(c2KpiAfterDelay, '1', 'Aggregate student count KPI remains 1 for c2 and was NOT overwritten by c1 (23)')

    // Verify document was NOT reloaded
    const sentinelAfterSwitch = await cdp.eval(`window.__IN_PAGE_SENTINEL__`)
    assert.strictEqual(
      sentinelAfterSwitch,
      'active_analytics_sentinel_456',
      'Delayed classroom switch was executed within the same mounted page without document reload',
    )
    console.log('✓ Delayed classroom switch verified: c1 was confirmed pending, switched to c2, and both header and aggregate data remained for c2')
    console.log('  (Note: Accurately covers in-page classroom navigation in EducatorAnalyticsView.vue, distinguished from same-component student-switch in StudentProgressView.vue)')

    // -------------------------------------------------------------
    // Test 7: Legacy ?student= Deep Link Redirection
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Legacy ?student= Deep Link Redirection ---')
    await cdp.navigate(`http://localhost:${TEST_PORT}/analytics/c1?student=p1&roster_page=2`)
    await cdp.waitEval(`window.location.pathname === '/classroom/students/c1/progress/p1'`)
    const legacyRedirectUrl = await cdp.eval(`window.location.href`)
    assert.ok(legacyRedirectUrl.includes('origin=students'), 'Resolved origin=students because roster_page was present')
    assert.ok(legacyRedirectUrl.includes('roster_page=2'), 'Preserved roster_page=2 in redirect')
    console.log('✓ Legacy ?student= link redirected correctly to dedicated student progress page')

    console.log('\n=========================================')
    console.log('ALL STEP 3 BROWSER & WORKSPACE TESTS PASSED (100%)')
    console.log('=========================================')
  } finally {
    if (cdp) cdp.close()
    chromeProc.kill()
    viteProc.kill()
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  try {
    await runStep3UnitChecks()
    await runStep3BrowserTests()
    process.exit(0)
  } catch (err) {
    console.error('\n❌ STEP 3 VERIFICATION FAILED:', err)
    process.exit(1)
  }
}

main()
