import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './authStore.js'
import { classifyApiError, extractErrorMessage } from '../api/client.js'
import {
  isPostTestBackendSupported,
  isPostTestMockEnabled,
  fetchPostTestEligibility,
  fetchMyPostTestAttempts,
  startOrResumePostTestAttempt,
  submitPostTestAttemptAnswers,
  fetchPostTestAttemptResult,
  loadDevPreviewInProgress,
  loadDevPreviewOutcome,
} from '../api/postTest.js'

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

const mapAttemptSummary = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    attemptId: String(raw.attempt_id),
    correctCount: Number(raw.correct_count ?? 0),
    questionCount: Number(raw.question_count ?? 0),
    scorePercent: Number(raw.score_percent ?? 0),
    passMarkPercent: Number(raw.pass_mark_percent ?? 75),
    passed: Boolean(raw.passed),
    submittedAt: raw.submitted_at || null,
  }
}

const mapAttemptResult = (raw) => {
  const summary = mapAttemptSummary(raw)
  if (!summary) return null
  const topics = Array.isArray(raw.topics)
    ? raw.topics.map((t) => ({
        topic: String(t.topic || ''),
        correct: Number(t.correct ?? 0),
        total: Number(t.total ?? 0),
        percentage:
          Number(t.total) > 0 ? Math.round((Number(t.correct ?? 0) / Number(t.total)) * 100) : 0,
      }))
    : []
  return {
    ...summary,
    topics,
  }
}

const mapStartedAttempt = (raw, existingAnswers = null) => {
  const questions = Array.isArray(raw?.questions)
    ? raw.questions.map((q, index) => ({
        id: String(q.question_id),
        displayNumber: index + 1,
        topic: String(q.topic || ''),
        questionText: String(q.question_text || ''),
        options: Array.isArray(q.options)
          ? q.options.map((opt) => ({
              id: String(opt.option_id),
              text: String(opt.option_text || ''),
            }))
          : [],
      }))
    : []

  const preservedAnswers = {}
  if (existingAnswers && typeof existingAnswers === 'object') {
    for (const q of questions) {
      const picked = existingAnswers[q.id]
      if (picked && q.options.some((opt) => opt.id === picked)) {
        preservedAnswers[q.id] = picked
      }
    }
  }

  return {
    attemptId: String(raw.attempt_id),
    questionCount: Number(raw.question_count ?? questions.length),
    passMarkPercent: Number(raw.pass_mark_percent ?? 75),
    resumed: Boolean(raw.resumed),
    currentIndex: 0,
    questions,
    answers: preservedAnswers,
  }
}

export const usePostTestStore = defineStore('postTest', () => {
  const authStore = useAuthStore()

  // ==========================================
  // 1. STATE
  // ==========================================
  const status = ref('idle') // 'idle' | 'loading' | 'locked' | 'available' | 'in-progress' | 'review' | 'results' | 'error'
  const eligible = ref(null) // null | boolean
  const overallPassed = ref(false)
  const bestAttempt = ref(null)
  const attemptHistory = ref([])
  const currentAttempt = ref(null)
  const activeResult = ref(null)
  const previewMode = ref('auto')
  const errorMessage = ref('')
  const inlineActionError = ref('')
  const historyWarning = ref('')
  const isSubmitting = ref(false)
  const isStarting = ref(false)
  const isLoadingResult = ref(false)
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

  const answeredCount = computed(() => {
    const attempt = currentAttempt.value
    if (!attempt || !attempt.answers) return 0
    return attempt.questions.reduce(
      (count, q) => (attempt.answers[q.id] ? count + 1 : count),
      0,
    )
  })

  const allQuestionsAnswered = computed(() => {
    const attempt = currentAttempt.value
    if (!attempt || !Array.isArray(attempt.questions) || attempt.questions.length === 0) {
      return false
    }
    return answeredCount.value === attempt.questions.length
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
    if (status.value === 'loading' || status.value === 'idle') {
      return 'loading'
    }
    if (status.value === 'error' && eligible.value === null) {
      return 'error'
    }
    if (eligible.value === false || status.value === 'locked') {
      return 'locked'
    }
    if (bestAttempt.value || attemptHistory.value.length > 0) {
      return 'results'
    }
    return 'ready'
  })

  const isRequestStillValid = (reqId, epochAtStart, scopeAtStart) =>
    reqId === requestSeq &&
    epochAtStart === authStore.activeSessionEpoch &&
    getCurrentAccountScope() === scopeAtStart

  const mergeAttemptIntoSummary = (summaryEntry) => {
    if (!summaryEntry) return
    if (summaryEntry.passed) overallPassed.value = true
    if (!attemptHistory.value.some((a) => a.attemptId === summaryEntry.attemptId)) {
      attemptHistory.value = [summaryEntry, ...attemptHistory.value]
    }
    if (
      !bestAttempt.value ||
      summaryEntry.scorePercent > bestAttempt.value.scorePercent ||
      (summaryEntry.scorePercent === bestAttempt.value.scorePercent &&
        summaryEntry.correctCount > bestAttempt.value.correctCount)
    ) {
      bestAttempt.value = summaryEntry
    }
  }

  const mapFriendlyApiError = (err, fallbackMessage) => {
    const httpStatus = err?.response?.status
    const detail = extractErrorMessage(err)

    if (httpStatus === 503) {
      return 'The post-test is not available right now while the question bank is being prepared. Please try again later.'
    }
    if (httpStatus === 403) {
      if (detail && detail.toLowerCase().includes('not a player')) {
        return 'Post-test assessments are available for player accounts only.'
      }
      return 'Finish and sync a Public Park win in the game to unlock the post-test.'
    }
    if (httpStatus === 404) {
      return 'This post-test attempt could not be found. Please start or load your current assessment again.'
    }
    if (httpStatus === 422) {
      return 'Please ensure every question has a selected answer before submitting.'
    }
    if (classifyApiError(err) === 'timeout') {
      return 'The server is taking longer than expected to respond. Please try again.'
    }
    return fallbackMessage
  }

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const syncAccountScope = () => {
    const nextScope = getCurrentAccountScope()
    if (nextScope === activeAccountScope.value) {
      return nextScope
    }
    requestSeq += 1
    activeAccountScope.value = nextScope
    status.value = 'idle'
    eligible.value = null
    overallPassed.value = false
    bestAttempt.value = null
    attemptHistory.value = []
    currentAttempt.value = null
    activeResult.value = null
    previewMode.value = 'auto'
    errorMessage.value = ''
    inlineActionError.value = ''
    historyWarning.value = ''
    isSubmitting.value = false
    isStarting.value = false
    isLoadingResult.value = false
    return nextScope
  }

  const reset = () => {
    requestSeq += 1
    activeAccountScope.value = null
    status.value = 'idle'
    eligible.value = null
    overallPassed.value = false
    bestAttempt.value = null
    attemptHistory.value = []
    currentAttempt.value = null
    activeResult.value = null
    previewMode.value = 'auto'
    errorMessage.value = ''
    inlineActionError.value = ''
    historyWarning.value = ''
    isSubmitting.value = false
    isStarting.value = false
    isLoadingResult.value = false
  }

  const refreshAttemptsHistory = async ({ reqId, epochAtStart, scopeAtStart } = {}) => {
    const data = await fetchMyPostTestAttempts()
    if (reqId !== undefined && !isRequestStillValid(reqId, epochAtStart, scopeAtStart)) {
      return false
    }
    overallPassed.value = Boolean(data?.passed)
    bestAttempt.value = mapAttemptSummary(data?.best)
    attemptHistory.value = Array.isArray(data?.attempts)
      ? data.attempts.map(mapAttemptSummary).filter(Boolean)
      : []
    return true
  }

  const loadOverview = async ({ force = false } = {}) => {
    const scopeAtStart = syncAccountScope()
    if (!scopeAtStart || !authStore.isPlayer) {
      status.value = 'idle'
      return
    }

    if (!force && (status.value === 'in-progress' || status.value === 'review')) {
      return
    }

    if (
      isDevMock.value &&
      !force &&
      previewMode.value !== 'auto' &&
      status.value !== 'idle'
    ) {
      return
    }

    const reqId = ++requestSeq
    const epochAtStart = authStore.activeSessionEpoch
    status.value = 'loading'
    errorMessage.value = ''
    inlineActionError.value = ''
    historyWarning.value = ''

    try {
      const eligibilityRes = await fetchPostTestEligibility()
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return

      const isEligible = Boolean(eligibilityRes?.eligible)
      eligible.value = isEligible

      if (!isEligible) {
        overallPassed.value = false
        bestAttempt.value = null
        attemptHistory.value = []
        currentAttempt.value = null
        activeResult.value = null
        status.value = 'locked'
        return
      }

      const ok = await refreshAttemptsHistory({ reqId, epochAtStart, scopeAtStart })
      if (!ok) return

      if (activeResult.value && status.value === 'results' && !force) {
        status.value = 'results'
      } else {
        status.value = 'available'
      }
    } catch (err) {
      if (classifyApiError(err) === 'canceled') return
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return

      if (err?.response?.status === 403) {
        const detail = extractErrorMessage(err)
        if (!detail.toLowerCase().includes('not a player')) {
          eligible.value = false
          status.value = 'locked'
          return
        }
      }

      errorMessage.value = mapFriendlyApiError(
        err,
        'Could not load post-test readiness right now. Please try again.',
      )
      status.value = 'error'
    }
  }

  const startAttempt = async () => {
    if (isStarting.value) return false

    const scopeAtStart = syncAccountScope()
    if (!scopeAtStart || !authStore.isPlayer) return false

    const epochAtStart = authStore.activeSessionEpoch
    const reqId = ++requestSeq
    isStarting.value = true
    errorMessage.value = ''
    inlineActionError.value = ''
    historyWarning.value = ''

    try {
      const existingAttempt = currentAttempt.value
      const started = await startOrResumePostTestAttempt()
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false

      const sameAttempt =
        existingAttempt && existingAttempt.attemptId === String(started.attempt_id)
      const mapped = mapStartedAttempt(started, sameAttempt ? existingAttempt.answers : null)
      if (sameAttempt && typeof existingAttempt.currentIndex === 'number') {
        mapped.currentIndex = Math.min(
          mapped.questions.length - 1,
          Math.max(0, existingAttempt.currentIndex),
        )
      }

      activeResult.value = null
      currentAttempt.value = mapped
      eligible.value = true
      status.value = 'in-progress'
      return true
    } catch (err) {
      if (classifyApiError(err) === 'canceled') return false
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false

      const httpStatus = err?.response?.status
      if (httpStatus === 403) {
        const detail = extractErrorMessage(err)
        if (!detail.toLowerCase().includes('not a player')) {
          eligible.value = false
          currentAttempt.value = null
          status.value = 'locked'
          return false
        }
      }

      inlineActionError.value = mapFriendlyApiError(
        err,
        'Unable to start the post-test right now. Please try again.',
      )
      if (status.value !== 'available' && status.value !== 'results') {
        errorMessage.value = inlineActionError.value
        status.value = 'error'
      }
      return false
    } finally {
      if (reqId === requestSeq) {
        isStarting.value = false
      }
    }
  }

  const selectAnswer = (questionId, optionId) => {
    if (!currentAttempt.value || (status.value !== 'in-progress' && status.value !== 'review')) {
      return
    }
    inlineActionError.value = ''
    currentAttempt.value = {
      ...currentAttempt.value,
      answers: {
        ...currentAttempt.value.answers,
        [questionId]: String(optionId),
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
    inlineActionError.value = ''
    status.value = 'review'
  }

  const backToQuiz = () => {
    if (!currentAttempt.value) return
    inlineActionError.value = ''
    status.value = 'in-progress'
  }

  const submitAttempt = async () => {
    if (!currentAttempt.value || isSubmitting.value) return false
    if (!allQuestionsAnswered.value) {
      inlineActionError.value = 'Please answer every question before submitting your post-test.'
      return false
    }

    const scopeAtStart = getCurrentAccountScope()
    const epochAtStart = authStore.activeSessionEpoch
    const attemptSnapshot = currentAttempt.value
    const reqId = ++requestSeq

    isSubmitting.value = true
    inlineActionError.value = ''
    historyWarning.value = ''

    const payloadAnswers = attemptSnapshot.questions.map((q) => ({
      question_id: q.id,
      option_id: attemptSnapshot.answers[q.id],
    }))

    try {
      const submitted = await submitPostTestAttemptAnswers(
        attemptSnapshot.attemptId,
        payloadAnswers,
      )
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false

      activeResult.value = mapAttemptResult(submitted)
      currentAttempt.value = null
      mergeAttemptIntoSummary(activeResult.value)
      status.value = 'results'

      // Refresh history in background without hiding the graded result if refresh fails
      try {
        await refreshAttemptsHistory({ reqId, epochAtStart, scopeAtStart })
      } catch {
        if (isRequestStillValid(reqId, epochAtStart, scopeAtStart)) {
          historyWarning.value =
            'Your score was saved, but your overall attempt history could not be refreshed right now.'
        }
      }
      return true
    } catch (err) {
      if (classifyApiError(err) === 'canceled') return false
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false

      const httpStatus = err?.response?.status

      // 409: Attempt already submitted -> recover by fetching its graded result
      if (httpStatus === 409) {
        try {
          const recovered = await fetchPostTestAttemptResult(attemptSnapshot.attemptId)
          if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false
          activeResult.value = mapAttemptResult(recovered)
          currentAttempt.value = null
          mergeAttemptIntoSummary(activeResult.value)
          status.value = 'results'
          try {
            await refreshAttemptsHistory({ reqId, epochAtStart, scopeAtStart })
          } catch {
            if (isRequestStillValid(reqId, epochAtStart, scopeAtStart)) {
              historyWarning.value =
                'Recovered your submitted result, but overall history could not be refreshed right now.'
            }
          }
          return true
        } catch {
          // Fall through to inline error if recovery lookup fails
        }
      }

      // 404: Stale open attempt -> discard open attempt without losing existing history
      if (httpStatus === 404) {
        currentAttempt.value = null
        inlineActionError.value =
          'This open attempt is no longer active on the server. Please start a new attempt.'
        status.value = 'available'
        try {
          await refreshAttemptsHistory({ reqId, epochAtStart, scopeAtStart })
        } catch {
          // Keep existing history intact
        }
        return false
      }

      // 403: Ineligible
      if (httpStatus === 403) {
        const detail = extractErrorMessage(err)
        if (!detail.toLowerCase().includes('not a player')) {
          eligible.value = false
          currentAttempt.value = null
          status.value = 'locked'
          return false
        }
      }

      // 422 / 503 / Network: keep in-memory picks intact on review screen
      inlineActionError.value = mapFriendlyApiError(
        err,
        'Unable to submit your post-test right now. Your selected answers are still preserved here—please try again.',
      )
      return false
    } finally {
      if (reqId === requestSeq) {
        isSubmitting.value = false
      }
    }
  }

  const viewAttemptResult = async (attemptId) => {
    if (!attemptId || isLoadingResult.value) return false
    const scopeAtStart = syncAccountScope()
    if (!scopeAtStart || !authStore.isPlayer) return false

    const epochAtStart = authStore.activeSessionEpoch
    const reqId = ++requestSeq
    isLoadingResult.value = true
    inlineActionError.value = ''
    historyWarning.value = ''

    try {
      const detail = await fetchPostTestAttemptResult(attemptId)
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false
      activeResult.value = mapAttemptResult(detail)
      status.value = 'results'
      return true
    } catch (err) {
      if (classifyApiError(err) === 'canceled') return false
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart)) return false
      inlineActionError.value = mapFriendlyApiError(
        err,
        'Could not load that submitted attempt right now. Please try again.',
      )
      return false
    } finally {
      if (reqId === requestSeq) {
        isLoadingResult.value = false
      }
    }
  }

  const backToOverview = () => {
    inlineActionError.value = ''
    historyWarning.value = ''
    activeResult.value = null
    status.value = eligible.value === false ? 'locked' : 'available'
  }

  const retakeAttempt = async () => {
    if (isDevMock.value && (previewMode.value === 'passed' || previewMode.value === 'failed')) {
      previewMode.value = 'auto'
    }
    return await startAttempt()
  }

  const retryLoad = async () => {
    if (isDevMock.value && (previewMode.value === 'error' || previewMode.value === 'loading')) {
      previewMode.value = 'auto'
    }
    await loadOverview({ force: true })
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
    inlineActionError.value = ''
    historyWarning.value = ''

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
      activeResult.value = null
      eligible.value = false
      overallPassed.value = false
      bestAttempt.value = null
      attemptHistory.value = []
      status.value = 'locked'
      return
    }

    if (normalized === 'available') {
      currentAttempt.value = null
      activeResult.value = null
      eligible.value = true
      status.value = 'available'
      return
    }

    if (normalized === 'in-progress') {
      const mockAttempt = await loadDevPreviewInProgress()
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart) || !mockAttempt) return
      eligible.value = true
      activeResult.value = null
      currentAttempt.value = {
        attemptId: mockAttempt.attemptId,
        questionCount: mockAttempt.totalQuestions,
        passMarkPercent: 75,
        resumed: false,
        currentIndex: mockAttempt.currentIndex || 0,
        questions: mockAttempt.questions.map((q) => ({
          id: q.id,
          displayNumber: q.displayNumber,
          topic: q.threat_name,
          questionText: q.question,
          options: q.choices.map((c) => ({ id: c.id, text: c.text })),
        })),
        answers: { ...mockAttempt.answers },
      }
      status.value = 'in-progress'
      return
    }

    if (normalized === 'passed' || normalized === 'failed') {
      const targetCorrectCount = normalized === 'passed' ? 32 : 29
      const previewOutcome = await loadDevPreviewOutcome({
        targetCorrectCount,
        attemptNumber: normalized === 'passed' ? 2 : 1,
      })
      if (!isRequestStillValid(reqId, epochAtStart, scopeAtStart) || !previewOutcome) return
      eligible.value = true
      currentAttempt.value = null
      const res = previewOutcome.result
      const mappedResult = {
        attemptId: res.attemptId,
        correctCount: res.correctCount,
        questionCount: res.totalCount,
        scorePercent: res.percentage,
        passMarkPercent: 75,
        passed: res.passed,
        submittedAt: res.submittedAt,
        topics: (res.categoryBreakdown || []).map((c) => ({
          topic: c.threat_name,
          correct: c.correct,
          total: c.asked,
          percentage: c.percentage ?? 0,
        })),
      }
      activeResult.value = mappedResult
      overallPassed.value = res.passed
      bestAttempt.value = mappedResult
      attemptHistory.value = [mappedResult]
      status.value = 'results'
      return
    }

    currentAttempt.value = null
    activeResult.value = null
    await loadOverview({ force: true })
  }

  return {
    status,
    eligible,
    overallPassed,
    bestAttempt,
    attemptHistory,
    currentAttempt,
    activeResult,
    previewMode,
    errorMessage,
    inlineActionError,
    historyWarning,
    isSubmitting,
    isStarting,
    isLoadingResult,
    isDevMock,
    isBackendSupported,
    isActionSupported,
    answeredCount,
    allQuestionsAnswered,
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
    viewAttemptResult,
    backToOverview,
    retakeAttempt,
    retryLoad,
  }
})
