import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { v2 as cloudinary } from 'cloudinary'
import { cloudinary as configuredCloudinary } from '../../config/cloudinary.js'
import { env } from '../../config/environment.js'
import { Client, FileAsset, Notification, Payment, Project, ProjectRequest, Service, User } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

const resourceTypeFor = (mime) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') || mime.startsWith('audio/') ? 'video' : 'raw'
const folderFor = (file) => {
  if (file.projectId) return `magaf/projects/${file.projectId}`
  if (file.projectRequestId) return `magaf/project-requests/${file.projectRequestId}`
  if (file.ownerType === 'student') return `magaf/mentoring/${file.ownerId}`
  if (file.clientId) return `magaf/clients/${file.clientId}`
  return 'magaf/internal'
}
const extensionCategory = (file) => {
  if (/\.zip$/i.test(file.originalname) || /zip/i.test(file.mimetype)) return 'archive'
  if (file.mimetype.startsWith('image/')) return 'input'
  if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) return 'reference'
  if (file.mimetype === 'application/pdf') return 'requirement'
  return 'other'
}

function uploadName(file, category, index) {
  if (category !== 'payment_proof') return file.originalname
  const extension = path.extname(file.originalname).replace(/[^\w.]/g, '').slice(0, 12)
  const day = new Date().toISOString().slice(0, 10)
  return `MAGAF_Payment_Proof_${day}_v${index + 1}${extension}`
}

async function uploadBuffer(file, folder, fileName) {
  if (!env.cloudinaryConfigured) throw Object.assign(new Error('Cloudinary is not configured. Set the Cloudinary environment variables before uploading files.'), { statusCode: 503 })
  return new Promise((resolve, reject) => {
    const stream = configuredCloudinary.uploader.upload_stream({
      folder,
      resource_type: resourceTypeFor(file.mimetype),
      filename_override: fileName,
      use_filename: true,
      unique_filename: true,
      context: { originalName: file.originalname },
    }, (error, result) => error ? reject(error) : resolve(result))
    stream.end(file.buffer)
  })
}

async function syncPaymentProofStatuses(files) {
  const linkedProofs = files.filter((file) => file.category === 'payment_proof' && file.paymentId)
  if (!linkedProofs.length) return
  const payments = await Payment.find({ _id: { $in: linkedProofs.map((file) => file.paymentId) } }).select('status')
  const paymentStatusById = new Map(payments.map((payment) => [payment.id, payment.status]))
  const updates = new Map()
  for (const file of linkedProofs) {
    const paymentStatus = paymentStatusById.get(String(file.paymentId))
    const approvalStatus = paymentStatus === 'paid'
      ? 'approved'
      : ['rejected', 'correction_requested'].includes(paymentStatus)
        ? 'changes_requested'
        : paymentStatus ? 'pending' : null
    if (!approvalStatus || file.approvalStatus === approvalStatus) continue
    file.approvalStatus = approvalStatus
    if (!updates.has(approvalStatus)) updates.set(approvalStatus, [])
    updates.get(approvalStatus).push(file._id)
  }
  await Promise.all([...updates].map(([approvalStatus, ids]) => FileAsset.updateMany(
    { _id: { $in: ids } },
    { $set: { approvalStatus } },
  )))
}

async function linkedEntities(input, user) {
  const clientId = user.portalType === 'client' ? user.clientId : input.clientId
  let project = null
  let request = null
  if (input.projectId) {
    project = await Project.findOne({ _id: input.projectId, ...(user.portalType === 'client' ? { clientId } : {}) })
    if (!project) throw Object.assign(new Error('Project not found or access denied.'), { statusCode: 404 })
  }
  if (input.projectRequestId) {
    request = await ProjectRequest.findOne({ _id: input.projectRequestId, ...(user.portalType === 'client' ? { clientId } : {}) })
    if (!request) throw Object.assign(new Error('Project request not found or access denied.'), { statusCode: 404 })
  }
  if (!project && !request && user.portalType === 'client' && !(input.category === 'payment_proof' && clientId)) {
    throw Object.assign(new Error('Client uploads must be associated with their project, request, or payment proof.'), { statusCode: 400 })
  }
  return { clientId: clientId || project?.clientId || request?.clientId, project, request }
}

export async function uploadFiles(files, input, user) {
  if (!files?.length) throw Object.assign(new Error('Select at least one file to upload.'), { statusCode: 400 })
  const entities = await linkedEntities(input, user)
  const uploaded = []
  const cloudinaryObjects = []
  try {
    for (const [index, file] of files.entries()) {
      const folder = folderFor({ ...entities, ownerType: user.portalType === 'client' ? 'client' : 'team', ownerId: user._id })
      const normalizedName = uploadName(file, input.category, index)
      const result = await uploadBuffer(file, folder, normalizedName)
      cloudinaryObjects.push({ publicId: result.public_id, resourceType: result.resource_type })
      const visibility = input.visibility && user.portalType === 'team' ? input.visibility : user.portalType === 'client' ? 'client' : 'internal'
      const record = await FileAsset.create({
        fileCode: `FILE-${randomBytes(3).toString('hex').toUpperCase()}`,
        ownerType: user.portalType,
        ownerId: user._id,
        projectId: entities.project?._id,
        projectRequestId: entities.request?._id,
        clientId: entities.clientId,
        serviceId: entities.project?.serviceId || entities.request?.serviceId,
        uploadedBy: user._id,
        uploadSource: user.portalType === 'client' ? 'client_portal' : 'internal_admin',
        category: input.category || extensionCategory(file),
        fileType: file.mimetype.split('/')[0],
        mimeType: file.mimetype,
        fileName: input.category === 'payment_proof' ? normalizedName : result.original_filename || file.originalname,
        originalName: file.originalname,
        cloudinaryPublicId: result.public_id,
        cloudinaryUrl: result.secure_url,
        resourceType: result.resource_type,
        size: result.bytes,
        folder,
        description: input.description,
        visibility,
      })
      uploaded.push(record)
    }
  } catch (error) {
    await Promise.all(uploaded.map((record) => record.deleteOne()))
    await Promise.all(cloudinaryObjects.map(({ publicId, resourceType }) => configuredCloudinary.uploader.destroy(publicId, { resource_type: resourceType })))
    throw error
  }
  for (const record of uploaded) {
    await recordActivity({ actor: user._id, action: 'file.uploaded', entityType: 'file', entityId: record._id, clientId: record.clientId, projectId: record.projectId, description: `${record.originalName} uploaded.` })
    const recipient = user.portalType === 'client'
      ? null
      : await Client.findById(record.clientId).select('userId')
    if (user.portalType === 'client') {
      const team = await User.find({ portalType: 'team', isActive: true, role: { $in: ['super_admin', 'admin', 'manager', 'team_member'] } }).select('_id')
      if (team.length) await Notification.insertMany(team.map(({ _id }) => ({
        recipient: _id, type: 'file_uploaded', title: 'Client uploaded a file',
        message: record.originalName, relatedEntity: 'file', relatedEntityId: record._id,
      })))
    } else if (record.visibility === 'client' && recipient?.userId) {
      await Notification.create({ recipient: recipient.userId, type: 'file_uploaded', title: 'A project file was added', message: record.originalName, relatedEntity: 'file', relatedEntityId: record._id })
    }
  }
  return uploaded
}

export async function createExternalLink(input, user) {
  if (!/^https:\/\//i.test(input.url || '')) throw Object.assign(new Error('External links must use HTTPS.'), { statusCode: 400 })
  const entities = await linkedEntities(input, user)
  const serviceId = entities.project?.serviceId || entities.request?.serviceId
  if (input.serviceId && await Service.exists({ _id: input.serviceId })) input.serviceId = input.serviceId
  const record = await FileAsset.create({
    fileCode: `LINK-${randomBytes(3).toString('hex').toUpperCase()}`,
    ownerType: user.portalType,
    ownerId: user._id,
    projectId: entities.project?._id,
    projectRequestId: entities.request?._id,
    clientId: entities.clientId,
    serviceId: serviceId || input.serviceId,
    uploadedBy: user._id,
    category: input.category || 'reference',
    fileType: 'link',
    mimeType: 'text/uri-list',
    fileName: input.title,
    originalName: input.title,
    cloudinaryPublicId: `external:${randomBytes(8).toString('hex')}`,
    cloudinaryUrl: input.url,
    resourceType: 'raw',
    folder: folderFor({ ...entities, ownerType: user.portalType, ownerId: user._id }),
    description: input.description,
    visibility: user.portalType === 'client' ? 'client' : input.visibility || 'internal',
  })
  await recordActivity({ actor: user._id, action: 'file.linked', entityType: 'file', entityId: record._id, clientId: record.clientId, projectId: record.projectId, description: `${record.fileName} link added.` })
  return record
}

export async function listFiles(user, query = {}) {
  const filter = user.portalType === 'client' ? { clientId: user.clientId, visibility: 'client' } : {}
  for (const field of ['projectId', 'projectRequestId', 'category']) if (query[field]) filter[field] = query[field]
  const files = await FileAsset.find(filter).sort({ createdAt: -1 }).populate('uploadedBy clientId projectId')
  await syncPaymentProofStatuses(files)
  if (user.portalType !== 'client') return files
  return files.map((file) => sanitizeClientFile(file))
}

export async function getFile(id, user) {
  const filter = { _id: id }
  if (user.portalType === 'client') Object.assign(filter, { clientId: user.clientId, visibility: 'client' })
  const file = await FileAsset.findOne(filter)
  if (!file) throw Object.assign(new Error('File not found or access denied.'), { statusCode: 404 })
  await syncPaymentProofStatuses([file])
  return user.portalType === 'client' ? sanitizeClientFile(file) : file
}

export async function updateFile(id, input, user) {
  const file = await FileAsset.findOne({ _id: id, ...(user.portalType === 'client' ? { clientId: user.clientId, visibility: 'client' } : {}) })
  if (!file) throw Object.assign(new Error('File not found or access denied.'), { statusCode: 404 })
  if (file.category === 'payment_proof' && (input.approvalStatus !== undefined || input.category !== undefined)) {
    throw Object.assign(new Error('Payment proof status and category are managed by the payment workflow.'), { statusCode: 409 })
  }
  const requestedStatus = input.approvalStatus
  if (user.portalType === 'client' && !['approved', 'changes_requested'].includes(requestedStatus)) {
    throw Object.assign(new Error('Clients can approve a shared deliverable or request changes.'), { statusCode: 403 })
  }
  if (requestedStatus !== undefined) {
    if (!['pending', 'approved', 'changes_requested', 'final'].includes(requestedStatus)) throw Object.assign(new Error('Invalid file approval status.'), { statusCode: 400 })
    file.approvalStatus = requestedStatus
  }
  if (input.clientFeedback !== undefined && user.portalType === 'client') file.clientFeedback = String(input.clientFeedback).slice(0, 2000)
  if (user.portalType === 'team' && input.visibility !== undefined) {
    if (!['internal', 'client', 'public_if_required'].includes(input.visibility)) throw Object.assign(new Error('Invalid file visibility.'), { statusCode: 400 })
    file.visibility = input.visibility
  }
  if (user.portalType === 'team' && input.category !== undefined) file.category = input.category
  await file.save()
  await recordActivity({ actor: user._id, action: 'file.approval_updated', entityType: 'file', entityId: file._id, clientId: file.clientId, projectId: file.projectId, description: `File ${file.fileName} approval status: ${file.approvalStatus}.` })
  return user.portalType === 'client' ? sanitizeClientFile(file) : file
}

function sanitizeClientFile(file) {
  const json = file.toJSON()
  delete json.ownerId
  delete json.uploadedBy
  if (json.clientId && typeof json.clientId === 'object') json.clientId = { id: json.clientId.id, name: json.clientId.name }
  if (json.projectId && typeof json.projectId === 'object') json.projectId = { id: json.projectId.id, projectName: json.projectId.projectName, status: json.projectId.status }
  return json
}

export async function deleteFile(id, user) {
  const file = await FileAsset.findOne({ _id: id, ...(user.portalType === 'client' ? { clientId: user.clientId, visibility: 'client' } : {}) })
  if (!file) throw Object.assign(new Error('File not found or access denied.'), { statusCode: 404 })
  if (user.portalType === 'client' && file.ownerId.toString() !== user._id.toString()) throw Object.assign(new Error('You cannot delete this file.'), { statusCode: 403 })
  if (file.paymentId || await Payment.exists({ proofFiles: file._id })) {
    throw Object.assign(new Error('Payment evidence is part of the financial record and cannot be deleted.'), { statusCode: 409 })
  }
  if (user.portalType === 'team' && file.cloudinaryPublicId.startsWith('external:')) {
    await file.deleteOne()
  } else {
    if (!file.cloudinaryPublicId.startsWith('external:')) await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: file.resourceType })
    await file.deleteOne()
  }
  await recordActivity({ actor: user._id, action: 'file.deleted', entityType: 'file', entityId: file._id, clientId: file.clientId, projectId: file.projectId, description: `${file.originalName} removed.` })
  return { id: file._id }
}
