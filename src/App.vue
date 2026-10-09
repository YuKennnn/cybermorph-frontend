<script setup>
import { computed } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import SidebarNav from './components/SidebarNav.vue'

const route = useRoute()
const authStore = useAuthStore()

const isPublicLayout = computed(() => {
  return (
    !!route.meta?.isPublic ||
    route.name === 'landing' ||
    route.name === 'about' ||
    route.name === 'gameplay' ||
    route.name === 'download' ||
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
    <SidebarNav v-if="showSidebar" />
    <main
      :class="[
        'main-content',
        { 'with-sidebar': showSidebar, 'landing-mode': isPublicLayout },
      ]"
    >
      <div :class="['content-wrapper', { 'full-width': isPublicLayout }]">
        <RouterView />
      </div>
    </main>
  </div>
</template>

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
