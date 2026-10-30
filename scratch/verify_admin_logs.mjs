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
        stdio: 'pipe',
      },
    )

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
    assert(initialCheck.timeSubtexts.some(t => t === 'Timezone unspecified'), 'Row timestamps must retain concise "Timezone unspecified" subtext')
    assert(initialCheck.timeSubtexts.some(t => t.startsWith('Local (')), 'Row timestamps must retain concise "Local (GMT+X)" subtext')
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

    console.log('\nALL ADMIN AUDIT LOGS FILTER USABILITY TESTS PASSED SUCCESSFULLY!')
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
