<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'
import {
  getSpeechState,
  onSpeechStateChange,
  pauseNarration,
  resumeNarration,
  stopNarration,
  changeNarrationSpeed,
  safelyRestoreFocus,
} from '../../utils/speech.js'
import { VALID_READ_SPEEDS } from '../../utils/accessibility.js'

const props = defineProps({
  ownerId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: 'Section',
  },
  triggerRef: {
    type: [Object, null],
    default: null,
  },
})

const speechState = ref(getSpeechState())
let unsubscribe = null

onMounted(() => {
  unsubscribe = onSpeechStateChange((newState) => {
    speechState.value = newState
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

const isActive = computed(() => {
  return speechState.value.activeOwnerId === props.ownerId
})

const isStarting = computed(() => {
  return isActive.value && speechState.value.status === 'starting'
})

const isPlaying = computed(() => {
  return isActive.value && speechState.value.status === 'playing'
})

const isPaused = computed(() => {
  return isActive.value && speechState.value.status === 'paused'
})

const isError = computed(() => {
  return isActive.value && speechState.value.status === 'error'
})

const currentSpeed = computed(() => {
  return String(speechState.value.currentRate || '1')
})

const feedbackText = computed(() => {
  if (!isActive.value) return ''
  if (speechState.value.errorMessage) {
    return speechState.value.errorMessage
  }
  if (isStarting.value) {
    return 'Starting narration…'
  }
  if (speechState.value.feedbackMessage) {
    return speechState.value.feedbackMessage
  }
  if (isPaused.value) {
    return 'Narration paused.'
  }
  if (isPlaying.value) {
    return `Reading aloud at ${currentSpeed.value}x speed.`
  }
  return ''
})

const playerRef = ref(null)

const handleTogglePlayPause = () => {
  if (isPlaying.value) {
    pauseNarration(props.ownerId)
  } else if (isPaused.value) {
    resumeNarration(props.ownerId)
  }
}

const handleStop = () => {
  stopNarration(props.ownerId)
  safelyRestoreFocus(props.triggerRef)
}

const handleSpeedChange = (speed) => {
  changeNarrationSpeed(speed, props.ownerId)
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    handleStop()
  }
}
</script>

<template>
  <div
    v-if="isActive"
    ref="playerRef"
    class="inline-speech-player"
    role="region"
    :aria-label="`Narration controls for ${title}`"
    tabindex="-1"
    @keydown="handleKeydown"
  >
    <div class="player-header">
      <div class="player-indicator">
        <AppIcon
          :name="isPlaying ? 'volume-2' : isStarting ? 'loader' : isPaused ? 'pause' : 'alert-circle'"
          :size="16"
          class="indicator-icon"
          :class="{ 'is-pulsing': isPlaying, 'is-spinning': isStarting }"
        />
        <span class="indicator-title">
          {{ isStarting ? 'Starting:' : isPaused ? 'Paused:' : isError ? 'Error:' : 'Reading:' }} {{ title }}
        </span>
      </div>

      <div class="player-actions">
        <button
          type="button"
          class="btn-player-action"
          :disabled="isStarting || isError"
          :aria-label="isStarting ? 'Starting narration' : isPlaying ? `Pause narration for ${title}` : `Resume narration for ${title}`"
          @click="handleTogglePlayPause"
        >
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="14" />
          <span>{{ isStarting ? 'Starting…' : isPlaying ? 'Pause' : 'Resume' }}</span>
        </button>

        <button
          type="button"
          class="btn-player-action btn-player-stop"
          :aria-label="`Stop narration for ${title}`"
          @click="handleStop"
        >
          <AppIcon name="stop" :size="14" />
          <span>Stop</span>
        </button>
      </div>
    </div>

    <div class="player-controls">
      <div class="speed-control-group" role="group" aria-label="Reading speed">
        <span class="speed-label" id="speed-group-label">Speed:</span>
        <div class="speed-pills">
          <button
            v-for="speed in VALID_READ_SPEEDS"
            :key="speed"
            type="button"
            class="speed-pill"
            :class="{ 'is-active': currentSpeed === speed }"
            :aria-pressed="currentSpeed === speed"
            :aria-label="`${speed} times normal speed`"
            @click="handleSpeedChange(speed)"
          >
            {{ speed }}x
          </button>
        </div>
      </div>
    </div>

    <!-- Live status feedback for screen readers & visual confirmation -->
    <div
      class="player-status-feedback"
      role="status"
      aria-live="polite"
      :class="{ 'is-error': isError }"
    >
      {{ feedbackText }}
      <span class="keyboard-hint">(Press Escape inside controls to stop)</span>
    </div>
  </div>
</template>

<style scoped>
.inline-speech-player {
  margin-top: 1rem;
  padding: 0.875rem 1rem;
  background-color: var(--surface-color-alt, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--primary-color, #0ea5e9);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  animation: playerFadeIn 0.2s ease-out;
}

@keyframes playerFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.player-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-color);
}

.indicator-icon {
  color: var(--primary-color, #0ea5e9);
}

.indicator-icon.is-spinning {
  animation: spinIndicator 1s linear infinite;
}

@keyframes spinIndicator {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.indicator-icon.is-pulsing {
  animation: pulseIndicator 1.5s infinite;
}

@keyframes pulseIndicator {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.92);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.player-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-player-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background-color: var(--surface-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.btn-player-action:hover {
  background-color: var(--surface-hover-color, rgba(0, 0, 0, 0.05));
  border-color: var(--border-hover-color, var(--primary-color));
}

.btn-player-action:focus-visible {
  outline: 2px solid var(--primary-color, #0ea5e9);
  outline-offset: 2px;
}

.btn-player-stop {
  color: var(--danger-color, #ef4444);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.speed-control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.speed-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.speed-pills {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.speed-pill {
  padding: 0.1875rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--surface-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.speed-pill:hover {
  border-color: var(--primary-color, #0ea5e9);
  background-color: var(--surface-hover-color, rgba(0, 0, 0, 0.05));
}

.speed-pill.is-active {
  background-color: var(--primary-color, #0ea5e9);
  color: #ffffff;
  border-color: var(--primary-color, #0ea5e9);
}

.speed-pill:focus-visible {
  outline: 2px solid var(--primary-color, #0ea5e9);
  outline-offset: 2px;
}

.player-status-feedback {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-status-feedback.is-error {
  color: var(--danger-color, #ef4444);
  font-weight: 500;
}

.keyboard-hint {
  font-size: 0.6875rem;
  opacity: 0.75;
}
</style>
