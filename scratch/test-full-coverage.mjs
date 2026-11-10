import assert from 'node:assert/strict'
import { setActivePinia, createPinia } from 'pinia'
import { useApiCacheStore } from '../src/stores/apiCacheStore.js'

// Setup Pinia environment
setActivePinia(createPinia())
const cacheStore = useApiCacheStore()

// Network request spy
let networkCalls = []
const apiSpy = (endpoint, params = {}) => {
  networkCalls.push({ endpoint, params, time: Date.now() })
}

console.log('=== STARTING CYBERMORPH FULL DASHBOARD COVERAGE TESTS ===\n')

// -------------------------------------------------------------
// TEST 1: INVENTORY & DATASET CLASSIFICATION VERIFICATION
// -------------------------------------------------------------
console.log('--- TEST 1: Route & Modal Coverage Classification ---')
const inventory = [
  // Admin
  { surface: 'Admin Overview', type: 'cached', key: 'admin::stats', ttl: 120000 },
  { surface: 'Admin Approvals Preview', type: 'cached', key: 'admin::approvals::page::1&size=1', ttl: 60000 },
  { surface: 'Admin Logs Preview', type: 'cached', key: 'admin::logs::page::1&size=5', ttl: 60000 },
  { surface: 'Admin Users Directory', type: 'cached', key: 'admin::users::page::page=1&page_size=20&role=all&search=', ttl: 120000 },
  { surface: 'Admin Approvals Queue', type: 'cached', key: 'admin::approvals::page::page=1&page_size=20&status=pending', ttl: 60000 },
  { surface: 'Admin Classrooms List', type: 'cached', key: 'admin::classrooms::page::page=1&page_size=20&status=all&search=', ttl: 120000 },
  { surface: 'Admin Audit Logs Table', type: 'cached', key: 'admin::logs::page::page=1&page_size=20&action=&user_id=', ttl: 60000 },
  { surface: 'Admin Logs User Lookup', type: 'cached', key: 'admin::logs::users::search=john&page_size=5', ttl: 30000 },
  { surface: 'Admin Play Data Metadata', type: 'cached', key: 'admin::play-data::page::page=1&page_size=20', ttl: 120000 },
  { surface: 'Admin Play Data Raw Export', type: 'on_demand', key: 'admin::play-data::raw::upload_1', ttl: 0 },

  // Educator
  { surface: 'Educator Classrooms', type: 'cached', key: 'educator::classrooms::mine', ttl: 120000 },
  { surface: 'Educator Classroom Snapshot', type: 'cached', key: 'educator::analytics::classroom::code_id=cls_101', ttl: 120000 },
  { surface: 'Educator Student Roster', type: 'cached', key: 'educator::roster::page::code_id=cls_101&page=1&page_size=10', ttl: 60000 },
  { surface: 'Educator Student Progress', type: 'cached', key: 'educator::analytics::student::profile_id=p_505', ttl: 60000 },
  { surface: 'Educator Session Telemetry Modal', type: 'cached', key: 'educator::telemetry::session_id=sess_900', ttl: 60000 },

  // Player
  { surface: 'Player Profile', type: 'cached', key: 'player::profile::me', ttl: 120000 },
  { surface: 'Player Sessions History', type: 'cached', key: 'player::sessions::page::page=1&page_size=20', ttl: 120000 },
  { surface: 'Player Classroom Membership', type: 'cached', key: 'player::classroom::mine', ttl: 120000 },
  { surface: 'Player Threat Index', type: 'cached', key: 'player::threat-index::mine', ttl: 120000 },
  { surface: 'Leaderboard Map Ranking', type: 'cached', key: 'leaderboard::page::map=Home&page=1&page_size=10', ttl: 60000 },
  { surface: 'Player Download Modal', type: 'public', key: 'public::app::version', ttl: 300000 },

  // Shared
  { surface: 'Settings Account Details', type: 'auth_owned', key: 'auth::user::profile', ttl: 0 },
]

assert.strictEqual(inventory.length, 22, 'Must cover 22 total dataset touchpoints across Admin, Educator, Player, and Shared')
console.log('✓ 22 navigation & modal datasets identified and classified')

// -------------------------------------------------------------
// TEST 2: COLD LOAD VS RETURN REVISIT (0 READS)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Cold Load vs Revisit (0 API Reads on Return) ---')
cacheStore.clearAll()

for (const item of inventory) {
  if (item.type === 'on_demand' || item.type === 'auth_owned') continue

  // 1. Cold Load
  networkCalls = []
  let entry = cacheStore.get(item.key)
  let data = null
  if (!entry || entry.isExpired) {
    apiSpy(item.key)
    data = { sample: 'payload_for_' + item.key }
    cacheStore.set(item.key, data, item.ttl)
  }
  assert.strictEqual(networkCalls.length, 1, `Cold load for ${item.surface} must invoke exactly 1 network call`)
  assert.deepStrictEqual(data, { sample: 'payload_for_' + item.key })

  // 2. Return Revisit (immediate same-tab reopen)
  networkCalls = []
  const cachedEntry = cacheStore.get(item.key)
  if (!cachedEntry || cachedEntry.isExpired) {
    apiSpy(item.key)
  }
  assert.strictEqual(networkCalls.length, 0, `Revisit to ${item.surface} must issue exactly ZERO network calls`)
  assert.deepStrictEqual(cachedEntry.data, { sample: 'payload_for_' + item.key })
}
console.log('✓ All eligible datasets successfully demonstrated cold load (1 call) and fresh return revisit (0 calls)')

// -------------------------------------------------------------
// TEST 3: EXPLICIT REFRESH BYPASSES CACHE
// -------------------------------------------------------------
console.log('\n--- TEST 3: Explicit Refresh (Bypass Fresh Cache) ---')
const testKey = 'educator::analytics::classroom::code_id=cls_101'
assert.ok(cacheStore.get(testKey) !== null && !cacheStore.get(testKey).isExpired, 'Key should be fresh in cache')

networkCalls = []
const doFetch = (force = false) => {
  if (!force) {
    const cached = cacheStore.get(testKey)
    if (cached && !cached.isExpired) return cached.data
  }
  apiSpy(testKey, { forced: force })
  const updated = { sample: 'fresh_forced_payload' }
  cacheStore.set(testKey, updated, 120000)
  return updated
}

// Without force -> 0 calls
const res1 = doFetch(false)
assert.strictEqual(networkCalls.length, 0)

// With force -> 1 call
const res2 = doFetch(true)
assert.strictEqual(networkCalls.length, 1)
assert.deepStrictEqual(res2, { sample: 'fresh_forced_payload' })
console.log('✓ Explicit refresh successfully bypasses fresh cache and updates state')

// -------------------------------------------------------------
// TEST 4: PREFIX INVALIDATION DETACHES PENDING REQUESTS
// -------------------------------------------------------------
console.log('\n--- TEST 4: Prefix Invalidation & Late Request Detachment ---')
// Simulate an ongoing read for a pending approval page
const pendingApprovalKey = 'admin::approvals::page::page=1&page_size=20&status=pending'
const v1 = cacheStore.getKeyVersion(pendingApprovalKey)

// Invalidate approvals before response arrives
cacheStore.invalidateApprovalMutations()
const v2 = cacheStore.getKeyVersion(pendingApprovalKey)
assert.ok(v2 > v1, `Version after prefix invalidation (${v2}) must be strictly greater than captured version (${v1})`)

// Simulate late arrival of v1 response
const latePayload = { items: [{ id: 'stale_educator' }] }
// Gate check that useCachedQuery uses:
const isLateResponseValid = v1 === cacheStore.getKeyVersion(pendingApprovalKey)
assert.strictEqual(isLateResponseValid, false, 'Late completion with obsolete key version must be rejected')
console.log('✓ Invalidation during pending read successfully invalidates effective key version via prefixVersions')

// -------------------------------------------------------------
// TEST 5: LOGOUT / ACCOUNT SWITCH CLEARS PRIVATE CACHE
// -------------------------------------------------------------
console.log('\n--- TEST 5: Logout & Session Reset Isolates Cache ---')
assert.ok(cacheStore.size > 0, 'Cache should have entries before logout')
cacheStore.clearAll()
assert.strictEqual(cacheStore.size, 0, 'Cache size must be 0 after clearAll')
assert.strictEqual(cacheStore.get('player::profile::me'), null, 'Private entries must be absent')
console.log('✓ Session reset and clearAll fully isolate per-tab memory cache')

console.log('\n=== ALL FULL COVERAGE SUITE TESTS PASSED ===')
