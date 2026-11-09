/* global process */
import assert from 'node:assert'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5195
const ISOLATED_CDP_PORT = 9245
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-fixes-test-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
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
        }
      }
    })
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
      console.error('Vite err:', d.toString())
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

  return { proc, cdp }
}

async function runTests() {
  let viteProc = null
  let edgeProc = null
  let cdp = null

  try {
    console.log('Starting Vite server on port', ISOLATED_VITE_PORT)
    viteProc = await startViteServer()

    console.log('Starting Edge on CDP port', ISOLATED_CDP_PORT)
    try {
      const browser = await startEdge()
      edgeProc = browser.proc
      cdp = browser.cdp
    } catch (startupErr) {
      console.error('[BLOCKED] Edge browser failed to start or DevTools handshake timed out:', startupErr.message)
      throw startupErr
    }

    const BASE_URL = `http://localhost:${ISOLATED_VITE_PORT}`

    // Helper to simulate signed in state
    async function setAuthState(role = 'player') {
      const token = role === 'player' ? 'mock-jwt-token-player:u-101' : `mock-jwt-token-${role}:u-001`
      await cdp.eval(`(() => {
        sessionStorage.clear();
        localStorage.clear();
        const user = {
          user_id: "u-101",
          profile_id: "p-u-101",
          email: "${role}@example.com",
          username: "test_${role}",
          role: "${role}"
        };
        localStorage.setItem("cyber_token", "${token}");
        localStorage.setItem("cyber_role", "${role}");
        localStorage.setItem("cyber_user", JSON.stringify(user));
        window.location.reload();
      })()`)
      await cdp.waitFor('document.readyState === "complete"')
      await new Promise((r) => setTimeout(r, 600))
    }

    async function setGuestState() {
      await cdp.eval(`(() => {
        sessionStorage.clear();
        localStorage.clear();
        window.location.reload();
      })()`)
      await cdp.waitFor('document.readyState === "complete"')
      await new Promise((r) => setTimeout(r, 400))
    }

    console.log('\n--- TEST 1: Page Landmarks Across Layouts ---')
    // 1. Landing (guest)
    await cdp.navigate(BASE_URL + '/', '.hero-section')
    await setGuestState()
    const landingMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const landingHeaderOutside = await cdp.eval('!document.querySelector("main header.public-nav-bar") && !!document.querySelector("header.public-nav-bar")')
    const landingFooterOutside = await cdp.eval('!document.querySelector("main footer.public-footer") && !!document.querySelector("footer.public-footer")')
    assert.strictEqual(landingMainCount, 1, 'Landing must have exactly 1 <main>')
    assert.ok(landingHeaderOutside, 'Landing header must be outside <main>')
    assert.ok(landingFooterOutside, 'Landing footer must be outside <main>')
    console.log('✓ Landing page landmark check passed')

    // 2. About (guest)
    await cdp.navigate(BASE_URL + '/about', '.about-main')
    const aboutMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const aboutHeaderOutside = await cdp.eval('!document.querySelector("main header.public-nav-bar") && !!document.querySelector("header.public-nav-bar")')
    assert.strictEqual(aboutMainCount, 1, 'About must have exactly 1 <main>')
    assert.ok(aboutHeaderOutside, 'About header must be outside <main>')
    console.log('✓ About page landmark check passed')

    // 3. Login (guest)
    await cdp.navigate(BASE_URL + '/login', '.auth-card')
    const loginMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const loginHeaderOutside = await cdp.eval('!document.querySelector("main header.public-nav-bar") && !!document.querySelector("header.public-nav-bar")')
    assert.strictEqual(loginMainCount, 1, 'Login must have exactly 1 <main>')
    assert.ok(loginHeaderOutside, 'Login header must be outside <main>')
    console.log('✓ Login page landmark check passed')

    // 4. Leaderboard (guest)
    await cdp.navigate(BASE_URL + '/leaderboard', '.leaderboard-main')
    const guestLbMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const guestLbHeaderOutside = await cdp.eval('!document.querySelector("main header.public-nav-bar") && !!document.querySelector("header.public-nav-bar")')
    const guestLbFooterOutside = await cdp.eval('!document.querySelector("main footer.public-footer") && !!document.querySelector("footer.public-footer")')
    const guestLbHomeLink = await cdp.eval('!!document.querySelector(".breadcrumb-link")')
    assert.strictEqual(guestLbMainCount, 1, 'Guest leaderboard must have exactly 1 <main>')
    assert.ok(guestLbHeaderOutside, 'Guest leaderboard header outside <main>')
    assert.ok(guestLbFooterOutside, 'Guest leaderboard footer outside <main>')
    assert.ok(guestLbHomeLink, 'Guest leaderboard must have Back to Home link')
    console.log('✓ Guest Leaderboard landmarks & Home link passed')

    // 5. 404 (guest)
    await cdp.navigate(BASE_URL + '/not-a-real-page-guest-xyz', '.not-found-card')
    const guest404MainCount = await cdp.eval('document.querySelectorAll("main").length')
    const guest404HeaderOutside = await cdp.eval('!document.querySelector("main header.public-nav-bar") && !!document.querySelector("header.public-nav-bar")')
    const guest404HomeLink = await cdp.eval('document.querySelector(".not-found-btn")?.textContent?.trim()')
    assert.strictEqual(guest404MainCount, 1, 'Guest 404 must have exactly 1 <main>')
    assert.ok(guest404HeaderOutside, 'Guest 404 header outside <main>')
    assert.strictEqual(guest404HomeLink, 'Go to Home', 'Guest 404 must link to Home')
    console.log('✓ Guest 404 landmarks & link passed')

    // 6. Signed in player dashboard
    await setAuthState('player')
    await cdp.navigate(BASE_URL + '/dashboard', '.role-dashboard')
    const playerDashMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const playerSidebarOutside = await cdp.eval('!document.querySelector("main .sidebar-nav") && !!document.querySelector(".sidebar-nav")')
    assert.strictEqual(playerDashMainCount, 1, 'Player dashboard must have exactly 1 <main>')
    assert.ok(playerSidebarOutside, 'Player sidebar outside <main>')
    console.log('✓ Player dashboard landmarks passed')

    // 7. Signed in player on /leaderboard
    await cdp.navigate(BASE_URL + '/leaderboard', '.leaderboard-main')
    const signedLbMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const signedLbSidebarOutside = await cdp.eval('!document.querySelector("main .sidebar-nav") && !!document.querySelector(".sidebar-nav")')
    const signedLbNoPublicHeader = await cdp.eval('!document.querySelector(".public-nav-bar")')
    assert.strictEqual(signedLbMainCount, 1, 'Signed-in leaderboard must have exactly 1 <main>')
    assert.ok(signedLbSidebarOutside, 'Signed-in leaderboard sidebar outside <main>')
    assert.ok(signedLbNoPublicHeader, 'Signed-in leaderboard must not render public header')
    console.log('✓ Signed-in leaderboard landmarks & layout passed')

    // 8. Signed in player on 404
    await cdp.navigate(BASE_URL + '/not-a-real-page-signed-in-xyz', '.not-found-card')
    const signed404MainCount = await cdp.eval('document.querySelectorAll("main").length')
    const signed404SidebarOutside = await cdp.eval('!document.querySelector("main .sidebar-nav") && !!document.querySelector(".sidebar-nav")')
    const signed404NoPublicHeader = await cdp.eval('!document.querySelector(".public-nav-bar")')
    const signed404DestLabel = await cdp.eval('document.querySelector(".btn-primary.not-found-btn")?.textContent?.trim()')
    assert.strictEqual(signed404MainCount, 1, 'Signed-in 404 must have exactly 1 <main>')
    assert.ok(signed404SidebarOutside, 'Signed-in 404 sidebar outside <main>')
    assert.ok(signed404NoPublicHeader, 'Signed-in 404 must NOT render public header (no guest loop)')
    assert.strictEqual(signed404DestLabel, 'Go to Dashboard', 'Signed-in 404 must link to Dashboard')
    console.log('✓ Signed-in 404 authenticated navigation passed')

    // 9. Educator /classroom/manage
    await setAuthState('educator')
    await cdp.navigate(BASE_URL + '/classroom/manage', '.management-page')
    const eduMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const eduSidebarOutside = await cdp.eval('!document.querySelector("main .sidebar-nav") && !!document.querySelector(".sidebar-nav")')
    assert.strictEqual(eduMainCount, 1, 'Educator /classroom/manage must have exactly 1 <main>')
    assert.ok(eduSidebarOutside, 'Educator sidebar must be outside <main>')
    console.log('✓ Educator /classroom/manage landmarks passed')

    // 10. Admin /admin/logs
    await setAuthState('admin')
    await cdp.navigate(BASE_URL + '/admin/logs', '.audit-logs-view')
    const adminMainCount = await cdp.eval('document.querySelectorAll("main").length')
    const adminSidebarOutside = await cdp.eval('!document.querySelector("main .sidebar-nav") && !!document.querySelector(".sidebar-nav")')
    assert.strictEqual(adminMainCount, 1, 'Admin /admin/logs must have exactly 1 <main>')
    assert.ok(adminSidebarOutside, 'Admin sidebar must be outside <main>')
    console.log('✓ Admin /admin/logs landmarks passed')

    console.log('\n--- TEST 2: Pagination & URL Synchronization ---')
    await setGuestState()

    // Ensure 15-score fixture and clear request history at Axios mock adapter
    await cdp.eval(`(() => {
      window.__CYBERMORPH_MOCK_CONTROL__.resetLeaderboard();
      window.__CYBERMORPH_MOCK_CONTROL__.setLeaderboardFixture('15');
      window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests();
    })()`)

    // 2.1 Click test first: Serve 15 scores at page size 10
    await cdp.navigate(BASE_URL + '/leaderboard', '.leaderboard-main')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".leaderboard-table tbody tr").length === 10')

    // Clean initial URL (no ?page=1)
    const initialUrlSearch = await cdp.eval('window.location.search')
    assert.strictEqual(initialUrlSearch, '', 'Initial leaderboard load must have clean URL without ?page=1')

    // Initial page 1 assertions: 10 scores, ranks 1-10, Next enabled
    const p1Rows = await cdp.eval('document.querySelectorAll(".leaderboard-table tbody tr").length')
    assert.strictEqual(p1Rows, 10, 'Page 1 must show first 10 scores')

    const p1Ranks = await cdp.eval('Array.from(document.querySelectorAll(".leaderboard-table tbody tr .rank-badge")).map(el => el.textContent.trim())')
    assert.deepStrictEqual(p1Ranks, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 'Page 1 must show ranks 1 to 10')

    const nextDisabledOnP1 = await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Next page\']").disabled')
    assert.strictEqual(nextDisabledOnP1, false, 'Next button must be enabled on page 1')

    const prevDisabledOnP1 = await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Previous page\']").disabled')
    assert.strictEqual(prevDisabledOnP1, true, 'Previous button must be disabled on page 1')

    // Clear request counter at adapter before click
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests()')

    // Click Next
    await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Next page\']").click()')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".leaderboard-table tbody tr").length === 5')

    // Assert exactly one page-2 request at adapter
    const p2Requests = await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.getLeaderboardRequests()')
    assert.strictEqual(p2Requests.length, 1, `Next click must trigger exactly one request, got ${p2Requests.length}`)
    assert.strictEqual(p2Requests[0].params.page, 2, 'Request must be for page 2')
    assert.strictEqual(p2Requests[0].params.page_size, 10, 'Request must specify page_size: 10')

    // Assert page=2 in the URL
    const p2UrlSearch = await cdp.eval('new URLSearchParams(window.location.search).get("page")')
    assert.strictEqual(p2UrlSearch, '2', 'URL must have page=2')

    // Assert ranks 11-15 in the table
    const p2Ranks = await cdp.eval('Array.from(document.querySelectorAll(".leaderboard-table tbody tr .rank-badge")).map(el => el.textContent.trim())')
    assert.deepStrictEqual(p2Ranks, ['11', '12', '13', '14', '15'], 'Page 2 must show ranks 11 to 15')

    // Assert Next is disabled on last page
    const nextDisabledOnP2 = await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Next page\']").disabled')
    assert.strictEqual(nextDisabledOnP2, true, 'Next button must be disabled on page 2')

    const prevDisabledOnP2 = await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Previous page\']").disabled')
    assert.strictEqual(prevDisabledOnP2, false, 'Previous button must be enabled on page 2')

    // Click Previous
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests()')
    await cdp.eval('document.querySelector(".pagination-actions button[aria-label=\'Previous page\']").click()')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".leaderboard-table tbody tr").length === 10')

    // Assert exactly one page-1 request at adapter
    const prevRequests = await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.getLeaderboardRequests()')
    assert.strictEqual(prevRequests.length, 1, `Previous click must trigger exactly one request, got ${prevRequests.length}`)
    assert.strictEqual(prevRequests[0].params.page, 1, 'Request must be for page 1')

    // Assert first 10 scores return (ranks 1-10) and page=1 omitted from URL
    const returnRanks = await cdp.eval('Array.from(document.querySelectorAll(".leaderboard-table tbody tr .rank-badge")).map(el => el.textContent.trim())')
    assert.deepStrictEqual(returnRanks, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 'First 10 scores must return after Previous click')
    const returnUrlPage = await cdp.eval('new URLSearchParams(window.location.search).get("page")')
    assert.strictEqual(returnUrlPage, null, 'URL must omit page=1')
    console.log('✓ Leaderboard click test (Page 1 -> Next -> Page 2 -> Previous -> Page 1) passed')

    // 2.2 Mounted malformed-query transition: ?page=2 -> ?map=Home&page=bogus&ref=portal
    await cdp.navigate(BASE_URL + '/leaderboard?page=2', '.leaderboard-main')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".leaderboard-table tbody tr").length === 5')

    // Clear recorded requests at adapter
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests()')

    // Push malformed query on mounted page
    await cdp.eval('window.__router.push("/leaderboard?map=Home&page=bogus&ref=portal")')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelector(".leaderboard-table tbody tr .agent-name")?.textContent?.trim() === "CipherQueen"')

    // Assert canonical URL preserves Home and ref=portal, omits page=1
    const malformedCanonicalParams = await cdp.eval(`(() => {
      const sp = new URLSearchParams(window.location.search);
      return { map: sp.get("map"), page: sp.get("page"), ref: sp.get("ref") };
    })()`)
    assert.strictEqual(malformedCanonicalParams.map, 'Home', 'Canonical URL must preserve map=Home')
    assert.strictEqual(malformedCanonicalParams.ref, 'portal', 'Canonical URL must preserve unrelated ref=portal')
    assert.strictEqual(malformedCanonicalParams.page, null, 'Canonical URL must omit page=1')

    // Assert adapter received exactly one request for (Home, 1)
    const malformedCaptured = await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.getLeaderboardRequests()')
    assert.strictEqual(malformedCaptured.length, 1, `Must request Home page 1 exactly once without duplicates, got ${malformedCaptured.length}`)
    assert.strictEqual(malformedCaptured[0].params.map_name, 'Home', 'Request must specify map_name: "Home"')
    assert.strictEqual(malformedCaptured[0].params.page, 1, 'Request must specify page: 1')
    assert.strictEqual(malformedCaptured[0].params.page_size, 10, 'Request must specify page_size: 10')
    console.log('✓ Mounted leaderboard transition (?page=2 -> ?map=Home&page=bogus&ref=portal) passed')

    // 2.3 Oversized-page recovery (?page=10005)
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests()')
    await cdp.navigate(BASE_URL + '/leaderboard?page=10005', '.leaderboard-main')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".leaderboard-table tbody tr").length === 5')

    const reqSequenceCalls = await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.getLeaderboardRequests()')
    const reqSequence = reqSequenceCalls.map((c) => c.params.page)
    assert.deepStrictEqual(reqSequence, [10000, 2], `Requests sequence at adapter must be [10000, 2], got ${JSON.stringify(reqSequence)}`)

    const finalSearchPage = await cdp.eval('new URLSearchParams(window.location.search).get("page")')
    assert.strictEqual(finalSearchPage, '2', 'Final URL must be page=2')

    const rowCount = await cdp.eval('document.querySelectorAll(".leaderboard-table tbody tr").length')
    assert.strictEqual(rowCount, 5, `15-item fixture on page 2 (size 10) must render final 5 scores, got ${rowCount}`)
    console.log('✓ Leaderboard page=10005 recovery ([10000, 2], URL page=2, 5 rows) passed')

    // 2.4 Zero results test: assert empty state without follow-up request
    await cdp.eval(`(() => {
      window.__CYBERMORPH_MOCK_CONTROL__.setLeaderboardFixture('zero');
      window.__CYBERMORPH_MOCK_CONTROL__.clearLeaderboardRequests();
    })()`)
    await cdp.navigate(BASE_URL + '/leaderboard?page=6', '.leaderboard-main')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelector(".empty-state")')

    const zeroRequests = await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.getLeaderboardRequests()')
    assert.strictEqual(zeroRequests.length, 1, `Zero results must NOT issue follow-up request, got ${zeroRequests.length}`)
    assert.strictEqual(zeroRequests[0].params.page, 6, 'Request was for page 6')
    const emptyStateVisible = await cdp.eval('!!document.querySelector(".empty-state")')
    assert.ok(emptyStateVisible, 'Empty state must be displayed for zero results')

    // Clean up mock fixture back to default
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.resetLeaderboard()')
    console.log('✓ Leaderboard zero results empty state without follow-up request passed')
    console.log('✓ Leaderboard zero results empty state without follow-up request passed')

    // Session history clean URL
    await setAuthState('player')
    await cdp.navigate(BASE_URL + '/session-history', '.session-history-view')
    const sessUrl = await cdp.eval('window.location.search')
    assert.strictEqual(sessUrl, '', 'Default session history load must have clean URL without ?page=1')
    console.log('✓ Session history clean URL passed')

    console.log('\n--- TEST 3: Navigation Discoverability ---')
    await setGuestState()
    await cdp.navigate(BASE_URL + '/', '.hero-section')
    const headerLbLink = await cdp.eval('!!document.querySelector("nav.desktop-nav a[href=\'/leaderboard\']")')
    await cdp.eval('document.querySelector(".mobile-menu-toggle")?.click()')
    await cdp.waitFor('document.querySelector(".mobile-nav-links")')
    const drawerLbLink = await cdp.eval('!!document.querySelector(".mobile-nav-links a[href=\'/leaderboard\']")')
    await cdp.eval('document.querySelector(".mobile-close-btn")?.click()')
    const footerLbLink = await cdp.eval('!!document.querySelector("footer.public-footer a[href=\'/leaderboard\']")')
    assert.ok(headerLbLink, 'PublicHeader desktop nav must contain /leaderboard')
    assert.ok(drawerLbLink, 'PublicHeader mobile drawer must contain /leaderboard')
    assert.ok(footerLbLink, 'PublicFooter must contain /leaderboard')
    console.log('✓ Guest Leaderboard discoverability in Header and Footer passed')

    console.log('\n--- TEST 4: PlayerDownloadModal at 320x400 Viewport with Delayed Response ---')
    await setAuthState('player')
    await cdp.navigate(BASE_URL + '/dashboard', '.role-dashboard')

    // Set viewport to 320x400
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 400,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // Set 600ms delay on /app/version mock response
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.delayAppVersionMs = 600')

    // Focus and click the download button in PlayerDashboard
    await cdp.waitFor('document.querySelector(".download-trigger-btn")')
    await cdp.eval('document.querySelector(".download-trigger-btn").focus()')
    const triggerFocused = await cdp.eval('document.activeElement?.classList?.contains("download-trigger-btn")')
    assert.ok(triggerFocused, 'Download trigger must have initial focus')

    await cdp.eval('document.querySelector(".download-trigger-btn").click()')

    // Modal opens in loading state
    await cdp.waitFor('document.querySelector(".download-modal-card")')

    // Verify Cancel button retains focus DURING the delay
    const focusDuringDelay = await cdp.eval('document.activeElement?.textContent?.trim()')
    assert.ok(focusDuringDelay.includes('Cancel'), `Cancel must hold focus during loading delay, got "${focusDuringDelay}"`)

    // Wait for the release to finish loading
    await cdp.waitFor('document.querySelector(".download-modal-actions .btn-primary")')

    // Verify Cancel button STILL retains focus AFTER the response arrives
    const focusAfterLoad = await cdp.eval('document.activeElement?.textContent?.trim()')
    assert.ok(focusAfterLoad.includes('Cancel'), `Cancel must retain focus after response arrives, got "${focusAfterLoad}"`)
    assert.ok(!focusAfterLoad.includes('Open release link'), 'Focus must NOT be moved to confirmation button')

    // Modal layout at 320x400
    const modalBox = await cdp.eval(`(() => {
      const card = document.querySelector(".download-modal-card");
      const title = document.getElementById("download-dialog-title");
      const cancelBtn = Array.from(document.querySelectorAll(".download-modal-actions button")).find(b => b.textContent.includes("Cancel"));
      const body = document.querySelector(".download-modal-body");
      const rect = card.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const cancelRect = cancelBtn.getBoundingClientRect();

      return {
        windowHeight: window.innerHeight,
        windowWidth: window.innerWidth,
        cardHeight: rect.height,
        cardTop: rect.top,
        cardBottom: rect.bottom,
        titleTop: titleRect.top,
        cancelTop: cancelRect.top,
        cancelBottom: cancelRect.bottom,
        bodyOverflow: window.getComputedStyle(body).overflowY
      };
    })()`)

    assert.ok(modalBox.cardHeight <= 400, `Card height (${modalBox.cardHeight}px) must be <= 400px`)
    assert.ok(modalBox.titleTop >= 0, `Title top (${modalBox.titleTop}px) must not be clipped`)
    assert.ok(modalBox.cancelBottom <= 400, `Cancel button bottom (${modalBox.cancelBottom}px) must be within 400px`)
    assert.ok(modalBox.bodyOverflow === 'auto' || modalBox.bodyOverflow === 'scroll', 'Modal body must have overflow scrolling')

    // Truthful confirm button copy: "Open release link"
    const confirmBtnLabel = await cdp.eval('document.querySelector(".download-modal-actions .btn-primary")?.textContent?.trim()')
    assert.ok(confirmBtnLabel.includes('Open release link'), `Confirm button should say "Open release link", got "${confirmBtnLabel}"`)

    // Press Escape to close modal and verify focus restores to exact trigger button
    await cdp.eval('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))')
    await cdp.waitFor('!document.querySelector(".download-modal-card")')

    const focusAfterEscape = await cdp.eval('document.activeElement?.classList?.contains("download-trigger-btn")')
    assert.ok(focusAfterEscape, 'Focus must return to exact download trigger button on Escape')

    // Clear metrics and delay
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await cdp.eval('window.__CYBERMORPH_MOCK_CONTROL__.delayAppVersionMs = 0')
    console.log('✓ Modal at 320x400 delay focus & Escape restoration passed')

    console.log('\n--- TEST 5: Public /download View Copy & States ---')
    await setGuestState()

    // 1. Available HTTPS release link
    await cdp.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 12,
        min_supported_build: 8,
        download_url: 'https://example.com/cybermorph-release'
      }));
    })()`)
    await cdp.navigate(BASE_URL + '/download', '.download-main')
    await cdp.waitFor('document.querySelector(".platforms-grid .btn-primary")')

    const downloadLinkInfo = await cdp.eval(`(() => {
      const a = document.querySelector(".platforms-grid .btn-primary");
      const statusBadge = document.querySelector(".status-badge-available")?.textContent?.trim();
      const statusHint = document.querySelector(".status-hint")?.textContent?.trim();
      return {
        text: a?.innerText?.trim(),
        href: a?.href,
        target: a?.target,
        ariaLabel: a?.getAttribute("aria-label"),
        statusBadge,
        statusHint
      };
    })()`)

    assert.ok(downloadLinkInfo.text.includes('Open release link'), `Button visible text must be "Open release link", got "${downloadLinkInfo.text}"`)
    assert.strictEqual(downloadLinkInfo.target, '_blank', 'Button must open in new tab')
    assert.strictEqual(downloadLinkInfo.href, 'https://example.com/cybermorph-release', 'Button must link to valid HTTPS release URL')
    assert.strictEqual(downloadLinkInfo.ariaLabel, 'Open release link in a new tab', 'Accessible aria-label must match')
    assert.strictEqual(downloadLinkInfo.statusBadge, 'Available', 'Status badge must show Available')
    assert.ok(downloadLinkInfo.statusHint.includes('Open release link'), 'Status hint must guide user to Open release link')
    console.log('✓ Public /download available release link check passed')

    // 2. Empty download link
    await cdp.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 12,
        min_supported_build: 8,
        download_url: ''
      }));
    })()`)
    await cdp.navigate(BASE_URL + '/download', '.download-main')
    await cdp.waitFor('document.querySelector(".apk-status-box")')

    const emptyInfo = await cdp.eval(`(() => {
      const statusSubtle = document.querySelector(".apk-status-box .status-subtle")?.textContent?.trim();
      const hint = document.querySelector(".apk-status-box .status-hint")?.textContent?.trim();
      const disabledBtn = document.querySelector(".platform-actions button.btn-disabled")?.textContent?.trim();
      return { statusSubtle, hint, disabledBtn };
    })()`)

    assert.strictEqual(emptyInfo.statusSubtle, 'Not available yet', 'Empty link status must show "Not available yet"')
    assert.strictEqual(emptyInfo.hint, 'Release link has not been published yet.', 'Empty link hint must be truthful')
    assert.strictEqual(emptyInfo.disabledBtn, 'Release link not available yet', 'Disabled button must indicate unavailable release link')
    console.log('✓ Public /download empty link check passed')

    // 3. Failed request with retry
    await cdp.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_FAIL_APP_VERSION__', '1');
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 12,
        min_supported_build: 8,
        download_url: 'https://example.com/recovered-release'
      }));
    })()`)
    await cdp.navigate(BASE_URL + '/download', '.download-main')
    await cdp.waitFor('document.querySelector(".btn-retry")')

    const errorVisible = await cdp.eval('!!document.querySelector(".status-hint-error")')
    assert.ok(errorVisible, 'Error banner/hint must be shown on request failure')

    // Click retry
    await cdp.eval('document.querySelector(".btn-retry")?.click()')
    await cdp.waitFor('document.querySelector(".status-badge-available")')

    const recoveredBtnLabel = await cdp.eval('document.querySelector(".platforms-grid .btn-primary")?.innerText?.trim()')
    assert.ok(recoveredBtnLabel.includes('Open release link'), 'After retry, button must show Open release link')

    // Clean up session overrides
    await cdp.eval(`(() => {
      sessionStorage.removeItem('__CYBERMORPH_FAIL_APP_VERSION__');
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_APP_VERSION__');
    })()`)
    console.log('✓ Public /download error and retry check passed')

    console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---')
  } finally {
    if (cdp) {
      try { await cdp.send('Emulation.clearDeviceMetricsOverride') } catch {}
    }
    if (edgeProc) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${edgeProc.pid} /T /F`, { stdio: 'ignore' })
        } else {
          edgeProc.kill('SIGKILL')
        }
      } catch {}
    }
    if (viteProc) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${viteProc.pid} /T /F`, { stdio: 'ignore' })
        } else {
          viteProc.kill('SIGKILL')
        }
      } catch {}
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
