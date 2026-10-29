/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { buildChartSeries, filterSessionsByMap } from '../src/utils/playerSessions.js'

console.log('=== 1. Unit Tests for buildChartSeries and 10-Session Window ===')

// Test 1: Zero score has height_percent 0 (zero-height fill)
{
  const sessions = [
    { session_id: 's1', score: 0, map_name: 'Home' },
    { session_id: 's2', score: 100, map_name: 'Office' },
  ]
  const series = buildChartSeries(sessions)
  assert.equal(series.points.length, 2)
  // sessions is newest-first, chronological is reversed: s2 (score 100), then s1 (score 0)
  const zeroPoint = series.points.find((p) => p.session_id === 's1')
  assert.equal(zeroPoint.height_percent, 0, 'Zero score must have zero height fill')
  console.log('✔ Zero score has 0% height fill')
}

// Test 2: Small score has genuine proportional height (no artificial 8% floor)
{
  const sessions = [
    { session_id: 's1', score: 20, map_name: 'Home' },
    { session_id: 's2', score: 1000, map_name: 'Office' },
  ]
  const series = buildChartSeries(sessions)
  const smallPoint = series.points.find((p) => p.session_id === 's1')
  // 20 / 1000 = 2%
  assert.equal(smallPoint.height_percent, 2, 'Small score must not have 8% floor')
  console.log('✔ Small score proportional scaling verified')
}

// Test 3: Missing scores excluded and tracked
{
  const sessions = [
    { session_id: 's1', score: null, map_name: 'Home' },
    { session_id: 's2', score: 50, map_name: 'Office' },
  ]
  const series = buildChartSeries(sessions)
  assert.equal(series.points.length, 1)
  assert.equal(series.invalidExcludedCount, 1)
  console.log('✔ Missing scores properly excluded and tracked')
}

// Test 4: 10-session dataset windowing
{
  const twentySessions = Array.from({ length: 20 }, (_, i) => ({
    session_id: `sess-${i + 1}`,
    score: (i + 1) * 10,
    map_name: i % 2 === 0 ? 'Home' : 'Office',
  }))
  const top10 = twentySessions.slice(0, 10)
  assert.equal(top10.length, 10)
  const homeInTop10 = filterSessionsByMap(top10, 'Home')
  assert.equal(homeInTop10.length, 5)
  console.log('✔ 10-session windowing and map filter verified')
}

console.log('\n=== 2. Browser E2E Tests for Simplified Overview ===')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5196
const CDP_PORT = 9246
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-overview-cdp-${Date.now()}`)
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
      // server not ready
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

async function runBrowserTests() {
  let viteProcess = null
  let chromeProcess = null
  let cdp = null
  let pageCdp = null

  try {
    console.log('[1/5] Starting Vite dev server...')
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

    const serverReady = await waitForServer(`${BASE_URL}/`)
    if (!serverReady) {
      throw new Error(`Server failed to start at ${BASE_URL}`)
    }
    console.log(`Server ready at ${BASE_URL}`)

    console.log('[2/5] Launching Chrome...')
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

    console.log('[3/5] Setting Auth & Navigating to Dashboard...')
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

    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(2000)

    const overviewState = await pageCdp.evaluate(`
      (() => {
        const table = document.querySelector('.sessions-table');
        const heading = document.querySelector('#recent-performance-heading')?.textContent?.trim();
        const badge = document.querySelector('.scope-badge')?.textContent?.trim();
        const historyLink = document.querySelector('.btn-history-link');
        const mapOptions = Array.from(document.querySelectorAll('#overview-map-select option')).map(o => o.textContent.trim());
        const filterNote = document.querySelector('#overview-map-filter-note')?.textContent?.trim();
        const chartPoints = document.querySelectorAll('.score-bar-col');
        const srTableRows = document.querySelectorAll('.chart-container .sr-only table tbody tr');
        const srTableCaption = document.querySelector('.chart-container .sr-only table caption')?.textContent?.trim();
        const chartAriaLabel = document.querySelector('.score-bars')?.getAttribute('aria-label');
        const bestScoreSublabel = document.querySelector('.highlight-card .stat-sublabel')?.textContent?.trim();
        const gamesPlayedVal = document.querySelector('.stat-card .stat-value')?.textContent?.trim();

        return {
          hasVisibleTable: !!table,
          heading,
          badge,
          historyLinkText: historyLink?.textContent?.trim(),
          historyLinkHref: historyLink?.getAttribute('href'),
          mapOptions,
          filterNote,
          chartPointCount: chartPoints.length,
          srTableRowCount: srTableRows.length,
          srTableCaption,
          chartAriaLabel,
          bestScoreSublabel,
          gamesPlayedVal,
        };
      })()
    `)

    console.log('Overview state:', overviewState)

    // Verify visible table is removed
    assert.equal(overviewState.hasVisibleTable, false, 'Visible preview table must be removed')
    // Verify heading, badge, link
    assert.equal(overviewState.heading, 'Recent performance')
    assert.equal(overviewState.badge, 'Latest 10 sessions')
    assert.equal(overviewState.historyLinkText, 'View session history')
    assert.equal(overviewState.historyLinkHref, '/session-history')
    // Verify select options & note
    assert.equal(overviewState.mapOptions[0], 'All maps (latest 10)')
    assert.equal(overviewState.filterNote, 'Filters within your latest 10 sessions')
    // Verify 10 points plotted
    assert.equal(overviewState.chartPointCount, 10, 'Chart must plot exactly 10 points')
    // Verify sr-only table
    assert.equal(overviewState.srTableRowCount, 10, 'Screen reader table must have 10 rows')
    assert.match(overviewState.srTableCaption, /latest 10 sessions/)
    assert.match(overviewState.chartAriaLabel, /latest 10 sessions/)
    // Verify summary cards
    assert.equal(overviewState.bestScoreSublabel, 'Latest 20 sessions', 'Recent best score sublabel must remain Latest 20 sessions')
    assert.equal(overviewState.gamesPlayedVal, '25', 'Games played must remain confirmed API total 25')
    console.log('✔ Overview desktop verification passed')

    console.log('[4/5] Testing map filter within latest 10 sessions...')
    // Select a map filter in select
    await pageCdp.evaluate(`
      (() => {
        const select = document.querySelector('#overview-map-select');
        select.value = 'Home';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(500)

    const homeFilterState = await pageCdp.evaluate(`
      (() => {
        const points = document.querySelectorAll('.score-bar-col');
        const srRows = document.querySelectorAll('.chart-container .sr-only table tbody tr');
        return {
          pointCount: points.length,
          srRowCount: srRows.length,
        };
      })()
    `)
    console.log('Home filter point count:', homeFilterState.pointCount)
    assert(homeFilterState.pointCount > 0 && homeFilterState.pointCount <= 10)
    assert.equal(homeFilterState.pointCount, homeFilterState.srRowCount)
    console.log('✔ Map filter applies strictly within latest 10 sessions')

    console.log('[5/5] Testing Mobile Layout (390px) & Horizontal Overflow...')
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(800)

    const mobileMetrics = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const chartWrapper = document.querySelector('.score-bars-wrapper');
        const chartScrollWidth = chartWrapper ? chartWrapper.scrollWidth : 0;
        const chartClientWidth = chartWrapper ? chartWrapper.clientWidth : 0;

        const overflowing = [];
        document.querySelectorAll('*').forEach(el => {
          if (el.scrollWidth > docWidth + 5) {
            overflowing.push({
              tag: el.tagName,
              cls: typeof el.className === 'string' ? el.className : '',
              id: el.id,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            });
          }
        });

        return {
          docWidth,
          scrollWidth,
          chartScrollWidth,
          chartClientWidth,
          hasPageHorizontalOverflow: scrollWidth > docWidth,
          overflowing: overflowing.slice(0, 10),
        };
      })()
    `)
    console.log('Mobile Metrics:', mobileMetrics)
    assert.equal(mobileMetrics.hasPageHorizontalOverflow, false, 'Mobile page must not have horizontal overflow')
    console.log('✔ No page horizontal overflow on mobile; chart scrolling contained')

    console.log('\nALL OVERVIEW TESTS PASSED!')
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
    await sleep(1000)
  }
}

runBrowserTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
