import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth.api'
import { clearToken, getToken, isRemembered, setToken } from '../api/tokenStorage'

const AuthContext = createContext(null)

function sessionUser(user) {
  return {
    ...user,
    kind: user.portalType === 'client' ? 'CLIENT' : 'TEAM',
    role: user.role,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const restore = async () => {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const result = await authApi.currentUser()
        if (active) setUser(sessionUser(result.user))
      } catch {
        clearToken()
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    const expireSession = () => {
      clearToken()
      setUser(null)
    }
    window.addEventListener('magaf:unauthorized', expireSession)
    restore()
    return () => {
      active = false
      window.removeEventListener('magaf:unauthorized', expireSession)
    }
  }, [])

  const login = async ({ email, password, remember = false }) => {
    const result = await authApi.login({ email: email.trim(), password })
    setToken(result.token, remember)
    const nextUser = sessionUser(result.user)
    setUser(nextUser)
    return nextUser
  }

  const changePassword = async (credentials) => {
    const result = await authApi.changePassword(credentials)
    setToken(result.token, isRemembered())
    const nextUser = sessionUser(result.user)
    setUser(nextUser)
    return nextUser
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
