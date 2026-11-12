import questionsBank from '../../docs/post-test/questions.json'
import answerKeyData from '../../docs/post-test/answer-key.json'
import {
  selectPostTestQuestions,
  evaluatePostTestScore,
  buildCategoryBreakdown,
  POST_TEST_CONFIG,
} from '../utils/postTestEngine.js'

const ANSWERS_BY_QUESTION_ID = new Map(
  (Array.isArray(answerKeyData?.answers) ? answerKeyData.answers : []).map((entry) => [
    String(entry.question_id),
    {
      correctChoiceId: String(entry.correct_choice_id),
      explanation: String(entry.explanation || ''),
    },
  ]),
)

const EMPTY_SCORE_SUMMARY = Object.freeze({
  attemptCount: 0,
  firstScore: null,
  latestScore: null,
  bestScore: null,
})

const accountLedgers = new Map()
let mockAttemptCounter = 0

const getOrCreateAccountLedger = (accountKey) => {
  const safeKey = accountKey || 'anonymous-mock'
  if (!accountLedgers.has(safeKey)) {
    accountLedgers.set(safeKey, {
      attemptCount: 0,
      firstScore: null,
      latestScore: null,
      bestScore: null,
      lastResult: null,
    })
  }
  return accountLedgers.get(safeKey)
}

const cloneScoreSummary = (ledger) => {
  if (!ledger || ledger.attemptCount <= 0) {
    return { ...EMPTY_SCORE_SUMMARY }
  }
  return {
    attemptCount: ledger.attemptCount,
    firstScore: ledger.firstScore ? { ...ledger.firstScore } : null,
    latestScore: ledger.latestScore ? { ...ledger.latestScore } : null,
    bestScore: ledger.bestScore ? { ...ledger.bestScore } : null,
  }
}

export const clearMockPostTestAccountData = (accountKey) => {
  if (accountKey) {
    accountLedgers.delete(accountKey)
  }
}

export const clearAllMockPostTestState = () => {
  accountLedgers.clear()
  mockAttemptCounter = 0
}

/**
 * Evaluates simulated post-test eligibility for development preview.
 * IMPORTANT: `map_progress === 3` means Public Park is unlocked, NOT completed.
 * Eligibility requires completing Public Park by reaching its required Security Credits.
 */
export const resolveMockEligibility = (playerProfile, { previewMode = 'auto' } = {}) => {
  const rawProgress = playerProfile?.map_progress
  const validMapProgress =
    typeof rawProgress === 'number' &&
    Number.isInteger(rawProgress) &&
    rawProgress >= 0 &&
    rawProgress <= 3
      ? rawProgress
      : null

  const publicParkUnlocked = validMapProgress === 3
  const explicitlyCompletedCredits = Boolean(
    playerProfile?.public_park_completed === true || playerProfile?.post_test_eligible === true,
  )

  if (previewMode === 'locked') {
    return {
      unlocked: false,
      completedPublicParkCredits: false,
      publicParkUnlocked,
      mapProgress: validMapProgress,
      requirementText:
        'Complete the Public Park stage by reaching its required Security Credits in CyberMorph.',
    }
  }

  if (
    previewMode === 'available' ||
    previewMode === 'in-progress' ||
    previewMode === 'passed' ||
    previewMode === 'failed'
  ) {
    return {
      unlocked: true,
      completedPublicParkCredits: true,
      publicParkUnlocked: true,
      mapProgress: 3,
      requirementText: 'Public Park Security Credits requirement met (development preview).',
    }
  }

  return {
    unlocked: explicitlyCompletedCredits,
    completedPublicParkCredits: explicitlyCompletedCredits,
    publicParkUnlocked,
    mapProgress: validMapProgress,
    requirementText:
      'Complete the Public Park stage by reaching its required Security Credits in CyberMorph.',
  }
}

export const fetchMockPostTestOverview = async ({
  accountKey,
  playerProfile,
  previewMode = 'auto',
}) => {
  await new Promise((resolve) => setTimeout(resolve, 60))

  if (previewMode === 'error') {
    throw new Error('Simulated mock failure while loading post-test details.')
  }

  const ledger = getOrCreateAccountLedger(accountKey)
  const eligibility = resolveMockEligibility(playerProfile, { previewMode })

  if (!eligibility.unlocked) {
    return {
      backendSupported: false,
      mockEnabled: true,
      status: 'locked',
      eligibility,
      scoreSummary: cloneScoreSummary(ledger),
      lastResult: ledger.lastResult ? { ...ledger.lastResult } : null,
    }
  }

  return {
    backendSupported: false,
    mockEnabled: true,
    status: 'available',
    eligibility,
    scoreSummary: cloneScoreSummary(ledger),
    lastResult: ledger.lastResult ? { ...ledger.lastResult } : null,
  }
}

export const createMockPostTestAttempt = (rng = Math.random) => {
  mockAttemptCounter += 1
  const questions = selectPostTestQuestions(questionsBank.questions, rng)
  return {
    attemptId: `mock-attempt-${mockAttemptCounter}-${Date.now()}`,
    startedAt: new Date().toISOString(),
    totalQuestions: POST_TEST_CONFIG.totalQuestions,
    questions,
    currentIndex: 0,
    answers: {},
  }
}

/**
 * Generates an in-progress preview attempt with the first 6 items answered so reviewers can inspect
 * active navigation, answered counts, and unanswered highlighting immediately.
 */
export const createMockInProgressPreviewAttempt = (rng = Math.random) => {
  const attempt = createMockPostTestAttempt(rng)
  const sampleAnswers = {}
  for (let i = 0; i < 6 && i < attempt.questions.length; i += 1) {
    const q = attempt.questions[i]
    if (q.choices[0]) {
      sampleAnswers[q.id] = q.choices[i % q.choices.length].id
    }
  }
  return {
    ...attempt,
    currentIndex: 5,
    answers: sampleAnswers,
  }
}

export const scoreMockPostTestAttempt = ({
  accountKey,
  attempt,
  answersMap,
  recordInLedger = true,
}) => {
  if (!attempt || !Array.isArray(attempt.questions) || attempt.questions.length === 0) {
    throw new Error('Cannot score an empty post-test attempt.')
  }

  let correctCount = 0
  const reviewedItems = attempt.questions.map((question) => {
    const answerMeta = ANSWERS_BY_QUESTION_ID.get(question.id)
    const selectedChoiceId = answersMap?.[question.id] ? String(answersMap[question.id]) : null
    const correctChoiceId = answerMeta ? answerMeta.correctChoiceId : null
    const isCorrect = Boolean(selectedChoiceId && correctChoiceId && selectedChoiceId === correctChoiceId)
    if (isCorrect) {
      correctCount += 1
    }

    const selectedChoice = question.choices.find((c) => c.id === selectedChoiceId) || null
    const correctChoice = question.choices.find((c) => c.id === correctChoiceId) || null

    return {
      id: question.id,
      displayNumber: question.displayNumber,
      threat_name: question.threat_name,
      question: question.question,
      selectedChoiceId,
      selectedChoiceText: selectedChoice ? selectedChoice.text : null,
      correctChoiceId,
      correctChoiceText: correctChoice ? correctChoice.text : '',
      isCorrect,
      explanation: answerMeta?.explanation || '',
    }
  })

  const evaluation = evaluatePostTestScore(correctCount, attempt.questions.length)
  const categoryBreakdown = buildCategoryBreakdown(reviewedItems)
  const submittedAt = new Date().toISOString()

  let scoreSummary = { ...EMPTY_SCORE_SUMMARY }

  if (recordInLedger) {
    const ledger = getOrCreateAccountLedger(accountKey)
    ledger.attemptCount += 1
    const attemptRecord = {
      attemptNumber: ledger.attemptCount,
      correctCount: evaluation.correctCount,
      totalCount: evaluation.totalCount,
      percentage: evaluation.percentage,
      passed: evaluation.passed,
      submittedAt,
    }
    if (!ledger.firstScore) {
      ledger.firstScore = attemptRecord
    }
    ledger.latestScore = attemptRecord
    if (!ledger.bestScore || attemptRecord.correctCount > ledger.bestScore.correctCount) {
      ledger.bestScore = attemptRecord
    }

    const resultPayload = {
      attemptId: attempt.attemptId,
      attemptNumber: ledger.attemptCount,
      submittedAt,
      isPreviewPreset: false,
      ...evaluation,
      categoryBreakdown,
      items: reviewedItems,
    }
    ledger.lastResult = resultPayload
    scoreSummary = cloneScoreSummary(ledger)
    return {
      result: resultPayload,
      scoreSummary,
    }
  }

  return {
    result: {
      attemptId: attempt.attemptId,
      attemptNumber: null,
      submittedAt,
      isPreviewPreset: true,
      ...evaluation,
      categoryBreakdown,
      items: reviewedItems,
    },
    scoreSummary,
  }
}

/**
 * Generates an instant preview result with exact target score count (e.g. 25/30 passed or 22/30 failed)
 * without polluting real interactive ledger history unless requested.
 */
export const createMockOutcomePreviewResult = ({
  targetCorrectCount,
  attemptNumber = 2,
  firstScoreOverride = {
    attemptNumber: 1,
    correctCount: 19,
    totalCount: 30,
    percentage: 63.3,
    passed: false,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
}) => {
  const attempt = createMockPostTestAttempt()
  const answersMap = {}
  const boundedCorrect = Math.max(0, Math.min(attempt.questions.length, targetCorrectCount))

  attempt.questions.forEach((question, index) => {
    const key = ANSWERS_BY_QUESTION_ID.get(question.id)
    if (!key) return
    if (index < boundedCorrect) {
      answersMap[question.id] = key.correctChoiceId
    } else {
      const wrongChoice = question.choices.find((c) => c.id !== key.correctChoiceId)
      if (wrongChoice) {
        answersMap[question.id] = wrongChoice.id
      }
    }
  })

  const { result } = scoreMockPostTestAttempt({
    accountKey: null,
    attempt,
    answersMap,
    recordInLedger: false,
  })

  const currentScoreSummaryItem = {
    attemptNumber,
    correctCount: result.correctCount,
    totalCount: result.totalCount,
    percentage: result.percentage,
    passed: result.passed,
    submittedAt: result.submittedAt,
  }

  const bestScore =
    firstScoreOverride.correctCount > currentScoreSummaryItem.correctCount
      ? firstScoreOverride
      : currentScoreSummaryItem

  return {
    result: {
      ...result,
      attemptNumber,
      isPreviewPreset: true,
    },
    scoreSummary: {
      attemptCount: attemptNumber,
      firstScore: firstScoreOverride,
      latestScore: currentScoreSummaryItem,
      bestScore,
    },
  }
}
