<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'
import InlineSpeechPlayer from '../components/common/InlineSpeechPlayer.vue'
import { getStoredReadAloud } from '../utils/accessibility.js'
import { startNarration, stopNarration, getSpeechState } from '../utils/speech.js'
import { fetchAppVersion, extractErrorMessage } from '../api/app.js'

const route = useRoute()

const isReadAloudEnabled = computed(() => getStoredReadAloud() === 'on')

const btnRefRequirements = ref(null)
const btnRefInstall = ref(null)

const DOWNLOAD_SECTIONS = {
  requirements: {
    title: 'System Requirements',
    text: 'System requirements. Device specifications and compatibility information for Android devices. Platform: Android. Android Version: Awaiting confirmation. Architecture: ARM64. Memory: Awaiting confirmation. Free Storage: Awaiting confirmation. Network: Required for initial account sign-in and cloud progress syncing; gameplay missions run offline locally.',
  },
  install: {
    title: 'Beta Installation Guide',
    text: 'How to install during the beta: Step 1: Download package. Open the download link to access the APK file on Google Drive or the external release host, then download it to your device. Step 2: Allow installation. If prompted by Android, enable "Install unknown apps" for your browser or file manager in system settings. Step 3: Install application. Tap the downloaded APK file in your notifications or downloads folder and select Install. Step 4: Sign in and play. Launch CyberMorph, sign in with your player account, and start exploring missions offline.',
  },
}

const releaseData = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')
const errorType = ref(null) // null | 'network' | 'invalid_metadata' | 'self_loop' | 'invalid_url'
let currentRequestId = 0

const isValidHttpsUrl = (urlString) => {
  if (typeof urlString !== 'string') return false
  const trimmed = urlString.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

const isSelfLoopUrl = (urlString) => {
  if (typeof urlString !== 'string') return false
  const trimmed = urlString.trim()
  if (!trimmed) return false
  try {
    if (typeof window === 'undefined') return false
    const targetUrl = new URL(trimmed, window.location.href)
    const isSameHost = targetUrl.host.toLowerCase() === window.location.host.toLowerCase()
    const targetPath = targetUrl.pathname.replace(/\/+$/, '').toLowerCase()
    const currentPath = window.location.pathname.replace(/\/+$/, '').toLowerCase()
    return isSameHost && (targetPath === currentPath || targetPath === '/download')
  } catch {
    return false
  }
}

const isGoogleDriveUrl = (urlString) => {
  if (typeof urlString !== 'string') return false
  try {
    const url = new URL(urlString.trim())
    const host = url.hostname.toLowerCase()
    return host === 'drive.google.com' || host === 'docs.google.com'
  } catch {
    return false
  }
}

const isDownloadAvailable = computed(() => {
  if (!releaseData.value || errorType.value) return false
  const url = releaseData.value.download_url
  return typeof url === 'string' && url.trim().length > 0 && isValidHttpsUrl(url) && !isSelfLoopUrl(url)
})

const isDownloadEmpty = computed(() => {
  if (!releaseData.value || errorType.value) return false
  const url = releaseData.value.download_url
  return !url || typeof url !== 'string' || url.trim().length === 0
})

const isGoogleDrive = computed(() => {
  if (!isDownloadAvailable.value) return false
  return isGoogleDriveUrl(releaseData.value.download_url)
})

const buildLabel = computed(() => {
  if (isLoading.value && !releaseData.value) {
    return 'Checking release...'
  }
  if (releaseData.value?.latest_build != null) {
    return `Build ${releaseData.value.latest_build}`
  }
  if (errorType.value) {
    return 'Unavailable'
  }
  return 'Beta release awaiting confirmation'
})

const fetchRelease = async () => {
  if (isLoading.value && currentRequestId > 0) return

  const requestId = ++currentRequestId
  isLoading.value = true
  errorMessage.value = ''
  errorType.value = null

  try {
    const data = await fetchAppVersion()
    if (requestId !== currentRequestId) return

    if (!data || typeof data !== 'object' || typeof data.latest_build !== 'number') {
      errorType.value = 'invalid_metadata'
      errorMessage.value = 'Invalid release metadata received from server.'
      releaseData.value = null
      return
    }

    releaseData.value = data

    const url = data.download_url
    if (url && typeof url === 'string' && url.trim()) {
      if (isSelfLoopUrl(url)) {
        errorType.value = 'self_loop'
        errorMessage.value = 'Release download link points back to this page (configuration error).'
      } else if (!isValidHttpsUrl(url)) {
        errorType.value = 'invalid_url'
        errorMessage.value = 'Release download link is not a valid HTTPS URL (configuration error).'
      }
    }
  } catch (err) {
    if (requestId !== currentRequestId) return
    errorType.value = 'network'
    errorMessage.value = extractErrorMessage(
      err,
      'Unable to load release information. The server may still be waking up — please try again.',
    )
    releaseData.value = null
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
    }
  }
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
  if (currentOwner && currentOwner.startsWith('download-')) {
    stopNarration(currentOwner)
  }
})

const scrollToSection = (id) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

onMounted(() => {
  fetchRelease()
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
            <a href="#requirements" class="local-nav-link" @click.prevent="scrollToSection('requirements')">
              System requirements
            </a>
            <span class="local-nav-sep" aria-hidden="true">|</span>
            <a href="#download" class="local-nav-link" @click.prevent="scrollToSection('download')">
              Download
            </a>
          </nav>
        </div>
      </section>

      <!-- SECTION 1: System requirements (#requirements) -->
      <section id="requirements" class="full-section">
        <div class="page-container">
          <div class="section-header">
            <div class="header-with-action">
              <h2 class="section-title">System requirements</h2>
              <button
                v-if="isReadAloudEnabled"
                ref="btnRefRequirements"
                type="button"
                class="btn-read-section"
                aria-label="Read System Requirements aloud"
                @click="handleReadSection('download-requirements', DOWNLOAD_SECTIONS.requirements.title, DOWNLOAD_SECTIONS.requirements.text, btnRefRequirements)"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Read section</span>
              </button>
            </div>
            <InlineSpeechPlayer
              v-if="isReadAloudEnabled"
              owner-id="download-requirements"
              :trigger-ref="btnRefRequirements"
            />
            <p class="section-lead">
              Device specifications and compatibility information for Android devices.
            </p>
          </div>

          <div class="requirements-card">
            <div class="table-scroll">
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
        </div>
      </section>

      <!-- SECTION 2: Download & platforms (#download) -->
      <section id="download" class="full-section section-bg-alt">
        <div class="page-container">
          <div class="section-header">
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
                  <span v-if="isLoading && !releaseData" class="status-subtle">Checking...</span>
                  <span v-else-if="errorType === 'network'" class="status-badge-pending">Connection error</span>
                  <span v-else-if="errorType" class="status-badge-pending">Configuration error</span>
                  <span v-else-if="isDownloadAvailable" class="status-badge-available">Available</span>
                  <span v-else-if="isDownloadEmpty" class="status-subtle">Not available yet</span>
                  <span v-else class="status-badge-pending">Awaiting confirmation</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Build version:</span>
                  <span :class="releaseData?.latest_build != null ? 'status-build-num' : 'status-subtle'">
                    {{ buildLabel }}
                  </span>
                </div>
                <p v-if="isLoading && !releaseData" class="status-hint">
                  Connecting to server to retrieve the latest build information...
                </p>
                <p v-else-if="errorType" class="status-hint status-hint-error">
                  {{ errorMessage }}
                </p>
                <p v-else-if="isDownloadAvailable && isGoogleDrive" class="status-hint">
                  The APK is hosted on Google Drive. Select "Get Android APK" to open the file page.
                </p>
                <p v-else-if="isDownloadAvailable" class="status-hint">
                  The direct APK package link is active.
                </p>
                <p v-else-if="isDownloadEmpty" class="status-hint">
                  Download not available yet.
                </p>
                <p v-else class="status-hint">
                  The direct APK package link will be activated once published.
                </p>
              </div>

              <div v-if="errorType" class="release-error-action">
                <button
                  type="button"
                  class="btn-retry"
                  :disabled="isLoading"
                  aria-label="Retry loading release information"
                  @click="fetchRelease"
                >
                  <AppIcon name="refresh" :size="15" :class="{ 'spin-icon': isLoading }" />
                  <span>Retry loading release</span>
                </button>
              </div>

              <div class="platform-actions">
                <!-- State 1: Loading -->
                <button
                  v-if="isLoading"
                  type="button"
                  class="btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  <AppIcon name="refresh" :size="16" class="spin-icon" />
                  <span>Loading release...</span>
                </button>

                <!-- State 2: Valid HTTPS download URL -->
                <template v-else-if="isDownloadAvailable">
                  <a
                    :href="releaseData.download_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary"
                    aria-label="Get Android APK (opens in a new tab)"
                  >
                    <AppIcon name="download" :size="16" />
                    <span>Get Android APK</span>
                    <span class="sr-only">(opens in a new tab)</span>
                  </a>
                  <p v-if="isGoogleDrive" class="destination-note">
                    Opens Google Drive
                  </p>
                </template>

                <!-- State 3: Download not available yet (empty URL) -->
                <template v-else-if="isDownloadEmpty">
                  <button
                    type="button"
                    class="btn-disabled"
                    disabled
                    aria-disabled="true"
                  >
                    Download not available yet
                  </button>
                </template>

                <!-- State 4: Error or Invalid URL / Self-loop -->
                <template v-else>
                  <button
                    type="button"
                    class="btn-disabled"
                    disabled
                    aria-disabled="true"
                  >
                    Download unavailable
                  </button>
                </template>
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
            <div class="header-with-action">
              <h3 class="guide-title" style="margin-bottom: 0;">How to install during the beta:</h3>
              <button
                v-if="isReadAloudEnabled"
                ref="btnRefInstall"
                type="button"
                class="btn-read-section"
                aria-label="Read installation guide aloud"
                @click="handleReadSection('download-install', DOWNLOAD_SECTIONS.install.title, DOWNLOAD_SECTIONS.install.text, btnRefInstall)"
              >
                <AppIcon name="volume-2" :size="16" />
                <span>Read section</span>
              </button>
            </div>
            <InlineSpeechPlayer
              v-if="isReadAloudEnabled"
              owner-id="download-install"
              :trigger-ref="btnRefInstall"
            />
            <ol class="guide-steps" style="margin-top: 1.25rem;">
              <li>
                <strong>Download package:</strong> Open the download link to access the APK file on Google Drive or the external release host, then download it to your device.
              </li>
              <li>
                <strong>Allow installation:</strong> If prompted by Android, enable "Install unknown apps" for your browser or file manager in system settings.
              </li>
              <li>
                <strong>Install application:</strong> Tap the downloaded APK file in your notifications or downloads folder and select <strong>Install</strong>.
              </li>
              <li>
                <strong>Sign in and play:</strong> Launch CyberMorph, sign in with your player account, and start exploring missions offline.
              </li>
            </ol>
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
  color: var(--color-text-main);
}

.download-main {
  flex: 1;
}

.page-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

@media (max-width: 640px) {
  .page-container {
    padding: 0 1rem;
  }
}

@media (min-width: 1600px) {
  .page-container {
    max-width: 1320px;
  }
}

@media (min-width: 2000px) {
  .page-container {
    max-width: 1440px;
  }
}

/* Hero & Local Navigation */
.download-hero {
  padding: 3.5rem 0 2.5rem;
  background: linear-gradient(180deg, var(--color-violet-subtle) 0%, transparent 100%);
  border-bottom: 1px solid var(--color-border);
}

.badge-subtle {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  margin-bottom: 1rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
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
  background-color: var(--color-card);
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
  background-color: var(--color-bg-alt, #f8fafc);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.section-header {
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
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
  background-color: var(--color-card);
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
  background-color: var(--color-bg-subtle);
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
  color: var(--color-text-main);
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
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
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
  color: var(--color-text-main);
}

.status-badge-pending {
  font-size: 0.725rem;
  font-weight: 700;
  color: var(--color-warning);
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.status-badge-available {
  font-size: 0.725rem;
  font-weight: 700;
  color: var(--color-success);
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.status-subtle {
  font-size: 0.775rem;
  color: var(--color-text-muted);
}

.status-build-num {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text-main);
  font-family: var(--font-mono, monospace);
}

.status-hint {
  font-size: 0.775rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.status-hint-error {
  color: var(--color-danger);
}

.release-error-action {
  margin-bottom: 1rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 1rem;
  min-height: 44px;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.btn-retry:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.destination-note {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0.15rem 0 0 0;
  font-weight: 500;
}

.disabled-status-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
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
  width: 100%;
  padding: 0.65rem 1rem;
  min-height: 44px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background: var(--btn-gradient);
  background-color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--btn-gradient-hover);
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-disabled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 1rem;
  min-height: 44px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-dim);
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: not-allowed;
  opacity: 0.85;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Install Guide Panel */
.install-guide-panel {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
}

.guide-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-main);
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
  color: var(--color-text-main);
}

/* Requirements Section */
.requirements-card {
  background-color: var(--color-card);
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
  color: var(--color-text-main);
}

.requirements-table td {
  color: var(--color-text-muted);
  line-height: 1.55;
}

.text-pending {
  font-style: italic;
  color: var(--color-warning);
}

.header-with-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
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
