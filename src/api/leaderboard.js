import apiClient from './client'

/**
 * Fetch paginated leaderboard records with optional map filtering and search.
 * Endpoint: GET /leaderboard
 */
export const fetchLeaderboardData = async (params = {}) => {
  const response = await apiClient.get('/leaderboard', { params })
  return response.data
}
