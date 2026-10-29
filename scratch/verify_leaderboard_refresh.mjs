/* global process */
import { spawn } from 'node:child_process'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { Buffer } from 'node:buffer'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TEST_PORT = 5197
const CDP_PORT = 9247
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const USER_DATA_DIR = path.join(os.tmpdir(), `cybermorph-leaderboard-cdp-${Date.now()}`)
const ARTIFACT_DIR = path.resolve('scratch/leaderboard-previews')
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
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

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
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
  let viteProcess = null
  let chromeProcess = null
  let cdp = null
  let pageCdp = null

  try {
    console.log('[1/6] Starting Vite test server on port', TEST_PORT)
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

    const serverReady = await waitForServer(`${BASE_URL}/`)
    if (!serverReady) {
      throw new Error(`Server failed to start at ${BASE_URL}`)
    }
    console.log(`Server ready at ${BASE_URL}`)

    console.log('[2/6] Launching Headless Chrome...')
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
    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('[3/6] Testing Signed-Out Leaderboard...')
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/leaderboard` })
    await sleep(1500)

    const signedOutData = await pageCdp.evaluate(`
      (() => {
        const title = document.querySelector('.title')?.textContent?.trim();
        const subtitle = document.querySelector('.subtitle')?.textContent?.trim();
        const filterBtns = Array.from(document.querySelectorAll('.filter-btn')).map(b => ({
          text: b.textContent.trim(),
          active: b.classList.contains('active'),
          ariaPressed: b.getAttribute('aria-pressed'),
        }));
        const podiumCards = Array.from(document.querySelectorAll('.podium-card')).map(c => ({
          rankText: c.querySelector('.podium-rank-badge')?.textContent?.trim(),
          username: c.querySelector('.podium-username')?.textContent?.trim(),
          map: c.querySelector('.podium-map-badge')?.textContent?.trim(),
          score: c.querySelector('.podium-score')?.textContent?.trim(),
          hasYouBadge: !!c.querySelector('.you-badge'),
          isCurrentPlayerClass: c.classList.contains('is-current-player'),
          order: window.getComputedStyle(c).order,
        }));
        const tableRows = Array.from(document.querySelectorAll('.leaderboard-table tbody tr')).map(r => ({
          rank: r.querySelector('.rank-badge')?.textContent?.trim(),
          username: r.querySelector('.agent-name')?.textContent?.trim(),
          map: r.querySelector('.map-badge')?.textContent?.trim(),
          score: r.querySelector('.score-value')?.textContent?.trim(),
          hasYouBadge: !!r.querySelector('.you-badge'),
          hasCurrentPlayerClass: r.classList.contains('current-player-row'),
          hasTopEntryClass: r.classList.contains('top-entry'),
        }));
        const paginationInFooter = !!document.querySelector('.table-card-footer.pagination-bar');

        return {
          title,
          subtitle,
          filterBtns,
          podiumCards,
          tableRowCount: tableRows.length,
          firstRow: tableRows[0],
          thirdRow: tableRows[2],
          paginationInFooter,
        };
      })()
    `)

    console.log('Title:', signedOutData.title)
    console.log('Subtitle:', signedOutData.subtitle)
    console.log('Filter Buttons:', signedOutData.filterBtns)
    console.log('Podium Cards:', signedOutData.podiumCards)
    console.log('Table row count:', signedOutData.tableRowCount)
    console.log('Pagination in footer:', signedOutData.paginationInFooter)

    assert.equal(signedOutData.title, 'Leaderboard')
    assert.match(signedOutData.subtitle, /Top scores and player rankings across maps/)
    assert.equal(signedOutData.filterBtns.length, 5)
    assert.equal(signedOutData.filterBtns[0].text, 'All maps')
    assert.equal(signedOutData.filterBtns[0].active, true)
    assert.equal(signedOutData.podiumCards.length, 3, 'Page 1 must show top 3 podium cards')

    // DOM order is #1, #2, #3; Desktop visual order is #2 (order: 1), #1 (order: 2), #3 (order: 3)
    assert.equal(signedOutData.podiumCards[0].rankText, '#1')
    assert.equal(signedOutData.podiumCards[0].order, '2', 'Desktop rank 1 must have visual order 2')
    assert.equal(signedOutData.podiumCards[1].rankText, '#2')
    assert.equal(signedOutData.podiumCards[1].order, '1', 'Desktop rank 2 must have visual order 1')
    assert.equal(signedOutData.podiumCards[2].rankText, '#3')
    assert.equal(signedOutData.podiumCards[2].order, '3', 'Desktop rank 3 must have visual order 3')

    // Check score unit uses "pts"
    assert.match(signedOutData.podiumCards[0].score, /pts/)
    assert.match(signedOutData.firstRow.score, /pts/)

    // No "You" badge when signed out
    assert.equal(signedOutData.podiumCards.some(c => c.hasYouBadge), false)
    assert.equal(signedOutData.firstRow.hasYouBadge, false)
    assert.equal(signedOutData.firstRow.hasTopEntryClass, false, 'Top entry purple tint class must be removed')
    assert.equal(signedOutData.tableRowCount, 10, 'Table must show 10 entries per page')
    assert.equal(signedOutData.paginationInFooter, true, 'Pagination must be inside table card footer')
    console.log('✔ Signed-out checks passed')

    console.log('[4/6] Testing Signed-In Player Ownership Highlighting...')
    // Sign in as AgentZero
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
    // Reload leaderboard
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/leaderboard` })
    await sleep(1500)

    const playerLeaderboardData = await pageCdp.evaluate(`
      (() => {
        const podiumCards = Array.from(document.querySelectorAll('.podium-card')).map(c => {
          const cs = window.getComputedStyle(c);
          const scoreEl = c.querySelector('.score-number');
          const badgeEl = c.querySelector('.podium-rank-badge');
          return {
            rankText: c.querySelector('.podium-rank-badge')?.textContent?.trim(),
            username: c.querySelector('.podium-username')?.textContent?.trim(),
            hasYouBadge: !!c.querySelector('.you-badge'),
            isCurrentPlayerClass: c.classList.contains('is-current-player'),
            bg: cs.backgroundColor,
            borderColor: cs.borderColor,
            scoreColor: scoreEl ? window.getComputedStyle(scoreEl).color : '',
            badgeBg: badgeEl ? window.getComputedStyle(badgeEl).backgroundColor : '',
            badgeColor: badgeEl ? window.getComputedStyle(badgeEl).color : '',
          };
        });
        const rows = Array.from(document.querySelectorAll('.leaderboard-table tbody tr')).map(r => ({
          rank: r.querySelector('.rank-badge')?.textContent?.trim(),
          username: r.querySelector('.agent-name')?.textContent?.trim(),
          hasYouBadge: !!r.querySelector('.you-badge'),
          hasCurrentPlayerClass: r.classList.contains('current-player-row'),
        }));
        return {
          podiumCards,
          rows,
        };
      })()
    `)

    // On "All maps", AgentZero is rank 3
    const agentZeroCard = playerLeaderboardData.podiumCards.find(c => c.username === 'AgentZero')
    console.log('AgentZero Podium Card:', agentZeroCard)
    assert(agentZeroCard, 'AgentZero should be in top 3 on All maps')
    assert.equal(agentZeroCard.hasYouBadge, true, 'AgentZero card must have "You" badge')
    assert.equal(agentZeroCard.isCurrentPlayerClass, true, 'AgentZero card must have is-current-player class')
    assert.equal(agentZeroCard.bg, 'rgb(255, 255, 255)', 'AgentZero card must preserve neutral background')

    // Check rank 1 (gold) and rank 2 (silver) cards
    const rank1Card = playerLeaderboardData.podiumCards.find(c => c.rankText === '#1')
    const rank2Card = playerLeaderboardData.podiumCards.find(c => c.rankText === '#2')
    assert(rank1Card, 'Rank 1 card must exist')
    assert.equal(rank1Card.bg, 'rgb(255, 255, 255)', 'Rank 1 card must have neutral background')
    assert.equal(rank1Card.scoreColor, 'rgb(15, 23, 42)', 'Rank 1 card must have neutral score text')

    assert(rank2Card, 'Rank 2 card must exist')
    assert.equal(rank2Card.bg, 'rgb(255, 255, 255)', 'Rank 2 card must have neutral background')
    assert.equal(rank2Card.scoreColor, 'rgb(15, 23, 42)', 'Rank 2 card must have neutral score text')

    const agentZeroRow = playerLeaderboardData.rows.find(r => r.username === 'AgentZero')
    console.log('AgentZero Table Row:', agentZeroRow)
    assert(agentZeroRow, 'AgentZero should be in table on page 1')
    assert.equal(agentZeroRow.hasYouBadge, true, 'AgentZero row must have "You" badge')
    assert.equal(agentZeroRow.hasCurrentPlayerClass, true, 'AgentZero row must have current-player-row class')

    // Capture Desktop Screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'leaderboard_desktop_1440.png')
    await pageCdp.screenshot(desktopScreenshotPath)
    console.log('✔ Desktop screenshot saved to', desktopScreenshotPath)

    console.log('[5/6] Testing Map Filter Button & Page 2 Pagination...')
    // Click "Home" filter button
    await pageCdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.filter-btn'));
        const homeBtn = btns.find(b => b.textContent.trim() === 'Home');
        if (homeBtn) homeBtn.click();
      })()
    `)
    await sleep(1200)

    const homeUrl = await pageCdp.evaluate(`window.location.href`)
    console.log('Home URL:', homeUrl)
    assert.match(homeUrl, /map=Home/)

    const homeData = await pageCdp.evaluate(`
      (() => {
        const activeBtn = document.querySelector('.filter-btn.active')?.textContent?.trim();
        const rows = Array.from(document.querySelectorAll('.leaderboard-table tbody tr')).map(r => ({
          map: r.querySelector('.map-badge')?.textContent?.trim(),
        }));
        return {
          activeBtn,
          maps: rows.map(r => r.map),
        };
      })()
    `)
    assert.equal(homeData.activeBtn, 'Home')
    assert(homeData.maps.every(m => m === 'Home'), 'All rows must be for Home map')
    console.log('✔ Filter button resets to page 1 and filters correctly')

    // Switch back to "All maps" and go to page 2
    await pageCdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.filter-btn'));
        const allBtn = btns.find(b => b.textContent.trim() === 'All maps');
        if (allBtn) allBtn.click();
      })()
    `)
    await sleep(1000)

    // Click Next page
    await pageCdp.evaluate(`
      document.querySelector('.pagination-actions button:last-child').click();
    `)
    await sleep(1200)

    const page2Data = await pageCdp.evaluate(`
      (() => {
        const podiumExists = !!document.querySelector('.podium-section');
        const currentUrl = window.location.href;
        const pageIndicator = document.querySelector('.page-indicator')?.textContent?.trim();
        const firstRowRank = document.querySelector('.leaderboard-table tbody tr .rank-badge')?.textContent?.trim();
        return {
          podiumExists,
          currentUrl,
          pageIndicator,
          firstRowRank,
        };
      })()
    `)
    console.log('Page 2 State:', page2Data)
    assert.equal(page2Data.podiumExists, false, 'Top 3 podium cards must NOT appear on page 2')
    assert.match(page2Data.currentUrl, /page=2/)
    assert.match(page2Data.pageIndicator, /Page 2 of 2/)
    assert.equal(page2Data.firstRowRank, '11', 'Page 2 first row rank must be 11')
    console.log('✔ Page 2 correctly hides podium and preserves ranking')

    console.log('[6/6] Testing Mobile Layout (390px)...')
    // Reset to page 1
    await pageCdp.send('Page.navigate', { url: `${BASE_URL}/leaderboard` })
    await sleep(1200)

    await pageCdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(800)

    const mobileData = await pageCdp.evaluate(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const podiumCards = Array.from(document.querySelectorAll('.podium-card')).map(c => ({
          rankText: c.querySelector('.podium-rank-badge')?.textContent?.trim(),
          order: window.getComputedStyle(c).order,
        }));
        return {
          docWidth,
          scrollWidth,
          hasPageHorizontalOverflow: scrollWidth > docWidth,
          podiumCards,
        };
      })()
    `)
    console.log('Mobile Data:', mobileData)
    assert.equal(mobileData.hasPageHorizontalOverflow, false, 'Mobile page must not have horizontal overflow')

    // On mobile, visual order must be 1st (order: 1), 2nd (order: 2), 3rd (order: 3)
    assert.equal(mobileData.podiumCards[0].rankText, '#1')
    assert.equal(mobileData.podiumCards[0].order, '1', 'Mobile rank 1 must have order 1')
    assert.equal(mobileData.podiumCards[1].rankText, '#2')
    assert.equal(mobileData.podiumCards[1].order, '2', 'Mobile rank 2 must have order 2')
    assert.equal(mobileData.podiumCards[2].rankText, '#3')
    assert.equal(mobileData.podiumCards[2].order, '3', 'Mobile rank 3 must have order 3')

    // Capture Mobile Screenshot
    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'leaderboard_mobile_390.png')
    await pageCdp.screenshot(mobileScreenshotPath)
    console.log('✔ Mobile screenshot saved to', mobileScreenshotPath)


    // Stress only the featured cards; no production data is changed.
    await pageCdp.evaluate(`
      document.documentElement.dataset.textSize = 'extra-large';
      document.querySelectorAll('.podium-username').forEach(el => {
        el.textContent = 'CyberCheetahWithAnExtraLongPlayerName';
      });
    `)
    for (const theme of ['light', 'dark']) {
      await pageCdp.evaluate(`document.documentElement.dataset.theme = '${theme}'`)
      const checks = await pageCdp.evaluate(`(() => {
        const luminance = rgb => {
          const c = rgb.match(/[\\d.]+/g).slice(0, 3).map(Number).map(v => {
            v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          });
          return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
        };
        return Array.from(document.querySelectorAll('.podium-card')).map(card => {
          const bg = luminance(getComputedStyle(card).backgroundColor);
          const contrast = selector => {
            const fg = luminance(getComputedStyle(card.querySelector(selector)).color);
            return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
          };
          const trophy = card.querySelector('.podium-trophy').getBoundingClientRect();
          const name = card.querySelector('.podium-username').getBoundingClientRect();
          return { overflow: card.scrollWidth > card.clientWidth,
            trophyClear: trophy.bottom <= name.top,
            nameContrast: contrast('.podium-username'), scoreContrast: contrast('.score-number') };
        });
      })()`)
      for (const check of checks) {
        assert.equal(check.overflow, false, 'Long names must fit enlarged-text cards')
        assert.equal(check.trophyClear, true, 'Trophy must not overlap username')
        assert(check.nameContrast >= 4.5 && check.scoreContrast >= 4.5, 'Card text contrast must pass')
      }
      assert.equal(await pageCdp.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true)
      console.log('Enlarged text, long names and contrast passed:', theme)
      await pageCdp.screenshot(path.join(ARTIFACT_DIR, `leaderboard_mobile_large_${theme}.png`))
    }

    console.log('\nALL LEADERBOARD VERIFICATIONS PASSED!')
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

run().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
