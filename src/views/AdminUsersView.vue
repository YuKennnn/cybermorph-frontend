<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { fetchAdminUsers } from '../api/admin'
import AdminSubNav from '../components/admin/AdminSubNav.vue'
import AppIcon from '../components/common/AppIcon.vue'

const users = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectedRole = ref('')
const searchQuery = ref('')
const isLoading = ref(true)
const errorMessage = ref('')

let latestRequestId = 0
let debounceTimer = null

const totalPages = computed(() => {
  if (totalCount.value <= 0) return 1
  return Math.ceil(totalCount.value / pageSize.value)
})

const VALID_ROLES = ['player', 'educator', 'admin']

const formatRole = (role) => {
  if (!role) return 'Unknown'
  const normalized = String(role).toLowerCase()
  if (normalized === 'player') return 'Player'
  if (normalized === 'educator') return 'Educator'
  if (normalized === 'admin') return 'Admin'
  return 'Unknown'
}

const getRoleClass = (role) => {
  if (!role) return 'unknown'
  const normalized = String(role).toLowerCase()
  return VALID_ROLES.includes(normalized) ? normalized : 'unknown'
}

const formatUsername = (username) => {
  if (typeof username === 'string' && username.trim().length > 0) {
    return username.trim()
  }
  return 'Not applicable'
}

const formatDate = (isoString) => {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return isNaN(date.getTime())
    ? 'N/A'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

const loadUsers = async () => {
  const reqId = ++latestRequestId
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (selectedRole.value) {
      params.role = selectedRole.value
    }
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    const data = await fetchAdminUsers(params)

    // Discard stale responses if a newer request was dispatched
    if (reqId !== latestRequestId) return

    users.value = data?.items || []
    totalCount.value = data?.total_count ?? users.value.length
    if (data?.page) page.value = data.page
    if (data?.page_size) pageSize.value = data.page_size
  } catch {
    if (reqId !== latestRequestId) return
    errorMessage.value = 'Failed to load user accounts. Please check your connection and try again.'
  } finally {
    if (reqId === latestRequestId) {
      isLoading.value = false
    }
  }
}

// Watchers for filtering with debounce and pagination reset
watch(selectedRole, () => {
  page.value = 1
  loadUsers()
})

watch(searchQuery, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadUsers()
  }, 300)
})

const handlePrevPage = () => {
  if (page.value > 1 && !isLoading.value) {
    page.value -= 1
    loadUsers()
  }
}

const handleNextPage = () => {
  if (page.value < totalPages.value && !isLoading.value) {
    page.value += 1
    loadUsers()
  }
}

onMounted(() => {
  loadUsers()
})

onUnmounted(() => {
  // Invalidate any pending in-flight requests and clear debounce timer
  latestRequestId++
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>

<template>
  <div class="admin-users-view">
    <header class="view-header">
      <div class="header-content">
        <div>
          <h2 class="title">User Management</h2>
          <p class="subtitle">Inspect registered accounts, identities, and portal roles</p>
        </div>
      </div>
    </header>

    <!-- Top Sub-Navigation Tabs -->
    <AdminSubNav />

    <!-- Action & Filter Bar -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search by email, username, or name..."
          class="search-input"
          aria-label="Search users"
        />
      </div>

      <div class="filter-controls">
        <select v-model="selectedRole" class="select-input" aria-label="Filter by role">
          <option value="">All Roles</option>
          <option value="player">Player</option>
          <option value="educator">Educator</option>
          <option value="admin">Admin</option>
        </select>

        <button class="btn-refresh" :disabled="isLoading" aria-label="Refresh user list" @click="loadUsers">
          <AppIcon name="refresh" :size="16" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
      <button class="btn-retry" @click="loadUsers">Retry</button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading user accounts...</p>
    </div>

    <!-- Users Table Card -->
    <div v-else-if="users.length > 0" class="table-card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.user_id">
            <td class="username-cell">
              <span :class="['user-display', { 'not-applicable': !user.username?.trim() }]">
                {{ formatUsername(user.username) }}
              </span>
            </td>
            <td class="email-cell">{{ user.email }}</td>
            <td>
              <span :class="['role-pill', getRoleClass(user.role)]">
                {{ formatRole(user.role) }}
              </span>
            </td>
            <td>
              <span :class="['status-badge', user.is_active ? 'active' : 'inactive']">
                {{ user.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(user.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination Bar -->
      <div v-if="totalCount > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (page - 1) * pageSize + 1 }}</strong> to
          <strong>{{ Math.min(page * pageSize, totalCount) }}</strong> of
          <strong>{{ totalCount }}</strong> users
        </div>
        <div class="pagination-actions">
          <button class="page-btn" :disabled="page <= 1 || isLoading" @click="handlePrevPage">
            ◀ Previous
          </button>
          <span class="page-indicator">Page {{ page }} of {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages || isLoading" @click="handleNextPage">
            Next ▶
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!errorMessage" class="empty-state">
      <h4>No Users Found</h4>
      <p v-if="searchQuery || selectedRole">
        No accounts match the current filter criteria.
      </p>
      <p v-else>
        There are currently no registered users in the database.
      </p>
      <button v-if="searchQuery || selectedRole" class="btn-clear" @click="searchQuery = ''; selectedRole = ''">
        Clear Filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-users-view {
  width: 100%;
}

.view-header {
  margin-bottom: 1.5rem;
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
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input-wrapper {
  flex: 1;
  min-width: 260px;
}

.search-input {
  width: 100%;
  padding: 0.65rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  color: var(--color-text-main);
  transition: border-color 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.select-input {
  padding: 0.65rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  color: var(--color-text-main);
  cursor: pointer;
}

.select-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-refresh:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border-color: var(--color-primary);
}


.table-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.users-table {
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
  border-bottom: 1.5px solid var(--color-border);
}

td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
  font-size: 0.92rem;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background-color: var(--color-bg-subtle);
}

.user-display {
  font-weight: 600;
  color: var(--color-text-main);
}

.user-display.not-applicable {
  font-weight: 400;
  color: var(--color-text-muted);
}

.email-cell {
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}

.role-pill {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.role-pill.player {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-violet-border);
}

.role-pill.educator {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.role-pill.admin {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.role-pill.unknown {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
}

.status-badge.active {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.inactive {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.88rem;
}


.pagination-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-top: 1px solid var(--color-border);
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
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-primary);
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
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

.loading-state,
.empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-card);
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
}

.btn-clear {
  margin-top: 1rem;
  padding: 0.55rem 1.2rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
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

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.btn-retry {
  padding: 0.35rem 0.85rem;
  background-color: var(--color-danger);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
