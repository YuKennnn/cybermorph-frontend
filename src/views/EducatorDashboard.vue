<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { useClassroomStore } from '../stores/classroomStore'
import { fetchMyClassrooms } from '../api/classroom'
import { fetchClassroomAnalytics } from '../api/analytics'
import { extractErrorMessage } from '../api/client'
import ClassroomCard from '../components/classroom/ClassroomCard.vue'
import ClassroomCreateModal from '../components/classroom/ClassroomCreateModal.vue'
import AppIcon from '../components/common/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const classroomStore = useClassroomStore()

const CANONICAL_MAPS = ['Home', 'Office', 'Internet Cafe', 'Public Park']

const classrooms = ref([])
const totalStudents = ref(0)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const isCreateModalOpen = ref(false)

// Classroom Snapshot state
const selectedSnapshotCodeId = ref('')
const snapshotAnalytics = ref(null)
const isSnapshotLoading = ref(false)
const snapshotError = ref('')
let snapshotRequestId = 0

const activeClassroomCount = computed(() => {
  return classrooms.value.filter((c) => c.is_active === true).length
})

const previewClassrooms = computed(() => {
  return classrooms.value.slice(0, 4)
})

const resolveSnapshotSelection = (list) => {
  if (!Array.isArray(list) || list.length === 0) return ''
  // 1. Preserve currently selected classroom if it still exists in the refreshed list
  if (selectedSnapshotCodeId.value) {
    const existing = list.find((c) => (c.code_id || c.id) === selectedSnapshotCodeId.value)
    if (existing) return existing.code_id || existing.id
  }
  // 2. Initially select first active classroom in returned order
  const firstActive = list.find((c) => c.is_active === true)
  if (firstActive) return firstActive.code_id || firstActive.id
  // 3. Otherwise select first available classroom
  return list[0].code_id || list[0].id
}

const loadSnapshotData = async (codeId) => {
  if (!codeId) {
    snapshotAnalytics.value = null
    isSnapshotLoading.value = false
    snapshotError.value = ''
    return
  }

  const reqId = ++snapshotRequestId
  isSnapshotLoading.value = true
  snapshotError.value = ''
  snapshotAnalytics.value = null // Prevent older classroom data from displaying while loading

  try {
    const data = await fetchClassroomAnalytics(codeId)
    if (reqId !== snapshotRequestId) return
    snapshotAnalytics.value = data
  } catch (err) {
    if (reqId !== snapshotRequestId) return
    snapshotError.value = extractErrorMessage(
      err,
      'Failed to load classroom performance snapshot. Please try again.',
    )
  } finally {
    if (reqId === snapshotRequestId) {
      isSnapshotLoading.value = false
    }
  }
}

const handleSnapshotClassroomChange = () => {
  if (selectedSnapshotCodeId.value) {
    loadSnapshotData(selectedSnapshotCodeId.value)
  }
}

const hasAnyScores = computed(() => {
  const mapScores = snapshotAnalytics.value?.avg_best_score_by_map
  if (!mapScores || typeof mapScores !== 'object') return false
  return CANONICAL_MAPS.some((mapName) => {
    const val = mapScores[mapName]
    return typeof val === 'number' && !isNaN(val) && val >= 0
  })
})

const maxSnapshotScore = computed(() => {
  if (!hasAnyScores.value) return 0
  const mapScores = snapshotAnalytics.value?.avg_best_score_by_map || {}
  const scores = CANONICAL_MAPS.map((m) => mapScores[m]).filter(
    (v) => typeof v === 'number' && !isNaN(v) && v >= 0,
  )
  return Math.max(...scores, 0)
})

const getBarWidthPercentage = (mapName) => {
  const mapScores = snapshotAnalytics.value?.avg_best_score_by_map
  if (!mapScores || !(mapName in mapScores)) return 0
  const val = mapScores[mapName]
  if (typeof val !== 'number' || isNaN(val) || val <= 0 || maxSnapshotScore.value <= 0) {
    return 0
  }
  return Math.min(100, Math.round((val / maxSnapshotScore.value) * 100))
}

const formatScoreLabel = (mapName) => {
  const mapScores = snapshotAnalytics.value?.avg_best_score_by_map
  if (!mapScores || !(mapName in mapScores)) {
    return 'No scores yet'
  }
  const val = mapScores[mapName]
  if (typeof val !== 'number' || isNaN(val) || val < 0) {
    return 'No scores yet'
  }
  return `${Math.round(val)} pts`
}

const loadDashboardData = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    const list = Array.isArray(data) ? data : []
    classrooms.value = list
    totalStudents.value = list.reduce((sum, c) => sum + (c.student_count || 0), 0)

    if (list.length > 0) {
      const nextCodeId = resolveSnapshotSelection(list)
      const isSwitching = nextCodeId !== selectedSnapshotCodeId.value
      selectedSnapshotCodeId.value = nextCodeId
      if (isSwitching || !snapshotAnalytics.value) {
        loadSnapshotData(nextCodeId)
      }
    } else {
      selectedSnapshotCodeId.value = ''
      snapshotAnalytics.value = null
      snapshotError.value = ''
      isSnapshotLoading.value = false
    }
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
  authStore.ensureWebProfileLoaded().catch(() => {})
  loadDashboardData()
  if (classroomStore.consumeReopenCreateModal('/dashboard')) {
    isCreateModalOpen.value = true
  }
})
</script>

<template>
  <div class="educator-dashboard">
    <!-- Header Section -->
    <header class="dashboard-header">
      <div class="header-text">
        <h2 class="title">Educator overview</h2>
        <p class="subtitle">
          Signed in as <strong>{{ authStore.displayName }}</strong>. Manage classroom access codes and review student progress.
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
          <span>Classroom analytics</span>
        </button>
      </div>
    </header>

    <!-- Missing Educator Display Name Notice -->
    <div
      v-if="authStore.isEducatorMissingDisplayName"
      class="display-name-notice"
      role="status"
      aria-live="polite"
    >
      <div class="notice-text">
        <strong>Set your display name</strong>
        <span>
          Add the name players see as their teacher in Account settings before creating a classroom.
        </span>
      </div>
      <router-link
        :to="{ path: '/settings', query: { section: 'account', returnTo: '/dashboard' } }"
        class="btn-notice-action"
      >
        Set display name in Settings
      </router-link>
    </div>

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
          <div class="stat-value">{{ activeClassroomCount }}</div>
          <p class="stat-desc">Classrooms currently marked active</p>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Classroom enrollments</span>
            <AppIcon name="users" :size="20" class="stat-icon" />
          </div>
          <div class="stat-value">{{ totalStudents }}</div>
          <p class="stat-desc">Total enrollments across classrooms; students in multiple classrooms are counted in each.</p>
        </div>

        <div class="stat-card stat-action-card">
          <div class="stat-header">
            <span class="stat-label">Classroom management</span>
            <AppIcon name="join" :size="20" class="stat-icon" />
          </div>
          <p class="stat-desc full">Configure classroom names, review status, or archive inactive codes.</p>
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

      <!-- Classroom Snapshot Card -->
      <section
        v-if="classrooms.length > 0"
        class="snapshot-card"
        aria-label="Classroom snapshot"
      >
        <div class="snapshot-card-header">
          <div class="snapshot-title-group">
            <h3 class="snapshot-card-title">Classroom snapshot</h3>
            <span class="snapshot-subtitle">Average best score by map</span>
          </div>

          <div class="snapshot-header-actions">
            <div class="snapshot-selector-wrapper">
              <label for="snapshot-classroom-select" class="snapshot-selector-label">Classroom</label>
              <select
                id="snapshot-classroom-select"
                v-model="selectedSnapshotCodeId"
                class="snapshot-select"
                :disabled="isSnapshotLoading"
                @change="handleSnapshotClassroomChange"
              >
                <option
                  v-for="c in classrooms"
                  :key="c.code_id || c.id"
                  :value="c.code_id || c.id"
                >
                  {{ c.name }} ({{ c.code_value || c.code }})
                </option>
              </select>
            </div>

            <router-link
              v-if="selectedSnapshotCodeId"
              :to="`/analytics/${selectedSnapshotCodeId}`"
              class="snapshot-analytics-btn"
            >
              <span>View analytics</span>
              <AppIcon name="arrow-right" :size="14" />
            </router-link>
          </div>
        </div>

        <div class="snapshot-card-body">
          <!-- Loading State -->
          <div v-if="isSnapshotLoading" class="snapshot-loading" role="status">
            <div class="spinner"></div>
            <p>Loading classroom performance snapshot...</p>
          </div>

          <!-- Error State with Retry Action -->
          <div v-else-if="snapshotError" class="snapshot-error-banner" role="alert">
            <div class="snapshot-error-content">
              <AppIcon name="alert" :size="16" class="error-icon" />
              <span>{{ snapshotError }}</span>
            </div>
            <button
              type="button"
              class="btn-retry"
              :disabled="isSnapshotLoading"
              @click="loadSnapshotData(selectedSnapshotCodeId)"
            >
              <AppIcon name="refresh" :size="14" />
              <span>Try again</span>
            </button>
          </div>

          <!-- Empty Scores State -->
          <div v-else-if="!hasAnyScores" class="snapshot-empty-scores" role="status">
            <p>No scores recorded yet for this classroom.</p>
          </div>

          <!-- Canonical Map Score Bars -->
          <div v-else class="snapshot-bars-container">
            <div class="snapshot-bars-list" role="list" aria-label="Average best score by map">
              <div
                v-for="mapName in CANONICAL_MAPS"
                :key="mapName"
                class="snapshot-bar-row"
                role="listitem"
              >
                <div class="bar-header">
                  <span class="bar-map-name">{{ mapName }}</span>
                  <span
                    class="bar-score-value"
                    :class="{ 'is-empty': formatScoreLabel(mapName) === 'No scores yet' }"
                  >
                    {{ formatScoreLabel(mapName) }}
                  </span>
                </div>
                <div class="bar-track" aria-hidden="true">
                  <div
                    class="bar-fill"
                    :style="{ width: `${getBarWidthPercentage(mapName)}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <p class="snapshot-footnote">
              Scores reflect different map scenarios and are not a direct measure of comparative skill.
            </p>
          </div>
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
          <router-link
            v-if="classrooms.length > 4"
            to="/classroom/manage"
            class="view-all-classrooms-link"
          >
            <span>View all classrooms</span>
            <AppIcon name="arrow-right" :size="14" />
          </router-link>
        </div>

        <!-- Classrooms Grid (Reusing ClassroomCard with utility actions hidden) -->
        <div v-if="previewClassrooms.length > 0" class="classrooms-grid">
          <ClassroomCard
            v-for="classroom in previewClassrooms"
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
            Generate your first 6-character access code to allow students to link their accounts and start tracking progress.
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
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.view-all-classrooms-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  min-height: 36px;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.view-all-classrooms-link:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.view-all-classrooms-link:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

@media (max-width: 768px) {
  .classrooms-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .view-all-classrooms-link {
    width: 100%;
  }
}

@media (min-width: 1600px) {
  .stats-grid {
    gap: 1.5rem;
  }

  .stat-card {
    padding: 1.5rem;
  }

  .classrooms-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .classrooms-grid > * {
    max-width: none;
    width: 100%;
  }
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

.display-name-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.9rem 1.15rem;
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 10px;
  font-size: 0.9rem;
}

:root[data-theme="dark"] .display-name-notice {
  background-color: #451a03;
  border-color: #92400e;
  color: #fde68a;
}

.notice-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.btn-notice-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.9rem;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}

.btn-notice-action:hover {
  background-color: var(--color-primary-hover);
}

.btn-notice-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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

/* Classroom Snapshot Card */
.snapshot-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem 1.75rem;
  box-shadow: var(--shadow-sm);
  margin-bottom: 2rem;
}

.snapshot-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.snapshot-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.snapshot-card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-main);
  letter-spacing: -0.01em;
}

.snapshot-subtitle {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.snapshot-header-actions {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.snapshot-selector-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
}

.snapshot-selector-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.snapshot-select {
  height: 38px;
  padding: 0 0.85rem;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  color: var(--color-text-main);
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.snapshot-select:focus,
.snapshot-select:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

.snapshot-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.snapshot-analytics-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 38px;
  padding: 0 1rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  box-sizing: border-box;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.snapshot-analytics-btn:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.snapshot-analytics-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
}

.snapshot-card-body {
  min-height: 120px;
}

.snapshot-loading {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.snapshot-loading .spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 0.75rem auto;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.snapshot-error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  border-radius: 8px;
  font-size: 0.88rem;
}

.snapshot-error-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.snapshot-empty-scores {
  text-align: center;
  padding: 2.5rem 1.5rem;
  background-color: var(--color-bg-subtle);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.snapshot-empty-scores p {
  margin: 0;
}

.snapshot-bars-container {
  display: flex;
  flex-direction: column;
}

.snapshot-bars-list {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.snapshot-bar-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
}

.bar-map-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.bar-score-value {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--color-primary);
  font-feature-settings: 'tnum';
}

.bar-score-value.is-empty {
  font-weight: 500;
  font-size: 0.82rem;
  color: var(--color-text-dim);
}

.bar-track {
  width: 100%;
  height: 10px;
  background-color: var(--color-bg-muted);
  border-radius: 9999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--btn-gradient);
  border-radius: 9999px;
  transition: width 0.35s ease;
}

.snapshot-footnote {
  margin: 1.5rem 0 0 0;
  font-size: 0.8rem;
  color: var(--color-text-dim);
  line-height: 1.4;
}

@media (max-width: 640px) {
  .snapshot-card {
    padding: 1.25rem 1rem;
  }

  .snapshot-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .snapshot-header-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 0.85rem;
  }

  .snapshot-selector-wrapper {
    width: 100%;
  }

  .snapshot-select {
    width: 100%;
  }

  .snapshot-analytics-btn {
    width: 100%;
  }
}
</style>
