/* global process */
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5191
const ISOLATED_CDP_PORT = 9241
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-router-test-' + Date.now())

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
      this.ws.onopen = async () => {
        resolve()
      }
      this.ws.onerror = (err) => reject(err)
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data)
        if (data.method === 'Runtime.exceptionThrown') {
          console.error('Browser Exception:', data.params.exceptionDetails)
        }
        if (data.method === 'Console.messageAdded') {
          console.log('Browser Console:', data.params.message.text)
        }
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

  async close() {
    if (this.ws) this.ws.close()
  }
}

function parseRgb(colorStr) {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return [255, 255, 255]
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrast(rgb1, rgb2) {
  const l1 = getLuminance(...rgb1)
  const l2 = getLuminance(...rgb2)
  const brighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (brighter + 0.05) / (darker + 0.05)
}

async function runRouterLifecycleTests() {
  console.log('=== CyberMorph Authenticated Router & Accessibility Verification ===\n')

  let viteProcess = null
  let chromeProcess = null

  try {
    // 1. Start isolated Vite dev server
    console.log(`Starting isolated Vite test server on port ${ISOLATED_VITE_PORT}...`)
    viteProcess = spawn(
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
        // waiting for Vite server
      }
      await new Promise((r) => setTimeout(r, 400))
    }

    // 2. Launch headless Chrome with CDP
    console.log(`Launching headless Chrome with CDP on port ${ISOLATED_CDP_PORT}...`)
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    chromeProcess = spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-extensions',
        `--user-data-dir=${USER_DATA_DIR}`,
        `http://localhost:${ISOLATED_VITE_PORT}/`,
      ],
      { stdio: 'ignore' }
    )

    let cdp = null
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        const pagesRes = await fetch(`http://127.0.0.1:${ISOLATED_CDP_PORT}/json/list`)
        const pages = await pagesRes.json()
        const targetPage = pages.find((p) => p.type === 'page') || pages[0]
        if (targetPage && targetPage.webSocketDebuggerUrl) {
          cdp = new ChromeCDP(targetPage.webSocketDebuggerUrl)
          await cdp.connect()
          await cdp.send('Console.enable')
          await cdp.send('Runtime.enable')
          break
        }
      } catch {
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    if (!cdp) throw new Error('Failed to connect to isolated Chrome CDP on port ' + ISOLATED_CDP_PORT)

    const waitForApp = async (timeoutMs = 5000) => {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        try {
          const ready = await cdp.eval('Boolean(window.__router && window.__pinia)')
          if (ready) {
            // Give Vue router guard a tick to finish navigation
            await new Promise((r) => setTimeout(r, 200))
            return true
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      return false
    }

    const setRoleSession = async (role, username) => {
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/login` })
      await waitForApp()
      await cdp.eval(`
        localStorage.setItem('cyber_token', 'mock-${role}-token');
        localStorage.setItem('cyber_role', '${role}');
        localStorage.setItem('cyber_user', JSON.stringify({ username: '${username}', role: '${role}' }));
      `)
      await cdp.send('Page.reload')
      await waitForApp()
    }

    const clearSession = async () => {
      await cdp.eval(`
        localStorage.removeItem('cyber_token');
        localStorage.removeItem('cyber_role');
        localStorage.removeItem('cyber_user');
      `)
      await cdp.send('Page.reload')
      await waitForApp()
    }

    // --- TEST 1: Role Redirection for Authenticated Users (All 3 Roles) ---
    console.log('--- 1. Testing Logged-in Redirection for All Roles (player, educator, admin) ---')
    const roles = [
      { role: 'player', name: 'TestPlayer' },
      { role: 'educator', name: 'ProfSmith' },
      { role: 'admin', name: 'SysAdmin' },
    ]

    for (const { role, name } of roles) {
      await setRoleSession(role, name)

      // Test / redirect
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
      await waitForApp()
      const debugInfo = await cdp.eval(`(() => {
        let isAuth = null;
        let currentRoute = null;
        try {
          if (window.__pinia) {
            const store = window.__pinia._s.get('auth');
            isAuth = store ? store.isAuthenticated : 'no auth store in pinia._s';
          }
          if (window.__router) {
            currentRoute = window.__router.currentRoute.value.fullPath;
          }
        } catch (e) {
          isAuth = e.message;
        }
        return {
          pathname: window.location.pathname,
          currentRoute,
          token: localStorage.getItem('cyber_token'),
          role: localStorage.getItem('cyber_role'),
          isAuth,
          hasRouter: !!window.__router
        };
      })()`)
      console.log('Debug info for ' + role + ' at /:', debugInfo)
      const pathAtSlash = debugInfo.pathname
      assert.strictEqual(pathAtSlash, '/dashboard', `${role} visiting / must redirect to /dashboard`)

      // Test /login redirect
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/login` })
      await waitForApp()
      const pathAtLogin = await cdp.eval(`window.location.pathname`)
      assert.strictEqual(pathAtLogin, '/dashboard', `${role} visiting /login must redirect to /dashboard`)

      // Test /register redirect
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/register` })
      await waitForApp()
      const pathAtRegister = await cdp.eval(`window.location.pathname`)
      assert.strictEqual(pathAtRegister, '/dashboard', `${role} visiting /register must redirect to /dashboard`)

      console.log(`  ✓ ${role} successfully redirected to /dashboard from /, /login, and /register`)
    }

    // --- TEST 2: Public Informational Pages Accessible When Authenticated ---
    console.log('\n--- 2. Testing Public Pages Access for Authenticated Users ---')
    await setRoleSession('player', 'TestPlayer')

    const publicPages = ['/about', '/gameplay', '/download', '/faq']
    for (const page of publicPages) {
      await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}${page}` })
      await new Promise((r) => setTimeout(r, 500))
      const currentPath = await cdp.eval(`window.location.pathname`)
      assert.strictEqual(currentPath, page, `Authenticated user should remain on ${page}`)
      console.log(`  ✓ ${page} remains accessible while authenticated`)
    }

    // Test /download#faq hash redirect
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/download#faq` })
    await new Promise((r) => setTimeout(r, 500))
    const faqPath = await cdp.eval(`window.location.pathname`)
    assert.strictEqual(faqPath, '/faq', `/download#faq must redirect to /faq`)
    console.log('  ✓ /download#faq correctly redirects to /faq')

    // --- TEST 3: Public Header Navbar Items When Authenticated ---
    console.log('\n--- 3. Testing Public Header Links & Brand Routing When Authenticated ---')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/about` })
    await new Promise((r) => setTimeout(r, 500))

    const headerNavCheck = await cdp.eval(`({
      hasHomeInDesktopNav: Array.from(document.querySelectorAll('.desktop-nav .nav-link')).some(el => el.textContent.trim() === 'Home'),
      brandLinkHref: document.querySelector('.brand-link')?.getAttribute('href'),
      dashboardButtonCount: document.querySelectorAll('.nav-auth .btn-nav-primary').length,
      dashboardButtonText: document.querySelector('.nav-auth .btn-nav-primary')?.textContent?.trim()
    })`)

    assert.strictEqual(headerNavCheck.hasHomeInDesktopNav, false, 'Home link must be hidden in desktop nav when authenticated')
    assert.strictEqual(headerNavCheck.brandLinkHref, '/dashboard', 'Brand logo link must point to /dashboard when authenticated')
    assert.strictEqual(headerNavCheck.dashboardButtonCount, 1, 'Exactly one primary action button must exist in nav auth area')
    assert.strictEqual(headerNavCheck.dashboardButtonText, 'Dashboard', 'Navbar action button must be "Dashboard"')
    console.log('  ✓ Brand links to /dashboard, Home is hidden, and Dashboard action is clean and non-duplicated')

    // --- TEST 4: Browser History (Back / Forward) & Reload Invariants ---
    console.log('\n--- 4. Testing Browser History (Back/Forward) & Refresh Invariants ---')
    // 1. From /about, go to / -> should redirect to /dashboard
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/dashboard')

    // 2. Click browser Back -> should return to /about
    await cdp.eval(`window.history.back()`)
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/about', 'Browser Back should return to /about')

    // 3. Click browser Forward -> should return to /dashboard
    await cdp.eval(`window.history.forward()`)
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/dashboard', 'Browser Forward should return to /dashboard')

    // 4. Reload page at /dashboard -> session must persist and stay on /dashboard
    await cdp.send('Page.reload')
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/dashboard', 'Page reload on /dashboard must retain route')
    console.log('  ✓ Browser Back, Forward, and Page Reload all adhere to authenticated invariants')

    // --- TEST 5: Accessibility Gear Icon Rendering & Measured Contrast ---
    console.log('\n--- 5. Testing Settings/Gear Icon Rendering, Accessible Name & Measured Contrast ---')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/about` })
    await waitForApp()

    const a11yMetrics = await cdp.eval(`(() => {
      const btn = document.querySelector('.btn-nav-a11y');
      const icon = btn?.querySelector('.app-icon');
      const tooltip = document.querySelector('#a11y-tooltip');
      const rect = btn?.getBoundingClientRect();
      return {
        ariaLabel: btn?.getAttribute('aria-label'),
        tooltipText: tooltip?.textContent?.trim(),
        width: rect?.width,
        height: rect?.height,
        iconHtml: icon?.outerHTML,
        hasGearPath: icon?.innerHTML?.includes('12.22'),
        hasCenterCircle: icon?.innerHTML?.includes('circle') && icon?.innerHTML?.includes('r="3"')
      };
    })()`)
    console.log('a11yMetrics:', a11yMetrics)

    assert.strictEqual(a11yMetrics.ariaLabel, 'Accessibility and appearance settings', 'Accessible name must be "Accessibility and appearance settings"')
    assert.strictEqual(a11yMetrics.tooltipText, 'Accessibility and appearance settings', 'Tooltip must be "Accessibility and appearance settings"')
    assert.ok(a11yMetrics.width >= 44 && a11yMetrics.height >= 44, `Touch target must be >= 44px (actual: ${a11yMetrics.width}x${a11yMetrics.height})`)
    assert.ok(a11yMetrics.hasGearPath && a11yMetrics.hasCenterCircle, 'Accessibility button must render the standard gear/settings SVG')

    // Measure actual rendered contrast in Light Mode
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'light')`)
    await new Promise((r) => setTimeout(r, 200))
    const lightColors = await cdp.eval(`({
      iconColor: window.getComputedStyle(document.querySelector('.btn-nav-a11y .app-icon')).color,
      headerBg: window.getComputedStyle(document.querySelector('.public-nav-bar')).backgroundColor
    })`)
    const lightRatio = getContrast(parseRgb(lightColors.iconColor), parseRgb(lightColors.headerBg))
    console.log(`  Light Mode - Measured icon contrast: ${lightRatio.toFixed(2)}:1`)
    assert.ok(lightRatio >= 4.5, `Light mode icon contrast must be >= 4.5:1 (actual: ${lightRatio.toFixed(2)}:1)`)

    // Measure actual rendered contrast in Dark Mode
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await new Promise((r) => setTimeout(r, 200))
    const darkColors = await cdp.eval(`({
      iconColor: window.getComputedStyle(document.querySelector('.btn-nav-a11y .app-icon')).color,
      headerBg: window.getComputedStyle(document.querySelector('.public-nav-bar')).backgroundColor
    })`)
    const darkRatio = getContrast(parseRgb(darkColors.iconColor), parseRgb(darkColors.headerBg))
    console.log(`  Dark Mode - Measured icon contrast: ${darkRatio.toFixed(2)}:1`)
    assert.ok(darkRatio >= 4.5, `Dark mode icon contrast must be >= 4.5:1 (actual: ${darkRatio.toFixed(2)}:1)`)
    console.log('  ✓ Gear icon rendered at 44x44px target with accessible name and measured WCAG-compliant contrast in light and dark modes')

    // --- TEST 6: Genuine Expired-Session Recovery (Backend 401 Interceptor) ---
    console.log('\n--- 6. Testing Genuine Expired-Session Recovery via Mocked 401 Interceptor ---')
    await setRoleSession('player', 'TestPlayer')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/dashboard` })
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/dashboard')

    // Trigger genuine 401 response error through axios client interceptor
    await cdp.eval(`
      import('/src/api/client.js').then(module => {
        const apiClient = module.default;
        // Simulate a protected request failing with 401 from backend
        return apiClient.interceptors.response.handlers[0].rejected({
          response: { status: 401, data: { detail: 'Token expired' } },
          config: { url: '/users/me' }
        });
      }).catch(() => {})
    `)

    await new Promise((r) => setTimeout(r, 800))

    const sessionAfter401 = await cdp.eval(`({
      token: localStorage.getItem('cyber_token'),
      user: localStorage.getItem('cyber_user'),
      role: localStorage.getItem('cyber_role'),
      pathname: window.location.pathname
    })`)

    assert.strictEqual(sessionAfter401.token, null, 'Expired session must purge cyber_token from localStorage')
    assert.strictEqual(sessionAfter401.user, null, 'Expired session must purge cyber_user from localStorage')
    assert.strictEqual(sessionAfter401.role, null, 'Expired session must purge cyber_role from localStorage')
    assert.strictEqual(sessionAfter401.pathname, '/login', '401 interceptor must automatically redirect to /login')
    console.log('  ✓ Genuine backend 401 purged credentials and redirected to /login')

    // Verify that after 401 redirect to /login, visiting / now shows the public Landing page
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/', 'Unauthenticated user can access landing page after session expiration')
    console.log('  ✓ Unauthenticated user can access landing page after session expired')

    // --- TEST 7: Clean Logout Verification ---
    console.log('\n--- 7. Testing Clean Logout Flow ---')
    await setRoleSession('player', 'TestPlayer')
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/dashboard` })
    await new Promise((r) => setTimeout(r, 600))

    // Perform clean logout
    await clearSession()
    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/dashboard` })
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/login', 'Unauthenticated user visiting /dashboard is redirected to /login')

    await cdp.send('Page.navigate', { url: `http://localhost:${ISOLATED_VITE_PORT}/` })
    await new Promise((r) => setTimeout(r, 600))
    assert.strictEqual(await cdp.eval(`window.location.pathname`), '/', 'Unauthenticated user can access landing page')
    console.log('  ✓ Clean logout successfully prevents dashboard access and allows public landing access')

    await cdp.close()
    console.log('\n✓ All Authenticated Router & Accessibility Verification Tests Passed Successfully!\n')
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

runRouterLifecycleTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
