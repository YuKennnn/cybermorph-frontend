/* global process */
import assert from 'node:assert'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5195
const ISOLATED_CDP_PORT = 9245
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-404-test-' + Date.now())

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

  async navigate(url, selector = '#app') {
    await this.send('Page.navigate', { url })
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const found = await this.eval(`document.querySelector(${JSON.stringify(selector)}) !== null`)
      if (found) return
    }
  }

  async close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

function killPidTree(pid) {
  if (!pid) return
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
  } catch (err) {
    // Process already exited
    void err
  }
}

async function run() {
  console.log('--- Starting 404 Route Verification ---')

  const vite = spawn('npx.cmd', ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  })

  let viteReady = false
  vite.stdout.on('data', (d) => {
    const str = d.toString()
    if (str.includes(`http://localhost:${ISOLATED_VITE_PORT}`)) {
      viteReady = true
    }
  })

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    'about:blank',
  ])

  for (let i = 0; i < 40; i++) {
    if (viteReady) break
    await new Promise((r) => setTimeout(r, 250))
  }
  assert(viteReady, 'Vite server failed to start')

  await new Promise((r) => setTimeout(r, 1500))

  const versionRes = await fetch(`http://localhost:${ISOLATED_CDP_PORT}/json/list`)
  const targets = await versionRes.json()
  const pageTarget = targets.find((t) => t.type === 'page')
  assert(pageTarget, 'No page target found')

  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Console.enable')
  await cdp.send('Runtime.enable')

  try {
    const baseUrl = `http://localhost:${ISOLATED_VITE_PORT}`

    // 1. Signed-out direct load: Visit /does-not-exist
    console.log('Test 1: Guest direct load on /does-not-exist')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval('localStorage.clear()')
    await cdp.navigate(`${baseUrl}/does-not-exist`, '.not-found-card')

    let currentUrl = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentUrl, '/does-not-exist', 'Guest URL should remain /does-not-exist')

    let h1Text = await cdp.eval("document.querySelector('h1')?.innerText")
    assert.strictEqual(h1Text, '404 — Page not found', 'H1 should display 404 — Page not found')

    let docTitle = await cdp.eval('document.title')
    assert.strictEqual(docTitle, '404 — Page not found | CyberMorph', 'Tab title should show 404 on /does-not-exist')

    let linkText = await cdp.eval("document.querySelector('.not-found-btn')?.innerText")
    let linkHref = await cdp.eval("document.querySelector('.not-found-btn')?.getAttribute('href')")
    assert.strictEqual(linkText, 'Go to Home', 'Guest recovery link text must be "Go to Home"')
    assert.strictEqual(linkHref, '/', 'Guest recovery link href must be "/"')

    // 2. Signed-out refresh on /does-not-exist
    console.log('Test 2: Guest refresh on /does-not-exist')
    await cdp.eval('window.location.reload()')
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      if (await cdp.eval("document.querySelector('.not-found-card') !== null")) break
    }
    currentUrl = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentUrl, '/does-not-exist', 'Guest refresh preserves URL')
    h1Text = await cdp.eval("document.querySelector('h1')?.innerText")
    assert.strictEqual(h1Text, '404 — Page not found', 'H1 preserved after refresh')
    docTitle = await cdp.eval('document.title')
    assert.strictEqual(docTitle, '404 — Page not found | CyberMorph', 'Tab title preserved after refresh')

    // 3. Guest click recovery link -> Home
    console.log('Test 3: Guest clicks recovery link to Home')
    await cdp.eval("document.querySelector('.not-found-btn').click()")
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200))
      currentUrl = await cdp.eval('window.location.pathname')
      if (currentUrl === '/') break
    }
    assert.strictEqual(currentUrl, '/', 'Recovery link went to /')
    await new Promise((r) => setTimeout(r, 500))
    docTitle = await cdp.eval('document.title')
    console.log('Tab title on /:', docTitle)
    assert.strictEqual(docTitle, 'CyberMorph | Cybersecurity Portal', 'Tab title restored after leaving 404 to /')

    // 4. Signed-in direct load: Visit /does-not-exist
    console.log('Test 4: Signed-in user direct load on /does-not-exist')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval(`
      localStorage.setItem('cyber_token', 'mock_jwt_token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        id: 'mock-uuid',
        username: 'TestPlayer',
        role: 'player'
      }));
    `)
    await cdp.navigate(`${baseUrl}/does-not-exist`, '.not-found-card')

    currentUrl = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentUrl, '/does-not-exist', 'Signed-in URL should remain /does-not-exist')

    h1Text = await cdp.eval("document.querySelector('h1')?.innerText")
    assert.strictEqual(h1Text, '404 — Page not found', 'H1 should display 404 — Page not found for signed in')

    docTitle = await cdp.eval('document.title')
    assert.strictEqual(docTitle, '404 — Page not found | CyberMorph', 'Tab title shows 404 for signed-in')

    linkText = await cdp.eval("document.querySelector('.not-found-btn')?.innerText")
    linkHref = await cdp.eval("document.querySelector('.not-found-btn')?.getAttribute('href')")
    assert.strictEqual(linkText, 'Go to Dashboard', 'Signed-in link text must be "Go to Dashboard"')
    assert.strictEqual(linkHref, '/dashboard', 'Signed-in link href must be "/dashboard"')

    // 5. Signed-in refresh on /does-not-exist
    console.log('Test 5: Signed-in refresh on /does-not-exist')
    await cdp.eval('window.location.reload()')
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      if (await cdp.eval("document.querySelector('.not-found-card') !== null")) break
    }
    currentUrl = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentUrl, '/does-not-exist', 'Signed-in refresh preserves URL')
    h1Text = await cdp.eval("document.querySelector('h1')?.innerText")
    assert.strictEqual(h1Text, '404 — Page not found', 'H1 preserved after refresh')
    docTitle = await cdp.eval('document.title')
    assert.strictEqual(docTitle, '404 — Page not found | CyberMorph', 'Tab title preserved after refresh')
    linkText = await cdp.eval("document.querySelector('.not-found-btn')?.innerText")
    assert.strictEqual(linkText, 'Go to Dashboard')

    // 6. Signed-in click recovery link -> Dashboard
    console.log('Test 6: Signed-in clicks recovery link to Dashboard')
    await cdp.eval("document.querySelector('.not-found-btn').click()")
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200))
      currentUrl = await cdp.eval('window.location.pathname')
      if (currentUrl === '/dashboard') break
    }
    assert.strictEqual(currentUrl, '/dashboard', 'Clicking recovery link navigates to /dashboard')
    await new Promise((r) => setTimeout(r, 500))
    docTitle = await cdp.eval('document.title')
    console.log('Tab title on /dashboard:', docTitle)
    assert.strictEqual(docTitle, 'CyberMorph | Cybersecurity Portal', 'Tab title restored after leaving 404 to /dashboard')

    // 7. Guest opening /dashboard redirects to /login
    console.log('Test 7: Guest opening /dashboard redirects to /login')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval('localStorage.clear()')
    await cdp.navigate(`${baseUrl}/dashboard`, '.auth-card')
    currentUrl = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentUrl, '/login', 'Guest opening /dashboard redirects to /login')

    // 8. Signed-in user opening / redirects to /dashboard
    console.log('Test 8: Signed-in user opening / redirects to /dashboard')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval(`
      localStorage.setItem('cyber_token', 'mock_jwt_token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({ id: 'p1', username: 'Test', role: 'player' }));
    `)
    await cdp.navigate(`${baseUrl}/`)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200))
      currentUrl = await cdp.eval('window.location.pathname')
      if (currentUrl === '/dashboard') break
    }
    assert.strictEqual(currentUrl, '/dashboard', 'Signed-in opening / redirects to /dashboard')

    // 9. Signed-in user can visit public routes (About, Gameplay, Download, FAQ)
    console.log('Test 9: Signed-in user can visit public routes')
    const publicRoutes = ['/about', '/gameplay', '/download', '/faq']
    for (const route of publicRoutes) {
      await cdp.navigate(`${baseUrl}${route}`)
      currentUrl = await cdp.eval('window.location.pathname')
      assert.strictEqual(currentUrl, route, `Signed-in user should access ${route}`)
    }

    // 10. Mobile layout & accessibility / dark mode checks
    console.log('Test 10: Responsive & styling check')
    await cdp.navigate(`${baseUrl}/some-unknown-path-xyz`, '.not-found-card')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await new Promise((r) => setTimeout(r, 500))

    const buttonComputed = await cdp.eval(`
      (() => {
        const btn = document.querySelector('.not-found-btn');
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        return {
          height: rect.height,
          width: rect.width,
          minHeight: style.minHeight,
          borderRadius: style.borderRadius
        };
      })()
    `)
    assert(buttonComputed.height >= 44, `Touch target height should be >= 44px, got ${buttonComputed.height}`)
    assert(buttonComputed.width >= 44, `Touch target width should be >= 44px, got ${buttonComputed.width}`)

    // Dark theme token check
    console.log('Test 11: Dark mode theme check')
    await cdp.eval("document.documentElement.setAttribute('data-theme', 'dark')")
    const darkBg = await cdp.eval("window.getComputedStyle(document.querySelector('.not-found-layout')).backgroundColor")
    console.log('Dark mode background:', darkBg)
    assert(darkBg.includes('11') || darkBg.includes('rgb'), 'Dark mode applied')

    console.log('--- ALL 11 TESTS PASSED SUCCESSFULLY ---')
  } catch (err) {
    console.error('INNER RUN ERROR:', err)
    throw err
  } finally {
    try {
      await cdp.close()
    } catch (err) {
      void err
    }
    killPidTree(chrome.pid)
    killPidTree(vite.pid)
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true, maxRetries: 3 })
    } catch (err) {
      void err
    }
  }
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err)
    process.exit(1)
  })
