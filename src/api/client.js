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

export default apiClient
