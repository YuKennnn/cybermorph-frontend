/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

console.log('=== CyberMorph Visual Verification: Uniform Bars & Solid Violet Nav Pill ===')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5198
const CDP_PORT = 9248
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-sidebar-cdp-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/bf7d1fc1-9e66-4899-ae20-f96344a21757'
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

  async close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const statusCode = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume()
          resolve(res.statusCode)
        })
        req.on('error', reject)
        req.setTimeout(1000, () => req.destroy())
      })
      if (statusCode >= 200 && statusCode < 400) {
        return true
      }
    } catch {
      // waiting
    }
    await sleep(250)
  }
  return false
}

async function getCDPWebSocketUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`)
  const json = await res.json()
  return json.webSocketDebuggerUrl
}

async function runVisualTests() {
  let viteProcess = null
  let chromeProcess = null
  let cdp = null
  let pageCdp = null

  try {
    console.log('[1/5] Starting Vite dev server on port', TEST_PORT)
    viteProcess = spawn(
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
    viteProcess.stdout.on('data', d => {
      const txt = d.toString()
      if (txt.includes('ready in')) console.log('[vite]', txt.trim())
    })
    viteProcess.stderr.on('data', d => console.error('[vite err]', d.toString().trim()))

    const serverReady = await waitForServer(`${BASE_URL}/`, 20000)
    if (!serverReady) throw new Error(`Vite server failed to start at ${BASE_URL}`)
    console.log('✓ Vite server ready')

    console.log('[2/5] Spawning Chrome...')
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    chromeProcess = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--window-size=1440,900',
      ],
      { stdio: 'ignore' },
    )

    await sleep(1500)
    const browserWs = await getCDPWebSocketUrl(CDP_PORT)
    cdp = new CDPClient(browserWs)
    await cdp.connect()

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const targetWs = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`
    pageCdp = new CDPClient(targetWs)
    await pageCdp.connect()

    await pageCdp.send('Page.enable')
    await pageCdp.send('DOM.enable')

    async function takeScreenshot(filename) {
      const { data } = await pageCdp.send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(ARTIFACT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      console.log(`✓ Screenshot captured: ${filename}`)
    }

    // ==========================================
    // TEST SECTION A: PLAYER DASHBOARD & BARS
    // ==========================================
    console.log('[3/5] Testing Player Overview, Uniform Violet Bars & Active Sidebar Pill...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
    await sleep(600)

    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-player-01',
        profile_id: 'p1',
        username: 'WishYouWereHere',
        role: 'player',
        display_name: 'WishYouWereHere'
      }));
    `)

    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1800)

    // Verify Active Nav Item on Player Sidebar (Desktop Light)
    const playerNavStyles = await pageCdp.evaluate(`
      (() => {
        const activeItem = document.querySelector('.nav-item.router-link-active');
        const icon = activeItem?.querySelector('.nav-icon');
        const computed = activeItem ? window.getComputedStyle(activeItem) : null;
        const iconComputed = icon ? window.getComputedStyle(icon) : null;
        return {
          exists: !!activeItem,
          text: activeItem?.textContent?.trim(),
          ariaCurrent: activeItem?.getAttribute('aria-current'),
          bgColor: computed?.backgroundColor,
          color: computed?.color,
          fontWeight: computed?.fontWeight,
          borderRadius: computed?.borderRadius,
          iconColor: iconComputed?.color,
        };
      })()
    `)
    console.log('Player active nav pill styles (Light):', playerNavStyles)
    assert.equal(playerNavStyles.exists, true, 'Active nav link must exist')
    assert.match(playerNavStyles.text, /Overview/i)
    assert.equal(playerNavStyles.ariaCurrent, 'page', 'Active nav link must have aria-current="page"')
    assert.equal(playerNavStyles.bgColor, 'rgb(139, 92, 246)', 'Active nav background must be solid violet (#8b5cf6 / var(--color-secondary))')
    assert.equal(playerNavStyles.color, 'rgb(255, 255, 255)', 'Active nav text must be white')
    assert.equal(playerNavStyles.iconColor, 'rgb(255, 255, 255)', 'Active nav icon must be white')
    assert.equal(playerNavStyles.borderRadius, '10px', 'Active nav must be rounded pill (10px)')
    assert(parseInt(playerNavStyles.fontWeight, 10) >= 600, 'Active nav text must be semibold')
    console.log('✓ Player active sidebar pill verified (Light mode)')

    // Verify Chart Bars - all have same violet fill, NO green Public Park bar
    const barStyles = await pageCdp.evaluate(`
      (() => {
        const bars = Array.from(document.querySelectorAll('.recent-progress-panel .score-bar-col')).map(col => {
          const fill = col.querySelector('.bar-fill');
          const map = fill?.getAttribute('data-map');
          const computed = fill ? window.getComputedStyle(fill) : null;
          const score = col.querySelector('.bar-score')?.textContent?.trim();
          const tag = col.querySelector('.bar-map-tag')?.textContent?.trim();
          return {
            map,
            score,
            tag,
            bgColor: computed?.backgroundColor,
            height: fill?.style?.height,
          };
        });
        return bars;
      })()
    `)
    console.log(`Verified ${barStyles.length} chart bars. First 4:`, barStyles.slice(0, 4))
    assert(barStyles.length > 0, 'Chart must have bars')
    const primaryLightRgb = 'rgb(124, 58, 237)' // var(--color-primary) in light mode
    barStyles.forEach((bar, idx) => {
      assert.equal(
        bar.bgColor,
        primaryLightRgb,
        `Bar ${idx} (map ${bar.map}) must use theme-aware violet var(--color-primary) (expected ${primaryLightRgb}, got ${bar.bgColor})`
      )
      assert.notEqual(bar.bgColor, 'rgb(5, 150, 105)', `Bar ${idx} (${bar.map}) must NOT use green`)
    })
    console.log('✓ All performance bars have identical theme-aware violet fill (Light mode)')

    await takeScreenshot('player_overview_desktop.png')

    // Test Dark Theme on Player Overview
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(400)

    const darkBarAndNavStyles = await pageCdp.evaluate(`
      (() => {
        const activeItem = document.querySelector('.nav-item.router-link-active');
        const icon = activeItem?.querySelector('.nav-icon');
        const activeComp = activeItem ? window.getComputedStyle(activeItem) : null;
        const iconComp = icon ? window.getComputedStyle(icon) : null;

        const firstBar = document.querySelector('.recent-progress-panel .bar-fill');
        const barComp = firstBar ? window.getComputedStyle(firstBar) : null;

        return {
          navBg: activeComp?.backgroundColor,
          navColor: activeComp?.color,
          iconColor: iconComp?.color,
          barBg: barComp?.backgroundColor,
        };
      })()
    `)
    console.log('Dark Theme styles:', darkBarAndNavStyles)
    assert.equal(darkBarAndNavStyles.navBg, 'rgb(139, 92, 246)', 'Dark mode nav pill background must remain solid violet (#8b5cf6)')
    assert.equal(darkBarAndNavStyles.navColor, 'rgb(255, 255, 255)', 'Dark mode nav pill text must remain white')
    assert.equal(darkBarAndNavStyles.iconColor, 'rgb(255, 255, 255)', 'Dark mode nav pill icon must remain white')
    assert.equal(darkBarAndNavStyles.barBg, 'rgb(167, 139, 250)', 'Dark mode bar fill must use dark primary violet (#a78bfa)')
    console.log('✓ Player active sidebar pill & bars verified (Dark mode)')

    await takeScreenshot('player_overview_dark_desktop.png')
    await pageCdp.evaluate(`document.documentElement.removeAttribute('data-theme');`)
    await sleep(300)

    // ==========================================
    // TEST SECTION B: EDUCATOR DASHBOARD
    // ==========================================
    console.log('[4/5] Testing Educator Sidebar active pill...')
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-educator-token');
      localStorage.setItem('cyber_role', 'educator');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-ed-01',
        profile_id: 'p-ed-01',
        username: 'educator',
        role: 'educator',
        display_name: 'educator'
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1800)

    const educatorNav = await pageCdp.evaluate(`
      (() => {
        const activeItem = document.querySelector('.nav-item.router-link-active');
        const icon = activeItem?.querySelector('.nav-icon');
        const computed = activeItem ? window.getComputedStyle(activeItem) : null;
        const iconComputed = icon ? window.getComputedStyle(icon) : null;
        return {
          exists: !!activeItem,
          text: activeItem?.textContent?.trim(),
          bgColor: computed?.backgroundColor,
          color: computed?.color,
          borderRadius: computed?.borderRadius,
          iconColor: iconComputed?.color,
        };
      })()
    `)
    console.log('Educator active nav pill:', educatorNav)
    assert.equal(educatorNav.exists, true, 'Educator active nav item must exist')
    assert.match(educatorNav.text, /Overview/i)
    assert.equal(educatorNav.bgColor, 'rgb(139, 92, 246)', 'Educator nav background must be solid violet')
    assert.equal(educatorNav.color, 'rgb(255, 255, 255)', 'Educator nav text must be white')
    assert.equal(educatorNav.iconColor, 'rgb(255, 255, 255)', 'Educator nav icon must be white')
    assert.equal(educatorNav.borderRadius, '10px', 'Educator nav must have 10px rounded corners')
    console.log('✓ Educator active sidebar pill verified')

    await takeScreenshot('educator_sidebar_desktop.png')

    // ==========================================
    // TEST SECTION C: ADMIN SIDEBAR
    // ==========================================
    console.log('[5/5] Testing Admin Sidebar active pill & Mobile Drawer...')
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-admin-token');
      localStorage.setItem('cyber_role', 'admin');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-admin-01',
        profile_id: 'p-admin-01',
        username: 'admin',
        role: 'admin',
        display_name: 'admin'
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/users` })
    await sleep(1800)

    const adminNav = await pageCdp.evaluate(`
      (() => {
        const activeItem = document.querySelector('.nav-item.router-link-active');
        const icon = activeItem?.querySelector('.nav-icon');
        const computed = activeItem ? window.getComputedStyle(activeItem) : null;
        const iconComputed = icon ? window.getComputedStyle(icon) : null;
        return {
          exists: !!activeItem,
          text: activeItem?.textContent?.trim(),
          bgColor: computed?.backgroundColor,
          color: computed?.color,
          borderRadius: computed?.borderRadius,
          iconColor: iconComputed?.color,
        };
      })()
    `)
    console.log('Admin active nav pill:', adminNav)
    assert.equal(adminNav.exists, true, 'Admin active nav item must exist')
    assert.match(adminNav.text, /Users/i)
    assert.equal(adminNav.bgColor, 'rgb(139, 92, 246)', 'Admin nav background must be solid violet')
    assert.equal(adminNav.color, 'rgb(255, 255, 255)', 'Admin nav text must be white')
    assert.equal(adminNav.iconColor, 'rgb(255, 255, 255)', 'Admin nav icon must be white')
    assert.equal(adminNav.borderRadius, '10px', 'Admin nav must have 10px rounded corners')
    console.log('✓ Admin active sidebar pill verified')

    await takeScreenshot('admin_sidebar_desktop.png')

    // Mobile Drawer Test (390px)
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(500)

    // Switch back to player
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-player-01',
        profile_id: 'p1',
        username: 'WishYouWereHere',
        role: 'player',
        display_name: 'WishYouWereHere'
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1500)

    // Open mobile sidebar drawer
    await pageCdp.evaluate(`
      (() => {
        const menuBtn = document.querySelector('.btn-menu');
        if (menuBtn) menuBtn.click();
      })()
    `)
    await sleep(500)

    const mobileNavStyles = await pageCdp.evaluate(`
      (() => {
        const activeItem = document.querySelector('.sidebar.open .nav-item.router-link-active, .nav-item.router-link-active');
        const icon = activeItem?.querySelector('.nav-icon');
        const computed = activeItem ? window.getComputedStyle(activeItem) : null;
        const iconComputed = icon ? window.getComputedStyle(icon) : null;
        return {
          exists: !!activeItem,
          text: activeItem?.textContent?.trim(),
          bgColor: computed?.backgroundColor,
          color: computed?.color,
          borderRadius: computed?.borderRadius,
          iconColor: iconComputed?.color,
        };
      })()
    `)
    console.log('Mobile open drawer active nav:', mobileNavStyles)
    assert.equal(mobileNavStyles.bgColor, 'rgb(139, 92, 246)', 'Mobile active nav must be solid violet')
    assert.equal(mobileNavStyles.color, 'rgb(255, 255, 255)', 'Mobile active nav text must be white')
    assert.equal(mobileNavStyles.iconColor, 'rgb(255, 255, 255)', 'Mobile active nav icon must be white')

    await takeScreenshot('player_sidebar_mobile.png')
    console.log('✓ Mobile sidebar drawer active pill verified')

    console.log('\n===========================================')
    console.log('ALL VISUAL VERIFICATIONS COMPLETED & PASSED!')
    console.log('===========================================')
  } finally {
    if (pageCdp) await pageCdp.close().catch(() => {})
    if (cdp) await cdp.close().catch(() => {})
    if (chromeProcess && chromeProcess.pid) {
      if (isWindows) spawn('taskkill', ['/pid', String(chromeProcess.pid), '/T', '/F'])
      else chromeProcess.kill('SIGTERM')
    }
    if (viteProcess && viteProcess.pid) {
      if (isWindows) spawn('taskkill', ['/pid', String(viteProcess.pid), '/T', '/F'])
      else viteProcess.kill('SIGTERM')
    }
    await sleep(800)
  }
}

runVisualTests().catch((err) => {
  console.error('Visual verification failed:', err)
  process.exit(1)
})
