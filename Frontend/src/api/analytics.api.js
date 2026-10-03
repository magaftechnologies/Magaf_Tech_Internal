import { readMockData } from './mockResource'
import { dashboardStats, serviceStats } from '../utils/calculations'
export const analyticsApi = {
  async getDashboard() {
    const data = readMockData()
    return dashboardStats(data)
  },
  async getServicePerformance() {
    const data = readMockData()
    return (data.services || []).map((service) => ({ service, ...serviceStats(data, service.id) }))
  },
}
