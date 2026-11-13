import apiClient from './client.js'

/**
 * Admin Post-test reporting API client.
 *
 * Uses paths relative to `apiClient.defaults.baseURL` (which already includes `/v1`).
 * All endpoints require an authenticated `admin` bearer token.
 */

/**
 * Fetch the aggregate post-test summary for the admin Overview card.
 * Endpoint: GET /admin/post-test/summary
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   pass_mark_percent: number,
 *   eligible_players: number,
 *   players_attempted: number,
 *   players_passed: number,
 *   pass_rate_percent: number | null,
 *   finished_attempts: number,
 *   anonymous_attempts: number,
 *   average_best_score_percent: number | null,
 *   topics: Array<{ topic: string, correct: number, total: number, accuracy_percent: number }>
 * }>}
 */
export const fetchAdminPostTestSummary = async ({ signal } = {}) => {
  const response = await apiClient.get('/admin/post-test/summary', { signal })
  return response.data
}

/**
 * Fetch paginated post-test results (one row per player with a submitted attempt,
 * ordered most recent finisher first).
 * Endpoint: GET /admin/post-test/results
 * @param {Object} [params]
 * @param {boolean | null} [params.passed=null] - Omit for all; `true` for passed; `false` for not passed
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.pageSize=20] - Page size (1–100)
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{
 *   items: Array<{
 *     profile_id: string,
 *     username: string,
 *     attempts: number,
 *     best_attempt_id: string,
 *     best_correct_count: number,
 *     question_count: number,
 *     best_score_percent: number,
 *     passed: boolean,
 *     last_submitted_at: string
 *   }>,
 *   total_count: number,
 *   page: number,
 *   page_size: number
 * }>}
 */
export const fetchAdminPostTestResults = async ({
  passed = null,
  page = 1,
  pageSize = 20,
  signal,
} = {}) => {
  const params = {
    page,
    page_size: pageSize,
  }
  if (typeof passed === 'boolean') {
    params.passed = passed
  }

  const response = await apiClient.get('/admin/post-test/results', {
    params,
    signal,
  })
  return response.data
}

/**
 * Fetch a single player's post-test summary and submitted attempts (newest first).
 * Endpoint: GET /admin/post-test/players/{profile_id}
 * @param {string} profileId - Player profile UUID
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   profile_id: string,
 *   username: string,
 *   passed: boolean,
 *   best: {
 *     attempt_id: string,
 *     correct_count: number,
 *     question_count: number,
 *     score_percent: number,
 *     pass_mark_percent: number,
 *     passed: boolean,
 *     submitted_at: string
 *   } | null,
 *   attempts: Array<{
 *     attempt_id: string,
 *     correct_count: number,
 *     question_count: number,
 *     score_percent: number,
 *     pass_mark_percent: number,
 *     passed: boolean,
 *     submitted_at: string,
 *     topics: Array<{ topic: string, correct: number, total: number }>
 *   }>
 * }>}
 */
export const fetchAdminPostTestPlayerResult = async (profileId, { signal } = {}) => {
  if (typeof profileId !== 'string' || !profileId.trim()) {
    throw new TypeError('Player profileId must be a non-empty string')
  }
  const response = await apiClient.get(
    `/admin/post-test/players/${encodeURIComponent(profileId.trim())}`,
    { signal },
  )
  return response.data
}
