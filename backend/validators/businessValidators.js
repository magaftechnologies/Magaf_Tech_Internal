import { body, param, query } from 'express-validator'
import { CLIENT_STATUSES, PAYMENT_STATUSES, PROJECT_STATUSES, REQUEST_STATUSES } from '../utils/constants.js'

export const objectIdParam = (name = 'id') => param(name).isMongoId()
export const paginationRules = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })]
export const clientRules = [
  body('name').optional().trim().isLength({ min: 2, max: 160 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('status').optional().isIn(CLIENT_STATUSES),
]
export const projectRules = [
  body('projectName').trim().isLength({ min: 2, max: 180 }),
  body('clientId').isMongoId(),
  body('serviceId').isMongoId(),
  body('status').optional().isIn(PROJECT_STATUSES),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('finalAmount').optional().isFloat({ min: 0 }),
]
export const requestRules = [
  body('projectName').trim().isLength({ min: 2, max: 180 }),
  body('serviceId').isMongoId(),
  body('description').trim().isLength({ min: 10, max: 10000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('estimatedBudget').optional().isFloat({ min: 0 }),
]
export const requestStatusRule = body('status').isIn(REQUEST_STATUSES)
export const paymentRules = [
  body('amount').isFloat({ min: 0.01 }),
  body('status').optional().isIn(PAYMENT_STATUSES),
  body('paymentMethod').optional().isIn(['cash', 'upi', 'bank_transfer', 'card', 'online', 'other']),
  body('paymentType').optional().isIn(['advance', 'milestone', 'full_payment', 'partial_payment', 'subscription', 'mentoring_fee', 'maintenance', 'other']),
  body('projectId').optional({ checkFalsy: true }).isMongoId(),
  body('studentId').optional({ checkFalsy: true }).isMongoId(),
  body('clientId').optional({ checkFalsy: true }).isMongoId(),
  body('dealId').optional({ checkFalsy: true }).isMongoId(),
  body('invoiceId').optional({ checkFalsy: true }).isMongoId(),
  body('paymentAccountId').optional({ checkFalsy: true }).isMongoId(),
  body('paymentDate').optional({ checkFalsy: true }).isISO8601(),
  body('transactionId').optional({ checkFalsy: true }).isString().trim().isLength({ max: 160 }),
  body('notes').optional({ checkFalsy: true }).isString().trim().isLength({ max: 4000 }),
  body('proofFiles').optional().isArray({ max: 5 }),
  body('proofFiles.*').optional().isMongoId(),
]
export const paymentUpdateRules = [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('status').optional().isIn(PAYMENT_STATUSES),
  body('paymentMethod').optional().isIn(['cash', 'upi', 'bank_transfer', 'card', 'online', 'other']),
  body('transactionId').optional({ checkFalsy: true }).isString().trim().isLength({ max: 160 }),
  body('paymentDate').optional({ checkFalsy: true }).isISO8601(),
  body('dueDate').optional({ checkFalsy: true }).isISO8601(),
  body('notes').optional({ checkFalsy: true }).isString().trim().isLength({ min: 3, max: 4000 }),
]
export const clientPaymentRules = [
  body('amount').isFloat({ min: 0.01 }),
  body('paymentMethod').isIn(['cash', 'upi', 'bank_transfer', 'card', 'online', 'other']),
  body('paymentType').optional().isIn(['advance', 'milestone', 'full_payment', 'partial_payment', 'subscription', 'mentoring_fee', 'maintenance', 'other']),
  body('transactionId').optional({ checkFalsy: true }).isString().trim().isLength({ max: 160 }),
  body('paymentDate').optional({ checkFalsy: true }).isISO8601(),
  body('projectId').optional({ checkFalsy: true }).isMongoId(),
  body('dealId').optional({ checkFalsy: true }).isMongoId(),
  body('invoiceId').optional({ checkFalsy: true }).isMongoId(),
  body('paymentAccountId').optional({ checkFalsy: true }).isMongoId(),
  body('proofFiles').optional().isArray({ max: 5 }),
  body('proofFiles.*').optional().isMongoId(),
]
export const paymentReviewRules = [
  body('action').isIn(['verify', 'reject', 'request_correction']),
  body('note').optional({ checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
]
export const founderTransferRules = [
  body('fromFounderId').isMongoId(),
  body('toOwnerType').optional().isIn(['founder', 'company']),
  body('toFounderId').if((value, { req }) => (req.body.toOwnerType || 'founder') === 'founder').isMongoId(),
  body('distributionId').optional({ checkFalsy: true }).isMongoId(),
  body('amount').isFloat({ min: 0.01 }),
  body('reason').optional({ checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
]
export const companyFinancialTransactionRules = [
  body('type').isIn(['external_funding', 'investment']),
  body('amount').isFloat({ min: 0.01 }),
  body('description').trim().isLength({ min: 1, max: 1000 }),
  body('currency').optional().trim().toUpperCase().equals('INR'),
  body('occurredAt').optional().isISO8601(),
  body('reference').optional({ checkFalsy: true }).isString().trim().isLength({ max: 160 }),
]
export const distributionUpdateRules = [
  body('companySharePercent').isFloat({ min: 0, max: 100 }),
  body('founderShares').isArray(),
  body('founderShares.*.userId').isMongoId(),
  body('founderShares.*.percent').isFloat({ gt: 0, max: 100 }),
  body('reason').trim().isLength({ min: 3, max: 1000 }),
]
export const distributionReversalRules = [
  body('reason').trim().isLength({ min: 3, max: 1000 }),
]
export const transferReversalRules = [
  body('reason').trim().isLength({ min: 3, max: 1000 }),
]
export const disputeReviewRules = [
  body('status').isIn(['information_requested', 'resolved', 'rejected']),
  body('response').trim().isLength({ min: 2, max: 2000 }),
]
export const disputeRules = [
  body('claimedAmount').isFloat({ min: 0 }),
  body('reference').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('explanation').trim().isLength({ min: 10, max: 4000 }),
  body('proofFiles').optional().isArray({ max: 5 }),
  body('proofFiles.*').optional().isMongoId(),
]
export const messageRules = [body('content').optional().isString().isLength({ max: 10000 }), body('messageType').optional().isIn(['text', 'image', 'video', 'audio', 'voice', 'file', 'system'])]
