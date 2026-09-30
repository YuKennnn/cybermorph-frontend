<script setup>
defineProps({
  threatName: {
    type: String,
    required: true,
  },
  failRate: {
    type: [Number, null],
    default: null,
  },
})

const formatFailRate = (rate) => {
  if (rate === null || rate === undefined) return null
  return `${(rate * 100).toFixed(1)}%`
}

const getRiskLevelClass = (rate) => {
  if (rate === null || rate === undefined) return 'no-data'
  if (rate >= 0.4) return 'risk-high'
  if (rate >= 0.2) return 'risk-moderate'
  return 'risk-low'
}

const getRiskLabel = (rate) => {
  if (rate === null || rate === undefined) return 'No Data Yet'
  if (rate >= 0.4) return 'High Fail Rate'
  if (rate >= 0.2) return 'Moderate Fail Rate'
  return 'Low Fail Rate'
}
</script>

<template>
  <div class="threat-card">
    <div class="threat-top">
      <h5 class="threat-name">{{ threatName }}</h5>
      <span :class="['risk-badge', getRiskLevelClass(failRate)]">
        {{ getRiskLabel(failRate) }}
      </span>
    </div>

    <!-- Metric Value -->
    <div class="threat-rate-row">
      <template v-if="failRate !== null && failRate !== undefined">
        <span class="rate-number">
          {{ formatFailRate(failRate) }}
        </span>
        <span class="rate-sub">fail frequency</span>
      </template>
      <template v-else>
        <span class="rate-null">No Encounters Logged</span>
      </template>
    </div>

    <!-- Visual Progress Bar -->
    <div class="progress-bar-bg">
      <div
        v-if="failRate !== null && failRate !== undefined"
        :class="['progress-bar-fill', getRiskLevelClass(failRate)]"
        :style="{ width: `${Math.min(failRate * 100, 100)}%` }"
      ></div>
      <div v-else class="progress-bar-empty"></div>
    </div>
  </div>
</template>

<style scoped>
.threat-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.threat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple);
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
  color: var(--color-text-dim);
  font-style: italic;
}

/* Risk Badges */
.risk-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

/* Progress Bars */
.progress-bar-bg {
  width: 100%;
  height: 6px;
  background-color: var(--color-border-subtle);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
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
