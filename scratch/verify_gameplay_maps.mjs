/* global process */
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5198
const ISOLATED_CDP_PORT = 9248
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-gameplay-maps-' + Date.now())

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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
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
    const browser = await startEdge()
    edgeProc = browser.proc
    cdp = browser.cdp

    const BASE_URL = `http://localhost:${ISOLATED_VITE_PORT}`

    // 1. Open Gameplay through the public navigation
    console.log('\n--- TEST 1: Open Gameplay Through Public Navigation ---')
    await cdp.navigate(BASE_URL + '/', '.public-nav-bar')
    await cdp.waitFor('document.querySelector("nav.desktop-nav") !== null')

    const gameplayNavLink = await cdp.eval('document.querySelector("nav.desktop-nav a[href=\'/gameplay\']") !== null')
    assert.strictEqual(gameplayNavLink, true, 'Gameplay navigation link must exist in public header')

    // Click navigation link to Gameplay
    await cdp.eval('document.querySelector("nav.desktop-nav a[href=\'/gameplay\']").click()')
    await cdp.waitFor('window.location.pathname === "/gameplay" && document.querySelector(".environments-grid") !== null')
    const currentPath = await cdp.eval('window.location.pathname')
    assert.strictEqual(currentPath, '/gameplay', 'Successfully navigated to /gameplay through public nav')
    console.log('✓ Successfully opened Gameplay through public navigation')

    // 2. Four map card assignments & metadata
    console.log('\n--- TEST 2: Environment Card Image Assignments & Composition ---')
    const envCards = await cdp.eval(`(() => {
      const cards = Array.from(document.querySelectorAll('.environment-card')).map(card => {
        const img = card.querySelector('.env-image');
        const badge = card.querySelector('.env-setting-badge');
        const name = card.querySelector('.env-name')?.textContent?.trim();
        const desc = card.querySelector('.env-description')?.textContent?.trim();
        const focusItems = Array.from(card.querySelectorAll('.focus-list li')).map(li => li.textContent.trim());
        const wrap = card.querySelector('.env-image-container');
        const computedImg = img ? window.getComputedStyle(img) : null;
        const computedWrap = wrap ? window.getComputedStyle(wrap) : null;
        const computedBadge = badge ? window.getComputedStyle(badge) : null;
        const computedCard = window.getComputedStyle(card);
        return {
          name,
          setting: badge?.textContent?.trim(),
          desc,
          focusCount: focusItems.length,
          imgSrc: img?.src,
          imgAlt: img?.alt,
          imgLoading: img?.loading,
          imgWidthAttr: img?.getAttribute('width'),
          imgHeightAttr: img?.getAttribute('height'),
          naturalWidth: img?.naturalWidth,
          naturalHeight: img?.naturalHeight,
          objectFit: computedImg?.objectFit,
          imageRendering: computedImg?.imageRendering,
          wrapAspectRatio: computedWrap?.aspectRatio,
          badgeColor: computedBadge?.color,
          badgeBg: computedBadge?.backgroundColor,
          badgeBorder: computedBadge?.border,
          cardCursor: computedCard?.cursor,
        };
      });
      return cards;
    })()`)

    console.log('Parsed environment cards count:', envCards.length)
    assert.strictEqual(envCards.length, 4, 'Must have exactly 4 environment cards')

    // Card 1: Home
    const card1 = envCards[0]
    console.log('Card 1:', card1.name, card1.setting, card1.imgSrc)
    assert.strictEqual(card1.name, 'Home')
    assert.strictEqual(card1.setting, 'Personal Residence')
    assert.ok(card1.imgSrc.includes('home') && card1.imgSrc.includes('.jpg'), `Card 1 image must be home.jpg, got ${card1.imgSrc}`)
    assert.ok(!card1.imgAlt.includes('gameplay screenshot'), 'Card 1 must not have gameplay screenshot alt text')
    assert.strictEqual(card1.imgAlt, '', 'Card 1 uses empty alt text (heading conveys purpose)')

    // Card 2: Office
    const card2 = envCards[1]
    console.log('Card 2:', card2.name, card2.setting, card2.imgSrc)
    assert.strictEqual(card2.name, 'Office')
    assert.strictEqual(card2.setting, 'Corporate Workplace')
    assert.ok(card2.imgSrc.includes('office') && card2.imgSrc.includes('.jpg'), `Card 2 image must be office.jpg, got ${card2.imgSrc}`)
    assert.strictEqual(card2.imgAlt, '', 'Card 2 uses empty alt text')

    // Card 3: Internet Cafe
    const card3 = envCards[2]
    console.log('Card 3:', card3.name, card3.setting, card3.imgSrc)
    assert.strictEqual(card3.name, 'Internet Cafe')
    assert.strictEqual(card3.setting, 'Shared Public Terminals')
    assert.ok(card3.imgSrc.includes('internet-cafe') && card3.imgSrc.includes('.jpg'), `Card 3 image must be internet-cafe.jpg, got ${card3.imgSrc}`)
    assert.strictEqual(card3.imgAlt, '', 'Card 3 uses empty alt text')

    // Card 4: Public Park
    const card4 = envCards[3]
    console.log('Card 4:', card4.name, card4.setting, card4.imgSrc)
    assert.strictEqual(card4.name, 'Public Park')
    assert.strictEqual(card4.setting, 'Open Public Space')
    assert.ok(card4.imgSrc.includes('public-park') && card4.imgSrc.includes('.jpg'), `Card 4 image must be public-park.jpg, got ${card4.imgSrc}`)
    assert.strictEqual(card4.imgAlt, '', 'Card 4 uses empty alt text')

    // Technical attributes across all cards
    for (const card of envCards) {
      assert.strictEqual(card.imgLoading, 'lazy', 'Image must have loading="lazy"')
      assert.strictEqual(card.imgWidthAttr, '320', 'Image width attribute is 320')
      assert.strictEqual(card.imgHeightAttr, '200', 'Image height attribute is 200')
      assert.strictEqual(card.naturalWidth, 320, 'Image natural width is 320')
      assert.strictEqual(card.naturalHeight, 200, 'Image natural height is 200')
      assert.strictEqual(card.objectFit, 'cover', 'Object fit is cover')
      assert.strictEqual(card.imageRendering, 'pixelated', 'Image rendering is pixelated')
      assert.ok(card.wrapAspectRatio.includes('16 / 10') || card.wrapAspectRatio.includes('1.6'), `Wrap aspect ratio must be 16/10, got ${card.wrapAspectRatio}`)
      assert.ok(card.badgeColor.includes('255, 255, 255') || card.badgeColor === 'rgb(255, 255, 255)', 'Setting badge has white text')
      assert.ok(card.badgeBg.includes('15, 23, 42'), 'Setting badge has dark slate backdrop')
      assert.strictEqual(card.cardCursor, 'default', 'Card is informational, cursor is default')
      assert.ok(card.focusCount >= 3, 'Learning points preserved')
    }
    console.log('✓ All 4 image assignments, 16:10 aspect ratios, pixelated rendering, and badges verified')

    // 3. Responsive layout
    console.log('\n--- TEST 3: Responsive Layout (1-Col Mobile, 2-Col Desktop) ---')
    // Desktop: 1280px
    await cdp.setViewport(1280, 800)
    await new Promise((r) => setTimeout(r, 200))
    const desktopCols = await cdp.eval('window.getComputedStyle(document.querySelector(".environments-grid")).gridTemplateColumns.trim().split(" ").length')
    assert.strictEqual(desktopCols, 2, `Desktop (1280px) must have 2 columns, got ${desktopCols}`)
    console.log('✓ Desktop breakpoint: 2 columns')

    // Mobile: 375px
    await cdp.setViewport(375, 667)
    await new Promise((r) => setTimeout(r, 200))
    const mobileCols375 = await cdp.eval('window.getComputedStyle(document.querySelector(".environments-grid")).gridTemplateColumns.trim().split(" ").length')
    assert.strictEqual(mobileCols375, 1, `Mobile (375px) must have 1 column, got ${mobileCols375}`)
    console.log('✓ Mobile breakpoint (375px): 1 column')

    // Narrow Mobile: 320px
    await cdp.setViewport(320, 568)
    await new Promise((r) => setTimeout(r, 200))
    const mobileCols320 = await cdp.eval('window.getComputedStyle(document.querySelector(".environments-grid")).gridTemplateColumns.trim().split(" ").length')
    assert.strictEqual(mobileCols320, 1, `Mobile (320px) must have 1 column, got ${mobileCols320}`)
    console.log('✓ Mobile breakpoint (320px): 1 column')

    // 4. Hover zoom & reduced motion
    console.log('\n--- TEST 4: Hover Zoom & Reduced Motion ---')
    await cdp.setViewport(1280, 800)

    const defaultTransition = await cdp.eval('window.getComputedStyle(document.querySelector(".env-image")).transition')
    console.log('Image transition:', defaultTransition)
    assert.ok(defaultTransition.includes('transform'), 'Image transition includes transform')

    // In-app reduced motion: :root[data-reduced-motion="true"]
    await cdp.eval('document.documentElement.setAttribute("data-reduced-motion", "true")')
    const inAppReducedTransition = await cdp.eval('window.getComputedStyle(document.querySelector(".env-image")).transition')
    console.log('In-app reduced motion transition:', inAppReducedTransition)
    assert.ok(
      inAppReducedTransition.includes('none') || inAppReducedTransition === '' || inAppReducedTransition.includes('0s'),
      'In-app reduced motion turns off transition',
    )
    await cdp.eval('document.documentElement.removeAttribute("data-reduced-motion")')

    // System reduced motion emulation
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    const sysReducedTransition = await cdp.eval('window.getComputedStyle(document.querySelector(".env-image")).transition')
    console.log('System prefers-reduced-motion transition:', sysReducedTransition)
    assert.ok(
      sysReducedTransition.includes('none') || sysReducedTransition === '' || sysReducedTransition.includes('0s'),
      'System prefers-reduced-motion turns off transition',
    )
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    console.log('✓ Reduced motion (in-app and system) verified')

    // 5. Read-aloud & keyboard access
    console.log('\n--- TEST 5: Read-Aloud & Keyboard Access ---')
    // Enable read aloud in preferences
    await cdp.eval('localStorage.setItem("cyber_pref_read_aloud", "on"); window.location.reload();')
    await cdp.waitFor('document.querySelector(".btn-read-section") !== null')

    // Read aloud button
    const readBtnAria = await cdp.eval('document.querySelector(".btn-read-section")?.getAttribute("aria-label")')
    console.log('Read section button aria-label:', readBtnAria)
    assert.ok(readBtnAria.includes('Read section'), 'Read section button present with aria-label')

    // Check keyboard focusability on page interactive elements
    const focusableCount = await cdp.eval(`(() => {
      const focusables = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])');
      return focusables.length;
    })()`)
    console.log('Focusable elements count on Gameplay page:', focusableCount)
    assert.ok(focusableCount >= 5, 'Page contains interactive focusable elements')

    console.log('\n--- ALL GAMEPLAY MAP TESTS PASSED SUCCESSFULLY! ---')
  } finally {
    if (edgeProc) {
      edgeProc.kill('SIGKILL')
    }
    if (viteProc) {
      viteProc.kill('SIGKILL')
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err)
  process.exit(1)
})
