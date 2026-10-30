/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'

const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/e915d42a-bc70-4315-86d7-18b50753d36f'
const isWindows = process.platform === 'win32'

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
// 1. Pure Unit Specification Checks of Business Formulas & Resolution Rules
// (Note: These are isolated formula tests, distinguished from full application browser tests below)
// =============================================================
async function runStep2FormulaChecks() {
  console.log('=== Suite 1: Pure Unit Specification Checks of Business Formulas & Rules ===')

  // Check 1: Win rate calculation formula
  console.log('1. Checking win rate calculation specification...')
  const calcWinRate = (wins, losses) => {
    const total = Number(wins || 0) + Number(losses || 0)
    if (total === 0) return 'No results yet'
    return `${Math.round((wins / total) * 100)}%`
  }

  assert.strictEqual(calcWinRate(0, 0), 'No results yet', '0 wins and 0 losses shows No results yet')
  assert.strictEqual(calcWinRate(6, 2), '75%', '6 wins and 2 losses yields 75%')
  assert.strictEqual(calcWinRate(1, 2), '33%', '1 win and 2 losses yields 33%')
  console.log('✓ Win rate calculation specification verified')

  // Check 2: Category breakdown formatting as Error rate with null preservation
  console.log('2. Checking category breakdown formatting specification...')
  const formatErrorRate = (rate) => {
    if (rate === null || rate === undefined) return 'No data yet'
    if (typeof rate === 'number') return `${Math.round(rate * 100)}%`
    return String(rate)
  }

  assert.strictEqual(formatErrorRate(null), 'No data yet', 'Null is preserved as No data yet')
  assert.strictEqual(formatErrorRate(undefined), 'No data yet', 'Undefined is preserved as No data yet')
  assert.strictEqual(formatErrorRate(0.15), '15%', '0.15 formatted as 15%')
  assert.strictEqual(formatErrorRate(0), '0%', '0 formatted as 0%')
  console.log('✓ Category breakdown formatting specification verified')

  // Check 3: Origin & Return destination rules (Condition 4)
  console.log('3. Checking origin and return destination resolution rules...')
  const resolveReturnDestination = ({ origin, roster_page, table_page, codeId = 'c1' }) => {
    let effectiveOrigin = 'students'
    if (origin === 'students') effectiveOrigin = 'students'
    else if (origin === 'analytics') effectiveOrigin = 'analytics'
    else if (roster_page) effectiveOrigin = 'students'
    else if (table_page) effectiveOrigin = 'analytics'

    const rPage = parseInt(roster_page, 10) || 1
    const tPage = parseInt(table_page, 10) || 1

    if (effectiveOrigin === 'analytics') {
      const query = { table_page: tPage }
      if (roster_page) query.roster_page = rPage
      return { path: `/analytics/${codeId}`, query, destination: 'analytics' }
    }

    return {
      path: `/classroom/students/${codeId}`,
      query: rPage > 1 ? { page: rPage } : {},
      destination: 'students',
    }
  }

  // Explicit origin students
  const dest1 = resolveReturnDestination({ origin: 'students', roster_page: 2 })
  assert.strictEqual(dest1.destination, 'students')
  assert.strictEqual(dest1.query.page, 2)

  // Explicit origin analytics
  const dest2 = resolveReturnDestination({ origin: 'analytics', table_page: 3, roster_page: 2 })
  assert.strictEqual(dest2.destination, 'analytics')
  assert.strictEqual(dest2.query.table_page, 3)
  assert.strictEqual(dest2.query.roster_page, 2)

  // Legacy link: roster_page present even when table_page is also present -> students
  const dest3 = resolveReturnDestination({ roster_page: 2, table_page: 1 })
  assert.strictEqual(dest3.destination, 'students', 'Retains Students return destination when roster_page is present')
  assert.strictEqual(dest3.query.page, 2)

  // Legacy link: only table_page present -> analytics
  const dest4 = resolveReturnDestination({ table_page: 2 })
  assert.strictEqual(dest4.destination, 'analytics', 'Returns to Analytics when only table_page is present')
  assert.strictEqual(dest4.query.table_page, 2)

  console.log('✓ Origin and return destination rules verified')

  // Check 4: Session profile_id validation specification (Condition 3 & Condition 4 gap)
  console.log('4. Checking session profile_id validation specification...')
  const validateSessionProfile = (sessionData, pageProfileId) => {
    if (!sessionData?.profile_id || String(sessionData.profile_id) !== String(pageProfileId)) {
      return { valid: false, error: 'Session details do not belong to this student.' }
    }
    return { valid: true, error: '' }
  }

  assert.strictEqual(validateSessionProfile({ profile_id: 'p1' }, 'p1').valid, true)
  assert.strictEqual(validateSessionProfile({ profile_id: 'p1' }, 'p18').valid, false)
  assert.strictEqual(validateSessionProfile({ profile_id: null }, 'p1').valid, false)
  assert.strictEqual(validateSessionProfile({}, 'p1').valid, false)
  console.log('✓ Session profile validation specification verified')

  console.log('✓ All pure unit specification checks passed!\n')
}

// =============================================================
// 2. Real Headless Chrome Browser Application Tests on Isolated Port
// =============================================================
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = process.env.TEST_PORT ? Number(process.env.TEST_PORT) : 5194
const CDP_PORT = 9258
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-step2-cdp-${Date.now()}`)

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

  // Genuine keyboard interaction through CDP Input domain
  async pressKey(key, code, windowsVirtualKeyCode, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers,
    })
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers,
    })
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
  }

  close() {
    if (this.ws) this.ws.close()
  }
}

async function runStep2BrowserTests() {
  console.log('=== Suite 2: Full Application Tests in Headless Chrome ===')

  // 1. Verify port is not already occupied
  console.log(`Checking if port ${TEST_PORT} is free...`)
  try {
    const preCheck = await fetch(`http://127.0.0.1:${TEST_PORT}/`)
    if (preCheck) {
      throw new Error(`Port ${TEST_PORT} is already occupied. Refusing to connect to an existing server.`)
    }
  } catch (err) {
    if (err.message.includes('Refusing to connect')) {
      throw err
    }
  }

  // 2. Spawn isolated Vite test server on port 5194 with VITE_USE_MOCK=true
  console.log(`Starting isolated Vite test server on port ${TEST_PORT} with VITE_USE_MOCK=true...`)
  let viteExited = false
  let viteExitCode = null
  let viteError = null

  const viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(TEST_PORT), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_USE_MOCK: 'true',
      },
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
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`)
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
  console.log(`✓ Confirmed own isolated Vite test server is up on http://127.0.0.1:${TEST_PORT}`)

  // 3. Launch Headless Chrome on CDP_PORT
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let client
  try {
    let versionData = null
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        versionData = await res.json()
        break
      } catch {
        await sleep(250)
      }
    }

    assert.ok(versionData, 'Chrome started successfully on port ' + CDP_PORT)

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await listRes.json()
    const page = pages.find((p) => p.type === 'page')
    assert.ok(page, 'Must find active browser page')

    client = new CDPClient(page.webSocketDebuggerUrl)
    await client.connect()

    // 4. Authenticate as educator
    console.log('1. Authenticating as educator on isolated test server...')
    await client.send('Page.navigate', { url: `http://127.0.0.1:${TEST_PORT}/login` })
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
    console.log('✓ Successfully authenticated with mock educator')

    // 5. Test Direct Student-Page Entry & Upper Header State
    console.log('2. Direct entry to student p18 (classroom c1) and verifying header and navigation...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p18?origin=students&roster_page=2`,
    })

    const directEntryData = await client.waitEval(`
      (() => {
        const pageH1 = document.querySelector('.workspace-heading-copy h1')?.textContent?.trim();
        const pageDesc = document.querySelector('.workspace-heading-copy p')?.textContent?.trim();
        const returnBtnText = document.querySelector('.return-button span')?.textContent?.trim();
        const returnBtnHref = document.querySelector('.return-button')?.getAttribute('href');
        const duplicateBack = document.querySelector('.breadcrumb-container, .return-nav-link');
        const headerTitle = document.querySelector('.classroom-title')?.textContent?.trim();
        const headerCode = document.querySelector('.code-pill')?.textContent?.trim();
        const headerBadge = document.querySelector('.count-badge strong')?.textContent?.trim();
        const studentTitle = document.querySelector('.student-title')?.textContent?.trim();
        if (!studentTitle || studentTitle.includes('Loading')) return null;
        const winRate = document.querySelector('.kpi-value.win-rate')?.textContent?.trim();
        const wins = document.querySelector('.kpi-value.win-count')?.textContent?.trim();
        const losses = document.querySelector('.kpi-value.loss-count')?.textContent?.trim();
        const mapProgress = document.querySelector('.identity-meta-row')?.textContent?.trim();
        const threatRows = document.querySelectorAll('.threats-table tbody tr');
        const sessionRows = document.querySelectorAll('.sessions-table tbody tr');
        return {
          pageH1,
          pageDesc,
          returnBtnText,
          returnBtnHref,
          hasDuplicateBack: Boolean(duplicateBack),
          headerTitle,
          headerCode,
          headerBadge,
          studentTitle,
          winRate,
          wins,
          losses,
          mapProgress,
          threatRowCount: threatRows.length,
          sessionRowCount: sessionRows.length,
        };
      })()
    `, 8000)

    console.log('Direct entry data:', directEntryData)
    assert.strictEqual(directEntryData.pageH1, 'Student progress', 'Page heading must be "Student progress"')
    assert.strictEqual(
      directEntryData.pageDesc,
      'Review this student’s map progression, threat unlocks, and recent sessions.',
      'Subtitle must match specification',
    )
    assert.strictEqual(
      directEntryData.returnBtnText,
      'Return to classroom roster',
      'Upper-right button must be "Return to classroom roster"',
    )
    assert.ok(
      directEntryData.returnBtnHref?.includes('/classroom/students/c1'),
      'Upper-right button must link to classroom students tab',
    )
    assert.ok(
      directEntryData.returnBtnHref?.includes('page=2'),
      'Roster page=2 query must be preserved in return link',
    )
    assert.strictEqual(
      directEntryData.hasDuplicateBack,
      false,
      'Duplicate back control inside content card must be removed',
    )
    assert.strictEqual(directEntryData.headerTitle, 'BSIT 4A', 'Shared store initialized header title')
    assert.strictEqual(directEntryData.headerCode, 'CYB101', 'Shared store initialized header code')
    assert.strictEqual(directEntryData.headerBadge, '23', 'Shared store confirmed 23 students')
    assert.strictEqual(directEntryData.studentTitle, 'RootAccess', 'Resolved student username RootAccess from page 2')
    assert.ok(directEntryData.mapProgress.includes('Internet Cafe'), 'Map progress resolved as Internet Cafe')
    assert.strictEqual(directEntryData.winRate, '75%', 'Calculated win rate 75%')
    assert.strictEqual(directEntryData.wins, '6')
    assert.strictEqual(directEntryData.losses, '2')
    assert.strictEqual(directEntryData.threatRowCount, 8, '8 canonical threat categories displayed')
    console.log('✓ Direct entry, upper-right Return to classroom roster, and page heading verified')

    // 6. Test Switching Between Classrooms (c1 -> c2) (Condition 1 & 3)
    console.log('3. Switching to classroom c2 and student p1...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c2/progress/p1?origin=students`,
    })

    const c2Data = await client.waitEval(`
      (() => {
        const headerTitle = document.querySelector('.classroom-title')?.textContent?.trim();
        const headerCode = document.querySelector('.code-pill')?.textContent?.trim();
        const headerBadge = document.querySelector('.count-badge strong')?.textContent?.trim();
        const studentTitle = document.querySelector('.student-title')?.textContent?.trim();
        if (headerTitle !== 'BSIT 3C' || !studentTitle || studentTitle.includes('Loading')) return null;
        return { headerTitle, headerCode, headerBadge, studentTitle };
      })()
    `, 8000)

    console.log('Classroom c2 data:', c2Data)
    assert.strictEqual(c2Data.headerTitle, 'BSIT 3C', 'Header updated to BSIT 3C')
    assert.strictEqual(c2Data.headerCode, 'NET202', 'Header updated to NET202')
    assert.strictEqual(c2Data.headerBadge, '1', 'Enrolled count updated to 1')
    assert.strictEqual(c2Data.studentTitle, 'AgentZero', 'Student identity updated to AgentZero')
    console.log('✓ Classroom switching and header synchronization verified')

    // 7. Test Fresh Page Reload on Direct Student Page (Condition 1)
    console.log('4. Performing fresh page reload on student page...')
    await client.send('Page.reload')
    const reloadedData = await client.waitEval(`
      (() => {
        const headerTitle = document.querySelector('.classroom-title')?.textContent?.trim();
        const headerCode = document.querySelector('.code-pill')?.textContent?.trim();
        const studentTitle = document.querySelector('.student-title')?.textContent?.trim();
        if (headerTitle !== 'BSIT 3C' || !studentTitle || studentTitle.includes('Loading')) return null;
        return { headerTitle, headerCode, studentTitle };
      })()
    `, 8000)
    assert.strictEqual(reloadedData.headerTitle, 'BSIT 3C', 'Header preserved after fresh reload')
    assert.strictEqual(reloadedData.headerCode, 'NET202', 'Code preserved after fresh reload')
    console.log('✓ Fresh reload header initialization verified')

    // 8. Test Legacy ?student= Redirection Suite (Condition 2)
    console.log('5. Testing legacy link redirection suite...')

    // 8A. Explicit valid origin preserved
    console.log('  5A: Explicit origin students preserved with table_page...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/analytics/c1?student=p18&origin=students&table_page=2`,
    })
    await client.waitEval(`window.location.pathname.includes('/progress/p18')`, 8000)
    let search5A = await client.eval(`window.location.search`)
    assert.ok(search5A.includes('origin=students'), 'Preserved explicit origin=students')
    assert.ok(search5A.includes('table_page=2'), 'Preserved table_page=2')

    // 8B. roster_page means Students, even with table_page
    console.log('  5B: roster_page takes priority over table_page when no explicit origin...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/analytics/c1?student=p18&roster_page=2&table_page=3`,
    })
    await client.waitEval(`window.location.pathname.includes('/progress/p18')`, 8000)
    let search5B = await client.eval(`window.location.search`)
    assert.ok(search5B.includes('origin=students'), 'roster_page resolved origin as students')
    assert.ok(search5B.includes('roster_page=2'), 'Preserved roster_page=2')
    assert.ok(search5B.includes('table_page=3'), 'Preserved table_page=3')

    // 8C. Only table_page means Analytics
    console.log('  5C: table_page means Analytics when no roster_page...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/analytics/c1?student=p18&table_page=3`,
    })
    await client.waitEval(`window.location.pathname.includes('/progress/p18')`, 8000)
    let search5C = await client.eval(`window.location.search`)
    assert.ok(search5C.includes('origin=analytics'), 'table_page resolved origin as analytics')
    assert.ok(search5C.includes('table_page=3'), 'Preserved table_page=3')

    // 8D. Classroom c2 (verifying no hardcoded 'c1')
    console.log('  5D: Classroom c2 redirecting without fallback to c1...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/analytics/c2?student=p1`,
    })
    await client.waitEval(`window.location.pathname.includes('/classroom/students/c2/progress/p1')`, 8000)
    let path5D = await client.eval(`window.location.pathname`)
    assert.ok(path5D.includes('/classroom/students/c2/progress/p1'), 'Redirected to c2, not fallback c1')
    console.log('✓ Legacy redirection suite verified')

    // 9. Test Return Navigation Destinations & Classroom Scope
    console.log('6. Testing return navigation destinations & scope...')
    // From students origin with roster page 2
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p18?roster_page=2`,
    })
    await client.waitEval(`document.querySelector('.return-button') !== null`, 8000)
    const returnText = await client.eval(`document.querySelector('.return-button span')?.textContent?.trim()`)
    assert.strictEqual(returnText, 'Return to classroom roster', 'Return button labeled Return to classroom roster')
    await client.eval(`document.querySelector('.return-button')?.click()`)
    await client.waitEval(`window.location.pathname.includes('/classroom/students/c1')`, 8000)
    let rosterSearch = await client.eval(`window.location.search`)
    assert.ok(rosterSearch.includes('page=2'), 'Preserved page=2 when returning to roster')

    // Direct entry without query returns to /classroom/students/c1
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p1`,
    })
    await client.waitEval(`document.querySelector('.return-button') !== null`, 8000)
    await client.eval(`document.querySelector('.return-button')?.click()`)
    await client.waitEval(`window.location.pathname.includes('/classroom/students/c1')`, 8000)
    console.log('✓ Direct entry return to roster verified')

    // Verify classroom-level pages still have "Return to all classrooms"
    console.log('  Verifying scope: classroom-level pages retain Return to all classrooms...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1`,
    })
    await client.waitEval(`document.querySelector('.return-button') !== null`, 8000)
    const studentsPageReturnText = await client.eval(`document.querySelector('.return-button span')?.textContent?.trim()`)
    const studentsPageReturnHref = await client.eval(`document.querySelector('.return-button')?.getAttribute('href')`)
    assert.strictEqual(studentsPageReturnText, 'Return to all classrooms')
    assert.strictEqual(studentsPageReturnHref, '/classroom/manage')

    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/analytics/c1`,
    })
    await client.waitEval(`document.querySelector('.return-button') !== null`, 8000)
    const analyticsPageReturnText = await client.eval(`document.querySelector('.return-button span')?.textContent?.trim()`)
    assert.strictEqual(analyticsPageReturnText, 'Return to all classrooms')
    console.log('✓ Classroom scope preserved (classroom pages still show Return to all classrooms)')

    // 10. Immediate State Clearing & Delayed Response Handling (Condition 3 & 5)
    console.log('7. Testing immediate state clearing and delayed response handling on student change...')
    // Set 600ms delay on student analytics in browser sessionStorage
    await client.eval(`sessionStorage.setItem('__CYBERMORPH_DELAY_PLAYER__', '600')`)

    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p18?origin=students`,
    })
    // Immediately switch to p1 before p18 completes
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p1?origin=students`,
    })

    // Immediately verify p18 data is cleared
    const immediateCheck = await client.eval(`
      (() => {
        const title = document.querySelector('.student-title')?.textContent?.trim();
        return title !== 'RootAccess';
      })()
    `)
    assert.strictEqual(immediateCheck, true, 'Old student title RootAccess immediately cleared')

    // Wait for p1 to load completely
    await client.waitEval(`document.querySelector('.student-title')?.textContent?.includes('AgentZero')`, 8000)
    // Wait extra 700ms to ensure late p18 response cannot overwrite p1
    await sleep(700)
    const finalTitle = await client.eval(`document.querySelector('.student-title')?.textContent?.trim()`)
    assert.strictEqual(finalTitle, 'AgentZero', 'Late response from p18 did not overwrite p1')

    // Clean up delay
    await client.eval(`sessionStorage.removeItem('__CYBERMORPH_DELAY_PLAYER__')`)
    console.log('✓ Immediate clearing and delayed response handling verified')

    // 11. Test Session Dialog: Single Close Button, Focus, Escape, and Opener Restoration
    console.log('8. Testing session dialog single Close button, keyboard containment, and dismissal...')
    // Wait for inspect button to appear and open session dialog
    await client.waitEval(`document.querySelector('.btn-inspect') !== null`, 8000)
    await client.eval(`
      (() => {
        const btn = document.querySelector('.btn-inspect');
        btn?.focus();
        btn?.click();
      })()
    `)
    await client.waitEval(`document.querySelector('.modal-backdrop') !== null`, 6000)
    await sleep(200)

    // Verify only ONE button exists in modal header
    const headerButtons = await client.eval(`document.querySelectorAll('.modal-header button').length`)
    assert.strictEqual(headerButtons, 1, 'Exactly one button in modal header')
    const closeBtnText = await client.eval(`document.querySelector('.modal-close-btn')?.textContent?.trim()`)
    assert.strictEqual(closeBtnText, 'Close', 'Modal button labeled Close')

    // Verify initial focus is on the Close button inside the modal
    let focusedClass = await client.eval(`document.activeElement?.className`)
    assert.ok(focusedClass.includes('modal-close-btn'), 'Initial modal focus is on modal-close-btn')

    // Test clicking Close button dismisses modal and preserves scroll position
    await client.eval(`window.scrollTo(0, 150)`)
    const scrollBefore = await client.eval(`window.scrollY`)
    await client.eval(`document.querySelector('.modal-close-btn')?.click()`)
    await client.waitEval(`document.querySelector('.modal-backdrop') === null`, 5000)
    const scrollAfter = await client.eval(`window.scrollY`)
    assert.strictEqual(scrollBefore, scrollAfter, 'Scroll position preserved after closing modal')
    assert.ok(await client.eval(`window.location.pathname.includes('/progress/p1')`), 'Student progress page preserved')

    // Reopen modal to test Escape dismissal and focus restoration
    await client.eval(`
      (() => {
        const btn = document.querySelector('.btn-inspect');
        btn?.focus();
        btn?.click();
      })()
    `)
    await client.waitEval(`document.querySelector('.modal-backdrop') !== null`, 6000)
    await sleep(200)

    // Dismiss modal via genuine Escape key
    await client.pressKey('Escape', 'Escape', 27)
    await client.waitEval(`document.querySelector('.modal-backdrop') === null`, 5000)
    await sleep(150)

    // Verify focus is restored to the opener button
    const restoredTag = await client.eval(`document.activeElement?.className`)
    console.log('Restored focus element class:', restoredTag)
    assert.ok(restoredTag.includes('btn-inspect'), 'Focus correctly restored to opener button')
    console.log('✓ Single Close button, Escape dismissal, and opener focus restoration verified')

    // 11B. Visual Verification & Screenshot Capture (Desktop 1440 & Mobile 390)
    console.log('  Capturing desktop and mobile verification screenshots...')
    // Desktop 1440x900
    await client.setViewport(1440, 900)
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p18`,
    })
    await client.waitEval(`document.querySelector('.student-title')?.textContent?.includes('RootAccess')`, 8000)
    await sleep(300)
    await client.screenshot(path.join(ARTIFACT_DIR, 'student_progress_desktop_1440.png'))

    // Open session modal for desktop screenshot
    await client.eval(`document.querySelector('.btn-inspect')?.click()`)
    await client.waitEval(`document.querySelector('.modal-backdrop') !== null`, 6000)
    await sleep(300)
    await client.screenshot(path.join(ARTIFACT_DIR, 'session_modal_desktop_1440.png'))

    // Mobile 390x844 with modal open
    await client.setViewport(390, 844)
    await sleep(300)
    await client.screenshot(path.join(ARTIFACT_DIR, 'session_modal_mobile_390.png'))

    // Close modal and capture mobile student progress
    await client.eval(`document.querySelector('.modal-close-btn')?.click()`)
    await client.waitEval(`document.querySelector('.modal-backdrop') === null`, 5000)
    await sleep(300)
    await client.screenshot(path.join(ARTIFACT_DIR, 'student_progress_mobile_390.png'))

    // Reset viewport
    await client.setViewport(1280, 900)
    console.log('✓ All 4 verification screenshots successfully captured')

    // 12. Test Removing ?session= Through Back/Forward & Invalidation (Condition 3 & 5)
    console.log('9. Testing ?session= removal via Back navigation with delayed session response...')
    await client.eval(`sessionStorage.setItem('__CYBERMORPH_DELAY_SESSION__', '800')`)

    // Navigate to direct session URL
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p1?origin=students&session=e2a8b351-9c2f-4612-8342-210394857612`,
    })
    await client.waitEval(`document.querySelector('.modal-backdrop') !== null`, 5000)

    // Immediately navigate back (removing ?session=) while request is pending
    await client.eval(`window.history.back()`)
    await client.waitEval(`document.querySelector('.modal-backdrop') === null`, 5000)

    // Wait 1000ms for delayed request to finish
    await sleep(1000)
    const modalAfterDelayedArrival = await client.eval(`document.querySelector('.modal-backdrop') !== null`)
    assert.strictEqual(modalAfterDelayedArrival, false, 'Late session response did not reopen modal after back navigation')

    await client.eval(`sessionStorage.removeItem('__CYBERMORPH_DELAY_SESSION__')`)
    console.log('✓ Session removal invalidation verified')

    // 13. Test Session profile_id Validation: Mismatched & Missing profile_id (Condition 4)
    console.log('10. Testing session profile_id validation (mismatched & missing)...')

    // 13A. Mismatched profile_id (session for p1 loaded under student p18)
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p18?session=e2a8b351-9c2f-4612-8342-210394857612`,
    })
    const mismatchBanner = await client.waitEval(`
      (() => {
        const text = document.querySelector('.error-banner')?.textContent?.trim();
        return text && text.includes('do not belong') ? text : null;
      })()
    `, 6000)
    assert.ok(mismatchBanner.includes('Session details do not belong to this student'), 'Mismatched profile_id rejected')
    const hasTelemetryMismatch = await client.eval(`document.querySelector('.session-summary-box') !== null`)
    assert.strictEqual(hasTelemetryMismatch, false, 'Session telemetry hidden on mismatch')

    // 13B. Missing profile_id (session-missing-profile loaded under student p1)
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p1?session=session-missing-profile`,
    })
    const missingProfileBanner = await client.waitEval(`
      (() => {
        const text = document.querySelector('.error-banner')?.textContent?.trim();
        return text && text.includes('do not belong') ? text : null;
      })()
    `, 6000)
    assert.ok(missingProfileBanner.includes('Session details do not belong to this student'), 'Missing profile_id rejected')
    const hasTelemetryMissing = await client.eval(`document.querySelector('.session-summary-box') !== null`)
    assert.strictEqual(hasTelemetryMissing, false, 'Session telemetry hidden on missing profile_id')
    console.log('✓ Session profile_id validation (mismatched and missing) verified')

    // 14. Test Non-Existent Student Identity (page_size=10 bounded search)
    console.log('11. Testing non-existent student identity handling (page_size=10 search)...')
    await client.send('Page.navigate', {
      url: `http://127.0.0.1:${TEST_PORT}/classroom/students/c1/progress/p9999?origin=students`,
    })
    const notFoundNote = await client.waitEval(`
      (() => {
        const note = document.querySelector('.identity-note.note-info')?.textContent?.trim();
        const title = document.querySelector('.student-title')?.textContent?.trim();
        return note ? { note, title } : null;
      })()
    `, 8000)
    assert.strictEqual(notFoundNote.title, 'Student', 'Title defaults to Student')
    assert.ok(notFoundNote.note.includes('not found in this classroom'), 'Displays clear not found note')
    console.log('✓ Non-existent student identity handling verified')

    client.close()
    console.log('✓ All browser application tests completed successfully!\n')
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
    await runStep2FormulaChecks()
    await runStep2BrowserTests()
    console.log('======================================================')
    console.log('ALL COMPREHENSIVE STEP 2 APPLICATION TESTS PASSED (100%)')
    console.log('======================================================')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ STEP 2 VERIFICATION FAILED:', err)
    process.exit(1)
  }
}

main()
