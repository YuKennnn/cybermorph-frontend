<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    })
    router.push('/dashboard')
  } catch (error) {
    if (error.response && error.response.data && error.response.data.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = 'Login failed. Please check your credentials.'
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
        <span>PORTAL AUTHENTICATION</span>
      </div>

      <h2 class="title">CyberMorph Login</h2>
      <p class="subtitle">Access your gamified security training portal</p>

      <div v-if="errorMessage" class="error-banner">
        ⚠️ {{ errorMessage }}
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Agent Identifier (Email)</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="agent@cybermorph.edu"
            required
            autocomplete="email"
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
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          {{ isLoading ? 'Signing In...' : 'Sign In to Portal' }}
        </button>
      </form>

      <p class="footer-text">
        Need an agent account?
        <router-link to="/register" class="link-primary">Initialize Registration</router-link>
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
  max-width: 420px;
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

input {
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

input:focus {
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
