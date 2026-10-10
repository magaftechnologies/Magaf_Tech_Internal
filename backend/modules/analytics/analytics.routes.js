import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { requireTeam } from '../../middleware/roleMiddleware.js'
import * as controller from './analytics.controller.js'

const router = Router()
router.use(authenticate, requireTeam)
router.get('/dashboard', controller.dashboard)
router.get('/revenue', controller.revenue)
router.get('/services', controller.services)
router.get('/clients', controller.clients)
router.get('/acquisition', controller.acquisition)
router.get('/projects', controller.projects)
router.get('/revenue/breakdown', controller.revenueBreakdown)
export default router
