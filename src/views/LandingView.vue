<script setup>
const scrollToSection = (id) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

const maps = [
  {
    name: 'Home Network',
    emoji: '🏠',
    description: 'Defend your personal network and smart IoT devices from basic threats.',
    unlocked: true,
  },
  {
    name: 'Corporate Office',
    emoji: '🏢',
    description: 'Secure corporate infrastructure and employee workstations against phishing.',
    unlocked: true,
  },
  {
    name: 'Internet Cafe',
    emoji: '☕',
    description: 'Protect public workstations from eavesdropping and Wi-Fi hijack attacks.',
    unlocked: false,
  },
  {
    name: 'Public Park',
    emoji: '🌳',
    description: 'Master advanced threat detection and social engineering in open spaces.',
    unlocked: false,
  },
]

const threats = [
  {
    name: 'Phishing',
    emoji: '🎣',
    description: 'Deceptive emails and messages designed to steal credentials and data.',
  },
  {
    name: 'Smishing',
    emoji: '📱',
    description: 'SMS-based phishing attacks targeting mobile devices and OTP tokens.',
  },
  {
    name: 'Vishing',
    emoji: '📞',
    description: 'Voice phishing — attackers impersonate trusted entities to extract secrets.',
  },
  {
    name: 'Social Engineering',
    emoji: '🧠',
    description: 'Psychological manipulation to exploit human cognitive vulnerabilities.',
  },
  {
    name: 'Credential Theft',
    emoji: '🔑',
    description: 'Weak password attacks, credential harvesting, and brute force techniques.',
  },
  {
    name: 'Public Wi-Fi Attack',
    emoji: '📶',
    description: 'Man-in-the-middle packet sniffing and rogue access point spoofing.',
  },
  {
    name: 'Malware Infection',
    emoji: '💀',
    description: 'Malicious payloads and trojans that compromise system integrity.',
  },
  {
    name: 'Ransomware',
    emoji: '💰',
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
          <span class="logo-bracket">[</span>
          <span class="logo-text">CYBERMORPH</span>
          <span class="logo-bracket">]</span>
        </div>

        <nav class="nav-links">
          <button class="nav-anchor" @click="scrollToSection('features')">Features</button>
          <button class="nav-anchor" @click="scrollToSection('maps')">Maps</button>
          <button class="nav-anchor" @click="scrollToSection('threats')">Threats</button>
        </nav>

        <div class="header-auth-actions">
          <router-link to="/login" class="btn-signin">Login</router-link>
          <router-link to="/register" class="btn-signup">Register</router-link>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
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
          <router-link to="/register" class="btn-hero-primary">Get Started</router-link>
          <button class="btn-hero-secondary" @click="scrollToSection('features')">
            Learn More ↓
          </button>
        </div>
      </div>
    </section>

    <!-- Features / How It Works Section -->
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
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <span class="feature-icon">🎮</span>
            </div>
            <h3>Play</h3>
            <p>
              Engage in 2D simulation missions navigating real-world scenarios and hands-on defense
              puzzles.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <span class="feature-icon">🛡️</span>
            </div>
            <h3>Learn</h3>
            <p>
              Master 8 critical cyber threats including social engineering, credential harvesting,
              and ransomware.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <span class="feature-icon">📈</span>
            </div>
            <h3>Track</h3>
            <p>
              Monitor progress, earn high scores on the global leaderboard, and sync classroom
              telemetry.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4 Maps Section -->
    <section id="maps" class="maps-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-tag">SIMULATION SECTORS</span>
          <h2 class="section-title">Explore the CyberMorph World</h2>
          <p class="section-subtitle">
            Battle cyber adversaries across dynamic environments with escalating difficulty
            levels.
          </p>
        </div>

        <div class="maps-grid">
          <div
            v-for="map in maps"
            :key="map.name"
            :class="['map-card', { locked: !map.unlocked }]"
          >
            <div class="map-emoji">{{ map.emoji }}</div>
            <div class="map-info">
              <div class="map-header">
                <h4>{{ map.name }}</h4>
                <span :class="['status-tag', map.unlocked ? 'unlocked' : 'locked']">
                  {{ map.unlocked ? '🔓 UNLOCKED' : '🔒 LOCKED' }}
                </span>
              </div>
              <p class="map-desc">{{ map.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8 Threats Section -->
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
          <div v-for="threat in threats" :key="threat.name" class="threat-card">
            <div class="threat-icon">{{ threat.emoji }}</div>
            <h4>{{ threat.name }}</h4>
            <p>{{ threat.description }}</p>
          </div>
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
  background-color: #ede9fe;
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

/* Hero Section */
.hero-section {
  padding: 5.5rem 1.5rem 4.5rem 1.5rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 10%, rgba(139, 92, 246, 0.12) 0%, transparent 70%);
}

.hero-content {
  max-width: 820px;
  margin: 0 auto;
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

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
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
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-hero-primary {
  padding: 0.85rem 2rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border-radius: 8px;
  text-decoration: none;
  font-family: var(--font-display);
  font-size: 1.05rem;
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
  padding: 0.85rem 1.75rem;
  background-color: #ffffff;
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.98rem;
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

/* Common Section Layout */
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

/* Features Section */
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

.feature-icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.25rem auto;
  background-color: #ffffff;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-purple-sm);
}

.feature-icon {
  font-size: 2rem;
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

/* Maps Section */
.maps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.map-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.2s ease;
}

.map-card:hover {
  box-shadow: var(--shadow-purple-hover);
  transform: translateY(-2px);
}

.map-card.locked {
  opacity: 0.85;
  background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);
}

.map-emoji {
  font-size: 2.75rem;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.map-header h4 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-text-main);
}

.status-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.status-tag.unlocked {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-tag.locked {
  background-color: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.map-desc {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
  margin: 0;
}

/* Threats Section */
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

.threat-card {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.threat-card:hover {
  background-color: #f1edff;
  border-color: var(--color-secondary);
  box-shadow: var(--shadow-purple-sm);
  transform: translateY(-2px);
}

.threat-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.threat-card h4 {
  margin: 0 0 0.35rem 0;
  font-size: 1.1rem;
  color: var(--color-text-main);
}

.threat-card p {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.45;
  margin: 0;
}

/* Footer */
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
  color: #94a3b8;
  font-size: 0.9rem;
  max-width: 380px;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.link-item {
  color: #cbd5e1;
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
  color: #64748b;
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
