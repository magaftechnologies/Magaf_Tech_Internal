import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './mentoring.controller.js'
import * as paymentController from '../payments/payment.controller.js'
import { paymentRules } from '../../validators/businessValidators.js'

const router = Router()
router.use(authenticate, requireTeam, allowRoles('super_admin', 'admin', 'manager', 'mentor'))
router.get('/sessions', controller.list)
router.post('/sessions', controller.create)
router.patch('/sessions/:id', objectIdParam(), validate, controller.update)
router.post('/payments', allowRoles('super_admin', 'admin', 'manager', 'mentor', 'finance'), paymentRules, validate, paymentController.createMentoring)
export default router
