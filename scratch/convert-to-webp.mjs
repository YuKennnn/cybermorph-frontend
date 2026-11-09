/* global process, Buffer */
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const CDP_PORT = 9250
const USER_DATA_DIR = path.join(os.tmpdir(), 'cybermorph-img-conv-' + Date.now())

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

  async close() {
    if (this.ws) this.ws.close()
  }
}

function killPidTree(pid) {
  if (!pid) return
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
  } catch (err) {
    void err
  }
}

async function convertImages() {
  const edge = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    'about:blank',
  ])

  await new Promise((r) => setTimeout(r, 1500))

  const versionRes = await fetch(`http://localhost:${CDP_PORT}/json/list`)
  const targets = await versionRes.json()
  const pageTarget = targets.find((t) => t.type === 'page')

  const cdp = new ChromeCDP(pageTarget.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const imgFiles = [
    { src: 'home-gameplay.png', out: 'home-gameplay.webp' },
    { src: 'office-gameplay.png', out: 'office-gameplay.webp' },
    { src: 'internet-cafe-server.png', out: 'internet-cafe-server.webp' },
    { src: 'public-park-gameplay.png', out: 'public-park-gameplay.webp' },
  ]

  const dir = path.resolve('src/assets/hero-gameplay')

  for (const item of imgFiles) {
    const inPath = path.join(dir, item.src)
    const outPath = path.join(dir, item.out)
    const inBuffer = fs.readFileSync(inPath)
    const base64Png = inBuffer.toString('base64')
    const beforeSize = inBuffer.length

    console.log(`Processing ${item.src} (${beforeSize} bytes)...`)

    // Load into browser image, draw scaled onto canvas, get WebP data URL
    const webpDataUrl = await cdp.eval(`
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // target width ~1080px (crisp 2x DPR preview for 540px width container)
          const targetWidth = 1080;
          const scale = targetWidth / img.width;
          const targetHeight = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const dataUrl = canvas.toDataURL('image/webp', 0.86);
          resolve({
            dataUrl,
            width: targetWidth,
            height: targetHeight
          });
        };
        img.onerror = (e) => reject(new Error('Failed to load image in browser'));
        img.src = 'data:image/png;base64,${base64Png}';
      })
    `)

    const base64Data = webpDataUrl.dataUrl.split(',')[1]
    const outBuffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(outPath, outBuffer)

    const afterSize = outBuffer.length
    const reduction = (((beforeSize - afterSize) / beforeSize) * 100).toFixed(1)
    console.log(
      `Saved ${item.out}: ${webpDataUrl.width}x${webpDataUrl.height}, ${afterSize} bytes (${reduction}% reduction)`
    )
  }

  await cdp.close()
  killPidTree(edge.pid)
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true, maxRetries: 3 })
  } catch (err) {
    void err
  }
}

convertImages().catch((err) => {
  console.error(err)
  process.exit(1)
})
