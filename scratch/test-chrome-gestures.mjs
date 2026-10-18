import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const CDP_PORT = 9241
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-gesture-test-' + Date.now())

class ChromeCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.pending = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) rej(new Error(msg.error.message))
        else res(msg.result)
      }
    }
    await this.send('Page.enable')
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`)
    }
    return res.result?.value
  }

  async close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

async function main() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  console.log('Launching normal Chrome with CDP...')
  // Normal Chrome without autoplay flags
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--no-first-run',
  ])

  await new Promise((r) => setTimeout(r, 2000))

  try {
    const pagesRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await pagesRes.json()
    const targetPage = pages.find((p) => p.type === 'page') || pages[0]
    const cdp = new ChromeCDP(targetPage.webSocketDebuggerUrl)
    await cdp.connect()

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/about' })
    await new Promise((r) => setTimeout(r, 1500))

    // 1. Check user activation before any interaction
    const actBefore = await cdp.eval(`({
      hasBeenActive: navigator.userActivation?.hasBeenActive,
      isActive: navigator.userActivation?.isActive,
    })`)
    console.log('1. User activation BEFORE interaction:', actBefore)

    // 2. Simulate a real click using Input.dispatchMouseEvent
    console.log('2. Dispatching real mouse click on document...')
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 100,
      y: 100,
      button: 'left',
      clickCount: 1,
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 100,
      y: 100,
      button: 'left',
      clickCount: 1,
    })

    const actAfter = await cdp.eval(`({
      hasBeenActive: navigator.userActivation?.hasBeenActive,
      isActive: navigator.userActivation?.isActive,
    })`)
    console.log('3. User activation AFTER real click:', actAfter)

    // 4. Test speech synthesis AFTER user activation
    const testAfterAct = await cdp.eval(`new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance('Speech test after user click');
      const events = [];
      u.onstart = () => events.push('onstart');
      u.onerror = (e) => events.push('onerror: ' + e.error);
      u.onend = () => events.push('onend');
      window.speechSynthesis.speak(u);
      setTimeout(() => resolve({ events, speaking: window.speechSynthesis.speaking }), 1500);
    })`)
    console.log('4. Speech synthesis result after user activation:', testAfterAct)

    // 5. Test hover narration in AboutView after user activation
    console.log('5. Enabling preferences and testing Hover in AboutView...')
    await cdp.eval(`
      localStorage.setItem('cyber_pref_read_aloud', 'on');
      localStorage.setItem('cyber_pref_hover_narration', 'on');
      localStorage.setItem('cyber_pref_hover_delay', '0.5');
    `)
    // Reload page to start clean with preferences set
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/about' })
    await new Promise((r) => setTimeout(r, 1500))

    // Check user activation on fresh page load
    const freshAct = await cdp.eval(`navigator.userActivation?.hasBeenActive`)
    console.log('Fresh page reload hasBeenActive:', freshAct)

    // If fresh page load has NO user activation, hover event is dispatched
    console.log('Dispatching hover on fresh page (no click yet)...')
    await cdp.eval(`(() => {
      const hero = document.querySelector('.about-hero');
      hero?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    })()`)
    await new Promise((r) => setTimeout(r, 800))

    const playerStateNoClick = await cdp.eval(`(() => {
      const p = document.querySelector('.inline-speech-player');
      return {
        hasPlayer: !!p,
        statusText: p?.textContent?.trim() || '',
        speechState: window.speechSynthesis ? {
          speaking: window.speechSynthesis.speaking,
          pending: window.speechSynthesis.pending,
          paused: window.speechSynthesis.paused,
        } : null
      };
    })()`)
    console.log('Player state after hover with NO previous click on page:', playerStateNoClick)

    // Now click on the page
    console.log('Now clicking on page...')
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 100,
      y: 100,
      button: 'left',
      clickCount: 1,
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 100,
      y: 100,
      button: 'left',
      clickCount: 1,
    })

    // Now dispatch hover again (pointerleave then pointerenter)
    console.log('Dispatching hover AFTER page click...')
    await cdp.eval(`(() => {
      const hero = document.querySelector('.about-hero');
      hero?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      hero?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    })()`)
    await new Promise((r) => setTimeout(r, 800))

    const playerStateWithClick = await cdp.eval(`(() => {
      const p = document.querySelector('.inline-speech-player');
      return {
        hasPlayer: !!p,
        statusText: p?.textContent?.trim() || '',
        speechState: window.speechSynthesis ? {
          speaking: window.speechSynthesis.speaking,
          pending: window.speechSynthesis.pending,
          paused: window.speechSynthesis.paused,
        } : null
      };
    })()`)
    console.log('Player state after hover WITH previous click on page:', playerStateWithClick)

    await cdp.close()
  } finally {
    chromeProcess.kill()
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

main().catch(console.error)
