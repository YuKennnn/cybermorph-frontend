<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { usePlayerClassroomStore } from '../stores/playerClassroomStore'
import AppIcon from './common/AppIcon.vue'
import LogoutModal from './common/LogoutModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const playerClassroomStore = usePlayerClassroomStore()

const isPlayerClassroomRoute = computed(
  () => route.path === '/classroom' || route.path === '/classroom/join',
)

const ensurePlayerMembershipLoaded = () => {
  if (authStore.isPlayer && authStore.token) {
    playerClassroomStore.loadMembership().catch(() => {})
  } else if (!authStore.token) {
    playerClassroomStore.reset()
  }
}

const handleRetryClassroomMembership = () => {
  if (playerClassroomStore.isLoading || playerClassroomStore.isRefreshing) return
  playerClassroomStore.loadMembership({ force: true }).catch(() => {})
}

const isMobileOpen = ref(false)
const mobileCloseBtnRef = ref(null)
const hamburgerBtnRef = ref(null)
const sidebarRef = ref(null)
const logoutBtnRef = ref(null)
const isLogoutModalOpen = ref(false)
const isLoggingOut = ref(false)
let previousActiveElement = null

const toggleMobileMenu = () => {
  isMobileOpen.value = !isMobileOpen.value
}

const closeMobileMenu = () => {
  isMobileOpen.value = false
}

const isElementVisible = (el) => {
  if (!el || !document.body.contains(el)) return false
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  )
}

const syncBodyOverflow = () => {
  if (typeof document !== 'undefined') {
    if (isMobileOpen.value || isLogoutModalOpen.value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
}

const trapFocus = (event) => {
  if (event.key !== 'Tab' || !sidebarRef.value || !isMobileOpen.value) return
  const focusables = sidebarRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === last) {
      first.focus()
      event.preventDefault()
    }
  }
}

const handleKeyDown = (event) => {
  // Only the topmost dialog handles focus trapping and Escape
  if (isLogoutModalOpen.value) return

  if (event.key === 'Escape' && isMobileOpen.value) {
    closeMobileMenu()
    return
  }
  trapFocus(event)
}

watch(
  isMobileOpen,
  (open) => {
    syncBodyOverflow()
    if (open) {
      previousActiveElement = document.activeElement
      nextTick(() => {
        mobileCloseBtnRef.value?.focus()
      })
    } else {
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === 'function' &&
        document.body.contains(previousActiveElement)
      ) {
        previousActiveElement.focus()
      } else {
        hamburgerBtnRef.value?.focus()
      }
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  ensurePlayerMembershipLoaded()
})

watch(
  () => [authStore.token, authStore.userRole, authStore.user?.user_id],
  () => {
    ensurePlayerMembershipLoaded()
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = ''
})

const handleLogoutClick = () => {
  isLogoutModalOpen.value = true
  syncBodyOverflow()
}

const handleLogoutCancelled = () => {
  isLogoutModalOpen.value = false
  syncBodyOverflow()
  nextTick(() => {
    // Restore focus to logout button if visible, otherwise to mobile menu control
    if (logoutBtnRef.value && isElementVisible(logoutBtnRef.value)) {
      logoutBtnRef.value.focus()
    } else {
      hamburgerBtnRef.value?.focus()
    }
  })
}

const handleLogoutConfirmed = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true

  try {
    isLogoutModalOpen.value = false
    closeMobileMenu()
    syncBodyOverflow()
    authStore.logout()
    await router.replace('/login')
  } finally {
    isLoggingOut.value = false
  }
}

const formatRole = (role) => {
  if (!role) return 'User'
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}
</script>

<template>
  <div>
    <!-- Mobile Top Navigation Header -->
    <header class="mobile-header">
      <div class="brand-logo font-brand">
        <span class="logo-text">CYBERMORPH</span>
      </div>
      <button
        ref="hamburgerBtnRef"
        class="hamburger-btn"
        :aria-expanded="isMobileOpen"
        aria-label="Toggle navigation menu"
        @click="toggleMobileMenu"
      >
        <AppIcon name="menu" :size="22" />
      </button>
    </header>

    <!-- Mobile Backdrop Overlay -->
    <div
      v-if="isMobileOpen"
      class="mobile-backdrop"
      aria-hidden="true"
      @click="closeMobileMenu"
    ></div>

    <!-- Sidebar Aside Navigation -->
    <aside
      ref="sidebarRef"
      :class="['sidebar-nav', { 'mobile-open': isMobileOpen }]"
      aria-label="Sidebar navigation"
    >
      <div class="sidebar-header">
        <div class="brand-logo font-brand">
          <span class="logo-text">CYBERMORPH</span>
        </div>
        <button
          ref="mobileCloseBtnRef"
          class="mobile-close-btn"
          aria-label="Close navigation menu"
          @click="closeMobileMenu"
        >
          <AppIcon name="x" :size="20" />
        </button>
      </div>

      <!-- User Profile Snippet -->
      <div class="user-profile-card">
        <div class="user-avatar" aria-hidden="true">
          {{ authStore.displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="user-details">
          <span class="user-name" :title="authStore.displayName">{{ authStore.displayName }}</span>
          <span v-if="authStore.userRole" :class="['role-pill', authStore.userRole]">
            {{ formatRole(authStore.userRole) }}
          </span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="nav-menu" aria-label="Main menu">
        <div class="nav-group-label">Navigation</div>

        <router-link to="/dashboard" class="nav-item" @click="closeMobileMenu">
          <AppIcon name="dashboard" :size="18" class="nav-icon" />
          <span class="nav-label">Overview</span>
        </router-link>

        <router-link to="/leaderboard" class="nav-item" @click="closeMobileMenu">
          <AppIcon name="leaderboard" :size="18" class="nav-icon" />
          <span class="nav-label">Leaderboard</span>
        </router-link>

        <!-- Player Specific Links -->
        <router-link
          v-if="authStore.isPlayer"
          to="/threat-index"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <AppIcon name="shield" :size="18" class="nav-icon" />
          <span class="nav-label">Threat index</span>
        </router-link>

        <div v-if="authStore.isPlayer" class="nav-item-group">
          <router-link
            :to="playerClassroomStore.navRoute"
            :class="['nav-item', { 'router-link-active': isPlayerClassroomRoute }]"
            @click="closeMobileMenu"
          >
            <AppIcon
              :name="playerClassroomStore.isUnenrolled ? 'join' : 'classrooms'"
              :size="18"
              class="nav-icon"
            />
            <span class="nav-label">{{ playerClassroomStore.navLabel }}</span>
          </router-link>
          <button
            v-if="playerClassroomStore.status === 'error'"
            type="button"
            class="nav-retry-btn"
            :disabled="playerClassroomStore.isLoading || playerClassroomStore.isRefreshing"
            aria-label="Retry loading classroom membership"
            title="Retry loading classroom membership"
            @click="handleRetryClassroomMembership"
          >
            <AppIcon name="refresh" :size="14" />
            <span>Retry</span>
          </button>
        </div>

        <!-- Educator Specific Links -->
        <router-link
          v-if="authStore.isEducator"
          to="/classroom/manage"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <AppIcon name="classrooms" :size="18" class="nav-icon" />
          <span class="nav-label">Classrooms</span>
        </router-link>

        <router-link
          v-if="authStore.isEducator"
          to="/analytics"
          class="nav-item"
          @click="closeMobileMenu"
        >
          <AppIcon name="analytics" :size="18" class="nav-icon" />
          <span class="nav-label">Classroom analytics</span>
        </router-link>

        <!-- Admin Specific Links -->
        <router-link
          v-if="authStore.isAdmin"
          to="/admin/users"
          class="nav-item"
          :class="{
            'router-link-active':
              $route.path.startsWith('/admin/users') || $route.path.startsWith('/admin/approvals'),
          }"
          @click="closeMobileMenu"
        >
          <AppIcon name="users" :size="18" class="nav-icon" />
          <span class="nav-label">Users</span>
        </router-link>

        <router-link
          v-if="authStore.isAdmin"
          to="/admin/classrooms"
          class="nav-item"
          :class="{ 'router-link-active': $route.path.startsWith('/admin/classrooms') }"
          @click="closeMobileMenu"
        >
          <AppIcon name="classrooms" :size="18" class="nav-icon" />
          <span class="nav-label">Classrooms</span>
        </router-link>

        <!-- Settings Link -->
        <router-link to="/settings" class="nav-item" @click="closeMobileMenu">
          <AppIcon name="settings" :size="18" class="nav-icon" />
          <span class="nav-label">Settings</span>
        </router-link>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button
          ref="logoutBtnRef"
          type="button"
          class="logout-btn"
          aria-label="Sign out of account"
          @click="handleLogoutClick"
        >
          <AppIcon name="logout" :size="18" class="logout-icon" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>

    <!-- Logout Confirmation Dialog -->
    <LogoutModal
      :is-open="isLogoutModalOpen"
      :is-logging-out="isLoggingOut"
      @close="handleLogoutCancelled"
      @confirm="handleLogoutConfirmed"
    />
  </div>
</template>

<style scoped>
/* Mobile Top Header */
.mobile-header {
  display: none;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background-color: var(--color-card);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.hamburger-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: var(--color-text-main);
  min-width: 44px;
  min-height: 44px;
  transition: background-color 0.15s ease;
}

.hamburger-btn:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
}

.mobile-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(2px);
  z-index: 140;
}

/* Sidebar Styling */
.sidebar-nav {
  width: 250px;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background-color: var(--color-card);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 3px rgba(15, 23, 42, 0.04);
  z-index: 150;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  padding: 1.25rem 1.25rem 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border-subtle);
}

.brand-logo {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.03em;
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
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
}

.mobile-close-btn:hover {
  color: var(--color-text-main);
  background-color: var(--color-bg-subtle);
}

/* User Profile Snippet */
.user-profile-card {
  margin: 1rem;
  padding: 0.75rem 0.85rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--btn-gradient);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.user-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-pill {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-primary);
  letter-spacing: 0.01em;
  margin-top: 0.1rem;
}

/* Navigation Links */
.nav-menu {
  flex: 1;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.nav-group-label {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.5rem 0.65rem 0.25rem 0.65rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.85rem;
  min-height: 40px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}

.nav-icon {
  color: var(--color-text-dim);
  transition: color 0.15s ease;
}

.nav-item:hover {
  background-color: var(--color-bg);
  color: var(--color-text-main);
}

.nav-item:hover .nav-icon {
  color: var(--color-primary);
}

.nav-item.router-link-active {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  font-weight: 600;
  border-left-color: var(--color-primary);
}

.nav-item.router-link-active .nav-icon {
  color: var(--color-primary);
}

.nav-label {
  letter-spacing: 0.01em;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--color-border-subtle);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  min-height: 40px;
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.logout-icon {
  color: var(--color-text-muted);
  transition: color 0.15s ease;
}

.logout-btn:hover {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.logout-btn:hover .logout-icon {
  color: var(--color-danger);
}

.logout-btn:active {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger);
  transform: scale(0.99);
}

.logout-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.nav-item-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-retry-btn {
  align-self: flex-start;
  margin-left: 2.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-retry-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.nav-retry-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.nav-retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive Breakpoints */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .mobile-close-btn {
    display: flex;
  }

  .sidebar-nav {
    transform: translateX(-100%);
  }

  .sidebar-nav.mobile-open {
    transform: translateX(0);
  }
}
</style>
