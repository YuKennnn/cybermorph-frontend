import axios from 'axios'
import { extractErrorMessage } from './client.js'

/**
 * Resolves the backend host-root URL from the configured base URL
 * (strips '/v1' and trailing slashes).
 * GET /app/version resides at the host root, NOT under /v1.
 *
 * @param {string} [baseUrl]
 * @returns {string} Host root URL (e.g. 'https://cybermorph-backend.onrender.com')
 */
export const resolveHostRootUrl = (baseUrl) => {
  const base = (
    baseUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    'https://cybermorph-backend.onrender.com/v1'
  ).trim()

  return base.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
}

/**
 * Dedicated unauthenticated axios client for host-root / public requests.
 * Has no authorization bearer interceptor and no 401 redirect side effects.
 */
export const publicClient = axios.create({
  timeout: 45000,
})

/**
 * Fetch public application release metadata.
 * Endpoint: GET /app/version (host root)
 *
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ latest_build: number, min_supported_build: number, download_url: string, api_current: number, api_min_supported: number }>}
 */
export const fetchAppVersion = async (options = {}) => {
  const rootUrl = resolveHostRootUrl()
  const response = await publicClient.get(`${rootUrl}/app/version`, {
    timeout: options.timeout || 45000,
    signal: options.signal,
  })
  return response.data
}

export { extractErrorMessage }
