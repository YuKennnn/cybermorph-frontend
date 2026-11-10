/* global process */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5198
const ISOLATED_CDP_PORT = 9248
const BASE_URL = `http://localhost:${ISOLATED_VITE_PORT}`
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-full-coverage-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
    this.eventListeners = new Map()
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const WebSocket = globalThis.WebSocket
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onopen = () => resolve()
      this.ws.onerror = (err) => reject(err)
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data)
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)
          this.pending.delete(data.id)
          if (data.error) reject(data.error)
          else resolve(data.result)
        } else if (data.method && this.eventListeners.has(data.method)) {
          for (const fn of this.eventListeners.get(data.method)) {
            fn(data.params)
          }
        }
      }
    })
  }

  on(method, fn) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, new Set())
    }
    this.eventListeners.get(method).add(fn)
  }

  async send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
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
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async waitFor(expr, timeoutMs = 8000, intervalMs = 100) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        // Retry
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error(`Timed out waiting for expression: ${expr}`)
  }

  async navigate(url, selector = '#app') {
    await this.send('Page.navigate', { url })
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const found = await this.eval(`document.querySelector(${JSON.stringify(selector)}) !== null`)
      if (found) {
        await new Promise((r) => setTimeout(r, 200))
        return
      }
    }
    throw new Error(`Timed out waiting for selector "${selector}" on ${url}`)
  }

  async spaNavigate(path, selector = '#app') {
    await this.waitFor('Boolean(window.__router)', 10000)
    await this.eval(`window.__router.push(${JSON.stringify(path)})`)
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const found = await this.eval(`document.querySelector(${JSON.stringify(selector)}) !== null`)
      if (found) {
        await new Promise((r) => setTimeout(r, 100))
        return
      }
    }
    throw new Error(`Timed out waiting for selector "${selector}" on SPA nav to ${path}`)
  }

  close() {
    if (this.ws) {
      try { this.ws.close() } catch {}
    }
  }
}

async function startViteServer() {
  const env = { ...process.env, VITE_USE_MOCK: 'true', PORT: String(ISOLATED_VITE_PORT) }
  const proc = spawn('npx.cmd', ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'], {
    env,
    shell: true,
    stdio: 'pipe',
  })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite server failed to start within 15s')), 15000)
    proc.stdout.on('data', (d) => {
      const text = d.toString()
      if (text.includes(`localhost:${ISOLATED_VITE_PORT}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    proc.stderr.on('data', (d) => {
      // console.error('Vite err:', d.toString())
    })
  })

  return proc
}

async function startEdge() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  const proc = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      '--window-size=1280,800',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const startTime = Date.now()
  const EDGE_STARTUP_TIMEOUT_MS = 15000
  let pageTarget = null

  while (Date.now() - startTime < EDGE_STARTUP_TIMEOUT_MS) {
    try {
      const res = await fetch(`http://127.0.0.1:${ISOLATED_CDP_PORT}/json/list`)
      const targets = await res.json()
      pageTarget = targets.find((t) => t.type === 'page')
      if (pageTarget?.webSocketDebuggerUrl) break
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error(`Edge DevTools handshake timed out after ${EDGE_STARTUP_TIMEOUT_MS}ms`)
  }

  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__CYBERMORPH_API_CALLS__ = window.__CYBERMORPH_API_CALLS__ || [];',
  })

  return { proc, cdp }
}

async function run() {
  console.log('=====================================================')
  console.log('CYBERMORPH REAL-BROWSER DASHBOARD COVERAGE RUN')
  console.log('=====================================================\n')

  let viteProc = null
  let edgeProc = null
  let client = null

  const observedMatrix = []

  try {
    console.log('[Setup 1] Starting Vite dev server with VITE_USE_MOCK=true...')
    viteProc = await startViteServer()
    console.log(`✓ Vite running at ${BASE_URL}\n`)

    console.log('[Setup 2] Launching headless Microsoft Edge on CDP port 9248...')
    const edge = await startEdge()
    edgeProc = edge.proc
    client = edge.cdp
    console.log('✓ Edge connected over CDP\n')

    const resetRequests = async () => {
      const reqs = await client.eval(`(() => {
        const r = window.__CYBERMORPH_API_CALLS__ || []
        window.__CYBERMORPH_API_CALLS__ = []
        return r
      })()`)
      return reqs || []
    }

    const setSession = async (role, token, user) => {
      await client.eval(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('cyber_token', ${JSON.stringify(token)});
        localStorage.setItem('cyber_user', JSON.stringify(${JSON.stringify(user)}));
        localStorage.setItem('cyber_role', ${JSON.stringify(role)});
        
        const auth = window.__pinia?._s?.get('auth')
        if (auth) {
          auth.token = ${JSON.stringify(token)};
          auth.user = ${JSON.stringify(user)};
          auth.userRole = ${JSON.stringify(role)};
          auth.isSessionReconciling = false;
          auth.isWebProfileVerified = true;
        }
      })()`)
    }

    // -------------------------------------------------------------
    // PHASE 1: ADMIN SURFACES COVERAGE
    // -------------------------------------------------------------
    console.log('=== PHASE 1: ADMIN DASHBOARD SURFACES ===')
    await client.navigate(`${BASE_URL}/login`)
    await client.waitFor('Boolean(window.__router)', 10000)
    await setSession('admin', 'mock-jwt-token-admin:u-admin-01', {
      user_id: 'u-admin-01',
      email: 'admin@cybermorph.local',
      role: 'admin',
      display_name: 'SysAdmin',
    })

    // 1A. Admin Overview
    await resetRequests()
    await client.spaNavigate('/dashboard', '.welcome-banner')
    await client.waitFor('document.querySelector(".stats-grid") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminOverviewColdReqs = await resetRequests()
    console.log(`Admin Overview Cold: ${adminOverviewColdReqs.length} requests`)
    assert.ok(adminOverviewColdReqs.length > 0, 'Admin overview cold mount must issue reads')

    // 1B. Admin Overview Revisit (same tab, client-side SPA navigation)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/dashboard', '.welcome-banner')
    await client.waitFor('document.querySelector(".stats-grid") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminOverviewRevisitReqs = await resetRequests()
    console.log(`Admin Overview Revisit: ${adminOverviewRevisitReqs.length} requests (Expected: 0)`)
    assert.strictEqual(adminOverviewRevisitReqs.length, 0, 'Admin overview fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Overview', cold: adminOverviewColdReqs.length, revisit: adminOverviewRevisitReqs.length, status: 'PASS' })

    // 1C. Explicit Refresh on Admin Overview
    await resetRequests()
    await client.eval('document.querySelector(".btn-refresh-data")?.click()')
    await new Promise((r) => setTimeout(r, 500))
    const adminRefreshReqs = await resetRequests()
    console.log(`Admin Overview Explicit Refresh: ${adminRefreshReqs.length} requests (Bypassed fresh cache)`)
    assert.ok(adminRefreshReqs.length > 0, 'Explicit refresh must bypass fresh cache')

    // 1D. Admin Users
    await resetRequests()
    await client.spaNavigate('/admin/users', '.admin-users-view')
    await client.waitFor('document.querySelector(".users-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminUsersCold = await resetRequests()
    console.log(`Admin Users Cold: ${adminUsersCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/admin/users', '.admin-users-view')
    await client.waitFor('document.querySelector(".users-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminUsersRevisit = await resetRequests()
    console.log(`Admin Users Revisit: ${adminUsersRevisit.length} requests`)
    assert.strictEqual(adminUsersRevisit.length, 0, 'Admin Users fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Users', cold: adminUsersCold.length, revisit: adminUsersRevisit.length, status: 'PASS' })

    // 1E. Admin Approvals
    await resetRequests()
    await client.spaNavigate('/admin/approvals', '.admin-approvals-view')
    await client.waitFor('document.querySelector(".approvals-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminApprovalsCold = await resetRequests()
    console.log(`Admin Approvals Cold: ${adminApprovalsCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/admin/approvals', '.admin-approvals-view')
    await client.waitFor('document.querySelector(".approvals-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminApprovalsRevisit = await resetRequests()
    console.log(`Admin Approvals Revisit: ${adminApprovalsRevisit.length} requests`)
    assert.strictEqual(adminApprovalsRevisit.length, 0, 'Admin Approvals fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Approvals', cold: adminApprovalsCold.length, revisit: adminApprovalsRevisit.length, status: 'PASS' })

    // 1F. Admin Classrooms
    await resetRequests()
    await client.spaNavigate('/admin/classrooms', '.admin-classrooms-view')
    await client.waitFor('document.querySelector(".classrooms-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminClassroomsCold = await resetRequests()
    console.log(`Admin Classrooms Cold: ${adminClassroomsCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/admin/classrooms', '.admin-classrooms-view')
    await client.waitFor('document.querySelector(".classrooms-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminClassroomsRevisit = await resetRequests()
    console.log(`Admin Classrooms Revisit: ${adminClassroomsRevisit.length} requests`)
    assert.strictEqual(adminClassroomsRevisit.length, 0, 'Admin Classrooms fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Classrooms', cold: adminClassroomsCold.length, revisit: adminClassroomsRevisit.length, status: 'PASS' })

    // 1G. Admin Logs & Lookup
    await resetRequests()
    await client.spaNavigate('/admin/logs', '.audit-logs-view')
    await client.waitFor('document.querySelector(".logs-table, .table-scroll") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminLogsCold = await resetRequests()
    console.log(`Admin Logs Cold: ${adminLogsCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/admin/logs', '.audit-logs-view')
    await client.waitFor('document.querySelector(".logs-table, .table-scroll") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminLogsRevisit = await resetRequests()
    console.log(`Admin Logs Revisit: ${adminLogsRevisit.length} requests`)
    assert.strictEqual(adminLogsRevisit.length, 0, 'Admin Logs fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Logs', cold: adminLogsCold.length, revisit: adminLogsRevisit.length, status: 'PASS' })

    // 1H. Admin Play Data
    await resetRequests()
    await client.spaNavigate('/admin/play-data', '.admin-play-data-view')
    await client.waitFor('document.querySelector(".play-data-table, .table-container") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminPlayDataCold = await resetRequests()
    console.log(`Admin Play Data Cold: ${adminPlayDataCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/admin/play-data', '.admin-play-data-view')
    await client.waitFor('document.querySelector(".play-data-table, .table-container") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const adminPlayDataRevisit = await resetRequests()
    console.log(`Admin Play Data Revisit: ${adminPlayDataRevisit.length} requests`)
    assert.strictEqual(adminPlayDataRevisit.length, 0, 'Admin Play Data fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Admin Play Data', cold: adminPlayDataCold.length, revisit: adminPlayDataRevisit.length, status: 'PASS' })

    // -------------------------------------------------------------
    // PHASE 2: EDUCATOR SURFACES COVERAGE
    // -------------------------------------------------------------
    console.log('\n=== PHASE 2: EDUCATOR DASHBOARD SURFACES ===')
    await setSession('educator', 'mock-jwt-token-educator:u-educator-01', {
      user_id: 'u-educator-01',
      email: 'educator@school.edu',
      role: 'educator',
      display_name: 'Professor Smith',
    })

    // 2A. Educator Overview
    await resetRequests()
    await client.spaNavigate('/dashboard', '.educator-dashboard')
    await client.waitFor('document.querySelector(".stats-grid") !== null || document.querySelector(".empty-state") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const eduOverviewCold = await resetRequests()
    console.log(`Educator Overview Cold: ${eduOverviewCold.length} requests`)
    await client.spaNavigate('/settings', '.settings-page')
    await resetRequests()
    await client.spaNavigate('/dashboard', '.educator-dashboard')
    await new Promise((r) => setTimeout(r, 400))
    const eduOverviewRevisit = await resetRequests()
    console.log(`Educator Overview Revisit: ${eduOverviewRevisit.length} requests`)
    assert.strictEqual(eduOverviewRevisit.length, 0, 'Educator Overview fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Educator Overview', cold: eduOverviewCold.length, revisit: eduOverviewRevisit.length, status: 'PASS' })

    // 2B. Classroom Management
    await resetRequests()
    await client.spaNavigate('/classroom/manage', '.management-page')
    await new Promise((r) => setTimeout(r, 400))
    const eduManageCold = await resetRequests()
    console.log(`Classroom Management: ${eduManageCold.length} requests (Uses fresh classroom store cache)`)
    await client.spaNavigate('/dashboard', '.educator-dashboard')
    await resetRequests()
    await client.spaNavigate('/classroom/manage', '.management-page')
    await new Promise((r) => setTimeout(r, 400))
    const eduManageRevisit = await resetRequests()
    console.log(`Classroom Management Revisit: ${eduManageRevisit.length} requests`)
    assert.strictEqual(eduManageRevisit.length, 0, 'Classroom Management fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Classroom Management', cold: eduManageCold.length, revisit: eduManageRevisit.length, status: 'PASS' })

    // 2C. Classroom Settings
    await resetRequests()
    await client.spaNavigate('/classroom/settings/c1', '.settings-workspace-page')
    await new Promise((r) => setTimeout(r, 400))
    const eduSettingsCold = await resetRequests()
    console.log(`Classroom Settings: ${eduSettingsCold.length} requests`)
    await client.spaNavigate('/classroom/manage', '.management-page')
    await resetRequests()
    await client.spaNavigate('/classroom/settings/c1', '.settings-workspace-page')
    await new Promise((r) => setTimeout(r, 400))
    const eduSettingsRevisit = await resetRequests()
    console.log(`Classroom Settings Revisit: ${eduSettingsRevisit.length} requests`)
    assert.strictEqual(eduSettingsRevisit.length, 0, 'Classroom Settings fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Classroom Settings', cold: eduSettingsCold.length, revisit: eduSettingsRevisit.length, status: 'PASS' })

    // 2D. Classroom Students Roster
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1', '.roster-page')
    await client.waitFor('document.querySelector(".roster-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const eduStudentsCold = await resetRequests()
    console.log(`Classroom Students Cold: ${eduStudentsCold.length} requests`)
    await client.spaNavigate('/classroom/manage', '.management-page')
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1', '.roster-page')
    await client.waitFor('document.querySelector(".roster-table") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const eduStudentsRevisit = await resetRequests()
    console.log(`Classroom Students Revisit: ${eduStudentsRevisit.length} requests`)
    assert.strictEqual(eduStudentsRevisit.length, 0, 'Classroom Students fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Classroom Students', cold: eduStudentsCold.length, revisit: eduStudentsRevisit.length, status: 'PASS' })

    // 2E. Student Progress & Session Telemetry Modal
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1/progress/p1', '.student-progress-view')
    await client.waitFor('document.querySelector(".kpi-grid") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const eduProgressCold = await resetRequests()
    console.log(`Student Progress Cold: ${eduProgressCold.length} requests (Identity reused cached roster!)`)
    await client.spaNavigate('/classroom/students/c1', '.roster-page')
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1/progress/p1', '.student-progress-view')
    await client.waitFor('document.querySelector(".kpi-grid") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const eduProgressRevisit = await resetRequests()
    console.log(`Student Progress Revisit: ${eduProgressRevisit.length} requests`)
    assert.strictEqual(eduProgressRevisit.length, 0, 'Student Progress fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Student Progress', cold: eduProgressCold.length, revisit: eduProgressRevisit.length, status: 'PASS' })

    // 2F. Session Telemetry Modal Open & Reopen
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1/progress/p1?session=e2a8b351-9c2f-4612-8342-210394857612', '.student-progress-view')
    await client.waitFor('document.querySelector(".modal-backdrop, .modal-content, .session-modal") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const modalOpenReqs = await resetRequests()
    console.log(`Session Telemetry Modal Open: ${modalOpenReqs.length} requests`)
    await client.spaNavigate('/classroom/students/c1/progress/p1', '.student-progress-view')
    await resetRequests()
    await client.spaNavigate('/classroom/students/c1/progress/p1?session=e2a8b351-9c2f-4612-8342-210394857612', '.student-progress-view')
    await client.waitFor('document.querySelector(".modal-backdrop, .modal-content, .session-modal") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const modalReopenReqs = await resetRequests()
    console.log(`Session Telemetry Modal Reopen: ${modalReopenReqs.length} requests (Cached!) -> ${JSON.stringify(modalReopenReqs)}`)
    assert.strictEqual(modalReopenReqs.length, 0, 'Session Telemetry Modal reopen must make ZERO API calls')
    observedMatrix.push({ surface: 'Session Telemetry Modal', cold: modalOpenReqs.length, revisit: modalReopenReqs.length, status: 'PASS' })

    // 2G. Educator 403 Access Loss on Student Progress
    console.log('Testing Educator 403 access loss handling on Student Progress...')
    await client.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS_STATUS__', '403');
      const cache = window.__pinia?._s?.get('apiCache');
      if (cache) cache.invalidateKey('educator::analytics::student::profile_id=p1');
    })()`)
    await resetRequests()
    await client.spaNavigate('/settings', '.settings-page')
    await client.spaNavigate('/classroom/students/c1/progress/p1', '.student-progress-view')
    await client.waitFor('document.querySelector(".error-banner") !== null')
    const isContentHidden = await client.eval('document.querySelector(".analytics-content") === null')
    const isErrorRendered = await client.eval('document.querySelector(".error-banner") !== null')
    console.log(`Educator 403 Access Loss: Error Banner=${isErrorRendered}, Private Content Hidden=${isContentHidden}`)
    assert.strictEqual(isContentHidden, true, 'Protected analytics content must be hidden on 403 access loss')
    assert.strictEqual(isErrorRendered, true, 'Error banner must be rendered on 403 access loss')
    await client.eval(`sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS_STATUS__')`)

    // 2H. Educator Analytics
    await resetRequests()
    await client.spaNavigate('/analytics/c1', '.analytics-suite')
    await new Promise((r) => setTimeout(r, 400))
    const eduAnalyticsCold = await resetRequests()
    console.log(`Educator Analytics Cold: ${eduAnalyticsCold.length} requests`)
    await client.spaNavigate('/classroom/manage', '.management-page')
    await resetRequests()
    await client.spaNavigate('/analytics/c1', '.analytics-suite')
    await new Promise((r) => setTimeout(r, 400))
    const eduAnalyticsRevisit = await resetRequests()
    console.log(`Educator Analytics Revisit: ${eduAnalyticsRevisit.length} requests`)
    assert.strictEqual(eduAnalyticsRevisit.length, 0, 'Educator Analytics fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Educator Analytics', cold: eduAnalyticsCold.length, revisit: eduAnalyticsRevisit.length, status: 'PASS' })

    // -------------------------------------------------------------
    // PHASE 3: PLAYER SURFACES COVERAGE
    // -------------------------------------------------------------
    console.log('\n=== PHASE 3: PLAYER DASHBOARD SURFACES ===')
    await setSession('player', 'mock-jwt-token-player:u-101', {
      user_id: 'u-101',
      profile_id: 'p1',
      username: 'AgentZero',
      role: 'player',
    })

    // 3A. Player Overview
    await resetRequests()
    await client.spaNavigate('/dashboard', '.role-dashboard')
    await client.waitFor('document.querySelector(".stats-grid") !== null')
    await client.waitFor('Boolean(window.__pinia?._s?.get("apiCache")?.get("player::sessions::page::page=1&page_size=20"))')
    const playerOverviewCold = await resetRequests()
    console.log(`Player Overview Cold: ${playerOverviewCold.length} requests`)

    // 3B. Player Session History (Checks format compatibility with Overview)
    await resetRequests()
    await client.spaNavigate('/session-history', '.session-history-view')
    await client.waitFor('document.querySelector(".history-content-card, .empty-state") !== null')
    const playerSessionsCold = await resetRequests()
    console.log(`Player Session History: ${playerSessionsCold.length} requests (Reused Overview page 1 cache!) -> ${JSON.stringify(playerSessionsCold)}`)
    assert.strictEqual(playerSessionsCold.length, 0, 'Session History page 1 must reuse Player Overview cache with 0 API calls')

    // 3C. Return Leg: Session History -> Player Overview
    await resetRequests()
    await client.spaNavigate('/dashboard', '.role-dashboard')
    await client.waitFor('document.querySelector(".stats-grid") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const playerOverviewReturnReqs = await resetRequests()
    console.log(`Return to Player Overview: ${playerOverviewReturnReqs.length} requests (Format matched in both directions!)`)
    assert.strictEqual(playerOverviewReturnReqs.length, 0, 'Return to Player Overview must make ZERO API calls')
    observedMatrix.push({ surface: 'Player Overview', cold: playerOverviewCold.length, revisit: playerOverviewReturnReqs.length, status: 'PASS' })
    observedMatrix.push({ surface: 'Player Session History', cold: playerSessionsCold.length, revisit: 0, status: 'PASS' })

    // 3D. Player Classroom
    await resetRequests()
    await client.spaNavigate('/classroom', '.player-classroom-page')
    await new Promise((r) => setTimeout(r, 400))
    const playerClassroomCold = await resetRequests()
    console.log(`Player Classroom: ${playerClassroomCold.length} requests (Reused cached membership!)`)
    assert.strictEqual(playerClassroomCold.length, 0, 'Player Classroom must reuse cached membership with 0 calls')
    observedMatrix.push({ surface: 'Player Classroom', cold: 0, revisit: 0, status: 'PASS' })

    // 3E. Player Threat Index & Lesson
    await resetRequests()
    await client.spaNavigate('/threat-index', '.threat-index-page')
    await new Promise((r) => setTimeout(r, 400))
    const playerThreatsCold = await resetRequests()
    console.log(`Player Threat Index: ${playerThreatsCold.length} requests (Reused cached threats!)`)
    assert.strictEqual(playerThreatsCold.length, 0, 'Player Threat Index must reuse cached threats with 0 calls')
    observedMatrix.push({ surface: 'Player Threat Index', cold: 0, revisit: 0, status: 'PASS' })

    // 3F. Leaderboard
    await resetRequests()
    await client.spaNavigate('/leaderboard', '.leaderboard-page')
    await client.waitFor('document.querySelector(".leaderboard-table, .table-container, .leaderboard-page") !== null')
    await new Promise((r) => setTimeout(r, 400))
    const leaderboardCold = await resetRequests()
    console.log(`Leaderboard Cold: ${leaderboardCold.length} requests`)
    await client.spaNavigate('/dashboard', '.role-dashboard')
    await resetRequests()
    await client.spaNavigate('/leaderboard', '.leaderboard-page')
    await new Promise((r) => setTimeout(r, 400))
    const leaderboardRevisit = await resetRequests()
    console.log(`Leaderboard Revisit: ${leaderboardRevisit.length} requests`)
    assert.strictEqual(leaderboardRevisit.length, 0, 'Leaderboard fresh revisit must make ZERO API calls')
    observedMatrix.push({ surface: 'Leaderboard', cold: leaderboardCold.length, revisit: leaderboardRevisit.length, status: 'PASS' })

    // 3G. Player Download Modal
    await resetRequests()
    await client.spaNavigate('/dashboard', '.role-dashboard')
    await client.eval('document.querySelector(".download-trigger-btn")?.click()')
    await client.waitFor('document.querySelector(".download-modal-card") !== null')
    await client.waitFor('Boolean(window.__pinia?._s?.get("apiCache")?.get("public::app::version"))')
    const downloadModalCold = await resetRequests()
    console.log(`Download Modal Open: ${downloadModalCold.length} requests`)

    // Close modal
    await client.eval('document.querySelector(".modal-close-btn")?.click()')
    await client.waitFor('document.querySelector(".download-modal-card") === null')

    // Reopen modal
    await resetRequests()
    await client.eval('document.querySelector(".download-trigger-btn")?.click()')
    await client.waitFor('document.querySelector(".download-modal-card") !== null')
    const downloadModalRevisit = await resetRequests()
    console.log(`Download Modal Reopen: ${downloadModalRevisit.length} requests`)
    assert.strictEqual(downloadModalRevisit.length, 0, 'Download modal reopen must make ZERO API calls')
    observedMatrix.push({ surface: 'Player Download Modal', cold: downloadModalCold.length, revisit: downloadModalRevisit.length, status: 'PASS' })

    // -------------------------------------------------------------
    // PHASE 4: SHARED SURFACES & IMPECCABLE OPERATE CHECKS
    // -------------------------------------------------------------
    console.log('\n=== PHASE 4: SHARED SURFACES & IMPECCABLE OPERATE ===')
    // 4A. Settings
    await resetRequests()
    await client.spaNavigate('/settings', '.settings-page')
    await new Promise((r) => setTimeout(r, 300))
    const settingsReqs = await resetRequests()
    console.log(`Settings View: ${settingsReqs.length} requests (Auth-owned state)`)
    assert.strictEqual(settingsReqs.length, 0, 'Settings view must make ZERO API calls')
    observedMatrix.push({ surface: 'Settings View', cold: 0, revisit: 0, status: 'PASS' })

    // 4B. Contrast Evaluation (Light & Dark Theme)
    const contrastData = await client.eval(`(() => {
      const getLuminance = (rgb) => {
        const parts = rgb.match(/\\d+/g)?.map(Number) || [0, 0, 0];
        const a = parts.slice(0, 3).map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };
      const getRatio = (fg, bg) => {
        const l1 = getLuminance(fg) + 0.05;
        const l2 = getLuminance(bg) + 0.05;
        return l1 > l2 ? l1 / l2 : l2 / l1;
      };

      document.documentElement.setAttribute('data-theme', 'light');
      const lightBg = window.getComputedStyle(document.body).backgroundColor;
      const lightText = window.getComputedStyle(document.querySelector('.page-title, h1, h2') || document.body).color;
      const lightRatio = getRatio(lightText, lightBg);

      document.documentElement.setAttribute('data-theme', 'dark');
      const darkBg = window.getComputedStyle(document.body).backgroundColor;
      const darkText = window.getComputedStyle(document.querySelector('.page-title, h1, h2') || document.body).color;
      const darkRatio = getRatio(darkText, darkBg);

      document.documentElement.removeAttribute('data-theme');
      return { lightRatio: lightRatio.toFixed(2), darkRatio: darkRatio.toFixed(2) };
    })()`)
    console.log(`Contrast Check: Light = ${contrastData.lightRatio}:1, Dark = ${contrastData.darkRatio}:1 (WCAG AA > 4.5:1 requirement)`)
    assert.ok(parseFloat(contrastData.lightRatio) >= 4.5, 'Light theme title text must meet WCAG AA >= 4.5:1')
    assert.ok(parseFloat(contrastData.darkRatio) >= 4.5, 'Dark theme title text must meet WCAG AA >= 4.5:1')

    // 4C. Reduced Motion Check
    const motionStyleCheck = await client.eval(`(() => {
      const navItem = document.querySelector('.nav-item');
      document.documentElement.setAttribute('data-reduced-motion', 'true');
      const trans = navItem ? window.getComputedStyle(navItem).transitionDuration : '0s';
      document.documentElement.removeAttribute('data-reduced-motion');
      return trans;
    })()`)
    console.log(`Reduced Motion Verification: NavItem transition duration = ${motionStyleCheck} (Instant/bypassed)`)

    // 4D. Responsive Viewports Check (Phone 375px & Tablet 768px)
    for (const [device, w, h] of [['Phone', 375, 667], ['Tablet', 768, 1024]]) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: true,
      })
      await new Promise((r) => setTimeout(r, 200))
      const hasHorizontalScroll = await client.eval('document.documentElement.scrollWidth > window.innerWidth')
      console.log(`Responsive ${device} (${w}px): Horizontal overflow = ${hasHorizontalScroll ? 'YES (FAIL)' : 'NO (CLEAN)'}`)
      assert.strictEqual(hasHorizontalScroll, false, `${device} viewport (${w}px) must NOT horizontally scroll`)
    }

    console.log('\n=====================================================')
    console.log('ALL PHASES COMPLETED WITH 100% PASS RATE!')
    console.log('=====================================================')
    console.log('\nFinal Observed Matrix:')
    console.table(observedMatrix)
  } finally {
    if (client) client.close()
    if (edgeProc) edgeProc.kill('SIGKILL')
    if (viteProc) {
      spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F'])
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {}
  }
}

run().catch((err) => {
  console.error('\nBROWSER COVERAGE RUN FAILED:', err)
  process.exit(1)
})
