<script setup>
import { useAuthStore } from '../stores/authStore'

import homeMapImg from '../assets/maps/home.png'
import internetCafeMapImg from '../assets/maps/internet-cafe.png'
import officeMapImg from '../assets/maps/office.png'
import publicParkMapImg from '../assets/maps/public-park.png'
import HeroSimulationCanvas from '../components/landing/HeroSimulationCanvas.vue'
import MapShowcaseCard from '../components/landing/MapShowcaseCard.vue'
import ThreatCurriculumCard from '../components/landing/ThreatCurriculumCard.vue'

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
// 2. Core Pillars Curriculum Data
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
const showcaseMaps = [
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
]

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
          <span class="logo-text">CYBERMORPH</span>
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
    <section class="hero-section">
      <!-- Interactive Background Canvas -->
      <HeroSimulationCanvas />

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
          <MapShowcaseCard
            v-for="map in showcaseMaps"
            :key="map.name"
            :map="map"
          />
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
          <ThreatCurriculumCard
            v-for="threat in threats"
            :key="threat.name"
            :threat="threat"
          />
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
