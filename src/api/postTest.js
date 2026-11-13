import apiClient from './client.js'

/**
 * Player Post-test API client.
 *
 * Uses paths relative to `apiClient.defaults.baseURL` (which already includes `/v1`).
 * Development-only preview helpers are dynamically imported only when
 * `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`.
 */

export const isPostTestBackendSupported = () => true

export const isPostTestMockEnabled = () =>
  Boolean(import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true')

/**
 * Check whether the authenticated player has unlocked the post-test
 * via a synced Public Park win.
 * Endpoint: GET /post-test/eligibility
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ eligible: boolean }>}
 */
export const fetchPostTestEligibility = async ({ signal } = {}) => {
  const response = await apiClient.get('/post-test/eligibility', { signal })
  return response.data
}

/**
 * Fetch the authenticated player's submitted post-test attempts, best score,
 * and overall pass status.
 * Endpoint: GET /post-test/attempts/me
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ passed: boolean, best: Object | null, attempts: Array }>}
 */
export const fetchMyPostTestAttempts = async ({ signal } = {}) => {
  const response = await apiClient.get('/post-test/attempts/me', { signal })
  return response.data
}

/**
 * Start a new 40-question post-test attempt, or resume the player's open attempt.
 * Endpoint: POST /post-test/attempts (empty body)
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   attempt_id: string,
 *   question_count: number,
 *   pass_mark_percent: number,
 *   resumed: boolean,
 *   questions: Array<{
 *     question_id: string,
 *     topic: string,
 *     question_text: string,
 *     options: Array<{ option_id: string, option_text: string }>
 *   }>
 * }>}
 */
export const startOrResumePostTestAttempt = async ({ signal } = {}) => {
  const response = await apiClient.post('/post-test/attempts', undefined, { signal })
  return response.data
}

/**
 * Submit all answers for an open post-test attempt.
 * Endpoint: POST /post-test/attempts/{attempt_id}/submit
 * @param {string} attemptId
 * @param {Array<{ question_id: string, option_id: string }>} answers
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   attempt_id: string,
 *   correct_count: number,
 *   question_count: number,
 *   score_percent: number,
 *   pass_mark_percent: number,
 *   passed: boolean,
 *   submitted_at: string,
 *   topics: Array<{ topic: string, correct: number, total: number }>
 * }>}
 */
export const submitPostTestAttemptAnswers = async (attemptId, answers, { signal } = {}) => {
  if (typeof attemptId !== 'string' || !attemptId.trim()) {
    throw new TypeError('attemptId must be a non-empty string')
  }
  const response = await apiClient.post(
    `/post-test/attempts/${encodeURIComponent(attemptId)}/submit`,
    { answers },
    { signal },
  )
  return response.data
}

/**
 * Fetch the graded result and topic breakdown for a submitted attempt.
 * Endpoint: GET /post-test/attempts/{attempt_id}
 * @param {string} attemptId
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export const fetchPostTestAttemptResult = async (attemptId, { signal } = {}) => {
  if (typeof attemptId !== 'string' || !attemptId.trim()) {
    throw new TypeError('attemptId must be a non-empty string')
  }
  const response = await apiClient.get(
    `/post-test/attempts/${encodeURIComponent(attemptId)}`,
    { signal },
  )
  return response.data
}

// ============================================================================
// Development-only preview helpers (excluded from production bundle)
// ============================================================================

const loadDevMockModule = async () => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    return await import('../mocks/postTestMockService.js')
  }
  return null
}

export const loadDevPreviewInProgress = async () => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) return null
  return mockMod.createMockInProgressPreviewAttempt()
}

export const loadDevPreviewOutcome = async ({ targetCorrectCount, attemptNumber }) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) return null
  return mockMod.createMockOutcomePreviewResult({
    targetCorrectCount,
    attemptNumber,
  })
}
