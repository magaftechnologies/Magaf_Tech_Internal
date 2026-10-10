import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes.js'
import resourceRoutes from '../modules/resources/resource.routes.js'
import requestRoutes from '../modules/requests/projectRequest.routes.js'
import paymentRoutes from '../modules/payments/payment.routes.js'
import fileRoutes from '../modules/files/file.routes.js'
import communicationRoutes from '../modules/communication/communication.routes.js'
import analyticsRoutes from '../modules/analytics/analytics.routes.js'
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js'
import mentoringRoutes from '../modules/mentoring/mentoring.routes.js'
import targetRoutes from '../modules/targets/target.routes.js'
import serviceWorkRoutes from '../modules/serviceWork/serviceWork.routes.js'
import leadRoutes from '../modules/leads/lead.routes.js'
import financeRoutes from '../modules/finance/finance.routes.js'

const router = Router()
router.use('/auth', authRoutes)
router.use('/project-requests', requestRoutes)
router.use('/leads', leadRoutes)
router.use('/payments', paymentRoutes)
router.use('/finance', financeRoutes)
router.use('/files', fileRoutes)
router.use(communicationRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/mentoring', mentoringRoutes)
router.use('/mentoring', resourceRoutes)
router.use('/targets', targetRoutes)
router.use(serviceWorkRoutes)
router.use(resourceRoutes)
export default router
