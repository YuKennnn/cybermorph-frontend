<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import AppIcon from '../components/common/AppIcon.vue'
import InteractiveHeroPreview from '../components/landing/InteractiveHeroPreview.vue'

import homeMapImg from '../assets/maps/home.png'
import internetCafeMapImg from '../assets/maps/internet-cafe.png'
import officeMapImg from '../assets/maps/office.png'
import publicParkMapImg from '../assets/maps/public-park.png'

const authStore = useAuthStore()
const isMobileNavOpen = ref(false)

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value
}

const closeMobileNav = () => {
  isMobileNavOpen.value = false
}

const scrollToSection = (id) => {
  closeMobileNav()
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isMobileNavOpen.value) {
    closeMobileNav()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const gameplayEnvironments = [
  {
    name: 'Home Network',
    image: homeMapImg,
    description:
      'Practice securing home Wi-Fi routers, managing connected smart devices, and avoiding basic social engineering tricks.',
  },
  {
    name: 'Internet Cafe',
    image: internetCafeMapImg,
    description:
      'Identify untrusted public access points, shared computer risks, and wireless eavesdropping in public spaces.',
  },
  {
    name: 'Corporate Office',
    image: officeMapImg,
    description:
      'Protect workplace computers against deceptive messages, unauthorized physical access, and password theft.',
  },
  {
    name: 'Public Park',
    image: publicParkMapImg,
    description:
      'Recognize shoulder surfing, suspicious public QR codes, and unsafe public charging stations in outdoor open areas.',
  },
]

const learningTopics = [
  {
    number: '01',
    name: 'Phishing',
    summary: 'Recognizing deceptive emails, forged sender addresses, and artificial urgency triggers.',
  },
  {
    number: '02',
    name: 'Smishing',
    summary: 'Identifying fraudulent SMS text messages and deceptive verification links on mobile phones.',
  },
  {
    number: '03',
    name: 'Vishing',
    summary: 'Spotting voice call deception, impersonated tech support agents, and pressure tactics.',
  },
  {
    number: '04',
    name: 'Social Engineering',
    summary: 'Understanding manipulation techniques that trick people into revealing sensitive information.',
  },
  {
    number: '05',
    name: 'Credential Theft',
    summary: 'Defending against weak passwords, fake login forms, and brute-force password guessing.',
  },
  {
    number: '06',
    name: 'Public Wi-Fi Attacks',
    summary: 'Protecting internet traffic against wireless eavesdropping and fake public access points.',
  },
  {
    number: '07',
    name: 'Malware Infection',
    summary: 'Preventing dangerous email attachments, suspicious download links, and harmful programs.',
  },
  {
    number: '08',
    name: 'Ransomware',
    summary: 'Recognizing malicious software that locks files, and learning preventative safety practices.',
  },
]
</script>

<template>
  <div class="landing-page">
    <!-- Public Navigation Bar -->
    <header class="public-nav-bar">
      <div class="nav-container">
        <a href="#hero" class="brand-link" @click.prevent="scrollToSection('hero')">
          <span class="brand-bracket">[</span>
          <span class="brand-name">CYBERMORPH</span>
          <span class="brand-bracket">]</span>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="desktop-nav" aria-label="Main Navigation">
          <button type="button" class="nav-link" @click="scrollToSection('hero')">Home</button>
          <button type="button" class="nav-link" @click="scrollToSection('about')">About</button>
          <button type="button" class="nav-link" @click="scrollToSection('gameplay')">Gameplay</button>
          <button type="button" class="nav-link" @click="scrollToSection('download')">Download</button>
          <button type="button" class="nav-link" @click="scrollToSection('requirements')">System requirements</button>
        </nav>

        <!-- Auth Action Link -->
        <div class="nav-auth">
          <RouterLink
            v-if="authStore.token"
            to="/dashboard"
            class="btn-nav-primary"
          >
            Dashboard
          </RouterLink>
          <RouterLink
            v-else
            to="/login"
            class="btn-nav-secondary"
          >
            Sign in
          </RouterLink>

          <!-- Mobile Hamburger Toggle -->
          <button
            type="button"
            class="mobile-menu-toggle"
            :aria-expanded="isMobileNavOpen"
            aria-label="Toggle navigation menu"
            @click="toggleMobileNav"
          >
            <AppIcon :name="isMobileNavOpen ? 'x' : 'menu'" :size="20" />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div
        v-if="isMobileNavOpen"
        class="mobile-drawer-backdrop"
        @click="closeMobileNav"
      >
        <div class="mobile-drawer" @click.stop>
          <div class="mobile-drawer-header">
            <span class="brand-name">CYBERMORPH</span>
            <button
              type="button"
              class="mobile-close-btn"
              aria-label="Close menu"
              @click="closeMobileNav"
            >
              <AppIcon name="x" :size="20" />
            </button>
          </div>
          <nav class="mobile-nav-links" aria-label="Mobile Navigation">
            <button type="button" class="mobile-nav-link" @click="scrollToSection('hero')">Home</button>
            <button type="button" class="mobile-nav-link" @click="scrollToSection('about')">About</button>
            <button type="button" class="mobile-nav-link" @click="scrollToSection('gameplay')">Gameplay</button>
            <button type="button" class="mobile-nav-link" @click="scrollToSection('download')">Download</button>
            <button type="button" class="mobile-nav-link" @click="scrollToSection('requirements')">System requirements</button>
          </nav>
          <div class="mobile-drawer-footer">
            <RouterLink
              v-if="authStore.token"
              to="/dashboard"
              class="btn-mobile-auth"
              @click="closeMobileNav"
            >
              Go to Dashboard
            </RouterLink>
            <RouterLink
              v-else
              to="/login"
              class="btn-mobile-auth"
              @click="closeMobileNav"
            >
              Sign in to Portal
            </RouterLink>
          </div>
        </div>
      </div>
    </header>

    <!-- 1. Hero Section -->
    <section id="hero" class="hero-section">
      <div class="hero-inner">
        <div class="hero-text-column">
          <span class="badge-subtle">Educational Cybersecurity Game</span>
          <h1 class="hero-headline">
            Learn to recognise cyber threats through play.
          </h1>
          <p class="hero-description">
            Practice cybersecurity decisions in an Android game. Use the web portal to view progress and manage classrooms.
          </p>

          <div class="hero-cta-group">
            <button
              type="button"
              class="btn-cta-primary"
              @click="scrollToSection('download')"
            >
              <AppIcon name="smartphone" :size="18" />
              <span>Download for Android</span>
            </button>
            <button
              type="button"
              class="btn-cta-secondary"
              @click="scrollToSection('gameplay')"
            >
              <span>Explore gameplay</span>
              <AppIcon name="arrow-right" :size="16" />
            </button>
          </div>

          <div class="hero-status-note">
            <span class="status-indicator-dot"></span>
            <span>Free offline-first gameplay for everyone &bull; Optional classroom sync</span>
          </div>
        </div>

        <!-- Bounded Interactive Pixel-Art Simulation Preview -->
        <div class="hero-visual-column">
          <InteractiveHeroPreview />
        </div>
      </div>
    </section>

    <!-- 2. About Section: Play, learn, and track your progress -->
    <section id="about" class="content-section section-bg-alt">
      <div class="section-container">
        <div class="section-header">
          <span class="section-kicker">How It Works</span>
          <h2 class="section-title">Play, learn, and track your progress</h2>
          <p class="section-lead">
            Play independently at your own pace, or connect with a teacher through optional classroom features.
          </p>
        </div>

        <div class="editorial-split">
          <!-- Column 1: For players (Primary audience) -->
          <div class="audience-column">
            <div class="column-header">
              <div class="audience-icon-badge">
                <AppIcon name="smartphone" :size="22" />
              </div>
              <div>
                <h3 class="audience-title">For players</h3>
                <span class="audience-subtitle">Play independently anytime on Android</span>
              </div>
            </div>
            <ul class="audience-feature-list">
              <li>
                <strong>Play offline anywhere:</strong> The game runs entirely on your Android device, allowing you to play through missions without requiring internet connectivity.
              </li>
              <li>
                <strong>Practice real-world defense:</strong> Make interactive security choices to identify phishing messages, spot fake Wi-Fi networks, and protect personal accounts.
              </li>
              <li>
                <strong>Track your progress:</strong> When you connect online, your completed missions sync with your web account to record scores and unlock threat index entries.
              </li>
              <li>
                <strong>No classroom required:</strong> Anyone can download and complete the full game on their own. Joining a classroom is completely optional.
              </li>
            </ul>
          </div>

          <!-- Column 2: Optional classroom features -->
          <div class="audience-column">
            <div class="column-header">
              <div class="audience-icon-badge">
                <AppIcon name="classrooms" :size="22" />
              </div>
              <div>
                <h3 class="audience-title">Optional classroom features</h3>
                <span class="audience-subtitle">Connect with teachers and classmates</span>
              </div>
            </div>
            <ul class="audience-feature-list">
              <li>
                <strong>Join with a class code:</strong> If your teacher uses CyberMorph in class, you can enter their 6-character code to share your progress with them.
              </li>
              <li>
                <strong>Classroom management for teachers:</strong> Instructors can create classrooms in the web portal and give students simple access codes.
              </li>
              <li>
                <strong>Identify common mistakes:</strong> Teachers can review overall completion rates and see which types of threats students find most challenging.
              </li>
              <li>
                <strong>Academic teacher accounts:</strong> Instructors register with an institutional email address (@dnsc.edu.ph) for verified portal access.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Gameplay Environments Section -->
    <section id="gameplay" class="content-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-kicker">Simulation Maps</span>
          <h2 class="section-title">Gameplay environments</h2>
          <p class="section-lead">
            Four realistic simulation environments designed to test security decision-making in everyday personal, academic, and workplace situations.
          </p>
        </div>

        <div class="environments-grid">
          <article
            v-for="env in gameplayEnvironments"
            :key="env.name"
            class="environment-item"
          >
            <div class="env-image-wrap">
              <img
                :src="env.image"
                :alt="`Simulation map environment: ${env.name}`"
                class="env-image"
                loading="lazy"
              />
            </div>
            <div class="env-details">
              <h3 class="env-name">{{ env.name }}</h3>
              <p class="env-desc">{{ env.description }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 4. The Eight Learning Topics Section -->
    <section id="topics" class="content-section section-bg-alt">
      <div class="section-container">
        <div class="section-header">
          <span class="section-kicker">Curriculum Coverage</span>
          <h2 class="section-title">The eight learning topics</h2>
          <p class="section-lead">
            The CyberMorph curriculum covers eight common digital threats to help players build practical cybersecurity awareness.
          </p>
        </div>

        <div class="topics-grid">
          <div
            v-for="topic in learningTopics"
            :key="topic.name"
            class="topic-entry"
          >
            <span class="topic-num">{{ topic.number }}</span>
            <div class="topic-body">
              <h3 class="topic-title">{{ topic.name }}</h3>
              <p class="topic-desc">{{ topic.summary }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Android Availability & System Requirements Section -->
    <section id="download" class="content-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-kicker">Platform Availability</span>
          <h2 class="section-title">Android availability and requirements</h2>
          <p class="section-lead">
            CyberMorph is developed as an Android mobile game, supported by a companion web portal for accounts and optional classrooms.
          </p>
        </div>

        <div class="download-layout">
          <!-- Platform Statements & Download Status Card -->
          <div class="download-info-card">
            <h3 class="card-title">Game Installation</h3>
            <p class="platform-statement">
              CyberMorph is currently available for Android. During the beta, players install the game using an APK.
            </p>
            <p class="platform-statement statement-muted">
              CyberMorph is not currently available for iPhone or iPad.
            </p>
            <p class="platform-statement statement-muted">
              The browser portal is used to view progress and manage classrooms. The game runs locally on your Android device.
            </p>

            <div class="release-status-box">
              <div class="status-row">
                <span class="status-label">Beta release link:</span>
                <span class="status-badge-pending">Awaiting confirmation</span>
              </div>
              <div class="status-row">
                <span class="status-label">Build version:</span>
                <span class="status-text-subtle">Beta release awaiting confirmation</span>
              </div>
              <p class="status-hint">
                The download link will be added once the beta package is finalized. You can register your account now to save your username.
              </p>
            </div>

            <div class="install-steps">
              <h4 class="install-steps-title">How to install during beta:</h4>
              <ol class="steps-list">
                <li>Download the CyberMorph APK package to your Android device once published.</li>
                <li>When prompted by Android, allow installation from unknown sources in settings.</li>
                <li>Tap the downloaded file and select <strong>Install</strong>.</li>
                <li>Open CyberMorph, sign in with your player account, and start playing.</li>
              </ol>
            </div>
          </div>

          <!-- System Requirements Table -->
          <div id="requirements" class="requirements-card">
            <h3 class="card-title">System requirements</h3>
            <p class="requirements-lead">
              Hardware and software requirements for running the Android mobile game:
            </p>

            <table class="req-table">
              <tbody>
                <tr>
                  <th scope="row">Target platform</th>
                  <td>Android</td>
                </tr>
                <tr>
                  <th scope="row">Minimum Android version</th>
                  <td><span class="status-badge-pending">Awaiting confirmation</span></td>
                </tr>
                <tr>
                  <th scope="row">Device architecture</th>
                  <td>ARM64 (standard for modern Android phones and tablets)</td>
                </tr>
                <tr>
                  <th scope="row">Memory (RAM)</th>
                  <td><span class="status-badge-pending">Awaiting confirmation</span></td>
                </tr>
                <tr>
                  <th scope="row">Free storage</th>
                  <td><span class="status-badge-pending">Awaiting confirmation</span></td>
                </tr>
                <tr>
                  <th scope="row">Internet connectivity</th>
                  <td>Required for account login and optional classroom sync; gameplay is fully offline</td>
                </tr>
              </tbody>
            </table>

            <div class="requirements-notice">
              <strong>Companion portal requirements:</strong> The web dashboard operates in any modern browser (Chrome, Firefox, Safari, Edge) without downloads.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Footer -->
    <footer class="public-footer">
      <div class="footer-container">
        <div class="footer-brand-column">
          <span class="footer-brand-name">CYBERMORPH</span>
          <p class="footer-tagline">
            Offline-first educational cybersecurity game with optional classroom tools.
          </p>
        </div>

        <nav class="footer-nav" aria-label="Footer links">
          <button type="button" class="footer-link" @click="scrollToSection('hero')">Home</button>
          <button type="button" class="footer-link" @click="scrollToSection('about')">About</button>
          <button type="button" class="footer-link" @click="scrollToSection('gameplay')">Gameplay</button>
          <button type="button" class="footer-link" @click="scrollToSection('download')">Download</button>
          <button type="button" class="footer-link" @click="scrollToSection('requirements')">System requirements</button>
          <RouterLink to="/login" class="footer-link">Sign in</RouterLink>
          <RouterLink to="/register" class="footer-link">Register</RouterLink>
        </nav>
      </div>

      <div class="footer-bottom-bar">
        <p>&copy; 2026 CyberMorph. Developed for educational cybersecurity training.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text-main);
  font-family: var(--font-sans);
}

/* =========================================================
   1. Public Navigation Bar
   ========================================================= */
.public-nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.nav-container {
  max-width: 1140px;
  margin: 0 auto;
  padding: 0.85rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  text-decoration: none;
  font-family: var(--font-brand);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.05em;
}

.brand-bracket {
  color: var(--color-primary);
  opacity: 0.6;
}

.brand-name {
  color: var(--color-primary);
}

.desktop-nav {
  display: flex;
  align-items: center;
  gap: 1.75rem;
}

.nav-link {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 0.925rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem 0;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--color-primary);
}

.nav-auth {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-nav-primary,
.btn-nav-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-nav-secondary {
  color: var(--color-primary);
  background-color: transparent;
  border: 1px solid var(--color-border);
}

.btn-nav-secondary:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
}

.btn-nav-primary {
  background-color: var(--color-primary);
  color: #ffffff;
  border: 1px solid var(--color-primary);
}

.btn-nav-primary:hover {
  background-color: #5b21b6;
}

.mobile-menu-toggle {
  display: none;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.45rem;
  color: var(--color-text-main);
  cursor: pointer;
}

/* Mobile Drawer */
.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.4);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.mobile-drawer {
  width: 280px;
  max-width: 85%;
  height: 100%;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
}

.mobile-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.mobile-close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.mobile-nav-link {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--color-text-main);
  text-align: left;
  cursor: pointer;
  padding: 0.25rem 0;
}

.mobile-drawer-footer {
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn-mobile-auth {
  display: block;
  text-align: center;
  padding: 0.65rem 1rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
}

/* =========================================================
   2. Hero Section
   ========================================================= */
.hero-section {
  padding: 4rem 1.5rem 4.5rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, #ffffff 0%, var(--color-bg) 100%);
}

.hero-inner {
  max-width: 1140px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 3.5rem;
  align-items: center;
}

.badge-subtle {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  background-color: #ede9fe;
  color: var(--color-primary);
  font-size: 0.825rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
}

.hero-headline {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.18;
  color: var(--color-text-main);
  margin: 0 0 1.25rem 0;
  letter-spacing: -0.025em;
}

.hero-description {
  font-size: 1.15rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0 0 2rem 0;
  max-width: 580px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.btn-cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.6rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.btn-cta-primary:hover {
  background-color: #5b21b6;
  transform: translateY(-1px);
}

.btn-cta-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.4rem;
  background-color: #ffffff;
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cta-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: #ede9fe;
}

.hero-status-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.status-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
}

/* =========================================================
   3. Content Sections Standard Layout
   ========================================================= */
.content-section {
  padding: 5rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.section-bg-alt {
  background-color: var(--color-bg-subtle);
}

.section-container {
  max-width: 1140px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 3rem;
  max-width: 680px;
}

.section-kicker {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text-main);
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.015em;
}

.section-lead {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
}

/* =========================================================
   4. About Section: Editorial Split
   ========================================================= */
.editorial-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
}

.audience-column {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.column-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.audience-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: #ede9fe;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.audience-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 0.2rem 0;
  color: var(--color-text-main);
}

.audience-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.audience-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.audience-feature-list li {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  position: relative;
  padding-left: 1.5rem;
}

.audience-feature-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55rem;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.audience-feature-list strong {
  color: var(--color-text-main);
}

/* =========================================================
   5. Gameplay Maps Grid
   ========================================================= */
.environments-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.environment-item {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.environment-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple);
}

.env-image-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: #0f172a;
  overflow: hidden;
}

.env-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.env-details {
  padding: 1.5rem;
}

.env-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
}

.env-desc {
  font-size: 0.925rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  margin: 0;
}

/* =========================================================
   6. Eight Learning Topics Section
   ========================================================= */
.topics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.topic-entry {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
}

.topic-num {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: #ede9fe;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.topic-body {
  flex: 1;
}

.topic-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
}

.topic-desc {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}

/* =========================================================
   7. Android Availability & Requirements
   ========================================================= */
.download-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: start;
}

.download-info-card,
.requirements-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: var(--color-text-main);
}

.platform-statement {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.55;
  color: var(--color-text-main);
  margin: 0 0 0.75rem 0;
}

.statement-muted {
  color: var(--color-text-muted);
  font-weight: 400;
}

.release-status-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.25rem;
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
}

.status-label {
  font-weight: 600;
  color: var(--color-text-main);
}

.status-badge-pending {
  font-size: 0.775rem;
  font-weight: 600;
  color: #854d0e;
  background-color: #fef9c3;
  border: 1px solid #fde047;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  white-space: nowrap;
}

.status-text-subtle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.status-hint {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0.4rem 0 0 0;
}

.install-steps-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
  color: var(--color-text-main);
}

.steps-list {
  padding-left: 1.25rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.steps-list strong {
  color: var(--color-text-main);
}

.requirements-lead {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0 0 1.5rem 0;
}

.req-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.req-table th,
.req-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  vertical-align: middle;
}

.req-table th {
  text-align: left;
  font-weight: 600;
  color: var(--color-text-main);
  width: 45%;
}

.req-table td {
  color: var(--color-text-muted);
}

.requirements-notice {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  padding: 0.85rem 1rem;
  border-radius: 6px;
  border-left: 3px solid var(--color-primary);
}

/* =========================================================
   8. Public Footer
   ========================================================= */
.public-footer {
  background-color: #ffffff;
  border-top: 1px solid var(--color-border);
  padding: 3.5rem 1.5rem 2rem 1.5rem;
}

.footer-container {
  max-width: 1140px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 2.5rem;
  margin-bottom: 2.5rem;
}

.footer-brand-name {
  font-family: var(--font-brand);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 0.5rem;
}

.footer-tagline {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  max-width: 340px;
  margin: 0;
  line-height: 1.5;
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.footer-link {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
}

.footer-link:hover {
  color: var(--color-primary);
}

.footer-bottom-bar {
  max-width: 1140px;
  margin: 0 auto;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* =========================================================
   9. Responsive Breakpoints
   ========================================================= */
@media (max-width: 960px) {
  .hero-inner {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .editorial-split,
  .download-layout {
    grid-template-columns: 1fr;
  }

  .hero-headline {
    font-size: 2.25rem;
  }
}

@media (max-width: 768px) {
  .desktop-nav {
    display: none;
  }

  .mobile-menu-toggle {
    display: inline-flex;
  }

  .environments-grid,
  .topics-grid {
    grid-template-columns: 1fr;
  }

  .hero-section {
    padding: 3rem 1.25rem;
  }

  .content-section {
    padding: 3.5rem 1.25rem;
  }

  .hero-headline {
    font-size: 2rem;
  }

  .footer-container {
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
