/* global process */
import assert from 'node:assert'

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

  console.log('\n=========================================')
  console.log('ALL MOCK CONTRACT ASSERTIONS PASSED (100%)')
  console.log('=========================================\n')
}

runContractTests().catch((err) => {
  console.error('\n❌ CONTRACT TEST FAILED:', err)
  process.exit(1)
})
