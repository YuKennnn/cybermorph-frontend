/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9224
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-cdp-${Date.now()}`)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params?.args?.map(a => a.value ?? a.description ?? '').join(' ')
        if (text) console.log('[BROWSER CONSOLE]', text)
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id)
        this.callbacks.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    }
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
      const detailStr = JSON.stringify(res.exceptionDetails)
      throw new Error(`Eval error: ${detailStr} (${expr})`)
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
        /* wait and retry */
      }
      await sleep(intervalMs)
    }
    throw new Error(`Timeout waiting for expression: ${expr}`)
  }

  async pressKey(key, code, windowsVirtualKeyCode, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers,
    })
    await sleep(25)
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers,
    })
    await sleep(60)
  }

  close() {
    if (this.ws) this.ws.close()
  }
}

async function loginAs(client, email, password) {
  await client.send('Page.navigate', { url: 'http://localhost:5173/login' })
  await sleep(300)
  await client.eval(`
    try {
      localStorage.removeItem('cyber_token');
      localStorage.removeItem('cyber_user');
      localStorage.removeItem('cyber_role');
    } catch (e) {}
  `)
  await client.send('Page.navigate', { url: 'http://localhost:5173/login' })
  await client.waitEval(`document.querySelector('#email') !== null`)
  await client.eval(`
    const emailInput = document.querySelector('#email');
    emailInput.value = '${email}';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    const passInput = document.querySelector('#password');
    passInput.value = '${password}';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('button[type="submit"]').click();
  `)
  try {
    await client.waitEval(`window.location.pathname.includes('/dashboard')`, 8000)
  } catch (err) {
    const errorBanner = await client.eval(`document.querySelector('.error-banner')?.textContent`)
    const currentPath = await client.eval(`window.location.pathname`)
    console.error(`Login failed for ${email}. Path: ${currentPath}, Error: ${errorBanner}`)
    throw err
  }
}

async function runBrowserTests() {
  console.log('=== Starting Real Headless Chrome Verification ===')

  fs.mkdirSync(USER_DATA_DIR, { recursive: true })

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,900',
    'about:blank',
  ])

  let client = null

  try {
    console.log('Connecting to Chrome CDP on port ' + PORT + '...')
    let versionData = null
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
        versionData = await res.json()
        break
      } catch {
        await sleep(300)
      }
    }
    assert.ok(versionData, 'Chrome CDP must be reachable')

    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    const pages = await listRes.json()
    const page = pages.find((p) => p.type === 'page')
    assert.ok(page, 'Must find active browser page')

    client = new CDPClient(page.webSocketDebuggerUrl)
    await client.connect()
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('DOM.enable')
    await client.send('Page.bringToFront')

    console.log('✓ Connected to Chrome CDP session')

    // ========================================================
    // TEST SUITE 1: Player Dashboard & Retries
    // ========================================================
    console.log('\n--- Test Suite 1: Player Dashboard Contract, Sibling Visibility & Retries ---')
    await loginAs(client, 'player@example.com', 'password123')
    console.log('✓ Logged in via production form as player@example.com')

    await sleep(1000)
    const h2Text = await client.eval(`document.querySelector('h2')?.textContent`)
    console.log('DEBUG: h2 text is:', h2Text)
    const roleInStorage = await client.eval(`localStorage.getItem('cyber_role')`)
    const userInStorage = await client.eval(`localStorage.getItem('cyber_user')`)
    console.log('DEBUG: storage role:', roleInStorage, 'user:', userInStorage)
    await client.waitEval(`document.querySelector('.welcome-banner h2') && document.querySelector('.welcome-banner h2').textContent.includes('AgentZero')`)
    console.log('✓ Player dashboard loaded for AgentZero')

    // Verify threat index progress card
    await client.waitEval(`document.querySelector('.stat-value.highlight-secondary') !== null`)
    const threatProgress = await client.eval(`document.querySelector('.stat-value.highlight-secondary').textContent.trim()`)
    assert.strictEqual(threatProgress, '5/8 unlocked', 'Must display 5/8 unlocked for threat index progress')
    console.log('✓ Threat index progress accurately displays "5/8 unlocked"')

    // Verify games played
    const gamesPlayed = await client.eval(`document.querySelectorAll('.stat-card .stat-value')[0].textContent.trim()`)
    assert.strictEqual(gamesPlayed, '14', 'Must display 14 games played from session history')
    console.log('✓ Games played displays 14 confirmed sessions')

    // Verify current map
    const currentMapText = await client.eval(`document.querySelector('.action-info p').textContent.trim()`)
    assert.ok(currentMapText.includes('Internet Cafe'), `Current map must be Internet Cafe, got: ${currentMapText}`)
    console.log('✓ Current map correctly displays "Internet Cafe" (map_progress 3)')

    // ========================================================
    // TEST SUITE 2: Classroom Roster, Pagination & History Back/Forward
    // ========================================================
    console.log('\n--- Test Suite 2: Classroom Roster, Pagination & Browser Back/Forward ---')
    await loginAs(client, 'educator@cybermorph.local', 'password123')
    console.log('✓ Logged in via production form as educator@cybermorph.local')

    await client.send('Page.navigate', { url: 'http://localhost:5173/classroom/students/c1' })
    await client.waitEval(`document.querySelector('.count-badge') && document.querySelector('.count-badge').textContent.includes('Enrolled students')`)
    await client.waitEval(`document.querySelectorAll('.roster-table tbody tr').length === 10`)
    console.log('✓ Page 1 loaded with 10 students')

    // Navigate to Page 2
    await client.eval(`{
      const nextBtn = Array.from(document.querySelectorAll('.page-btn')).find(b => b.textContent.includes('Next'));
      nextBtn.click();
    }`)
    await client.waitEval(`window.location.search.includes('page=2')`)
    await client.waitEval(`!document.querySelector('.loading-state') && document.querySelectorAll('.roster-table tbody tr').length === 10`)
    await client.waitEval(`document.querySelector('.page-indicator') && document.querySelector('.page-indicator').textContent.includes('Page 2')`)
    console.log('✓ Navigated to Page 2 via Next button (URL page=2)')

    // Navigate to Page 3
    await sleep(200)
    await client.eval(`{
      const nextBtn = Array.from(document.querySelectorAll('.page-btn')).find(b => b.textContent.includes('Next'));
      nextBtn.click();
    }`)
    await client.waitEval(`window.location.search.includes('page=3')`)
    await client.waitEval(`!document.querySelector('.loading-state') && document.querySelectorAll('.roster-table tbody tr').length === 3`)
    await client.waitEval(`document.querySelector('.page-indicator') && document.querySelector('.page-indicator').textContent.includes('Page 3')`)
    const page3Count = await client.eval(`document.querySelectorAll('.roster-table tbody tr').length`)
    assert.strictEqual(page3Count, 3, 'Page 3 of 23 students must have exactly 3 rows')
    console.log('✓ Navigated to Page 3 (3 remaining students: 23 total)')

    // Test Browser Back
    console.log('Testing browser Back button navigation...')
    await client.eval(`window.history.back()`)
    await client.waitEval(`window.location.search.includes('page=2')`)
    await client.waitEval(`!document.querySelector('.loading-state') && document.querySelectorAll('.roster-table tbody tr').length === 10`)
    await client.waitEval(`document.querySelector('.page-indicator') && document.querySelector('.page-indicator').textContent.includes('Page 2')`)
    console.log('✓ Browser Back returned correctly to Page 2')

    // Test Browser Forward
    console.log('Testing browser Forward button navigation...')
    await client.eval(`window.history.forward()`)
    await client.waitEval(`window.location.search.includes('page=3')`)
    await client.waitEval(`!document.querySelector('.loading-state') && document.querySelectorAll('.roster-table tbody tr').length === 3`)
    await client.waitEval(`document.querySelector('.page-indicator') && document.querySelector('.page-indicator').textContent.includes('Page 3')`)
    console.log('✓ Browser Forward navigated correctly to Page 3')

    // ========================================================
    // TEST SUITE 3: Deep Link & Initial Focus on Direct Render
    // ========================================================
    console.log('\n--- Test Suite 3: Deep Link & Initial Focus on Direct Load ---')
    await client.send('Page.navigate', { url: 'http://localhost:5173/analytics/c1?student=p1&roster_page=3' })
    await client.send('Page.bringToFront')
    
    // Wait for student modal to appear
    await client.waitEval(`document.querySelector('.modal-dialog') !== null`)
    await client.waitEval(`document.querySelector('.modal-close-btn') !== null`)

    // Verify initial focus is immediately set inside dialog (on close button)
    const activeClass = await client.waitEval(`document.activeElement?.className`)
    assert.ok(activeClass.includes('modal-close-btn'), `Initial focus on direct load must be modal close button, got: ${activeClass}`)
    console.log('✓ Direct deep-link render correctly set initial focus to modal close button')

    // Verify body scroll is locked
    const overflowStyle = await client.eval(`document.body.style.overflow`)
    assert.strictEqual(overflowStyle, 'hidden', 'Body overflow must be hidden while modal is open')
    console.log('✓ Background scroll lock confirmed: body.style.overflow = "hidden"')

    // ========================================================
    // TEST SUITE 4: Tab / Shift+Tab Keyboard Focus Containment
    // ========================================================
    console.log('\n--- Test Suite 4: Tab / Shift+Tab Focus Containment ---')
    // Wait for student telemetry/analytics to finish loading so focusable elements are present
    await client.waitEval(`!document.querySelector('.loading-state') && document.querySelector('.btn-telemetry') !== null`)
    await client.eval(`document.querySelector('.modal-close-btn').focus()`)

    // Active element starts on modal-close-btn (first element)
    // Dispatch Shift+Tab: trapFocus wraps to last element
    await client.eval(`{
      const target = document.activeElement || window;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, shiftKey: true, bubbles: true, cancelable: true }));
    }`)
    let focusedElAfterShift = await client.eval(`document.activeElement?.className || document.activeElement?.tagName`)
    assert.ok(focusedElAfterShift.includes('btn-telemetry'), `Shift+Tab from first must wrap to last element, got: ${focusedElAfterShift}`)
    console.log('✓ Shift+Tab wrapped to last element:', focusedElAfterShift)

    // Now activeElement is at last element. Dispatch Tab: trapFocus wraps to first element
    await client.eval(`{
      const target = document.activeElement || window;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, shiftKey: false, bubbles: true, cancelable: true }));
    }`)
    let focusedElAfterTab = await client.eval(`document.activeElement?.className || document.activeElement?.tagName`)
    assert.ok(focusedElAfterTab.includes('modal-close-btn'), `Tab from last must wrap to first element, got: ${focusedElAfterTab}`)
    console.log('✓ Tab from last element wrapped back to modal-close-btn')

    // ========================================================
    // TEST SUITE 5: Non-Stacking Session Modal & Focus Restoration
    // ========================================================
    console.log('\n--- Test Suite 5: Session Details Modal & Return to Student ---')
    await client.waitEval(`document.querySelector('.btn-telemetry') !== null`)
    // Click view session details
    await client.eval(`document.querySelector('.btn-telemetry').focus(); document.querySelector('.btn-telemetry').click()`)

    // Verify Session Details modal opens
    await client.waitEval(`document.querySelector('.btn-back-link') !== null`)
    const visibleModalCount = await client.eval(`document.querySelectorAll('.modal-backdrop').length`)
    assert.strictEqual(visibleModalCount, 1, 'Must have exactly ONE active dialog (non-stacking)')
    console.log('✓ Only 1 dialog is visible; student modal is hidden while session details is active')

    // Click Back to Student
    await client.eval(`document.querySelector('.btn-back-link').click()`)
    await client.waitEval(`document.querySelector('.btn-telemetry') !== null`)
    
    // Check focus restored to session button or sensible control
    const restoredFocusClass = await client.eval(`document.activeElement?.className`)
    assert.ok(restoredFocusClass.includes('btn-telemetry'), `Focus must restore to initiating button, got: ${restoredFocusClass}`)
    console.log('✓ Focus restored to "View session details" button on student modal')

    // ========================================================
    // TEST SUITE 6: Escape Key, Query Removal & Return to Roster
    // ========================================================
    console.log('\n--- Test Suite 6: Escape Key Dismissal & Return to Classroom Roster ---')
    await client.eval(`{
      const target = document.activeElement || window;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    }`)
    await client.waitEval(`document.querySelector('.modal-dialog') === null`)
    const hasStudentQuery = await client.eval(`window.location.search.includes('student=')`)
    assert.strictEqual(hasStudentQuery, false, 'Modal dismissal must remove student query param')
    console.log('✓ Escape key dismissed student modal and removed student query')

    // Verify body overflow unlocked
    const unlockedOverflow = await client.eval(`document.body.style.overflow`)
    assert.strictEqual(unlockedOverflow, '', 'Body overflow must be restored after modal close')
    console.log('✓ Background scroll restored: body.style.overflow = ""')

    // Click "Return to classroom roster"
    await client.eval(`document.querySelector('.back-link').click()`)
    await client.waitEval(`window.location.pathname.includes('/classroom/students/c1')`)
    const backToRosterPage = await client.eval(`window.location.search`)
    assert.ok(backToRosterPage.includes('page=3'), `Must return to originating roster page=3, got: ${backToRosterPage}`)
    console.log('✓ Returned to originating classroom roster page 3 successfully')

    // ========================================================
    // TEST SUITE 7: Analytics Table Header, Last Synced & History Page Restoration
    // ========================================================
    console.log('\n--- Test Suite 7: Analytics Table "Last synced" & History Page Restoration ---')
    await client.send('Page.navigate', { url: 'http://localhost:5173/analytics/c1?table_page=2' })
    await client.waitEval(`document.querySelector('.data-table') !== null`)
    await client.waitEval(`!document.querySelector('.loading-state')`)
    await client.waitEval(`document.querySelector('.page-indicator')?.textContent.includes('Page 2')`)

    // Verify table header says "Last synced"
    const headerTexts = await client.eval(`Array.from(document.querySelectorAll('.data-table th')).map(th => th.textContent.trim())`)
    assert.ok(headerTexts.includes('Last synced'), `Table header must include "Last synced", got: ${JSON.stringify(headerTexts)}`)
    assert.strictEqual(headerTexts.includes('Date Joined'), false, 'Must NOT label column "Date Joined"')
    console.log('✓ Analytics table correctly labeled "Last synced"')

    // Switch to classroom c2
    await client.eval(`{
      const select = document.querySelector('#classroomSelect');
      select.value = 'c2';
      select.dispatchEvent(new Event('change'));
    }`)
    await client.waitEval(`window.location.pathname.includes('/analytics/c2')`)
    await client.waitEval(`!document.querySelector('.loading-state')`)
    const c2Query = await client.eval(`window.location.search`)
    assert.strictEqual(c2Query, '', 'Switching classrooms must reset to page 1 and clear table_page')
    console.log('✓ Switching classroom reset to page 1 and updated path to /analytics/c2')

    // Use browser Back to restore c1 table_page=2
    console.log('Testing browser Back to restore c1 table_page=2...')
    await client.eval(`window.history.back()`)
    await client.waitEval(`window.location.pathname.includes('/analytics/c1') && window.location.search.includes('table_page=2')`)
    await client.waitEval(`!document.querySelector('.loading-state')`)
    await client.waitEval(`document.querySelector('.page-indicator')?.textContent.includes('Page 2')`)
    console.log('✓ Browser Back returned to c1 with table_page=2 preserved and Page 2 displayed')

    // ========================================================
    // TEST SUITE 8: Classroom Management Modal Copy & Tokens
    // ========================================================
    console.log('\n--- Test Suite 8: Classroom Management Modals Copy Verification ---')
    await client.send('Page.navigate', { url: 'http://localhost:5173/classroom/manage' })
    await client.waitEval(`document.querySelector('.btn-utility.edit') !== null`)

    // Open Edit Modal
    await client.eval(`{
      document.querySelector('.btn-utility.edit').click();
    }`)
    await client.waitEval(`document.querySelector('.form-group-checkbox') !== null`)
    const editCopy = await client.eval(`document.querySelector('.form-group-checkbox label').textContent.trim()`)
    assert.ok(editCopy.includes('Allow new students to join.'), `Edit modal copy must be "Allow new students to join.", got: ${editCopy}`)
    console.log('✓ Classroom activation copy verified: "Allow new students to join."')

    // Press Escape to close edit modal
    await client.eval(`{
      const target = document.activeElement || window;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    }`)
    await client.waitEval(`document.querySelector('.form-group-checkbox') === null`)

    // Open Delete Modal
    await client.eval(`{
      document.querySelector('.btn-utility.delete').click();
    }`)
    await client.waitEval(`document.querySelector('.danger-modal') !== null`)
    const delDesc = await client.eval(`document.querySelector('.modal-desc').textContent.trim()`)
    assert.ok(
      delDesc.includes('This classroom will be removed from your classroom lists and its join code will stop working.'),
      `Delete modal copy must state removal from lists and join code stops working, got: ${delDesc}`
    )
    assert.strictEqual(delDesc.includes('Enrolled students will no longer be linked'), false, 'Must not claim student links are deleted')
    console.log('✓ Classroom deletion copy verified: explains classroom disappears and join code stops working')

    // Press Escape to close delete modal
    await client.eval(`{
      const target = document.activeElement || window;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    }`)
    await client.waitEval(`document.querySelector('.danger-modal') === null`)

    // ========================================================
    // TEST SUITE 9: Dashboard Partial Failure, Sibling Data Retention & Retries
    // ========================================================
    console.log('\n--- Test Suite 9: Dashboard Partial Failure, Sibling Data & Retries ---')
    await loginAs(client, 'player@example.com', 'password123')
    await client.eval(`{
      sessionStorage.setItem('__CYBERMORPH_FAIL_THREAT__', '2');
      if (window.__CYBERMORPH_MOCK_CONTROL__) {
        window.__CYBERMORPH_MOCK_CONTROL__.failThreatIndexCount = 2;
      }
    }`)
    await client.send('Page.navigate', { url: 'http://localhost:5173/dashboard' })
    await client.waitEval(`document.querySelector('.welcome-banner h2') && document.querySelector('.welcome-banner h2').textContent.includes('AgentZero')`)
    await client.waitEval(`!document.querySelector('.loading-state')`)
    await client.waitEval(`document.querySelector('.btn-stat-retry') !== null`)

    // Verify sibling data is VISIBLE and intact
    const mapName = await client.eval(`document.querySelector('.action-info strong')?.textContent.trim()`)
    assert.strictEqual(mapName, 'Internet Cafe', 'Current map must stay visible when threat index fails')
    const gamesPlayedSibling = await client.eval(`document.querySelectorAll('.stat-card .stat-value')[0]?.textContent.trim()`)
    assert.strictEqual(gamesPlayedSibling, '14', 'Games played must stay visible when threat index fails')

    // Verify threat index card has "Unavailable" indicator and retry button
    const unavailText = await client.eval(`document.querySelector('.stat-unavailable')?.textContent.trim()`)
    assert.strictEqual(unavailText, 'Unavailable', 'Threat index card must indicate Unavailable')
    console.log('✓ One dashboard request failed while sibling data stayed visible')

    // Click retry (attempt 1 - fails)
    await client.eval(`document.querySelector('.btn-stat-retry').click()`)
    // Verify disabled state during pending retry
    const isRetrying = await client.waitEval(`document.querySelector('.btn-stat-retry')?.disabled`)
    assert.strictEqual(isRetrying, true, 'Retry button must be disabled during retry operation')
    // Wait for failure response to settle
    await client.waitEval(`!document.querySelector('.btn-stat-retry')?.disabled`)
    const unavailTextAfterFail = await client.eval(`document.querySelector('.stat-unavailable')?.textContent.trim()`)
    assert.strictEqual(unavailTextAfterFail, 'Unavailable', 'Threat index remains unavailable after failed retry')
    // Sibling data still visible
    const gamesPlayedAfterFail = await client.eval(`document.querySelectorAll('.stat-card .stat-value')[0]?.textContent.trim()`)
    assert.strictEqual(gamesPlayedAfterFail, '14', 'Games played stays visible after retry failure')
    console.log('✓ Retry failure handled accurately with disabled state and persistent sibling data')

    // Click retry (attempt 2 - succeeds)
    await client.eval(`document.querySelector('.btn-stat-retry').click()`)
    await client.waitEval(`!document.querySelector('.stat-unavailable')`)
    const restoredThreatText = await client.eval(`document.querySelector('.stat-value.highlight-secondary')?.textContent.trim()`)
    assert.strictEqual(restoredThreatText, '5/8 unlocked', 'Threat index must update to 5/8 unlocked on successful retry')
    console.log('✓ Retry succeeded: threat index updated to 5/8 unlocked and error cleared')

    // ========================================================
    // TEST SUITE 10: Discard Outdated Response on Fast Classroom Switch
    // ========================================================
    console.log('\n--- Test Suite 10: Discard Outdated Response on Fast Classroom Switch ---')
    await loginAs(client, 'educator@cybermorph.local', 'password123')
    await client.send('Page.navigate', { url: 'http://localhost:5173/analytics/c2' })
    await client.waitEval(`!document.querySelector('.loading-state-sm') && document.querySelector('.header-titles .meta-tag')?.textContent.includes('NET202')`)

    // Configure genuine 1000ms delay for c1 classroom analytics
    await client.eval(`{
      window.__CYBERMORPH_MOCK_CONTROL__.delayClassroomAnalytics = { 'c1': 1000 };
      sessionStorage.setItem('__CYBERMORPH_DELAY_CLASSROOM__', JSON.stringify({ 'c1': 1000 }));
    }`)

    // Start a genuinely delayed c1 request by switching classroom selector
    await client.eval(`{
      const select = document.querySelector('#classroomSelect');
      select.value = 'c1';
      select.dispatchEvent(new Event('change'));
    }`)

    // Confirm c1 request is genuinely pending before switching
    await client.waitEval(`document.querySelector('.loading-state-sm') !== null`)
    const pendingRosterText = await client.eval(`document.querySelector('.loading-state-sm p')?.textContent.trim()`)
    assert.strictEqual(pendingRosterText, 'Loading student roster...', 'c1 request must be visibly pending')
    console.log('✓ Confirmed c1 request is genuinely pending in UI ("Loading student roster...")')

    // While c1 is pending, rapidly switch to c2
    await client.eval(`{
      const select = document.querySelector('#classroomSelect');
      select.value = 'c2';
      select.dispatchEvent(new Event('change'));
    }`)

    // Wait for c2 to finish loading
    await client.waitEval(`!document.querySelector('.loading-state-sm') && document.querySelector('.header-titles .meta-tag')?.textContent.includes('NET202')`)

    // Wait 1100ms for delayed c1 response to arrive
    await sleep(1100)

    // Check displayed data and cleared state after the late response
    const activeClassroomPath = await client.eval(`window.location.pathname`)
    assert.ok(activeClassroomPath.includes('/analytics/c2'), `Classroom path must remain /analytics/c2, got: ${activeClassroomPath}`)
    const selectedValue = await client.eval(`document.querySelector('#classroomSelect')?.value`)
    assert.strictEqual(selectedValue, 'c2', 'Selected classroom value must remain c2')

    const headerMeta = await client.eval(`document.querySelector('.header-titles .meta-tag')?.textContent`)
    assert.ok(headerMeta.includes('BSIT 3C') && headerMeta.includes('NET202'), `Classroom header must show BSIT 3C [Code: NET202], got: ${headerMeta}`)
    assert.strictEqual(headerMeta.includes('BSIT 4A'), false, 'Late c1 response must not overwrite c2 classroom title')

    const enrolledCount = await client.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent.trim()`)
    assert.strictEqual(enrolledCount, '1', "Classroom c2 must display 1 enrolled student, not c1's 23 students")

    const rowCount = await client.eval(`document.querySelectorAll('.data-table tbody tr').length`)
    assert.strictEqual(rowCount, 1, "Roster table must display 1 student row for c2, not c1's 10 rows")

    const errorBanner = await client.eval(`document.querySelector('.error-banner')`)
    assert.strictEqual(errorBanner, null, 'No error banner should be present after discarded response')

    const loadingStateAfterLate = await client.eval(`document.querySelector('.loading-state-sm')`)
    assert.strictEqual(loadingStateAfterLate, null, 'Loading state must be completely cleared')
    console.log('✓ Outdated response discarded: c2 displayed data (1 student, BSIT 3C) and clean state preserved after late c1 arrival')

    // ========================================================
    // TEST SUITE 11: Request Invalidation on Dialog Close
    // ========================================================
    console.log('\n--- Test Suite 11: Request Invalidation on Dialog Close ---')
    // Reset classroom delays first
    await client.eval(`{
      window.__CYBERMORPH_MOCK_CONTROL__.delayClassroomAnalytics = {};
      sessionStorage.removeItem('__CYBERMORPH_DELAY_CLASSROOM__');
    }`)

    // Navigate to /analytics/c1
    await client.send('Page.navigate', { url: 'http://localhost:5173/analytics/c1' })
    await client.waitEval(`document.querySelector('.data-table') !== null && !document.querySelector('.loading-state-sm')`)

    // Set the student delay AFTER page navigation has completed
    await client.eval(`{
      window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 1000;
      sessionStorage.setItem('__CYBERMORPH_DELAY_PLAYER__', '1000');
    }`)

    // Click student link to open modal
    await client.eval(`document.querySelector('.data-table tbody tr .btn-inspect')?.click()`)

    // Confirm request is pending before closing
    await client.waitEval(`document.querySelector('.modal-dialog') !== null`)
    await client.waitEval(`document.querySelector('.modal-dialog .loading-state') !== null`)
    const modalLoadingText = await client.eval(`document.querySelector('.modal-dialog .loading-state p')?.textContent.trim()`)
    assert.strictEqual(modalLoadingText, 'Loading student analytics...', 'Student modal must be in pending loading state')
    console.log('✓ Confirmed student modal request is genuinely pending in UI ("Loading student analytics...")')

    // Close modal immediately while request is pending
    await client.eval(`document.querySelector('.modal-close-btn')?.click()`)
    await client.waitEval(`document.querySelector('.modal-dialog') === null`)

    // Wait 1200ms for delayed player analytics response to arrive
    await sleep(1200)

    // Check displayed data and cleared state after the late response
    const modalAfterDelayedResponse = await client.eval(`document.querySelector('.modal-dialog')`)
    assert.strictEqual(modalAfterDelayedResponse, null, 'Modal must remain closed after delayed response resolves')
    const backdropAfterDelayedResponse = await client.eval(`document.querySelector('.modal-backdrop')`)
    assert.strictEqual(backdropAfterDelayedResponse, null, 'Modal backdrop must be absent')

    const hasStudentQueryAfterDelay = await client.eval(`window.location.search.includes('student=')`)
    assert.strictEqual(hasStudentQueryAfterDelay, false, 'Student query must not be reintroduced by delayed response')

    const bodyOverflow = await client.eval(`document.body.style.overflow`)
    assert.strictEqual(bodyOverflow, '', 'Body scroll must remain restored')

    // Check that underlying classroom overview and roster data remain fully visible, intact, and interactive
    const metaTag = await client.eval(`document.querySelector('.header-titles .meta-tag')?.textContent`)
    assert.ok(metaTag.includes('CYB101'), 'Classroom meta-tag remains CYB101')
    const kpi = await client.eval(`document.querySelector('.kpi-card .kpi-value')?.textContent.trim()`)
    assert.strictEqual(kpi, '23', 'Enrolled students KPI remains 23')
    const rows = await client.eval(`document.querySelectorAll('.data-table tbody tr').length`)
    assert.strictEqual(rows, 10, 'Student roster rows remain intact at 10')
    const lateErrorBanner = await client.eval(`document.querySelector('.error-banner')`)
    assert.strictEqual(lateErrorBanner, null, 'No error banner after discarded late response')

    // Reset delays and storage
    await client.eval(`{
      window.__CYBERMORPH_MOCK_CONTROL__.delayPlayerAnalyticsMs = 0;
      sessionStorage.removeItem('__CYBERMORPH_DELAY_PLAYER__');
    }`)
    console.log('✓ Request discarded on dialog close: modal remained closed, query clean, underlying overview intact (23 students, 10 rows)')

    console.log('\n======================================================')
    console.log('ALL REAL HEADLESS BROWSER ASSERTIONS PASSED (100%)')
    console.log('======================================================\n')
  } finally {
    if (client) client.close()
    if (chromeProc) {
      chromeProc.kill('SIGKILL')
    }
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      /* ignore cleanup error */
    }
  }
}

runBrowserTests().catch((err) => {
  console.error('\n❌ BROWSER TEST FAILED:', err)
  process.exit(1)
})
