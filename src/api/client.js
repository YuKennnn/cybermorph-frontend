import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://cybermorph-backend.onrender.com',
})

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cyber_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If receiving 401 on a protected call (not during the initial login attempt)
    const isLoginEndpoint = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('cyber_token')
      localStorage.removeItem('cyber_user')
      localStorage.removeItem('cyber_role')
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

/**
 * Extracts a safe, user-friendly error message from FastAPI and network errors.
 * Handles flat detail strings (401, 403, 404), nested 409 conflict objects,
 * and 422 validation error arrays.
 */
export const extractErrorMessage = (error, defaultMessage = 'An unexpected error occurred.') => {
  if (!error) return defaultMessage

  // Network or server wake-up/timeout failure
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Connection timed out. The server may still be waking up — please try again.'
    }
    if (error.message === 'Network Error') {
      return 'Unable to reach backend server. Please verify your connection or CORS settings.'
    }
    return error.message || 'Unable to connect to the server.'
  }

  const data = error.response.data
  if (!data) return defaultMessage

  // Flat detail string (401, 403, 404)
  if (typeof data.detail === 'string') {
    return data.detail
  }

  // Nested detail object (409 conflict: { detail: { field, message } })
  if (data.detail && typeof data.detail === 'object') {
    if (data.detail.message) {
      return data.detail.message
    }
    // Validation error array (422: [{ loc, msg, type }])
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const firstError = data.detail[0]
      if (firstError?.msg) {
        return firstError.msg
      }
    }
  }

  return defaultMessage
}

export default apiClient
