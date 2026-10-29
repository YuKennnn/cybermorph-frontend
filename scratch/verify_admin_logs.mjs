/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5198
const CDP_PORT = 9248
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-admin-logs-cdp-${Date.now()}`)
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

    console.log('[3/7] Setting up Admin Session & Loading /admin/logs...')
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
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs` })
    await sleep(1500)

    console.log('[4/7] Testing Filter Alignment & Actor Validation...')
    // Check initial control alignment (bottom coordinate comparison)
    const initialAlign = await pageCdp.evaluate(`
      (() => {
        const select = document.querySelector('#action-filter');
        const input = document.querySelector('#actor-filter');
        const applyBtn = document.querySelector('.btn-apply-actor');
        const sRect = select.getBoundingClientRect();
        const iRect = input.getBoundingClientRect();
        const aRect = applyBtn.getBoundingClientRect();
        return {
          selectBottom: sRect.bottom,
          inputBottom: iRect.bottom,
          applyBottom: aRect.bottom,
          aligned: Math.abs(sRect.bottom - iRect.bottom) < 2 && Math.abs(iRect.bottom - aRect.bottom) < 2
        };
      })()
    `)
    console.log('Initial Control Alignment:', initialAlign)
    assert.equal(initialAlign.aligned, true, 'Controls must have identical bottom alignment initially')

    // Enter invalid UUID
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#actor-filter');
        input.value = 'invalid-not-a-uuid';
        input.dispatchEvent(new Event('input'));
        const applyBtn = document.querySelector('.btn-apply-actor');
        applyBtn.click();
      })()
    `)
    await sleep(500)

    const invalidState = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#actor-filter');
        const errorEl = document.querySelector('#actor-filter-error');
        const select = document.querySelector('#action-filter');
        const applyBtn = document.querySelector('.btn-apply-actor');

        const sRect = select.getBoundingClientRect();
        const iRect = input.getBoundingClientRect();
        const aRect = applyBtn.getBoundingClientRect();

        return {
          hasErrorText: Boolean(errorEl && errorEl.textContent.trim()),
          errorText: errorEl ? errorEl.textContent.trim() : '',
          ariaInvalid: input.getAttribute('aria-invalid'),
          ariaDescribedBy: input.getAttribute('aria-describedby'),
          selectBottom: sRect.bottom,
          inputBottom: iRect.bottom,
          applyBottom: aRect.bottom,
          stillAligned: Math.abs(sRect.bottom - iRect.bottom) < 2 && Math.abs(iRect.bottom - aRect.bottom) < 2,
          currentUrl: window.location.search
        };
      })()
    `)
    console.log('Invalid State & Alignment:', invalidState)
    assert.equal(invalidState.hasErrorText, true, 'Error message must appear for invalid UUID')
    assert.match(invalidState.errorText, /valid 36-character user UUID/)
    assert.equal(invalidState.ariaInvalid, 'true', 'Input must have aria-invalid="true"')
    assert.equal(invalidState.ariaDescribedBy, 'actor-filter-error', 'Input must reference error via aria-describedby')
    assert.equal(invalidState.stillAligned, true, 'Controls must remain perfectly aligned when error message is shown')
    assert.equal(invalidState.currentUrl, '', 'Invalid input must NOT send an API request or change URL')

    // Capture Desktop Screenshot with validation error shown
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'admin_logs_desktop_1440.png')
    await pageCdp.screenshot(desktopScreenshotPath)
    console.log('✔ Desktop screenshot (with validation error) saved to', desktopScreenshotPath)

    // Clear invalid input
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#actor-filter');
        input.value = '';
        input.dispatchEvent(new Event('input'));
        document.querySelector('.btn-apply-actor')?.click();
      })()
    `)
    await sleep(600)

    console.log('[5/7] Testing Timezone Clarity & Notice...')
    const timezoneCheck = await pageCdp.evaluate(`
      (() => {
        const notice = document.querySelector('.table-timezone-notice');
        const orangeBadges = document.querySelectorAll('.tz-tag');
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          timeText: r.querySelector('.time-formatted')?.textContent?.trim(),
          subtext: r.querySelector('.time-status-subtext')?.textContent?.trim(),
          descText: r.querySelector('.desc-text')?.textContent?.trim(),
        }));
        return {
          hasNotice: Boolean(notice && notice.textContent.trim()),
          noticeText: notice ? notice.textContent.trim() : '',
          orangeBadgeCount: orangeBadges.length,
          rows
        };
      })()
    `)
    console.log('Timezone notice:', timezoneCheck.noticeText)
    console.log('Orange badge count:', timezoneCheck.orangeBadgeCount)

    const naiveRow = timezoneCheck.rows.find(r => r.descText?.includes('prof.santos'))
    const offsetRow = timezoneCheck.rows.find(r => r.descText?.includes('Closed enrollment'))
    console.log('Naive row:', naiveRow)
    console.log('Offset row:', offsetRow)

    assert.equal(timezoneCheck.hasNotice, true, 'Notice above table must explain timezone policy')
    assert.match(timezoneCheck.noticeText, /Timestamps with recorded offsets are shown in your local time/)
    assert.equal(timezoneCheck.orangeBadgeCount, 0, 'Repetitive orange warning badges must be completely removed')
    assert(naiveRow, 'Row with naive timestamp must exist')
    assert.equal(naiveRow.subtext, 'Timezone unspecified', 'Naive timestamp must display "Timezone unspecified"')
    assert(offsetRow, 'Row with offset timestamp must exist')
    assert.match(offsetRow.subtext, /Local \(/, 'Converted timestamp must visibly identify the displayed timezone')

    console.log('[6/7] Testing Missing Data & Partial Resource Presentation...')
    const dataPresentation = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          action: r.querySelector('.action-badge')?.textContent?.trim(),
          targetHtml: r.querySelector('.td-target')?.innerHTML,
          targetText: r.querySelector('.td-target')?.textContent?.trim(),
          descText: r.querySelector('.td-desc')?.textContent?.trim(),
          timeText: r.querySelector('.td-time')?.textContent?.trim(),
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
          actorEmailStyle: window.getComputedStyle(r.querySelector('.actor-email')).overflowWrap
        }));
        return rows;
      })()
    `)

    // Check login row: missing resource & description
    const loginRow = dataPresentation.find(r => r.action === 'User login' && r.targetText === 'Not recorded')
    console.log('Login row (missing resource & desc):', loginRow)
    assert(loginRow, 'Should have a login row with unrecorded target')
    assert.equal(loginRow.targetText, 'Not recorded', 'Missing resource must display "Not recorded"')
    assert.equal(loginRow.descText, 'No additional details recorded', 'Missing description must display "No additional details recorded"')

    // Check partial resource row: target table without target ID
    const partialRow = dataPresentation.find(r => r.targetText.includes('(No ID recorded)'))
    console.log('Partial resource row:', partialRow)
    assert(partialRow, 'Partial resource with only target_table must preserve table and display "(No ID recorded)"')
    assert.match(partialRow.targetText, /classroom_codes/)

    // Check malformed timestamp row
    const malformedRow = dataPresentation.find(r => r.timeText.includes('Date unavailable'))
    console.log('Malformed timestamp row:', malformedRow)
    assert(malformedRow, 'Malformed timestamp must display "Date unavailable"')

    // Check actor email overflow-wrap
    assert.equal(dataPresentation[0].actorEmailStyle, 'break-word', 'Actor email must use break-word overflow wrap')

    console.log('[7/7] Testing Mobile Layout (390px) & Enlarged Text...')
    // Mobile layout
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

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'admin_logs_mobile_390.png')
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
    console.log('Enlarged Text Check:', enlargedCheck)
    assert.equal(enlargedCheck.hasHorizontalOverflow, false, 'Enlarged text must not cause horizontal blowout')

    await pageCdp.evaluate(`
      document.documentElement.removeAttribute('data-text-size');
    `)

    console.log('\nALL AUDIT LOGS FIXES VERIFIED SUCCESSFULLY!')
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
