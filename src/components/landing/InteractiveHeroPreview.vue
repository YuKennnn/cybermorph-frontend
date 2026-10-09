<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
const containerRef = ref(null)
const isPaused = ref(false)
const userPrefersReducedMotion = ref(false)

let animationFrameId = null
let mouseX = -100
let mouseY = -100

// Character state (Defending operative)
const player = {
  x: 240,
  y: 190,
  width: 30,
  height: 30,
  speed: 2.8,
  targetX: 240,
  targetY: 190,
  isMoving: false,
  frameCount: 0,
}

// 4 Pixel Server Units sized for the bounded panel
const servers = [
  { x: 50, y: 150, width: 56, height: 84, isUnderAttack: false, attackTimer: 0 },
  { x: 50, y: 310, width: 56, height: 84, isUnderAttack: false, attackTimer: 0 },
  { x: 390, y: 140, width: 56, height: 84, isUnderAttack: false, attackTimer: 0 },
  { x: 390, y: 300, width: 56, height: 84, isUnderAttack: false, attackTimer: 0 },
]

const updateCoordinatesFromEvent = (clientX, clientY) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouseX = clientX - rect.left
  mouseY = clientY - rect.top
  player.targetX = Math.max(16, Math.min(canvas.width - 16, mouseX))
  player.targetY = Math.max(16, Math.min(canvas.height - 16, mouseY))
}

const handleMouseMove = (e) => {
  updateCoordinatesFromEvent(e.clientX, e.clientY)
}

const handleMouseLeave = () => {
  player.targetX = player.x
  player.targetY = player.y
  mouseX = -100
  mouseY = -100
}

const handleTouchMove = (e) => {
  if (e.touches && e.touches.length > 0) {
    updateCoordinatesFromEvent(e.touches[0].clientX, e.touches[0].clientY)
  }
}

const handleTouchStart = (e) => {
  if (e.touches && e.touches.length > 0) {
    updateCoordinatesFromEvent(e.touches[0].clientX, e.touches[0].clientY)
  }
}

const togglePause = () => {
  isPaused.value = !isPaused.value
  if (!isPaused.value) {
    draw()
  } else if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const resizeCanvas = () => {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const w = container.clientWidth
  const h = container.clientHeight || 360
  canvas.width = w
  canvas.height = h

  // Distribute servers proportionally inside the bounded box
  if (servers.length >= 4) {
    servers[0].x = Math.max(30, Math.round(w * 0.12))
    servers[0].y = Math.round(h * 0.38)
    servers[1].x = Math.max(30, Math.round(w * 0.12))
    servers[1].y = Math.round(h * 0.85)

    servers[2].x = Math.min(w - 86, Math.round(w * 0.82))
    servers[2].y = Math.round(h * 0.35)
    servers[3].x = Math.min(w - 86, Math.round(w * 0.82))
    servers[3].y = Math.round(h * 0.82)
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

  // Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)'
  ctx.beginPath()
  ctx.ellipse(drawX + width / 2, drawY + 2, width * 0.55, width * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  // Main Rack Body
  ctx.fillStyle = inConflict ? '#450a0a' : '#1e293b'
  ctx.fillRect(drawX, drawY - height, width, height)

  // Inner Frame
  ctx.fillStyle = inConflict ? '#7f1d1d' : '#334155'
  ctx.fillRect(drawX + 3, drawY - height + 3, width - 6, height - 6)

  // Server Slots
  ctx.fillStyle = '#0f172a'
  const slotCount = 5
  const slotHeight = Math.floor((height - 20) / slotCount)
  for (let i = 0; i < slotCount; i++) {
    ctx.fillRect(drawX + 6, drawY - height + 8 + i * slotHeight, width - 12, slotHeight - 4)
  }

  // Blinking Telemetry LEDs
  const time = Date.now() / 1000
  for (let i = 0; i < slotCount; i++) {
    const isBlinking = inConflict ? Math.random() > 0.3 : Math.sin(time * (i + 1) * 4 + x) > 0
    ctx.fillStyle = isBlinking ? (inConflict ? '#ef4444' : '#10b981') : '#064e3b'
    ctx.fillRect(drawX + 10, drawY - height + 10 + i * slotHeight, 4, 3)

    const isRed = inConflict ? Math.random() > 0.4 : Math.sin(time * (i + 2) * 2 + y) > 0.7
    ctx.fillStyle = isRed ? '#f87171' : '#475569'
    ctx.fillRect(drawX + 18, drawY - height + 10 + i * slotHeight, 4, 3)
  }

  // Breach Alert
  if (inConflict) {
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('BREACH!', drawX + width / 2, drawY - height - 8)

    ctx.beginPath()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)'
    ctx.lineWidth = 1.5
    ctx.arc(drawX + width / 2, drawY - height / 2, 22 + Math.random() * 4, 0, Math.PI * 2)
    ctx.stroke()
  }
}

const drawDefender = (ctx, p) => {
  const isMoving = p.isMoving
  p.frameCount += 0.15
  const bounce = isMoving ? Math.abs(Math.sin(p.frameCount)) * 3 : 0

  // Ground shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.15)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + p.height / 2, p.width * 0.45, p.width * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  const drawY = p.y - bounce

  // Cloak body (Purple)
  ctx.fillStyle = '#6d28d9'
  ctx.fillRect(p.x - p.width / 2, drawY - p.height / 2, p.width, p.height)

  // Inner chestplate
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(p.x - p.width * 0.35, drawY - p.height * 0.2, p.width * 0.7, p.height * 0.5)

  // Eyes pivoting toward cursor
  const eyeDx = p.targetX - p.x
  const eyeDy = p.targetY - p.y
  const lookX = eyeDx > 2 ? 2 : eyeDx < -2 ? -2 : 0
  const lookY = eyeDy > 2 ? 1 : eyeDy < -2 ? -1 : 0

  ctx.fillStyle = '#38bdf8'
  ctx.fillRect(p.x - 6 + lookX, drawY - 4 + lookY, 4, 3)
  ctx.fillRect(p.x + 2 + lookX, drawY - 4 + lookY, 4, 3)
}

const draw = () => {
  if (isPaused.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // Smooth interpolation toward target
  const dx = player.targetX - player.x
  const dy = player.targetY - player.y
  const distance = Math.hypot(dx, dy)

  if (distance > 4) {
    player.x += (dx / distance) * player.speed
    player.y += (dy / distance) * player.speed
    player.isMoving = true
  } else {
    player.isMoving = false
  }

  // Clear conflict flags
  servers.forEach((s) => {
    s.isUnderAttack = false
    if (s.attackTimer > 0) s.attackTimer--
  })

  // AABB Collision Check
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

  // Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Light Cyber Grid
  ctx.strokeStyle = 'rgba(109, 40, 217, 0.06)'
  ctx.lineWidth = 1
  const gridSize = 28
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }

  // Depth-sorted rendering
  const renderables = [
    { type: 'player', y: player.y + player.height / 2, data: player },
    ...servers.map((o) => ({ type: 'server', y: o.y, data: o })),
  ]
  renderables.sort((a, b) => a.y - b.y)

  for (const item of renderables) {
    if (item.type === 'server') drawServer(ctx, item.data)
    else if (item.type === 'player') drawDefender(ctx, item.data)
  }

  // Reticle at cursor/touch point
  if (mouseX > 0 && mouseY > 0) {
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, 9 + Math.sin(player.frameCount) * 1.5, 0, Math.PI * 2)
    ctx.stroke()
  }

  animationFrameId = requestAnimationFrame(draw)
}

onMounted(() => {
  // Check user preference for reduced motion
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  userPrefersReducedMotion.value = mediaQuery.matches
  if (mediaQuery.matches) {
    isPaused.value = true
  }

  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()

  if (canvasRef.value) {
    player.x = canvasRef.value.width / 2
    player.y = canvasRef.value.height / 2
    player.targetX = player.x
    player.targetY = player.y
  }

  if (!isPaused.value) {
    draw()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<template>
  <div class="interactive-preview-panel">
    <!-- Top Bar with status & controls -->
    <div class="panel-header">
      <div class="header-left">
        <span class="status-dot" :class="{ paused: isPaused }"></span>
        <span class="panel-title">Interactive preview</span>
        <span class="preview-badge">Simulation preview</span>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="btn-control"
          :aria-pressed="isPaused"
          @click="togglePause"
        >
          {{ isPaused ? 'Resume' : 'Pause' }}
        </button>
      </div>
    </div>

    <!-- Canvas Simulation Stage -->
    <div
      ref="containerRef"
      class="canvas-stage"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @touchstart.passive="handleTouchStart"
      @touchmove.passive="handleTouchMove"
    >
      <canvas
        ref="canvasRef"
        class="simulation-canvas"
        aria-hidden="true"
      ></canvas>

      <div v-if="isPaused" class="paused-overlay">
        <span class="paused-pill">Animation paused</span>
      </div>
    </div>

    <!-- Bottom Context Note -->
    <div class="panel-footer">
      <div class="footer-hint">
        <span class="hint-icon">&bull;</span>
        <span>Move pointer or touch screen to guide the defender. Servers alert on contact.</span>
      </div>
      <span class="disclaimer-text">Not a playable browser version &bull; Android APK required</span>
    </div>
  </div>
</template>

<style scoped>
.interactive-preview-panel {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-purple);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.85rem;
  background-color: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
}

.status-dot.paused {
  background-color: #94a3b8;
}

.panel-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.preview-badge {
  font-size: 0.725rem;
  font-weight: 500;
  color: var(--color-primary);
  background-color: #ede9fe;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-control {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-control:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background-color: #f5f3ff;
}

.canvas-stage {
  position: relative;
  width: 100%;
  height: 340px;
  background-color: #fdfdfd;
  cursor: crosshair;
  overflow: hidden;
  touch-action: none;
}

.simulation-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.paused-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.paused-pill {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--color-border);
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background-color: #ffffff;
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
  gap: 0.5rem;
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-muted);
}

.hint-icon {
  color: var(--color-primary);
  font-size: 1rem;
  line-height: 1;
}

.disclaimer-text {
  font-style: italic;
  color: #94a3b8;
}

@media (max-width: 640px) {
  .canvas-stage {
    height: 260px;
  }

  .panel-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
