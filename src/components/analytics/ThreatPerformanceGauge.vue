<script setup>
import { computed } from 'vue'
import { isValidErrorRate } from '../../utils/analyticsValidation.js'

const props = defineProps({
  threatName: {
    type: String,
    required: true,
  },
  // Accepts arbitrary standalone runtime values without Vue prop warnings;
  // parents should pre-validate payloads with classifyCategoryBreakdown().
  failRate: {
    default: null,
  },
})

const hasValidRate = computed(() => isValidErrorRate(props.failRate))

const isInvalidRate = computed(
  () => props.failRate !== null && !hasValidRate.value,
)

const formattedRate = computed(() => {
  if (!hasValidRate.value) return null
  return `${(props.failRate * 100).toFixed(1)}%`
})

const riskLevelClass = computed(() => {
  if (!hasValidRate.value) return 'no-data'
  if (props.failRate >= 0.4) return 'risk-high'
  if (props.failRate >= 0.2) return 'risk-moderate'
  return 'risk-low'
})

const riskLabel = computed(() => {
  if (isInvalidRate.value) return 'Unavailable'
  if (!hasValidRate.value) return 'No data yet'
  if (props.failRate >= 0.4) return 'High error rate'
  if (props.failRate >= 0.2) return 'Moderate error rate'
  return 'Low error rate'
})

const barWidthStyle = computed(() => {
  if (!hasValidRate.value) return null
  return { width: `${props.failRate * 100}%` }
})
</script>

<template>
  <div class="threat-card">
    <div class="threat-top">
      <h5 class="threat-name">{{ threatName }}</h5>
      <span :class="['risk-badge', riskLevelClass]">
        {{ riskLabel }}
      </span>
    </div>

    <!-- Metric Value -->
    <div class="threat-rate-row">
      <template v-if="hasValidRate">
        <span class="rate-number">
          {{ formattedRate }}
        </span>
        <span class="rate-sub">decision error rate</span>
      </template>
      <template v-else-if="isInvalidRate">
        <span class="rate-null">Unavailable metric</span>
      </template>
      <template v-else>
        <span class="rate-null">No decisions uploaded</span>
      </template>
    </div>

    <!-- Visual Progress Bar -->
    <div
      class="progress-bar-bg"
      :role="hasValidRate ? 'progressbar' : undefined"
      :aria-valuenow="hasValidRate ? Number((props.failRate * 100).toFixed(1)) : undefined"
      :aria-valuemin="hasValidRate ? 0 : undefined"
      :aria-valuemax="hasValidRate ? 100 : undefined"
      :aria-label="hasValidRate ? `${threatName} error rate` : undefined"
    >
      <div
        v-if="hasValidRate"
        :class="['progress-bar-fill', riskLevelClass]"
        :style="barWidthStyle"
      ></div>
      <div v-else class="progress-bar-empty"></div>
    </div>
  </div>
</template>

<style scoped>
.threat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  transition: border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.threat-card:hover {
  border-color: var(--color-violet-border);
}

.threat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.threat-name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.3;
}

.threat-rate-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.rate-number {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-primary);
}

.rate-sub {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.rate-null {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  font-style: italic;
}

/* Risk Badges */
.risk-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
}

.risk-badge.risk-low {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.risk-badge.risk-moderate {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.risk-badge.risk-high {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.risk-badge.no-data {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

/* Progress Bars */
.progress-bar-bg {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-muted);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .threat-card,
  .progress-bar-fill {
    transition: none;
  }
}

:global([data-reduced-motion='true']) .threat-card,
:global([data-reduced-motion='true']) .progress-bar-fill {
  transition: none;
}

.progress-bar-fill.risk-low {
  background-color: var(--color-success);
}

.progress-bar-fill.risk-moderate {
  background-color: var(--color-warning);
}

.progress-bar-fill.risk-high {
  background-color: var(--color-danger);
}

.progress-bar-empty {
  height: 100%;
  background-color: transparent;
}
</style>
