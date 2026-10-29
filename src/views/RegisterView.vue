<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { validateDisplayName } from '../utils/displayName'
import {
  validateEmailField,
  validateUsernameField,
  validateRegistrationPasswordField,
  mapAuthApiError,
  joinDescribedBy,
} from '../utils/authValidation'
import PublicHeader from '../components/common/PublicHeader.vue'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const displayName = ref('')
const password = ref('')
const showPassword = ref(false)
const role = ref('player')

const formError = ref('')
const successMessage = ref('')
const isLoading = ref(false)

const fieldErrors = reactive({
  displayName: '',
  email: '',
  username: '',
  password: '',
})

const invalidatedFields = reactive({
  displayName: false,
  email: false,
  username: false,
  password: false,
})

const displayNameInputRef = ref(null)
const emailInputRef = ref(null)
const usernameInputRef = ref(null)
const passwordInputRef = ref(null)

const displayNameDescribedBy = computed(() =>
  joinDescribedBy(
    'register-display-name-hint',
    fieldErrors.displayName ? 'register-display-name-error' : null,
  ),
)

const emailDescribedBy = computed(() =>
  joinDescribedBy(
    role.value === 'educator' ? 'register-role-hint' : null,
    fieldErrors.email ? 'register-email-error' : null,
  ),
)

const usernameDescribedBy = computed(() =>
  joinDescribedBy(fieldErrors.username ? 'register-username-error' : null),
)

const passwordDescribedBy = computed(() =>
  joinDescribedBy(
    'register-password-hint',
    fieldErrors.password ? 'register-password-error' : null,
  ),
)

const clearAllErrors = () => {
  formError.value = ''
  fieldErrors.displayName = ''
  fieldErrors.email = ''
  fieldErrors.username = ''
  fieldErrors.password = ''
  invalidatedFields.displayName = false
  invalidatedFields.email = false
  invalidatedFields.username = false
  invalidatedFields.password = false
}

const selectRole = (nextRole) => {
  if (role.value === nextRole) return
  role.value = nextRole
  successMessage.value = ''
  clearAllErrors()
}

const validateSingleField = (field) => {
  if (field === 'displayName') {
    if (role.value !== 'educator') {
      fieldErrors.displayName = ''
      return { valid: true, trimmed: '' }
    }
    const res = validateDisplayName(displayName.value)
    fieldErrors.displayName = res.valid ? '' : res.error
    return res
  }

  if (field === 'email') {
    const res = validateEmailField(email.value, {
      requireEducatorDomain: role.value === 'educator',
    })
    fieldErrors.email = res.valid ? '' : res.error
    return res
  }

  if (field === 'username') {
    if (role.value !== 'player') {
      fieldErrors.username = ''
      return { valid: true, trimmed: '' }
    }
    const res = validateUsernameField(username.value)
    fieldErrors.username = res.valid ? '' : res.error
    return res
  }

  if (field === 'password') {
    const res = validateRegistrationPasswordField(password.value)
    fieldErrors.password = res.valid ? '' : res.error
    return res
  }

  return { valid: true }
}

const handleFieldInput = (field) => {
  if (formError.value) {
    formError.value = ''
  }
  if (invalidatedFields[field]) {
    validateSingleField(field)
  }
}

const focusFirstInvalidField = async () => {
  await nextTick()
  if (role.value === 'educator' && fieldErrors.displayName) {
    displayNameInputRef.value?.focus()
    return
  }
  if (fieldErrors.email) {
    emailInputRef.value?.focus()
    return
  }
  if (role.value === 'player' && fieldErrors.username) {
    usernameInputRef.value?.focus()
    return
  }
  if (fieldErrors.password) {
    passwordInputRef.value?.focus()
  }
}

const handleRegister = async () => {
  if (isLoading.value) return

  formError.value = ''
  successMessage.value = ''

  const nameRes = validateSingleField('displayName')
  const emailRes = validateSingleField('email')
  const usernameRes = validateSingleField('username')
  const passwordRes = validateSingleField('password')

  if (!nameRes.valid) invalidatedFields.displayName = true
  if (!emailRes.valid) invalidatedFields.email = true
  if (!usernameRes.valid) invalidatedFields.username = true
  if (!passwordRes.valid) invalidatedFields.password = true

  if (!nameRes.valid || !emailRes.valid || !usernameRes.valid || !passwordRes.valid) {
    await focusFirstInvalidField()
    return
  }

  isLoading.value = true

  try {
    if (role.value === 'player') {
      await authStore.registerPlayer({
        email: emailRes.trimmed,
        username: usernameRes.trimmed,
        password: password.value,
      })
      router.push('/login')
    } else {
      await authStore.registerWeb({
        email: emailRes.trimmed,
        password: password.value,
        display_name: nameRes.trimmed,
      })
      successMessage.value =
        'Educator profile submitted! Account is pending administrative approval before portal activation.'
      setTimeout(() => {
        router.push('/login')
      }, 3500)
    }
  } catch (error) {
    const mapped = mapAuthApiError(error, {
      mode: 'register',
      role: role.value,
    })

    for (const key of ['displayName', 'email', 'username', 'password']) {
      if (mapped.fieldErrors[key]) {
        fieldErrors[key] = mapped.fieldErrors[key]
        invalidatedFields[key] = true
      }
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

    <main class="auth-container">
      <section class="auth-card">
        <h1 class="title">Create Account</h1>

        <div
          v-if="successMessage"
          class="success-banner"
          role="status"
          aria-live="polite"
        >
          {{ successMessage }}
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
              @click="selectRole('player')"
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
              @click="selectRole('educator')"
            >
              <AppIcon name="classrooms" :size="15" />
              <span>Educator</span>
            </button>
          </div>
        </div>

        <!-- Inner Form Container (capped to max-w 340px centered) -->
        <form
          class="auth-form"
          novalidate
          :aria-busy="isLoading ? 'true' : 'false'"
          @submit.prevent="handleRegister"
        >
          <div v-if="role === 'educator'" class="form-group">
            <label for="displayName">Display name</label>
            <input
              id="displayName"
              ref="displayNameInputRef"
              v-model="displayName"
              type="text"
              :class="{ 'input-invalid': !!fieldErrors.displayName }"
              :aria-invalid="fieldErrors.displayName ? 'true' : 'false'"
              :aria-describedby="displayNameDescribedBy"
              placeholder="Maria Santos"
              required
              autocomplete="name"
              @input="handleFieldInput('displayName')"
            />
            <p
              v-if="fieldErrors.displayName"
              id="register-display-name-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="13" class="field-error-icon" />
              <span>{{ fieldErrors.displayName }}</span>
            </p>
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              ref="emailInputRef"
              v-model="email"
              type="email"
              :class="{ 'input-invalid': !!fieldErrors.email }"
              :aria-invalid="fieldErrors.email ? 'true' : 'false'"
              :aria-describedby="emailDescribedBy"
              :placeholder="role === 'educator' ? 'instructor@dnsc.edu.ph' : 'player@example.com'"
              required
              autocomplete="email"
              @input="handleFieldInput('email')"
            />
            <p
              v-if="fieldErrors.email"
              id="register-email-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="13" class="field-error-icon" />
              <span>{{ fieldErrors.email }}</span>
            </p>
          </div>

          <div v-if="role === 'player'" class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              ref="usernameInputRef"
              v-model="username"
              type="text"
              :class="{ 'input-invalid': !!fieldErrors.username }"
              :aria-invalid="fieldErrors.username ? 'true' : 'false'"
              :aria-describedby="usernameDescribedBy"
              placeholder="Choose a username"
              required
              autocomplete="username"
              @input="handleFieldInput('username')"
            />
            <p
              v-if="fieldErrors.username"
              id="register-username-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="13" class="field-error-icon" />
              <span>{{ fieldErrors.username }}</span>
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
                :class="{ 'input-invalid': !!fieldErrors.password }"
                :aria-invalid="fieldErrors.password ? 'true' : 'false'"
                :aria-describedby="passwordDescribedBy"
                placeholder="Minimum 12 characters"
                required
                autocomplete="new-password"
                @input="handleFieldInput('password')"
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
            <small id="register-password-hint" class="field-hint">
              Must be at least 12 characters with uppercase, lowercase, numbers, and symbols.
            </small>
            <p
              v-if="fieldErrors.password"
              id="register-password-error"
              class="field-error"
              role="alert"
            >
              <AppIcon name="alert" :size="13" class="field-error-icon" />
              <span>{{ fieldErrors.password }}</span>
            </p>
          </div>

          <div
            v-if="formError"
            id="register-form-error"
            class="error-banner form-error-banner"
            role="alert"
          >
            <AppIcon name="alert" :size="15" class="field-error-icon" />
            <span>{{ formError }}</span>
          </div>

          <button
            type="submit"
            class="btn-primary"
            :disabled="isLoading"
            :aria-busy="isLoading ? 'true' : 'false'"
          >
            <AppIcon v-if="isLoading" name="loader" :size="16" class="btn-spinner" />
            <span>{{ isLoading ? 'Creating account…' : 'Create Account' }}</span>
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
  padding: 0.75rem 1rem;
  box-sizing: border-box;
}

.auth-card {
  width: 100%;
  max-width: 405px;
  margin: auto;
  padding: 1.5rem 1.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 10px 30px -4px rgba(124, 58, 237, 0.09), 0 2px 8px -2px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.title {
  max-width: 310px;
  margin: 0 auto 0.9rem auto;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-primary);
  text-align: left;
  line-height: 1.2;
}

.role-selector-wrap {
  max-width: 310px;
  margin: 0 auto 0.85rem auto;
}

.role-selector-wrap label {
  display: block;
  text-align: left;
  margin-bottom: 0.2rem;
}

.role-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  padding: 0.18rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-top: 0.2rem;
}

.role-tab-btn {
  min-height: 44px;
  padding: 0.42rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.role-tab-btn.active {
  background-color: var(--color-card);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.auth-form {
  max-width: 310px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
}

label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.18rem;
}

input {
  min-height: 44px;
  padding: 0.48rem 0.78rem;
  background-color: var(--color-bg);
  border: 1.5px solid var(--color-border-control);
  border-radius: 7px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.84rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
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
  padding-right: 2.5rem;
}

.btn-toggle-password {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0.2rem;
  min-height: 44px;
  min-width: 44px;
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
  gap: 0.3rem;
  margin: 0.28rem 0 0 0;
  color: var(--color-danger);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  overflow-wrap: anywhere;
}

.field-error-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.btn-primary {
  width: 100%;
  min-height: 44px;
  padding: 0.6rem;
  margin-top: 14px;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 7px;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
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

.error-banner,
.success-banner {
  max-width: 310px;
  margin: 0 auto 0.65rem auto;
  padding: 0.5rem 0.75rem;
  border-radius: 7px;
  font-size: 0.78rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.form-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
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

.field-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
  line-height: 1.3;
  text-align: left;
}

.footer-text {
  margin-top: 0.85rem;
  text-align: center;
  font-size: 0.8rem;
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

/* Height-adaptive spacing for short laptop viewports (preserves control sizes and natural document scroll) */
@media (max-height: 760px) {
  .auth-container {
    padding: 0.5rem 0.85rem;
  }
  .auth-card {
    padding: 1.15rem 1.65rem;
  }
  .title {
    margin-bottom: 0.6rem;
  }
  .role-selector-wrap {
    margin-bottom: 0.6rem;
  }
  .form-group {
    margin-bottom: 0.55rem;
  }
  .btn-primary {
    margin-top: 0.65rem;
  }
  .footer-text {
    margin-top: 0.65rem;
  }
}

/* Mobile screen width responsiveness */
@media (max-width: 440px) {
  .auth-container {
    padding: 0.5rem 0.75rem;
  }
  .auth-card {
    padding: 1.25rem 1.15rem;
  }
  .title,
  .auth-form,
  .role-selector-wrap,
  .error-banner,
  .success-banner {
    max-width: 100%;
  }
}

@media (min-width: 1600px) {
  .auth-container {
    align-items: flex-start;
    padding-top: clamp(2.5rem, 8vh, 5rem);
    padding-bottom: 2.5rem;
  }

  .auth-card {
    max-width: 480px;
    margin: 0 auto;
    padding: 2.25rem 2.5rem;
  }

  .title,
  .auth-form,
  .role-selector-wrap,
  .error-banner,
  .success-banner {
    max-width: 360px;
  }
}
</style>
