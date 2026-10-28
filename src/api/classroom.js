import apiClient from './client.js'

/**
 * Fetch list of classrooms owned by the authenticated educator.
 * Endpoint: GET /classroom/my-codes
 */
export const fetchMyClassrooms = async () => {
  const response = await apiClient.get('/classroom/my-codes')
  return response.data
}

/**
 * Fetch paginated list of students enrolled in a classroom.
 * Endpoint: GET /classroom/{codeId}/students
 */
export const fetchClassroomStudents = async (codeId, params = {}) => {
  const response = await apiClient.get(`/classroom/${codeId}/students`, { params })
  return response.data
}

/**
 * Generate a new classroom code.
 * Endpoint: POST /classroom/generate
 */
export const generateClassroomCode = async (data) => {
  const response = await apiClient.post('/classroom/generate', data)
  return response.data
}

/**
 * Join a classroom using a code.
 * Endpoint: POST /classroom/join
 * @param {string|{ code_value: string }} codeOrPayload - 6-character classroom code
 * @returns {Promise<{ profile_id: string, code_id: string, name: string, joined_at: string }>}
 */
export const joinClassroom = async (codeOrPayload) => {
  const rawCode =
    typeof codeOrPayload === 'string'
      ? codeOrPayload
      : codeOrPayload?.code_value || codeOrPayload?.code || ''
  const normalizedCode = String(rawCode).replace(/[\s-]+/g, '').toUpperCase()
  const response = await apiClient.post('/classroom/join', { code_value: normalizedCode })
  return response.data
}

/**
 * Fetch the authenticated player's current classroom membership.
 * Endpoint: GET /classroom/mine
 * @returns {Promise<{
 *   code_id: string,
 *   name: string,
 *   educator_name: string | null,
 *   joined_at: string,
 *   member_count: number,
 *   members: Array<{ username: string, map_progress: number }>
 * }>}
 */
export const fetchMyClassroom = async () => {
  const response = await apiClient.get('/classroom/mine')
  return response.data
}

/**
 * Leave the authenticated player's current classroom.
 * Endpoint: DELETE /classroom/mine
 * @returns {Promise<void>}
 */
export const leaveMyClassroom = async () => {
  const response = await apiClient.delete('/classroom/mine')
  return response.data
}

/**
 * Update an existing classroom code.
 * Endpoint: PATCH /classroom/{codeId}
 */
export const updateClassroom = async (codeId, data) => {
  const response = await apiClient.patch(`/classroom/${codeId}`, data)
  return response.data
}

/**
 * Delete (soft delete) a classroom code.
 * Endpoint: DELETE /classroom/{codeId}
 */
export const deleteClassroom = async (codeId) => {
  const response = await apiClient.delete(`/classroom/${codeId}`)
  return response.data
}
