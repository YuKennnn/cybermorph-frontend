import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE (The Data)
  // ==========================================
  const token = ref(localStorage.getItem('cyber_token') || null)
  const user = ref(null)
  const userRole = ref(null)

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

      user.value = data.user || null
      userRole.value = data.user?.role || data.role || null

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
  }

  // ==========================================
  // 3. RETURN (Make them usable)
  // ==========================================
  return { token, user, userRole, login, logout, registerPlayer, registerWeb }
})