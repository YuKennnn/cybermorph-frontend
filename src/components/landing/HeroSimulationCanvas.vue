<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'

const heroCanvasRef = ref(null)
let animationFrameId = null
let frameCount = 0

const mousePos = reactive({
  x: -1000,
  y: -1000,
  active: false,
})

const player = reactive({
  x: 200,
  y: 200,
  targetX: 200,
  targetY: 200,
  width: 32,
  height: 32,
  angle: 0,
  bounce: 0,
  isMoving: false,
  frameCount: 0,
})

// 6 Procedural Server Terminals (60x90 px)
const servers = reactive([
  { id: 1, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.1, baseYRatio: 0.25 },
  { id: 2, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.08, baseYRatio: 0.65 },
  { id: 3, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.18, baseYRatio: 0.8 },
  { id: 4, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.88, baseYRatio: 0.22 },
  { id: 5, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.9, baseYRatio: 0.62 },
  { id: 6, x: 0, y: 0, width: 60, height: 90, isUnderAttack: false, attackTimer: 0, jitterX: 0, jitterY: 0, baseXRatio: 0.82, baseYRatio: 0.82 },
])

const handleMouseMove = (e) => {
  const canvas = heroCanvasRef.value
  const parent = canvas?.parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  mousePos.x = e.clientX - rect.left
  mousePos.y = e.clientY - rect.top
  mousePos.active = true
  player.targetX = mousePos.x
  player.targetY = mousePos.y
}

const handleMouseLeave = () => {
  mousePos.active = false
}

// Compute Server Layout with Central Text Exclusion Zone
const placeServers = (w, h) => {
  const textWidth = Math.min(840, w - 40)
  const textLeft = (w - textWidth) / 2
  const textRight = textLeft + textWidth
  const textHeight = 440
  const textTop = Math.max(30, (h - textHeight) / 2)
  const textBottom = textTop + textHeight

  const placedServers = []
  const minDistance = 100

  servers.forEach((obs) => {
    let isValid = false
    let attempts = 0

    while (!isValid && attempts < 100) {
      const isLeft = Math.random() > 0.5
      let testX, testY

      if (w > 1024) {
        testX = isLeft ? Math.random() * (w * 0.16) + 15 : Math.random() * (w * 0.16) + w * 0.8
        testY = Math.random() * (h * 0.72) + h * 0.14
      } else {
        testX = isLeft ? Math.random() * 15 + 5 : w - 75 - Math.random() * 15
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
      obs.x = isLeft ? 10 : w - 70
      obs.y = Math.min(h - 20, Math.max(90, h * 0.5))
      placedServers.push(obs)
    }

    obs.baseXRatio = obs.x / w
    obs.baseYRatio = obs.y / h
  })
}

const adaptServers = (w, h) => {
  const textWidth = Math.min(840, w - 40)
  const textLeft = (w - textWidth) / 2
  const textRight = textLeft + textWidth
  const textHeight = 440
  const textTop = Math.max(30, (h - textHeight) / 2)
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

let serversPlaced = false

const setupCanvas = () => {
  if (!heroCanvasRef.value) return
  const canvas = heroCanvasRef.value
  const parent = canvas.parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  if (!serversPlaced) {
    placeServers(rect.width, rect.height)
    serversPlaced = true
  } else {
    adaptServers(rect.width, rect.height)
  }
}

// Render Tactical Reticle
const drawReticle = (ctx) => {
  if (!mousePos.active) return
  ctx.save()
  const pulse = Math.sin(frameCount * 0.14) * 2.5
  const radius = 12 + pulse

  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(mousePos.x, mousePos.y, radius, 0, Math.PI * 2)
  ctx.stroke()

  // 4 Targeting Crosshair Ticks
  const tickLen = 4
  ctx.beginPath()
  ctx.moveTo(mousePos.x - radius - tickLen, mousePos.y)
  ctx.lineTo(mousePos.x - radius + 1, mousePos.y)
  ctx.moveTo(mousePos.x + radius - 1, mousePos.y)
  ctx.lineTo(mousePos.x + radius + tickLen, mousePos.y)
  ctx.moveTo(mousePos.x, mousePos.y - radius - tickLen)
  ctx.lineTo(mousePos.x, mousePos.y - radius + 1)
  ctx.moveTo(mousePos.x, mousePos.y + radius - 1)
  ctx.lineTo(mousePos.x, mousePos.y + radius + tickLen)
  ctx.stroke()

  // Center Target Dot
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(mousePos.x, mousePos.y, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Render Pixel-Art Server Rack
const drawServer = (ctx, server) => {
  const { x, y, width, height, isUnderAttack, attackTimer } = server
  let drawX = x + server.jitterX
  let drawY = y + server.jitterY
  const inConflict = isUnderAttack || attackTimer > 0

  ctx.save()

  // Ambient Drop Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)'
  ctx.beginPath()
  ctx.roundRect(drawX + 3, drawY - height + 3, width, height, 6)
  ctx.fill()

  // Cabinet Body
  ctx.fillStyle = inConflict ? '#1e1b4b' : '#0f172a'
  ctx.strokeStyle = inConflict ? '#ef4444' : '#334155'
  ctx.lineWidth = inConflict ? 2 : 1.5
  ctx.beginPath()
  ctx.roundRect(drawX, drawY - height, width, height, 6)
  ctx.fill()
  ctx.stroke()

  // Server Blades & LEDs
  const bladeCount = 4
  const bladeHeight = 15
  const bladeGap = 4

  for (let i = 0; i < bladeCount; i++) {
    const by = drawY - height + 8 + i * (bladeHeight + bladeGap)

    // Blade Slot
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(drawX + 5, by, width - 10, bladeHeight)

    // Ventilation Lines
    ctx.fillStyle = '#334155'
    ctx.fillRect(drawX + 8, by + 4, 18, 1.5)
    ctx.fillRect(drawX + 8, by + 8, 18, 1.5)

    // Status LEDs
    for (let led = 0; led < 3; led++) {
      const lx = drawX + 32 + led * 7
      const ly = by + 7

      let ledColor = '#06b6d4'
      if (inConflict) {
        ledColor = (frameCount + led * 5) % 8 < 4 ? '#ef4444' : '#7f1d1d'
      } else {
        if (led === 2) {
          ledColor = (frameCount + i * 10) % 30 < 15 ? '#10b981' : '#059669'
        }
      }

      ctx.save()
      ctx.fillStyle = ledColor
      if (inConflict) {
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 6
      }
      ctx.beginPath()
      ctx.arc(lx, ly, 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Breach Alert Visuals
  if (inConflict) {
    const pulseRadius = 45 + Math.sin(frameCount * 0.25) * 8
    ctx.save()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(drawX + width / 2, drawY - height / 2, pulseRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Floating Monospace "BREACH!" Text
    ctx.save()
    ctx.font = '700 12px "JetBrains Mono", monospace'
    ctx.fillStyle = '#ef4444'
    ctx.shadowColor = '#ef4444'
    ctx.shadowBlur = 8
    const floatY = drawY - height - 10 - (60 - attackTimer) * 0.15
    ctx.fillText('BREACH!', drawX + 6, floatY)
    ctx.restore()
  }

  ctx.restore()
}

// Render Pixel-Art Operative Sprite
const drawPlayer = (ctx, p) => {
  ctx.save()
  const px = p.x
  const py = p.y + p.bounce

  // Ground Drop Shadow
  ctx.fillStyle = 'rgba(30, 27, 75, 0.18)'
  ctx.beginPath()
  ctx.ellipse(px, p.y + 16, 12, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Trenchcoat Body
  ctx.fillStyle = '#1e1b4b'
  ctx.beginPath()
  ctx.roundRect(px - 9, py - 4, 18, 18, [4, 4, 2, 2])
  ctx.fill()

  // Violet Shoulder Mantle / Trim
  ctx.fillStyle = '#7c3aed'
  ctx.fillRect(px - 11, py - 5, 22, 4)

  // Operative Hood
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(px, py - 7, 9, 0, Math.PI * 2)
  ctx.fill()

  // Directional Glowing Visor Eyes (Pivots toward cursor)
  const eyeDistance = 3.5
  const eyeVx = Math.cos(p.angle) * eyeDistance
  const eyeVy = Math.sin(p.angle) * (eyeDistance * 0.6)

  ctx.save()
  ctx.fillStyle = '#ef4444'
  ctx.shadowColor = '#ef4444'
  ctx.shadowBlur = 6

  ctx.fillRect(px - 4 + eyeVx, py - 8 + eyeVy, 2.5, 2)
  ctx.fillRect(px + 1 + eyeVx, py - 8 + eyeVy, 2.5, 2)
  ctx.restore()

  ctx.restore()
}

// Main Canvas Animation Loop
const animate = () => {
  if (!heroCanvasRef.value) return
  const canvas = heroCanvasRef.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width / (window.devicePixelRatio || 1)
  const height = canvas.height / (window.devicePixelRatio || 1)

  ctx.clearRect(0, 0, width, height)
  frameCount++

  // Operative Movement & Smooth Interpolation
  const dx = player.targetX - player.x
  const dy = player.targetY - player.y
  const dist = Math.hypot(dx, dy)

  if (dist > 4) {
    player.x += dx * 0.055
    player.y += dy * 0.055
    player.angle = Math.atan2(dy, dx)
    player.bounce = Math.sin(frameCount * 0.25) * 3
    player.isMoving = true
  } else {
    player.bounce *= 0.8
    player.isMoving = false
  }

  // Check Collisions (AABB) & Update Servers
  const pLeft = player.x - player.width / 2
  const pRight = player.x + player.width / 2
  const pTop = player.y - player.height / 2
  const pBottom = player.y + player.height / 2

  servers.forEach((server) => {
    const sLeft = server.x
    const sRight = server.x + server.width
    const sTop = server.y - server.height
    const sBottom = server.y

    const isColliding =
      pLeft < sRight &&
      pRight > sLeft &&
      pTop < sBottom &&
      pBottom > sTop

    if (isColliding) {
      server.isUnderAttack = true
      server.attackTimer = 60
    }

    if (server.attackTimer > 0) {
      server.jitterX = (Math.random() - 0.5) * 4
      server.jitterY = (Math.random() - 0.5) * 2
      server.attackTimer--
      if (server.attackTimer <= 0) {
        server.isUnderAttack = false
        server.jitterX = 0
        server.jitterY = 0
      }
    } else {
      server.jitterX = 0
      server.jitterY = 0
    }
  })

  // Depth-Sorted Rendering
  const renderables = [
    { type: 'player', y: player.y + 16, data: player },
    ...servers.map((o) => ({ type: 'server', y: o.y, data: o })),
  ]
  renderables.sort((a, b) => a.y - b.y)

  for (const item of renderables) {
    if (item.type === 'server') drawServer(ctx, item.data)
    else if (item.type === 'player') drawPlayer(ctx, item.data)
  }

  drawReticle(ctx)

  animationFrameId = requestAnimationFrame(animate)
}

const handleResize = () => {
  setupCanvas()
}

onMounted(() => {
  setupCanvas()
  animationFrameId = requestAnimationFrame(animate)
  window.addEventListener('resize', handleResize)

  const parent = heroCanvasRef.value?.parentElement
  if (parent) {
    parent.addEventListener('mousemove', handleMouseMove)
    parent.addEventListener('mouseleave', handleMouseLeave)
  }
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', handleResize)

  const parent = heroCanvasRef.value?.parentElement
  if (parent) {
    parent.removeEventListener('mousemove', handleMouseMove)
    parent.removeEventListener('mouseleave', handleMouseLeave)
  }
})
</script>

<template>
  <canvas ref="heroCanvasRef" class="hero-canvas" aria-hidden="true"></canvas>
</template>

<style scoped>
.hero-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
</style>
