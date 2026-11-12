/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const TEST_PORT = 5212
const CDP_PORT = 9262
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-threat-redesign-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/2f8e9ba7-d772-4a40-89e2-3efc8252c39d'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 1
    this.callbacks = new Map()
    this.events = []
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
      } else if (msg.method) {
        this.events.push(msg)
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
      throw new Error(
        `CDP evaluate exception: ${res.exceptionDetails.text} - ${JSON.stringify(
          res.exceptionDetails.exception?.description || res.exceptionDetails,
        )}`,
      )
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

  async waitFor(expr, timeoutMs = 15000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const ok = await this.evaluate(`Boolean(${expr})`).catch(() => false)
      if (ok) return true
      await sleep(150)
    }
    throw new Error(`Timed out waiting for: ${expr}`)
  }

  async spaNavigate(routePath, selector) {
    await this.evaluate(`window.__router.push(${JSON.stringify(routePath)})`)
    if (selector) {
      await this.waitFor(`document.querySelector(${JSON.stringify(selector)}) !== null`)
    }
    await sleep(300)
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status < 400) return true
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
  let edgeProc = null

  try {
    console.log('[1/8] Starting Vite mock server on', BASE_URL)
    viteProc = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(TEST_PORT), '--strictPort'],
      {
        cwd: process.cwd(),
        env: { ...process.env, VITE_USE_MOCK: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const isViteReady = await waitForServer(`${BASE_URL}/`)
    assert.ok(isViteReady, 'Vite dev server failed to start')

    console.log('[2/8] Launching headless Edge CDP on port', CDP_PORT)
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    edgeProc = spawn(
      EDGE_PATH,
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

    const isEdgeReady = await waitForServer(`http://127.0.0.1:${CDP_PORT}/json/version`, 10000)
    assert.ok(isEdgeReady, 'Edge CDP failed to start')

    let pageCdp = null
    for (let i = 0; i < 20; i++) {
      try {
        const wsUrl = await getCDPWebSocketUrl(CDP_PORT)
        const browserCdp = new CDPClient(wsUrl)
        await browserCdp.connect()
        const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' })
        pageCdp = new CDPClient(`ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`)
        await pageCdp.connect()
        await pageCdp.send('Page.enable')
        await pageCdp.send('Runtime.enable')
        break
      } catch {
        await sleep(250)
      }
    }
    assert.ok(pageCdp, 'Failed to attach Edge page target')

    const runtimeErrors = []
    pageCdp.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.method === 'Runtime.exceptionThrown') {
        runtimeErrors.push(msg.params?.exceptionDetails?.text || 'Runtime exception')
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        runtimeErrors.push(
          msg.params.args?.map((a) => a.value || a.description).join(' ') || 'Console error',
        )
      }
    })

    console.log('[3/8] Seeding player session & verifying /dashboard Threat Index card...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
    await pageCdp.waitFor('Boolean(window.__router) && Boolean(window.__pinia)', 20000)
    await pageCdp.evaluate(`
      const token = 'mock-jwt-token-player:u-101';
      const user = {
        user_id: 'u-101',
        profile_id: 'p1',
        username: 'AgentZero',
        display_name: 'AgentZero',
        email: 'player@example.com',
        role: 'player'
      };
      localStorage.setItem('cyber_token', token);
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify(user));
      const auth = window.__pinia?._s?.get('auth');
      if (auth) {
        auth.token = token;
        auth.user = user;
        auth.userRole = 'player';
        auth.isSessionReconciling = false;
        auth.isWebProfileVerified = true;
      }
    `)

    await pageCdp.setViewport(1440, 900)
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)
    await pageCdp.spaNavigate('/dashboard', '.threat-mini-pip')
    await sleep(450)

    const dashCheck = await pageCdp.evaluate(`(() => {
      const pips = document.querySelectorAll('.threat-mini-pip');
      const unlockedPips = document.querySelectorAll('.threat-mini-pip.is-unlocked');
      const lockedPips = document.querySelectorAll('.threat-mini-pip.is-locked');
      const linkPill = document.querySelector('.stat-link-pill');
      const activeNav = document.querySelector('.sidebar-nav .nav-item.router-link-active');
      const dashRoot = document.querySelector('.role-dashboard');
      return {
        totalPips: pips.length,
        unlockedPips: unlockedPips.length,
        lockedPips: lockedPips.length,
        linkHref: linkPill?.getAttribute('href'),
        overviewPrimary: dashRoot ? getComputedStyle(dashRoot).getPropertyValue('--color-primary').trim() : null,
        activeNavBgImage: activeNav ? getComputedStyle(activeNav).backgroundImage : null,
      };
    })()`)
    console.log('Dashboard check:', dashCheck)
    assert.strictEqual(dashCheck.totalPips, 8)
    assert.strictEqual(dashCheck.unlockedPips, 5)
    assert.strictEqual(dashCheck.lockedPips, 3)
    assert.strictEqual(dashCheck.linkHref, '/threat-index')
    assert.strictEqual(dashCheck.overviewPrimary, '#653096')
    assert.ok(dashCheck.activeNavBgImage && dashCheck.activeNavBgImage.includes('linear-gradient'))
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'player_dashboard_desktop.png'))

    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(400)
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'player_dashboard_desktop_dark.png'))
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)

    console.log('[4/8] Navigating to /threat-index & checking dossier cards, filters, images...')
    await pageCdp.spaNavigate('/threat-index', '.threat-card')
    await sleep(500)

    const indexCheck = await pageCdp.evaluate(`(() => {
      const cards = document.querySelectorAll('.threat-card');
      const unlocked = document.querySelectorAll('.threat-card.is-unlocked');
      const locked = document.querySelectorAll('.threat-card.is-locked');
      const lockedImgs = document.querySelectorAll('.threat-card.is-locked img');
      const unlockedImgs = Array.from(document.querySelectorAll('.threat-card.is-unlocked .card-cover-img'));
      const lessonLinks = document.querySelectorAll('.btn-lesson');
      const progressBar = document.querySelector('.progress-strip');
      return {
        totalCards: cards.length,
        unlockedCards: unlocked.length,
        lockedCards: locked.length,
        lockedImgsCount: lockedImgs.length,
        allUnlockedImgsReady: unlockedImgs.length === 5 && unlockedImgs.every((img) => img.complete && img.naturalWidth > 0),
        lessonLinksCount: lessonLinks.length,
        firstHref: lessonLinks[0]?.getAttribute('href'),
        hasProgressBar: Boolean(progressBar),
      };
    })()`)
    console.log('Threat Index check:', indexCheck)
    assert.strictEqual(indexCheck.totalCards, 8)
    assert.strictEqual(indexCheck.unlockedCards, 5)
    assert.strictEqual(indexCheck.lockedCards, 3)
    assert.strictEqual(indexCheck.lockedImgsCount, 0, 'Locked cards must NOT render screenshots')
    assert.ok(indexCheck.allUnlockedImgsReady, 'Unlocked cards must render loaded screenshots')
    assert.strictEqual(indexCheck.lessonLinksCount, 5)
    assert.strictEqual(indexCheck.firstHref, '/threat-index/phishing')
    assert.ok(indexCheck.hasProgressBar)

    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_index_desktop.png'))

    // Filter test: Unlocked / Locked / All
    await pageCdp.evaluate(`document.querySelectorAll('.filter-pill')[1].click()`)
    await pageCdp.waitFor('document.querySelectorAll(".threat-card:not(.dossier-grid-leave-active)").length === 5')

    await pageCdp.evaluate(`document.querySelectorAll('.filter-pill')[2].click()`)
    await pageCdp.waitFor('document.querySelectorAll(".threat-card:not(.dossier-grid-leave-active)").length === 3')

    await pageCdp.evaluate(`document.querySelectorAll('.filter-pill')[0].click()`)
    await pageCdp.waitFor('document.querySelectorAll(".threat-card:not(.dossier-grid-leave-active)").length === 8')
    await sleep(500)

    // Dark theme screenshot for /threat-index
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(450)
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_index_desktop_dark.png'))
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)

    // Cross-route container alignment check at wide 1720x960 (>= 1600px wrapper breakpoint)
    await pageCdp.setViewport(1720, 960)
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)
    await pageCdp.spaNavigate('/dashboard', '.role-dashboard')
    const overviewRect = await pageCdp.evaluate(`(() => {
      const r = document.querySelector('.role-dashboard').getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    })()`)
    await pageCdp.spaNavigate('/session-history', '.session-history-view')
    const historyRect = await pageCdp.evaluate(`(() => {
      const r = document.querySelector('.session-history-view').getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    })()`)
    await pageCdp.spaNavigate('/threat-index', '.threat-index-page')
    const threatIndexRect = await pageCdp.evaluate(`(() => {
      const r = document.querySelector('.threat-index-page').getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    })()`)
    await pageCdp.spaNavigate('/threat-index/smishing', '.lesson-page')
    const threatLessonRect = await pageCdp.evaluate(`(() => {
      const r = document.querySelector('.lesson-page').getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    })()`)
    console.log('Alignment parity at 1720px:', { overviewRect, historyRect, threatIndexRect, threatLessonRect })
    assert.deepStrictEqual(threatIndexRect, overviewRect, '/threat-index must match Overview container alignment and width')
    assert.strictEqual(threatLessonRect.width, historyRect.width, '/threat-index/:slug width must match sibling dashboard views')
    assert.ok(Math.abs(threatLessonRect.left - historyRect.left) <= 8, '/threat-index/:slug left alignment must match sibling dashboard views (accounting for vertical scrollbar)')

    // Responsive checks across tablet (1024px, 768px) and mobile (390x844)
    await pageCdp.spaNavigate('/threat-index', '.threat-index-page')
    for (const [vw, vh] of [
      [1024, 768],
      [768, 900],
      [390, 844],
    ]) {
      await pageCdp.setViewport(vw, vh)
      await sleep(300)
      const overflow = await pageCdp.evaluate(`
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      `)
      assert.strictEqual(overflow, false, `/threat-index must not overflow horizontally at ${vw}x${vh}`)
    }
    const mobileHeaderHeight = await pageCdp.evaluate(`
      Math.round(document.querySelector('.index-header').getBoundingClientRect().height)
    `)
    console.log('Mobile .index-header height (390px):', mobileHeaderHeight)
    assert.ok(mobileHeaderHeight <= 190, `Mobile header must stay compact (got ${mobileHeaderHeight}px)`)
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_index_mobile.png'))

    console.log('[5/8] Opening /threat-index/social-engineering & /smishing showcase...')
    await pageCdp.setViewport(1440, 900)
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)
    await pageCdp.spaNavigate('/threat-index/social-engineering', '.lesson-article')
    await sleep(400)
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_lesson_social_desktop.png'))

    await pageCdp.spaNavigate('/threat-index/smishing', '.lesson-article')
    await sleep(450)

    const lessonCheck = await pageCdp.evaluate(`(() => {
      const h1 = document.querySelector('.lesson-title');
      const img = document.querySelector('.lesson-image');
      const inertCodes = Array.from(document.querySelectorAll('.inert-code')).map((c) => c.textContent.trim());
      const extLinks = document.querySelectorAll('.lesson-article a[href^="http"]').length;
      const signalRows = document.querySelectorAll('.signal-row').length;
      const decisionItems = document.querySelectorAll('.decision-item').length;
      const bodyText = document.body.innerText;
      return {
        title: document.title,
        h1Text: h1?.textContent?.trim(),
        h1Focused: document.activeElement === h1,
        imgLoaded: Boolean(img && img.complete && img.naturalWidth > 0 && img.getAttribute('alt')),
        inertCodes,
        extLinks,
        signalRows,
        decisionItems,
        hasNumberedKicker01: bodyText.includes('01 ·') || bodyText.includes('02 ·'),
      };
    })()`)
    console.log('Smishing lesson check:', lessonCheck)
    assert.strictEqual(lessonCheck.title, 'Smishing Lesson | CyberMorph')
    assert.strictEqual(lessonCheck.h1Text, 'Smishing')
    assert.ok(lessonCheck.h1Focused, 'H1 must receive focus on load')
    assert.ok(lessonCheck.imgLoaded, 'Smishing image must load cleanly')
    assert.strictEqual(lessonCheck.extLinks, 0)
    assert.strictEqual(lessonCheck.hasNumberedKicker01, false, 'Section eyebrow kickers must be removed')
    assert.strictEqual(lessonCheck.signalRows, 3)
    assert.strictEqual(lessonCheck.decisionItems, 2)
    assert.deepStrictEqual(lessonCheck.inertCodes, ['0917-123-4567', 'https://gcash-verification-portal.net'])

    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_lesson_smishing_desktop.png'))

    console.log('[6/8] Testing opaque Lightbox Modal + Escape focus restore + Dark Mode...')
    await pageCdp.evaluate(`document.querySelector('.btn-enlarge').click()`)
    await sleep(300)
    const lightboxCheck = await pageCdp.evaluate(`(() => {
      const dlg = document.querySelector('.lightbox-dialog');
      const closeBtn = document.querySelector('.lightbox-close-btn');
      const bg = dlg ? getComputedStyle(dlg).backgroundColor : null;
      return {
        exists: Boolean(dlg),
        bg,
        closeFocused: document.activeElement === closeBtn,
      };
    })()`)
    console.log('Lightbox check:', lightboxCheck)
    assert.ok(lightboxCheck.exists, 'Lightbox must open')
    assert.notStrictEqual(lightboxCheck.bg, 'rgba(0, 0, 0, 0)', 'Lightbox surface must be opaque')
    assert.ok(lightboxCheck.closeFocused, 'Lightbox close button must receive focus')
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_lesson_lightbox_desktop.png'))

    await pageCdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
    await sleep(250)
    const afterEscapeCheck = await pageCdp.evaluate(`(() => ({
      lightboxExists: Boolean(document.querySelector('.lightbox-dialog')),
      enlargeRefocused: document.activeElement === document.querySelector('.btn-enlarge'),
    }))()`)
    assert.strictEqual(afterEscapeCheck.lightboxExists, false, 'Escape must close lightbox')
    assert.ok(afterEscapeCheck.enlargeRefocused, 'Closing lightbox must restore focus to Enlarge button')

    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(450)
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_lesson_smishing_desktop_dark.png'))
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`)

    console.log('[7/8] Testing mobile 390px layout & overflow on /threat-index/smishing...')
    await pageCdp.setViewport(390, 844)
    await sleep(450)
    const lessonMobileOverflow = await pageCdp.evaluate(`
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    `)
    assert.strictEqual(lessonMobileOverflow, false, '/threat-index/smishing must not overflow horizontally on 390px mobile')
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'threat_lesson_smishing_mobile.png'))

    console.log('[8/8] Verifying locked (/threat-index/ransomware) & invalid (/threat-index/unknown-threat) boundaries...')
    await pageCdp.setViewport(1440, 900)
    await pageCdp.spaNavigate('/threat-index/ransomware', '.locked-state')
    await sleep(300)
    const lockedRes = await pageCdp.evaluate(`(() => ({
      hasLocked: Boolean(document.querySelector('.locked-state')),
      title: document.querySelector('.locked-state .state-title')?.textContent?.trim(),
      hasArticle: Boolean(document.querySelector('.lesson-article')),
      leaksSpoiler: document.body.innerText.includes('0.5 BTC'),
    }))()`)
    assert.ok(lockedRes.hasLocked)
    assert.strictEqual(lockedRes.title, 'This threat lesson is locked')
    assert.strictEqual(lockedRes.hasArticle, false)
    assert.strictEqual(lockedRes.leaksSpoiler, false)

    await pageCdp.spaNavigate('/threat-index/unknown-threat', '.not-found-state')
    await sleep(300)
    const notFoundRes = await pageCdp.evaluate(`(() => ({
      hasNotFound: Boolean(document.querySelector('.not-found-state')),
      title: document.querySelector('.not-found-state .state-title')?.textContent?.trim(),
      hasArticle: Boolean(document.querySelector('.lesson-article')),
    }))()`)
    assert.ok(notFoundRes.hasNotFound)
    assert.strictEqual(notFoundRes.title, 'Threat category not found')
    assert.strictEqual(notFoundRes.hasArticle, false)

    console.log('[9/9] Verifying royal violet palette across Educator & Admin roles...')
    await pageCdp.evaluate(`(() => {
      const token = 'mock-jwt-token-educator:u-edu-1';
      const user = { user_id: 'u-edu-1', display_name: 'Prof. Reyes', role: 'educator' };
      localStorage.setItem('cyber_token', token);
      localStorage.setItem('cyber_role', 'educator');
      localStorage.setItem('cyber_user', JSON.stringify(user));
      const auth = window.__pinia?._s?.get('auth');
      if (auth) { auth.token = token; auth.user = user; auth.userRole = 'educator'; auth.isWebProfileVerified = true; }
    })()`)
    await pageCdp.spaNavigate('/analytics/c1', '.workspace-nav .nav-link.active')
    await sleep(450)
    const eduCheck = await pageCdp.evaluate(`(() => {
      const tab = document.querySelector('.workspace-nav .nav-link.active');
      return {
        rootPrimary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        tabBg: tab ? getComputedStyle(tab).backgroundImage : null,
      };
    })()`)
    assert.strictEqual(eduCheck.rootPrimary, '#653096')
    assert.ok(eduCheck.tabBg && eduCheck.tabBg.includes('linear-gradient'))
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'educator_analytics_royal.png'))

    await pageCdp.evaluate(`(() => {
      const token = 'mock-jwt-token-admin:u-admin-1';
      const user = { user_id: 'u-admin-1', display_name: 'SysAdmin', role: 'admin' };
      localStorage.setItem('cyber_token', token);
      localStorage.setItem('cyber_role', 'admin');
      localStorage.setItem('cyber_user', JSON.stringify(user));
      const auth = window.__pinia?._s?.get('auth');
      if (auth) { auth.token = token; auth.user = user; auth.userRole = 'admin'; auth.isWebProfileVerified = true; }
    })()`)
    await pageCdp.spaNavigate('/admin/users', '.admin-subnav .router-link-active')
    await sleep(450)
    const adminCheck = await pageCdp.evaluate(`(() => {
      const tab = document.querySelector('.admin-subnav .router-link-active');
      const nav = document.querySelector('.sidebar-nav .nav-item.router-link-active');
      return {
        subnavBg: tab ? getComputedStyle(tab).backgroundImage : null,
        navBg: nav ? getComputedStyle(nav).backgroundImage : null,
      };
    })()`)
    assert.ok(adminCheck.subnavBg && adminCheck.subnavBg.includes('linear-gradient'))
    assert.ok(adminCheck.navBg && adminCheck.navBg.includes('linear-gradient'))
    await pageCdp.screenshot(path.join(ARTIFACT_DIR, 'admin_users_royal.png'))

    assert.strictEqual(runtimeErrors.length, 0, `Unexpected runtime/console errors: ${runtimeErrors.join('; ')}`)
    console.log('\nALL THREAT INDEX REDESIGN E2E & VISUAL CHECKS PASSED (0 CONSOLE ERRORS)')
  } finally {
    if (edgeProc) edgeProc.kill()
    if (viteProc) viteProc.kill()
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // ignore cleanup error
    }
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err)
  process.exit(1)
})
