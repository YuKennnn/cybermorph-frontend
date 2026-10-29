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

/**
 * Fetch paginated list of all live classrooms across educators.
 * Endpoint: GET /admin/classrooms
 * @param {Object} [params] - Query parameters
 * @param {string} [params.search] - Search term across classroom name, join code, or owner email
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.page_size=20] - Number of items per page
 * @returns {Promise<{ items: Array, total_count: number, page: number, page_size: number }>}
 */
export const fetchAdminClassrooms = async (params = {}) => {
  const response = await apiClient.get('/admin/classrooms', { params })
  return response.data
}

/**
 * Switch a classroom's student enrollment status on or off as an administrator.
 * Endpoint: PATCH /admin/classrooms/{codeId}
 * Only `{ is_active }` is accepted by the backend (`StrictBool`, `extra="forbid"`).
 * @param {string} codeId - UUID of the classroom (`code_id`)
 * @param {boolean} isActive - Strict boolean enrollment state (`true` = open, `false` = closed)
 * @returns {Promise<Object>} Updated `AdminClassroomResponse`
 */
export const updateAdminClassroomStatus = async (codeId, isActive) => {
  if (typeof codeId !== 'string' || !codeId.trim()) {
    throw new TypeError('Classroom codeId must be a non-empty string')
  }
  if (typeof isActive !== 'boolean') {
    throw new TypeError('isActive must be a boolean')
  }
  const response = await apiClient.patch(
    `/admin/classrooms/${encodeURIComponent(codeId)}`,
    { is_active: isActive },
  )
  return response.data
}

/**
 * Soft-delete any educator's classroom as an administrator.
 * Endpoint: DELETE /admin/classrooms/{codeId}
 * @param {string} codeId - UUID of the classroom (`code_id`)
 * @returns {Promise<void>} Resolves on 204 No Content
 */
export const deleteAdminClassroom = async (codeId) => {
  if (typeof codeId !== 'string' || !codeId.trim()) {
    throw new TypeError('Classroom codeId must be a non-empty string')
  }
  await apiClient.delete(`/admin/classrooms/${encodeURIComponent(codeId)}`)
}

/**
 * Fetch paginated audit log of administrative, account, and classroom activities.
 * Endpoint: GET /admin/logs
 * @param {Object} [params] - Query parameters
 * @param {string} [params.action_type] - Filter by ActionType
 * @param {string} [params.user_id] - Filter by actor UUID
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.page_size=20] - Number of items per page
 * @returns {Promise<{ items: Array, total_count: number, page: number, page_size: number }>}
 */
export const fetchAdminLogs = async (params = {}) => {
  const query = {}
  if (params.action_type) query.action_type = params.action_type
  if (params.user_id) query.user_id = params.user_id
  if (params.page !== undefined) query.page = params.page
  if (params.page_size !== undefined) query.page_size = params.page_size

  const response = await apiClient.get('/admin/logs', { params: query })
  return response.data
}
