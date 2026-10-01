<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const isMobileOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileOpen.value = !isMobileOpen.value
}

const closeMobileMenu = () => {
  isMobileOpen.value = false
}

const handleLogout = () => {
  closeMobileMenu()
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div>
    <!-- Mobile Top Navigation Header -->
    <header class="mobile-header">
      <div class="brand-logo">
        <span class="logo-bracket">[</span>
        <span class="logo-text">CYBERMORPH</span>
        <span class="logo-bracket">]</span>
      </div>
      <button class="hamburger-btn" aria-label="Toggle menu" @click="toggleMobileMenu">
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
      </button>
    </header>

    <!-- Mobile Backdrop Overlay -->
    <div
      v-if="isMobileOpen"
      class="mobile-backdrop"
      @click="closeMobileMenu"
    ></div>

    <!-- Sidebar Aside Navigation -->
    <aside :class="['sidebar-nav', { 'mobile-open': isMobileOpen }]">
      <div class="sidebar-header">
        <div class="brand-logo">
          <span class="logo-bracket">[</span>
          <span class="logo-text">CYBERMORPH</span>
          <span class="logo-bracket">]</span>
        </div>
        <button class="mobile-close-btn" @click="closeMobileMenu">✕</button>
      </div>

      <!-- User Profile Snippet -->
      <div class="user-profile-card">
        <div class="user-avatar">
          {{ authStore.displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="user-details">
          <span class="user-name">{{ authStore.displayName }}</span>
          <span v-if="authStore.userRole" :class="['role-pill', authStore.userRole]">
            {{ authStore.userRole }}
          </span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="nav-menu">
        <div class="nav-group-label">NAVIGATION</div>

        <router-link to="/dashboard" class="nav-item" @click="closeMobileMenu">
          <span class="nav-label">Dashboard</span>
        </router-link>

        <router-link to="/leaderboard" class="nav-item" @click="closeMobileMenu">
          <span class="nav-label">Leaderboard</span>
        </router-link>

        <!-- Player Specific Link -->
        <router-link
          v-if="authStore.isPlayer"
          to="/classroom/join"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <span class="nav-label">Join Classroom</span>
        </router-link>

        <!-- Educator Specific Links -->
        <router-link
          v-if="authStore.isEducator"
          to="/classroom/manage"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <span class="nav-label">Manage Classrooms</span>
        </router-link>

        <router-link
          v-if="authStore.isEducator"
          to="/analytics"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <span class="nav-label">Threat Analytics</span>
        </router-link>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button class="logout-btn" @click="handleLogout">
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Mobile Top Header */
.mobile-header {
  display: none;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background-color: #ffffff;
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-purple-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.hamburger-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
}

.hamburger-bar {
  width: 22px;
  height: 2.5px;
  background-color: var(--color-primary);
  border-radius: 2px;
}

.mobile-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(30, 27, 75, 0.4);
  backdrop-filter: blur(4px);
  z-index: 140;
}

/* Sidebar Styling */
.sidebar-nav {
  width: 250px;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background-color: #ffffff;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 16px rgba(124, 58, 237, 0.06);
  z-index: 150;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  padding: 1.5rem 1.25rem 1.25rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border-subtle);
}

.brand-logo {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.logo-bracket {
  color: var(--color-secondary);
}

.logo-text {
  color: var(--color-primary);
  margin: 0 0.15rem;
}

.mobile-close-btn {
  display: none;
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--color-text-dim);
  cursor: pointer;
}

/* User Profile Snippet */
.user-profile-card {
  margin: 1.25rem 1rem;
  padding: 0.85rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--btn-gradient);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.user-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-pill {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.15rem;
}

.role-pill.player {
  color: var(--color-primary);
}

.role-pill.educator {
  color: var(--color-primary);
}

.role-pill.admin {
  color: var(--color-secondary);
}

/* Navigation Links */
.nav-menu {
  flex: 1;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.nav-group-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  padding: 0 0.5rem 0.4rem 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.72rem 1rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 500;
  border-radius: 8px;
  border-left: 3.5px solid transparent;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
}

.nav-item.router-link-active {
  background-color: var(--color-bg-muted);
  color: var(--color-primary);
  font-weight: 700;
  border-left-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.08);
}

.nav-label {
  letter-spacing: 0.01em;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 1.25rem 1rem;
  border-top: 1px solid var(--color-border-subtle);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background-color: var(--color-danger-border);
  border-color: var(--color-danger);
}

/* Responsive Breakpoints */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .mobile-close-btn {
    display: block;
  }

  .sidebar-nav {
    transform: translateX(-100%);
  }

  .sidebar-nav.mobile-open {
    transform: translateX(0);
  }
}
</style>
