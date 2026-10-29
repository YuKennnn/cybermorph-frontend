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

import { CANONICAL_THREAT_CATEGORIES } from '../src/stores/threatIndexStore.js'
import {
  resolveCurrentMapName,
  resolveHighestUnlockedMapName,
  isMapUnlocked,
} from '../src/utils/playerSessions.js'
import {
  formatMemberMapProgress,
  validateMyClassroomPayload,
} from '../src/stores/playerClassroomStore.js'

console.log('--- Running Pass 1 API Alignment Verifications ---\n')

// 1. Canonical Threat Categories Verification
console.log('1. Checking Canonical Threat Categories...')
assert.strictEqual(CANONICAL_THREAT_CATEGORIES.length, 8, 'Must have 8 canonical categories')
const expectedThreatOrder = [
  'Phishing',
  'Smishing',
  'Vishing',
  'Social Engineering',
  'Credential Theft',
  'Public Wi-Fi Attack',
  'Malware Infection',
  'Ransomware',
]
CANONICAL_THREAT_CATEGORIES.forEach((cat, idx) => {
  assert.strictEqual(cat.threat_name, expectedThreatOrder[idx], `Category ${idx} threat_name mismatch`)
  assert.strictEqual(cat.name, expectedThreatOrder[idx], `Category ${idx} name alias mismatch`)
  assert.ok(cat.summary && typeof cat.summary === 'string', `Category ${idx} must retain summary educational copy`)
})
assert.strictEqual(CANONICAL_THREAT_CATEGORIES[4].threat_name, 'Credential Theft')
assert.strictEqual(CANONICAL_THREAT_CATEGORIES[4].name, 'Credential Theft')
console.log('✓ Canonical threat categories match exact API contract and preserve order & descriptions.')

// 2. Map Progression Helpers (0-3) Verification
console.log('\n2. Checking Map Progression Helpers in playerSessions.js...')
assert.strictEqual(resolveCurrentMapName(0), 'Home')
assert.strictEqual(resolveCurrentMapName(1), 'Office')
assert.strictEqual(resolveCurrentMapName(2), 'Internet Cafe')
assert.strictEqual(resolveCurrentMapName(3), 'Public Park')

// Strict invalid/missing handling: no clamping, no fraction truncation
assert.strictEqual(resolveCurrentMapName(4), null, 'Map index 4 must return null')
assert.strictEqual(resolveCurrentMapName(-1), null, 'Negative map index must return null')
assert.strictEqual(resolveCurrentMapName(null), null, 'null must return null')
assert.strictEqual(resolveCurrentMapName(undefined), null, 'undefined must return null')
assert.strictEqual(resolveCurrentMapName(1.5), null, 'Fraction must return null')
assert.strictEqual(resolveCurrentMapName('0'), null, 'String must return null')

// Highest unlocked map name alias
assert.strictEqual(resolveHighestUnlockedMapName(0), 'Home')
assert.strictEqual(resolveHighestUnlockedMapName(3), 'Public Park')

// isMapUnlocked tests
assert.strictEqual(isMapUnlocked(0, 0), true, 'Map 0 unlocked with progress 0')
assert.strictEqual(isMapUnlocked('Home', 0), true, 'Home unlocked with progress 0')
assert.strictEqual(isMapUnlocked(1, 0), false, 'Map 1 locked with progress 0')
assert.strictEqual(isMapUnlocked('Office', 0), false, 'Office locked with progress 0')
assert.strictEqual(isMapUnlocked(1, 1), true, 'Map 1 unlocked with progress 1')
assert.strictEqual(isMapUnlocked(2, 1), false, 'Map 2 locked with progress 1')
assert.strictEqual(isMapUnlocked(2, 2), true, 'Map 2 unlocked with progress 2')
assert.strictEqual(isMapUnlocked(3, 2), false, 'Map 3 locked with progress 2')
assert.strictEqual(isMapUnlocked(3, 3), true, 'Map 3 unlocked with progress 3')
assert.strictEqual(isMapUnlocked(0, null), false, 'Invalid progress locks all maps')
console.log('✓ resolveCurrentMapName and isMapUnlocked strictly follow 0-3 progression.')

// 3. Member Map Progress Formatting & Classroom Validation
console.log('\n3. Checking Classroom Map Progress Formatting & Validation...')
assert.strictEqual(formatMemberMapProgress(0), 'Map 1 of 4 · Home')
assert.strictEqual(formatMemberMapProgress(1), 'Map 2 of 4 · Office')
assert.strictEqual(formatMemberMapProgress(2), 'Map 3 of 4 · Internet Cafe')
assert.strictEqual(formatMemberMapProgress(3), 'Map 4 of 4 · Public Park')
assert.strictEqual(formatMemberMapProgress(4), 'Map progress unavailable')
assert.strictEqual(formatMemberMapProgress(null), 'Map progress unavailable')
assert.strictEqual(formatMemberMapProgress(undefined), 'Map progress unavailable')
assert.strictEqual(formatMemberMapProgress(-1), 'Map progress unavailable')
assert.strictEqual(formatMemberMapProgress(1.5), 'Map progress unavailable')

const validClassroomWithZero = {
  code_id: 'c1',
  name: 'Security Lab 101',
  members: [
    { username: 'NewStudent', map_progress: 0 },
    { username: 'AdvancedStudent', map_progress: 3 },
  ],
}
const valRes1 = validateMyClassroomPayload(validClassroomWithZero)
assert.strictEqual(valRes1.valid, true, 'Validation must accept map_progress 0 and 3')

const invalidClassroomWithFour = {
  code_id: 'c1',
  name: 'Security Lab 101',
  members: [{ username: 'InvalidStudent', map_progress: 4 }],
}
const valRes2 = validateMyClassroomPayload(invalidClassroomWithFour)
assert.strictEqual(valRes2.valid, false, 'Validation must reject map_progress 4')

const invalidClassroomWithFraction = {
  code_id: 'c1',
  name: 'Security Lab 101',
  members: [{ username: 'FractionStudent', map_progress: 1.5 }],
}
const valRes3 = validateMyClassroomPayload(invalidClassroomWithFraction)
assert.strictEqual(valRes3.valid, false, 'Validation must reject fraction map_progress')

const invalidClassroomWithNull = {
  code_id: 'c1',
  name: 'Security Lab 101',
  members: [{ username: 'NullStudent', map_progress: null }],
}
const valRes4 = validateMyClassroomPayload(invalidClassroomWithNull)
assert.strictEqual(valRes4.valid, false, 'Validation must reject null map_progress in member array')

console.log('✓ formatMemberMapProgress and validateMyClassroomPayload strictly handle 0-3 integers.')

// 4. Client & Mock Endpoints Alignment
console.log('\n4. Checking Mock Endpoints for Credential Theft & 0-based map_progress...')
const clientModule = await import('../src/api/client.js')
const client = clientModule.default
await import('../src/api/mock.js')

// A. Threat Index Mock
const threatIndexRes = await client.get('/players/threat-index')
assert.strictEqual(threatIndexRes.status, 200)
assert.strictEqual(threatIndexRes.data[4].threat_name, 'Credential Theft')
console.log('✓ Mock /players/threat-index has Credential Theft at index 4')

// B. Player Profile Mock
const playerRes = await client.get('/players/me')
assert.strictEqual(playerRes.status, 200)
assert.strictEqual(typeof playerRes.data.map_progress, 'number')
assert.ok(playerRes.data.map_progress >= 0 && playerRes.data.map_progress <= 3)
console.log(`✓ Mock /players/me returns map_progress ${playerRes.data.map_progress} (in 0-3 range)`)

// C. Classroom analytics mock
const classAnalyticsRes = await client.get('/analytics/classroom', { params: { classroom_id: 'c1' } })
assert.strictEqual(classAnalyticsRes.status, 200)
assert.ok('Credential Theft' in classAnalyticsRes.data.category_fail_rates, 'Classroom analytics must key Credential Theft')
assert.strictEqual('Credential Theft / Weak Password Attack' in classAnalyticsRes.data.category_fail_rates, false)
console.log('✓ Mock /analytics/classroom uses Credential Theft')

// D. Player analytics mock
const playerAnalyticsRes = await client.get('/analytics/player', { params: { student_id: 'p1' } })
assert.strictEqual(playerAnalyticsRes.status, 200)
assert.ok('Credential Theft' in playerAnalyticsRes.data.category_breakdown, 'Player analytics must key Credential Theft')
console.log('✓ Mock /analytics/player uses Credential Theft')

console.log('\n=========================================')
console.log('ALL PASS 1 ALIGNMENT VERIFICATIONS PASSED')
console.log('=========================================\n')
