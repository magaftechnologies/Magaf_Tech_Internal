import { Conversation, Message, Client, Project, ProjectRequest, Notification, User, FileAsset } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

const idOf = (value) => value?.toString()

async function canAccessConversation(conversationId, user) {
  const filter = { _id: conversationId }
  if (user.portalType === 'client') filter.clientId = user.clientId
  const conversation = await Conversation.findOne(filter)
  if (!conversation) throw Object.assign(new Error('Conversation not found or access denied.'), { statusCode: 404 })
  const hasGlobalAccess = ['super_admin', 'admin'].includes(user.role)
    || conversation.conversationType !== 'internal' && user.role === 'manager'
  if (user.portalType === 'team' && !hasGlobalAccess) {
    const isParticipant = conversation.participants.some((participant) => idOf(participant.userId) === idOf(user._id))
    if (!isParticipant) throw Object.assign(new Error('You are not a participant in this conversation.'), { statusCode: 403 })
  }
  return conversation
}

export async function listConversations(user) {
  const filter = user.portalType === 'client'
    ? { conversationType: 'client', clientId: user.clientId, status: { $ne: 'archived' } }
    : { status: { $ne: 'archived' } }
  if (user.portalType === 'team' && ['super_admin', 'admin'].includes(user.role) === false) {
    if (user.role === 'manager') {
      filter.$or = [{ conversationType: { $ne: 'internal' } }, { 'participants.userId': user._id }]
    } else {
      filter['participants.userId'] = user._id
    }
  }
  const rows = await Conversation.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).populate('clientId projectId serviceId participants.userId')
  return rows.map((conversation) => {
    const json = conversation.toJSON()
    if (user.portalType === 'client') {
      delete json.participants
      if (json.clientId && typeof json.clientId === 'object') json.clientId = { id: json.clientId.id, name: json.clientId.name, businessName: json.clientId.businessName }
      if (json.projectId && typeof json.projectId === 'object') json.projectId = { id: json.projectId.id, projectName: json.projectId.projectName, status: json.projectId.status }
    }
    return json
  })
}

export async function createConversation(input, user) {
  if (user.portalType === 'team' && input.recipientId) {
    const recipient = await User.findOne({ _id: input.recipientId, portalType: 'team', isActive: true }).select('_id')
    if (!recipient) throw Object.assign(new Error('Choose an active internal team member.'), { statusCode: 400 })
    if (recipient._id.equals(user._id)) throw Object.assign(new Error('Choose another team member to start a conversation.'), { statusCode: 400 })
    const existing = await Conversation.findOne({
      conversationType: 'internal',
      status: 'open',
      participants: { $size: 2 },
      $and: [
        { 'participants.userId': user._id },
        { 'participants.userId': recipient._id },
      ],
    }).populate('participants.userId')
    if (existing) return existing
    const conversation = await Conversation.create({
      conversationType: 'internal',
      participants: [
        { userId: user._id, participantType: 'team' },
        { userId: recipient._id, participantType: 'team' },
      ],
      createdBy: user._id,
    })
    await recordActivity({ actor: user._id, action: 'conversation.created', entityType: 'conversation', entityId: conversation._id, description: 'An internal team conversation was created.' })
    return conversation.populate('participants.userId')
  }
  const clientId = user.portalType === 'client' ? user.clientId : input.clientId
  if (!clientId) throw Object.assign(new Error('clientId is required.'), { statusCode: 400 })
  const client = await Client.findById(clientId)
  if (!client) throw Object.assign(new Error('Client not found.'), { statusCode: 404 })
  let project = null
  if (input.projectId) {
    project = await Project.findOne({ _id: input.projectId, clientId })
    if (!project) throw Object.assign(new Error('Project not found for this client.'), { statusCode: 404 })
  }
  let request = null
  if (input.projectRequestId) {
    request = await ProjectRequest.findOne({ _id: input.projectRequestId, clientId })
    if (!request) throw Object.assign(new Error('Project request not found for this client.'), { statusCode: 404 })
  }
  if (project && request && project.requestId?.toString() !== request._id.toString()) throw Object.assign(new Error('Project and request are not related.'), { statusCode: 400 })
  const existing = await Conversation.findOne({
    clientId,
    projectId: project?._id || null,
    projectRequestId: project ? null : request?._id || null,
    serviceId: input.serviceId || project?.serviceId || request?.serviceId || null,
    status: 'open',
  })
  if (existing) return existing
  const teamMemberIds = new Set([
    user.portalType === 'team' ? idOf(user._id) : null,
    ...(project?.assignedTeamMembers || []).map(idOf),
    project?.projectManager ? idOf(project.projectManager) : null,
    ...(client.assignedTeamMembers || []).map(idOf),
  ].filter(Boolean))
  const team = teamMemberIds.size
    ? await User.find({ _id: { $in: [...teamMemberIds] }, portalType: 'team', isActive: true }).select('_id')
    : []
  const clientUserId = client.userId || (user.portalType === 'client' ? user._id : null)
  const participants = [
    ...(clientUserId ? [{ userId: clientUserId, participantType: 'client' }] : []),
    ...team.map(({ _id }) => ({ userId: _id, participantType: 'team' })),
  ]
  const conversation = await Conversation.create({
    conversationType: 'client',
    clientId,
    projectId: project?._id,
    projectRequestId: project ? undefined : request?._id,
    serviceId: input.serviceId || project?.serviceId || request?.serviceId,
    participants,
    createdBy: user._id,
  })
  await recordActivity({ actor: user._id, action: 'conversation.created', entityType: 'conversation', entityId: conversation._id, clientId, projectId: project?._id, description: 'A client conversation was created.' })
  return conversation
}

export async function listMessages(conversationId, user, query = {}) {
  const conversation = await canAccessConversation(conversationId, user)
  const filter = { conversationId: conversation._id }
  if (user.portalType === 'client') filter.clientId = user.clientId
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 100))
  const rows = await Message.find(filter).sort({ createdAt: 1 }).limit(limit).populate('senderId attachments readReceipts.userId')
  return rows.map((message) => {
    const json = message.toJSON()
    if (user.portalType === 'client') {
      if (json.senderId && typeof json.senderId === 'object') json.senderId = { id: json.senderId.id, name: json.senderId.name }
      json.attachments = (json.attachments || []).map((file) => ({
        id: file.id || file._id?.toString(),
        fileName: file.fileName,
        originalName: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        cloudinaryUrl: file.cloudinaryUrl,
      }))
      json.readReceipts = json.readReceipts.filter((receipt) => receipt.userId?.portalType === 'client')
      if (message.senderType === 'client') {
        const teamReads = message.readReceipts.filter((receipt) => idOf(receipt.userId) !== idOf(user._id))
        json.teamReadCount = teamReads.length
        json.readReceipts = []
      }
    }
    return json
  })
}

export async function sendMessage(input, user) {
  const conversation = await canAccessConversation(input.conversationId, user)
  const senderType = user.portalType
  if (senderType === 'client' && !conversation.clientId.equals(user.clientId)) throw Object.assign(new Error('Access denied.'), { statusCode: 403 })
  const content = String(input.content || '').trim()
  if (!content && !(input.attachments || []).length) throw Object.assign(new Error('A message must contain text or an attachment.'), { statusCode: 400 })
  const attachmentIds = input.attachments || []
  if (attachmentIds.length) {
    const attachmentFilter = senderType === 'client'
      ? { clientId: user.clientId, visibility: 'client' }
      : conversation.conversationType === 'internal'
        ? { conversationId: conversation._id }
        : {
          $or: [
            { conversationId: conversation._id },
            ...(conversation.projectId ? [{ projectId: conversation.projectId }] : []),
            ...(conversation.projectRequestId ? [{ projectRequestId: conversation.projectRequestId }] : []),
          ],
        }
    const attachments = await FileAsset.find({ _id: { $in: attachmentIds }, ...attachmentFilter })
    if (attachments.length !== attachmentIds.length) throw Object.assign(new Error('One or more attachments are unavailable.'), { statusCode: 400 })
  }
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user._id,
    senderType,
    recipientType: senderType === 'client' || conversation.conversationType === 'internal' ? 'team' : 'client',
    clientId: conversation.clientId,
    projectId: conversation.projectId,
    messageType: input.messageType || 'text',
    content,
    attachments: attachmentIds,
    status: 'sent',
  })
  conversation.lastMessage = content || 'Attachment'
  conversation.lastMessageAt = message.createdAt
  await conversation.save()
  const teamParticipantIds = conversation.participants
    .filter((participant) => participant.participantType === 'team')
    .map((participant) => participant.userId)
  const recipients = conversation.conversationType === 'internal'
    ? await User.find({ _id: { $in: conversation.participants.map((participant) => participant.userId).filter((participantId) => !participantId.equals(user._id)) }, isActive: true }).select('_id')
    : senderType === 'client'
    ? await User.find({
      portalType: 'team',
      isActive: true,
      $or: [
        { _id: { $in: teamParticipantIds } },
        { role: { $in: ['super_admin', 'admin', 'manager'] } },
      ],
    }).select('_id')
    : await User.findOne({ portalType: 'client', clientId: conversation.clientId, isActive: true }).select('_id')
  const recipientList = Array.isArray(recipients) ? recipients : recipients ? [recipients] : []
  if (recipientList.length) {
    await Notification.insertMany(recipientList.map(({ _id }) => ({
      recipient: _id,
      type: 'message',
      title: 'New message',
      message: content.slice(0, 180) || 'An attachment was shared.',
      relatedEntity: 'conversation',
      relatedEntityId: conversation._id,
    })))
  }
  await recordActivity({ actor: user._id, action: 'message.sent', entityType: 'message', entityId: message._id, clientId: conversation.clientId, projectId: conversation.projectId, description: 'A message was sent.' })
  return message.populate('senderId attachments')
}

export async function markRead(messageId, user) {
  const message = await Message.findById(messageId).populate('conversationId')
  if (!message || !message.conversationId) throw Object.assign(new Error('Message not found.'), { statusCode: 404 })
  await canAccessConversation(message.conversationId._id, user)
  const isSender = message.senderId.equals(user._id)
  const receiptRoleMatches = message.conversationId.conversationType === 'internal'
    ? user.portalType === 'team'
    : message.senderType === 'client' ? user.portalType === 'team' : user.portalType === 'client'
  if (isSender || !receiptRoleMatches) throw Object.assign(new Error('Only the recipient side can mark this message as read.'), { statusCode: 403 })
  const alreadyRead = message.readReceipts.some((receipt) => idOf(receipt.userId) === idOf(user._id))
  if (!alreadyRead) {
    message.readReceipts.push({ userId: user._id, readAt: new Date() })
    if (message.senderType === 'client' && user.portalType === 'team') message.status = 'read'
    if (message.senderType === 'team') message.status = 'read'
    await message.save()
    await recordActivity({ actor: user._id, action: 'message.read', entityType: 'message', entityId: message._id, clientId: message.clientId, projectId: message.projectId, description: 'A message was read.' })
  }
  return message
}

export async function listMyNotifications(user, query = {}) {
  const filter = { recipient: user._id }
  if (query.unread === 'true') filter.isRead = false
  return Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Number.parseInt(query.limit, 10) || 50))
}

export async function markNotificationRead(id, user) {
  const notification = await Notification.findOne({ _id: id, recipient: user._id })
  if (!notification) throw Object.assign(new Error('Notification not found.'), { statusCode: 404 })
  notification.isRead = true
  notification.readAt ||= new Date()
  await notification.save()
  return notification
}

export async function markAllNotificationsRead(user) {
  const result = await Notification.updateMany({ recipient: user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } })
  return { modifiedCount: result.modifiedCount }
}
