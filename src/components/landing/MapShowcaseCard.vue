<script setup>
import { ref } from 'vue'

defineProps({
  map: {
    type: Object,
    required: true,
  },
})

const imgError = ref(false)
</script>

<template>
  <div :class="['showcase-card', { locked: !map.unlocked }]">
    <!-- Retro 4:3 Aspect Ratio Preview Container -->
    <div class="aspect-retro">
      <!-- Map Image from Asset Bundle -->
      <img
        v-if="!imgError"
        :src="map.image"
        :alt="map.name"
        class="preview-img"
        @error="imgError = true"
      />

      <!-- Stylized Fallback Graphic if Image Fails -->
      <div v-else class="map-vector-preview">
        <svg viewBox="0 0 240 180" class="preview-svg" aria-hidden="true">
          <rect width="240" height="180" fill="var(--color-text-main)" opacity="0.9" />
          <circle cx="120" cy="90" r="48" fill="var(--color-primary)" opacity="0.15" />
          <rect x="75" y="70" width="90" height="40" rx="6" fill="var(--color-text-main)" stroke="var(--color-secondary)" stroke-width="2" />
          <circle cx="95" cy="90" r="3" fill="var(--color-success)" />
          <circle cx="110" cy="90" r="3" fill="var(--color-success)" />
          <circle cx="125" cy="90" r="3" fill="var(--color-accent)" />
          <circle cx="140" cy="90" r="3" fill="var(--color-secondary)" />
        </svg>
      </div>

      <!-- Vector Scanline / Grid Overlay -->
      <div class="vector-grid-overlay"></div>

      <!-- Top Sector & Status Badges -->
      <div class="retro-header">
        <span class="sector-code-tag">{{ map.sector }}</span>
        <span :class="['status-tag', map.unlocked ? 'unlocked' : 'locked']">
          {{ map.unlocked ? 'UNLOCKED' : 'LOCKED' }}
        </span>
      </div>
    </div>

    <!-- Card Information Content -->
    <div class="showcase-content">
      <span class="card-eyebrow">{{ map.eyebrow }}</span>
      <h3 class="showcase-title">{{ map.name }}</h3>

      <!-- Focus Pills Row -->
      <div class="focus-pills-row">
        <span v-for="tag in map.focus" :key="tag" class="focus-pill">
          {{ tag }}
        </span>
      </div>

      <p class="showcase-desc">{{ map.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.showcase-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-purple);
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.showcase-card:hover {
  box-shadow: var(--shadow-purple-hover);
  transform: translateY(-3px);
  border-color: var(--color-secondary);
}

.showcase-card.locked {
  opacity: 0.9;
}

/* Retro 4:3 Aspect Ratio Container */
.aspect-retro {
  aspect-ratio: 4 / 3;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: var(--color-text-main);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.showcase-card:hover .preview-img {
  transform: scale(1.04);
}

.map-vector-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.preview-svg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vector-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
}

.retro-header {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
}

.sector-code-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: #ffffff;
  background-color: rgba(30, 27, 75, 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.status-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.status-tag.unlocked {
  background-color: var(--color-success);
  color: #ffffff;
}

.status-tag.locked {
  background-color: var(--color-text-muted);
  color: var(--color-bg-subtle);
}

.showcase-content {
  padding: 1.25rem 1.25rem 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.showcase-title {
  margin: 0 0 0.65rem 0;
  font-size: 1.15rem;
  color: var(--color-text-main);
}

.focus-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.focus-pill {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.showcase-desc {
  color: var(--color-text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
  margin: 0;
}
</style>
