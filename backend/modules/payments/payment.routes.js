import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { allowRoles } from '../../middleware/roleMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { clientPaymentRules, disputeReviewRules, disputeRules, objectIdParam, paymentReviewRules, paymentRules, paymentUpdateRules } from '../../validators/businessValidators.js'
import * as controller from './payment.controller.js'

const router = Router()
router.use(authenticate)
router.get('/summary', allowRoles('super_admin', 'admin', 'manager', 'finance'), controller.summary)
router.get('/', controller.list)
router.post('/client-submissions', allowRoles('client'), clientPaymentRules, validate, controller.submitClientPayment)
router.patch('/:id/resubmission', allowRoles('client'), objectIdParam(), clientPaymentRules, validate, controller.resubmitClientPayment)
router.post('/', allowRoles('super_admin', 'admin', 'manager', 'finance'), paymentRules, validate, controller.create)
router.patch('/:id/verification', allowRoles('super_admin', 'admin', 'manager', 'finance'), objectIdParam(), paymentReviewRules, validate, controller.verify)
router.patch('/:id/cash-approval', allowRoles('super_admin', 'admin', 'manager', 'finance'), objectIdParam(), validate, controller.approveCash)
router.post('/:id/disputes', allowRoles('client'), objectIdParam(), disputeRules, validate, controller.createDispute)
router.patch('/:id/disputes/:disputeId', allowRoles('super_admin', 'admin', 'manager', 'finance'), objectIdParam(), objectIdParam('disputeId'), disputeReviewRules, validate, controller.reviewDispute)
router.patch('/:id', allowRoles('super_admin', 'admin', 'manager', 'finance'), objectIdParam(), paymentUpdateRules, validate, controller.update)
export default router
