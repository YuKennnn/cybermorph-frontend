<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'
import InlineSpeechPlayer from '../components/common/InlineSpeechPlayer.vue'
import {
  getStoredReadAloud,
  isReducedMotionActive,
  onMotionChange,
} from '../utils/accessibility.js'
import { startNarration, stopNarration, getSpeechState } from '../utils/speech.js'

import homeImg from '../assets/maps/home.jpg'
import officeImg from '../assets/maps/office.jpg'
import internetCafeImg from '../assets/maps/internet-cafe.jpg'
import publicParkImg from '../assets/maps/public-park.jpg'

import heroHomeImg from '../assets/hero-gameplay/home-gameplay.webp'
import heroOfficeImg from '../assets/hero-gameplay/office-gameplay.webp'
import heroInternetCafeImg from '../assets/hero-gameplay/internet-cafe-server.webp'
import heroPublicParkImg from '../assets/hero-gameplay/public-park-gameplay.webp'

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
    text: 'Play, learn, and track your progress. Play independently at your own pace, or connect with a teacher through optional classroom features. For players: Play offline. The game runs locally on your Android device without requiring continuous internet access. Practice real defense: Identify phishing scams, spot rogue Wi-Fi networks, and protect accounts in interactive missions. Personal progress: Sync completed missions to this web portal to view scores and threat summaries. No classroom required: Anyone can download and finish the full game independently. Optional classroom features: Connect with teachers and classmates. Join with a class code: Enter your teacher\'s 6-character code to share your mission progress with them. Classroom management: Instructors can create classrooms and monitor student progress. Identify common mistakes: Teachers review which threat types students find most difficult to tailor their instruction. Institutional accounts: Educator registration requires a DNSC email address and admin approval.',
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

const heroGameplaySlides = [
  {
    id: 'home',
    name: 'Home',
    image: heroHomeImg,
    alt: 'CyberMorph Home gameplay HUD showing Sector 01 intermediate level with progress bar, abort button, family living room, and status bar.',
  },
  {
    id: 'office',
    name: 'Office',
    image: heroOfficeImg,
    alt: 'CyberMorph Office gameplay HUD showing Sector 02 intermediate level with office workstations, employees, server rack, and status telemetry.',
  },
  {
    id: 'internet-cafe',
    name: 'Internet Cafe',
    image: heroInternetCafeImg,
    alt: 'CyberMorph Internet Cafe gameplay HUD showing Sector 03 beginner level with full server terminal grid of 20 PC stations and management controls.',
  },
  {
    id: 'public-park',
    name: 'Public Park',
    image: heroPublicParkImg,
    alt: 'CyberMorph Public Park gameplay HUD showing Sector 04 intermediate level with outdoor plaza, water fountain, unattended laptop, and status bar.',
  },
]

const TRANSITION_DURATION_MS = 240
const PRESS_FEEDBACK_MS = 150

const activeSlideIndex = ref(0)
const outgoingSlide = ref(null)
const transitionDirection = ref('next')
const isTransitioning = ref(false)
const isIncomingReady = ref(true)
const transitionKey = ref(0)
const pressedControl = ref(null)
const reducedMotion = ref(false)
const activeImgRef = ref(null)

const loadedSlideIds = new Set([heroGameplaySlides[0].id])
let transitionTimeoutId = null
let pressTimeoutId = null
let unsubscribeMotion = null

const activeSlide = computed(() => heroGameplaySlides[activeSlideIndex.value])

const clearTransitionTimer = () => {
  if (transitionTimeoutId !== null) {
    clearTimeout(transitionTimeoutId)
    transitionTimeoutId = null
  }
}

const clearPressTimer = () => {
  if (pressTimeoutId !== null) {
    clearTimeout(pressTimeoutId)
    pressTimeoutId = null
  }
}

const triggerControlFeedback = (direction) => {
  clearPressTimer()
  pressedControl.value = direction
  pressTimeoutId = setTimeout(() => {
    pressedControl.value = null
    pressTimeoutId = null
  }, PRESS_FEEDBACK_MS)
}

const scheduleTransitionEnd = () => {
  clearTransitionTimer()
  transitionTimeoutId = setTimeout(() => {
    isTransitioning.value = false
    outgoingSlide.value = null
    transitionTimeoutId = null
  }, TRANSITION_DURATION_MS)
}

const preloadSlideImages = () => {
  if (typeof Image === 'undefined') return
  for (const slide of heroGameplaySlides) {
    const img = new Image()
    img.onload = () => {
      loadedSlideIds.add(slide.id)
    }
    img.src = slide.image
    if (img.complete && img.naturalWidth > 0) {
      loadedSlideIds.add(slide.id)
    }
  }
}

const handleIncomingImageLoad = (slideId) => {
  if (slideId) {
    loadedSlideIds.add(slideId)
  }
  if (activeSlide.value?.id !== slideId) return
  if (!isIncomingReady.value) {
    isIncomingReady.value = true
    if (isTransitioning.value && !reducedMotion.value && !isReducedMotionActive()) {
      transitionKey.value += 1
      scheduleTransitionEnd()
    } else {
      isTransitioning.value = false
      outgoingSlide.value = null
    }
  }
}

const selectSlide = (index, direction = 'next') => {
  if (index < 0 || index >= heroGameplaySlides.length) return
  if (index === activeSlideIndex.value) return

  const previousSlide = heroGameplaySlides[activeSlideIndex.value]
  const nextSlideObj = heroGameplaySlides[index]
  transitionDirection.value = direction

  if (reducedMotion.value || isReducedMotionActive()) {
    clearTransitionTimer()
    isTransitioning.value = false
    isIncomingReady.value = true
    outgoingSlide.value = null
    activeSlideIndex.value = index
    return
  }

  clearTransitionTimer()
  outgoingSlide.value = previousSlide
  activeSlideIndex.value = index
  transitionKey.value += 1
  isTransitioning.value = true

  if (loadedSlideIds.has(nextSlideObj.id)) {
    isIncomingReady.value = true
    scheduleTransitionEnd()
  } else {
    isIncomingReady.value = false
    nextTick(() => {
      const el = activeImgRef.value
      if (el && el.complete && el.naturalWidth > 0) {
        handleIncomingImageLoad(nextSlideObj.id)
      }
    })
  }
}

const prevSlide = () => {
  const count = heroGameplaySlides.length
  const targetIndex = (activeSlideIndex.value - 1 + count) % count
  triggerControlFeedback('prev')
  selectSlide(targetIndex, 'prev')
}

const nextSlide = () => {
  const count = heroGameplaySlides.length
  const targetIndex = (activeSlideIndex.value + 1) % count
  triggerControlFeedback('next')
  selectSlide(targetIndex, 'next')
}

onMounted(() => {
  reducedMotion.value = isReducedMotionActive()
  preloadSlideImages()
  unsubscribeMotion = onMotionChange((active) => {
    reducedMotion.value = active
    if (active) {
      clearTransitionTimer()
      isTransitioning.value = false
      isIncomingReady.value = true
      outgoingSlide.value = null
    }
  })
})

onUnmounted(() => {
  clearTransitionTimer()
  clearPressTimer()
  if (unsubscribeMotion) {
    unsubscribeMotion()
    unsubscribeMotion = null
  }
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

          <!-- Landscape Android Phone Gameplay Preview Carousel -->
          <div class="hero-visual-column">
            <div class="hero-gameplay-preview" role="region" aria-label="Gameplay preview">
              <!-- Preview Header -->
              <div class="preview-header">
                <span class="preview-title">Gameplay preview</span>
              </div>

              <!-- Landscape Galaxy-Inspired Android Phone Frame -->
              <div class="android-phone-frame">
                <!-- Slim Camera Detail (stays clear of gameplay) -->
                <div class="phone-camera-hole" aria-hidden="true"></div>

                <!-- 16:9 Phone Screen with Quiet Dark Fill -->
                <div
                  class="phone-screen"
                  :class="{
                    'is-transitioning': isTransitioning && isIncomingReady && !reducedMotion,
                    'is-waiting-image': isTransitioning && !isIncomingReady && !reducedMotion,
                    'dir-next': transitionDirection === 'next',
                    'dir-prev': transitionDirection === 'prev',
                  }"
                >
                  <img
                    v-if="outgoingSlide && isTransitioning && !reducedMotion"
                    :key="`out-${transitionKey}-${outgoingSlide.id}`"
                    :src="outgoingSlide.image"
                    alt=""
                    aria-hidden="true"
                    class="phone-screen-img-outgoing"
                  />
                  <img
                    ref="activeImgRef"
                    :key="`in-${transitionKey}-${activeSlide.id}`"
                    :src="activeSlide.image"
                    :alt="activeSlide.alt"
                    class="phone-screen-img"
                    :loading="activeSlideIndex === 0 ? 'eager' : 'auto'"
                    @load="handleIncomingImageLoad(activeSlide.id)"
                    @error="handleIncomingImageLoad(activeSlide.id)"
                  />
                </div>
              </div>

              <!-- Below Phone: Active Map Name (left) and Navigation Controls (right) -->
              <div class="preview-footer">
                <div class="preview-map-info" aria-live="polite" aria-atomic="true">
                  <span class="hud-sector-dot" aria-hidden="true"></span>
                  <span class="sr-only">Active map: </span>
                  <span
                    :key="activeSlide.id"
                    class="preview-map-name"
                    :class="{
                      'map-name-next': isTransitioning && transitionDirection === 'next' && !reducedMotion,
                      'map-name-prev': isTransitioning && transitionDirection === 'prev' && !reducedMotion,
                    }"
                  >{{ activeSlide.name }}</span>
                </div>

                <div class="preview-nav-controls" role="group" aria-label="Map navigation">
                  <button
                    type="button"
                    class="nav-chevron-btn nav-chevron-prev"
                    :class="{ 'is-pressed': pressedControl === 'prev' }"
                    aria-label="Previous map"
                    @click="prevSlide"
                  >
                    <AppIcon name="chevron-left" :size="20" />
                  </button>
                  <button
                    type="button"
                    class="nav-chevron-btn nav-chevron-next"
                    :class="{ 'is-pressed': pressedControl === 'next' }"
                    aria-label="Next map"
                    @click="nextSlide"
                  >
                    <AppIcon name="chevron-right" :size="20" />
                  </button>
                </div>
              </div>
            </div>
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
                  <strong>Classroom management:</strong> Instructors can create classrooms and monitor student progress.
                </li>
                <li>
                  <strong>Identify common mistakes:</strong> Teachers review which threat types students find most difficult to tailor their instruction.
                </li>
                <li>
                  <strong>Institutional accounts:</strong> Educator registration requires a DNSC email address and admin approval.
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
                  width="320"
                  height="200"
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
  position: relative;
  overflow: hidden;
  padding: 3.5rem 0 4rem;
  background: linear-gradient(180deg, var(--color-violet-subtle) 0%, transparent 100%);
  --hero-dot-color: #6d28d9;
  --hero-glow-color: rgba(139, 92, 246, 0.16);
}

:root[data-theme="dark"] .hero-section {
  --hero-dot-color: #ede9fe;
  --hero-glow-color: rgba(167, 139, 250, 0.22);
}

.hero-section::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(var(--hero-dot-color) 1.5px, transparent 1.5px);
  background-size: 24px 24px;
  opacity: 0.04;
}

@media (max-width: 640px) {
  .hero-section {
    padding: 2rem 0 2.5rem;
  }
}

.hero-inner {
  position: relative;
  z-index: 1;
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
    grid-template-columns: 1fr 1.05fr;
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
  animation: hero-copy-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
  text-wrap: balance;
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
  text-wrap: pretty;
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
  max-width: 540px;
  margin: 0 auto;
  animation: hero-device-enter 460ms cubic-bezier(0.16, 1, 0.3, 1) 35ms both;
}

@keyframes hero-copy-enter {
  0% {
    opacity: 0.92;
    transform: translate3d(0, 10px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes hero-device-enter {
  0% {
    opacity: 0.92;
    transform: translate3d(0, 10px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.hero-gameplay-preview {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
}

.preview-title {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-text-main);
  letter-spacing: -0.01em;
}

/* Landscape Android Phone Chassis (Samsung Galaxy-Inspired) */
.android-phone-frame {
  --phone-chassis-border: #334155;
  --phone-chassis-dark: #0f172a;
  --phone-screen-bg: #080c14;

  position: relative;
  background: linear-gradient(145deg, #1e293b 0%, var(--phone-chassis-dark) 100%);
  border: 1.5px solid var(--phone-chassis-border);
  border-radius: 20px;
  padding: 6px 8px 6px 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4),
    0 10px 25px -4px rgba(15, 23, 42, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-phone-frame::before {
  content: '';
  position: absolute;
  inset: -28px -32px;
  background: radial-gradient(ellipse at center, var(--hero-glow-color, rgba(139, 92, 246, 0.16)) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 72%);
  border-radius: 44px;
  pointer-events: none;
  z-index: -1;
  filter: blur(10px);
}

.phone-camera-hole {
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #030712;
  border: 1px solid #374151;
  box-shadow: inset 0 0 1px rgba(167, 139, 250, 0.35);
  pointer-events: none;
}

.phone-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: var(--phone-screen-bg);
  border-radius: 14px;
  overflow: hidden;
  padding: 5px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.phone-screen-img,
.phone-screen-img-outgoing {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  display: block;
  user-select: none;
}

.phone-screen-img {
  position: relative;
  z-index: 2;
}

.phone-screen-img-outgoing {
  position: absolute;
  inset: 5px;
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  z-index: 1;
  pointer-events: none;
}

/* Keep outgoing image steady until incoming image is decoded */
.phone-screen.is-waiting-image .phone-screen-img {
  opacity: 0;
}

.phone-screen.is-waiting-image .phone-screen-img-outgoing {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

/* Directional Slide Transition Inside Phone Screen (240ms smooth deceleration) */
.phone-screen.is-transitioning.dir-next .phone-screen-img {
  will-change: transform, opacity;
  animation: screen-slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.phone-screen.is-transitioning.dir-next .phone-screen-img-outgoing {
  will-change: transform, opacity;
  animation: screen-slide-out-left 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.phone-screen.is-transitioning.dir-prev .phone-screen-img {
  will-change: transform, opacity;
  animation: screen-slide-in-left 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.phone-screen.is-transitioning.dir-prev .phone-screen-img-outgoing {
  will-change: transform, opacity;
  animation: screen-slide-out-right 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes screen-slide-in-right {
  0% {
    opacity: 0.92;
    transform: translate3d(100%, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes screen-slide-out-left {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
  100% {
    opacity: 0.25;
    transform: translate3d(-28%, 0, 0);
  }
}

@keyframes screen-slide-in-left {
  0% {
    opacity: 0.92;
    transform: translate3d(-100%, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes screen-slide-out-right {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
  100% {
    opacity: 0.25;
    transform: translate3d(28%, 0, 0);
  }
}

/* Below Phone: Active Map Name (left) & Navigation Chevrons (right) */
.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0;
}

.preview-map-info {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.hud-sector-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-violet-subtle);
  flex-shrink: 0;
}

.preview-map-name {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-main);
  letter-spacing: -0.01em;
  overflow-wrap: break-word;
  display: inline-block;
}

.preview-map-name.map-name-next {
  animation: map-label-next 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.preview-map-name.map-name-prev {
  animation: map-label-prev 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes map-label-next {
  0% {
    opacity: 0.75;
    transform: translate3d(6px, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes map-label-prev {
  0% {
    opacity: 0.75;
    transform: translate3d(-6px, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.preview-nav-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.nav-chevron-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border-control);
  border-radius: 8px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease,
    transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-chevron-btn :deep(svg) {
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-chevron-btn:hover {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nav-chevron-btn:active,
.nav-chevron-btn.is-pressed {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.22);
  transform: translateY(1px);
}

.nav-chevron-prev:active :deep(svg),
.nav-chevron-prev.is-pressed :deep(svg) {
  transform: translateX(-2px) scale(0.92);
}

.nav-chevron-next:active :deep(svg),
.nav-chevron-next.is-pressed :deep(svg) {
  transform: translateX(2px) scale(0.92);
}

.nav-chevron-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .hero-text-column,
  .hero-visual-column,
  .phone-screen.is-transitioning .phone-screen-img,
  .phone-screen.is-transitioning .phone-screen-img-outgoing,
  .preview-map-name.map-name-next,
  .preview-map-name.map-name-prev {
    animation: none !important;
    transform: none !important;
    opacity: 1 !important;
  }

  .phone-screen-img-outgoing {
    display: none !important;
  }

  .nav-chevron-btn,
  .nav-chevron-btn :deep(svg) {
    transition: background-color 0.01ms, border-color 0.01ms, color 0.01ms, box-shadow 0.01ms !important;
    transform: none !important;
  }

  .nav-chevron-btn:active,
  .nav-chevron-btn.is-pressed {
    transform: none !important;
    background-color: var(--color-violet-subtle);
    border-color: var(--color-primary);
    color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.28);
  }
}

:root[data-reduced-motion="true"] .hero-text-column,
:root[data-reduced-motion="true"] .hero-visual-column,
:root[data-reduced-motion="true"] .phone-screen.is-transitioning .phone-screen-img,
:root[data-reduced-motion="true"] .phone-screen.is-transitioning .phone-screen-img-outgoing,
:root[data-reduced-motion="true"] .preview-map-name.map-name-next,
:root[data-reduced-motion="true"] .preview-map-name.map-name-prev {
  animation: none !important;
  transform: none !important;
  opacity: 1 !important;
}

:root[data-reduced-motion="true"] .phone-screen-img-outgoing {
  display: none !important;
}

:root[data-reduced-motion="true"] .nav-chevron-btn,
:root[data-reduced-motion="true"] .nav-chevron-btn :deep(svg) {
  transition: none !important;
  transform: none !important;
}

:root[data-reduced-motion="true"] .nav-chevron-btn:active,
:root[data-reduced-motion="true"] .nav-chevron-btn.is-pressed {
  transform: none !important;
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.28);
}

@media (max-width: 560px) {
  .android-phone-frame {
    border-radius: 16px;
    padding: 5px 6px 5px 12px;
  }

  .phone-screen {
    border-radius: 11px;
  }
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
  text-wrap: balance;
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
  text-wrap: pretty;
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
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: block;
}

@media (hover: hover) and (pointer: fine) {
  .preview-map-card:hover .preview-img {
    transform: scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview-img {
    transition: none !important;
  }

  .preview-map-card:hover .preview-img {
    transform: none !important;
  }
}

:root[data-reduced-motion="true"] .preview-img {
  transition: none !important;
}

:root[data-reduced-motion="true"] .preview-map-card:hover .preview-img {
  transform: none !important;
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
  text-wrap: balance;
}

.download-banner-lead {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
  text-wrap: pretty;
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
