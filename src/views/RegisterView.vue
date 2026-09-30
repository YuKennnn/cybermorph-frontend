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
    const status = error.response?.status
    if (status === 409) {
      errorMessage.value = 'An account with this email or codename is already registered.'
    } else if (status === 400 || status === 422) {
      errorMessage.value = 'Registration rejected: please verify that all fields meet requirements.'
    } else {
      errorMessage.value = 'Registration request failed. Please check your connection and try again.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="card-badge">
        <span class="badge-dot"></span>
        <span>AGENT REGISTRATION</span>
      </div>

      <h2 class="title">Create Account</h2>
      <p class="subtitle">Enroll a new player or educator profile in CyberMorph</p>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="role">Account Type</label>
          <select id="role" v-model="role" class="select-input">
            <option value="player">Player (Student / Operative)</option>
            <option value="educator">Educator (Instructor / Admin)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="email">Institutional / Personal Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            :placeholder="role === 'educator' ? 'instructor@school.edu' : 'player@example.com'"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="username">Agent Codename (Username)</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="AgentZero"
            required
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="password">Security Passcode</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          {{ isLoading ? 'Initializing Identity...' : 'Complete Registration' }}
        </button>
      </form>

      <p class="footer-text">
        Already registered?
        <router-link to="/login" class="link-primary">Sign in here</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 85vh;
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  padding: 2.25rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-purple);
  transition: transform 0.2s, box-shadow 0.2s;
}

.auth-card:hover {
  box-shadow: var(--shadow-purple-hover);
}

.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  margin-bottom: 1.25rem;
  letter-spacing: 0.05em;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.title {
  margin: 0 0 0.35rem 0;
  font-size: 1.65rem;
  color: var(--color-primary);
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 0.92rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.4rem;
}

input,
.select-input {
  padding: 0.75rem 1rem;
  background-color: #ffffff;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s ease;
}

input:focus,
.select-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.btn-primary {
  width: 100%;
  padding: 0.8rem;
  margin-top: 0.5rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
}

.footer-text {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.link-primary {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
  margin-left: 0.25rem;
}

.link-primary:hover {
  text-decoration: underline;
}
</style>
