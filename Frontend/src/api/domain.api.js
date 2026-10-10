import { apiData, listAll } from './http'
import { createResourceApi } from './resourceApi'

const resource = (key, route = key) => createResourceApi(key, route)

export const activitiesApi = resource('activities')
export const assetsApi = resource('assets')
export const clientsApi = resource('clients')
export const communicationsApi = resource('communications')
export const dealsApi = resource('deals')
export const expensesApi = resource('expenses')
export const invoicesApi = resource('invoices')
export const leadsApi = {
  ...resource('leads'),
  convert: (id, details = {}) => apiData(`/leads/${encodeURIComponent(id)}/convert`, { method: 'POST', body: details }),
}
export const mentoringStudentsApi = resource('students')
export const milestonesApi = resource('milestones')
export const mentoringSessionsApi = {
  ...resource('mentoringSessions', 'mentoring/sessions'),
  addPayment: (payment) => apiData('/mentoring/payments', { method: 'POST', body: payment }),
}
export const paymentsApi = {
  ...resource('payments'),
  submitFromClient: (payment) => apiData('/payments/client-submissions', { method: 'POST', body: payment }),
  resubmitFromClient: (id, payment) => apiData(`/payments/${encodeURIComponent(id)}/resubmission`, { method: 'PATCH', body: payment }),
  verify: (id, review) => apiData(`/payments/${encodeURIComponent(id)}/verification`, { method: 'PATCH', body: review }),
  approveCash: (id) => apiData(`/payments/${encodeURIComponent(id)}/cash-approval`, { method: 'PATCH', body: {} }),
  createDispute: (id, dispute) => apiData(`/payments/${encodeURIComponent(id)}/disputes`, { method: 'POST', body: dispute }),
  reviewDispute: (id, disputeId, review) => apiData(`/payments/${encodeURIComponent(id)}/disputes/${encodeURIComponent(disputeId)}`, { method: 'PATCH', body: review }),
}
export const financeApi = {
  getPaymentAccounts: () => apiData('/finance/payment-accounts'),
  createPaymentAccount: (account) => apiData('/finance/payment-accounts', { method: 'POST', body: account }),
  updatePaymentAccount: (id, changes) => apiData(`/finance/payment-accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  getDistributions: (query = {}) => apiData(`/finance/distributions?${new URLSearchParams(query)}`),
  getDistributionSummary: (query = {}) => apiData(`/finance/distributions/summary?${new URLSearchParams(query)}`),
  updateDistributionRules: (projectId, rules) => apiData(`/finance/projects/${encodeURIComponent(projectId)}/distribution-rules`, { method: 'PUT', body: rules }),
  finalizeProjectDistribution: (projectId) => apiData(`/finance/projects/${encodeURIComponent(projectId)}/distribution`, { method: 'POST', body: {} }),
  updateDistribution: (id, changes) => apiData(`/finance/distributions/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  reverseDistribution: (id, reason) => apiData(`/finance/distributions/${encodeURIComponent(id)}/reversal`, { method: 'POST', body: { reason } }),
  getFounderTransfers: (query = {}) => apiData(`/finance/founder-transfers?${new URLSearchParams(query)}`),
  createFounderTransfer: (transfer) => apiData('/finance/founder-transfers', { method: 'POST', body: transfer }),
  reverseFounderTransfer: (id, reason) => apiData(`/finance/founder-transfers/${encodeURIComponent(id)}/reversal`, { method: 'POST', body: { reason } }),
  getCompanyTransactions: (query = {}) => apiData(`/finance/company-transactions?${new URLSearchParams(query)}`),
  createCompanyTransaction: (transaction) => apiData('/finance/company-transactions', { method: 'POST', body: transaction }),
  getAudit: (query = {}) => apiData(`/finance/audit?${new URLSearchParams(query)}`),
}
export const productsApi = resource('products')
export const projectRequestsApi = {
  ...resource('projectRequests', 'project-requests'),
  review: (id, changes) => apiData(`/project-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  convert: (id, agreedAmount) => apiData(`/project-requests/${encodeURIComponent(id)}/convert`, { method: 'POST', body: { agreedAmount } }),
}
export const projectsApi = resource('projects')
export const revisionsApi = resource('revisions')
export const servicesApi = resource('services')
export const tasksApi = resource('tasks')
export const usersApi = resource('users')
export const teamMembersApi = {
  getAll: () => apiData('/team-members'),
}

export const contentApi = resource('content', 'content/projects')

export const targetsApi = {
  getTargets: () => listAll('/targets'),
  create: (target) => apiData('/targets', { method: 'POST', body: target }),
  update: (id, changes) => apiData(`/targets/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
}

export const conversationsApi = {
  getAll: () => apiData('/conversations'),
  create: (conversation) => apiData('/conversations', { method: 'POST', body: conversation }),
  getMessages: (id) => apiData(`/conversations/${encodeURIComponent(id)}/messages?limit=100`),
}

export const messagesApi = {
  send: (message) => apiData('/messages', { method: 'POST', body: message }),
  markRead: (id) => apiData(`/messages/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} }),
}

export const notificationsApi = {
  getAll: () => apiData('/notifications'),
  markRead: (id) => apiData(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} }),
  markAllRead: () => apiData('/notifications/read-all', { method: 'PATCH', body: {} }),
}

export const filesApi = {
  getAll: (query) => listAll('/files', query),
  getById: (id) => apiData(`/files/${encodeURIComponent(id)}`),
  upload: async (files, association = {}) => {
    const body = new FormData()
    for (const file of files) body.append('files', file)
    for (const [key, value] of Object.entries(association)) {
      if (value !== undefined && value !== null && value !== '') body.append(key, String(value))
    }
    return apiData('/files/upload', { method: 'POST', body })
  },
  createLink: (link) => apiData('/files/links', { method: 'POST', body: link }),
  update: (id, changes) => apiData(`/files/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  remove: (id) => apiData(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const dashboardApi = {
  getSummary: () => apiData('/dashboard/summary'),
  getClientSummary: () => apiData('/dashboard/client'),
  getRevenue: (query = {}) => apiData(`/dashboard/revenue?${new URLSearchParams(query)}`),
  getServiceAnalytics: () => apiData('/dashboard/services'),
  getProjectAnalytics: () => apiData('/dashboard/projects'),
  getAcquisitionAnalytics: () => apiData('/analytics/acquisition'),
}

export const analyticsApi = dashboardApi

export const resourceApis = {
  activities: activitiesApi,
  assets: assetsApi,
  clients: clientsApi,
  communications: communicationsApi,
  content: contentApi,
  deals: dealsApi,
  expenses: expensesApi,
  invoices: invoicesApi,
  leads: leadsApi,
  mentoringSessions: mentoringSessionsApi,
  milestones: milestonesApi,
  notifications: notificationsApi,
  payments: paymentsApi,
  products: productsApi,
  projectRequests: projectRequestsApi,
  projects: projectsApi,
  revisions: revisionsApi,
  services: servicesApi,
  students: mentoringStudentsApi,
  tasks: tasksApi,
  targets: targetsApi,
  users: usersApi,
}
