import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { requireClient, requireTeam } from '../../middleware/roleMiddleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as analytics from '../analytics/analytics.service.js'

const router = Router()
router.use(authenticate)
router.get('/summary', requireTeam, asyncHandler(async (_req, res) => success(res, await analytics.dashboardSummary(), 'Dashboard summary retrieved.')))
router.get('/client', requireClient, asyncHandler(async (req, res) => success(res, await analytics.clientDashboardSummary(req.user), 'Client dashboard retrieved.')))
router.get('/revenue', requireTeam, asyncHandler(async (req, res) => success(res, await analytics.revenueTimeSeries(req.query), 'Revenue series retrieved.')))
router.get('/services', requireTeam, asyncHandler(async (_req, res) => success(res, await analytics.serviceAnalytics(), 'Service analytics retrieved.')))
router.get('/clients', requireTeam, asyncHandler(async (_req, res) => success(res, await analytics.clientAnalytics(), 'Client analytics retrieved.')))
router.get('/projects', requireTeam, asyncHandler(async (_req, res) => success(res, await analytics.projectAnalytics(), 'Project analytics retrieved.')))
export default router
