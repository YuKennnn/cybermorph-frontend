<script setup>
import { computed } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import SidebarNav from './components/SidebarNav.vue'
import AccessibilityModal from './components/common/AccessibilityModal.vue'

const route = useRoute()
const authStore = useAuthStore()

const isPublicLayout = computed(() => {
  if (route.name === 'not-found') {
    return !authStore.isAuthenticated
  }
  if (route.name === 'leaderboard') {
    return !authStore.token
  }
  return (
    !!route.meta?.isPublic ||
    route.path === '/' ||
    route.name === 'landing' ||
    route.name === 'about' ||
    route.name === 'gameplay' ||
    route.name === 'download' ||
    route.name === 'faq' ||
    route.name === 'login' ||
    route.name === 'register'
  )
})

const showSidebar = computed(() => {
  return !!authStore.token && !isPublicLayout.value
})
</script>

<template>
  <div class="app-layout">
    <SidebarNav v-if="showSidebar && !authStore.isSessionReconciling" />
    <component
      :is="isPublicLayout ? 'div' : 'main'"
      :class="[
        'main-content',
        {
          'with-sidebar': showSidebar && !authStore.isSessionReconciling,
          'landing-mode': isPublicLayout,
        },
      ]"
    >
      <div :class="['content-wrapper', { 'full-width': isPublicLayout }]">
        <!-- Protected Render Gate: Neutral shell while reconciling stored session -->
        <div
          v-if="!isPublicLayout && authStore.token && authStore.isSessionReconciling"
          class="session-reconcile-gate"
          role="status"
          aria-live="polite"
        >
          <div v-if="authStore.verificationError" class="reconcile-error-box">
            <p class="reconcile-error-text">{{ authStore.verificationError }}</p>
            <button
              type="button"
              class="btn-subtle reconcile-retry-btn"
              @click="authStore.retryStartupVerification"
            >
              Retry verification
            </button>
          </div>
          <div v-else class="reconcile-loading-box">
            <div class="gate-spinner" aria-hidden="true"></div>
            <p class="gate-text">Verifying session...</p>
          </div>
        </div>
        <RouterView v-else />
      </div>
    </component>

    <!-- Public Accessibility Preferences Modal -->
    <template v-if="isPublicLayout">
      <AccessibilityModal />
    </template>
  </div>
</template>

<style scoped>
.session-reconcile-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  width: 100%;
}

.reconcile-loading-box,
.reconcile-error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  border-radius: var(--radius-md, 8px);
  background: var(--color-card, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
}

.gate-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border, #e2e8f0);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.gate-text,
.reconcile-error-text {
  font-size: 0.95rem;
  color: var(--color-text-muted, #64748b);
  margin: 0;
}

.reconcile-retry-btn {
  padding: 0.4rem 0.9rem;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
}

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  width: 100%;
  transition: padding-left 0.3s ease;
}

.main-content.with-sidebar {
  padding-left: 250px;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

.content-wrapper.full-width {
  max-width: 100%;
  padding: 0;
}

@media (min-width: 1600px) {
  .content-wrapper {
    max-width: 1360px;
    padding: 2.5rem 2rem;
  }
}

@media (min-width: 2000px) {
  .content-wrapper {
    max-width: 1480px;
    padding: 3rem 2.5rem;
  }
}

@media (max-width: 768px) {
  .main-content.with-sidebar {
    padding-left: 0;
  }

  .content-wrapper {
    padding: 1.25rem 1rem;
  }

  .content-wrapper.full-width {
    padding: 0;
  }
}
</style>
