import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam, requestRules } from '../../validators/businessValidators.js'
import * as controller from './projectRequest.controller.js'

const router = Router()
router.use(authenticate)
router.get('/', controller.list)
router.post('/', requestRules, validate, controller.create)
router.get('/:id', objectIdParam(), validate, controller.get)
router.patch('/:id', (req, res, next) => req.user.portalType === 'client'
  ? next()
  : allowRoles('super_admin', 'admin', 'manager', 'sales')(req, res, next), objectIdParam(), validate, controller.update)
router.post('/:id/convert', requireTeam, objectIdParam(), validate, controller.convert)
export default router
