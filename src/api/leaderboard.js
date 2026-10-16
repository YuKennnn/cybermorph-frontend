import apiClient from './client'

/**
 * Fetch paginated leaderboard scores. Capped at top 50 per map.
 * Supported query params: map_name, page, page_size.
 * Endpoint: GET /leaderboard
 */
export const fetchLeaderboardData = async (params = {}) => {
  const response = await apiClient.get('/leaderboard', { params })
  return response.data
}
