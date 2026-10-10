import { Activity, Client, Conversation, Deal, Expense, Lead, Message, Notification, Payment, Project, ProjectRequest, Service, Student } from '../../models/index.js'

const activeProjectStatuses = ['requested', 'pending_review', 'accepted', 'planning', 'in_progress', 'review', 'revision', 'on_hold']

function dateRange(query = {}) {
  const now = new Date()
  const end = query.endDate ? new Date(query.endDate) : new Date(now)
  end.setUTCHours(23, 59, 59, 999)
  let start
  if (query.startDate) start = new Date(query.startDate)
  else {
    const range = query.range || 'last30'
    start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    if (range === 'last5') start.setUTCDate(start.getUTCDate() - 4)
    else if (range === 'last7') start.setUTCDate(start.getUTCDate() - 6)
    else if (range === 'this_month') start.setUTCDate(1)
    else if (range === 'previous_month') {
      start.setUTCDate(1)
      start.setUTCMonth(start.getUTCMonth() - 1)
      end.setUTCDate(0)
      end.setUTCHours(23, 59, 59, 999)
    } else start.setUTCDate(start.getUTCDate() - 29)
  }
  start.setUTCHours(0, 0, 0, 0)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    throw Object.assign(new Error('Provide a valid date range.'), { statusCode: 400 })
  }
  return { start, end }
}

const monthKey = (date) => date.toISOString().slice(0, 7)
const dateKey = (date) => date.toISOString().slice(0, 10)

export async function dashboardSummary() {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [
    totalClients, activeClients, newClients, totalProjects, activeProjects, completedProjects,
    pendingProjects, students, activeStudents, paymentRows, outstanding, serviceBreakdown, expenseRows,
    totalLeads, newLeads, convertedLeads, dealRows, requestTotal, pendingRequests,
    projectStatusRows, monthlyRevenue, projectValue, dealValue, mentoringValue, mentoringOutstanding,
  ] = await Promise.all([
    Client.countDocuments(),
    Client.countDocuments({ status: 'active' }),
    Client.countDocuments({ createdAt: { $gte: monthStart } }),
    Project.countDocuments(),
    Project.countDocuments({ status: { $in: activeProjectStatuses } }),
    Project.countDocuments({ status: { $in: ['completed', 'delivered'] } }),
    Project.countDocuments({ status: { $in: ['requested', 'pending_review'] } }),
    Student.countDocuments(),
    Student.countDocuments({ status: 'active' }),
    Payment.aggregate([{ $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Project.aggregate([{ $group: { _id: null, total: { $sum: '$balanceAmount' } } }]),
    serviceAnalytics(),
    Expense.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Lead.countDocuments(),
    Lead.countDocuments({ status: { $nin: ['converted', 'lost'] } }),
    Lead.countDocuments({ status: 'converted' }),
    Deal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ProjectRequest.countDocuments(),
    ProjectRequest.countDocuments({ status: { $in: ['submitted', 'under_review', 'need_more_information', 'quoted'] } }),
    Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'paid', paymentDate: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Project.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$finalAmount' } } }]),
    Deal.aggregate([{ $match: { projectId: { $exists: false }, status: { $in: ['accepted', 'completed'] } } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$agreedAmount', '$quotedAmount'] } } } }]),
    Student.aggregate([{ $group: { _id: null, total: { $sum: '$agreedAmount' } } }]),
    Student.aggregate([{ $group: { _id: null, total: { $sum: { $max: [0, { $subtract: ['$agreedAmount', '$paidAmount'] }] } } } }]),
  ])
  const payments = Object.fromEntries(paymentRows.map((row) => [row._id, row]))
  const paidRevenue = payments.paid?.amount || 0
  const paidCount = payments.paid?.count || 0
  const pendingRevenue = ['pending', 'partially_paid'].reduce((sum, status) => sum + (payments[status]?.amount || 0), 0)
  const mentoringRevenue = await Payment.aggregate([
    { $match: { status: 'paid', studentId: { $exists: true } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return {
    clients: { total: totalClients, active: activeClients, newThisMonth: newClients },
    projects: { total: totalProjects, active: activeProjects, completed: completedProjects, pending: pendingProjects },
    leads: { total: totalLeads, active: newLeads, converted: convertedLeads },
    deals: { total: dealRows.reduce((sum, row) => sum + row.count, 0), accepted: dealRows.filter((row) => ['accepted', 'completed'].includes(row._id)).reduce((sum, row) => sum + row.count, 0), byStatus: dealRows.map(({ _id, count }) => ({ status: _id, count })) },
    projectRequests: { total: requestTotal, pending: pendingRequests },
    projectStatuses: projectStatusRows.map(({ _id, count }) => ({ status: _id, count })),
    mentoring: { students, activeStudents, revenue: mentoringRevenue[0]?.total || 0 },
    revenue: { total: paidRevenue, paid: paidRevenue, month: monthlyRevenue[0]?.total || 0, pending: pendingRevenue, booked: (projectValue[0]?.total || 0) + (dealValue[0]?.total || 0) + (mentoringValue[0]?.total || 0), outstanding: (outstanding[0]?.total || 0) + (mentoringOutstanding[0]?.total || 0), paidPayments: paidCount, paidExpenses: expenseRows[0]?.total || 0, netAfterExpenses: paidRevenue - (expenseRows[0]?.total || 0) },
    paymentStatuses: paymentRows.map(({ _id, amount, count }) => ({ status: _id, amount, count })),
    serviceRevenue: serviceBreakdown,
    generatedAt: now.toISOString(),
  }
}

export async function clientDashboardSummary(user) {
  const clientId = user.clientId
  const [
    projects, requests, paidPayments, pendingPayments, outstanding, activeProjects, completedProjects,
    pendingRequests, unreadMessages, unreadNotifications, recentActivity,
  ] = await Promise.all([
    Project.countDocuments({ clientId }),
    ProjectRequest.countDocuments({ clientId }),
    Payment.aggregate([{ $match: { clientId, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { clientId, status: { $in: ['pending', 'partially_paid'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Project.aggregate([{ $match: { clientId } }, { $group: { _id: null, total: { $sum: '$balanceAmount' } } }]),
    Project.countDocuments({ clientId, status: { $in: activeProjectStatuses } }),
    Project.countDocuments({ clientId, status: { $in: ['completed', 'delivered'] } }),
    ProjectRequest.countDocuments({ clientId, status: { $in: ['submitted', 'under_review', 'need_more_information', 'quoted'] } }),
    Message.countDocuments({ clientId, senderType: 'team', readReceipts: { $not: { $elemMatch: { userId: user._id } } } }),
    Notification.countDocuments({ recipient: user._id, isRead: false }),
    Activity.find({ clientId }).sort({ timestamp: -1 }).limit(8),
  ])
  const client = await Client.findById(clientId).select('name businessName')
  if (!client) throw Object.assign(new Error('Client profile not found.'), { statusCode: 404 })
  const conversationCount = await Conversation.countDocuments({ clientId, status: { $ne: 'archived' } })
  return {
    client: { id: client.id, name: client.name, businessName: client.businessName },
    projects: { total: projects, active: activeProjects, completed: completedProjects },
    requests: { total: requests, pending: pendingRequests },
    payments: {
      paid: paidPayments[0]?.total || 0,
      pending: pendingPayments[0]?.total || 0,
      outstanding: outstanding[0]?.total || 0,
    },
    conversations: { total: conversationCount, unreadMessages },
    unreadNotifications,
    recentActivity: recentActivity.map((activity) => ({
      id: activity._id.toString(),
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId?.toString(),
      description: activity.description,
      timestamp: activity.timestamp || activity.createdAt,
      projectId: activity.projectId?.toString(),
    })),
  }
}

export async function revenueTimeSeries(query = {}) {
  let rangeQuery = query
  if (['all', 'all_time'].includes(query.range) && !query.startDate && !query.endDate) {
    const firstPayment = await Payment.findOne({ status: 'paid', paymentDate: { $type: 'date' } })
      .sort({ paymentDate: 1 })
      .select('paymentDate')
      .lean()
    const start = firstPayment?.paymentDate || new Date()
    rangeQuery = {
      ...query,
      startDate: start.toISOString(),
      interval: 'month',
    }
  }
  const { start, end } = dateRange(rangeQuery)
  const monthly = rangeQuery.interval === 'month' || (end.getTime() - start.getTime()) > 90 * 86400000
  const rows = await Payment.aggregate([
    { $match: { status: 'paid', paymentDate: { $gte: start, $lte: end }, ...(query.serviceId ? { serviceId: query.serviceId } : {}) } },
    { $group: { _id: monthly ? { $dateToString: { format: '%Y-%m', date: '$paymentDate' } } : { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  const values = new Map(rows.map((row) => [row._id, row]))
  const series = []
  const cursor = new Date(start)
  if (monthly) cursor.setUTCDate(1)
  while (cursor <= end) {
    const key = monthly ? monthKey(cursor) : dateKey(cursor)
    const row = values.get(key)
    series.push({ date: key, revenue: row?.revenue || 0, payments: row?.count || 0 })
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    else cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return { startDate: start.toISOString(), endDate: end.toISOString(), interval: monthly ? 'month' : 'day', series }
}

export async function serviceAnalytics() {
  const [services, projectRows, clientRows, paymentRows, studentRows, leadRows, requestRows] = await Promise.all([
    Service.find().sort({ displayOrder: 1, name: 1 }).lean(),
    Project.aggregate([
      { $group: {
        _id: '$serviceId',
        projectCount: { $sum: 1 },
        completedProjects: { $sum: { $cond: [{ $in: ['$status', ['completed', 'delivered']] }, 1, 0] } },
        activeProjects: { $sum: { $cond: [{ $in: ['$status', activeProjectStatuses] }, 1, 0] } },
        outstanding: { $sum: '$balanceAmount' },
        clients: { $addToSet: '$clientId' },
      } },
    ]),
    Client.aggregate([{ $match: { serviceId: { $exists: true } } }, { $group: { _id: '$serviceId', clients: { $addToSet: '$_id' } } }]),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: '$serviceId', revenue: { $sum: '$amount' } } }]),
    Student.aggregate([{ $group: {
      _id: '$serviceId',
      students: { $sum: 1 },
      activeStudents: { $sum: { $cond: [{ $in: ['$status', ['enrolled', 'active']] }, 1, 0] } },
      completedStudents: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      outstanding: { $sum: { $max: [0, { $subtract: ['$agreedAmount', '$paidAmount'] }] } },
    } }]),
    Lead.aggregate([{ $group: { _id: '$serviceId', count: { $sum: 1 } } }]),
    ProjectRequest.aggregate([{ $group: { _id: '$serviceId', count: { $sum: 1 } } }]),
  ])
  const projects = new Map(projectRows.map((row) => [row._id.toString(), row]))
  const primaryClients = new Map(clientRows.map((row) => [row._id.toString(), row.clients.map((id) => id.toString())]))
  const revenues = new Map(paymentRows.filter((row) => row._id).map((row) => [row._id.toString(), row.revenue]))
  const students = new Map(studentRows.filter((row) => row._id).map((row) => [row._id.toString(), row.students]))
  const studentStats = new Map(studentRows.filter((row) => row._id).map((row) => [row._id.toString(), row]))
  const leads = new Map(leadRows.filter((row) => row._id).map((row) => [row._id.toString(), row.count]))
  const requests = new Map(requestRows.filter((row) => row._id).map((row) => [row._id.toString(), row.count]))
  const mentoring = await Payment.aggregate([{ $match: { status: 'paid', studentId: { $exists: true } } }, { $group: { _id: null, revenue: { $sum: '$amount' }, payments: { $sum: 1 } } }])
  return services.map((service) => {
    const project = projects.get(service._id.toString())
    const associatedClients = new Set([...(project?.clients || []).map((id) => id.toString()), ...(primaryClients.get(service._id.toString()) || [])])
    const result = {
      service: { id: service._id.toString(), name: service.name, slug: service.slug, category: service.category },
      revenue: revenues.get(service._id.toString()) || 0,
      projectCount: project?.projectCount || 0,
      completedProjects: project?.completedProjects || 0,
      activeProjects: project?.activeProjects || 0,
      outstanding: project?.outstanding || 0,
      clientCount: associatedClients.size,
      studentCount: students.get(service._id.toString()) || 0,
      activeStudentCount: studentStats.get(service._id.toString())?.activeStudents || 0,
      completedStudentCount: studentStats.get(service._id.toString())?.completedStudents || 0,
      leadCount: leads.get(service._id.toString()) || 0,
      requestCount: requests.get(service._id.toString()) || 0,
    }
    if (service.slug === 'development-mentoring') {
      result.revenue = mentoring[0]?.revenue || result.revenue
      result.studentCount = students.get(service._id.toString()) || 0
      result.activeProjects = result.activeStudentCount
      result.completedProjects = result.completedStudentCount
      result.outstanding = studentStats.get(service._id.toString())?.outstanding || 0
    }
    return result
  })
}

export async function clientAnalytics() {
  const rows = await Project.aggregate([
    { $group: { _id: '$serviceId', clients: { $addToSet: '$clientId' }, projects: { $sum: 1 } } },
  ])
  return rows.map((row) => ({ serviceId: row._id, clientCount: row.clients.length, projectCount: row.projects }))
}

export async function acquisitionAnalytics() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
  const [clients, requests, leadSources, leadTotals] = await Promise.all([
    Client.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    ProjectRequest.aggregate([
      { $addFields: { submittedAt: { $ifNull: ['$submittedAt', '$createdAt'] } } },
      { $match: { submittedAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$submittedAt' } }, count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $group: { _id: { $ifNull: ['$source', 'Unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 6 },
    ]),
    Lead.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } } } },
    ]),
  ])
  const clientCounts = new Map(clients.map((row) => [row._id, row.count]))
  const requestCounts = new Map(requests.map((row) => [row._id, row.count]))
  const months = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const month = monthDate.toISOString().slice(0, 7)
    months.push({ month, clients: clientCounts.get(month) || 0, requests: requestCounts.get(month) || 0 })
  }
  const totals = leadTotals[0] || { total: 0, converted: 0 }
  return {
    months,
    leadSources: leadSources.map(({ _id, count }) => ({ source: _id, count })),
    leadConversion: {
      total: totals.total,
      converted: totals.converted,
      rate: totals.total ? Math.round(totals.converted / totals.total * 100) : 0,
    },
  }
}

export async function projectAnalytics() {
  return Project.aggregate([{ $group: { _id: { serviceId: '$serviceId', status: '$status' }, count: { $sum: 1 } } }, { $sort: { '_id.serviceId': 1 } }])
}

export async function revenueBreakdown(query = {}) {
  const { start, end } = query.startDate || query.endDate ? dateRange(query) : { start: new Date(0), end: new Date('9999-12-31T23:59:59.999Z') }
  const [total, byService, byClient, byProject] = await Promise.all([
    Payment.aggregate([{ $match: { status: 'paid', paymentDate: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'paid', paymentDate: { $gte: start, $lte: end } } }, { $group: { _id: '$serviceId', amount: { $sum: '$amount' } } }, { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } }, { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } }, { $project: { amount: 1, serviceId: '$_id', serviceName: '$service.name' } }]),
    Payment.aggregate([{ $match: { status: 'paid', clientId: { $exists: true }, paymentDate: { $gte: start, $lte: end } } }, { $group: { _id: '$clientId', amount: { $sum: '$amount' } } }, { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } }, { $unwind: '$client' }, { $project: { amount: 1, clientId: '$_id', clientName: '$client.name' } }]),
    Payment.aggregate([{ $match: { status: 'paid', projectId: { $exists: true }, paymentDate: { $gte: start, $lte: end } } }, { $group: { _id: '$projectId', amount: { $sum: '$amount' } } }, { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } }, { $unwind: '$project' }, { $project: { amount: 1, projectId: '$_id', projectName: '$project.projectName' } }]),
  ])
  return { totalRevenue: total[0]?.total || 0, paymentCount: total[0]?.count || 0, byService, byClient, byProject, startDate: start.toISOString(), endDate: end.toISOString() }
}

export async function currentTarget(target) {
  const start = new Date(target.startDate)
  const end = new Date(target.endDate)
  end.setUTCHours(23, 59, 59, 999)
  if (target.targetType === 'revenue') {
    const [row] = await Payment.aggregate([{ $match: { status: 'paid', paymentDate: { $gte: start, $lte: end }, ...(target.serviceId ? { serviceId: target.serviceId } : {}) } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    return row?.total || 0
  }
  const Model = target.targetType === 'clients' ? Client
    : target.targetType === 'leads' ? Lead
      : target.targetType === 'students' ? Student
        : Project
  const dateField = target.targetType === 'students' ? 'enrollmentDate'
    : target.targetType === 'projects' ? 'completionDate'
      : 'createdAt'
  const filter = { [dateField]: { $gte: start, $lte: end } }
  if (target.targetType === 'projects') filter.status = { $in: ['completed', 'delivered'] }
  if (target.serviceId && ['projects', 'students'].includes(target.targetType)) filter.serviceId = target.serviceId
  return Model.countDocuments(filter)
}
