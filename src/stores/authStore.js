import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE (The Data)
  // ==========================================
  const token = ref(localStorage.getItem('cyber_token') || null)

  const getInitialUser = () => {
    try {
      const rawUser = localStorage.getItem('cyber_user')
      return rawUser ? JSON.parse(rawUser) : null
    } catch {
      return null
    }
  }
  const initialUser = getInitialUser()
  const user = ref(initialUser)

  const storedRole = localStorage.getItem('cyber_role') || initialUser?.role || null
  const userRole = ref(storedRole)

  // ==========================================
  // 2. ACTIONS (The Functions that change the Data)
  // ==========================================
  const login = async (credentials) => {
    try {
      const response = await apiClient.post('/auth/login', credentials)
      const data = response.data

      const authToken = data.access_token || data.token
      token.value = authToken
      localStorage.setItem('cyber_token', authToken)

      const extractedUser = data.user || {
        email: credentials.email,
        username: credentials.email?.split('@')[0] || 'User',
      }
      const extractedRole =
        data.user?.role ||
        data.role ||
        (credentials.email?.includes('admin')
          ? 'admin'
          : credentials.email?.includes('educator')
            ? 'educator'
            : 'player')

      user.value = extractedUser
      userRole.value = extractedRole

      localStorage.setItem('cyber_user', JSON.stringify(extractedUser))
      localStorage.setItem('cyber_role', extractedRole)

      return data
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const registerPlayer = async (playerData) => {
    try {
      const response = await apiClient.post('/auth/register', playerData)
      return response.data
    } catch (error) {
      console.error('Player registration failed:', error)
      throw error
    }
  }

  const registerWeb = async (webUserData) => {
    try {
      const response = await apiClient.post('/auth/register-web', webUserData)
      return response.data
    } catch (error) {
      console.error('Web registration failed:', error)
      throw error
    }
  }

  const logout = () => {
    token.value = null
    user.value = null
    userRole.value = null
    localStorage.removeItem('cyber_token')
    localStorage.removeItem('cyber_user')
    localStorage.removeItem('cyber_role')
  }

  // ==========================================
  // 3. RETURN (Make them usable)
  // ==========================================
  return { token, user, userRole, login, logout, registerPlayer, registerWeb }
})