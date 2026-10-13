import apiClient from './client.js'

/**
 * Fetch system administration metrics.
 * Endpoint: GET /admin/stats
 * @returns {Promise<{ total_users: number, sessions_last_24h: number, threats_detected: number, uptime_seconds: number }>}
 */
export const fetchAdminStats = async () => {
  const response = await apiClient.get('/admin/stats')
  return response.data
}

/**
 * Fetch paginated list of all registered user accounts.
 * Endpoint: GET /admin/users
 * @param {Object} params - Query parameters
 * @param {string} [params.role] - Filter by role ('player', 'educator', 'admin')
 * @param {string} [params.search] - Search term across email, username, or display_name
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.page_size=20] - Number of items per page
 * @returns {Promise<{ items: Array, total_count: number, page: number, page_size: number }>}
 */
export const fetchAdminUsers = async (params = {}) => {
  const response = await apiClient.get('/admin/users', { params })
  return response.data
}

/**
 * Fetch paginated list of educator registrations requiring approval.
 * Endpoint: GET /admin/approvals
 * @param {Object} params - Query parameters
 * @param {string} [params.status='pending'] - Filter by status ('pending', 'approved', 'rejected')
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.page_size=20] - Number of items per page
 * @returns {Promise<{ items: Array, total_count: number, page: number, page_size: number }>}
 */
export const fetchAdminApprovals = async (params = {}) => {
  const response = await apiClient.get('/admin/approvals', { params })
  return response.data
}

/**
 * Authorize an educator account for web portal access.
 * Endpoint: POST /admin/approvals/{userId}/approve
 * @param {string} userId - UUID of the user to approve
 * @returns {Promise<{ user_id: string, email: string, approval_status: string, created_at: string }>}
 */
export const approveEducator = async (userId) => {
  const response = await apiClient.post(`/admin/approvals/${userId}/approve`)
  return response.data
}

/**
 * Reject an educator account from web portal access.
 * Endpoint: POST /admin/approvals/{userId}/reject
 * @param {string} userId - UUID of the user to reject
 * @returns {Promise<{ user_id: string, email: string, approval_status: string, created_at: string }>}
 */
export const rejectEducator = async (userId) => {
  const response = await apiClient.post(`/admin/approvals/${userId}/reject`)
  return response.data
}
