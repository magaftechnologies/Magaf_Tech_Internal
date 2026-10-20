import mongoose from 'mongoose'
import { Discussion, DiscussionMessage, FileAsset, Service, User } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

const founderRoles = ['super_admin', 'admin']
const canManageAll = (user) => user.portalType === 'team' && founderRoles.includes(user.role)
const canAccess = (discussion, user) => canManageAll(user)
  || user.portalType === 'team' && discussion.participants.some((participant) => participant.equals(user._id))
const denied = () => Object.assign(new Error('Discussion not found or access denied.'), { statusCode: 404 })

async function requireDiscussion(id, user) {
  if (user.portalType !== 'team') throw denied()
  const discussion = await Discussion.findById(id)
  if (!discussion || !canAccess(discussion, user)) throw denied()
  return discussion
}

export async function listDiscussions(user) {
  if (user.portalType !== 'team') throw Object.assign(new Error('Internal service discussions are not available to clients.'), { statusCode: 403 })
  const filter = { status: { $ne: 'archived' } }
  if (!canManageAll(user)) filter.participants = user._id
  return Discussion.find(filter)
    .limit(200)
    .sort({ lastActivityAt: -1 })
    .populate('serviceId createdBy participants')
}

export async function createDiscussion(input, user) {
  if (!canManageAll(user)) throw Object.assign(new Error('Only founders can create service discussions.'), { statusCode: 403 })
  const title = String(input.title || '').trim()
  if (!title) throw Object.assign(new Error('A discussion title is required.'), { statusCode: 400 })
  if (!mongoose.isValidObjectId(input.serviceId)) throw Object.assign(new Error('Choose a valid service.'), { statusCode: 400 })
  const service = await Service.findOne({ _id: input.serviceId, isActive: true })
  if (!service) throw Object.assign(new Error('The selected service is not active.'), { statusCode: 400 })
  const requestedParticipants = [...new Set([user._id.toString(), ...(input.participants || []).map(String)])]
  if (requestedParticipants.some((id) => !mongoose.isValidObjectId(id))) {
    throw Object.assign(new Error('Discussion participants must be active internal team members.'), { statusCode: 400 })
  }
  const participants = await User.find({
    _id: { $in: requestedParticipants },
    portalType: 'team',
    isActive: true,
  }).distinct('_id')
  if (participants.length !== requestedParticipants.length) {
    throw Object.assign(new Error('Discussion participants must be active internal team members.'), { statusCode: 400 })
  }
  const discussion = await Discussion.create({
    serviceId: service._id,
    title,
    category: String(input.category || '').trim(),
    status: 'open',
    participants,
    createdBy: user._id,
    lastActivityAt: new Date(),
  })
  const initialMessage = String(input.description || '').trim()
  if (initialMessage) {
    await DiscussionMessage.create({ discussionId: discussion._id, senderId: user._id, content: initialMessage })
  }
  await recordActivity({
    actor: user._id,
    action: 'discussion.created',
    entityType: 'discussion',
    entityId: discussion._id,
    description: `Created a discussion for ${service.name}: ${title}.`,
  })
  return Discussion.findById(discussion._id).populate('serviceId createdBy participants')
}

export async function listMessages(discussionId, user) {
  const discussion = await requireDiscussion(discussionId, user)
  return DiscussionMessage.find({ discussionId: discussion._id })
    .sort({ createdAt: 1 })
    .populate('senderId attachments')
}

export async function postMessage(discussionId, input, user) {
  const discussion = await requireDiscussion(discussionId, user)
  const content = String(input.content || '').trim()
  const attachmentIds = [...new Set((input.attachments || []).map(String))]
  if (!content && !attachmentIds.length) throw Object.assign(new Error('Write a reply or attach a file.'), { statusCode: 400 })
  if (attachmentIds.some((id) => !mongoose.isValidObjectId(id))) throw Object.assign(new Error('One or more attachments are invalid.'), { statusCode: 400 })
  if (attachmentIds.length) {
    const available = await FileAsset.find({
      _id: { $in: attachmentIds },
      discussionId: discussion._id,
      visibility: 'internal',
    }).distinct('_id')
    if (available.length !== attachmentIds.length) throw Object.assign(new Error('One or more attachments are unavailable.'), { statusCode: 400 })
  }
  const message = await DiscussionMessage.create({
    discussionId: discussion._id,
    senderId: user._id,
    content,
    attachments: attachmentIds,
  })
  discussion.lastActivityAt = message.createdAt
  await discussion.save()
  await recordActivity({
    actor: user._id,
    action: 'discussion.message.created',
    entityType: 'discussion',
    entityId: discussion._id,
    description: `Added a reply to ${discussion.title}.`,
  })
  return message.populate('senderId attachments')
}

export async function updateDiscussion(id, input, user) {
  const discussion = await requireDiscussion(id, user)
  if (!canManageAll(user) && !discussion.createdBy.equals(user._id)) {
    throw Object.assign(new Error('Only the discussion creator or a founder can edit this discussion.'), { statusCode: 403 })
  }
  const previous = { title: discussion.title, status: discussion.status }
  if (input.title !== undefined) {
    const title = String(input.title).trim()
    if (!title) throw Object.assign(new Error('A discussion title is required.'), { statusCode: 400 })
    discussion.title = title
  }
  if (input.status !== undefined) {
    if (!['open', 'in_progress', 'resolved'].includes(input.status)) throw Object.assign(new Error('Choose a valid discussion status.'), { statusCode: 400 })
    discussion.status = input.status
  }
  if (input.participants !== undefined) {
    const ids = [...new Set([discussion.createdBy.toString(), ...(input.participants || []).map(String)])]
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw Object.assign(new Error('Participants must be active internal team members.'), { statusCode: 400 })
    const participants = await User.find({ _id: { $in: ids }, portalType: 'team', isActive: true }).distinct('_id')
    if (participants.length !== ids.length) throw Object.assign(new Error('Participants must be active internal team members.'), { statusCode: 400 })
    discussion.participants = participants
  }
  discussion.lastActivityAt = new Date()
  await discussion.save()
  await recordActivity({
    actor: user._id,
    action: 'discussion.updated',
    entityType: 'discussion',
    entityId: discussion._id,
    metadata: { oldValue: previous, newValue: { title: discussion.title, status: discussion.status } },
    description: `Updated discussion ${discussion.title}.`,
  })
  return discussion.populate('serviceId createdBy participants')
}

export async function updateMessage(discussionId, messageId, input, user) {
  const discussion = await requireDiscussion(discussionId, user)
  const message = await DiscussionMessage.findOne({ _id: messageId, discussionId })
  if (!message) throw Object.assign(new Error('Discussion reply not found.'), { statusCode: 404 })
  if (message.isDeleted) throw Object.assign(new Error('This reply has already been removed.'), { statusCode: 409 })
  if (!canManageAll(user) && !message.senderId.equals(user._id)) {
    throw Object.assign(new Error('You can only edit your own reply.'), { statusCode: 403 })
  }
  const content = String(input.content || '').trim()
  if (!content && !message.attachments.length) throw Object.assign(new Error('A reply cannot be empty.'), { statusCode: 400 })
  message.content = content
  message.updatedBy = user._id
  await message.save()
  discussion.lastActivityAt = new Date()
  await discussion.save()
  await recordActivity({
    actor: user._id,
    action: 'discussion.message.updated',
    entityType: 'discussion',
    entityId: discussion._id,
    description: `Edited a reply in ${discussion.title}.`,
  })
  return message.populate('senderId attachments')
}

export async function deleteMessage(discussionId, messageId, user) {
  const discussion = await requireDiscussion(discussionId, user)
  const message = await DiscussionMessage.findOne({ _id: messageId, discussionId })
  if (!message) throw Object.assign(new Error('Discussion reply not found.'), { statusCode: 404 })
  if (message.isDeleted) throw Object.assign(new Error('This reply has already been removed.'), { statusCode: 409 })
  if (!canManageAll(user) && !message.senderId.equals(user._id)) {
    throw Object.assign(new Error('You can only delete your own reply.'), { statusCode: 403 })
  }
  message.content = ''
  message.attachments = []
  message.isDeleted = true
  message.updatedBy = user._id
  await message.save()
  discussion.lastActivityAt = new Date()
  await discussion.save()
  await recordActivity({
    actor: user._id,
    action: 'discussion.message.deleted',
    entityType: 'discussion',
    entityId: discussion._id,
    description: `Removed a reply from ${discussion.title}.`,
  })
  return message.populate('senderId')
}

export async function archiveDiscussion(id, user) {
  const discussion = await requireDiscussion(id, user)
  if (!canManageAll(user) && !discussion.createdBy.equals(user._id)) {
    throw Object.assign(new Error('Only the discussion creator or a founder can archive this discussion.'), { statusCode: 403 })
  }
  discussion.status = 'archived'
  await discussion.save()
  await recordActivity({
    actor: user._id,
    action: 'discussion.archived',
    entityType: 'discussion',
    entityId: discussion._id,
    description: `Archived discussion ${discussion.title}.`,
  })
  return { id: discussion.id, status: discussion.status }
}
