import { dashboardStats } from '../utils/calculations'
import { initialData } from '../data/mockData'
export const dashboardApi = {
  async getStats(data = initialData) { return dashboardStats(data) },
}
