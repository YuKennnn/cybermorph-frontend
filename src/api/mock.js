import MockAdapter from 'axios-mock-adapter'
import apiClient from './client'

const mock = new MockAdapter(apiClient, { delayResponse: 200 })

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

mock.onAny().passThrough()

export default mock
