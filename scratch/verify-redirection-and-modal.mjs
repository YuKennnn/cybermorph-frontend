/* global process */
import assert from 'node:assert'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5199
const ISOLATED_CDP_PORT = 9249
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-redir-test-' + Date.now())

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
        if (data.method === 'Runtime.consoleAPICalled') {
          console.log('BROWSER CONSOLE:', ...data.params.args.map((a) => a.value))
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

  async navigate(url, selector = '#app') {
    await this.send('Page.navigate', { url })
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const found = await this.eval(`document.querySelector(${JSON.stringify(selector)}) !== null`)
      if (found) return
    }
  }

  async close() {
    if (this.ws) this.ws.close()
  }
}

function killPidTree(pid) {
  if (!pid) return
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
  } catch (err) {
    void err
  }
}

async function run() {
  console.log('--- Starting Route Redirection and Download Modal Verification ---')

  const vite = spawn('npx.cmd', ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, VITE_USE_MOCK: 'true' },
  })

  let viteReady = false
  vite.stdout.on('data', (d) => {
    if (d.toString().includes(`http://localhost:${ISOLATED_VITE_PORT}`)) {
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

  await new Promise((r) => setTimeout(r, 1000))

  const versionRes = await fetch(`http://localhost:${ISOLATED_CDP_PORT}/json/list`)
  const targets = await versionRes.json()
  const pageTarget = targets.find((t) => t.type === 'page')
  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const baseUrl = `http://localhost:${ISOLATED_VITE_PORT}`

  try {
    // -------------------------------------------------------------
    // Test 1: Signed-out visitors reach guest pages and URL variants
    // -------------------------------------------------------------
    console.log('Test 1: Guest visits public routes and URL variants')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval('localStorage.clear()')

    const guestVariants = [
      { url: '/about', expected: '/about' },
      { url: '/About', expected: '/About' },
      { url: '/about/', expected: '/about/' },
      { url: '/faq', expected: '/faq' },
      { url: '/FAQ', expected: '/FAQ' },
      { url: '/faq/', expected: '/faq/' },
      { url: '/gameplay', expected: '/gameplay' },
      { url: '/download', expected: '/download' },
    ]

    for (const item of guestVariants) {
      await cdp.navigate(`${baseUrl}${item.url}`)
      const path = await cdp.eval('window.location.pathname')
      assert.strictEqual(path.toLowerCase().replace(/\/+$/, ''), item.expected.toLowerCase().replace(/\/+$/, ''), `Guest should access ${item.url}`)
    }

    // Guest /download#faq redirects to /faq
    console.log('Test 2: Guest /download#faq legacy redirect')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.navigate(`${baseUrl}/download#faq`)
    await new Promise((r) => setTimeout(r, 600))
    const faqPath = await cdp.eval('window.location.pathname')
    assert.strictEqual(faqPath, '/faq', 'Guest visiting /download#faq redirects to /faq')

    // -------------------------------------------------------------
    // Test 3: Signed-in user redirects to /dashboard from guest routes
    // -------------------------------------------------------------
    console.log('Test 3: Signed-in user redirects to /dashboard from guest routes')
    await cdp.navigate(`${baseUrl}/login`, '.auth-card')
    await cdp.eval(`
      localStorage.setItem('cyber_token', 'mock_jwt_token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'mock-player-1',
        username: 'HeroPlayer',
        role: 'player'
      }));
    `)

    const signedInVariants = [
      '/about',
      '/About',
      '/about/',
      '/faq',
      '/FAQ',
      '/faq/',
      '/gameplay',
      '/download',
      '/download#faq',
    ]

    for (const route of signedInVariants) {
      await cdp.navigate(`${baseUrl}${route}`)
      let currentPath = ''
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 200))
        currentPath = await cdp.eval('window.location.pathname')
        if (currentPath === '/dashboard') break
      }
      assert.strictEqual(currentPath, '/dashboard', `Signed-in user visiting ${route} must land on /dashboard`)
    }

    // -------------------------------------------------------------
    // Test 4: Back history preservation
    // -------------------------------------------------------------
    console.log('Test 4: Back history preservation after guest-route push redirect')
    await cdp.navigate(`${baseUrl}/leaderboard`)
    await new Promise((r) => setTimeout(r, 300))
    let path = await cdp.eval('window.location.pathname')
    assert.strictEqual(path, '/leaderboard', 'On leaderboard')

    // Navigate to /about (which pushes to /dashboard)
    await cdp.eval('window.__router.push("/about")')
    await new Promise((r) => setTimeout(r, 400))
    path = await cdp.eval('window.location.pathname')
    assert.strictEqual(path, '/dashboard', 'Redirected to dashboard')

    // Call history.back()
    await cdp.eval('window.history.back()')
    await new Promise((r) => setTimeout(r, 400))
    path = await cdp.eval('window.location.pathname')
    assert.strictEqual(path, '/leaderboard', 'Back button successfully returned to /leaderboard')

    // -------------------------------------------------------------
    // Test 5: Player dashboard Download button & modal interaction
    // -------------------------------------------------------------
    console.log('Test 5: Player dashboard Download button and accessible modal')
    await cdp.navigate(`${baseUrl}/dashboard`, '.download-trigger-btn')

    // Confirm button text
    const btnText = await cdp.eval('document.querySelector(".download-trigger-btn")?.innerText')
    assert(btnText.includes('Download'), 'Download button exists on Player Dashboard')

    // Open dialog
    await cdp.eval('document.querySelector(".download-trigger-btn").click()')
    await new Promise((r) => setTimeout(r, 400))

    // Confirm dialog is visible
    let modalVisible = await cdp.eval('document.querySelector(".download-modal-card") !== null')
    assert.strictEqual(modalVisible, true, 'Download modal opened')

    // Test Escape key closes modal & restores focus
    console.log('Test 5a: Escape key closes modal and restores focus')
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 })
    await new Promise((r) => setTimeout(r, 300))

    modalVisible = await cdp.eval('document.querySelector(".download-modal-card") !== null')
    assert.strictEqual(modalVisible, false, 'Modal closed on Escape')

    const focusedBtnClass = await cdp.eval('document.activeElement?.className')
    assert(focusedBtnClass.includes('download-trigger-btn'), `Focus restored to trigger button, got ${focusedBtnClass}`)

    // Test Cancel button closes modal
    console.log('Test 5b: Cancel button closes modal')
    await cdp.eval('document.querySelector(".download-trigger-btn").click()')
    await new Promise((r) => setTimeout(r, 400))
    await cdp.eval('document.querySelector(".download-modal-actions .btn-outline").click()')
    await new Promise((r) => setTimeout(r, 300))

    modalVisible = await cdp.eval('document.querySelector(".download-modal-card") !== null')
    assert.strictEqual(modalVisible, false, 'Modal closed on Cancel button')

    // -------------------------------------------------------------
    // Test 6: Valid release response flow
    // -------------------------------------------------------------
    console.log('Test 6: Valid release response flow')
    await cdp.eval('document.querySelector(".download-trigger-btn").click()')
    await new Promise((r) => setTimeout(r, 600))

    const buildText = await cdp.eval('document.querySelector(".build-badge")?.innerText')
    console.log('Release build badge:', buildText)
    assert(buildText.includes('Build 10'), 'Valid build version displayed')

    const confirmDisabled = await cdp.eval('document.querySelector(".download-modal-actions .btn-primary")?.disabled')
    assert.strictEqual(confirmDisabled, false, 'Continue button is enabled for valid release')

    await cdp.eval('document.querySelector(".modal-close-btn").click()')
    await new Promise((r) => setTimeout(r, 300))

    // -------------------------------------------------------------
    // Test 7: Empty / rejected download URL flow
    // -------------------------------------------------------------
    console.log('Test 7: Empty / rejected release URL flow')
    await cdp.eval(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 11,
        min_supported_build: 10,
        download_url: '',
        api_current: 1,
        api_min_supported: 1
      }));
    `)
    await cdp.eval('document.querySelector(".download-trigger-btn").click()')
    await new Promise((r) => setTimeout(r, 500))

    let errorVisible = await cdp.eval('document.querySelector(".error-box") !== null')
    assert.strictEqual(errorVisible, true, 'Error box displayed for empty URL')

    let continueDisabled = await cdp.eval('document.querySelector(".download-modal-actions .btn-primary")?.disabled')
    assert.strictEqual(continueDisabled, true, 'Continue button disabled when release URL is empty')

    await cdp.eval('document.querySelector(".modal-close-btn").click()')
    await new Promise((r) => setTimeout(r, 300))

    // -------------------------------------------------------------
    // Test 8: Failed response and Retry flow
    // -------------------------------------------------------------
    console.log('Test 8: Failed response and Retry flow')
    await cdp.eval(`
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_APP_VERSION__');
      sessionStorage.setItem('__CYBERMORPH_FAIL_APP_VERSION__', '1');
    `)
    await cdp.eval('document.querySelector(".download-trigger-btn").click()')
    await new Promise((r) => setTimeout(r, 500))

    errorVisible = await cdp.eval('document.querySelector(".error-box") !== null')
    assert.strictEqual(errorVisible, true, 'Error box shown on network failure')

    // Click Retry
    await cdp.eval('document.querySelector(".btn-retry")?.click()')
    await new Promise((r) => setTimeout(r, 600))

    const retriedBuild = await cdp.eval('document.querySelector(".build-badge")?.innerText')
    assert(retriedBuild.includes('Build 10'), 'Retry succeeded in loading release info')

    await cdp.eval('document.querySelector(".modal-close-btn").click()')
    await new Promise((r) => setTimeout(r, 300))

    // -------------------------------------------------------------
    // Test 9: Sign-out restores public page access
    // -------------------------------------------------------------
    console.log('Test 9: Sign out restores immediate access to public marketing routes')
    await cdp.eval('window.__pinia._s.get("auth")?.logout()')
    await cdp.navigate(`${baseUrl}/about`, '.about-page')
    path = await cdp.eval('window.location.pathname')
    assert.strictEqual(path, '/about', 'After logout, guest immediately accesses /about')

    console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY ---')
  } finally {
    await cdp.close()
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
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err)
    process.exit(1)
  })
