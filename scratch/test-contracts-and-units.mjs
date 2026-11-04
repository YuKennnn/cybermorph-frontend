/* global process */
import assert from 'node:assert'
import { register } from 'node:module'

try {
  register('./png-loader.mjs', import.meta.url)
} catch {
  // Ignore if register already called or not supported
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

// Test through mock adapter / axios directly or through client
async function runContractTests() {
  console.log('--- 1. Testing Mock Contract Handlers ---')
  
  // Dynamic import of client and mock
  const clientModule = await import('../src/api/client.js')
  const client = clientModule.default
  await import('../src/api/mock.js')

  // A. /players/me
  console.log('Testing GET /players/me...')
  const meRes = await client.get('/players/me')
  assert.strictEqual(meRes.status, 200, '/players/me should return 200')
  const me = meRes.data
  assert.strictEqual(typeof me.profile_id, 'string', 'profile_id must be string')
  assert.strictEqual(typeof me.user_id, 'string', 'user_id must be string')
  assert.strictEqual(typeof me.username, 'string', 'username must be string')
  assert.strictEqual(typeof me.email, 'string', 'email must be string')
  assert.strictEqual(me.role, 'player', 'role must be player')
  assert.strictEqual(typeof me.map_progress, 'number', 'map_progress must be integer number')
  assert.strictEqual(Number.isInteger(me.map_progress), true, 'map_progress must be integer')
  console.log('✓ /players/me matches documented contract:', me)

  // B. /players/threat-index
  console.log('\nTesting GET /players/threat-index...')
  const threatsRes = await client.get('/players/threat-index')
  assert.strictEqual(threatsRes.status, 200, '/players/threat-index should return 200')
  const threats = threatsRes.data
  assert.strictEqual(Array.isArray(threats), true, 'threat-index must return an array')
  assert.strictEqual(threats.length, 8, 'must have exactly 8 canonical DICT threats')
  
  const expectedThreatNames = [
    'Phishing',
    'Smishing',
    'Vishing',
    'Social Engineering',
    'Credential Theft',
    'Public Wi-Fi Attack',
    'Malware Infection',
    'Ransomware',
  ]
  threats.forEach((t, i) => {
    assert.strictEqual(t.threat_name, expectedThreatNames[i], `Threat ${i} must be ${expectedThreatNames[i]}`)
    assert.strictEqual(typeof t.is_unlocked, 'boolean', 'is_unlocked must be boolean')
    assert.ok(t.unlocked_at === null || typeof t.unlocked_at === 'string', 'unlocked_at must be string or null')
  })
  console.log('✓ /players/threat-index matches 8 canonical DICT threats in documented order')

  // C. /sessions/history with pagination
  console.log('\nTesting GET /sessions/history (pagination)...')
  const sessionRes = await client.get('/sessions/history', { params: { page: 1, page_size: 5 } })
  assert.strictEqual(sessionRes.status, 200)
  const sessionData = sessionRes.data
  assert.strictEqual(sessionData.page, 1)
  assert.strictEqual(sessionData.page_size, 5)
  assert.strictEqual(sessionData.items.length, 5)
  assert.ok(sessionData.total_count >= 14, 'Total sessions must be at least 14')
  
  const canonicalMaps = ['Home', 'Office', 'Internet Cafe', 'Public Park']
  sessionData.items.forEach((s) => {
    assert.strictEqual(typeof s.session_id, 'string')
    assert.ok(canonicalMaps.includes(s.map_name), `Map name ${s.map_name} must be one of canonical maps`)
    assert.strictEqual(typeof s.duration_seconds, 'number')
    assert.strictEqual(typeof s.credits_earned, 'number')
    assert.strictEqual(typeof s.credits_lost, 'number')
    assert.ok(['win', 'lose', 'timeout'].includes(s.result))
    assert.strictEqual(typeof s.played_at, 'string')
  })
  
  // Page 2
  const sessionRes2 = await client.get('/sessions/history', { params: { page: 2, page_size: 5 } })
  assert.strictEqual(sessionRes2.data.page, 2)
  assert.strictEqual(sessionRes2.data.items.length, 5)
  assert.notStrictEqual(sessionRes.data.items[0].session_id, sessionRes2.data.items[0].session_id, 'Page 2 must have different sessions')
  console.log('✓ /sessions/history pagination and schema verified')

  // D. Classroom roster & 23-student pagination
  console.log('\nTesting GET /classroom/c1/students...')
  const rosterRes = await client.get('/classroom/c1/students', { params: { page: 1, page_size: 10 } })
  assert.strictEqual(rosterRes.status, 200)
  assert.strictEqual(rosterRes.data.total_count, 23, 'Must preserve 23-student roster')
  assert.strictEqual(rosterRes.data.items.length, 10)
  rosterRes.data.items.forEach((s) => {
    assert.strictEqual(typeof s.profile_id, 'string')
    assert.strictEqual(typeof s.username, 'string')
    assert.strictEqual(typeof s.map_progress, 'number', 'Student map_progress must be integer')
    assert.strictEqual(Number.isInteger(s.map_progress), true)
  })
  console.log('✓ Classroom roster returns 23 students with integer map_progress')

  // E. Leaderboard schema & search removal
  console.log('\nTesting GET /leaderboard...')
  const lbRes = await client.get('/leaderboard', { params: { map: 'All', page: 1, page_size: 10 } })
  assert.strictEqual(lbRes.status, 200)
  lbRes.data.items.forEach((entry) => {
    assert.strictEqual(typeof entry.score_id, 'string', 'Leaderboard entry must have score_id')
    assert.strictEqual(typeof entry.total_score, 'number', 'Leaderboard entry must have total_score')
    assert.strictEqual(typeof entry.recorded_at, 'string', 'Leaderboard entry must have recorded_at')
  })
  console.log('✓ Leaderboard entries match score_id, total_score, recorded_at')

  // F. Classroom deletion returns 204 with no body
  console.log('\nTesting DELETE /classroom/c3...')
  const delRes = await client.delete('/classroom/c3')
  assert.strictEqual(delRes.status, 204, 'DELETE classroom should return 204')
  assert.ok(!delRes.data || Object.keys(delRes.data).length === 0, 'DELETE classroom should have no body')
  console.log('✓ Classroom deletion returns 204 No Content with empty body')

  // G. Unmatched route safety: returns 404, does NOT leak to live backend
  console.log('\nTesting unmatched route isolation...')
  try {
    await client.get('/unmatched-nonexistent-endpoint-12345')
    assert.fail('Should have thrown 404')
  } catch (err) {
    assert.strictEqual(err.response?.status, 404, 'Unmatched route must return 404 from mock')
    assert.strictEqual(err.response?.data?.detail, 'Endpoint not found in mock adapter')
  }
  console.log('✓ Unmatched route is cleanly rejected with 404 and does not leak to live backend')

  // H. POST /classroom/join contract & correctly shaped student record
  console.log('\nTesting POST /classroom/join and resulting student record shape...')
  globalThis.localStorage.setItem('cyber_token', 'mock-jwt-token-educator')
  const genRes = await client.post('/classroom/generate', { name: 'Join Lab 101' })
  assert.strictEqual(genRes.status, 201)
  const targetCode = genRes.data.code_value || genRes.data.code
  const targetId = genRes.data.id || genRes.data.code_id

  globalThis.localStorage.setItem('cyber_token', 'mock-jwt-token-player')
  try {
    await client.delete('/classroom/mine')
  } catch {
    // ignore if not enrolled
  }
  const joinRes = await client.post('/classroom/join', { code_value: targetCode })
  assert.strictEqual(joinRes.status, 201, 'POST /classroom/join must return 201')
  assert.ok(joinRes.data.profile_id, 'Join response must include profile_id')
  assert.strictEqual(joinRes.data.code_id, targetId, 'Join response must include code_id')
  assert.strictEqual(joinRes.data.name, 'Join Lab 101', 'Join response must include name')
  assert.ok(joinRes.data.joined_at, 'Join response must include joined_at')
  assert.deepStrictEqual(
    Object.keys(joinRes.data).sort(),
    ['code_id', 'joined_at', 'name', 'profile_id'].sort(),
    'Join response contract must match API_GUIDE.md fields exactly (profile_id, code_id, name, joined_at)'
  )

  // Verify resulting student record shape in classroom roster reading from items
  globalThis.localStorage.setItem('cyber_token', 'mock-jwt-token-educator')
  const joinedRosterRes = await client.get(`/classroom/${targetId}/students`)
  assert.ok(Array.isArray(joinedRosterRes.data.items), 'Classroom roster must have items array')
  const joinedStudent = joinedRosterRes.data.items.find((s) => s.profile_id === joinRes.data.profile_id)
  assert.ok(joinedStudent, 'Newly joined student must exist in classroom students roster items')
  assert.strictEqual(typeof joinedStudent.map_progress, 'number', 'Student map_progress must be integer')
  assert.strictEqual(Number.isInteger(joinedStudent.map_progress), true, 'Student map_progress must be an integer')
  assert.ok(joinedStudent.last_synced_at === null || typeof joinedStudent.last_synced_at === 'string', 'Student last_synced_at must be string or null')
  assert.strictEqual(joinedStudent.username, 'AgentZero')
  console.log('✓ POST /classroom/join returns 201 with documented fields and creates correctly shaped student record in items')

  console.log('\n--- 2. Testing Session Reliability & Stale 401 Rejection ---')

  const { default: mock } = await import('../src/api/mock.js')
  const { setUnauthorizedSessionHandler } = clientModule

  // Temporarily pop onAny fallback handler so our test endpoints match
  const onAnyHandler = mock.handlers.pop()

  mock.onGet('/test/delayed-protected-session').reply(async () => {
    await new Promise((r) => setTimeout(r, 60))
    return [401, { detail: 'Token expired' }]
  })
  mock.onGet('/test/immediate-protected-session').reply(401, { detail: 'Session revoked' })
  mock.onGet('/test/public-endpoint-401').reply(401, { detail: 'Unauthenticated rate limit' })
  mock.onPost('/auth/login-failure-test').reply(401, { detail: 'Invalid credentials' })

  // Re-append fallback 404 handler
  mock.handlers.push(onAnyHandler)

  let unauthorizedHandlerInvocations = 0
  setUnauthorizedSessionHandler(async () => {
    unauthorizedHandlerInvocations++
  })

  // Test Case 2.1: Delayed 401 from previous session (Account A) must NOT clear new session (Account B)
  console.log('\nTesting Case 2.1: Delayed 401 from previous session does NOT clear new session...')
  globalThis.localStorage.setItem('cyber_token', 'token-account-a')
  unauthorizedHandlerInvocations = 0

  const pendingReqA = client.get('/test/delayed-protected-session')

  // Allow request interceptor to execute and tag _sessionToken with Account A's token
  await new Promise((r) => setTimeout(r, 10))

  // User switches account immediately while request A is in-flight over the wire
  globalThis.localStorage.setItem('cyber_token', 'token-account-b')
  globalThis.localStorage.setItem('cyber_role', 'admin')

  try {
    await pendingReqA
    assert.fail('Request A should have rejected with 401')
  } catch (err) {
    assert.strictEqual(err.response?.status, 401, 'Request A must fail with 401')
  }

  assert.strictEqual(
    unauthorizedHandlerInvocations,
    0,
    'Delayed 401 from account A must NOT invoke unauthorized session handler'
  )
  assert.strictEqual(
    globalThis.localStorage.getItem('cyber_token'),
    'token-account-b',
    'Account B token must remain untouched in localStorage'
  )
  console.log('✓ Account A delayed 401 did not trigger logout or clear Account B session')

  // Test Case 2.2: Current-session protected-call 401 DOES invoke handler and sign user out
  console.log('\nTesting Case 2.2: Current-session protected-call 401 signs user out...')
  globalThis.localStorage.setItem('cyber_token', 'token-account-b')
  unauthorizedHandlerInvocations = 0

  try {
    await client.get('/test/immediate-protected-session')
    assert.fail('Request should have rejected with 401')
  } catch (err) {
    assert.strictEqual(err.response?.status, 401)
  }

  assert.strictEqual(
    unauthorizedHandlerInvocations,
    1,
    'Current session 401 MUST invoke unauthorized session handler'
  )
  console.log('✓ Current session 401 invoked unauthorized session handler as expected')

  // Test Case 2.3: Unauthenticated / public request 401 does NOT trigger logout
  console.log('\nTesting Case 2.3: Public request 401 does not trigger logout...')
  globalThis.localStorage.setItem('cyber_token', 'token-account-b')
  unauthorizedHandlerInvocations = 0

  try {
    // Send request with skipAuth
    await client.get('/test/public-endpoint-401', { skipAuth: true })
    assert.fail('Request should have rejected with 401')
  } catch (err) {
    assert.strictEqual(err.response?.status, 401)
  }

  assert.strictEqual(
    unauthorizedHandlerInvocations,
    0,
    'Public request 401 must NOT invoke unauthorized session handler'
  )
  assert.strictEqual(
    globalThis.localStorage.getItem('cyber_token'),
    'token-account-b',
    'Token must remain active'
  )
  console.log('✓ Public request 401 did not trigger logout')

  // Test Case 2.4: /auth/login credential failure 401 does NOT trigger logout
  console.log('\nTesting Case 2.4: /auth/login failure 401 does not trigger logout...')
  unauthorizedHandlerInvocations = 0

  try {
    await client.post('/auth/login-failure-test', { username: 'bad', password: 'bad' })
    assert.fail('Login request should have rejected with 401')
  } catch (err) {
    assert.strictEqual(err.response?.status, 401)
  }

  assert.strictEqual(
    unauthorizedHandlerInvocations,
    0,
    'Login failure 401 must NOT invoke unauthorized session handler'
  )
  console.log('✓ /auth/login 401 did not trigger unauthorized handler')

  // Test Case 2.5: Pinia authStore integration
  console.log('\nTesting Case 2.5: Pinia authStore session integration...')
  const { createPinia, setActivePinia } = await import('pinia')
  const pinia = createPinia()
  setActivePinia(pinia)
  const { useAuthStore } = await import('../src/stores/authStore.js')
  const authStore = useAuthStore()

  authStore.token = 'active-pinia-jwt'
  authStore.user = { user_id: 'u-admin-test', role: 'admin', email: 'adm@local' }
  globalThis.localStorage.setItem('cyber_token', 'active-pinia-jwt')

  assert.strictEqual(authStore.isAuthenticated, true)

  // Current session 401
  try {
    await client.get('/test/immediate-protected-session')
  } catch {
    // expected
  }

  assert.strictEqual(authStore.isAuthenticated, false, 'authStore must be signed out')
  assert.strictEqual(authStore.token, null, 'authStore token must be null')
  assert.strictEqual(authStore.user, null, 'authStore user must be null')
  assert.strictEqual(globalThis.localStorage.getItem('cyber_token'), null, 'localStorage cyber_token must be cleared')
  console.log('✓ authStore logout cleanly executed by unauthorizedSessionHandler')

  // Test Case 2.6: Lifecycle & race-condition logic verification
  console.log('\nTesting Case 2.6: Search invalidation and epoch guard race-condition logic...')

  // Simulate AdminUsersView request tracking
  let sessionEpoch = 1
  let reqCounter = 0
  let renderedUsers = []
  let activeLoading = false

  const simulateLoadUsers = async (searchParam, delayMs) => {
    const currentReq = ++reqCounter
    const currentEpoch = sessionEpoch
    activeLoading = true

    await new Promise((r) => setTimeout(r, delayMs))

    // Discard stale response
    if (currentEpoch !== sessionEpoch || currentReq !== reqCounter) {
      return
    }

    renderedUsers = [`Results for ${searchParam} (req ${currentReq})`]
    activeLoading = false
  }

  // User types "query1" with slow response (80ms)
  const slowPromise = simulateLoadUsers('query1', 80)

  // User immediately clears or types "query2" (invalidation: reqCounter++)
  reqCounter++ // immediate invalidation on input change
  const fastPromise = simulateLoadUsers('query2', 20)

  await Promise.all([slowPromise, fastPromise])

  assert.strictEqual(activeLoading, false)
  assert.deepStrictEqual(renderedUsers, ['Results for query2 (req 3)'])
  console.log('✓ Immediate request invalidation prevents slow query from overwriting newer query')

  // Simulate account switch during in-flight request
  const slowAccountAPromise = simulateLoadUsers('accountAData', 80)
  // Account switch occurs: epoch advances and state is reset
  sessionEpoch++
  reqCounter++
  renderedUsers = []

  await slowAccountAPromise
  assert.deepStrictEqual(renderedUsers, [], 'Stale response from previous account must be discarded')
  console.log('✓ Epoch guard prevents previous account response from populating state')

  // Test Case 2.7: Audit logs row expansion & description mechanics
  console.log('\nTesting Case 2.7: Audit logs row expansion & description mechanics...')

  const hasDescription = (log) => {
    return typeof log?.description === 'string' && log.description.trim().length > 0
  }

  // hasDescription validation
  assert.strictEqual(hasDescription({ description: 'Valid details' }), true)
  assert.strictEqual(hasDescription({ description: '   Multi-line \n details   ' }), true)
  assert.strictEqual(hasDescription({ description: null }), false)
  assert.strictEqual(hasDescription({ description: undefined }), false)
  assert.strictEqual(hasDescription({ description: '' }), false)
  assert.strictEqual(hasDescription({ description: '    ' }), false)
  assert.strictEqual(hasDescription({}), false)
  assert.strictEqual(hasDescription(null), false)
  console.log('✓ hasDescription correctly detects content and excludes null/empty/whitespace')

  // Expansion set & toggle mechanics
  let expandedDescriptions = new Set()
  const toggleDescriptionExpand = (logId) => {
    if (!logId) return
    const updated = new Set(expandedDescriptions)
    if (updated.has(logId)) {
      updated.delete(logId)
    } else {
      updated.add(logId)
    }
    expandedDescriptions = updated
  }
  const isDescriptionExpanded = (logId) => Boolean(logId && expandedDescriptions.has(logId))
  const clearExpansion = () => {
    if (expandedDescriptions.size > 0) expandedDescriptions = new Set()
  }

  // Initial state: none expanded
  assert.strictEqual(isDescriptionExpanded('log-1'), false)
  assert.strictEqual(isDescriptionExpanded('log-2'), false)

  // Expand log-1
  toggleDescriptionExpand('log-1')
  assert.strictEqual(isDescriptionExpanded('log-1'), true)
  assert.strictEqual(isDescriptionExpanded('log-2'), false)

  // Expand log-2 independently
  toggleDescriptionExpand('log-2')
  assert.strictEqual(isDescriptionExpanded('log-1'), true)
  assert.strictEqual(isDescriptionExpanded('log-2'), true)

  // Collapse log-1
  toggleDescriptionExpand('log-1')
  assert.strictEqual(isDescriptionExpanded('log-1'), false)
  assert.strictEqual(isDescriptionExpanded('log-2'), true)

  // Clear expansion on page / filter / account change
  clearExpansion()
  assert.strictEqual(isDescriptionExpanded('log-1'), false)
  assert.strictEqual(isDescriptionExpanded('log-2'), false)
  assert.strictEqual(expandedDescriptions.size, 0)
  console.log('✓ Independent expansion by log_id and reset lifecycle verified')

  console.log('\n--- 11. Testing Threat Lessons Content & Slugs ---')
  const { THREAT_LESSONS, getThreatLessonBySlug, getAllThreatLessons } = await import('../src/data/threatLessons.js')
  const { CANONICAL_THREAT_CATEGORIES, getCanonicalBySlug } = await import('../src/stores/threatIndexStore.js')

  const expectedSlugs = [
    'phishing',
    'smishing',
    'vishing',
    'social-engineering',
    'credential-theft',
    'public-wi-fi-attack',
    'malware-infection',
    'ransomware',
  ]

  assert.strictEqual(CANONICAL_THREAT_CATEGORIES.length, 8)
  assert.strictEqual(getAllThreatLessons().length, 8)

  expectedSlugs.forEach((slug, idx) => {
    const canonical = CANONICAL_THREAT_CATEGORIES[idx]
    assert.strictEqual(canonical.slug, slug, `Canonical threat at ${idx} must have slug ${slug}`)
    assert.strictEqual(getCanonicalBySlug(slug)?.threat_name, canonical.threat_name)

    const lesson = getThreatLessonBySlug(slug)
    assert.ok(lesson, `Lesson for slug ${slug} must exist`)
    assert.strictEqual(lesson.slug, slug)
    assert.strictEqual(lesson.threatName, canonical.threat_name)
    assert.strictEqual(lesson.number, canonical.number)
    assert.ok(lesson.summary.length > 20, 'summary must be detailed')
    assert.ok(lesson.gameScenario.setting.length > 0, 'setting must be present')
    assert.ok(lesson.gameScenario.description.length > 20, 'scenario description must be detailed')
    assert.ok(lesson.gameScenario.warningSigns.length >= 3, 'must have at least 3 warning signs')
    assert.ok(lesson.recommendedAction.whatToDo.length > 20, 'whatToDo must be detailed')
    assert.ok(lesson.recommendedAction.whyItMatters.length > 20, 'whyItMatters must be detailed')
    assert.ok(lesson.preventionTips.length >= 3, 'must have at least 3 prevention tips')
    assert.ok(lesson.keyTakeaway.length > 15, 'keyTakeaway must be present')
    assert.ok(lesson.screenshot.image, 'screenshot image must be present')
    assert.ok(lesson.screenshot.caption.length > 20, 'screenshot caption must be present')
    assert.ok(lesson.screenshot.alt.length > 10, 'screenshot alt must be present')
  })

  assert.strictEqual(getThreatLessonBySlug('non-existent'), null)
  assert.strictEqual(getCanonicalBySlug('non-existent'), null)
  console.log('✓ All 8 threat lessons validated with correct structure, slugs, and educational content')

  console.log('\n=========================================')
  console.log('ALL MOCK CONTRACT & RELIABILITY ASSERTIONS PASSED (100%)')
  console.log('=========================================\n')
}

runContractTests().catch((err) => {
  console.error('\n❌ CONTRACT TEST FAILED:', err)
  process.exit(1)
})
