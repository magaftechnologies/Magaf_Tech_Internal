import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam, paginationRules } from '../../validators/businessValidators.js'
import * as controller from './resource.controller.js'
import { resources, rolesFor, writeRolesFor } from './resource.service.js'

const router = Router()
router.use(authenticate)
router.get('/team-members', requireTeam, controller.teamMembers)
router.param('resource', (req, res, next, resource) => {
  if (!resources[resource]) return res.status(404).json({ success: false, message: 'Unknown resource.', errors: [] })
  return next()
})
router.get('/:resource', (req, res, next) => allowRoles(...rolesFor(req.params.resource))(req, res, next), paginationRules, validate, controller.list)
router.get('/:resource/:id', (req, res, next) => allowRoles(...rolesFor(req.params.resource))(req, res, next), objectIdParam(), validate, controller.get)
router.post('/:resource', (req, res, next) => allowRoles(...writeRolesFor(req.params.resource))(req, res, next), controller.create)
router.patch('/:resource/:id', (req, res, next) => allowRoles(...[...writeRolesFor(req.params.resource), ...(req.params.resource === 'clients' || req.params.resource === 'projects' ? ['client'] : [])])(req, res, next), objectIdParam(), validate, controller.update)
router.delete('/:resource/:id', (req, res, next) => allowRoles(...writeRolesFor(req.params.resource))(req, res, next), objectIdParam(), validate, controller.remove)
export default router
