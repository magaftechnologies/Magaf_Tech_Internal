import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { messageRules, objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './communication.controller.js'

const router = Router()
router.use(authenticate)
router.get('/conversations', controller.listConversations)
router.post('/conversations', controller.createConversation)
router.get('/conversations/:conversationId/messages', controller.listMessages)
router.post('/messages', messageRules, validate, controller.sendMessage)
router.patch('/messages/:id/read', objectIdParam(), validate, controller.markRead)
router.get('/notifications', controller.listNotifications)
router.patch('/notifications/read-all', controller.markAllNotificationsRead)
router.patch('/notifications/:id/read', objectIdParam(), validate, controller.markNotificationRead)
export default router
