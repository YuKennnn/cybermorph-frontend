import apiClient from './client'

/**
 * Authenticate user with credentials.
 * Endpoint: POST /auth/login
 * @param {Object} credentials - { email, password }
 * @returns {Promise<{ access_token: string, token_type: string }>}
 */
export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials)
  return response.data
}

/**
 * Register a new player account (game-side).
 * Endpoint: POST /auth/register
 * @param {Object} playerData - { email, username, password }
 * @returns {Promise<{ user_id: string, email: string, username: string }>}
 */
export const registerPlayerAccount = async (playerData) => {
  const response = await apiClient.post('/auth/register', playerData)
  return response.data
}

/**
 * Register a new web user (educator portal account).
 * Note: Email must end in @dnsc.edu.ph.
 * Endpoint: POST /auth/register-web
 * @param {Object} webUserData - { email, password }
 * @returns {Promise<{ user_id: string, email: string, approval_status: string }>}
 */
export const registerWebAccount = async (webUserData) => {
  const response = await apiClient.post('/auth/register-web', webUserData)
  return response.data
}

/**
 * Fetch authenticated web user profile (educator or admin).
 * Endpoint: GET /web-users/me
 * @returns {Promise<{ web_profile_id: string, user_id: string, email: string, role: string, display_name: string|null, portal_access: boolean, approval_status: string, last_login_at: string|null }>}
 */
export const fetchWebUserProfile = async () => {
  const response = await apiClient.get('/web-users/me')
  return response.data
}

/**
 * Fetch authenticated player's profile and progress telemetry.
 * Endpoint: GET /players/me
 * @returns {Promise<{ profile_id: string, user_id: string, username: string, map_progress: string|number }>}
 */
export const fetchPlayerProfile = async () => {
  const response = await apiClient.get('/players/me')
  return response.data
}

/**
 * Fetch canonical threat index telemetry for player.
 * Endpoint: GET /players/threat-index
 * @returns {Promise<Array<{ threat_name: string, is_unlocked: boolean, unlocked_at: string|null }>>}
 */
export const fetchThreatIndex = async () => {
  const response = await apiClient.get('/players/threat-index')
  return response.data
}
