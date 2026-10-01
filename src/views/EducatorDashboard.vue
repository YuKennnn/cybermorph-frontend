<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchMyClassrooms } from '../api/classroom'

const router = useRouter()
const authStore = useAuthStore()

const classroomData = ref({
  classrooms: [],
  total_students: 0,
  recent_activity: [],
})

const isLoading = ref(true)

onMounted(async () => {
  try {
    const data = await fetchMyClassrooms()
    if (data) {
      const list = Array.isArray(data) ? data : data.classrooms || []
      classroomData.value.classrooms = list
      classroomData.value.total_students =
        data.total_students ??
        list.reduce((sum, c) => sum + (c.student_count || 0), 0)
      classroomData.value.recent_activity = data.recent_activity || []
    }
  } catch {
    // Keep local default state on failure
  } finally {
    isLoading.value = false
  }
})

const handleManageClassrooms = () => {
  router.push('/classroom/manage')
}

const handleViewAnalytics = () => {
  router.push('/analytics')
}
</script>

<template>
  <div class="role-dashboard">
    <div class="welcome-banner">
      <div class="banner-text">
        <h3 class="title">Instructor Console: {{ authStore.user?.username || authStore.user?.email || 'Educator' }}</h3>
        <p class="subtitle">Classroom rosters, security analytics, and student threat performance</p>
      </div>
      <div class="banner-actions">
        <button class="btn-primary" @click="handleViewAnalytics">Threat Analytics</button>
        <button class="btn-outline-banner" @click="handleManageClassrooms">Manage Classrooms</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value highlight-purple">{{ classroomData.classrooms.length }}</div>
        <div class="stat-label">Active Classrooms</div>
      </div>

      <div class="stat-card">
        <div class="stat-value highlight-secondary">{{ classroomData.total_students }}</div>
        <div class="stat-label">Total Enrolled Agents</div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-header">
        <h4>Classroom Deployments</h4>
        <button class="btn-outline-sm" @click="handleManageClassrooms">+ Create / Configure</button>
      </div>

      <div v-if="isLoading" class="loading-text">Loading classroom overview...</div>

      <div v-else-if="classroomData.classrooms.length > 0" class="classrooms-list">
        <div
          v-for="classroom in classroomData.classrooms"
          :key="classroom.code_id || classroom.id"
          class="classroom-card"
        >
          <div class="classroom-info">
            <h5>{{ classroom.name }}</h5>
            <span class="code-badge">CODE: {{ classroom.code_value || classroom.code }}</span>
          </div>
          <div class="student-count">{{ classroom.student_count || 0 }} Enrolled</div>
        </div>
      </div>

      <div v-else class="empty-note">
        No active classrooms found. Click "Manage Classrooms" to generate your first access code.
      </div>
    </div>

    <div class="content-section">
      <h4>Recent Simulation Events</h4>
      <ul v-if="classroomData.recent_activity.length > 0" class="activity-list">
        <li v-for="item in classroomData.recent_activity" :key="item.id" class="activity-item">
          <span class="activity-text">{{ item.text }}</span>
          <span class="activity-time">{{ item.time }}</span>
        </li>
      </ul>
      <div v-else class="empty-note">No recent student telemetry recorded.</div>
    </div>
  </div>
</template>

<style scoped>
.role-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.welcome-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-purple);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple-hover);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.stat-value.highlight-purple {
  color: var(--color-primary);
}

.stat-value.highlight-secondary {
  color: var(--color-secondary);
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.content-section {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-purple);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.section-header h4,
.content-section h4 {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
  letter-spacing: 0.02em;
}

.btn-primary {
  padding: 0.65rem 1.35rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-primary:hover {
  background: var(--btn-gradient-hover);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-outline-banner {
  padding: 0.65rem 1.25rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-outline-banner:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.btn-outline-sm {
  padding: 0.45rem 0.95rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-outline-sm:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
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
  padding: 1rem 1.25rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.2s, background-color 0.2s;
}

.classroom-card:hover {
  background-color: #f1edff;
  border-color: var(--color-secondary);
}

.classroom-info h5 {
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
  font-size: 1rem;
}

.code-badge {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.student-count {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-subtle);
  border-radius: 6px;
  border-left: 3.5px solid var(--color-primary);
  font-size: 0.9rem;
}

.activity-text {
  color: var(--color-text-main);
  font-weight: 500;
}

.activity-time {
  color: var(--color-text-dim);
  font-size: 0.82rem;
}

.loading-text,
.empty-note {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  padding: 1.5rem 0;
  text-align: center;
}
</style>
