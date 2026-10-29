/* global process */
import assert from 'node:assert'
import { formatLastSyncedDate } from '../src/utils/datetime.js'
import { formatThreatUnlockDate } from '../src/stores/threatIndexStore.js'
import { formatSessionDate } from '../src/utils/playerSessions.js'

const tz = process.argv[2] || process.env.TZ || 'UTC'
console.log(`[Worker] Running timezone test in isolated process with TZ=${tz}...`)

// Timezone-free near-midnight inputs (treated as UTC by parseBackendUtcTimestamp)
const beforeMidnightUtc = '2026-10-28T23:30:00'
const afterMidnightUtc = '2026-10-29T00:30:00'

// 1. Threat Index: MUST remain UTC regardless of process TZ
const unlockBefore = formatThreatUnlockDate(beforeMidnightUtc)
const unlockAfter = formatThreatUnlockDate(afterMidnightUtc)

assert.strictEqual(
  unlockBefore,
  'Unlocked Oct 28, 2026',
  `Threat Index before midnight must be Oct 28 UTC in ${tz}`
)
assert.strictEqual(
  unlockAfter,
  'Unlocked Oct 29, 2026',
  `Threat Index after midnight must be Oct 29 UTC in ${tz}`
)
console.log(`  ✓ Threat Index strictly UTC in ${tz}: "${unlockBefore}", "${unlockAfter}"`)

// 2. Session & Sync Formatters: reflect browser-local time (process TZ)
const sessionBefore = formatSessionDate(beforeMidnightUtc)
const sessionAfter = formatSessionDate(afterMidnightUtc)
const syncBefore = formatLastSyncedDate(beforeMidnightUtc)
const syncAfter = formatLastSyncedDate(afterMidnightUtc)

if (tz === 'UTC') {
  // Before midnight is Oct 28; after midnight is Oct 29
  assert.strictEqual(sessionBefore.shortLabel, 'Oct 28')
  assert.ok(sessionBefore.fullLabel.includes('Oct 28, 2026'))
  assert.ok(syncBefore.includes('Oct 28, 2026'))

  assert.strictEqual(sessionAfter.shortLabel, 'Oct 29')
  assert.ok(sessionAfter.fullLabel.includes('Oct 29, 2026'))
  assert.ok(syncAfter.includes('Oct 29, 2026'))
} else if (tz === 'Asia/Manila') {
  // UTC+8: 23:30 UTC -> 07:30 Oct 29 (crosses midnight)
  // 00:30 UTC -> 08:30 Oct 29
  assert.strictEqual(sessionBefore.shortLabel, 'Oct 29')
  assert.ok(sessionBefore.fullLabel.includes('Oct 29, 2026'))
  assert.ok(syncBefore.includes('Oct 29, 2026'))

  assert.strictEqual(sessionAfter.shortLabel, 'Oct 29')
  assert.ok(sessionAfter.fullLabel.includes('Oct 29, 2026'))
  assert.ok(syncAfter.includes('Oct 29, 2026'))
} else if (tz === 'America/Los_Angeles') {
  // PDT (UTC-7 in Oct): 23:30 UTC -> 16:30 Oct 28
  // 00:30 UTC -> 17:30 Oct 28 (crosses back across midnight)
  assert.strictEqual(sessionBefore.shortLabel, 'Oct 28')
  assert.ok(sessionBefore.fullLabel.includes('Oct 28, 2026'))
  assert.ok(syncBefore.includes('Oct 28, 2026'))

  assert.strictEqual(sessionAfter.shortLabel, 'Oct 28')
  assert.ok(sessionAfter.fullLabel.includes('Oct 28, 2026'))
  assert.ok(syncAfter.includes('Oct 28, 2026'))
}

console.log(`  ✓ Session and sync formatters correctly evaluate local midnight boundaries in ${tz}.`)
console.log(`[Worker] All checks passed for TZ=${tz}.\n`)
