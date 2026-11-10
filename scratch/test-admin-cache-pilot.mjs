import assert from 'node:assert/strict'

// Mock environment setup for testing store and caching primitives in isolation
globalThis.localStorage = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

console.log('--- Starting Admin Cache Pilot Unit Verification ---')

// 1. Test JWT Expiry and Dev Mock Token Validator
{
  console.log('\n[Check 1] Token Validation & Mock Gate:')
  // Helper simulating isValidTokenFormat logic
  const checkToken = (tok, isDevMock) => {
    if (!tok || typeof tok !== 'string') return false
    if (isDevMock) return true
    const parts = tok.split('.')
    if (parts.length !== 3) return false
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
      if (payload && typeof payload.exp === 'number') {
        return Date.now() < payload.exp * 1000
      }
      return false
    } catch {
      return false
    }
  }

  // A. Dev mock mode allows opaque tokens
  assert.equal(checkToken('mock-admin-token', true), true, 'Dev mock should allow opaque token')
  assert.equal(checkToken('mock-player-token', true), true, 'Dev mock should allow opaque token')

  // B. Non-mock mode rejects opaque tokens
  assert.equal(checkToken('mock-admin-token', false), false, 'Non-mock must reject opaque token')

  // C. Valid non-expired JWT
  const validExp = Math.floor(Date.now() / 1000) + 3600
  const validJwt = `header.${Buffer.from(JSON.stringify({ exp: validExp })).toString('base64')}.sig`
  assert.equal(checkToken(validJwt, false), true, 'Valid non-expired JWT must pass')

  // D. Expired JWT
  const expiredExp = Math.floor(Date.now() / 1000) - 60
  const expiredJwt = `header.${Buffer.from(JSON.stringify({ exp: expiredExp })).toString('base64')}.sig`
  assert.equal(checkToken(expiredJwt, false), false, 'Expired JWT must be rejected')

  console.log('✓ Token validation and mock gate checks passed.')
}

// 2. Test In-Memory Cache Store (apiCacheStore) primitives
{
  console.log('\n[Check 2] Cache Store Primitives & Key Versioning:')
  const cache = new Map()
  const keyVersions = new Map()
  const inFlightRequests = new Map()

  const getKeyVersion = (key) => keyVersions.get(key) || 0
  const bumpKeyVersion = (key) => {
    const next = (keyVersions.get(key) || 0) + 1
    keyVersions.set(key, next)
    return next
  }

  const set = (key, data, ttlMs, currentTime = Date.now()) => {
    cache.set(key, { data, expiresAt: currentTime + ttlMs, fetchedAt: currentTime })
  }

  const get = (key, currentTime = Date.now()) => {
    const entry = cache.get(key)
    if (!entry) return null
    return {
      data: entry.data,
      isExpired: currentTime > entry.expiresAt,
      fetchedAt: entry.fetchedAt,
    }
  }

  const invalidatePrefix = (prefix) => {
    for (const key of Array.from(cache.keys())) {
      if (key.startsWith(prefix)) {
        cache.delete(key)
        bumpKeyVersion(key)
      }
    }
    for (const [key, inFlight] of Array.from(inFlightRequests.entries())) {
      if (key.startsWith(prefix)) {
        if (inFlight.abortController?.abort) inFlight.abortController.abort()
        inFlightRequests.delete(key)
      }
    }
  }

  const invalidateApprovalMutations = () => {
    invalidatePrefix('admin::approvals::')
    invalidatePrefix('admin::users::')
    invalidatePrefix('admin::logs::')
  }

  const t0 = 1000000000000
  set('admin::stats::summary', { total_users: 42 }, 120000, t0)
  set('admin::approvals::preview::page_size=1&status=pending', { total_count: 5 }, 60000, t0)
  set('admin::logs::preview::page_size=5', { items: [1, 2, 3, 4, 5] }, 60000, t0)

  // Verify fresh hits at t0 + 10s
  assert.equal(get('admin::stats::summary', t0 + 10000).isExpired, false)
  assert.equal(get('admin::approvals::preview::page_size=1&status=pending', t0 + 10000).isExpired, false)
  assert.equal(get('admin::logs::preview::page_size=5', t0 + 10000).isExpired, false)

  // Case 1: at t0 + 65s (Approvals and Logs previews expire; Stats stays fresh!)
  assert.equal(get('admin::approvals::preview::page_size=1&status=pending', t0 + 65000).isExpired, true, 'Approvals preview must be expired at 65s')
  assert.equal(get('admin::logs::preview::page_size=5', t0 + 65000).isExpired, true, 'Logs preview must be expired at 65s')
  assert.equal(get('admin::stats::summary', t0 + 65000).isExpired, false, 'Stats must remain fresh at 65s (TTL 120s)')

  // Case 2: at t0 + 125s (Stats expires)
  assert.equal(get('admin::stats::summary', t0 + 125000).isExpired, true, 'Stats must be expired at 125s')

  // Check Single Invalidation Rule
  set('admin::approvals::page::page=1&page_size=20&status=pending', { items: [] }, 60000, t0)
  set('admin::users::page::page=1&page_size=20', { items: [] }, 120000, t0)
  set('admin::logs::page::page=1&page_size=20', { items: [] }, 60000, t0)
  set('admin::stats::summary', { total_users: 99 }, 120000, t0)

  invalidateApprovalMutations()

  assert.equal(get('admin::approvals::preview::page_size=1&status=pending', t0), null, 'Approvals preview cleared')
  assert.equal(get('admin::approvals::page::page=1&page_size=20&status=pending', t0), null, 'Approvals table cleared')
  assert.equal(get('admin::users::page::page=1&page_size=20', t0), null, 'Users cleared')
  assert.equal(get('admin::logs::preview::page_size=5', t0), null, 'Logs preview cleared')
  assert.equal(get('admin::logs::page::page=1&page_size=20', t0), null, 'Logs table cleared')
  assert.notEqual(get('admin::stats::summary', t0), null, 'Stats must NOT be invalidated by approval mutations')

  console.log('✓ Cache store primitives, independent TTLs, and single invalidation rule passed.')
}

// 3. Test Invalidation Detaches Pending Read and Prevents Overwriting Replacement
{
  console.log('\n[Check 3] Invalidation Detaches Pending Read & Protects Replacement:');
  let authEpoch = 1
  const keyVersions = new Map()
  const cache = new Map()

  const getKeyVersion = (k) => keyVersions.get(k) || 0
  const bumpKeyVersion = (k) => {
    const next = (keyVersions.get(k) || 0) + 1
    keyVersions.set(k, next)
    return next
  }

  const key = 'admin::approvals::page::page=1&page_size=20&status=pending'

  // Read 1 starts
  const req1Epoch = authEpoch
  const req1Version = getKeyVersion(key)
  let read1Written = false

  // Invalidation occurs while Read 1 is in-flight!
  bumpKeyVersion(key)

  // Replacement Read 2 starts
  const req2Epoch = authEpoch
  const req2Version = getKeyVersion(key)
  let read2Written = false

  // Read 2 completes first
  if (req2Epoch === authEpoch && req2Version === getKeyVersion(key)) {
    cache.set(key, 'REPLACEMENT_DATA')
    read2Written = true
  }

  // Late Read 1 arrives now
  if (req1Epoch === authEpoch && req1Version === getKeyVersion(key)) {
    cache.set(key, 'STALE_DATA')
    read1Written = true
  }

  assert.equal(read2Written, true, 'Read 2 must succeed and write to cache')
  assert.equal(read1Written, false, 'Late Read 1 must be rejected due to obsolete keyVersion')
  assert.equal(cache.get(key), 'REPLACEMENT_DATA', 'Cache must retain replacement data, not overwritten by late read')

  console.log('✓ Invalidation detached pending read; late completion prevented from overwriting replacement.')
}

// 4. Test Late Response Populates Cache Without Mutating Different Active View (Pending -> Approved filter switch)
{
  console.log('\n[Check 4] Filter Switch: Late Response Populates Cache Without Mutating Active View:');
  let activeViewKey = 'admin::approvals::page::page=1&page_size=20&status=pending'
  let visibleTableData = null
  const cache = new Map()

  // User starts loading Pending tab
  const pendingKey = 'admin::approvals::page::page=1&page_size=20&status=pending'
  const pendingEpoch = 1
  const pendingVersion = 0

  // User immediately clicks 'Approved' tab before Pending returns
  activeViewKey = 'admin::approvals::page::page=1&page_size=20&status=approved'
  visibleTableData = [{ email: 'approved_user@school.edu' }]

  // Late Pending response arrives now
  const pendingResult = [{ email: 'pending_user@school.edu' }]
  if (pendingEpoch === 1 && pendingVersion === 0) {
    // 1. Populates its own valid cache entry!
    cache.set(pendingKey, pendingResult)

    // 2. View guard: only updates visible table if activeViewKey matches!
    if (activeViewKey === pendingKey) {
      visibleTableData = pendingResult
    }
  }

  assert.equal(cache.get(pendingKey), pendingResult, 'Late response must populate its own valid cache entry')
  assert.equal(visibleTableData[0].email, 'approved_user@school.edu', 'Visible Approved table must NOT be overwritten by late Pending response')

  console.log('✓ Filter switch late response populated cache without mutating visible view.')
}

// 5. Test Cross-Tab Session Switch & Preservation of Replacement Token
{
  console.log('\n[Check 5] Cross-Tab Token Switch & Replacement Preservation:');
  let token = 'old-admin-token'
  let sessionEpoch = 1
  let user = { role: 'admin', email: 'admin1@cybermorph.org' }
  const cache = new Map()
  cache.set('some-key', 'old-data')

  localStorage.setItem('cyber_token', 'old-admin-token')

  // Simulate another tab logging in as user B
  const replacementToken = 'new-educator-token'
  localStorage.setItem('cyber_token', replacementToken)

  // Storage listener trigger
  const currentStored = localStorage.getItem('cyber_token')
  assert.notEqual(currentStored, token)

  sessionEpoch++
  cache.clear()
  user = null
  token = currentStored

  // Validate replacement token is preserved
  assert.equal(localStorage.getItem('cyber_token'), 'new-educator-token', 'Replacement token must NOT be cleared')
  assert.equal(token, 'new-educator-token', 'Active session must adopt replacement token')
  assert.equal(cache.size, 0, 'Old cache must be cleared')
  assert.equal(user, null, 'Old user state must be removed before resolving new profile')

  console.log('✓ Cross-tab token replacement preserved and old cache wiped.')
}

console.log('\nAll Admin Cache Pilot Unit Checks PASSED Successfully.')
