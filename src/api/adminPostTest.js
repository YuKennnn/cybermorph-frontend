/**
 * Admin Post-test results API boundary.
 *
 * The FastAPI backend does not currently provide assessment or post-test results endpoints.
 * Sample results and attempt histories are strictly isolated behind Vite's dev-mock gate
 * (`import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`) so no sample data
 * enters the production bundle (`vite build`).
 */

export const isAdminPostTestBackendSupported = () => false

export const isAdminPostTestMockEnabled = () =>
  Boolean(import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true')

const loadDevMockModule = async () => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    return await import('../mocks/adminPostTestMockService.js')
  }
  return null
}

/**
 * Fetch paginated player post-test summary list for admins.
 * Proposed future endpoint: GET /admin/post-test-results
 *
 * @param {Object} [params]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=8]
 * @param {string} [params.previewState='default'] - Dev-only preview state
 */
export const fetchAdminPostTestPlayers = async ({
  search = '',
  page = 1,
  pageSize = 8,
  previewState = 'default',
} = {}) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    return {
      backendSupported: false,
      mockEnabled: false,
      isSampleData: false,
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
    }
  }
  return await mockMod.fetchMockAdminPostTestPlayers({
    search,
    page,
    pageSize,
    previewState,
  })
}

/**
 * Fetch submitted post-test attempt history for a single player.
 * Proposed future endpoint: GET /admin/post-test-results/{player_id}
 *
 * @param {Object} params
 * @param {string} params.playerId
 * @param {string} [params.previewState='default'] - Dev-only preview state
 */
export const fetchAdminPostTestPlayerHistory = async ({
  playerId,
  previewState = 'default',
} = {}) => {
  const mockMod = await loadDevMockModule()
  if (!mockMod) {
    throw new Error(
      'Post-test attempt history is unavailable because backend support is not connected yet.',
    )
  }
  return await mockMod.fetchMockAdminPostTestPlayerHistory({
    playerId,
    previewState,
  })
}
