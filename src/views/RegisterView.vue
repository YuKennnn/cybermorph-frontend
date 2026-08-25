<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const role = ref('player')
const errorMessage = ref('')
const isLoading = ref(false)

const handleRegister = async () => {
  errorMessage.value = ''
  isLoading.value = true

  try {
    if (role.value === 'player') {
      await authStore.registerPlayer({
        email: email.value,
        username: username.value,
        password: password.value,
      })
    } else {
      await authStore.registerWeb({
        email: email.value,
        username: username.value,
        password: password.value,
        role: role.value,
      })
    }
    router.push('/login')
  } catch (error) {
    if (error.response && error.response.data && error.response.data.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = 'Registration failed. Please check your details.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2>CyberMorph Register</h2>
      <p class="subtitle">Create your account</p>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="role">Account Type</label>
          <select id="role" v-model="role">
            <option value="player">Player</option>
            <option value="educator">Educator</option>
          </select>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            :placeholder="role === 'educator' ? 'educator@school.edu' : 'player@example.com'"
            required
          />
        </div>

        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="AgentZero"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Registering...' : 'Create Account' }}
        </button>
      </form>

      <p class="footer-text">
        Already have an account?
        <router-link to="/login">Sign in here</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #fff;
  color: #333;
}

h2 {
  margin-top: 0;
  margin-bottom: 0.25rem;
}

.subtitle {
  color: #666;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}

label {
  font-weight: bold;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

input,
select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  width: 100%;
  padding: 0.6rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.error-banner {
  background-color: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.footer-text {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
}
</style>
