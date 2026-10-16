import MockAdapter from 'axios-mock-adapter'
import apiClient from './client.js'

const mock = new MockAdapter(apiClient, { delayResponse: 200 })

export const mockControl = {
  failThreatIndexCount: 0,
  delayPlayerAnalyticsMs: 0,
  delayClassroomAnalytics: {},
  delaySessionAnalyticsMs: 0,
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
    code: 'CYB101',
    code_value: 'CYB101',
    name: 'BSIT 4A',
    is_active: true,
    student_count: 23,
    created_at: '2026-08-20T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 'c2',
    code_id: 'c2',
    code: 'NET202',
    code_value: 'NET202',
    name: 'BSIT 3C',
    is_active: true,
    student_count: 1,
    created_at: '2026-08-22T14:30:00Z',
    deleted_at: null,
  },
  {
    id: 'c3',
    code_id: 'c3',
    code: 'OLD303',
    code_value: 'OLD303',
    name: 'BSCS 2B (Archived)',
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
    map_progress: 3,
    joined_at: '2026-08-21T09:15:00Z',
    last_synced_at: '2026-09-28T13:45:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p2',
    username: 'CipherQueen',
    map_progress: 4,
    joined_at: '2026-08-21T11:40:00Z',
    last_synced_at: '2026-09-28T10:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p3',
    username: 'ByteMaster',
    map_progress: 2,
    joined_at: '2026-08-22T08:00:00Z',
    last_synced_at: '2026-09-27T15:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p4',
    username: 'NeoMatrix',
    map_progress: 1,
    joined_at: '2026-08-22T09:10:00Z',
    last_synced_at: '2026-09-26T12:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p5',
    username: 'ShadowCoder',
    map_progress: 2,
    joined_at: '2026-08-22T10:15:00Z',
    last_synced_at: '2026-09-25T11:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p6',
    username: 'CyberGhost',
    map_progress: 3,
    joined_at: '2026-08-23T14:20:00Z',
    last_synced_at: '2026-09-24T16:40:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p7',
    username: 'FirewallFox',
    map_progress: 4,
    joined_at: '2026-08-23T15:00:00Z',
    last_synced_at: '2026-09-24T09:15:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p8',
    username: 'DataNinja',
    map_progress: 1,
    joined_at: '2026-08-24T11:00:00Z',
    last_synced_at: '2026-09-23T14:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p9',
    username: 'NetSentinel',
    map_progress: 2,
    joined_at: '2026-08-24T12:30:00Z',
    last_synced_at: '2026-09-22T18:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p10',
    username: 'PixelGuard',
    map_progress: 3,
    joined_at: '2026-08-25T08:45:00Z',
    last_synced_at: '2026-09-21T13:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p11',
    username: 'ZeroDayHero',
    map_progress: 1,
    joined_at: '2026-08-25T10:00:00Z',
    last_synced_at: '2026-09-20T17:05:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p12',
    username: 'CryptoKnight',
    map_progress: 2,
    joined_at: '2026-08-25T11:15:00Z',
    last_synced_at: '2026-09-19T10:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p13',
    username: 'PacketHunter',
    map_progress: 4,
    joined_at: '2026-08-26T09:20:00Z',
    last_synced_at: '2026-09-18T14:45:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p14',
    username: 'SecOpsPro',
    map_progress: 3,
    joined_at: '2026-08-26T13:40:00Z',
    last_synced_at: '2026-09-17T11:25:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p15',
    username: 'KernelPanic',
    map_progress: 1,
    joined_at: '2026-08-27T08:10:00Z',
    last_synced_at: '2026-09-16T15:50:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p16',
    username: 'LogicBomb',
    map_progress: 2,
    joined_at: '2026-08-27T10:30:00Z',
    last_synced_at: '2026-09-15T09:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p17',
    username: 'BufferOverflow',
    map_progress: 4,
    joined_at: '2026-08-28T14:00:00Z',
    last_synced_at: '2026-09-14T12:15:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p18',
    username: 'RootAccess',
    map_progress: 3,
    joined_at: '2026-08-28T15:20:00Z',
    last_synced_at: '2026-09-13T16:30:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p19',
    username: 'SynFlood',
    map_progress: 1,
    joined_at: '2026-08-29T11:00:00Z',
    last_synced_at: '2026-09-12T10:40:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p20',
    username: 'PortScanner',
    map_progress: 2,
    joined_at: '2026-08-29T16:15:00Z',
    last_synced_at: '2026-09-11T14:20:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p21',
    username: 'EchoReply',
    map_progress: 4,
    joined_at: '2026-08-30T09:30:00Z',
    last_synced_at: '2026-09-10T11:00:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p22',
    username: 'TraceRoute',
    map_progress: 3,
    joined_at: '2026-08-30T13:45:00Z',
    last_synced_at: '2026-09-09T15:10:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p23',
    username: 'SubnetMask',
    map_progress: 1,
    joined_at: '2026-08-31T10:00:00Z',
    last_synced_at: '2026-09-08T08:50:00Z',
  },
  {
    classroom_id: 'c2',
    profile_id: 'p1',
    username: 'AgentZero',
    map_progress: 2,
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
mock.onPost('/auth/login').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, password } = data

  if (!email || !password || password === 'wrongpassword') {
    return [401, { detail: 'Invalid credentials' }]
  }

  const role = email.includes('admin') ? 'admin' : email.includes('educator') ? 'educator' : 'player'

  return [
    200,
    {
      access_token: `mock-jwt-token-${role}-12345`,
      token_type: 'bearer',
    },
  ]
})

mock.onPost('/auth/register').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, username, password } = data

  if (!email || !username || !password) {
    return [400, { detail: 'Missing required registration fields' }]
  }

  if (email.includes('conflict') || username === 'existinguser') {
    return [409, { detail: 'Username or email already registered' }]
  }

  return [
    201,
    {
      id: 101,
      email,
      username,
      role: 'player',
    },
  ]
})

mock.onPost('/auth/register-web').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { email, password } = data

  if (!email || !password) {
    return [400, { detail: 'Missing required registration fields' }]
  }

  if (!email.toLowerCase().endsWith('@dnsc.edu.ph')) {
    return [400, { detail: 'Invalid institutional email domain' }]
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
mock.onGet('/players/me').reply(200, {
  profile_id: 'p1',
  user_id: 'u-101',
  username: 'AgentZero',
  email: 'player@example.com',
  role: 'player',
  map_progress: 3,
})

const mockThreatIndex = [
  { threat_name: 'Phishing', is_unlocked: true, unlocked_at: '2026-09-20T10:00:00Z' },
  { threat_name: 'Smishing', is_unlocked: true, unlocked_at: '2026-09-21T11:00:00Z' },
  { threat_name: 'Vishing', is_unlocked: true, unlocked_at: '2026-09-22T14:00:00Z' },
  { threat_name: 'Social Engineering', is_unlocked: true, unlocked_at: '2026-09-23T09:00:00Z' },
  { threat_name: 'Credential Theft / Weak Password Attack', is_unlocked: true, unlocked_at: '2026-09-24T16:00:00Z' },
  { threat_name: 'Public Wi-Fi Attack', is_unlocked: false, unlocked_at: null },
  { threat_name: 'Malware Infection', is_unlocked: false, unlocked_at: null },
  { threat_name: 'Ransomware', is_unlocked: false, unlocked_at: null },
]

mock.onGet('/players/threat-index').reply(() => {
  const sessionFail = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('__CYBERMORPH_FAIL_THREAT__') || '0', 10) : 0
  if (mockControl.failThreatIndexCount > 0 || sessionFail > 0) {
    if (mockControl.failThreatIndexCount > 0) mockControl.failThreatIndexCount--
    if (sessionFail > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem('__CYBERMORPH_FAIL_THREAT__', String(sessionFail - 1))
    }
    return [500, { detail: 'Temporary threat index failure' }]
  }
  return [200, mockThreatIndex]
})

const mockPlayerSessions = [
  {
    session_id: 'sess-01',
    map_name: 'Internet Cafe',
    duration_seconds: 145,
    credits_earned: 9200,
    credits_lost: 0,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-28T14:30:00Z',
  },
  {
    session_id: 'sess-02',
    map_name: 'Office',
    duration_seconds: 180,
    credits_earned: 8500,
    credits_lost: 200,
    false_positives: 1,
    result: 'win',
    played_at: '2026-09-27T11:15:00Z',
  },
  {
    session_id: 'sess-03',
    map_name: 'Home',
    duration_seconds: 120,
    credits_earned: 7800,
    credits_lost: 150,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-26T16:00:00Z',
  },
  {
    session_id: 'sess-04',
    map_name: 'Internet Cafe',
    duration_seconds: 210,
    credits_earned: 6900,
    credits_lost: 400,
    false_positives: 2,
    result: 'lose',
    played_at: '2026-09-25T13:45:00Z',
  },
  {
    session_id: 'sess-05',
    map_name: 'Public Park',
    duration_seconds: 160,
    credits_earned: 5400,
    credits_lost: 300,
    false_positives: 1,
    result: 'win',
    played_at: '2026-09-24T10:20:00Z',
  },
  {
    session_id: 'sess-06',
    map_name: 'Office',
    duration_seconds: 130,
    credits_earned: 7100,
    credits_lost: 100,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-23T15:10:00Z',
  },
  {
    session_id: 'sess-07',
    map_name: 'Home',
    duration_seconds: 95,
    credits_earned: 6200,
    credits_lost: 50,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-22T09:30:00Z',
  },
  {
    session_id: 'sess-08',
    map_name: 'Internet Cafe',
    duration_seconds: 200,
    credits_earned: 4500,
    credits_lost: 600,
    false_positives: 3,
    result: 'timeout',
    played_at: '2026-09-21T17:00:00Z',
  },
  {
    session_id: 'sess-09',
    map_name: 'Home',
    duration_seconds: 110,
    credits_earned: 5900,
    credits_lost: 120,
    false_positives: 1,
    result: 'win',
    played_at: '2026-09-20T14:40:00Z',
  },
  {
    session_id: 'sess-10',
    map_name: 'Office',
    duration_seconds: 150,
    credits_earned: 6800,
    credits_lost: 250,
    false_positives: 1,
    result: 'win',
    played_at: '2026-09-19T11:50:00Z',
  },
  {
    session_id: 'sess-11',
    map_name: 'Public Park',
    duration_seconds: 175,
    credits_earned: 7300,
    credits_lost: 180,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-18T16:25:00Z',
  },
  {
    session_id: 'sess-12',
    map_name: 'Internet Cafe',
    duration_seconds: 140,
    credits_earned: 8100,
    credits_lost: 90,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-17T13:10:00Z',
  },
  {
    session_id: 'sess-13',
    map_name: 'Office',
    duration_seconds: 165,
    credits_earned: 7600,
    credits_lost: 150,
    false_positives: 1,
    result: 'win',
    played_at: '2026-09-16T10:05:00Z',
  },
  {
    session_id: 'sess-14',
    map_name: 'Home',
    duration_seconds: 105,
    credits_earned: 6400,
    credits_lost: 80,
    false_positives: 0,
    result: 'win',
    played_at: '2026-09-15T15:35:00Z',
  },
]

mock.onGet('/sessions/history').reply((config) => {
  const params = config.params || {}
  const page = Math.max(1, parseInt(params.page, 10) || 1)
  const pageSize = Math.max(1, parseInt(params.page_size, 10) || 20)

  const total_count = mockPlayerSessions.length
  const startIndex = (page - 1) * pageSize
  const paginatedItems = mockPlayerSessions.slice(startIndex, startIndex + pageSize)

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
// Web Users Profile Endpoint
// ==========================================
mock.onGet('/web-users/me').reply((config) => {
  const auth = config.headers?.Authorization || config.headers?.authorization || ''
  if (auth.includes('player')) {
    return [403, { detail: 'Not a web portal account' }]
  }
  if (auth.includes('admin')) {
    return [
      200,
      {
        web_profile_id: 'wp-002',
        user_id: 'u-admin-01',
        email: 'admin@cybermorph.local',
        role: 'admin',
        display_name: 'SysAdmin',
        portal_access: true,
        approval_status: 'approved',
        last_login_at: '2026-10-01T06:00:00Z',
      },
    ]
  }
  return [
    200,
    {
      web_profile_id: 'wp-001',
      user_id: 'u-001',
      email: 'educator@cybermorph.local',
      role: 'educator',
      display_name: 'Prof. CyberMorph',
      portal_access: true,
      approval_status: 'approved',
      last_login_at: '2026-10-01T06:00:00Z',
    },
  ]
})

// ==========================================
// Admin Dashboard Data Endpoint
// ==========================================
mock.onGet('/admin/stats').reply(200, {
  total_users: 156,
  active_sessions: 23,
  pending_approvals: 4,
  threats_detected: 412,
  server_uptime: '99.9%',
  recent_logs: [
    { id: 1, action: 'User Registration', user: 'educator_smith@school.edu', status: 'Pending' },
    { id: 2, action: 'Threat Simulation Sync', user: 'AgentZero', status: 'Success' },
    { id: 3, action: 'Classroom Code Generated', user: 'prof_jones@univ.edu', status: 'Success' },
  ],
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

mock.onGet('/classroom/my-codes').reply(() => {
  const list = getClassroomResponse()
  return [200, { classrooms: list, total_students: mockStudentEnrollments.length }]
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
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const { name} = data

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

mock.onPost('/classroom/join').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const rawCode = (data.code_value || data.code || '').trim().toUpperCase()

  if (!rawCode) {
    return [400, { detail: 'Classroom code is required.' }]
  }

  const targetClassroom = mockClassrooms.find(
    (c) => !c.deleted_at && (c.code.toUpperCase() === rawCode || c.id === rawCode),
  )

  if (!targetClassroom) {
    return [404, { detail: 'Classroom code not found. Please verify the code with your educator.' }]
  }

  if (!targetClassroom.is_active) {
    return [409, { detail: 'This classroom is currently inactive and cannot accept new students.' }]
  }

  const alreadyJoined = mockStudentEnrollments.some(
    (s) =>
      (s.classroom_id === targetClassroom.id || s.classroom_id === targetClassroom.code) &&
      s.username === 'AgentZero',
  )

  if (alreadyJoined) {
    return [409, { detail: 'You have already joined this classroom.' }]
  }

  const newEnrollment = {
    classroom_id: targetClassroom.id,
    profile_id: 'p' + (mockStudentEnrollments.length + 1),
    username: 'AgentZero',
    map_progress: 1,
    last_synced_at: null,
    joined_at: new Date().toISOString(),
  }

  mockStudentEnrollments.push(newEnrollment)
  targetClassroom.student_count = (targetClassroom.student_count || 0) + 1

  return [
    201,
    {
      profile_id: newEnrollment.profile_id,
      code_id: targetClassroom.id,
      name: targetClassroom.name,
      joined_at: newEnrollment.joined_at,
    },
  ]
})

// GET /classroom/:code_id/students
mock.onGet(new RegExp('/classroom/([^/]+)/students')).reply((config) => {
  const match = config.url.match(/\/classroom\/([^/]+)\/students/)
  const codeId = match ? match[1] : null

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
mock.onPatch(new RegExp('/classroom/([^/]+)$')).reply((config) => {
  const match = config.url.match(/\/classroom\/([^/]+)$/)
  const codeId = match ? match[1] : null
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}

  const index = mockClassrooms.findIndex((c) => !c.deleted_at && (c.id === codeId || c.code === codeId))
  if (index === -1) {
    return [404, { detail: 'Classroom not found.' }]
  }

  const updated = {
    ...mockClassrooms[index],
    name: data.name !== undefined ? data.name : mockClassrooms[index].name,
    is_active: data.is_active !== undefined ? data.is_active : mockClassrooms[index].is_active,
  }

  mockClassrooms[index] = updated

  return [200, updated]
})

// DELETE /classroom/:code_id
mock.onDelete(new RegExp('/classroom/([^/]+)$')).reply((config) => {
  const match = config.url.match(/\/classroom\/([^/]+)$/)
  const codeId = match ? match[1] : null

  const index = mockClassrooms.findIndex((c) => !c.deleted_at && (c.id === codeId || c.code === codeId))
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
        'Credential Theft / Weak Password Attack': 0.35,
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
  return [
    200,
    {
      profile_id: profileId,
      wins: 6,
      losses: 2,
      avg_duration_seconds: 132.5,
      best_score_by_map: {
        Home: 850,
        Office: 720,
      },
      category_breakdown: {
        Phishing: 0.10,
        Smishing: 0.25,
        Vishing: 0.40,
        'Social Engineering': 0.08,
        'Credential Theft / Weak Password Attack': 0.30,
        'Public Wi-Fi Attack': null,
        'Malware Infection': 0.45,
        Ransomware: null,
      },
      recent_sessions: [
        {
          session_id: 'e2a8b351-9c2f-4612-8342-210394857612',
          map_name: 'Office',
          duration_seconds: 145,
          credits_earned: 40,
          credits_lost: 60,
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
            threat_type: 'Credential Theft / Weak Password Attack',
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
    user_id: 'u-admin-01',
    email: 'admin@cybermorph.local',
    role: 'admin',
    username: null,
    display_name: null,
    is_active: true,
    created_at: '2026-08-01T08:00:00Z',
  },
  {
    user_id: 'u-educator-01',
    email: 'educator@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: null,
    is_active: true,
    created_at: '2026-08-05T09:30:00Z',
  },
  {
    user_id: 'u-educator-pending-01',
    email: 'prof_smith@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: null,
    is_active: false,
    created_at: '2026-09-10T14:15:00Z',
  },
  {
    user_id: 'u-educator-pending-02',
    email: 'instructor_lee@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: null,
    is_active: false,
    created_at: '2026-09-15T11:20:00Z',
  },
  {
    user_id: 'u-educator-rejected-01',
    email: 'rejected_candidate@dnsc.edu.ph',
    role: 'educator',
    username: null,
    display_name: null,
    is_active: false,
    created_at: '2026-09-02T10:00:00Z',
  },
  {
    user_id: 'u-player-01',
    email: 'player_alex@example.com',
    role: 'player',
    username: 'AgentAlex',
    display_name: null,
    is_active: true,
    created_at: '2026-08-10T16:45:00Z',
  },
  {
    user_id: 'u-player-02',
    email: 'player_sam@example.com',
    role: 'player',
    username: 'SamSec',
    display_name: null,
    is_active: true,
    created_at: '2026-08-12T13:10:00Z',
  },
  {
    user_id: 'u-player-03',
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

mock.onAny().reply(404, { detail: 'Endpoint not found in mock adapter' })

export default mock
