import MockAdapter from 'axios-mock-adapter'
import apiClient from './client'

const mock = new MockAdapter(apiClient, { delayResponse: 200 })

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
// Dashboard Data Endpoints
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

mock.onGet('/educator/classrooms').reply(200, {
  classrooms: [
    {
      id: 'c1',
      name: 'Intro to Cybersecurity',
      code: 'CYB101',
      student_count: 28,
      is_active: true,
    },
    {
      id: 'c2',
      name: 'Network Defense & Firewalls',
      code: 'NET202',
      student_count: 19,
      is_active: true,
    },
  ],
  total_students: 47,
  recent_activity: [
    { id: 1, text: 'Student AgentZero completed Map 2 simulation', time: '10m ago' },
    { id: 2, text: 'New student joined Intro to Cybersecurity', time: '1h ago' },
    { id: 3, text: 'Class average Threat Index score improved by 12%', time: 'Yesterday' },
  ],
})

mock.onGet('/classroom/my-codes').reply(200, {
  classrooms: [
    {
      id: 'c1',
      name: 'Intro to Cybersecurity',
      code: 'CYB101',
      student_count: 28,
      is_active: true,
    },
  ],
  total_students: 28,
})

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

mock.onAny().passThrough()

export default mock
