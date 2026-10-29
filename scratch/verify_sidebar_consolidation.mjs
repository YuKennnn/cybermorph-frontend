/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import http from 'node:http'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5184
const CDP_PORT = 9234
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-sidebar-cdp-${Date.now()}`)
const isWindows = process.platform === 'win32'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CDPClient {
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
    await sleep(700)
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
    await sleep(200)
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
    }
  }
}

async function runVerification() {
  console.log('=== 1. Checking Logic Specification ===')

  const isEducatorClassroomRouteLogic = (path, name) => {
    if (
      name === 'classroom-manage' ||
      name === 'classroom-students' ||
      name === 'student-progress' ||
      name === 'classroom-settings' ||
      name === 'educator-analytics'
    ) {
      return true
    }
    return (
      path === '/classroom/manage' ||
      path.startsWith('/classroom/manage/') ||
      path.startsWith('/classroom/students') ||
      path.startsWith('/classroom/settings') ||
      path.startsWith('/analytics')
    )
  }

  assert.strictEqual(isEducatorClassroomRouteLogic('/classroom/manage', 'classroom-manage'), true)
  assert.strictEqual(isEducatorClassroomRouteLogic('/classroom/students/c1', 'classroom-students'), true)
  assert.strictEqual(isEducatorClassroomRouteLogic('/classroom/students/c1/progress/p1', 'student-progress'), true)
  assert.strictEqual(isEducatorClassroomRouteLogic('/classroom/settings/c1', 'classroom-settings'), true)
  assert.strictEqual(isEducatorClassroomRouteLogic('/analytics/c1', 'educator-analytics'), true)
  assert.strictEqual(isEducatorClassroomRouteLogic('/analytics', 'educator-analytics'), true)

  assert.strictEqual(isEducatorClassroomRouteLogic('/dashboard', 'educator-dashboard'), false)
  assert.strictEqual(isEducatorClassroomRouteLogic('/leaderboard', 'leaderboard'), false)
  assert.strictEqual(isEducatorClassroomRouteLogic('/settings', 'settings'), false)
  console.log('✓ Route logic matches all classroom screens and rejects non-classroom routes.\n')

  console.log('=== 2. Launching Isolated Vite & Headless Chrome Server ===')

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
  viteProc.stdout.on('data', (d) => console.log('[VITE STDOUT]', d.toString()))
  viteProc.stderr.on('data', (d) => console.log('[VITE STDERR]', d.toString()))
  viteProc.on('exit', (code) => console.log('[VITE EXIT]', code))

  let serverReady = false
  for (let i = 0; i < 40; i++) {
    try {
      const statusCode = await new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}/`, (r) => resolve(r.statusCode))
        req.on('error', reject)
        req.setTimeout(500, () => req.destroy())
      })
      if (statusCode === 200) {
        serverReady = true
        break
      }
    } catch (err) {
      if (i % 10 === 0) console.log(`Probe attempt ${i} error:`, err.message)
      await sleep(250)
    }
  }

  assert.ok(serverReady, `Vite test server ready on port ${TEST_PORT}`)
  console.log(`✓ Confirmed isolated Vite server on http://localhost:${TEST_PORT}`)

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
    // Wait for Chrome CDP ready
    let versionData = null
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        versionData = await res.json()
        if (versionData) break
      } catch {
        await sleep(200)
      }
    }
    assert.ok(versionData, 'Chrome CDP must be accessible')

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await listRes.json()
    const targetPage = pages.find((p) => p.type === 'page') || pages[0]
    assert.ok(targetPage?.webSocketDebuggerUrl, 'Must find valid page target')

    cdp = new CDPClient(targetPage.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    console.log('✓ Vite & Chrome connected.\n')

    console.log('=== 3. Testing Sidebar Links & Active State Across Routes ===')

    // Set educator credentials in localStorage
    await cdp.navigate(BASE_URL)
    await cdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-jwt-token-educator:u-201');
      localStorage.setItem('cyber_role', 'educator');
      localStorage.setItem('cyber_user', JSON.stringify({
        id: 'u-201',
        email: 'educator@example.com',
        role: 'educator',
        display_name: 'Dr. Jane Smith',
        status: 'approved'
      }));
    `)

    // Set Desktop/Laptop viewport (1440x900)
    await cdp.setViewport(1440, 900)

    const checkSidebarOnRoute = async (targetPath, expectedActiveLabel) => {
      await cdp.navigate(`${BASE_URL}${targetPath}`)
      await sleep(600)

      const state = await cdp.evaluate(`
        (() => {
          const navItems = Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item'));
          const labels = navItems.map(el => el.querySelector('.nav-label')?.textContent?.trim() || '');
          const activeItems = navItems.filter(el => el.classList.contains('router-link-active'));
          const activeLabels = activeItems.map(el => el.querySelector('.nav-label')?.textContent?.trim() || '');
          const hasClassroomAnalytics = labels.includes('Classroom analytics');
          return {
            labels,
            activeLabels,
            hasClassroomAnalytics,
            currentPath: window.location.pathname
          };
        })()
      `)

      assert.strictEqual(
        state.hasClassroomAnalytics,
        false,
        `"Classroom analytics" must NOT exist in sidebar on ${targetPath}`
      )
      assert.deepStrictEqual(
        state.activeLabels,
        [expectedActiveLabel],
        `On ${targetPath}, only "${expectedActiveLabel}" must be active (got: ${JSON.stringify(state.activeLabels)})`
      )
      console.log(`✓ ${targetPath}: only "${expectedActiveLabel}" active, no Classroom analytics entry`)
      return state
    }

    // A. Check non-classroom routes: only their own entry active
    await checkSidebarOnRoute('/dashboard', 'Overview')
    await checkSidebarOnRoute('/leaderboard', 'Leaderboard')
    await checkSidebarOnRoute('/settings', 'Settings')

    // B. Check classroom routes: only "Classrooms" active
    await checkSidebarOnRoute('/classroom/manage', 'Classrooms')
    await checkSidebarOnRoute('/classroom/students/c1', 'Classrooms')
    await checkSidebarOnRoute('/classroom/students/c1/progress/p1', 'Classrooms')
    await checkSidebarOnRoute('/classroom/settings/c1', 'Classrooms')
    await checkSidebarOnRoute('/analytics/c1', 'Classrooms')

    // C. Check direct bare /analytics link (redirects to /analytics/c1 while keeping Classrooms active)
    await cdp.navigate(`${BASE_URL}/analytics`)
    await sleep(700)
    const bareAnalyticsState = await cdp.evaluate(`
      (() => {
        const activeItems = Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active'));
        return {
          path: window.location.pathname,
          activeLabels: activeItems.map(el => el.querySelector('.nav-label')?.textContent?.trim() || '')
        };
      })()
    `)
    assert.strictEqual(bareAnalyticsState.path.startsWith('/analytics'), true)
    assert.deepStrictEqual(bareAnalyticsState.activeLabels, ['Classrooms'])
    console.log(`✓ Direct /analytics -> redirected to ${bareAnalyticsState.path}, Classrooms active\n`)

    console.log('=== 4. Testing Classroom Tabs & Actions Workflow ===')

    // From classroom manage, click Analytics action on classroom card
    await cdp.navigate(`${BASE_URL}/classroom/manage`)
    await sleep(600)
    await cdp.evaluate(`
      (() => {
        const analyticsBtn = document.querySelector('.classroom-card .btn-analytics, .classroom-card button[title*="Analytics" i], .classroom-card button.btn-secondary:nth-child(2)');
        if (analyticsBtn) analyticsBtn.click();
      })()
    `)
    await sleep(600)
    let currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.ok(currentUrl.startsWith('/analytics'), `Card Analytics shortcut should open /analytics (at: ${currentUrl})`)
    let active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Classrooms'])
    console.log('✓ Card Analytics shortcut navigated to analytics with Classrooms active.')

    // In ClassroomWorkspaceHeader, click "Students" tab
    await cdp.evaluate(`
      (() => {
        const studentsTab = Array.from(document.querySelectorAll('.workspace-nav .nav-link')).find(el => el.textContent.includes('Students'));
        if (studentsTab) studentsTab.click();
      })()
    `)
    await sleep(600)
    currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.ok(currentUrl.startsWith('/classroom/students'), `Students tab should navigate to /classroom/students (at: ${currentUrl})`)
    active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Classrooms'])
    console.log('✓ Classroom Students tab navigated with Classrooms active.')

    // Click "Settings" tab
    await cdp.evaluate(`
      (() => {
        const settingsTab = Array.from(document.querySelectorAll('.workspace-nav .nav-link')).find(el => el.textContent.includes('Settings'));
        if (settingsTab) settingsTab.click();
      })()
    `)
    await sleep(600)
    currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.ok(currentUrl.startsWith('/classroom/settings'), `Settings tab should navigate to /classroom/settings (at: ${currentUrl})`)
    active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Classrooms'])
    console.log('✓ Classroom Settings tab navigated with Classrooms active.')

    // Click purple "Return to all classrooms" button outside card
    await cdp.evaluate(`
      (() => {
        const returnBtn = document.querySelector('.return-button, a.btn-primary.return-button');
        if (returnBtn) returnBtn.click();
      })()
    `)
    await sleep(600)
    currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.strictEqual(currentUrl, '/classroom/manage', `Return button must navigate back to /classroom/manage`)
    active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Classrooms'])
    console.log('✓ "Return to all classrooms" button returns to /classroom/manage with Classrooms active.')

    // Test Overview header action button ("Classroom analytics")
    await cdp.navigate(`${BASE_URL}/dashboard`)
    await sleep(600)
    await cdp.evaluate(`
      (() => {
        const overviewAnalyticsBtn = Array.from(document.querySelectorAll('header button.btn-outline')).find(b => b.textContent.includes('Classroom analytics'));
        if (overviewAnalyticsBtn) overviewAnalyticsBtn.click();
      })()
    `)
    await sleep(700)
    currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.ok(currentUrl.startsWith('/analytics'), `Overview header button should open analytics (at: ${currentUrl})`)
    active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Classrooms'])
    console.log('✓ Overview header action button navigated to analytics with Classrooms active.')

    // Test Browser Back navigation
    await cdp.evaluate(`window.history.back()`)
    await sleep(600)
    currentUrl = await cdp.evaluate(`window.location.pathname`)
    assert.strictEqual(currentUrl, '/dashboard', 'History back should return to /dashboard')
    active = await cdp.evaluate(`Array.from(document.querySelectorAll('.sidebar-nav .nav-menu .nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim())`)
    assert.deepStrictEqual(active, ['Overview'], 'Overview must be active after back navigation')
    console.log('✓ Browser back navigation restores correct active sidebar item.\n')

    console.log('=== 5. Testing Mobile Viewport & Drawer Behavior (375x667) ===')

    await cdp.setViewport(375, 667)
    await cdp.navigate(`${BASE_URL}/classroom/manage`)
    await sleep(600)

    const mobileCheck1 = await cdp.evaluate(`
      (() => {
        const header = document.querySelector('.mobile-header');
        const hamburger = document.querySelector('.hamburger-btn');
        const sidebar = document.querySelector('.sidebar-nav');
        return {
          headerVisible: header && window.getComputedStyle(header).display !== 'none',
          hamburgerVisible: hamburger && window.getComputedStyle(hamburger).display !== 'none',
          sidebarOpen: sidebar && sidebar.classList.contains('mobile-open'),
        };
      })()
    `)
    assert.strictEqual(mobileCheck1.headerVisible, true, 'Mobile header visible on 375px')
    assert.strictEqual(mobileCheck1.hamburgerVisible, true, 'Hamburger visible on 375px')
    assert.strictEqual(mobileCheck1.sidebarOpen, false, 'Sidebar initially closed on mobile')

    // Open mobile menu
    await cdp.evaluate(`document.querySelector('.hamburger-btn').click()`)
    await sleep(300)
    const mobileCheck2 = await cdp.evaluate(`
      (() => {
        const sidebar = document.querySelector('.sidebar-nav');
        const activeLabels = Array.from(sidebar.querySelectorAll('.nav-item.router-link-active')).map(el => el.querySelector('.nav-label')?.textContent?.trim());
        const hasAnalytics = Array.from(sidebar.querySelectorAll('.nav-label')).some(el => el.textContent.includes('Classroom analytics'));
        return {
          sidebarOpen: sidebar.classList.contains('mobile-open'),
          activeLabels,
          hasAnalytics
        };
      })()
    `)
    assert.strictEqual(mobileCheck2.sidebarOpen, true, 'Sidebar opens with mobile-open class')
    assert.strictEqual(mobileCheck2.hasAnalytics, false, 'No Classroom analytics in mobile sidebar')
    assert.deepStrictEqual(mobileCheck2.activeLabels, ['Classrooms'], 'Classrooms active in mobile menu')

    // Close via close button
    await cdp.evaluate(`document.querySelector('.mobile-close-btn').click()`)
    await sleep(300)
    const mobileCheck3 = await cdp.evaluate(`document.querySelector('.sidebar-nav').classList.contains('mobile-open')`)
    assert.strictEqual(mobileCheck3, false, 'Sidebar closes via close button')

    // Open again and close via Escape
    await cdp.evaluate(`document.querySelector('.hamburger-btn').click()`)
    await sleep(300)
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(300)
    const mobileCheck4 = await cdp.evaluate(`document.querySelector('.sidebar-nav').classList.contains('mobile-open')`)
    assert.strictEqual(mobileCheck4, false, 'Sidebar closes via Escape key on mobile')
    console.log('✓ Mobile hamburger, drawer active state, close button, and Escape key all verified.\n')

    console.log('====================================================')
    console.log('ALL VERIFICATIONS PASSED (100% SUCCESS)')
    console.log('====================================================')
  } finally {
    if (cdp) cdp.close()
    if (chromeProc) chromeProc.kill('SIGKILL')
    if (viteProc) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F'])
      } else {
        viteProc.kill('SIGTERM')
      }
    }
  }
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err)
  process.exit(1)
})
