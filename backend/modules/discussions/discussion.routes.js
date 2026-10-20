import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './discussion.controller.js'

const router = Router()
router.use(authenticate)
router.get('/', controller.list)
router.post('/', controller.create)
router.get('/:id/messages', objectIdParam('id'), validate, controller.messages)
router.post('/:id/messages', objectIdParam('id'), validate, controller.postMessage)
router.patch('/:id/messages/:messageId', objectIdParam('id'), objectIdParam('messageId'), validate, controller.updateMessage)
router.delete('/:id/messages/:messageId', objectIdParam('id'), objectIdParam('messageId'), validate, controller.deleteMessage)
router.patch('/:id', objectIdParam('id'), validate, controller.update)
router.delete('/:id', objectIdParam('id'), validate, controller.archive)
export default router
