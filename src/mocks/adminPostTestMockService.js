/**
 * Development-only mock service for the Admin Post-test reporting endpoints.
 *
 * IMPORTANT:
 * - Imported ONLY by `src/api/mock.js` when `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`.
 * - Never imported in production builds.
 * - Aligned with the live FastAPI response shapes in `features/post_test/analytics_schemas.py`.
 * - Excludes answer keys and per-question choices.
 */

const QUESTION_COUNT = 40
const PASS_MARK_PERCENT = 75

const CANONICAL_TOPICS = [
  'Phishing',
  'Smishing',
  'Vishing',
  'Social Engineering',
  'Credential Theft',
  'Public Wi-Fi Attack',
  'Malware Infection',
  'Ransomware',
]

const roundOneDecimal = (value) => Math.round(value * 10) / 10

const buildTopics = (correctCount) => {
  const base = Math.floor(correctCount / CANONICAL_TOPICS.length)
  let remainder = correctCount % CANONICAL_TOPICS.length

  return CANONICAL_TOPICS.map((topic) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder -= 1
    const correct = Math.min(5, base + extra)
    return {
      topic,
      correct,
      total: 5,
    }
  })
}

const buildAttempt = ({ attemptId, correctCount, submittedAt }) => {
  const scorePercent = roundOneDecimal((correctCount * 100) / QUESTION_COUNT)
  return {
    attempt_id: attemptId,
    correct_count: correctCount,
    question_count: QUESTION_COUNT,
    score_percent: scorePercent,
    pass_mark_percent: PASS_MARK_PERCENT,
    passed: scorePercent >= PASS_MARK_PERCENT,
    submitted_at: submittedAt,
    topics: buildTopics(correctCount),
  }
}

const toAttemptSummary = (attempt) => ({
  attempt_id: attempt.attempt_id,
  correct_count: attempt.correct_count,
  question_count: attempt.question_count,
  score_percent: attempt.score_percent,
  pass_mark_percent: attempt.pass_mark_percent,
  passed: attempt.passed,
  submitted_at: attempt.submitted_at,
})

const SAMPLE_PLAYER_RECORDS = [
  {
    profile_id: '00000000-0000-4000-8000-000000000101',
    username: 'SMISShINGUCrazy',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001011',
        correctCount: 33,
        submittedAt: '2026-11-08T09:15:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001012',
        correctCount: 24,
        submittedAt: '2026-11-12T14:40:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000102',
    username: 'solo_cipher',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001021',
        correctCount: 29,
        submittedAt: '2026-11-12T11:20:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000103',
    username: 'carlo_m',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001031',
        correctCount: 0,
        submittedAt: '2026-11-11T16:05:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000104',
    username: 'elena_v',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001041',
        correctCount: 25,
        submittedAt: '2026-11-06T08:30:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001042',
        correctCount: 31,
        submittedAt: '2026-11-09T10:45:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001043',
        correctCount: 36,
        submittedAt: '2026-11-12T07:50:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000105',
    username: 'noah_reyes',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001051',
        correctCount: 30,
        submittedAt: '2026-11-11T18:10:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000106',
    username: 'paolo_g',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001061',
        correctCount: 34,
        submittedAt: '2026-11-07T13:00:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001062',
        correctCount: 27,
        submittedAt: '2026-11-11T09:25:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000107',
    username: 'hannah_b',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001071',
        correctCount: 38,
        submittedAt: '2026-11-10T15:35:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000108',
    username: 'marco_dizon',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001081',
        correctCount: 21,
        submittedAt: '2026-11-05T10:15:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001082',
        correctCount: 26,
        submittedAt: '2026-11-08T17:45:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000109',
    username: 'ivan_santos',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001091',
        correctCount: 39,
        submittedAt: '2026-11-10T12:05:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000110',
    username: 'bea_aquino',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001101',
        correctCount: 28,
        submittedAt: '2026-11-04T09:40:00Z',
      }),
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001102',
        correctCount: 32,
        submittedAt: '2026-11-09T14:20:00Z',
      }),
    ],
  },
  {
    profile_id: '00000000-0000-4000-8000-000000000111',
    username: 'liam_torres',
    attempts: [
      buildAttempt({
        attemptId: '00000000-0000-4000-9000-000000001111',
        correctCount: 22,
        submittedAt: '2026-11-09T08:00:00Z',
      }),
    ],
  },
  // Player with zero finished attempts (excluded from /results, valid 200 on /players/{profile_id})
  {
    profile_id: '00000000-0000-4000-8000-000000000112',
    username: 'maya_tan',
    attempts: [],
  },
]

const getBestAttempt = (attempts) => {
  if (!attempts.length) return null
  return attempts.reduce((best, current) => {
    if (current.correct_count > best.correct_count) return current
    if (
      current.correct_count === best.correct_count &&
      current.submitted_at < best.submitted_at
    ) {
      return current
    }
    return best
  }, attempts[0])
}

const getLastSubmittedAt = (attempts) => {
  if (!attempts.length) return null
  return attempts.reduce(
    (latest, current) => (current.submitted_at > latest ? current.submitted_at : latest),
    attempts[0].submitted_at,
  )
}

export const getMockAdminPostTestSummary = () => {
  const attemptedPlayers = SAMPLE_PLAYER_RECORDS.filter((player) => player.attempts.length > 0)
  const bestAttempts = attemptedPlayers.map((player) => getBestAttempt(player.attempts))
  const playersAttempted = attemptedPlayers.length
  const playersPassed = bestAttempts.filter((attempt) => attempt.passed).length
  const finishedAttempts = attemptedPlayers.reduce(
    (sum, player) => sum + player.attempts.length,
    0,
  )

  const averageBestScorePercent = playersAttempted
    ? roundOneDecimal(
        bestAttempts.reduce((sum, attempt) => sum + attempt.score_percent, 0) /
          playersAttempted,
      )
    : null

  const passRatePercent = playersAttempted
    ? roundOneDecimal((playersPassed * 100) / playersAttempted)
    : null

  const topicMap = new Map(CANONICAL_TOPICS.map((topic) => [topic, { correct: 0, total: 0 }]))
  for (const best of bestAttempts) {
    for (const item of best.topics) {
      const bucket = topicMap.get(item.topic)
      if (bucket) {
        bucket.correct += item.correct
        bucket.total += item.total
      }
    }
  }

  return {
    pass_mark_percent: PASS_MARK_PERCENT,
    eligible_players: 15,
    players_attempted: playersAttempted,
    players_passed: playersPassed,
    pass_rate_percent: passRatePercent,
    finished_attempts: finishedAttempts,
    anonymous_attempts: 0,
    average_best_score_percent: averageBestScorePercent,
    topics: CANONICAL_TOPICS.map((topic) => {
      const counts = topicMap.get(topic)
      return {
        topic,
        correct: counts.correct,
        total: counts.total,
        accuracy_percent: counts.total
          ? roundOneDecimal((counts.correct * 100) / counts.total)
          : 0,
      }
    }),
  }
}

export const getMockAdminPostTestResults = ({
  passed = null,
  page = 1,
  pageSize = 20,
} = {}) => {
  const allRows = SAMPLE_PLAYER_RECORDS.filter((player) => player.attempts.length > 0)
    .map((player) => {
      const best = getBestAttempt(player.attempts)
      const lastSubmittedAt = getLastSubmittedAt(player.attempts)
      return {
        profile_id: player.profile_id,
        username: player.username,
        attempts: player.attempts.length,
        best_attempt_id: best.attempt_id,
        best_correct_count: best.correct_count,
        question_count: best.question_count,
        best_score_percent: best.score_percent,
        passed: best.passed,
        last_submitted_at: lastSubmittedAt,
      }
    })
    .sort((a, b) => b.last_submitted_at.localeCompare(a.last_submitted_at))

  const filteredRows =
    typeof passed === 'boolean'
      ? allRows.filter((row) => row.passed === passed)
      : allRows

  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20))
  const safePage = Math.max(1, Number(page) || 1)
  const start = (safePage - 1) * safePageSize

  return {
    items: filteredRows.slice(start, start + safePageSize),
    total_count: filteredRows.length,
    page: safePage,
    page_size: safePageSize,
  }
}

export const getMockAdminPostTestPlayerResult = (profileId) => {
  const player = SAMPLE_PLAYER_RECORDS.find((entry) => entry.profile_id === profileId)
  if (!player) return null

  const best = getBestAttempt(player.attempts)
  const attemptsNewestFirst = [...player.attempts].sort((a, b) =>
    b.submitted_at.localeCompare(a.submitted_at),
  )

  return {
    profile_id: player.profile_id,
    username: player.username,
    passed: Boolean(best?.passed),
    best: best ? toAttemptSummary(best) : null,
    attempts: attemptsNewestFirst.map((attempt) => ({
      ...attempt,
      topics: attempt.topics.map((topic) => ({ ...topic })),
    })),
  }
}
