export const FALSE_POSITIVE_PENALTY = 25

export const CANONICAL_SESSION_MAPS = Object.freeze([
  'Home',
  'Office',
  'Internet Cafe',
  'Public Park',
])

export const SHORT_MAP_TAGS = Object.freeze({
  Home: 'Home',
  Office: 'Office',
  'Internet Cafe': 'Cafe',
  'Public Park': 'Park',
})

const RESULT_LABELS = Object.freeze({
  win: 'Win',
  lose: 'Lose',
  timeout: 'Timeout',
})

/**
 * Checks whether a value is a finite non-negative integer/number counter.
 * Missing, null, NaN, negative, or non-number values return false.
 */
export const isValidNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/**
 * Resolves a player's highest unlocked map name from documented 0-based `map_progress` (0–3):
 * 0 = Home; 1 = Office; 2 = Internet Cafe; 3 = Public Park.
 * Returns null if `map_progress` is missing or invalid (never defaults to 'Home').
 * Strictly requires an integer; does not truncate fractions or clamp out-of-range values.
 *
 * @param {unknown} mapProgress
 * @returns {string | null}
 */
export const resolveHighestUnlockedMapName = (mapProgress) => {
  if (typeof mapProgress !== 'number' || !Number.isInteger(mapProgress)) {
    return null
  }
  if (mapProgress < 0 || mapProgress >= CANONICAL_SESSION_MAPS.length) {
    return null
  }
  return CANONICAL_SESSION_MAPS[mapProgress]
}

/**
 * Backward-compatible alias for resolveHighestUnlockedMapName.
 */
export const resolveCurrentMapName = resolveHighestUnlockedMapName

/**
 * Checks whether a map is unlocked according to the player's `map_progress` (0–3).
 * Maps with index <= map_progress are unlocked.
 * Returns false if mapProgress is missing or invalid.
 *
 * @param {string | number} mapNameOrIndex
 * @param {unknown} mapProgress
 * @returns {boolean}
 */
export const isMapUnlocked = (mapNameOrIndex, mapProgress) => {
  if (typeof mapProgress !== 'number' || !Number.isInteger(mapProgress) || mapProgress < 0 || mapProgress > 3) {
    return false
  }
  const index =
    typeof mapNameOrIndex === 'number'
      ? mapNameOrIndex
      : CANONICAL_SESSION_MAPS.indexOf(mapNameOrIndex)
  if (index < 0 || index >= CANONICAL_SESSION_MAPS.length) {
    return false
  }
  return index <= mapProgress
}

/**
 * Computes the verified backend session score:
 *   max(0, credits_earned - credits_lost - 25 * false_positives)
 *
 * Returns `null` if any required numeric field (`credits_earned`, `credits_lost`,
 * `false_positives`) is missing or invalid. Never defaults invalid fields to 0.
 * `credits_left` is kept separate and never used here.
 */
export const computeSessionScore = (session) => {
  if (!session || typeof session !== 'object') return null
  const { credits_earned, credits_lost, false_positives } = session
  if (
    !isValidNonNegativeNumber(credits_earned) ||
    !isValidNonNegativeNumber(credits_lost) ||
    !isValidNonNegativeNumber(false_positives)
  ) {
    return null
  }

  const earned = Math.trunc(credits_earned)
  const lost = Math.trunc(credits_lost)
  const fp = Math.trunc(false_positives)
  const penalty = fp * FALSE_POSITIVE_PENALTY

  return Math.max(0, earned - lost - penalty)
}

export const formatSessionDuration = (durationSeconds) => {
  if (!isValidNonNegativeNumber(durationSeconds)) return 'Unavailable'
  const total = Math.trunc(durationSeconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

export const formatSessionDate = (isoString) => {
  if (typeof isoString !== 'string' || !isoString.trim()) {
    return {
      fullLabel: 'Date unavailable',
      shortLabel: '—',
      valid: false,
    }
  }
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return {
      fullLabel: 'Date unavailable',
      shortLabel: '—',
      valid: false,
    }
  }
  return {
    fullLabel: parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    shortLabel: parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    valid: true,
  }
}

/**
 * Normalizes a single session record from `GET /sessions/history`.
 */
export const normalizeSessionItem = (rawItem, index = 0) => {
  const item = rawItem && typeof rawItem === 'object' ? rawItem : {}
  const sessionId =
    typeof item.session_id === 'string' && item.session_id.trim()
      ? item.session_id.trim()
      : `session-row-${index}`

  const rawMapName = typeof item.map_name === 'string' ? item.map_name.trim() : ''
  const isKnownMap = CANONICAL_SESSION_MAPS.includes(rawMapName)
  const mapName = isKnownMap ? rawMapName : 'Unavailable'
  const shortMapTag = isKnownMap ? SHORT_MAP_TAGS[rawMapName] : '—'

  const rawResult = typeof item.result === 'string' ? item.result.trim().toLowerCase() : ''
  const resultKey = rawResult in RESULT_LABELS ? rawResult : 'unknown'
  const resultLabel = RESULT_LABELS[resultKey] || 'Unavailable'

  const dateInfo = formatSessionDate(item.played_at)
  const durationSeconds = isValidNonNegativeNumber(item.duration_seconds)
    ? Math.trunc(item.duration_seconds)
    : null
  const durationLabel = formatSessionDuration(item.duration_seconds)

  const creditsEarned = isValidNonNegativeNumber(item.credits_earned)
    ? Math.trunc(item.credits_earned)
    : null
  const creditsLost = isValidNonNegativeNumber(item.credits_lost)
    ? Math.trunc(item.credits_lost)
    : null
  const falsePositives = isValidNonNegativeNumber(item.false_positives)
    ? Math.trunc(item.false_positives)
    : null
  const creditsLeft = isValidNonNegativeNumber(item.credits_left)
    ? Math.trunc(item.credits_left)
    : null

  const score = computeSessionScore(item)
  const falsePositivePenalty =
    falsePositives !== null ? falsePositives * FALSE_POSITIVE_PENALTY : null

  const creditBreakdownLabel =
    score !== null
      ? `+${creditsEarned.toLocaleString()} earned · −${creditsLost.toLocaleString()} lost · −${falsePositivePenalty.toLocaleString()} (${falsePositives} FP)`
      : 'Credit breakdown unavailable'

  return {
    session_id: sessionId,
    profile_id:
      item.profile_id !== undefined && item.profile_id !== null ? String(item.profile_id) : null,
    map_name: mapName,
    short_map_tag: shortMapTag,
    is_known_map: isKnownMap,
    result: resultKey,
    result_label: resultLabel,
    played_at: typeof item.played_at === 'string' ? item.played_at : null,
    played_date_label: dateInfo.fullLabel,
    short_date_label: dateInfo.shortLabel,
    duration_seconds: durationSeconds,
    duration_label: durationLabel,
    credits_earned: creditsEarned,
    credits_lost: creditsLost,
    false_positives: falsePositives,
    false_positive_penalty: falsePositivePenalty,
    credits_left: creditsLeft,
    score,
    score_label: score !== null ? score.toLocaleString() : 'Unavailable',
    credit_breakdown_label: creditBreakdownLabel,
  }
}

/**
 * Validates and normalizes `GET /sessions/history` payload (`SessionHistoryPage`).
 * Enforces account isolation when `expectedProfileId` is provided.
 * Missing or invalid numeric fields are preserved as `null` (`Unavailable`), never `0`.
 */
export const normalizeSessionHistoryResponse = (rawResponse, expectedProfileId = null) => {
  if (!rawResponse || typeof rawResponse !== 'object' || !Array.isArray(rawResponse.items)) {
    return {
      valid: false,
      error: 'Invalid session history response.',
      items: [],
      gamesPlayed: null,
      bestScore: null,
      bestScoreUnavailable: true,
      hasNoSessions: false,
    }
  }

  const normalizedExpectedProfileId =
    expectedProfileId !== undefined &&
    expectedProfileId !== null &&
    String(expectedProfileId).trim() !== ''
      ? String(expectedProfileId).trim()
      : null

  if (normalizedExpectedProfileId) {
    for (const rawItem of rawResponse.items) {
      if (
        rawItem &&
        typeof rawItem === 'object' &&
        rawItem.profile_id !== undefined &&
        rawItem.profile_id !== null &&
        String(rawItem.profile_id).trim() !== normalizedExpectedProfileId
      ) {
        return {
          valid: false,
          error: 'Session history response does not match the active player profile.',
          items: [],
          gamesPlayed: null,
          bestScore: null,
          bestScoreUnavailable: true,
          hasNoSessions: false,
        }
      }
    }
  }

  const items = rawResponse.items.slice(0, 20).map((item, idx) => normalizeSessionItem(item, idx))

  const totalCountValid = isValidNonNegativeNumber(rawResponse.total_count)
  const rawTotalCount = totalCountValid ? Math.trunc(rawResponse.total_count) : null
  // Total count cannot be smaller than the number of returned session rows
  const gamesPlayed =
    rawTotalCount !== null && rawTotalCount >= items.length ? rawTotalCount : null

  if (items.length === 0) {
    return {
      valid: true,
      error: '',
      items: [],
      gamesPlayed,
      bestScore: null,
      bestScoreUnavailable: false,
      hasNoSessions: true,
    }
  }

  const validScores = items.map((item) => item.score).filter((score) => score !== null)
  const bestScore = validScores.length > 0 ? Math.max(...validScores) : null
  const bestScoreUnavailable = validScores.length === 0

  return {
    valid: true,
    error: '',
    items,
    gamesPlayed,
    bestScore,
    bestScoreUnavailable,
    hasNoSessions: false,
  }
}

/**
 * Filters normalized session items by map name within the latest 20 sessions.
 */
export const filterSessionsByMap = (items, selectedMap = 'All') => {
  if (!Array.isArray(items)) return []
  if (!selectedMap || selectedMap === 'All') return items
  return items.filter((item) => item.map_name === selectedMap)
}

/**
 * Builds chronological (oldest -> newest) chart points from filtered sessions.
 * Only sessions with a valid numeric `score` (`score !== null`) and known map are plotted.
 */
export const buildChartSeries = (filteredItems) => {
  if (!Array.isArray(filteredItems)) {
    return {
      points: [],
      maxScore: 0,
      invalidExcludedCount: 0,
    }
  }

  const validItems = filteredItems.filter((item) => item && item.score !== null)
  const invalidExcludedCount = filteredItems.length - validItems.length

  if (validItems.length === 0) {
    return {
      points: [],
      maxScore: 0,
      invalidExcludedCount,
    }
  }

  const chronological = [...validItems].reverse()
  const maxScore = Math.max(100, ...chronological.map((item) => item.score))

  const points = chronological.map((item, idx) => {
    const rawPct = maxScore > 0 ? Math.round((item.score / maxScore) * 100) : 0
    const heightPercent = item.score === 0 ? 4 : Math.max(8, Math.min(100, rawPct))
    return {
      ...item,
      order_index: idx + 1,
      height_percent: heightPercent,
    }
  })

  return {
    points,
    maxScore,
    invalidExcludedCount,
  }
}
