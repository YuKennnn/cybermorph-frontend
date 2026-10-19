<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { extractErrorMessage } from '../api/client'
import PublicHeader from '../components/common/PublicHeader.vue'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
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

    <main class="auth-container">
      <section class="auth-card">
        <h1 class="title">Create Account</h1>

        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="success-banner">
          {{ successMessage }}
        </div>

        <div v-if="isServerWakingUp" class="info-banner">
          Connecting to backend server... This may take up to 45 seconds after idle.
        </div>

        <!-- Role Selector: Segmented Pill Control -->
        <div class="role-selector-wrap">
          <label id="role-label">Account Type</label>
          <div class="role-tabs" role="radiogroup" aria-labelledby="role-label">
            <button
              type="button"
              class="role-tab-btn"
              :class="{ active: role === 'player' }"
              role="radio"
              :aria-checked="role === 'player'"
              @click="role = 'player'"
            >
              <AppIcon name="play" :size="15" />
              <span>Player</span>
            </button>
            <button
              type="button"
              class="role-tab-btn"
              :class="{ active: role === 'educator' }"
              role="radio"
              :aria-checked="role === 'educator'"
              @click="role = 'educator'"
            >
              <AppIcon name="classrooms" :size="15" />
              <span>Educator</span>
            </button>
          </div>
          <small v-if="role === 'educator'" class="field-hint">
            Requires institutional @dnsc.edu.ph address. Subject to admin approval.
          </small>
        </div>

        <!-- Inner Form Container (capped to max-w 340px centered) -->
        <form class="auth-form" @submit.prevent="handleRegister">
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
            <div class="password-input-wrapper">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Minimum 12 characters"
                required
                minlength="12"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="btn-toggle-password"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :title="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
              </button>
            </div>
            <small class="field-hint">
              Must be at least 12 characters with uppercase, lowercase, numbers, and symbols.
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
      </section>
    </main>
  </div>
</template>

<style scoped>
.auth-page-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
}

.auth-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  padding: 1.25rem 1.5rem;
  box-sizing: border-box;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  margin: auto;
  padding: 2rem 2.25rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 10px 30px -4px rgba(124, 58, 237, 0.09), 0 2px 8px -2px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.title {
  max-width: 340px;
  margin: 0 auto 1.25rem auto;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
  text-align: left;
  line-height: 1.2;
}

.role-selector-wrap {
  max-width: 340px;
  margin: 0 auto 1.15rem auto;
}

.role-selector-wrap label {
  display: block;
  text-align: left;
  margin-bottom: 0.25rem;
}

.role-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  padding: 0.2rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  margin-top: 0.25rem;
}

.role-tab-btn {
  padding: 0.55rem 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  transition: all 0.2s ease;
}

.role-tab-btn.active {
  background-color: var(--color-card);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.auth-form {
  max-width: 340px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}

label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.25rem;
}

input {
  padding: 0.65rem 0.9rem;
  background-color: var(--color-bg);
  border: 1.5px solid var(--color-border-control);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s ease;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.password-input-wrapper input {
  width: 100%;
  padding-right: 2.75rem;
}

.btn-toggle-password {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0.25rem;
  color: var(--color-text-dim);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.btn-toggle-password:hover {
  color: var(--color-primary);
}

.btn-toggle-password:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-primary {
  width: 100%;
  padding: 0.72rem;
  margin-top: 20px;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 0.96rem;
  font-weight: 700;
  letter-spacing: 0.02em;
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

.error-banner,
.success-banner,
.info-banner {
  max-width: 340px;
  margin: 0 auto 0.75rem auto;
  padding: 0.55rem 0.85rem;
  border-radius: 7px;
  font-size: 0.82rem;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}

.success-banner {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.info-banner {
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning);
}

.field-hint {
  font-size: 0.74rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
  line-height: 1.35;
  text-align: left;
}

.footer-text {
  margin-top: 1.15rem;
  text-align: center;
  font-size: 0.84rem;
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

/* Height-adaptive tuning for short viewports (laptops with browser toolbars) */
@media (max-height: 720px) {
  .auth-container {
    padding: 0.65rem 1rem;
  }
  .auth-card {
    padding: 1.5rem 1.85rem;
  }
  .title {
    font-size: 1.4rem;
    margin-bottom: 0.85rem;
  }
  .form-group {
    margin-bottom: 0.8rem;
  }
  input {
    padding: 0.55rem 0.8rem;
    font-size: 0.86rem;
  }
  .btn-primary {
    padding: 0.65rem;
    margin-top: 16px;
  }
  .footer-text {
    margin-top: 0.85rem;
  }
}

/* Mobile screen width responsiveness */
@media (max-width: 440px) {
  .auth-container {
    padding: 0.75rem 0.85rem;
  }
  .auth-card {
    padding: 1.5rem 1.25rem;
  }
  .title,
  .auth-form,
  .role-selector-wrap,
  .error-banner,
  .success-banner,
  .info-banner {
    max-width: 100%;
  }
}
</style>
