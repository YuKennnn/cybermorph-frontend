import axios from 'axios'

const apiClient = axios.create({
    baseURL: import.meta.env?.VITE_API_BASE_URL || 'https://cybermorph-backend.onrender.com/v1',
})

export const extractBearerToken = (authHeader) => {
    if (typeof authHeader !== 'string') return null
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    return match ? match[1].trim() : null
}

let unauthorizedSessionHandler = null

export const setUnauthorizedSessionHandler = (handler) => {
    unauthorizedSessionHandler = handler
}

export const getUnauthorizedSessionHandler = () => unauthorizedSessionHandler

apiClient.interceptors.request.use(
    (config) => {
        if (!config.headers) {
            config.headers = {}
        }

        if (config.skipAuth || config.headers.Authorization === null || config.headers.Authorization === false) {
            delete config.headers.Authorization
            delete config.headers.authorization
            config._sessionToken = null
            return config
        }

        const existingAuth =
            config.headers.Authorization ||
            config.headers.authorization ||
            (typeof config.headers.get === 'function' ? config.headers.get('Authorization') : null)

        if (!existingAuth) {
            const token = localStorage.getItem('cyber_token')
            if (token) {
                config.headers.Authorization = `Bearer ${token}`
                config._sessionToken = token
            }
        } else {
            const token = extractBearerToken(existingAuth)
            if (token) {
                config._sessionToken = token
            }
        }
        return config
    },
    (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status
        const config = error.config || {}
        const requestUrl = config.url || ''
        const isLoginEndpoint = requestUrl.includes('/auth/login')

        if (status === 401 && !isLoginEndpoint) {
            const sentToken =
                config._sessionToken ||
                extractBearerToken(
                    config.headers?.Authorization ||
                    config.headers?.authorization ||
                    (typeof config.headers?.get === 'function' ? config.headers.get('Authorization') : null),
                )

            const currentToken = localStorage.getItem('cyber_token')

            // A 401 only terminates authentication if it belongs to the currently active session.
            // If the user has logged out (currentToken is null) or logged into a new account
            // (sentToken !== currentToken), the response is obsolete and must not clear the new session.
            if (sentToken && currentToken && sentToken === currentToken) {
                if (typeof unauthorizedSessionHandler === 'function') {
                    try {
                        unauthorizedSessionHandler()
                    } catch {
                        localStorage.removeItem('cyber_token')
                        localStorage.removeItem('cyber_user')
                        localStorage.removeItem('cyber_role')
                    }
                } else {
                    localStorage.removeItem('cyber_token')
                    localStorage.removeItem('cyber_user')
                    localStorage.removeItem('cyber_role')
                }

                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    window.location.assign('/login')
                }
            }
        }
        return Promise.reject(error)
    },
)

/**
 * Extracts a safe, user-friendly error message from FastAPI and network errors.
 * Handles flat detail strings (401, 403, 404), nested 409 conflict objects,
 * and 422 validation error arrays.
 */
export const extractErrorMessage = (error, defaultMessage = 'An unexpected error occurred.') => {
    if (!error) return defaultMessage

    // Network or server wake-up/timeout failure
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return 'Connection timed out. The server may still be waking up — please try again.'
        }
        if (error.message === 'Network Error') {
            return 'Unable to reach backend server. Please verify your connection or CORS settings.'
        }
        return error.message || 'Unable to connect to the server.'
    }

    const data = error.response.data
    if (!data) return defaultMessage

    // Flat detail string (401, 403, 404)
    if (typeof data.detail === 'string') {
        return data.detail
    }

    // Nested detail object (409 conflict: { detail: { field, message } })
    if (data.detail && typeof data.detail === 'object') {
        if (data.detail.message) {
            return data.detail.message
        }
        // Validation error array (422: [{ loc, msg, type }])
        if (Array.isArray(data.detail) && data.detail.length > 0) {
            const firstError = data.detail[0]
            if (firstError?.msg) {
                return firstError.msg
            }
        }
    }

    return defaultMessage
}

export default apiClient
