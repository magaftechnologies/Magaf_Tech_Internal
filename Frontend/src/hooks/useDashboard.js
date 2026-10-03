import { useData } from '../context/DataContext'
import { dashboardStats } from '../utils/calculations'
export const useDashboard = () => {
  const { data } = useData()
  return dashboardStats(data)
}
