<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../api/client'

const router = useRouter()
const authStore = useAuthStore()

const leaderboardItems = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const selectedMap = ref('All')
const isLoading = ref(false)
const errorMessage = ref('')

const mapOptions = ['All', 'Home', 'Office', 'Internet Cafe', 'Public Park']

let debounceTimer = null

const fetchLeaderboard = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }

    if (selectedMap.value && selectedMap.value !== 'All') {
      params.map_name = selectedMap.value
    }

    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    const response = await apiClient.get('/leaderboard', { params })
    const data = response.data

    leaderboardItems.value = data.items || []
    totalCount.value = data.total_count || 0
  } catch (error) {
    console.error('Failed to load leaderboard:', error)
    errorMessage.value = 'Unable to load leaderboard data. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Watch searchQuery with 300ms debounce
watch(searchQuery, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchLeaderboard()
  }, 300)
})

// Watch selectedMap immediately
watch(selectedMap, () => {
  page.value = 1
  fetchLeaderboard()
})

const totalPages = () => Math.ceil(totalCount.value / pageSize.value) || 1

const handlePrevPage = () => {
  if (page.value > 1) {
    page.value--
    fetchLeaderboard()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages()) {
    page.value++
    fetchLeaderboard()
  }
}

const handleNavAction = () => {
  if (authStore.token) {
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
}

onMounted(() => {
  fetchLeaderboard()
})
</script>

<template>
  <div class="leaderboard-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <h2>Global Leaderboard</h2>
          <p class="subtitle">Top agent scores and threat simulation rankings</p>
        </div>
        <button class="nav-btn" @click="handleNavAction">
          {{ authStore.token ? '← Back to Dashboard' : 'Sign In' }}
        </button>
      </div>
    </header>

    <main class="page-body">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <label for="search-input" class="sr-only">Search agents</label>
          <input
            id="search-input"
            v-model="searchQuery"
            type="text"
            placeholder="Search by agent username..."
          />
        </div>

        <div class="map-filter">
          <label for="map-select">Map:</label>
          <select id="map-select" v-model="selectedMap">
            <option v-for="mapName in mapOptions" :key="mapName" :value="mapName">
              {{ mapName === 'All' ? 'All Maps' : mapName }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading agent rankings...</p>
      </div>

      <!-- Data Table -->
      <div v-else-if="leaderboardItems.length > 0" class="table-container">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th class="rank-col">Rank</th>
              <th>Agent Username</th>
              <th>Simulation Map</th>
              <th class="score-col">High Score</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in leaderboardItems"
              :key="entry.id || entry.rank"
              :class="{ 'top-three': entry.rank <= 3 }"
            >
              <td class="rank-col">
                <span :class="['rank-badge', `rank-${entry.rank}`]">
                  {{ entry.rank }}
                </span>
              </td>
              <td class="username-col">
                <strong>{{ entry.username }}</strong>
              </td>
              <td>
                <span class="map-badge">{{ entry.map_name }}</span>
              </td>
              <td class="score-col">
                <span class="score-value">{{ entry.score.toLocaleString() }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <h4>No rankings found</h4>
        <p>No agents matched your current filter criteria.</p>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> agents
        </div>
        <div class="pagination-actions">
          <button class="page-btn" :disabled="page <= 1 || isLoading" @click="handlePrevPage">
            Previous
          </button>
          <span class="page-indicator">Page {{ page }} of {{ totalPages() }}</span>
          <button
            class="page-btn"
            :disabled="page >= totalPages() || isLoading"
            @click="handleNextPage"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.leaderboard-page {
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
}

.page-header {
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0 0 0.25rem 0;
  color: #111827;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.nav-btn {
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.nav-btn:hover {
  background-color: #e5e7eb;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.search-box {
  flex: 1;
  min-width: 240px;
}

.search-box input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.map-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.map-filter label {
  font-weight: 600;
  color: #4b5563;
  font-size: 0.9rem;
}

.map-filter select {
  padding: 0.6rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: white;
  font-size: 0.95rem;
}

.table-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: #f9fafb;
  color: #4b5563;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  color: #1f2937;
  font-size: 0.95rem;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background-color: #f9fafb;
}

.rank-col {
  width: 70px;
  text-align: center;
}

.score-col {
  text-align: right;
  width: 140px;
}

.rank-badge {
  display: inline-block;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.85rem;
  background-color: #f3f4f6;
  color: #4b5563;
}

.rank-1 {
  background-color: #fef08a;
  color: #854d0e;
}

.rank-2 {
  background-color: #e5e7eb;
  color: #374151;
}

.rank-3 {
  background-color: #fed7aa;
  color: #9a3412;
}

.map-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  background-color: #eff6ff;
  color: #1e40af;
  border-radius: 4px;
  font-size: 0.85rem;
}

.score-value {
  font-weight: 700;
  color: #059669;
}

.loading-state,
.empty-state {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 3rem 1rem;
  text-align: center;
  color: #6b7280;
}

.spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 1rem auto;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.pagination-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  gap: 1rem;
}

.pagination-info {
  font-size: 0.9rem;
  color: #4b5563;
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  padding: 0.4rem 0.8rem;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
}

.page-btn:hover:not(:disabled) {
  background-color: #f9fafb;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.9rem;
  color: #6b7280;
}

.error-banner {
  background-color: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
