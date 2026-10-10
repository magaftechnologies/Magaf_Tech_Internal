import { PAYMENT_STATUSES } from './constants.js'

export function balanceFor(amount, paid) {
  return Math.max(0, Math.round((Number(amount || 0) - Number(paid || 0)) * 100) / 100)
}

export function paymentStatusFor(amount, paid, overdue = false) {
  const total = Number(amount || 0)
  const received = Number(paid || 0)
  if (overdue && received < total) return 'overdue'
  if (total > 0 && received >= total) return 'paid'
  return received > 0 ? 'partially_paid' : 'unpaid'
}

export function paidPaymentAmount(payments = []) {
  return payments.filter((payment) => payment.status === 'paid').reduce((total, payment) => total + Number(payment.amount || 0), 0)
}

export function normalizePaidStatus(status) {
  return PAYMENT_STATUSES.includes(status) ? status : 'pending'
}

export function targetProgress(targetValue, currentValue) {
  if (!Number(targetValue)) return 0
  return Math.min(100, Math.round((Number(currentValue || 0) / Number(targetValue)) * 10000) / 100)
}
