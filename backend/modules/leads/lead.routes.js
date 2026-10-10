import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './lead.controller.js'

const router = Router()
router.use(authenticate, requireTeam, allowRoles('super_admin', 'admin', 'manager', 'sales'))
router.post('/:id/convert', objectIdParam(), validate, controller.convert)
export default router
