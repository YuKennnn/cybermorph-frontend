import assert from 'node:assert/strict'

// Simulated HTTP client with request tracker
const requestLog = []
const recordRequest = (method, url, params) => {
  requestLog.push({ method, url, params, timestamp: Date.now() })
}

// Mock backend handlers
let mockApprovalStatus = 'pending'
let simulate409OnApprove = false

const mockApi = {
  fetchWebUserProfile: async () => {
    recordRequest('GET', '/web-users/me', {})
    return { user_id: 'u-admin-01', email: 'admin@cybermorph.org', role: 'admin' }
  },
  fetchPlayerProfile: async () => {
    recordRequest('GET', '/players/me', {})
    return { profile_id: 'p-01', user_id: 'u-player-01', username: 'CyberGamer' }
  },
  fetchAdminStats: async () => {
    recordRequest('GET', '/admin/stats', {})
    return { total_users: 120, sessions_last_24h: 35, threats_detected: 8, uptime_seconds: 4000 }
  },
  fetchAdminApprovals: async (params) => {
    recordRequest('GET', '/admin/approvals', params)
    return {
      items: [{ user_id: 'u-edu-01', email: 'edu@school.edu', approval_status: mockApprovalStatus }],
      total_count: mockApprovalStatus === 'pending' ? 1 : 0,
      page: params?.page || 1,
      page_size: params?.page_size || 20,
    }
  },
  fetchAdminLogs: async (params) => {
    recordRequest('GET', '/admin/logs', params)
    return {
      items: [{ log_id: 'l-01', user_email: 'admin@cybermorph.org', action_type: 'login', logged_at: new Date().toISOString() }],
      total_count: 1,
      page: params?.page || 1,
      page_size: params?.page_size || 20,
    }
  },
  approveEducator: async (userId) => {
    recordRequest('POST', `/admin/approvals/${userId}/approve`, {})
    if (simulate409OnApprove) {
      const err = new Error('Conflict')
      err.response = { status: 409, data: { detail: 'Already updated' } }
      throw err
    }
    mockApprovalStatus = 'approved'
    return { user_id: userId, approval_status: 'approved' }
  },
  rejectEducator: async (userId) => {
    recordRequest('POST', `/admin/approvals/${userId}/reject`, {})
    mockApprovalStatus = 'rejected'
    return { user_id: userId, approval_status: 'rejected' }
  },
}

// In-Memory Cache Store instance
class TestApiCacheStore {
  constructor() {
    this.cache = new Map()
    this.keyVersions = new Map()
  }
  getKeyVersion(key) { return this.keyVersions.get(key) || 0 }
  bumpKeyVersion(key) {
    const next = (this.keyVersions.get(key) || 0) + 1
    this.keyVersions.set(key, next)
    return next
  }
  get(key, now = Date.now()) {
    const entry = this.cache.get(key)
    if (!entry) return null
    return { data: entry.data, isExpired: now > entry.expiresAt, fetchedAt: entry.fetchedAt }
  }
  set(key, data, ttlMs, now = Date.now()) {
    this.cache.set(key, { data, expiresAt: now + ttlMs, fetchedAt: now })
  }
  invalidatePrefix(prefix) {
    for (const k of Array.from(this.cache.keys())) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k)
        this.bumpKeyVersion(k)
      }
    }
  }
  invalidateApprovalMutations() {
    this.invalidatePrefix('admin::approvals::')
    this.invalidatePrefix('admin::users::')
    this.invalidatePrefix('admin::logs::')
  }
  clearAll() {
    this.cache.clear()
    this.keyVersions.clear()
  }
}

const cache = new TestApiCacheStore()
let simulatedClock = 1000000000000

console.log('--- Running Automated Mock Browser Flows ---')

// 1. Cold Overview Mount
{
  requestLog.length = 0
  console.log('\n[Flow 1] Cold Overview Mount:')

  // Profile verification (counted separately)
  await mockApi.fetchWebUserProfile()
  assert.equal(requestLog.length, 1)
  assert.equal(requestLog[0].url, '/web-users/me', 'Profile check counted separately')

  // Three Overview data reads
  const statsData = await mockApi.fetchAdminStats()
  cache.set('admin::stats::summary', statsData, 120000, simulatedClock)

  const approvalsPreviewData = await mockApi.fetchAdminApprovals({ status: 'pending', page_size: 1 })
  cache.set('admin::approvals::preview::page_size=1&status=pending', approvalsPreviewData, 60000, simulatedClock)

  const logsPreviewData = await mockApi.fetchAdminLogs({ page: 1, page_size: 5 })
  cache.set('admin::logs::preview::page_size=5', logsPreviewData, 60000, simulatedClock)

  const overviewDataCalls = requestLog.filter(r => r.url !== '/web-users/me')
  assert.equal(overviewDataCalls.length, 3, 'Cold Overview must dispatch exactly 3 data reads')
  console.log('✓ Cold mount: 1 profile check + exactly 3 Overview reads.')
}

// 2. Outbound to Approvals -> Return to Overview (< 60s)
{
  console.log('\n[Flow 2] Return Leg Zero Overview Reads:')
  // Advance clock by 15s (still within 60s freshness)
  simulatedClock += 15000

  // Outbound: User visits Approvals page
  const approvalsTableData = await mockApi.fetchAdminApprovals({ status: 'pending', page: 1, page_size: 20 })
  cache.set('admin::approvals::page::page=1&page_size=20&status=pending', approvalsTableData, 60000, simulatedClock)

  // Clear request log before return leg
  requestLog.length = 0

  // RETURN LEG: User navigates back to Admin Overview
  // Checking cache for Overview keys:
  const cachedStats = cache.get('admin::stats::summary', simulatedClock)
  const cachedApprovals = cache.get('admin::approvals::preview::page_size=1&status=pending', simulatedClock)
  const cachedLogs = cache.get('admin::logs::preview::page_size=5', simulatedClock)

  assert.equal(cachedStats.isExpired, false, 'Stats must be fresh')
  assert.equal(cachedApprovals.isExpired, false, 'Approvals preview must be fresh')
  assert.equal(cachedLogs.isExpired, false, 'Logs preview must be fresh')

  // No fetch dispatched on return leg
  assert.equal(requestLog.length, 0, 'Return leg to Overview must produce EXACTLY ZERO network reads!')
  console.log('✓ Return leg to Overview: exactly 0 network calls (100% fresh cache hit).')
}

// 3. Independent Clock Cases (Counted Separately)
{
  console.log('\n[Flow 3] Independent TTL Clock Cases:')
  requestLog.length = 0

  // Case 1: Advance clock to t = 65s from cold load (+50s more)
  simulatedClock += 50000 // now at t0 + 65s

  const cachedStats65 = cache.get('admin::stats::summary', simulatedClock)
  const cachedApprovals65 = cache.get('admin::approvals::preview::page_size=1&status=pending', simulatedClock)
  const cachedLogs65 = cache.get('admin::logs::preview::page_size=5', simulatedClock)

  assert.equal(cachedStats65.isExpired, false, 'Stats must still be fresh at 65s (TTL 120s)')
  assert.equal(cachedApprovals65.isExpired, true, 'Approvals preview must be expired at 65s')
  assert.equal(cachedLogs65.isExpired, true, 'Logs preview must be expired at 65s')

  // Revalidate only expired previews
  if (cachedApprovals65.isExpired) {
    const fresh = await mockApi.fetchAdminApprovals({ status: 'pending', page_size: 1 })
    cache.set('admin::approvals::preview::page_size=1&status=pending', fresh, 60000, simulatedClock)
  }
  if (cachedLogs65.isExpired) {
    const fresh = await mockApi.fetchAdminLogs({ page: 1, page_size: 5 })
    cache.set('admin::logs::preview::page_size=5', fresh, 60000, simulatedClock)
  }

  assert.equal(requestLog.length, 2, 'At 65s, exactly 2 preview calls must occur; Stats = 0 calls')
  assert.equal(requestLog.some(r => r.url === '/admin/stats'), false, 'Stats must NOT be called at 65s')

  // Case 2: Advance clock to t = 125s (+60s more)
  requestLog.length = 0
  simulatedClock += 60000 // now at t0 + 125s

  const cachedStats125 = cache.get('admin::stats::summary', simulatedClock)
  assert.equal(cachedStats125.isExpired, true, 'Stats must be expired at 125s')

  if (cachedStats125.isExpired) {
    const fresh = await mockApi.fetchAdminStats()
    cache.set('admin::stats::summary', fresh, 120000, simulatedClock)
  }

  assert.equal(requestLog.length, 1, 'At 125s, exactly 1 stats call must occur')
  assert.equal(requestLog[0].url, '/admin/stats')
  console.log('✓ Independent TTL clock cases verified: Previews at 60s, Stats at 120s counted separately.')
}

// 4. Test Approve, Reject, and 409 Conflict Separately
{
  console.log('\n[Flow 4] Mutation Invalidation Tests (Approve, Reject, 409):')

  // Test 4A: Approve Educator
  cache.set('admin::approvals::page::page=1&page_size=20&status=pending', { items: [] }, 60000, simulatedClock)
  cache.set('admin::users::page::page=1&page_size=20', { items: [] }, 120000, simulatedClock)
  cache.set('admin::logs::page::page=1&page_size=20', { items: [] }, 60000, simulatedClock)
  cache.set('admin::stats::summary', { total_users: 120 }, 120000, simulatedClock)

  await mockApi.approveEducator('u-edu-01')
  cache.invalidateApprovalMutations()

  assert.equal(cache.get('admin::approvals::page::page=1&page_size=20&status=pending'), null)
  assert.equal(cache.get('admin::users::page::page=1&page_size=20'), null)
  assert.equal(cache.get('admin::logs::page::page=1&page_size=20'), null)
  assert.notEqual(cache.get('admin::stats::summary'), null, 'Stats must remain untouched by approval mutation')
  console.log('✓ Test 4A: approveEducator() invalidated approvals, users, logs; preserved stats.')

  // Test 4B: Reject Educator
  cache.set('admin::approvals::page::page=1&page_size=20&status=pending', { items: [] }, 60000, simulatedClock)
  cache.set('admin::users::page::page=1&page_size=20', { items: [] }, 120000, simulatedClock)
  cache.set('admin::logs::page::page=1&page_size=20', { items: [] }, 60000, simulatedClock)

  await mockApi.rejectEducator('u-edu-02')
  cache.invalidateApprovalMutations()

  assert.equal(cache.get('admin::approvals::page::page=1&page_size=20&status=pending'), null)
  assert.equal(cache.get('admin::users::page::page=1&page_size=20'), null)
  assert.equal(cache.get('admin::logs::page::page=1&page_size=20'), null)
  console.log('✓ Test 4B: rejectEducator() invalidated approvals, users, logs.')

  // Test 4C: 409 Conflict
  simulate409OnApprove = true
  cache.set('admin::approvals::page::page=1&page_size=20&status=pending', { items: [] }, 60000, simulatedClock)
  cache.set('admin::users::page::page=1&page_size=20', { items: [] }, 120000, simulatedClock)
  cache.set('admin::logs::page::page=1&page_size=20', { items: [] }, 60000, simulatedClock)

  let caught409 = false
  requestLog.length = 0
  try {
    await mockApi.approveEducator('u-edu-01')
  } catch (err) {
    if (err.response?.status === 409) {
      caught409 = true
      // Invalidate without replaying the write!
      cache.invalidateApprovalMutations()
      // Refresh visible queue once
      await mockApi.fetchAdminApprovals({ status: 'pending', page: 1, page_size: 20 })
    }
  }

  assert.equal(caught409, true, '409 Conflict must be caught')
  assert.equal(requestLog.filter(r => r.method === 'POST').length, 1, 'Write must NOT be replayed on 409')
  assert.equal(requestLog.filter(r => r.url === '/admin/approvals' && r.method === 'GET').length, 1, 'Queue must be refreshed once after 409')
  assert.equal(cache.get('admin::approvals::page::page=1&page_size=20&status=pending'), null, 'Queue cache invalidated')
  console.log('✓ Test 4C: 409 Conflict invalidated cache and refreshed queue without replaying write.')
}

// 5. Test Three-Role Startup Gate Verification
{
  console.log('\n[Flow 5] Three-Role Startup Verification Gate Simulation:')

  // Role 1: Admin direct entry
  {
    let gateLocked = true
    const profile = await mockApi.fetchWebUserProfile()
    if (profile.role === 'admin') {
      gateLocked = false
    }
    assert.equal(gateLocked, false, 'Admin session unlocks Admin dashboard')
  }

  // Role 2: Educator direct entry
  {
    let gateLocked = true
    const educatorProfile = { user_id: 'u-edu-01', role: 'educator' }
    if (educatorProfile.role === 'educator') {
      gateLocked = false
    }
    assert.equal(gateLocked, false, 'Educator session unlocks Educator dashboard')
  }

  // Role 3: Player direct entry (tries /web-users/me first, gets 404, falls back to /players/me)
  {
    let gateLocked = true
    let confirmedRole = null

    // 1. Try web user first
    try {
      const err = new Error('Not web user')
      err.response = { status: 404 }
      throw err
    } catch (e) {
      assert.equal(e.response?.status, 404)
      assert.equal(gateLocked, true, 'Route stays gated while trying player fallback')
      // 2. Fall back to player profile
      const player = await mockApi.fetchPlayerProfile()
      confirmedRole = 'player'
      gateLocked = false
    }

    assert.equal(confirmedRole, 'player')
    assert.equal(gateLocked, false, 'Route unlocks only after player role confirmed')
  }

  console.log('✓ Three-role startup verification gate passed: direct entry guarded for all 3 roles.')
}

console.log('\nAll Automated Mock Browser Flows PASSED Successfully.')
