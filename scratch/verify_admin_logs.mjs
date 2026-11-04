/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Buffer } from 'node:buffer'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5198
const CDP_PORT = 9248
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-admin-logs-cdp-${Date.now()}`)
const ARTIFACT_DIR = 'C:/Users/licok/.gemini/antigravity/brain/bf7d1fc1-9e66-4899-ae20-f96344a21757'

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
      const res = await fetch(url)
      if (res.ok || res.status < 400) {
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
    console.log('[1/8] Starting Vite test server on port', TEST_PORT)
    viteProc = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(TEST_PORT), '--strictPort'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VITE_USE_MOCK: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    viteProc.stdout.on('data', (d) => {
      const str = d.toString()
      if (str.includes('ready in') || str.includes('Local:')) {
        console.log('Vite:', str.trim())
      }
    })
    viteProc.stderr.on('data', (d) => console.error('Vite err:', d.toString().trim()))

    const serverReady = await waitForServer(`${BASE_URL}/`)
    if (!serverReady) {
      throw new Error(`Server failed to start at ${BASE_URL}`)
    }
    console.log('Server ready at', BASE_URL)

    console.log('[2/8] Launching Headless Chrome on CDP port', CDP_PORT)
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
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1440,900',
        'about:blank',
      ],
      { stdio: 'ignore' }
    )

    let pageCdp = null
    for (let i = 0; i < 20; i++) {
      try {
        const browserWs = await getCDPWebSocketUrl(CDP_PORT)
        const cdp = new CDPClient(browserWs)
        await cdp.connect()
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
        const targetWs = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`
        pageCdp = new CDPClient(targetWs)
        await pageCdp.connect()
        await pageCdp.send('Page.enable')
        await pageCdp.send('Runtime.enable')
        break
      } catch {
        await sleep(250)
      }
    }
    if (!pageCdp) throw new Error('Failed to connect to Chrome CDP')

    console.log('[3/8] Setting up Admin Session & Loading /admin/logs...')
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
      sessionStorage.clear();
    `)

    await pageCdp.setViewport(1440, 900)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs` })
    await sleep(1500)

    console.log('[4/8] Testing Clean UI: No Fluff Text, No Big Banners, Timestamp Labels Retained...')
    const initialCheck = await pageCdp.evaluate(`
      (() => {
        const labelEl = document.querySelector('label[for="performed-by-filter"]');
        const inputEl = document.querySelector('#performed-by-filter');
        const hintEl = document.querySelector('#actor-filter-hint');
        const tzNotice = document.querySelector('.table-timezone-notice');
        const activeFilterBanner = document.querySelector('.active-filter-indicator');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const applyBtn = document.querySelector('.btn-apply-actor');
        const select = document.querySelector('#action-filter');
        const thActor = document.querySelector('.th-actor');

        const thTime = document.querySelector('.th-time');
        const firstTimeFormatted = document.querySelector('.logs-table tbody tr .time-formatted')?.textContent?.trim();

        // Check timestamp cells in table
        const timeSubtexts = Array.from(document.querySelectorAll('.time-status-subtext')).map(el => el.textContent.trim());

        const sRect = select.getBoundingClientRect();
        const iRect = inputEl.getBoundingClientRect();
        const aRect = applyBtn.getBoundingClientRect();

        return {
          labelText: labelEl ? labelEl.textContent.trim() : '',
          placeholder: inputEl ? inputEl.getAttribute('placeholder') : '',
          hasHintText: Boolean(hintEl),
          hasTzNotice: Boolean(tzNotice),
          hasActiveFilterBanner: Boolean(activeFilterBanner),
          hasAppliedIndicator: Boolean(appliedIndicator),
          timeSubtexts,
          thTimeText: thTime ? thTime.textContent.trim() : '',
          firstTimeFormatted,
          thActorText: thActor ? thActor.textContent.trim() : '',
          applyDisabled: applyBtn ? applyBtn.disabled : false,
          applyGradient: window.getComputedStyle(applyBtn).backgroundImage,
          aligned: Math.abs(sRect.bottom - iRect.bottom) < 2 && Math.abs(iRect.bottom - aRect.bottom) < 2,
        };
      })()
    `)
    console.log('Initial UI state:', initialCheck)
    assert.equal(initialCheck.labelText, 'Performed by')
    assert.equal(initialCheck.placeholder, 'Search email or name')
    assert.equal(initialCheck.hasHintText, false, 'Redundant hint text "Find actions performed by a specific account" must be removed')
    assert.equal(initialCheck.hasTzNotice, false, 'Large timezone explanation banner must be removed')
    assert.equal(initialCheck.hasActiveFilterBanner, false, 'Active filter banner must be removed')
    assert.equal(initialCheck.hasAppliedIndicator, false, 'Applied indicator must be hidden when no filter is active')
    assert.equal(initialCheck.thTimeText, 'Timestamp (PHT)', 'Table column header must be "Timestamp (PHT)"')
    assert.equal(initialCheck.timeSubtexts.some(t => t.includes('Timezone') || t.includes('Local')), false, 'Valid rows must not display repeated timezone subtexts')
    assert.deepEqual(initialCheck.timeSubtexts, ['Date unavailable'], 'Only the malformed log row displays Date unavailable subtext')
    assert.ok(initialCheck.firstTimeFormatted, 'First row must render formatted PHT timestamp')
    assert.equal(initialCheck.thActorText, 'Performed by')
    assert.equal(initialCheck.applyDisabled, true, 'Apply button must be disabled when no pending selection')
    assert.equal(initialCheck.aligned, true, 'Controls must have matching baseline alignment')

    console.log('[5/8] Testing Debounced Account Lookup & Duplicate Names...')
    // 1 char -> no dropdown
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'a';
        input.dispatchEvent(new Event('input'));
      })()
    `)
    await sleep(350)
    const oneCharCheck = await pageCdp.evaluate(`Boolean(document.querySelector('#performed-by-suggestions'))`)
    assert.equal(oneCharCheck, false, '1 char should not open suggestions dropdown')

    // Search "alex" -> triggers after 300ms debounce
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'alex';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(600)

    const debugState = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const dropdown = document.querySelector('#performed-by-suggestions');
        return {
          inputValue: input ? input.value : null,
          dropdownHtml: dropdown ? dropdown.outerHTML : null,
          allDropdowns: Array.from(document.querySelectorAll('.suggestions-dropdown')).length,
        };
      })()
    `)
    console.log('DEBUG STATE:', debugState)

    const alexCheck = await pageCdp.evaluate(`
      (() => {
        const dropdown = document.querySelector('#performed-by-suggestions');
        const items = Array.from(document.querySelectorAll('.suggestion-item')).map(item => ({
          email: item.querySelector('.user-email')?.textContent?.trim(),
          role: item.querySelector('.user-role-badge')?.textContent?.trim(),
          name: item.querySelector('.user-name')?.textContent?.trim(),
        }));
        return {
          isOpen: Boolean(dropdown),
          items,
        };
      })()
    `)
    console.log('Duplicate names lookup results for "alex":', alexCheck)
    assert.equal(alexCheck.isOpen, true, 'Suggestions dropdown must open')
    assert.equal(alexCheck.items.length, 2, 'Should find two matching accounts for "alex"')
    const [u1, u2] = alexCheck.items
    assert.equal(u1.name, 'Alex Santos')
    assert.equal(u2.name, 'Alex Santos')
    assert.notEqual(u1.email, u2.email, 'Duplicate names must be distinguishable by different emails')
    const alexEmails = [u1.email, u2.email]
    assert(alexEmails.includes('alex.santos@dnsc.edu.ph'))
    assert(alexEmails.includes('alex.player@example.com'))

    console.log('[6/8] Testing Pagination ("Load more accounts") & Keyboard Navigation...')
    // Search "ph" which matches 8 accounts in mockAdminUsers (page size 5, total 8)
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'ph';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(600)

    const paginationCheck = await pageCdp.evaluate(`
      (() => {
        const items = document.querySelectorAll('.suggestion-item');
        const loadMoreBtn = document.querySelector('.btn-load-more');
        return {
          itemCount: items.length,
          hasLoadMore: Boolean(loadMoreBtn),
          loadMoreText: loadMoreBtn ? loadMoreBtn.textContent.trim() : '',
        };
      })()
    `)
    console.log('Pagination check:', paginationCheck)
    assert.equal(paginationCheck.itemCount, 5, 'Initial page size should be 5')
    assert.equal(paginationCheck.hasLoadMore, true, 'Load more button must appear when total > 5')
    assert.match(paginationCheck.loadMoreText, /Load more accounts \(5 of 8\)/)

    // Click Load more accounts
    await pageCdp.evaluate(`document.querySelector('.btn-load-more')?.click()`)
    await sleep(400)
    const afterLoadMore = await pageCdp.evaluate(`
      (() => {
        const items = document.querySelectorAll('.suggestion-item');
        const loadMoreBtn = document.querySelector('.btn-load-more');
        return {
          itemCount: items.length,
          hasLoadMore: Boolean(loadMoreBtn),
        };
      })()
    `)
    console.log('After load more:', afterLoadMore)
    assert.equal(afterLoadMore.itemCount, 8, 'Should append second page results')
    assert.equal(afterLoadMore.hasLoadMore, false, 'Load more button should disappear when all accounts loaded')

    // Test Keyboard navigation (ArrowDown, Escape, Enter)
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      })()
    `)
    await sleep(150)
    const keyNav1 = await pageCdp.evaluate(`
      (() => {
        const item = document.querySelector('.suggestion-item.is-highlighted');
        return item ? item.querySelector('.user-email')?.textContent?.trim() : null;
      })()
    `)
    console.log('Key nav highlighted:', keyNav1)
    assert(keyNav1, 'An item should be highlighted after ArrowDown')

    // Escape closes dropdown
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      })()
    `)
    await sleep(150)
    const isOpenAfterEsc = await pageCdp.evaluate(`Boolean(document.querySelector('#performed-by-suggestions'))`)
    assert.equal(isOpenAfterEsc, false, 'Escape must close suggestions dropdown')

    console.log('[7/8] Testing Explicit Selection, Apply, Compact Differing Indicator & Historical Actor...')
    // Re-focus and type "delacruz"
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'delacruz';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(600)

    // Select account via click
    await pageCdp.evaluate(`
      (() => {
        const item = document.querySelector('.suggestion-item');
        item.click();
      })()
    `)
    await sleep(300)

    const pendingCheck = await pageCdp.evaluate(`
      (() => {
        const applyBtn = document.querySelector('.btn-apply-actor');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const url = window.location.search;
        return {
          applyDisabled: applyBtn.disabled,
          hasAppliedIndicator: Boolean(appliedIndicator),
          url,
        };
      })()
    `)
    console.log('Pending selection state:', pendingCheck)
    assert.equal(pendingCheck.applyDisabled, false, 'Apply button should be enabled')
    assert.equal(pendingCheck.hasAppliedIndicator, false, 'Applied indicator must be hidden before any filter was active')
    assert.equal(pendingCheck.url, '', 'Selecting account must NOT change URL or send request before clicking Apply')

    // Click Apply
    await pageCdp.evaluate(`document.querySelector('.btn-apply-actor')?.click()`)
    await sleep(600)

    const appliedCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const oldBanner = document.querySelector('.active-filter-indicator');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const url = window.location.search;
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
        }));
        return {
          inputValue: input ? input.value : '',
          hasOldBanner: Boolean(oldBanner),
          hasAppliedIndicator: Boolean(appliedIndicator),
          url,
          rows,
        };
      })()
    `)
    console.log('Applied filter state:', appliedCheck)
    assert.equal(appliedCheck.hasOldBanner, false, 'Old bulky banner must never exist')
    assert.equal(appliedCheck.hasAppliedIndicator, false, 'Applied indicator must be hidden when input represents applied account')
    assert.match(appliedCheck.inputValue, /prof\.delacruz@dnsc\.edu\.ph/, 'Picker input must display the applied account email')
    assert.match(appliedCheck.url, /user_id=00000000-0000-0000-0000-000000000005/)
    assert(appliedCheck.rows.length > 0)
    appliedCheck.rows.forEach(r => {
      assert.equal(r.actorEmail, 'prof.delacruz@dnsc.edu.ph')
    })

    // Now test: unapplied search differing from active filter -> compact indicator appears!
    console.log('Testing unapplied search differing from active filter...')
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'alex';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(400)

    const differingCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        return {
          hasIndicator: Boolean(appliedIndicator),
          indicatorText: appliedIndicator ? appliedIndicator.textContent.trim() : '',
          ariaDescribedBy: input ? input.getAttribute('aria-describedby') : null,
        };
      })()
    `)
    console.log('Differing search state:', differingCheck)
    assert.equal(differingCheck.hasIndicator, true, 'Compact indicator must appear when picker differs from active filter')
    assert.equal(differingCheck.indicatorText, 'Applied: prof.delacruz@dnsc.edu.ph')
    assert.equal(differingCheck.ariaDescribedBy, 'actor-filter-applied', 'Input must have aria-describedby pointing to applied indicator')

    // Restore input back to applied email -> compact indicator hides!
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'prof.delacruz@dnsc.edu.ph';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(300)
    const restoredCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        return {
          hasIndicator: Boolean(appliedIndicator),
          ariaDescribedBy: input ? input.getAttribute('aria-describedby') : null,
        };
      })()
    `)
    assert.equal(restoredCheck.hasIndicator, false, 'Compact indicator must hide when picker represents applied account')
    assert.equal(restoredCheck.ariaDescribedBy, null, 'aria-describedby must be removed when indicator hidden')

    // Clear filters
    await pageCdp.evaluate(`document.querySelector('.btn-clear-filters')?.click()`)
    await sleep(600)
    const afterClear = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        return {
          url: window.location.search,
          inputVal: input ? input.value : '',
          hasIndicator: Boolean(appliedIndicator),
        };
      })()
    `)
    assert.equal(afterClear.url, '', 'Clearing filters must reset URL')
    assert.equal(afterClear.inputVal, '', 'Clearing filters must clear picker')
    assert.equal(afterClear.hasIndicator, false, 'No indicator after clearing filters')

    // Test Row-Level Historical Actor filtering
    console.log('Testing Row-Level Historical Actor click...')
    const historicalRowClicked = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr'));
        const historicalRow = rows.find(r => r.querySelector('.actor-email')?.textContent?.includes('historical.instructor'));
        if (!historicalRow) return false;
        const btn = historicalRow.querySelector('.btn-actor-filter');
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `)
    assert.equal(historicalRowClicked, true, 'Historical actor row should be found and clicked')
    await sleep(600)

    const historicalCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const oldBanner = document.querySelector('.active-filter-indicator');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const url = window.location.search;
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
        }));
        return {
          inputValue: input ? input.value : '',
          hasOldBanner: Boolean(oldBanner),
          hasAppliedIndicator: Boolean(appliedIndicator),
          url,
          rows,
        };
      })()
    `)
    console.log('Historical actor filtered state:', historicalCheck)
    assert.equal(historicalCheck.hasOldBanner, false, 'No bulky banner for historical actor')
    assert.equal(historicalCheck.hasAppliedIndicator, false, 'No differing indicator when picker represents historical actor')
    assert.equal(historicalCheck.inputValue, 'historical.instructor@dnsc.edu.ph', 'Picker displays historical actor email')
    assert.match(historicalCheck.url, /user_id=00000000-0000-0000-0000-000000000099/)
    assert.equal(historicalCheck.rows.length, 1)
    assert.equal(historicalCheck.rows[0].actorEmail, 'historical.instructor@dnsc.edu.ph')

    // Differing search on historical actor
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'query';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(300)
    const histDiffering = await pageCdp.evaluate(`
      (() => {
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        return appliedIndicator ? appliedIndicator.textContent.trim() : '';
      })()
    `)
    assert.equal(histDiffering, 'Applied: historical.instructor@dnsc.edu.ph')

    // Test clear filters button resets both action and user
    await pageCdp.evaluate(`
      (() => {
        const select = document.querySelector('#action-filter');
        select.value = 'user_login';
        select.dispatchEvent(new Event('change'));
      })()
    `)
    await sleep(400)
    await pageCdp.evaluate(`document.querySelector('.btn-clear-filters')?.click()`)
    await sleep(500)
    const afterClearAll = await pageCdp.evaluate(`
      (() => {
        const select = document.querySelector('#action-filter');
        const input = document.querySelector('#performed-by-filter');
        const indicator = document.querySelector('#actor-filter-applied');
        const oldBanner = document.querySelector('.active-filter-indicator');
        return {
          selectVal: select.value,
          inputVal: input.value,
          hasIndicator: Boolean(indicator || oldBanner),
          url: window.location.search,
        };
      })()
    `)
    console.log('After clear filters:', afterClearAll)
    assert.equal(afterClearAll.selectVal, '')
    assert.equal(afterClearAll.inputVal, '')
    assert.equal(afterClearAll.hasIndicator, false)
    assert.equal(afterClearAll.url, '')

    // Test Lookup Failure State
    console.log('Testing Lookup Failure State & Retry...')
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_USERS__', '1');
      const input = document.querySelector('#performed-by-filter');
      input.value = 'failtest';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `)
    await sleep(600)

    const failCheck = await pageCdp.evaluate(`
      (() => {
        const errEl = document.querySelector('.suggestion-error');
        const retryBtn = document.querySelector('.btn-retry-lookup');
        return {
          hasError: Boolean(errEl),
          errText: errEl ? errEl.textContent.trim() : '',
          hasRetry: Boolean(retryBtn),
        };
      })()
    `)
    console.log('Lookup failure state:', failCheck)
    assert.equal(failCheck.hasError, true)
    assert.match(failCheck.errText, /Account directory lookup unavailable/)
    assert.equal(failCheck.hasRetry, true)

    // Unset failure flag and click Retry
    await pageCdp.evaluate(`
      sessionStorage.removeItem('__CYBERMORPH_FAIL_ADMIN_USERS__');
      document.querySelector('.btn-retry-lookup')?.click();
    `)
    await sleep(600)
    const afterRetry = await pageCdp.evaluate(`
      (() => {
        const errEl = document.querySelector('.suggestion-error');
        const dropdown = document.querySelector('#performed-by-suggestions');
        return {
          hasError: Boolean(errEl),
          dropdownOpen: Boolean(dropdown),
        };
      })()
    `)
    console.log('After retry:', afterRetry)
    assert.equal(afterRetry.hasError, false, 'Error should clear on successful retry')

    console.log('[8/8] Testing Desktop (1440px) & Mobile (390px) Layout with Screenshots...')
    // Desktop screenshot with clean applied state
    await pageCdp.setViewport(1440, 900)
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'admin@cybermorph.local';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(600)
    await pageCdp.evaluate(`
      (() => {
        const item = document.querySelector('.suggestion-item');
        if (item) item.click();
        const applyBtn = document.querySelector('.btn-apply-actor');
        if (applyBtn) applyBtn.click();
      })()
    `)
    await sleep(600)
    // Expand first row with description for visual review
    await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        if (toggleBtn) toggleBtn.click();
      })()
    `)
    await sleep(400)
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'admin_logs_desktop_1440.png')
    await pageCdp.screenshot(desktopScreenshotPath)
    console.log('✔ Desktop screenshot saved to', desktopScreenshotPath)

    // Mobile layout
    await pageCdp.setViewport(390, 844)
    await sleep(500)

    const mobileCheck = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > docWidth,
        };
      })()
    `)
    console.log('Mobile Check (390px):', mobileCheck)
    assert.equal(mobileCheck.hasHorizontalOverflow, false, 'Mobile viewport must not have document horizontal overflow')

    // Test Enlarged Text on mobile
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
          hasHorizontalOverflow: scrollWidth > docWidth,
        };
      })()
    `)
    console.log('Enlarged Text Check on Mobile:', enlargedCheck)
    assert.equal(enlargedCheck.hasHorizontalOverflow, false, 'Enlarged text must not cause horizontal blowout')

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'admin_logs_mobile_390.png')
    await pageCdp.screenshot(mobileScreenshotPath)
    console.log('✔ Mobile screenshot saved to', mobileScreenshotPath)

    await pageCdp.evaluate(`
      document.documentElement.removeAttribute('data-text-size');
    `)

    console.log('[9/9] Testing Account-Filter Restoration & Contract Alignment...')
    // Track requests to /admin/users by instrumenting XMLHttpRequest
    await pageCdp.evaluate(`
      (() => {
        window.__capturedUserSearches = [];
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          if (typeof url === 'string' && url.includes('/admin/users')) {
            window.__capturedUserSearches.push(url);
          }
          return origOpen.call(this, method, url, ...rest);
        };
      })()
    `)

    // Subtest A: Filtered-URL reload with matching logs
    console.log('Subtest A: Filtered-URL reload with matching logs...')
    const matchingUserId = '00000000-0000-0000-0000-000000000005'
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs?user_id=${matchingUserId}` })
    await sleep(1500)

    const subtestACheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
        }));
        const userSearches = window.__capturedUserSearches || [];
        return {
          inputValue: input ? input.value : '',
          appliedIndicatorText: appliedIndicator ? appliedIndicator.textContent.trim() : null,
          userSearches,
          hasRows: rows.length > 0,
          allRowsMatch: rows.every(r => r.actorEmail === 'prof.delacruz@dnsc.edu.ph'),
        };
      })()
    `)
    console.log('Subtest A state:', subtestACheck)
    const uuidSearchesA = subtestACheck.userSearches.filter(url => url.includes(matchingUserId))
    assert.equal(uuidSearchesA.length, 0, 'No UUID directory-search request should ever be sent')
    assert.equal(subtestACheck.inputValue, 'prof.delacruz@dnsc.edu.ph', 'Readable label must be resolved from returned logs')
    assert.equal(subtestACheck.hasRows, true, 'Matching logs should be displayed')
    assert.equal(subtestACheck.allRowsMatch, true, 'All returned rows must match actor')

    // Subtest B: Filtered-URL reload with NO matching logs
    console.log('Subtest B: Filtered-URL reload with NO matching logs...')
    const emptyUserId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs?user_id=${emptyUserId}` })
    await sleep(1500)

    const subtestBCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        const url = window.location.search;
        const emptyState = document.querySelector('.empty-state');
        const userSearches = window.__capturedUserSearches || [];
        return {
          inputValue: input ? input.value : '',
          appliedIndicatorText: appliedIndicator ? appliedIndicator.textContent.trim() : null,
          url,
          hasEmptyState: Boolean(emptyState),
          userSearches,
        };
      })()
    `)
    console.log('Subtest B state:', subtestBCheck)
    const uuidSearchesB = subtestBCheck.userSearches.filter(url => url.includes(emptyUserId))
    assert.equal(uuidSearchesB.length, 0, 'No UUID directory-search request should ever be sent for empty user')
    assert.equal(subtestBCheck.inputValue, emptyUserId, 'UUID must be retained as fallback when no label is available')
    assert.equal(subtestBCheck.hasEmptyState, true, 'Empty state shown when no logs match')
    assert.match(subtestBCheck.url, new RegExp(`user_id=${emptyUserId}`), 'Valid filter and URL must be preserved')

    // Subtest C: Back/Forward navigation
    console.log('Subtest C: Back/Forward navigation...')
    await pageCdp.evaluate(`window.history.back()`)
    await sleep(1500)
    const subtestCCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const url = window.location.search;
        return {
          inputValue: input ? input.value : '',
          url,
        };
      })()
    `)
    console.log('Subtest C (after back):', subtestCCheck)
    assert.match(subtestCCheck.url, new RegExp(`user_id=${matchingUserId}`), 'Back navigation must restore previous user_id')
    assert.equal(subtestCCheck.inputValue, 'prof.delacruz@dnsc.edu.ph', 'Back navigation must restore resolved label')

    // Subtest D: Unapplied typed search text remains separate from applied filter
    console.log('Subtest D: Unapplied typed search text remains separate...')
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'typed_unapplied_text';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(400)
    // Trigger log refresh while input has unapplied text
    await pageCdp.evaluate(`document.querySelector('.btn-refresh')?.click()`)
    await sleep(800)

    const subtestDCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const appliedIndicator = document.querySelector('#actor-filter-applied');
        return {
          inputValue: input ? input.value : '',
          appliedText: appliedIndicator ? appliedIndicator.textContent.trim() : '',
        };
      })()
    `)
    console.log('Subtest D state:', subtestDCheck)
    assert.equal(subtestDCheck.inputValue, 'typed_unapplied_text', 'Delayed logs response must not overwrite typed input')
    assert.equal(subtestDCheck.appliedText, 'Applied: prof.delacruz@dnsc.edu.ph', 'Active filter indicator must display resolved applied label')

    console.log('[10/10] Testing Request-Lifecycle Fixes & Concurrency Robustness...')

    // 10A: Delayed search followed by clearing input must not reopen suggestions
    console.log('Test 10A: Delayed search followed by clearing input must not reopen suggestions...')
    await pageCdp.evaluate(`
      sessionStorage.setItem('__CYBERMORPH_DELAY_ADMIN_USERS__', '600');
      const input = document.querySelector('#performed-by-filter');
      input.value = 'alex';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `)
    // Wait for the 300ms debounce to fire and request to enter flight
    await sleep(350)
    // Clear input while search is in flight
    await pageCdp.evaluate(`
      const clearBtn = document.querySelector('.btn-clear-input');
      if (clearBtn) {
        clearBtn.click();
      } else {
        const input = document.querySelector('#performed-by-filter');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `)
    // Input is cleared immediately and dropdown is closed
    const immediateClearCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const dropdown = document.querySelector('#performed-by-suggestions');
        return {
          val: input ? input.value : null,
          hasDropdown: Boolean(dropdown),
        };
      })()
    `)
    assert.equal(immediateClearCheck.val, '')
    assert.equal(immediateClearCheck.hasDropdown, false, 'Dropdown must close immediately upon clearing')

    // Wait for the delayed search to resolve (600ms delay + buffer)
    await sleep(750)

    const delayedAfterClearCheck = await pageCdp.evaluate(`
      (() => {
        const dropdown = document.querySelector('#performed-by-suggestions');
        const items = document.querySelectorAll('.suggestion-item');
        return {
          hasDropdown: Boolean(dropdown),
          itemCount: items.length,
        };
      })()
    `)
    console.log('State after delayed search finishes (10A):', delayedAfterClearCheck)
    assert.equal(delayedAfterClearCheck.hasDropdown, false, 'Stale search must not reopen dropdown after input was cleared')
    assert.equal(delayedAfterClearCheck.itemCount, 0, 'Suggestions list must remain empty')
    await pageCdp.evaluate(`sessionStorage.removeItem('__CYBERMORPH_DELAY_ADMIN_USERS__')`)

    // 10B: Delayed search followed by UUID input must not overwrite that selection
    console.log('Test 10B: Delayed search followed by UUID input must not overwrite that selection...')
    const testUuid = '00000000-0000-0000-0000-000000000001'
    // Start debounced search with 600ms delay
    await pageCdp.evaluate(`
      (() => {
        sessionStorage.setItem('__CYBERMORPH_DELAY_ADMIN_USERS__', '600');
        const input = document.querySelector('#performed-by-filter');
        input.value = 'alex';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(350) // debounce fires, request in flight

    // Paste UUID into input while search is in flight
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = '${testUuid}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)

    const uuidStagedCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const applyBtn = document.querySelector('.btn-apply-actor');
        const dropdown = document.querySelector('#performed-by-suggestions');
        return {
          val: input.value,
          applyDisabled: applyBtn ? applyBtn.disabled : true,
          hasDropdown: Boolean(dropdown),
        };
      })()
    `)
    assert.equal(uuidStagedCheck.val, testUuid)
    assert.equal(uuidStagedCheck.applyDisabled, false, 'UUID selection must be staged and enable Apply')
    assert.equal(uuidStagedCheck.hasDropdown, false, 'Dropdown should be closed for UUID input')

    // Wait for the delayed "alex" search to resolve
    await sleep(750)

    const uuidAfterDelayedCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const applyBtn = document.querySelector('.btn-apply-actor');
        const dropdown = document.querySelector('#performed-by-suggestions');
        return {
          val: input.value,
          applyDisabled: applyBtn ? applyBtn.disabled : true,
          hasDropdown: Boolean(dropdown),
        };
      })()
    `)
    console.log('State after delayed search finishes (10B):', uuidAfterDelayedCheck)
    assert.equal(uuidAfterDelayedCheck.val, testUuid, 'UUID in input must not be overwritten by stale search')
    assert.equal(uuidAfterDelayedCheck.applyDisabled, false, 'UUID selection remains staged')
    assert.equal(uuidAfterDelayedCheck.hasDropdown, false, 'Stale search must not reopen dropdown over UUID selection')

    // Apply the UUID filter and verify it works
    await pageCdp.evaluate(`document.querySelector('.btn-apply-actor')?.click()`)
    await sleep(600)
    const afterUuidApply = await pageCdp.evaluate(`
      (() => {
        const url = window.location.search;
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
        }));
        return { url, rows };
      })()
    `)
    assert.match(afterUuidApply.url, new RegExp(`user_id=${testUuid}`))
    assert(afterUuidApply.rows.length > 0)
    assert(afterUuidApply.rows.every(r => r.actorEmail === 'admin@cybermorph.local'))

    // Clear delays and filters
    await pageCdp.evaluate(`
      sessionStorage.removeItem('__CYBERMORPH_DELAY_ADMIN_USERS__');
      document.querySelector('.btn-clear-filters')?.click();
    `)
    await sleep(600)

    // 10C: Logout during pending requests must not start another protected request or restore stale account data
    console.log('Test 10C: Logout during pending requests must not start another protected request...')
    await pageCdp.evaluate(`
      (() => {
        sessionStorage.setItem('__CYBERMORPH_DELAY_ADMIN_LOGS__', '800');
        sessionStorage.setItem('__CYBERMORPH_DELAY_ADMIN_USERS__', '800');
        const input = document.querySelector('#performed-by-filter');
        input.value = 'alex';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-refresh')?.click();
      })()
    `)
    await sleep(350) // debounced search + refresh in flight

    const logsCallsBeforeLogout = await pageCdp.evaluate(`window.__cybermorphAdminLogsCalls || 0`)

    // Click logout
    await pageCdp.evaluate(`
      (() => {
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) logoutBtn.click();
      })()
    `)
    await sleep(200)
    await pageCdp.evaluate(`
      (() => {
        const confirmBtn = document.querySelector('.btn-confirm-signout');
        if (confirmBtn) confirmBtn.click();
      })()
    `)
    await sleep(300)

    const logsCallsImmediatelyAfterLogout = await pageCdp.evaluate(`window.__cybermorphAdminLogsCalls || 0`)
    assert.equal(
      logsCallsImmediatelyAfterLogout,
      logsCallsBeforeLogout,
      'Logout must not trigger another protected request to /admin/logs',
    )

    // Wait for the delayed in-flight requests (800ms) to resolve
    await sleep(1000)

    const logsCallsAfterDelay = await pageCdp.evaluate(`window.__cybermorphAdminLogsCalls || 0`)
    assert.equal(
      logsCallsAfterDelay,
      logsCallsBeforeLogout,
      'No protected requests should have been triggered after logout',
    )

    // Verify account-specific data was NOT restored by stale response
    const loggedOutState = await pageCdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('.logs-table tbody tr');
        const input = document.querySelector('#performed-by-filter');
        const dropdown = document.querySelector('#performed-by-suggestions');
        const err = document.querySelector('.suggestion-error, .page-error-banner, [role="alert"]');
        return {
          hasRows: rows.length > 0,
          inputVal: input ? input.value : null,
          hasDropdown: Boolean(dropdown),
          hasError: Boolean(err),
          token: localStorage.getItem('cyber_token'),
        };
      })()
    `)
    console.log('Logged out state after delayed responses resolve (10C):', loggedOutState)
    assert.equal(loggedOutState.token, null, 'User must be signed out')
    assert.equal(loggedOutState.hasRows, false, 'Stale logs response must not populate table after logout')
    assert.equal(loggedOutState.hasDropdown, false, 'Stale user search response must not open suggestions after logout')
    assert.equal(loggedOutState.hasError, false, 'Stale error responses must not be displayed after logout')

    await pageCdp.evaluate(`
      sessionStorage.removeItem('__CYBERMORPH_DELAY_ADMIN_LOGS__');
      sessionStorage.removeItem('__CYBERMORPH_DELAY_ADMIN_USERS__');
    `)

    // 10D: Re-login as Admin and confirm normal search and filter restoration still work
    console.log('Test 10D: Re-login as Admin & Confirm normal search and filter restoration still work...')
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
      sessionStorage.clear();
    `)
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs` })
    await sleep(1500)

    // Test normal search works
    await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        input.value = 'alex';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `)
    await sleep(600)
    const normalSearchCheck = await pageCdp.evaluate(`
      (() => {
        const dropdown = document.querySelector('#performed-by-suggestions');
        const items = document.querySelectorAll('.suggestion-item');
        return {
          hasDropdown: Boolean(dropdown),
          itemCount: items.length,
        };
      })()
    `)
    console.log('Normal search check after re-login:', normalSearchCheck)
    assert.equal(normalSearchCheck.hasDropdown, true, 'Dropdown must open on valid search')
    assert.equal(normalSearchCheck.itemCount, 2, 'Should find 2 accounts for "alex"')

    // Test URL filter restoration still works
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs?user_id=${matchingUserId}` })
    await sleep(1500)
    const urlRestorationCheck = await pageCdp.evaluate(`
      (() => {
        const input = document.querySelector('#performed-by-filter');
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr')).map(r => ({
          actorEmail: r.querySelector('.actor-email')?.textContent?.trim(),
        }));
        return {
          inputValue: input ? input.value : '',
          rowsCount: rows.length,
          allMatch: rows.every(r => r.actorEmail === 'prof.delacruz@dnsc.edu.ph'),
        };
      })()
    `)
    console.log('URL filter restoration check after re-login:', urlRestorationCheck)
    assert.equal(urlRestorationCheck.inputValue, 'prof.delacruz@dnsc.edu.ph', 'Resolved account label must be restored')
    assert(urlRestorationCheck.rowsCount > 0, 'Rows must be loaded for restored filter')
    assert.equal(urlRestorationCheck.allMatch, true, 'All rows must match restored actor')

    console.log('[11/11] Testing Expandable Row Details, Plain Text Safety & Expansion State Lifecycles...')
    // Navigate to /admin/logs without filters
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/admin/logs` })
    await sleep(1500)

    // 1. Column header check: exactly 4 columns, no Description column
    const headersCheck = await pageCdp.evaluate(`
      (() => {
        const ths = Array.from(document.querySelectorAll('.logs-table thead th')).map(th => th.textContent.trim());
        const hasThDesc = Boolean(document.querySelector('.th-desc'));
        const hasTdDesc = document.querySelectorAll('.td-desc').length;
        return { ths, hasThDesc, hasTdDesc };
      })()
    `)
    console.log('Table Headers Check:', headersCheck)
    assert.deepEqual(headersCheck.ths, ['Timestamp (PHT)', 'Performed by', 'Action', 'Affected resource'])
    assert.equal(headersCheck.hasThDesc, false, 'Description table header must be removed')
    assert.equal(headersCheck.hasTdDesc, 0, 'No td-desc elements should exist')

    // 2. Check toggle presence on rows with description and absence on null description
    const togglePresenceCheck = await pageCdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.logs-table tbody tr.log-row'));
        const toggles = document.querySelectorAll('.btn-details-toggle');
        const descMissing = document.querySelectorAll('.desc-missing');
        return {
          totalRows: rows.length,
          togglesCount: toggles.length,
          descMissingCount: descMissing.length,
        };
      })()
    `)
    console.log('Toggle Presence Check:', togglePresenceCheck)
    assert(togglePresenceCheck.togglesCount > 0, 'Rows with description must render details toggle')
    assert.equal(togglePresenceCheck.descMissingCount, 0, 'No missing-description sentences should be rendered')

    // 3. Expand and collapse without additional requests
    const callsBeforeExpand = await pageCdp.evaluate(`window.__cybermorphAdminLogsCalls || 0`)

    // Expand first row
    const initialToggleState = await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        if (!toggleBtn) return null;
        toggleBtn.focus();
        const initialText = toggleBtn.textContent.trim();
        const initialAria = toggleBtn.getAttribute('aria-expanded');
        const ariaControls = toggleBtn.getAttribute('aria-controls');
        toggleBtn.click();
        return { initialText, initialAria, ariaControls };
      })()
    `)
    await sleep(250) // allow Vue reactivity to patch DOM

    const expandResult = await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        const afterClickText = toggleBtn ? toggleBtn.textContent.trim() : null;
        const afterClickAria = toggleBtn ? toggleBtn.getAttribute('aria-expanded') : null;
        const isFocused = document.activeElement === toggleBtn;

        const detailRow = document.querySelector('.log-detail-row');
        const detailCell = detailRow ? detailRow.querySelector('.td-details') : null;
        const detailId = detailCell ? detailCell.getAttribute('id') : null;
        const colspan = detailCell ? detailCell.getAttribute('colspan') : null;
        const detailLabel = detailCell ? detailCell.querySelector('.detail-label')?.textContent?.trim() : null;
        const detailText = detailCell ? detailCell.querySelector('.detail-text')?.textContent?.trim() : null;

        return {
          afterClickText,
          afterClickAria,
          isFocused,
          hasDetailRow: Boolean(detailRow),
          detailId,
          colspan,
          detailLabel,
          hasDetailText: Boolean(detailText),
        };
      })()
    `)
    console.log('Expand Result:', { ...initialToggleState, ...expandResult })
    assert.equal(initialToggleState.initialText, 'View details')
    assert.equal(initialToggleState.initialAria, 'false')
    assert.equal(expandResult.afterClickText, 'Hide details')
    assert.equal(expandResult.afterClickAria, 'true')
    assert.equal(expandResult.isFocused, true, 'Focus must remain on the toggle button')
    assert.equal(expandResult.hasDetailRow, true, 'Detail row must appear when expanded')
    assert.equal(expandResult.colspan, '4', 'Detail cell must span all 4 columns')
    assert.equal(initialToggleState.ariaControls, expandResult.detailId, 'aria-controls must point to detail cell ID')
    assert.equal(expandResult.detailLabel, 'Description')
    assert.equal(expandResult.hasDetailText, true)

    // Check no additional API request was made
    const callsAfterExpand = await pageCdp.evaluate(`window.__cybermorphAdminLogsCalls || 0`)
    assert.equal(callsAfterExpand, callsBeforeExpand, 'Expanding row details must NOT trigger an API request')

    // 4. Collapse row
    await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        toggleBtn.focus();
        toggleBtn.click();
      })()
    `)
    await sleep(250)

    const collapseResult = await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        const text = toggleBtn ? toggleBtn.textContent.trim() : null;
        const aria = toggleBtn ? toggleBtn.getAttribute('aria-expanded') : null;
        const isFocused = document.activeElement === toggleBtn;
        const detailRow = document.querySelector('.log-detail-row');
        return { text, aria, isFocused, hasDetailRow: Boolean(detailRow) };
      })()
    `)
    console.log('Collapse Result:', collapseResult)
    assert.equal(collapseResult.text, 'View details')
    assert.equal(collapseResult.aria, 'false')
    assert.equal(collapseResult.isFocused, true, 'Focus must remain on toggle button after collapse')
    assert.equal(collapseResult.hasDetailRow, false, 'Detail row must be removed upon collapse')

    // 5. Keyboard accessibility: activate via keyboard events
    await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        toggleBtn.focus();
        toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        toggleBtn.click();
      })()
    `)
    await sleep(250)

    const keyExpandResult = await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        return {
          expandedAfterKey: Boolean(document.querySelector('.log-detail-row')),
          textAfterKey: toggleBtn ? toggleBtn.textContent.trim() : null,
        };
      })()
    `)
    console.log('Keyboard Operation (Expand) Result:', keyExpandResult)
    assert.equal(keyExpandResult.expandedAfterKey, true, 'Toggle must expand with keyboard activation')
    assert.equal(keyExpandResult.textAfterKey, 'Hide details')

    // Collapse via keyboard
    await pageCdp.evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.btn-details-toggle');
        toggleBtn.focus();
        toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        toggleBtn.click();
      })()
    `)
    await sleep(250)

    const keyCollapseResult = await pageCdp.evaluate(`!document.querySelector('.log-detail-row')`)
    assert.equal(keyCollapseResult, true, 'Toggle must collapse with keyboard activation')

    // 6. Parent row identity, count, and pagination unaffected
    const parentRowsBefore = await pageCdp.evaluate(`document.querySelectorAll('.logs-table tbody tr.log-row').length`)
    const paginationTextBefore = await pageCdp.evaluate(`document.querySelector('.pagination-info')?.textContent?.trim()`)

    // Expand two rows independently
    await pageCdp.evaluate(`
      (() => {
        const toggles = document.querySelectorAll('.btn-details-toggle');
        if (toggles[0]) toggles[0].click();
        if (toggles[1]) toggles[1].click();
      })()
    `)
    await sleep(300)

    const multiExpandCheck = await pageCdp.evaluate(`
      (() => {
        const parentRows = document.querySelectorAll('.logs-table tbody tr.log-row').length;
        const detailRows = document.querySelectorAll('.log-detail-row').length;
        const paginationText = document.querySelector('.pagination-info')?.textContent?.trim();
        return { parentRows, detailRows, paginationText };
      })()
    `)
    console.log('Multi-Expand Check:', multiExpandCheck)
    assert.equal(multiExpandCheck.detailRows, 2, 'Two rows must expand independently')
    assert.equal(multiExpandCheck.parentRows, parentRowsBefore, 'Parent row count must be unaffected by detail rows')
    assert.equal(multiExpandCheck.paginationText, paginationTextBefore, 'Pagination info must remain identical')

    // 7. Expansion cleared on page change
    await pageCdp.evaluate(`
      (() => {
        const nextBtn = document.querySelector('.page-btn[aria-label="Next page"]');
        if (nextBtn) nextBtn.click();
      })()
    `)
    await sleep(800)

    const page2ExpansionCheck = await pageCdp.evaluate(`document.querySelectorAll('.log-detail-row').length`)
    assert.equal(page2ExpansionCheck, 0, 'Page change must clear expansion state on page 2')

    // Return to page 1: expansion must also be clean
    await pageCdp.evaluate(`
      (() => {
        const prevBtn = document.querySelector('.page-btn[aria-label="Previous page"]');
        if (prevBtn) prevBtn.click();
      })()
    `)
    await sleep(800)

    const page1ReturnedExpansionCheck = await pageCdp.evaluate(`document.querySelectorAll('.log-detail-row').length`)
    assert.equal(page1ReturnedExpansionCheck, 0, 'Expansion state on previous page must not linger')

    // 8. Expansion cleared on filter change
    await pageCdp.evaluate(`
      (() => {
        const toggle = document.querySelector('.btn-details-toggle');
        if (toggle) toggle.click();
      })()
    `)
    await sleep(300)
    assert.equal(await pageCdp.evaluate(`document.querySelectorAll('.log-detail-row').length`), 1)

    // Apply action filter
    await pageCdp.evaluate(`
      (() => {
        const select = document.querySelector('#action-filter');
        select.value = 'approve_educator';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(800)

    const filterChangeExpansionCheck = await pageCdp.evaluate(`document.querySelectorAll('.log-detail-row').length`)
    assert.equal(filterChangeExpansionCheck, 0, 'Filter change must clear expansion state')

    // Clear filter
    await pageCdp.evaluate(`document.querySelector('.btn-clear-filters')?.click()`)
    await sleep(600)

    console.log('\nALL ADMIN AUDIT LOGS FILTER USABILITY TESTS PASSED SUCCESSFULLY!')
  } finally {
    try {
      if (chromeProc) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(chromeProc.pid), '/T', '/F'])
        } else {
          chromeProc.kill('SIGTERM')
        }
      }
      if (viteProc) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F'])
        } else {
          viteProc.kill('SIGTERM')
        }
      }
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
