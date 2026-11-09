<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'

const DEFAULT_TITLE = 'CyberMorph | Cybersecurity Portal'
const PAGE_TITLE = '404 — Page not found | CyberMorph'

const authStore = useAuthStore()

const destinationPath = computed(() => {
  return authStore.isAuthenticated ? '/dashboard' : '/'
})

const destinationLabel = computed(() => {
  return authStore.isAuthenticated ? 'Go to Dashboard' : 'Go to Home'
})

let previousTitle = ''

onMounted(() => {
  previousTitle =
    document.title && document.title !== PAGE_TITLE
      ? document.title
      : DEFAULT_TITLE
  document.title = PAGE_TITLE
})

onUnmounted(() => {
  if (document.title === PAGE_TITLE) {
    document.title = previousTitle || DEFAULT_TITLE
  }
})
</script>

<template>
  <div :class="['not-found-layout', { 'authenticated-layout': authStore.isAuthenticated }]">
    <PublicHeader v-if="!authStore.isAuthenticated" />

    <component
      :is="authStore.isAuthenticated ? 'div' : 'main'"
      class="not-found-content"
    >
      <div class="not-found-card">
        <span class="status-code" aria-hidden="true">404</span>
        <h1 class="not-found-title">404 — Page not found</h1>
        <p class="not-found-text">
          The page you requested could not be found. It may have been moved, deleted, or the address may be incorrect.
        </p>

        <div class="not-found-actions">
          <RouterLink
            :to="destinationPath"
            class="btn-primary not-found-btn"
          >
            {{ destinationLabel }}
          </RouterLink>
          <RouterLink
            to="/leaderboard"
            class="btn-outline not-found-btn"
          >
            View Leaderboard
          </RouterLink>
        </div>
      </div>
    </component>

    <PublicFooter v-if="!authStore.isAuthenticated" />
  </div>
</template>

<style scoped>
.not-found-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-bg);
}

.not-found-layout.authenticated-layout {
  min-height: auto;
  background-color: transparent;
}

.not-found-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

.not-found-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  padding: 3rem 2.5rem;
  max-width: 520px;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

.status-code {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-primary);
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.not-found-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin: 0 0 0.875rem 0;
  line-height: 1.3;
}

.not-found-text {
  font-family: var(--font-sans);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 0 2rem 0;
}

.not-found-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.not-found-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  min-height: 44px;
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.btn-outline {
  padding: 0.55rem 1.15rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
}

.btn-outline:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

@media (max-width: 480px) {
  .not-found-content {
    padding: 2rem 1rem;
  }

  .not-found-card {
    padding: 2rem 1.25rem;
  }

  .status-code {
    font-size: 2.75rem;
  }

  .not-found-title {
    font-size: 1.25rem;
  }

  .not-found-actions {
    flex-direction: column;
  }

  .not-found-btn {
    width: 100%;
    min-height: 44px;
  }
}
</style>
