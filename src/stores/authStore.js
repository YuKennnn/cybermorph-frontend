import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '../api/client'; // The Axios setup we discussed

export const useAuthStore = defineStore('auth', () => {
  // ==========================================
  // 1. STATE (The Data)
  // ==========================================
  // We check LocalStorage FIRST. If they refreshed, the token is still here!
  const token = ref(localStorage.getItem('cyber_token') || null);
  
  // The user's profile and role (admin, educator, player)
  const user = ref(null); 
  const userRole = ref(null);

  // ==========================================
  // 2. ACTIONS (The Functions that change the Data)
  // ==========================================
  
  // This is what your Login View will call when the user clicks "Submit"
  const login = async (credentials) => {
    try {
      // 1. Send the username/password to FastAPI
      const response = await apiClient.post('/login', credentials);
      
      // 2. FastAPI says OK and gives us the wristband (JWT) and user data
      const data = response.data;
      
      // 3. Save the token to State AND LocalStorage so it survives a refresh
      token.value = data.token;
      localStorage.setItem('cyber_token', data.token);
      
      // 4. Save the user data and their specific role
      user.value = data.user;
      userRole.value = data.role; // e.g., 'player', 'educator', 'admin'

      return true; // Tell the login page it was successful
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Pass the error back so the login page can show a red warning
    }
  };

  const logout = () => {
    // 1. Wipe the state clean
    token.value = null;
    user.value = null;
    userRole.value = null;
    // 2. Delete the backup from the browser's hard drive
    localStorage.removeItem('cyber_token');
  };

  // ==========================================
  // 3. RETURN (Make them usable)
  // ==========================================
  return { token, user, userRole, login, logout };
});