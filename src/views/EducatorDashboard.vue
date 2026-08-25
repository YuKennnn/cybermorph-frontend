<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../api/client'

const authStore = useAuthStore()

const classroomData = ref({
  classrooms: [
    {
      id: 'c1',
      name: 'Intro to Cybersecurity',
      code: 'CYB101',
      student_count: 28,
      is_active: true,
    },
    {
      id: 'c2',
      name: 'Network Defense & Firewalls',
      code: 'NET202',
      student_count: 19,
      is_active: true,
    },
  ],
  total_students: 47,
  recent_activity: [
    { id: 1, text: 'Student AgentZero completed Map 2 simulation', time: '10m ago' },
    { id: 2, text: 'New student joined Intro to Cybersecurity', time: '1h ago' },
    { id: 3, text: 'Class average Threat Index score improved by 12%', time: 'Yesterday' },
  ],
})

const isLoading = ref(true)
const actionNotice = ref('')

onMounted(async () => {
  try {
    const response = await apiClient.get('/educator/classrooms')
    if (response.data) {
      classroomData.value = { ...classroomData.value, ...response.data }
    }
  } catch (error) {
    console.warn('Could not fetch classrooms, using mock defaults:', error)
  } finally {
    isLoading.value = false
  }
})

const handleCreateClassroom = () => {
  actionNotice.value = 'Classroom creation panel will be connected in the next milestone.'
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <h3>Welcome, Educator {{ authStore.user?.username || authStore.user?.email || '' }}!</h3>
      <p class="subtitle">Classroom rosters, security analytics, and student threat performance.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ classroomData.classrooms.length }}</div>
        <div class="stat-label">Active Classrooms</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight">{{ classroomData.total_students }}</div>
        <div class="stat-label">Total Enrolled Students</div>
      </div>
    </div>

    <div class="section-container">
      <div class="section-header">
        <h4>Classrooms</h4>
        <button class="primary-btn" @click="handleCreateClassroom">+ Create Classroom</button>
      </div>

      <div v-if="actionNotice" class="notice-box">
        {{ actionNotice }}
      </div>

      <div class="classrooms-list">
        <div
          v-for="classroom in classroomData.classrooms"
          :key="classroom.id"
          class="classroom-card"
        >
          <div class="classroom-info">
            <h5>{{ classroom.name }}</h5>
            <span class="code-badge">Code: {{ classroom.code }}</span>
          </div>
          <div class="student-count">{{ classroom.student_count }} Students</div>
        </div>
      </div>
    </div>

    <div class="section-container">
      <h4>Recent Student Activity</h4>
      <ul class="activity-list">
        <li v-for="item in classroomData.recent_activity" :key="item.id" class="activity-item">
          <span>{{ item.text }}</span>
          <span class="activity-time">{{ item.time }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.role-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.welcome-banner h3 {
  margin: 0 0 0.25rem 0;
  color: #111827;
  font-size: 1.35rem;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  text-align: center;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.stat-value.highlight {
  color: #059669;
}

.stat-label {
  font-size: 0.85rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4,
.section-container h4 {
  margin: 0;
  color: #111827;
}

.primary-btn {
  padding: 0.5rem 1rem;
  background-color: #059669;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.primary-btn:hover {
  background-color: #047857;
}

.classrooms-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.classroom-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.classroom-info h5 {
  margin: 0 0 0.25rem 0;
  color: #1f2937;
  font-size: 1rem;
}

.code-badge {
  font-size: 0.8rem;
  font-weight: 600;
  background-color: #e0e7ff;
  color: #3730a3;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.student-count {
  font-size: 0.9rem;
  color: #4b5563;
  font-weight: 500;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9rem;
  color: #374151;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  color: #9ca3af;
  font-size: 0.8rem;
}

.notice-box {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background-color: #eff6ff;
  border: 1px solid #3b82f6;
  color: #1e40af;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
