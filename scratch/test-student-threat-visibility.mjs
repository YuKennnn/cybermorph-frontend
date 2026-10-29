/* global process */
import test from 'node:test'
import assert from 'node:assert/strict'

import { formatThreatUnlockedCount } from '../src/utils/datetime.js'

import {
  CANONICAL_THREAT_CATEGORIES,
  validateThreatIndexResponse,
} from '../src/stores/threatIndexStore.js'

test('formatThreatUnlockedCount handles null last_synced_at as Not synced yet', () => {
  assert.strictEqual(formatThreatUnlockedCount(0, null), 'Not synced yet')
  assert.strictEqual(formatThreatUnlockedCount(3, null), 'Not synced yet')
  assert.strictEqual(formatThreatUnlockedCount(undefined, null), 'Not synced yet')
})

test('formatThreatUnlockedCount formats valid integer count for synced students', () => {
  const syncedAt = '2026-09-28T13:45:00Z'
  assert.strictEqual(formatThreatUnlockedCount(0, syncedAt), '0 of 8 unlocked')
  assert.strictEqual(formatThreatUnlockedCount(1, syncedAt), '1 of 8 unlocked')
  assert.strictEqual(formatThreatUnlockedCount(5, syncedAt), '5 of 8 unlocked')
  assert.strictEqual(formatThreatUnlockedCount(8, syncedAt), '8 of 8 unlocked')
})

test('formatThreatUnlockedCount returns Unavailable for missing, invalid, or out-of-range counts', () => {
  const syncedAt = '2026-09-28T13:45:00Z'
  assert.strictEqual(formatThreatUnlockedCount(-1, syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(9, syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(3.5, syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(NaN, syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount('3', syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(null, syncedAt), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(undefined, syncedAt), 'Unavailable')
})

test('formatThreatUnlockedCount returns Unavailable for unconfirmed or malformed sync status', () => {
  assert.strictEqual(formatThreatUnlockedCount(3, undefined), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(3, ''), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(3, 'not-a-date'), 'Unavailable')
  assert.strictEqual(formatThreatUnlockedCount(3, '2026-02-29T10:00:00Z'), 'Unavailable')
})

test('CANONICAL_THREAT_CATEGORIES has 8 entries in exact backend order with Credential Theft', () => {
  assert.strictEqual(CANONICAL_THREAT_CATEGORIES.length, 8)
  const names = CANONICAL_THREAT_CATEGORIES.map((c) => c.threat_name)
  assert.deepStrictEqual(names, [
    'Phishing',
    'Smishing',
    'Vishing',
    'Social Engineering',
    'Credential Theft',
    'Public Wi-Fi Attack',
    'Malware Infection',
    'Ransomware',
  ])
})

test('validateThreatIndexResponse handles valid 8 canonical threat categories correctly', () => {
  const raw = [
    { threat_name: 'Phishing', is_unlocked: true, unlocked_at: '2026-09-20T10:00:00Z' },
    { threat_name: 'Smishing', is_unlocked: true, unlocked_at: '2026-09-21T11:30:00Z' },
    { threat_name: 'Vishing', is_unlocked: false, unlocked_at: null },
    { threat_name: 'Social Engineering', is_unlocked: false, unlocked_at: null },
    { threat_name: 'Credential Theft', is_unlocked: false, unlocked_at: null },
    { threat_name: 'Public Wi-Fi Attack', is_unlocked: false, unlocked_at: null },
    { threat_name: 'Malware Infection', is_unlocked: false, unlocked_at: null },
    { threat_name: 'Ransomware', is_unlocked: false, unlocked_at: null },
  ]
  const res = validateThreatIndexResponse(raw)
  assert.strictEqual(res.status, 'ready')
  assert.strictEqual(res.entries.length, 8)
  assert.strictEqual(res.entries[0].threat_name, 'Phishing')
  assert.strictEqual(res.entries[0].is_unlocked, true)
  assert.strictEqual(res.entries[1].threat_name, 'Smishing')
  assert.strictEqual(res.entries[1].is_unlocked, true)
  assert.strictEqual(res.entries[2].threat_name, 'Vishing')
  assert.strictEqual(res.entries[2].is_unlocked, false)
})

test('validateThreatIndexResponse rejects incomplete, malformed, or missing payloads', () => {
  assert.strictEqual(validateThreatIndexResponse(null).status, 'malformed')
  assert.strictEqual(validateThreatIndexResponse({}).status, 'malformed')
  assert.strictEqual(validateThreatIndexResponse([]).status, 'empty')
  assert.strictEqual(
    validateThreatIndexResponse([
      { threat_name: 'Phishing', is_unlocked: true, unlocked_at: null },
    ]).status,
    'incomplete',
  )
  assert.strictEqual(
    validateThreatIndexResponse([
      { threat_name: 'Phishing', is_unlocked: 'yes', unlocked_at: null },
    ]).status,
    'malformed',
  )
})

test('map progression calculation: unlocks map if index <= map_progress', () => {
  const maps = ['Home', 'Office', 'Internet Cafe', 'Public Park']
  const calculateUnlockedMaps = (mapProgress) => {
    if (typeof mapProgress !== 'number' || !Number.isInteger(mapProgress) || mapProgress < 0 || mapProgress > 3) {
      return null
    }
    return maps.map((name, idx) => ({
      name,
      isUnlocked: idx <= mapProgress,
    }))
  }

  // 0 = only Home unlocked
  const p0 = calculateUnlockedMaps(0)
  assert.deepStrictEqual(p0.map((m) => m.isUnlocked), [true, false, false, false])

  // 1 = Home and Office unlocked
  const p1 = calculateUnlockedMaps(1)
  assert.deepStrictEqual(p1.map((m) => m.isUnlocked), [true, true, false, false])

  // 2 = Home, Office, Internet Cafe unlocked
  const p2 = calculateUnlockedMaps(2)
  assert.deepStrictEqual(p2.map((m) => m.isUnlocked), [true, true, true, false])

  // 3 = all 4 unlocked
  const p3 = calculateUnlockedMaps(3)
  assert.deepStrictEqual(p3.map((m) => m.isUnlocked), [true, true, true, true])

  // invalid map_progress
  assert.strictEqual(calculateUnlockedMaps(null), null)
  assert.strictEqual(calculateUnlockedMaps(undefined), null)
  assert.strictEqual(calculateUnlockedMaps(-1), null)
  assert.strictEqual(calculateUnlockedMaps(4), null)
})

test('never-synced student vs synced-with-zero threat count distinction', () => {
  // Never synced student: last_synced_at === null
  const neverSyncedCountLabel = formatThreatUnlockedCount(0, null)
  assert.strictEqual(neverSyncedCountLabel, 'Not synced yet')

  // Synced student with 0 unlocks
  const syncedZeroCountLabel = formatThreatUnlockedCount(0, '2026-09-28T13:45:00Z')
  assert.strictEqual(syncedZeroCountLabel, '0 of 8 unlocked')

  // Synced student with 5 unlocks
  const syncedFiveCountLabel = formatThreatUnlockedCount(5, '2026-09-28T13:45:00Z')
  assert.strictEqual(syncedFiveCountLabel, '5 of 8 unlocked')
})

