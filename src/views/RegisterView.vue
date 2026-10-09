<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { extractErrorMessage } from '../api/client'
import PublicHeader from '../components/common/PublicHeader.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const role = ref('player')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const isServerWakingUp = ref(false)
let wakeUpTimer = null

const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  const trimmedEmail = email.value.trim()

  // Educator institutional domain validation per API contract
  if (role.value === 'educator' && !trimmedEmail.toLowerCase().endsWith('@dnsc.edu.ph')) {
    errorMessage.value = 'Educator registration requires a verified institutional email ending in @dnsc.edu.ph.'
    return
  }

  // Password length validation (backend requires >= 12 chars, upper, lower, digit, special)
  if (password.value.length < 12) {
    errorMessage.value = 'Passcode must be at least 12 characters and contain uppercase, lowercase, number, and special character.'
    return
  }

  isLoading.value = true
  isServerWakingUp.value = false

  wakeUpTimer = setTimeout(() => {
    if (isLoading.value) {
      isServerWakingUp.value = true
    }
  }, 4000)

  try {
    if (role.value === 'player') {
      await authStore.registerPlayer({
        email: trimmedEmail,
        username: username.value.trim(),
        password: password.value,
      })
      router.push('/login')
    } else {
      // Educator accounts send only email and password to /auth/register-web
      await authStore.registerWeb({
        email: trimmedEmail,
        password: password.value,
      })
      successMessage.value = 'Educator profile submitted! Account is pending administrative approval before portal activation.'
      setTimeout(() => {
        router.push('/login')
      }, 3500)
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(
      error,
      'Registration request failed. Please check your connection and try again.',
    )
  } finally {
    if (wakeUpTimer) clearTimeout(wakeUpTimer)
    isLoading.value = false
    isServerWakingUp.value = false
  }
}

onUnmounted(() => {
  if (wakeUpTimer) clearTimeout(wakeUpTimer)
})
</script>

<template>
  <div class="auth-page-wrapper">
    <PublicHeader />
    <div class="auth-container">
      <div class="auth-card">
        <div class="card-badge">
          <span class="badge-dot"></span>
          <span>ACCOUNT REGISTRATION</span>
        </div>

        <h2 class="title">Create Account</h2>
        <p class="subtitle">Register a player or educator account for CyberMorph</p>

        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="success-banner">
          {{ successMessage }}
        </div>

        <div v-if="isServerWakingUp" class="info-banner">
          Connecting to backend server... This may take up to 45 seconds after idle.
        </div>

        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label for="role">Account Type</label>
            <select id="role" v-model="role" class="select-input">
              <option value="player">Player</option>
              <option value="educator">Educator</option>
            </select>
            <small v-if="role === 'educator'" class="field-hint">
              Requires institutional @dnsc.edu.ph address. Subject to admin approval.
            </small>
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              :placeholder="role === 'educator' ? 'instructor@dnsc.edu.ph' : 'player@example.com'"
              required
              autocomplete="email"
            />
          </div>

          <div v-if="role === 'player'" class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="Choose a username"
              required
              minlength="3"
              maxlength="50"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="Minimum 12 characters"
              required
              minlength="12"
              autocomplete="new-password"
            />
            <small class="field-hint">
              Must be at least 12 characters with uppercase, lowercase, number, and special character.
            </small>
          </div>

          <button type="submit" class="btn-primary" :disabled="isLoading">
            {{ isLoading ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>

        <p class="footer-text">
          Already registered?
          <RouterLink to="/login" class="link-primary">Sign in here</RouterLink>
        </p>
      </div>
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

.success-banner {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
}

.info-banner {
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
}

.field-hint {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
  line-height: 1.3;
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
