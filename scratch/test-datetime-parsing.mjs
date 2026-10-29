/* global process */
import { test, describe } from 'node:test'
import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import { parseBackendUtcTimestamp, formatLastSyncedDate } from '../src/utils/datetime.js'
import { formatThreatUnlockDate, validateThreatIndexResponse } from '../src/stores/threatIndexStore.js'
import { formatSessionDate } from '../src/utils/playerSessions.js'

describe('Backend UTC Timestamp Parser & Formatter Suite', () => {
  test('1. Equivalent naive UTC, Z, and explicit offset produce identical instant', () => {
    // 08:00 UTC represented as naive UTC, with Z, and as Manila (+08:00) or Los Angeles (-07:00 PDT)
    const naive = parseBackendUtcTimestamp('2026-10-28T08:00:00')
    const withZ = parseBackendUtcTimestamp('2026-10-28T08:00:00Z')
    const withOffsetManila = parseBackendUtcTimestamp('2026-10-28T16:00:00+08:00')
    const withOffsetLA = parseBackendUtcTimestamp('2026-10-28T01:00:00-07:00')

    assert.ok(naive !== null, 'Naive UTC must parse')
    assert.ok(withZ !== null, 'Z must parse')
    assert.ok(withOffsetManila !== null, 'Manila offset must parse')
    assert.ok(withOffsetLA !== null, 'LA offset must parse')

    const expectedEpochMs = Date.UTC(2026, 9, 28, 8, 0, 0)
    assert.strictEqual(naive.getTime(), expectedEpochMs)
    assert.strictEqual(withZ.getTime(), expectedEpochMs)
    assert.strictEqual(withOffsetManila.getTime(), expectedEpochMs)
    assert.strictEqual(withOffsetLA.getTime(), expectedEpochMs)

    assert.strictEqual(naive.toISOString(), '2026-10-28T08:00:00.000Z')
    assert.strictEqual(withZ.toISOString(), '2026-10-28T08:00:00.000Z')
    assert.strictEqual(withOffsetManila.toISOString(), '2026-10-28T08:00:00.000Z')
    assert.strictEqual(withOffsetLA.toISOString(), '2026-10-28T08:00:00.000Z')
  })

  test('2. Years 0000-0099: reject year 0000 and preserve exact calendar years 1-99', () => {
    // Year 0000: rejected (Python datetime min year is 1)
    assert.strictEqual(parseBackendUtcTimestamp('0000-01-01T00:00:00Z'), null)
    assert.strictEqual(parseBackendUtcTimestamp('0000-12-31T23:59:59'), null)

    // Year 0001: exact preservation, not shifted to 1901
    const y1 = parseBackendUtcTimestamp('0001-01-01T00:00:00Z')
    assert.ok(y1 !== null)
    assert.strictEqual(y1.getUTCFullYear(), 1)
    assert.strictEqual(y1.toISOString(), '0001-01-01T00:00:00.000Z')

    // Year 0004: leap year Feb 29 preserved exactly
    const leapY4 = parseBackendUtcTimestamp('0004-02-29T12:00:00Z')
    assert.ok(leapY4 !== null)
    assert.strictEqual(leapY4.getUTCFullYear(), 4)
    assert.strictEqual(leapY4.getUTCMonth(), 1)
    assert.strictEqual(leapY4.getUTCDate(), 29)
    assert.strictEqual(leapY4.toISOString(), '0004-02-29T12:00:00.000Z')

    // Year 0099: exact preservation with offset and fractional seconds
    const y99 = parseBackendUtcTimestamp('0099-12-31T23:59:59.500+08:00')
    assert.ok(y99 !== null)
    // 23:59:59.500 +08:00 = 15:59:59.500 UTC on 0099-12-31
    assert.strictEqual(y99.getUTCFullYear(), 99)
    assert.strictEqual(y99.getUTCMonth(), 11)
    assert.strictEqual(y99.getUTCDate(), 31)
    assert.strictEqual(y99.getUTCHours(), 15)
    assert.strictEqual(y99.getUTCMinutes(), 59)
    assert.strictEqual(y99.getUTCSeconds(), 59)
    assert.strictEqual(y99.getUTCMilliseconds(), 500)
    assert.strictEqual(y99.toISOString(), '0099-12-31T15:59:59.500Z')

    // Year 0100: boundary transition
    const y100 = parseBackendUtcTimestamp('0100-01-01T00:00:00Z')
    assert.ok(y100 !== null)
    assert.strictEqual(y100.getUTCFullYear(), 100)
    assert.strictEqual(y100.toISOString(), '0100-01-01T00:00:00.000Z')

    // Year 0100 is NOT a leap year in Gregorian calendar
    assert.strictEqual(parseBackendUtcTimestamp('0100-02-29T12:00:00Z'), null)
  })

  test('3. Near-midnight values under UTC, Asia/Manila, and America/Los_Angeles', () => {
    // 23:59:59 UTC on 2026-10-28
    const utcMidnight = parseBackendUtcTimestamp('2026-10-28T23:59:59Z')
    assert.ok(utcMidnight !== null)

    // Formatted under UTC: day must be Oct 28
    const utcDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(utcMidnight)
    assert.strictEqual(utcDay, 'Oct 28, 2026')

    // Formatted under Asia/Manila (UTC+8): 23:59:59 + 8h = 07:59:59 on Oct 29
    const manilaDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(utcMidnight)
    assert.ok(manilaDay.includes('Oct 29, 2026'), `Manila must be Oct 29 (got: ${manilaDay})`)

    // Formatted under America/Los_Angeles (UTC-7 PDT): 23:59:59 - 7h = 16:59:59 on Oct 28
    const laDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(utcMidnight)
    assert.ok(laDay.includes('Oct 28, 2026'), `LA must be Oct 28 (got: ${laDay})`)
  })

  test('4. Isolated Node processes under TZ=UTC, TZ=Asia/Manila, and TZ=America/Los_Angeles', () => {
    const timezones = ['UTC', 'Asia/Manila', 'America/Los_Angeles']
    for (const tz of timezones) {
      const res = spawnSync(process.execPath, ['scratch/test-timezone-process.mjs', tz], {
        env: {
          ...process.env,
          TZ: tz,
        },
        encoding: 'utf-8',
      })
      if (res.status !== 0) {
        console.error(`Error output for TZ=${tz}:\n`, res.stderr || res.stdout)
      }
      assert.strictEqual(res.status, 0, `Isolated process for TZ=${tz} must succeed`)
      assert.ok(res.stdout.includes(`All checks passed for TZ=${tz}`))
    }
  })

  test('5. Fractional seconds without rounding into next second', () => {
    // 999 milliseconds
    const subSecondHigh = parseBackendUtcTimestamp('2026-10-28T12:00:00.999999Z')
    assert.ok(subSecondHigh !== null)
    assert.strictEqual(subSecondHigh.getUTCFullYear(), 2026)
    assert.strictEqual(subSecondHigh.getUTCSeconds(), 0, 'Seconds must remain 00, not rounded to 01')
    assert.strictEqual(subSecondHigh.getUTCMilliseconds(), 999)
    assert.strictEqual(subSecondHigh.toISOString(), '2026-10-28T12:00:00.999Z')

    // 1 digit fraction (.5 -> 500ms)
    const subSecondHalf = parseBackendUtcTimestamp('2026-10-28T12:00:00.5Z')
    assert.ok(subSecondHalf !== null)
    assert.strictEqual(subSecondHalf.getUTCMilliseconds(), 500)

    // 2 digit fraction (.25 -> 250ms)
    const subSecondQuarter = parseBackendUtcTimestamp('2026-10-28T12:00:00.25Z')
    assert.ok(subSecondQuarter !== null)
    assert.strictEqual(subSecondQuarter.getUTCMilliseconds(), 250)
  })

  test('6. Leap days and impossible calendar dates', () => {
    // Leap year 2024: Feb 29 is valid
    const leap2024 = parseBackendUtcTimestamp('2024-02-29T12:00:00Z')
    assert.ok(leap2024 !== null)
    assert.strictEqual(leap2024.toISOString(), '2024-02-29T12:00:00.000Z')

    // Non-leap year 2026: Feb 29 is impossible -> null
    assert.strictEqual(parseBackendUtcTimestamp('2026-02-29T12:00:00Z'), null)

    // Impossible days in month
    assert.strictEqual(parseBackendUtcTimestamp('2026-04-31T12:00:00Z'), null, 'April 31 is impossible')
    assert.strictEqual(parseBackendUtcTimestamp('2026-02-30T12:00:00Z'), null, 'Feb 30 is impossible')
    assert.strictEqual(parseBackendUtcTimestamp('2026-00-10T12:00:00Z'), null, 'Month 00 is impossible')
    assert.strictEqual(parseBackendUtcTimestamp('2026-13-10T12:00:00Z'), null, 'Month 13 is impossible')
    assert.strictEqual(parseBackendUtcTimestamp('2026-05-00T12:00:00Z'), null, 'Day 00 is impossible')
    assert.strictEqual(parseBackendUtcTimestamp('2026-05-32T12:00:00Z'), null, 'Day 32 is impossible')

    // Impossible time bounds
    assert.strictEqual(parseBackendUtcTimestamp('2026-05-15T24:00:00Z'), null, 'Hour 24 is out of bounds')
    assert.strictEqual(parseBackendUtcTimestamp('2026-05-15T23:60:00Z'), null, 'Minute 60 is out of bounds')
    assert.strictEqual(parseBackendUtcTimestamp('2026-05-15T23:59:60Z'), null, 'Second 60 is out of bounds')
  })

  test('7. Rejection of null, undefined, blank, malformed, non-string inputs', () => {
    assert.strictEqual(parseBackendUtcTimestamp(null), null)
    assert.strictEqual(parseBackendUtcTimestamp(undefined), null)
    assert.strictEqual(parseBackendUtcTimestamp(''), null)
    assert.strictEqual(parseBackendUtcTimestamp('   '), null)
    assert.strictEqual(parseBackendUtcTimestamp('invalid-date-string'), null)
    assert.strictEqual(parseBackendUtcTimestamp('2026-10-28'), null, 'Date-only string rejected')
    assert.strictEqual(parseBackendUtcTimestamp(1729872000000), null)
    assert.strictEqual(parseBackendUtcTimestamp({}), null)
    assert.strictEqual(parseBackendUtcTimestamp([]), null)
  })

  test('8. Existing display choices preserved: Threat Index UTC, Sessions local', () => {
    // Threat Index: Naive UTC string formatted in UTC
    const unlockLabel = formatThreatUnlockDate('2026-10-28T08:00:00')
    assert.strictEqual(unlockLabel, 'Unlocked Oct 28, 2026')

    // Invalid unlock timestamp returns 'Unlock date unavailable'
    assert.strictEqual(formatThreatUnlockDate(null), 'Unlock date unavailable')
    assert.strictEqual(formatThreatUnlockDate(''), 'Unlock date unavailable')
    assert.strictEqual(formatThreatUnlockDate('bad-date'), 'Unlock date unavailable')
    assert.strictEqual(formatThreatUnlockDate('2026-02-29T10:00:00'), 'Unlock date unavailable')

    // Session Date: Formatted in local browser time
    const sessionInfo = formatSessionDate('2026-10-28T08:00:00Z')
    assert.strictEqual(sessionInfo.valid, true)
    assert.ok(sessionInfo.fullLabel !== 'Date unavailable')
    assert.ok(sessionInfo.shortLabel !== '—')

    const invalidSessionInfo = formatSessionDate('not-a-date')
    assert.strictEqual(invalidSessionInfo.valid, false)
    assert.strictEqual(invalidSessionInfo.fullLabel, 'Date unavailable')
    assert.strictEqual(invalidSessionInfo.shortLabel, '—')
  })

  test('9. Confirmed never-synced versus malformed versus unresolved sync states', () => {
    // Confirmed never synced (last_synced_at === null from successful roster)
    assert.strictEqual(formatLastSyncedDate(null), 'Not synced yet')

    // Valid sync timestamp formats in local date
    const formatted = formatLastSyncedDate('2026-09-28T13:45:00Z')
    assert.ok(formatted !== 'Not synced yet' && formatted !== 'Sync date unavailable')
    assert.ok(formatted.includes('2026'))

    // Missing, empty, or malformed sync date returns 'Sync date unavailable'
    assert.strictEqual(formatLastSyncedDate(undefined), 'Sync date unavailable')
    assert.strictEqual(formatLastSyncedDate(''), 'Sync date unavailable')
    assert.strictEqual(formatLastSyncedDate('   '), 'Sync date unavailable')
    assert.strictEqual(formatLastSyncedDate('malformed-sync-date'), 'Sync date unavailable')
    assert.strictEqual(formatLastSyncedDate('2026-02-29T10:00:00Z'), 'Sync date unavailable')
  })

  test('10. Threat Index validation rejects malformed or impossible unlock dates', () => {
    // Valid 8 canonical threats
    const validThreats = [
      { threat_name: 'Phishing', is_unlocked: true, unlocked_at: '2026-10-28T08:00:00' },
      { threat_name: 'Smishing', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Vishing', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Social Engineering', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Credential Theft', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Public Wi-Fi Attack', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Malware Infection', is_unlocked: false, unlocked_at: null },
      { threat_name: 'Ransomware', is_unlocked: false, unlocked_at: null },
    ]
    const validRes = validateThreatIndexResponse(validThreats)
    assert.strictEqual(validRes.status, 'ready')
    assert.strictEqual(validRes.entries[0].unlock_date_label, 'Unlocked Oct 28, 2026')

    // Impossible unlock date (2026-02-29) -> rejected as malformed
    const impossibleDateThreats = [
      { threat_name: 'Phishing', is_unlocked: true, unlocked_at: '2026-02-29T08:00:00' },
      ...validThreats.slice(1),
    ]
    const invalidRes = validateThreatIndexResponse(impossibleDateThreats)
    assert.strictEqual(invalidRes.status, 'malformed')
    assert.strictEqual(invalidRes.error, 'Threat index response contains invalid unlock dates.')
  })
})
