<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import {
  validateEmailField,
  validateLoginPasswordField,
  mapAuthApiError,
  joinDescribedBy,
} from '../utils/authValidation'
import PublicHeader from '../components/common/PublicHeader.vue'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)

const emailError = ref('')
const passwordError = ref('')
const credentialsError = ref('')
const formError = ref('')

const emailInvalidated = ref(false)
const passwordInvalidated = ref(false)

const emailInputRef = ref(null)
const passwordInputRef = ref(null)

const isEmailInvalid = computed(
  () => Boolean(emailError.value || credentialsError.value),
)
const isPasswordInvalid = computed(
  () => Boolean(passwordError.value || credentialsError.value),
)

const emailDescribedBy = computed(() =>
  joinDescribedBy(
    emailError.value ? 'login-email-error' : null,
    credentialsError.value ? 'login-credentials-error' : null,
  ),
)

const passwordDescribedBy = computed(() =>
  joinDescribedBy(
    passwordError.value ? 'login-password-error' : null,
    credentialsError.value ? 'login-credentials-error' : null,
  ),
)

const handleEmailInput = () => {
  if (credentialsError.value) {
    credentialsError.value = ''
  }
  if (formError.value) {
    formError.value = ''
  }
  if (emailInvalidated.value) {
    const check = validateEmailField(email.value)
    emailError.value = check.valid ? '' : check.error
  }
}

const handlePasswordInput = () => {
  if (credentialsError.value) {
    credentialsError.value = ''
  }
  if (formError.value) {
    formError.value = ''
  }
  if (passwordInvalidated.value) {
    const check = validateLoginPasswordField(password.value)
    passwordError.value = check.valid ? '' : check.error
  }
}

const handleLogin = async () => {
  if (isLoading.value) return

  formError.value = ''
  credentialsError.value = ''

  const emailCheck = validateEmailField(email.value)
  const passwordCheck = validateLoginPasswordField(password.value)

  emailError.value = emailCheck.valid ? '' : emailCheck.error
  passwordError.value = passwordCheck.valid ? '' : passwordCheck.error

  if (!emailCheck.valid) {
    emailInvalidated.value = true
  }
  if (!passwordCheck.valid) {
    passwordInvalidated.value = true
  }

  if (!emailCheck.valid || !passwordCheck.valid) {
    await nextTick()
    if (!emailCheck.valid) {
      emailInputRef.value?.focus()
    } else if (!passwordCheck.valid) {
      passwordInputRef.value?.focus()
    }
    return
  }

  isLoading.value = true

  try {
    await authStore.login({
      email: emailCheck.trimmed,
      password: password.value,
    })
    router.push('/dashboard')
  } catch (error) {
    const mapped = mapAuthApiError(error, { mode: 'login' })
    credentialsError.value = mapped.credentialsError
    if (mapped.fieldErrors.email) {
      emailError.value = mapped.fieldErrors.email
      emailInvalidated.value = true
    }
    if (mapped.fieldErrors.password) {
      passwordError.value = mapped.fieldErrors.password
      passwordInvalidated.value = true
    }
    formError.value = mapped.formError
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page-wrapper">
    <PublicHeader />
    <div class="auth-container">
      <div class="auth-card">
        <h2 class="title">Sign In</h2>
        <p class="subtitle">Sign in to your CyberMorph account</p>

        <form
          novalidate
          :aria-busy="isLoading ? 'true' : 'false'"
          @submit.prevent="handleLogin"
        >
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              ref="emailInputRef"
              v-model="email"
              type="email"
              :class="{ 'input-invalid': isEmailInvalid }"
              :aria-invalid="isEmailInvalid ? 'true' : 'false'"
              :aria-describedby="emailDescribedBy"
              placeholder="your-email@example.com"
              required
              autocomplete="email"
              @input="handleEmailInput"
            />
            <p
              v-if="emailError"
              id="login-email-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="14" class="field-error-icon" />
              <span>{{ emailError }}</span>
            </p>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-input-wrapper">
              <input
                id="password"
                ref="passwordInputRef"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :class="{ 'input-invalid': isPasswordInvalid }"
                :aria-invalid="isPasswordInvalid ? 'true' : 'false'"
                :aria-describedby="passwordDescribedBy"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
                @input="handlePasswordInput"
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
            <p
              v-if="passwordError"
              id="login-password-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="14" class="field-error-icon" />
              <span>{{ passwordError }}</span>
            </p>
            <p
              v-if="credentialsError"
              id="login-credentials-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="14" class="field-error-icon" />
              <span>{{ credentialsError }}</span>
            </p>
          </div>

          <div
            v-if="formError"
            id="login-form-error"
            class="error-banner form-error-banner"
            role="alert"
          >
            <AppIcon name="alert" :size="16" class="field-error-icon" />
            <span>{{ formError }}</span>
          </div>

          <button
            type="submit"
            class="btn-primary"
            :disabled="isLoading"
            :aria-busy="isLoading ? 'true' : 'false'"
          >
            <AppIcon v-if="isLoading" name="loader" :size="16" class="btn-spinner" />
            <span>{{ isLoading ? 'Signing in…' : 'Sign In to Portal' }}</span>
          </button>
        </form>

        <p class="footer-text">
          Don't have an account?
          <RouterLink to="/register" class="link-primary">Create an account</RouterLink>
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
  min-height: calc(100vh - 80px);
  padding: 2rem 1.5rem;
  box-sizing: border-box;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  margin: auto;
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
  min-height: 44px;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg);
  border: 1.5px solid var(--color-border-control);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

input.input-invalid {
  border-color: var(--color-danger);
}

input.input-invalid:focus {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-border);
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
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  min-width: 44px;
  min-height: 44px;
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

.field-error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0.35rem 0 0 0;
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.field-error-icon {
  flex-shrink: 0;
  margin-top: 0.12rem;
}

.btn-primary {
  width: 100%;
  min-height: 44px;
  padding: 0.8rem 1rem;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-sizing: border-box;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
}

.btn-spinner {
  animation: auth-spin 0.8s linear infinite;
}

@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-spinner {
    animation: none !important;
  }
}

:global(:root[data-reduced-motion="true"]) .btn-spinner {
  animation: none !important;
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
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
