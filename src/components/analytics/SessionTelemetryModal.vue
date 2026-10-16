<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  session: {
    type: Object,
    default: null,
  },
  sessionTelemetry: {
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
  student: {
    type: Object,
    default: null,
  },
  fallbackFocusSelector: {
    type: String,
    default: '.title',
  },
})

const emit = defineEmits(['close', 'backToStudent'])

const modalRef = ref(null)
const backBtnRef = ref(null)
let previousActiveElement = null

const trapFocus = (event) => {
  if (event.key !== 'Tab' || !modalRef.value) return
  const focusables = modalRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === last) {
      first.focus()
      event.preventDefault()
    }
  }
}

const handleKeyDown = (event) => {
  if (!props.isOpen) return
  if (event.key === 'Escape') {
    emit('backToStudent')
    return
  }
  trapFocus(event)
}

watch(
  () => props.isOpen,
  (open, oldOpen) => {
    if (open) {
      previousActiveElement = document.activeElement
      document.body.style.overflow = 'hidden'
      nextTick(() => {
        if (backBtnRef.value) {
          backBtnRef.value.focus()
        } else {
          const firstFocusable = modalRef.value?.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )
          firstFocusable?.focus()
        }
      })
    } else if (oldOpen) {
      nextTick(() => {
        if (!document.querySelector('.modal-backdrop')) {
          document.body.style.overflow = ''
        }
      })
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === 'function' &&
        previousActiveElement !== document.body &&
        document.body.contains(previousActiveElement)
      ) {
        previousActiveElement.focus()
      } else if (props.fallbackFocusSelector) {
        const fallback = document.querySelector(props.fallbackFocusSelector)
        if (fallback && typeof fallback.focus === 'function') {
          if (!fallback.hasAttribute('tabindex')) {
            fallback.setAttribute('tabindex', '-1')
          }
          fallback.focus()
        }
      }
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (!document.querySelector('.modal-backdrop')) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div
    v-if="isOpen"
    ref="modalRef"
    class="modal-backdrop sub-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Session details"
    @click.self="emit('backToStudent')"
  >
    <div class="modal-dialog modal-md">
      <div class="modal-header">
        <div class="header-left-actions">
          <button
            ref="backBtnRef"
            type="button"
            class="btn-back-link"
            @click="emit('backToStudent')"
          >
            ◀ Back to student
          </button>
          <div class="modal-title-box">
            <h4>Session details</h4>
          </div>
        </div>
        <button
          class="modal-close-btn"
          aria-label="Close session details modal"
          @click="emit('backToStudent')"
        >
          ✕
        </button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading session details...</p>
      </div>

      <div v-else-if="errorMessage" class="error-banner" role="alert">
        {{ errorMessage }}
      </div>

      <div v-else-if="sessionTelemetry" class="modal-body">
        <!-- Session Context Header -->
        <div class="session-summary-box">
          <div class="summary-col">
            <span class="summary-label">Student</span>
            <span class="summary-val">{{ sessionTelemetry.username || student?.username || 'Student' }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Map</span>
            <span class="summary-val">{{ sessionTelemetry.map_name }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Outcome</span>
            <span :class="['result-pill', sessionTelemetry.result]">
              {{ sessionTelemetry.result?.toUpperCase() }}
            </span>
          </div>
        </div>

        <!-- Threat Events Table or Graceful Empty State -->
        <div class="subsection">
          <h5>Session events</h5>

          <div
            v-if="sessionTelemetry.threat_events && sessionTelemetry.threat_events.length > 0"
            class="table-container"
          >
            <table class="data-table events-table">
              <thead>
                <tr>
                  <th>Type of threat</th>
                  <th>Action taken</th>
                  <th>Assessment</th>
                  <th>Legitimate?</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(event, idx) in sessionTelemetry.threat_events"
                  :key="idx"
                >
                  <td>
                    <span class="event-threat">{{ event.threat_type }}</span>
                  </td>
                  <td>
                    <span class="event-action">{{ event.player_action }}</span>
                  </td>
                  <td>
                    <span
                      :class="['assessment-tag', event.is_correct ? 'correct' : 'incorrect']"
                    >
                      {{ event.is_correct ? 'Correct' : 'Incorrect' }}
                    </span>
                  </td>
                  <td>
                    {{ event.is_legitimate_item ? 'Yes (Benign)' : 'No (Attack)' }}
                  </td>
                  <td>
                    <span
                      :class="['credit-val', event.credits_affected >= 0 ? 'gain' : 'loss']"
                    >
                      {{ event.credits_affected >= 0 ? `+${event.credits_affected}` : event.credits_affected }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Graceful Empty State for Telemetry Streaming -->
          <div v-else class="telemetry-pending-banner">
            <div class="pending-text">
              <h6>Session event details</h6>
              <p>
                No individual threat events recorded for this session. Summary outcome metrics remain recorded above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-left-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.btn-back-link:hover {
  background-color: var(--color-bg-subtle);
  text-decoration: underline;
}
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

.sub-backdrop {
  z-index: 250;
  background-color: rgba(30, 27, 75, 0.7);
}

.modal-dialog {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(124, 58, 237, 0.2);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-md {
  max-width: 680px;
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

.session-summary-box {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.summary-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.summary-val {
  font-weight: 700;
  color: var(--color-text-main);
  font-size: 1rem;
}

.subsection h5 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: var(--color-text-main);
  border-left: 3.5px solid var(--color-primary);
  padding-left: 0.5rem;
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

.event-threat {
  font-weight: 600;
  color: var(--color-text-main);
}

.event-action {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
}

.assessment-tag {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.assessment-tag.correct {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.assessment-tag.incorrect {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.credit-val.gain {
  color: var(--color-success);
  font-weight: 700;
}

.credit-val.loss {
  color: var(--color-danger);
  font-weight: 700;
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

.telemetry-pending-banner {
  background-color: var(--color-bg-subtle);
  border: 1.5px dashed var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.pending-text h6 {
  margin: 0 0 0.35rem 0;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.pending-text p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
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
  .session-summary-box {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
