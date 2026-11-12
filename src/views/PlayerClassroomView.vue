<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import {
  PLAYER_MAP_NAMES,
  usePlayerClassroomStore,
} from '../stores/playerClassroomStore.js'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const playerClassroomStore = usePlayerClassroomStore()

const getMemberMapName = (mapProgress) => {
  if (
    typeof mapProgress === 'number' &&
    Number.isInteger(mapProgress) &&
    mapProgress >= 0 &&
    mapProgress < PLAYER_MAP_NAMES.length
  ) {
    return PLAYER_MAP_NAMES[mapProgress]
  }
  return 'Unavailable'
}

const isLeaveModalOpen = ref(false)
const leaveError = ref('')
const leaveModalRef = ref(null)
const cancelLeaveBtnRef = ref(null)
const leaveTriggerBtnRef = ref(null)
let previousActiveElement = null

const currentUsernameLower = computed(() =>
  (authStore.user?.username || '').trim().toLowerCase(),
)

const isCurrentUserMember = (username) =>
  Boolean(currentUsernameLower.value) &&
  typeof username === 'string' &&
  username.trim().toLowerCase() === currentUsernameLower.value

const syncRedirectIfNeeded = () => {
  const redirectTarget = playerClassroomStore.resolveRedirectForPath('/classroom')
  if (redirectTarget && redirectTarget !== '/classroom') {
    router.replace(redirectTarget)
    return true
  }
  return false
}

const loadClassroom = async ({ force = false } = {}) => {
  playerClassroomStore.syncAccountScope()
  if (syncRedirectIfNeeded()) return
  if (playerClassroomStore.joinSucceededRefreshFailed && !force) return

  try {
    await playerClassroomStore.loadMembership({ force })
  } catch {
    // Error state is managed in playerClassroomStore
  }
  syncRedirectIfNeeded()
}

const handleRetryLoad = () => {
  if (playerClassroomStore.isLoading || playerClassroomStore.isRefreshing) return
  loadClassroom({ force: true })
}

const openLeaveModal = () => {
  leaveError.value = ''
  previousActiveElement = document.activeElement
  isLeaveModalOpen.value = true
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden'
  }
  nextTick(() => {
    cancelLeaveBtnRef.value?.focus()
  })
}

const closeLeaveModal = () => {
  if (playerClassroomStore.isLeaving) return
  isLeaveModalOpen.value = false
  leaveError.value = ''
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
  nextTick(() => {
    if (
      leaveTriggerBtnRef.value &&
      typeof leaveTriggerBtnRef.value.focus === 'function'
    ) {
      leaveTriggerBtnRef.value.focus()
    } else if (
      previousActiveElement &&
      typeof previousActiveElement.focus === 'function'
    ) {
      previousActiveElement.focus()
    }
  })
}

const trapModalFocus = (event) => {
  if (event.key !== 'Tab' || !leaveModalRef.value) return
  const focusables = leaveModalRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  } else if (document.activeElement === last) {
    first.focus()
    event.preventDefault()
  }
}

const handleWindowKeyDown = (event) => {
  if (!isLeaveModalOpen.value) return
  if (event.key === 'Escape') {
    if (!playerClassroomStore.isLeaving) {
      closeLeaveModal()
    }
    return
  }
  trapModalFocus(event)
}

const handleConfirmLeave = async () => {
  if (playerClassroomStore.isLeaving) return
  leaveError.value = ''

  try {
    const left = await playerClassroomStore.leaveCurrentClassroom()
    if (!left) return
    isLeaveModalOpen.value = false
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
    }
    await router.replace('/classroom/join')
  } catch (err) {
    const detail = err?.response?.data?.detail
    leaveError.value =
      typeof detail === 'string'
        ? detail
        : 'Unable to leave the classroom right now. Your enrollment is unchanged; please try again.'
  }
}

watch(
  () => playerClassroomStore.status,
  () => {
    syncRedirectIfNeeded()
  },
)

watch(
  () => [authStore.token, authStore.user?.user_id, authStore.user?.email],
  ([newToken], [oldToken]) => {
    if (!newToken) {
      isLeaveModalOpen.value = false
      if (typeof document !== 'undefined') {
        document.body.style.overflow = ''
      }
      playerClassroomStore.reset()
      return
    }
    if (newToken !== oldToken) {
      isLeaveModalOpen.value = false
      loadClassroom({ force: true })
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeyDown)
  loadClassroom()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeyDown)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div class="player-classroom-page">
    <header class="classroom-hero">
      <div class="hero-identity">
        <div class="hero-icon" aria-hidden="true">
          <AppIcon name="users" :size="22" />
        </div>
        <div class="hero-text">
          <h1 class="page-title">
            {{
              playerClassroomStore.isEnrolled
                ? playerClassroomStore.membership.name
                : 'My classroom'
            }}
          </h1>
        </div>
      </div>

      <div class="header-actions">
        <router-link to="/dashboard" class="btn-secondary">
          <AppIcon name="arrow-left" :size="15" />
          <span>Overview</span>
        </router-link>
        <button
          type="button"
          class="btn-refresh"
          :disabled="playerClassroomStore.isLoading || playerClassroomStore.isRefreshing"
          :aria-busy="playerClassroomStore.isLoading || playerClassroomStore.isRefreshing ? 'true' : 'false'"
          @click="handleRetryLoad"
        >
          <AppIcon
            name="refresh"
            :size="16"
            :class="{
              'icon-spin':
                playerClassroomStore.isLoading || playerClassroomStore.isRefreshing,
            }"
          />
          <span>{{
            playerClassroomStore.isLoading || playerClassroomStore.isRefreshing
              ? 'Refreshing...'
              : 'Refresh'
          }}</span>
        </button>
        <button
          v-if="playerClassroomStore.isEnrolled"
          ref="leaveTriggerBtnRef"
          type="button"
          class="btn-danger-outline"
          :disabled="playerClassroomStore.isLeaving"
          @click="openLeaveModal"
        >
          Leave classroom
        </button>
      </div>
    </header>

    <!-- Brief Join Success Banner -->
    <div
      v-if="playerClassroomStore.flashMessage"
      class="flash-banner"
      role="status"
      aria-live="polite"
    >
      <div class="flash-content">
        <AppIcon name="check" :size="18" class="flash-icon" />
        <span>{{ playerClassroomStore.flashMessage }}</span>
      </div>
      <button
        type="button"
        class="flash-dismiss"
        aria-label="Dismiss notification"
        @click="playerClassroomStore.clearFlashMessage()"
      >
        <AppIcon name="x" :size="16" />
      </button>
    </div>

    <!-- Initial Loading State (Structural Skeleton) -->
    <div
      v-if="playerClassroomStore.isLoading && !playerClassroomStore.isEnrolled"
      class="loading-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading classroom details"
    >
      <div class="details-grid">
        <div v-for="n in 3" :key="n" class="detail-card skeleton-card">
          <div class="skeleton-line skeleton-sm"></div>
          <div class="skeleton-line skeleton-lg"></div>
        </div>
      </div>
      <div class="members-section">
        <div class="skeleton-line skeleton-md"></div>
        <div v-for="r in 3" :key="r" class="skeleton-row"></div>
      </div>
    </div>

    <!-- Post-Join Refresh Failure OR Initial Membership Lookup Error -->
    <div
      v-else-if="!playerClassroomStore.isEnrolled && playerClassroomStore.hasError"
      class="state-card error-state"
      role="alert"
    >
      <div class="error-header">
        <AppIcon name="alert" :size="20" />
        <h2 class="state-title">
          {{
            playerClassroomStore.joinSucceededRefreshFailed
              ? 'Joined successfully; classroom details could not load'
              : 'Classroom details unavailable'
          }}
        </h2>
      </div>
      <p class="state-description">
        <template v-if="playerClassroomStore.joinSucceededRefreshFailed">
          Your enrollment{{
            playerClassroomStore.partialJoinInfo?.name
              ? ` in "${playerClassroomStore.partialJoinInfo.name}"`
              : ''
          }}
          was recorded, but loading full classroom details failed. Retry loading your classroom below without resubmitting your join code.
        </template>
        <template v-else>
          {{
            playerClassroomStore.error ||
            'Unable to load classroom membership. Please try again.'
          }}
        </template>
      </p>
      <button
        type="button"
        class="btn-retry"
        :disabled="playerClassroomStore.isLoading || playerClassroomStore.isRefreshing"
        @click="handleRetryLoad"
      >
        {{
          playerClassroomStore.isLoading || playerClassroomStore.isRefreshing
            ? 'Retrying...'
            : 'Try again'
        }}
      </button>
    </div>

    <!-- Enrolled Classroom Details & Members -->
    <template v-else-if="playerClassroomStore.isEnrolled">
      <div
        v-if="playerClassroomStore.error"
        class="inline-error-banner"
        role="alert"
      >
        <span>{{ playerClassroomStore.error }}</span>
        <button
          type="button"
          class="btn-retry-inline"
          :disabled="playerClassroomStore.isRefreshing"
          @click="handleRetryLoad"
        >
          {{ playerClassroomStore.isRefreshing ? 'Retrying...' : 'Try again' }}
        </button>
      </div>

      <section class="details-grid" aria-label="Classroom summary">
        <div class="detail-card">
          <div class="detail-head">
            <span class="detail-label">Educator</span>
            <AppIcon name="shield" :size="16" class="detail-icon" aria-hidden="true" />
          </div>
          <strong class="detail-value">
            {{
              playerClassroomStore.membership.educator_name ||
              'Educator name not set'
            }}
          </strong>
        </div>

        <div class="detail-card">
          <div class="detail-head">
            <span class="detail-label">Joined</span>
            <AppIcon name="clock" :size="16" class="detail-icon" aria-hidden="true" />
          </div>
          <strong class="detail-value">{{
            playerClassroomStore.membership.joined_date_label
          }}</strong>
        </div>

        <div class="detail-card highlight-card">
          <div class="detail-head">
            <span class="detail-label">Enrolled players</span>
            <AppIcon name="users" :size="16" class="detail-icon" aria-hidden="true" />
          </div>
          <strong class="detail-value highlight-primary">
            {{ playerClassroomStore.membership.member_count }}
          </strong>
        </div>
      </section>

      <section class="members-section" aria-labelledby="members-heading">
        <div class="members-header">
          <h2 id="members-heading" class="members-title">
            Classroom members
          </h2>
          <span class="members-count-pill">
            {{ playerClassroomStore.membership.member_count }}
          </span>
        </div>

        <ul
          v-if="playerClassroomStore.membership.members.length > 0"
          class="members-list"
          aria-label="Enrolled players in this classroom"
        >
          <li
            v-for="member in playerClassroomStore.membership.members"
            :key="member.username"
            :class="[
              'member-row',
              { 'is-self': isCurrentUserMember(member.username) },
            ]"
          >
            <div class="member-identity">
              <div class="member-avatar" aria-hidden="true">
                {{ member.username.charAt(0).toUpperCase() }}
              </div>
              <div class="member-name-wrap">
                <span class="member-username">{{ member.username }}</span>
                <span
                  v-if="isCurrentUserMember(member.username)"
                  class="self-badge"
                >
                  You
                </span>
              </div>
            </div>

            <div class="member-progress">
              <div
                class="stage-pips"
                :aria-label="member.map_label"
              >
                <span
                  v-for="stageIndex in PLAYER_MAP_NAMES.length"
                  :key="stageIndex"
                  class="stage-pip"
                  :class="{
                    'is-unlocked':
                      typeof member.map_progress === 'number' &&
                      stageIndex - 1 <= member.map_progress,
                  }"
                ></span>
              </div>
              <span class="progress-map-name">
                {{ getMemberMapName(member.map_progress) }}
              </span>
              <span class="progress-ratio">
                {{
                  typeof member.map_progress === 'number'
                    ? `${member.map_progress + 1}/${PLAYER_MAP_NAMES.length}`
                    : '—'
                }}
              </span>
            </div>
          </li>
        </ul>

        <p v-else class="empty-members">
          No classroom members returned.
        </p>
      </section>
    </template>

    <!-- Accessible Leave Classroom Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="isLeaveModalOpen"
        ref="leaveModalRef"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-classroom-title"
        aria-describedby="leave-classroom-desc"
        @click.self="closeLeaveModal"
      >
        <div class="modal-card">
          <div class="modal-header">
            <h2 id="leave-classroom-title" class="modal-title">
              Leave classroom
            </h2>
            <button
              type="button"
              class="modal-close-btn"
              aria-label="Close leave classroom dialog"
              :disabled="playerClassroomStore.isLeaving"
              @click="closeLeaveModal"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </div>

          <div v-if="leaveError" class="modal-error-banner" role="alert">
            {{ leaveError }}
          </div>

          <p id="leave-classroom-desc" class="modal-desc">
            Are you sure you want to leave
            <strong>"{{ playerClassroomStore.membership?.name || 'this classroom' }}"</strong>?
            You will be removed from the educator's student list. Your gameplay progress stays saved.
          </p>

          <div class="modal-actions">
            <button
              ref="cancelLeaveBtnRef"
              type="button"
              class="btn-cancel"
              :disabled="playerClassroomStore.isLeaving"
              @click="closeLeaveModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn-confirm-leave"
              :disabled="playerClassroomStore.isLeaving"
              :aria-busy="playerClassroomStore.isLeaving ? 'true' : 'false'"
              @click="handleConfirmLeave"
            >
              <AppIcon
                v-if="playerClassroomStore.isLeaving"
                name="loader"
                :size="16"
                class="icon-spin"
              />
              <span>{{
                playerClassroomStore.isLeaving
                  ? 'Leaving classroom...'
                  : 'Leave classroom'
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.player-classroom-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.classroom-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.25rem;
  padding: 1.25rem 1.45rem;
  border-radius: 14px;
  border: 1px solid var(--color-violet-border);
  background: linear-gradient(135deg, var(--color-card) 0%, var(--color-violet-subtle) 100%);
  box-shadow: var(--shadow-purple);
}

.hero-identity {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.hero-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--btn-gradient);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--btn-rim-shadow);
}

.hero-text {
  min-width: 0;
}

.page-title {
  margin: 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.btn-secondary,
.btn-refresh,
.btn-danger-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0.5rem 1rem;
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-secondary:hover,
.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-danger-outline {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

.btn-danger-outline:hover:not(:disabled) {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger);
}

.btn-secondary:focus-visible,
.btn-refresh:focus-visible,
.btn-danger-outline:focus-visible,
.btn-retry:focus-visible,
.btn-retry-inline:focus-visible,
.flash-dismiss:focus-visible,
.modal-close-btn:focus-visible,
.btn-cancel:focus-visible,
.btn-confirm-leave:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-refresh:disabled,
.btn-danger-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.flash-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem;
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  border-radius: 10px;
  font-size: 0.92rem;
  font-weight: 600;
}

.flash-content {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.flash-icon {
  flex-shrink: 0;
}

.flash-dismiss {
  background: transparent;
  border: none;
  color: var(--color-success);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1.15rem;
}

.detail-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem 1.35rem;
  box-shadow: var(--shadow-purple-sm);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.detail-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple);
}

.detail-card.highlight-card {
  border-color: var(--color-violet-border);
  background: linear-gradient(180deg, var(--color-card) 0%, var(--color-purple-light) 100%);
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.detail-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.detail-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-family: var(--font-sans);
  font-size: 1.22rem;
  font-weight: 700;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.detail-value.highlight-primary {
  color: var(--color-primary);
  font-size: 1.65rem;
}

.optional-note {
  padding: 0.85rem 1.1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.note-icon {
  color: var(--color-primary);
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.members-section {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.35rem 1.5rem;
  box-shadow: var(--shadow-purple-sm);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.85rem;
}

.members-title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.members-count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 0.6rem;
  border-radius: 9999px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.members-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding: 0.85rem 1.05rem;
  border-radius: 11px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.member-row:hover {
  border-color: var(--color-violet-border);
}

.member-row.is-self {
  border-color: var(--color-violet-border);
  background: linear-gradient(90deg, var(--color-violet-subtle) 0%, var(--color-card) 70%);
}

.member-identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--btn-gradient);
  background-color: var(--color-primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--btn-rim-shadow);
}

.member-row.is-self .member-avatar {
  box-shadow:
    0 0 0 2px var(--color-card),
    0 0 0 4px var(--color-primary);
}

.member-name-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.member-username {
  font-weight: 700;
  color: var(--color-text-main);
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.self-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
}

.member-progress {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.38rem 0.75rem;
  border-radius: 9999px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
}

.stage-pips {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.stage-pip {
  width: 14px;
  height: 6px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  transition: background-color 0.2s ease;
}

.stage-pip.is-unlocked {
  background: var(--btn-gradient);
}

.progress-map-name {
  color: var(--color-text-main);
  font-size: 0.8rem;
  font-weight: 600;
}

.progress-ratio {
  color: var(--color-primary);
  font-size: 0.76rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skeleton-card {
  min-height: 92px;
  justify-content: center;
}

.skeleton-line {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle) 25%,
    var(--color-bg-muted) 50%,
    var(--color-bg-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 1.4s ease-in-out infinite;
}

.skeleton-sm {
  width: 42%;
  height: 12px;
}

.skeleton-md {
  width: 30%;
  height: 18px;
}

.skeleton-lg {
  width: 72%;
  height: 22px;
}

.skeleton-row {
  height: 58px;
  border-radius: 11px;
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle) 25%,
    var(--color-bg-muted) 50%,
    var(--color-bg-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 1.4s ease-in-out infinite;
}

@keyframes skeletonShimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 640px) {
  .classroom-hero {
    padding: 1.1rem;
  }

  .header-actions {
    width: 100%;
  }

  .btn-secondary,
  .btn-refresh,
  .btn-danger-outline {
    min-height: 44px;
    flex: 1 1 auto;
  }

  .members-section {
    padding: 1.1rem;
  }

  .member-progress {
    width: 100%;
    justify-content: space-between;
  }
}

.state-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow: var(--shadow-purple-sm);
}

.error-state {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.state-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.state-description {
  margin: 0;
  font-size: 0.92rem;
  max-width: 540px;
  line-height: 1.5;
}

.btn-retry {
  margin-top: 0.25rem;
  padding: 0.45rem 1rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1.5px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.inline-error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  border-radius: 8px;
  font-size: 0.88rem;
}

.btn-retry-inline {
  padding: 0.3rem 0.7rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

.modal-card {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-danger-border);
  border-radius: 12px;
  max-width: 460px;
  width: 100%;
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-danger);
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: inline-flex;
}

.modal-error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.modal-desc {
  margin: 0 0 1.4rem 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-cancel {
  min-height: 38px;
  padding: 0.5rem 1rem;
  background-color: var(--color-card);
  color: var(--color-text-main);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-leave {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0.5rem 1.1rem;
  background-color: var(--color-danger);
  color: #ffffff;
  border: 1.5px solid var(--color-danger);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel:disabled,
.btn-confirm-leave:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 34px;
  height: 34px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.icon-spin {
  animation: spin 0.9s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner,
  .icon-spin,
  .skeleton-line,
  .skeleton-row {
    animation: none !important;
  }

  .detail-card,
  .member-row {
    transition: none !important;
  }

  .detail-card:hover {
    transform: none !important;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
