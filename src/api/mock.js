import MockAdapter from 'axios-mock-adapter'
import apiClient from './client.js'
import { stripDisplayNameWhitespace, validateDisplayName } from '../utils/displayName.js'

const mock = new MockAdapter(apiClient, { delayResponse: 200 })

const MOCK_PROFILES_STORAGE_KEY = 'cyber_mock_web_profiles_v1'

const createDefaultMockWebProfiles = () => ({
  'u-001': {
    web_profile_id: 'wp-001',
    user_id: 'u-001',
    email: 'educator@cybermorph.local',
    role: 'educator',
    display_name: 'Prof. CyberMorph',
    portal_access: true,
    approval_status: 'approved',
    last_login_at: '2026-10-01T06:00:00Z',
  },
  'u-educator-legacy': {
    web_profile_id: 'wp-legacy-01',
    user_id: 'u-educator-legacy',
    email: 'unnamed@dnsc.edu.ph',
    role: 'educator',
    display_name: null,
    portal_access: true,
    approval_status: 'approved',
    last_login_at: '2026-10-01T06:00:00Z',
  },
  'u-admin-01': {
    web_profile_id: 'wp-002',
    user_id: 'u-admin-01',
    email: 'admin@cybermorph.local',
    role: 'admin',
    display_name: 'SysAdmin',
    portal_access: true,
    approval_status: 'approved',
    last_login_at: '2026-10-01T06:00:00Z',
  },
})

const loadPersistedMockWebProfiles = () => {
  const defaults = createDefaultMockWebProfiles()
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(MOCK_PROFILES_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaults
    const merged = { ...defaults }
    for (const [id, profile] of Object.entries(parsed)) {
      if (profile && typeof profile === 'object') {
        merged[id] = { ...defaults[id], ...profile }
      }
    }
    return merged
  } catch {
    return defaults
  }
}

let mockWebProfiles = loadPersistedMockWebProfiles()

const savePersistedMockWebProfiles = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MOCK_PROFILES_STORAGE_KEY, JSON.stringify(mockWebProfiles))
  } catch {
    // Ignore storage quota errors in mock mode
  }
}

const resolveMockWebProfileFromConfig = (config) => {
  mockWebProfiles = loadPersistedMockWebProfiles()
  const auth =
    config?.headers?.Authorization ||
    config?.headers?.authorization ||
    (typeof localStorage !== 'undefined' ? `Bearer ${localStorage.getItem('cyber_token') || ''}` : '')

  if (!auth || auth === 'Bearer ') return { status: 401, profile: null }
  if (auth.includes('player')) return { status: 403, profile: null }

  const explicitIdMatch = auth.match(/mock-jwt-token-(?:educator|admin):([^\s]+)/)
  if (explicitIdMatch && mockWebProfiles[explicitIdMatch[1]]) {
    return { status: 200, profile: mockWebProfiles[explicitIdMatch[1]] }
  }

  if (auth.includes('admin')) {
    return { status: 200, profile: mockWebProfiles['u-admin-01'] }
  }
  if (auth.includes('unnamed') || auth.includes('legacy')) {
    return { status: 200, profile: mockWebProfiles['u-educator-legacy'] }
  }
  return { status: 200, profile: mockWebProfiles['u-001'] }
}

export const mockControl = {
  failThreatIndexCount: 0,
  delayThreatIndexMs: 0,
  threatIndexOverride: undefined,
  failMyClassroomCount: 0,
  delayMyClassroomMs: 0,
  failLeaveClassroomCount: 0,
  delayLeaveClassroomMs: 0,
  myClassroomOverride: undefined,
  failSessionsHistoryCount: 0,
  delaySessionsHistoryMs: 0,
  sessionsHistoryOverride: undefined,
  failPlayerProfileCount: 0,
  delayPlayerProfileMs: 0,
  playerProfileOverride: undefined,
  delayPlayerAnalyticsMs: 0,
  delayClassroomsMs: 0,
  delayClassroomAnalytics: {},
  delaySessionAnalyticsMs: 0,
  failClassroomsCount: 0,
  failClassroomAnalyticsCount: 0,
  failClassroomStudentsCount: 0,
  failClassroomPatchCount: 0,
  delayClassroomPatchMs: 0,
  failClassroomDeleteCount: 0,
  delayClassroomDeleteMs: 0,
  failAdminClassroomsCount: 0,
  delayAdminClassroomsMs: 0,
  failAdminClassroomPatchCount: 0,
  delayAdminClassroomPatchMs: 0,
  failAdminClassroomDeleteCount: 0,
  delayAdminClassroomDeleteMs: 0,
  failProfilePatchCount: 0,
  delayProfileGetMs: 0,
  delayProfilePatchMs: 0,
  delayAuthMs: 0,
  resetProfiles() {
    mockWebProfiles = createDefaultMockWebProfiles()
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MOCK_PROFILES_STORAGE_KEY)
    }
    return mockWebProfiles
  },
  setEducatorDisplayName(displayName, userId = 'u-001') {
    mockWebProfiles = loadPersistedMockWebProfiles()
    if (mockWebProfiles[userId]) {
      mockWebProfiles[userId] = {
        ...mockWebProfiles[userId],
        display_name: displayName,
      }
      savePersistedMockWebProfiles()
    }
  },
  setThreatIndexOverride(payload) {
    mockControl.threatIndexOverride = payload
  },
  resetThreatIndex() {
    mockControl.failThreatIndexCount = 0
    mockControl.delayThreatIndexMs = 0
    mockControl.threatIndexOverride = undefined
  },
  setPlayerEnrollment(userIdOrUsername, classroomIdOrNull) {
    setMockPlayerEnrollment(userIdOrUsername, classroomIdOrNull)
  },
  resetPlayerEnrollments() {
    resetMockPlayerEnrollments()
  },
  setSessionsHistoryOverride(payload) {
    mockControl.sessionsHistoryOverride = payload
  },
  resetSessionsHistory() {
    mockControl.failSessionsHistoryCount = 0
    mockControl.delaySessionsHistoryMs = 0
    mockControl.sessionsHistoryOverride = undefined
    mockControl.failPlayerProfileCount = 0
    mockControl.delayPlayerProfileMs = 0
    mockControl.playerProfileOverride = undefined
  },
  failAdminStatsCount: 0,
  adminStatsOverride: undefined,
  failAdminApprovalsCount: 0,
  adminApprovalsOverride: undefined,
  failAdminLogsCount: 0,
  adminLogsOverride: undefined,
  setAdminStatsOverride(payload) {
    mockControl.adminStatsOverride = payload
  },
  resetAdminStats() {
    mockControl.failAdminStatsCount = 0
    mockControl.adminStatsOverride = undefined
  },
  setAdminApprovalsOverride(payload) {
    mockControl.adminApprovalsOverride = payload
  },
  resetAdminApprovals() {
    mockControl.failAdminApprovalsCount = 0
    mockControl.adminApprovalsOverride = undefined
  },
  setAdminLogsOverride(payload) {
    mockControl.adminLogsOverride = payload
  },
  resetAdminLogs() {
    mockControl.failAdminLogsCount = 0
    mockControl.adminLogsOverride = undefined
  },
  resetAdminClassrooms() {
    mockControl.failAdminClassroomsCount = 0
    mockControl.delayAdminClassroomsMs = 0
    mockControl.failAdminClassroomPatchCount = 0
    mockControl.delayAdminClassroomPatchMs = 0
    mockControl.failAdminClassroomDeleteCount = 0
    mockControl.delayAdminClassroomDeleteMs = 0
    mockClassrooms = [
      {
        id: 'c1',
        code_id: 'c1',
        web_profile_id: 'wp-001',
        code: 'CYB101',
        code_value: 'CYB101',
        name: 'BSIT 4A',
        description: 'Cybersecurity fundamentals and threat defense.',
        is_active: true,
        student_count: 23,
        created_at: '2026-08-20T10:00:00Z',
        deleted_at: null,
      },
      {
        id: 'c2',
        code_id: 'c2',
        web_profile_id: 'wp-001',
        code: 'NET202',
        code_value: 'NET202',
        name: 'BSIT 3C',
        description: null,
        is_active: true,
        student_count: 1,
        created_at: '2026-08-22T14:30:00Z',
        deleted_at: null,
      },
      {
        id: 'c3',
        code_id: 'c3',
        web_profile_id: 'wp-legacy-01',
        code: 'OLD303',
        code_value: 'OLD303',
        name: 'BSCS 2B (Archived)',
        description: 'Archived 2025-2026 cohort.',
        is_active: false,
        student_count: 5,
        created_at: '2026-06-10T08:00:00Z',
        deleted_at: null,
      },
    ]
  },
}

if (typeof window !== 'undefined') {
  window.__CYBERMORPH_MOCK_CONTROL__ = mockControl
}

// ==========================================
// Stateful Mock Data Sets
// ==========================================
let mockClassrooms = [
  {
    id: 'c1',
    code_id: 'c1',
    web_profile_id: 'wp-001',
    code: 'CYB101',
    code_value: 'CYB101',
    name: 'BSIT 4A',
    description: 'Cybersecurity fundamentals and threat defense.',
    is_active: true,
    student_count: 23,
    created_at: '2026-08-20T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 'c2',
    code_id: 'c2',
    web_profile_id: 'wp-001',
    code: 'NET202',
    code_value: 'NET202',
    name: 'BSIT 3C',
    description: null,
    is_active: true,
    student_count: 1,
    created_at: '2026-08-22T14:30:00Z',
    deleted_at: null,
  },
  {
    id: 'c3',
    code_id: 'c3',
    web_profile_id: 'wp-legacy-01',
    code: 'OLD303',
    code_value: 'OLD303',
    name: 'BSCS 2B (Archived)',
    description: 'Archived 2025-2026 cohort.',
    is_active: false,
    student_count: 5,
    created_at: '2026-06-10T08:00:00Z',
    deleted_at: null,
  },
]

let mockStudentEnrollments = [
  {
    classroom_id: 'c1',
    profile_id: 'p1',
    username: 'AgentZero',
    map_progress: 2,
    threat_unlocked_count: 5,
    joined_at: '2026-08-21T09:15:00Z',
    last_synced_at: '2026-09-28T13:45:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p2',
    username: 'CipherQueen',
    map_progress: 3,
    threat_unlocked_count: 8,
    joined_at: '2026-08-21T11:40:00Z',
    last_synced_at: '2026-09-28T10:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p3',
    username: 'ByteMaster',
    map_progress: 1,
    threat_unlocked_count: 3,
    joined_at: '2026-08-22T08:00:00Z',
    last_synced_at: '2026-09-27T15:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p4',
    username: 'NeoMatrix',
    map_progress: 0,
    threat_unlocked_count: 1,
    joined_at: '2026-08-22T09:10:00Z',
    last_synced_at: '2026-09-26T12:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p5',
    username: 'ShadowCoder',
    map_progress: 1,
    threat_unlocked_count: 2,
    joined_at: '2026-08-22T10:15:00Z',
    last_synced_at: '2026-09-25T11:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p6',
    username: 'CyberGhost',
    map_progress: 2,
    threat_unlocked_count: 4,
    joined_at: '2026-08-23T14:20:00Z',
    last_synced_at: '2026-09-24T16:40:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p7',
    username: 'FirewallFox',
    map_progress: 3,
    threat_unlocked_count: 6,
    joined_at: '2026-08-23T15:00:00Z',
    last_synced_at: '2026-09-24T09:15:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p8',
    username: 'DataNinja',
    map_progress: 0,
    threat_unlocked_count: 0,
    joined_at: '2026-08-24T11:00:00Z',
    last_synced_at: '2026-09-23T14:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p9',
    username: 'NetSentinel',
    map_progress: 1,
    threat_unlocked_count: 2,
    joined_at: '2026-08-24T12:30:00Z',
    last_synced_at: '2026-09-22T18:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p10',
    username: 'PixelGuard',
    map_progress: 2,
    threat_unlocked_count: 4,
    joined_at: '2026-08-25T08:45:00Z',
    last_synced_at: '2026-09-21T13:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p11',
    username: 'ZeroDayHero',
    map_progress: 0,
    threat_unlocked_count: 1,
    joined_at: '2026-08-25T10:00:00Z',
    last_synced_at: '2026-09-20T17:05:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p12',
    username: 'CryptoKnight',
    map_progress: 1,
    threat_unlocked_count: 3,
    joined_at: '2026-08-25T11:15:00Z',
    last_synced_at: '2026-09-19T10:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p13',
    username: 'PacketHunter',
    map_progress: 3,
    threat_unlocked_count: 7,
    joined_at: '2026-08-26T09:20:00Z',
    last_synced_at: '2026-09-18T14:45:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p14',
    username: 'SecOpsPro',
    map_progress: 2,
    threat_unlocked_count: 5,
    joined_at: '2026-08-26T13:40:00Z',
    last_synced_at: '2026-09-17T11:25:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p15',
    username: 'KernelPanic',
    map_progress: 0,
    threat_unlocked_count: 0,
    joined_at: '2026-08-27T08:10:00Z',
    last_synced_at: '2026-09-16T15:50:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p16',
    username: 'LogicBomb',
    map_progress: 1,
    threat_unlocked_count: 2,
    joined_at: '2026-08-27T10:30:00Z',
    last_synced_at: '2026-09-15T09:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p17',
    username: 'BufferOverflow',
    map_progress: 3,
    threat_unlocked_count: 8,
    joined_at: '2026-08-28T14:00:00Z',
    last_synced_at: '2026-09-14T12:15:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p18',
    username: 'RootAccess',
    map_progress: 2,
    threat_unlocked_count: 5,
    joined_at: '2026-08-28T15:20:00Z',
    last_synced_at: '2026-09-13T16:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p19',
    username: 'SynFlood',
    map_progress: 0,
    threat_unlocked_count: 1,
    joined_at: '2026-08-29T11:00:00Z',
    last_synced_at: '2026-09-12T10:40:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p20',
    username: 'PortScanner',
    map_progress: 1,
    threat_unlocked_count: 3,
    joined_at: '2026-08-29T16:15:00Z',
    last_synced_at: '2026-09-11T14:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p21',
    username: 'EchoReply',
    map_progress: 3,
    threat_unlocked_count: 7,
    joined_at: '2026-08-30T09:30:00Z',
    last_synced_at: '2026-09-10T11:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p22',
    username: 'TraceRoute',
    map_progress: 2,
    threat_unlocked_count: 4,
    joined_at: '2026-08-30T13:45:00Z',
    last_synced_at: '2026-09-09T15:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p23',
    username: 'SubnetMask',
    map_progress: 0,
    threat_unlocked_count: 0,
    joined_at: '2026-08-31T10:00:00Z',
    last_synced_at: null,
  },
  {
    classroom_id: 'c2',
    profile_id: 'p1',
    username: 'AgentZero',
    map_progress: 2,
    threat_unlocked_count: 5,
    joined_at: '2026-08-23T08:20:00Z',
    last_synced_at: '2026-09-20T14:10:00Z',
  },
]

const mockLeaderboardEntries = [
  { score_id: 'sc-01', rank: 1, username: 'CipherQueen', total_score: 9850, map_name: 'Home', recorded_at: '2026-09-28T10:20:00Z' },
  { score_id: 'sc-02', rank: 2, username: 'NeoMatrix', total_score: 9600, map_name: 'Office', recorded_at: '2026-09-27T14:15:00Z' },
  { score_id: 'sc-03', rank: 3, username: 'AgentZero', total_score: 9200, map_name: 'Internet Cafe', recorded_at: '2026-09-26T16:40:00Z' },
  { score_id: 'sc-04', rank: 4, username: 'ByteMaster', total_score: 8950, map_name: 'Public Park', recorded_at: '2026-09-25T11:30:00Z' },
  { score_id: 'sc-05', rank: 5, username: 'CyberGhost', total_score: 8700, map_name: 'Home', recorded_at: '2026-09-24T18:00:00Z' },
  { score_id: 'sc-06', rank: 6, username: 'ShadowCoder', total_score: 8550, map_name: 'Office', recorded_at: '2026-09-23T15:20:00Z' },
  { score_id: 'sc-07', rank: 7, username: 'FirewallFox', total_score: 8300, map_name: 'Internet Cafe', recorded_at: '2026-09-22T09:45:00Z' },
  { score_id: 'sc-08', rank: 8, username: 'DataNinja', total_score: 8150, map_name: 'Public Park', recorded_at: '2026-09-21T13:10:00Z' },
  { score_id: 'sc-09', rank: 9, username: 'NetSentinel', total_score: 7900, map_name: 'Home', recorded_at: '2026-09-20T17:25:00Z' },
  { score_id: 'sc-10', rank: 10, username: 'PixelGuard', total_score: 7750, map_name: 'Office', recorded_at: '2026-09-19T10:05:00Z' },
  { score_id: 'sc-11', rank: 11, username: 'ZeroDayHero', total_score: 7500, map_name: 'Internet Cafe', recorded_at: '2026-09-18T14:40:00Z' },
  { score_id: 'sc-12', rank: 12, username: 'CryptoKnight', total_score: 7350, map_name: 'Public Park', recorded_at: '2026-09-17T11:15:00Z' },
  { score_id: 'sc-13', rank: 13, username: 'PacketHunter', total_score: 7100, map_name: 'Home', recorded_at: '2026-09-16T16:50:00Z' },
  { score_id: 'sc-14', rank: 14, username: 'SecOpsPro', total_score: 6950, map_name: 'Office', recorded_at: '2026-09-15T08:30:00Z' },
  { score_id: 'sc-15', rank: 15, username: 'KernelPanic', total_score: 6800, map_name: 'Internet Cafe', recorded_at: '2026-09-14T12:00:00Z' },
  { score_id: 'sc-16', rank: 16, username: 'LogicBomb', total_score: 6600, map_name: 'Public Park', recorded_at: '2026-09-13T15:10:00Z' },
  { score_id: 'sc-17', rank: 17, username: 'BufferOverflow', total_score: 6450, map_name: 'Home', recorded_at: '2026-09-12T09:20:00Z' },
  { score_id: 'sc-18', rank: 18, username: 'RootAccess', total_score: 6300, map_name: 'Office', recorded_at: '2026-09-11T13:45:00Z' },
  { score_id: 'sc-19', rank: 19, username: 'SynFlood', total_score: 6100, map_name: 'Internet Cafe', recorded_at: '2026-09-10T17:15:00Z' },
  { score_id: 'sc-20', rank: 20, username: 'PortScanner', total_score: 5900, map_name: 'Public Park', recorded_at: '2026-09-09T14:00:00Z' },
]

// ==========================================
// Authentication Endpoints
// ==========================================
const applyMockAuthDelay = async () => {
  let delay = mockControl.delayAuthMs || 0
  if (!delay && typeof sessionStorage !== 'undefined') {
    delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_AUTH__') || '0', 10) || 0
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

mock.onPost('/auth/login').reply(async (config) => {
  await applyMockAuthDelay()
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, password } = data

  if (!email || !password || password === 'wrongpassword') {
    return [401, { detail: 'Incorrect email or password' }]
  }

  mockWebProfiles = loadPersistedMockWebProfiles()
  const lowerEmail = String(email).toLowerCase()

  if (lowerEmail.includes('unknown') || lowerEmail.includes('nonexistent')) {
    return [401, { detail: 'Incorrect email or password' }]
  }

  if (
    lowerEmail === 'prof_smith@dnsc.edu.ph' ||
    lowerEmail === 'instructor_lee@dnsc.edu.ph' ||
    lowerEmail === 'rejected_candidate@dnsc.edu.ph' ||
    lowerEmail.includes('pending') ||
    lowerEmail.includes('inactive')
  ) {
    return [403, { detail: 'Account is not active' }]
  }

  if (lowerEmail.includes('admin')) {
    return [
      200,
      {
        access_token: 'mock-jwt-token-admin:u-admin-01',
        token_type: 'bearer',
      },
    ]
  }

  if (lowerEmail.includes('unnamed') || lowerEmail.includes('legacy')) {
    return [
      200,
      {
        access_token: 'mock-jwt-token-educator:u-educator-legacy',
        token_type: 'bearer',
      },
    ]
  }

  const matchedProfile = Object.values(mockWebProfiles).find(
    (p) => p.email?.toLowerCase() === lowerEmail,
  )
  if (matchedProfile) {
    if (matchedProfile.portal_access === false || matchedProfile.approval_status !== 'approved') {
      return [403, { detail: 'Account is not active' }]
    }
    return [
      200,
      {
        access_token: `mock-jwt-token-${matchedProfile.role}:${matchedProfile.user_id}`,
        token_type: 'bearer',
      },
    ]
  }

  if (lowerEmail.includes('educator')) {
    return [
      200,
      {
        access_token: 'mock-jwt-token-educator:u-001',
        token_type: 'bearer',
      },
    ]
  }

  if (lowerEmail.includes('playertwo') || lowerEmail.includes('unenrolled')) {
    return [
      200,
      {
        access_token: 'mock-jwt-token-player:u-202',
        token_type: 'bearer',
      },
    ]
  }

  return [
    200,
    {
      access_token: 'mock-jwt-token-player:u-101',
      token_type: 'bearer',
    },
  ]
})

mock.onPost('/auth/register').reply(async (config) => {
  await applyMockAuthDelay()
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, username, password } = data

  if (!email || !username || !password) {
    const detail = []
    if (!email) detail.push({ loc: ['body', 'email'], msg: 'Field required', type: 'missing' })
    if (!username) detail.push({ loc: ['body', 'username'], msg: 'Field required', type: 'missing' })
    if (!password) detail.push({ loc: ['body', 'password'], msg: 'Field required', type: 'missing' })
    return [422, { detail }]
  }

  if (String(email).toLowerCase().includes('conflict')) {
    return [
      409,
      {
        detail: {
          field: 'email',
          message: 'Email already registered',
        },
      },
    ]
  }

  if (username === 'existinguser' || username === 'AgentZero') {
    return [
      409,
      {
        detail: {
          field: 'username',
          message: 'Username already taken',
        },
      },
    ]
  }

  return [
    201,
    {
      user_id: 'u-101',
      email,
      username,
    },
  ]
})

mock.onPost('/auth/register-web').reply(async (config) => {
  await applyMockAuthDelay()
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, password, display_name } = data

  const nameValidation = validateDisplayName(display_name)
  if (!nameValidation.valid) {
    return [
      422,
      {
        detail: [
          {
            loc: ['body', 'display_name'],
            msg: nameValidation.error,
            type: 'value_error',
          },
        ],
      },
    ]
  }

  if (!email || !password) {
    const detail = []
    if (!email) detail.push({ loc: ['body', 'email'], msg: 'Field required', type: 'missing' })
    if (!password) detail.push({ loc: ['body', 'password'], msg: 'Field required', type: 'missing' })
    return [422, { detail }]
  }

  if (!String(email).toLowerCase().endsWith('@dnsc.edu.ph')) {
    return [
      422,
      {
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'Value error, Educator email must end in @dnsc.edu.ph',
            type: 'value_error',
          },
        ],
      },
    ]
  }

  if (
    String(email).toLowerCase().includes('conflict') ||
    String(email).toLowerCase() === 'educator@dnsc.edu.ph'
  ) {
    return [
      409,
      {
        detail: {
          field: 'email',
          message: 'Email already registered',
        },
      },
    ]
  }

  return [
    201,
    {
      user_id: '102',
      email,
      approval_status: 'pending',
    },
  ]
})

// ==========================================
// Player Profile & Progress Endpoints
// ==========================================
const MOCK_PLAYER_ENROLLMENTS_KEY = 'cyber_mock_player_enrollments_v1'

const createDefaultMockPlayerAccounts = () => ({
  'u-101': {
    profile_id: 'p1',
    user_id: 'u-101',
    username: 'AgentZero',
    email: 'player@example.com',
    role: 'player',
    map_progress: 2,
  },
  'u-202': {
    profile_id: 'p99',
    user_id: 'u-202',
    username: 'PlayerTwo',
    email: 'playertwo@example.com',
    role: 'player',
    map_progress: 0,
  },
})

const loadPersistedPlayerEnrollments = () => {
  const defaults = { 'u-101': 'c1', 'u-202': null }
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(MOCK_PLAYER_ENROLLMENTS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaults
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

let mockPlayerEnrollmentByUserId = loadPersistedPlayerEnrollments()

const savePersistedPlayerEnrollments = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      MOCK_PLAYER_ENROLLMENTS_KEY,
      JSON.stringify(mockPlayerEnrollmentByUserId),
    )
  } catch {
    // Ignore storage quota issues in mock mode
  }
}

const syncPlayerRosterForAccount = (player, classroomIdOrNull) => {
  mockStudentEnrollments = mockStudentEnrollments.filter(
    (s) =>
      s.profile_id !== player.profile_id &&
      s.username.toLowerCase() !== player.username.toLowerCase(),
  )
  if (classroomIdOrNull) {
    mockStudentEnrollments.push({
      classroom_id: classroomIdOrNull,
      profile_id: player.profile_id,
      username: player.username,
      map_progress: typeof player.map_progress === 'number' ? player.map_progress : 0,
      joined_at: '2026-08-21T09:15:00Z',
      last_synced_at: '2026-09-28T13:45:00Z',
    })
  }
}

const setMockPlayerEnrollment = (userIdOrUsername, classroomIdOrNull) => {
  const accounts = createDefaultMockPlayerAccounts()
  let targetUserId = userIdOrUsername || 'u-101'
  for (const [id, acct] of Object.entries(accounts)) {
    if (
      id === userIdOrUsername ||
      acct.username.toLowerCase() === String(userIdOrUsername).toLowerCase()
    ) {
      targetUserId = id
      break
    }
  }
  const player = accounts[targetUserId] || {
    profile_id: `p-${targetUserId}`,
    user_id: targetUserId,
    username: String(userIdOrUsername),
    map_progress: 0,
  }
  mockPlayerEnrollmentByUserId = loadPersistedPlayerEnrollments()
  mockPlayerEnrollmentByUserId[targetUserId] = classroomIdOrNull || null
  savePersistedPlayerEnrollments()
  syncPlayerRosterForAccount(player, classroomIdOrNull || null)
}

const resetMockPlayerEnrollments = () => {
  mockControl.failMyClassroomCount = 0
  mockControl.delayMyClassroomMs = 0
  mockControl.failLeaveClassroomCount = 0
  mockControl.delayLeaveClassroomMs = 0
  mockControl.myClassroomOverride = undefined
  mockPlayerEnrollmentByUserId = { 'u-101': 'c1', 'u-202': null }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(MOCK_PLAYER_ENROLLMENTS_KEY)
  }
  const accounts = createDefaultMockPlayerAccounts()
  syncPlayerRosterForAccount(accounts['u-101'], 'c1')
  syncPlayerRosterForAccount(accounts['u-202'], null)
}

const resolveMockPlayerFromConfig = (config) => {
  mockPlayerEnrollmentByUserId = loadPersistedPlayerEnrollments()
  const accounts = createDefaultMockPlayerAccounts()
  const auth =
    config?.headers?.Authorization ||
    config?.headers?.authorization ||
    (typeof localStorage !== 'undefined'
      ? `Bearer ${localStorage.getItem('cyber_token') || ''}`
      : '')

  const explicitMatch = auth.match(/mock-jwt-token-player:([^\s]+)/)
  const userId = explicitMatch ? explicitMatch[1] : 'u-101'
  const player = accounts[userId] || {
    profile_id: `p-${userId}`,
    user_id: userId,
    username: `Player_${userId}`,
    email: `${userId}@example.com`,
    role: 'player',
    map_progress: 0,
  }
  const enrolledClassroomId =
    userId in mockPlayerEnrollmentByUserId
      ? mockPlayerEnrollmentByUserId[userId]
      : userId === 'u-101'
        ? 'c1'
        : null

  syncPlayerRosterForAccount(player, enrolledClassroomId)
  const enrolledClassroom = enrolledClassroomId
    ? mockClassrooms.find(
        (c) =>
          !c.deleted_at &&
          (c.id === enrolledClassroomId ||
            c.code_id === enrolledClassroomId ||
            c.code === enrolledClassroomId ||
            c.code_value === enrolledClassroomId),
      ) || null
    : null

  return { player, enrolledClassroom }
}

mock.onGet('/players/me').reply(async (config) => {
  if (mockControl.delayPlayerProfileMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayPlayerProfileMs))
  }
  if (mockControl.failPlayerProfileCount > 0) {
    mockControl.failPlayerProfileCount--
    return [500, { detail: 'Temporary player profile failure' }]
  }
  if (mockControl.playerProfileOverride !== undefined) {
    return [200, mockControl.playerProfileOverride]
  }
  const { player, enrolledClassroom } = resolveMockPlayerFromConfig(config)
  return [
    200,
    {
      ...player,
      map_progress: typeof player.map_progress === 'number' ? player.map_progress : 0,
      classroom_name: enrolledClassroom ? enrolledClassroom.name : null,
    },
  ]
})

const mockThreatIndex = [
  { threat_name: 'Phishing', is_unlocked: true, unlocked_at: '2026-09-20T10:00:00Z' },
  { threat_name: 'Smishing', is_unlocked: true, unlocked_at: '2026-09-21T11:00:00Z' },
  { threat_name: 'Vishing', is_unlocked: true, unlocked_at: '2026-09-22T14:00:00Z' },
  { threat_name: 'Social Engineering', is_unlocked: true, unlocked_at: '2026-09-23T09:00:00Z' },
  { threat_name: 'Credential Theft', is_unlocked: true, unlocked_at: '2026-09-24T16:00:00Z' },
  { threat_name: 'Public Wi-Fi Attack', is_unlocked: false, unlocked_at: null },
  { threat_name: 'Malware Infection', is_unlocked: false, unlocked_at: null },
  { threat_name: 'Ransomware', is_unlocked: false, unlocked_at: null },
]

mock.onGet('/players/threat-index').reply(async () => {
  if (mockControl.delayThreatIndexMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayThreatIndexMs))
  }
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_THREAT__') || '0', 10) : 0
  if (mockControl.failThreatIndexCount > 0 || sessionFail > 0) {
    if (mockControl.failThreatIndexCount > 0) mockControl.failThreatIndexCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_THREAT__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary threat index failure' }]
  }
  if (mockControl.threatIndexOverride !== undefined) {
    return [200, mockControl.threatIndexOverride]
  }
  return [200, mockThreatIndex]
})

const mockPlayerSessions = [
  {
    session_id: 'sess-01',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 145,
    credits_earned: 9200,
    credits_lost: 0,
    credits_left: 9300,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-28T14:30:00Z',
    created_at: '2026-09-28T14:31:00Z',
  },
  {
    session_id: 'sess-02',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 180,
    credits_earned: 8500,
    credits_lost: 200,
    credits_left: 8400,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-27T11:15:00Z',
    created_at: '2026-09-27T11:16:00Z',
  },
  {
    session_id: 'sess-03',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 120,
    credits_earned: 7800,
    credits_lost: 150,
    credits_left: 7750,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-26T16:00:00Z',
    created_at: '2026-09-26T16:01:00Z',
  },
  {
    session_id: 'sess-04',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 210,
    credits_earned: 6900,
    credits_lost: 400,
    credits_left: 6600,
    false_positives: 2,
    result: 'lose',
    is_synced: true,
    played_at: '2026-09-25T13:45:00Z',
    created_at: '2026-09-25T13:46:00Z',
  },
  {
    session_id: 'sess-05',
    profile_id: 'p1',
    map_name: 'Public Park',
    duration_seconds: 160,
    credits_earned: 5400,
    credits_lost: 300,
    credits_left: 5200,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-24T10:20:00Z',
    created_at: '2026-09-24T10:21:00Z',
  },
  {
    session_id: 'sess-06',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 130,
    credits_earned: 7100,
    credits_lost: 100,
    credits_left: 7100,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-23T15:10:00Z',
    created_at: '2026-09-23T15:11:00Z',
  },
  {
    session_id: 'sess-07',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 95,
    credits_earned: 6200,
    credits_lost: 50,
    credits_left: 6250,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-22T09:30:00Z',
    created_at: '2026-09-22T09:31:00Z',
  },
  {
    session_id: 'sess-08',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 200,
    credits_earned: 4500,
    credits_lost: 600,
    credits_left: 4000,
    false_positives: 3,
    result: 'timeout',
    is_synced: true,
    played_at: '2026-09-21T17:00:00Z',
    created_at: '2026-09-21T17:01:00Z',
  },
  {
    session_id: 'sess-09',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 110,
    credits_earned: 5900,
    credits_lost: 120,
    credits_left: 5880,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-20T14:40:00Z',
    created_at: '2026-09-20T14:41:00Z',
  },
  {
    session_id: 'sess-10',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 150,
    credits_earned: 6800,
    credits_lost: 250,
    credits_left: 6650,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-19T11:50:00Z',
    created_at: '2026-09-19T11:51:00Z',
  },
  {
    session_id: 'sess-11',
    profile_id: 'p1',
    map_name: 'Public Park',
    duration_seconds: 175,
    credits_earned: 7300,
    credits_lost: 180,
    credits_left: 7220,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-18T16:25:00Z',
    created_at: '2026-09-18T16:26:00Z',
  },
  {
    session_id: 'sess-12',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 140,
    credits_earned: 8100,
    credits_lost: 90,
    credits_left: 8110,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-17T13:10:00Z',
    created_at: '2026-09-17T13:11:00Z',
  },
  {
    session_id: 'sess-13',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 165,
    credits_earned: 7600,
    credits_lost: 150,
    credits_left: 7550,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-16T10:05:00Z',
    created_at: '2026-09-16T10:06:00Z',
  },
  {
    session_id: 'sess-14',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 105,
    credits_earned: 6400,
    credits_lost: 80,
    credits_left: 6420,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-15T15:35:00Z',
    created_at: '2026-09-15T15:36:00Z',
  },
  {
    session_id: 'sess-15',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 150,
    credits_earned: 7100,
    credits_lost: 150,
    credits_left: 7000,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-14T11:20:00Z',
    created_at: '2026-09-14T11:21:00Z',
  },
  {
    session_id: 'sess-16',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 130,
    credits_earned: 5900,
    credits_lost: 220,
    credits_left: 5700,
    false_positives: 2,
    result: 'lose',
    is_synced: true,
    played_at: '2026-09-13T16:45:00Z',
    created_at: '2026-09-13T16:46:00Z',
  },
  {
    session_id: 'sess-17',
    profile_id: 'p1',
    map_name: 'Public Park',
    duration_seconds: 195,
    credits_earned: 8800,
    credits_lost: 100,
    credits_left: 8750,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-12T14:10:00Z',
    created_at: '2026-09-12T14:11:00Z',
  },
  {
    session_id: 'sess-18',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 90,
    credits_earned: 5400,
    credits_lost: 50,
    credits_left: 5400,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-11T10:05:00Z',
    created_at: '2026-09-11T10:06:00Z',
  },
  {
    session_id: 'sess-19',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 175,
    credits_earned: 7600,
    credits_lost: 300,
    credits_left: 7350,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-10T15:30:00Z',
    created_at: '2026-09-10T15:31:00Z',
  },
  {
    session_id: 'sess-20',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 160,
    credits_earned: 6800,
    credits_lost: 180,
    credits_left: 6650,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-09T13:40:00Z',
    created_at: '2026-09-09T13:41:00Z',
  },
  {
    session_id: 'sess-21',
    profile_id: 'p1',
    map_name: 'Public Park',
    duration_seconds: 210,
    credits_earned: 8200,
    credits_lost: 250,
    credits_left: 8000,
    false_positives: 2,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-08T09:25:00Z',
    created_at: '2026-09-08T09:26:00Z',
  },
  {
    session_id: 'sess-22',
    profile_id: 'p1',
    map_name: 'Home',
    duration_seconds: 85,
    credits_earned: 4900,
    credits_lost: 30,
    credits_left: 4900,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-07T12:00:00Z',
    created_at: '2026-09-07T12:01:00Z',
  },
  {
    session_id: 'sess-23',
    profile_id: 'p1',
    map_name: 'Office',
    duration_seconds: 140,
    credits_earned: 6100,
    credits_lost: 120,
    credits_left: 6000,
    false_positives: 1,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-06T17:15:00Z',
    created_at: '2026-09-06T17:16:00Z',
  },
  {
    session_id: 'sess-24',
    profile_id: 'p1',
    map_name: 'Internet Cafe',
    duration_seconds: 155,
    credits_earned: 7300,
    credits_lost: 200,
    credits_left: 7150,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-05T14:50:00Z',
    created_at: '2026-09-05T14:51:00Z',
  },
  {
    session_id: 'sess-25',
    profile_id: 'p1',
    map_name: 'Public Park',
    duration_seconds: 220,
    credits_earned: 9100,
    credits_lost: 90,
    credits_left: 9050,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-04T10:10:00Z',
    created_at: '2026-09-04T10:11:00Z',
  },
]

const mockPlayerTwoSessions = [
  {
    session_id: 'sess-p99-01',
    profile_id: 'p99',
    map_name: 'Office',
    duration_seconds: 140,
    credits_earned: 5100,
    credits_lost: 100,
    credits_left: 5100,
    false_positives: 2,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-28T09:15:00Z',
    created_at: '2026-09-28T09:16:00Z',
  },
  {
    session_id: 'sess-p99-02',
    profile_id: 'p99',
    map_name: 'Home',
    duration_seconds: 115,
    credits_earned: 4600,
    credits_lost: 50,
    credits_left: 4650,
    false_positives: 0,
    result: 'win',
    is_synced: true,
    played_at: '2026-09-26T14:20:00Z',
    created_at: '2026-09-26T14:21:00Z',
  },
]

mock.onGet('/sessions/history').reply(async (config) => {
  if (mockControl.delaySessionsHistoryMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delaySessionsHistoryMs))
  }
  const sessionFail =
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_SESSIONS__') || '0', 10)
      : 0
  if (mockControl.failSessionsHistoryCount > 0 || sessionFail > 0) {
    if (mockControl.failSessionsHistoryCount > 0) mockControl.failSessionsHistoryCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_SESSIONS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary session history failure' }]
  }
  if (mockControl.sessionsHistoryOverride !== undefined) {
    return [200, mockControl.sessionsHistoryOverride]
  }

  const { player } = resolveMockPlayerFromConfig(config)
  const sourceSessions =
    player.profile_id === 'p99'
      ? mockPlayerTwoSessions
      : mockPlayerSessions.map((item) => ({
          ...item,
          profile_id: player.profile_id || 'p1',
        }))

  const params = config.params || {}
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  const total_count = sourceSessions.length
  const startIndex = (page - 1) * pageSize
  const paginatedItems = sourceSessions.slice(startIndex, startIndex + pageSize)

  return [
    200,
    {
      items: paginatedItems,
      total_count,
      page,
      page_size: pageSize,
    },
  ]
})

// ==========================================
// Web Users Profile Endpoints (GET & PATCH)
// ==========================================
mock.onGet('/web-users/me').reply(async (config) => {
  if (mockControl.delayProfileGetMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayProfileGetMs))
  }
  const { status, profile } = resolveMockWebProfileFromConfig(config)
  if (status === 401) {
    return [401, { detail: 'Missing authorization token' }]
  }
  if (status === 403 || !profile) {
    return [403, { detail: 'Not a web portal account' }]
  }
  return [200, { ...profile }]
})

mock.onPatch('/web-users/me').reply(async (config) => {
  if (mockControl.delayProfilePatchMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayProfilePatchMs))
  }
  if (mockControl.failProfilePatchCount > 0) {
    mockControl.failProfilePatchCount--
    return [500, { detail: 'Temporary profile update failure' }]
  }

  const { status, profile } = resolveMockWebProfileFromConfig(config)
  if (status === 401) {
    return [401, { detail: 'Missing authorization token' }]
  }
  if (status === 403 || !profile) {
    return [403, { detail: 'Not a web portal account' }]
  }

  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const validation = validateDisplayName(data.display_name)
  if (!validation.valid) {
    return [
      422,
      {
        detail: [
          {
            loc: ['body', 'display_name'],
            msg: validation.error,
            type: 'value_error',
          },
        ],
      },
    ]
  }

  const updated = {
    ...profile,
    display_name: validation.trimmed,
  }
  mockWebProfiles[profile.user_id] = updated
  savePersistedMockWebProfiles()

  const adminUserEntry = mockAdminUsers.find((u) => u.user_id === profile.user_id)
  if (adminUserEntry) {
    adminUserEntry.display_name = validation.trimmed
  }

  return [200, { ...updated }]
})


// ==========================================
// Classroom Endpoints (Stateful)
// ==========================================
const getClassroomResponse = () => {
  const activeClassrooms = mockClassrooms.filter((c) => !c.deleted_at)
  return activeClassrooms.map((c) => {
    const studentCount = mockStudentEnrollments.filter((s) => s.classroom_id === c.id || s.classroom_id === c.code).length
    return {
      ...c,
      student_count: studentCount,
    }
  })
}

mock.onGet('/classroom/my-codes').reply(async () => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_CLASSROOMS__') || '0', 10) : 0
  if (mockControl.failClassroomsCount > 0 || sessionFail > 0) {
    if (mockControl.failClassroomsCount > 0) mockControl.failClassroomsCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOMS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary classroom list failure' }]
  }
  let delay = mockControl.delayClassroomsMs || 0
  if (!delay && typeof window !== 'undefined') {
    delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_CLASSROOMS__') || '0', 10) || 0
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  if (typeof window !== 'undefined') {
    window.__MY_CODES_FETCH_COUNT__ = (window.__MY_CODES_FETCH_COUNT__ || 0) + 1
  }
  const list = getClassroomResponse()
  return [200, list]
})

mock.onGet('/educator/classrooms').reply(() => {
  const list = getClassroomResponse()
  return [
    200,
    {
      classrooms: list,
      total_students: mockStudentEnrollments.length,
      recent_activity: [
        { id: 1, text: 'Student AgentZero completed Map 2 simulation', time: '10m ago' },
        { id: 2, text: 'New student joined Intro to Cybersecurity', time: '1h ago' },
        { id: 3, text: 'Class average Threat Index score improved by 12%', time: 'Yesterday' },
      ],
    },
  ]
})

mock.onPost('/classroom/generate').reply((config) => {
  const { status, profile } = resolveMockWebProfileFromConfig(config)
  if (status === 401) {
    return [401, { detail: 'Missing authorization token' }]
  }
  if (status === 403 || !profile || profile.role !== 'educator') {
    return [403, { detail: 'Educator privileges required' }]
  }

  if (!stripDisplayNameWhitespace(profile.display_name || '')) {
    return [
      409,
      {
        detail: {
          field: 'display_name',
          message: 'Set your display name before creating a class',
        },
      },
    ]
  }

  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { name } = data

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let newCode = ''
  for (let i = 0; i < 6; i++) {
    newCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const newId = 'c' + (mockClassrooms.length + 1)
  const newClassroom = {
    id: newId,
    code_id: newId,
    code: newCode,
    code_value: newCode,
    name: name || 'Untitled Classroom',
    is_active: true,
    created_at: new Date().toISOString(),
    deleted_at: null,
  }

  mockClassrooms.push(newClassroom)

  return [201, { ...newClassroom, student_count: 0 }]
})

mock.onGet('/classroom/mine').reply(async (config) => {
  if (mockControl.delayMyClassroomMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayMyClassroomMs))
  }
  if (mockControl.failMyClassroomCount > 0) {
    mockControl.failMyClassroomCount--
    return [500, { detail: 'Temporary classroom membership failure' }]
  }
  if (mockControl.myClassroomOverride !== undefined) {
    return [200, mockControl.myClassroomOverride]
  }

  const { player, enrolledClassroom } = resolveMockPlayerFromConfig(config)
  if (!enrolledClassroom) {
    return [404, { detail: 'You are not in a classroom' }]
  }

  mockWebProfiles = loadPersistedMockWebProfiles()
  const educatorProfile = mockWebProfiles['u-001']
  const educatorName = stripDisplayNameWhitespace(educatorProfile?.display_name || '') || null

  const classMembers = mockStudentEnrollments
    .filter(
      (s) =>
        s.classroom_id === enrolledClassroom.id ||
        s.classroom_id === enrolledClassroom.code_id ||
        s.classroom_id === enrolledClassroom.code ||
        s.classroom_id === enrolledClassroom.code_value,
    )
    .map((s) => ({
      username: s.username,
      map_progress: typeof s.map_progress === 'number' ? s.map_progress : 0,
    }))
    .sort((a, b) =>
      a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }),
    )

  const selfEnrollment = mockStudentEnrollments.find(
    (s) =>
      (s.classroom_id === enrolledClassroom.id ||
        s.classroom_id === enrolledClassroom.code) &&
      s.username.toLowerCase() === player.username.toLowerCase(),
  )

  return [
    200,
    {
      code_id: enrolledClassroom.code_id || enrolledClassroom.id,
      name: enrolledClassroom.name,
      educator_name: educatorName,
      joined_at: selfEnrollment?.joined_at || '2026-08-21T09:15:00Z',
      member_count: classMembers.length,
      members: classMembers,
    },
  ]
})

mock.onDelete('/classroom/mine').reply(async (config) => {
  if (mockControl.delayLeaveClassroomMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayLeaveClassroomMs))
  }
  if (mockControl.failLeaveClassroomCount > 0) {
    mockControl.failLeaveClassroomCount--
    return [500, { detail: 'Temporary error leaving classroom' }]
  }

  const { player, enrolledClassroom } = resolveMockPlayerFromConfig(config)
  if (!enrolledClassroom) {
    return [404, { detail: 'You are not in a classroom' }]
  }

  setMockPlayerEnrollment(player.user_id, null)
  return [204]
})

mock.onPost('/classroom/join').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const rawCode = String(data.code_value || data.code || '')
    .replace(/[\s-]+/g, '')
    .toUpperCase()

  if (!rawCode) {
    return [422, { detail: [{ loc: ['body', 'code_value'], msg: 'Field required' }] }]
  }

  const { player, enrolledClassroom } = resolveMockPlayerFromConfig(config)

  const targetClassroom = mockClassrooms.find(
    (c) =>
      !c.deleted_at &&
      (c.code.toUpperCase() === rawCode ||
        (c.code_value && c.code_value.toUpperCase() === rawCode) ||
        c.id.toUpperCase() === rawCode),
  )

  if (!targetClassroom) {
    return [404, { detail: 'Classroom code not found' }]
  }

  if (enrolledClassroom) {
    const isSameClass =
      enrolledClassroom.id === targetClassroom.id ||
      enrolledClassroom.code_id === targetClassroom.code_id
    return [
      409,
      {
        detail: {
          field: 'code_value',
          message: isSameClass
            ? 'You have already joined this classroom'
            : 'You are already in a classroom',
        },
      },
    ]
  }

  if (!targetClassroom.is_active) {
    return [
      409,
      {
        detail: {
          field: 'code_value',
          message: 'This classroom is not accepting new students',
        },
      },
    ]
  }

  const joinedAt = new Date().toISOString()
  setMockPlayerEnrollment(player.user_id, targetClassroom.id)
  const createdRow = mockStudentEnrollments.find(
    (s) =>
      s.classroom_id === targetClassroom.id &&
      s.username.toLowerCase() === player.username.toLowerCase(),
  )
  if (createdRow) {
    createdRow.joined_at = joinedAt
  }

  return [
    201,
    {
      profile_id: player.profile_id,
      code_id: targetClassroom.code_id || targetClassroom.id,
      name: targetClassroom.name,
      joined_at: joinedAt,
    },
  ]
})

// GET /classroom/:code_id/students
mock.onGet(new RegExp('/classroom/([^/]+)/students')).reply(async (config) => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_CLASSROOM_STUDENTS__') || '0', 10) : 0
  if (mockControl.failClassroomStudentsCount > 0 || sessionFail > 0) {
    if (mockControl.failClassroomStudentsCount > 0) mockControl.failClassroomStudentsCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_STUDENTS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary student roster failure' }]
  }
  const match = config.url.match(/\/classroom\/([^/]+)\/students/)
  const codeId = match ? match[1] : null

  let delay = mockControl.delayClassroomAnalytics?.[codeId] || 0
  if (!delay && typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(sessionStorage.getItem('__CYBERMORPH_DELAY_CLASSROOM__') || '{}')
      delay = stored[codeId] || 0
    } catch {
      /* ignore */
    }
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const classroom = mockClassrooms.find(
    (c) =>
      !c.deleted_at &&
      (c.id === codeId ||
        c.code_id === codeId ||
        c.code === codeId ||
        c.code_value === codeId),
  )
  if (!classroom) {
    return [404, { detail: 'Classroom not found.' }]
  }

  const allStudents = mockStudentEnrollments.filter(
    (s) =>
      s.classroom_id === classroom.id ||
      s.classroom_id === classroom.code_id ||
      s.classroom_id === classroom.code ||
      s.classroom_id === classroom.code_value,
  )

  const params = config.params || {}
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 10)
  const start = (page - 1) * pageSize
  const pagedItems = allStudents.slice(start, start + pageSize)

  return [
    200,
    {
      items: pagedItems,
      students: pagedItems,
      total_count: allStudents.length,
      page,
      page_size: pageSize,
    },
  ]
})

// PATCH /classroom/:code_id
mock.onPatch(new RegExp('/classroom/(?!mine$)([^/]+)$')).reply(async (config) => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_CLASSROOM_PATCH__') || '0', 10) : 0
  if (mockControl.failClassroomPatchCount > 0 || sessionFail > 0) {
    if (mockControl.failClassroomPatchCount > 0) mockControl.failClassroomPatchCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_PATCH__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary server error saving classroom settings.' }]
  }

  let delay = mockControl.delayClassroomPatchMs || 0
  if (!delay && typeof window !== 'undefined') {
    delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_CLASSROOM_PATCH__') || '0', 10) || 0
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const match = config.url.match(/\/classroom\/([^/]+)$/)
  const codeId = match ? match[1] : null
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}

  const index = mockClassrooms.findIndex(
    (c) =>
      !c.deleted_at &&
      (c.id === codeId || c.code_id === codeId || c.code === codeId || c.code_value === codeId),
  )
  if (index === -1) {
    return [404, { detail: 'Classroom not found.' }]
  }

  const updated = {
    ...mockClassrooms[index],
    name: data.name !== undefined ? data.name : mockClassrooms[index].name,
    description:
      data.description !== undefined
        ? data.description === null || data.description === ''
          ? null
          : data.description
        : mockClassrooms[index].description ?? null,
    is_active: data.is_active !== undefined ? data.is_active : mockClassrooms[index].is_active,
  }

  mockClassrooms[index] = updated

  return [200, updated]
})

// DELETE /classroom/:code_id
mock.onDelete(new RegExp('/classroom/(?!mine$)([^/]+)$')).reply(async (config) => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_CLASSROOM_DELETE__') || '0', 10) : 0
  if (mockControl.failClassroomDeleteCount > 0 || sessionFail > 0) {
    if (mockControl.failClassroomDeleteCount > 0) mockControl.failClassroomDeleteCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_DELETE__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary server error deleting classroom.' }]
  }

  let delay = mockControl.delayClassroomDeleteMs || 0
  if (!delay && typeof window !== 'undefined') {
    delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_CLASSROOM_DELETE__') || '0', 10) || 0
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const match = config.url.match(/\/classroom\/([^/]+)$/)
  const codeId = match ? match[1] : null

  const index = mockClassrooms.findIndex(
    (c) =>
      !c.deleted_at &&
      (c.id === codeId || c.code_id === codeId || c.code === codeId || c.code_value === codeId),
  )
  if (index === -1) {
    return [404, { detail: 'Classroom not found.' }]
  }

  mockClassrooms[index].deleted_at = new Date().toISOString()

  return [204]
})

// ==========================================
// Leaderboard Endpoint
// ==========================================
mock.onGet('/leaderboard').reply((config) => {
  const params = config.params || {}
  const { map_name } = params
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 10)

  let filtered = [...mockLeaderboardEntries]

  if (map_name && map_name !== 'All') {
    filtered = filtered.filter(
      (entry) => entry.map_name.toLowerCase() === map_name.toLowerCase(),
    )
  }

  const total_count = filtered.length
  const startIndex = (page - 1) * pageSize
  const paginatedItems = filtered.slice(startIndex, startIndex + pageSize).map((item, index) => ({
    rank: startIndex + index + 1,
    score_id: item.score_id,
    username: item.username,
    total_score: item.total_score,
    map_name: item.map_name,
    recorded_at: item.recorded_at,
  }))

  return [
    200,
    {
      items: paginatedItems,
      total_count,
      page,
      page_size: pageSize,
    },
  ]
})

// ==========================================
// Analytics Endpoints (Educator)
// ==========================================
mock.onGet(new RegExp('/analytics/classroom')).reply(async (config) => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__') || '0', 10) : 0
  if (mockControl.failClassroomAnalyticsCount > 0 || sessionFail > 0) {
    if (mockControl.failClassroomAnalyticsCount > 0) mockControl.failClassroomAnalyticsCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_CLASSROOM_ANALYTICS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary classroom analytics failure' }]
  }
  const codeId = config.params?.code_id || 'c1'
  let delay = mockControl.delayClassroomAnalytics?.[codeId] || 0
  if (!delay && typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(sessionStorage.getItem('__CYBERMORPH_DELAY_CLASSROOM__') || '{}')
      delay = stored[codeId] || 0
    } catch {
      /* ignore */
    }
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  return [
    200,
    {
      code_id: codeId,
      student_count: codeId === 'c1' || codeId === 'CYB101' ? 23 : 1,
      avg_map_progress: 2.33,
      avg_best_score_by_map: {
        Home: 723.3,
        Office: 750.0,
      },
      category_fail_rates: {
        Phishing: 0.15,
        Smishing: 0.28,
        Vishing: 0.45,
        'Social Engineering': 0.12,
        'Credential Theft': 0.35,
        'Public Wi-Fi Attack': null,
        'Malware Infection': 0.52,
        Ransomware: null,
      },
    },
  ]
})

mock.onGet(new RegExp('/analytics/player')).reply(async (config) => {
  let delay = mockControl.delayPlayerAnalyticsMs || 0
  if (!delay && typeof window !== 'undefined') {
    try {
      delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_PLAYER__') || '0', 10) || 0
    } catch {
      /* ignore */
    }
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  const profileId = config.params?.profile_id || 'p1'
  const enrolledStudent = mockStudentEnrollments.find((s) => s.profile_id === profileId)
  const isNeverSynced = enrolledStudent ? enrolledStudent.last_synced_at === null : false
  const threatCount = isNeverSynced ? 0 : (enrolledStudent?.threat_unlocked_count ?? 5)
  const mapProgress = enrolledStudent?.map_progress ?? 2

  const canonicalThreatNames = [
    'Phishing',
    'Smishing',
    'Vishing',
    'Social Engineering',
    'Credential Theft',
    'Public Wi-Fi Attack',
    'Malware Infection',
    'Ransomware',
  ]

  const mockThreatIndex = canonicalThreatNames.map((name, idx) => {
    const isUnlocked = !isNeverSynced && idx < threatCount
    return {
      threat_name: name,
      is_unlocked: isUnlocked,
      unlocked_at: isUnlocked ? `2026-09-${String(20 + idx).padStart(2, '0')}T10:00:00Z` : null,
    }
  })

  return [
    200,
    {
      profile_id: profileId,
      wins: isNeverSynced ? 0 : 6,
      losses: isNeverSynced ? 0 : 2,
      avg_duration_seconds: isNeverSynced ? 0 : 132.5,
      map_progress: mapProgress,
      threat_index: mockThreatIndex,
      best_score_by_map: isNeverSynced
        ? {}
        : {
            Home: 850,
            Office: 720,
          },
      category_breakdown: isNeverSynced
        ? {
            Phishing: null,
            Smishing: null,
            Vishing: null,
            'Social Engineering': null,
            'Credential Theft': null,
            'Public Wi-Fi Attack': null,
            'Malware Infection': null,
            Ransomware: null,
          }
        : {
            Phishing: 0.10,
            Smishing: 0.25,
            Vishing: 0.40,
            'Social Engineering': 0.08,
            'Credential Theft': 0.30,
            'Public Wi-Fi Attack': null,
            'Malware Infection': 0.45,
            Ransomware: null,
          },
      recent_sessions: isNeverSynced
        ? []
        : [
        {
          session_id: 'e2a8b351-9c2f-4612-8342-210394857612',
          map_name: 'Office',
          duration_seconds: 145,
          credits_earned: 40,
          credits_lost: 60,
          credits_left: 45,
          false_positives: 2,
          result: 'lose',
          played_at: '2026-09-28T13:45:00+08:00',
        },
        {
          session_id: 'c1f7a240-8b1e-4501-9231-109283746501',
          map_name: 'Home',
          duration_seconds: 110,
          credits_earned: 95,
          credits_lost: 5,
          credits_left: 0,
          false_positives: 0,
          result: 'win',
          played_at: '2026-09-27T10:20:00+08:00',
        },
        {
          session_id: 'f3b9c462-0d3a-4723-9453-321405968723',
          map_name: 'Office',
          duration_seconds: 160,
          credits_earned: 80,
          credits_lost: 20,
          credits_left: null,
          false_positives: 1,
          result: 'win',
          played_at: '2026-09-26T16:10:00+08:00',
        },
      ],
    },
  ]
})

mock.onGet(new RegExp('/analytics/session')).reply(async (config) => {
  const sessionId = config.params?.session_id || ''

  let delay = mockControl.delaySessionAnalyticsMs || 0
  if (!delay && typeof window !== 'undefined') {
    try {
      delay = parseInt(sessionStorage.getItem('__CYBERMORPH_DELAY_SESSION__') || '0', 10) || 0
    } catch {
      /* ignore */
    }
  }
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  if (sessionId === 'session-missing-profile') {
    return [
      200,
      {
        session_id: 'session-missing-profile',
        profile_id: null,
        username: 'NoProfileUser',
        map_name: 'Home',
        result: 'win',
        threat_events: [],
      },
    ]
  }

  if (sessionId === 'e2a8b351-9c2f-4612-8342-210394857612') {
    return [
      200,
      {
        session_id: sessionId,
        profile_id: 'p1',
        username: 'AgentZero',
        map_name: 'Office',
        result: 'lose',
        threat_events: [
          {
            threat_type: 'Social Engineering',
            player_action: 'ignored',
            is_correct: false,
            is_legitimate_item: false,
            credits_affected: -15,
            logged_at: '2026-09-28T13:46:12+08:00',
          },
          {
            threat_type: 'Phishing',
            player_action: 'quarantined',
            is_correct: true,
            is_legitimate_item: false,
            credits_affected: 20,
            logged_at: '2026-09-28T13:47:35+08:00',
          },
          {
            threat_type: 'Credential Theft',
            player_action: 'accepted',
            is_correct: false,
            is_legitimate_item: false,
            credits_affected: -45,
            logged_at: '2026-09-28T13:48:50+08:00',
          },
        ],
      },
    ]
  }

  // Graceful empty threat_events list matching real backend behavior
  return [
    200,
    {
      session_id: sessionId || 'c1f7a240-8b1e-4501-9231-109283746501',
      profile_id: 'p1',
      username: 'AgentZero',
      map_name: 'Home',
      result: 'win',
      threat_events: [],
    },
  ]
})

// ==========================================
// Admin Stateful Mock Datasets & Endpoints
// ==========================================
let mockAdminUsers = [
  {
    user_id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@cybermorph.local',
    role: 'admin',
    username: null,
    display_name: 'Administrator',
    is_active: true,
    created_at: '2026-08-01T08:00:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000002',
    email: 'educator@cybermorph.local',
    role: 'educator',
    username: null,
    display_name: 'Prof. Santos',
    is_active: true,
    created_at: '2026-08-05T09:30:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000003',
    email: 'player@cybermorph.local',
    role: 'player',
    username: 'CyberPlayer',
    display_name: null,
    is_active: true,
    created_at: '2026-08-07T10:00:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000004',
    email: 'cadet1@cybermorph.local',
    role: 'player',
    username: 'CadetOne',
    display_name: null,
    is_active: true,
    created_at: '2026-08-08T11:00:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000005',
    email: 'prof.delacruz@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: 'Prof. Dela Cruz',
    is_active: true,
    created_at: '2026-08-09T12:00:00Z',
  },
  // Duplicate names to test distinguishing by email
  {
    user_id: '00000000-0000-0000-0000-000000000006',
    email: 'alex.santos@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: 'Alex Santos',
    is_active: true,
    created_at: '2026-08-10T14:00:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000007',
    email: 'alex.player@example.com',
    role: 'player',
    username: 'Alex Santos',
    display_name: null,
    is_active: true,
    created_at: '2026-08-11T15:00:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000008',
    email: 'prof_smith@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: 'Prof. Smith',
    is_active: false,
    created_at: '2026-09-10T14:15:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000009',
    email: 'instructor_lee@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: 'Instructor Lee',
    is_active: false,
    created_at: '2026-09-15T11:20:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000010',
    email: 'player_sam@example.com',
    role: 'player',
    username: 'SamSec',
    display_name: null,
    is_active: true,
    created_at: '2026-08-12T13:10:00Z',
  },
  {
    user_id: '00000000-0000-0000-0000-000000000011',
    email: 'player_casey@example.com',
    role: 'player',
    username: 'CaseyByte',
    display_name: null,
    is_active: true,
    created_at: '2026-08-15T18:20:00Z',
  },
]

let mockAdminApprovals = [
  {
    user_id: 'u-educator-pending-01',
    email: 'prof_smith@dnsc.edu.ph',
    approval_status: 'pending',
    created_at: '2026-09-10T14:15:00Z',
  },
  {
    user_id: 'u-educator-pending-02',
    email: 'instructor_lee@dnsc.edu.ph',
    approval_status: 'pending',
    created_at: '2026-09-15T11:20:00Z',
  },
  {
    user_id: 'u-educator-01',
    email: 'educator@dnsc.edu.ph',
    approval_status: 'approved',
    created_at: '2026-08-05T09:30:00Z',
  },
  {
    user_id: 'u-educator-rejected-01',
    email: 'rejected_candidate@dnsc.edu.ph',
    approval_status: 'rejected',
    created_at: '2026-09-02T10:00:00Z',
  },
]

mock.onGet('/admin/stats').reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin privileges required' }]

  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_ADMIN_STATS__') || '0', 10) : 0
  if (mockControl.failAdminStatsCount > 0 || sessionFail > 0) {
    if (mockControl.failAdminStatsCount > 0) mockControl.failAdminStatsCount--
    if (sessionFail > 0 && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_STATS__', String(sessionFail - 1))
    }
    return [500, { detail: 'System metrics unavailable' }]
  }

  const sessionOverride = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('__CYBERMORPH_OVERRIDE_ADMIN_STATS__') : null
  if (sessionOverride) {
    return [200, JSON.parse(sessionOverride)]
  }
  if (mockControl.adminStatsOverride !== undefined) {
    return [200, mockControl.adminStatsOverride]
  }

  return [
    200,
    {
      total_users: mockAdminUsers.length,
      sessions_last_24h: 12,
      threats_detected: 84,
      uptime_seconds: 3600,
    },
  ]
})

mock.onGet('/admin/users').reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin privileges required' }]

  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_ADMIN_USERS__') || '0', 10) : 0
  if (sessionFail > 0 && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_USERS__', String(sessionFail - 1))
    return [500, { detail: 'Account directory lookup unavailable' }]
  }

  const params = config.params || {}
  const roleFilter = params.role ? String(params.role).toLowerCase() : null
  const searchQuery = params.search ? String(params.search).toLowerCase() : null
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  let filtered = mockAdminUsers.filter((u) => {
    if (roleFilter && u.role?.toLowerCase() !== roleFilter) return false
    if (searchQuery) {
      const matchEmail = u.email?.toLowerCase().includes(searchQuery)
      const matchUsername = u.username?.toLowerCase().includes(searchQuery)
      const matchDisplay = u.display_name?.toLowerCase().includes(searchQuery)
      if (!matchEmail && !matchUsername && !matchDisplay) return false
    }
    return true
  })

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const totalCount = filtered.length
  const startIdx = (page - 1) * pageSize
  const items = filtered.slice(startIdx, startIdx + pageSize)

  return [
    200,
    {
      items,
      total_count: totalCount,
      page,
      page_size: pageSize,
    },
  ]
})

mock.onGet('/admin/approvals').reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin privileges required' }]

  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_ADMIN_APPROVALS__') || '0', 10) : 0
  if (mockControl.failAdminApprovalsCount > 0 || sessionFail > 0) {
    if (mockControl.failAdminApprovalsCount > 0) mockControl.failAdminApprovalsCount--
    if (sessionFail > 0 && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_APPROVALS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Pending approvals queue unavailable' }]
  }

  const sessionOverride = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('__CYBERMORPH_OVERRIDE_ADMIN_APPROVALS__') : null
  if (sessionOverride) {
    return [200, JSON.parse(sessionOverride)]
  }
  if (mockControl.adminApprovalsOverride !== undefined) {
    return [200, mockControl.adminApprovalsOverride]
  }

  const params = config.params || {}
  const statusFilter = (params.status || 'pending').toLowerCase()
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  let filtered = mockAdminApprovals.filter((a) => a.approval_status === statusFilter)
  filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const totalCount = filtered.length
  const startIdx = (page - 1) * pageSize
  const items = filtered.slice(startIdx, startIdx + pageSize)

  return [
    200,
    {
      items,
      total_count: totalCount,
      page,
      page_size: pageSize,
    },
  ]
})

mock.onPost(new RegExp('^/admin/approvals/[^/]+/approve$')).reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin privileges required' }]

  const match = config.url.match(/^\/admin\/approvals\/([^/]+)\/approve$/)
  const userId = match ? match[1] : null
  const approvalItem = mockAdminApprovals.find((a) => a.user_id === userId)

  if (!approvalItem) {
    return [404, { detail: 'Educator registration not found' }]
  }

  if (approvalItem.approval_status === 'approved') {
    return [409, { detail: { field: 'approval_status', message: 'Registration has already been approved' } }]
  }

  approvalItem.approval_status = 'approved'

  const userAccount = mockAdminUsers.find((u) => u.user_id === userId)
  if (userAccount) {
    userAccount.is_active = true
  }

  return [
    200,
    {
      user_id: approvalItem.user_id,
      email: approvalItem.email,
      approval_status: 'approved',
      created_at: approvalItem.created_at,
    },
  ]
})

mock.onPost(new RegExp('^/admin/approvals/[^/]+/reject$')).reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin privileges required' }]

  const match = config.url.match(/^\/admin\/approvals\/([^/]+)\/reject$/)
  const userId = match ? match[1] : null
  const approvalItem = mockAdminApprovals.find((a) => a.user_id === userId)

  if (!approvalItem) {
    return [404, { detail: 'Educator registration not found' }]
  }

  if (approvalItem.approval_status !== 'pending') {
    return [
      409,
      {
        detail: {
          field: 'approval_status',
          message: `Cannot reject registration with status '${approvalItem.approval_status}'`,
        },
      },
    ]
  }

  approvalItem.approval_status = 'rejected'

  const userAccount = mockAdminUsers.find((u) => u.user_id === userId)
  if (userAccount) {
    userAccount.is_active = false
  }

  return [
    200,
    {
      user_id: approvalItem.user_id,
      email: approvalItem.email,
      approval_status: 'rejected',
      created_at: approvalItem.created_at,
    },
  ]
})

const buildAdminClassroomRow = (classroom) => {
  mockWebProfiles = loadPersistedMockWebProfiles()
  const webProfiles = Object.values(mockWebProfiles)
  const ownerProfile =
    webProfiles.find((p) => p.web_profile_id === classroom.web_profile_id) ||
    mockWebProfiles['u-001']
  const studentCount = mockStudentEnrollments.filter(
    (s) => s.classroom_id === classroom.id || s.classroom_id === classroom.code_id || s.classroom_id === classroom.code,
  ).length
  const trimmedDisplayName = stripDisplayNameWhitespace(ownerProfile?.display_name || '') || null

  return {
    code_id: classroom.code_id || classroom.id,
    web_profile_id: ownerProfile?.web_profile_id || classroom.web_profile_id || 'wp-001',
    code_value: classroom.code_value || classroom.code,
    name: classroom.name,
    description: classroom.description ?? null,
    is_active: Boolean(classroom.is_active),
    student_count: studentCount,
    created_at: classroom.created_at,
    owner_user_id: ownerProfile?.user_id || 'u-001',
    owner_email: ownerProfile?.email || 'educator@cybermorph.local',
    owner_display_name: trimmedDisplayName,
  }
}

const verifyAdminMockAuth = (config) => {
  const authHeader =
    config?.headers?.Authorization ||
    config?.headers?.authorization ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('cyber_token')
      ? `Bearer ${localStorage.getItem('cyber_token')}`
      : '')
  if (!authHeader || authHeader === 'Bearer ') {
    return [401, { detail: 'Could not validate credentials' }]
  }
  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('cyber_role') : null
  if (
    (role && role !== 'admin') ||
    authHeader.includes('player') ||
    authHeader.includes('educator')
  ) {
    return [403, { detail: 'Admin access required' }]
  }
  return null
}

mock.onGet('/admin/classrooms').reply(async (config) => {
  if (mockControl.delayAdminClassroomsMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayAdminClassroomsMs))
  }
  const authErr = verifyAdminMockAuth(config)
  if (authErr) return authErr

  if (mockControl.failAdminClassroomsCount > 0) {
    mockControl.failAdminClassroomsCount--
    return [500, { detail: 'Temporary admin classrooms failure' }]
  }

  const params = config.params || {}
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : ''
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  let rows = mockClassrooms
    .filter((c) => !c.deleted_at)
    .map((c) => buildAdminClassroomRow(c))

  if (search) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.code_value.toLowerCase().includes(search) ||
        r.owner_email.toLowerCase().includes(search),
    )
  }

  rows.sort((a, b) => {
    const timeDiff = new Date(b.created_at) - new Date(a.created_at)
    if (timeDiff !== 0) return timeDiff
    return String(b.code_id).localeCompare(String(a.code_id))
  })

  const totalCount = rows.length
  const startIdx = (page - 1) * pageSize
  const items = rows.slice(startIdx, startIdx + pageSize)

  return [
    200,
    {
      items,
      total_count: totalCount,
      page,
      page_size: pageSize,
    },
  ]
})

mock.onPatch(new RegExp('^/admin/classrooms/([^/]+)$')).reply(async (config) => {
  if (mockControl.delayAdminClassroomPatchMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayAdminClassroomPatchMs))
  }
  const authErr = verifyAdminMockAuth(config)
  if (authErr) return authErr

  if (mockControl.failAdminClassroomPatchCount > 0) {
    mockControl.failAdminClassroomPatchCount--
    return [500, { detail: 'Temporary admin classroom update failure' }]
  }

  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [422, { detail: [{ loc: ['body'], msg: 'Input should be a valid dictionary', type: 'dict_type' }] }]
  }

  const keys = Object.keys(data)
  const extraKeys = keys.filter((k) => k !== 'is_active')
  if (extraKeys.length > 0) {
    return [
      422,
      {
        detail: extraKeys.map((k) => ({
          loc: ['body', k],
          msg: 'Extra inputs are not permitted',
          type: 'extra_forbidden',
        })),
      },
    ]
  }

  if (typeof data.is_active !== 'boolean') {
    return [
      422,
      {
        detail: [
          {
            loc: ['body', 'is_active'],
            msg: 'Input should be a valid boolean',
            type: 'bool_type',
          },
        ],
      },
    ]
  }

  const match = config.url.match(/^\/admin\/classrooms\/([^/]+)$/)
  const codeId = match ? decodeURIComponent(match[1]) : null
  const target = mockClassrooms.find(
    (c) => !c.deleted_at && (c.code_id === codeId || c.id === codeId),
  )

  if (!target) {
    return [404, { detail: 'Classroom not found' }]
  }

  target.is_active = data.is_active
  return [200, buildAdminClassroomRow(target)]
})

mock.onDelete(new RegExp('^/admin/classrooms/([^/]+)$')).reply(async (config) => {
  if (mockControl.delayAdminClassroomDeleteMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockControl.delayAdminClassroomDeleteMs))
  }
  const authErr = verifyAdminMockAuth(config)
  if (authErr) return authErr

  if (mockControl.failAdminClassroomDeleteCount > 0) {
    mockControl.failAdminClassroomDeleteCount--
    return [500, { detail: 'Temporary admin classroom delete failure' }]
  }

  const match = config.url.match(/^\/admin\/classrooms\/([^/]+)$/)
  const codeId = match ? decodeURIComponent(match[1]) : null
  const target = mockClassrooms.find(
    (c) => !c.deleted_at && (c.code_id === codeId || c.id === codeId),
  )

  if (!target) {
    return [404, { detail: 'Classroom not found' }]
  }

  target.deleted_at = new Date().toISOString()
  return [204]
})

const VALID_ACTION_TYPES = new Set([
  'register_player',
  'register_web_user',
  'login',
  'create_classroom',
  'join_classroom',
  'leave_classroom',
  'update_classroom',
  'delete_classroom',
  'approve_educator',
  'reject_educator',
  'reassign_classroom',
])

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const mockLogs = [
  {
    log_id: '10000000-0000-0000-0000-000000000030',
    user_id: '00000000-0000-0000-0000-000000000099',
    user_email: 'historical.instructor@dnsc.edu.ph',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: 'c9000000-0000-0000-0000-000000000099',
    description: 'Historical instructor action before account removal from directory.',
    logged_at: '2026-10-29T09:50:00Z',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000025',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'approve_educator',
    target_table: 'web_user_profiles',
    target_id: 'e1000000-0000-0000-0000-000000000001',
    description: 'Approved educator account for prof.santos@dnsc.edu.ph after institutional domain confirmation.',
    logged_at: '2026-10-29T09:45:00', // Timezone-free
  },
  {
    log_id: '10000000-0000-0000-0000-000000000024',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: 'c1000000-0000-0000-0000-000000000001',
    description: 'Updated class \'Network Defense 101\' (is_active: false) by an admin. Closed enrollment ahead of semester examination period.',
    logged_at: '2026-10-29T08:30:00+08:00', // Explicit timezone
  },
  {
    log_id: '10000000-0000-0000-0000-000000000023',
    user_id: '00000000-0000-0000-0000-000000000002',
    user_email: 'educator@cybermorph.local',
    action_type: 'create_classroom',
    target_table: 'classroom_codes',
    target_id: 'c2000000-0000-0000-0000-000000000002',
    description: 'Generated classroom code \'CYBER8\' for Security Lab 2.',
    logged_at: '2026-10-28T16:15:00', // Timezone-free
  },
  {
    log_id: '10000000-0000-0000-0000-000000000022',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'reject_educator',
    target_table: 'web_user_profiles',
    target_id: 'e2000000-0000-0000-0000-000000000002',
    description: 'Rejected unverified educator registration application.',
    logged_at: '2026-10-28T14:10:00Z', // Explicit UTC Z
  },
  {
    log_id: '10000000-0000-0000-0000-000000000021',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'player@cybermorph.local',
    action_type: 'join_classroom',
    target_table: 'classroom_students',
    target_id: 'c1000000-0000-0000-0000-000000000001',
    description: 'Joined classroom \'Network Defense 101\' via join code.',
    logged_at: '2026-10-28T11:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000020',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'delete_classroom',
    target_table: 'classroom_codes',
    target_id: 'c3000000-0000-0000-0000-000000000003',
    description: 'Deleted obsolete test classroom \'Sample Sandbox\' by an admin.',
    logged_at: '2026-10-27T17:40:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000019',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'reassign_classroom',
    target_table: 'classroom_codes',
    target_id: 'c4000000-0000-0000-0000-000000000004',
    description: 'Historical reassignment of classroom code before feature deprecation.',
    logged_at: '2026-10-24T12:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000018',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'login',
    target_table: null,
    target_id: null,
    description: null,
    logged_at: '2026-10-27T08:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000026',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: null,
    description: 'Updated classroom global settings with no individual target code ID specified.',
    logged_at: '2026-10-26T18:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000027',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'login',
    target_table: null,
    target_id: null,
    description: null,
    logged_at: '2026-10-27T99:00:00', // Malformed hour bounds (sorts on page 1)
  },
  {
    log_id: '10000000-0000-0000-0000-000000000017',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'player@cybermorph.local',
    action_type: 'leave_classroom',
    target_table: 'classroom_students',
    target_id: 'c5000000-0000-0000-0000-000000000005',
    description: 'Player voluntarily unenrolled from previous semester section.',
    logged_at: '2026-10-26T15:20:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000016',
    user_id: '00000000-0000-0000-0000-000000000004',
    user_email: 'cadet1@cybermorph.local',
    action_type: 'register_player',
    target_table: 'users',
    target_id: '00000000-0000-0000-0000-000000000004',
    description: 'Registered player account with username \'CyberCadet\'.',
    logged_at: '2026-10-26T10:05:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000015',
    user_id: '00000000-0000-0000-0000-000000000005',
    user_email: 'prof.delacruz@dnsc.edu.ph',
    action_type: 'register_web_user',
    target_table: 'users',
    target_id: '00000000-0000-0000-0000-000000000005',
    description: 'Submitted educator application under institutional domain.',
    logged_at: '2026-10-25T14:50:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000014',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'approve_educator',
    target_table: 'web_user_profiles',
    target_id: 'e3000000-0000-0000-0000-000000000003',
    description: 'Approved educator registration for prof.reyes@dnsc.edu.ph.',
    logged_at: '2026-10-25T09:12:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000013',
    user_id: '00000000-0000-0000-0000-000000000002',
    user_email: 'educator@cybermorph.local',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: 'c2000000-0000-0000-0000-000000000002',
    description: 'Renamed classroom code to \'Intro to Security Concepts\'.',
    logged_at: '2026-10-24T18:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000012',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: 'c6000000-0000-0000-0000-000000000006',
    description: 'Re-activated classroom \'Summer Intensive Bootcamp\' following educator request.',
    logged_at: '2026-10-24T11:30:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000011',
    user_id: '00000000-0000-0000-0000-000000000002',
    user_email: 'educator@cybermorph.local',
    action_type: 'login',
    target_table: null,
    target_id: null,
    description: 'Educator authenticated to web management portal from campus network subnet.',
    logged_at: '2026-10-24T08:15:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000010',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'approve_educator',
    target_table: 'web_user_profiles',
    target_id: 'e4000000-0000-0000-0000-000000000004',
    description: 'Approved instructor credentials after verification with academic affairs.',
    logged_at: '2026-10-23T14:40:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000009',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'delete_classroom',
    target_table: 'classroom_codes',
    target_id: 'c7000000-0000-0000-0000-000000000007',
    description: 'Deleted abandoned draft classroom code \'TEST99\'.',
    logged_at: '2026-10-23T10:15:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000008',
    user_id: '00000000-0000-0000-0000-000000000003',
    user_email: 'player@cybermorph.local',
    action_type: 'login',
    target_table: null,
    target_id: null,
    description: null,
    logged_at: '2026-10-22T19:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000007',
    user_id: '00000000-0000-0000-0000-000000000002',
    user_email: 'educator@cybermorph.local',
    action_type: 'create_classroom',
    target_table: 'classroom_codes',
    target_id: 'c8000000-0000-0000-0000-000000000008',
    description: 'Generated classroom code \'ROOKIE\' for freshmen orientation section.',
    logged_at: '2026-10-22T09:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000006',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'reject_educator',
    target_table: 'web_user_profiles',
    target_id: 'e5000000-0000-0000-0000-000000000005',
    description: 'Rejected application with incomplete institutional affiliation.',
    logged_at: '2026-10-21T16:30:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000005',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'update_classroom',
    target_table: 'classroom_codes',
    target_id: 'c9000000-0000-0000-0000-000000000009',
    description: 'Administrative status toggle: closed enrollment.',
    logged_at: '2026-10-21T11:00:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000004',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'approve_educator',
    target_table: 'web_user_profiles',
    target_id: 'e6000000-0000-0000-0000-000000000006',
    description: 'Approved instructor account.',
    logged_at: '2026-10-20T14:15:00',
  },
  {
    log_id: '10000000-0000-0000-0000-000000000003',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'login',
    target_table: null,
    target_id: null,
    description: 'Administrator initial system bootstrap login.',
    logged_at: '2026-10-15T08:00:00',
  },
  // Null timestamp entries: backend database allows NULL logged_at, sorted last
  {
    log_id: '10000000-0000-0000-0000-000000000002',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'approve_educator',
    target_table: 'web_user_profiles',
    target_id: 'e7000000-0000-0000-0000-000000000007',
    description: 'Legacy migration audit record with unrecorded timestamp.',
    logged_at: null,
  },
  {
    log_id: '10000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    user_email: 'admin@cybermorph.local',
    action_type: 'create_classroom',
    target_table: 'classroom_codes',
    target_id: 'c0000000-0000-0000-0000-000000000000',
    description: 'Historical genesis classroom entry without timestamp.',
    logged_at: null,
  },
]

mock.onGet('/admin/logs').reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  if (!authHeader) return [401, { detail: 'Missing authorization token' }]
  const role = localStorage.getItem('cyber_role')
  if (role && role !== 'admin') return [403, { detail: 'Admin access required' }]

  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_ADMIN_LOGS__') || '0', 10) : 0
  if (mockControl.failAdminLogsCount > 0 || sessionFail > 0) {
    if (mockControl.failAdminLogsCount > 0) mockControl.failAdminLogsCount--
    if (sessionFail > 0 && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_ADMIN_LOGS__', String(sessionFail - 1))
    }
    return [500, { detail: 'Audit activity logs unavailable' }]
  }

  const sessionOverride = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('__CYBERMORPH_OVERRIDE_ADMIN_LOGS__') : null
  if (sessionOverride) {
    return [200, JSON.parse(sessionOverride)]
  }
  if (mockControl.adminLogsOverride !== undefined) {
    return [200, mockControl.adminLogsOverride]
  }

  const params = config.params || {}
  const actionType = params.action_type ? String(params.action_type).trim() : null
  const userId = params.user_id ? String(params.user_id).trim() : null

  // Validate action_type if provided
  if (actionType && !VALID_ACTION_TYPES.has(actionType)) {
    return [
      422,
      {
        detail: [
          {
            loc: ['query', 'action_type'],
            msg: `Input should be a valid action_type enum value`,
            type: 'enum',
          },
        ],
      },
    ]
  }

  // Validate user_id if provided
  if (userId && !UUID_REGEX.test(userId)) {
    return [
      422,
      {
        detail: [
          {
            loc: ['query', 'user_id'],
            msg: 'Input should be a valid UUID, invalid character or length',
            type: 'uuid_parsing',
          },
        ],
      },
    ]
  }

  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  let filtered = mockLogs.filter((log) => {
    if (actionType && log.action_type !== actionType) return false
    if (userId && log.user_id.toLowerCase() !== userId.toLowerCase()) return false
    return true
  })

  // Order by logged_at DESC NULLS LAST, log_id DESC
  filtered.sort((a, b) => {
    if (a.logged_at && !b.logged_at) return -1
    if (!a.logged_at && b.logged_at) return 1
    if (a.logged_at && b.logged_at) {
      const cmp = b.logged_at.localeCompare(a.logged_at)
      if (cmp !== 0) return cmp
    }
    return b.log_id.localeCompare(a.log_id)
  })

  const totalCount = filtered.length
  const startIndex = (page - 1) * pageSize
  const items = filtered.slice(startIndex, startIndex + pageSize)

  return [
    200,
    {
      items,
      total_count: totalCount,
      page,
      page_size: pageSize,
    },
  ]
})

mock.onAny().reply(404, { detail: 'Endpoint not found in mock adapter' })

export default mock
