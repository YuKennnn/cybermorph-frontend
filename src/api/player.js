import apiClient from './client'

/**
 * Fetch authenticated player's profile and progress telemetry.
 * Endpoint: GET /players/me
 */
export const fetchPlayerProfile = async () => {
  const response = await apiClient.get('/players/me')
  return response.data
}
