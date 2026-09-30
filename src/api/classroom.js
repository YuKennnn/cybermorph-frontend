import apiClient from './client'

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
 */
export const joinClassroom = async (code) => {
  const response = await apiClient.post('/classroom/join', { code })
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
