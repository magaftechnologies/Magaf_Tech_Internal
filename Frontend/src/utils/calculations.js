import { getServiceCapabilities } from '../services/serviceRegistry'

export const paymentValue = (payment) => payment.type === 'Refund' || payment.status === 'Refunded'
  ? -Math.abs(Number(payment.amount || 0))
  : Number(payment.amount || 0)
//
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
  const student = data.students.find((item) => item.id === payment.studentId)
  if (student) return student.serviceId || 'mentoring'
  const project = data.projects.find((item) => item.id === payment.projectId)
  if (project) return project.serviceId
  return data.deals.find((item) => item.id === payment.dealId)?.serviceId
}

export const studentPaid = (data, student) => {
  const entries=data.payments.filter((payment)=>payment.studentId===student.id)
  return Math.max(0,entries.length?entries.reduce((sum,payment)=>sum+paymentValue(payment),0):Number(student.paidAmount||0))
}

export const studentBalance = (data, student) => Math.max(0,Number(student.agreedAmount||0)-studentPaid(data,student))

export const serviceStats = (data, serviceId) => {
  const capabilities=getServiceCapabilities(serviceId)
  const serviceProjects = data.projects.filter((project) => project.serviceId === serviceId)
  const revenue = data.payments.filter((payment) => paymentServiceId(data, payment) === serviceId).reduce((sum, payment) => sum + paymentValue(payment), 0)
  if(capabilities.supportsStudents){
    const students=data.students.filter((student)=>(student.serviceId||'mentoring')===serviceId)
    const requests=data.projectRequests.filter((request)=>request.serviceId===serviceId)
    return {
      clients:0,students:students.length,projects:0,requests:requests.length,revenue,
      pending:students.reduce((sum,student)=>sum+studentBalance(data,student),0),
      completed:students.filter((student)=>student.status==='Completed').length,
      active:students.filter((student)=>student.status==='Active').length,
      leads:data.leads.filter((lead)=>lead.serviceId===serviceId).length,
      deals:data.deals.filter((deal)=>deal.serviceId===serviceId).length,
      average:students.length?Math.round(students.reduce((sum,student)=>sum+Number(student.agreedAmount||0),0)/students.length):0,
    }
  }
  return {
    projects: serviceProjects.length,
    students:0,
    requests:data.projectRequests.filter((request)=>request.serviceId===serviceId).length,
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
  const countedProjects=data.projects.filter((project)=>getServiceCapabilities(project.serviceId).supportsProjects)
  const students=data.students.filter((student)=>(student.serviceId||'mentoring')==='mentoring')
  const mentoringRevenue=data.payments.filter((payment)=>paymentServiceId(data,payment)==='mentoring').reduce((sum,payment)=>sum+paymentValue(payment),0)
  const linkedDealIds = new Set(data.projects.map((project) => project.dealId).filter(Boolean))
  const dealOnlyBalance = data.deals.filter((deal) => getServiceCapabilities(deal.serviceId).supportsProjects && !deal.projectId && !linkedDealIds.has(deal.id)).reduce((sum, deal) => sum + dealBalance(data, deal), 0)
  const pending = data.projects.filter((project)=>getServiceCapabilities(project.serviceId).supportsProjects).reduce((sum, project) => sum + projectOutstanding(data, project), 0) + dealOnlyBalance + students.reduce((sum,student)=>sum+studentBalance(data,student),0)
  const month = targetMonthPrefix(data)
  const monthRevenue = data.payments.filter((payment) => payment.date?.startsWith(month)).reduce((sum, payment) => sum + paymentValue(payment), 0)
  const converted = data.leads.filter((lead) => lead.status === 'Converted').length
  const activeProjects = countedProjects.filter((project) => !['Completed', 'Cancelled'].includes(project.status)).length
  const countableDeals=data.deals.filter((deal)=>getServiceCapabilities(deal.serviceId).supportsProjects)
  const uniqueProjectDealCount = countableDeals.length + countedProjects.filter((project) => !project.dealId || !data.deals.some((deal) => deal.id === project.dealId)).length
  const bookedRevenue = countedProjects.filter((project) => project.status !== 'Cancelled').reduce((sum, project) => sum + Number(project.agreedAmount || 0), 0)
    + data.deals.filter((deal) => getServiceCapabilities(deal.serviceId).supportsProjects && !deal.projectId && !linkedDealIds.has(deal.id) && ['Accepted', 'In Progress', 'Completed'].includes(deal.status))
      .reduce((sum, deal) => sum + Number(deal.agreedAmount || deal.quotedAmount || 0), 0)
    + students.reduce((sum,student)=>sum+Number(student.agreedAmount||0),0)
  const requests=data.projectRequests||[]
  return {
    revenue,
    totalPaid: revenue,
    bookedRevenue,
    pending,
    totalDealValue: countableDeals.reduce((sum, deal) => sum + Number(deal.agreedAmount || deal.quotedAmount || 0), 0)+students.reduce((sum,student)=>sum+Number(student.agreedAmount||0),0),
    clients: data.clients.length,
    activeClients: data.clients.filter(isActiveClient).length,
    newLeads: data.leads.filter((lead) => !['Converted', 'Lost'].includes(lead.status)).length,
    activeProjects,
    projectCount: countedProjects.length,
    completed: countedProjects.filter((project) => project.status === 'Completed').length,
    deals: uniqueProjectDealCount,
    acceptedDeals: countableDeals.filter((deal) => deal.status === 'Accepted').length,
    monthRevenue,
    conversion: data.leads.length ? Math.round(converted / data.leads.length * 100) : 0,
    students:students.length,
    activeStudents:students.filter((student)=>student.status==='Active').length,
    completedStudents:students.filter((student)=>student.status==='Completed').length,
    mentoringRevenue,
    totalRequests:requests.length,
    newRequests:requests.filter((request)=>['Submitted','Under Review','Need More Information'].includes(request.status)).length,
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
  .map(({ service, revenue, clients, projects, students }) => ({ id: service.id, name: service.shortName || service.name, revenue, clients, projects, students }))
  .filter((item) => item.revenue !== 0 || item.projects || item.clients || item.students)

export const projectStatusCounts = (data) => {
  const statuses = ['Draft','Proposal','Awaiting Client','Deal Accepted','Payment Pending','Planning','Requirement Gathering','Design','Development','In Progress','Review','Client Review','Revision','Revision Requested','Approved','Ready for Delivery','Deployment','Delivered','Completed','On Hold','Paused','Cancelled']
  const projects=data.projects.filter((project)=>getServiceCapabilities(project.serviceId).supportsProjects)
  const encountered = [...new Set(projects.map((project) => project.status).filter(Boolean))]
  return [...new Set([...statuses, ...encountered])].map((status) => ({
    status,
    count: projects.filter((project) => project.status === status).length,
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
    count: data.deals.filter((deal) => getServiceCapabilities(deal.serviceId).supportsProjects && values.includes(deal.status)).length
      + (stage === 'Lead' ? data.leads.filter((lead) => ['New', 'Contacted'].includes(lead.status) && !data.deals.some((deal) => deal.leadId === lead.id)).length : 0),
  })).concat([{ stage: 'Project', count: data.projects.filter((project)=>getServiceCapabilities(project.serviceId).supportsProjects).length }])
}

export const paymentStatusCounts = (data) => {
  const linkedDealIds = new Set(data.projects.map((project) => project.dealId).filter(Boolean))
  const contracts = [
    ...data.projects.filter((project)=>getServiceCapabilities(project.serviceId).supportsProjects).map((project) => ({
      amount: Number(project.agreedAmount || 0),
      paid: projectPaid(data, project),
      paymentStatus: data.deals.find((deal) => deal.id === project.dealId)?.paymentStatus,
    })),
    ...data.students.map((student)=>({amount:Number(student.agreedAmount||0),paid:studentPaid(data,student)})),
    ...data.deals.filter((deal) => getServiceCapabilities(deal.serviceId).supportsProjects && !deal.projectId && !linkedDealIds.has(deal.id)).map((deal) => ({
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
