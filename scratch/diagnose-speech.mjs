import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const CDP_PORT = 9239
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-diagnose-speech-' + Date.now())

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
    await this.send('DOM.enable')
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
  console.log('Launching Chrome with CDP on port', CDP_PORT)
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
  ])

  await new Promise((r) => setTimeout(r, 2000))

  try {
    const pagesRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const pages = await pagesRes.json()
    const targetPage = pages.find((p) => p.type === 'page') || pages[0]
    const cdp = new ChromeCDP(targetPage.webSocketDebuggerUrl)
    await cdp.connect()

    console.log('--- 1. BROWSER ENVIRONMENT TELEMETRY ---')
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/about' })
    await new Promise((r) => setTimeout(r, 1500))

    const browserInfo = await cdp.eval(`(() => {
      return {
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
        platform: navigator.platform,
        hasSpeechSynthesis: 'speechSynthesis' in window,
        voicesLength: window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0,
        voices: window.speechSynthesis ? window.speechSynthesis.getVoices().map(v => ({ name: v.name, lang: v.lang, default: v.default })) : [],
        speaking: window.speechSynthesis?.speaking,
        pending: window.speechSynthesis?.pending,
        paused: window.speechSynthesis?.paused,
        pointerFine: window.matchMedia('(pointer: fine)').matches,
        hoverHover: window.matchMedia('(hover: hover)').matches,
      };
    })()`)
    console.log('Browser Telemetry:', JSON.stringify(browserInfo, null, 2))

    console.log('\n--- 2. RAW SPEECH SYNTHESIS BEHAVIOR TEST ---')
    // Test raw speech synthesis in this Chrome environment
    const rawSpeechResult = await cdp.eval(`new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        return resolve({ supported: false });
      }
      const logs = [];
      const u = new SpeechSynthesisUtterance('Test speech synthesis');
      u.onstart = () => logs.push('onstart');
      u.onend = () => {
        logs.push('onend');
        resolve({ logs, speaking: window.speechSynthesis.speaking });
      };
      u.onerror = (e) => {
        logs.push('onerror: ' + e.error);
        resolve({ logs, error: e.error, speaking: window.speechSynthesis.speaking });
      };
      
      logs.push('call speak');
      window.speechSynthesis.speak(u);
      
      setTimeout(() => {
        resolve({ logs, timeout: true, speaking: window.speechSynthesis.speaking, pending: window.speechSynthesis.pending, paused: window.speechSynthesis.paused });
      }, 3000);
    })`)
    console.log('Raw speech synthesis result:', JSON.stringify(rawSpeechResult, null, 2))

    console.log('\n--- 3. COMPARISON OF NARRATION INVOCATIONS ---')
    // Setup preferences
    await cdp.eval(`
      localStorage.setItem('cyber_pref_read_aloud', 'on');
      localStorage.setItem('cyber_pref_hover_narration', 'on');
      localStorage.setItem('cyber_pref_hover_delay', '0.5');
      window.dispatchEvent(new Event('storage'));
    `)
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/about' })
    await new Promise((r) => setTimeout(r, 1500))

    // A. Explicit click on "Read section"
    console.log('Test A: Explicit click on Read section button:')
    const clickResult = await cdp.eval(`(() => {
      const btn = document.querySelector('.btn-read-section');
      if (!btn) return { found: false };
      btn.click();
      return { found: true };
    })()`)
    console.log('Click result:', clickResult)
    await new Promise((r) => setTimeout(r, 500))

    const playerAfterClick = await cdp.eval(`(() => {
      const player = document.querySelector('.inline-speech-player');
      return {
        hasPlayer: !!player,
        text: player?.textContent?.trim() || '',
        statusFeedback: player?.querySelector('.player-status-feedback')?.textContent?.trim() || '',
        speaking: window.speechSynthesis?.speaking,
        pending: window.speechSynthesis?.pending,
        paused: window.speechSynthesis?.paused,
      };
    })()`)
    console.log('Player state after click:', playerAfterClick)

    // Stop explicit
    await cdp.eval(`document.querySelector('.btn-player-stop')?.click()`)
    await new Promise((r) => setTimeout(r, 500))

    // B. Pointer enter hover on About section
    console.log('\nTest B: Hovering over About section:')
    const hoverSetup = await cdp.eval(`(() => {
      const hero = document.querySelector('.about-hero');
      if (!hero) return { found: false };
      hero.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: false }));
      return { found: true };
    })()`)
    console.log('Hover dispatched:', hoverSetup)
    // Wait for 0.5s delay + 200ms
    await new Promise((r) => setTimeout(r, 800))

    const playerAfterHover = await cdp.eval(`(() => {
      const player = document.querySelector('.inline-speech-player');
      return {
        hasPlayer: !!player,
        text: player?.textContent?.trim() || '',
        statusFeedback: player?.querySelector('.player-status-feedback')?.textContent?.trim() || '',
        speaking: window.speechSynthesis?.speaking,
        pending: window.speechSynthesis?.pending,
        paused: window.speechSynthesis?.paused,
      };
    })()`)
    console.log('Player state after hover:', playerAfterHover)

    // C. Hovering over Settings or Dashboard text
    console.log('\nTest C: Hovering over Settings / Dashboard:')
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/settings?section=accessibility' })
    await new Promise((r) => setTimeout(r, 1000))
    const settingsHover = await cdp.eval(`(() => {
      const card = document.querySelector('.settings-card');
      card?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: false }));
      return { hasPlayer: !!document.querySelector('.inline-speech-player') };
    })()`)
    console.log('Settings hover coverage test:', settingsHover)

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
