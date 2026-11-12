/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'

const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const CHROME_PATH = BROWSER_CANDIDATES.find((p) => fs.existsSync(p)) || BROWSER_CANDIDATES[1]
const TEST_PORT = 5192
const CDP_PORT = 9242
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-threat-cdp-${Date.now()}`)
const isWindows = process.platform === 'win32'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 1
    this.callbacks = new Map()
    this.eventHandlers = new Map()
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, [])
    }
    this.eventHandlers.get(method).push(handler)
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
      } else if (msg.method && this.eventHandlers.has(msg.method)) {
        for (const handler of this.eventHandlers.get(msg.method)) {
          handler(msg.params)
        }
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
        `CDP evaluate exception: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`,
      )
    }
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
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) resolve(true)
          else resolve(false)
        })
        req.on('error', reject)
        req.end()
      })
      return true
    } catch {
      await sleep(250)
    }
  }
  return false
}

async function getCDPWebSocketUrl(port, timeoutMs = 15000) {
  const start = Date.now()
  let lastErr = null
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) {
        const json = await res.json()
        if (json?.webSocketDebuggerUrl) return json.webSocketDebuggerUrl
      }
    } catch (err) {
      lastErr = err
    }
    await sleep(250)
  }
  throw lastErr || new Error(`CDP DevTools handshake timed out after ${timeoutMs}ms`)
}

async function run() {
  let viteProcess = null
  let chromeProcess = null
  let cdp = null
  let pageCdp = null

  try {
    console.log('[1/4] Starting Vite dev server...')
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

    viteProcess.stderr.on('data', (d) => process.stderr.write(d))

    const serverReady = await waitForServer(BASE_URL)
    if (!serverReady) {
      throw new Error(`Preview server failed to start at ${BASE_URL}`)
    }
    console.log(`Preview server ready at ${BASE_URL}`)

    console.log(`[2/4] Starting Headless Browser (${CHROME_PATH})...`)
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
    chromeProcess = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--mute-audio',
        '--window-size=1440,900',
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

    const wsUrl = await getCDPWebSocketUrl(CDP_PORT)
    cdp = new CDPClient(wsUrl)
    await cdp.connect()

    const targetRes = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const targetWsUrl = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetRes.targetId}`
    pageCdp = new CDPClient(targetWsUrl)
    await pageCdp.connect()

  await pageCdp.send('Page.enable')
  await pageCdp.send('DOM.enable')
  await pageCdp.send('Runtime.enable')

  const vueWarnings = []
  const pageExceptions = []
  pageCdp.on('Runtime.consoleAPICalled', (params) => {
    const text = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
    if ((params.type === 'warning' || params.type === 'error') && text.includes('Vue warn')) {
      vueWarnings.push(text)
    }
  })
  pageCdp.on('Runtime.exceptionThrown', (params) => {
    pageExceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Unknown exception')
  })

  // Set Educator Auth State in localStorage
  await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
  await sleep(800)
  await pageCdp.evaluate(`
    localStorage.setItem('cyber_token', 'mock-educator-token');
    localStorage.setItem('cyber_role', 'educator');
    localStorage.setItem('cyber_user', JSON.stringify({
      user_id: 'u-001',
      email: 'educator@cybermorph.local',
      role: 'educator',
      display_name: 'Professor Ramos'
    }));
  `)

  const reloadPage = async () => {
    await pageCdp.evaluate(`window.__BEFORE_RELOAD__ = true`).catch(() => {})
    await pageCdp.send('Page.reload')
    const start = Date.now()
    while (Date.now() - start < 8000) {
      const reloaded = await pageCdp.evaluate(`window.__BEFORE_RELOAD__ !== true`).catch(() => false)
      if (reloaded) return
      await sleep(80)
    }
    throw new Error('Timed out waiting for Page.reload to load fresh document')
  }

  const waitForPath = async (expectedSuffix, timeoutMs = 8000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const matched = await pageCdp
        .evaluate(`window.location.pathname.endsWith(${JSON.stringify(expectedSuffix)})`)
        .catch(() => false)
      if (matched) return
      await sleep(80)
    }
    throw new Error(`Timed out waiting for pathname to end with ${expectedSuffix}`)
  }

  const waitForThreatSection = async () => {
    const start = Date.now()
    while (Date.now() - start < 8000) {
      const ready = await pageCdp.evaluate(`
        (() => {
          const loading = document.querySelector('.loading-state');
          const sec = document.querySelector('section[aria-label="Types of threats"]');
          const title = document.querySelector('.student-title')?.textContent?.trim();
          return !loading && Boolean(sec) && Boolean(title) && !title.includes('Loading');
        })()
      `)
      if (ready) return
      await sleep(150)
    }
    throw new Error('Timed out waiting for StudentProgressView Types of threats section')
  }

  const waitForSelector = async (selector, timeoutMs = 8000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const found = await pageCdp.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      if (found) return
      await sleep(100)
    }
    throw new Error(`Timed out waiting for selector: ${selector}`)
  }

  const waitForModalReady = async (timeoutMs = 8000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const ready = await pageCdp.evaluate(`
        (() => {
          const dialog = document.querySelector('.modal-dialog');
          if (!dialog) return false;
          const loading = dialog.querySelector('.loading-state');
          const done = dialog.querySelector('.telemetry-pending-banner, .events-table, .error-banner');
          return !loading && Boolean(done);
        })()
      `)
      if (ready) return
      await sleep(100)
    }
    throw new Error('Timed out waiting for session telemetry modal to finish loading')
  }

  const waitForModalClosed = async (timeoutMs = 5000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const open = await pageCdp.evaluate(`Boolean(document.querySelector('.modal-dialog'))`)
      if (!open) return
      await sleep(100)
    }
    throw new Error('Timed out waiting for session telemetry modal to close')
  }

  const inspectThreatRatesSection = async () => {
    return pageCdp.evaluate(`
      (() => {
        const sec = document.querySelector('section[aria-label="Types of threats"]');
        if (!sec) return null;
        const rows = Array.from(sec.querySelectorAll('.threats-table tbody tr')).map((tr) => ({
          name: tr.querySelector('.threat-name-cell')?.textContent.trim(),
          rate: tr.querySelector('.error-rate-badge')?.textContent.trim(),
        }));
        const emptyNote = sec.querySelector('.breakdown-empty-note')?.textContent.trim() || null;
        const unavailableBanner = sec.querySelector('.scoped-unavailable-banner')?.textContent.trim() || null;
        return { rows, emptyNote, unavailableBanner };
      })()
    `)
  }

  const inspectClassroomAnalytics = async () => {
    return pageCdp.evaluate(`
      (() => {
        const overviewLoading = Boolean(document.querySelector('.analytics-overview-loading'));
        const overviewUnavailable = document.querySelector('.overview-unavailable-card')?.textContent.trim() || null;
        const topErrorBanner = document.querySelector('.error-banner')?.textContent.trim() || null;
        const kpis = Array.from(document.querySelectorAll('.kpi-card .kpi-value')).map((el) => el.textContent.trim());
        const mapPills = Array.from(document.querySelectorAll('.map-score-pill')).map((el) => ({
          name: el.querySelector('.map-pill-name')?.textContent.trim(),
          val: (el.querySelector('.map-pill-value') || el.querySelector('.map-pill-unplayed'))?.textContent.trim(),
        }));
        const scopedUnavailableBanner =
          document.querySelector('.threat-matrix-section .scoped-unavailable-banner')?.textContent.trim() || null;
        const gauges = Array.from(document.querySelectorAll('.threat-matrix-section .threat-card')).map((card) => {
          const badgeEl = card.querySelector('.risk-badge');
          const fillEl = card.querySelector('.progress-bar-fill');
          const emptyEl = card.querySelector('.progress-bar-empty');
          return {
            name: card.querySelector('.threat-name')?.textContent.trim(),
            badge: badgeEl?.textContent.trim(),
            badgeClasses: badgeEl ? Array.from(badgeEl.classList) : [],
            rateNumber: card.querySelector('.rate-number')?.textContent.trim() || null,
            rateNull: card.querySelector('.rate-null')?.textContent.trim() || null,
            hasFillBar: Boolean(fillEl),
            barClasses: fillEl ? Array.from(fillEl.classList) : [],
            barWidth: fillEl?.style?.width || null,
            hasEmptyBar: Boolean(emptyEl),
          };
        });
        const rosterRows = document.querySelectorAll('.data-table tbody tr').length;
        return {
          overviewLoading,
          overviewUnavailable,
          topErrorBanner,
          kpis,
          mapPills,
          scopedUnavailableBanner,
          gauges,
          rosterRows,
        };
      })()
    `)
  }

  const testViewports = [
    { name: 'Laptop (1440x900)', width: 1440, height: 900, isMobile: false },
    { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
  ]

  for (const vp of testViewports) {
    console.log(`\n--- Testing ${vp.name} ---`)
    await pageCdp.evaluate(`
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS__');
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_CLASSROOM_ANALYTICS__');
      sessionStorage.removeItem('__CYBERMORPH_DELAY_CLASSROOM__');
      sessionStorage.removeItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__');
      sessionStorage.removeItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__');
    `)
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    })

    // 1. Verify Legacy Classroom Students Route Redirects to Analytics Roster (/classroom/students/c1 -> /analytics/c1#students-roster)
    console.log(`Navigating to /classroom/students/c1 (legacy redirect)...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1` })
    await waitForSelector('#students-roster .data-table .threat-count-badge')

    const debugInfo = await pageCdp.evaluate(`({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 300)
    })`)
    console.log('Page debug info:', debugInfo)

    const rosterHeaders = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('#students-roster .data-table th')).map(th => th.textContent.trim())
    `)
    console.log('Roster table headers:', rosterHeaders)
    assert(rosterHeaders.includes('Threat index'), 'Analytics roster must include "Threat index" header')

    const studentBadges = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('#students-roster .data-table .threat-count-badge')).map(b => b.textContent.trim())
    `)
    console.log(`Roster threat badges (${studentBadges.length} rows):`, studentBadges.slice(0, 3))
    assert(studentBadges.length > 0, 'Classroom roster must render threat badges')
    assert(studentBadges[0].includes('of 8 unlocked'), 'Synced student badge should format count')

    // 2. Verify Shared Validator & Standalone ThreatPerformanceGauge & EducatorAnalyticsView
    console.log('Checking shared analyticsValidation.js contract in Vite runtime...')
    await pageCdp.evaluate(`
      (async () => {
        const { isValidErrorRate, classifyCategoryBreakdown } = await import('/src/utils/analyticsValidation.js');
        const { CANONICAL_THREAT_CATEGORIES } = await import('/src/stores/threatIndexStore.js');
        const names = CANONICAL_THREAT_CATEGORIES.map((c) => c.name);
        if (names.length !== 8) throw new Error('Expected 8 canonical threat category names');
        const assertEq = (a, b, msg) => {
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            throw new Error(msg + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
          }
        };
        assertEq(isValidErrorRate(0), true, '0');
        assertEq(isValidErrorRate(1), true, '1');
        assertEq(isValidErrorRate(0.25), true, '0.25');
        assertEq(isValidErrorRate(null), false, 'null');
        assertEq(isValidErrorRate(undefined), false, 'undefined');
        assertEq(isValidErrorRate(-0.001), false, 'neg');
        assertEq(isValidErrorRate(1.001), false, 'gt1');
        assertEq(isValidErrorRate(Number.NaN), false, 'NaN');
        assertEq(isValidErrorRate(Number.POSITIVE_INFINITY), false, 'Inf');
        assertEq(isValidErrorRate('0.5'), false, 'str');
        assertEq(isValidErrorRate(true), false, 'bool');

        const allNull = Object.fromEntries(names.map((n) => [n, null]));
        assertEq(classifyCategoryBreakdown(allNull), { status: 'empty' }, '8 nulls -> empty');
        assertEq(classifyCategoryBreakdown({ ...allNull, ExtraKey: 0.4 }), { status: 'empty' }, 'extra key + nulls -> empty');
        assertEq(classifyCategoryBreakdown({ ...allNull, 'Social Engineering': 0 }), { status: 'ready' }, '0 -> ready');
        assertEq(classifyCategoryBreakdown({ ...allNull, Phishing: 1, ExtraKey: 0.2 }), { status: 'ready' }, '1 + extra -> ready');

        const inherited = Object.create({ Ransomware: 0.2 });
        for (const n of names.slice(0, 7)) inherited[n] = 0.2;
        assertEq(classifyCategoryBreakdown(inherited), { status: 'unavailable' }, 'inherited key rejected');

        const missingKey = Object.fromEntries(names.slice(0, 7).map((n) => [n, 0.2]));
        for (const bad of [null, undefined, [], '{}', missingKey, { ...allNull, Phishing: '0.2' }, { ...allNull, Phishing: -0.1 }, { ...allNull, Phishing: 1.1 }, { ...allNull, Phishing: Number.NaN }]) {
          assertEq(classifyCategoryBreakdown(bad), { status: 'unavailable' }, 'malformed rejected');
        }
      })()
    `)

    console.log('Checking standalone ThreatPerformanceGauge invalid and valid props in browser runtime...')
    const standaloneGaugeResults = await pageCdp.evaluate(`
      (async () => {
        const srcResp = await fetch('/src/components/analytics/ThreatPerformanceGauge.vue');
        const srcText = await srcResp.text();
        const vueMatch = srcText.match(/from\\s+["']([^"']*vue[^"']*)["']/);
        if (!vueMatch) throw new Error('Could not resolve bundled Vue import path in Vite dev mode');
        const { createApp, h } = await import(vueMatch[1]);
        const { default: ThreatPerformanceGauge } = await import('/src/components/analytics/ThreatPerformanceGauge.vue');

        const cases = [
          { label: 'neg-number', props: { threatName: 'Phishing', failRate: -0.1 } },
          { label: 'over-one', props: { threatName: 'Phishing', failRate: 1.2 } },
          { label: 'nan', props: { threatName: 'Phishing', failRate: Number.NaN } },
          { label: 'string-prop', props: { threatName: 'Phishing', failRate: '0.5' } },
          { label: 'valid-null', props: { threatName: 'Phishing', failRate: null } },
          { label: 'valid-zero', props: { threatName: 'Phishing', failRate: 0 } },
          { label: 'valid-mod', props: { threatName: 'Phishing', failRate: 0.25 } },
          { label: 'valid-high', props: { threatName: 'Phishing', failRate: 0.45 } },
        ];

        const results = {};
        for (const c of cases) {
          const host = document.createElement('div');
          document.body.appendChild(host);
          const app = createApp({ render: () => h(ThreatPerformanceGauge, c.props) });
          app.mount(host);
          const badgeEl = host.querySelector('.risk-badge');
          const fillEl = host.querySelector('.progress-bar-fill');
          results[c.label] = {
            badge: badgeEl?.textContent.trim(),
            badgeClasses: badgeEl ? Array.from(badgeEl.classList) : [],
            rateNumber: host.querySelector('.rate-number')?.textContent.trim() || null,
            rateNull: host.querySelector('.rate-null')?.textContent.trim() || null,
            hasFillBar: Boolean(fillEl),
            barClasses: fillEl ? Array.from(fillEl.classList) : [],
            barWidth: fillEl?.style?.width || null,
            hasEmptyBar: Boolean(host.querySelector('.progress-bar-empty')),
          };
          app.unmount();
          host.remove();
        }
        return results;
      })()
    `)
    for (const invalidKey of ['neg-number', 'over-one', 'nan', 'string-prop']) {
      const r = standaloneGaugeResults[invalidKey]
      assert.strictEqual(r.badge, 'Unavailable', `${invalidKey}: badge must be Unavailable`)
      assert(r.badgeClasses.includes('no-data'), `${invalidKey}: must use neutral no-data badge class`)
      assert(
        !['risk-low', 'risk-moderate', 'risk-high'].some((c) => r.badgeClasses.includes(c)),
        `${invalidKey}: must not apply risk-* severity color class`,
      )
      assert.strictEqual(r.rateNumber, null, `${invalidKey}: must not format invalid percentage`)
      assert.strictEqual(r.rateNull, 'Unavailable metric', `${invalidKey}: must show unavailable metric text`)
      assert.strictEqual(r.hasFillBar, false, `${invalidKey}: must not render progress fill bar`)
      assert.strictEqual(r.hasEmptyBar, true, `${invalidKey}: must render empty progress bar`)
    }
    assert.strictEqual(standaloneGaugeResults['valid-null'].badge, 'No data yet')
    assert.strictEqual(standaloneGaugeResults['valid-null'].rateNull, 'No decisions uploaded')
    assert.strictEqual(standaloneGaugeResults['valid-null'].hasEmptyBar, true)
    assert.strictEqual(standaloneGaugeResults['valid-zero'].rateNumber, '0.0%')
    assert.strictEqual(standaloneGaugeResults['valid-zero'].badge, 'Low error rate')
    assert(standaloneGaugeResults['valid-zero'].barClasses.includes('risk-low'))
    assert.strictEqual(standaloneGaugeResults['valid-zero'].barWidth, '0%')
    assert.strictEqual(standaloneGaugeResults['valid-mod'].rateNumber, '25.0%')
    assert(standaloneGaugeResults['valid-mod'].barClasses.includes('risk-moderate'))
    assert.strictEqual(standaloneGaugeResults['valid-high'].rateNumber, '45.0%')
    assert(standaloneGaugeResults['valid-high'].barClasses.includes('risk-high'))

    console.log('Checking EducatorAnalyticsView initial loading state (delayed c1)...')
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_DELAY_CLASSROOM__', JSON.stringify({ c1: 1200 }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/analytics/c1` })
    await waitForSelector('.analytics-overview-loading')
    const duringLoadState = await inspectClassroomAnalytics()
    assert.strictEqual(duringLoadState.overviewLoading, true, 'Initial load must show loading indicator')
    assert.strictEqual(duringLoadState.gauges.length, 0, 'Must not flash "No data yet" gauges while loading')
    assert.strictEqual(duringLoadState.kpis.length, 0, 'Must not show placeholder KPIs while loading')

    await pageCdp.evaluate(`sessionStorage.removeItem('__CYBERMORPH_DELAY_CLASSROOM__')`)
    await waitForSelector('.threat-matrix-section .threat-card')
    await waitForSelector('.data-table .threat-count-badge')

    const c1Ready = await inspectClassroomAnalytics()
    assert.strictEqual(c1Ready.scopedUnavailableBanner, null)
    assert.strictEqual(c1Ready.gauges.length, 8, 'c1 ready must render all 8 threat gauges')
    assert.strictEqual(
      c1Ready.gauges.find((g) => g.name === 'Social Engineering')?.rateNumber,
      '0.0%',
      'Classroom measured 0 must render as 0.0%',
    )
    assert.strictEqual(
      c1Ready.gauges.find((g) => g.name === 'Social Engineering')?.badge,
      'Low error rate',
    )
    assert.strictEqual(
      c1Ready.gauges.find((g) => g.name === 'Ransomware')?.rateNull,
      'No decisions uploaded',
    )

    // Test navigation cache reuse (Settings tab -> Analytics tab & classroom switch c1 -> c2 -> c1 within 120s)
    await pageCdp.evaluate(`sessionStorage.setItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__', '[]')`)
    await pageCdp.evaluate(`document.querySelector('.workspace-nav a[href*="/classroom/settings/c1"]').click()`)
    await waitForSelector('.settings-card')
    await pageCdp.evaluate(`document.querySelector('.workspace-nav a[href*="/analytics/c1"]').click()`)
    await waitForSelector('.threat-matrix-section .threat-card')
    const navCallsAfterTabRevisit = await pageCdp.evaluate(`
      JSON.parse(sessionStorage.getItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__') || '[]').length
    `)
    assert.strictEqual(navCallsAfterTabRevisit, 0, 'Ordinary tab navigation within 120s must reuse cached classroom summary')

    await pageCdp.evaluate(`document.querySelector('a[href="/classroom/manage"]').click()`)
    await waitForSelector('.classroom-grid')
    await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.classroom-grid > *')[1].querySelectorAll('button, a'))
        .find((el) => el.textContent.trim().includes('Analytics'))?.click()
    `)
    await waitForSelector('.threat-matrix-section .threat-card')
    await pageCdp.evaluate(`document.querySelector('a[href="/classroom/manage"]').click()`)
    await waitForSelector('.classroom-grid')
    await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.classroom-grid > *')[0].querySelectorAll('button, a'))
        .find((el) => el.textContent.trim().includes('Analytics'))?.click()
    `)
    await waitForSelector('.threat-matrix-section .threat-card')
    const classCallsAfterSwitch = await pageCdp.evaluate(`
      JSON.parse(sessionStorage.getItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__') || '[]').map((c) => c.code_id)
    `)
    assert.deepStrictEqual(
      classCallsAfterSwitch,
      ['c2'],
      'Switching c1 -> c2 -> c1 within 120s must fetch c2 once and reuse cached c1',
    )

    // Test failed Refresh data -> explicit Try again (top banner + overview card) with force=true
    console.log('Testing failed Refresh data -> explicit Try again (force=true)...')
    await pageCdp.evaluate(`sessionStorage.setItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__', '[]')`)
    await pageCdp.evaluate(`sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__', '1')`)
    await pageCdp.evaluate(`document.querySelector('.refresh-btn').click()`)
    await waitForSelector('.overview-unavailable-card .btn-retry')
    const failRefreshState = await inspectClassroomAnalytics()
    assert(failRefreshState.topErrorBanner && failRefreshState.overviewUnavailable, 'Failed refresh must show retry banners')
    const callsAfterFailedRefresh = await pageCdp.evaluate(`
      JSON.parse(sessionStorage.getItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__') || '[]').length
    `)
    assert.strictEqual(callsAfterFailedRefresh, 1, 'Failed refresh must have triggered 1 live fetch attempt')

    await pageCdp.evaluate(`document.querySelector('.error-banner .btn-retry').click()`)
    await waitForSelector('.threat-matrix-section .threat-card')
    const callsAfterTopRetry = await pageCdp.evaluate(`
      JSON.parse(sessionStorage.getItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__') || '[]').length
    `)
    assert.strictEqual(callsAfterTopRetry, 2, 'Top-banner Try again must force refetch (bypassing stale <120s cache)')

    await pageCdp.evaluate(`sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__', '1')`)
    await pageCdp.evaluate(`document.querySelector('.refresh-btn').click()`)
    await waitForSelector('.overview-unavailable-card .btn-retry')
    await pageCdp.evaluate(`document.querySelector('.overview-unavailable-card .btn-retry').click()`)
    await waitForSelector('.threat-matrix-section .threat-card')
    const callsAfterOverviewRetry = await pageCdp.evaluate(`
      JSON.parse(sessionStorage.getItem('__CYBERMORPH_CLASSROOM_ANALYTICS_CALLS__') || '[]').length
    `)
    assert.strictEqual(callsAfterOverviewRetry, 4, 'Overview Try again must also force refetch cleanly')

    // Test Classroom Analytics valid all-8-null state (keeps default 8 cards) & extra unknown key
    const baseClassroomMetrics = {
      student_count: 23,
      avg_map_progress: 2.33,
      avg_best_score_by_map: { Home: 723.3, Office: 750.0 },
    }
    const allNullFailRates = {
      Phishing: null,
      Smishing: null,
      Vishing: null,
      'Social Engineering': null,
      'Credential Theft': null,
      'Public Wi-Fi Attack': null,
      'Malware Infection': null,
      Ransomware: null,
    }
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_CLASSROOM_ANALYTICS__', ${JSON.stringify(
        JSON.stringify({ c1: { ...baseClassroomMetrics, category_fail_rates: allNullFailRates } }),
      )});
    `)
    await reloadPage()
    await waitForSelector('.threat-matrix-section .threat-card')
    const classAllNull = await inspectClassroomAnalytics()
    assert.strictEqual(classAllNull.scopedUnavailableBanner, null)
    assert.strictEqual(classAllNull.gauges.length, 8, 'Valid 8-null classroom state must keep 8 cards')
    assert(classAllNull.gauges.every((g) => g.badge === 'No data yet' && g.rateNull === 'No decisions uploaded'))

    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_CLASSROOM_ANALYTICS__', ${JSON.stringify(
        JSON.stringify({
          c1: {
            ...baseClassroomMetrics,
            category_fail_rates: { ...allNullFailRates, Phishing: 0.1, FutureUnknownThreat: 0.9 },
          },
        }),
      )});
    `)
    await reloadPage()
    await waitForSelector('.threat-matrix-section .threat-card')
    const classExtraKey = await inspectClassroomAnalytics()
    assert.strictEqual(classExtraKey.scopedUnavailableBanner, null, 'Extra unknown classroom key must be ignored')
    assert.strictEqual(classExtraKey.gauges.length, 8)
    assert.strictEqual(classExtraKey.gauges.find((g) => g.name === 'Phishing')?.rateNumber, '10.0%')

    // Test Malformed classroom category_fail_rates keeps valid scores, KPIs, and roster visible
    const malformedClassroomCases = [
      { label: 'missing-fail-rates', payload: baseClassroomMetrics },
      {
        label: 'missing-key',
        payload: {
          ...baseClassroomMetrics,
          category_fail_rates: Object.fromEntries(Object.entries(allNullFailRates).filter(([k]) => k !== 'Ransomware')),
        },
      },
      {
        label: 'string-rate',
        payload: { ...baseClassroomMetrics, category_fail_rates: { ...allNullFailRates, Phishing: '0.25' } },
      },
      {
        label: 'negative-rate',
        payload: { ...baseClassroomMetrics, category_fail_rates: { ...allNullFailRates, Phishing: -0.1 } },
      },
      {
        label: 'over-one-rate',
        payload: { ...baseClassroomMetrics, category_fail_rates: { ...allNullFailRates, Phishing: 1.2 } },
      },
      {
        label: 'array-rates',
        payload: { ...baseClassroomMetrics, category_fail_rates: [] },
      },
    ]

    for (const tc of malformedClassroomCases) {
      await pageCdp.evaluate(`
        sessionStorage.setItem('__CYBERMORPH_OVERRIDE_CLASSROOM_ANALYTICS__', ${JSON.stringify(
          JSON.stringify({ c1: tc.payload }),
        )});
      `)
      await reloadPage()
      await waitForSelector('.threat-matrix-section .scoped-unavailable-banner')
      await waitForSelector('.data-table .threat-count-badge')
      const badState = await inspectClassroomAnalytics()
      assert.strictEqual(badState.gauges.length, 0, `${tc.label}: must hide mislabeled gauges`)
      assert(badState.scopedUnavailableBanner.includes('unavailable'), `${tc.label}: must show scoped unavailable banner`)
      assert.strictEqual(badState.kpis[0], '23', `${tc.label}: enrolled count KPI must remain visible`)
      assert.strictEqual(badState.mapPills.find((m) => m.name === 'Home:')?.val, '723 pts', `${tc.label}: valid Home score must remain visible`)
      assert(badState.rosterRows > 0, `${tc.label}: Level 2 student roster must remain visible`)
    }
    await pageCdp.evaluate(`sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_CLASSROOM_ANALYTICS__')`)
    await reloadPage()
    await waitForSelector('.data-table .threat-count-badge')

    const analyticsRosterHeaders = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.data-table th')).map(th => th.textContent.trim())
    `)
    console.log('Analytics roster table headers:', analyticsRosterHeaders)
    assert(analyticsRosterHeaders.includes('Threat index'), 'EducatorAnalyticsView must include "Threat index" header')

    const analyticsThreatBadges = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.data-table .threat-count-badge')).map(b => b.textContent.trim())
    `)
    console.log(`Analytics threat badges (${analyticsThreatBadges.length} rows):`, analyticsThreatBadges.slice(0, 3))
    assert(analyticsThreatBadges.length > 0, 'Analytics roster must render threat badges')

    // 3. Verify Student Progress View (/classroom/students/c1/progress/p1)
    console.log(`Navigating to /classroom/students/c1/progress/p1 (synced student)...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p1` })
    await waitForThreatSection()

    const mapTiles = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.map-card')).map(card => ({
        name: card.querySelector('.map-name')?.textContent.trim(),
        badge: card.querySelector('.status-badge')?.textContent.trim(),
        isUnlocked: card.classList.contains('is-unlocked')
      }))
    `)
    console.log(`Map progression tiles count: ${mapTiles.length}`)
    assert.strictEqual(mapTiles.length, 4, 'Must render exactly 4 map tiles')
    console.log('Map tiles:', mapTiles)
    assert(mapTiles[0].isUnlocked, 'Home map must be unlocked')
    assert(mapTiles[1].isUnlocked, 'Office map must be unlocked for map_progress = 2')
    assert(mapTiles[2].isUnlocked, 'Internet Cafe must be unlocked for map_progress = 2')
    assert(!mapTiles[3].isUnlocked, 'Public Park must be locked for map_progress = 2')

    const threatTiles = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.threat-card')).map(card => ({
        name: card.querySelector('.threat-name')?.textContent.trim(),
        badge: card.querySelector('.status-badge')?.textContent.trim(),
        isUnlocked: card.classList.contains('is-unlocked')
      }))
    `)
    console.log(`Threat index tiles count: ${threatTiles.length}`)
    assert.strictEqual(threatTiles.length, 8, 'Must render exactly 8 threat index tiles')
    console.log('Threat tiles sample:', threatTiles.slice(0, 2))
    assert.strictEqual(threatTiles[0].name, 'Phishing')
    assert.strictEqual(threatTiles[4].name, 'Credential Theft')

    await waitForThreatSection()
    const p1Breakdown = await inspectThreatRatesSection()
    console.log('p1 breakdown state:', p1Breakdown)
    assert.strictEqual(p1Breakdown.emptyNote, null, 'p1 with numeric rates must not show empty note')
    assert.strictEqual(p1Breakdown.unavailableBanner, null, 'p1 valid breakdown must not show unavailable banner')
    assert.strictEqual(p1Breakdown.rows.length, 8, 'p1 must render all 8 canonical rows')
    assert.strictEqual(
      p1Breakdown.rows.find((r) => r.name === 'Phishing')?.rate,
      '10%',
      'p1 Phishing error rate must be 10%',
    )
    assert.strictEqual(
      p1Breakdown.rows.find((r) => r.name === 'Social Engineering')?.rate,
      '0%',
      'p1 Social Engineering measured 0 must render 0%',
    )
    assert.strictEqual(
      p1Breakdown.rows.find((r) => r.name === 'Public Wi-Fi Attack')?.rate,
      'No data yet',
      'p1 null rate must keep No data yet inside 8-row table',
    )

    // 3b. Verify Session Telemetry Modal & Finishing Credits
    console.log('Testing session telemetry modal - Session 1 (positive credits: 45)...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[0].click()`)
    await waitForModalReady()

    const modalSummary1 = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.modal-dialog .summary-col')).map(c => ({
        label: c.querySelector('.summary-label')?.textContent.trim(),
        val: c.querySelector('.summary-val')?.textContent.trim()
      }))
    `)
    console.log('Modal summary 1:', modalSummary1)
    const fc1 = modalSummary1.find(c => c.label === 'FINISHING CREDITS' || c.label === 'Finishing credits')
    assert(fc1, 'Modal must include "Finishing credits" item')
    assert.strictEqual(fc1.val, '45', 'Session 1 finishing credits must be 45')

    // Close modal
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .modal-close-btn').click()`)
    await waitForModalClosed()

    // Open Session 2 (zero credits: 0, empty events)
    console.log('Testing session telemetry modal - Session 2 (0 credits, empty events)...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[1].click()`)
    await waitForModalReady()

    const modalSummary2 = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.modal-dialog .summary-col')).map(c => ({
        label: c.querySelector('.summary-label')?.textContent.trim(),
        val: c.querySelector('.summary-val')?.textContent.trim()
      }))
    `)
    console.log('Modal summary 2:', modalSummary2)
    const fc2 = modalSummary2.find(c => c.label === 'FINISHING CREDITS' || c.label === 'Finishing credits')
    assert.strictEqual(fc2.val, '0', 'Session 2 finishing credits must be 0 (no stale value)')

    const emptyEventsNote = await pageCdp.evaluate(`
      document.querySelector('.modal-dialog .telemetry-pending-banner')?.textContent.trim()
    `)
    assert(emptyEventsNote && emptyEventsNote.includes('No individual threat events recorded'), 'Empty events note must render while summary remains visible')

    // Close modal
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .modal-close-btn').click()`)
    await waitForModalClosed()

    // Open Session 3 (null credits -> "Not recorded")
    console.log('Testing session telemetry modal - Session 3 (null credits -> "Not recorded")...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[2].click()`)
    await waitForModalReady()

    const modalSummary3 = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.modal-dialog .summary-col')).map(c => ({
        label: c.querySelector('.summary-label')?.textContent.trim(),
        val: c.querySelector('.summary-val')?.textContent.trim()
      }))
    `)
    console.log('Modal summary 3:', modalSummary3)
    const fc3 = modalSummary3.find(c => c.label === 'FINISHING CREDITS' || c.label === 'Finishing credits')
    assert.strictEqual(fc3.val, 'Not recorded', 'Session 3 with null credits must show "Not recorded"')

    // Close modal
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .modal-close-btn').click()`)
    await waitForModalClosed()
    console.log(`Navigating to /classroom/students/c1/progress/p23 (never-synced student)...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p23` })
    await waitForThreatSection()

    const neverSyncedNote = await pageCdp.evaluate(`
      document.querySelector('.threat-sync-note')?.textContent.trim()
    `)
    console.log('Never-synced notice:', neverSyncedNote)
    assert(neverSyncedNote && neverSyncedNote.includes('has not synced gameplay progress yet'), 'Never-synced student must display informational note')

    const neverSyncedThreatBadges = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.threat-card .status-badge')).map(b => b.textContent.trim())
    `)
    assert.strictEqual(neverSyncedThreatBadges.length, 8)
    assert(neverSyncedThreatBadges.every(b => b === 'Locked'), 'All threats must be locked for never-synced student')

    const summaryCount = await pageCdp.evaluate(`
      document.querySelector('section[aria-label="Threat index unlocks"] .summary-count-badge')?.textContent.trim()
    `)
    console.log('Never-synced summary count badge:', summaryCount)
    assert.strictEqual(summaryCount, 'Not synced yet', 'Never-synced student must show "Not synced yet" instead of "0 of 8"')

    await waitForThreatSection()
    const p23Breakdown = await inspectThreatRatesSection()
    console.log('p23 (never-synced) breakdown state:', p23Breakdown)
    assert.strictEqual(
      p23Breakdown.emptyNote,
      'No decision data yet. Error rates appear after the game uploads decisions.',
      'Never-synced 8-null breakdown must display single empty-state message',
    )
    assert.strictEqual(p23Breakdown.rows.length, 0, 'All-null empty state must hide repeated 8-row table')
    assert.strictEqual(p23Breakdown.unavailableBanner, null, 'Valid 8-null empty state must not show unavailable banner')

    // 4. Synced student with uploaded session & 8 valid null rates (p15)
    console.log('Navigating to /classroom/students/c1/progress/p15 (uploaded session + 8 null rates)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p15` })
    await waitForThreatSection()

    const p15SessionsCount = await pageCdp.evaluate(`
      ({
        uploaded: document.querySelectorAll('.kpi-card .kpi-value')[0]?.textContent.trim(),
        rows: document.querySelectorAll('.sessions-table tbody tr').length,
      })
    `)
    assert.strictEqual(p15SessionsCount.uploaded, '1', 'p15 must show 1 uploaded session')
    assert.strictEqual(p15SessionsCount.rows, 1, 'p15 must render 1 recent session row')

    const p15Breakdown = await inspectThreatRatesSection()
    console.log('p15 (session uploaded, 8 null rates) breakdown state:', p15Breakdown)
    assert.strictEqual(
      p15Breakdown.emptyNote,
      'No decision data yet. Error rates appear after the game uploads decisions.',
      'Synced student with uploaded session and 8 null rates must display single empty-state message',
    )
    assert.strictEqual(p15Breakdown.rows.length, 0, 'p15 all-null state must hide repeated 8-row table')
    assert.strictEqual(p15Breakdown.unavailableBanner, null, 'p15 valid 8-null state must not show unavailable banner')

    // Confirm p15 session has empty threat_events in modal
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[0].click()`)
    await waitForModalReady()
    const p15EmptyModal = await pageCdp.evaluate(`
      document.querySelector('.modal-dialog .telemetry-pending-banner')?.textContent.trim()
    `)
    assert(
      p15EmptyModal && p15EmptyModal.includes('No individual threat events recorded'),
      'p15 session modal must confirm empty threat_events',
    )
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .modal-close-btn').click()`)
    await waitForModalClosed()

    // 5. Measured zero student (p8: Phishing = 0.0 + 7 nulls -> keep all 8 rows)
    console.log('Navigating to /classroom/students/c1/progress/p8 (measured 0 + 7 nulls)...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p8` })
    await waitForThreatSection()
    const p8Breakdown = await inspectThreatRatesSection()
    console.log('p8 (measured 0.0) breakdown state:', p8Breakdown)
    assert.strictEqual(p8Breakdown.emptyNote, null, 'p8 with measured 0.0 must not show empty note')
    assert.strictEqual(p8Breakdown.unavailableBanner, null, 'p8 valid breakdown must not show unavailable banner')
    assert.strictEqual(p8Breakdown.rows.length, 8, 'p8 must keep all 8 rows when >= 1 rate is available')
    assert.strictEqual(
      p8Breakdown.rows.find((r) => r.name === 'Phishing')?.rate,
      '0%',
      'Measured 0.0 rate must render as 0%',
    )
    assert.strictEqual(
      p8Breakdown.rows.filter((r) => r.rate === 'No data yet').length,
      7,
      'Remaining 7 null categories must still render No data yet',
    )

    // 6. Extra unknown key ignored & valid 8 canonical keys render table
    console.log('Testing extra unknown key tolerance on p1...')
    const baseValidBreakdown = {
      Phishing: 0.1,
      Smishing: null,
      Vishing: null,
      'Social Engineering': 0,
      'Credential Theft': null,
      'Public Wi-Fi Attack': null,
      'Malware Infection': null,
      Ransomware: null,
    }
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS__', ${JSON.stringify(
        JSON.stringify({
          p1: {
            category_breakdown: {
              ...baseValidBreakdown,
              FutureUnknownThreat: 0.42,
            },
          },
        }),
      )});
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p1` })
    await waitForPath('/classroom/students/c1/progress/p1')
    await waitForThreatSection()
    await reloadPage()
    await waitForThreatSection()
    const extraKeyBreakdown = await inspectThreatRatesSection()
    console.log('Extra unknown key breakdown state:', extraKeyBreakdown)
    assert.strictEqual(extraKeyBreakdown.emptyNote, null, 'Extra unknown key with valid rate must not show empty note')
    assert.strictEqual(extraKeyBreakdown.unavailableBanner, null, 'Extra unknown key must be ignored')
    assert.strictEqual(extraKeyBreakdown.rows.length, 8, 'Must still render all 8 canonical rows')
    assert.strictEqual(extraKeyBreakdown.rows.find((r) => r.name === 'Social Engineering')?.rate, '0%')

    // 7. Malformed & missing JSON payloads stay distinct from valid empty state
    const malformedCases = [
      {
        label: 'missing-category_breakdown',
        override: { p1: { wins: 2, losses: 1 } },
      },
      {
        label: 'missing-canonical-key',
        override: {
          p1: {
            category_breakdown: Object.fromEntries(
              Object.entries(baseValidBreakdown).filter(([k]) => k !== 'Ransomware'),
            ),
          },
        },
      },
      {
        label: 'string-rate',
        override: {
          p1: {
            category_breakdown: { ...baseValidBreakdown, Phishing: '0.25' },
          },
        },
      },
      {
        label: 'negative-rate',
        override: {
          p1: {
            category_breakdown: { ...baseValidBreakdown, Phishing: -0.1 },
          },
        },
      },
      {
        label: 'over-one-rate',
        override: {
          p1: {
            category_breakdown: { ...baseValidBreakdown, Phishing: 1.25 },
          },
        },
      },
      {
        label: 'array-breakdown',
        override: {
          p1: {
            category_breakdown: [],
          },
        },
      },
    ]

    for (const testCase of malformedCases) {
      console.log(`Testing malformed JSON case: ${testCase.label}...`)
      const overrideWithSession = {
        p1: {
          recent_sessions: [
            {
              session_id: 's-mal-1',
              map_name: 'Office',
              result: 'WIN',
              duration_seconds: 90,
              played_at: '2026-10-28T08:00:00Z',
            },
          ],
          ...testCase.override.p1,
        },
      }
      await pageCdp.evaluate(`
        sessionStorage.setItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS__', ${JSON.stringify(
          JSON.stringify(overrideWithSession),
        )});
      `)
      await reloadPage()
      await waitForThreatSection()
      const state = await inspectThreatRatesSection()
      assert.strictEqual(state.emptyNote, null, `${testCase.label}: must not render empty-state copy`)
      assert.strictEqual(state.rows.length, 0, `${testCase.label}: must not render rows or fake 0%`)
      assert(
        state.unavailableBanner && state.unavailableBanner.includes('unavailable'),
        `${testCase.label}: must render distinct unavailable banner`,
      )
      const studentIsolation = await pageCdp.evaluate(`({
        scores: document.querySelectorAll('.map-score-pill .map-pill-value').length,
        sessions: document.querySelectorAll('.sessions-table tbody tr').length,
        threats: document.querySelectorAll('.threat-card').length,
      })`)
      assert(studentIsolation.scores > 0, `${testCase.label}: student map scores must remain visible`)
      assert.strictEqual(studentIsolation.sessions, 1, `${testCase.label}: student recent sessions must remain visible`)
      assert.strictEqual(studentIsolation.threats, 8, `${testCase.label}: student threat index must remain visible`)
    }

    await pageCdp.evaluate(`sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_PLAYER_ANALYTICS__')`)
  }

  assert.strictEqual(
    vueWarnings.length,
    0,
    `Expected zero Vue runtime prop/lifecycle warnings, got: ${JSON.stringify(vueWarnings)}`,
  )
  assert.strictEqual(
    pageExceptions.length,
    0,
    `Expected zero uncaught runtime page exceptions, got: ${JSON.stringify(pageExceptions)}`,
  )
  console.log('✓ Zero Vue warnings and zero uncaught runtime exceptions verified via CDP Runtime events')

  } catch (err) {
    console.error('\n❌ Verification failed:', err)
    process.exitCode = 1
  } finally {
    console.log('\nCleaning up processes...')
    if (pageCdp) await pageCdp.close().catch(() => {})
    if (cdp) await cdp.close().catch(() => {})
    if (chromeProcess) {
      try {
        if (isWindows && chromeProcess.pid) {
          spawn('taskkill', ['/pid', String(chromeProcess.pid), '/T', '/F'])
        } else {
          chromeProcess.kill()
        }
      } catch {
        /* ignore */
      }
    }
    if (viteProcess) {
      try {
        if (isWindows && viteProcess.pid) {
          spawn('taskkill', ['/pid', String(viteProcess.pid), '/T', '/F'])
        } else {
          viteProcess.kill()
        }
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

run()
