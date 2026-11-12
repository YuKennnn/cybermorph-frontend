import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './authStore.js'
import { fetchPlayerProfile } from '../api/player.js'
import { classifyApiError } from '../api/client.js'
import {
  isPostTestBackendSupported,
  isPostTestMockEnabled,
  loadPostTestOverview,
  startPostTestAttempt,
  startPreviewInProgressAttempt,
  submitPostTestAttempt,
  buildPreviewOutcome,
  clearAllMockPostTestState,
} from '../api/postTest.js'

const EMPTY_SCORE_SUMMARY = () => ({
  attemptCount: 0,
  firstScore: null,
  latestScore: null,
  bestScore: null,
})

const VALID_PREVIEW_MODES = new Set([
  'auto',
  'locked',
  'available',
  'in-progress',
  'passed',
  'failed',
  'loading',
  'error',
])

export const usePostTestStore = defineStore('postTest', () => {
  const authStore = useAuthStore()

  // ==========================================
  // 1. STATE
  // ==========================================
  const status = ref(isPostTestMockEnabled() ? 'idle' : 'unavailable')
  const eligibility = ref(null)
  const currentAttempt = ref(null)
  const lastResult = ref(null)
  const scoreSummary = ref(EMPTY_SCORE_SUMMARY())
  const previewMode = ref('auto')
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  const isStarting = ref(false)
  const activeAccountScope = ref(null)

  let requestSeq = 0

  // ==========================================
  // 2. HELPERS & GETTERS
  // ==========================================
  const isDevMock = computed(() => isPostTestMockEnabled())
  const isBackendSupported = computed(() => isPostTestBackendSupported())
  const isActionSupported = computed(() => isDevMock.value || isBackendSupported.value)

  const getCurrentAccountScope = () => {
    if (!authStore.token || !authStore.isPlayer) return null
    const id =
      authStore.user?.user_id ||
      authStore.user?.profile_id ||
      authStore.user?.email ||
      authStore.user?.username ||
      'player'
    return `${authStore.activeSessionEpoch}::${authStore.token}::${id}`
  }

  const getMockAccountKey = () => {
    if (!authStore.isPlayer || !authStore.token) return null
    return (
      authStore.user?.user_id ||
      authStore.user?.profile_id ||
      authStore.user?.email ||
      authStore.token
    )
  }

  const answeredCount = computed(() => {
    const attempt = currentAttempt.value
    if (!attempt || !attempt.answers) return 0
    return attempt.questions.reduce(
      (count, q) => (attempt.answers[q.id] ? count + 1 : count),
      0,
    )
  })

  const unansweredQuestionNumbers = computed(() => {
    const attempt = currentAttempt.value
    if (!attempt || !Array.isArray(attempt.questions)) return []
    return attempt.questions
      .filter((q) => !attempt.answers?.[q.id])
      .map((q) => q.displayNumber)
  })

  const currentQuestion = computed(() => {
    const attempt = currentAttempt.value
    if (!attempt || !Array.isArray(attempt.questions)) return null
    return attempt.questions[attempt.currentIndex] || null
  })

  const overviewCardState = computed(() => {
    if (!isActionSupported.value || status.value === 'unavailable') {
      return 'unavailable'
    }
    if (status.value === 'loading' || status.value === 'idle') {
      return 'loading'
    }
    if (status.value === 'error') {
      return 'error'
    }
    if (status.value === 'locked') {
      return 'locked'
    }
    if (currentAttempt.value && (status.value === 'in-progress' || status.value === 'review')) {
      return 'in-progress'
    }
    if (scoreSummary.value.attemptCount > 0 || lastResult.value) {
      return 'completed'
    }
    return 'available'
  })

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const syncAccountScope = () => {
    const nextScope = getCurrentAccountScope()
    if (nextScope === activeAccountScope.value) {
      return nextScope
    }
    if (isPostTestMockEnabled()) {
      clearAllMockPostTestState().catch(() => {})
    }
    requestSeq += 1
    activeAccountScope.value = nextScope
    status.value = isPostTestMockEnabled() ? 'idle' : 'unavailable'
    eligibility.value = null
    currentAttempt.value = null
    lastResult.value = null
    scoreSummary.value = EMPTY_SCORE_SUMMARY()
    previewMode.value = 'auto'
    errorMessage.value = ''
    isSubmitting.value = false
    isStarting.value = false
    return nextScope
  }

  const reset = () => {
    requestSeq += 1
    activeAccountScope.value = null
    status.value = isPostTestMockEnabled() ? 'idle' : 'unavailable'
    eligibility.value = null
    currentAttempt.value = null
    lastResult.value = null
    scoreSummary.value = EMPTY_SCORE_SUMMARY()
    previewMode.value = 'auto'
    errorMessage.value = ''
    isSubmitting.value = false
    isStarting.value = false
    if (isPostTestMockEnabled()) {
      clearAllMockPostTestState().catch(() => {})
    }
  }

  const loadOverview = async ({ force = false, playerProfile = null } = {}) => {
    const scopeAtStart = syncAccountScope()
    if (!scopeAtStart || !authStore.isPlayer) {
      status.value = isPostTestMockEnabled() ? 'idle' : 'unavailable'
      return
    }

    if (!isPostTestMockEnabled() && !isPostTestBackendSupported()) {
      status.value = 'unavailable'
      eligibility.value = null
      currentAttempt.value = null
      lastResult.value = null
      scoreSummary.value = EMPTY_SCORE_SUMMARY()
      return
    }

    // Preserve active quiz/review state across background overview refreshes unless forced
    if (!force && (status.value === 'in-progress' || status.value === 'review')) {
      return
    }

    // Respect explicit preview state on soft revisits unless forced
    if (
      !force &&
      previewMode.value !== 'auto' &&
      (status.value === 'locked' ||
        status.value === 'available' ||
        status.value === 'results' ||
        status.value === 'loading' ||
        status.value === 'error')
    ) {
      return
    }

    const reqId = ++requestSeq
    const epochAtStart = authStore.activeSessionEpoch
    const accountKey = getMockAccountKey()
    status.value = 'loading'
    errorMessage.value = ''

    try {
      let resolvedProfile = playerProfile
      if (!resolvedProfile && previewMode.value === 'auto') {
        try {
          resolvedProfile = await fetchPlayerProfile()
        } catch (profileErr) {
          if (classifyApiError(profileErr) === 'canceled') return
          if (
            reqId !== requestSeq ||
            epochAtStart !== authStore.activeSessionEpoch ||
            getCurrentAccountScope() !== scopeAtStart
          ) {
            return
          }
          throw profileErr
        }
      }

      const payload = await loadPostTestOverview({
        accountKey,
        playerProfile: resolvedProfile || authStore.user,
        previewMode: previewMode.value,
      })

      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return
      }

      if (!payload.mockEnabled && !payload.backendSupported) {
        status.value = 'unavailable'
        return
      }

      eligibility.value = payload.eligibility
      scoreSummary.value = payload.scoreSummary || EMPTY_SCORE_SUMMARY()
      lastResult.value = payload.lastResult || null

      if (payload.status === 'locked') {
        status.value = 'locked'
      } else if (payload.lastResult && scoreSummary.value.attemptCount > 0 && status.value === 'results') {
        status.value = 'results'
      } else {
        status.value = 'available'
      }
    } catch (err) {
      if (classifyApiError(err) === 'canceled') return
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return
      }
      errorMessage.value =
        err?.message || 'Could not load post-test readiness right now. Please try again.'
      status.value = 'error'
    }
  }

  /**
   * Dev-only preview mode switcher (`locked`, `available`, `in-progress`, `passed`, `failed`, `loading`, `error`, or `auto`).
   * Blocked immediately outside development mock mode.
   */
  const setDevPreviewMode = async (nextMode) => {
    if (!isPostTestMockEnabled()) return
    const normalized = VALID_PREVIEW_MODES.has(nextMode) ? nextMode : 'auto'
    previewMode.value = normalized

    const scopeAtStart = syncAccountScope()
    const epochAtStart = authStore.activeSessionEpoch
    const reqId = ++requestSeq
    errorMessage.value = ''

    if (normalized === 'loading') {
      currentAttempt.value = null
      status.value = 'loading'
      return
    }

    if (normalized === 'error') {
      currentAttempt.value = null
      errorMessage.value =
        'Simulated error state: Unable to retrieve post-test status or scoring data.'
      status.value = 'error'
      return
    }

    if (normalized === 'locked') {
      currentAttempt.value = null
      lastResult.value = null
      await loadOverview({ force: true })
      return
    }

    if (normalized === 'available') {
      currentAttempt.value = null
      lastResult.value = null
      await loadOverview({ force: true })
      return
    }

    if (normalized === 'in-progress') {
      const accountKey = getMockAccountKey()
      const overview = await loadPostTestOverview({
        accountKey,
        playerProfile: authStore.user,
        previewMode: 'in-progress',
      })
      const attempt = await startPreviewInProgressAttempt()
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return
      }
      eligibility.value = overview.eligibility
      scoreSummary.value = overview.scoreSummary || EMPTY_SCORE_SUMMARY()
      lastResult.value = null
      currentAttempt.value = attempt
      status.value = 'in-progress'
      return
    }

    if (normalized === 'passed' || normalized === 'failed') {
      const targetCorrectCount = normalized === 'passed' ? 25 : 22
      const previewOutcome = await buildPreviewOutcome({
        targetCorrectCount,
        attemptNumber: normalized === 'passed' ? 2 : 1,
        firstScoreOverride:
          normalized === 'passed'
            ? {
                attemptNumber: 1,
                correctCount: 19,
                totalCount: 30,
                percentage: 63.3,
                passed: false,
                submittedAt: new Date(Date.now() - 86400000).toISOString(),
              }
            : {
                attemptNumber: 1,
                correctCount: 22,
                totalCount: 30,
                percentage: 73.3,
                passed: false,
                submittedAt: new Date().toISOString(),
              },
      })
      if (
        !previewOutcome ||
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return
      }
      const overview = await loadPostTestOverview({
        accountKey: getMockAccountKey(),
        playerProfile: authStore.user,
        previewMode: normalized,
      })
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return
      }
      eligibility.value = overview.eligibility
      currentAttempt.value = null
      lastResult.value = previewOutcome.result
      scoreSummary.value = previewOutcome.scoreSummary
      status.value = 'results'
      return
    }

    // 'auto': restore real mock account state
    currentAttempt.value = null
    await loadOverview({ force: true })
  }

  const startAttempt = async () => {
    if (!isPostTestMockEnabled() && !isPostTestBackendSupported()) {
      status.value = 'unavailable'
      return false
    }
    if (!eligibility.value?.unlocked) {
      return false
    }
    if (isStarting.value) return false

    const scopeAtStart = getCurrentAccountScope()
    const epochAtStart = authStore.activeSessionEpoch
    const reqId = ++requestSeq
    isStarting.value = true
    errorMessage.value = ''

    try {
      const attempt = await startPostTestAttempt()
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return false
      }
      lastResult.value = null
      currentAttempt.value = attempt
      status.value = 'in-progress'
      return true
    } catch (err) {
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return false
      }
      errorMessage.value = err?.message || 'Unable to start post-test attempt.'
      status.value = 'error'
      return false
    } finally {
      isStarting.value = false
    }
  }

  const selectAnswer = (questionId, choiceId) => {
    if (!currentAttempt.value || (status.value !== 'in-progress' && status.value !== 'review')) {
      return
    }
    currentAttempt.value = {
      ...currentAttempt.value,
      answers: {
        ...currentAttempt.value.answers,
        [questionId]: String(choiceId),
      },
    }
  }

  const goToQuestion = (index) => {
    if (!currentAttempt.value) return
    const max = currentAttempt.value.questions.length - 1
    const safeIdx = Math.max(0, Math.min(max, Number(index) || 0))
    currentAttempt.value = {
      ...currentAttempt.value,
      currentIndex: safeIdx,
    }
    status.value = 'in-progress'
  }

  const nextQuestion = () => {
    if (!currentAttempt.value) return
    const nextIdx = currentAttempt.value.currentIndex + 1
    if (nextIdx >= currentAttempt.value.questions.length) {
      status.value = 'review'
      return
    }
    goToQuestion(nextIdx)
  }

  const prevQuestion = () => {
    if (!currentAttempt.value) return
    if (currentAttempt.value.currentIndex > 0) {
      goToQuestion(currentAttempt.value.currentIndex - 1)
    }
  }

  const openReview = () => {
    if (!currentAttempt.value) return
    status.value = 'review'
  }

  const backToQuiz = () => {
    if (!currentAttempt.value) return
    status.value = 'in-progress'
  }

  const submitAttempt = async () => {
    if (!isPostTestMockEnabled() && !isPostTestBackendSupported()) {
      status.value = 'unavailable'
      return false
    }
    if (!currentAttempt.value || isSubmitting.value) return false

    const scopeAtStart = getCurrentAccountScope()
    const epochAtStart = authStore.activeSessionEpoch
    const accountKey = getMockAccountKey()
    const attemptSnapshot = currentAttempt.value
    const reqId = ++requestSeq

    isSubmitting.value = true
    errorMessage.value = ''

    try {
      const scored = await submitPostTestAttempt({
        accountKey,
        attempt: attemptSnapshot,
        answersMap: attemptSnapshot.answers,
      })
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return false
      }
      lastResult.value = scored.result
      scoreSummary.value = scored.scoreSummary
      currentAttempt.value = null
      status.value = 'results'
      return true
    } catch (err) {
      if (
        reqId !== requestSeq ||
        epochAtStart !== authStore.activeSessionEpoch ||
        getCurrentAccountScope() !== scopeAtStart
      ) {
        return false
      }
      errorMessage.value = err?.message || 'Unable to submit post-test answers right now.'
      status.value = 'error'
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  const retakeAttempt = async () => {
    if (previewMode.value === 'passed' || previewMode.value === 'failed') {
      previewMode.value = 'available'
    }
    return await startAttempt()
  }

  const retryLoad = async () => {
    if (previewMode.value === 'error' || previewMode.value === 'loading') {
      previewMode.value = 'auto'
    }
    await loadOverview({ force: true })
  }

  return {
    status,
    eligibility,
    currentAttempt,
    lastResult,
    scoreSummary,
    previewMode,
    errorMessage,
    isSubmitting,
    isStarting,
    isDevMock,
    isBackendSupported,
    isActionSupported,
    answeredCount,
    unansweredQuestionNumbers,
    currentQuestion,
    overviewCardState,
    syncAccountScope,
    reset,
    loadOverview,
    setDevPreviewMode,
    startAttempt,
    selectAnswer,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    openReview,
    backToQuiz,
    submitAttempt,
    retakeAttempt,
    retryLoad,
  }
})
