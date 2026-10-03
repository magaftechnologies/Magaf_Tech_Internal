import { useData } from '../context/DataContext'
export const useLeads = () => useData().data.leads
