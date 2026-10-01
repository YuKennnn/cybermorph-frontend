import apiClient from './client'

/**
 * Fetch authenticated player's profile and progress telemetry.
 * Endpoint: GET /players/me
 */
export const fetchPlayerProfile = async () => {
  const response = await apiClient.get('/players/me')
  return response.data
}

/**
 * Fetch player's unlocked threat categories index.
 * Endpoint: GET /players/threat-index
 */
export const fetchThreatIndex = async () => {
  const response = await apiClient.get('/players/threat-index')
  return response.data
}
