/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5199
const CDP_PORT = 9249
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-admin-overview-cdp-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/e915d42a-bc70-4315-86d7-18b50753d36f'

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

async function run() {
  let viteProc = null
  let chromeProc = null

  try {
    console.log('[1/7] Starting Vite test server on port', TEST_PORT)
    viteProc = spawn(
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
    console.log('Server ready at', BASE_URL)

    console.log('[2/7] Launching Headless Chrome on CDP port', CDP_PORT)
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
        '--window-size=1440,900',
      ],
      { stdio: 'ignore' }
    )

    await sleep(1500)
    const browserWs = await getCDPWebSocketUrl(CDP_PORT)
    const cdp = new CDPClient(browserWs)
    await cdp.connect()

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const targetWs = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`
    const pageCdp = new CDPClient(targetWs)
    await pageCdp.connect()
    await pageCdp.send('Page.enable')
    await pageCdp.send('Runtime.enable')

    console.log('[3/7] Setting up Admin Session & Loading /dashboard...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/login` })
    await sleep(1000)
    await pageCdp.evaluate(`
      localStorage.setItem('cyber_token', 'mock-admin-token');
      localStorage.setItem('cyber_role', 'admin');
      localStorage.setItem('cyber_user', JSON.stringify({
        user_id: '00000000-0000-0000-0000-000000000001',
        username: 'admin',
        email: 'admin@cybermorph.local',
        role: 'admin'
      }));
    `)

    await pageCdp.setViewport(1440, 900)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1500)

    console.log('[4/7] Testing Initial Overview State (Desktop 1440px)...')
    const initialOverview = await pageCdp.evaluate(`
      (() => {
        const title = document.querySelector('.title')?.textContent?.trim();
        const subtitle = document.querySelector('.subtitle')?.textContent?.trim();
        const cards = Array.from(document.querySelectorAll('.stat-card')).map(card => ({
          value: card.querySelector('.stat-value')?.textContent?.trim(),
          label: card.querySelector('.stat-label')?.textContent?.trim(),
          help: card.querySelector('.stat-help')?.textContent?.trim(),
          isLink: card.tagName === 'A',
          hasAttention: card.classList.contains('has-attention'),
          href: card.getAttribute('href')
        }));

        const approvalsTile = document.querySelector('.action-tile.highlight-tile');
        const activitySection = document.querySelector('.content-section:last-of-type');
        const activityTitle = activitySection?.querySelector('.section-title')?.textContent?.trim();
        const viewAllLink = activitySection?.querySelector('.link-view-all');
        const rows = Array.from(activitySection?.querySelectorAll('.activity-row') || []).map(r => ({
          email: r.querySelector('.actor-email')?.textContent?.trim(),
          action: r.querySelector('.action-badge')?.textContent?.trim(),
          time: r.querySelector('.time-formatted')?.textContent?.trim(),
          timeStatus: r.querySelector('.time-status')?.textContent?.trim(),
        }));

        return {
          title,
          subtitle,
          cards,
          approvalsTileText: approvalsTile?.textContent?.trim(),
          activityTitle,
          hasViewAllLink: Boolean(viewAllLink),
          viewAllHref: viewAllLink?.getAttribute('href'),
          rowCount: rows.length,
          rows
        };
      })()
    `)
    console.log('Initial Overview:', JSON.stringify(initialOverview, null, 2))

    assert.equal(initialOverview.title, 'System administration')
    assert.match(initialOverview.subtitle, /Signed in as administrator:/)

    // Check Sessions received (24h)
    const sessionsCard = initialOverview.cards.find(c => c.label === 'Sessions received (24h)')
    assert(sessionsCard, 'Must have Sessions received (24h) card')
    assert.equal(sessionsCard.help, 'Offline sessions count when uploaded')
    assert.notEqual(sessionsCard.value, 'Unavailable')

    // Check Pending Educator Approvals card (count > 0 in default mock)
    const approvalsCard = initialOverview.cards.find(c => c.label === 'Pending educator approvals')
    assert(approvalsCard, 'Must have Pending educator approvals card')
    assert.equal(approvalsCard.isLink, true, 'Pending educator approvals card must be a link')
    assert.equal(approvalsCard.href, '/admin/approvals')
    assert.equal(approvalsCard.hasAttention, true, 'Card must have attention styling when pending count > 0')
    assert.match(initialOverview.approvalsTileText, /\(\d+\)/, 'Tile must display pending count')

    // Check Recent activity section
    assert.equal(initialOverview.activityTitle, 'Recent activity')
    assert.equal(initialOverview.hasViewAllLink, true)
    assert.equal(initialOverview.viewAllHref, '/admin/logs')
    assert.equal(initialOverview.rowCount, 5, 'Must show up to 5 records in preview')

    // Capture Desktop Screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'admin_overview_desktop_1440.png')
    await pageCdp.screenshot(desktopScreenshotPath)
    console.log('✔ Desktop screenshot saved to', desktopScreenshotPath)

    console.log('[5/7] Testing Pending Approvals = 0 & Record Count Variants (0, 2, >5)...')
    // Test pending approvals = 0
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_ADMIN_APPROVALS__', JSON.stringify({
        items: [],
        total_count: 0,
        page: 1,
        page_size: 1
      }));
    `)
    // Reload page to re-fetch
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const zeroApprovalsState = await pageCdp.evaluate(`
      (() => {
        const card = document.querySelector('.stat-card-link');
        const tile = document.querySelector('.action-tile:nth-child(2)');
        return {
          cardValue: card?.querySelector('.stat-value')?.textContent?.trim(),
          hasAttention: card?.classList.contains('has-attention'),
          tileText: tile?.textContent?.trim(),
          tileHasHighlight: tile?.classList.contains('highlight-tile')
        };
      })()
    `)
    console.log('Zero Approvals State:', zeroApprovalsState)
    assert.equal(zeroApprovalsState.cardValue, '0', 'Zero approvals must be displayed as 0')
    assert.equal(zeroApprovalsState.hasAttention, false, 'No attention styling when pending approvals is 0')
    assert.equal(zeroApprovalsState.tileHasHighlight, false, 'Action tile must not have highlight-tile when pending approvals is 0')

    // Test 0 activity records
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_ADMIN_LOGS__', JSON.stringify({
        items: [],
        total_count: 0,
        page: 1,
        page_size: 5
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const emptyLogsState = await pageCdp.evaluate(`
      (() => {
        const emptyEl = document.querySelector('.activity-empty-state');
        const rows = document.querySelectorAll('.activity-row');
        return {
          hasEmptyText: Boolean(emptyEl && emptyEl.textContent.trim()),
          emptyText: emptyEl?.textContent?.trim(),
          rowCount: rows.length
        };
      })()
    `)
    console.log('Empty Logs State:', emptyLogsState)
    assert.equal(emptyLogsState.rowCount, 0)
    assert.equal(emptyLogsState.emptyText, 'No activity recorded yet.')

    // Test fewer than 5 records (e.g. 2 records with timezone variants)
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_ADMIN_LOGS__', JSON.stringify({
        items: [
          {
            log_id: 'l-01',
            user_id: '00000000-0000-0000-0000-000000000001',
            user_email: 'naive@cybermorph.local',
            action_type: 'approve_educator',
            target_table: 'users',
            target_id: 'u-01',
            description: 'Approved educator with naive timestamp.',
            logged_at: '2026-10-29T10:00:00'
          },
          {
            log_id: 'l-02',
            user_id: '00000000-0000-0000-0000-000000000001',
            user_email: 'offset@cybermorph.local',
            action_type: 'delete_classroom',
            target_table: 'classroom_codes',
            target_id: 'c-01',
            description: 'Deleted classroom with offset timestamp.',
            logged_at: '2026-10-29T10:00:00+08:00'
          }
        ],
        total_count: 2,
        page: 1,
        page_size: 5
      }));
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const twoLogsState = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.activity-row')).map(r => ({
          email: r.querySelector('.actor-email')?.textContent?.trim(),
          action: r.querySelector('.action-badge')?.textContent?.trim(),
          timeStatus: r.querySelector('.time-status')?.textContent?.trim()
        }));
        return rows;
      })()
    `)
    console.log('Two Logs State (with TZ variants):', twoLogsState)
    assert.equal(twoLogsState.length, 2)
    assert.equal(twoLogsState[0].timeStatus, 'Timezone unspecified')
    assert.match(twoLogsState[1].timeStatus, /Local \(/)

    // Reset overrides
    await pageCdp.evaluate(`
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_ADMIN_APPROVALS__');
      sessionStorage.removeItem('__CYBERMORPH_OVERRIDE_ADMIN_LOGS__');
    `)

    console.log('[6/7] Testing Independent Request Failures & Retries...')
    // 1. Stats failure
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_STATS__', '1');
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const statsFailureState = await pageCdp.evaluate(`
      (() => {
        const statsErrorBanner = document.querySelector('.stats-error-banner');
        const retryBtn = statsErrorBanner?.querySelector('.btn-retry');
        const userCardVal = document.querySelector('.stat-card:nth-child(1) .stat-value')?.textContent?.trim();
        const approvalsVal = document.querySelector('.stat-card-link .stat-value')?.textContent?.trim();
        const activityRows = document.querySelectorAll('.activity-row');

        return {
          hasStatsError: Boolean(statsErrorBanner),
          userCardVal,
          approvalsVal,
          activityRowCount: activityRows.length,
          hasRetryBtn: Boolean(retryBtn)
        };
      })()
    `)
    console.log('Stats Failure State:', statsFailureState)
    assert.equal(statsFailureState.hasStatsError, true, 'Stats error banner must appear')
    assert.equal(statsFailureState.userCardVal, 'Unavailable', 'Unavailable stat must display "Unavailable" honestly')
    assert.notEqual(statsFailureState.approvalsVal, 'Unavailable', 'Approvals card must remain loaded when stats fail')
    assert.equal(statsFailureState.activityRowCount, 5, 'Activity section must remain loaded when stats fail')

    // Click retry on stats
    await pageCdp.evaluate(`
      document.querySelector('.stats-error-banner .btn-retry')?.click();
    `)
    await sleep(600)
    const statsRecovered = await pageCdp.evaluate(`
      (() => {
        const userCardVal = document.querySelector('.stat-card:nth-child(1) .stat-value')?.textContent?.trim();
        const banner = document.querySelector('.stats-error-banner');
        return { userCardVal, hasBanner: Boolean(banner) };
      })()
    `)
    console.log('Stats Recovered after Retry:', statsRecovered)
    assert.notEqual(statsRecovered.userCardVal, 'Unavailable', 'Stats must recover after retry')
    assert.equal(statsRecovered.hasBanner, false, 'Error banner disappears on recovery')

    // 2. Activity failure
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_LOGS__', '1');
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const activityFailureState = await pageCdp.evaluate(`
      (() => {
        const activityError = document.querySelector('.activity-error-banner');
        const userCardVal = document.querySelector('.stat-card:nth-child(1) .stat-value')?.textContent?.trim();
        return {
          hasActivityError: Boolean(activityError),
          userCardVal
        };
      })()
    `)
    console.log('Activity Failure State:', activityFailureState)
    assert.equal(activityFailureState.hasActivityError, true, 'Activity error banner must appear')
    assert.notEqual(activityFailureState.userCardVal, 'Unavailable', 'Metrics must remain usable when activity fails')

    // Click retry on activity
    await pageCdp.evaluate(`
      document.querySelector('.activity-error-banner .btn-retry')?.click();
    `)
    await sleep(600)
    const activityRecovered = await pageCdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('.activity-row');
        const banner = document.querySelector('.activity-error-banner');
        return { rowCount: rows.length, hasBanner: Boolean(banner) };
      })()
    `)
    console.log('Activity Recovered after Retry:', activityRecovered)
    assert.equal(activityRecovered.rowCount, 5, 'Activity must recover after retry')
    assert.equal(activityRecovered.hasBanner, false)

    // 3. Approvals failure
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_APPROVALS__', '1');
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    const approvalsFailureState = await pageCdp.evaluate(`
      (() => {
        const cardVal = document.querySelector('.stat-card-link .stat-value')?.textContent?.trim();
        const retryBtn = document.querySelector('.stat-card-link .btn-retry-sm');
        const userCardVal = document.querySelector('.stat-card:nth-child(1) .stat-value')?.textContent?.trim();
        const activityRows = document.querySelectorAll('.activity-row');
        return {
          cardVal,
          hasRetryBtn: Boolean(retryBtn),
          userCardVal,
          activityRowCount: activityRows.length
        };
      })()
    `)
    console.log('Approvals Failure State:', approvalsFailureState)
    assert.equal(approvalsFailureState.cardVal, 'Unavailable')
    assert.equal(approvalsFailureState.hasRetryBtn, true)
    assert.notEqual(approvalsFailureState.userCardVal, 'Unavailable')
    assert.equal(approvalsFailureState.activityRowCount, 5)

    // Click retry on approvals
    await pageCdp.evaluate(`
      document.querySelector('.stat-card-link .btn-retry-sm')?.click();
    `)
    await sleep(600)
    const approvalsRecovered = await pageCdp.evaluate(`
      (() => {
        const cardVal = document.querySelector('.stat-card-link .stat-value')?.textContent?.trim();
        const retryBtn = document.querySelector('.stat-card-link .btn-retry-sm');
        return { cardVal, hasRetryBtn: Boolean(retryBtn) };
      })()
    `)
    console.log('Approvals Recovered after Retry:', approvalsRecovered)
    assert.notEqual(approvalsRecovered.cardVal, 'Unavailable')
    assert.equal(approvalsRecovered.hasRetryBtn, false)

    console.log('[7/7] Testing Navigation & Mobile Layout (390px) with Enlarged Text...')
    // Test navigation: Pending Approvals card click
    await pageCdp.evaluate(`
      document.querySelector('.stat-card-link')?.click();
    `)
    await sleep(800)
    const navigatedApprovals = await pageCdp.evaluate(`window.location.pathname`)
    console.log('Navigated Approvals URL:', navigatedApprovals)
    assert.equal(navigatedApprovals, '/admin/approvals', 'Card click must navigate to /admin/approvals')

    // Go back to /dashboard
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    // Test navigation: View all audit logs link
    await pageCdp.evaluate(`
      document.querySelector('.link-view-all')?.click();
    `)
    await sleep(800)
    const navigatedLogs = await pageCdp.evaluate(`window.location.pathname`)
    console.log('Navigated Logs URL:', navigatedLogs)
    assert.equal(navigatedLogs, '/admin/logs', 'Link click must navigate to /admin/logs')

    // Go back to /dashboard for mobile test
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/dashboard` })
    await sleep(1000)

    // Mobile layout at 390px
    await pageCdp.setViewport(390, 844)
    await sleep(600)

    const mobileCheck = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > docWidth
        };
      })()
    `)
    console.log('Mobile Check (390px):', mobileCheck)
    assert.equal(mobileCheck.hasHorizontalOverflow, false, 'Mobile viewport must not have document horizontal overflow')

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'admin_overview_mobile_390.png')
    await pageCdp.screenshot(mobileScreenshotPath)
    console.log('✔ Mobile screenshot saved to', mobileScreenshotPath)

    // Test Enlarged Text
    await pageCdp.evaluate(`
      document.documentElement.setAttribute('data-text-size', 'extra-large');
    `)
    await sleep(400)
    const enlargedCheck = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > docWidth
        };
      })()
    `)
    console.log('Enlarged Text Check (390px):', enlargedCheck)
    assert.equal(enlargedCheck.hasHorizontalOverflow, false, 'Enlarged text must not cause horizontal blowout')

    await pageCdp.evaluate(`
      document.documentElement.removeAttribute('data-text-size');
    `)

    console.log('\nALL ADMIN OVERVIEW ENHANCEMENTS VERIFIED SUCCESSFULLY!')
  } finally {
    try {
      if (chromeProc) chromeProc.kill('SIGTERM')
      if (viteProc) viteProc.kill('SIGTERM')
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
