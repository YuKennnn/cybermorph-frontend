import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const CDP_PORT = 9240
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-user-act-' + Date.now())

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
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
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

    // Check with --autoplay-policy=no-user-gesture-required
    const testWithPolicy = await cdp.eval(`new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance('Testing speech');
      u.onstart = () => resolve({ event: 'onstart' });
      u.onerror = (e) => resolve({ event: 'onerror', error: e.error });
      u.onend = () => resolve({ event: 'onend' });
      window.speechSynthesis.speak(u);
      setTimeout(() => resolve({ event: 'timeout', speaking: window.speechSynthesis.speaking }), 3000);
    })`)
    console.log('Result with no-user-gesture-required flag:', testWithPolicy)

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
