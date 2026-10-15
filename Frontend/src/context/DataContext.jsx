import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  activitiesApi, assetsApi, clientsApi, communicationsApi, contentApi, conversationsApi,
  dashboardApi, dealsApi, expensesApi, filesApi, financeApi, invoicesApi, leadsApi, mentoringSessionsApi,
  mentoringStudentsApi, messagesApi, milestonesApi, notificationsApi, paymentsApi, productsApi,
  projectRequestsApi, projectsApi, revisionsApi, servicesApi, targetsApi, tasksApi, teamMembersApi, usersApi,
} from '../api/domain.api'
import { normalizeRecord, serializeRecord } from '../api/normalizers'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const collectionApis = {
  activities: activitiesApi,
  assets: assetsApi,
  clients: clientsApi,
  communications: communicationsApi,
  content: contentApi,
  deals: dealsApi,
  expenses: expensesApi,
  files: filesApi,
  invoices: invoicesApi,
  leads: leadsApi,
  mentoringSessions: mentoringSessionsApi,
  milestones: milestonesApi,
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

const emptyData = () => ({
  activities: [], assets: [], clients: [], communications: [], content: [], conversations: [],
  deals: [], expenses: [], files: [], invoices: [], leads: [], messages: [], messageReads: [], servicePerformance: [],
  mentoringSessions: [], milestones: [], notifications: [], payments: [], products: [],
  projectRequests: [], projects: [], revisions: [], services: [], students: [], tasks: [],
  targets: [], teamMembers: [], users: [], paymentAccounts: [], revenueDistributions: [], distributionSummary: [], founderTransfers: [], companyTransactions: [], financeAudit: [], acquisition: null, companySettings: { name: 'MAGAF Technologies', currency: 'INR', timezone: 'Asia/Kolkata' },
})

const teamRoles = new Set(['super_admin', 'admin', 'manager', 'team_member', 'sales', 'developer', 'designer', 'mentor', 'finance'])
const allowed = (role, roles) => roles.includes(role)

function relatedDeals(projects) {
  const uniqueDeals = new Map()
  for (const project of projects) {
    if (project.linkedDeal?.id) uniqueDeals.set(project.linkedDeal.id, project.linkedDeal)
  }
  return [...uniqueDeals.values()]
}

export function DataProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [revenueSeries, setRevenueSeries] = useState([])

  const refresh = useCallback(async ({ showLoading = false } = {}) => {
    if (!user) {
      setData(emptyData())
      setDashboard(null)
      setRevenueSeries([])
      setLoading(false)
      return true
    }
    if (showLoading) setLoading(true)
    setError('')
    const client = user.kind === 'CLIENT'
    const role = user.role
    const next = emptyData()
    try {
      const loads = []
      const addLoad = (key, promise) => loads.push(promise.then((records) => {
        next[key] = (Array.isArray(records) ? records : []).map((record) => normalizeRecord(key, record))
      }))

      if (client) {
        const [
          profile, projectsRaw, requestRows, paymentRows, invoiceRows, serviceRows, milestoneRows,
          revisionRows, activityRows, fileRows, conversationRows, notificationRows, paymentAccounts, summary,
        ] = await Promise.all([
          clientsApi.getById(user.clientId),
          projectsApi.getAll(),
          projectRequestsApi.getAll(),
          paymentsApi.getAll(),
          invoicesApi.getAll(),
          servicesApi.getAll(),
          milestonesApi.getAll(),
          revisionsApi.getAll(),
          activitiesApi.getAll(),
          filesApi.getAll(),
          conversationsApi.getAll(),
          notificationsApi.getAll(),
          financeApi.getPaymentAccounts(),
          dashboardApi.getClientSummary(),
        ])
        next.clients = [normalizeRecord('clients', profile)]
        next.projects = projectsRaw.map((record) => normalizeRecord('projects', record))
        next.projectRequests = requestRows.map((record) => normalizeRecord('projectRequests', record))
        next.payments = paymentRows.map((record) => normalizeRecord('payments', record))
        next.invoices = invoiceRows.map((record) => normalizeRecord('invoices', record))
        next.paymentAccounts = paymentAccounts
        next.services = serviceRows.map((record) => normalizeRecord('services', record))
        next.milestones = milestoneRows.map((record) => normalizeRecord('milestones', record))
        next.revisions = revisionRows.map((record) => normalizeRecord('revisions', record))
        next.activities = activityRows.map((record) => normalizeRecord('activities', record))
        next.files = fileRows.map((record) => normalizeRecord('files', record))
        next.conversations = conversationRows.map((record) => normalizeRecord('conversations', record))
        next.notifications = notificationRows.map((record) => {
          const normalized = normalizeRecord('notifications', record)
          return { ...normalized, readBy: normalized.read ? [{ userId: user.id }] : [] }
        })
        next.messages = (await Promise.all(conversationRows.map((conversation) => conversationsApi.getMessages(conversation.id || conversation._id)))).flat().map((record) => normalizeRecord('messages', record))
        next.deals = relatedDeals(next.projects)
        setDashboard(summary)
      } else if (teamRoles.has(role)) {
        const basic = ['clients', 'leads', 'projects', 'payments', 'projectRequests', 'services', 'activities', 'files']
        for (const key of basic) addLoad(key, collectionApis[key].getAll())
        addLoad('teamMembers', teamMembersApi.getAll())

        if (allowed(role, ['super_admin', 'admin', 'manager', 'sales', 'finance'])) addLoad('deals', dealsApi.getAll())
        if (allowed(role, ['super_admin', 'admin', 'manager', 'finance'])) {
          addLoad('invoices', invoicesApi.getAll())
          addLoad('expenses', expensesApi.getAll())
          addLoad('targets', targetsApi.getTargets())
        }
        if (allowed(role, ['super_admin', 'admin'])) addLoad('users', usersApi.getAll())
        if (allowed(role, ['super_admin', 'admin', 'manager', 'mentor', 'finance'])) {
          addLoad('students', mentoringStudentsApi.getAll())
          if (allowed(role, ['super_admin', 'admin', 'manager', 'mentor'])) addLoad('mentoringSessions', mentoringSessionsApi.getAll())
        }
        if (allowed(role, ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer', 'mentor'])) addLoad('tasks', tasksApi.getAll())
        if (allowed(role, ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer'])) {
          addLoad('assets', assetsApi.getAll())
          addLoad('content', contentApi.getAll())
          addLoad('milestones', milestonesApi.getAll())
          addLoad('revisions', revisionsApi.getAll())
        }
        if (allowed(role, ['super_admin', 'admin', 'manager', 'team_member'])) addLoad('products', productsApi.getAll())
        if (allowed(role, ['super_admin', 'admin', 'manager', 'sales', 'team_member'])) addLoad('communications', communicationsApi.getAll())
        const [summary, conversations, notifications, serviceRows, acquisition, paymentAccounts, revenueDistributions, distributionSummary, founderTransfers, companyTransactions, financeAudit] = await Promise.all([
          dashboardApi.getSummary(),
          conversationsApi.getAll(),
          notificationsApi.getAll(),
          dashboardApi.getServiceAnalytics(),
          dashboardApi.getAcquisitionAnalytics(),
          allowed(role, ['super_admin', 'admin', 'manager', 'finance']) ? financeApi.getPaymentAccounts() : Promise.resolve([]),
          allowed(role, ['super_admin', 'admin', 'manager', 'finance']) ? financeApi.getDistributions({ limit: 500 }) : Promise.resolve([]),
          allowed(role, ['super_admin', 'admin', 'manager', 'finance']) ? financeApi.getDistributionSummary() : Promise.resolve([]),
          allowed(role, ['super_admin', 'admin', 'manager', 'finance']) ? financeApi.getFounderTransfers({ limit: 500 }) : Promise.resolve([]),
          allowed(role, ['super_admin', 'admin', 'manager', 'finance']) ? financeApi.getCompanyTransactions({ limit: 500 }) : Promise.resolve([]),
          allowed(role, ['super_admin', 'admin']) ? financeApi.getAudit() : Promise.resolve([]),
        ])
        await Promise.all(loads)
        next.acquisition = acquisition
        next.paymentAccounts = paymentAccounts
        next.revenueDistributions = revenueDistributions
        next.distributionSummary = distributionSummary
        next.founderTransfers = founderTransfers.map((record) => normalizeRecord('founderTransfers', record))
        next.companyTransactions = companyTransactions
        next.financeAudit = financeAudit
        next.notifications = notifications.map((record) => normalizeRecord('notifications', record))
        next.notifications = next.notifications.map((notification) => ({
          ...notification,
          readBy: notification.read ? [{ userId: user.id }] : [],
        }))
        next.conversations = conversations.map((record) => normalizeRecord('conversations', record))
        next.messages = (await Promise.all(conversations.map((conversation) => conversationsApi.getMessages(conversation.id || conversation._id)))).flat().map((record) => normalizeRecord('messages', record))
        next.deals = [...next.deals, ...relatedDeals(next.projects).filter((deal) => !next.deals.some((existing) => existing.id === deal.id))]
        next.servicePerformance = serviceRows.map((row) => ({
          service: next.services.find((service) => service.id === row.service.id) || normalizeRecord('services', row.service),
          clients: row.clientCount || 0,
          students: row.studentCount || 0,
          projects: row.projectCount || 0,
          revenue: row.revenue || 0,
          active: row.activeProjects || 0,
          completed: row.completedProjects || 0,
          pending: row.outstanding || 0,
          leads: row.leadCount || 0,
          requests: row.requestCount || 0,
        }))
        next.dashboardSummary = summary
        setDashboard(summary)
      }

      setData(next)
      return true
    } catch (loadError) {
      setError(loadError.message || 'Unable to load workspace data. Please try again.')
      return false
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [user])

  const loadRevenue = useCallback(async (range = 'last5') => {
    try {
      const result = await dashboardApi.getRevenue({ range })
      setRevenueSeries(result.series || [])
    } catch (revenueError) {
      setError(revenueError.message || 'Unable to load revenue analytics.')
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    const refreshTimer = window.setTimeout(() => {
      void refresh({ showLoading: Boolean(user) })
    }, 0)
    return () => window.clearTimeout(refreshTimer)
  }, [authLoading, user, refresh])

  const mutate = async (operation, collection, { throwOnError = false } = {}) => {
    setError('')
    try {
      const result = await operation()
      await refresh()
      return result ? normalizeRecord(collection, result) : result
    } catch (mutationError) {
      setError(mutationError.message || 'The change could not be saved. Please try again.')
      if (throwOnError) throw mutationError
      return null
    }
  }

  const create = (collection, item) => {
    if (collection === 'files') return addFile(item)
    if (collection === 'payments' && item.studentId) {
      return mutate(() => mentoringSessionsApi.addPayment(serializeRecord('payments', item, data)), 'payments')
    }
    const api = collectionApis[collection]
    if (!api?.create) {
      setError(`Creating ${collection} is not available through the backend.`)
      return Promise.resolve(null)
    }
    return mutate(() => api.create(serializeRecord(collection, item, data)), collection)
  }

  const patch = (collection, recordId, changes) => {
    const api = collectionApis[collection]
    if (!api?.update) {
      setError(`Updating ${collection} is not available through the backend.`)
      return Promise.resolve(null)
    }
    return mutate(() => api.update(recordId, serializeRecord(collection, changes, data)), collection)
  }

  const update = (collection, changes) => {
    if (collection !== 'targets' || !Array.isArray(data.targets)) {
      setError('This workspace setting is managed by the backend.')
      return Promise.resolve(null)
    }
    return Promise.all(data.targets.map((target) => {
      const targetValue = changes[target.targetType]
      return targetValue === undefined ? null : targetsApi.update(target.id, { targetValue: Number(targetValue) })
    })).then(() => refresh()).catch((updateError) => {
      setError(updateError.message || 'Targets could not be updated.')
      return null
    })
  }

  const saveTargets = async (values) => {
    const now = new Date()
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
    const monthKey = startDate.slice(0, 7)
    const targetTypes = ['clients', 'leads', 'revenue', 'projects', 'students']
    const activeTargets = data.targets.filter((target) => target.period === 'monthly'
      && target.status === 'Active'
      && target.startDate?.slice(0, 7) === monthKey)
    setError('')
    try {
      await Promise.all(targetTypes.map((targetType) => {
        const target = activeTargets.find((item) => item.targetType === targetType)
        const targetValue = Number(values[targetType] || 0)
        if (target) return targetsApi.update(target.id, { targetValue })
        if (!targetValue) return Promise.resolve(null)
        return targetsApi.create({ targetType, period: 'monthly', targetValue, startDate, endDate, status: 'active' })
      }))
      await refresh()
      return true
    } catch (targetError) {
      setError(targetError.message || 'Targets could not be saved.')
      return false
    }
  }

  const addFile = async (item, options) => {
    const rawFile = item.rawFile || item.file
    const association = {
      clientId: item.clientId,
      projectId: item.projectId,
      projectRequestId: item.projectRequestId || item.requestId,
      category: ({
        input: 'input', image: 'input', reference: 'reference', video: 'reference', audio: 'reference', document: 'requirement', requirement: 'requirement', working: 'draft', draft: 'draft',
        revision: 'revision', output: 'final_output', final: 'final_output', payment_proof: 'payment_proof', 'payment proof': 'payment_proof', archive: 'archive',
        client_provided: 'requirement', invoice: 'invoice', contract: 'contract',
      })[String(item.category || '').toLowerCase().replaceAll(' ', '_')] || 'other',
      description: item.description,
      visibility: String(item.visibility || '').toLowerCase() === 'client' ? 'client' : 'internal',
    }
    return mutate(async () => {
      if (rawFile instanceof File) {
        const uploaded = await filesApi.upload([rawFile], association)
        return Array.isArray(uploaded) ? uploaded[0] : uploaded
      }
      if (item.url || item.externalUrl) {
        return filesApi.createLink({
          title: item.name || item.fileName || 'Shared link',
          url: item.url || item.externalUrl,
          ...association,
        })
      }
      throw new Error('Choose a file to upload or provide a secure HTTPS link.')
    }, 'files', options)
  }

  const addProject = (item) => create('projects', item)
  const addClient = (item) => create('clients', item)
  const addLead = (item) => create('leads', item)
  const addDeal = (item) => create('deals', item)
  const addPayment = (item) => create('payments', item)
  const savePaymentAccount = (item) => mutate(
    () => item.id
      ? financeApi.updatePaymentAccount(item.id, item)
      : financeApi.createPaymentAccount(item),
    'paymentAccounts',
    { throwOnError: true },
  )
  const saveDistributionRules = (projectId, rules) => mutate(
    () => financeApi.updateDistributionRules(projectId, rules),
    'projects',
    { throwOnError: true },
  )
  const finalizeProjectDistribution = (projectId) => mutate(
    () => financeApi.finalizeProjectDistribution(projectId),
    'revenueDistributions',
    { throwOnError: true },
  )
  const updateDistribution = (distributionId, changes) => mutate(
    () => financeApi.updateDistribution(distributionId, changes),
    'revenueDistributions',
    { throwOnError: true },
  )
  const reverseDistribution = (distributionId, reason) => mutate(
    () => financeApi.reverseDistribution(distributionId, reason),
    'revenueDistributions',
    { throwOnError: true },
  )
  const createFounderTransfer = (transfer) => mutate(
    () => financeApi.createFounderTransfer(transfer),
    'founderTransfers',
    { throwOnError: true },
  )
  const reverseFounderTransfer = (transferId, reason) => mutate(
    () => financeApi.reverseFounderTransfer(transferId, reason),
    'founderTransfers',
    { throwOnError: true },
  )
  const createCompanyTransaction = (transaction) => mutate(
    () => financeApi.createCompanyTransaction(transaction),
    'companyTransactions',
    { throwOnError: true },
  )
  const submitClientPayment = (item) => mutate(
    () => paymentsApi.submitFromClient(item),
    'payments',
    { throwOnError: true },
  )
  const resubmitClientPayment = (paymentId, item) => mutate(
    () => paymentsApi.resubmitFromClient(paymentId, item),
    'payments',
    { throwOnError: true },
  )
  const createPaymentDispute = (paymentId, dispute) => mutate(
    () => paymentsApi.createDispute(paymentId, dispute),
    'payments',
    { throwOnError: true },
  )
  const reviewPayment = (paymentId, review) => mutate(
    () => paymentsApi.verify(paymentId, review),
    'payments',
    { throwOnError: true },
  )
  const approveCashPayment = (paymentId) => mutate(
    () => paymentsApi.approveCash(paymentId),
    'payments',
    { throwOnError: true },
  )
  const reviewDispute = (paymentId, disputeId, review) => mutate(
    () => paymentsApi.reviewDispute(paymentId, disputeId, review),
    'payments',
    { throwOnError: true },
  )
  const addInvoice = (item) => create('invoices', item)
  const addTask = (item) => create('tasks', item)
  const addAsset = (item) => create('assets', item)
  const addCommunication = (item) => create('communications', item)
  const addStudent = (item) => create('students', item)
  const addMentoringSession = (item) => create('mentoringSessions', item)
  const addProjectRequest = (item) => mutate(
    () => collectionApis.projectRequests.create(serializeRecord('projectRequests', item, data)),
    'projectRequests',
    { throwOnError: true },
  )
  const addRevision = (item) => create('revisions', item)
  const addGeneric = (collection, item) => create(collection, item)

  const convertLead = (lead) => mutate(() => leadsApi.convert(lead.id, {}), 'clients')
  const updateDealStatus = async (dealId, status) => {
    const deal = data.deals.find((record) => record.id === dealId)
    const updated = await patch('deals', dealId, { status })
    if (!updated) return null
    return updated.linkedProject || (updated.projectId ? data.projects.find((project) => project.id === updated.projectId) : null) || deal
  }
  const reviewProjectRequest = (requestId, status, teamNotes) => mutate(
    () => projectRequestsApi.review(requestId, {
      status: String(status).toLowerCase().replaceAll(' ', '_'),
      ...(teamNotes !== undefined ? { teamNotes, informationRequested: status === 'Need More Information' ? teamNotes : undefined } : {}),
    }),
    'projectRequests',
  )
  const convertProjectRequest = (requestId, agreedAmount) => mutate(
    () => projectRequestsApi.convert(requestId, agreedAmount),
    'projects',
    { throwOnError: true },
  )

  const ensureConversation = (clientId, projectId, projectRequestId) => mutate(
    () => conversationsApi.create({ clientId, projectId: projectId || undefined, projectRequestId: projectRequestId || undefined }),
    'conversations',
  )
  const sendMessage = ({ conversationId, text, attachments = [] }) => mutate(
    () => messagesApi.send({
      conversationId,
      content: String(text || '').trim(),
      attachments: attachments.map((file) => typeof file === 'string' ? file : file.id).filter(Boolean),
      messageType: attachments.length && !String(text || '').trim() ? 'file' : 'text',
    }),
    'messages',
  )
  const markConversationRead = useCallback(async (conversationId) => {
    const unread = data.messages.filter((message) => message.conversationId === conversationId && message.senderId !== user?.id && !(message.readReceipts || []).some((receipt) => receipt.userId === user?.id))
    for (const message of unread) await messagesApi.markRead(message.id)
    if (unread.length) await refresh()
  }, [data.messages, user?.id, refresh])
  const markNotificationRead = (notificationId) => mutate(() => notificationsApi.markRead(notificationId), 'notifications')
  const markAllNotificationsRead = () => mutate(() => notificationsApi.markAllRead(), 'notifications')
  const addRequestInformation = ({ requestId, text }) => mutate(
    () => projectRequestsApi.review(requestId, { additionalNotes: text }),
    'projectRequests',
  )
  const updateClientProfile = (changes) => {
    if (!user?.clientId) return Promise.resolve(null)
    return patch('clients', user.clientId, changes)
  }
  const setDeliverableStatus = (fileId, status) => {
    const file = data.files.find((item) => item.id === fileId)
    if (!file) return Promise.resolve(null)
    const approvalStatus = ({
      approved: 'approved', final: 'final', delivered: 'final',
      'changes requested': 'changes_requested', pending: 'pending', 'pending approval': 'pending',
    })[String(status).toLowerCase()] || 'pending'
    return mutate(() => filesApi.update(fileId, { approvalStatus }), 'files')
  }
  const completeMilestone = (milestoneId) => patch('milestones', milestoneId, { status: 'completed', completionPercentage: 100 })
  const removeRecord = (collection, recordId) => {
    const api = collectionApis[collection]
    if (!api?.remove) {
      setError(`Archiving ${collection} is not available through the backend.`)
      return Promise.resolve(null)
    }
    return mutate(() => api.remove(recordId), collection)
  }

  const value = {
    data,
    dashboard,
    revenueSeries,
    loadRevenue,
    loading,
    error,
    refresh: () => refresh({ showLoading: true }),
    dismissError: () => setError(''),
    update,
    saveTargets,
    patch,
    addClient,
    addLead,
    addProject,
    addPayment,
    savePaymentAccount,
    saveDistributionRules,
    finalizeProjectDistribution,
    updateDistribution,
    reverseDistribution,
    createFounderTransfer,
    reverseFounderTransfer,
    createCompanyTransaction,
    submitClientPayment,
    resubmitClientPayment,
    createPaymentDispute,
    reviewPayment,
    approveCashPayment,
    reviewDispute,
    addTask,
    addAsset,
    addFile,
    addDeal,
    addInvoice,
    addCommunication,
    addGeneric,
    addStudent,
    addMentoringSession,
    addProjectRequest,
    addRevision,
    convertLead,
    updateDealStatus,
    reviewProjectRequest,
    convertProjectRequest,
    ensureConversation,
    sendMessage,
    markConversationRead,
    markNotificationRead,
    markAllNotificationsRead,
    addRequestInformation,
    updateClientProfile,
    setDeliverableStatus,
    completeMilestone,
    removeRecord,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => useContext(DataContext)
