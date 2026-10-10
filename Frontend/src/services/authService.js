import { authApi } from '../api/auth.api'
import { clearToken, setToken } from '../api/tokenStorage'

export const authService = {
  async login(credentials) {
    const session = await authApi.login(credentials)
    setToken(session.token, credentials.remember)
    return session.user
  },
  async logout() {
    clearToken()
  },
  async getCurrentUser() {
    return (await authApi.currentUser()).user
  },
}
