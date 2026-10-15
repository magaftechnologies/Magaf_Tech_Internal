import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Client, Communication, CreativeAsset, Deal, Expense, Invoice, Lead, Milestone, Notification, Payment, ProductIdea, Project, Revision, Service, Student, Task, Target, User, Activity } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'
import { paginationFromQuery, paginationMeta } from '../../utils/pagination.js'
import { balanceFor, paymentStatusFor } from '../../utils/calculations.js'
import { ROLES, ROLES_WITH_ALL_ACCESS } from '../../utils/constants.js'

const projectStatusTransitions = {
  draft: ['requested', 'planning', 'cancelled'],
  requested: ['pending_review', 'rejected', 'cancelled'],
  pending_review: ['accepted', 'rejected', 'cancelled'],
  accepted: ['planning', 'cancelled'],
  planning: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['review', 'on_hold', 'cancelled'],
  review: ['revision', 'delivered', 'in_progress', 'cancelled'],
  revision: ['in_progress', 'review', 'on_hold', 'cancelled'],
  on_hold: ['planning', 'in_progress', 'cancelled'],
  delivered: ['completed', 'revision'],
  completed: [],
  rejected: [],
  cancelled: [],
}

export const resources = Object.freeze({
  users: { Model: User, roles: ['super_admin', 'admin'], searchable: ['name', 'email', 'role'], writeFields: ['name', 'email', 'phone', 'role', 'portalType', 'profileImage', 'department', 'designation', 'permissions', 'isActive', 'password'], populate: [] },
  clients: { Model: Client, roles: ['super_admin', 'admin', 'manager', 'sales', 'team_member', 'client'], searchable: ['name', 'businessName', 'email', 'industry', 'city'], writeFields: ['name', 'businessName', 'companyName', 'contactName', 'email', 'phone', 'alternatePhone', 'alternateContact', 'whatsappNumber', 'address', 'city', 'state', 'country', 'website', 'socialLinks', 'instagram', 'linkedin', 'industry', 'businessType', 'businessDescription', 'targetAudience', 'businessSize', 'leadDate', 'firstContactDate', 'lastContactDate', 'priority', 'serviceId', 'source', 'notes', 'status', 'assignedTeamMembers', 'tags', 'gstNumber', 'billingAddress', 'shippingAddress'], populate: ['assignedTeamMembers', 'serviceId'] },
  leads: { Model: Lead, roles: ['super_admin', 'admin', 'manager', 'sales', 'team_member'], searchable: ['name', 'email', 'companyName', 'status'], writeFields: ['name', 'contactName', 'email', 'phone', 'companyName', 'industry', 'city', 'serviceId', 'source', 'status', 'potentialValue', 'assignedTo', 'nextFollowUp', 'notes'], populate: ['serviceId', 'assignedTo', 'convertedClientId'] },
  deals: { Model: Deal, roles: ['super_admin', 'admin', 'manager', 'sales', 'finance'], searchable: ['title', 'status'], writeFields: ['leadId', 'clientId', 'serviceId', 'projectId', 'title', 'description', 'quotedAmount', 'agreedAmount', 'discount', 'advanceRequired', 'status', 'expectedCloseDate', 'assignedTo', 'notes'], populate: ['leadId', 'clientId', 'serviceId', 'projectId', 'assignedTo'] },
  students: { Model: Student, roles: ['super_admin', 'admin', 'manager', 'mentor', 'finance'], searchable: ['name', 'email', 'phone', 'courseName', 'college', 'branch', 'status'], writeFields: ['name', 'email', 'phone', 'whatsapp', 'education', 'college', 'branch', 'year', 'courseName', 'learningGoals', 'skills', 'experienceLevel', 'interestedTechnologies', 'enrollmentDate', 'status', 'notes', 'assignedMentor', 'serviceId', 'agreedAmount', 'sessionsRemaining'], populate: ['assignedMentor'] },
  services: { Model: Service, roles: ['super_admin', 'admin', 'manager', 'team_member', 'sales', 'client'], searchable: ['name', 'slug', 'category'], writeFields: ['name', 'slug', 'description', 'category', 'icon', 'isActive', 'displayOrder', 'features'], populate: [] },
  projects: { Model: Project, roles: ['super_admin', 'admin', 'manager', 'team_member', 'sales', 'developer', 'designer', 'mentor', 'finance', 'client'], searchable: ['projectName', 'status', 'priority'], writeFields: ['projectName', 'clientId', 'serviceId', 'dealId', 'description', 'businessGoal', 'problemStatement', 'expectedOutcome', 'requirements', 'expectedDeliverables', 'existingTechnology', 'serviceDetails', 'referenceLinks', 'projectType', 'repositoryUrl', 'liveUrl', 'hosting', 'domain', 'status', 'priority', 'startDate', 'deadline', 'completionDate', 'budget', 'quotedAmount', 'finalAmount', 'assignedTeamMembers', 'projectManager', 'tags', 'notes', 'internalNotes', 'clientVisibleNotes', 'progress'], populate: ['clientId', 'serviceId', 'dealId', 'assignedTeamMembers', 'projectManager'] },
  invoices: { Model: Invoice, roles: ['super_admin', 'admin', 'manager', 'finance', 'client'], searchable: ['invoiceCode', 'status'], writeFields: ['clientId', 'projectId', 'dealId', 'amount', 'currency', 'issueDate', 'dueDate', 'status', 'notes'], populate: ['clientId', 'projectId', 'dealId'] },
  expenses: { Model: Expense, roles: ['super_admin', 'admin', 'manager', 'finance'], searchable: ['category', 'description', 'vendor', 'status'], writeFields: ['category', 'description', 'amount', 'currency', 'expenseDate', 'paymentMethod', 'status', 'vendor', 'projectId', 'serviceId', 'receiptFileId'], populate: ['projectId', 'serviceId', 'recordedBy'] },
  tasks: { Model: Task, roles: ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer', 'mentor'], searchable: ['title', 'status', 'priority'], writeFields: ['projectId', 'title', 'description', 'assignedTo', 'priority', 'status', 'dueDate'], populate: ['projectId', 'assignedTo'] },
  milestones: { Model: Milestone, roles: ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer', 'mentor', 'client'], searchable: ['name', 'status'], writeFields: ['projectId', 'name', 'description', 'status', 'completionPercentage', 'dueDate', 'clientVisible', 'displayOrder'], populate: ['projectId'] },
  revisions: { Model: Revision, roles: ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer', 'client'], searchable: ['status', 'description'], writeFields: ['projectId', 'clientId', 'description', 'status', 'dueDate', 'attachments'], populate: ['projectId', 'requestedBy'] },
  communications: { Model: Communication, roles: ['super_admin', 'admin', 'manager', 'sales', 'team_member'], searchable: ['channel', 'person', 'summary'], writeFields: ['clientId', 'projectId', 'date', 'channel', 'person', 'summary', 'followUpDate', 'notes'], populate: ['clientId', 'projectId', 'createdBy'] },
  targets: { Model: Target, roles: ['super_admin', 'admin', 'manager', 'finance'], searchable: ['targetType', 'period', 'status'], writeFields: ['targetType', 'period', 'targetValue', 'startDate', 'endDate', 'serviceId', 'status'], populate: ['serviceId'] },
  activities: { Model: Activity, roles: ['super_admin', 'admin', 'manager', 'team_member', 'sales', 'developer', 'designer', 'mentor', 'finance', 'client'], searchable: ['action', 'entityType', 'description'], writeFields: [], populate: ['actor'] },
  assets: { Model: CreativeAsset, roles: ['super_admin', 'admin', 'manager', 'team_member', 'designer', 'developer'], searchable: ['name', 'type', 'status', 'prompt'], writeFields: ['name', 'type', 'clientId', 'projectId', 'serviceId', 'fileId', 'version', 'prompt', 'url', 'status', 'notes'], populate: ['clientId', 'projectId', 'serviceId', 'fileId'] },
  products: { Model: ProductIdea, roles: ['super_admin', 'admin', 'manager', 'team_member'], searchable: ['name', 'description', 'target', 'stage'], writeFields: ['name', 'description', 'problem', 'target', 'stage', 'priority', 'assignedTo', 'notes'], populate: ['assignedTo'] },
})

const writeRoles = Object.freeze({
  users: ['super_admin', 'admin'],
  clients: ['super_admin', 'admin', 'manager', 'sales'],
  leads: ['super_admin', 'admin', 'manager', 'sales'],
  deals: ['super_admin', 'admin', 'manager', 'sales', 'finance'],
  students: ['super_admin', 'admin', 'manager', 'mentor'],
  services: ['super_admin', 'admin', 'manager'],
  projects: ['super_admin', 'admin', 'manager', 'developer', 'designer', 'mentor'],
  invoices: ['super_admin', 'admin', 'manager', 'finance'],
  expenses: ['super_admin', 'admin', 'manager', 'finance'],
  tasks: ['super_admin', 'admin', 'manager', 'team_member', 'developer', 'designer', 'mentor'],
  milestones: ['super_admin', 'admin', 'manager', 'developer', 'designer', 'team_member'],
  revisions: ['super_admin', 'admin', 'manager', 'developer', 'designer', 'team_member', 'client'],
  communications: ['super_admin', 'admin', 'manager', 'sales', 'team_member'],
  targets: ['super_admin', 'admin', 'manager', 'finance'],
  activities: [],
  assets: ['super_admin', 'admin', 'manager', 'team_member', 'designer', 'developer'],
  products: ['super_admin', 'admin', 'manager', 'team_member'],
})

const assignmentFields = Object.freeze({
  clients: ['assignedTeamMembers'],
  leads: ['assignedTo'],
  deals: ['assignedTo'],
  students: ['assignedMentor'],
  projects: ['assignedTeamMembers', 'projectManager'],
  tasks: ['assignedTo'],
  products: ['assignedTo'],
})
const internalRoles = ROLES.filter((role) => role !== 'client')

async function validateTeamAssignments(key, payload) {
  for (const field of assignmentFields[key] || []) {
    if (!(field in payload)) continue
    const value = payload[field]
    const ids = (Array.isArray(value) ? value : [value])
      .filter((id) => id !== undefined && id !== null && id !== '')
      .map(String)
    if (!ids.length) continue
    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
      throw Object.assign(new Error('Assignments must reference active internal team members.'), { statusCode: 400 })
    }
    const eligible = await User.find({
      _id: { $in: [...new Set(ids)] },
      portalType: 'team',
      role: { $in: internalRoles },
      isActive: true,
    }).distinct('_id')
    if (eligible.length !== new Set(ids).size) {
      throw Object.assign(new Error('Assignments must reference active internal team members.'), { statusCode: 400 })
    }
  }
}

async function clientFilter(user, key) {
  if (user.portalType !== 'client') return {}
  if (key === 'clients') return { _id: user.clientId }
  if (key === 'activities') return { clientId: user.clientId }
  if (key === 'projects') return { clientId: user.clientId }
  if (key === 'invoices') return { clientId: user.clientId }
  if (key === 'revisions') return { clientId: user.clientId, clientVisible: true }
  if (key === 'milestones') return { projectId: { $in: await Project.find({ clientId: user.clientId }).distinct('_id') }, clientVisible: true }
  if (key === 'students' || key === 'users' || key === 'tasks' || key === 'targets') {
    const error = new Error('Client portal access is not permitted for this resource.')
    error.statusCode = 403
    throw error
  }
  return {}
}

function applySearch(filter, fields, term) {
  if (!term || !fields.length) return filter
  return { $and: [filter, { $or: fields.map((field) => ({ [field]: { $regex: String(term).slice(0, 100), $options: 'i' } })) }] }
}

export async function list(key, user, query) {
  const config = resources[key]
  const ownership = await clientFilter(user, key)
  const { page, limit, skip } = paginationFromQuery(query)
  const filter = { ...ownership }
  if (key === 'users') {
    filter.portalType = 'team'
    filter.role = { $in: internalRoles }
  }
  if (query.status) filter.status = query.status
  if (query.clientId && user.portalType !== 'client') filter.clientId = query.clientId
  if (query.projectId) filter.projectId = query.projectId
  if (query.serviceId) filter.serviceId = query.serviceId
  if (user.portalType === 'client' && key === 'milestones') filter.projectId = ownership.projectId
  if (user.portalType === 'client' && key === 'revisions') filter.clientVisible = true
  const where = applySearch(filter, config.searchable, query.search)
  let find = config.Model.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit)
  if (config.populate.length) find = find.populate(config.populate)
  const [items, total] = await Promise.all([find, config.Model.countDocuments(where)])
  return { items: items.map((item) => redactClientData(item, user, key)), pagination: paginationMeta(total, page, limit) }
}

function redactClientData(record, user, key) {
  if (user.portalType !== 'client') return record
  const json = record.toJSON()
  if (key === 'projects') {
    delete json.internalNotes
    delete json.notes
    delete json.assignedTeamMembers
    delete json.projectManager
    json.clientId = safeClientSummary(json.clientId)
    if (json.dealId && typeof json.dealId === 'object') {
      const deal = json.dealId
      json.dealId = {
        id: deal.id || deal._id?.toString(),
        dealCode: deal.dealCode,
        title: deal.title,
        quotedAmount: deal.quotedAmount,
        agreedAmount: deal.agreedAmount,
        status: deal.status,
      }
    }
  }
  if (key === 'clients') {
    delete json.notes
    delete json.assignedTeamMembers
    delete json.createdBy
    delete json.updatedBy
  }
  if (key === 'activities') {
    delete json.metadata
    delete json.createdBy
    delete json.updatedBy
    if (json.actor && typeof json.actor === 'object') json.actor = { id: json.actor.id || json.actor._id?.toString(), name: json.actor.name }
  }
  if (key === 'invoices') {
    json.clientId = safeClientSummary(json.clientId)
    json.projectId = safeProjectSummary(json.projectId)
    if (json.dealId && typeof json.dealId === 'object') json.dealId = { id: json.dealId.id, title: json.dealId.title, status: json.dealId.status }
    delete json.notes
    delete json.createdBy
    delete json.updatedBy
  }
  if (key === 'milestones' || key === 'revisions') {
    json.projectId = safeProjectSummary(json.projectId)
    delete json.requestedBy
    delete json.createdBy
    delete json.updatedBy
  }
  return json
}

function safeClientSummary(client) {
  if (!client || typeof client !== 'object') return client
  return { id: client.id || client._id?.toString(), name: client.name, businessName: client.businessName }
}

function safeProjectSummary(project) {
  if (!project || typeof project !== 'object') return project
  return { id: project.id || project._id?.toString(), projectName: project.projectName, projectCode: project.projectCode, status: project.status }
}

export async function getById(key, id, user) {
  const config = resources[key]
  const filter = { _id: id, ...await clientFilter(user, key), ...(key === 'users' ? { portalType: 'team', role: { $in: internalRoles } } : {}) }
  let find = config.Model.findOne(filter)
  if (config.populate.length) find = find.populate(config.populate)
  const result = await find
  if (!result) {
    const error = new Error('Record not found.')
    error.statusCode = 404
    throw error
  }
  return redactClientData(result, user, key)
}

function pickFields(input, permitted) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => permitted.includes(key)))
}

export async function create(key, input, user) {
  const config = resources[key]
  const payload = pickFields(input, config.writeFields)
  const actorId = user._id
  let mentoringRecipients = []
  await validateTeamAssignments(key, payload)
  if (key === 'users') {
    if (!input.password || input.password.length < 10) throw Object.assign(new Error('A password of at least 10 characters is required.'), { statusCode: 400 })
    payload.passwordHash = await bcrypt.hash(input.password, 12)
    payload.portalType = payload.portalType || 'team'
    if (payload.portalType !== 'team' || payload.role === 'client') throw Object.assign(new Error('Team accounts must use the team portal and a team role.'), { statusCode: 400 })
    if (user.role !== 'super_admin' && ['super_admin', 'admin'].includes(payload.role)) throw Object.assign(new Error('Only a super administrator can create administrator accounts.'), { statusCode: 403 })
    delete payload.password
  }
  if (key === 'clients') {
    payload.clientCode = payload.clientCode || `CL-${randomBytes(3).toString('hex').toUpperCase()}`
    payload.createdBy = actorId
  }
  if (key === 'services') {
    payload.createdBy = actorId
    payload.slug ||= payload.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }
  if (key === 'projects') {
    if (user.portalType === 'client') payload.clientId = user.clientId
    const [client, service] = await Promise.all([Client.exists({ _id: payload.clientId }), Service.exists({ _id: payload.serviceId, isActive: true })])
    if (!client || !service) {
      const error = new Error('A valid client and active service are required.')
      error.statusCode = 400
      throw error
    }
    payload.projectCode ||= `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`
    payload.createdBy = actorId
    payload.paidAmount = 0
    payload.balanceAmount = balanceFor(payload.finalAmount ?? payload.quotedAmount ?? payload.budget, 0)
    payload.paymentStatus = paymentStatusFor(payload.finalAmount ?? payload.quotedAmount ?? payload.budget, 0)
    if (payload.dealId) {
      const deal = await Deal.findOne({ _id: payload.dealId, clientId: payload.clientId })
      if (!deal || deal.serviceId.toString() !== payload.serviceId.toString()) throw Object.assign(new Error('The selected deal does not belong to this client and service.'), { statusCode: 400 })
    }
  }
  if (key === 'clients' && input.createPortalAccount) {
    if (!payload.email) throw Object.assign(new Error('An email address is required to create a client portal account.'), { statusCode: 400 })
    if (typeof input.portalPassword !== 'string' || input.portalPassword.length < 10) throw Object.assign(new Error('Set a temporary portal password of at least 10 characters.'), { statusCode: 400 })
    if (await User.exists({ email: payload.email.toLowerCase() })) throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409 })
  }
  if (['tasks', 'milestones', 'revisions'].includes(key)) {
    const project = await Project.findOne({ _id: payload.projectId, ...(user.portalType === 'client' ? { clientId: user.clientId } : {}) })
    if (!project) throw Object.assign(new Error('Project not found or access denied.'), { statusCode: 404 })
    if (key === 'revisions') {
      payload.clientId = project.clientId
      payload.requestedBy = actorId
      payload.status = 'submitted'
      payload.revisionCode ||= `REV-${randomBytes(3).toString('hex').toUpperCase()}`
      payload.revisionNumber = (await Revision.countDocuments({ projectId: project._id })) + 1
    }
    if (key === 'milestones') payload.milestoneCode ||= `MILE-${randomBytes(3).toString('hex').toUpperCase()}`
    if (key === 'tasks') payload.taskCode ||= `TSK-${randomBytes(3).toString('hex').toUpperCase()}`
  }
  if (key === 'communications') {
    const client = await Client.findById(payload.clientId)
    if (!client) throw Object.assign(new Error('Client not found.'), { statusCode: 404 })
    if (payload.projectId && !await Project.exists({ _id: payload.projectId, clientId: client._id })) throw Object.assign(new Error('Project does not belong to this client.'), { statusCode: 400 })
    payload.createdBy = actorId
  }
  if (key === 'expenses') {
    payload.expenseCode ||= `EXP-${randomBytes(4).toString('hex').toUpperCase()}`
    payload.recordedBy = actorId
    if (payload.projectId && !await Project.exists({ _id: payload.projectId })) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
    if (payload.serviceId && !await Service.exists({ _id: payload.serviceId })) throw Object.assign(new Error('Service not found.'), { statusCode: 404 })
  }
  if (key === 'invoices' && payload.projectId && !await Project.exists({ _id: payload.projectId, clientId: payload.clientId })) {
    throw Object.assign(new Error('Project does not belong to this client.'), { statusCode: 400 })
  }
  if (key === 'students') {
    payload.studentCode ||= `STU-${randomBytes(3).toString('hex').toUpperCase()}`
    payload.createdBy = actorId
    if (!String(payload.name || '').trim() || !String(payload.courseName || '').trim() || payload.agreedAmount === undefined) {
      throw Object.assign(new Error('Student name, course or learning track, and agreed enrollment fee are required.'), { statusCode: 400 })
    }
    const mentoringService = await Service.findOne({ slug: 'development-mentoring', isActive: true }).select('_id')
    if (!mentoringService) throw Object.assign(new Error('The active Development Mentorship service must be configured before enrolling students.'), { statusCode: 409 })
    if (payload.serviceId && !mentoringService._id.equals(payload.serviceId)) {
      throw Object.assign(new Error('Students must be associated with the Development Mentorship service.'), { statusCode: 400 })
    }
    payload.serviceId = mentoringService._id
    if (payload.agreedAmount !== undefined && (!Number.isFinite(Number(payload.agreedAmount)) || Number(payload.agreedAmount) < 0)) {
      throw Object.assign(new Error('Agreed student fee must be a non-negative amount.'), { statusCode: 400 })
    }
    mentoringRecipients = payload.assignedMentor ? [payload.assignedMentor] : await User.find({ portalType: 'team', isActive: true, role: { $in: ['super_admin', 'admin', 'manager'] } }).distinct('_id')
  }
  if (key === 'invoices') {
    payload.invoiceCode ||= `MAG-INV-${randomBytes(4).toString('hex').toUpperCase()}`
    payload.createdBy = actorId
  }
  if (key === 'tasks') payload.createdBy = actorId
  if (key === 'targets') payload.createdBy = actorId
  let created
  if (key === 'clients' && input.createPortalAccount) {
    const client = await Client.create(payload)
    try {
      const portalUser = await User.create({
        name: payload.contactName || payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        passwordHash: await bcrypt.hash(input.portalPassword, 12),
        role: 'client',
        portalType: 'client',
        clientId: client._id,
        mustChangePassword: true,
        isActive: true,
      })
      client.userId = portalUser._id
      await client.save()
      created = client
    } catch (error) {
      await Client.findByIdAndDelete(client._id)
      throw error
    }
  } else {
    if (key === 'assets') {
      payload.assetCode ||= `AST-${randomBytes(4).toString('hex').toUpperCase()}`
      payload.createdBy = actorId
      if (payload.projectId) {
        const project = await Project.findById(payload.projectId)
        if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
        if (payload.clientId && project.clientId.toString() !== payload.clientId.toString()) throw Object.assign(new Error('Project does not belong to this client.'), { statusCode: 400 })
        payload.clientId = project.clientId
        payload.serviceId ||= project.serviceId
      }
    }
    if (key === 'products') {
      payload.productCode ||= `PRD-${randomBytes(4).toString('hex').toUpperCase()}`
      payload.createdBy = actorId
    }
    created = await config.Model.create(payload)
  }
  if (key === 'students' && mentoringRecipients.length) {
    await Notification.insertMany(mentoringRecipients.map((recipient) => ({
      recipient, type: 'mentoring_enrollment', title: 'New mentoring enrollment',
      message: created.name, relatedEntity: 'student', relatedEntityId: created._id,
    })))
  }
  await recordActivity({ actor: actorId, action: `${key}.created`, entityType: key, entityId: created._id, clientId: created.clientId, projectId: key === 'projects' ? created._id : created.projectId, description: `${key.slice(0, -1)} created.` })
  return created
}

export async function update(key, id, input, user) {
  const config = resources[key]
  const current = await config.Model.findOne({ _id: id, ...await clientFilter(user, key), ...(key === 'users' ? { portalType: 'team', role: { $in: internalRoles } } : {}) })
  if (!current) throw Object.assign(new Error('Record not found.'), { statusCode: 404 })
  const previousStatus = current.status
  const changes = pickFields(input, config.writeFields)
  await validateTeamAssignments(key, changes)
  let previousStudentFee
  if (key === 'students' && changes.serviceId) {
    const mentoringService = await Service.findOne({ slug: 'development-mentoring', isActive: true }).select('_id')
    if (!mentoringService) throw Object.assign(new Error('The active Development Mentorship service must be configured before updating student enrollments.'), { statusCode: 409 })
    if (!mentoringService._id.equals(changes.serviceId)) {
      throw Object.assign(new Error('Students must remain associated with the Development Mentorship service.'), { statusCode: 400 })
    }
  }
  if (key === 'students' && changes.agreedAmount !== undefined) {
    const agreedAmount = Number(changes.agreedAmount)
    if (!Number.isFinite(agreedAmount) || agreedAmount < 0) {
      throw Object.assign(new Error('Agreed student fee must be a non-negative amount.'), { statusCode: 400 })
    }
    const [collected] = await Payment.aggregate([
      { $match: { studentId: current._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    if (agreedAmount < Number(collected?.total || 0)) {
      throw Object.assign(new Error('The new agreed fee is below verified payments already collected. Resolve the overpayment explicitly before changing the fee.'), { statusCode: 409 })
    }
    previousStudentFee = Number(current.agreedAmount || 0)
  }
  if (user.portalType === 'client') {
    const allowedClientFields = ['name', 'contactName', 'phone', 'alternatePhone', 'whatsappNumber', 'address', 'city', 'state', 'country', 'website', 'socialLinks']
    const allowedProjectFields = ['clientVisibleNotes']
    const allowedRevisionFields = ['description', 'attachments']
    const allowed = key === 'clients' ? allowedClientFields : key === 'projects' ? allowedProjectFields : key === 'revisions' ? allowedRevisionFields : []
    const disallowed = Object.keys(changes).filter((field) => !allowed.includes(field))
    if (disallowed.length) throw Object.assign(new Error('One or more fields are not editable from the client portal.'), { statusCode: 403 })
  }
  if (key === 'projects') {
    delete changes.paidAmount
    delete changes.balanceAmount
    delete changes.paymentStatus
    if (changes.status && changes.status !== previousStatus && !projectStatusTransitions[previousStatus]?.includes(changes.status)) {
      throw Object.assign(new Error(`Project status cannot transition from ${previousStatus} to ${changes.status}.`), { statusCode: 409 })
    }
    if (changes.status === 'completed') changes.completionDate = new Date()
    if (changes.finalAmount !== undefined) {
      if (Number(changes.finalAmount) < Number(current.paidAmount || 0)) throw Object.assign(new Error('finalAmount cannot be lower than payments already received.'), { statusCode: 409 })
      changes.paidAmount = current.paidAmount
      changes.balanceAmount = balanceFor(changes.finalAmount, current.paidAmount)
      changes.paymentStatus = paymentStatusFor(changes.finalAmount, current.paidAmount)
    }
  }
  if (key === 'tasks' && changes.status === 'completed') changes.completedAt = new Date()
  if (key === 'users') {
    if (changes.email) changes.email = changes.email.toLowerCase()
    if (changes.password) {
      if (changes.password.length < 10) throw Object.assign(new Error('A password of at least 10 characters is required.'), { statusCode: 400 })
      changes.passwordHash = await bcrypt.hash(changes.password, 12)
      delete changes.password
    }
    if (changes.role === 'client' || changes.portalType === 'client') throw Object.assign(new Error('Client accounts are created through client registration.'), { statusCode: 400 })
    if (user.role !== 'super_admin' && ['super_admin', 'admin'].includes(changes.role)) throw Object.assign(new Error('Only a super administrator can assign administrator roles.'), { statusCode: 403 })
  }
  let acceptedDealProject
  if (key === 'deals' && changes.status === 'accepted' && !current.projectId) {
    if (!current.clientId) throw Object.assign(new Error('An accepted deal must be associated with a client before creating its project.'), { statusCode: 400 })
    const amount = Number(current.agreedAmount ?? current.quotedAmount ?? 0)
    acceptedDealProject = await Project.create({
      projectCode: `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`,
      projectName: current.title,
      clientId: current.clientId,
      serviceId: current.serviceId,
      dealId: current._id,
      description: current.description,
      quotedAmount: current.quotedAmount,
      finalAmount: amount,
      balanceAmount: amount,
      paymentStatus: amount > 0 ? 'unpaid' : 'paid',
      status: 'planning',
      projectManager: current.assignedTo,
      createdBy: user._id,
    })
    current.projectId = acceptedDealProject._id
  }
  Object.assign(current, changes)
  current.updatedBy = user._id
  try {
    await current.save()
  } catch (error) {
    if (acceptedDealProject) await Project.findByIdAndDelete(acceptedDealProject._id)
    throw error
  }
  if (key === 'projects' && changes.status && changes.status !== previousStatus) {
    const client = await Client.findById(current.clientId).select('userId')
    if (client?.userId) {
      const completed = ['completed', 'delivered'].includes(changes.status)
      await Notification.create({
        recipient: client.userId,
        type: completed ? 'project_completed' : 'project_status',
        title: completed ? 'Project completed' : 'Project status updated',
        message: `${current.projectName}: ${changes.status.replaceAll('_', ' ')}`,
        relatedEntity: 'project',
        relatedEntityId: current._id,
      })
    }
  }
  await recordActivity({ actor: user._id, action: `${key}.updated`, entityType: key, entityId: current._id, clientId: current.clientId, projectId: key === 'projects' ? current._id : current.projectId, description: `${key.slice(0, -1)} updated.` })
  if (key === 'students' && previousStudentFee !== undefined && previousStudentFee !== Number(current.agreedAmount || 0)) {
    await recordActivity({
      actor: user._id,
      action: 'student.enrollment_fee.updated',
      entityType: 'student',
      entityId: current._id,
      metadata: { oldValue: { agreedAmount: previousStudentFee }, newValue: { agreedAmount: Number(current.agreedAmount || 0) } },
      description: `Agreed enrollment fee changed from ${previousStudentFee} to ${Number(current.agreedAmount || 0)}.`,
    })
  }
  return redactClientData(current, user, key)
}

export async function remove(key, id, user) {
  const current = await resources[key].Model.findOne({ _id: id, ...await clientFilter(user, key), ...(key === 'users' ? { portalType: 'team', role: { $in: internalRoles } } : {}) })
  if (!current) throw Object.assign(new Error('Record not found.'), { statusCode: 404 })
  if (key === 'clients') current.status = 'inactive'
  else if (key === 'services') current.isActive = false
  else if (key === 'users') current.isActive = false
  else if (key === 'projects') current.status = 'cancelled'
  else if (key === 'tasks') current.status = 'cancelled'
  else {
    const error = new Error('This record type cannot be deleted through the API.')
    error.statusCode = 405
    throw error
  }
  await current.save()
  await recordActivity({ actor: user._id, action: `${key}.archived`, entityType: key, entityId: current._id, clientId: current.clientId, projectId: key === 'projects' ? current._id : current.projectId, description: `${key.slice(0, -1)} archived.` })
  return current
}

export function rolesFor(key) {
  return resources[key]?.roles || ROLES_WITH_ALL_ACCESS
}

export function writeRolesFor(key) {
  return writeRoles[key] || []
}

export async function listTeamMembers() {
  return User.find({ portalType: 'team', role: { $in: internalRoles }, isActive: true })
    .select('name role department designation profileImage')
    .sort({ name: 1 })
}
