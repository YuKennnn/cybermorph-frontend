<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import apiClient from '../api/client'

const router = useRouter()

const classroomCode = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successData = ref(null)

const handleJoinClassroom = async () => {
  const code = classroomCode.value.trim().toUpperCase()
  if (!code) {
    errorMessage.value = 'Please enter a classroom code.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successData.value = null

  try {
    const response = await apiClient.post('/classroom/join', { code })
    successData.value = response.data
    classroomCode.value = ''
  } catch (error) {
    if (error.response && error.response.data && error.response.data.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = 'Failed to join classroom. Please check your connection and try again.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="join-page">
    <div class="join-card">
      <div class="card-header">
        <button class="back-link" @click="handleBack">← Return to Dashboard</button>
        <div class="card-badge">
          <span class="badge-dot"></span>
          <span>SECTOR UPLINK // ENROLLMENT</span>
        </div>
        <h2 class="title">Join Classroom</h2>
        <p class="subtitle">
          Input the 6-character access key provided by your instructor to link your telemetry.
        </p>
      </div>

      <div v-if="successData" class="success-banner">
        <h4>🎉 Enrollment Confirmed!</h4>
        <p>
          You are now linked to sector <strong>{{ successData.name }}</strong> (Access Code:
          <span class="code-highlight">{{ successData.code }}</span>).
        </p>
        <button class="btn-primary" @click="handleBack">Return to Dashboard</button>
      </div>

      <div v-if="errorMessage" class="error-banner">
        ⚠️ {{ errorMessage }}
      </div>

      <form v-if="!successData" @submit.prevent="handleJoinClassroom">
        <div class="form-group">
          <label for="code-input">6-Character Access Key</label>
          <input
            id="code-input"
            v-model="classroomCode"
            type="text"
            placeholder="CYB101"
            maxlength="10"
            required
            autocomplete="off"
          />
          <span class="help-text">Access keys are case-insensitive alphanumeric codes.</span>
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          {{ isLoading ? 'Verifying Code...' : 'Verify & Join Classroom' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.join-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 75vh;
  padding: 1.5rem;
}

.join-card {
  width: 100%;
  max-width: 460px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.25rem;
  box-shadow: var(--shadow-purple);
  transition: box-shadow 0.2s;
}

.join-card:hover {
  box-shadow: var(--shadow-purple-hover);
}

.card-header {
  margin-bottom: 1.5rem;
}

.back-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.85rem;
  transition: all 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
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
  margin-bottom: 0.75rem;
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
  color: var(--color-primary);
  font-size: 1.65rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.form-group {
  margin-bottom: 1.5rem;
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
  padding: 0.85rem 1rem;
  background-color: #ffffff;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 1.35rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: center;
  font-weight: 700;
  color: var(--color-primary);
  outline: none;
  transition: all 0.2s ease;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.help-text {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  text-align: center;
}

.btn-primary {
  width: 100%;
  padding: 0.8rem;
  background: var(--btn-gradient);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-banner {
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.1);
}

.success-banner h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-success);
  font-size: 1.15rem;
}

.success-banner p {
  margin: 0 0 1.25rem 0;
  font-size: 0.92rem;
  color: #065f46;
}

.code-highlight {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-weight: 700;
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}
</style>
