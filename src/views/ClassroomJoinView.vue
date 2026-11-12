<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { joinClassroom } from '../api/classroom.js'
import { useAuthStore } from '../stores/authStore.js'
import { usePlayerClassroomStore } from '../stores/playerClassroomStore.js'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const playerClassroomStore = usePlayerClassroomStore()

const classroomCode = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

const syncRedirectIfNeeded = () => {
  const redirectTarget = playerClassroomStore.resolveRedirectForPath('/classroom/join')
  if (redirectTarget && redirectTarget !== '/classroom/join') {
    router.replace(redirectTarget)
    return true
  }
  return false
}

const verifyMembershipState = async ({ force = false } = {}) => {
  playerClassroomStore.syncAccountScope()
  if (syncRedirectIfNeeded()) return

  try {
    await playerClassroomStore.loadMembership({ force })
  } catch {
    // Error state is managed in playerClassroomStore
  }
  syncRedirectIfNeeded()
}

const handleRetryMembershipCheck = () => {
  if (playerClassroomStore.isLoading || playerClassroomStore.isRefreshing) return
  verifyMembershipState({ force: true })
}

const handleJoinClassroom = async () => {
  if (isSubmitting.value || !playerClassroomStore.isUnenrolled) return

  const normalizedCode = classroomCode.value.replace(/[\s-]+/g, '').toUpperCase()
  if (!normalizedCode) {
    errorMessage.value = 'Please enter a 6-character classroom code.'
    return
  }
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    errorMessage.value = 'Classroom codes must be 6 alphanumeric characters.'
    return
  }

  const scopeAtStart = playerClassroomStore.syncAccountScope()
  isSubmitting.value = true
  errorMessage.value = ''
  playerClassroomStore.clearFlashMessage()

  try {
    const data = await joinClassroom(normalizedCode)
    if (playerClassroomStore.syncAccountScope() !== scopeAtStart || !authStore.token) {
      return
    }

    classroomCode.value = ''
    await playerClassroomStore.completeJoin(data)
    await router.replace('/classroom')
  } catch (error) {
    if (playerClassroomStore.syncAccountScope() !== scopeAtStart || !authStore.token) {
      return
    }

    const status = error?.response?.status
    const rawDetail = error?.response?.data?.detail
    const nestedMessage =
      rawDetail && typeof rawDetail === 'object' ? rawDetail.message : null
    const plainDetail = typeof rawDetail === 'string' ? rawDetail : null
    const serverMessage = nestedMessage || plainDetail || ''

    if (status === 404) {
      errorMessage.value =
        serverMessage ||
        'Classroom access code not found. Please verify the code with your educator.'
    } else if (status === 409) {
      const lower = serverMessage.toLowerCase()
      if (lower.includes('already in a classroom') || lower.includes('already joined')) {
        try {
          await playerClassroomStore.loadMembership({ force: true })
        } catch {
          // Handled by store
        }
        if (syncRedirectIfNeeded()) return
      }
      errorMessage.value =
        serverMessage ||
        'Unable to join this classroom. You may already be enrolled or the classroom is inactive.'
    } else {
      errorMessage.value =
        serverMessage || 'Unable to join classroom right now. Please try again.'
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleBack = () => {
  router.push('/dashboard')
}

watch(
  () => [
    playerClassroomStore.status,
    playerClassroomStore.joinSucceededRefreshFailed,
  ],
  () => {
    syncRedirectIfNeeded()
  },
)

watch(
  () => [authStore.token, authStore.user?.user_id, authStore.user?.email],
  ([newToken], [oldToken]) => {
    if (!newToken) {
      playerClassroomStore.reset()
      return
    }
    if (newToken !== oldToken) {
      errorMessage.value = ''
      classroomCode.value = ''
      verifyMembershipState({ force: true })
    }
  },
)

onMounted(() => {
  verifyMembershipState()
})
</script>

<template>
  <div class="join-page">
    <div class="join-card">
      <div class="card-header">
        <button type="button" class="back-link" @click="handleBack">
          <AppIcon name="arrow-left" :size="14" />
          <span>Overview</span>
        </button>
        <div class="join-title-row">
          <div class="join-icon" aria-hidden="true">
            <AppIcon name="key" :size="20" />
          </div>
          <h1 class="title">
            {{
              playerClassroomStore.isUnenrolled ? 'Join classroom' : 'Classroom'
            }}
          </h1>
        </div>
        <p class="subtitle">
          Enter the 6-character access code provided by your educator to link your account to a classroom. Independent gameplay is always available without joining a classroom.
        </p>
      </div>

      <!-- Brief Status Banner (e.g. after leaving a classroom) -->
      <div
        v-if="playerClassroomStore.flashMessage"
        class="status-banner"
        role="status"
        aria-live="polite"
      >
        <div class="status-banner-text">
          <AppIcon name="check" :size="18" />
          <span>{{ playerClassroomStore.flashMessage }}</span>
        </div>
        <button
          type="button"
          class="banner-dismiss"
          aria-label="Dismiss notification"
          @click="playerClassroomStore.clearFlashMessage()"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>

      <!-- Membership Check Loading State -->
      <div
        v-if="
          playerClassroomStore.isLoading ||
          playerClassroomStore.status === 'idle'
        "
        class="checking-skeleton"
        role="status"
        aria-live="polite"
        aria-label="Checking classroom membership"
      >
        <div class="skeleton-line skeleton-label"></div>
        <div class="skeleton-input"></div>
        <div class="skeleton-btn"></div>
      </div>

      <!-- Membership Check Error State (Never defaults to Join Form on error) -->
      <div
        v-else-if="playerClassroomStore.status === 'error'"
        class="error-banner membership-error"
        role="alert"
      >
        <p class="error-title">
          {{
            playerClassroomStore.joinSucceededRefreshFailed
              ? 'Joined successfully; classroom details could not load'
              : 'Unable to verify classroom membership'
          }}
        </p>
        <p class="error-desc">
          {{
            playerClassroomStore.error ||
            'Could not check your current classroom status. Please try again.'
          }}
        </p>
        <button
          type="button"
          class="btn-retry"
          :disabled="
            playerClassroomStore.isLoading || playerClassroomStore.isRefreshing
          "
          @click="handleRetryMembershipCheck"
        >
          {{
            playerClassroomStore.isLoading || playerClassroomStore.isRefreshing
              ? 'Retrying...'
              : 'Try again'
          }}
        </button>
      </div>

      <!-- Confirmed Unenrolled Join Form -->
      <template v-else-if="playerClassroomStore.isUnenrolled">
        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <form novalidate @submit.prevent="handleJoinClassroom">
          <div class="form-group">
            <label for="code-input">6-character access code</label>
            <input
              id="code-input"
              v-model="classroomCode"
              type="text"
              placeholder="CYB101"
              maxlength="10"
              required
              autocomplete="off"
              :disabled="isSubmitting"
              @input="errorMessage = ''"
            />
            <span class="help-text">
              Access codes are 6-character case-insensitive codes. Spaces and dashes are ignored.
            </span>
          </div>

          <button
            type="submit"
            class="btn-primary"
            :disabled="isSubmitting"
            :aria-busy="isSubmitting ? 'true' : 'false'"
          >
            <AppIcon
              v-if="isSubmitting"
              name="loader"
              :size="18"
              class="icon-spin"
            />
            <span>{{
              isSubmitting ? 'Joining classroom...' : 'Join classroom'
            }}</span>
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.join-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
  padding: 2rem 1.5rem;
  box-sizing: border-box;
}

.join-card {
  width: 100%;
  max-width: 480px;
  margin: auto;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem;
  box-shadow: var(--shadow-purple);
}

@media (max-width: 640px) {
  .join-page {
    padding: 1rem 0.5rem;
  }

  .join-card {
    padding: 1.5rem 1.25rem;
  }
}

@media (min-width: 1600px) {
  .join-page {
    align-items: flex-start;
    padding-top: clamp(2.5rem, 8vh, 5rem);
    padding-bottom: 2.5rem;
  }

  .join-card {
    max-width: 500px;
    margin: 0 auto;
    padding: 2.5rem;
  }
}

.card-header {
  margin-bottom: 1.5rem;
}

.back-link {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.38rem 0.8rem;
  margin-bottom: 1.15rem;
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.back-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-violet-subtle);
}

.back-link:focus-visible,
.btn-primary:focus-visible,
.btn-retry:focus-visible,
.banner-dismiss:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.join-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.join-icon {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: var(--btn-gradient);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--btn-rim-shadow);
}

.title {
  margin: 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  padding: 0.85rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.status-banner-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.banner-dismiss {
  background: transparent;
  border: none;
  color: var(--color-success);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: inline-flex;
}

.checking-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.skeleton-line,
.skeleton-input,
.skeleton-btn {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle) 25%,
    var(--color-bg-muted) 50%,
    var(--color-bg-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 1.4s ease-in-out infinite;
}

.skeleton-label {
  width: 45%;
  height: 14px;
}

.skeleton-input {
  width: 100%;
  height: 54px;
}

.skeleton-btn {
  width: 100%;
  height: 44px;
  margin-top: 0.5rem;
}

@keyframes skeletonShimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.4rem;
}

input {
  padding: 0.85rem 1rem;
  background-color: var(--color-bg);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 1.35rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: center;
  font-weight: 700;
  color: var(--color-primary);
  outline: none;
  transition: all 0.2s ease;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.help-text {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  text-align: center;
}

.btn-primary {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--btn-gradient);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}

.membership-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.error-title {
  margin: 0;
  font-weight: 700;
}

.error-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
}

.btn-retry {
  margin-top: 0.25rem;
  padding: 0.4rem 0.85rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1.5px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.icon-spin {
  animation: spin 0.9s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .icon-spin,
  .skeleton-line,
  .skeleton-input,
  .skeleton-btn {
    animation: none !important;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
