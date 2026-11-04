/* global process */
import assert from 'node:assert'
import {
  formatLastSyncedDate,
  formatPlayDataUploadTimestamp,
  formatAuditLogTimestamp,
} from '../src/utils/datetime.js'
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

// 3. Play Data Formatter: MUST remain strictly Asia/Manila (PHT) regardless of process TZ
const playDataNaive = formatPlayDataUploadTimestamp('2026-11-03T04:43:00')
const playDataMidnight = formatPlayDataUploadTimestamp('2026-11-03T18:00:00Z')

assert.strictEqual(
  playDataNaive.formatted,
  'Nov 3, 2026, 12:43 PM',
  `Play data naive UTC must format to Asia/Manila 12:43 PM in TZ=${tz}`
)
assert.strictEqual(
  playDataMidnight.formatted,
  'Nov 4, 2026, 2:00 AM',
  `Play data 18:00 UTC must format to Asia/Manila Nov 4 2:00 AM in TZ=${tz}`
)
console.log(`  ✓ Play data strictly Asia/Manila in ${tz}: "${playDataNaive.formatted}", "${playDataMidnight.formatted}"`)

// 4. Audit Log Formatter: MUST remain strictly Asia/Manila (PHT) regardless of process TZ
const auditNaive = formatAuditLogTimestamp('2026-11-03T04:43:00')
const auditMidnight = formatAuditLogTimestamp('2026-11-03T18:00:00Z')

assert.strictEqual(
  auditNaive.formatted,
  'Nov 3, 2026, 12:43 PM',
  `Audit log naive UTC must format to Asia/Manila 12:43 PM in TZ=${tz}`
)
assert.strictEqual(
  auditMidnight.formatted,
  'Nov 4, 2026, 2:00 AM',
  `Audit log 18:00 UTC must format to Asia/Manila Nov 4 2:00 AM in TZ=${tz}`
)
console.log(`  ✓ Audit logs strictly Asia/Manila in ${tz}: "${auditNaive.formatted}", "${auditMidnight.formatted}"`)

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
