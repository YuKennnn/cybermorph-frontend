import apiClient from './client'

/**
 * Submit or finalize a player game session.
 * Endpoint: POST /sessions
 *
 * @param {Object} sessionData
 * @param {string} sessionData.session_id - Client-generated UUID string
 * @param {'Home'|'Office'|'Internet Cafe'|'Public Park'} sessionData.map_name
 * @param {number} sessionData.duration_seconds
 * @param {number} sessionData.credits_earned
 * @param {number} sessionData.credits_lost
 * @param {number} sessionData.false_positives
 * @param {'win'|'lose'|'timeout'} sessionData.result
 * @param {string} sessionData.played_at - ISO 8601 string WITH timezone offset or 'Z' suffix
 * @returns {Promise<{ session: Object, map_progress: number }>}
 */
export const submitSession = async (sessionData) => {
  // Ensure played_at includes a timezone offset / Z suffix
  const playedAt = sessionData.played_at || new Date().toISOString()
  const payload = {
    ...sessionData,
    session_id: sessionData.session_id || crypto.randomUUID(),
    played_at: playedAt,
  }
  const response = await apiClient.post('/sessions', payload)
  return response.data
}

/**
 * Fetch paginated history of game sessions for authenticated player.
 * Endpoint: GET /sessions/history
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.page_size=20]
 * @returns {Promise<{ items: Array<Object>, total_count: number, page: number, page_size: number }>}
 */
export const fetchSessionHistory = async (params = {}) => {
  const response = await apiClient.get('/sessions/history', { params })
  return response.data
}
