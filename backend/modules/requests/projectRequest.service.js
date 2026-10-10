import { randomBytes } from 'node:crypto'
import { Client, Conversation, Deal, Notification, Project, ProjectRequest, Service, User, FileAsset } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

const teamAudience = { portalType: 'team', isActive: true, role: { $in: ['super_admin', 'admin', 'manager', 'sales', 'team_member'] } }

export async function createRequest(input, user) {
  const clientId = user.portalType === 'client' ? user.clientId : input.clientId
  if (!clientId) throw Object.assign(new Error('clientId is required.'), { statusCode: 400 })
  const [client, service] = await Promise.all([
    Client.findById(clientId),
    Service.findOne({ _id: input.serviceId, isActive: true }),
  ])
  if (!client || !service) throw Object.assign(new Error('A valid client and active service are required.'), { statusCode: 400 })
  const request = await ProjectRequest.create({
    ...input,
    clientId,
    status: 'submitted',
    submittedAt: new Date(),
    createdBy: user._id,
    requestCode: `REQ-${randomBytes(3).toString('hex').toUpperCase()}`,
  })
  const recipients = await User.find(teamAudience).select('_id')
  if (recipients.length) {
    await Notification.insertMany(recipients.map(({ _id }) => ({
      recipient: _id, type: 'project_request', title: 'New project request',
      message: `${client.name}: ${request.projectName}`, relatedEntity: 'project_request', relatedEntityId: request._id,
    })))
  }
  await recordActivity({ actor: user._id, action: 'project_request.submitted', entityType: 'project_request', entityId: request._id, clientId, description: `${request.projectName} was submitted for review.` })
  return request
}

export async function listRequests(user, filters = {}) {
  const query = user.portalType === 'client' ? { clientId: user.clientId } : {}
  for (const key of ['status', 'clientId', 'serviceId']) if (filters[key] && user.portalType !== 'client') query[key] = filters[key]
  const rows = await ProjectRequest.find(query).sort({ createdAt: -1 }).populate('clientId serviceId reviewedBy convertedProjectId')
  return user.portalType === 'client' ? rows.map((request) => {
    const json = request.toJSON()
    delete json.teamNotes
    delete json.reviewedBy
    return json
  }) : rows
}

export async function getRequest(id, user) {
  const query = { _id: id }
  if (user.portalType === 'client') query.clientId = user.clientId
  const request = await ProjectRequest.findOne(query).populate('clientId serviceId reviewedBy convertedProjectId')
  if (!request) throw Object.assign(new Error('Project request not found.'), { statusCode: 404 })
  if (user.portalType === 'client') {
    const json = request.toJSON()
    delete json.teamNotes
    delete json.reviewedBy
    return json
  }
  return request
}

export async function updateRequest(id, changes, user) {
  const request = await getRequest(id, user)
  const teamStatusChanges = ['status', 'proposedPrice', 'teamNotes', 'informationRequested']
  if (user.portalType === 'client' && Object.keys(changes).some((key) => teamStatusChanges.includes(key))) {
    throw Object.assign(new Error('Only the internal team can update review status, pricing, or internal notes.'), { statusCode: 403 })
  }
  if (user.portalType === 'team' && changes.status && !['under_review', 'need_more_information', 'quoted', 'accepted', 'rejected', 'cancelled'].includes(changes.status)) {
    throw Object.assign(new Error('Use the conversion action to convert an accepted request.'), { statusCode: 400 })
  }
  const permitted = user.portalType === 'client'
    ? ['additionalNotes', 'requirements', 'referenceLinks', 'expectedDeliverables', 'existingTechnology']
    : ['status', 'proposedPrice', 'teamNotes', 'informationRequested', 'priority', 'preferredDeadline']
  for (const [key, value] of Object.entries(changes)) if (permitted.includes(key)) request[key] = value
  request.updatedBy = user._id
  if (user.portalType === 'team') request.reviewedBy = user._id
  await request.save()
  await recordActivity({ actor: user._id, action: 'project_request.updated', entityType: 'project_request', entityId: request._id, clientId: request.clientId, description: `Request ${request.requestCode} updated.` })
  if (user.portalType === 'team') {
    const owner = await Client.findById(request.clientId).select('userId')
    if (owner?.userId) await Notification.create({
      recipient: owner.userId,
      type: 'project_request_update',
      title: request.status === 'need_more_information' ? 'More information requested' : 'Project request updated',
      message: `${request.projectName}: ${request.status.replaceAll('_', ' ')}`,
      relatedEntity: 'project_request',
      relatedEntityId: request._id,
    })
  }
  return request
}

export async function convertRequest(id, input, user) {
  const request = await ProjectRequest.findById(id)
  if (!request) throw Object.assign(new Error('Project request not found.'), { statusCode: 404 })
  if (request.status === 'converted_to_project') throw Object.assign(new Error('This request has already been converted.'), { statusCode: 409 })
  if (!['accepted', 'quoted'].includes(request.status)) throw Object.assign(new Error('Accept or quote this request before converting it to a project.'), { statusCode: 409 })
  const agreedAmount = Number(input.agreedAmount ?? request.proposedPrice ?? request.estimatedBudget ?? 0)
  if (!Number.isFinite(agreedAmount) || agreedAmount < 0) throw Object.assign(new Error('agreedAmount must be a non-negative number.'), { statusCode: 400 })
  const previousStatus = request.status
  const quotedAmount = Number(request.proposedPrice || request.estimatedBudget || agreedAmount)
  const deal = await Deal.create({
    dealCode: `DEAL-${randomBytes(3).toString('hex').toUpperCase()}`,
    clientId: request.clientId,
    serviceId: request.serviceId,
    title: request.projectName,
    description: request.description,
    quotedAmount,
    agreedAmount,
    status: 'accepted',
    expectedCloseDate: request.preferredDeadline,
    notes: request.teamNotes,
    createdBy: user._id,
  })
  let project
  try {
    project = await Project.create({
    projectCode: `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`,
    projectName: request.projectName,
    clientId: request.clientId,
    serviceId: request.serviceId,
    dealId: deal._id,
    requestId: request._id,
    description: request.description,
    businessGoal: request.businessGoal,
    problemStatement: request.problemStatement,
    expectedOutcome: request.expectedOutcome,
    requirements: request.requirements,
    expectedDeliverables: request.expectedDeliverables,
    existingTechnology: request.existingTechnology,
    referenceLinks: request.referenceLinks,
    priority: request.priority,
    deadline: request.preferredDeadline,
    budget: request.estimatedBudget,
    quotedAmount,
    finalAmount: agreedAmount,
    paidAmount: 0,
    balanceAmount: agreedAmount,
    paymentStatus: agreedAmount > 0 ? 'unpaid' : 'paid',
    status: 'planning',
    notes: request.additionalNotes,
    internalNotes: request.teamNotes,
    createdBy: user._id,
    })
    deal.projectId = project._id
    await deal.save()
    request.convertedProjectId = project._id
    request.convertedDealId = deal._id
    request.status = 'converted_to_project'
    request.reviewedBy = user._id
    request.updatedBy = user._id
    await request.save()
    await FileAsset.updateMany({ projectRequestId: request._id }, { $set: { projectId: project._id } })
    const conversation = await Conversation.findOne({ clientId: request.clientId, projectRequestId: request._id })
    if (conversation) {
      conversation.projectId = project._id
      conversation.projectRequestId = undefined
      await conversation.save()
    }
  } catch (error) {
    request.status = previousStatus
    request.convertedProjectId = undefined
    request.convertedDealId = undefined
    await request.save()
    if (project) {
      await FileAsset.updateMany({ projectId: project._id }, { $unset: { projectId: 1 } })
      await Conversation.updateOne({ clientId: request.clientId, projectId: project._id }, { $unset: { projectId: 1 }, $set: { projectRequestId: request._id } })
      await Project.findByIdAndDelete(project._id)
    }
    await Deal.findByIdAndDelete(deal._id)
    throw error
  }
  const client = await Client.findById(request.clientId).select('userId')
  if (client?.userId) await Notification.create({ recipient: client.userId, type: 'project_created', title: 'Your request became a project', message: `${request.projectName} is now in planning.`, relatedEntity: 'project', relatedEntityId: project._id })
  await recordActivity({ actor: user._id, action: 'project_request.converted', entityType: 'project_request', entityId: request._id, clientId: request.clientId, projectId: project._id, description: `Request ${request.requestCode} converted to project ${project.projectCode}.` })
  return project
}
