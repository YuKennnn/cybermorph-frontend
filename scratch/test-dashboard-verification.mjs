/* global process */
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5189
const ISOLATED_CDP_PORT = 9239
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-dashboard-test-' + Date.now())

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

// Relative luminance calculation for RGB
function parseRgb(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return [0, 0, 0]
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

function getLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrast(rgb1, rgb2) {
  const l1 = getLuminance(rgb1)
  const l2 = getLuminance(rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

async function runDashboardVerification() {
  console.log('=== CyberMorph Dashboard & Visual Verification Suite ===\n')

  fs.mkdirSync(USER_DATA_DIR, { recursive: true })

  console.log(`Starting isolated Vite server on port ${ISOLATED_VITE_PORT}...`)
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

  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const res = await fetch(`http://localhost:${ISOLATED_VITE_PORT}/`)
      if (res.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  console.log('Launching headless Chrome with CDP on port', ISOLATED_CDP_PORT)
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
  ])

  let cdp = null
  try {
    for (let attempt = 0; attempt < 25; attempt++) {
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

    const setRoleSession = async (role, username) => {
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/login` })
      await new Promise(r => setTimeout(r, 400))
      await cdp.eval(`
        localStorage.setItem('cyber_token', 'mock-${role}-token');
        localStorage.setItem('cyber_role', '${role}');
        localStorage.setItem('cyber_user', JSON.stringify({ username: '${username}', role: '${role}' }));
      `)
    }

    const testViewports = [
      { name: 'Mobile (320px)', width: 320, height: 600, mobile: true },
      { name: 'Tablet (768px)', width: 768, height: 1024, mobile: true },
      { name: 'Laptop with Sidebar (1024px)', width: 1024, height: 768, mobile: false },
      { name: 'Desktop HD (1440px)', width: 1440, height: 900, mobile: false },
    ]

    // Destination inventory
    const playerDestinations = [
      { path: '/dashboard', name: 'Player Overview' },
      { path: '/leaderboard', name: 'Leaderboard' },
      { path: '/classroom/join', name: 'Classroom Join' },
      { path: '/settings', name: 'Settings' },
      { path: '/settings?section=accessibility', name: 'Settings Accessibility Tab' },
    ]

    const educatorDestinations = [
      { path: '/dashboard', name: 'Educator Overview' },
      { path: '/classroom/manage', name: 'Classrooms Management' },
      { path: '/classroom/students/c1', name: 'Classroom Students (Roster)' },
      { path: '/classroom/students/c1/progress/p1', name: 'Student Progress' },
      { path: '/classroom/settings/c1', name: 'Classroom Settings' },
      { path: '/analytics', name: 'Classroom Analytics' },
      { path: '/analytics/c1', name: 'Classroom Analytics (c1)' },
      { path: '/settings', name: 'Educator Settings' },
    ]

    const adminDestinations = [
      { path: '/dashboard', name: 'Admin Overview' },
      { path: '/admin/users', name: 'Admin Users' },
      { path: '/admin/approvals', name: 'Admin Approvals' },
      { path: '/settings', name: 'Admin Settings' },
    ]

    // 1. Player Role Destination Testing
    console.log('\n--- 1. Testing Player Role Destinations ---')
    await setRoleSession('player', 'TestPlayer')

    for (const dest of playerDestinations) {
      console.log(`Checking ${dest.name} (${dest.path})...`)
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}${dest.path}` })
      await new Promise(r => setTimeout(r, 600))

      for (const vp of testViewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.mobile,
        })
        await new Promise(r => setTimeout(r, 150))

        await cdp.eval(`document.querySelectorAll('[class*="vue-devtools"], iframe[src*="__devtools__"]').forEach(el => el.remove())`)
        const overflow = await cdp.eval(`({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`)
        if (overflow.hasHScroll) {
          const culprits = await cdp.eval(`
            Array.from(document.querySelectorAll('*')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.right > document.documentElement.clientWidth + 1;
            }).slice(0, 5).map(el => ({ tag: el.tagName, cls: el.className, id: el.id, right: el.getBoundingClientRect().right }))
          `);
          console.error('Culprits in ' + dest.name + ' at ' + vp.name + ':', JSON.stringify(culprits));
        }
        assert.strictEqual(overflow.hasHScroll, false, `${dest.name} must not horizontally scroll the page at ${vp.name}`)
      }
    }
    console.log('✓ All Player Destinations Passed!')

    // 2. Educator Role Destination Testing
    console.log('\n--- 2. Testing Educator Role Destinations ---')
    await setRoleSession('educator', 'TeacherJane')

    for (const dest of educatorDestinations) {
      console.log(`Checking ${dest.name} (${dest.path})...`)
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}${dest.path}` })
      await new Promise(r => setTimeout(r, 600))

      for (const vp of testViewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.mobile,
        })
        await new Promise(r => setTimeout(r, 150))

        await cdp.eval(`document.querySelectorAll('[class*="vue-devtools"], iframe[src*="__devtools__"]').forEach(el => el.remove())`)
        const overflow = await cdp.eval(`({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`)
        if (overflow.hasHScroll) {
          const culprits = await cdp.eval(`
            Array.from(document.querySelectorAll('*')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.right > document.documentElement.clientWidth + 1;
            }).slice(0, 5).map(el => ({ tag: el.tagName, cls: el.className, id: el.id, right: el.getBoundingClientRect().right }))
          `);
          console.error('Culprits at ' + vp.name + ':', JSON.stringify(culprits));
        }
        assert.strictEqual(overflow.hasHScroll, false, `${dest.name} must not horizontally scroll the page at ${vp.name}`)
      }
    }
    console.log('✓ All Educator Destinations Passed!')

    // 3. Admin Role Destination Testing
    console.log('\n--- 3. Testing Admin Role Destinations ---')
    await setRoleSession('admin', 'AdminLead')

    for (const dest of adminDestinations) {
      console.log(`Checking ${dest.name} (${dest.path})...`)
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}${dest.path}` })
      await new Promise(r => setTimeout(r, 600))

      for (const vp of testViewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.mobile,
        })
        await new Promise(r => setTimeout(r, 150))

        await cdp.eval(`document.querySelectorAll('[class*="vue-devtools"], iframe[src*="__devtools__"]').forEach(el => el.remove())`)
        const overflow = await cdp.eval(`({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`)
        if (overflow.hasHScroll) {
          const culprits = await cdp.eval(`
            Array.from(document.querySelectorAll('*')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.right > document.documentElement.clientWidth + 1;
            }).slice(0, 5).map(el => ({ tag: el.tagName, cls: el.className, id: el.id, right: el.getBoundingClientRect().right }))
          `);
          console.error('Culprits in ' + dest.name + ' at ' + vp.name + ':', JSON.stringify(culprits));
        }
        assert.strictEqual(overflow.hasHScroll, false, `${dest.name} must not horizontally scroll the page at ${vp.name}`)
      }
    }
    console.log('✓ All Admin Destinations Passed!')

    // 4. Dedicated Table Scrolling & Pagination Anchoring Invariant
    console.log('\n--- 4. Testing Dedicated Table Scrolling & Pagination Containment ---')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true })
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/admin/users` })
    await new Promise(r => setTimeout(r, 800))

    const tableInspection = await cdp.eval(`({
      hasTableScroll: !!document.querySelector('.table-card .table-scroll'),
      tableScrollWidth: document.querySelector('.table-scroll')?.scrollWidth || 0,
      tableClientWidth: document.querySelector('.table-scroll')?.clientWidth || 0,
      cardScrollWidth: document.querySelector('.table-card')?.scrollWidth || 0,
      cardClientWidth: document.querySelector('.table-card')?.clientWidth || 0,
      paginationWidth: document.querySelector('.pagination-bar')?.getBoundingClientRect()?.width || 0
    })`)

    console.log('Admin Users Table scroll metrics at 375px:', tableInspection)
    assert.strictEqual(tableInspection.hasTableScroll, true, 'table-card must contain dedicated table-scroll wrapper')
    assert.ok(tableInspection.tableScrollWidth > tableInspection.tableClientWidth, 'table itself must scroll horizontally inside table-scroll')
    assert.strictEqual(tableInspection.cardScrollWidth, tableInspection.cardClientWidth, 'table-card itself must NOT scroll horizontally')

    // 5. Text Size Enlargement & Label Clipping Check
    console.log('\n--- 5. Testing Enlarged Text & Header Button Clipping ---')
    // Reset to public unauthenticated view at 1024px
    await cdp.eval(`
      localStorage.removeItem('cyber_token');
      localStorage.removeItem('cyber_role');
      localStorage.removeItem('cyber_user');
      document.documentElement.setAttribute('data-text-size', 'extra-large');
    `)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
    await new Promise(r => setTimeout(r, 700))

    const buttonMetrics = await cdp.eval(`({
      registerHeight: Math.round(document.querySelector('.btn-nav-primary')?.getBoundingClientRect()?.height || 0),
      registerScrollHeight: document.querySelector('.btn-nav-primary')?.scrollHeight || 0,
      signInHeight: Math.round(document.querySelector('.btn-nav-secondary')?.getBoundingClientRect()?.height || 0),
      signInScrollHeight: document.querySelector('.btn-nav-secondary')?.scrollHeight || 0,
      a11yHeight: Math.round(document.querySelector('.btn-nav-a11y')?.getBoundingClientRect()?.height || 0)
    })`)
    console.log('Button metrics at extra-large text size:', buttonMetrics)
    assert.ok(buttonMetrics.registerHeight >= buttonMetrics.registerScrollHeight, 'Register button must accommodate text without vertical overflow')
    assert.ok(buttonMetrics.signInHeight >= buttonMetrics.signInScrollHeight, 'Sign in button must accommodate text without vertical overflow')
    assert.ok(buttonMetrics.a11yHeight >= 44, 'A11y button must preserve minimum 44px touch target')

    // 6. Visual Theme Contrast Checking (Light and Dark)
    console.log('\n--- 6. Testing Visual Theme Contrast (Light and Dark) ---')

    // Light Theme
    await cdp.eval(`
      document.documentElement.setAttribute('data-text-size', 'standard');
      document.documentElement.setAttribute('data-theme', 'light');
    `)
    await new Promise(r => setTimeout(r, 200))
    const lightThemeStyles = await cdp.eval(`({
      registerColor: window.getComputedStyle(document.querySelector('.btn-nav-primary')).color,
      registerBg: window.getComputedStyle(document.querySelector('.btn-nav-primary')).backgroundColor,
      a11yColor: window.getComputedStyle(document.querySelector('.btn-nav-a11y')).color,
      headerBg: window.getComputedStyle(document.querySelector('.public-nav-bar')).backgroundColor,
    })`)

    const lightRegContrast = getContrast(parseRgb(lightThemeStyles.registerColor), parseRgb(lightThemeStyles.registerBg))
    const lightA11yContrast = getContrast(parseRgb(lightThemeStyles.a11yColor), parseRgb(lightThemeStyles.headerBg))
    console.log(`Light Mode - Register contrast: ${lightRegContrast.toFixed(2)}:1, A11y contrast: ${lightA11yContrast.toFixed(2)}:1`)
    assert.ok(lightRegContrast >= 4.5, `Register button text must have >= 4.5:1 contrast in light mode (actual: ${lightRegContrast.toFixed(2)}:1)`)
    assert.ok(lightA11yContrast >= 4.5, `A11y icon button must have >= 4.5:1 contrast in light mode (actual: ${lightA11yContrast.toFixed(2)}:1)`)

    // Dark Theme
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await new Promise(r => setTimeout(r, 200))
    const darkThemeStyles = await cdp.eval(`({
      registerColor: window.getComputedStyle(document.querySelector('.btn-nav-primary')).color,
      registerBg: window.getComputedStyle(document.querySelector('.btn-nav-primary')).backgroundColor,
      a11yColor: window.getComputedStyle(document.querySelector('.btn-nav-a11y')).color,
      headerBg: window.getComputedStyle(document.querySelector('.public-nav-bar')).backgroundColor,
    })`)

    const darkRegContrast = getContrast(parseRgb(darkThemeStyles.registerColor), parseRgb(darkThemeStyles.registerBg))
    const darkA11yContrast = getContrast(parseRgb(darkThemeStyles.a11yColor), parseRgb(darkThemeStyles.headerBg))
    console.log(`Dark Mode - Register contrast: ${darkRegContrast.toFixed(2)}:1, A11y contrast: ${darkA11yContrast.toFixed(2)}:1`)
    assert.ok(darkRegContrast >= 4.5, `Register button text must have >= 4.5:1 contrast in dark mode (actual: ${darkRegContrast.toFixed(2)}:1)`)
    assert.ok(darkA11yContrast >= 4.5, `A11y icon button must have >= 4.5:1 contrast in dark mode (actual: ${darkA11yContrast.toFixed(2)}:1)`)

    await cdp.close()
    console.log('\n✓ Dashboard Verification Suite Completed Successfully!\n')
  } finally {
    if (viteProcess) viteProcess.kill()
    if (chromeProcess) chromeProcess.kill()
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

runDashboardVerification()
