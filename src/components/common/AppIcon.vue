<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 18,
  },
})

const sizePixels = computed(() => {
  return typeof props.size === 'number' ? `${props.size}px` : props.size
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="sizePixels"
    :height="sizePixels"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="app-icon"
    aria-hidden="true"
  >
    <!-- Dashboard / Grid -->
    <template v-if="name === 'dashboard' || name === 'layout-dashboard'">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </template>

    <!-- Classrooms / Users / Group -->
    <template v-else-if="name === 'classrooms' || name === 'users'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </template>

    <!-- Analytics / Chart / Bar Chart -->
    <template v-else-if="name === 'analytics' || name === 'chart'">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </template>

    <!-- Leaderboard / Trophy -->
    <template v-else-if="name === 'leaderboard' || name === 'trophy'">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </template>

    <!-- Join Classroom / Key -->
    <template v-else-if="name === 'join' || name === 'key'">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </template>

    <!-- Logout / Exit -->
    <template v-else-if="name === 'logout' || name === 'log-out'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </template>

    <!-- Copy / Duplicate -->
    <template v-else-if="name === 'copy'">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </template>

    <!-- Check / Success -->
    <template v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12" />
    </template>

    <!-- Plus / Add -->
    <template v-else-if="name === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </template>

    <!-- Alert / Triangle / Circle -->
    <template v-else-if="name === 'alert' || name === 'alert-circle'">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </template>

    <!-- Refresh / Reload -->
    <template v-else-if="name === 'refresh'">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </template>

    <!-- Close / X -->
    <template v-else-if="name === 'x'">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </template>

    <!-- Menu / Hamburger -->
    <template v-else-if="name === 'menu'">
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </template>

    <!-- Chevron / Arrow Right -->
    <template v-else-if="name === 'arrow-right'">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </template>

    <!-- Download -->
    <template v-else-if="name === 'download'">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </template>

    <!-- Smartphone / Mobile -->
    <template v-else-if="name === 'smartphone' || name === 'mobile'">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </template>

    <!-- Shield / Security -->
    <template v-else-if="name === 'shield'">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </template>

    <!-- Info / Details -->
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </template>

    <!-- External Link -->
    <template v-else-if="name === 'external-link'">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </template>

    <!-- Eye / Show password -->
    <template v-else-if="name === 'eye'">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </template>

    <!-- Eye Off / Hide password -->
    <template v-else-if="name === 'eye-off'">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </template>

    <!-- Google Play -->
    <template v-else-if="name === 'google-play' || name === 'play-store'">
      <polygon points="5 3 19 12 5 21 5 3" />
      <line x1="5" y1="3" x2="14" y2="14.5" />
      <line x1="5" y1="21" x2="14" y2="9.5" />
    </template>

    <!-- Steam -->
    <template v-else-if="name === 'steam'">
      <circle cx="12" cy="12" r="10" />
      <circle cx="15.5" cy="8.5" r="2.5" />
      <circle cx="8.5" cy="15.5" r="2" />
      <line x1="13.7" y1="9.8" x2="10" y2="14" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
