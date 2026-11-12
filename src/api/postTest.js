/**
 * Post-test integration boundary.
 *
 * The FastAPI backend does not currently provide assessment endpoints.
 * Simulated eligibility, 30-question attempts, scoring, explanations, and preview states
 * are strictly isolated behind Vite's dev-mock gate so nothing from the answer key or
 * mock harness enters the production bundle (`vite build`).
 */

export const isPostTestBackendSupported = () => false

export const isPostTestMockEnabled = () =>
  Boolean(import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true')

const loadDevMockModule = async () => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    return await import('../mocks/postTestMockService.js')
  }
  return null
}

export const loadPostTestOverview = async ({
  accountKey,
  playerProfile,
  previewMode = 'auto',
} = {}) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    return {
      backendSupported: false,
      mockEnabled: false,
      status: 'unavailable',
      eligibility: null,
      scoreSummary: {
        attemptCount: 0,
        firstScore: null,
        latestScore: null,
        bestScore: null,
      },
      lastResult: null,
    }
  }
  return await mockMod.fetchMockPostTestOverview({
    accountKey,
    playerProfile,
    previewMode,
  })
}

export const startPostTestAttempt = async () => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    throw new Error(
      'Post-test assessments cannot be started because backend support is not available yet.',
    )
  }
  return mockMod.createMockPostTestAttempt()
}

export const startPreviewInProgressAttempt = async () => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    throw new Error('Development preview is only available in development mock mode.')
  }
  return mockMod.createMockInProgressPreviewAttempt()
}

export const submitPostTestAttempt = async ({ accountKey, attempt, answersMap }) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    throw new Error(
      'Post-test answers cannot be submitted because backend support is not available yet.',
    )
  }
  return mockMod.scoreMockPostTestAttempt({
    accountKey,
    attempt,
    answersMap,
    recordInLedger: true,
  })
}

export const buildPreviewOutcome = async ({ targetCorrectCount, attemptNumber, firstScoreOverride }) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    return null
  }
  return mockMod.createMockOutcomePreviewResult({
    targetCorrectCount,
    attemptNumber,
    firstScoreOverride,
  })
}

export const clearMockPostTestAccountData = async (accountKey) => {
  const mockMod = await loadDevMockModule()
  if (mockMod) {
    mockMod.clearMockPostTestAccountData(accountKey)
  }
}

export const clearAllMockPostTestState = async () => {
  const mockMod = await loadDevMockModule()
  if (mockMod) {
    mockMod.clearAllMockPostTestState()
  }
}
