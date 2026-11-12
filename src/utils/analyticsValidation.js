import { CANONICAL_THREAT_CATEGORIES } from '../stores/threatIndexStore.js'

/**
 * Checks whether a decision error rate is a finite number within [0, 1].
 * Non-numbers (including null), NaN/Infinity, and out-of-range numbers return false.
 */
export const isValidErrorRate = (rate) => {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1
}

/**
 * Validates a player `category_breakdown` or classroom `category_fail_rates` payload
 * against the eight canonical threat category names while ignoring extra unknown keys.
 *
 * Returns `{ status: 'unavailable' | 'empty' | 'ready' }`.
 */
export const classifyCategoryBreakdown = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'unavailable' }
  }

  let hasNumericRate = false
  for (const threat of CANONICAL_THREAT_CATEGORIES) {
    if (!Object.hasOwn(raw, threat.name)) {
      return { status: 'unavailable' }
    }
    const val = raw[threat.name]
    if (val === null) {
      continue
    }
    if (isValidErrorRate(val)) {
      hasNumericRate = true
      continue
    }
    return { status: 'unavailable' }
  }

  return {
    status: hasNumericRate ? 'ready' : 'empty',
  }
}
