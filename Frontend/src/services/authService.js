import { users } from '../data/mockData'
export const authService = {
  async login(name) {
    const user = users.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (!user) throw new Error('The selected demo team account was not found.')
    const session = { ...user, kind:'TEAM' }
    localStorage.setItem('magaf-os-user', JSON.stringify(session))
    return session
  },
  async loginClient(client) {
    if (!client?.id) throw new Error('A valid client profile is required for portal access.')
    const session = { id:`portal:${client.id}`, clientId:client.id, name:client.contact||client.name, email:client.email, role:'CLIENT', kind:'CLIENT' }
    localStorage.setItem('magaf-os-user', JSON.stringify(session))
    return session
  },
  async logout() { localStorage.removeItem('magaf-os-user') },
  async getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('magaf-os-user') || 'null') }
    catch (error) { console.error('Unable to load the current demo session.',error); throw error }
  },
  async getUserRole() { return (await this.getCurrentUser())?.kind || null },
}
