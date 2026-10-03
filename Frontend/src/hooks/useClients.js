import { useData } from '../context/DataContext'
export const useClients = () => useData().data.clients
