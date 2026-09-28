<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const heroCanvas = ref(null)
let animationFrameId = null
let mouseX = -100
let mouseY = -100

// Character state
const player = {
  x: 200,
  y: 200,
  width: 32,
  height: 32,
  speed: 2.5,
  color: '#7D5CFF', // pixel-violet
  targetX: 200,
  targetY: 200,
  isMoving: false,
  frameCount: 0,
}

// Generate some static "pixel" servers
const servers = []
for (let i = 0; i < 6; i++) {
  servers.push({
    x: 0,
    y: 0,
    width: 60,
    height: 90,
    isUnderAttack: false,
    attackTimer: 0,
  })
}

const handleMouseMove = (e) => {
  const canvas = heroCanvas.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
  player.targetX = mouseX
  player.targetY = mouseY
}

const handleMouseLeave = () => {
  player.targetX = player.x
  player.targetY = player.y
  mouseX = -100
  mouseY = -100
}

const placeServers = (w, h) => {
  const placedServers = []
  const minDistance = 110 // Minimum spacing between server units

  const textWidth = Math.min(896, w - 40)
  const textLeft = (w - textWidth) / 2
  const textRight = textLeft + textWidth
  const textHeight = 500
  const textTop = (h - textHeight) / 2
  const textBottom = textTop + textHeight

  servers.forEach((obs) => {
    let isValid = false
    let attempts = 0

    while (!isValid && attempts < 100) {
      const isLeft = Math.random() > 0.5
      let testX, testY

      if (w > 1024) {
        testX = isLeft ? Math.random() * (w * 0.15) + 20 : Math.random() * (w * 0.15) + w * 0.8
        testY = Math.random() * (h * 0.7) + h * 0.15
      } else {
        testX = isLeft ? Math.random() * 10 - 10 : w - 50 - Math.random() * 10
        const safeTopSpace = Math.max(0, textTop - 20)
        const safeBottomSpace = Math.max(0, h - textBottom - 20)

        if (safeTopSpace > 100 && (Math.random() > 0.5 || safeBottomSpace < 100)) {
          testY = Math.random() * (safeTopSpace - 90) + 90
        } else if (safeBottomSpace > 100) {
          testY = Math.random() * (safeBottomSpace - 90) + textBottom + 90
        } else {
          testY = Math.random() * (h * 0.8) + h * 0.1
        }
      }

      const serverLeft = testX
      const serverRight = testX + obs.width
      const serverTop = testY - obs.height
      const serverBottom = testY

      const overlapsText = !(
        serverRight < textLeft ||
        serverLeft > textRight ||
        serverBottom < textTop ||
        serverTop > textBottom
      )

      let overlapsServers = false
      for (const placed of placedServers) {
        const dx = placed.x - testX
        const dy = placed.y - testY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDistance) {
          overlapsServers = true
          break
        }
      }

      if (!overlapsText && !overlapsServers) {
        obs.x = testX
        obs.y = testY
        placedServers.push(obs)
        isValid = true
      }
      attempts++
    }

    if (!isValid) {
      const isLeft = Math.random() > 0.5
      obs.x = isLeft ? -10 : w - 50
      let cornerCount = 0
      const isTop = Math.random() > 0.5
      for (const placed of placedServers) {
        if ((isLeft && placed.x < w / 2) || (!isLeft && placed.x > w / 2)) {
          if ((isTop && placed.y < h / 2) || (!isTop && placed.y > h / 2)) {
            cornerCount++
          }
        }
      }
      obs.y = isTop
        ? Math.max(90, h * 0.15) + cornerCount * 100
        : Math.min(h - 20, h * 0.85) - cornerCount * 100
      placedServers.push(obs)
    }
    obs.baseXRatio = obs.x / w
    obs.baseYRatio = obs.y / h
  })
}

let serversPlaced = false

const adaptServers = (w, h) => {
  const textWidth = Math.min(896, w - 40)
  const textLeft = (w - textWidth) / 2
  const textRight = textLeft + textWidth
  const textHeight = 500
  const textTop = (h - textHeight) / 2
  const textBottom = textTop + textHeight

  servers.forEach((obs) => {
    let targetX = obs.baseXRatio * w
    let targetY = obs.baseYRatio * h

    const serverLeft = targetX
    const serverRight = targetX + obs.width
    const serverTop = targetY - obs.height
    const serverBottom = targetY

    const overlapsText = !(
      serverRight < textLeft ||
      serverLeft > textRight ||
      serverBottom < textTop ||
      serverTop > textBottom
    )

    if (overlapsText) {
      const toLeft = serverRight - textLeft
      const toRight = textRight - serverLeft
      const toTop = serverBottom - textTop
      const toBottom = textBottom - serverTop
      const minPush = Math.min(toLeft, toRight, toTop, toBottom)

      if (minPush === toTop) {
        targetY = textTop - 5
      } else if (minPush === toBottom) {
        targetY = textBottom + obs.height + 5
      } else if (minPush === toLeft) {
        targetX = textLeft - obs.width - 5
      } else {
        targetX = textRight + 5
      }
    }
    obs.x = targetX
    obs.y = targetY
  })
}

const resizeCanvas = () => {
  const canvas = heroCanvas.value
  if (canvas) {
    const parent = canvas.parentElement
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight

    if (!serversPlaced) {
      placeServers(canvas.width, canvas.height)
      serversPlaced = true
    } else {
      adaptServers(canvas.width, canvas.height)
    }
  }
}

const drawServer = (ctx, server) => {
  const { x, y, width, height, isUnderAttack, attackTimer } = server
  let drawX = x
  let drawY = y
  const inConflict = isUnderAttack || attackTimer > 0

  if (inConflict) {
    drawX += (Math.random() - 0.5) * 4
    drawY += (Math.random() - 0.5) * 2
  }

  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(drawX + width / 2, drawY, width * 0.6, width * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = inConflict ? '#4a1111' : '#2c2e33'
  ctx.fillRect(drawX, drawY - height, width, height)
  ctx.fillStyle = inConflict ? '#5a1f1f' : '#3f424a'
  ctx.fillRect(drawX + 4, drawY - height + 4, width - 8, height - 8)
  ctx.fillStyle = '#1f2024'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(drawX + 8, drawY - height + 12 + i * 14, width - 16, 6)
  }
  const time = Date.now() / 1000
  for (let i = 0; i < 5; i++) {
    const isBlinking = inConflict ? Math.random() > 0.3 : Math.sin(time * (i + 1) * 5 + x) > 0
    ctx.fillStyle = isBlinking ? (inConflict ? '#ff3333' : '#00ffcc') : '#005544'
    ctx.fillRect(drawX + 12, drawY - height + 14 + i * 14, 3, 3)
    const isRed = inConflict ? Math.random() > 0.5 : Math.sin(time * (i + 2) * 2 + y) > 0.8
    ctx.fillStyle = isRed ? '#ff4444' : '#551111'
    ctx.fillRect(drawX + 20, drawY - height + 14 + i * 14, 3, 3)
  }

  if (inConflict) {
    ctx.fillStyle = '#ff3333'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BREACH!', drawX + width / 2, drawY - height - 10)
    ctx.beginPath()
    ctx.strokeStyle = '#ff3333'
    ctx.lineWidth = 2
    ctx.arc(drawX + width / 2, drawY - height / 2, 20 + Math.random() * 5, 0, Math.PI * 2)
    ctx.stroke()
  }
}

const drawTailgater = (ctx, p) => {
  const isMoving = p.isMoving
  p.frameCount += 0.15
  const bounce = isMoving ? Math.abs(Math.sin(p.frameCount)) * 4 : 0
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + p.height / 2, p.width * 0.4, p.width * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  const drawY = p.y - bounce
  ctx.fillStyle = '#3b1d52'
  ctx.fillRect(p.x - p.width / 2, drawY - p.height / 2, p.width, p.height)
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(p.x - p.width * 0.35, drawY - p.height * 0.2, p.width * 0.7, p.height * 0.5)
  const eyeDx = p.targetX - p.x
  const eyeDy = p.targetY - p.y
  let lookX = isMoving ? (eyeDx > 0 ? 2 : -2) : 0
  let lookY = isMoving ? (eyeDy > 0 ? 2 : -2) : 0
  ctx.fillStyle = '#ff3333'
  ctx.shadowColor = '#ff3333'
  ctx.shadowBlur = 6
  ctx.fillRect(p.x - 6 + lookX, drawY - 4 + lookY, 3, 2)
  ctx.fillRect(p.x + 3 + lookX, drawY - 4 + lookY, 3, 2)
  ctx.shadowBlur = 0
}

const draw = () => {
  const canvas = heroCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dx = player.targetX - player.x
  const dy = player.targetY - player.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance > 5) {
    player.x += (dx / distance) * player.speed
    player.y += (dy / distance) * player.speed
    player.isMoving = true
  } else {
    player.isMoving = false
  }

  servers.forEach((s) => {
    s.isUnderAttack = false
    if (s.attackTimer > 0) s.attackTimer--
  })

  const pLeft = player.x - player.width / 2
  const pRight = player.x + player.width / 2
  const pTop = player.y - player.height / 2
  const pBottom = player.y + player.height / 2

  servers.forEach((s) => {
    const sLeft = s.x
    const sRight = s.x + s.width
    const sTop = s.y - s.height
    const sBottom = s.y
    if (pLeft < sRight && pRight > sLeft && pTop < sBottom && pBottom > sTop) {
      s.isUnderAttack = true
      s.attackTimer = 60
    }
  })

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const renderables = [
    { type: 'player', y: player.y + player.height / 2, data: player },
    ...servers.map((o) => ({ type: 'server', y: o.y, data: o })),
  ]
  renderables.sort((a, b) => a.y - b.y)
  for (const item of renderables) {
    if (item.type === 'server') drawServer(ctx, item.data)
    else if (item.type === 'player') drawTailgater(ctx, item.data)
  }

  if (mouseX > 0 && mouseY > 0) {
    ctx.strokeStyle = '#4d8f53'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, 10 + Math.sin(player.frameCount) * 2, 0, Math.PI * 2)
    ctx.stroke()
  }
  animationFrameId = requestAnimationFrame(draw)
}

onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
  const w = window.innerWidth
  const h = window.innerHeight
  player.x = w / 2
  player.y = h / 2
  player.targetX = w / 2
  player.targetY = h / 2
  resizeCanvas()
  draw()
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <section
    class="relative isolate overflow-hidden px-5 py-10 sm:px-6 lg:px-10"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <div class="landing-grid" aria-hidden="true"></div>

    <!-- Interactive Canvas -->
    <canvas
      ref="heroCanvas"
      class="absolute inset-0 -z-10 h-full w-full"
      style="image-rendering: pixelated; pointer-events: none"
    ></canvas>

    <div class="mx-auto max-w-7xl">
      <div
        class="flex min-h-[calc(100vh-5.5rem)] items-center justify-center py-14 lg:py-20 pointer-events-none"
      >
        <div class="mx-auto max-w-4xl text-center pointer-events-auto">
          <p class="eyebrow">Cybersecurity simulation platform</p>
          <h1
            class="mx-auto mt-5 max-w-4xl text-5xl font-black leading-[0.98] text-pixel-plum sm:text-6xl lg:text-7xl"
          >
            Train defenders inside living cyber worlds.
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-pixel-plum/75">
            CyberMorph turns digital safety lessons into playable missions, clear progress, and
            instructor-ready insights for modern learning teams.
          </p>

          <div class="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <router-link to="/register" class="btn-hero btn-hero-primary">
              Start Training
            </router-link>
            <a href="#showcase" class="btn-hero btn-hero-secondary"> View Showcase </a>
          </div>

          <dl class="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3">
            <div class="metric-tile">
              <dt>Maps</dt>
              <dd>04</dd>
            </div>
            <div class="metric-tile">
              <dt>Roles</dt>
              <dd>03</dd>
            </div>
            <div class="metric-tile">
              <dt>Mode</dt>
              <dd>Live</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "../../assets/main.css";

.landing-grid {
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.45;
  background-image:
    linear-gradient(rgba(125, 92, 255, 0.15) 1.5px, transparent 1.5px),
    linear-gradient(90deg, rgba(125, 92, 255, 0.15) 1.5px, transparent 1.5px);
  background-size: 40px 40px;
  mask-image: linear-gradient(to bottom, black, transparent 90%);
}

.eyebrow {
  @apply text-sm font-black uppercase text-pixel-violet;
  font-family: var(--font-display);
}

h1 {
  font-family: var(--font-display);
}

.btn-hero {
  @apply inline-flex min-h-12 items-center justify-center rounded-md px-6 text-sm font-black transition-all duration-200 active:scale-95;
  font-family: var(--font-display);
}

.btn-hero-primary {
  @apply border border-pixel-violet bg-pixel-violet text-white shadow-pixel-hero hover:brightness-110;
}

.btn-hero-secondary {
  @apply border border-pixel-plum/15 bg-white/55 text-pixel-plum shadow-pixel-soft hover:border-pixel-violet/45 hover:bg-pixel-lavender/35 hover:text-pixel-violet;
}

.metric-tile {
  @apply rounded-md border border-pixel-violet/15 bg-white/55 p-4 shadow-pixel-soft;
}

.metric-tile dt {
  @apply text-xs font-bold uppercase text-pixel-plum/55;
}

.metric-tile dd {
  @apply mt-2 font-mono text-2xl font-black text-pixel-plum;
}

@media (max-width: 640px) {
  .metric-tile {
    @apply p-3;
  }
  .metric-tile dd {
    @apply text-xl;
  }
}
</style>
