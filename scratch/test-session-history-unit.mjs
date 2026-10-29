import assert from 'node:assert/strict'
import {
  normalizeSessionHistoryResponse,
  formatFinishingCredits,
} from '../src/utils/playerSessions.js'

console.log('Running Session History Unit Tests...')

// 1. Pagination metadata in normalizeSessionHistoryResponse
{
  const raw = {
    items: [
      {
        session_id: 's1',
        profile_id: 'p1',
        map_name: 'Home',
        duration_seconds: 120,
        credits_earned: 5000,
        credits_lost: 100,
        credits_left: 4900,
        false_positives: 0,
        result: 'win',
        played_at: '2026-09-28T14:30:00Z',
      },
    ],
    total_count: 42,
    page: 2,
    page_size: 20,
  }

  const norm = normalizeSessionHistoryResponse(raw, 'p1')
  assert.equal(norm.valid, true)
  assert.equal(norm.totalCount, 42)
  assert.equal(norm.page, 2)
  assert.equal(norm.pageSize, 20)
  assert.equal(norm.gamesPlayed, 42)
  assert.equal(norm.items.length, 1)
  console.log('✔ Pagination metadata correctly normalized')
}

// 2. Profile mismatch validation
{
  const raw = {
    items: [{ session_id: 's1', profile_id: 'p2' }],
    total_count: 1,
    page: 1,
    page_size: 20,
  }
  const norm = normalizeSessionHistoryResponse(raw, 'p1')
  assert.equal(norm.valid, false)
  assert.equal(norm.items.length, 0)
  assert.match(norm.error, /does not match the active player profile/)
  console.log('✔ Profile isolation verified')
}

// 3. Fallbacks on missing or invalid page / page_size
{
  const raw = {
    items: [],
    total_count: 'invalid',
    page: -5,
    page_size: 'abc',
  }
  const norm = normalizeSessionHistoryResponse(raw, 'p1')
  assert.equal(norm.valid, true)
  assert.equal(norm.totalCount, null)
  assert.equal(norm.page, 1)
  assert.equal(norm.pageSize, 20)
  console.log('✔ Invalid metadata defaults safely')
}

// 4. Finishing credits formatting
{
  assert.equal(formatFinishingCredits(120), '120')
  assert.equal(formatFinishingCredits(0), '0')
  assert.equal(formatFinishingCredits(null), 'Not recorded')
  assert.equal(formatFinishingCredits(undefined), 'Not recorded')
  assert.equal(formatFinishingCredits(-10), 'Unavailable')
  assert.equal(formatFinishingCredits('100'), 'Unavailable')
  assert.equal(formatFinishingCredits(NaN), 'Unavailable')
  console.log('✔ Finishing credits formatting verified')
}

console.log('ALL UNIT TESTS PASSED!')
