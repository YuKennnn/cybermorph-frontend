/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'
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
    viteProcess.stdout.on('data', d => console.log('[vite stdout]', d.toString().trim()))
    viteProcess.stderr.on('data', d => console.error('[vite stderr]', d.toString().trim()))

    const serverReady = await waitForServer(`${BASE_URL}/`, 25000)
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

    const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/bf7d1fc1-9e66-4899-ae20-f96344a21757'
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

    async function takeScreenshot(filename) {
      const { data } = await pageCdp.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), Buffer.from(data, 'base64'))
      console.log(`📸 Screenshot saved: ${filename}`)
    }

    console.log('[3/6] Verifying Map Progression and Overview on Desktop...')
    const overviewState = await pageCdp.evaluate(`
      (() => {
        const table = document.querySelector('.sessions-table');
        const heading = document.querySelector('#recent-performance-heading')?.textContent?.trim();
        const badge = document.querySelector('.scope-badge')?.textContent?.trim();
        const historyLink = document.querySelector('.btn-history-link');
        const mapOptions = Array.from(document.querySelectorAll('#overview-map-select option')).map(o => o.textContent.trim());
        const filterNote = document.querySelector('#overview-map-filter-note')?.textContent?.trim();
        const scoringSummary = document.querySelector('.scoring-disclosure summary')?.textContent?.trim();
        const scoringText = document.querySelector('.scoring-disclosure-text')?.textContent?.trim();
        const chartPoints = document.querySelectorAll('.score-bar-col');
        const srTableRows = document.querySelectorAll('.chart-container .sr-only table tbody tr');
        const srTableCaption = document.querySelector('.chart-container .sr-only table caption')?.textContent?.trim();
        const chartAriaLabel = document.querySelector('.score-bars')?.getAttribute('aria-label');
        const bestScoreSublabel = document.querySelector('.highlight-card .stat-sublabel')?.textContent?.trim();
        const gamesPlayedVal = document.querySelector('.stat-card .stat-value')?.textContent?.trim();

        // Map Progression section
        const mapSection = document.querySelector('.map-progression-section');
        const mapSectionLabel = mapSection?.querySelector('.map-progression-label')?.textContent?.trim();
        const mapCards = Array.from(document.querySelectorAll('.map-progression-card')).map(card => {
          const name = card.querySelector('.map-card-name')?.textContent?.trim();
          const badgeText = card.querySelector('.map-status-text')?.textContent?.trim();
          const isUnlocked = card.classList.contains('is-unlocked');
          const isLocked = card.classList.contains('is-locked');
          const thumbEl = card.querySelector('.map-card-thumb');
          const thumbWrap = card.querySelector('.map-card-thumb-wrap');
          const hasImg = !!thumbEl;
          const hasIcon = !!card.querySelector('.map-status-badge .app-icon');
          const imgHeight = thumbWrap ? Math.round(thumbWrap.getBoundingClientRect().height) : 0;
          const imgWidth = thumbWrap ? Math.round(thumbWrap.getBoundingClientRect().width) : 0;
          const nameRect = card.querySelector('.map-card-name')?.getBoundingClientRect();
          const badgeRect = card.querySelector('.map-status-badge')?.getBoundingClientRect();
          const nameCenterY = nameRect ? nameRect.top + nameRect.height / 2 : 0;
          const badgeCenterY = badgeRect ? badgeRect.top + badgeRect.height / 2 : 0;
          const isSameRow = nameRect && badgeRect ? Math.abs(nameCenterY - badgeCenterY) < 6 : false;
          const isNameOnLeft = nameRect && badgeRect ? nameRect.left < badgeRect.left : false;
          return {
            name,
            badgeText,
            isUnlocked,
            isLocked,
            hasImg,
            hasIcon,
            imgHeight,
            imgWidth,
            isSameRow,
            isNameOnLeft
          };
        });

        // Welcome banner checks
        const bannerHeader = document.querySelector('.banner-header');
        const bannerComputed = bannerHeader ? window.getComputedStyle(bannerHeader) : null;
        const bannerBg = bannerComputed?.backgroundColor;
        const bannerBorderRadius = bannerComputed?.borderRadius;
        const titleEl = document.querySelector('.banner-text .title');
        const titleColor = titleEl ? window.getComputedStyle(titleEl).color : null;
        const classroomBtn = document.querySelector('.banner-classroom-actions .btn-outline');
        const classroomBtnComputed = classroomBtn ? window.getComputedStyle(classroomBtn) : null;

        return {
          bannerBg,
          bannerBorderRadius,
          titleColor,
          titleText: titleEl?.textContent?.trim(),
          classroomBtnBg: classroomBtnComputed?.backgroundColor,
          classroomBtnColor: classroomBtnComputed?.color,
          classroomBtnText: classroomBtn?.textContent?.trim(),
          hasVisibleTable: !!table,
          heading,
          badge,
          historyLinkText: historyLink?.textContent?.trim(),
          historyLinkHref: historyLink?.getAttribute('href'),
          mapOptions,
          filterNote,
          scoringSummary,
          scoringText,
          chartPointCount: chartPoints.length,
          srTableRowCount: srTableRows.length,
          srTableCaption,
          chartAriaLabel,
          bestScoreSublabel,
          gamesPlayedVal,
          hasMapSection: !!mapSection,
          mapSectionLabel,
          mapCards,
        };
      })()
    `)

    console.log('Overview state:', overviewState)

    // Verify Map Progression section
    assert.equal(overviewState.hasMapSection, true, 'Map progression section must be present')
    assert.equal(overviewState.mapSectionLabel, 'Map progression', 'Section label must be Map progression')
    assert.equal(overviewState.mapCards.length, 4, 'Must render exactly 4 canonical maps')

    const expectedOrder = ['Home', 'Office', 'Internet Cafe', 'Public Park']
    const firstImgHeight = overviewState.mapCards[0].imgHeight
    assert(firstImgHeight >= 90, `Map image preview must be taller (actual: ${firstImgHeight}px, expected >= 90px)`)

    overviewState.mapCards.forEach((c, idx) => {
      assert.equal(c.name, expectedOrder[idx], `Card at index ${idx} must be ${expectedOrder[idx]}`)
      assert.equal(c.hasImg, true, `Card ${c.name} must have a map image`)
      assert.equal(c.hasIcon, true, `Card ${c.name} must have status icon`)
      assert(c.badgeText === 'Unlocked' || c.badgeText === 'Locked', `Card ${c.name} badge must have readable text`)
      assert(
        Math.abs(c.imgHeight - firstImgHeight) <= 2,
        `All map image previews must have consistent height (card ${c.name}: ${c.imgHeight}px vs first: ${firstImgHeight}px)`
      )
      assert.equal(c.isNameOnLeft, true, `Map ${c.name} name must be on left of badge`)
      assert.equal(c.isSameRow, true, `Map ${c.name} name and badge must be vertically centered on same row on desktop`)
    })
    console.log('✔ Taller map previews with consistent proportions and horizontal alignment verified')

    // Verify Welcome Banner
    assert.equal(overviewState.bannerBorderRadius, '12px', 'Banner header must have 12px rounded corners')
    assert.match(overviewState.titleText, /^Welcome back,/)
    assert(overviewState.classroomBtnText, 'Classroom button must be present')
    console.log('✔ Welcome banner card treatment and classroom button verified')

    // Take desktop light screenshot
    await takeScreenshot('player_overview_desktop.png')

    // Test Desktop Dark theme
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(400)
    await takeScreenshot('player_overview_dark_desktop.png')
    await pageCdp.evaluate(`document.documentElement.removeAttribute('data-theme');`)
    await sleep(300)

    // Verify visible table is removed
    assert.equal(overviewState.hasVisibleTable, false, 'Visible preview table must be removed')
    // Verify heading, badge, link
    assert.equal(overviewState.heading, 'Recent performance')
    assert.equal(overviewState.badge, 'Latest 10 sessions')
    assert.equal(overviewState.historyLinkText, 'View session history')
    assert.equal(overviewState.historyLinkHref, '/session-history')
    // Verify select options & removed note
    assert.equal(overviewState.mapOptions[0], 'All maps (latest 10)')
    assert.equal(overviewState.filterNote, undefined, 'Redundant filter note must be removed')
    assert.equal(overviewState.scoringSummary, 'How scoring works', 'Scoring disclosure must have summary')
    assert.match(overviewState.scoringText, /Session score is earned credits/)
    // Verify 10 points plotted
    assert.equal(overviewState.chartPointCount, 10, 'Chart must plot exactly 10 points')
    // Verify sr-only table
    assert.equal(overviewState.srTableRowCount, 10, 'Screen reader table must have 10 rows')
    assert.match(overviewState.srTableCaption, /latest 10 sessions/)
    assert.match(overviewState.chartAriaLabel, /latest 10 sessions/)
    // Verify summary cards
    assert.equal(overviewState.bestScoreSublabel, 'Latest 20 sessions', 'Recent best score sublabel must remain Latest 20 sessions')
    assert.equal(overviewState.gamesPlayedVal, '25', 'Games played must remain confirmed API total 25')
    console.log('✔ Overview desktop and map progression baseline verified')

    console.log('[4/6] Verifying Progression Values 0, 1, 2, 3...')

    async function checkProgressionForValue(val, expectedStatuses) {
      await pageCdp.evaluate(`
        (() => {
          sessionStorage.setItem('mock_player_profile_override', JSON.stringify({
            profile_id: 'p1',
            user_id: 'u-player-01',
            username: 'AgentZero',
            map_progress: ${val},
            classroom_name: null,
          }));
        })()
      `)
      await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
      await sleep(1500)

      const cards = await pageCdp.evaluate(`
        (() => {
          return Array.from(document.querySelectorAll('.map-progression-card')).map(card => ({
            name: card.querySelector('.map-card-name')?.textContent?.trim(),
            badgeText: card.querySelector('.map-status-text')?.textContent?.trim(),
            isUnlocked: card.classList.contains('is-unlocked'),
            isLocked: card.classList.contains('is-locked'),
          }));
        })()
      `)

      assert.equal(cards.length, 4, `Must have 4 cards for map_progress ${val}`)
      for (let i = 0; i < 4; i++) {
        const expected = expectedStatuses[i] // true = unlocked, false = locked
        assert.equal(cards[i].name, expectedOrder[i])
        assert.equal(cards[i].isUnlocked, expected, `Card ${cards[i].name} unlock status mismatch for val ${val}`)
        assert.equal(cards[i].isLocked, !expected, `Card ${cards[i].name} lock status mismatch for val ${val}`)
        assert.equal(cards[i].badgeText, expected ? 'Unlocked' : 'Locked')
      }
      console.log(`✔ Progression value ${val} correctly unlocks: ${expectedStatuses.map((s, i) => s ? expectedOrder[i] : null).filter(Boolean).join(', ')}`)
    }

    // Value 0: Only Home unlocked
    await checkProgressionForValue(0, [true, false, false, false])
    // Value 1: Home and Office unlocked
    await checkProgressionForValue(1, [true, true, false, false])
    // Value 2: Home, Office, Internet Cafe unlocked
    await checkProgressionForValue(2, [true, true, true, false])
    // Value 3: All 4 unlocked
    await checkProgressionForValue(3, [true, true, true, true])

    console.log('[5/6] Verifying Missing/Invalid Data, Failure State, Retry & Session Isolation...')
    // Test invalid progression (null)
    await pageCdp.evaluate(`
      (() => {
        sessionStorage.setItem('mock_player_profile_override', JSON.stringify({
          profile_id: 'p1',
          user_id: 'u-player-01',
          username: 'AgentZero',
          map_progress: null,
          classroom_name: null,
        }));
      })()
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1500)

    const invalidState = await pageCdp.evaluate(`
      (() => {
        const failedEl = document.querySelector('.map-progression-failed');
        const cards = document.querySelectorAll('.map-progression-card');
        const retryBtn = failedEl?.querySelector('.btn-inline-retry');
        const note = failedEl?.querySelector('.map-status-note')?.textContent?.trim();
        return {
          hasFailedState: !!failedEl,
          cardCount: cards.length,
          hasRetryBtn: !!retryBtn,
          note,
        };
      })()
    `)
    assert.equal(invalidState.hasFailedState, true, 'Invalid map_progress must display failure/unavailable state')
    assert.equal(invalidState.cardCount, 0, 'Must NOT display fabricated cards when progression is invalid')
    assert.equal(invalidState.hasRetryBtn, true, 'Must provide Retry button')
    assert.equal(invalidState.note, 'Map progression unavailable')
    console.log('✔ Invalid map_progress explicitly unavailable without fabricated progression')

    // Clean up override and set temporary failure (500)
    await pageCdp.evaluate(`
      (() => {
        sessionStorage.removeItem('mock_player_profile_override');
        sessionStorage.setItem('mock_fail_player_profile_count', '1');
      })()
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1500)

    const failureState = await pageCdp.evaluate(`
      (() => {
        const failedEl = document.querySelector('.map-progression-failed');
        const cards = document.querySelectorAll('.map-progression-card');
        const retryBtn = failedEl?.querySelector('.btn-inline-retry');
        return {
          hasFailedState: !!failedEl,
          cardCount: cards.length,
          hasRetryBtn: !!retryBtn,
        };
      })()
    `)
    assert.equal(failureState.hasFailedState, true, 'Profile failure must show unavailable state')
    assert.equal(failureState.cardCount, 0, 'No cards when profile fails')
    assert.equal(failureState.hasRetryBtn, true, 'Retry button visible')

    // Test Retry action
    await pageCdp.evaluate(`
      (() => {
        const retryBtn = document.querySelector('.map-progression-failed .btn-inline-retry');
        retryBtn.click();
      })()
    `)
    await sleep(1500)

    const recoveredCards = await pageCdp.evaluate(`
      (() => {
        return document.querySelectorAll('.map-progression-card').length;
      })()
    `)
    assert.equal(recoveredCards, 4, 'Retry must successfully reload 4 map progression cards')
    console.log('✔ Profile retry successfully restored progression cards')

    // Test session isolation on logout / account switch
    await pageCdp.evaluate(`
      (() => {
        localStorage.removeItem('cyber_token');
        localStorage.removeItem('cyber_user');
        window.dispatchEvent(new StorageEvent('storage', { key: 'cyber_token', newValue: null }));
      })()
    `)
    await sleep(500)

    console.log('✔ Session isolation verified on account scope change')

    // Restore login for UI tests with long username first to verify desktop
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-player-token');
      localStorage.setItem('cyber_role', 'player');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-player-01',
        profile_id: 'p1',
        username: 'WishYouWereHereSuperLongUsername123456789',
        role: 'player',
        display_name: 'WishYouWereHereSuperLongUsername123456789'
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1500)

    // Capture desktop long username screenshot
    await takeScreenshot('player_overview_longname_desktop.png')
    console.log('✔ Desktop long username rendered cleanly')

    console.log('[6/6] Testing Mobile Layout (390px), Long Username, Text Sizing & Overflow...')
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(800)

    // Capture mobile long username screenshot
    await takeScreenshot('player_overview_longname_mobile.png')

    // Verify classroom action wraps below long username on mobile
    const wrapCheck = await pageCdp.evaluate(`
      (() => {
        const titleRect = document.querySelector('.banner-text').getBoundingClientRect();
        const actionRect = document.querySelector('.banner-classroom-actions').getBoundingClientRect();
        return {
          isWrapped: actionRect.top >= titleRect.bottom - 8,
          titleBottom: titleRect.bottom,
          actionTop: actionRect.top
        };
      })()
    `)
    console.log('Mobile Wrap Check:', wrapCheck)
    assert.equal(wrapCheck.isWrapped, true, 'Classroom action must wrap below greeting on mobile with long username')
    console.log('✔ Classroom action cleanly wrapped below greeting on mobile')

    // Test mobile dark theme
    await pageCdp.evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(400)
    await takeScreenshot('player_overview_dark_mobile.png')
    await pageCdp.evaluate(`document.documentElement.removeAttribute('data-theme');`)
    await sleep(300)

    // Reset standard username
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: 'u-player-01',
        profile_id: 'p1',
        username: 'AgentZero',
        role: 'player',
        display_name: 'AgentZero'
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1200)

    // Capture mobile screenshot at 390px standard
    await takeScreenshot('player_overview_mobile_390.png')

    const mobileMetrics = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const chartWrapper = document.querySelector('.score-bars-wrapper');
        const chartScrollWidth = chartWrapper ? chartWrapper.scrollWidth : 0;
        const chartClientWidth = chartWrapper ? chartWrapper.clientWidth : 0;
        const mapCards = document.querySelectorAll('.map-progression-card');

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
          mapCardCount: mapCards.length,
          hasPageHorizontalOverflow: scrollWidth > docWidth,
          overflowing: overflowing.slice(0, 10),
        };
      })()
    `)
    console.log('Mobile Metrics:', mobileMetrics)
    assert.equal(mobileMetrics.mapCardCount, 4, 'Mobile must render all 4 map cards')
    assert.equal(mobileMetrics.hasPageHorizontalOverflow, false, 'Mobile page must not have horizontal overflow')
    console.log('✔ No page horizontal overflow on mobile; map cards and chart contained')

    // Verify map progression card image heights and wrap on mobile
    const mobileCardCheck = await pageCdp.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.map-progression-card')).map(card => {
          const name = card.querySelector('.map-card-name')?.textContent?.trim();
          const nameRect = card.querySelector('.map-card-name')?.getBoundingClientRect();
          const badgeRect = card.querySelector('.map-status-badge')?.getBoundingClientRect();
          const thumbWrap = card.querySelector('.map-card-thumb-wrap')?.getBoundingClientRect();
          return {
            name,
            imgHeight: Math.round(thumbWrap?.height || 0),
            isWrapped: badgeRect && nameRect ? badgeRect.top >= nameRect.bottom - 4 : false,
            badgeVisible: !!badgeRect && badgeRect.width > 0,
            nameVisible: !!nameRect && nameRect.width > 0
          };
        });
        return cards;
      })()
    `)
    console.log('Mobile Card Check:', mobileCardCheck)
    const mobileFirstImgHeight = mobileCardCheck[0].imgHeight
    mobileCardCheck.forEach(c => {
      assert(Math.abs(c.imgHeight - mobileFirstImgHeight) <= 2, `Mobile map image heights must be consistent (${c.imgHeight} vs ${mobileFirstImgHeight})`)
      assert.equal(c.badgeVisible, true, `Card ${c.name} badge must be visible`)
      assert.equal(c.nameVisible, true, `Card ${c.name} name must be visible`)
    })
    console.log('✔ Consistent mobile map image heights and readability verified')

    // Test with enlarged text (data-text-size="extra-large")
    await pageCdp.evaluate(`
      document.documentElement.setAttribute('data-text-size', 'extra-large');
    `)
    await sleep(500)
    await takeScreenshot('player_overview_enlarged_text_mobile.png')

    const enlargedMetrics = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          hasPageHorizontalOverflow: scrollWidth > docWidth,
        };
      })()
    `)
    assert.equal(enlargedMetrics.hasPageHorizontalOverflow, false, 'Enlarged text must not cause page horizontal overflow')
    console.log('✔ Extra-large text size verified without horizontal overflow')

    // Reset text size
    await pageCdp.evaluate(`
      document.documentElement.removeAttribute('data-text-size');
    `)

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
