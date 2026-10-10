<script setup>
import { onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'

const route = useRoute()

const scrollToSection = (id) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

onMounted(() => {
  if (route.hash) {
    const targetId = route.hash.replace('#', '')
    setTimeout(() => {
      scrollToSection(targetId)
    }, 120)
  }
})
</script>

<template>
  <div class="download-page">
    <PublicHeader />

    <main class="download-main">
      <!-- Hero -->
      <section class="download-hero">
        <div class="page-container">
          <span class="badge-subtle">Android Beta</span>
          <h1 class="page-title">Download CyberMorph</h1>
          <p class="page-lead">
            Install the game on your Android device to practice cybersecurity defense offline. Use this web portal to manage your account and view synced progress.
          </p>

          <!-- Local Section Links -->
          <nav class="local-nav-bar" aria-label="Page section navigation">
            <a href="#download" class="local-nav-link" @click.prevent="scrollToSection('download')">
              Download
            </a>
            <span class="local-nav-sep" aria-hidden="true">|</span>
            <a href="#requirements" class="local-nav-link" @click.prevent="scrollToSection('requirements')">
              System requirements
            </a>
            <span class="local-nav-sep" aria-hidden="true">|</span>
            <a href="#faq" class="local-nav-link" @click.prevent="scrollToSection('faq')">
              FAQ
            </a>
          </nav>
        </div>
      </section>

      <!-- SECTION 1: Download (#download) -->
      <section id="download" class="full-section">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Platforms</span>
            <h2 class="section-title">Distribution & platforms</h2>
            <p class="section-lead">
              CyberMorph is currently developed as an offline-first Android application. Choose your platform below.
            </p>
          </div>

          <!-- Platform Options Grid -->
          <div class="platforms-grid">
            <!-- 1. Android APK (Primary option) -->
            <div class="platform-card platform-card-primary">
              <div class="platform-card-header">
                <div class="platform-icon-wrap primary-icon">
                  <AppIcon name="smartphone" :size="24" />
                </div>
                <div>
                  <h3 class="platform-name">Android Package (APK)</h3>
                  <span class="platform-badge-primary">Beta Testing</span>
                </div>
              </div>

              <p class="platform-card-desc">
                CyberMorph is currently available for Android. During the beta, players install the game directly using an APK package.
              </p>

              <div class="apk-status-box">
                <div class="status-row">
                  <span class="status-label">Beta release link:</span>
                  <span class="status-badge-pending">Awaiting confirmation</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Build version:</span>
                  <span class="status-subtle">Beta release awaiting confirmation</span>
                </div>
                <p class="status-hint">
                  The direct APK package link will be activated once published. Register your player account now to reserve your username.
                </p>
              </div>

              <div class="platform-actions">
                <RouterLink to="/register" class="btn-primary">
                  <span>Create Player Account</span>
                  <AppIcon name="arrow-right" :size="16" />
                </RouterLink>
                <RouterLink to="/login" class="btn-secondary">
                  <span>Sign In</span>
                </RouterLink>
              </div>
            </div>

            <!-- 2. Google Play (Not currently available) -->
            <div class="platform-card platform-card-disabled">
              <div class="platform-card-header">
                <div class="platform-icon-wrap disabled-icon">
                  <AppIcon name="google-play" :size="24" />
                </div>
                <div>
                  <h3 class="platform-name">Google Play Store</h3>
                  <span class="platform-badge-unavailable">Not currently available</span>
                </div>
              </div>

              <p class="platform-card-desc">
                CyberMorph is not currently distributed through the Google Play Store. Beta access is provided via direct APK package.
              </p>

              <div class="disabled-status-note">
                <span>Direct store download is unavailable.</span>
              </div>

              <div class="platform-actions">
                <button
                  type="button"
                  class="btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  Download
                </button>
              </div>
            </div>

            <!-- 3. Steam (Not currently available) -->
            <div class="platform-card platform-card-disabled">
              <div class="platform-card-header">
                <div class="platform-icon-wrap disabled-icon">
                  <AppIcon name="steam" :size="24" />
                </div>
                <div>
                  <h3 class="platform-name">Steam</h3>
                  <span class="platform-badge-unavailable">Not currently available</span>
                </div>
              </div>

              <p class="platform-card-desc">
                CyberMorph is not currently distributed on Steam for PC or Steam Deck. The simulation is designed for Android mobile devices.
              </p>

              <div class="disabled-status-note">
                <span>Steam store distribution is unavailable.</span>
              </div>

              <div class="platform-actions">
                <button
                  type="button"
                  class="btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  Download
                </button>
              </div>
            </div>
          </div>

          <!-- Existing APK Installation Guide -->
          <div class="install-guide-panel">
            <h3 class="guide-title">How to install during the beta:</h3>
            <ol class="guide-steps">
              <li>
                <strong>Download package:</strong> Download the CyberMorph APK file directly to your Android device once published.
              </li>
              <li>
                <strong>Allow installation:</strong> If prompted by Android, enable "Install unknown apps" for your browser in system settings.
              </li>
              <li>
                <strong>Install application:</strong> Tap the downloaded file in your notifications or downloads folder and select <strong>Install</strong>.
              </li>
              <li>
                <strong>Sign in and play:</strong> Launch CyberMorph, sign in with your player account, and start exploring missions offline.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- SECTION 2: System requirements (#requirements) -->
      <section id="requirements" class="full-section section-bg-alt">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Compatibility</span>
            <h2 class="section-title">System requirements</h2>
            <p class="section-lead">
              Device specifications and compatibility information for Android devices.
            </p>
          </div>

          <div class="requirements-card">
            <table class="requirements-table">
              <tbody>
                <tr>
                  <th scope="row">Platform</th>
                  <td>Android</td>
                </tr>
                <tr>
                  <th scope="row">Android Version</th>
                  <td>
                    <span class="text-pending">Awaiting confirmation</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Architecture</th>
                  <td>ARM64</td>
                </tr>
                <tr>
                  <th scope="row">Memory (RAM)</th>
                  <td>
                    <span class="text-pending">Awaiting confirmation</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Free Storage</th>
                  <td>
                    <span class="text-pending">Awaiting confirmation</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Network</th>
                  <td>
                    Required for initial account sign-in and cloud progress syncing; gameplay missions run offline locally.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- SECTION 3: Frequently asked questions (#faq) -->
      <section id="faq" class="full-section">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Got Questions?</span>
            <h2 class="section-title">Frequently asked questions</h2>
            <p class="section-lead">
              Clear answers regarding gameplay, offline availability, device support, and classroom participation.
            </p>
          </div>

          <div class="faq-list">
            <!-- Q1: Can anyone play or do I need classroom? -->
            <div class="faq-card">
              <h3 class="faq-question">Can anyone play, or do I need to join a classroom?</h3>
              <p class="faq-answer">
                Anyone can play. Independent play is the default and complete experience. Anyone can download the Android game, play through all scenarios, and track their personal progress without needing to join a classroom. Joining a classroom is completely optional for students whose instructor provides a 6-character code.
              </p>
            </div>

            <!-- Q2: Web browser play? -->
            <div class="faq-card">
              <h3 class="faq-question">Can I play in a web browser?</h3>
              <p class="faq-answer">
                No. The game runs natively on Android devices as an offline-first mobile app built in Godot. This web portal is used for account registration, viewing synchronized progress scores, and managing optional classrooms.
              </p>
            </div>

            <!-- Q3: Internet connection needed? -->
            <div class="faq-card">
              <h3 class="faq-question">Do I need an internet connection to play?</h3>
              <p class="faq-answer">
                Gameplay simulation missions run offline locally on your Android device. You do not need a continuous internet connection to play. An active connection is only required to initially sign in and sync completed mission scores to your web account.
              </p>
            </div>

            <!-- Q4: iPhone or iPad? -->
            <div class="faq-card">
              <h3 class="faq-question">Is the game available for iPhone or iPad?</h3>
              <p class="faq-answer">
                CyberMorph is currently developed exclusively for Android. It is not currently available for iPhone or iPad (iOS).
              </p>
            </div>

            <!-- Q5: Google Play or Steam? -->
            <div class="faq-card">
              <h3 class="faq-question">Is it available on Google Play or Steam?</h3>
              <p class="faq-answer">
                No. CyberMorph is not currently available on Google Play or Steam. During the beta period, players install the game directly using an Android APK package.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>
.download-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.download-main {
  flex: 1;
}

.page-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Hero & Local Navigation */
.download-hero {
  padding: 3.5rem 0 2.5rem;
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
  max-width: 780px;
  margin-bottom: 1.75rem;
}

/* Local Section Navigation */
.local-nav-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
}

.local-nav-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.local-nav-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.local-nav-sep {
  color: var(--color-border-hover);
  font-size: 0.85rem;
}

/* Sections */
.full-section {
  padding: 4rem 0;
  scroll-margin-top: 85px;
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
  margin-bottom: 0.5rem;
}

.section-lead {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  max-width: 700px;
}

/* Platform Options Grid */
.platforms-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

@media (min-width: 840px) {
  .platforms-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.platform-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
}

.platform-card-primary {
  border-color: rgba(124, 58, 237, 0.35);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.08);
}

.platform-card-disabled {
  background-color: #fbfbfc;
  opacity: 0.95;
}

.platform-card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
}

.platform-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.primary-icon {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
}

.disabled-icon {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
}

.platform-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.platform-badge-primary {
  display: inline-block;
  font-size: 0.725rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.platform-badge-unavailable {
  display: inline-block;
  font-size: 0.725rem;
  font-weight: 600;
  color: #64748b;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.platform-card-desc {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
  flex: 1;
}

.apk-status-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.status-label {
  font-weight: 600;
  color: var(--color-text);
}

.status-badge-pending {
  font-size: 0.725rem;
  font-weight: 700;
  color: #854d0e;
  background-color: #fef9c3;
  border: 1px solid #fde047;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.status-subtle {
  font-size: 0.775rem;
  color: var(--color-text-muted);
}

.status-hint {
  font-size: 0.775rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.disabled-status-note {
  font-size: 0.8rem;
  color: #64748b;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem 0.875rem;
  margin-bottom: 1.5rem;
}

.platform-actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
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

.btn-primary:hover {
  background: var(--btn-gradient-hover) !important;
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
}

.btn-disabled {
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: not-allowed;
  opacity: 0.85;
}

/* Install Guide Panel */
.install-guide-panel {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.guide-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1.25rem;
}

.guide-steps {
  padding-left: 1.25rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.guide-steps li {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.guide-steps strong {
  color: var(--color-text);
}

/* Requirements Section */
.requirements-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.requirements-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.requirements-table th,
.requirements-table td {
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.requirements-table tr:last-child th,
.requirements-table tr:last-child td {
  border-bottom: none;
}

.requirements-table th {
  width: 35%;
  font-weight: 600;
  color: var(--color-text);
}

.requirements-table td {
  color: var(--color-text-muted);
  line-height: 1.55;
}

.text-pending {
  font-style: italic;
  color: #854d0e;
}

/* FAQ Section */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-sm);
}

.faq-question {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.65rem;
}

.faq-answer {
  font-size: 0.925rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
