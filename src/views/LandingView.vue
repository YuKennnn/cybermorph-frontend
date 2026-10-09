<script setup>
import { RouterLink } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import InteractiveHeroPreview from '../components/landing/InteractiveHeroPreview.vue'
import AppIcon from '../components/common/AppIcon.vue'

import homeImg from '../assets/maps/home.png'
import officeImg from '../assets/maps/office.png'
import internetCafeImg from '../assets/maps/internet-cafe.png'
import publicParkImg from '../assets/maps/public-park.png'

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
            <span class="badge-subtle">Educational Cybersecurity Game</span>
            <h1 class="hero-headline">
              Learn to recognise cyber threats through play.
            </h1>
            <p class="hero-description">
              Practice cybersecurity decisions in an Android game. Use the web portal to view progress and manage classrooms.
            </p>

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

      <!-- 2. Concise Audience Overview: Play, learn, and track your progress -->
      <section class="content-section section-bg-alt">
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
            <RouterLink to="/gameplay" class="btn-section-header">
              <span>View full gameplay guide</span>
              <AppIcon name="arrow-right" :size="16" />
            </RouterLink>
          </div>

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
              <span class="badge-subtle">Android Beta</span>
              <h2 class="download-banner-title">Get started with CyberMorph</h2>
              <p class="download-banner-lead">
                CyberMorph is currently available for Android devices as an APK package. The companion web portal lets you view synced scores and join optional classrooms.
              </p>
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
  padding: 3.5rem 1.5rem 4.5rem;
  background: linear-gradient(180deg, rgba(245, 243, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%);
}

.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  align-items: center;
}

@media (min-width: 1024px) {
  .hero-inner {
    grid-template-columns: 1.15fr 0.85fr;
    gap: 3.5rem;
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
  font-family: var(--font-body);
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--color-text);
  margin-bottom: 1.25rem;
}

@media (min-width: 640px) {
  .hero-headline {
    font-size: 3.25rem;
  }
}

@media (min-width: 1024px) {
  .hero-headline {
    font-size: 3.5rem;
  }
}

.hero-description {
  font-size: 1.15rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: 2rem;
  max-width: 580px;
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
  background-color: #ede9fe;
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
}

/* 2. Content Sections */
.content-section {
  padding: 4.5rem 1.5rem;
}

.section-bg-alt {
  background-color: var(--color-bg-alt);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.section-container {
  max-width: 1200px;
  margin: 0 auto;
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
  color: var(--color-purple);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background-color: var(--color-purple-light);
  border: 1px solid rgba(109, 40, 217, 0.2);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-section-header:hover {
  background-color: rgba(109, 40, 217, 0.15);
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
  background-color: #ffffff;
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
  background-color: #ffffff;
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
  background-color: #0f172a;
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
  background-color: #ffffff;
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
</style>
