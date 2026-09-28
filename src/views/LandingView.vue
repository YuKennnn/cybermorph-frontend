<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'

import homeMapImg from '../assets/maps/home.png'
import internetCafeMapImg from '../assets/maps/internet-cafe.png'
import officeMapImg from '../assets/maps/office.png'
import publicParkMapImg from '../assets/maps/public-park.png'

const authStore = useAuthStore()

// ==========================================
// 1. Smooth Scroll Navigation
// ==========================================
const scrollToSection = (id) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

// ==========================================
// 2. Interactive Hero Canvas Mini-Game
// ==========================================
const heroSectionRef = ref(null)
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
  if (!heroSectionRef.value) return
  const rect = heroSectionRef.value.getBoundingClientRect()
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
  if (!heroCanvasRef.value || !heroSectionRef.value) return
  const canvas = heroCanvasRef.value
  const parent = heroSectionRef.value
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
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', handleResize)
})

// ==========================================
// 3. Core Pillars Curriculum Data
// ==========================================
const pillars = [
  {
    tag: 'PILLAR 01',
    title: 'Play',
    description: 'Engage in 2D simulation missions navigating real-world scenarios and hands-on defense puzzles.',
  },
  {
    tag: 'PILLAR 02',
    title: 'Learn',
    description: 'Master 8 critical cyber threats including social engineering, credential harvesting, and ransomware.',
  },
  {
    tag: 'PILLAR 03',
    title: 'Track',
    description: 'Monitor progress, earn high scores on the global leaderboard, and sync classroom telemetry.',
  },
]

// ==========================================
// 4. Simulation Map Showcase Gallery Data
// ==========================================
const showcaseMaps = reactive([
  {
    sector: 'SECTOR 01',
    eyebrow: 'FIRST MAP // SECTOR 01',
    name: 'Home Network',
    focus: ['IoT Defense', 'Password Hygiene', 'Router Baseline'],
    description: 'Master personal network baseline defense, securing connected smart devices and hardening Wi-Fi router configurations against intrusion.',
    image: homeMapImg,
    unlocked: true,
    imgError: false,
  },
  {
    sector: 'SECTOR 02',
    eyebrow: 'SECOND MAP // SECTOR 02',
    name: 'Internet Cafe',
    focus: ['Public Wi-Fi', 'Rogue APs', 'Packet Sniffing'],
    description: 'Navigate untrusted public infrastructure, detecting rogue access points, encrypted tunnel eavesdropping, and shared terminal vulnerabilities.',
    image: internetCafeMapImg,
    unlocked: true,
    imgError: false,
  },
  {
    sector: 'SECTOR 03',
    eyebrow: 'THIRD MAP // SECTOR 03',
    name: 'Corporate Office',
    focus: ['Workstation Security', 'Spear-Phishing', 'Data Privacy'],
    description: 'Defend corporate infrastructure against social engineering, spear-phishing campaigns, and unauthorized physical tailgating.',
    image: officeMapImg,
    unlocked: true,
    imgError: false,
  },
  {
    sector: 'SECTOR 04',
    eyebrow: 'FOURTH MAP // SECTOR 04',
    name: 'Public Park',
    difficulty: 'Master',
    focus: ['Social Engineering', 'Juice Jacking', 'Shoulder Surfing'],
    description: 'Identify cognitive manipulation, shoulder surfing, and malicious public charging kiosks (juice jacking) in public environments.',
    image: publicParkMapImg,
    unlocked: false,
    imgError: false,
  },
])

// ==========================================
// 5. Threat Curriculum Data
// ==========================================
const threats = [
  {
    code: 'THREAT 01',
    name: 'Phishing',
    description: 'Deceptive emails and messages designed to steal credentials and data.',
  },
  {
    code: 'THREAT 02',
    name: 'Smishing',
    description: 'SMS-based phishing attacks targeting mobile devices and OTP tokens.',
  },
  {
    code: 'THREAT 03',
    name: 'Vishing',
    description: 'Voice phishing — attackers impersonate trusted entities to extract secrets.',
  },
  {
    code: 'THREAT 04',
    name: 'Social Engineering',
    description: 'Psychological manipulation to exploit human cognitive vulnerabilities.',
  },
  {
    code: 'THREAT 05',
    name: 'Credential Theft',
    description: 'Weak password attacks, credential harvesting, and brute force techniques.',
  },
  {
    code: 'THREAT 06',
    name: 'Public Wi-Fi Attack',
    description: 'Man-in-the-middle packet sniffing and rogue access point spoofing.',
  },
  {
    code: 'THREAT 07',
    name: 'Malware Infection',
    description: 'Malicious payloads and trojans that compromise system integrity.',
  },
  {
    code: 'THREAT 08',
    name: 'Ransomware',
    description: 'Extortion malware that encrypts files and demands ransom payments.',
  },
]
</script>

<template>
  <div class="landing-container">
    <!-- Public Navigation Bar -->
    <header class="landing-header">
      <div class="header-inner">
        <div class="brand-logo">
          <span class="logo-bracket">[</span>
          <span class="logo-text">CYBERMORPH</span>
          <span class="logo-bracket">]</span>
        </div>

        <nav class="nav-links">
          <button class="nav-anchor" @click="scrollToSection('features')">Features</button>
          <button class="nav-anchor" @click="scrollToSection('showcase')">Sectors</button>
          <button class="nav-anchor" @click="scrollToSection('threats')">Threats</button>
        </nav>

        <div class="header-auth-actions">
          <template v-if="authStore.token">
            <router-link to="/dashboard" class="btn-signup">Dashboard</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="btn-signin">Login</router-link>
            <router-link to="/register" class="btn-signup">Register</router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- Hero Section with Canvas Mini-Game -->
    <section
      ref="heroSectionRef"
      class="hero-section"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <!-- Interactive Background Canvas -->
      <canvas ref="heroCanvasRef" class="hero-canvas"></canvas>

      <!-- Foreground Content -->
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          <span>CYBERSECURITY GAMIFIED LEARNING PORTAL</span>
        </div>

        <h1 class="hero-title">
          Master cybersecurity through <span class="highlight-text">immersive 2D simulation.</span>
        </h1>

        <p class="hero-subtitle">
          Learn to defend against real-world cyber threats through interactive gameplay, clear
          progress tracking, and instructor-ready insights.
        </p>

        <div class="hero-actions">
          <router-link :to="authStore.token ? '/dashboard' : '/register'" class="btn-hero-primary">
            {{ authStore.token ? 'Enter Dashboard' : 'Get Started' }}
          </router-link>
          <button class="btn-hero-secondary" @click="scrollToSection('showcase')">
            View Showcase
          </button>
          <button class="btn-hero-outline" @click="scrollToSection('features')">
            How It Works
          </button>
        </div>
      </div>
    </section>

    <!-- Features / Core Pillars Section -->
    <section id="features" class="features-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">CORE PILLARS</span>
          <h2 class="section-title">How CyberMorph Works</h2>
          <p class="section-subtitle">
            An offline-first educational platform bridging interactive Godot gaming with
            web-based classroom analytics.
          </p>
        </div>

        <div class="features-grid">
          <div v-for="pillar in pillars" :key="pillar.title" class="feature-card">
            <div class="pillar-tag">{{ pillar.tag }}</div>
            <h3>{{ pillar.title }}</h3>
            <p>{{ pillar.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Simulation Map Gallery Showcase Section -->
    <section id="showcase" class="showcase-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">CURRICULUM SHOWCASE</span>
          <h2 class="section-title">Simulation Map Environments</h2>
          <p class="section-subtitle">
            Explore the 4 tactical sectors in CyberMorph. Each sector trains agents against real-world attack vectors with escalating difficulty levels.
          </p>
        </div>

        <div class="showcase-grid">
          <div
            v-for="map in showcaseMaps"
            :key="map.name"
            :class="['showcase-card', { locked: !map.unlocked }]"
          >
            <!-- Retro 4:3 Aspect Ratio Preview Container -->
            <div class="aspect-retro">
              <!-- Map Image from Asset Bundle -->
              <img
                v-if="!map.imgError"
                :src="map.image"
                :alt="map.name"
                class="preview-img"
                @error="map.imgError = true"
              />

              <!-- Stylized Fallback Graphic if Image Fails -->
              <div v-else class="map-vector-preview">
                <svg viewBox="0 0 240 180" class="preview-svg" aria-hidden="true">
                  <rect width="240" height="180" fill="#1e1b4b" opacity="0.9" />
                  <circle cx="120" cy="90" r="48" fill="#7c3aed" opacity="0.15" />
                  <rect x="75" y="70" width="90" height="40" rx="6" fill="#0f172a" stroke="#8b5cf6" stroke-width="2" />
                  <circle cx="95" cy="90" r="3" fill="#10b981" />
                  <circle cx="110" cy="90" r="3" fill="#10b981" />
                  <circle cx="125" cy="90" r="3" fill="#06b6d4" />
                  <circle cx="140" cy="90" r="3" fill="#8b5cf6" />
                </svg>
              </div>

              <!-- Vector Scanline / Grid Overlay -->
              <div class="vector-grid-overlay"></div>

              <!-- Top Sector & Status Badges -->
              <div class="retro-header">
                <span class="sector-code-tag">{{ map.sector }}</span>
                <span :class="['status-tag', map.unlocked ? 'unlocked' : 'locked']">
                  {{ map.unlocked ? 'UNLOCKED' : 'LOCKED' }}
                </span>
              </div>
            </div>

            <!-- Card Information Content -->
            <div class="showcase-content">
              <span class="card-eyebrow">{{ map.eyebrow }}</span>
              <h3 class="showcase-title">{{ map.name }}</h3>

              <!-- Focus Pills Row -->
              <div class="focus-pills-row">
                <span v-for="tag in map.focus" :key="tag" class="focus-pill">
                  {{ tag }}
                </span>
              </div>

              <p class="showcase-desc">{{ map.description }}</p>

            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8 Threats Curriculum Section -->
    <section id="threats" class="threats-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">CURRICULUM MODULES</span>
          <h2 class="section-title">Master 8 Critical Cyber Threats</h2>
          <p class="section-subtitle">
            Comprehensive defense training against today's most pervasive vector attacks.
          </p>
        </div>

        <div class="threats-grid">
          <div v-for="threat in threats" :key="threat.name" class="threat-card">
            <div class="threat-tag">{{ threat.code }}</div>
            <h4>{{ threat.name }}</h4>
            <p>{{ threat.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="footer-container">
        <div class="footer-brand">
          <div class="brand-logo">
            <span class="logo-bracket">[</span>
            <span class="logo-text">CYBERMORPH</span>
            <span class="logo-bracket">]</span>
          </div>
          <p class="footer-desc">
            Empowering students and educators with offline-first interactive cybersecurity training.
          </p>
        </div>

        <div class="footer-links">
          <span class="link-item">About</span>
          <span class="link-item">Contact</span>
          <span class="link-item">Privacy Policy</span>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 CyberMorph. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-container {
  width: 100%;
  overflow-x: hidden;
  background-color: var(--color-bg);
}

/* Header */
.landing-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-purple-sm);
}

.header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-logo {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.logo-bracket {
  color: var(--color-secondary);
}

.logo-text {
  color: var(--color-primary);
  margin: 0 0.15rem;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-anchor {
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s ease;
}

.nav-anchor:hover {
  color: var(--color-primary);
}

.header-auth-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-signin {
  padding: 0.5rem 1.1rem;
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-signin:hover {
  background-color: var(--color-bg-muted);
  border-color: var(--color-primary);
}

.btn-signup {
  padding: 0.55rem 1.25rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border-radius: 8px;
  text-decoration: none;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  transition: all 0.2s ease;
}

.btn-signup:hover {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 18px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

/* ==========================================================================
   Hero Section with Canvas Mini-Game
   ========================================================================== */
.hero-section {
  position: relative;
  overflow: hidden;
  padding: 5.5rem 1.5rem 4.5rem 1.5rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 10%, rgba(139, 92, 246, 0.12) 0%, transparent 70%);
  min-height: 540px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 820px;
  margin: 0 auto;
  pointer-events: auto;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  margin-bottom: 1.5rem;
  letter-spacing: 0.06em;
}

.hero-title {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-text-main);
  margin-bottom: 1.25rem;
  letter-spacing: -0.01em;
}

.highlight-text {
  color: var(--color-primary);
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.15rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 auto 2.25rem auto;
  max-width: 680px;
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.btn-hero-primary {
  padding: 0.85rem 1.85rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border-radius: 8px;
  text-decoration: none;
  font-family: var(--font-display);
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
}

.btn-hero-primary:hover {
  background: var(--btn-gradient-hover);
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.5);
  transform: translateY(-2px);
}

.btn-hero-secondary {
  padding: 0.85rem 1.65rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-purple-sm);
  transition: all 0.2s ease;
}

.btn-hero-secondary:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.btn-hero-outline {
  padding: 0.85rem 1.45rem;
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1.5px solid var(--color-border-subtle);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-hero-outline:hover {
  color: var(--color-primary);
  border-color: var(--color-border);
  background-color: var(--color-bg-subtle);
}

/* ==========================================================================
   Common Section Layout
   ========================================================================== */
.section-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 4.5rem 1.5rem;
}

.section-header {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 3rem auto;
}

.section-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 2.1rem;
  margin: 0 0 0.75rem 0;
  color: var(--color-text-main);
}

.section-subtitle {
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
}

/* ==========================================================================
   Features Section (Core Pillars)
   ========================================================================== */
.features-section {
  background-color: #ffffff;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.75rem;
}

.feature-card {
  padding: 2.25rem 1.75rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-purple);
  border-color: var(--color-secondary);
}

.pillar-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  letter-spacing: 0.05em;
  margin-bottom: 1.25rem;
}

.feature-card h3 {
  font-size: 1.35rem;
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
}

.feature-card p {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0;
}

/* ==========================================================================
   Simulation Map Gallery Showcase (#showcase)
   ========================================================================== */
.showcase-section {
  background-color: var(--color-bg);
  border-top: 1px solid var(--color-border);
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1024px) {
  .showcase-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .showcase-grid {
    grid-template-columns: 1fr;
  }
}

.showcase-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.showcase-card:hover {
  box-shadow: var(--shadow-purple-hover);
  transform: translateY(-3px);
  border-color: var(--color-secondary);
}

.showcase-card.locked {
  opacity: 0.9;
}

/* Retro 4:3 Aspect Ratio Container */
.aspect-retro {
  aspect-ratio: 4 / 3;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: #0f172a;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.showcase-card:hover .preview-img {
  transform: scale(1.04);
}

.map-vector-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.preview-svg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vector-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
}

.retro-header {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
}

.sector-code-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: #ffffff;
  background-color: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.status-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.status-tag.unlocked {
  background-color: rgba(5, 150, 105, 0.9);
  color: #ffffff;
}

.status-tag.locked {
  background-color: rgba(100, 116, 139, 0.85);
  color: #f1f5f9;
}

.showcase-content {
  padding: 1.25rem 1.25rem 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.showcase-title {
  margin: 0 0 0.65rem 0;
  font-size: 1.15rem;
  color: var(--color-text-main);
}

.focus-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.focus-pill {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.showcase-desc {
  color: var(--color-text-muted);
  font-size: 0.86rem;
  line-height: 1.45;
  margin: 0 0 1rem 0;
  flex: 1;
}

.card-footer {
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 0.75rem;
}

.difficulty-tag {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-secondary);
}

/* ==========================================================================
   Threats Section (8 Modules)
   ========================================================================== */
.threats-section {
  background-color: #ffffff;
  border-top: 1px solid var(--color-border);
}

.threats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .threats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .threats-grid {
    grid-template-columns: 1fr;
  }
}

.threat-card {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.threat-card:hover {
  background-color: var(--color-card-hover);
  border-color: var(--color-secondary);
  box-shadow: var(--shadow-purple-sm);
  transform: translateY(-2px);
}

.threat-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  display: inline-block;
  margin-bottom: 0.75rem;
}

.threat-card h4 {
  margin: 0 0 0.35rem 0;
  font-size: 1.1rem;
  color: var(--color-text-main);
}

.threat-card p {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.45;
  margin: 0;
}

/* ==========================================================================
   Footer
   ========================================================================== */
.landing-footer {
  background-color: #1e1b4b;
  color: #e2e8f0;
  padding: 3.5rem 1.5rem 2rem 1.5rem;
}

.footer-container {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-brand .brand-logo .logo-bracket {
  color: #a78bfa;
}

.footer-brand .brand-logo .logo-text {
  color: #ffffff;
}

.footer-desc {
  margin: 0.5rem 0 0 0;
  color: var(--color-text-dim);
  font-size: 0.9rem;
  max-width: 380px;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.link-item {
  color: var(--color-border);
  font-size: 0.9rem;
  cursor: pointer;
  transition: color 0.2s;
}

.link-item:hover {
  color: #ffffff;
}

.footer-bottom {
  max-width: 1120px;
  margin: 1.5rem auto 0 auto;
  text-align: center;
  color: var(--color-text-dim);
  font-size: 0.85rem;
}

/* Responsive tweaks */
@media (max-width: 768px) {
  .nav-links {
    display: none;
  }

  .hero-title {
    font-size: 2.2rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }
}
</style>
