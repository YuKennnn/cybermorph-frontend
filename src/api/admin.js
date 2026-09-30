import apiClient from './client'

/**
 * Fetch system administration metrics and event logs.
 * Endpoint: GET /admin/stats
 */
export const fetchAdminStats = async () => {
  const response = await apiClient.get('/admin/stats')
  return response.data
}
