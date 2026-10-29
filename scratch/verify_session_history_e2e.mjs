/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5195
const CDP_PORT = 9245
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-history-cdp-${Date.now()}`)
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
    } catch (err) {
      console.log('waitForServer error:', err.message)
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
  let viteProcess = null
  let chromeProcess = null
  let cdp = null
  let pageCdp = null

  try {
    console.log('[1/7] Starting Vite dev server...')
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

    viteProcess.stdout.on('data', (d) => process.stdout.write(`[VITE] ${d}`))
    viteProcess.stderr.on('data', (d) => process.stderr.write(`[VITE ERR] ${d}`))
    viteProcess.on('exit', (c) => console.log(`[VITE EXIT] ${c}`))

    const serverReady = await waitForServer(`${BASE_URL}/`)
    if (!serverReady) {
      throw new Error(`Preview server failed to start at ${BASE_URL}`)
    }
    console.log(`Server ready at ${BASE_URL}`)

    console.log('[2/7] Launching Headless Chrome...')
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
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
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('[3/7] Setting Player Auth State for AgentZero...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
    await sleep(800)

    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-player-01',
        profile_id: 'p1',
        username: 'AgentZero',
        role: 'player',
        display_name: 'AgentZero'
      }));
    `)
    await sleep(500)

    console.log('[4/7] Checking Overview page preview...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(2000)

    const overviewData = await pageCdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('.sessions-table tbody tr');
        const countNote = document.querySelector('.sessions-count-note')?.textContent?.trim() || '';
        const historyLink = document.querySelector('.btn-history-link');
        const chart = document.querySelector('.score-bars');
        const sidebarItems = Array.from(document.querySelectorAll('.nav-menu .nav-item .nav-label')).map(el => el.textContent.trim());

        return {
          rowCount: rows.length,
          countNote,
          historyLinkText: historyLink?.textContent?.trim() || null,
          historyLinkHref: historyLink?.getAttribute('href') || null,
          chartAriaLabel: chart?.getAttribute('aria-label') || '',
          sidebarItems,
        };
      })()
    `)

    console.log('Overview Table Row Count:', overviewData.rowCount)
    console.log('Overview Count Note:', overviewData.countNote)
    console.log('Overview History Link:', overviewData.historyLinkText, '->', overviewData.historyLinkHref)
    console.log('Overview Chart aria-label:', overviewData.chartAriaLabel)
    console.log('Sidebar items:', overviewData.sidebarItems)

    assert.equal(overviewData.rowCount, 5, 'Overview table must show exactly 5 preview rows')
    assert.match(overviewData.countNote, /Showing 5 of \d+ in latest 20 \(preview\)/)
    assert.equal(overviewData.historyLinkText, 'View session history')
    assert.equal(overviewData.historyLinkHref, '/session-history')
    assert.match(overviewData.chartAriaLabel, /The latest 5 sessions are shown in the preview below; full session history is available on the Session history page/)
    
    // Check sidebar order: Overview, then Session history
    const overviewIdx = overviewData.sidebarItems.indexOf('Overview')
    const historyIdx = overviewData.sidebarItems.indexOf('Session history')
    assert(overviewIdx >= 0, 'Overview must be in sidebar')
    assert(historyIdx >= 0, 'Session history must be in sidebar')
    assert.equal(historyIdx, overviewIdx + 1, 'Session history must be directly below Overview')
    console.log('✔ Overview preview checks passed')

    console.log('[5/7] Navigating to Session history page 1...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/session-history` })
    await sleep(2000)

    const page1Data = await pageCdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('.sessions-table tbody tr');
        const countNote = document.querySelector('.history-count-note')?.textContent?.trim() || '';
        const pageInfo = document.querySelector('.pagination-info')?.textContent?.trim() || '';
        const prevBtn = document.querySelectorAll('.btn-pagination')[0];
        const nextBtn = document.querySelectorAll('.btn-pagination')[1];
        const currentUrl = window.location.href;
        const heading = document.querySelector('#session-history-heading')?.textContent?.trim() || '';

        return {
          currentUrl,
          heading,
          rowCount: rows.length,
          countNote,
          pageInfo,
          prevDisabled: prevBtn?.disabled,
          nextDisabled: nextBtn?.disabled,
        };
      })()
    `)

    console.log('Session History Page 1 URL:', page1Data.currentUrl)
    console.log('Heading:', page1Data.heading)
    console.log('Row count:', page1Data.rowCount)
    console.log('Count note:', page1Data.countNote)
    console.log('Page info:', page1Data.pageInfo)
    console.log('Prev disabled:', page1Data.prevDisabled, 'Next disabled:', page1Data.nextDisabled)

    assert.equal(page1Data.heading, 'Session history')
    assert.match(page1Data.currentUrl, /page=1/)
    assert.equal(page1Data.rowCount, 20, 'Page 1 must show 20 rows')
    assert.match(page1Data.countNote, /Showing 1–20 of 25 sessions/)
    assert.match(page1Data.pageInfo, /Page 1 of 2/)
    assert.equal(page1Data.prevDisabled, true, 'Previous button must be disabled on page 1')
    assert.equal(page1Data.nextDisabled, false, 'Next button must be enabled on page 1')
    console.log('✔ Page 1 checks passed')

    console.log('[6/7] Clicking Next to test Page 2 and recovery...')
    await pageCdp.evaluate(`
      document.querySelectorAll('.btn-pagination')[1].click();
    `)
    await sleep(1500)

    const page2Data = await pageCdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('.sessions-table tbody tr');
        const countNote = document.querySelector('.history-count-note')?.textContent?.trim() || '';
        const pageInfo = document.querySelector('.pagination-info')?.textContent?.trim() || '';
        const prevBtn = document.querySelectorAll('.btn-pagination')[0];
        const nextBtn = document.querySelectorAll('.btn-pagination')[1];
        const currentUrl = window.location.href;

        return {
          currentUrl,
          rowCount: rows.length,
          countNote,
          pageInfo,
          prevDisabled: prevBtn?.disabled,
          nextDisabled: nextBtn?.disabled,
        };
      })()
    `)

    console.log('Page 2 URL:', page2Data.currentUrl)
    console.log('Row count:', page2Data.rowCount)
    console.log('Count note:', page2Data.countNote)
    console.log('Page info:', page2Data.pageInfo)
    console.log('Prev disabled:', page2Data.prevDisabled, 'Next disabled:', page2Data.nextDisabled)

    assert.match(page2Data.currentUrl, /page=2/)
    assert.equal(page2Data.rowCount, 5, 'Page 2 must show 5 rows')
    assert.match(page2Data.countNote, /Showing 21–25 of 25 sessions/)
    assert.match(page2Data.pageInfo, /Page 2 of 2/)
    assert.equal(page2Data.prevDisabled, false, 'Previous button must be enabled on page 2')
    assert.equal(page2Data.nextDisabled, true, 'Next button must be disabled on page 2')
    console.log('✔ Page 2 checks passed')

    // Test out of range recovery
    console.log('Testing out-of-range recovery (?page=999)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/session-history?page=999` })
    await sleep(1500)
    const recoveredUrl = await pageCdp.evaluate(`window.location.href`)
    console.log('Recovered URL:', recoveredUrl)
    assert.match(recoveredUrl, /page=2/, 'Should recover from page 999 to page 2')
    console.log('✔ Out-of-range recovery passed')

    // Test invalid page normalization
    console.log('Testing invalid page normalization (?page=abc)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/session-history?page=abc` })
    await sleep(1500)
    const normalizedUrl = await pageCdp.evaluate(`window.location.href`)
    console.log('Normalized URL:', normalizedUrl)
    assert.match(normalizedUrl, /page=1/, 'Should normalize invalid page to page 1')
    console.log('✔ Invalid page normalization passed')

    console.log('[7/7] Testing mobile layout at 390px...')
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(1000)

    const mobileCheck = await pageCdp.evaluate(`
      (() => {
        const thead = document.querySelector('.sessions-table thead');
        const firstCell = document.querySelector('.sessions-table tbody td');
        const computedDisplay = window.getComputedStyle(thead).display;
        const cellDataLabel = firstCell?.getAttribute('data-label');
        return {
          theadDisplay: computedDisplay,
          cellDataLabel,
        };
      })()
    `)
    console.log('Mobile thead display:', mobileCheck.theadDisplay)
    console.log('Mobile cell data-label:', mobileCheck.cellDataLabel)
    assert.equal(mobileCheck.theadDisplay, 'none', 'Mobile table header should be hidden in card mode')
    assert.equal(mobileCheck.cellDataLabel, 'Date', 'First cell should have data-label Date')
    console.log('✔ Mobile card layout verified')

    console.log('ALL VERIFICATIONS PASSED!')
  } finally {
    if (pageCdp) await pageCdp.close().catch(() => {})
    if (cdp) await cdp.close().catch(() => {})
    if (chromeProcess && chromeProcess.pid) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(chromeProcess.pid), '/T', '/F'])
      } else {
        chromeProcess.kill('SIGTERM')
      }
    }
    if (viteProcess && viteProcess.pid) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(viteProcess.pid), '/T', '/F'])
      } else {
        viteProcess.kill('SIGTERM')
      }
    }
    await sleep(1000)
  }
}

run().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
