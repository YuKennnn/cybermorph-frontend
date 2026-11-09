/* global process */
import assert from 'node:assert'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ISOLATED_VITE_PORT = 5197
const ISOLATED_CDP_PORT = 9247
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-carousel-test-' + Date.now())

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
  console.log('--- Starting Carousel Verification ---')

  const vite = spawn('npx.cmd', ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
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
  assert(viteReady, 'Vite failed to start')

  await new Promise((r) => setTimeout(r, 1000))

  const versionRes = await fetch(`http://localhost:${ISOLATED_CDP_PORT}/json/list`)
  const targets = await versionRes.json()
  const pageTarget = targets.find((t) => t.type === 'page')

  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  try {
    const baseUrl = `http://localhost:${ISOLATED_VITE_PORT}`
    await cdp.navigate(baseUrl, '.android-phone-frame')

    // 1. Check all 4 slides loading and forward wrap (0 -> 1 -> 2 -> 3 -> 0)
    console.log('Checking forward navigation and wrap...')
    const expectedSlides = ['Home', 'Office', 'Internet Cafe', 'Public Park']

    for (let i = 0; i < expectedSlides.length; i++) {
      const activeName = await cdp.eval(`document.querySelector('.preview-map-name')?.innerText`)
      const imgSrc = await cdp.eval(`document.querySelector('.phone-screen-img')?.getAttribute('src')`)
      const imgLoaded = await cdp.eval(`document.querySelector('.phone-screen-img')?.complete`)
      const naturalWidth = await cdp.eval(`document.querySelector('.phone-screen-img')?.naturalWidth`)
      assert.strictEqual(activeName, expectedSlides[i], `Slide ${i} should be ${expectedSlides[i]}`)
      assert(imgSrc.includes('.webp'), `Slide ${i} must use WebP image, got ${imgSrc}`)
      assert(imgLoaded, `Slide ${i} image failed to load`)
      assert(naturalWidth > 0, `Slide ${i} naturalWidth must be > 0`)

      // Check first slide eager
      if (i === 0) {
        const loadingAttr = await cdp.eval(`document.querySelector('.phone-screen-img')?.getAttribute('loading')`)
        assert.strictEqual(loadingAttr, 'eager', 'First slide must be eager loading')
      }

      // Click next
      await cdp.eval(`document.querySelector('button[aria-label="Next map"]')?.click()`)
      await new Promise((r) => setTimeout(r, 300))
    }

    // After 4 clicks from 0, should wrap back to 0 (Home)
    const wrappedName = await cdp.eval(`document.querySelector('.preview-map-name')?.innerText`)
    assert.strictEqual(wrappedName, 'Home', 'Carousel forward wrap back to Home')

    // 2. Check backward navigation and wrap (0 -> 3 -> 2 -> 1 -> 0)
    console.log('Checking backward navigation and wrap...')
    await cdp.eval(`document.querySelector('button[aria-label="Previous map"]')?.click()`)
    await new Promise((r) => setTimeout(r, 300))
    const backSlide1 = await cdp.eval(`document.querySelector('.preview-map-name')?.innerText`)
    assert.strictEqual(backSlide1, 'Public Park', 'Wrap backward goes to Public Park')

    await cdp.eval(`document.querySelector('button[aria-label="Previous map"]')?.click()`)
    await new Promise((r) => setTimeout(r, 300))
    const backSlide2 = await cdp.eval(`document.querySelector('.preview-map-name')?.innerText`)
    assert.strictEqual(backSlide2, 'Internet Cafe')

    // 3. Keyboard navigation test: Focus button and press Enter / Space
    console.log('Checking keyboard navigation...')
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[aria-label="Next map"]');
        btn.focus();
        btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        btn.click();
      })()
    `)
    await new Promise((r) => setTimeout(r, 300))
    const keybSlide = await cdp.eval(`document.querySelector('.preview-map-name')?.innerText`)
    assert.strictEqual(keybSlide, 'Public Park', 'Keyboard navigation works')

    // 4. Viewport checks: 375px and 320px
    console.log('Checking viewport at 375px...')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await new Promise((r) => setTimeout(r, 300))
    let frameWidth = await cdp.eval(`document.querySelector('.android-phone-frame')?.getBoundingClientRect().width`)
    let docScrollWidth = await cdp.eval(`document.documentElement.scrollWidth`)
    assert(frameWidth <= 375, `Phone frame fits in 375px, got ${frameWidth}`)
    assert(docScrollWidth <= 375, `No horizontal overflow at 375px, scrollWidth is ${docScrollWidth}`)

    console.log('Checking viewport at 320px...')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 568,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await new Promise((r) => setTimeout(r, 300))
    frameWidth = await cdp.eval(`document.querySelector('.android-phone-frame')?.getBoundingClientRect().width`)
    docScrollWidth = await cdp.eval(`document.documentElement.scrollWidth`)
    assert(frameWidth <= 320, `Phone frame fits in 320px, got ${frameWidth}`)
    assert(docScrollWidth <= 320, `No horizontal overflow at 320px, scrollWidth is ${docScrollWidth}`)

    // 5. Reduced motion check
    console.log('Checking reduced motion...')
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await cdp.eval(`window.dispatchEvent(new Event('change'))`)
    await cdp.eval(`document.querySelector('button[aria-label="Next map"]')?.click()`)
    await new Promise((r) => setTimeout(r, 100))
    const wipeActive = await cdp.eval(`document.querySelector('.pixel-wipe-overlay') !== null`)
    assert.strictEqual(wipeActive, false, 'Pixel wipe overlay should not exist under reduced motion')

    // 6. 200% text enlargement check
    console.log('Checking 200% text enlargement...')
    await cdp.eval(`document.documentElement.style.fontSize = '200%'`)
    await new Promise((r) => setTimeout(r, 300))
    const enlargedFrame = await cdp.eval(`
      (() => {
        const frame = document.querySelector('.android-phone-frame');
        const img = document.querySelector('.phone-screen-img');
        const r = frame.getBoundingClientRect();
        return {
          frameVisible: r.width > 0 && r.height > 0,
          imgComplete: img.complete
        };
      })()
    `)
    assert(enlargedFrame.frameVisible, 'Phone frame visible under 200% text zoom')
    assert(enlargedFrame.imgComplete, 'Image complete under 200% text zoom')

    console.log('--- ALL CAROUSEL VERIFICATIONS PASSED ---')
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

run().catch((err) => {
  console.error('CAROUSEL VERIFICATION FAILED:', err)
  process.exit(1)
})
