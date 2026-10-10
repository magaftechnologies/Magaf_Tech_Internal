import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './serviceWork.controller.js'

const router = Router()
router.use(authenticate)
router.param('kind', (req, res, next, kind) => ['advertising', 'content', 'invitations', 'automation'].includes(kind) ? next() : res.status(404).json({ success: false, message: 'Unknown service work module.', errors: [] }))
router.get('/:kind/projects', controller.list)
router.get('/:kind/projects/:id', objectIdParam(), validate, controller.get)
router.post('/:kind/projects', requireTeam, controller.create)
router.patch('/:kind/projects/:id', requireTeam, objectIdParam(), validate, controller.update)
export default router
