<script setup>
import { RouterLink } from 'vue-router'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'
import AppIcon from '../components/common/AppIcon.vue'

import homeImg from '../assets/maps/home.png'
import officeImg from '../assets/maps/office.png'
import internetCafeImg from '../assets/maps/internet-cafe.png'
import publicParkImg from '../assets/maps/public-park.png'

const environments = [
  {
    name: 'Home',
    image: homeImg,
    setting: 'Personal Residence',
    description: 'Learn to protect personal home networks, avoid deceptive delivery notifications, and identify email phishing links targeting personal accounts.',
    focusAreas: [
      'Personal email phishing verification',
      'Suspicious package delivery messages',
      'Securing home Wi-Fi and router settings',
    ],
  },
  {
    name: 'Office',
    image: officeImg,
    setting: 'Corporate Workplace',
    description: 'Practice workstation security hygiene, recognise fake urgent executive requests, and stop physical shoulder-surfing and tailgating attempts.',
    focusAreas: [
      'CEO fraud & urgent wire transfer requests',
      'Locking unattended computer screens',
      'Verifying external visitor badges and access',
    ],
  },
  {
    name: 'Internet Cafe',
    image: internetCafeImg,
    setting: 'Shared Public Terminals',
    description: 'Master defense strategies on shared public computers, ensuring credentials are not cached and private sessions are completely terminated.',
    focusAreas: [
      'Clearing browser history and saved passwords',
      'Recognising keylogger risks on untrusted PCs',
      'Two-factor authentication on shared machines',
    ],
  },
  {
    name: 'Public Park',
    image: publicParkImg,
    setting: 'Open Public Space',
    description: 'Navigate the dangers of unencrypted open wireless hotspots and spot rogue access points set up to intercept mobile internet traffic.',
    focusAreas: [
      'Differentiating authentic hotspots from rogue portals',
      'Safeguarding sensitive transactions on public networks',
      'Preventing shoulder-surfing in open areas',
    ],
  },
]

const learningTopics = [
  {
    number: '01',
    name: 'Phishing',
    summary: 'Deceptive email messages and fraudulent login pages designed to trick people into surrendering usernames and passwords.',
  },
  {
    number: '02',
    name: 'Smishing',
    summary: 'SMS-based text message scams using fake package delivery notices or urgent account suspensions to induce clicks.',
  },
  {
    number: '03',
    name: 'Vishing',
    summary: 'Voice calls where attackers impersonate bank agents, technical support personnel, or government agencies.',
  },
  {
    number: '04',
    name: 'Social Engineering',
    summary: 'Psychological manipulation techniques that exploit urgency, trust, or authority to bypass security procedures.',
  },
  {
    number: '05',
    name: 'Credential Theft',
    summary: 'Attacks targeting login credentials, including password reuse, keylogging, and weak password choices.',
  },
  {
    number: '06',
    name: 'Public Wi-Fi Attacks',
    summary: 'Rogue access points, "evil twin" networks, and packet interception on unencrypted public Wi-Fi connections.',
  },
  {
    number: '07',
    name: 'Malware Infection',
    summary: 'Dangerous email attachments, malicious installers, and compromised download links that deploy harmful software.',
  },
  {
    number: '08',
    name: 'Ransomware',
    summary: 'Malicious programs that lock or encrypt files, along with essential backup strategies and defensive habits.',
  },
]
</script>

<template>
  <div class="gameplay-page">
    <PublicHeader />

    <main class="gameplay-main">
      <!-- Hero -->
      <section class="gameplay-hero">
        <div class="page-container">
          <span class="badge-subtle">Game Experience</span>
          <h1 class="page-title">Gameplay & Simulation Environments</h1>
          <p class="page-lead">
            CyberMorph combines top-down pixel exploration with real-world security decision scenarios. Explore four everyday maps and practice defending against eight core threat types.
          </p>
        </div>
      </section>

      <!-- Section: Simulation Maps -->
      <section class="content-section">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Interactive Environments</span>
            <h2 class="section-title">Four realistic simulation maps</h2>
            <p class="section-lead">
              Each map represents a familiar real-world setting where players encounter security challenges specific to that environment.
            </p>
          </div>

          <div class="environments-grid">
            <article
              v-for="env in environments"
              :key="env.name"
              class="environment-card"
            >
              <div class="env-image-container">
                <img
                  :src="env.image"
                  :alt="`CyberMorph gameplay screenshot of ${env.name}`"
                  class="env-image"
                  loading="lazy"
                />
                <span class="env-setting-badge">{{ env.setting }}</span>
              </div>

              <div class="env-content">
                <h3 class="env-name">{{ env.name }}</h3>
                <p class="env-description">{{ env.description }}</p>

                <div class="env-focus-box">
                  <h4 class="focus-title">Practical learning points:</h4>
                  <ul class="focus-list">
                    <li v-for="point in env.focusAreas" :key="point">{{ point }}</li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- Section: 8 Learning Topics -->
      <section class="content-section section-bg-alt">
        <div class="page-container">
          <div class="section-header">
            <span class="section-kicker">Curriculum Coverage</span>
            <h2 class="section-title">The eight learning topics</h2>
            <p class="section-lead">
              The game curriculum systematically covers the eight most common digital threats encountered by everyday users.
            </p>
          </div>

          <div class="topics-grid">
            <div
              v-for="topic in learningTopics"
              :key="topic.number"
              class="topic-card"
            >
              <div class="topic-header">
                <span class="topic-number">{{ topic.number }}</span>
                <h3 class="topic-name">{{ topic.name }}</h3>
              </div>
              <p class="topic-summary">{{ topic.summary }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Download Banner -->
      <section class="content-section">
        <div class="page-container">
          <div class="download-cta-box">
            <div class="cta-text">
              <h2 class="cta-title">Install the game on your Android device</h2>
              <p class="cta-subtitle">
                The game is currently available for Android devices as an APK package. Download the game to start exploring the maps.
              </p>
            </div>
            <div class="cta-actions">
              <RouterLink to="/download" class="btn-primary">
                <AppIcon name="download" :size="18" />
                <span>Go to Download Page</span>
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
.gameplay-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.gameplay-main {
  flex: 1;
}

.page-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.gameplay-hero {
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

.environments-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .environments-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.environment-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.env-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #0f172a;
  overflow: hidden;
}

.env-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.env-setting-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background-color: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.env-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.env-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.env-description {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.env-focus-box {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.focus-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.focus-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.focus-list li {
  position: relative;
  padding-left: 1.25rem;
  font-size: 0.825rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.focus-list li::before {
  content: '•';
  position: absolute;
  left: 0.25rem;
  color: var(--color-purple);
  font-weight: 700;
}

.topics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

@media (min-width: 640px) {
  .topics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .topics-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.topic-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.topic-header {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.topic-number {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-purple);
}

.topic-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.topic-summary {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}

.download-cta-box {
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
  .download-cta-box {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cta-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.35rem;
}

.cta-subtitle {
  font-size: 0.925rem;
  color: var(--color-text-muted);
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
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--btn-gradient-hover) !important;
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}
</style>
