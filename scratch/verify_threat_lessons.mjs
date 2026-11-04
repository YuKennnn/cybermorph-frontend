/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5202
const CDP_PORT = 9252
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-threat-lessons-cdp-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/bf7d1fc1-9e66-4899-ae20-f96344a21757'

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
    if (res.exceptionDetails) {
      throw new Error(`CDP evaluate exception: ${res.exceptionDetails.text} - ${JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status < 400) {
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

async function run() {
  let viteProc = null
  let chromeProc = null

  try {
    console.log('[1/10] Starting Vite test server on port', TEST_PORT)
    viteProc = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(TEST_PORT), '--strictPort'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VITE_USE_MOCK: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    viteProc.stdout.on('data', (d) => {
      const str = d.toString()
      if (str.includes('ready in') || str.includes('Local:')) {
        console.log('Vite:', str.trim())
      }
    })
    viteProc.stderr.on('data', (d) => console.error('Vite err:', d.toString().trim()))

    const isViteReady = await waitForServer(`${BASE_URL}/`)
    assert.ok(isViteReady, 'Vite test server failed to start within timeout')
    console.log('✓ Vite server ready at', BASE_URL)

    console.log('[2/10] Launching headless Chrome with remote debugging on', CDP_PORT)
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    chromeProc = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1440,900',
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

    const isChromeReady = await waitForServer(`http://127.0.0.1:${CDP_PORT}/json/version`, 10000)
    assert.ok(isChromeReady, 'Chrome CDP debugger failed to start')

    let pageCdp = null
    for (let i = 0; i < 20; i++) {
      try {
        const browserWs = await getCDPWebSocketUrl(CDP_PORT)
        const cdp = new CDPClient(browserWs)
        await cdp.connect()
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
        const targetWs = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`
        pageCdp = new CDPClient(targetWs)
        await pageCdp.connect()
        await pageCdp.send('Page.enable')
        await pageCdp.send('Runtime.enable')
        break
      } catch {
        await sleep(250)
      }
    }
    assert.ok(pageCdp, 'Failed to connect to Chrome Page CDP')
    console.log('✓ Connected to Chrome Page target')

    console.log('[3/10] Setting up authenticated Player session in browser...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
    await sleep(1000)

    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token-threats');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-101',
        profile_id: 'p1',
        username: 'PlayerTester',
        display_name: 'PlayerTester',
        email: 'playertester@example.com',
        role: 'player'
      }));
    `)

    console.log('[4/10] Navigating to /threat-index and testing "View lesson" button appearance...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/threat-index` })
    await sleep(1500)

    const threatGridCheck = await pageCdp.evaluate(`
      (() => {
        const cards = document.querySelectorAll('.threat-card');
        const lessonButtons = document.querySelectorAll('.btn-lesson');
        const unlockedCards = document.querySelectorAll('.threat-card.is-unlocked');
        const lockedCards = document.querySelectorAll('.threat-card.is-locked');
        return {
          totalCards: cards.length,
          lessonButtons: lessonButtons.length,
          unlockedCards: unlockedCards.length,
          lockedCards: lockedCards.length,
          firstLessonText: lessonButtons[0]?.textContent?.trim() || null,
          firstLessonHref: lessonButtons[0]?.getAttribute('href') || null
        };
      })()
    `)

    console.log('Threat grid check:', threatGridCheck)
    assert.strictEqual(threatGridCheck.totalCards, 8, 'Must have 8 canonical cards')
    assert.strictEqual(threatGridCheck.lessonButtons, threatGridCheck.unlockedCards, 'Every unlocked card must have a View lesson button')
    assert.strictEqual(threatGridCheck.lessonButtons, 5, 'In mock, 5 threats are unlocked')
    assert.strictEqual(threatGridCheck.lockedCards, 3, 'In mock, 3 threats are locked')
    assert.ok(threatGridCheck.firstLessonHref?.includes('/threat-index/phishing'), 'First button links to phishing')
    console.log('✓ Threat index grid correctly displays View lesson buttons for unlocked threats only')

    console.log('[5/10] Clicking "View lesson" on Phishing and verifying dedicated view...')
    await pageCdp.evaluate(`document.querySelector('.btn-lesson').click()`)
    await sleep(1200)

    const lessonViewCheck = await pageCdp.evaluate(`
      (() => {
        const article = document.querySelector('.lesson-article');
        const titleEl = document.querySelector('.lesson-title');
        const activeNav = document.querySelector('.sidebar-nav .router-link-active .nav-label')?.textContent?.trim();
        const inertLinks = Array.from(document.querySelectorAll('.lesson-article a[href^="http"]'));
        const inertCodes = Array.from(document.querySelectorAll('.inert-code')).map(c => c.textContent.trim());
        const backBtn = document.querySelector('.btn-back');
        const img = document.querySelector('.lesson-image');

        return {
          hasArticle: Boolean(article),
          pageTitle: document.title,
          h1Text: titleEl?.textContent?.trim(),
          isH1Focused: document.activeElement === titleEl,
          activeNavLabel: activeNav,
          url: window.location.pathname,
          externalLinksCount: inertLinks.length,
          inertCodes,
          hasBackBtn: Boolean(backBtn),
          imgLoaded: Boolean(img && img.naturalWidth > 0 && img.getAttribute('alt'))
        };
      })()
    `)

    console.log('Lesson view check:', lessonViewCheck)
    assert.ok(lessonViewCheck.hasArticle, 'Lesson article must be present')
    assert.strictEqual(lessonViewCheck.url, '/threat-index/phishing', 'URL must be /threat-index/phishing')
    assert.strictEqual(lessonViewCheck.activeNavLabel, 'Threat index', 'Sidebar must keep Threat index active')
    assert.strictEqual(lessonViewCheck.pageTitle, 'Phishing Lesson | CyberMorph', 'Document title must reflect lesson')
    assert.strictEqual(lessonViewCheck.h1Text, 'Phishing', 'Heading must be Phishing')
    assert.ok(lessonViewCheck.isH1Focused, 'H1 must receive focus on navigation')
    assert.strictEqual(lessonViewCheck.externalLinksCount, 0, 'Must NOT contain live external links')
    assert.ok(lessonViewCheck.inertCodes.length > 0, 'Inert sample codes must be present')
    console.log('✓ Phishing lesson rendered with focus, sidebar active, and inert URLs')

    console.log('[6/10] Testing "Back to Threat index" navigation...')
    await pageCdp.evaluate(`document.querySelector('.btn-back').click()`)
    await sleep(1000)

    const backCheck = await pageCdp.evaluate(`window.location.pathname`)
    assert.strictEqual(backCheck, '/threat-index', 'Must navigate back to /threat-index')
    console.log('✓ Back button restored /threat-index')

    console.log('[7/10] Testing direct navigation to a LOCKED threat (/threat-index/ransomware)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/threat-index/ransomware` })
    await sleep(1500)

    const lockedCheck = await pageCdp.evaluate(`
      (() => {
        const lockedCard = document.querySelector('.locked-state');
        const article = document.querySelector('.lesson-article');
        const lockedTitle = document.querySelector('.locked-state .state-title')?.textContent?.trim();
        const activeNav = document.querySelector('.sidebar-nav .router-link-active .nav-label')?.textContent?.trim();
        const backBtn = document.querySelector('.locked-state .btn-primary');
        const bodyText = document.body.innerText;

        return {
          hasLockedCard: Boolean(lockedCard),
          hasArticle: Boolean(article),
          lockedTitle,
          pageTitle: document.title,
          activeNavLabel: activeNav,
          hasBackBtn: Boolean(backBtn),
          containsDecryptionSpoiler: bodyText.includes('0.5 BTC') || bodyText.includes('Pay 0.5')
        };
      })()
    `)

    console.log('Locked view check:', lockedCheck)
    assert.ok(lockedCheck.hasLockedCard, 'Locked card must appear')
    assert.strictEqual(lockedCheck.hasArticle, false, 'Lesson article must NOT be rendered for locked threats')
    assert.strictEqual(lockedCheck.lockedTitle, 'This threat lesson is locked')
    assert.strictEqual(lockedCheck.containsDecryptionSpoiler, false, 'No unauthorized lesson content/spoilers leaked')
    assert.strictEqual(lockedCheck.activeNavLabel, 'Threat index', 'Sidebar must keep Threat index active')
    console.log('✓ Direct URL for locked threat safely blocks unauthorized content')

    console.log('[8/10] Testing direct navigation to an INVALID threat slug (/threat-index/unknown-threat)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/threat-index/unknown-threat` })
    await sleep(1200)

    const notFoundCheck = await pageCdp.evaluate(`
      (() => {
        const notFoundCard = document.querySelector('.not-found-state');
        const article = document.querySelector('.lesson-article');
        const title = document.querySelector('.not-found-state .state-title')?.textContent?.trim();

        return {
          hasNotFoundCard: Boolean(notFoundCard),
          hasArticle: Boolean(article),
          title
        };
      })()
    `)

    console.log('Not-found check:', notFoundCheck)
    assert.ok(notFoundCheck.hasNotFoundCard, 'Not-found card must appear')
    assert.strictEqual(notFoundCheck.hasArticle, false, 'No lesson article for invalid slug')
    assert.strictEqual(notFoundCheck.title, 'Threat category not found')
    console.log('✓ Invalid slug handled gracefully without crash')

    console.log('[9/10] Capturing desktop visual review screenshot (1440 x 900)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/threat-index/phishing` })
    await sleep(1500)
    await pageCdp.setViewport(1440, 900)
    await sleep(800)
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'threat_lesson_desktop_1440.png')
    await pageCdp.screenshot(desktopScreenshotPath)
    console.log('✓ Desktop screenshot captured:', desktopScreenshotPath)

    console.log('[10/10] Capturing mobile visual review screenshot and checking 390px overflow...')
    await pageCdp.setViewport(390, 844)
    await sleep(800)

    const mobileOverflowCheck = await pageCdp.evaluate(`
      (() => {
        const docEl = document.documentElement;
        return {
          clientWidth: docEl.clientWidth,
          scrollWidth: docEl.scrollWidth,
          hasHorizontalOverflow: docEl.scrollWidth > docEl.clientWidth
        };
      })()
    `)

    console.log('Mobile overflow check:', mobileOverflowCheck)
    assert.strictEqual(mobileOverflowCheck.hasHorizontalOverflow, false, 'Must have zero horizontal overflow on mobile 390px')

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'threat_lesson_mobile_390.png')
    await pageCdp.screenshot(mobileScreenshotPath)
    console.log('✓ Mobile screenshot captured:', mobileScreenshotPath)

    console.log('\n=========================================')
    console.log('ALL THREAT LESSONS E2E & VISUAL TESTS PASSED (100%)')
    console.log('=========================================\n')
  } finally {
    if (chromeProc) {
      chromeProc.kill()
    }
    if (viteProc) {
      viteProc.kill()
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // tmp cleanup
    }
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err)
  process.exit(1)
})
