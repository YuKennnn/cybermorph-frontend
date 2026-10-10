<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/authStore'
import AppIcon from './AppIcon.vue'

const authStore = useAuthStore()
const isMobileNavOpen = ref(false)

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value
}

const closeMobileNav = () => {
  isMobileNavOpen.value = false
}
</script>

<template>
  <header class="public-nav-bar">
    <div class="nav-container">
      <RouterLink to="/" class="brand-link" @click="closeMobileNav">
        <span class="brand-name">CYBERMORPH</span>
      </RouterLink>

      <!-- Desktop Navigation Links -->
      <nav class="desktop-nav" aria-label="Main Navigation">
        <RouterLink to="/" class="nav-link" exact-active-class="active">Home</RouterLink>
        <RouterLink to="/about" class="nav-link" active-class="active">About</RouterLink>
        <RouterLink to="/gameplay" class="nav-link" active-class="active">Gameplay</RouterLink>
        <RouterLink to="/download" class="nav-link" active-class="active">Download</RouterLink>
      </nav>

      <!-- Auth Action Link -->
      <div class="nav-auth">
        <RouterLink
          v-if="authStore.isAuthenticated"
          to="/dashboard"
          class="btn-nav-primary"
        >
          Dashboard
        </RouterLink>
        <template v-else>
          <RouterLink
            to="/login"
            class="btn-nav-secondary"
          >
            Sign in
          </RouterLink>
          <RouterLink
            to="/register"
            class="btn-nav-primary"
          >
            Register
          </RouterLink>
        </template>

        <!-- Mobile Hamburger Toggle -->
        <button
          type="button"
          class="mobile-menu-toggle"
          :aria-expanded="isMobileNavOpen"
          aria-label="Toggle navigation menu"
          @click="toggleMobileNav"
        >
          <AppIcon :name="isMobileNavOpen ? 'x' : 'menu'" :size="20" />
        </button>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    <div
      v-if="isMobileNavOpen"
      class="mobile-drawer-backdrop"
      @click="closeMobileNav"
    >
      <div class="mobile-drawer" @click.stop>
        <div class="mobile-drawer-header">
          <RouterLink to="/" class="brand-link" @click="closeMobileNav">
            <span class="brand-name">CYBERMORPH</span>
          </RouterLink>
          <button
            type="button"
            class="mobile-close-btn"
            aria-label="Close menu"
            @click="closeMobileNav"
          >
            <AppIcon name="x" :size="20" />
          </button>
        </div>

        <nav class="mobile-nav-links" aria-label="Mobile Navigation">
          <RouterLink to="/" class="mobile-nav-link" exact-active-class="active" @click="closeMobileNav">
            Home
          </RouterLink>
          <RouterLink to="/about" class="mobile-nav-link" active-class="active" @click="closeMobileNav">
            About
          </RouterLink>
          <RouterLink to="/gameplay" class="mobile-nav-link" active-class="active" @click="closeMobileNav">
            Gameplay
          </RouterLink>
          <RouterLink to="/download" class="mobile-nav-link" active-class="active" @click="closeMobileNav">
            Download
          </RouterLink>
        </nav>

        <div class="mobile-drawer-footer">
          <RouterLink
            v-if="authStore.isAuthenticated"
            to="/dashboard"
            class="btn-mobile-auth btn-mobile-primary"
            @click="closeMobileNav"
          >
            Go to Dashboard
          </RouterLink>
          <template v-else>
            <RouterLink
              to="/login"
              class="btn-mobile-auth btn-mobile-secondary"
              @click="closeMobileNav"
            >
              Sign in
            </RouterLink>
            <RouterLink
              to="/register"
              class="btn-mobile-auth btn-mobile-primary"
              @click="closeMobileNav"
            >
              Register
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.public-nav-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.875rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-family: var(--font-brand);
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  transition: opacity 0.15s ease;
}

.brand-link:hover {
  opacity: 0.85;
}

.brand-name {
  color: var(--color-primary);
}

.desktop-nav {
  display: none;
  align-items: center;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .desktop-nav {
    display: flex;
  }
}

.nav-link {
  background: none;
  border: none;
  padding: 0.5rem 0.875rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-link:hover {
  color: var(--color-text);
  background-color: var(--color-bg-alt);
}

.nav-link.active {
  color: var(--color-purple);
  font-weight: 600;
  background-color: var(--color-purple-light);
}

.nav-auth {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-nav-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.125rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--color-purple);
  border: 1px solid var(--color-purple);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-nav-primary:hover {
  background-color: var(--color-purple-hover);
  border-color: var(--color-purple-hover);
}

.btn-nav-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-purple);
  background-color: var(--color-purple-light);
  border: 1px solid rgba(109, 40, 217, 0.2);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-nav-secondary:hover {
  background-color: rgba(109, 40, 217, 0.15);
  border-color: var(--color-purple);
}

.mobile-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  cursor: pointer;
}

@media (min-width: 768px) {
  .mobile-menu-toggle {
    display: none;
  }
}

/* Mobile Drawer */
.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

.mobile-drawer {
  width: 290px;
  height: 100%;
  background-color: #ffffff;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.mobile-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.mobile-close-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem;
  cursor: pointer;
  color: var(--color-text-muted);
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.25rem 0;
  flex: 1;
}

.mobile-nav-link {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.75rem 0.875rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-nav-link:hover {
  background-color: var(--color-bg-alt);
}

.mobile-nav-link.active {
  color: var(--color-purple);
  font-weight: 600;
  background-color: var(--color-purple-light);
}

.mobile-drawer-footer {
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.btn-mobile-auth {
  display: block;
  width: 100%;
  text-align: center;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.btn-mobile-primary {
  color: #ffffff;
  background-color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-mobile-primary:hover {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-mobile-secondary {
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
}

.btn-mobile-secondary:hover {
  background-color: #ede9fe;
}
</style>
