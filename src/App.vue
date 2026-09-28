<script setup>
import { computed } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import SidebarNav from './components/SidebarNav.vue'

const route = useRoute()
const authStore = useAuthStore()

const showSidebar = computed(() => {
  return (
    !!authStore.token &&
    route.name !== 'landing' &&
    route.name !== 'login' &&
    route.name !== 'register'
  )
})
</script>

<template>
  <div class="app-layout">
    <SidebarNav v-if="showSidebar" />
    <main
      :class="[
        'main-content',
        { 'with-sidebar': showSidebar, 'landing-mode': route.name === 'landing' },
      ]"
    >
      <div :class="['content-wrapper', { 'full-width': route.name === 'landing' }]">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style>
/* ==========================================
   CyberMorph Purple / White Design System
   ========================================== */
:root {
  --color-primary: #7c3aed;
  --color-primary-hover: #6d28d9;
  --color-secondary: #8b5cf6;
  --color-accent: #c084fc;

  --color-bg: #fafafa;
  --color-bg-subtle: #f5f3ff;
  --color-bg-muted: #ede9fe;
  --color-card: #ffffff;
  --color-card-hover: #faf8ff;

  --color-border: #e9d5ff;
  --color-border-subtle: #f3e8ff;

  --color-text-main: #1e1b4b;
  --color-text-muted: #6d6b7a;
  --color-text-dim: #94a3b8;

  --color-success: #059669;
  --color-success-bg: #ecfdf5;
  --color-success-border: #a7f3d0;

  --color-danger: #dc2626;
  --color-danger-bg: #fef2f2;
  --color-danger-border: #fecaca;

  --color-warning: #d97706;
  --color-warning-bg: #fffbeb;
  --color-warning-border: #fde68a;

  --shadow-purple: 0 4px 20px rgba(124, 58, 237, 0.08);
  --shadow-purple-hover: 0 8px 28px rgba(124, 58, 237, 0.16);
  --shadow-purple-sm: 0 2px 10px rgba(124, 58, 237, 0.06);

  --btn-gradient: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  --btn-gradient-hover: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);

  --font-display: 'Pixelify Sans', system-ui, sans-serif;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--color-bg);
  background-image: 
    radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.06) 0%, transparent 60%),
    radial-gradient(ellipse at 85% 90%, rgba(124, 58, 237, 0.04) 0%, transparent 50%);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  letter-spacing: 0.02em;
  color: var(--color-text-main);
}

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
  max-width: 1040px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.content-wrapper.full-width {
  max-width: 100%;
  padding: 0;
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
