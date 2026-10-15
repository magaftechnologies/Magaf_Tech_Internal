import { randomBytes } from 'node:crypto'
import { AdvertisingProject, Client, Deal, FileAsset, Invoice, Notification, Payment, PaymentAccount, Project, RevenueDistribution, Service, Student, User } from '../../models/index.js'
import { balanceFor, paymentStatusFor } from '../../utils/calculations.js'
import { recordActivity } from '../../utils/audit.js'
import { financialSnapshot, recordFinanceAudit } from '../../utils/financeAudit.js'
import { paginationFromQuery, paginationMeta } from '../../utils/pagination.js'
import { withProjectFinanceLock } from '../finance/finance.service.js'

async function refreshProject(projectId) {
  const project = await Project.findById(projectId)
  if (!project) return null
  const paidPayments = await Payment.find({ projectId: project._id, status: 'paid' })
    .select('_id amount createdAt paymentDate verifiedAt cashApprovedAt')
  project.paidAmount = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const amount = project.finalAmount ?? project.quotedAmount ?? project.budget ?? 0
  project.balanceAmount = balanceFor(amount, project.paidAmount)
  project.paymentStatus = paymentStatusFor(amount, project.paidAmount, project.deadline && new Date(project.deadline) < new Date())
  const orderedPayments = paidPayments.sort((left, right) => {
    const actionTime = (payment) => new Date(payment.verifiedAt || payment.cashApprovedAt || payment.createdAt || payment.paymentDate || 0).getTime()
    return actionTime(left) - actionTime(right) || new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
  })
  let cumulative = 0
  let finalPaymentId = null
  if (Number(amount) > 0) {
    for (const payment of orderedPayments) {
      cumulative += Number(payment.amount || 0)
      if (Math.round(cumulative * 100) >= Math.round(Number(amount) * 100)) {
        finalPaymentId = payment._id
        break
      }
    }
  }
  project.finalPaymentId = finalPaymentId
  await project.save()
  await Payment.updateMany({ projectId: project._id, isFinalPayment: true }, { $set: { isFinalPayment: false } })
  if (finalPaymentId) await Payment.updateOne({ _id: finalPaymentId }, { $set: { isFinalPayment: true } })
  await AdvertisingProject.updateOne({ projectId: project._id }, { $set: { quotedAmount: amount, paidAmount: project.paidAmount, balanceAmount: project.balanceAmount } })
  const invoices = await Invoice.find({ projectId: project._id, status: { $nin: ['cancelled', 'draft'] } })
  for (const invoice of invoices) {
    const [invoicePayments] = await Payment.aggregate([
      { $match: { invoiceId: invoice._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const paid = invoicePayments?.total ?? (invoices.length === 1 ? project.paidAmount : 0)
    invoice.status = paid >= invoice.amount ? 'paid' : paid > 0 ? 'partially_paid' : 'issued'
    await invoice.save()
  }
  return project
}

async function refreshInvoice(invoiceId) {
  if (!invoiceId) return
  const invoice = await Invoice.findById(invoiceId)
  if (!invoice || ['cancelled', 'draft'].includes(invoice.status)) return
  const [paid] = await Payment.aggregate([
    { $match: { invoiceId: invoice._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  invoice.status = (paid?.total || 0) >= invoice.amount ? 'paid' : (paid?.total || 0) > 0 ? 'partially_paid' : 'issued'
  await invoice.save()
}

async function syncAll(payment) {
  if (payment.projectId) await refreshProject(payment.projectId)
  await refreshInvoice(payment.invoiceId)
  if (payment.studentId) {
    const paid = await Payment.aggregate([{ $match: { studentId: payment.studentId, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    await Student.findByIdAndUpdate(payment.studentId, { $set: { paidAmount: paid[0]?.total || 0 } })
  }
}

async function setPaymentProofApproval(payment, approvalStatus) {
  const proofIds = (payment.proofFiles || []).map((file) => file?._id || file)
  if (!proofIds.length) return
  await FileAsset.updateMany(
    { _id: { $in: proofIds }, category: 'payment_proof' },
    { $set: { approvalStatus } },
  )
}

async function validateClientProofFiles(fileIds, clientId) {
  const ids = [...new Set((fileIds || []).map(String))]
  if (!ids.length) return []
  const valid = await FileAsset.find({
    _id: { $in: ids },
    clientId,
    ownerType: 'client',
    visibility: 'client',
    category: 'payment_proof',
  }).distinct('_id')
  if (valid.length !== ids.length) {
    throw Object.assign(new Error('Payment proof must use files uploaded by you as payment proof.'), { statusCode: 400 })
  }
  return valid
}

async function validateTeamProofFiles(fileIds, clientId, projectId) {
  const ids = [...new Set((fileIds || []).map(String))]
  if (!ids.length) return []
  const query = {
    _id: { $in: ids },
    category: 'payment_proof',
    ownerType: { $in: ['team', 'client'] },
  }
  if (projectId) query.projectId = projectId
  else if (clientId) query.clientId = clientId
  const valid = await FileAsset.find(query).distinct('_id')
  if (valid.length !== ids.length) {
    throw Object.assign(new Error('Payment proof must be an uploaded payment-proof file linked to this client or project.'), { statusCode: 400 })
  }
  return valid
}

export async function listPayments(user, query) {
  const { page, limit, skip } = paginationFromQuery(query)
  const filter = user.portalType === 'client' ? { clientId: user.clientId } : {}
  for (const field of ['status', 'projectId', 'dealId', 'invoiceId', 'serviceId', 'studentId']) if (query[field]) filter[field] = query[field]
  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit)
      .populate('clientId projectId serviceId studentId recordedBy proofFiles')
      .populate('submittedBy reviewedBy approvedBy verifiedBy cashApprovedBy')
      .populate('dealId', 'dealCode title status')
      .populate('invoiceId', 'invoiceCode amount status dueDate'),
    Payment.countDocuments(filter),
  ])
  const items = user.portalType === 'client' ? payments.map((payment) => {
    const json = payment.toJSON()
    delete json.recordedBy
    delete json.updatedBy
    delete json.reviewedBy
    delete json.reviewedAt
    delete json.approvedBy
    delete json.notes
    delete json.paymentHistory
    delete json.verifiedBy
    delete json.cashApprovedBy
    delete json.receivingAccount
    json.disputes = (json.disputes || []).map((dispute) => {
      delete dispute.reviewedBy
      return dispute
    })
    if (json.clientId && typeof json.clientId === 'object') json.clientId = { id: json.clientId.id, name: json.clientId.name, businessName: json.clientId.businessName }
    if (json.projectId && typeof json.projectId === 'object') json.projectId = { id: json.projectId.id, projectName: json.projectId.projectName, status: json.projectId.status }
    if (json.dealId && typeof json.dealId === 'object') json.dealId = { id: json.dealId.id, dealCode: json.dealId.dealCode, title: json.dealId.title, status: json.dealId.status }
    if (json.invoiceId && typeof json.invoiceId === 'object') json.invoiceId = { id: json.invoiceId.id, invoiceCode: json.invoiceId.invoiceCode, amount: json.invoiceId.amount, status: json.invoiceId.status, dueDate: json.invoiceId.dueDate }
    delete json.studentId
    return json
  }) : payments
  return { items, pagination: paginationMeta(total, page, limit) }
}

export async function submitClientPayment(input, user) {
  if (user.portalType !== 'client' || !user.clientId) {
    throw Object.assign(new Error('Client portal access is required.'), { statusCode: 403 })
  }
  const cashPayment = input.paymentMethod === 'cash'
  const proofFiles = await validateClientProofFiles(input.proofFiles, user.clientId)
  if (input.paymentMethod !== 'cash' && !proofFiles.length) {
    throw Object.assign(new Error('Upload payment proof for non-cash payments.'), { statusCode: 400 })
  }
  let paymentAccount = null
  if (input.paymentAccountId) {
    paymentAccount = await PaymentAccount.findOne({ _id: input.paymentAccountId, isActive: true })
    if (!paymentAccount) throw Object.assign(new Error('Selected payment account is unavailable.'), { statusCode: 404 })
    if (paymentAccount.method !== input.paymentMethod && paymentAccount.method !== 'other') {
      throw Object.assign(new Error('The selected account does not match this payment method.'), { statusCode: 400 })
    }
  }
  if (input.studentId) throw Object.assign(new Error('Client payment submissions cannot be used for mentoring payments.'), { statusCode: 400 })
  const payment = await recordPayment({
    amount: Number(input.amount),
    clientId: user.clientId,
    projectId: input.projectId,
    dealId: input.dealId,
    invoiceId: input.invoiceId,
    paymentMethod: input.paymentMethod,
    paymentType: input.paymentType || 'other',
    transactionId: input.transactionId,
    paymentDate: input.paymentDate,
    paymentAccountId: paymentAccount?._id,
    receivingAccount: paymentAccount?.name,
    payerName: input.payerName,
    notes: input.notes,
    proofFiles,
    status: 'submitted',
    paymentSource: 'client_portal',
  }, user)
  payment.status = 'submitted'
  payment.verificationStatus = 'submitted'
  payment.submittedBy = user._id
  payment.submittedAt = new Date()
  payment.paymentHistory.push({
    action: 'client_submitted',
    actor: user._id,
    status: payment.status,
    note: cashPayment
      ? 'Client reported a cash payment for team verification.'
      : 'Client submitted payment details for team verification.',
  })
  await payment.save()
  await recordFinanceAudit({
    actor: user._id,
    action: 'payment.submitted',
    paymentId: payment._id,
    projectId: payment.projectId,
    after: financialSnapshot(payment),
  })
  const recipients = await User.find({
    portalType: 'team',
    isActive: true,
    role: { $in: ['super_admin', 'admin', 'manager', 'finance'] },
  }).select('_id')
  if (recipients.length) {
    await Notification.insertMany(recipients.map(({ _id }) => ({
      recipient: _id,
      type: 'payment_verification',
      title: cashPayment ? 'Client cash payment needs verification' : 'Client payment submitted',
      message: `${payment.currency} ${payment.amount} is awaiting verification.`,
      relatedEntity: 'payment',
      relatedEntityId: payment._id,
    })))
  }
  await recordActivity({
    actor: user._id,
    action: 'payment.submitted_for_verification',
    entityType: 'payment',
    entityId: payment._id,
    clientId: payment.clientId,
    projectId: payment.projectId,
    metadata: { newValue: { amount: payment.amount, status: payment.status, proofFiles: proofFiles.map(String) } },
    description: `Client submitted payment ${payment.paymentCode} for verification.`,
  })
  return Payment.findById(payment._id)
}

export async function resubmitClientPayment(id, input, user) {
  if (user.portalType !== 'client' || !user.clientId) {
    throw Object.assign(new Error('Client portal access is required.'), { statusCode: 403 })
  }
  const payment = await Payment.findOne({ _id: id, clientId: user.clientId })
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  if (payment.paymentSource !== 'client_portal' || payment.status !== 'correction_requested') {
    throw Object.assign(new Error('Only a client payment awaiting correction can be resubmitted.'), { statusCode: 409 })
  }
  const proofFiles = await validateClientProofFiles(input.proofFiles, user.clientId)
  if (input.paymentMethod !== 'cash' && !proofFiles.length) {
    throw Object.assign(new Error('Upload updated payment proof for non-cash payments.'), { statusCode: 400 })
  }
  let paymentAccount = null
  if (input.paymentAccountId) {
    paymentAccount = await PaymentAccount.findOne({ _id: input.paymentAccountId, isActive: true })
    if (!paymentAccount) throw Object.assign(new Error('Selected payment account is unavailable.'), { statusCode: 404 })
    if (paymentAccount.method !== input.paymentMethod && paymentAccount.method !== 'other') {
      throw Object.assign(new Error('The selected account does not match this payment method.'), { statusCode: 400 })
    }
  }
  const previous = {
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    proofFiles: payment.proofFiles.map(String),
    receivingAccount: payment.receivingAccount,
    paymentAccountId: payment.paymentAccountId?.toString(),
  }
  payment.amount = Number(input.amount)
  payment.paymentMethod = input.paymentMethod
  payment.transactionId = input.transactionId?.trim() || undefined
  payment.paymentAccountId = paymentAccount?._id
  payment.receivingAccount = paymentAccount?.name
  payment.paymentDate = input.paymentDate ? new Date(input.paymentDate) : payment.paymentDate
  payment.proofFiles = [...new Set([...payment.proofFiles.map(String), ...proofFiles.map(String)])]
  payment.status = 'submitted'
  payment.verificationStatus = 'submitted'
  payment.submittedBy = user._id
  payment.submittedAt = new Date()
  payment.financeRevision = Number(payment.financeRevision || 0) + 1
  payment.verifiedBy = undefined
  payment.verifiedAt = undefined
  payment.paymentHistory.push({
    action: 'client_resubmitted',
    actor: user._id,
    previousStatus: 'correction_requested',
    status: payment.status,
    note: `Previous amount: ${previous.amount}; updated amount: ${payment.amount}. Client payment details require team verification.`,
  })
  await payment.save()
  await setPaymentProofApproval(payment, 'pending')
  if (proofFiles.length) {
    await FileAsset.updateMany({ _id: { $in: proofFiles }, paymentId: { $in: [null, payment._id] } }, { $set: { paymentId: payment._id } })
  }
  await syncAll(payment)
  await recordFinanceAudit({
    actor: user._id,
    action: 'payment.resubmitted',
    paymentId: payment._id,
    projectId: payment.projectId,
    before: previous,
    after: financialSnapshot(payment),
  })
  await recordActivity({
    actor: user._id,
    action: 'payment.resubmitted_for_verification',
    entityType: 'payment',
    entityId: payment._id,
    clientId: payment.clientId,
    projectId: payment.projectId,
    metadata: { oldValue: previous, newValue: { amount: payment.amount, paymentMethod: payment.paymentMethod, transactionId: payment.transactionId, proofFiles: payment.proofFiles.map(String) } },
    description: `Client resubmitted payment ${payment.paymentCode} for verification.`,
  })
  const recipients = await User.find({
    portalType: 'team',
    isActive: true,
    role: { $in: ['super_admin', 'admin', 'manager', 'finance'] },
  }).select('_id')
  if (recipients.length) {
    await Notification.insertMany(recipients.map(({ _id }) => ({
      recipient: _id,
      type: 'payment_verification',
      title: 'Client updated a payment submission',
      message: `${payment.currency} ${payment.amount} · ${payment.paymentCode}`,
      relatedEntity: 'payment',
      relatedEntityId: payment._id,
    })))
  }
  return Payment.findById(payment._id)
}

async function recordPaymentLocked(input, user) {
  let clientId = user.portalType === 'client' ? user.clientId : input.clientId
  let project = null
  let student = null
  let deal = null
  let invoice = null
  if (input.dealId) {
    deal = await Deal.findOne({ _id: input.dealId, ...(clientId ? { clientId } : {}) })
    if (!deal) throw Object.assign(new Error('Deal not found or access denied.'), { statusCode: 404 })
    if (!clientId) clientId = deal.clientId
    if (!input.projectId && deal.projectId) input = { ...input, projectId: deal.projectId }
  }
  if (input.invoiceId) {
    invoice = await Invoice.findOne({ _id: input.invoiceId, ...(clientId ? { clientId } : {}) })
    if (!invoice) throw Object.assign(new Error('Invoice not found or access denied.'), { statusCode: 404 })
    if (!clientId) clientId = invoice.clientId
    if (!input.projectId && invoice.projectId) input = { ...input, projectId: invoice.projectId }
    if (!deal && invoice.dealId) {
      deal = await Deal.findOne({ _id: invoice.dealId, ...(clientId ? { clientId } : {}) })
      if (!deal) throw Object.assign(new Error('The invoice deal could not be found.'), { statusCode: 404 })
    }
  }
  if (input.paymentAccountId && user.portalType !== 'client') {
    const account = await PaymentAccount.findOne({ _id: input.paymentAccountId, isActive: true })
    if (!account) throw Object.assign(new Error('Payment account not found or inactive.'), { statusCode: 404 })
    if (account.method !== input.paymentMethod && account.method !== 'other') {
      throw Object.assign(new Error('The payment account does not match this payment method.'), { statusCode: 400 })
    }
    input = { ...input, receivingAccount: account.name }
  }
  if (!input.projectId && deal?.projectId) input = { ...input, projectId: deal.projectId }
  if (invoice?.dealId && deal && !invoice.dealId.equals(deal._id)) throw Object.assign(new Error('The selected invoice and deal are not related.'), { statusCode: 400 })
  if (input.projectId) {
    project = await Project.findOne({ _id: input.projectId, ...(user.portalType === 'client' ? { clientId } : {}) })
    if (!project) throw Object.assign(new Error('Project not found or access denied.'), { statusCode: 404 })
  }
  if (deal?.projectId && project && !deal.projectId.equals(project._id)) throw Object.assign(new Error('The selected deal and project are not related.'), { statusCode: 400 })
  if (invoice?.projectId && project && !invoice.projectId.equals(project._id)) throw Object.assign(new Error('The selected invoice and project are not related.'), { statusCode: 400 })
  if (input.studentId) {
    student = await Student.findById(input.studentId)
    if (!student) throw Object.assign(new Error('Mentoring student not found.'), { statusCode: 404 })
  }
  if (student && (input.projectId || input.dealId || input.invoiceId || input.clientId)) {
    throw Object.assign(new Error('Mentorship payments must belong only to a student and must not be linked to project, deal, invoice, or client records.'), { statusCode: 400 })
  }
  if (student) input = { ...input, paymentType: 'mentoring_fee' }
  const associatedClientId = project?.clientId || deal?.clientId || invoice?.clientId || student?.clientId
  if (clientId && associatedClientId && !associatedClientId.equals(clientId)) throw Object.assign(new Error('The selected records do not belong to the specified client.'), { statusCode: 400 })
  if (!clientId && associatedClientId) clientId = associatedClientId
  const associatedServiceId = project?.serviceId || deal?.serviceId || student?.serviceId
  if (input.serviceId && associatedServiceId && !associatedServiceId.equals(input.serviceId)) throw Object.assign(new Error('The selected records do not belong to the specified service.'), { statusCode: 400 })
  if (!project && !student && !clientId) throw Object.assign(new Error('Payment must be associated with a client, project, or student.'), { statusCode: 400 })
  const serviceId = input.serviceId || project?.serviceId || deal?.serviceId || student?.serviceId
  if (clientId && !await Client.exists({ _id: clientId })) throw Object.assign(new Error('Client not found.'), { statusCode: 404 })
  if (serviceId && !await Service.exists({ _id: serviceId })) throw Object.assign(new Error('Service not found.'), { statusCode: 404 })
  const cashPayment = input.paymentMethod === 'cash'
  const clientSubmission = user.portalType === 'client'
  const cashRequiresApproval = cashPayment && !clientSubmission && !student
  const explicitStatus = String(input.status || '').toLowerCase()
  const status = clientSubmission
    ? 'submitted'
    : cashRequiresApproval
      ? 'under_verification'
      : explicitStatus === 'refunded'
        ? 'refunded'
        : 'paid'
  if (user.portalType === 'team') {
    input.proofFiles = await validateTeamProofFiles(input.proofFiles, clientId, project?._id)
  }
  if (project) {
    const [existing] = await Payment.aggregate([{ $match: { projectId: project._id, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    const amountDue = Number(project.finalAmount ?? project.quotedAmount ?? project.budget ?? 0)
    if (amountDue > 0 && (existing?.total || 0) + Number(input.amount) > amountDue) throw Object.assign(new Error('Payment exceeds the remaining project balance.'), { statusCode: 409 })
  }
  if (user.portalType === 'team' && !cashPayment && !input.proofFiles?.length) {
    throw Object.assign(new Error('Attach payment proof for non-cash payments.'), { statusCode: 400 })
  }
  if (student && status === 'paid' && student.agreedAmount > 0) {
    const [existing] = await Payment.aggregate([{ $match: { studentId: student._id, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    if ((existing?.total || 0) + Number(input.amount) > student.agreedAmount) throw Object.assign(new Error('Payment exceeds the remaining mentoring balance.'), { statusCode: 409 })
  }
  if (invoice) {
    const [existing] = await Payment.aggregate([{ $match: { invoiceId: invoice._id, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    if ((existing?.total || 0) + Number(input.amount) > invoice.amount) throw Object.assign(new Error('Payment exceeds the remaining invoice balance.'), { statusCode: 409 })
  }
  const payment = await Payment.create({
    amount: Number(input.amount),
    currency: input.currency || 'INR',
    paymentType: input.paymentType || 'other',
    paymentMethod: input.paymentMethod || 'other',
    transactionId: input.transactionId,
    paymentDate: input.paymentDate || (status === 'paid' ? new Date() : undefined),
    dueDate: input.dueDate,
    notes: input.notes,
    proofFiles: input.proofFiles || [],
    payerName: input.payerName,
    receivingAccount: input.receivingAccount,
    paymentAccountId: input.paymentAccountId,
    paymentSource: user.portalType === 'client' ? 'client_portal' : 'internal_admin',
    clientId: clientId || project?.clientId || student?.clientId,
    studentId: student?._id || input.studentId,
    projectId: project?._id || input.projectId,
    dealId: deal?._id || input.dealId,
    invoiceId: invoice?._id || input.invoiceId,
    serviceId,
    status,
    verificationStatus: clientSubmission ? 'submitted' : cashRequiresApproval ? 'awaiting_second_approval' : 'not_required',
    paymentCode: `PAY-${randomBytes(4).toString('hex').toUpperCase()}`,
    recordedBy: user._id,
    submittedBy: user._id,
    submittedAt: new Date(),
    createdBy: user._id,
    paymentHistory: [{
      action: cashRequiresApproval ? 'cash_recorded_awaiting_approval' : clientSubmission ? 'client_payment_submitted' : 'payment_recorded',
      actor: user._id,
      status,
      note: cashRequiresApproval ? 'A different authorized team member must approve this project cash payment.' : undefined,
    }],
  })
  try {
    if (payment.proofFiles.length) {
      await FileAsset.updateMany({ _id: { $in: payment.proofFiles }, paymentId: { $in: [null, payment._id] } }, { $set: { paymentId: payment._id } })
    }
    if (payment.status === 'paid') await setPaymentProofApproval(payment, 'approved')
    if (payment.status === 'paid' && !payment.paymentDate) payment.paymentDate = new Date()
    await syncAll(payment)
    await recordActivity({ actor: user._id, action: 'payment.recorded', entityType: 'payment', entityId: payment._id, clientId: payment.clientId, projectId: payment.projectId, metadata: { newValue: { amount: payment.amount, status: payment.status, paymentMethod: payment.paymentMethod, paymentSource: payment.paymentSource } }, description: `${payment.currency} ${payment.amount} payment ${payment.status}.` })
    await recordFinanceAudit({
      actor: user._id,
      action: 'payment.recorded',
      paymentId: payment._id,
      projectId: payment.projectId,
      after: financialSnapshot(payment),
    })
    if (payment.clientId) {
      const client = await Client.findById(payment.clientId).select('userId')
      if (client?.userId) await Notification.create({
        recipient: client.userId,
        type: payment.status === 'paid' ? 'payment_received' : 'payment_update',
        title: payment.status === 'paid' ? 'Payment recorded' : 'Payment status updated',
        message: `${payment.currency} ${payment.amount} · ${payment.status.replaceAll('_', ' ')}`,
        relatedEntity: 'payment',
        relatedEntityId: payment._id,
      })
    }
  } catch (error) {
    await Payment.findByIdAndDelete(payment._id)
    await syncAll(payment)
    throw error
  }
  return Payment.findById(payment._id)
}

export async function recordPayment(input, user) {
  let projectId = input.projectId
  if (!projectId && input.dealId) projectId = (await Deal.findById(input.dealId).select('projectId'))?.projectId
  if (!projectId && input.invoiceId) projectId = (await Invoice.findById(input.invoiceId).select('projectId'))?.projectId
  return withProjectFinanceLock(projectId, () => recordPaymentLocked(input, user))
}

async function updatePaymentLocked(id, changes, user, { allowWorkflowTransition = false } = {}) {
  const payment = await Payment.findOne({ _id: id, ...(user.portalType === 'client' ? { clientId: user.clientId } : {}) })
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  if (user.portalType === 'client') throw Object.assign(new Error('Clients cannot edit payment records.'), { statusCode: 403 })
  const old = payment.toObject()
  if (changes.amount !== undefined) {
    const amount = Number(changes.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Corrected payment amount must be a positive number.'), { statusCode: 400 })
    }
    if (amount !== Number(payment.amount) && String(changes.notes || '').trim().length < 3) {
      throw Object.assign(new Error('A correction reason of at least 3 characters is required when changing a payment amount.'), { statusCode: 400 })
    }
    if (payment.studentId && payment.status === 'paid') {
      const [otherPayments] = await Payment.aggregate([
        { $match: { studentId: payment.studentId, status: 'paid', _id: { $ne: payment._id } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      const student = await Student.findById(payment.studentId).select('agreedAmount')
      if (student && Number(otherPayments?.total || 0) + amount > Number(student.agreedAmount || 0)) {
        throw Object.assign(new Error('Corrected payment would exceed the student’s agreed enrollment fee.'), { statusCode: 409 })
      }
    }
    if (payment.projectId && payment.status === 'paid') {
      const finalized = await RevenueDistribution.exists({ projectId: payment.projectId, entryType: 'receipt' })
      if (finalized) throw Object.assign(new Error('A payment linked to a finalized project distribution requires a controlled financial reversal.'), { statusCode: 409 })
      const [otherPayments] = await Payment.aggregate([
        { $match: { projectId: payment.projectId, status: 'paid', _id: { $ne: payment._id } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      const project = await Project.findById(payment.projectId)
      const amountDue = Number(project?.finalAmount ?? project?.quotedAmount ?? project?.budget ?? 0)
      if (amountDue > 0 && Number(otherPayments?.total || 0) + amount > amountDue) {
        throw Object.assign(new Error('Corrected payment would exceed the remaining project balance.'), { statusCode: 409 })
      }
    }
  }
  if (changes.status && changes.status !== payment.status && !allowWorkflowTransition) {
    throw Object.assign(new Error('Payment status changes must use the verification or cash-approval workflow.'), { statusCode: 409 })
  }
  if (payment.status === 'paid' && changes.status && changes.status !== 'paid' && payment.projectId) {
    const finalized = await RevenueDistribution.exists({ projectId: payment.projectId, entryType: 'receipt' })
    if (finalized) throw Object.assign(new Error('A payment linked to a finalized project distribution requires a controlled financial reversal.'), { statusCode: 409 })
  }
  for (const field of ['amount', 'status', 'paymentMethod', 'transactionId', 'paymentDate', 'dueDate', 'notes']) if (changes[field] !== undefined) payment[field] = field === 'amount' ? Number(changes[field]) : changes[field]
  const amountChanged = changes.amount !== undefined && Number(changes.amount) !== Number(old.amount)
  if (payment.status !== old.status || amountChanged) payment.financeRevision = Number(payment.financeRevision || 0) + 1
  payment.updatedBy = user._id
  if (payment.status === 'paid' && !payment.paymentDate) payment.paymentDate = new Date()
  if (payment.status === 'paid' && old.status !== 'paid') {
    if (payment.projectId) {
      const [existing] = await Payment.aggregate([{ $match: { projectId: payment.projectId, status: 'paid', _id: { $ne: payment._id } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
      const project = await Project.findById(payment.projectId)
      const amountDue = Number(project?.finalAmount ?? project?.quotedAmount ?? project?.budget ?? 0)
      if (amountDue > 0 && (existing?.total || 0) + payment.amount > amountDue) throw Object.assign(new Error('Payment exceeds the remaining project balance.'), { statusCode: 409 })
    }
    if (payment.studentId) {
      const [existing] = await Payment.aggregate([{ $match: { studentId: payment.studentId, status: 'paid', _id: { $ne: payment._id } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
      const student = await Student.findById(payment.studentId)
      if (student?.agreedAmount > 0 && (existing?.total || 0) + payment.amount > student.agreedAmount) throw Object.assign(new Error('Payment exceeds the remaining mentoring balance.'), { statusCode: 409 })
    }
  }
  await payment.save()
  try {
    await syncAll(payment)
    if (payment.status !== old.status) {
      const proofStatus = payment.status === 'paid'
        ? 'approved'
        : ['rejected', 'correction_requested'].includes(payment.status)
          ? 'changes_requested'
          : 'pending'
      await setPaymentProofApproval(payment, proofStatus)
    }
    await recordFinanceAudit({
      actor: user._id,
      action: 'payment.updated',
      paymentId: payment._id,
      projectId: payment.projectId,
      before: financialSnapshot(old),
      after: financialSnapshot(payment),
      reason: changes.notes,
    })
    payment.paymentHistory.push({
      action: amountChanged ? 'payment_amount_corrected' : 'payment_updated',
      actor: user._id,
      previousStatus: old.status,
      status: payment.status,
      note: amountChanged ? `Amount corrected from ${old.amount} to ${payment.amount}. ${String(changes.notes || '').trim()}` : changes.notes,
    })
    await payment.save()
    await recordActivity({ actor: user._id, action: 'payment.updated', entityType: 'payment', entityId: payment._id, clientId: payment.clientId, projectId: payment.projectId, metadata: { oldValue: { amount: old.amount, status: old.status, paymentMethod: old.paymentMethod }, newValue: { amount: payment.amount, status: payment.status, paymentMethod: payment.paymentMethod } }, description: `Payment ${payment.paymentCode} updated.` })
    if (old.status !== payment.status && payment.clientId) {
      const client = await Client.findById(payment.clientId).select('userId')
      if (client?.userId) await Notification.create({ recipient: client.userId, type: 'payment_update', title: 'Payment status updated', message: `${payment.currency} ${payment.amount} · ${payment.status.replaceAll('_', ' ')}`, relatedEntity: 'payment', relatedEntityId: payment._id })
    }
  } catch (error) {
    await Payment.findByIdAndUpdate(payment._id, old)
    await syncAll(payment)
    throw error
  }
  return Payment.findById(payment._id)
}

export async function updatePayment(id, changes, user, options = {}) {
  const payment = await Payment.findOne({ _id: id, ...(user.portalType === 'client' ? { clientId: user.clientId } : {}) }).select('projectId')
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  return withProjectFinanceLock(payment.projectId, () => updatePaymentLocked(id, changes, user, options))
}

async function reviewPaymentLocked(id, input, user) {
  const payment = await Payment.findById(id)
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  if (payment.paymentMethod === 'cash' && payment.verificationStatus === 'awaiting_second_approval') {
    throw Object.assign(new Error('Cash payments require approval through the separate second-approver action.'), { statusCode: 409 })
  }
  if (!['submitted', 'under_verification', 'correction_requested', 'disputed'].includes(payment.status)) {
    throw Object.assign(new Error('This payment is not awaiting verification.'), { statusCode: 409 })
  }
  const actions = {
    verify: { status: 'paid', verificationStatus: 'verified' },
    reject: { status: 'rejected', verificationStatus: 'rejected' },
    request_correction: { status: 'correction_requested', verificationStatus: 'correction_requested' },
  }
  const result = actions[input.action]
  if (!result) throw Object.assign(new Error('Choose verify, reject, or request_correction.'), { statusCode: 400 })
  if (input.action !== 'verify' && !String(input.note || '').trim()) {
    throw Object.assign(new Error('Add a reason when rejecting or requesting a correction.'), { statusCode: 400 })
  }
  const oldStatus = payment.status
  if (result.status === 'paid') {
    await updatePaymentLocked(id, { status: 'paid' }, user, { allowWorkflowTransition: true })
  } else {
    await updatePaymentLocked(id, { status: result.status }, user, { allowWorkflowTransition: true })
  }
  const reviewed = await Payment.findById(id)
  reviewed.verificationStatus = result.verificationStatus
  reviewed.verifiedBy = result.status === 'paid' ? user._id : undefined
  reviewed.approvedBy = result.status === 'paid' ? user._id : undefined
  reviewed.verifiedAt = result.status === 'paid' ? new Date() : undefined
  reviewed.verificationNote = input.note?.trim()
  reviewed.reviewedBy = user._id
  reviewed.reviewedAt = new Date()
  reviewed.paymentHistory.push({
    action: input.action,
    actor: user._id,
    previousStatus: oldStatus,
    status: result.status,
    note: input.note?.trim(),
  })
  await reviewed.save()
  await syncAll(reviewed)
  await recordFinanceAudit({
    actor: user._id,
    action: `payment.${input.action}`,
    paymentId: reviewed._id,
    projectId: reviewed.projectId,
    before: financialSnapshot(payment),
    after: financialSnapshot(reviewed),
    reason: input.note?.trim(),
  })
  await recordActivity({
    actor: user._id,
    action: `payment.${input.action}`,
    entityType: 'payment',
    entityId: reviewed._id,
    clientId: reviewed.clientId,
    projectId: reviewed.projectId,
    metadata: { oldValue: { status: oldStatus }, newValue: { status: reviewed.status, verificationStatus: reviewed.verificationStatus }, reason: input.note?.trim() },
    description: `Payment ${reviewed.paymentCode} ${input.action.replaceAll('_', ' ')}.`,
  })
  return Payment.findById(reviewed._id)
}

export async function reviewPayment(id, input, user) {
  const payment = await Payment.findById(id).select('projectId')
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  return withProjectFinanceLock(payment.projectId, () => reviewPaymentLocked(id, input, user))
}

async function approveCashPaymentLocked(id, user) {
  const payment = await Payment.findById(id)
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  if (payment.paymentMethod !== 'cash' || payment.verificationStatus !== 'awaiting_second_approval') {
    throw Object.assign(new Error('This cash payment is not awaiting approval.'), { statusCode: 409 })
  }
  if (payment.recordedBy?.toString() === user._id.toString()) {
    throw Object.assign(new Error('The person who recorded a cash payment cannot approve it.'), { statusCode: 403 })
  }
  await updatePaymentLocked(id, { status: 'paid' }, user, { allowWorkflowTransition: true })
  const approved = await Payment.findById(id)
  approved.verificationStatus = 'verified'
  approved.verifiedBy = user._id
  approved.verifiedAt = new Date()
  approved.cashApprovedBy = user._id
  approved.approvedBy = user._id
  approved.cashApprovedAt = approved.verifiedAt
  approved.reviewedBy = user._id
  approved.reviewedAt = approved.verifiedAt
  approved.paymentHistory.push({ action: 'cash_payment_approved', actor: user._id, previousStatus: payment.status, status: 'paid' })
  await approved.save()
  await syncAll(approved)
  await recordFinanceAudit({
    actor: user._id,
    action: 'payment.cash_approved',
    paymentId: approved._id,
    projectId: approved.projectId,
    before: financialSnapshot(payment),
    after: financialSnapshot(approved),
  })
  await recordActivity({
    actor: user._id,
    action: 'payment.cash_approved',
    entityType: 'payment',
    entityId: approved._id,
    clientId: approved.clientId,
    projectId: approved.projectId,
    metadata: { oldValue: { status: payment.status }, newValue: { status: approved.status, verificationStatus: approved.verificationStatus }, recordedBy: payment.recordedBy },
    description: `Cash payment ${approved.paymentCode} approved by a second authorized team member.`,
  })
  return Payment.findById(approved._id)
}

export async function approveCashPayment(id, user) {
  const payment = await Payment.findById(id).select('projectId')
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  return withProjectFinanceLock(payment.projectId, () => approveCashPaymentLocked(id, user))
}

export async function createPaymentDispute(id, input, user) {
  const payment = await Payment.findOne({ _id: id, clientId: user.clientId })
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  if (!['paid', 'partially_paid', 'submitted', 'under_verification', 'correction_requested', 'rejected'].includes(payment.status)) {
    throw Object.assign(new Error('This payment is not eligible for a payment issue.'), { statusCode: 409 })
  }
  if (payment.disputes.some((item) => ['open', 'information_requested'].includes(item.status))) {
    throw Object.assign(new Error('An open issue already exists for this payment.'), { statusCode: 409 })
  }
  const proofFiles = await validateClientProofFiles(input.proofFiles, user.clientId)
  const dispute = {
    claimedAmount: Number(input.claimedAmount),
    reference: input.reference?.trim(),
    explanation: input.explanation.trim(),
    proofFiles,
  }
  payment.disputes.push(dispute)
  const previousVerification = payment.verificationStatus
  payment.verificationStatus = 'disputed'
  payment.paymentHistory.push({ action: 'client_disputed', actor: user._id, status: payment.status, note: dispute.explanation })
  await payment.save()
  await recordFinanceAudit({
    actor: user._id,
    action: 'payment.disputed',
    paymentId: payment._id,
    projectId: payment.projectId,
    before: { verificationStatus: previousVerification },
    after: { dispute },
    reason: dispute.explanation,
  })
  await recordActivity({
    actor: user._id,
    action: 'payment.disputed',
    entityType: 'payment',
    entityId: payment._id,
    clientId: payment.clientId,
    projectId: payment.projectId,
    metadata: { oldValue: { verificationStatus: previousVerification }, newValue: dispute },
    description: `Client raised a payment dispute for ${payment.paymentCode}.`,
  })
  const recipients = await User.find({ portalType: 'team', isActive: true, role: { $in: ['super_admin', 'admin', 'manager', 'finance'] } }).select('_id')
  if (recipients.length) await Notification.insertMany(recipients.map(({ _id }) => ({
    recipient: _id,
    type: 'payment_dispute',
    title: 'Client raised a payment issue',
    message: `${payment.currency} ${payment.amount} · ${dispute.explanation.slice(0, 180)}`,
    relatedEntity: 'payment',
    relatedEntityId: payment._id,
  })))
  return payment
}

export async function reviewPaymentDispute(id, disputeId, input, user) {
  const payment = await Payment.findById(id)
  if (!payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 })
  const dispute = payment.disputes.id(disputeId)
  if (!dispute) throw Object.assign(new Error('Payment dispute not found.'), { statusCode: 404 })
  if (!['information_requested', 'resolved', 'rejected'].includes(input.status)) {
    throw Object.assign(new Error('Choose information_requested, resolved, or rejected.'), { statusCode: 400 })
  }
  if (!String(input.response || '').trim()) throw Object.assign(new Error('A response is required for this dispute decision.'), { statusCode: 400 })
  const previous = { status: dispute.status, response: dispute.response }
  dispute.status = input.status
  dispute.response = input.response.trim()
  dispute.reviewedBy = user._id
  dispute.reviewedAt = new Date()
  payment.paymentHistory.push({ action: `dispute_${input.status}`, actor: user._id, status: payment.status, note: dispute.response })
  if (input.status === 'resolved' || input.status === 'rejected') {
    payment.verificationStatus = payment.status === 'paid' ? 'verified' : payment.verificationStatus === 'disputed' ? 'submitted' : payment.verificationStatus
  }
  await payment.save()
  await recordFinanceAudit({
    actor: user._id,
    action: `payment.dispute_${input.status}`,
    paymentId: payment._id,
    projectId: payment.projectId,
    before: previous,
    after: { status: dispute.status, response: dispute.response },
    reason: dispute.response,
  })
  await recordActivity({
    actor: user._id,
    action: `payment.dispute_${input.status}`,
    entityType: 'payment',
    entityId: payment._id,
    clientId: payment.clientId,
    projectId: payment.projectId,
    metadata: { oldValue: previous, newValue: { status: dispute.status, response: dispute.response } },
    description: `Dispute on payment ${payment.paymentCode} marked ${input.status}.`,
  })
  const client = await Client.findById(payment.clientId).select('userId')
  if (client?.userId) await Notification.create({
    recipient: client.userId,
    type: 'payment_dispute_update',
    title: 'Payment issue updated',
    message: dispute.response,
    relatedEntity: 'payment',
    relatedEntityId: payment._id,
  })
  return payment
}

export async function summary() {
  const rows = await Payment.aggregate([{ $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }])
  return rows.reduce((output, row) => {
    output[row._id] = { amount: row.amount, count: row.count }
    return output
  }, {})
}

export async function recalculateProject(projectId) {
  return refreshProject(projectId)
}
