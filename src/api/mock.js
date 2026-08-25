import MockAdapter from 'axios-mock-adapter'
import apiClient from './client'

const mock = new MockAdapter(apiClient, { delayResponse: 200 })

// ==========================================
// Stateful Mock Data Sets
// ==========================================
let mockClassrooms = [
  {
    id: 'c1',
    code: 'CYB101',
    name: 'Intro to Cybersecurity',
    description: 'Fundamental security principles, phishing detection, and baseline hygiene.',
    is_active: true,
    created_at: '2026-08-20T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 'c2',
    code: 'NET202',
    name: 'Network Defense & Firewalls',
    description: 'Network topology defense, firewall rule evaluation, and intrusion analysis.',
    is_active: true,
    created_at: '2026-08-22T14:30:00Z',
    deleted_at: null,
  },
]

let mockStudentEnrollments = [
  {
    classroom_id: 'c1',
    profile_id: 'p1',
    username: 'AgentZero',
    map_progress: 'Map 3: Power Grid',
    joined_at: '2026-08-21T09:15:00Z',
  },
  {
    classroom_id: 'c1',
    profile_id: 'p2',
    username: 'CipherQueen',
    map_progress: 'Map 4: Command Center',
    joined_at: '2026-08-21T11:40:00Z',
  },
  {
    classroom_id: 'c2',
    profile_id: 'p1',
    username: 'AgentZero',
    map_progress: 'Map 2: Water Facility',
    joined_at: '2026-08-23T08:20:00Z',
  },
]

const mockLeaderboardEntries = [
  { id: 1, rank: 1, username: 'CipherQueen', score: 9850, map_name: 'Home' },
  { id: 2, rank: 2, username: 'NeoMatrix', score: 9600, map_name: 'Office' },
  { id: 3, rank: 3, username: 'AgentZero', score: 9200, map_name: 'Industrial Control Station' },
  { id: 4, rank: 4, username: 'ByteMaster', score: 8950, map_name: 'Internet Cafe' },
  { id: 5, rank: 5, username: 'CyberGhost', score: 8700, map_name: 'Public Park' },
  { id: 6, rank: 6, username: 'ShadowCoder', score: 8550, map_name: 'Home' },
  { id: 7, rank: 7, username: 'FirewallFox', score: 8300, map_name: 'Office' },
  { id: 8, rank: 8, username: 'DataNinja', score: 8150, map_name: 'Internet Cafe' },
  { id: 9, rank: 9, username: 'NetSentinel', score: 7900, map_name: 'Public Park' },
  { id: 10, rank: 10, username: 'PixelGuard', score: 7750, map_name: 'Home' },
  { id: 11, rank: 11, username: 'ZeroDayHero', score: 7500, map_name: 'Office' },
  { id: 12, rank: 12, username: 'CryptoKnight', score: 7350, map_name: 'Internet Cafe' },
  { id: 13, rank: 13, username: 'PacketHunter', score: 7100, map_name: 'Public Park' },
  { id: 14, rank: 14, username: 'SecOpsPro', score: 6950, map_name: 'Home' },
  { id: 15, rank: 15, username: 'KernelPanic', score: 6800, map_name: 'Office' },
  { id: 16, rank: 16, username: 'LogicBomb', score: 6600, map_name: 'Internet Cafe' },
  { id: 17, rank: 17, username: 'BufferOverflow', score: 6450, map_name: 'Public Park' },
  { id: 18, rank: 18, username: 'RootAccess', score: 6300, map_name: 'Home' },
  { id: 19, rank: 19, username: 'SynFlood', score: 6100, map_name: 'Office' },
  { id: 20, rank: 20, username: 'PortScanner', score: 5900, map_name: 'Internet Cafe' },
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
      access_token: 'mock-jwt-token-cybermorph-12345',
      token_type: 'bearer',
      user: {
        id: 1,
        email,
        username: email.split('@')[0] || 'user',
        role,
      },
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
  const { email, username, password, role } = data

  if (!email || !username || !password) {
    return [400, { detail: 'Missing required registration fields' }]
  }

  if (role === 'educator' && !email.includes('.')) {
    return [400, { detail: 'Invalid institutional email domain' }]
  }

  return [
    201,
    {
      id: 102,
      email,
      username,
      role: role || 'educator',
    },
  ]
})

// ==========================================
// Player Dashboard Data Endpoint
// ==========================================
mock.onGet('/players/me').reply(200, {
  id: 101,
  username: 'AgentZero',
  email: 'player@example.com',
  role: 'player',
  games_played: 14,
  best_score: 9200,
  threat_index_progress: '5/8 unlocked',
  current_map: 'Industrial Control Station',
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
  const { name, description } = data

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let newCode = ''
  for (let i = 0; i < 6; i++) {
    newCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const newId = 'c' + (mockClassrooms.length + 1)
  const newClassroom = {
    id: newId,
    code: newCode,
    name: name || 'Untitled Classroom',
    description: description || '',
    is_active: true,
    created_at: new Date().toISOString(),
    deleted_at: null,
  }

  mockClassrooms.push(newClassroom)

  return [201, { ...newClassroom, student_count: 0 }]
})

mock.onPost('/classroom/join').reply((config) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
  const rawCode = (data.code || '').trim().toUpperCase()

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
    map_progress: 'Map 1: Home Baseline',
    joined_at: new Date().toISOString(),
  }

  mockStudentEnrollments.push(newEnrollment)

  return [
    200,
    {
      classroom_id: targetClassroom.id,
      code: targetClassroom.code,
      name: targetClassroom.name,
      message: `Successfully joined ${targetClassroom.name}!`,
    },
  ]
})

// GET /classroom/:code_id/students
mock.onGet(new RegExp('/classroom/([^/]+)/students')).reply((config) => {
  const match = config.url.match(/\/classroom\/([^/]+)\/students/)
  const codeId = match ? match[1] : null

  const classroom = mockClassrooms.find((c) => !c.deleted_at && (c.id === codeId || c.code === codeId))
  if (!classroom) {
    return [404, { detail: 'Classroom not found.' }]
  }

  const students = mockStudentEnrollments.filter(
    (s) => s.classroom_id === classroom.id || s.classroom_id === classroom.code,
  )

  return [
    200,
    {
      classroom: {
        id: classroom.id,
        code: classroom.code,
        name: classroom.name,
      },
      students,
      total_count: students.length,
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
    description: data.description !== undefined ? data.description : mockClassrooms[index].description,
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

  return [200, { success: true, message: 'Classroom soft-deleted successfully.' }]
})

// ==========================================
// Leaderboard Endpoint
// ==========================================
mock.onGet('/leaderboard').reply((config) => {
  const params = config.params || {}
  const { map_name, search } = params
  const page = parseInt(params.page, 10) || 1
  const pageSize = parseInt(params.page_size, 10) || 10

  let filtered = [...mockLeaderboardEntries]

  if (map_name && map_name !== 'All') {
    filtered = filtered.filter(
      (entry) => entry.map_name.toLowerCase() === map_name.toLowerCase(),
    )
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter((entry) => entry.username.toLowerCase().includes(q))
  }

  const total_count = filtered.length
  const startIndex = (page - 1) * pageSize
  const paginatedItems = filtered.slice(startIndex, startIndex + pageSize).map((item, index) => ({
    ...item,
    rank: startIndex + index + 1,
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

mock.onAny().passThrough()

export default mock
