<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import InteractiveHeroPreview from '../components/landing/InteractiveHeroPreview.vue'
import AppIcon from '../components/common/AppIcon.vue'
import InlineSpeechPlayer from '../components/common/InlineSpeechPlayer.vue'
import { getStoredReadAloud } from '../utils/accessibility.js'
import { startNarration, stopNarration, getSpeechState } from '../utils/speech.js'

import homeImg from '../assets/maps/home.png'
import officeImg from '../assets/maps/office.png'
import internetCafeImg from '../assets/maps/internet-cafe.png'
import publicParkImg from '../assets/maps/public-park.png'

const isReadAloudEnabled = computed(() => getStoredReadAloud() === 'on')

const btnRefHero = ref(null)
const btnRefAudience = ref(null)
const btnRefMaps = ref(null)
const btnRefDownload = ref(null)

const LANDING_SECTIONS = {
  hero: {
    title: 'Overview',
    text: 'Learn to recognise cyber threats through play. Practice cybersecurity decisions in an Android game. Use the web portal to view progress and manage classrooms.',
  },
  audience: {
    title: 'How It Works',
    text: 'Play, learn, and track your progress. Play independently at your own pace, or connect with a teacher through optional classroom features. For players: Play offline. The game runs locally on your Android device without requiring continuous internet access. Practice real defense: Identify phishing scams, spot rogue Wi-Fi networks, and protect accounts in interactive missions. Personal progress: Sync completed missions to this web portal to view scores and threat summaries. No classroom required: Anyone can download and finish the full game independently. Optional classroom features: Connect with teachers and classmates. Join with a class code: Enter your teacher\'s 6-character code to share your mission progress with them. Classroom management: Instructors can create classrooms and monitor student completion rates. Identify common mistakes: Teachers review which threat types students find most difficult to tailor their instruction. Institutional accounts: Educators register with verified institutional email addresses.',
  },
  maps: {
    title: 'Simulation Maps',
    text: 'Four realistic gameplay environments. Explore familiar locations to practice identifying and responding to digital threats. Home: Personal Wi-Fi and email phishing. Office: Workplace security and visitor protocol. Internet Cafe: Shared PC credential safety. Public Park: Open hotspots and rogue portals.',
  },
  download: {
    title: 'Get Started',
    text: 'Get started with CyberMorph. CyberMorph is currently available for Android devices as an APK package. The companion web portal lets you view synced scores and join optional classrooms.',
  },
}

const handleReadSection = (ownerId, title, text, triggerEl) => {
  startNarration({
    ownerId,
    title,
    text,
    triggerEl,
    triggerMode: 'explicit',
  })
}

onUnmounted(() => {
  const currentOwner = getSpeechState().activeOwnerId
  if (currentOwner && currentOwner.startsWith('landing-')) {
    stopNarration(currentOwner)
  }
})

const mapPreviews = [
  { name: 'Home', image: homeImg, desc: 'Personal Wi-Fi and email phishing' },
  { name: 'Office', image: officeImg, desc: 'Workplace security & visitor protocol' },
  { name: 'Internet Cafe', image: internetCafeImg, desc: 'Shared PC credential safety' },
  { name: 'Public Park', image: publicParkImg, desc: 'Open hotspots & rogue portals' },
]
</script>

<template>
  <div class="landing-page">
    <PublicHeader />

    <main class="landing-main">
      <!-- 1. Hero Section -->
      <section class="hero-section">
        <div class="hero-inner">
          <div class="hero-text-column">
            <div class="header-with-action">
              <span class="badge-subtle">Educational Cybersecurity Game</span>
              <button
                v-if="isReadAloudEnabled"
                ref="btnRefHero"
                type="button"
                class="btn-read-section"
                :aria-label="`Read section: ${LANDING_SECTIONS.hero.title}`"
                @click="handleReadSection('landing-hero', LANDING_SECTIONS.hero.title, LANDING_SECTIONS.hero.text, btnRefHero)"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Read section</span>
              </button>
            </div>
            <h1 class="hero-headline">
              Learn to recognise cyber threats through play.
            </h1>
            <p class="hero-description">
              Practice cybersecurity decisions in an Android game. Use the web portal to view progress and manage classrooms.
            </p>

            <InlineSpeechPlayer
              owner-id="landing-hero"
              :title="LANDING_SECTIONS.hero.title"
              :trigger-ref="btnRefHero"
            />

            <div class="hero-cta-group">
              <RouterLink to="/download" class="btn-cta-primary">
                <AppIcon name="smartphone" :size="18" />
                <span>Download for Android</span>
              </RouterLink>
              <RouterLink to="/gameplay" class="btn-cta-secondary">
                <span>Explore gameplay</span>
                <AppIcon name="arrow-right" :size="16" />
              </RouterLink>
            </div>
          </div>

          <!-- Bounded Interactive Pixel-Art Simulation Preview -->
          <div class="hero-visual-column">
            <InteractiveHeroPreview />
          </div>
        </div>
      </section>

      <!-- 2. Concise Audience Overview: Play, learn, and track your progress -->
      <section class="content-section section-bg-alt">
        <div class="section-container">
          <div class="section-header">
            <div class="header-with-action">
              <div>
                <span class="section-kicker">How It Works</span>
                <h2 class="section-title">Play, learn, and track your progress</h2>
              </div>
              <button
                v-if="isReadAloudEnabled"
                ref="btnRefAudience"
                type="button"
                class="btn-read-section"
                :aria-label="`Read section: ${LANDING_SECTIONS.audience.title}`"
                @click="handleReadSection('landing-audience', LANDING_SECTIONS.audience.title, LANDING_SECTIONS.audience.text, btnRefAudience)"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Read section</span>
              </button>
            </div>
            <p class="section-lead">
              Play independently at your own pace, or connect with a teacher through optional classroom features.
            </p>
            <InlineSpeechPlayer
              owner-id="landing-audience"
              :title="LANDING_SECTIONS.audience.title"
              :trigger-ref="btnRefAudience"
            />
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
                  <strong>Play offline:</strong> The game runs locally on your Android device without requiring continuous internet access.
                </li>
                <li>
                  <strong>Practice real defense:</strong> Identify phishing scams, spot rogue Wi-Fi networks, and protect accounts in interactive missions.
                </li>
                <li>
                  <strong>Personal progress:</strong> Sync completed missions to this web portal to view scores and threat summaries.
                </li>
                <li>
                  <strong>No classroom required:</strong> Anyone can download and finish the full game independently. Joining a class is purely optional.
                </li>
              </ul>
              <div class="column-action">
                <RouterLink to="/about" class="section-link">
                  <span>Learn more about CyberMorph</span>
                  <AppIcon name="arrow-right" :size="14" />
                </RouterLink>
              </div>
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
                  <strong>Join with a class code:</strong> Enter your teacher's 6-character code to share your mission progress with them.
                </li>
                <li>
                  <strong>Classroom management:</strong> Instructors can create classrooms and monitor student completion rates.
                </li>
                <li>
                  <strong>Identify common mistakes:</strong> Teachers review which threat types students find most difficult to tailor their instruction.
                </li>
                <li>
                  <strong>Institutional accounts:</strong> Educators register with verified institutional email addresses (@dnsc.edu.ph).
                </li>
              </ul>
              <div class="column-action">
                <RouterLink to="/about#classrooms" class="section-link">
                  <span>Explore classroom features</span>
                  <AppIcon name="arrow-right" :size="14" />
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Concise Simulation Map Preview -->
      <section class="content-section">
        <div class="section-container">
          <div class="section-header-row">
            <div>
              <span class="section-kicker">Simulation Maps</span>
              <h2 class="section-title">Four realistic gameplay environments</h2>
              <p class="section-lead">
                Explore familiar locations to practice identifying and responding to digital threats.
              </p>
            </div>
            <div class="header-actions-group">
              <button
                v-if="isReadAloudEnabled"
                ref="btnRefMaps"
                type="button"
                class="btn-read-section"
                :aria-label="`Read section: ${LANDING_SECTIONS.maps.title}`"
                @click="handleReadSection('landing-maps', LANDING_SECTIONS.maps.title, LANDING_SECTIONS.maps.text, btnRefMaps)"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Read section</span>
              </button>
              <RouterLink to="/gameplay" class="btn-section-header">
                <span>View full gameplay guide</span>
                <AppIcon name="arrow-right" :size="16" />
              </RouterLink>
            </div>
          </div>

          <InlineSpeechPlayer
            owner-id="landing-maps"
            :title="LANDING_SECTIONS.maps.title"
            :trigger-ref="btnRefMaps"
          />

          <div class="preview-map-grid">
            <div
              v-for="map in mapPreviews"
              :key="map.name"
              class="preview-map-card"
            >
              <div class="preview-img-wrap">
                <img
                  :src="map.image"
                  :alt="`Map preview of ${map.name}`"
                  class="preview-img"
                  loading="lazy"
                />
              </div>
              <div class="preview-info">
                <h3 class="preview-map-name">{{ map.name }}</h3>
                <p class="preview-map-desc">{{ map.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Download Preview Banner -->
      <section class="content-section section-bg-alt">
        <div class="section-container">
          <div class="home-download-card">
            <div class="home-download-text">
              <div class="header-with-action">
                <span class="badge-subtle">Android Beta</span>
                <button
                  v-if="isReadAloudEnabled"
                  ref="btnRefDownload"
                  type="button"
                  class="btn-read-section"
                  :aria-label="`Read section: ${LANDING_SECTIONS.download.title}`"
                  @click="handleReadSection('landing-download', LANDING_SECTIONS.download.title, LANDING_SECTIONS.download.text, btnRefDownload)"
                >
                  <AppIcon name="volume-2" :size="16" />
                  <span>Read section</span>
                </button>
              </div>
              <h2 class="download-banner-title">Get started with CyberMorph</h2>
              <p class="download-banner-lead">
                CyberMorph is currently available for Android devices as an APK package. The companion web portal lets you view synced scores and join optional classrooms.
              </p>

              <InlineSpeechPlayer
                owner-id="landing-download"
                :title="LANDING_SECTIONS.download.title"
                :trigger-ref="btnRefDownload"
              />
            </div>
            <div class="home-download-actions">
              <RouterLink to="/download" class="btn-cta-primary">
                <AppIcon name="download" :size="18" />
                <span>Go to Download Page</span>
              </RouterLink>
              <RouterLink to="/download#requirements" class="btn-cta-secondary">
                <span>System requirements</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.landing-main {
  flex: 1;
}

/* 1. Hero Section */
.hero-section {
  padding: 3.5rem 0 4rem;
  background: linear-gradient(180deg, var(--color-violet-subtle) 0%, transparent 100%);
}

@media (max-width: 640px) {
  .hero-section {
    padding: 2rem 0 2.5rem;
  }
}

.hero-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1.5rem;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: center;
}

@media (max-width: 640px) {
  .hero-inner {
    padding: 0 1rem;
  }
}

@media (min-width: 1024px) {
  .hero-inner {
    grid-template-columns: 1.1fr 0.9fr;
    gap: 2.5rem;
  }
}

@media (min-width: 1600px) {
  .hero-inner {
    max-width: 1320px;
    gap: 3.5rem;
  }
}

@media (min-width: 2000px) {
  .hero-inner {
    max-width: 1440px;
    gap: 4rem;
  }
}

.hero-text-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.badge-subtle {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-purple);
  background-color: var(--color-purple-light);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  margin-bottom: 1.25rem;
}

.hero-headline {
  font-family: var(--font-display, var(--font-sans));
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.025em;
  color: var(--color-text-main);
  margin-bottom: 1.25rem;
}

@media (min-width: 640px) {
  .hero-headline {
    font-size: 2.65rem;
  }
}

@media (min-width: 1024px) {
  .hero-headline {
    font-size: 2.85rem;
  }
}

.hero-description {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: 1.75rem;
  max-width: 520px;
}

.hero-cta-group {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  width: 100%;
  margin-bottom: 1.75rem;
}

@media (min-width: 640px) {
  .hero-cta-group {
    flex-direction: row;
    width: auto;
  }
}

.btn-cta-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  color: #ffffff !important;
  background: var(--btn-gradient) !important;
  background-color: var(--color-primary) !important;
  border: 1px solid var(--color-primary) !important;
  border-radius: 8px;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.15s ease;
}

.btn-cta-primary:hover {
  background: var(--btn-gradient-hover) !important;
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
}

.btn-cta-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-cta-secondary:hover {
  background-color: var(--color-bg-muted);
  border-color: var(--color-primary);
  color: var(--color-primary-hover);
}

.hero-status-note {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.825rem;
  color: var(--color-text-muted);
}

.status-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
}

.hero-visual-column {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* 2. Content Sections */
.content-section {
  padding: 4rem 0;
}

@media (max-width: 640px) {
  .content-section {
    padding: 2.5rem 0;
  }
}

.section-bg-alt {
  background-color: var(--color-bg-alt);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.section-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1.5rem;
  box-sizing: border-box;
}

@media (max-width: 640px) {
  .section-container {
    padding: 0 1rem;
  }
}

@media (min-width: 1600px) {
  .section-container {
    max-width: 1320px;
  }

  .section-header {
    max-width: 840px;
  }
}

@media (min-width: 2000px) {
  .section-container {
    max-width: 1440px;
  }
}

.section-header {
  max-width: 760px;
  margin-bottom: 3rem;
}

.section-header-row {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  justify-content: space-between;
  margin-bottom: 2.5rem;
}

@media (min-width: 768px) {
  .section-header-row {
    flex-direction: row;
    align-items: flex-end;
  }
}

.btn-section-header {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-border);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-section-header:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.section-kicker {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-purple);
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin-bottom: 0.75rem;
}

@media (min-width: 640px) {
  .section-title {
    font-size: 2.25rem;
  }
}

.section-lead {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Editorial Split */
.editorial-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .editorial-split {
    grid-template-columns: 1fr 1fr;
  }
}

.audience-column {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.audience-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background-color: var(--color-purple-light);
  color: var(--color-purple);
  flex-shrink: 0;
}

.audience-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.audience-subtitle {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
}

.audience-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.audience-feature-list li {
  position: relative;
  padding-left: 1.5rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.audience-feature-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-purple);
  font-weight: 700;
}

.audience-feature-list strong {
  color: var(--color-text);
}

.column-action {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.section-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-purple);
  text-decoration: none;
  transition: gap 0.15s ease;
}

.section-link:hover {
  gap: 0.6rem;
}

/* 3. Map Previews */
.preview-map-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .preview-map-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .preview-map-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.preview-map-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.preview-img-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: var(--color-bg-muted);
  overflow: hidden;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  transition: transform 0.2s ease;
}

.preview-map-card:hover .preview-img {
  transform: scale(1.04);
}

.preview-info {
  padding: 1rem;
}

.preview-map-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.preview-map-desc {
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
}

/* 4. Home Download Card */
.home-download-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  box-shadow: var(--shadow-sm);
}

@media (min-width: 860px) {
  .home-download-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.home-download-text {
  max-width: 600px;
}

.download-banner-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.download-banner-lead {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
}

.home-download-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex-shrink: 0;
}

@media (min-width: 500px) {
  .home-download-actions {
    flex-direction: row;
  }
}

.header-with-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.header-actions-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-read-section {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-main);
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border-control);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 36px;
}

.btn-read-section:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-read-section:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
