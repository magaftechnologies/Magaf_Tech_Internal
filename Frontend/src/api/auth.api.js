import { apiData } from './http'

export const authApi = {
  login: (credentials) => apiData('/auth/login', { method: 'POST', body: credentials }),
  currentUser: () => apiData('/auth/me'),
  changePassword: (credentials) => apiData('/auth/change-password', { method: 'POST', body: credentials }),
}
