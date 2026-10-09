<script setup>
import { onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'

const route = useRoute()

onMounted(() => {
  if (route.hash === '#requirements') {
    setTimeout(() => {
      const el = document.getElementById('requirements')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
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
        </div>
      </section>

      <!-- Main Download & Installation Section -->
      <section class="content-section">
        <div class="page-container">
          <div class="download-grid">
            <!-- Left Card: Package Status & Sideloading -->
            <div class="card-package">
              <div class="card-header">
                <div class="platform-badge">
                  <AppIcon name="smartphone" :size="20" />
                  <span>Android Package (APK)</span>
                </div>
                <span class="badge-beta">Beta Testing</span>
              </div>

              <div class="platform-notes">
                <p class="platform-statement">
                  CyberMorph is currently available for Android. During the beta, players install the game using an APK package.
                </p>
                <p class="platform-statement statement-muted">
                  CyberMorph is not currently available for iPhone or iPad.
                </p>
                <p class="platform-statement statement-muted">
                  The browser portal is used to view progress and manage classrooms. The game itself runs locally on your Android device.
                </p>
              </div>

              <!-- Status Box -->
              <div class="status-box">
                <div class="status-row">
                  <span class="status-label">Beta release link:</span>
                  <span class="status-badge-pending">Awaiting confirmation</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Build version:</span>
                  <span class="status-text-subtle">Beta release awaiting confirmation</span>
                </div>
                <p class="status-hint">
                  The direct APK package link will be activated once the build package is published. You can register your player account now to reserve your username.
                </p>
              </div>

              <div class="action-row">
                <RouterLink to="/register" class="btn-primary">
                  <span>Create Player Account</span>
                  <AppIcon name="arrow-right" :size="16" />
                </RouterLink>
                <RouterLink to="/login" class="btn-secondary">
                  <span>Sign In</span>
                </RouterLink>
              </div>

              <!-- Installation steps -->
              <div class="install-guide">
                <h3 class="guide-title">How to install during the beta:</h3>
                <ol class="guide-steps">
                  <li>
                    <strong>Download package:</strong> Download the CyberMorph APK file directly to your Android device once published.
                  </li>
                  <li>
                    <strong>Allow installation:</strong> If prompted by Android, enable "Install unknown apps" for your browser in system settings.
                  </li>
                  <li>
                    <strong>Install application:</strong> Tap the downloaded file in your notifications or downloads folder and tap <strong>Install</strong>.
                  </li>
                  <li>
                    <strong>Sign in and play:</strong> Launch CyberMorph, sign in with your player account, and start exploring missions offline.
                  </li>
                </ol>
              </div>
            </div>

            <!-- Right Card: System Requirements -->
            <div id="requirements" class="card-requirements">
              <h2 class="requirements-title">System requirements</h2>
              <p class="requirements-subtitle">
                Device specifications and compatibility information for Android.
              </p>

              <div class="requirements-table-wrap">
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
                        Required for account sign-in and syncing progress; gameplay missions are playable offline.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="faq-box">
                <h3 class="faq-heading">Frequently asked questions</h3>
                <div class="faq-item">
                  <h4 class="faq-question">Can I play in my desktop browser?</h4>
                  <p class="faq-answer">
                    No. The game runs natively on Android devices. This browser application provides account registration, personal progress viewing, and optional classroom management.
                  </p>
                </div>
                <div class="faq-item">
                  <h4 class="faq-question">Do I need an active internet connection to play?</h4>
                  <p class="faq-answer">
                    Gameplay missions run offline locally. You only need an internet connection to initially sign in and sync completed mission scores to your web account.
                  </p>
                </div>
              </div>
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

.download-hero {
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
  padding: 3.5rem 0 5rem;
}

.download-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: start;
}

@media (min-width: 900px) {
  .download-grid {
    grid-template-columns: 1.25fr 1fr;
  }
}

.card-package,
.card-requirements {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.badge-beta {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-purple);
  background-color: var(--color-purple-light);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

.platform-notes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.75rem;
}

.platform-statement {
  font-size: 0.925rem;
  line-height: 1.55;
  color: var(--color-text);
  margin: 0;
}

.statement-muted {
  color: var(--color-text-muted);
}

.status-box {
  background-color: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}

.status-label {
  font-weight: 600;
  color: var(--color-text);
}

.status-badge-pending {
  font-size: 0.75rem;
  font-weight: 700;
  color: #854d0e;
  background-color: #fef9c3;
  border: 1px solid #fde047;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

.status-text-subtle {
  font-size: 0.825rem;
  color: var(--color-text-muted);
}

.status-hint {
  font-size: 0.825rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
}

.action-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
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

.btn-primary:hover {
  background: var(--btn-gradient-hover) !important;
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
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

.btn-secondary:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
  color: var(--color-primary-hover);
}

.btn-secondary:hover {
  background-color: rgba(109, 40, 217, 0.15);
}

.install-guide {
  padding-top: 1.75rem;
  border-top: 1px solid var(--color-border);
}

.guide-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.guide-steps {
  padding-left: 1.25rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.guide-steps li {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.guide-steps strong {
  color: var(--color-text);
}

.requirements-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.35rem;
}

.requirements-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.requirements-table-wrap {
  margin-bottom: 2rem;
}

.requirements-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.requirements-table th,
.requirements-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.requirements-table th {
  width: 40%;
  font-weight: 600;
  color: var(--color-text);
}

.requirements-table td {
  color: var(--color-text-muted);
  line-height: 1.5;
}

.text-pending {
  font-style: italic;
  color: #854d0e;
}

.faq-box {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.faq-heading {
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.faq-item {
  margin-bottom: 1rem;
}

.faq-question {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.faq-answer {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
