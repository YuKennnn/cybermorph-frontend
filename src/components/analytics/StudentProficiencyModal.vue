<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  student: {
    type: Object,
    default: null,
  },
  studentAnalytics: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  canonicalMaps: {
    type: Array,
    required: true,
  },
  canonicalThreats: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['close', 'inspectSession'])

const handleKeyDown = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const formatDate = (isoString) => {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getRiskLevelClass = (rate) => {
  if (rate === null || rate === undefined) return 'no-data'
  if (rate >= 0.4) return 'risk-high'
  if (rate >= 0.2) return 'risk-moderate'
  return 'risk-low'
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-label="`Agent Proficiency: ${student?.username || ''}`"
    @click.self="emit('close')"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-header">
        <div class="modal-title-box">
          <h4>Agent Proficiency: {{ student?.username }}</h4>
          <span class="modal-profile-id">Profile ID: {{ student?.profile_id }}</span>
        </div>
        <button class="modal-close-btn" aria-label="Close proficiency modal" @click="emit('close')">✕</button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Compiling student telemetry breakdown...</p>
      </div>

      <div v-else-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-else-if="studentAnalytics" class="modal-body">
        <!-- Student Performance Highlights -->
        <div class="student-kpi-row">
          <div class="stat-box">
            <span class="stat-number stat-win">{{ studentAnalytics.wins }}</span>
            <span class="stat-tag">Missions Won</span>
          </div>
          <div class="stat-box">
            <span class="stat-number stat-loss">{{ studentAnalytics.losses }}</span>
            <span class="stat-tag">Missions Lost</span>
          </div>
          <div class="stat-box">
            <span class="stat-number stat-rate">
              {{
                studentAnalytics.wins + studentAnalytics.losses > 0
                  ? `${Math.round((studentAnalytics.wins / (studentAnalytics.wins + studentAnalytics.losses)) * 100)}%`
                  : 'N/A'
              }}
            </span>
            <span class="stat-tag">Win Rate</span>
          </div>
          <div class="stat-box">
            <span class="stat-number stat-duration">
              {{ formatDuration(studentAnalytics.avg_duration_seconds) }}
            </span>
            <span class="stat-tag">Avg Duration</span>
          </div>
        </div>

        <!-- Best Score per Map -->
        <div class="subsection">
          <h5>Best Scores Across Simulation Maps</h5>
          <div class="map-scores-grid">
            <div
              v-for="m in canonicalMaps"
              :key="m.name"
              class="student-map-card"
            >
              <div class="s-map-info">
                <span class="s-map-name">{{ m.name }}</span>
                <span
                  v-if="studentAnalytics.best_score_by_map?.[m.name] !== undefined"
                  class="s-map-score"
                >
                  {{ studentAnalytics.best_score_by_map[m.name] }} pts
                </span>
                <span v-else class="s-map-unplayed">Not Attempted</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Student Individual Threat Category Breakdown -->
        <div class="subsection">
          <h5>Vulnerability by Threat Category</h5>
          <div class="student-threats-grid">
            <div
              v-for="threat in canonicalThreats"
              :key="threat.name"
              class="student-threat-pill"
            >
              <span class="st-name">{{ threat.name }}</span>
              <span
                :class="[
                  'st-badge',
                  getRiskLevelClass(studentAnalytics.category_breakdown?.[threat.name]),
                ]"
              >
                {{
                  studentAnalytics.category_breakdown?.[threat.name] !== null &&
                  studentAnalytics.category_breakdown?.[threat.name] !== undefined
                    ? `${(studentAnalytics.category_breakdown[threat.name] * 100).toFixed(0)}% Fail`
                    : 'No Data'
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- Recent Sessions List -->
        <div class="subsection">
          <h5>Recent Missions (Up to 10)</h5>
          <div
            v-if="studentAnalytics.recent_sessions && studentAnalytics.recent_sessions.length > 0"
            class="table-container"
          >
            <table class="data-table sessions-table">
              <thead>
                <tr>
                  <th>Map</th>
                  <th>Result</th>
                  <th>Duration</th>
                  <th>Credits Net</th>
                  <th>Played At</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in studentAnalytics.recent_sessions"
                  :key="s.session_id"
                >
                  <td>
                    <span class="session-map">{{ s.map_name }}</span>
                  </td>
                  <td>
                    <span :class="['result-pill', s.result]">
                      {{ s.result?.toUpperCase() }}
                    </span>
                  </td>
                  <td>{{ formatDuration(s.duration_seconds) }}</td>
                  <td>
                    <span class="credits-earned">+{{ s.credits_earned || 0 }}</span>
                    /
                    <span class="credits-lost">-{{ s.credits_lost || 0 }}</span>
                  </td>
                  <td class="date-cell">{{ formatDate(s.played_at) }}</td>
                  <td class="text-right">
                    <button
                      class="btn-telemetry"
                      @click="emit('inspectSession', s)"
                    >
                      View Telemetry
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-note">No recent mission sessions recorded for this agent.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(30, 27, 75, 0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-dialog {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(124, 58, 237, 0.2);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-lg {
  max-width: 820px;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-subtle);
}

.modal-title-box h4 {
  margin: 0 0 0.15rem 0;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.modal-profile-id {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-dim);
  cursor: pointer;
}

.modal-close-btn:hover {
  color: var(--color-danger);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.student-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.stat-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
}

.stat-number {
  display: block;
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.stat-win {
  color: var(--color-success);
}

.stat-loss {
  color: var(--color-danger);
}

.stat-rate {
  color: var(--color-primary);
}

.stat-duration {
  color: var(--color-secondary);
}

.stat-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.subsection h5 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: var(--color-text-main);
  border-left: 3.5px solid var(--color-primary);
  padding-left: 0.5rem;
}

.map-scores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.student-map-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.s-map-info {
  display: flex;
  flex-direction: column;
}

.s-map-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.s-map-score {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.s-map-unplayed {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  font-style: italic;
}

.student-threats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.65rem;
}

.student-threat-pill {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.st-name {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.st-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.st-badge.risk-low {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.st-badge.risk-moderate {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.st-badge.risk-high {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.st-badge.no-data {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

.data-table td {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 0.92rem;
  color: var(--color-text-main);
}

.result-pill {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  display: inline-block;
}

.result-pill.win {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.result-pill.lose {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.result-pill.timeout {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.credits-earned {
  color: var(--color-success);
  font-weight: 600;
}

.credits-lost {
  color: var(--color-danger);
  font-weight: 600;
}

.btn-telemetry {
  padding: 0.35rem 0.75rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-telemetry:hover {
  background-color: #ede9fe;
  border-color: var(--color-primary);
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.text-right {
  text-align: right;
}

.empty-note {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
  font-size: 0.9rem;
}

.loading-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem auto;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .student-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
