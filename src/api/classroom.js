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
