import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { allowRoles } from '../../middleware/roleMiddleware.js'
import { companyFinancialTransactionRules, distributionReversalRules, distributionUpdateRules, founderTransferRules, objectIdParam, transferReversalRules } from '../../validators/businessValidators.js'
import * as controller from './finance.controller.js'

const router = Router()
router.use(authenticate)
router.get('/payment-accounts', allowRoles('super_admin', 'admin', 'manager', 'finance', 'client'), controller.accounts)
router.post('/payment-accounts', allowRoles('super_admin', 'admin', 'finance'), controller.createAccount)
router.patch('/payment-accounts/:id', allowRoles('super_admin', 'admin', 'finance'), objectIdParam(), controller.updateAccount)
router.get('/distributions', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.distributions)
router.get('/distributions/summary', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.distributionSummary)
router.put('/projects/:projectId/distribution-rules', allowRoles('super_admin', 'admin'), objectIdParam('projectId'), controller.distributionRules)
router.post('/projects/:projectId/distribution', allowRoles('super_admin', 'admin'), objectIdParam('projectId'), controller.finalizeProjectDistribution)
router.patch('/distributions/:id', allowRoles('super_admin', 'admin'), objectIdParam(), distributionUpdateRules, validate, controller.updateDistribution)
router.post('/distributions/:id/reversal', allowRoles('super_admin', 'admin'), objectIdParam(), distributionReversalRules, validate, controller.reverseDistribution)
router.get('/founder-transfers', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.founderTransfers)
router.post('/founder-transfers', allowRoles('super_admin', 'admin'), founderTransferRules, validate, controller.createFounderTransfer)
router.post('/founder-transfers/:id/reversal', allowRoles('super_admin', 'admin'), objectIdParam(), transferReversalRules, validate, controller.reverseFounderTransfer)
router.get('/company-transactions', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.companyTransactions)
router.post('/company-transactions', allowRoles('super_admin', 'admin'), companyFinancialTransactionRules, validate, controller.createCompanyTransaction)
router.get('/audit', allowRoles('super_admin', 'admin'), controller.audit)
export default router
