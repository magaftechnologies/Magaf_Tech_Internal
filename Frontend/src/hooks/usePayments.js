import { useData } from '../context/DataContext'
export const usePayments = () => useData().data.payments
