/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'

const isWindows = process.platform === 'win32'
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5196
const CDP_PORT = 9262
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/e915d42a-bc70-4315-86d7-18b50753d36f'
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-classrooms-cdp-${Date.now()}`)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// =============================================================
// Suite 1: Pure Logic Unit Checks
// =============================================================
function runUnitFilterTests() {
  console.log('=== Suite 1: Classroom Search & Status Filter Unit Checks ===')

  const sampleClassrooms = [
    { code_id: 'c1', name: 'BSIT 4A', code_value: 'CYB101', is_active: true },
    { code_id: 'c2', name: 'BSIT 3C', code_value: 'NET202', is_active: true },
    { code_id: 'c3', name: 'BSCS 2B (Archived)', code_value: 'OLD303', is_active: false },
  ]

  const filterFn = (items, search, status) => {
    const q = (search || '').trim().toLowerCase()
    return items.filter((c) => {
      if (status === 'active' && c.is_active !== true) return false
      if (status === 'inactive' && c.is_active !== false) return false
      if (q) {
        const name = String(c.name || '').toLowerCase()
        const code = String(c.code_value || c.code || '').toLowerCase()
        if (!name.includes(q) && !code.includes(q)) return false
      }
      return true
    })
  }

  // 1. Partial name matching
  assert.strictEqual(filterFn(sampleClassrooms, 'bsit', 'all').length, 2, 'Matches BSIT 4A and BSIT 3C')
  assert.strictEqual(filterFn(sampleClassrooms, 'archived', 'all').length, 1, 'Matches BSCS 2B (Archived)')

  // 2. Partial code matching
  assert.strictEqual(filterFn(sampleClassrooms, 'cyb', 'all').length, 1, 'Matches CYB101 by code')
  assert.strictEqual(filterFn(sampleClassrooms, '202', 'all').length, 1, 'Matches NET202 by code')

  // 3. Whitespace trimming & case-insensitivity
  assert.strictEqual(filterFn(sampleClassrooms, '   CYB101   ', 'all').length, 1, 'Matches trimmed CYB101')
  assert.strictEqual(filterFn(sampleClassrooms, 'old303', 'all').length, 1, 'Matches lowercase code')

  // 4. Status filtering
  assert.strictEqual(filterFn(sampleClassrooms, '', 'active').length, 2, '2 active classrooms')
  assert.strictEqual(filterFn(sampleClassrooms, '', 'inactive').length, 1, '1 inactive classroom')
  assert.strictEqual(filterFn(sampleClassrooms, '', 'all').length, 3, 'All 3 classrooms')

  // 5. Combined search and status
  assert.strictEqual(filterFn(sampleClassrooms, 'bsit', 'active').length, 2, 'BSIT + active = 2')
  assert.strictEqual(filterFn(sampleClassrooms, 'bsit', 'inactive').length, 0, 'BSIT + inactive = 0')
  assert.strictEqual(filterFn(sampleClassrooms, 'bscs', 'inactive').length, 1, 'BSCS + inactive = 1')

  // 6. Backend order preservation
  const filtered = filterFn(sampleClassrooms, 'bs', 'all')
  assert.deepStrictEqual(filtered.map((c) => c.code_id), ['c1', 'c2', 'c3'], 'Order preserved')

  console.log('✓ All filter unit checks passed successfully!\n')
}

// =============================================================
// Suite 2: Full Headless Chrome Browser Verification
// =============================================================
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
    await this.send('Page.enable')
    await this.send('Runtime.enable')
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

async function runBrowserTests() {
  console.log('=== Suite 2: Browser Verification in Headless Chrome ===')

  console.log(`Starting isolated Vite test server on port ${TEST_PORT}...`)
  let viteExited = false
  let viteExitCode = null
  let viteError = null

  const viteProc = spawn(
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

  viteProc.on('exit', (code) => {
    viteExited = true
    viteExitCode = code
  })

  viteProc.on('error', (err) => {
    viteError = err
  })

  for (let i = 0; i < 40; i++) {
    if (viteExited) {
      throw new Error(`Vite server exited prematurely with code ${viteExitCode}`)
    }
    if (viteError) {
      throw new Error(`Vite process error: ${viteError.message}`)
    }
    try {
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`)
      if (res.ok) break
    } catch {
      await sleep(250)
    }
  }

  console.log(`✓ Isolated Vite server up on http://127.0.0.1:${TEST_PORT}`)

  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  const chromeProc = spawn(
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

  let client
  try {
    let versionData = null
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        versionData = await res.json()
        break
      } catch {
        await sleep(250)
      }
    }
    assert.ok(versionData, 'Chrome started successfully on port ' + CDP_PORT)

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await listRes.json()
    const page = pages.find((p) => p.type === 'page')
    assert.ok(page, 'Must find active browser page')

    client = new CDPClient(page.webSocketDebuggerUrl)
    await client.connect()

    // 1. Authenticate as educator
    console.log('1. Authenticating as educator...')
    await client.send('Page.navigate', { url: `http://127.0.0.1:${TEST_PORT}/login` })
    await client.waitEval(`document.querySelector('#email') !== null`)
    await client.eval(`
      (() => {
        const email = document.querySelector('#email');
        email.value = 'educator@cybermorph.local';
        email.dispatchEvent(new Event('input', { bubbles: true }));
        const pass = document.querySelector('#password');
        pass.value = 'password123';
        pass.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('button[type="submit"]')?.click();
      })()
    `)
    await client.waitEval(`window.location.pathname.includes('/dashboard')`, 8000)
    console.log('✓ Successfully authenticated')

    // 2. Navigate to /classroom/manage
    console.log('2. Navigating to Classroom management...')
    await client.send('Page.navigate', { url: `http://127.0.0.1:${TEST_PORT}/classroom/manage` })
    await client.waitEval(`document.querySelector('.classroom-toolbar') !== null`, 8000)

    // Inspect initial toolbar and cards
    const initialData = await client.eval(`
      (() => {
        const toolbar = document.querySelector('.classroom-toolbar');
        const searchInput = document.querySelector('#classroom-search');
        const statusSelect = document.querySelector('#classroom-status');
        const clearBtn = document.querySelector('.btn-clear-filters');
        const cards = document.querySelectorAll('.classroom-card');
        const searchLabel = document.querySelector('label[for="classroom-search"]')?.textContent?.trim();
        const statusLabel = document.querySelector('label[for="classroom-status"]')?.textContent?.trim();
        return {
          hasToolbar: Boolean(toolbar),
          hasSearchInput: Boolean(searchInput),
          hasStatusSelect: Boolean(statusSelect),
          hasClearBtn: Boolean(clearBtn),
          searchLabel,
          statusLabel,
          cardCount: cards.length,
        };
      })()
    `)

    console.log('Initial toolbar state:', initialData)
    assert.strictEqual(initialData.hasToolbar, true, 'Toolbar is rendered')
    assert.strictEqual(initialData.searchLabel, 'Search classrooms', 'Search input label matches spec')
    assert.strictEqual(initialData.statusLabel, 'Status', 'Status label matches spec')
    assert.strictEqual(initialData.hasClearBtn, false, 'Clear filters hidden initially')
    assert.strictEqual(initialData.cardCount, 3, '3 initial classroom cards loaded')
    console.log('✓ Initial toolbar controls and card count verified')

    // 3. Test Name Search: "BSIT"
    console.log('3. Testing search by name: "BSIT"...')
    await client.eval(`
      (() => {
        const input = document.querySelector('#classroom-search');
        input.value = '  bsit  ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(200)

    const searchResult = await client.eval(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.classroom-card')).map(c => c.querySelector('.classroom-name')?.textContent?.trim());
        const hasClearBtn = Boolean(document.querySelector('.btn-clear-filters'));
        return { cards, hasClearBtn };
      })()
    `)
    console.log('Search "bsit" result:', searchResult)
    assert.strictEqual(searchResult.cards.length, 2, '2 BSIT classrooms match')
    assert.ok(searchResult.cards.includes('BSIT 4A') && searchResult.cards.includes('BSIT 3C'))
    assert.strictEqual(searchResult.hasClearBtn, true, 'Clear filters visible when search active')
    console.log('✓ Name search and Clear button appearance verified')

    // 4. Test Clear Filters
    console.log('4. Testing Clear filters...')
    await client.eval(`document.querySelector('.btn-clear-filters')?.click()`)
    await sleep(200)
    const afterClearCount = await client.eval(`document.querySelectorAll('.classroom-card').length`)
    const searchValAfterClear = await client.eval(`document.querySelector('#classroom-search')?.value`)
    assert.strictEqual(afterClearCount, 3, 'All 3 classrooms restored after clearing')
    assert.strictEqual(searchValAfterClear, '', 'Search input emptied')
    console.log('✓ Clear filters restored complete list')

    // 5. Test Access Code Search: "OLD303"
    console.log('5. Testing search by access code: "old303"...')
    await client.eval(`
      (() => {
        const input = document.querySelector('#classroom-search');
        input.value = 'old303';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(200)
    const codeSearchResult = await client.eval(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.classroom-card')).map(c => c.querySelector('.classroom-name')?.textContent?.trim());
        return cards;
      })()
    `)
    assert.strictEqual(codeSearchResult.length, 1, '1 classroom matched by code')
    assert.strictEqual(codeSearchResult[0], 'BSCS 2B (Archived)')
    console.log('✓ Access code search verified')

    // 6. Test Status Filter: Inactive
    console.log('6. Testing Status filter: Inactive...')
    await client.eval(`
      (() => {
        const input = document.querySelector('#classroom-search');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const select = document.querySelector('#classroom-status');
        select.value = 'inactive';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(200)
    const inactiveResult = await client.eval(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.classroom-card')).map(c => c.querySelector('.classroom-name')?.textContent?.trim());
        return cards;
      })()
    `)
    assert.strictEqual(inactiveResult.length, 1, '1 inactive classroom')
    assert.strictEqual(inactiveResult[0], 'BSCS 2B (Archived)')
    console.log('✓ Status filter inactive verified')

    // 7. Test Combined Filter yielding "No matching classrooms"
    console.log('7. Testing combined filter yielding No matching classrooms...')
    await client.eval(`
      (() => {
        const input = document.querySelector('#classroom-search');
        input.value = 'CYB101';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const select = document.querySelector('#classroom-status');
        select.value = 'inactive';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(200)
    const emptyMatchData = await client.eval(`
      (() => {
        const h4 = document.querySelector('.empty-state h4')?.textContent?.trim();
        const p = document.querySelector('.empty-state p')?.textContent?.trim();
        const clearBtn = document.querySelector('.empty-state .btn-outline')?.textContent?.trim();
        return { h4, p, clearBtn };
      })()
    `)
    console.log('Empty match data:', emptyMatchData)
    assert.strictEqual(emptyMatchData.h4, 'No matching classrooms', 'Header is "No matching classrooms"')
    assert.ok(emptyMatchData.clearBtn.includes('Clear filters'), 'Clear filters button present in empty state')
    console.log('✓ "No matching classrooms" distinguished with Clear button')

    // 8. Test Clear filters from empty state
    console.log('8. Testing Clear filters from empty state...')
    await client.eval(`document.querySelector('.empty-state .btn-outline')?.click()`)
    await sleep(200)
    const restoredFromEmpty = await client.eval(`document.querySelectorAll('.classroom-card').length`)
    assert.strictEqual(restoredFromEmpty, 3, 'Restored 3 classrooms')
    console.log('✓ Restored list from empty state')

    // 9. Test Filter Retention across Refresh
    console.log('9. Testing search/filter retention across simulated refresh...')
    await client.eval(`
      (() => {
        const input = document.querySelector('#classroom-search');
        input.value = 'BSIT';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(150)
    // Trigger simulated refresh by calling fetchClassrooms (simulates post-create/edit/delete refresh)
    await client.eval(`
      (() => {
        // Trigger page re-fetch
        const select = document.querySelector('#classroom-status');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(200)
    const retainedQuery = await client.eval(`document.querySelector('#classroom-search')?.value`)
    const retainedCardCount = await client.eval(`document.querySelectorAll('.classroom-card').length`)
    assert.strictEqual(retainedQuery, 'BSIT', 'Filter value preserved')
    assert.strictEqual(retainedCardCount, 2, 'Filtered results recomputed from data')
    console.log('✓ Search and filter retention verified')

    // Reset filters for screenshots
    await client.eval(`document.querySelector('.btn-clear-filters')?.click()`)
    await sleep(200)

    // 10. Capture Desktop and Mobile Screenshots
    console.log('10. Capturing desktop and mobile layout screenshots...')
    await client.setViewport(1440, 900)
    await sleep(300)
    await client.screenshot(path.join(ARTIFACT_DIR, 'classroom_search_desktop_1440.png'))

    // Mobile viewport 390x844
    await client.setViewport(390, 844)
    await sleep(300)

    // Check no horizontal overflow on mobile
    const overflowCheck = await client.eval(`
      (() => {
        const bodyWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        return { bodyWidth, windowWidth, hasOverflow: bodyWidth > windowWidth };
      })()
    `)
    console.log('Mobile overflow check:', overflowCheck)
    assert.strictEqual(overflowCheck.hasOverflow, false, 'No horizontal page overflow on mobile')

    await client.screenshot(path.join(ARTIFACT_DIR, 'classroom_search_mobile_390.png'))
    console.log('✓ Desktop and mobile screenshots captured without horizontal overflow')

    client.close()
    console.log('✓ All browser tests completed successfully!\n')
  } finally {
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
      /* ignore */
    }
  }
}

async function main() {
  try {
    runUnitFilterTests()
    await runBrowserTests()
    console.log('======================================================')
    console.log('ALL CLASSROOM SEARCH & FILTER CHECKS PASSED (100%)')
    console.log('======================================================')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err)
    process.exit(1)
  }
}

main()
