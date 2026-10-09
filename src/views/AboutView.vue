<script setup>
import { RouterLink } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'
</script>

<template>
  <div class="about-page">
    <PublicHeader />

    <main class="about-main">
      <!-- Hero / Introduction -->
      <section class="about-hero">
        <div class="page-container">
          <span class="badge-subtle">Educational Mission</span>
          <h1 class="page-title">About CyberMorph</h1>
          <p class="page-lead">
            CyberMorph is an educational cybersecurity game designed to help learners and players recognise digital threats through interactive, simulation-based decision making.
          </p>
        </div>
      </section>

      <!-- Section: Why Interactive Defense Matters -->
      <section class="content-section">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Core Philosophy</span>
            <h2 class="section-title">Learn by making decisions</h2>
            <p class="section-lead">
              Traditional security training relies on static slides and abstract rules. CyberMorph puts players in real-world situations where every decision carries realistic consequences.
            </p>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="card-icon">
                <AppIcon name="shield" :size="24" />
              </div>
              <h3 class="card-title">Realistic digital threats</h3>
              <p class="card-text">
                Players encounter phishing emails, suspicious links, credential harvesting portals, rogue Wi-Fi access points, and social engineering attempts in familiar settings.
              </p>
            </div>

            <div class="info-card">
              <div class="card-icon">
                <AppIcon name="smartphone" :size="24" />
              </div>
              <h3 class="card-title">Offline-first mobile play</h3>
              <p class="card-text">
                Built with Godot for Android, the game runs locally on your device without requiring continuous internet access during gameplay.
              </p>
            </div>

            <div class="info-card">
              <div class="card-icon">
                <AppIcon name="analytics" :size="24" />
              </div>
              <h3 class="card-title">Cloud sync & web portal</h3>
              <p class="card-text">
                When an internet connection is available, players can sync their completed missions to view scores, threat summaries, and personal history on this portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: For Players (Primary Audience) -->
      <section class="content-section section-bg-alt">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Primary Audience</span>
            <h2 class="section-title">Built for players</h2>
            <p class="section-lead">
              CyberMorph is designed for anyone interested in improving their digital security habits. Independent play is the default and complete experience.
            </p>
          </div>

          <div class="detail-split">
            <div class="detail-column">
              <h3 class="detail-heading">Independent gameplay</h3>
              <p class="detail-paragraph">
                You do not need to be enrolled in a school, university, or classroom program to enjoy CyberMorph. Any user can download the Android game package, play through all simulation maps, and practice defending against every threat type.
              </p>
              <ul class="feature-checklist">
                <li>Complete all gameplay environments at your own pace</li>
                <li>Practice identifying 8 common digital threat types</li>
                <li>Review your personal decision records and mistakes</li>
                <li>No mandatory classroom codes or institutional credentials required</li>
              </ul>
            </div>

            <div class="detail-column">
              <h3 class="detail-heading">Your personal portal</h3>
              <p class="detail-paragraph">
                Creating an account on this web portal allows you to safeguard your username and review your synchronized progress whenever your mobile device connects online.
              </p>
              <ul class="feature-checklist">
                <li>View completed missions and map progress</li>
                <li>Read threat knowledge base summaries</li>
                <li>Optionally connect to a classroom if an instructor provides a code</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: Optional Classroom Features -->
      <section id="classrooms" class="content-section">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">For Schools & Instructors</span>
            <h2 class="section-title">Optional classroom features</h2>
            <p class="section-lead">
              For educators teaching digital safety courses, CyberMorph provides optional classroom management tools to coordinate student cohorts.
            </p>
          </div>

          <div class="classroom-cards">
            <div class="classroom-step-card">
              <div class="step-badge">1</div>
              <h3 class="step-title">Verified educator accounts</h3>
              <p class="step-desc">
                Instructors register using their institutional email address (such as @dnsc.edu.ph). Once approved by administrators, they gain access to teacher dashboard tools.
              </p>
            </div>

            <div class="classroom-step-card">
              <div class="step-badge">2</div>
              <h3 class="step-title">Simple 6-character class codes</h3>
              <p class="step-desc">
                Educators create classrooms for specific subjects or sections. Each classroom generates a simple 6-character code that students can enter in their accounts.
              </p>
            </div>

            <div class="classroom-step-card">
              <div class="step-badge">3</div>
              <h3 class="step-title">Identify common mistakes</h3>
              <p class="step-desc">
                Teachers can view overall completion rates and see which types of threats students struggle with the most, helping instructors focus classroom instruction.
              </p>
            </div>
          </div>

          <div class="classroom-note-box">
            <AppIcon name="info" :size="20" class="note-icon" />
            <p class="note-text">
              <strong>Reminder for students:</strong> Joining a classroom is entirely optional. It simply links your progress to your teacher's roster so they can see your completed missions.
            </p>
          </div>
        </div>
      </section>

      <!-- Call to Action Banner -->
      <section class="content-section cta-banner-section">
        <div class="page-container">
          <div class="cta-banner">
            <div class="cta-content">
              <h2 class="cta-headline">Ready to practice digital defense?</h2>
              <p class="cta-subhead">
                Download CyberMorph for your Android device or explore the gameplay simulation maps.
              </p>
            </div>
            <div class="cta-actions">
              <RouterLink to="/download" class="btn-cta-primary">
                <AppIcon name="download" :size="18" />
                <span>Download Android Game</span>
              </RouterLink>
              <RouterLink to="/gameplay" class="btn-cta-secondary">
                <span>Explore Gameplay</span>
                <AppIcon name="arrow-right" :size="16" />
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
.about-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.about-main {
  flex: 1;
}

.page-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.about-hero {
  padding: 4rem 0 3rem;
  background: linear-gradient(180deg, rgba(245, 243, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%);
  border-bottom: 1px solid var(--color-border);
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
  margin-bottom: 1rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text);
  line-height: 1.15;
  margin-bottom: 1rem;
}

@media (min-width: 768px) {
  .page-title {
    font-size: 3rem;
  }
}

.page-lead {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  max-width: 800px;
}

.content-section {
  padding: 4rem 0;
}

.section-bg-alt {
  background-color: var(--color-bg-alt);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.section-header {
  margin-bottom: 2.5rem;
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
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin-bottom: 0.75rem;
}

.section-lead {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  max-width: 700px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.info-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.75rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background-color: var(--color-purple-light);
  color: var(--color-purple);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
}

.card-text {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.detail-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .detail-split {
    grid-template-columns: 1fr 1fr;
  }
}

.detail-column {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.detail-heading {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.75rem;
}

.detail-paragraph {
  font-size: 0.925rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.feature-checklist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.feature-checklist li {
  position: relative;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text);
}

.feature-checklist li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-purple);
  font-weight: 700;
}

.classroom-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .classroom-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

.classroom-step-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.75rem;
  position: relative;
  box-shadow: var(--shadow-sm);
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-purple);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.step-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.step-desc {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.classroom-note-box {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
  background-color: var(--color-purple-light);
  border: 1px solid rgba(109, 40, 217, 0.2);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}

.note-icon {
  color: var(--color-purple);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.note-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text);
  margin: 0;
}

.cta-banner {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: var(--shadow-sm);
}

@media (min-width: 768px) {
  .cta-banner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cta-headline {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.cta-subhead {
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.cta-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex-shrink: 0;
}

@media (min-width: 640px) {
  .cta-actions {
    flex-direction: row;
  }
}

.btn-cta-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffffff !important;
  background: var(--btn-gradient) !important;
  background-color: var(--color-primary) !important;
  border: 1px solid var(--color-primary) !important;
  border-radius: 6px;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  transition: all 0.15s ease;
}

.btn-cta-primary:hover {
  background: var(--btn-gradient-hover) !important;
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}

.btn-cta-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-cta-secondary:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
  color: var(--color-primary-hover);
}
</style>
