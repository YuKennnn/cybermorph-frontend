import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import assert from 'node:assert/strict'

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SCREENSHOT_DIR =
  'C:/Users/User/.gemini/antigravity/brain/2f8e9ba7-d772-4a40-89e2-3efc8252c39d'

const captureScreenshot = async (cdp, filename) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(data, 'base64'))
}

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      srv.close(() => resolve(addr.port))
    })
    srv.on('error', reject)
  })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.events = []
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve)
      this.ws.addEventListener('error', reject)
    })
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id) {
        const entry = this.pending.get(msg.id)
        if (entry) {
          this.pending.delete(msg.id)
          if (msg.error) entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          else entry.resolve(msg.result)
        }
      } else {
        this.events.push(msg)
      }
    })
  }

  async send(method, params = {}) {
    await this.ready
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails))
    }
    return res.result?.value
  }

  async waitFor(fnExpr, timeoutMs = 8000, label = 'condition') {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const val = await this.eval(`Boolean(${fnExpr})`)
      if (val) return true
      await sleep(60)
    }
    const debugState = await this.eval(`({
      href: location.href,
      title: document.title,
      h1: document.querySelector('h1,h2')?.textContent?.trim(),
      body: document.body.innerText.slice(0, 350)
    })`)
    throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(debugState)}`)
  }

  async pressKey(key, code, shift = false) {
    const modifiers = shift ? 8 : 0
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      modifiers,
      windowsVirtualKeyCode: key === 'Escape' ? 27 : 9,
      nativeVirtualKeyCode: key === 'Escape' ? 27 : 9,
    })
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      modifiers,
      windowsVirtualKeyCode: key === 'Escape' ? 27 : 9,
      nativeVirtualKeyCode: key === 'Escape' ? 27 : 9,
    })
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

const main = async () => {
  const vitePort = await getFreePort()
  const cdpPort = await getFreePort()
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'cm-edge-'))
  const baseUrl = `http://127.0.0.1:${vitePort}`

  const viteProc = spawn(
    process.execPath,
    [path.resolve('node_modules/vite/bin/vite.js'), '--port', String(vitePort), '--host', '127.0.0.1'],
    {
      env: { ...process.env, VITE_USE_MOCK: 'true', BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let viteOut = ''
  viteProc.stdout.on('data', (d) => {
    viteOut += d.toString()
  })
  viteProc.stderr.on('data', (d) => {
    viteOut += d.toString()
  })

  // Wait for Vite ready
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(baseUrl)
      if (r.ok) break
    } catch {
      await sleep(200)
    }
  }

  const edgeProc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,900',
      `${baseUrl}/login`,
    ],
    { stdio: 'ignore' },
  )

  let cdp = null
  try {
    let targetWsUrl = null
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${cdpPort}/json`)
        const pages = await r.json()
        const page = pages.find((p) => p.type === 'page')
        if (page?.webSocketDebuggerUrl) {
          targetWsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {
        await sleep(200)
      }
    }
    if (!targetWsUrl) throw new Error(`Edge CDP unavailable. Vite output:\n${viteOut}`)

    cdp = new CdpClient(targetWsUrl)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const consoleErrors = []
    cdp.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '))
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception')
      }
    })

    // 1. Login as educator
    await cdp.waitFor(`document.querySelector('input[type="email"]')`, 10000, 'login email input')
    await cdp.eval(`(() => {
      const setVal = (el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal(document.querySelector('input[type="email"]'), 'educator@cybermorph.local');
      setVal(document.querySelector('input[type="password"]'), 'DemoPass123!');
      document.querySelector('form button[type="submit"]').click();
    })()`)
    await cdp.waitFor(`location.pathname === '/dashboard'`, 10000, 'educator dashboard')

    // Check ClassroomCard buttons on /dashboard
    await cdp.waitFor(`document.querySelectorAll('.card-actions .btn-action').length >= 2`, 8000, 'classroom card actions')
    const cardLabels = await cdp.eval(
      `Array.from(document.querySelectorAll('.classroom-card:first-of-type .card-actions .btn-action')).map(b => b.textContent.trim())`,
    )
    assert.deepEqual(cardLabels, ['Analytics', 'Settings'], 'ClassroomCard shows Analytics & Settings without Students')

    // Click Analytics card button -> direct /analytics/c1
    await cdp.eval(`document.querySelector('.classroom-card .btn-analytics').click()`)
    await cdp.waitFor(`location.pathname === '/analytics/c1'`, 8000, '/analytics/c1 route')
    await cdp.waitFor(`document.querySelectorAll('tbody tr').length === 10`, 8000, '10 student rows on page 1')

    // 2. Verify header workspace tabs: no Students tab, Analytics active, Settings retained
    const navLabels = await cdp.eval(
      `Array.from(document.querySelectorAll('.workspace-nav .nav-link')).map(el => el.textContent.trim())`,
    )
    assert.deepEqual(navLabels, ['Analytics', 'Settings'], 'Header navigation retains only Analytics & Settings')

    const jumpExists = await cdp.eval(`Boolean(document.querySelector('a.jump-students-link[href="#students-roster"]'))`)
    assert.equal(jumpExists, true, 'Jump to students link exists near top of Analytics')

    // Verify overview card precedes #students-roster and cards align to workspace header width
    const layoutMetrics = await cdp.eval(`(() => {
      const headerWidth = document.querySelector('.workspace-header')?.getBoundingClientRect().width || 0;
      const cards = Array.from(document.querySelectorAll('.section-card'));
      const roster = document.getElementById('students-roster');
      return {
        cardCount: cards.length,
        orderOk: cards.length >= 3 && roster && cards[0].offsetTop < cards[1].offsetTop && cards[1].offsetTop < roster.offsetTop,
        maxWidthDelta: Math.max(...cards.map((c) => Math.abs(c.getBoundingClientRect().width - headerWidth))),
      };
    })()`)
    assert.equal(layoutMetrics.orderOk, true, `Ordered cards precede roster: ${JSON.stringify(layoutMetrics)}`)
    assert.ok(layoutMetrics.maxWidthDelta <= 1.5, `Section cards align with header width (${layoutMetrics.maxWidthDelta})`)

    await captureScreenshot(cdp, 'analytics_desktop.png')

    // 3. Click Jump to students and verify scroll moves to #students-roster
    await cdp.eval(`document.querySelector('a.jump-students-link').click()`)
    await sleep(450)
    const afterJump = await cdp.eval(`({
      scrollY: window.scrollY,
      rosterTop: document.getElementById('students-roster').getBoundingClientRect().top
    })`)
    assert.ok(afterJump.scrollY > 100 && afterJump.rosterTop < 350, `Jump scrolled to roster: ${JSON.stringify(afterJump)}`)

    // 4. Verify row button labels and paginate to page 2 preserving scroll position
    const btnTexts = await cdp.eval(
      `Array.from(document.querySelectorAll('.btn-inspect')).map(b => b.textContent.trim())`,
    )
    assert.ok(btnTexts.length === 10 && btnTexts.every((t) => t === 'View student progress'), 'Row buttons labeled View student progress')

    const scrollBeforePage2 = await cdp.eval(`window.scrollY`)
    await cdp.eval(`Array.from(document.querySelectorAll('.page-btn')).find(b => b.textContent.includes('Next')).click()`)
    await cdp.waitFor(`location.search.includes('table_page=2') && document.body.innerText.includes('CryptoKnight')`, 8000, 'page 2 roster')
    await sleep(250)
    const scrollAfterPage2 = await cdp.eval(`window.scrollY`)
    assert.ok(Math.abs(scrollAfterPage2 - scrollBeforePage2) < 30, `Pagination preserved scroll (${scrollBeforePage2} -> ${scrollAfterPage2})`)

    // Settings tab preserves table_page=2 round-trip and matches header width
    await cdp.eval(`Array.from(document.querySelectorAll('.workspace-nav .nav-link')).find(el => el.textContent.includes('Settings')).click()`)
    await cdp.waitFor(`location.pathname === '/classroom/settings/c1' && document.querySelector('.settings-card')`, 8000, 'settings view')
    const settingsWidthDelta = await cdp.eval(`Math.abs(document.querySelector('.settings-card').getBoundingClientRect().width - document.querySelector('.workspace-header').getBoundingClientRect().width)`)
    assert.ok(settingsWidthDelta <= 1.5, `Settings card matches Analytics width cleanly (delta=${settingsWidthDelta})`)
    await cdp.eval(`Array.from(document.querySelectorAll('.workspace-nav .nav-link')).find(el => el.textContent.includes('Analytics')).click()`)
    await cdp.waitFor(`location.pathname === '/analytics/c1' && location.search.includes('table_page=2')`, 8000, 'return from settings preserves table_page=2')
    await cdp.waitFor(`document.querySelector('[data-student-profile-id="p12"]')`, 8000, 'p12 row loaded')

    // 5. Open p12 modal from roster page 2, verify opaque surface across themes, focus trap, content, Escape
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
    await sleep(50)
    const preModalScrollY = await cdp.eval(`window.scrollY`)
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').click()`)
    await cdp.waitFor(`location.search.includes('student=p12') && document.querySelector('[role="dialog"]')`, 8000, 'p12 modal open')
    await cdp.waitFor(`!document.querySelector('[role="dialog"] .loading-state') && document.querySelector('[role="dialog"]').innerText.includes('CryptoKnight')`, 8000, 'p12 modal content loaded')

    const inspectModalThemeSurface = async () =>
      cdp.eval(`(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const backdrop = document.querySelector('.modal-backdrop');
        const header = dlg.querySelector('.modal-header');
        const body = dlg.querySelector('.modal-body');
        const footer = dlg.querySelector('.modal-footer');
        const fullBtn = dlg.querySelector('a.btn-full-progress');
        const dlgStyle = getComputedStyle(dlg);
        const headerStyle = getComputedStyle(header);
        const parseRgba = (str) => {
          const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/i);
          if (!m) return { r: 0, g: 0, b: 0, a: 0 };
          return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
        };
        const lum = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const bgRgb = parseRgba(dlgStyle.backgroundColor);
        const textRgb = parseRgba(dlgStyle.color);
        const btnBg = parseRgba(getComputedStyle(fullBtn).backgroundColor);
        const btnText = parseRgba(getComputedStyle(fullBtn).color);
        const hRect = header.getBoundingClientRect();
        const bRect = body.getBoundingClientRect();
        const fRect = footer.getBoundingClientRect();
        return {
          bgColor: dlgStyle.backgroundColor,
          bgAlpha: bgRgb.a,
          bgLum: lum(bgRgb),
          textLum: lum(textRgb),
          backdropBg: backdrop ? getComputedStyle(backdrop).backgroundColor : null,
          headerBg: headerStyle.backgroundColor,
          btnTextLum: lum(btnText),
          btnBgLum: lum(btnBg),
          layoutNonOverlapping: hRect.bottom <= bRect.top + 1 && bRect.bottom <= fRect.top + 1,
        };
      })()`)

    const lightSurface = await inspectModalThemeSurface()
    assert.ok(lightSurface.bgColor !== 'rgba(0, 0, 0, 0)' && lightSurface.bgAlpha >= 0.99, `Light modal must be opaque: ${JSON.stringify(lightSurface)}`)
    assert.ok(lightSurface.bgLum > 0.85 && lightSurface.textLum < 0.25, `Light modal contrast verified: ${JSON.stringify(lightSurface)}`)
    assert.equal(lightSurface.layoutNonOverlapping, true, `Header/body/footer stacked cleanly: ${JSON.stringify(lightSurface)}`)
    await captureScreenshot(cdp, 'modal_desktop.png')

    // Explicit dark theme via data-theme="dark" on teleported dialog
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(80)
    const darkSurface = await inspectModalThemeSurface()
    assert.ok(darkSurface.bgColor !== 'rgba(0, 0, 0, 0)' && darkSurface.bgAlpha >= 0.99, `Dark modal must be opaque: ${JSON.stringify(darkSurface)}`)
    assert.ok(darkSurface.bgLum < 0.15 && darkSurface.textLum > 0.7, `Dark modal contrast verified: ${JSON.stringify(darkSurface)}`)
    assert.ok(darkSurface.btnTextLum > 0.85, `Primary button white text legible in dark mode: ${JSON.stringify(darkSurface)}`)
    await captureScreenshot(cdp, 'modal_desktop_dark.png')
    await cdp.eval(`document.documentElement.removeAttribute('data-theme')`)

    // System dark theme via prefers-color-scheme: dark
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    })
    await sleep(80)
    const sysDarkSurface = await inspectModalThemeSurface()
    assert.ok(sysDarkSurface.bgColor !== 'rgba(0, 0, 0, 0)' && sysDarkSurface.bgAlpha >= 0.99, `System dark modal opaque: ${JSON.stringify(sysDarkSurface)}`)
    assert.ok(sysDarkSurface.bgLum < 0.15 && sysDarkSurface.textLum > 0.7, `System dark contrast verified: ${JSON.stringify(sysDarkSurface)}`)
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    await sleep(60)

    const modalCheck = await cdp.eval(`(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const txt = dlg.innerText;
      const fullLink = dlg.querySelector('a.btn-full-progress');
      return {
        bodyOverflow: document.body.style.overflow,
        scrollY: window.scrollY,
        activeInDialog: dlg.contains(document.activeElement),
        hasName: txt.includes('CryptoKnight'),
        hasMapProgress: txt.includes('Map progress:'),
        hasLastSynced: txt.includes('Last synced:'),
        hasSessionCounts: txt.includes('Uploaded sessions') && txt.includes('Reported wins') && txt.includes('Other results') && txt.includes('Average duration'),
        hasNoWinRate: !/win\\s*rate/i.test(txt),
        fullHref: fullLink?.getAttribute('href'),
      };
    })()`)
    assert.equal(modalCheck.bodyOverflow, 'hidden', 'Body scroll locked while modal open')
    assert.ok(Math.abs(modalCheck.scrollY - preModalScrollY) < 25, `Modal open preserved scroll: ${preModalScrollY} vs ${modalCheck.scrollY}`)
    assert.equal(modalCheck.activeInDialog, true, 'Initial focus placed inside dialog')
    assert.equal(modalCheck.hasName, true)
    assert.equal(modalCheck.hasMapProgress, true)
    assert.equal(modalCheck.hasLastSynced, true)
    assert.equal(modalCheck.hasSessionCounts, true)
    assert.equal(modalCheck.hasNoWinRate, true, 'No invented win rate metric')
    assert.equal(modalCheck.fullHref, '/classroom/students/c1/progress/p12?origin=analytics&table_page=2')

    // Focus trap test via Tab and Shift+Tab
    for (let i = 0; i < 4; i++) {
      await cdp.pressKey('Tab', 'Tab', false)
      const inside = await cdp.eval(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)
      assert.equal(inside, true, `Tab ${i + 1} stayed inside dialog`)
    }
    for (let i = 0; i < 4; i++) {
      await cdp.pressKey('Tab', 'Tab', true)
      const inside = await cdp.eval(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)
      assert.equal(inside, true, `Shift+Tab ${i + 1} stayed inside dialog`)
    }

    // Escape closes modal & returns focus to originating row button without scrolling
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]') && !location.search.includes('student=')`, 8000, 'Escape closes modal')
    await sleep(100)
    const afterEscape = await cdp.eval(`({
      scrollY: window.scrollY,
      bodyOverflow: document.body.style.overflow,
      focusedId: document.activeElement?.dataset?.studentProfileId || null,
    })`)
    assert.equal(afterEscape.focusedId, 'p12', 'Focus returned to originating p12 trigger button')
    assert.equal(afterEscape.bodyOverflow, '', 'Body overflow restored')
    assert.ok(Math.abs(afterEscape.scrollY - preModalScrollY) < 25, `Close preserved scroll (${preModalScrollY} -> ${afterEscape.scrollY})`)

    // 6. Browser Back closes modal opened from roster
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"]')`, 8000, 'modal reopen before Back')
    await cdp.eval(`window.history.back()`)
    await cdp.waitFor(`!document.querySelector('[role="dialog"]') && !location.search.includes('student=')`, 8000, 'Browser Back closed modal')

    // 7. Navigate to Open full progress and back to #students-roster
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] a.btn-full-progress')`, 8000, 'full progress link')
    await cdp.eval(`document.querySelector('[role="dialog"] a.btn-full-progress').click()`)
    await cdp.waitFor(`location.pathname === '/classroom/students/c1/progress/p12' && document.querySelector('.student-progress-view .return-button')`, 8000, 'StudentProgressView')
    const progressHeaderTabs = await cdp.eval(
      `Array.from(document.querySelectorAll('.workspace-nav .nav-link')).map(el => ({ label: el.textContent.trim(), current: el.getAttribute('aria-current') }))`,
    )
    assert.deepEqual(progressHeaderTabs, [
      { label: 'Analytics', current: 'page' },
      { label: 'Settings', current: null },
    ])
    const returnHref = await cdp.eval(`document.querySelector('a.return-button')?.getAttribute('href')`)
    assert.equal(returnHref, '/analytics/c1?table_page=2#students-roster')
    await cdp.eval(`document.querySelector('a.return-button').click()`)
    await cdp.waitFor(`location.pathname === '/analytics/c1' && location.search.includes('table_page=2')`, 8000, 'return to analytics roster')

    // 8. Direct deep link modal URL: close button removes ?student= keeping table_page=2
    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1?table_page=2&student=p12` })
    await cdp.waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('CryptoKnight')`, 10000, 'direct deep link modal p12')
    await cdp.eval(`document.querySelector('[role="dialog"] .btn-close-footer').click()`)
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 8000, 'direct modal close button')
    const afterDirectClose = await cdp.eval(`location.pathname + location.search`)
    assert.equal(afterDirectClose, '/analytics/c1?table_page=2', 'Closing direct modal removes student without leaving classroom/page')

    // Direct deep link on wrong page resolves student identity across pages
    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1?student=p12` })
    await cdp.waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('CryptoKnight')`, 10000, 'cross-page identity lookup resolves CryptoKnight')
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 8000, 'close cross-page modal')

    // 9. Legacy redirect /classroom/students/c1?page=2 -> /analytics/c1?table_page=2#students-roster
    await cdp.send('Page.navigate', { url: `${baseUrl}/classroom/students/c1?page=2` })
    await cdp.waitFor(
      `location.pathname === '/analytics/c1' && location.search.includes('table_page=2') && document.querySelector('[data-student-profile-id="p12"]')`,
      10000,
      'legacy redirect to analytics page 2',
    )
    const legacyUrl = await cdp.eval(`({ path: location.pathname, search: location.search, hash: location.hash, hasP12: !!document.querySelector('[data-student-profile-id="p12"]') })`)
    assert.equal(legacyUrl.hash, '#students-roster')
    assert.equal(legacyUrl.hasP12, true)

    // 10. Empty state (p23 on page 3), Error + Retry, and Loading/Race condition guard
    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1?table_page=3` })
    await cdp.waitFor(`document.querySelector('[data-student-profile-id="p23"]')`, 8000, 'p23 on page 3')
    await cdp.eval(`document.querySelector('[data-student-profile-id="p23"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .empty-state-box')`, 8000, 'p23 empty uploaded sessions state')
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 8000, 'close empty state modal')

    // Error + retry (force=true bypasses cache)
    await cdp.eval(`sessionStorage.setItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS_STATUS__', '403')`)
    await cdp.eval(`document.querySelector('[data-student-profile-id="p21"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .error-banner')`, 8000, 'p21 403 error state')
    const errText = await cdp.eval(`document.querySelector('[role="dialog"] .error-text').textContent`)
    assert.ok(!errText.includes('Not your student') && errText.includes('permission'), `Friendly 403 error shown: ${errText}`)
    await cdp.eval(`sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS_STATUS__')`)
    await cdp.eval(`document.querySelector('[role="dialog"] .retry-btn').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .summary-grid')`, 8000, 'retry recovered student analytics')
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 8000, 'close recovered modal')

    // Switching directly between students clears stale prior student content immediately
    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1?table_page=2&student=p12` })
    await cdp.waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('CryptoKnight')`, 8000, 'p12 open before direct switch')
    await cdp.eval(`
      window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 450;
      window.history.pushState({}, '', '/analytics/c1?table_page=2&student=p13');
      window.dispatchEvent(new PopStateEvent('popstate'));
    `)
    await cdp.waitFor(`location.search.includes('student=p13')`, 4000, 'url switched to p13')
    const duringSwitchLeak = await cdp.eval(`document.querySelector('[role="dialog"]')?.innerText.includes('CryptoKnight')`)
    assert.equal(duringSwitchLeak, false, 'Switching from p12 to p13 clears stale CryptoKnight content immediately')
    await cdp.waitFor(`!document.querySelector('[role="dialog"] .loading-state') && document.querySelector('[role="dialog"] .summary-grid')`, 8000, 'p13 modal content loaded')
    await cdp.eval(`window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 0`)
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 8000, 'close p13 modal')

    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1?table_page=3` })
    await cdp.waitFor(`document.querySelector('[data-student-profile-id="p22"]')`, 8000, 'p22 back on page 3')

    // Delayed response discarded when closing modal / switching classroom mid-flight
    await cdp.eval(`window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 700`)
    await cdp.eval(`document.querySelector('[data-student-profile-id="p22"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .loading-state')`, 3000, 'p22 loading state shown')
    // Close modal while p22 response still in-flight, verify it stays closed after 700ms
    await cdp.pressKey('Escape', 'Escape')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 3000, 'modal closed while loading')
    await sleep(900)
    assert.equal(
      await cdp.eval(`Boolean(document.querySelector('[role="dialog"]'))`),
      false,
      'Delayed p22 response did not reopen closed modal',
    )

    // Rapid classroom switch mid-flight c1?student=p22 -> c2
    await cdp.eval(`document.querySelector('[data-student-profile-id="p22"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .loading-state')`, 3000, 'p22 loading before classroom switch')
    await cdp.eval(`window.history.pushState({}, '', '/analytics/c2'); window.dispatchEvent(new PopStateEvent('popstate'));`)
    await sleep(950)
    await cdp.eval(`window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 0`)
    const afterRace = await cdp.eval(`({ path: location.pathname, dialogOpen: !!document.querySelector('[role="dialog"]') })`)
    assert.equal(afterRace.path, '/analytics/c2')
    assert.equal(afterRace.dialogOpen, false, 'Delayed p22 response did not reopen modal in c2')

    // 12. Mobile layout check (390 x 844) including page 2 modal & internal scrolling
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await cdp.send('Page.navigate', { url: `${baseUrl}/analytics/c1` })
    await cdp.waitFor(`document.querySelector('[data-student-profile-id="p1"]')`, 8000, 'mobile analytics loaded')
    const mobileOverflow = await cdp.eval(`document.documentElement.scrollWidth - window.innerWidth`)
    assert.ok(mobileOverflow <= 1, `No mobile horizontal overflow (delta=${mobileOverflow})`)
    await captureScreenshot(cdp, 'analytics_mobile.png')

    await cdp.eval(`document.querySelector('a.jump-students-link').click()`)
    await sleep(450)
    const mobileJump = await cdp.eval(`({
      rosterTop: document.getElementById('students-roster').getBoundingClientRect().top,
      headerBottom: document.querySelector('.mobile-header')?.getBoundingClientRect().bottom || 0
    })`)
    assert.ok(mobileJump.rosterTop >= mobileJump.headerBottom - 4, `Mobile jump clears sticky header: ${JSON.stringify(mobileJump)}`)

    // Paginate to page 2 on mobile and open p12 modal from roster page 2
    await cdp.eval(`Array.from(document.querySelectorAll('.page-btn')).find(b => b.textContent.includes('Next')).click()`)
    await cdp.waitFor(`location.search.includes('table_page=2') && document.querySelector('[data-student-profile-id="p12"]')`, 8000, 'mobile page 2 roster')
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').scrollIntoView({ block: 'center', behavior: 'instant' })`)
    await sleep(50)
    await cdp.eval(`document.querySelector('[data-student-profile-id="p12"]').click()`)
    await cdp.waitFor(`document.querySelector('[role="dialog"] .summary-grid') && document.querySelector('[role="dialog"]').innerText.includes('CryptoKnight')`, 8000, 'mobile page 2 p12 modal loaded')
    const mobileModal = await cdp.eval(`(() => {
      const dlgEl = document.querySelector('[role="dialog"]');
      const dlg = dlgEl.getBoundingClientRect();
      const bodyEl = dlgEl.querySelector('.modal-body');
      const fullBtn = dlgEl.querySelector('.btn-full-progress').getBoundingClientRect();
      const closeIcon = dlgEl.querySelector('.close-icon-btn').getBoundingClientRect();
      const bgStyle = getComputedStyle(dlgEl);
      bodyEl.scrollTop = 80;
      return {
        bgColor: bgStyle.backgroundColor,
        fitsWidth: dlg.right <= 391 && dlg.left >= 0,
        fitsHeight: dlg.bottom <= 845 && dlg.top >= 0,
        fullBtnHeight: fullBtn.height,
        closeIconHeight: closeIcon.height,
        bodyOverflowY: getComputedStyle(bodyEl).overflowY,
        canScrollBody: bodyEl.scrollHeight >= bodyEl.clientHeight,
        scrolledTop: bodyEl.scrollTop,
      };
    })()`)
    assert.ok(mobileModal.bgColor !== 'rgba(0, 0, 0, 0)', `Mobile modal opaque surface: ${JSON.stringify(mobileModal)}`)
    assert.equal(mobileModal.fitsWidth, true, `Mobile modal fits width: ${JSON.stringify(mobileModal)}`)
    assert.equal(mobileModal.fitsHeight, true, `Mobile modal fits height: ${JSON.stringify(mobileModal)}`)
    assert.ok(mobileModal.fullBtnHeight >= 44, `Mobile primary CTA >= 44px (${mobileModal.fullBtnHeight})`)
    assert.ok(mobileModal.closeIconHeight >= 44, `Mobile close button >= 44px (${mobileModal.closeIconHeight})`)
    assert.ok(['auto', 'scroll'].includes(mobileModal.bodyOverflowY), `Mobile modal body scrollable (${mobileModal.bodyOverflowY})`)
    await cdp.eval(`document.querySelector('[role="dialog"] .modal-body').scrollTop = 0`)
    await sleep(40)
    await captureScreenshot(cdp, 'modal_mobile.png')

    assert.equal(consoleErrors.length, 0, `Zero console/runtime errors, got: ${JSON.stringify(consoleErrors)}`)
    console.log('ALL_VERIFY_CLASSROOM_REDESIGN_CHECKS_PASSED')
  } finally {
    if (cdp) cdp.close()
    edgeProc.kill()
    viteProc.kill()
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('VERIFICATION_FAILED:', err)
  process.exit(1)
})
