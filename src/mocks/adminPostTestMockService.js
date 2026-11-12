/**
 * Development-only mock service for the Admin "Post-test results" view.
 *
 * IMPORTANT:
 * - Dynamically imported ONLY when `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`.
 * - Never imported in production builds.
 * - Intentionally excludes any answer key or individual question/answer payloads.
 */

const PASS_THRESHOLD_CORRECT = 23
const TOTAL_QUESTIONS = 30

const buildAttempt = ({ attemptNumber, score, submittedAt }) => {
  const percentage = Math.round((score / TOTAL_QUESTIONS) * 100)
  return {
    attemptId: `mock-attempt-${attemptNumber}-${score}`,
    attemptNumber,
    score,
    totalQuestions: TOTAL_QUESTIONS,
    percentage,
    passed: score >= PASS_THRESHOLD_CORRECT,
    submittedAt,
  }
}

/**
 * Sample player records covering:
 * - Players without a classroom (independent players)
 * - Players with no attempts yet (0 attempts, distinct from 0/30)
 * - A player with a submitted 0/30 score
 * - Players with one failed attempt (including boundary 22/30)
 * - Players with one passed attempt (including boundary 23/30)
 * - Players with multiple attempts (including passed earlier, failed later retake)
 * - Enough records (14) to span multiple pages at pageSize = 8
 */
const SAMPLE_PLAYERS = [
  {
    playerId: 'plr-001',
    username: 'SMISShINGUCrazy',
    displayName: 'Kenji Navarro',
    classroomName: 'BSIT-3A Cybersecurity',
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 25, submittedAt: '2026-11-08T09:15:00Z' }),
      buildAttempt({ attemptNumber: 2, score: 19, submittedAt: '2026-11-11T14:40:00Z' }),
    ],
  },
  {
    playerId: 'plr-002',
    username: 'solo_cipher',
    displayName: 'Alex Rivera',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 22, submittedAt: '2026-11-10T11:20:00Z' }),
    ],
  },
  {
    playerId: 'plr-003',
    username: 'maya_tan',
    displayName: 'Maya Tan',
    classroomName: null,
    attempts: [],
  },
  {
    playerId: 'plr-004',
    username: 'carlo_m',
    displayName: 'Carlo Mendoza',
    classroomName: 'BSCS-2B Network Defense',
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 0, submittedAt: '2026-11-09T16:05:00Z' }),
    ],
  },
  {
    playerId: 'plr-005',
    username: 'elena_v',
    displayName: 'Elena Villanueva',
    classroomName: 'BSIT-3A Cybersecurity',
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 18, submittedAt: '2026-11-06T08:30:00Z' }),
      buildAttempt({ attemptNumber: 2, score: 24, submittedAt: '2026-11-09T10:45:00Z' }),
      buildAttempt({ attemptNumber: 3, score: 27, submittedAt: '2026-11-12T07:50:00Z' }),
    ],
  },
  {
    playerId: 'plr-006',
    username: 'noah_reyes',
    displayName: 'Noah Reyes',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 23, submittedAt: '2026-11-11T18:10:00Z' }),
    ],
  },
  {
    playerId: 'plr-007',
    username: 'trisha_lim',
    displayName: 'Trisha Lim',
    classroomName: 'BSIS-1A Digital Literacy',
    attempts: [],
  },
  {
    playerId: 'plr-008',
    username: 'paolo_g',
    displayName: 'Paolo Garcia',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 26, submittedAt: '2026-11-07T13:00:00Z' }),
      buildAttempt({ attemptNumber: 2, score: 21, submittedAt: '2026-11-12T09:25:00Z' }),
    ],
  },
  {
    playerId: 'plr-009',
    username: 'hannah_b',
    displayName: 'Hannah Bautista',
    classroomName: 'BSIT-3A Cybersecurity',
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 28, submittedAt: '2026-11-10T15:35:00Z' }),
    ],
  },
  {
    playerId: 'plr-010',
    username: 'marco_dizon',
    displayName: 'Marco Dizon',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 15, submittedAt: '2026-11-05T10:15:00Z' }),
      buildAttempt({ attemptNumber: 2, score: 20, submittedAt: '2026-11-08T17:45:00Z' }),
    ],
  },
  {
    playerId: 'plr-011',
    username: 'sofia_cruz',
    displayName: 'Sofia Cruz',
    classroomName: 'BSCS-2B Network Defense',
    attempts: [],
  },
  {
    playerId: 'plr-012',
    username: 'ivan_santos',
    displayName: 'Ivan Santos',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 29, submittedAt: '2026-11-12T12:05:00Z' }),
    ],
  },
  {
    playerId: 'plr-013',
    username: 'bea_aquino',
    displayName: 'Bea Aquino',
    classroomName: 'BSIS-1A Digital Literacy',
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 21, submittedAt: '2026-11-04T09:40:00Z' }),
      buildAttempt({ attemptNumber: 2, score: 25, submittedAt: '2026-11-09T14:20:00Z' }),
    ],
  },
  {
    playerId: 'plr-014',
    username: 'liam_torres',
    displayName: 'Liam Torres',
    classroomName: null,
    attempts: [
      buildAttempt({ attemptNumber: 1, score: 17, submittedAt: '2026-11-11T08:00:00Z' }),
    ],
  },
]

const summarizePlayer = (player) => {
  const attempts = Array.isArray(player.attempts) ? player.attempts : []
  const attemptCount = attempts.length

  if (attemptCount === 0) {
    return {
      playerId: player.playerId,
      username: player.username,
      displayName: player.displayName,
      classroomName: player.classroomName,
      attemptCount: 0,
      latestScore: null,
      latestPercentage: null,
      latestPassed: null,
      bestScore: null,
      bestPercentage: null,
      bestPassed: null,
      hasPassedAny: false,
      lastSubmittedAt: null,
    }
  }

  // Attempts are ordered oldest -> newest in fixture; pick last as latest
  const latest = attempts[attempts.length - 1]
  const best = attempts.reduce(
    (top, current) => (current.score > top.score ? current : top),
    attempts[0],
  )

  return {
    playerId: player.playerId,
    username: player.username,
    displayName: player.displayName,
    classroomName: player.classroomName,
    attemptCount,
    latestScore: latest.score,
    latestPercentage: latest.percentage,
    latestPassed: latest.passed,
    bestScore: best.score,
    bestPercentage: best.percentage,
    bestPassed: best.passed,
    hasPassedAny: attempts.some((a) => a.passed),
    lastSubmittedAt: latest.submittedAt,
  }
}

export const fetchMockAdminPostTestPlayers = async ({
  search = '',
  page = 1,
  pageSize = 8,
  previewState = 'default',
} = {}) => {
  if (previewState === 'error') {
    throw new Error('Simulated preview error: unable to load sample post-test results.')
  }

  if (previewState === 'empty') {
    return {
      backendSupported: false,
      mockEnabled: true,
      isSampleData: true,
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
    }
  }

  const normalizedSearch = String(search || '').trim().toLowerCase()
  const filtered = SAMPLE_PLAYERS.filter((player) => {
    if (!normalizedSearch) return true
    const username = player.username.toLowerCase()
    const displayName = (player.displayName || '').toLowerCase()
    const classroom = (player.classroomName || 'independent player').toLowerCase()
    return (
      username.includes(normalizedSearch) ||
      displayName.includes(normalizedSearch) ||
      classroom.includes(normalizedSearch)
    )
  })

  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 8))
  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize))
  const safePage = Math.max(1, Math.min(totalPages, Number(page) || 1))
  const startIndex = (safePage - 1) * safePageSize
  const pageItems = filtered.slice(startIndex, startIndex + safePageSize).map(summarizePlayer)

  return {
    backendSupported: false,
    mockEnabled: true,
    isSampleData: true,
    items: pageItems,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
  }
}

export const fetchMockAdminPostTestPlayerHistory = async ({
  playerId,
  previewState = 'default',
} = {}) => {
  if (previewState === 'error') {
    throw new Error('Simulated preview error: unable to load player attempt history.')
  }

  const player = SAMPLE_PLAYERS.find((entry) => entry.playerId === playerId)
  if (!player) {
    throw new Error('Player record not found in sample dataset.')
  }

  const summary = summarizePlayer(player)
  // Return newest attempt first for admin review
  const attemptsNewestFirst = [...player.attempts].reverse().map((attempt) => ({ ...attempt }))

  return {
    backendSupported: false,
    mockEnabled: true,
    isSampleData: true,
    player: summary,
    attempts: attemptsNewestFirst,
  }
}
