import { AdvertisingProject, AutomationProject, ContentProject, InvitationProject, Project } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

const definitions = Object.freeze({
  advertising: { Model: AdvertisingProject, serviceSlug: 'advertising-creative', writeRoles: ['super_admin', 'admin', 'manager', 'designer', 'developer', 'team_member'], fields: ['creativeType', 'campaignName', 'platform', 'objective', 'targetAudience', 'script', 'creativeBrief', 'requirements', 'referenceMaterials', 'inputFiles', 'outputFiles', 'revisionCount', 'status', 'deadline'] },
  content: { Model: ContentProject, serviceSlug: 'content-creation', writeRoles: ['super_admin', 'admin', 'manager', 'designer', 'developer', 'team_member'], fields: ['contentType', 'platform', 'contentBrief', 'topic', 'caption', 'script', 'contentCalendar', 'targetAudience', 'referenceFiles', 'deliverables', 'status', 'deadline'] },
  invitations: { Model: InvitationProject, serviceSlug: 'digital-invitations', writeRoles: ['super_admin', 'admin', 'manager', 'designer', 'team_member'], fields: ['eventType', 'eventName', 'hostName', 'eventDate', 'eventTime', 'venue', 'location', 'mapLink', 'rsvpDetails', 'countdown', 'photos', 'gallery', 'invitationTheme', 'invitationUrl', 'qrCode', 'videoInvitation', 'status'] },
  automation: { Model: AutomationProject, serviceSlug: 'business-automation', writeRoles: ['super_admin', 'admin', 'manager', 'developer', 'team_member'], fields: ['automationType', 'businessProblem', 'workflowDescription', 'inputSources', 'integrations', 'knowledgeSources', 'agentType', 'expectedOutcome', 'requirements', 'limitations', 'deploymentStatus', 'maintenanceRequired', 'monthlyCost', 'setupCost', 'status'] },
})

const pick = (input, fields) => Object.fromEntries(Object.entries(input).filter(([key]) => fields.includes(key)))

export async function listWork(kind, user, query = {}) {
  const { Model } = definitions[kind]
  const filter = user.portalType === 'client' ? { clientId: user.clientId } : {}
  if (query.projectId) filter.projectId = query.projectId
  const rows = await Model.find(filter).sort({ createdAt: -1 }).populate('projectId clientId serviceId')
  if (user.portalType !== 'client') return rows
  return rows.map((row) => {
    const json = row.toJSON()
    delete json.createdBy
    delete json.updatedBy
    if (json.clientId && typeof json.clientId === 'object') json.clientId = { id: json.clientId.id, name: json.clientId.name, businessName: json.clientId.businessName }
    if (json.projectId && typeof json.projectId === 'object') json.projectId = { id: json.projectId.id, projectName: json.projectId.projectName, status: json.projectId.status }
    return json
  })
}

export async function createWork(kind, input, user) {
  const { Model, serviceSlug, fields, writeRoles } = definitions[kind]
  if (user.portalType !== 'team') throw Object.assign(new Error('Only the internal team can configure service work records.'), { statusCode: 403 })
  if (!writeRoles.includes(user.role)) throw Object.assign(new Error('Your role cannot modify this service work module.'), { statusCode: 403 })
  const project = await Project.findById(input.projectId).populate('serviceId')
  if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
  if (project.serviceId.slug !== serviceSlug) throw Object.assign(new Error(`The linked project is not a ${kind} service project.`), { statusCode: 400 })
  if (await Model.exists({ projectId: project._id })) throw Object.assign(new Error('A service work record already exists for this project.'), { statusCode: 409 })
  const amount = Number(project.finalAmount ?? project.quotedAmount ?? project.budget ?? 0)
  const record = await Model.create({
    ...pick(input, fields),
    projectId: project._id,
    clientId: project.clientId,
    serviceId: project.serviceId._id,
    ...(kind === 'advertising' ? { quotedAmount: amount, paidAmount: project.paidAmount, balanceAmount: project.balanceAmount } : {}),
    ...(kind === 'content' ? { pricing: amount } : {}),
    createdBy: user._id,
  })
  await recordActivity({ actor: user._id, action: `${kind}.work_created`, entityType: `${kind}_project`, entityId: record._id, clientId: project.clientId, projectId: project._id, description: `${kind} work record created.` })
  return record
}

export async function updateWork(kind, id, input, user) {
  const { Model, fields, writeRoles } = definitions[kind]
  const record = await Model.findById(id)
  if (!record) throw Object.assign(new Error(`${kind} record not found.`), { statusCode: 404 })
  if (user.portalType === 'client' && record.clientId.toString() !== user.clientId.toString()) throw Object.assign(new Error('Access denied.'), { statusCode: 403 })
  if (user.portalType !== 'team' || !writeRoles.includes(user.role)) throw Object.assign(new Error('Service work records are managed by authorized internal team members.'), { statusCode: 403 })
  Object.assign(record, pick(input, fields))
  record.updatedBy = user._id
  await record.save()
  await recordActivity({ actor: user._id, action: `${kind}.work_updated`, entityType: `${kind}_project`, entityId: record._id, clientId: record.clientId, projectId: record.projectId, description: `${kind} work record updated.` })
  return record
}

export async function getWork(kind, id, user) {
  const { Model } = definitions[kind]
  const filter = { _id: id }
  if (user.portalType === 'client') filter.clientId = user.clientId
  const record = await Model.findOne(filter).populate('projectId clientId serviceId')
  if (!record) throw Object.assign(new Error(`${kind} record not found.`), { statusCode: 404 })
  if (user.portalType === 'client') {
    const json = record.toJSON()
    delete json.createdBy
    delete json.updatedBy
    if (json.clientId && typeof json.clientId === 'object') json.clientId = { id: json.clientId.id, name: json.clientId.name, businessName: json.clientId.businessName }
    if (json.projectId && typeof json.projectId === 'object') json.projectId = { id: json.projectId.id, projectName: json.projectId.projectName, status: json.projectId.status }
    return json
  }
  return record
}
