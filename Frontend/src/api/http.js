import { clearToken, getToken } from './tokenStorage'

//const configuredBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
const configuredBase = import.meta.env.VITE_API_BASE_URL || 'https://magaf-tech-internal.onrender.com/api'
const API_BASE = configuredBase.replace(/\/+$/, '').replace(/\/api$/i, '') + '/api'
const API_ORIGIN = API_BASE.slice(0, -4)

export class ApiError extends Error {
  constructor(message, { status = 0, errors = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export async function apiRequest(path, { body, headers = {}, ...options } = {}) {
  const token = getToken()
  const requestHeaders = new Headers(headers)
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
  let requestBody = body
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }
  let response
  try {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers: requestHeaders,
      body: requestBody,
    })
  } catch {
    throw new ApiError('Unable to reach the MAGAF API. Check that the backend is running and try again.')
  }
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('The server returned an unreadable response.', { status: response.status })
  }
  if (!response.ok || payload.success === false) {
    if (response.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new CustomEvent('magaf:unauthorized'))
    }
    const message = response.status >= 500
      ? 'The server could not complete the request. Please try again.'
      : payload.message || 'The request could not be completed.'
    throw new ApiError(message, { status: response.status, errors: payload.errors || [] })
  }
  return payload
}

export async function checkApiConnection() {
  let healthResponse
  try {
    healthResponse = await fetch(`${API_ORIGIN}/health`)
  } catch {
    throw new ApiError('Unable to reach the MAGAF backend. Check that it is running.')
  }

  let health
  try {
    health = await healthResponse.json()
  } catch {
    throw new ApiError('The backend health endpoint returned an unreadable response.', { status: healthResponse.status })
  }
  if (!healthResponse.ok || health.success !== true) {
    throw new ApiError(health.message || 'The backend health check failed.', { status: healthResponse.status })
  }
  if (health.data?.database !== 'connected') {
    throw new ApiError(`Backend is running, but its database is ${health.data?.database || 'unavailable'}.`)
  }

  await apiRequest('/project-requests?limit=1')
  return { database: health.data.database, authenticated: true }
}

export async function listAll(path, query = {}) {
  const records = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({ ...query, page: String(page), limit: '100' })
    const result = await apiRequest(`${path}?${params}`)
    records.push(...(Array.isArray(result.data) ? result.data : []))
    const pages = result.meta?.pages || 1
    if (page >= pages) break
    page += 1
  }
  return records
}

export async function apiData(path, options) {
  const result = await apiRequest(path, options)
  return result.data
}
