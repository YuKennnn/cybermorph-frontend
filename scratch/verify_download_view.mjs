/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'
import { resolveHostRootUrl } from '../src/api/app.js'

const isWindows = process.platform === 'win32'
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5193
const CDP_PORT = 9253
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-download-cdp-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/e915d42a-bc70-4315-86d7-18b50753d36f'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.id = 0
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
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.callbacks.set(id, { resolve, reject })
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
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async waitEval(expr, timeoutMs = 8000, intervalMs = 150) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        /* wait */
      }
      await sleep(intervalMs)
    }
    throw new Error(`Timeout waiting for expression: ${expr}`)
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

  close() {
    if (this.ws) this.ws.close()
  }
}

async function getCDPWebSocketUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`)
  const json = await res.json()
  return json.webSocketDebuggerUrl
}

async function run() {
  console.log('[Phase 1] Unit test: resolveHostRootUrl')
  assert.strictEqual(
    resolveHostRootUrl('https://cybermorph-backend.onrender.com/v1'),
    'https://cybermorph-backend.onrender.com',
  )
  assert.strictEqual(
    resolveHostRootUrl('https://cybermorph-backend.onrender.com/v1/'),
    'https://cybermorph-backend.onrender.com',
  )
  assert.strictEqual(
    resolveHostRootUrl('http://localhost:8000/v1'),
    'http://localhost:8000',
  )
  assert.strictEqual(
    resolveHostRootUrl('http://localhost:8000/'),
    'http://localhost:8000',
  )
  assert.strictEqual(
    resolveHostRootUrl('http://localhost:8000'),
    'http://localhost:8000',
  )
  console.log('✓ resolveHostRootUrl passed all unit assertions\n')

  let viteProc = null
  let chromeProc = null
  let client = null

  try {
    console.log('[Phase 2] Starting Vite test server on port', TEST_PORT)
    let viteExited = false
    let viteExitCode = null
    let viteError = null

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
        console.log('Vite output:', str.trim())
      }
    })
    viteProc.stderr.on('data', (d) => console.error('Vite err:', d.toString().trim()))
    viteProc.on('exit', (code) => {
      viteExited = true
      viteExitCode = code
    })
    viteProc.on('error', (err) => {
      viteError = err
    })

    let serverReady = false
    for (let i = 0; i < 40; i++) {
      if (viteExited) {
        throw new Error(`Vite server exited prematurely with code ${viteExitCode}`)
      }
      if (viteError) {
        throw new Error(`Vite process error: ${viteError.message}`)
      }
      try {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`)
        if (res.ok) {
          serverReady = true
          break
        }
      } catch (err) {
        if (i === 19) console.error('CDP connect error on last attempt:', err)
        await sleep(250)
      }
    }

    if (!serverReady) {
      throw new Error(`Server failed to start at http://127.0.0.1:${TEST_PORT}/`)
    }
    console.log('✓ Server ready at', BASE_URL)

    console.log('[Phase 3] Launching Headless Chrome on CDP port', CDP_PORT)
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
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1440,900',
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

    let connected = false
    let pageCdp = null
    for (let i = 0; i < 20; i++) {
      try {
        const browserWs = await getCDPWebSocketUrl(CDP_PORT)
        const browserCdp = new CDPClient(browserWs)
        await browserCdp.connect()
        const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' })
        const targetWs = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`
        pageCdp = new CDPClient(targetWs)
        await pageCdp.connect()
        await pageCdp.send('Page.enable')
        await pageCdp.send('Runtime.enable')
        await pageCdp.send('DOM.enable')
        client = pageCdp
        connected = true
        break
      } catch (err) {
        if (i === 19) console.error('CDP connect error on last attempt:', err)
        await sleep(250)
      }
    }
    if (!connected) throw new Error('Failed to connect to Chrome CDP')
    console.log('✓ Connected to Headless Chrome via CDP\n')

    console.log('[Phase 4] Testing normal release state (logged out, desktop 1440x900)')
    await client.setViewport(1440, 900)
    await client.send('Page.navigate', { url: `${BASE_URL}/download` })
    await sleep(1500)

    const initialInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const buildVersionEl = card?.querySelector('.status-build-num');
      const statusBadge = card?.querySelector('.status-badge-available');
      const actionLink = card?.querySelector('.btn-primary');
      const driveNotice = card?.querySelector('.destination-note');
      const playCard = document.querySelectorAll('.platform-card-disabled')[0];
      const steamCard = document.querySelectorAll('.platform-card-disabled')[1];
      const tableRows = Array.from(document.querySelectorAll('.requirements-table tr')).map(tr => ({
        label: tr.querySelector('th')?.textContent?.trim(),
        val: tr.querySelector('td')?.textContent?.trim()
      }));

      return {
        hasCard: !!card,
        buildVersion: buildVersionEl?.textContent?.trim(),
        statusBadgeText: statusBadge?.textContent?.trim(),
        isAnchor: actionLink?.tagName === 'A',
        linkText: actionLink?.querySelector('span')?.textContent?.trim(),
        href: actionLink?.getAttribute('href'),
        target: actionLink?.getAttribute('target'),
        rel: actionLink?.getAttribute('rel'),
        srOnlyText: actionLink?.querySelector('.sr-only')?.textContent?.trim(),
        driveNoticeText: driveNotice?.textContent?.trim(),
        minHeight: actionLink ? window.getComputedStyle(actionLink).minHeight : null,
        playDisabled: playCard?.querySelector('button')?.disabled,
        steamDisabled: steamCard?.querySelector('button')?.disabled,
        tableRows,
      };
    })()`)

    console.log('Initial page info:', initialInfo)
    assert.strictEqual(initialInfo.hasCard, true, 'APK card must exist')
    assert.strictEqual(initialInfo.buildVersion, 'Build 10', 'Build version should be Build 10')
    assert.strictEqual(initialInfo.statusBadgeText, 'Available', 'Status badge should be Available')
    assert.strictEqual(initialInfo.isAnchor, true, 'Download action must be an anchor tag <a>')
    assert.strictEqual(initialInfo.linkText, 'Get Android APK', 'Action link text must be Get Android APK')
    assert.ok(initialInfo.href?.includes('drive.google.com'), 'Href must preserve Google Drive link')
    assert.strictEqual(initialInfo.target, '_blank', 'Target must be _blank')
    assert.strictEqual(initialInfo.rel, 'noopener noreferrer', 'Rel must be noopener noreferrer')
    assert.strictEqual(initialInfo.srOnlyText, '(opens in a new tab)', 'Accessible new-tab disclosure must exist')
    assert.strictEqual(initialInfo.driveNoticeText, 'Opens Google Drive', 'Concise "Opens Google Drive" text must show')
    assert.strictEqual(initialInfo.minHeight, '44px', 'Minimum touch target must be at least 44px')
    assert.strictEqual(initialInfo.playDisabled, true, 'Google Play button must remain disabled')
    assert.strictEqual(initialInfo.steamDisabled, true, 'Steam button must remain disabled')

    // Check system requirements table preserved
    const androidVerRow = initialInfo.tableRows.find((r) => r.label === 'Android Version')
    assert.strictEqual(androidVerRow?.val, 'Awaiting confirmation', 'System requirements must remain awaiting confirmation')

    // Capture desktop screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'download_page_desktop_1440.png')
    await client.screenshot(desktopScreenshotPath)
    console.log('✓ Captured desktop screenshot:', desktopScreenshotPath, '\n')

    console.log('[Phase 5] Testing mobile viewport (390x844)')
    await client.setViewport(390, 844)
    await sleep(500)

    const mobileCheck = await client.eval(`(() => {
      const bodyWidth = document.body.scrollWidth;
      const windowWidth = window.innerWidth;
      const card = document.querySelector('.platform-card-primary');
      const actionLink = card?.querySelector('.btn-primary');
      return {
        bodyWidth,
        windowWidth,
        hasOverflow: bodyWidth > windowWidth,
        actionHeight: actionLink?.offsetHeight,
      };
    })()`)
    console.log('Mobile check:', mobileCheck)
    assert.strictEqual(mobileCheck.hasOverflow, false, 'No horizontal page overflow on mobile')
    assert.ok(mobileCheck.actionHeight >= 44, 'Touch target meets 44px on mobile')

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'download_page_mobile_390.png')
    await client.screenshot(mobileScreenshotPath)
    console.log('✓ Captured mobile screenshot:', mobileScreenshotPath, '\n')

    console.log('[Phase 6] Testing error & retry state')
    await client.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_FAIL_APP_VERSION__', '1');
    })()`)
    await client.send('Page.navigate', { url: `${BASE_URL}/download` })
    await sleep(1000)

    const errorInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const retryBtn = card?.querySelector('.btn-retry');
      const disabledBtn = card?.querySelector('.platform-actions .btn-disabled');
      const errText = card?.querySelector('.status-hint-error')?.textContent?.trim();
      return {
        hasRetryBtn: !!retryBtn,
        retryBtnText: retryBtn?.textContent?.trim(),
        disabledBtnText: disabledBtn?.textContent?.trim(),
        errText,
      };
    })()`)

    console.log('Error state info:', errorInfo)
    assert.strictEqual(errorInfo.hasRetryBtn, true, 'Retry button must be visible in error state')
    assert.strictEqual(errorInfo.disabledBtnText, 'Download unavailable', 'Button should state Download unavailable')
    assert.ok(errorInfo.errText?.length > 0, 'Error message must be displayed')

    // Click retry and verify recovery
    console.log('Clicking retry button...')
    await client.eval(`document.querySelector('.btn-retry').click()`)
    await sleep(1000)

    const recoveredInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const actionLink = card?.querySelector('.btn-primary');
      const buildVersionEl = card?.querySelector('.status-build-num');
      return {
        hasActionLink: actionLink?.tagName === 'A',
        buildVersion: buildVersionEl?.textContent?.trim(),
        retryGone: !card?.querySelector('.btn-retry'),
      };
    })()`)
    console.log('Recovered info:', recoveredInfo)
    assert.strictEqual(recoveredInfo.hasActionLink, true, 'Must recover to active download link')
    assert.strictEqual(recoveredInfo.buildVersion, 'Build 10', 'Build 10 restored')
    assert.strictEqual(recoveredInfo.retryGone, true, 'Retry button disappears after success')
    console.log('✓ Error recovery via Retry confirmed\n')

    console.log('[Phase 7] Testing empty download_url state')
    await client.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 11,
        min_supported_build: 11,
        download_url: '',
        api_current: 1,
        api_min_supported: 1
      }));
    })()`)
    await client.send('Page.navigate', { url: `${BASE_URL}/download` })
    await sleep(1000)

    const emptyInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const buildVersion = card?.querySelector('.status-build-num')?.textContent?.trim();
      const statusLabel = card?.querySelectorAll('.status-row')[0]?.querySelector('.status-subtle')?.textContent?.trim();
      const disabledBtn = card?.querySelector('.platform-actions .btn-disabled');
      return {
        buildVersion,
        statusLabel,
        disabledBtnText: disabledBtn?.textContent?.trim(),
        isDisabled: disabledBtn?.disabled,
      };
    })()`)
    console.log('Empty state info:', emptyInfo)
    assert.strictEqual(emptyInfo.buildVersion, 'Build 11', 'Should show Build 11')
    assert.strictEqual(emptyInfo.statusLabel, 'Not available yet', 'Status should indicate Not available yet')
    assert.strictEqual(emptyInfo.disabledBtnText, 'Download not available yet', 'Button must say Download not available yet')
    assert.strictEqual(emptyInfo.isDisabled, true, 'Button must be disabled')
    console.log('✓ Empty download_url handled correctly\n')

    console.log('[Phase 8] Testing self-link loop detection')
    await client.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 12,
        min_supported_build: 12,
        download_url: '${BASE_URL}/download',
        api_current: 1,
        api_min_supported: 1
      }));
    })()`)
    await client.send('Page.navigate', { url: `${BASE_URL}/download` })
    await sleep(1000)

    const loopInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const errHint = card?.querySelector('.status-hint-error')?.textContent?.trim();
      const disabledBtn = card?.querySelector('.platform-actions .btn-disabled');
      const isAnchor = card?.querySelector('.platform-actions a');
      return {
        errHint,
        disabledBtnText: disabledBtn?.textContent?.trim(),
        hasAnchor: !!isAnchor,
      };
    })()`)
    console.log('Self-loop info:', loopInfo)
    assert.ok(loopInfo.errHint?.includes('configuration error'), 'Self-loop must report configuration error')
    assert.strictEqual(loopInfo.disabledBtnText, 'Download unavailable', 'Button must be disabled')
    assert.strictEqual(loopInfo.hasAnchor, false, 'Self-link must NOT render an active anchor')
    console.log('✓ Self-link loop detected and blocked\n')

    console.log('[Phase 9] Testing invalid non-HTTPS URL detection')
    await client.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_APP_VERSION__', JSON.stringify({
        latest_build: 13,
        min_supported_build: 13,
        download_url: 'http://insecure-cdn.com/game.apk',
        api_current: 1,
        api_min_supported: 1
      }));
    })()`)
    await client.send('Page.navigate', { url: `${BASE_URL}/download` })
    await sleep(1000)

    const invalidInfo = await client.eval(`(() => {
      const card = document.querySelector('.platform-card-primary');
      const errHint = card?.querySelector('.status-hint-error')?.textContent?.trim();
      const hasAnchor = !!card?.querySelector('.platform-actions a');
      return {
        errHint,
        hasAnchor,
      };
    })()`)
    console.log('Invalid URL info:', invalidInfo)
    assert.ok(invalidInfo.errHint?.includes('valid HTTPS URL'), 'Must flag non-HTTPS URL')
    assert.strictEqual(invalidInfo.hasAnchor, false, 'Insecure URL must NOT render an active anchor')
    console.log('✓ Non-HTTPS URL flagged as configuration error\n')

    console.log('=====================================================')
    console.log('ALL PHASES PASSED SUCCESSFULLY!')
    console.log('=====================================================')
  } finally {
    if (client) client.close()
    if (chromeProc) chromeProc.kill('SIGKILL')
    if (viteProc) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F'])
      } else {
        viteProc.kill('SIGKILL')
      }
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
