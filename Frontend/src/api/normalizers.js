const idOf = (value) => value && typeof value === 'object' ? value.id || value._id?.toString() : value
const nameOf = (value) => value && typeof value === 'object' ? value.name : value
const statusLabels = {
  converted_to_project: 'Converted to Project',
  need_more_information: 'Need More Information',
  partially_paid: 'Partially Paid',
  pending_review: 'Awaiting Client',
}
const textStatus = (value) => statusLabels[String(value || '').toLowerCase()] || String(value || '').split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
const enumStatus = (value) => String(value || '').trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_')

const serviceNames = {
  'software-development': ['software', 'Software Development'],
  'business-automation': ['automation', 'Automation & AI'],
  'advertising-creative': ['creative', 'Advertising & Creative'],
  'content-creation': ['content', 'Content Creation'],
  'digital-invitations': ['events', 'Digital Invitations'],
  'development-mentoring': ['mentoring', 'Development Mentoring'],
  'magaf-products': ['products', 'MAGAF Products'],
}

const statusAliases = {
  projects: { proposal: 'planning', awaiting_client: 'pending_review', deal_accepted: 'accepted', payment_pending: 'planning', requirement_gathering: 'planning', design: 'in_progress', development: 'in_progress', testing: 'review', client_review: 'review', approved: 'review', ready_for_delivery: 'review', deployment: 'in_progress', paused: 'on_hold', revision_requested: 'revision' },
  requests: { 'converted_to_project': 'converted_to_project' },
  clients: { returning: 'active', active_client: 'active', qualified: 'discussion', converted: 'active', archived: 'inactive' },
  leads: { meeting_scheduled: 'contacted', follow_up: 'contacted' },
  deals: { lead: 'new', discussion: 'contacted', requirement_gathering: 'contacted', in_progress: 'accepted', on_hold: 'negotiation' },
  tasks: { blocked: 'review' },
  payments: { refunded: 'refunded', partial: 'partially_paid' },
  invoices: { not_paid: 'issued', payment_pending: 'issued', fully_paid: 'paid', partially_paid: 'partially_paid' },
  mentoringSessions: { scheduled: 'scheduled' },
}

const serverStatus = (collection, value) => {
  const normalized = enumStatus(value)
  return statusAliases[collection]?.[normalized] || normalized
}

function normalizeService(record) {
  const [legacyKey, shortName] = serviceNames[record.slug] || [record.slug, record.name]
  const mentoring = record.slug === 'development-mentoring'
  return {
    ...record,
    legacyKey,
    shortName,
    offerings: record.features || [],
    status: record.isActive ? 'Active' : 'Inactive',
    supportsStudents: mentoring,
    supportsProjects: !mentoring,
    supportsRequests: !mentoring && record.slug !== 'magaf-products',
    supportsPayments: true,
    supportsFiles: true,
    icon: record.icon || (mentoring ? 'graduation' : 'layers'),
  }
}

export function normalizeRecord(collection, record) {
  if (!record) return record
  const normalized = { ...record, id: idOf(record.id || record._id) }
  if (collection === 'services') return normalizeService(normalized)
  if (collection === 'clients') return {
    ...normalized,
    contact: normalized.contactName || normalized.name,
    whatsapp: normalized.whatsappNumber,
    category: normalized.industry || normalized.businessType || '',
    location: normalized.city || '',
    serviceId: idOf(normalized.serviceId),
    status: normalized.status === 'discussion' ? 'Qualified' : normalized.status === 'active' ? 'Active' : textStatus(normalized.status),
    assignedTo: (normalized.assignedTeamMembers || []).map(nameOf).join(', '),
  }
  if (collection === 'leads') return {
    ...normalized,
    contact: normalized.contactName || '',
    category: normalized.industry || '',
    location: normalized.city || '',
    serviceId: idOf(normalized.serviceId),
    assignedTo: idOf(normalized.assignedTo),
    convertedClientId: idOf(normalized.convertedClientId),
    status: textStatus(normalized.status),
  }
  if (collection === 'projects') return {
    ...normalized,
    name: normalized.projectName,
    dealId: idOf(normalized.dealId),
    linkedDeal: normalized.dealId && typeof normalized.dealId === 'object' ? normalizeRecord('deals', normalized.dealId) : null,
    clientId: idOf(normalized.clientId),
    serviceId: idOf(normalized.serviceId),
    requestId: idOf(normalized.requestId),
    agreedAmount: normalized.finalAmount ?? normalized.quotedAmount ?? normalized.budget ?? 0,
    balance: normalized.balanceAmount ?? 0,
    assignedTo: nameOf(normalized.projectManager) || (normalized.assignedTeamMembers || []).map(nameOf).join(', '),
    status: textStatus(normalized.status),
    priority: textStatus(normalized.priority),
    paymentStatus: textStatus(normalized.paymentStatus),
    technologyStack: normalized.existingTechnology,
  }
  if (collection === 'deals') return {
    ...normalized,
    leadId: idOf(normalized.leadId),
    clientId: idOf(normalized.clientId),
    serviceId: idOf(normalized.serviceId),
    projectId: idOf(normalized.projectId),
    linkedProject: normalized.projectId && typeof normalized.projectId === 'object' ? normalizeRecord('projects', normalized.projectId) : null,
    assignedTo: idOf(normalized.assignedTo),
    status: textStatus(normalized.status),
    paymentStatus: normalized.projectId?.paymentStatus ? textStatus(normalized.projectId.paymentStatus) : undefined,
    paidAmount: normalized.projectId?.paidAmount || 0,
    balance: normalized.projectId?.balanceAmount ?? normalized.agreedAmount ?? normalized.quotedAmount ?? 0,
  }
  if (collection === 'payments') return {
    ...normalized,
    clientId: idOf(normalized.clientId),
    studentId: idOf(normalized.studentId),
    projectId: idOf(normalized.projectId),
    dealId: idOf(normalized.dealId),
    invoiceId: idOf(normalized.invoiceId),
    serviceId: idOf(normalized.serviceId),
    paymentAccountId: idOf(normalized.paymentAccountId),
    date: normalized.paymentDate,
    method: textStatus(normalized.paymentMethod),
    type: textStatus(normalized.paymentType),
    reference: normalized.transactionId || normalized.paymentCode,
    proofFiles: (normalized.proofFiles || []).map((file) => file && typeof file === 'object' ? { ...file, id: idOf(file.id || file._id) } : idOf(file)),
    verificationStatus: textStatus(normalized.verificationStatus),
    paymentSource: normalized.paymentSource,
    disputes: (normalized.disputes || []).map((dispute) => ({
      ...dispute,
      id: idOf(dispute.id || dispute._id),
      status: textStatus(dispute.status),
      proofFiles: (dispute.proofFiles || []).map((file) => file && typeof file === 'object' ? { ...file, id: idOf(file.id || file._id) } : idOf(file)),
    })),
    status: textStatus(normalized.status),
  }
  if (collection === 'invoices') return {
    ...normalized,
    invoiceNumber: normalized.invoiceCode,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
    dealId: idOf(normalized.dealId),
    issueDate: normalized.issueDate,
    dueDate: normalized.dueDate,
    paymentStatus: textStatus(normalized.status),
    status: textStatus(normalized.status),
  }
  if (collection === 'students') return {
    ...normalized,
    serviceId: idOf(normalized.serviceId),
    assignedMentor: nameOf(normalized.assignedMentor),
    mentorId: idOf(normalized.assignedMentor),
    goal: normalized.learningGoals,
    topics: (normalized.interestedTechnologies || []).join(', '),
    status: textStatus(normalized.status),
  }
  if (collection === 'mentoringSessions') return {
    ...normalized,
    studentId: idOf(normalized.studentId),
    mentor: nameOf(normalized.mentorId),
    mentorId: idOf(normalized.mentorId),
    status: textStatus(normalized.status),
  }
  if (collection === 'projectRequests') return {
    ...normalized,
    clientId: idOf(normalized.clientId),
    serviceId: idOf(normalized.serviceId),
    convertedProjectId: idOf(normalized.convertedProjectId),
    convertedDealId: idOf(normalized.convertedDealId),
    desiredDeadline: normalized.preferredDeadline,
    clientNotes: normalized.additionalNotes,
    status: textStatus(normalized.status),
    priority: textStatus(normalized.priority),
  }
  if (collection === 'tasks') return {
    ...normalized,
    projectId: idOf(normalized.projectId),
    clientId: idOf(normalized.projectId?.clientId),
    assignedTo: nameOf(normalized.assignedTo),
    deadline: normalized.dueDate,
    status: textStatus(normalized.status),
    priority: textStatus(normalized.priority),
  }
  if (collection === 'files') return {
    ...normalized,
    name: normalized.fileName || normalized.originalName,
    type: normalized.mimeType === 'text/uri-list' ? 'Link' : normalized.mimeType === 'application/zip' || normalized.mimeType === 'application/x-zip-compressed' || normalized.category === 'archive' ? 'Archive' : normalized.fileType,
    url: normalized.cloudinaryUrl,
    fileUrl: normalized.cloudinaryUrl,
    fileType: normalized.mimeType,
    fileSize: normalized.size,
    uploadedAt: normalized.createdAt,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
    projectRequestId: idOf(normalized.projectRequestId),
    uploadedBy: nameOf(normalized.uploadedBy),
    visibility: textStatus(normalized.visibility),
    status: textStatus(normalized.approvalStatus === 'approved' ? 'approved' : normalized.approvalStatus === 'final' ? 'delivered' : normalized.approvalStatus === 'changes_requested' ? 'changes_requested' : 'pending_approval'),
    approvalStatus: textStatus(normalized.approvalStatus || 'pending'),
  }
  if (collection === 'assets') return {
    ...normalized,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
    serviceId: idOf(normalized.serviceId),
    fileId: idOf(normalized.fileId),
    status: textStatus(normalized.status),
  }
  if (collection === 'content') {
    const project = normalized.projectId
    return {
      ...normalized,
      projectId: idOf(project),
      clientId: idOf(normalized.clientId),
      serviceId: idOf(normalized.serviceId),
      name: nameOf(project) || normalized.topic || normalized.contentType,
      url: normalized.deliverables?.[0]?.cloudinaryUrl || '',
      status: textStatus(normalized.status),
    }
  }
  if (collection === 'conversations') return {
    ...normalized,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
    projectRequestId: idOf(normalized.projectRequestId),
    participantIds: (normalized.participants || []).map((participant) => idOf(participant.userId)),
  }
  if (collection === 'messages') return {
    ...normalized,
    senderId: idOf(normalized.senderId),
    senderName: nameOf(normalized.senderId),
    senderRole: normalized.senderType === 'client' ? 'CLIENT' : 'TEAM',
    text: normalized.content,
    status: textStatus(normalized.status),
    attachments: (normalized.attachments || []).map((file) => ({
      id: idOf(file),
      name: file.fileName || file.originalName,
      type: file.fileType || file.mimeType,
      url: file.cloudinaryUrl,
    })),
    readReceipts: (normalized.readReceipts || []).map((receipt) => ({
      ...receipt,
      userId: idOf(receipt.userId),
      name: nameOf(receipt.userId),
      role: receipt.userId?.portalType === 'client' ? 'CLIENT' : 'TEAM',
    })),
  }
  if (collection === 'notifications') return {
    ...normalized,
    type: normalized.relatedEntity === 'conversation' ? 'message' : normalized.relatedEntity || normalized.type,
    detail: normalized.message,
    recordId: idOf(normalized.relatedEntityId),
    conversationId: normalized.relatedEntity === 'conversation' ? idOf(normalized.relatedEntityId) : undefined,
    read: normalized.isRead,
    readBy: normalized.isRead ? [{ userId: 'current-user' }] : [],
    timestamp: normalized.createdAt,
    time: normalized.createdAt ? new Date(normalized.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '',
  }
  if (collection === 'activities') return {
    ...normalized,
    type: normalized.entityType,
    title: textStatus(normalized.action),
    detail: normalized.description,
    recordId: idOf(normalized.entityId),
    timestamp: normalized.timestamp || normalized.createdAt,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
  }
  if (collection === 'communications') return {
    ...normalized,
    clientId: idOf(normalized.clientId),
    projectId: idOf(normalized.projectId),
  }
  if (collection === 'targets') return {
    ...normalized,
    targetType: normalized.targetType,
    serviceId: idOf(normalized.serviceId),
    status: textStatus(normalized.status),
  }
  if (collection === 'products') return {
    ...normalized,
    assignedTo: idOf(normalized.assignedTo),
    stage: textStatus(normalized.stage),
    priority: textStatus(normalized.priority),
  }
  if (collection === 'milestones') return {
    ...normalized,
    projectId: idOf(normalized.projectId),
    status: textStatus(normalized.status),
  }
  if (collection === 'revisions') return {
    ...normalized,
    projectId: idOf(normalized.projectId),
    clientId: idOf(normalized.clientId),
    requestedBy: nameOf(normalized.requestedBy),
    status: textStatus(normalized.status),
  }
  return normalized
}

export function serializeRecord(collection, values, data = {}) {
  const payload = { ...values }
  const lowerStatus = serverStatus(collection, payload.status)
  if (payload.status !== undefined) payload.status = lowerStatus
  if (payload.priority !== undefined) payload.priority = enumStatus(payload.priority)
  const assignedId = (nameOrId) => {
    if (!nameOrId) return undefined
    return [...(data.teamMembers || []), ...(data.users || [])]
      .find((person) => person.id === nameOrId || person.name === nameOrId)?.id || nameOrId
  }
  if (collection === 'clients') {
    payload.businessName ||= payload.name
    payload.contactName = payload.contact || payload.contactName
    payload.whatsappNumber = payload.whatsapp || payload.whatsappNumber
    payload.city = payload.city || payload.location
    payload.industry = payload.industry || payload.category
    payload.assignedTeamMembers = payload.assignedTo
      ? [assignedId(payload.assignedTo)]
      : payload.assignedTeamMembers
    delete payload.contact
    delete payload.whatsapp
    delete payload.location
    delete payload.category
    delete payload.assignedTo
    delete payload.portalPasswordConfirm
  }
  if (collection === 'leads') {
    payload.companyName ||= payload.name
    payload.contactName = payload.contact || payload.contactName
    payload.industry = payload.industry || payload.category
    payload.city = payload.city || payload.location
    payload.assignedTo = assignedId(payload.assignedTo)
    delete payload.contact
    delete payload.category
    delete payload.location
  }
  if (collection === 'projects') {
    payload.projectName = payload.projectName || payload.name
    payload.finalAmount = payload.finalAmount ?? payload.agreedAmount
    payload.projectType = payload.projectType || payload.type
    payload.existingTechnology = payload.existingTechnology || payload.technologyStack
    payload.projectManager = assignedId(payload.projectManager || payload.assignedTo)
    payload.assignedTeamMembers = payload.assignedTeamMembers || (payload.assignedTo ? [assignedId(payload.assignedTo)] : undefined)
    delete payload.name
    delete payload.agreedAmount
    delete payload.balance
    delete payload.type
    delete payload.technologyStack
    delete payload.assignedTo
  }
  if (collection === 'deals') payload.assignedTo = assignedId(payload.assignedTo)
  if (collection === 'users') {
    payload.password ||= payload.portalPassword
    delete payload.portalPassword
  }
  if (collection === 'payments') {
    payload.paymentDate = payload.paymentDate || payload.date
    payload.paymentMethod = enumStatus(payload.paymentMethod || payload.method).replace('net_banking', 'online')
    payload.transactionId = payload.transactionId || payload.reference
    payload.paymentType = ({
      advance: 'advance',
      partial_payment: 'partial_payment',
      milestone_payment: 'milestone',
      final_payment: 'full_payment',
      refund: 'other',
    })[enumStatus(payload.paymentType || payload.type)] || enumStatus(payload.paymentType || payload.type || 'other')
    if (enumStatus(payload.type) === 'refund') payload.status = 'refunded'
    delete payload.date
    delete payload.method
    delete payload.reference
    delete payload.type
  }
  if (collection === 'invoices') {
    payload.invoiceCode = payload.invoiceCode || payload.invoiceNumber
    payload.status = payload.status || serverStatus('invoices', payload.paymentStatus || 'issued')
    delete payload.invoiceNumber
    delete payload.paymentStatus
  }
  if (collection === 'students') {
    payload.learningGoals = payload.learningGoals || payload.goal
    payload.interestedTechnologies = Array.isArray(payload.interestedTechnologies) ? payload.interestedTechnologies : String(payload.topics || '').split(',').map((item) => item.trim()).filter(Boolean)
    payload.assignedMentor = assignedId(payload.assignedMentor || payload.mentor)
    payload.serviceId ||= data.services?.find((service) => service.legacyKey === 'mentoring')?.id
    delete payload.goal
    delete payload.topics
    delete payload.mentor
  }
  if (collection === 'mentoringSessions') {
    payload.status = serverStatus(collection, payload.status || 'scheduled')
    payload.mentorId = assignedId(payload.mentorId || payload.mentor)
    delete payload.mentor
  }
  if (collection === 'projectRequests') {
    payload.preferredDeadline = payload.preferredDeadline || payload.desiredDeadline
    payload.additionalNotes = payload.additionalNotes || payload.clientNotes
    payload.existingTechnology = payload.existingTechnology || payload.technologyInformation
    if (typeof payload.referenceLinks === 'string') {
      payload.referenceLinks = payload.referenceLinks.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ title: new URL(url).hostname, url, type: 'reference' }))
    }
    delete payload.desiredDeadline
    delete payload.clientNotes
    delete payload.clientName
    delete payload.technologyInformation
  }
  if (collection === 'tasks') {
    payload.dueDate = payload.dueDate || payload.deadline
    payload.assignedTo = assignedId(payload.assignedTo)
    delete payload.deadline
    delete payload.clientVisible
    delete payload.clientId
  }
  if (collection === 'content') {
    payload.contentType ||= 'social_post'
    payload.platform = Array.isArray(payload.platform) ? payload.platform : payload.platform ? [payload.platform] : []
    payload.topic = payload.topic || payload.name
    payload.status = serverStatus('content', payload.status || 'idea')
    payload.deadline = payload.deadline || payload.scheduledDate
    delete payload.name
    delete payload.scheduledDate
    delete payload.url
  }
  if (collection === 'revisions') payload.status = enumStatus(payload.status) === 'requested' ? 'submitted' : enumStatus(payload.status || 'submitted')
  if (collection === 'files' || collection === 'conversations' || collection === 'messages') return payload
  if (collection === 'communications') payload.createdBy = undefined
  if (collection === 'assets') payload.status = enumStatus(payload.status || 'input')
  if (collection === 'products') {
    payload.assignedTo = assignedId(payload.assignedTo)
    payload.stage = enumStatus(payload.stage || 'idea')
  }
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export { idOf, serverStatus }
