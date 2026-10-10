import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './communication.service.js'

export const listConversations = asyncHandler(async (req, res) => success(res, await service.listConversations(req.user), 'Conversations retrieved.'))
export const createConversation = asyncHandler(async (req, res) => success(res, await service.createConversation(req.body, req.user), 'Conversation ready.', 201))
export const listMessages = asyncHandler(async (req, res) => success(res, await service.listMessages(req.params.conversationId, req.user, req.query), 'Messages retrieved.'))
export const sendMessage = asyncHandler(async (req, res) => success(res, await service.sendMessage(req.body, req.user), 'Message sent.', 201))
export const markRead = asyncHandler(async (req, res) => success(res, await service.markRead(req.params.id, req.user), 'Message marked as read.'))
export const listNotifications = asyncHandler(async (req, res) => success(res, await service.listMyNotifications(req.user, req.query), 'Notifications retrieved.'))
export const markNotificationRead = asyncHandler(async (req, res) => success(res, await service.markNotificationRead(req.params.id, req.user), 'Notification marked as read.'))
export const markAllNotificationsRead = asyncHandler(async (req, res) => success(res, await service.markAllNotificationsRead(req.user), 'Notifications marked as read.'))
