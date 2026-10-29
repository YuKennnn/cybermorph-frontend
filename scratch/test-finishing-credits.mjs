/* global process */
import test from 'node:test'
import assert from 'node:assert/strict'

import { formatFinishingCredits } from '../src/utils/playerSessions.js'

test('formatFinishingCredits handles valid non-negative integers including 0', () => {
  assert.strictEqual(formatFinishingCredits(0), '0')
  assert.strictEqual(formatFinishingCredits(1), '1')
  assert.strictEqual(formatFinishingCredits(130), '130')
  assert.strictEqual(formatFinishingCredits(500), '500')
})

test('formatFinishingCredits handles null or missing values as Not recorded', () => {
  assert.strictEqual(formatFinishingCredits(null), 'Not recorded')
  assert.strictEqual(formatFinishingCredits(undefined), 'Not recorded')
})

test('formatFinishingCredits returns Unavailable for malformed values (no coercion, clamping, or truncating)', () => {
  // Negative
  assert.strictEqual(formatFinishingCredits(-1), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(-130), 'Unavailable')

  // Floats / fractions (must not truncate)
  assert.strictEqual(formatFinishingCredits(12.5), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(0.1), 'Unavailable')

  // Strings (must not coerce)
  assert.strictEqual(formatFinishingCredits('130'), 'Unavailable')
  assert.strictEqual(formatFinishingCredits('0'), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(''), 'Unavailable')
  assert.strictEqual(formatFinishingCredits('null'), 'Unavailable')

  // Non-number primitives / objects
  assert.strictEqual(formatFinishingCredits(NaN), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(Infinity), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(-Infinity), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(true), 'Unavailable')
  assert.strictEqual(formatFinishingCredits(false), 'Unavailable')
  assert.strictEqual(formatFinishingCredits({}), 'Unavailable')
  assert.strictEqual(formatFinishingCredits([]), 'Unavailable')
})
