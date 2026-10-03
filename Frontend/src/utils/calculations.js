export const paymentValue = (payment) => payment.type === 'Refund' || payment.status === 'Refunded'
  ? -Math.abs(Number(payment.amount || 0))
  : Number(payment.amount || 0)

export const clientProjects = (data, clientId) => data.projects.filter((project) => project.clientId === clientId)

export const projectPayments = (data, project) => data.payments.filter((payment) =>
  payment.projectId === project.id || (project.dealId && payment.dealId === project.dealId))

export const projectPaid = (data, project) => {
  const entries = projectPayments(data, project)
  return entries.length
    ? Math.max(0, entries.reduce((sum, payment) => sum + paymentValue(payment), 0))
    : Math.max(0, Number(project.paidAmount || 0))
}

export const projectOutstanding = (data, project) => Math.max(0, Number(project.agreedAmount || 0) - projectPaid(data, project))
export const outstanding = (project) => Math.max(0, Number(project.agreedAmount || 0) - Number(project.paidAmount || 0))
export const dealPayments = (data, deal) => data.payments.filter((payment) =>
  payment.dealId === deal.id || (deal.projectId && payment.projectId === deal.projectId))

export const dealPaid = (data, deal) => {
  const entries = dealPayments(data, deal)
  return entries.length ? Math.max(0, entries.reduce((sum, payment) => sum + paymentValue(payment), 0)) : Math.max(0, Number(deal.paidAmount || 0))
}

export const dealBalance = (data, deal) => Math.max(0, Number(deal.agreedAmount || deal.quotedAmount || 0) - dealPaid(data, deal))
export const clientPaid = (data, clientId) => data.payments.filter((payment) => payment.clientId === clientId).reduce((sum, payment) => sum + paymentValue(payment), 0)
export const clientOutstanding = (data, clientId) => {
  const projects = clientProjects(data, clientId)
  const linkedDeals = new Set(projects.map((project) => project.dealId).filter(Boolean))
  return projects.reduce((sum, project) => sum + projectOutstanding(data, project), 0)
    + data.deals.filter((deal) => deal.clientId === clientId && !deal.projectId && !linkedDeals.has(deal.id)).reduce((sum, deal) => sum + dealBalance(data, deal), 0)
}

export const invoicePaid = (data, invoice) => {
  const directlyLinked = data.payments.filter((payment) => payment.invoiceId === invoice.id || payment.invoiceId === invoice.invoiceNumber)
  if (directlyLinked.length) return Math.max(0, directlyLinked.reduce((sum, payment) => sum + paymentValue(payment), 0))
  const siblingInvoices = data.invoices.filter((item) => (invoice.projectId && item.projectId === invoice.projectId) || (invoice.dealId && item.dealId === invoice.dealId))
  if (siblingInvoices.length > 1) return 0
  return Math.max(0, data.payments.filter((payment) => (invoice.projectId && payment.projectId === invoice.projectId) || (invoice.dealId && payment.dealId === invoice.dealId)).reduce((sum, payment) => sum + paymentValue(payment), 0))
}

export const invoiceStatus = (data, invoice) => {
  const paid = invoicePaid(data, invoice)
  if (paid >= Number(invoice.amount || 0) && Number(invoice.amount || 0) > 0) return 'Fully Paid'
  if (paid > 0) return 'Partially Paid'
  if (invoice.dueDate && invoice.dueDate < new Date().toISOString().slice(0, 10)) return 'Overdue'
  return invoice.paymentStatus === 'Not Paid' ? 'Not Paid' : 'Payment Pending'
}

export const paymentServiceId = (data, payment) => {
  if (payment.serviceId) return payment.serviceId
  const project = data.projects.find((item) => item.id === payment.projectId)
  if (project) return project.serviceId
  return data.deals.find((item) => item.id === payment.dealId)?.serviceId
}

export const serviceStats = (data, serviceId) => {
  const serviceProjects = data.projects.filter((project) => project.serviceId === serviceId)
  const revenue = data.payments.filter((payment) => paymentServiceId(data, payment) === serviceId).reduce((sum, payment) => sum + paymentValue(payment), 0)
  return {
    projects: serviceProjects.length,
    clients: new Set([
      ...data.clients.filter((client) => client.serviceId === serviceId).map((client) => client.id),
      ...serviceProjects.map((project) => project.clientId),
      ...data.deals.filter((deal) => deal.serviceId === serviceId).map((deal) => deal.clientId),
    ].filter(Boolean)).size,
    revenue,
    pending: serviceProjects.reduce((sum, project) => sum + projectOutstanding(data, project), 0)
      + data.deals.filter((deal) => deal.serviceId === serviceId && !deal.projectId).reduce((sum, deal) => sum + dealBalance(data, deal), 0),
    completed: serviceProjects.filter((project) => project.status === 'Completed').length,
    active: serviceProjects.filter((project) => !['Completed', 'Cancelled'].includes(project.status)).length,
    leads: data.leads.filter((lead) => lead.serviceId === serviceId).length,
    deals: data.deals.filter((deal) => deal.serviceId === serviceId).length,
    average: serviceProjects.length ? Math.round(serviceProjects.reduce((sum, project) => sum + Number(project.agreedAmount || 0), 0) / serviceProjects.length) : 0,
  }
}

export const targetMonthPrefix = (data) => {
  const targetDate = new Date(`${data.targets?.month || 'October 2026'} 1`)
  if (Number.isNaN(targetDate.getTime())) return new Date().toISOString().slice(0, 7)
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
}

const isActiveClient = (client) => !['Lead', 'Lost', 'Inactive', 'Archived'].includes(client.status)

export const dashboardStats = (data) => {
  const revenue = data.payments.reduce((sum, payment) => sum + paymentValue(payment), 0)
  const linkedDealIds = new Set(data.projects.map((project) => project.dealId).filter(Boolean))
  const dealOnlyBalance = data.deals.filter((deal) => !deal.projectId && !linkedDealIds.has(deal.id)).reduce((sum, deal) => sum + dealBalance(data, deal), 0)
  const pending = data.projects.reduce((sum, project) => sum + projectOutstanding(data, project), 0) + dealOnlyBalance
  const month = targetMonthPrefix(data)
  const monthRevenue = data.payments.filter((payment) => payment.date?.startsWith(month)).reduce((sum, payment) => sum + paymentValue(payment), 0)
  const converted = data.leads.filter((lead) => lead.status === 'Converted').length
  const activeProjects = data.projects.filter((project) => !['Completed', 'Cancelled'].includes(project.status)).length
  const uniqueProjectDealCount = data.deals.length + data.projects.filter((project) => !project.dealId || !data.deals.some((deal) => deal.id === project.dealId)).length
  const bookedRevenue = data.projects.filter((project) => project.status !== 'Cancelled').reduce((sum, project) => sum + Number(project.agreedAmount || 0), 0)
    + data.deals.filter((deal) => !deal.projectId && !linkedDealIds.has(deal.id) && ['Accepted', 'In Progress', 'Completed'].includes(deal.status))
      .reduce((sum, deal) => sum + Number(deal.agreedAmount || deal.quotedAmount || 0), 0)
  return {
    revenue,
    totalPaid: revenue,
    bookedRevenue,
    pending,
    totalDealValue: data.deals.reduce((sum, deal) => sum + Number(deal.agreedAmount || deal.quotedAmount || 0), 0),
    clients: data.clients.length,
    activeClients: data.clients.filter(isActiveClient).length,
    newLeads: data.leads.filter((lead) => !['Converted', 'Lost'].includes(lead.status)).length,
    activeProjects,
    projectCount: data.projects.length,
    completed: data.projects.filter((project) => project.status === 'Completed').length,
    deals: uniqueProjectDealCount,
    acceptedDeals: data.deals.filter((deal) => deal.status === 'Accepted').length,
    monthRevenue,
    conversion: data.leads.length ? Math.round(converted / data.leads.length * 100) : 0,
  }
}

export const servicePerformance = (data) => data.services.map((service) => ({
  service,
  ...serviceStats(data, service.id),
}))

export const revenueWindow = (data, days = 5, endDate = new Date()) => {
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - days + index + 1)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      date: iso,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: data.payments.filter((payment) => payment.date === iso).reduce((sum, payment) => sum + paymentValue(payment), 0),
    }
  })
}

export const revenueByService = (data) => servicePerformance(data)
  .map(({ service, revenue, clients, projects }) => ({ id: service.id, name: service.shortName || service.name, revenue, clients, projects }))
  .filter((item) => item.revenue !== 0 || item.projects || item.clients)

export const projectStatusCounts = (data) => {
  const statuses = ['Planning', 'Requirement Gathering', 'Design', 'Development', 'In Progress', 'Review', 'Client Review', 'Revision', 'Revision Requested', 'Approved', 'Deployment', 'Delivered', 'Completed', 'On Hold', 'Paused', 'Cancelled']
  const encountered = [...new Set(data.projects.map((project) => project.status).filter(Boolean))]
  return [...new Set([...statuses, ...encountered])].map((status) => ({
    status,
    count: data.projects.filter((project) => project.status === status).length,
  })).filter((item) => item.count > 0)
}

export const dealFunnel = (data) => {
  const stages = [
    ['Lead', ['New', 'Lead']],
    ['Contacted', ['Contacted']],
    ['Discussion', ['Discussion', 'Interested', 'Requirement Gathering']],
    ['Proposal', ['Proposal Sent']],
    ['Negotiation', ['Negotiation']],
    ['Accepted', ['Accepted']],
  ]
  return stages.map(([stage, values]) => ({
    stage,
    count: data.deals.filter((deal) => values.includes(deal.status)).length
      + (stage === 'Lead' ? data.leads.filter((lead) => ['New', 'Contacted'].includes(lead.status) && !data.deals.some((deal) => deal.leadId === lead.id)).length : 0),
  })).concat([{ stage: 'Project', count: data.projects.length }])
}

export const paymentStatusCounts = (data) => {
  const linkedDealIds = new Set(data.projects.map((project) => project.dealId).filter(Boolean))
  const contracts = [
    ...data.projects.map((project) => ({
      amount: Number(project.agreedAmount || 0),
      paid: projectPaid(data, project),
      paymentStatus: data.deals.find((deal) => deal.id === project.dealId)?.paymentStatus,
    })),
    ...data.deals.filter((deal) => !deal.projectId && !linkedDealIds.has(deal.id)).map((deal) => ({
      amount: Number(deal.agreedAmount || deal.quotedAmount || 0),
      paid: dealPaid(data, deal),
      paymentStatus: deal.paymentStatus,
    })),
  ]
  const statusFor = ({ amount, paid, paymentStatus }) => {
    if (amount > 0 && paid >= amount) return 'Fully Paid'
    if (paid > 0) return 'Partially Paid'
    return ['Not Paid', 'Unpaid'].includes(paymentStatus) ? 'Not Paid' : 'Payment Pending'
  }
  return ['Fully Paid', 'Partially Paid', 'Payment Pending', 'Not Paid'].map((status) => ({
    status,
    count: contracts.filter((contract) => statusFor(contract) === status).length,
  }))
}

export const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
