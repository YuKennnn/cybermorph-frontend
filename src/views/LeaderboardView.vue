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

// Featured top three entries on page 1 only
const topThreeEntries = computed(() => {
  if (page.value !== 1) return []
  return leaderboardItems.value.slice(0, 3)
})

/**
 * Checks if a leaderboard entry belongs to the currently signed-in player.
 * Only authenticated player accounts with a confirmed username are matched.
 * Visitors, educators, and admins are never highlighted.
 */
const isCurrentPlayer = (entry) => {
  if (!authStore.isPlayer || !authStore.user?.username || !entry?.username) {
    return false
  }
  return entry.username.toLowerCase() === authStore.user.username.toLowerCase()
}

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
    errorMessage.value =
      'Unable to load leaderboard scores. Please verify your connection or try again.'
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

const handleSelectMap = (mapName) => {
  if (selectedMap.value === mapName && page.value === 1) return
  selectedMap.value = mapName
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
      <!-- Filter Bar with Accessible Buttons -->
      <nav class="filter-bar" aria-label="Map filter navigation">
        <div class="map-filter-group" role="group" aria-label="Filter leaderboard by map">
          <button
            v-for="mapName in mapOptions"
            :key="mapName"
            type="button"
            :class="['filter-btn', { active: selectedMap === mapName }]"
            :aria-pressed="selectedMap === mapName"
            @click="handleSelectMap(mapName)"
          >
            {{ mapName === 'All' ? 'All maps' : mapName }}
          </button>
        </div>
      </nav>

      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn-retry" :disabled="isLoading" @click="fetchLeaderboard">
          Try again
        </button>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading leaderboard rankings...</p>
      </div>

      <!-- Populated State -->
      <template v-else-if="leaderboardItems.length > 0">
        <!-- Featured Top Three Cards (Page 1 Only) -->
        <section
          v-if="topThreeEntries.length > 0"
          class="podium-section"
          aria-label="Top ranked players"
        >
          <div class="podium-grid">
            <article
              v-for="entry in topThreeEntries"
              :key="entry.score_id || `${entry.rank}-${entry.username}`"
              :class="[
                'podium-card',
                `rank-card-${entry.rank}`,
                { 'is-current-player': isCurrentPlayer(entry) },
              ]"
            >
              <svg class="podium-trophy" viewBox="0 0 80 88" aria-hidden="true" focusable="false">
                <path class="trophy-handles" d="M22 14H10v10c0 11 7 17 18 17M58 14h12v10c0 11-7 17-18 17" />
                <path class="trophy-fill" d="M21 8h38v22c0 13-8 22-19 22S21 43 21 30Z" />
                <path class="trophy-highlight" d="M25 12h10v31c-6-3-10-8-10-15Z" />
                <path class="trophy-star" d="m40 18 4 8 9 1-6.5 6.3 1.5 9L40 38l-8 4.3 1.5-9L27 27l9-1Z" />
                <path class="trophy-fill" d="M35 52h10v13l10 7H25l10-7Z" />
                <rect class="trophy-base" x="21" y="72" width="38" height="9" rx="3" />
              </svg>
              <div class="podium-header">
                <span :class="['podium-rank-badge', `badge-rank-${entry.rank}`]">
                  #{{ entry.rank }}
                </span>
              </div>

              <div class="podium-body">
                <div class="podium-player">
                  <span class="podium-username" :title="entry.username">{{ entry.username }}</span>
                  <span v-if="isCurrentPlayer(entry)" class="you-badge">You</span>
                </div>
                <span class="podium-map-badge">{{ entry.map_name }}</span>
                <div class="podium-score">
                  <span class="score-number">{{
                    (entry.total_score ?? entry.score ?? 0).toLocaleString()
                  }}</span>
                  <span class="score-suffix">pts</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- Ranking Table Card -->
        <div class="table-card">
          <div class="table-scroll">
            <table class="leaderboard-table" aria-label="Leaderboard rankings">
              <thead>
                <tr>
                  <th scope="col" class="rank-col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">Map</th>
                  <th scope="col" class="score-col">High score</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in leaderboardItems"
                  :key="entry.score_id || entry.id || `${entry.rank}-${entry.username}`"
                  :class="{ 'current-player-row': isCurrentPlayer(entry) }"
                >
                  <td class="rank-col">
                    <span :class="['rank-badge', `rank-${entry.rank}`]">
                      {{ entry.rank }}
                    </span>
                  </td>
                  <td class="username-col">
                    <div class="player-identity">
                      <span class="agent-name" :title="entry.username">{{ entry.username }}</span>
                      <span v-if="isCurrentPlayer(entry)" class="you-badge">You</span>
                    </div>
                  </td>
                  <td>
                    <span class="map-badge">{{ entry.map_name }}</span>
                  </td>
                  <td class="score-col">
                    <span class="score-value">
                      {{ (entry.total_score ?? entry.score ?? 0).toLocaleString() }}
                      <span class="score-unit">pts</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls inside Table Card Footer -->
          <footer v-if="totalCount > 0" class="table-card-footer pagination-bar">
            <div class="pagination-info" aria-live="polite">
              Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
              <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
              <strong>{{ totalCount }}</strong> scores
            </div>
            <div class="pagination-actions">
              <button
                type="button"
                class="page-btn"
                :disabled="page <= 1 || isLoading"
                aria-label="Previous page"
                @click="handlePrevPage"
              >
                ◀ Previous
              </button>
              <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
              <button
                type="button"
                class="page-btn"
                :disabled="page >= totalPages || isLoading"
                aria-label="Next page"
                @click="handleNextPage"
              >
                Next ▶
              </button>
            </div>
          </footer>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <h4>No scores recorded</h4>
        <p>No scores recorded for this map selection yet.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.leaderboard-page {
  width: 100%;
}

.page-header {
  margin-bottom: 1.75rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
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
  background-color: var(--color-card);
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

/* Accessible Map Filter Buttons */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.map-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.45rem 0.95rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border-color: var(--color-primary);
}

.filter-btn.active {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-purple-sm);
}

/* Featured Top-Three Podium Cards */
.podium-section {
  margin-bottom: 1.75rem;
  padding-top: 1.5rem;
}

.podium-grid {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1.25rem;
  width: 100%;
}

.podium-card {
  position: relative;
  flex: 1 1 0px;
  max-width: 380px;
  min-width: 0;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.15rem 1.15rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.podium-trophy {
  position: absolute;
  width: 4rem;
  height: 4.4rem;
  top: -1.35rem;
  right: 1rem;
  color: var(--podium-accent);
  pointer-events: none;
}

.trophy-handles {
  fill: none;
  stroke: currentColor;
  stroke-width: 5;
  stroke-linecap: round;
}

.trophy-fill { fill: var(--podium-fill); stroke: currentColor; stroke-width: 2; }
.trophy-highlight { fill: var(--color-card); opacity: 0.45; }
.trophy-star, .trophy-base { fill: currentColor; }

.podium-header { padding-right: 4.5rem; min-height: 2rem; }

.podium-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.podium-rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-family: var(--font-sans);
}

/* Rank 1: Gold */
.rank-card-1 {
  --podium-accent: var(--color-medal-gold-score);
  --podium-fill: var(--color-medal-gold-trophy);
  background-color: var(--color-card);
  border-color: color-mix(in srgb, var(--color-medal-gold-border) 35%, var(--color-border));
  box-shadow: var(--shadow-sm);
  padding: 1.35rem 1.25rem;
}

.rank-card-1 .podium-trophy { width: 4.5rem; height: 4.95rem; top: -1.65rem; }

.rank-card-1 .score-number {
  color: var(--color-text-main);
}

.badge-rank-1 {
  background-color: var(--color-medal-gold-badge-bg);
  color: var(--color-medal-gold-text);
  border: 1px solid var(--color-medal-gold-border);
}

/* Rank 2: Silver */
.rank-card-2 {
  --podium-accent: var(--color-medal-silver-score);
  --podium-fill: var(--color-medal-silver-trophy);
  background-color: var(--color-card);
  border-color: color-mix(in srgb, var(--color-medal-silver-border) 35%, var(--color-border));
  box-shadow: var(--shadow-sm);
}

.rank-card-2 .score-number {
  color: var(--color-text-main);
}

.badge-rank-2 {
  background-color: var(--color-medal-silver-badge-bg);
  color: var(--color-medal-silver-text);
  border: 1px solid var(--color-medal-silver-border);
}

/* Rank 3: Bronze */
.rank-card-3 {
  --podium-accent: var(--color-medal-bronze-score);
  --podium-fill: var(--color-medal-bronze-trophy);
  background-color: var(--color-card);
  border-color: color-mix(in srgb, var(--color-medal-bronze-border) 35%, var(--color-border));
  box-shadow: var(--shadow-sm);
}

.rank-card-3 .score-number {
  color: var(--color-text-main);
}

.badge-rank-3 {
  background-color: var(--color-medal-bronze-badge-bg);
  color: var(--color-medal-bronze-text);
  border: 1px solid var(--color-medal-bronze-border);
}

.podium-map-badge {
  align-self: flex-start;
  display: inline-block;
  padding: 0.18rem 0.55rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
}

.podium-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.podium-player {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  flex-wrap: wrap;
}

.podium-username {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
  overflow-wrap: anywhere;
  min-width: 0;
}

.podium-score {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin-top: 0.25rem;
  flex-wrap: wrap;
}

.score-number {
  font-size: 1.65rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.1;
}

.score-suffix {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

/* Desktop layout: 2nd place on left, 1st place center, 3rd place right */
@media (min-width: 769px) {
  .rank-card-1 {
    order: 2;
    transform: translateY(-6px);
  }

  .rank-card-2 {
    order: 1;
  }

  .rank-card-3 {
    order: 3;
  }
}

/* Mobile layout: 1st, 2nd, 3rd stacked */
@media (max-width: 768px) {
  .podium-grid {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .podium-card {
    max-width: 100%;
  }

  .podium-trophy,
  .rank-card-1 .podium-trophy {
    top: 0.65rem;
    right: 0.85rem;
    width: 2.75rem;
    height: 3rem;
  }

  .podium-header { padding-right: 3.5rem; min-height: 2.5rem; }

  .rank-card-1 {
    order: 1;
    transform: none;
  }

  .rank-card-2 {
    order: 2;
  }

  .rank-card-3 {
    order: 3;
  }
}

/* Current Player Highlight */
.podium-card.is-current-player {
  /* Preserves medal background and border; 'You' badge acts as indicator */
}

.current-player-row {
  background-color: var(--color-purple-light);
}

.current-player-row td:first-child {
  border-left: 3px solid var(--color-primary);
}

.you-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 9999px;
  background-color: var(--color-primary);
  color: #ffffff;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

/* Ranking Table Card */
.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-purple-sm);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  padding: 0.85rem 1.25rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
}

td {
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.92rem;
  vertical-align: middle;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover:not(.current-player-row) {
  background-color: var(--color-bg-subtle);
}

.rank-col {
  width: 75px;
  text-align: center;
}

.score-col {
  text-align: right;
  width: 170px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.35rem;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.85rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.rank-badge.rank-1 {
  background-color: var(--color-medal-gold-badge-bg);
  color: var(--color-medal-gold-text);
  border-color: var(--color-medal-gold-border);
}

.rank-badge.rank-2 {
  background-color: var(--color-medal-silver-badge-bg);
  color: var(--color-medal-silver-text);
  border-color: var(--color-medal-silver-border);
}

.rank-badge.rank-3 {
  background-color: var(--color-medal-bronze-badge-bg);
  color: var(--color-medal-bronze-text);
  border-color: var(--color-medal-bronze-border);
}

.player-identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.agent-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.map-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
}

.score-value {
  font-family: var(--font-sans);
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.score-unit {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-left: 0.15rem;
}

/* Pagination inside Table Card Footer */
.table-card-footer {
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-card);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.pagination-info {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-text-main);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.page-btn {
  padding: 0.45rem 0.85rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text-main);
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* State Cards */
.loading-state,
.empty-state {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3.5rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-purple-sm);
}

.spinner {
  width: 32px;
  height: 32px;
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
  color: var(--color-text-main);
  font-size: 1.1rem;
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
