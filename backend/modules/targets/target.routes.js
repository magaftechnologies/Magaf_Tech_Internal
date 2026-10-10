import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './target.controller.js'

const router = Router()
router.use(authenticate, requireTeam)
router.get('/', controller.list)
router.post('/', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.create)
router.patch('/:id', allowRoles('super_admin', 'admin', 'manager', 'finance'), objectIdParam(), validate, controller.update)
export default router
