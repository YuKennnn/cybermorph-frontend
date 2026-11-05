/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

console.log('=== CyberMorph Verification: Player Session History Duration Removal ===')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5197
const CDP_PORT = 9247
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-history-cdp-${Date.now()}`)
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

async function runHistoryTests() {
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

    console.log('[3/5] Navigating to Session History as Player...')
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

    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/session-history` })

    // Wait for table to render
    const startWait = Date.now()
    let found = false
    while (Date.now() - startWait < 8000) {
      found = await pageCdp.evaluate(`!!document.querySelector('.sessions-table tbody tr')`)
      if (found) break
      await sleep(200)
    }
    assert.equal(found, true, 'Sessions table must render rows')
    await sleep(500)

    // 1. Verify Desktop Table Structure and absence of Duration
    console.log('[4/5] Verifying Desktop Table Rows and absence of Duration line...')
    const tableData = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.sessions-table tbody tr')).map(row => {
          const dateCell = row.querySelector('td[data-label="Date"]');
          const primaryDate = dateCell?.querySelector('.date-primary')?.textContent?.trim();
          const durationEl = dateCell?.querySelector('.date-duration');
          const entireDateCellText = dateCell?.textContent?.trim();
          const map = row.querySelector('td[data-label="Map"] .map-badge')?.textContent?.trim();
          const result = row.querySelector('td[data-label="Result"] .result-pill')?.textContent?.trim();
          const score = row.querySelector('td[data-label="Score"]')?.textContent?.trim();
          const breakdown = row.querySelector('td[data-label="Credit breakdown"]')?.textContent?.trim();
          return {
            hasDurationEl: !!durationEl,
            entireDateCellText,
            primaryDate,
            hasDurationText: (entireDateCellText || '').toLowerCase().includes('duration'),
            map,
            result,
            score,
            breakdown,
          };
        });

        const entireTableText = document.querySelector('.sessions-table')?.textContent || '';
        const countNote = document.querySelector('.history-count-note')?.textContent?.trim();
        const pagination = document.querySelector('.pagination-bar');

        return {
          rowCount: rows.length,
          firstRow: rows[0],
          allRows: rows,
          tableContainsDuration: entireTableText.toLowerCase().includes('duration'),
          countNote,
          hasPagination: !!pagination,
        };
      })()
    `)

    console.log('Desktop Table data:', {
      rowCount: tableData.rowCount,
      firstRow: tableData.firstRow,
      tableContainsDuration: tableData.tableContainsDuration,
      countNote: tableData.countNote,
      hasPagination: tableData.hasPagination,
    })

    assert(tableData.rowCount > 0, 'Table must contain sessions')
    assert.equal(tableData.tableContainsDuration, false, 'Sessions table must NOT contain any Duration text')
    assert.equal(tableData.firstRow.hasDurationEl, false, 'First row must NOT have .date-duration element')
    assert.equal(tableData.firstRow.hasDurationText, false, 'First row date cell must NOT contain duration text')
    assert(tableData.firstRow.primaryDate.length > 0, 'Primary date must be displayed')
    assert(tableData.firstRow.map.length > 0, 'Map must be displayed')
    assert(tableData.firstRow.result.length > 0, 'Result must be displayed')
    assert(tableData.firstRow.score.length > 0, 'Score must be displayed')
    assert(tableData.firstRow.breakdown.length > 0, 'Breakdown must be displayed')
    assert.equal(tableData.hasPagination, true, 'Pagination bar must be present')
    console.log('✓ Desktop Session history table verified without duration line')

    await takeScreenshot('player_session_history_desktop.png')

    // 2. Verify Mobile Layout (390px)
    console.log('[5/5] Testing Mobile Layout (390px)...')
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(500)

    const mobileData = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.sessions-table tbody tr')).map(row => {
          const dateCell = row.querySelector('td[data-label="Date"]');
          const primaryDate = dateCell?.querySelector('.date-primary')?.textContent?.trim();
          const entireCellText = dateCell?.textContent?.trim();
          return {
            primaryDate,
            hasDurationText: (entireCellText || '').toLowerCase().includes('duration'),
          };
        });
        const entireTableText = document.querySelector('.sessions-table')?.textContent || '';
        return {
          rowCount: rows.length,
          firstRow: rows[0],
          tableContainsDuration: entireTableText.toLowerCase().includes('duration'),
        };
      })()
    `)
    console.log('Mobile Data:', mobileData)
    assert.equal(mobileData.tableContainsDuration, false, 'Mobile table must NOT contain duration')
    assert.equal(mobileData.firstRow.hasDurationText, false, 'Mobile first row date must NOT contain duration')
    assert(mobileData.firstRow.primaryDate.length > 0, 'Mobile date must be readable')
    console.log('✓ Mobile Session history rows verified without duration line')

    await takeScreenshot('player_session_history_mobile.png')

    console.log('\n===========================================')
    console.log('ALL SESSION HISTORY TESTS PASSED!')
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

runHistoryTests().catch((err) => {
  console.error('Session history tests failed:', err)
  process.exit(1)
})
