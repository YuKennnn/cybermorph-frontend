<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchMyClassrooms } from '../api/classroom'
import { extractErrorMessage } from '../api/client'
import ClassroomCard from '../components/classroom/ClassroomCard.vue'
import ClassroomCreateModal from '../components/classroom/ClassroomCreateModal.vue'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const classrooms = ref([])
const totalStudents = ref(0)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const isCreateModalOpen = ref(false)

const loadDashboardData = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    const list = Array.isArray(data) ? data : data?.classrooms || []
    classrooms.value = list
    totalStudents.value =
      data?.total_students ?? list.reduce((sum, c) => sum + (c.student_count || 0), 0)
  } catch (error) {
    errorMessage.value = extractErrorMessage(
      error,
      'Failed to load classroom overview. Please verify your connection or try again.',
    )
  } finally {
    isLoading.value = false
  }
}

const handleClassroomCreated = (newClassroom) => {
  const code = newClassroom.code_value || newClassroom.code || 'GENERATED'
  successMessage.value = `Classroom "${newClassroom.name}" created with access code: ${code}`
  setTimeout(() => {
    successMessage.value = ''
  }, 4500)
  loadDashboardData()
}

const handleViewStudents = (codeId) => {
  router.push(`/classroom/students/${codeId}`)
}

const handleViewAnalytics = (codeId) => {
  if (codeId) {
    router.push(`/analytics/${codeId}`)
  } else {
    router.push('/analytics')
  }
}

const handleManageClassrooms = () => {
  router.push('/classroom/manage')
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div class="educator-dashboard">
    <!-- Header Section -->
    <header class="dashboard-header">
      <div class="header-text">
        <h2 class="title">Educator overview</h2>
        <p class="subtitle">
          Signed in as <strong>{{ authStore.displayName }}</strong>. Manage classroom access keys and inspect student progression.
        </p>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="btn-primary"
          @click="isCreateModalOpen = true"
        >
          <AppIcon name="plus" :size="16" />
          <span>Create classroom</span>
        </button>
        <button
          type="button"
          class="btn-outline"
          @click="() => handleViewAnalytics()"
        >
          <AppIcon name="analytics" :size="16" />
          <span>Threat analytics</span>
        </button>
      </div>
    </header>

    <!-- Success Feedback Banner -->
    <div v-if="successMessage" class="success-banner" role="status">
      <AppIcon name="check" :size="18" class="banner-icon" />
      <span>{{ successMessage }}</span>
    </div>

    <!-- Error State (Truthful fallback with Retry action) -->
    <div v-if="errorMessage" class="error-banner" role="alert">
      <div class="error-content">
        <AppIcon name="alert" :size="18" class="banner-icon" />
        <span>{{ errorMessage }}</span>
      </div>
      <button
        type="button"
        class="btn-retry"
        :disabled="isLoading"
        @click="loadDashboardData"
      >
        <AppIcon name="refresh" :size="14" />
        <span>Try again</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading classroom overview...</p>
    </div>

    <!-- Populated / Valid State -->
    <div v-else-if="!errorMessage" class="dashboard-body">
      <!-- KPI Stats Grid -->
      <section class="stats-grid" aria-label="Classroom metrics">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Active classrooms</span>
            <AppIcon name="classrooms" :size="20" class="stat-icon" />
          </div>
          <div class="stat-value">{{ classrooms.length }}</div>
          <p class="stat-desc">Curriculum deployments currently active</p>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Enrolled students</span>
            <AppIcon name="users" :size="20" class="stat-icon" />
          </div>
          <div class="stat-value">{{ totalStudents }}</div>
          <p class="stat-desc">Total agents linked across all classrooms</p>
        </div>

        <div class="stat-card stat-action-card">
          <div class="stat-header">
            <span class="stat-label">Classroom management</span>
            <AppIcon name="join" :size="20" class="stat-icon" />
          </div>
          <p class="stat-desc full">Configure sector names, review status, or archive inactive codes.</p>
          <button
            type="button"
            class="btn-subtle-link"
            @click="handleManageClassrooms"
          >
            <span>Manage all classrooms</span>
            <AppIcon name="arrow-right" :size="14" />
          </button>
        </div>
      </section>

      <!-- Classroom Deployments Section -->
      <section class="classrooms-section">
        <div class="section-header">
          <div>
            <h3 class="section-title">Your classrooms</h3>
            <p class="section-subtitle">
              Distribute access codes to students to connect their devices to your roster.
            </p>
          </div>
          <button
            v-if="classrooms.length > 0"
            type="button"
            class="btn-outline-sm"
            @click="isCreateModalOpen = true"
          >
            <AppIcon name="plus" :size="14" />
            <span>New classroom</span>
          </button>
        </div>

        <!-- Classrooms Grid (Reusing ClassroomCard with utility actions hidden) -->
        <div v-if="classrooms.length > 0" class="classrooms-grid">
          <ClassroomCard
            v-for="classroom in classrooms"
            :key="classroom.code_id || classroom.id"
            :classroom="classroom"
            :show-utility-actions="false"
            @view-students="handleViewStudents"
            @view-analytics="handleViewAnalytics"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon-box" aria-hidden="true">
            <AppIcon name="classrooms" :size="32" />
          </div>
          <h4 class="empty-title">No classrooms created yet</h4>
          <p class="empty-desc">
            Generate your first 6-character access code to allow students to link their simulation profiles and start tracking telemetry.
          </p>
          <button
            type="button"
            class="btn-primary"
            @click="isCreateModalOpen = true"
          >
            <AppIcon name="plus" :size="16" />
            <span>Create classroom</span>
          </button>
        </div>
      </section>
    </div>

    <!-- Reused Existing Creation Dialog -->
    <ClassroomCreateModal
      :is-open="isCreateModalOpen"
      @close="isCreateModalOpen = false"
      @created="handleClassroomCreated"
    />
  </div>
</template>

<style scoped>
.educator-dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.banner-icon {
  flex-shrink: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background-color: #ffffff;
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover:not(:disabled) {
  background-color: var(--color-danger-bg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.stat-icon {
  color: var(--color-primary);
}

.stat-value {
  font-family: var(--font-sans);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.15;
  margin-bottom: 0.35rem;
  font-feature-settings: 'tnum';
}

.stat-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-dim);
  line-height: 1.4;
}

.stat-desc.full {
  margin-top: 0.25rem;
  margin-bottom: 1rem;
}

.stat-action-card {
  justify-content: space-between;
}

.btn-subtle-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: auto;
  transition: gap 0.15s ease;
}

.btn-subtle-link:hover {
  text-decoration: underline;
  gap: 0.6rem;
}

.classrooms-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-size: 1.25rem;
  font-weight: 600;
}

.section-subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.btn-outline-sm {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background-color: #ffffff;
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-outline-sm:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.classrooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 1.25rem;
}

.empty-state {
  background-color: var(--color-card);
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  padding: 3.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon-box {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.empty-title {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
  font-weight: 600;
}

.empty-desc {
  margin: 0 0 1rem 0;
  max-width: 440px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.loading-state {
  text-align: center;
  padding: 4rem 1.5rem;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn-primary,
  .header-actions .btn-outline {
    flex: 1;
    min-width: 140px;
  }
}
</style>
