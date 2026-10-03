import { createContext, useContext, useState } from 'react'
import { users } from '../data/mockData'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { const saved = localStorage.getItem('magaf-os-user'); return saved ? JSON.parse(saved) : null } catch (error) { console.error('Unable to restore demo session.', error); return null }
  })
  const login = (name) => {
    const next = users.find((person) => person.name.toLowerCase() === name.toLowerCase()) || users[0]
    const session = { ...next, kind:'TEAM', role:next.role || 'TEAM MEMBER' }
    setUser(session)
    localStorage.setItem('magaf-os-user', JSON.stringify(session))
  }
  const loginAsClient = (client) => {
    if (!client?.id) throw new Error('A valid client profile is required for portal access.')
    const session = { id:`portal:${client.id}`, clientId:client.id, name:client.contact || client.name, email:client.email, role:'CLIENT', kind:'CLIENT' }
    setUser(session)
    localStorage.setItem('magaf-os-user', JSON.stringify(session))
  }
  const logout = () => { setUser(null); localStorage.removeItem('magaf-os-user') }
  return <AuthContext.Provider value={{ user, login, loginAsClient, logout }}>{children}</AuthContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
