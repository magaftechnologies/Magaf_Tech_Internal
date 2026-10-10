import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import { Student } from '../../models/index.js'
import * as service from './payment.service.js'

export const list = asyncHandler(async (req, res) => {
  const result = await service.listPayments(req.user, req.query)
  return success(res, result.items, 'Payments retrieved.', 200, result.pagination)
})
export const create = asyncHandler(async (req, res) => success(res, await service.recordPayment(req.body, req.user), 'Payment recorded.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updatePayment(req.params.id, req.body, req.user), 'Payment updated.'))
export const submitClientPayment = asyncHandler(async (req, res) => success(res, await service.submitClientPayment(req.body, req.user), 'Payment submitted for verification.', 201))
export const resubmitClientPayment = asyncHandler(async (req, res) => success(res, await service.resubmitClientPayment(req.params.id, req.body, req.user), 'Payment resubmitted for verification.'))
export const verify = asyncHandler(async (req, res) => success(res, await service.reviewPayment(req.params.id, req.body, req.user), 'Payment review saved.'))
export const approveCash = asyncHandler(async (req, res) => success(res, await service.approveCashPayment(req.params.id, req.user), 'Cash payment approved.'))
export const createDispute = asyncHandler(async (req, res) => success(res, await service.createPaymentDispute(req.params.id, req.body, req.user), 'Payment issue submitted.', 201))
export const reviewDispute = asyncHandler(async (req, res) => success(res, await service.reviewPaymentDispute(req.params.id, req.params.disputeId, req.body, req.user), 'Payment issue updated.'))
export const summary = asyncHandler(async (_req, res) => success(res, await service.summary(), 'Payment summary retrieved.'))
export const createMentoring = asyncHandler(async (req, res) => {
  if (!req.body.studentId) throw Object.assign(new Error('studentId is required for mentoring payments.'), { statusCode: 400 })
  const student = await Student.findById(req.body.studentId)
  if (!student) throw Object.assign(new Error('Mentoring student not found.'), { statusCode: 404 })
  return success(res, await service.recordPayment({ ...req.body, serviceId: student.serviceId, paymentType: 'mentoring_fee' }, req.user), 'Mentoring payment recorded.', 201)
})
