import apiClient from './client.js'

/**
 * Fetch authenticated player's profile and progress telemetry.
 * Endpoint: GET /players/me
 */
export const fetchPlayerProfile = async (config = {}) => {
  const response = await apiClient.get('/players/me', config)
  return response.data
}

/**
 * Fetch player's unlocked threat categories index.
 * Endpoint: GET /players/threat-index
 */
export const fetchThreatIndex = async (config = {}) => {
  const response = await apiClient.get('/players/threat-index', config)
  return response.data
}
