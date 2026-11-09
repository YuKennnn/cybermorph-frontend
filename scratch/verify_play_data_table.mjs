/* global process */
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ISOLATED_VITE_PORT = 5196
const ISOLATED_CDP_PORT = 9246
const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-playdata-test-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const WebSocket = globalThis.WebSocket
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onopen = () => resolve()
      this.ws.onerror = (err) => reject(err)
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data)
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)
          this.pending.delete(data.id)
          if (data.error) reject(data.error)
          else resolve(data.result)
        }
      }
    })
  }

  async send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
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
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async waitFor(expr, timeoutMs = 8000, intervalMs = 100) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr)
        if (val) return val
      } catch {
        // Retry
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error(`Timed out waiting for expression: ${expr}`)
  }

  async navigate(url, selector = '#app') {
    await this.send('Page.navigate', { url })
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const found = await this.eval(`document.querySelector(${JSON.stringify(selector)}) !== null`)
      if (found) {
        await new Promise((r) => setTimeout(r, 200))
        return
      }
    }
    throw new Error(`Timed out waiting for selector "${selector}" on ${url}`)
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
  }
}

async function startViteServer() {
  const env = { ...process.env, VITE_USE_MOCK: 'true', PORT: String(ISOLATED_VITE_PORT) }
  const proc = spawn('npx.cmd', ['vite', '--port', String(ISOLATED_VITE_PORT), '--strictPort'], {
    env,
    shell: true,
    stdio: 'pipe',
  })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite server failed to start within 15s')), 15000)
    proc.stdout.on('data', (d) => {
      const text = d.toString()
      if (text.includes(`localhost:${ISOLATED_VITE_PORT}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    proc.stderr.on('data', (d) => {
      console.error('Vite err:', d.toString())
    })
  })

  return proc
}

async function startEdge() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  const proc = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${ISOLATED_CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      '--window-size=1280,800',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const startTime = Date.now()
  const EDGE_STARTUP_TIMEOUT_MS = 15000
  let pageTarget = null

  while (Date.now() - startTime < EDGE_STARTUP_TIMEOUT_MS) {
    try {
      const res = await fetch(`http://127.0.0.1:${ISOLATED_CDP_PORT}/json/list`)
      const targets = await res.json()
      pageTarget = targets.find((t) => t.type === 'page')
      if (pageTarget?.webSocketDebuggerUrl) break
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error(`Edge DevTools handshake timed out after ${EDGE_STARTUP_TIMEOUT_MS}ms`)
  }

  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  return { proc, cdp }
}

async function runTests() {
  let viteProc = null
  let edgeProc = null
  let cdp = null

  try {
    console.log('Starting Vite server on port', ISOLATED_VITE_PORT)
    viteProc = await startViteServer()

    console.log('Starting Edge on CDP port', ISOLATED_CDP_PORT)
    const browser = await startEdge()
    edgeProc = browser.proc
    cdp = browser.cdp

    const BASE_URL = `http://localhost:${ISOLATED_VITE_PORT}`

    // Helper to simulate signed in admin state
    async function setAdminAuthState() {
      await cdp.eval(`(() => {
        sessionStorage.clear();
        localStorage.clear();
        const user = {
          user_id: "u-admin-01",
          profile_id: "p-admin-01",
          email: "admin@example.com",
          username: "admin_tester",
          role: "admin"
        };
        localStorage.setItem("cyber_token", "mock-jwt-token-admin:u-admin-01");
        localStorage.setItem("cyber_role", "admin");
        localStorage.setItem("cyber_user", JSON.stringify(user));
        window.location.reload();
      })()`)
      await cdp.waitFor('document.readyState === "complete"')
      await new Promise((r) => setTimeout(r, 600))
    }

    console.log('\n--- TEST 1: Table Layout & Column Verification ---')
    await cdp.navigate(BASE_URL + '/', '#app')
    await setAdminAuthState()
    await cdp.navigate(BASE_URL + '/admin/play-data', '.admin-play-data-view')
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".play-data-table tbody tr").length > 0')

    // 1. Column headers
    const headerInfo = await cdp.eval(`(() => {
      const ths = Array.from(document.querySelectorAll('.play-data-table thead th')).map(th => ({
        text: th.textContent.trim(),
        className: th.className,
      }));
      return ths;
    })()`)

    console.log('Headers found:', headerInfo)
    assert.strictEqual(headerInfo.length, 4, 'Table must have exactly 4 columns')
    assert.strictEqual(headerInfo[0].text, 'Player', 'Column 1 header must be Player')
    assert.strictEqual(headerInfo[1].text, 'Rows', 'Column 2 header must be Rows')
    assert.strictEqual(headerInfo[2].text, 'Uploaded (PHT)', 'Column 3 header must be Uploaded (PHT)')
    assert.strictEqual(headerInfo[3].text, 'Action', 'Column 4 header must be Action')

    // Ensure Participant code column is completely removed
    const hasParticipantHeader = headerInfo.some((th) => th.text.toLowerCase().includes('participant'))
    assert.strictEqual(hasParticipantHeader, false, 'No Participant code column header')

    // Ensure all rows have exactly 4 cells and no .td-code
    const rowCellCounts = await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('.play-data-table tbody tr'));
      return {
        totalRows: rows.length,
        allHaveFourCells: rows.every(r => r.querySelectorAll('td').length === 4),
        hasCodeCells: rows.some(r => r.querySelector('.td-code') !== null),
        hasCodeBadges: rows.some(r => r.querySelector('.code-badge') !== null),
      };
    })()`)

    assert.ok(rowCellCounts.totalRows > 0, 'Must have rendered rows')
    assert.strictEqual(rowCellCounts.allHaveFourCells, true, 'Every row must have exactly 4 cells')
    assert.strictEqual(rowCellCounts.hasCodeCells, false, 'No row may have .td-code')
    assert.strictEqual(rowCellCounts.hasCodeBadges, false, 'No row may have .code-badge')
    console.log('✓ Four-column structure verified (Player, Rows, Uploaded (PHT), Action)')

    // 2. Download CSV button accessible name check
    console.log('\n--- TEST 2: Accessible Names on Download CSV Buttons ---')
    const buttonAccessibleNames = await cdp.eval(`(() => {
      const buttons = Array.from(document.querySelectorAll('.btn-download')).map(btn => ({
        ariaLabel: btn.getAttribute('aria-label'),
        visibleText: btn.textContent.trim(),
      }));
      return buttons;
    })()`)

    console.log('Sample button accessible names (first 3):', buttonAccessibleNames.slice(0, 3))
    assert.ok(buttonAccessibleNames.length > 0, 'Buttons must be present')
    for (const btn of buttonAccessibleNames) {
      assert.ok(btn.ariaLabel, 'Each Download CSV button must have an aria-label')
      assert.ok(btn.ariaLabel.startsWith('Download CSV for '), `Aria-label "${btn.ariaLabel}" must start with Download CSV for`)
      assert.ok(btn.ariaLabel.includes(', uploaded '), `Aria-label "${btn.ariaLabel}" must include upload time info`)
      assert.ok(!btn.ariaLabel.includes('participant'), `Aria-label must not be keyed to participant code: "${btn.ariaLabel}"`)
    }
    console.log('✓ Download CSV accessible names correctly identify player and upload time')

    // 3. Desktop width & Long Username Word-Wrapping
    console.log('\n--- TEST 3: Desktop Width (1280px) & Long Username Word Wrapping ---')
    await cdp.setViewport(1280, 800)

    // Inject a row with a very long unbroken username
    await cdp.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_ADMIN_PLAY_DATA__', JSON.stringify({
        items: [
          {
            upload_id: 'a0000001-0000-0000-0000-000000000001',
            username: 'super_extra_long_unbroken_username_for_cybersecurity_testing_research_telemetry_2026',
            participant_code: 'LONG01',
            row_count: 85,
            uploaded_at: '2026-10-31T09:15:00Z',
          }
        ],
        total_count: 1,
        page: 1,
        page_size: 20
      }));
      window.location.reload();
    })()`)
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".play-data-table tbody tr").length === 1')

    const longUsernameStyles = await cdp.eval(`(() => {
      const td = document.querySelector('.td-user');
      const text = document.querySelector('.username-text');
      const computedTd = window.getComputedStyle(td);
      const computedText = window.getComputedStyle(text);
      return {
        tdWordBreak: computedTd.wordBreak,
        tdOverflowWrap: computedTd.overflowWrap,
        textWordBreak: computedText.wordBreak,
        textOverflowWrap: computedText.overflowWrap,
        textWidth: text.offsetWidth,
        tdWidth: td.offsetWidth,
        tableWidth: document.querySelector('.play-data-table').offsetWidth,
      };
    })()`)

    console.log('Long username computed wrapping styles:', longUsernameStyles)
    assert.ok(
      longUsernameStyles.textWordBreak === 'break-word' || longUsernameStyles.tdWordBreak === 'break-word',
      'Word-break must be break-word',
    )
    assert.ok(
      longUsernameStyles.textOverflowWrap === 'anywhere' || longUsernameStyles.tdOverflowWrap === 'anywhere',
      'Overflow-wrap must be anywhere',
    )
    console.log('✓ Long username wrapping verified')

    // 4. Narrow Screen / Mobile Viewports (640px, 375px, 320px)
    console.log('\n--- TEST 4: Mobile & Narrow Screens (640px, 375px, 320px) ---')
    for (const width of [640, 375, 320]) {
      await cdp.setViewport(width, 600)
      await new Promise((r) => setTimeout(r, 200))

      const metrics = await cdp.eval(`(() => {
        const th = document.querySelector('.play-data-table th');
        const td = document.querySelector('.play-data-table td');
        const btn = document.querySelector('.btn-download');
        const scroll = document.querySelector('.table-scroll');
        const computedTh = window.getComputedStyle(th);
        const computedBtn = window.getComputedStyle(btn);
        return {
          thPadding: computedTh.padding,
          btnMinHeight: computedBtn.minHeight,
          hasScrollContainer: !!scroll,
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
        };
      })()`)

      console.log(`Viewport ${width}px metrics:`, metrics)
      assert.strictEqual(metrics.btnMinHeight, '44px', `Button min-height must be 44px at ${width}px`)
      assert.ok(metrics.hasScrollContainer, 'Table scroll container present')
      // Under 640px, padding is responsive
      if (width <= 640) {
        assert.ok(metrics.thPadding.includes('10px') || metrics.thPadding.includes('12px'), `Padding reduced on mobile (${metrics.thPadding})`)
      }
    }
    console.log('✓ Narrow screen responsive layouts and touch targets verified')

    // 5. Single & Bulk Downloads with Shared Participant Code
    console.log('\n--- TEST 5: Single & Bulk Downloads with Two Uploads Sharing a Participant Code ---')
    await cdp.setViewport(1280, 800)

    // Setup 2 uploads sharing participant code "SHARED_DUO"
    await cdp.eval(`(() => {
      sessionStorage.setItem('__CYBERMORPH_OVERRIDE_ADMIN_PLAY_DATA__', JSON.stringify({
        items: [
          {
            upload_id: 'a0000001-0000-0000-0000-000000000001',
            username: 'alpha_player',
            participant_code: 'SHARED_DUO',
            row_count: 85,
            uploaded_at: '2026-10-31T09:15:00Z',
          },
          {
            upload_id: 'a0000002-0000-0000-0000-000000000002',
            username: 'beta_player',
            participant_code: 'SHARED_DUO',
            row_count: 142,
            uploaded_at: '2026-10-31T08:42:00Z',
          }
        ],
        total_count: 2,
        page: 1,
        page_size: 20
      }));
      window.location.reload();
    })()`)
    await cdp.waitFor('!document.querySelector(".loading-state") && document.querySelectorAll(".play-data-table tbody tr").length === 2')

    // Setup download interception in the browser
    await cdp.eval(`(() => {
      window.__interceptedDownloads = [];
      const origCreate = window.URL.createObjectURL.bind(window.URL);
      window.URL.createObjectURL = function(blob) {
        const item = { url: origCreate(blob), blob, textPromise: blob.text() };
        window.__lastBlob = item;
        return item.url;
      };

      const origAppend = document.body.appendChild.bind(document.body);
      document.body.appendChild = function(node) {
        if (node.tagName === 'A' && node.download) {
          const downloadEntry = {
            filename: node.download,
            content: null,
          };
          window.__interceptedDownloads.push(downloadEntry);
          if (window.__lastBlob) {
            window.__lastBlob.textPromise.then(t => {
              downloadEntry.content = t;
            });
          }
          node.click = function() {};
        }
        return origAppend(node);
      };
    })()`)

    // 5A: Single download for Upload 1 (alpha_player)
    console.log('Testing single download 1 (alpha_player, upload_id a0000001)...')
    await cdp.eval(`document.querySelectorAll('.btn-download')[0].click()`)
    await cdp.waitFor('window.__interceptedDownloads.length === 1 && window.__interceptedDownloads[0].content !== null')

    const dl1 = await cdp.eval('window.__interceptedDownloads[0]')
    console.log('Download 1 result:', dl1.filename)
    assert.ok(dl1.filename.startsWith('play-data-SHARED_DUO-'), `Filename must preserve participant_code SHARED_DUO: ${dl1.filename}`)
    assert.ok(dl1.filename.endsWith('.csv'), 'Filename must end with .csv')
    assert.ok(dl1.content.includes('participant_code'), 'CSV must contain participant_code header')
    // Decoded payload contains participant_code
    const dl1Lines = dl1.content.trim().split('\n')
    assert.ok(dl1Lines.length >= 2, 'CSV must have at least header + 1 data line')

    // 5B: Single download for Upload 2 (beta_player)
    console.log('Testing single download 2 (beta_player, upload_id a0000002)...')
    await cdp.eval(`document.querySelectorAll('.btn-download')[1].click()`)
    await cdp.waitFor('window.__interceptedDownloads.length === 2 && window.__interceptedDownloads[1].content !== null')

    const dl2 = await cdp.eval('window.__interceptedDownloads[1]')
    console.log('Download 2 result:', dl2.filename)
    assert.ok(dl2.filename.startsWith('play-data-SHARED_DUO-'), `Filename must preserve participant_code SHARED_DUO: ${dl2.filename}`)
    assert.ok(dl2.filename.endsWith('.csv'), 'Filename must end with .csv')
    assert.ok(dl2.content.includes('participant_code'), 'CSV must contain participant_code header')

    // 5C: Bulk "Download all" execution
    console.log('Testing bulk "Download all" with shared participant code...')
    await cdp.eval(`document.querySelector('.btn-bulk-download').click()`)
    await cdp.waitFor('window.__interceptedDownloads.length === 3 && window.__interceptedDownloads[2].content !== null', 15000)

    const dlBulk = await cdp.eval('window.__interceptedDownloads[2]')
    console.log('Bulk download result:', dlBulk.filename)
    assert.ok(dlBulk.filename.startsWith('play-data-all-'), `Bulk filename must start with play-data-all-: ${dlBulk.filename}`)
    assert.ok(dlBulk.filename.endsWith('.csv'), 'Bulk filename must end with .csv')
    assert.ok(dlBulk.content.includes('participant_code'), 'Bulk CSV must contain participant_code column')

    console.log('✓ Single and bulk downloads with shared participant code verified')

    // Cleanup session storage
    await cdp.eval(`(() => {
      sessionStorage.clear();
    })()`)

    console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---')
  } finally {
    if (edgeProc) {
      edgeProc.kill('SIGKILL')
    }
    if (viteProc) {
      viteProc.kill('SIGKILL')
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err)
  process.exit(1)
})
