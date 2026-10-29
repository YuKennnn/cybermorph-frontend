/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
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

    console.log('[2/4] Starting Headless Chrome...')
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
      ],
      { stdio: 'ignore' },
    )

    await sleep(1500)
    const wsUrl = await getCDPWebSocketUrl(CDP_PORT)
    cdp = new CDPClient(wsUrl)
    await cdp.connect()

    const targetRes = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const targetWsUrl = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetRes.targetId}`
    pageCdp = new CDPClient(targetWsUrl)
    await pageCdp.connect()

  await pageCdp.send('Page.enable')
  await pageCdp.send('DOM.enable')

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

  const testViewports = [
    { name: 'Laptop (1440x900)', width: 1440, height: 900, isMobile: false },
    { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
  ]

  for (const vp of testViewports) {
    console.log(`\n--- Testing ${vp.name} ---`)
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    })

    // 1. Verify Classroom Students View (/classroom/students/c1)
    console.log(`Navigating to /classroom/students/c1...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1` })
    await sleep(2000)

    const debugInfo = await pageCdp.evaluate(`({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 300)
    })`)
    console.log('Page debug info:', debugInfo)

    const rosterHeaders = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.roster-table th')).map(th => th.textContent.trim())
    `)
    console.log('Roster table headers:', rosterHeaders)
    assert(rosterHeaders.includes('Threat index'), 'ClassroomStudentsView must include "Threat index" header')

    const studentBadges = await pageCdp.evaluate(`
      Array.from(document.querySelectorAll('.roster-table .threat-count-badge')).map(b => b.textContent.trim())
    `)
    console.log(`Roster threat badges (${studentBadges.length} rows):`, studentBadges.slice(0, 3))
    assert(studentBadges.length > 0, 'Classroom roster must render threat badges')
    assert(studentBadges[0].includes('of 8 unlocked'), 'Synced student badge should format count')

    // 2. Verify Educator Analytics View (/analytics/c1)
    console.log(`Navigating to /analytics/c1...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/analytics/c1` })
    await sleep(2000)

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
    await sleep(1200)

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

    // 3b. Verify Session Telemetry Modal & Finishing Credits
    console.log('Testing session telemetry modal - Session 1 (positive credits: 45)...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[0].click()`)
    await sleep(800)

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
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .btn-back-link').click()`)
    await sleep(400)

    // Open Session 2 (zero credits: 0, empty events)
    console.log('Testing session telemetry modal - Session 2 (0 credits, empty events)...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[1].click()`)
    await sleep(800)

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
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .btn-back-link').click()`)
    await sleep(400)

    // Open Session 3 (null credits -> "Not recorded")
    console.log('Testing session telemetry modal - Session 3 (null credits -> "Not recorded")...')
    await pageCdp.evaluate(`document.querySelectorAll('.sessions-table .btn-inspect')[2].click()`)
    await sleep(800)

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
    await pageCdp.evaluate(`document.querySelector('.modal-dialog .btn-back-link').click()`)
    await sleep(400)
    console.log(`Navigating to /classroom/students/c1/progress/p23 (never-synced student)...`)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/classroom/students/c1/progress/p23` })
    await sleep(1200)

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
  }

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
