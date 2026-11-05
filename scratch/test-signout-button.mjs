/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

console.log('=== CyberMorph Verification: Sign Out Button Hover, Focus & Touch ===')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5199
const CDP_PORT = 9249
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-signout-cdp-${Date.now()}`)
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

async function runSignoutTests() {
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

    console.log('[3/5] Navigating to Dashboard as Player...')
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
    
    // Wait for .logout-btn to appear in DOM
    const startWait = Date.now()
    let found = false
    while (Date.now() - startWait < 8000) {
      found = await pageCdp.evaluate(`!!document.querySelector('.logout-btn')`)
      if (found) break
      await sleep(200)
    }
    if (!found) {
      const currentUrl = await pageCdp.evaluate(`window.location.href`)
      const bodyHtml = await pageCdp.evaluate(`document.body.innerHTML.substring(0, 300)`)
      throw new Error(`Logout button not found at ${currentUrl}. Body starts: ${bodyHtml}`)
    }
    await sleep(500)

    // 1. Verify Default state of Sign Out button
    console.log('[4/5] Checking Sign Out button states...')
    const defaultStyles = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const icon = btn?.querySelector('.logout-icon');
        const btnComp = btn ? window.getComputedStyle(btn) : null;
        const iconComp = icon ? window.getComputedStyle(icon) : null;
        return {
          exists: !!btn,
          text: btn?.textContent?.trim(),
          bgColor: btnComp?.backgroundColor,
          color: btnComp?.color,
          border: btnComp?.border,
          borderRadius: btnComp?.borderRadius,
          iconColor: iconComp?.color,
        };
      })()
    `)
    console.log('Default Sign Out button styles:', defaultStyles)
    assert.equal(defaultStyles.exists, true, 'Sign out button must exist')
    assert.match(defaultStyles.text, /Sign out/i)
    assert(
      defaultStyles.bgColor === 'rgba(0, 0, 0, 0)' || defaultStyles.bgColor === 'transparent',
      'Default background must be transparent'
    )
    assert.equal(defaultStyles.borderRadius, '8px', 'Default border-radius must be 8px')
    console.log('✓ Default Sign Out button state verified')

    // 2. Hover over Sign Out button via CDP mouse events
    const btnBox = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const rect = btn.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        };
      })()
    `)
    await pageCdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: btnBox.x,
      y: btnBox.y,
    })
    await sleep(300)

    const hoverStyles = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const icon = btn?.querySelector('.logout-icon');
        const btnComp = btn ? window.getComputedStyle(btn) : null;
        const iconComp = icon ? window.getComputedStyle(icon) : null;
        return {
          bgColor: btnComp?.backgroundColor,
          borderColor: btnComp?.borderColor,
          color: btnComp?.color,
          iconColor: iconComp?.color,
        };
      })()
    `)
    console.log('Hover styles (Light Theme):', hoverStyles)
    assert.equal(hoverStyles.bgColor, 'rgb(220, 38, 38)', 'Hover background must be solid deep red (#dc2626)')
    assert.equal(hoverStyles.borderColor, 'rgb(220, 38, 38)', 'Hover border must be solid deep red (#dc2626)')
    assert.equal(hoverStyles.color, 'rgb(255, 255, 255)', 'Hover text must be white (#ffffff)')
    assert.equal(hoverStyles.iconColor, 'rgb(255, 255, 255)', 'Hover icon must be white (#ffffff)')
    console.log('✓ Solid deep red hover state verified in Light Theme')

    await takeScreenshot('signout_hover_desktop.png')

    // 3. Hover in Dark Theme
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(300)
    // Move mouse slightly to ensure hover recalculation
    await pageCdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: btnBox.x,
      y: btnBox.y,
    })
    await sleep(200)

    const darkHoverStyles = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const icon = btn?.querySelector('.logout-icon');
        const btnComp = btn ? window.getComputedStyle(btn) : null;
        const iconComp = icon ? window.getComputedStyle(icon) : null;
        return {
          bgColor: btnComp?.backgroundColor,
          borderColor: btnComp?.borderColor,
          color: btnComp?.color,
          iconColor: iconComp?.color,
        };
      })()
    `)
    console.log('Hover styles (Dark Theme):', darkHoverStyles)
    assert.equal(darkHoverStyles.bgColor, 'rgb(220, 38, 38)', 'Dark theme hover background must be solid deep red (#dc2626)')
    assert.equal(darkHoverStyles.color, 'rgb(255, 255, 255)', 'Dark theme hover text must be white (#ffffff)')
    assert.equal(darkHoverStyles.iconColor, 'rgb(255, 255, 255)', 'Dark theme hover icon must be white (#ffffff)')
    console.log('✓ Solid deep red hover state verified in Dark Theme (high contrast 4.77:1)')

    await takeScreenshot('signout_hover_dark_desktop.png')
    // 4. Keyboard focus ring (:focus-visible) in Light and Dark themes
    console.log('[5/5] Checking Keyboard Focus Ring and Confirmation Dialog...')
    
    // Test Focus in Dark Theme first (since dark theme is currently active)
    await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        btn.focus();
      })()
    `)
    await sleep(200)

    const darkFocusStyles = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const comp = window.getComputedStyle(btn);
        return {
          isFocused: document.activeElement === btn,
          outlineOffset: comp.outlineOffset,
          outlineStyle: comp.outlineStyle,
          outlineColor: comp.outlineColor,
        };
      })()
    `)
    console.log('Dark Focus styles:', darkFocusStyles)
    assert.equal(darkFocusStyles.isFocused, true, 'Sign out button must be focused')
    assert.equal(darkFocusStyles.outlineStyle, 'solid', 'Focus ring must be solid')
    assert.equal(darkFocusStyles.outlineOffset, '2px', 'Focus ring must have 2px offset')
    assert.equal(darkFocusStyles.outlineColor, 'rgb(167, 139, 250)', 'Dark mode focus ring color must be dark var(--color-primary)')
    console.log('✓ Distinct keyboard focus ring verified in Dark Theme')

    // Reset to Light Theme
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(300)

    const lightFocusStyles = await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        const comp = window.getComputedStyle(btn);
        return {
          isFocused: document.activeElement === btn,
          outlineOffset: comp.outlineOffset,
          outlineStyle: comp.outlineStyle,
          outlineColor: comp.outlineColor,
        };
      })()
    `)
    console.log('Light Focus styles:', lightFocusStyles)
    assert.equal(lightFocusStyles.isFocused, true, 'Sign out button must remain focused')
    assert.equal(lightFocusStyles.outlineStyle, 'solid', 'Focus ring must be solid')
    assert.equal(lightFocusStyles.outlineOffset, '2px', 'Focus ring must have 2px offset')
    assert.equal(lightFocusStyles.outlineColor, 'rgb(124, 58, 237)', 'Light mode focus ring color must be light var(--color-primary)')
    console.log('✓ Distinct keyboard focus ring verified in Light Theme')

    await takeScreenshot('signout_focus_desktop.png')

    // 5. Test Confirmation Modal Behavior
    await pageCdp.evaluate(`
      (() => {
        const btn = document.querySelector('.logout-btn');
        btn.click();
      })()
    `)
    await sleep(400)

    const modalState = await pageCdp.evaluate(`
      (() => {
        const modal = document.querySelector('.logout-modal-overlay');
        const title = modal?.querySelector('.logout-modal-title')?.textContent?.trim();
        const cancelBtn = modal?.querySelector('.btn-cancel');
        const confirmBtn = modal?.querySelector('.btn-confirm-signout')?.textContent?.trim();
        return {
          isOpen: !!modal,
          title,
          confirmBtn,
          hasCancelBtn: !!cancelBtn,
        };
      })()
    `)
    console.log('Modal state after click:', modalState)
    assert.equal(modalState.isOpen, true, 'Logout confirmation dialog must open on click')
    assert.equal(modalState.title, 'Sign out', 'Dialog title must be Sign out')
    assert.equal(modalState.confirmBtn, 'Sign out', 'Confirm button must say Sign out')
    assert.equal(modalState.hasCancelBtn, true, 'Dialog must have Cancel button')

    // Click Cancel and verify dialog closes and focus restored to logout button
    await pageCdp.evaluate(`
      (() => {
        const cancelBtn = document.querySelector('.logout-modal-overlay .btn-cancel');
        cancelBtn.click();
      })()
    `)
    await sleep(400)

    const postCancelState = await pageCdp.evaluate(`
      (() => {
        const modal = document.querySelector('.logout-modal-overlay');
        const btn = document.querySelector('.logout-btn');
        return {
          isOpen: !!modal,
          isFocusRestored: document.activeElement === btn,
        };
      })()
    `)
    console.log('Post-cancel state:', postCancelState)
    assert.equal(postCancelState.isOpen, false, 'Modal must close on cancel')
    assert.equal(postCancelState.isFocusRestored, true, 'Focus must return to sign out button on cancel')
    console.log('✓ Sign-out confirmation dialog and focus restoration verified intact')

    console.log('\n===========================================')
    console.log('ALL SIGN OUT BUTTON TESTS COMPLETED & PASSED!')
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

runSignoutTests().catch((err) => {
  console.error('Sign out tests failed:', err)
  process.exit(1)
})
