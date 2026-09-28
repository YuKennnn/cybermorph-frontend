import axios from 'axios'

const apiClient = axios.create({
  // baseURL: import.meta.env.VITE_API_BASE_URL || '',
  baseURL: 'https://cybermorph-backend.onrender.com',
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
    return Promise.reject(error)
  },
)

export default apiClient
