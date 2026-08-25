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
        <button class="back-link" @click="handleBack">← Back to Dashboard</button>
        <h2>Join Classroom</h2>
        <p class="subtitle">
          Enter the 6-character code provided by your cybersecurity educator.
        </p>
      </div>

      <div v-if="successData" class="success-banner">
        <h4>🎉 Successfully Enrolled!</h4>
        <p>
          You are now enrolled in <strong>{{ successData.name }}</strong> (Code:
          {{ successData.code }}).
        </p>
        <button class="primary-btn" @click="handleBack">Return to Dashboard</button>
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <form v-if="!successData" @submit.prevent="handleJoinClassroom">
        <div class="form-group">
          <label for="code-input">Classroom Code</label>
          <input
            id="code-input"
            v-model="classroomCode"
            type="text"
            placeholder="e.g. CYB101"
            maxlength="10"
            required
            autocomplete="off"
          />
          <span class="help-text">Classroom codes are usually 6 characters (letters and numbers).</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? 'Verifying Code...' : 'Join Classroom' }}
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
  padding: 1rem;
}

.join-card {
  width: 100%;
  max-width: 440px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.card-header {
  margin-bottom: 1.5rem;
}

.back-link {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.75rem;
}

.back-link:hover {
  text-decoration: underline;
}

h2 {
  margin: 0 0 0.25rem 0;
  color: #111827;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.4;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
}

label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
}

input {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  font-weight: 700;
  color: #1f2937;
}

input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.help-text {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-top: 0.35rem;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #1d4ed8;
}

.submit-btn:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.success-banner {
  background-color: #ecfdf5;
  border: 1px solid #10b981;
  color: #065f46;
  padding: 1.25rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  text-align: center;
}

.success-banner h4 {
  margin: 0 0 0.5rem 0;
  color: #065f46;
}

.success-banner p {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
}

.primary-btn {
  padding: 0.5rem 1rem;
  background-color: #059669;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.error-banner {
  background-color: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}
</style>
