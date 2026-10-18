<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { fetchLeaderboardData } from '../api/leaderboard'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const mapOptions = ['All', 'Home', 'Office', 'Internet Cafe', 'Public Park']

// Parse and validate initial query parameters
const parseMapQuery = (val) => {
  if (typeof val === 'string' && mapOptions.includes(val)) {
    return val
  }
  return 'All'
}

const parsePageQuery = (val) => {
  const parsed = parseInt(val, 10)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

const leaderboardItems = ref([])
const totalCount = ref(0)
const page = ref(parsePageQuery(route.query.page))
const pageSize = ref(10)
const selectedMap = ref(parseMapQuery(route.query.map))
const isLoading = ref(false)
const errorMessage = ref('')

let latestRequestId = 0
let isMounted = true

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const fetchLeaderboard = async () => {
  const reqId = ++latestRequestId
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

    const data = await fetchLeaderboardData(params)

    if (!isMounted || reqId !== latestRequestId) return

    leaderboardItems.value = data.items || []
    totalCount.value = data.total_count || 0
  } catch {
    if (!isMounted || reqId !== latestRequestId) return
    errorMessage.value = 'Unable to load leaderboard scores. Please verify your connection or try again.'
  } finally {
    if (isMounted && reqId === latestRequestId) {
      isLoading.value = false
    }
  }
}

// Keep URL query in sync when user changes filters
const updateQueryParams = () => {
  const query = { ...route.query }
  if (selectedMap.value && selectedMap.value !== 'All') {
    query.map = selectedMap.value
  } else {
    delete query.map
  }
  if (page.value > 1) {
    query.page = String(page.value)
  } else {
    delete query.page
  }
  router.replace({ query })
}

// Watch for external route query changes (e.g. browser Back/Forward or direct link)
watch(
  () => route.query,
  (newQuery) => {
    const newMap = parseMapQuery(newQuery.map)
    const newPg = parsePageQuery(newQuery.page)
    let shouldFetch = false

    if (selectedMap.value !== newMap) {
      selectedMap.value = newMap
      shouldFetch = true
    }
    if (page.value !== newPg) {
      page.value = newPg
      shouldFetch = true
    }
    if (shouldFetch) {
      fetchLeaderboard()
    }
  },
)

const handleMapChange = () => {
  page.value = 1
  updateQueryParams()
  fetchLeaderboard()
}

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    page.value--
    updateQueryParams()
    fetchLeaderboard()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    page.value++
    updateQueryParams()
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
  isMounted = true
  fetchLeaderboard()
})

onUnmounted(() => {
  isMounted = false
  latestRequestId++
})
</script>

<template>
  <div class="leaderboard-page">
    <header class="page-header">
      <div class="header-content">
        <div>
          <h2 class="title">Leaderboard</h2>
          <p class="subtitle">Top scores and player rankings across maps</p>
        </div>
        <button v-if="!authStore.token" class="btn-outline" @click="handleNavAction">
          Sign In
        </button>
      </div>
    </header>

    <main class="page-body">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="map-filter">
          <label for="map-select">Map:</label>
          <select id="map-select" v-model="selectedMap" class="select-input" @change="handleMapChange">
            <option v-for="mapName in mapOptions" :key="mapName" :value="mapName">
              {{ mapName === 'All' ? 'All maps' : mapName }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" :disabled="isLoading" @click="fetchLeaderboard">
          Try again
        </button>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading leaderboard rankings...</p>
      </div>

      <!-- Data Table -->
      <div v-else-if="leaderboardItems.length > 0" class="table-card">
        <div class="table-scroll">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th class="rank-col">Rank</th>
                <th>Player</th>
                <th>Map</th>
                <th class="score-col">High score</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in leaderboardItems"
                :key="entry.score_id || entry.id || entry.rank"
                :class="{ 'top-entry': entry.rank <= 3 }"
              >
                <td class="rank-col">
                  <span :class="['rank-badge', `rank-${entry.rank}`]">
                    {{ entry.rank }}
                  </span>
                </td>
                <td class="username-col">
                  <span class="agent-name">{{ entry.username }}</span>
                </td>
                <td>
                  <span class="map-badge">{{ entry.map_name }}</span>
                </td>
                <td class="score-col">
                  <span class="score-value">{{ (entry.total_score ?? entry.score ?? 0).toLocaleString() }} PTS</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <h4>No scores recorded</h4>
        <p>No scores recorded for this map selection yet.</p>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> scores
        </div>
        <div class="pagination-actions">
          <button class="page-btn" :disabled="page <= 1 || isLoading" @click="handlePrevPage">
            ◀ Previous
          </button>
          <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
          <button
            class="page-btn"
            :disabled="page >= totalPages || isLoading"
            @click="handleNextPage"
          >
            Next ▶
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.leaderboard-page {
  width: 100%;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
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
  color: var(--color-text-main);
  font-size: 1.65rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.btn-outline {
  padding: 0.55rem 1.15rem;
  background-color: #ffffff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.btn-outline:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
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
  min-width: 260px;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.search-box input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.map-filter {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.map-filter label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.select-input {
  padding: 0.7rem 1rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 500;
  outline: none;
  box-shadow: var(--shadow-purple-sm);
}

.select-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.15);
}

.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-purple);
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: 0.95rem 1.25rem;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.95rem;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background-color: var(--color-bg-subtle);
}

.top-entry {
  background-color: #faf8ff;
}

.rank-col {
  width: 80px;
  text-align: center;
}

.score-col {
  text-align: right;
  width: 160px;
}

.rank-badge {
  display: inline-block;
  width: 32px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  background-color: var(--color-bg-muted);
  color: var(--color-primary);
}

.rank-1 {
  background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
  color: #854d0e;
  box-shadow: 0 2px 8px rgba(234, 179, 8, 0.3);
}

.rank-2 {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #334155;
  box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);
}

.rank-3 {
  background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
  color: #9a3412;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
}

.agent-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.map-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
}

.score-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  font-size: 1rem;
}

.loading-state,
.empty-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3.5rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-purple);
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem auto;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
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
  color: var(--color-primary);
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
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-primary);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-primary);
  transition: all 0.2s ease;
  box-shadow: var(--shadow-purple-sm);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background-color: var(--color-card);
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
</style>
