<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="public-footer">
    <div class="footer-container">
      <div class="footer-main">
        <div class="footer-brand">
          <RouterLink to="/" class="brand-link">
            <span class="brand-name">CYBERMORPH</span>
          </RouterLink>
          <p class="brand-tagline">
            An offline-first educational cybersecurity game for Android. Practice practical digital defense through realistic simulation scenarios.
          </p>
          <p class="brand-disclaimer">
            Companion web portal for player accounts and optional classroom progress tracking.
          </p>
        </div>

        <div class="footer-nav-groups">
          <div class="footer-nav-column">
            <h4 class="column-heading">Navigation</h4>
            <ul class="nav-links">
              <li><RouterLink to="/" class="footer-link">Home</RouterLink></li>
              <li><RouterLink to="/about" class="footer-link">About</RouterLink></li>
              <li><RouterLink to="/gameplay" class="footer-link">Gameplay</RouterLink></li>
              <li><RouterLink to="/download" class="footer-link">Download</RouterLink></li>
              <li><RouterLink to="/download#requirements" class="footer-link">System requirements</RouterLink></li>
            </ul>
          </div>

          <div class="footer-nav-column">
            <h4 class="column-heading">Portal & Accounts</h4>
            <ul class="nav-links">
              <li><RouterLink to="/login" class="footer-link">Sign in</RouterLink></li>
              <li><RouterLink to="/register" class="footer-link">Create account</RouterLink></li>
              <li><RouterLink to="/about#classrooms" class="footer-link">Classroom features</RouterLink></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p class="copyright-text">
          &copy; 2026 CyberMorph Educational Project &bull; Developed for cybersecurity education
        </p>
        <p class="platform-note">
          Android APK required for offline gameplay &bull; Web browser used for portal accounts
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  background-color: #ffffff;
  border-top: 1px solid var(--color-border);
  padding: 3rem 1.5rem 2rem;
  margin-top: auto;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  padding-bottom: 2.5rem;
  border-bottom: 1px solid var(--color-border);
}

@media (min-width: 768px) {
  .footer-main {
    grid-template-columns: 1.5fr 1fr;
  }
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 500px;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-family: var(--font-brand);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-primary);
}

.brand-name {
  color: var(--color-primary);
}

.brand-tagline {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.brand-disclaimer {
  font-size: 0.8rem;
  line-height: 1.5;
  color: #64748b;
}

.footer-nav-groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.column-heading {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
  margin-bottom: 0.875rem;
}

.nav-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.footer-link {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-link:hover {
  color: var(--color-purple);
}

.footer-bottom {
  padding-top: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

@media (min-width: 640px) {
  .footer-bottom {
    flex-direction: row;
    align-items: center;
  }
}

.platform-note {
  color: #64748b;
}
</style>
