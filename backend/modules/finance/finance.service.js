import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'
import { CompanyFinancialTransaction, Deal, FinanceAudit, FinanceLock, FounderTransfer, Invoice, Payment, PaymentAccount, Project, RevenueDistribution, User } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'
import { recordFinanceAudit } from '../../utils/financeAudit.js'

const eligibleFounderRoles = ['super_admin', 'admin']
const accountMethods = ['upi', 'bank_transfer', 'cash', 'other']
const FINANCE_LOCK_MS = 60_000
const FINANCE_LOCK_WAIT_MS = 10_000

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function acquireFinanceLock(key) {
  const token = randomBytes(16).toString('hex')
  const deadline = Date.now() + FINANCE_LOCK_WAIT_MS
  while (Date.now() < deadline) {
    const now = new Date()
    const locked = await FinanceLock.findOneAndUpdate(
      { key, expiresAt: { $lte: now } },
      { $set: { token, expiresAt: new Date(now.getTime() + FINANCE_LOCK_MS) } },
      { new: true },
    )
    if (locked) return { key, token }
    try {
      await FinanceLock.create({ key, token, expiresAt: new Date(now.getTime() + FINANCE_LOCK_MS) })
      return { key, token }
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
    await delay(40)
  }
  throw Object.assign(new Error('Another financial update is in progress. Retry shortly.'), { statusCode: 409 })
}

async function withFinanceLocks(keys, operation) {
  const acquired = []
  try {
    for (const key of [...new Set(keys)].sort()) acquired.push(await acquireFinanceLock(key))
    return await operation()
  } finally {
    for (const lock of acquired.reverse()) {
      await FinanceLock.deleteOne({ key: lock.key, token: lock.token })
    }
  }
}

const founderLock = (founderId) => `owner:founder:${founderId}`
const companyLock = (currency = 'INR') => `owner:company:${currency}`
const projectLock = (projectId) => `project:${projectId}`

export async function withProjectFinanceLock(projectId, operation) {
  if (!projectId) return operation()
  return withFinanceLocks([projectLock(String(projectId))], operation)
}

function accountForClient(account) {
  return {
    id: account.id,
    name: account.name,
    method: account.method,
    accountHolder: account.accountHolder,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    ifscCode: account.ifscCode,
    upiId: account.upiId,
    instructions: account.instructions,
  }
}

function accountSnapshot(account) {
  if (!account) return null
  return {
    name: account.name,
    method: account.method,
    accountHolder: account.accountHolder,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    ifscCode: account.ifscCode,
    upiId: account.upiId,
    instructions: account.instructions,
    isActive: account.isActive,
    displayOrder: account.displayOrder,
    internalNotes: account.internalNotes,
  }
}

export async function listPaymentAccounts(user) {
  const accounts = await PaymentAccount.find(user.portalType === 'client' ? { isActive: true } : {})
    .sort({ displayOrder: 1, name: 1 })
  if (user.portalType === 'client') return accounts.map(accountForClient)
  if (['super_admin', 'admin', 'finance'].includes(user.role)) return accounts
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    method: account.method,
    accountHolder: account.accountHolder,
    bankName: account.bankName,
    accountNumber: account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : '',
    ifscCode: account.ifscCode,
    upiId: account.upiId,
    instructions: account.instructions,
    isActive: account.isActive,
    displayOrder: account.displayOrder,
  }))
}

export async function savePaymentAccount(input, user, id) {
  const current = id ? await PaymentAccount.findById(id) : null
  if (id && !current) throw Object.assign(new Error('Payment account not found.'), { statusCode: 404 })
  const name = input.name === undefined ? current?.name : input.name
  const method = input.method === undefined ? current?.method : input.method
  if (typeof name !== 'string' || !name.trim() || !accountMethods.includes(method)) {
    throw Object.assign(new Error('Provide a payment account name and supported method.'), { statusCode: 400 })
  }
  const before = accountSnapshot(current)
  const account = current || new PaymentAccount({ createdBy: user._id })
  for (const field of ['name', 'method', 'accountHolder', 'bankName', 'accountNumber', 'ifscCode', 'upiId', 'instructions', 'internalNotes']) {
    if (input[field] !== undefined) account[field] = typeof input[field] === 'string' ? input[field].trim() : input[field]
  }
  if (input.isActive !== undefined) account.isActive = Boolean(input.isActive)
  if (input.displayOrder !== undefined) account.displayOrder = Number(input.displayOrder)
  if (account.method === 'upi' && !account.upiId) throw Object.assign(new Error('Add the UPI ID for this payment account.'), { statusCode: 400 })
  if (account.method === 'bank_transfer' && (!account.accountNumber || !account.ifscCode)) {
    throw Object.assign(new Error('Bank transfer accounts require an account number and IFSC code.'), { statusCode: 400 })
  }
  account.updatedBy = user._id
  await account.save()
  await recordFinanceAudit({
    actor: user._id,
    action: current ? 'payment_account.updated' : 'payment_account.created',
    accountId: account._id,
    before,
    after: accountSnapshot(account),
  })
  await recordActivity({
    actor: user._id,
    action: current ? 'payment_account.updated' : 'payment_account.created',
    entityType: 'payment_account',
    entityId: account._id,
    description: `Payment account ${account.name} ${current ? 'updated' : 'created'}.`,
  })
  return account
}

async function updateDistributionRulesLocked(projectId, input, user) {
  const project = await Project.findById(projectId)
  if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
  if (await RevenueDistribution.exists({ projectId: project._id, entryType: 'receipt', status: 'finalized' })) {
    throw Object.assign(new Error('Allocation rules are locked after the project distribution is finalized.'), { statusCode: 409 })
  }
  const companyPercent = Number(input.companySharePercent)
  if (!Number.isFinite(companyPercent) || companyPercent < 0 || companyPercent > 100) {
    throw Object.assign(new Error('Company allocation must be between 0 and 100 percent.'), { statusCode: 400 })
  }
  if (!Array.isArray(input.founderShares)) throw Object.assign(new Error('Founder allocations must be an array.'), { statusCode: 400 })
  const shares = input.founderShares.map((share) => ({
    userId: String(share.userId || ''),
    percent: Number(share.percent),
  }))
  if (shares.some((share) => !mongoose.isValidObjectId(share.userId) || !Number.isFinite(share.percent) || share.percent <= 0 || share.percent > 100)) {
    throw Object.assign(new Error('Each founder allocation needs a valid eligible user and a percentage greater than zero.'), { statusCode: 400 })
  }
  if (new Set(shares.map((share) => share.userId)).size !== shares.length) {
    throw Object.assign(new Error('A founder can only appear once in the project allocation.'), { statusCode: 400 })
  }
  const founderTotal = shares.reduce((sum, share) => sum + share.percent, 0)
  if ((companyPercent < 100 && Math.abs(founderTotal - 100) > 0.001)
    || (companyPercent === 100 && shares.length > 0)) {
    throw Object.assign(new Error('Founder contributions must total 100 percent of the founder pool.'), { statusCode: 400 })
  }
  const eligible = await User.find({
    _id: { $in: shares.map((share) => share.userId) },
    portalType: 'team',
    role: { $in: eligibleFounderRoles },
    isActive: true,
  }).select('_id')
  if (eligible.length !== shares.length) {
    throw Object.assign(new Error('Founder allocations can only be assigned to active internal super-admin or admin accounts.'), { statusCode: 400 })
  }
  const before = {
    companySharePercent: project.companySharePercent,
    founderShares: project.founderShares.map((share) => ({ userId: String(share.userId), percent: share.percent })),
  }
  project.companySharePercent = companyPercent
  project.founderShares = shares
  project.distributionUpdatedBy = user._id
  project.distributionUpdatedAt = new Date()
  await project.save()
  const after = {
    companySharePercent: project.companySharePercent,
    founderShares: shares,
  }
  await recordFinanceAudit({ actor: user._id, action: 'distribution_rules.updated', projectId: project._id, before, after })
  await recordActivity({
    actor: user._id,
    action: 'distribution_rules.updated',
    entityType: 'project',
    entityId: project._id,
    clientId: project.clientId,
    projectId: project._id,
    metadata: { oldValue: before, newValue: after },
    description: `Revenue allocation rules updated for ${project.projectName}.`,
  })
  return project
}

export async function updateDistributionRules(projectId, input, user) {
  return withFinanceLocks([projectLock(projectId)], () => updateDistributionRulesLocked(projectId, input, user))
}

async function finalizeProjectDistributionLocked(projectId, user) {
  const project = await Project.findById(projectId).populate('founderShares.userId', 'name role portalType isActive')
  if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
  if (await RevenueDistribution.exists({ projectId: project._id, entryType: 'receipt', status: 'finalized' })) {
    throw Object.assign(new Error('This project already has a finalized revenue distribution.'), { statusCode: 409 })
  }
  const totalProjectAmount = Math.round(Number(project.finalAmount ?? project.quotedAmount ?? project.budget ?? 0) * 100) / 100
  if (totalProjectAmount <= 0) throw Object.assign(new Error('Set a positive project amount before distributing revenue.'), { statusCode: 409 })
  const [verified] = await Payment.aggregate([
    { $match: { projectId: project._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  if (Math.round(Number(verified?.total || 0) * 100) < Math.round(totalProjectAmount * 100)) {
    throw Object.assign(new Error('Revenue distribution is unavailable until the project is fully paid and verified.'), { statusCode: 409 })
  }
  const companyPercent = Number(project.companySharePercent ?? 100)
  const founderShares = project.founderShares || []
  const founderShareTotal = founderShares.reduce((sum, share) => sum + Number(share.percent), 0)
  if ((companyPercent < 100 && Math.abs(founderShareTotal - 100) > 0.001)
    || (companyPercent === 100 && founderShares.length)) {
    throw Object.assign(new Error('Configure founder contributions to total 100 percent of the founder pool before finalizing.'), { statusCode: 409 })
  }
  const eligibleShares = founderShares.filter((share) => share.userId?.isActive
    && share.userId?.portalType === 'team' && eligibleFounderRoles.includes(share.userId.role))
  if (eligibleShares.length !== founderShares.length) {
    throw Object.assign(new Error('This project has an inactive or ineligible founder allocation; update the rules before finalizing.'), { statusCode: 409 })
  }
  const paidPayments = await Payment.find({ projectId: project._id, status: 'paid' })
    .select('_id amount paymentDate createdAt verifiedAt cashApprovedAt')
  paidPayments.sort((left, right) => {
    const actionTime = (payment) => new Date(payment.verifiedAt || payment.cashApprovedAt || payment.createdAt || payment.paymentDate || 0).getTime()
    return actionTime(left) - actionTime(right) || new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
  })
  let paidTotal = 0
  const finalPayment = paidPayments.find((payment) => {
    paidTotal += Number(payment.amount || 0)
    return Math.round(paidTotal * 100) >= Math.round(totalProjectAmount * 100)
  })
  if (!finalPayment) throw Object.assign(new Error('No verified project payment completed the project amount.'), { statusCode: 409 })
  project.finalPaymentId = finalPayment._id
  await project.save()
  await Payment.updateMany({ projectId: project._id, isFinalPayment: true }, { $set: { isFinalPayment: false } })
  await Payment.updateOne({ _id: finalPayment._id }, { $set: { isFinalPayment: true } })
  const invoice = await Invoice.findOne({ projectId: project._id, status: { $nin: ['cancelled', 'draft'] } }).sort({ createdAt: -1 })
  const deal = project.dealId ? await Deal.findById(project.dealId) : null
  const founderPoolPercent = 100 - companyPercent
  const companyAmount = Math.round(totalProjectAmount * companyPercent) / 100
  const founderPoolAmount = Math.round((totalProjectAmount - companyAmount) * 100) / 100
  const allocations = []
  if (companyPercent > 0) allocations.push({
    recipientType: 'company',
    founderName: 'MAGAF Technologies',
    percent: companyPercent,
    effectiveProjectPercentage: companyPercent,
    amount: companyAmount,
  })
  for (const share of eligibleShares) {
    const effectivePercent = Math.round(founderPoolPercent * Number(share.percent)) / 100
    allocations.push({
      recipientType: 'founder',
      founderId: share.userId._id,
      founderName: share.userId.name,
      percent: effectivePercent,
      contributionPercentage: Number(share.percent),
      effectiveProjectPercentage: effectivePercent,
      amount: Math.round(founderPoolAmount * Number(share.percent)) / 100,
    })
  }
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  const remainder = Math.round((totalProjectAmount - allocated) * 100) / 100
  if (remainder && allocations.length) {
    allocations.at(-1).amount = Math.round((allocations.at(-1).amount + remainder) * 100) / 100
  }
  const revision = await RevenueDistribution.countDocuments({ projectId: project._id, entryType: 'receipt' })
  const distribution = await RevenueDistribution.create({
    sourceKey: `project:${project.id}:finalized:${revision + 1}`,
    entryType: 'receipt',
    paymentId: finalPayment._id,
    projectId: project._id,
    clientId: project.clientId,
    dealId: deal?._id,
    invoiceId: invoice?._id,
    currency: finalPayment.currency || 'INR',
    grossAmount: totalProjectAmount,
    companySharePercent: companyPercent,
    companyAmount,
    founderPoolPercent,
    founderPoolAmount,
    totalDistributed: totalProjectAmount,
    finalizedBy: user._id,
    allocations,
  })
  await recordFinanceAudit({
    actor: user._id,
    action: 'revenue_distribution.finalized',
    paymentId: finalPayment._id,
    projectId: project._id,
    distributionId: distribution._id,
    after: {
      grossAmount: distribution.grossAmount,
      companySharePercent: distribution.companySharePercent,
      companyAmount: distribution.companyAmount,
      founderPoolPercent: distribution.founderPoolPercent,
      founderPoolAmount: distribution.founderPoolAmount,
      allocations: distribution.allocations,
    },
  })
  await recordActivity({
    actor: user._id,
    action: 'revenue_distribution.finalized',
    entityType: 'project',
    entityId: project._id,
    clientId: project.clientId,
    projectId: project._id,
    metadata: { newValue: { distributionId: distribution._id, grossAmount: totalProjectAmount, allocations } },
    description: `Revenue distribution finalized for ${project.projectName}.`,
  })
  return distribution
}

export async function finalizeProjectDistribution(projectId, user) {
  const project = await Project.findById(projectId).select('founderShares.userId')
  if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 })
  return withFinanceLocks([
    projectLock(projectId),
    companyLock(),
    ...project.founderShares.map((share) => founderLock(share.userId)),
  ], () => finalizeProjectDistributionLocked(projectId, user))
}

async function reverseProjectDistributionLocked(distributionId, reason, user) {
  const distribution = await RevenueDistribution.findOne({ _id: distributionId, entryType: 'receipt', status: 'finalized' })
  if (!distribution) throw Object.assign(new Error('Finalized project distribution not found.'), { statusCode: 404 })
  if (!reason.trim()) throw Object.assign(new Error('A reason is required to reverse a project distribution.'), { statusCode: 400 })
  if (await FounderTransfer.exists({ distributionId: distribution._id, status: 'finalized' })) {
    throw Object.assign(new Error('Reverse or reconcile transfers linked to this distribution before reversing it.'), { statusCode: 409 })
  }
  const currentBalances = await distributionSummary()
  for (const allocation of distribution.allocations) {
    const balance = currentBalances.find((row) => allocation.recipientType === 'company'
      ? row.recipientType === 'company' && row.currency === distribution.currency
      : row.recipientType === 'founder' && String(row.founderId) === String(allocation.founderId))
    if (Number(allocation.amount) > Number(balance?.amount || 0) + 0.001) {
      throw Object.assign(new Error(`${allocation.founderName} has already used part of this allocation; reconcile the balance before reversing it.`), { statusCode: 409 })
    }
  }
  const before = {
    status: distribution.status,
    grossAmount: distribution.grossAmount,
    companySharePercent: distribution.companySharePercent,
    companyAmount: distribution.companyAmount,
    founderPoolPercent: distribution.founderPoolPercent,
    founderPoolAmount: distribution.founderPoolAmount,
    allocations: distribution.allocations.map((allocation) => allocation.toObject()),
  }
  const reversal = await RevenueDistribution.create({
    sourceKey: `reversal:${distribution._id}`,
    entryType: 'reversal',
    paymentId: distribution.paymentId,
    sourceDistributionId: distribution._id,
    projectId: distribution.projectId,
    clientId: distribution.clientId,
    dealId: distribution.dealId,
    invoiceId: distribution.invoiceId,
    currency: distribution.currency,
    grossAmount: -distribution.grossAmount,
    companySharePercent: distribution.companySharePercent,
    companyAmount: -Number(distribution.companyAmount || 0),
    founderPoolPercent: distribution.founderPoolPercent,
    founderPoolAmount: -Number(distribution.founderPoolAmount || 0),
    totalDistributed: -Number(distribution.totalDistributed || 0),
    finalizedBy: user._id,
    allocations: distribution.allocations.map((allocation) => ({
      recipientType: allocation.recipientType,
      founderId: allocation.founderId,
      founderName: allocation.founderName,
      percent: allocation.percent,
      contributionPercentage: allocation.contributionPercentage,
      effectiveProjectPercentage: allocation.effectiveProjectPercentage,
      amount: -Number(allocation.amount || 0),
    })),
    finalizedAt: new Date(),
  })
  distribution.status = 'reversed'
  distribution.reversedBy = user._id
  distribution.reversedAt = new Date()
  distribution.reversalReason = reason.trim()
  await distribution.save()
  await recordFinanceAudit({
    actor: user._id,
    action: 'revenue_distribution.reversed',
    paymentId: distribution.paymentId,
    projectId: distribution.projectId,
    distributionId: distribution._id,
    before,
    after: { status: 'reversed', reversalId: reversal._id, grossAmount: reversal.grossAmount, allocations: reversal.allocations },
    reason: reason.trim(),
  })
  await recordActivity({
    actor: user._id,
    action: 'revenue_distribution.reversed',
    entityType: 'project',
    entityId: distribution.projectId,
    projectId: distribution.projectId,
    clientId: distribution.clientId,
    metadata: { oldValue: distribution.toObject(), newValue: { reversalId: reversal._id, reason: reason.trim() } },
    description: `Project revenue distribution reversed: ${reason.trim()}`,
  })
  return reversal
}

async function updateProjectDistributionLocked(distributionId, input, user) {
  const distribution = await RevenueDistribution.findOne({ _id: distributionId, entryType: 'receipt', status: 'finalized' })
  if (!distribution) throw Object.assign(new Error('Finalized project distribution not found.'), { statusCode: 404 })
  const reason = String(input.reason || '').trim()
  if (!reason) throw Object.assign(new Error('A reason is required when editing a finalized distribution.'), { statusCode: 400 })
  if (await FounderTransfer.exists({ distributionId: distribution._id, status: 'finalized' })) {
    throw Object.assign(new Error('A distribution with finalized transfers cannot be edited. Reverse or reconcile the transfers first.'), { statusCode: 409 })
  }
  const companyPercent = Number(input.companySharePercent)
  if (!Number.isFinite(companyPercent) || companyPercent < 0 || companyPercent > 100 || !Array.isArray(input.founderShares)) {
    throw Object.assign(new Error('Provide a company allocation between 0 and 100 and a founder allocation list.'), { statusCode: 400 })
  }
  const shares = input.founderShares.map((share) => ({ userId: String(share.userId || ''), percent: Number(share.percent) }))
  if (shares.some((share) => !mongoose.isValidObjectId(share.userId) || !Number.isFinite(share.percent) || share.percent <= 0 || share.percent > 100)) {
    throw Object.assign(new Error('Each founder allocation needs a valid eligible user and a percentage greater than zero.'), { statusCode: 400 })
  }
  if (new Set(shares.map((share) => share.userId)).size !== shares.length) {
    throw Object.assign(new Error('A founder can only appear once in the project allocation.'), { statusCode: 400 })
  }
  const founderTotal = shares.reduce((sum, share) => sum + share.percent, 0)
  if ((companyPercent < 100 && Math.abs(founderTotal - 100) > 0.001) || (companyPercent === 100 && shares.length)) {
    throw Object.assign(new Error('Founder contributions must total 100 percent of the founder pool.'), { statusCode: 400 })
  }
  const founders = await User.find({
    _id: { $in: shares.map((share) => share.userId) },
    portalType: 'team',
    role: { $in: eligibleFounderRoles },
    isActive: true,
  }).select('_id name')
  if (founders.length !== shares.length) throw Object.assign(new Error('Only active internal admin/super-admin accounts can receive founder allocations.'), { statusCode: 400 })
  const founderById = new Map(founders.map((founder) => [String(founder._id), founder]))
  const project = await Project.findById(distribution.projectId)
  if (!project) throw Object.assign(new Error('The project linked to this distribution no longer exists.'), { statusCode: 409 })
  const total = Math.round(Number(distribution.grossAmount) * 100) / 100
  const founderPoolPercent = 100 - companyPercent
  const companyAmount = Math.round(total * companyPercent) / 100
  const founderPoolAmount = Math.round((total - companyAmount) * 100) / 100
  const allocations = []
  if (companyPercent > 0) allocations.push({
    recipientType: 'company',
    founderName: 'MAGAF Technologies',
    percent: companyPercent,
    effectiveProjectPercentage: companyPercent,
    amount: companyAmount,
  })
  for (const share of shares) {
    const founder = founderById.get(share.userId)
    const effectivePercent = Math.round(founderPoolPercent * share.percent) / 100
    allocations.push({
      recipientType: 'founder',
      founderId: founder._id,
      founderName: founder.name,
      percent: effectivePercent,
      contributionPercentage: share.percent,
      effectiveProjectPercentage: effectivePercent,
      amount: Math.round(founderPoolAmount * share.percent) / 100,
    })
  }
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  if (allocations.length) allocations.at(-1).amount = Math.round((allocations.at(-1).amount + total - allocated) * 100) / 100
  const before = {
    projectRules: {
      companySharePercent: project.companySharePercent,
      founderShares: project.founderShares.map((share) => share.toObject()),
    },
    grossAmount: distribution.grossAmount,
    companySharePercent: distribution.companySharePercent,
    companyAmount: distribution.companyAmount,
    founderPoolPercent: distribution.founderPoolPercent,
    founderPoolAmount: distribution.founderPoolAmount,
    allocations: distribution.allocations.map((allocation) => allocation.toObject()),
  }
  distribution.companySharePercent = companyPercent
  distribution.companyAmount = companyAmount
  distribution.founderPoolPercent = founderPoolPercent
  distribution.founderPoolAmount = founderPoolAmount
  distribution.totalDistributed = total
  distribution.allocations = allocations
  project.companySharePercent = companyPercent
  project.founderShares = shares.map((share) => ({ userId: share.userId, percent: share.percent }))
  await project.save()
  await distribution.save()
  const after = {
    projectRules: {
      companySharePercent: project.companySharePercent,
      founderShares: project.founderShares.map((share) => share.toObject()),
    },
    grossAmount: distribution.grossAmount,
    companySharePercent: companyPercent,
    companyAmount,
    founderPoolPercent,
    founderPoolAmount,
    allocations,
  }
  await recordFinanceAudit({
    actor: user._id,
    action: 'revenue_distribution.updated',
    projectId: distribution.projectId,
    paymentId: distribution.paymentId,
    distributionId: distribution._id,
    before,
    after,
    reason,
  })
  await recordActivity({
    actor: user._id,
    action: 'revenue_distribution.updated',
    entityType: 'project',
    entityId: distribution.projectId,
    projectId: distribution.projectId,
    clientId: distribution.clientId,
    metadata: { oldValue: before, newValue: after, reason },
    description: `Project distribution updated: ${reason}`,
  })
  return distribution
}

export async function updateProjectDistribution(distributionId, input, user) {
  const distribution = await RevenueDistribution.findOne({ _id: distributionId, entryType: 'receipt', status: 'finalized' })
    .select('projectId allocations')
  if (!distribution) throw Object.assign(new Error('Finalized project distribution not found.'), { statusCode: 404 })
  return withFinanceLocks([
    projectLock(distribution.projectId),
    companyLock(),
    ...distribution.allocations.filter((allocation) => allocation.recipientType === 'founder').map((allocation) => founderLock(allocation.founderId)),
    ...(input.founderShares || []).map((share) => founderLock(share.userId)),
  ], () => updateProjectDistributionLocked(distributionId, input, user))
}

export async function reverseProjectDistribution(distributionId, reason, user) {
  const distribution = await RevenueDistribution.findOne({ _id: distributionId, entryType: 'receipt', status: 'finalized' })
    .select('projectId allocations')
  if (!distribution) throw Object.assign(new Error('Finalized project distribution not found.'), { statusCode: 404 })
  return withFinanceLocks([
    projectLock(distribution.projectId),
    companyLock(),
    ...distribution.allocations.filter((allocation) => allocation.recipientType === 'founder').map((allocation) => founderLock(allocation.founderId)),
  ], () => reverseProjectDistributionLocked(distributionId, String(reason || ''), user))
}

async function createFounderTransferLocked(input, user) {
  const fromId = String(input.fromFounderId || '')
  const toId = String(input.toFounderId || '')
  const toOwnerType = input.toOwnerType === 'company' ? 'company' : 'founder'
  if (!mongoose.isValidObjectId(fromId) || (toOwnerType === 'founder' && (!mongoose.isValidObjectId(toId) || fromId === toId))) {
    throw Object.assign(new Error('Choose an eligible founder and a different founder or the company as destination.'), { statusCode: 400 })
  }
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Transfer amount must be greater than zero.'), { statusCode: 400 })
  const eligibleIds = toOwnerType === 'founder' ? [fromId, toId] : [fromId]
  const eligible = await User.countDocuments({
    _id: { $in: eligibleIds },
    portalType: 'team',
    role: { $in: eligibleFounderRoles },
    isActive: true,
  })
  if (eligible !== eligibleIds.length) throw Object.assign(new Error('Transfers are limited to active internal founders.'), { statusCode: 400 })
  let distribution = null
  if (input.distributionId) {
    if (!mongoose.isValidObjectId(String(input.distributionId))) throw Object.assign(new Error('Choose a valid project distribution.'), { statusCode: 400 })
    distribution = await RevenueDistribution.findOne({
      _id: input.distributionId,
      entryType: 'receipt',
      status: 'finalized',
    })
    if (!distribution) throw Object.assign(new Error('Finalized project distribution not found.'), { statusCode: 404 })
  }
  const [founderDistributions, relatedTransfers] = await Promise.all([
    distribution
      ? Promise.resolve([distribution])
      : RevenueDistribution.find({ entryType: 'receipt', status: 'finalized' }).select('allocations'),
    FounderTransfer.find({ status: 'finalized', ...(distribution ? { distributionId: distribution._id } : {}) }),
  ])
  const original = founderDistributions.flatMap((entry) => entry.allocations)
    .filter((allocation) => allocation.recipientType === 'founder' && String(allocation.founderId) === fromId)
    .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
  const received = relatedTransfers.filter((transfer) => transfer.toOwnerType === 'founder' && String(transfer.toFounderId) === fromId).reduce((sum, transfer) => sum + transfer.amount, 0)
  const sent = relatedTransfers.filter((transfer) => String(transfer.fromFounderId) === fromId).reduce((sum, transfer) => sum + transfer.amount, 0)
  const available = Math.round((original + received - sent) * 100) / 100
  if (amount > available) throw Object.assign(new Error(`Transfer exceeds the founder's available allocation of ₹${available.toFixed(2)}${distribution ? ' for this project' : ''}.`), { statusCode: 409 })
  const transfer = await FounderTransfer.create({
    transferCode: `TRF-${randomBytes(4).toString('hex').toUpperCase()}`,
    fromFounderId: fromId,
    toFounderId: toOwnerType === 'founder' ? toId : undefined,
    toOwnerType,
    projectId: distribution?.projectId,
    distributionId: distribution?._id,
    amount,
    reason: String(input.reason || '').trim(),
    createdBy: user._id,
    finalizedAt: new Date(),
  })
  await recordFinanceAudit({
    actor: user._id,
    action: 'founder_transfer.finalized',
    transferId: transfer._id,
    projectId: distribution?.projectId,
    distributionId: distribution?._id,
    after: { fromFounderId: fromId, toFounderId: toOwnerType === 'founder' ? toId : null, toOwnerType, amount, reason: transfer.reason },
  })
  await recordActivity({
    actor: user._id,
    action: 'founder_transfer.finalized',
    entityType: 'founder_transfer',
    entityId: transfer._id,
    projectId: distribution?.projectId,
    metadata: { newValue: { fromFounderId: fromId, toFounderId: toOwnerType === 'founder' ? toId : null, toOwnerType, amount, distributionId: distribution?._id } },
    description: `Founder allocation transfer ${transfer.transferCode} finalized for ${amount.toFixed(2)}.`,
  })
  return transfer
}

export async function createFounderTransfer(input, user) {
  const locks = [founderLock(String(input.fromFounderId || ''))]
  if (input.toOwnerType === 'company') locks.push(companyLock())
  else if (input.toFounderId) locks.push(founderLock(String(input.toFounderId)))
  if (input.distributionId) {
    const distribution = await RevenueDistribution.findById(input.distributionId).select('projectId')
    if (distribution) locks.push(projectLock(distribution.projectId))
  }
  return withFinanceLocks(locks, () => createFounderTransferLocked(input, user))
}

async function reverseFounderTransferLocked(transferId, reason, user) {
  const transfer = await FounderTransfer.findOne({ _id: transferId, status: 'finalized' })
  if (!transfer) throw Object.assign(new Error('Finalized founder transfer not found.'), { statusCode: 404 })
  const destinationId = transfer.toOwnerType === 'company' ? null : String(transfer.toFounderId)
  let available
  if (transfer.distributionId) {
    const [distribution, relatedTransfers] = await Promise.all([
      RevenueDistribution.findById(transfer.distributionId).select('allocations'),
      FounderTransfer.find({ distributionId: transfer.distributionId, status: 'finalized' }),
    ])
    const initial = transfer.toOwnerType === 'company'
      ? distribution?.allocations.filter((allocation) => allocation.recipientType === 'company').reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
      : distribution?.allocations.filter((allocation) => allocation.recipientType === 'founder' && String(allocation.founderId) === destinationId).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
    const received = transfer.toOwnerType === 'company'
      ? relatedTransfers.filter((entry) => entry.toOwnerType === 'company').reduce((sum, entry) => sum + entry.amount, 0)
      : relatedTransfers.filter((entry) => entry.toOwnerType === 'founder' && String(entry.toFounderId) === destinationId).reduce((sum, entry) => sum + entry.amount, 0)
    const sent = transfer.toOwnerType === 'company'
      ? 0
      : relatedTransfers.filter((entry) => String(entry.fromFounderId) === destinationId).reduce((sum, entry) => sum + entry.amount, 0)
    available = Number(initial || 0) + received - sent
  } else {
    const row = (await distributionSummary()).find((entry) => transfer.toOwnerType === 'company'
      ? entry.recipientType === 'company'
      : entry.recipientType === 'founder' && String(entry.founderId) === destinationId)
    available = Number(row?.amount || 0)
  }
  const globalBalance = (await distributionSummary()).find((entry) => transfer.toOwnerType === 'company'
    ? entry.recipientType === 'company'
    : entry.recipientType === 'founder' && String(entry.founderId) === destinationId)
  available = Math.min(available, Number(globalBalance?.amount || 0))
  if (Number(transfer.amount) > available + 0.001) {
    throw Object.assign(new Error('The recipient has already used part of this transfer; reconcile the balance before reversing it.'), { statusCode: 409 })
  }
  const before = transfer.toObject()
  transfer.status = 'reversed'
  transfer.reversedBy = user._id
  transfer.reversedAt = new Date()
  transfer.reversalReason = reason.trim()
  await transfer.save()
  await recordFinanceAudit({
    actor: user._id,
    action: 'founder_transfer.reversed',
    transferId: transfer._id,
    projectId: transfer.projectId,
    distributionId: transfer.distributionId,
    before,
    after: transfer.toObject(),
    reason: reason.trim(),
  })
  await recordActivity({
    actor: user._id,
    action: 'founder_transfer.reversed',
    entityType: 'founder_transfer',
    entityId: transfer._id,
    projectId: transfer.projectId,
    metadata: { oldValue: before, newValue: transfer.toObject() },
    description: `Founder transfer reversed: ${reason.trim()}`,
  })
  return transfer
}

export async function reverseFounderTransfer(transferId, reason, user) {
  const transfer = await FounderTransfer.findOne({ _id: transferId, status: 'finalized' })
  if (!transfer) throw Object.assign(new Error('Finalized founder transfer not found.'), { statusCode: 404 })
  const locks = [founderLock(transfer.fromFounderId)]
  if (transfer.toOwnerType === 'company') locks.push(companyLock())
  else locks.push(founderLock(transfer.toFounderId))
  if (transfer.projectId) locks.push(projectLock(transfer.projectId))
  return withFinanceLocks(locks, () => reverseFounderTransferLocked(transferId, String(reason || ''), user))
}

export async function listFounderTransfers(query = {}) {
  const filter = {}
  if (query.projectId) filter.projectId = query.projectId
  if (query.founderId) filter.$or = [{ fromFounderId: query.founderId }, { toFounderId: query.founderId }]
  return FounderTransfer.find(filter)
    .sort({ finalizedAt: -1 })
    .limit(Math.min(Number(query.limit) || 100, 500))
    .populate('fromFounderId toFounderId', 'name role')
    .populate('projectId', 'projectName')
    .populate('distributionId', 'grossAmount')
}

function financeDateFilter(query, field = 'finalizedAt') {
  if (!query.startDate && !query.endDate) return {}
  const range = {}
  if (query.startDate) range.$gte = new Date(query.startDate)
  if (query.endDate) range.$lte = new Date(query.endDate)
  return { [field]: range }
}

export async function listCompanyTransactions(query = {}) {
  const filter = { status: 'finalized' }
  if (query.type) filter.type = query.type
  if (query.startDate || query.endDate) Object.assign(filter, financeDateFilter(query, 'occurredAt'))
  return CompanyFinancialTransaction.find(filter).sort({ occurredAt: -1 })
    .limit(Math.min(Number(query.limit) || 100, 500))
    .populate('createdBy', 'name role')
}

async function createCompanyTransactionLocked(input, user) {
  const type = String(input.type || '')
  if (!['external_funding', 'investment'].includes(type)) {
    throw Object.assign(new Error('Choose external funding or investment.'), { statusCode: 400 })
  }
  const amount = Math.round(Number(input.amount) * 100) / 100
  const description = String(input.description || '').trim()
  if (!Number.isFinite(amount) || amount <= 0 || !description || description.length > 1000) {
    throw Object.assign(new Error('Provide a positive amount and a description of up to 1000 characters.'), { statusCode: 400 })
  }
  if (String(input.currency || 'INR').toUpperCase() !== 'INR') {
    throw Object.assign(new Error('Company financial transactions currently support INR only.'), { statusCode: 400 })
  }
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()
  if (Number.isNaN(occurredAt.getTime())) throw Object.assign(new Error('Provide a valid transaction date.'), { statusCode: 400 })
  if (type === 'investment') {
    const company = (await distributionSummary()).find((row) => row.recipientType === 'company' && row.currency === 'INR')
    const available = Math.round(Number(company?.amount || 0) * 100) / 100
    if (amount > available) {
      throw Object.assign(new Error(`Investment exceeds available company funds of ₹${available.toFixed(2)}.`), { statusCode: 409 })
    }
  }
  const transaction = await CompanyFinancialTransaction.create({
    transactionCode: `${type === 'investment' ? 'INV' : 'FND'}-${randomBytes(4).toString('hex').toUpperCase()}`,
    type,
    amount,
    currency: String(input.currency || 'INR').toUpperCase(),
    occurredAt,
    description,
    reference: String(input.reference || '').trim(),
    createdBy: user._id,
    finalizedAt: new Date(),
  })
  await recordFinanceAudit({
    actor: user._id,
    action: `company.${type}.finalized`,
    companyTransactionId: transaction._id,
    after: { type, amount, currency: transaction.currency, description, reference: transaction.reference, occurredAt: transaction.occurredAt },
  })
  await recordActivity({
    actor: user._id,
    action: `company.${type}.finalized`,
    entityType: 'company_financial_transaction',
    entityId: transaction._id,
    metadata: { newValue: { type, amount, currency: transaction.currency, description, reference: transaction.reference } },
    description: `${type === 'investment' ? 'Investment' : 'External company funding'} finalized: ${transaction.currency} ${amount.toFixed(2)} — ${description}.`,
  })
  return transaction
}

export async function createCompanyTransaction(input, user) {
  return withFinanceLocks([companyLock(String(input.currency || 'INR').toUpperCase())], () => createCompanyTransactionLocked(input, user))
}

export async function listDistributions(query = {}) {
  const filter = {}
  if (query.projectId) filter.projectId = query.projectId
  if (query.paymentId) filter.paymentId = query.paymentId
  const items = await RevenueDistribution.find(filter)
    .sort({ finalizedAt: -1 })
    .limit(Math.min(Number(query.limit) || 100, 500))
    .populate('paymentId', 'paymentCode status paymentMethod paymentDate')
    .populate('projectId', 'projectName')
    .populate('clientId', 'name businessName')
    .populate('allocations.founderId', 'name')
  return items
}

export async function distributionSummary(query = {}) {
  const match = {}
  if (query.projectId) match.projectId = new mongoose.Types.ObjectId(query.projectId)
  Object.assign(match, financeDateFilter(query))
  const rows = await RevenueDistribution.aggregate([
    { $match: match },
    { $unwind: '$allocations' },
    {
      $group: {
        _id: { recipientType: '$allocations.recipientType', founderId: '$allocations.founderId', founderName: '$allocations.founderName', currency: '$currency' },
        amount: { $sum: '$allocations.amount' },
        receipts: { $sum: { $cond: [{ $eq: ['$entryType', 'receipt'] }, 1, 0] } },
      },
    },
    { $sort: { '_id.recipientType': 1, '_id.founderName': 1, '_id.currency': 1 } },
  ])
  const transfers = await FounderTransfer.find({
    status: 'finalized',
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...financeDateFilter(query),
  })
    .populate('distributionId', 'currency')
  const companyTransactions = query.projectId ? [] : await listCompanyTransactions(query)
  const summary = new Map(rows.map((row) => {
    const founderId = row._id.founderId ? String(row._id.founderId) : null
    return [`${row._id.recipientType}:${founderId || row._id.currency}`, {
      recipientType: row._id.recipientType,
      founderId: row._id.founderId,
      name: row._id.founderName,
      currency: row._id.currency,
      allocatedAmount: row.amount,
      transfersReceived: 0,
      transfersSent: 0,
      externalFunding: 0,
      investments: 0,
      amount: row.amount,
      receipts: row.receipts,
    }]
  }))
  if (!query.projectId) {
    const founders = await User.find({
      portalType: 'team',
      role: { $in: eligibleFounderRoles },
      isActive: true,
    }).select('_id name')
    for (const founder of founders) {
      const key = `founder:${String(founder._id)}`
      if (!summary.has(key)) summary.set(key, {
        recipientType: 'founder',
        founderId: founder._id,
        name: founder.name,
        currency: 'INR',
        allocatedAmount: 0,
        transfersReceived: 0,
        transfersSent: 0,
        externalFunding: 0,
        investments: 0,
        amount: 0,
        receipts: 0,
      })
    }
    if (!summary.has('company:INR')) summary.set('company:INR', {
      recipientType: 'company',
      founderId: null,
      name: 'MAGAF Technologies',
      currency: 'INR',
      allocatedAmount: 0,
      transfersReceived: 0,
      transfersSent: 0,
      externalFunding: 0,
      investments: 0,
      amount: 0,
      receipts: 0,
    })
  }
  for (const transfer of transfers) {
    const fromKey = `founder:${String(transfer.fromFounderId)}`
    const from = summary.get(fromKey)
    if (from) {
      from.transfersSent += transfer.amount
      from.amount -= transfer.amount
    }
    const currency = transfer.distributionId?.currency || 'INR'
    if (transfer.toOwnerType === 'company') {
      const toKey = `company:${currency}`
      let to = summary.get(toKey)
      if (!to) {
        to = { recipientType: 'company', founderId: null, name: 'MAGAF Technologies', currency, allocatedAmount: 0, transfersReceived: 0, transfersSent: 0, externalFunding: 0, investments: 0, amount: 0, receipts: 0 }
        summary.set(toKey, to)
      }
      to.transfersReceived += transfer.amount
      to.amount += transfer.amount
    } else {
      const toKey = `founder:${String(transfer.toFounderId)}`
      let to = summary.get(toKey)
      if (!to) {
        const founder = await User.findById(transfer.toFounderId).select('name')
        to = { recipientType: 'founder', founderId: transfer.toFounderId, name: founder?.name || 'Founder', currency, allocatedAmount: 0, transfersReceived: 0, transfersSent: 0, externalFunding: 0, investments: 0, amount: 0, receipts: 0 }
        summary.set(toKey, to)
      }
      to.transfersReceived += transfer.amount
      to.amount += transfer.amount
    }
  }
  for (const transaction of companyTransactions) {
    const key = `company:${transaction.currency}`
    let company = summary.get(key)
    if (!company) {
      company = { recipientType: 'company', founderId: null, name: 'MAGAF Technologies', currency: transaction.currency, allocatedAmount: 0, transfersReceived: 0, transfersSent: 0, externalFunding: 0, investments: 0, amount: 0, receipts: 0 }
      summary.set(key, company)
    }
    if (transaction.type === 'external_funding') {
      company.externalFunding += transaction.amount
      company.amount += transaction.amount
    } else {
      company.investments += transaction.amount
      company.amount -= transaction.amount
    }
  }
  return [...summary.values()].map((row) => ({
    ...row,
    currentAvailable: Math.round(row.amount * 100) / 100,
    amount: Math.round(row.amount * 100) / 100,
  }))
}

export async function listFinanceAudit(query = {}) {
  const filter = {}
  for (const field of ['paymentId', 'projectId', 'accountId', 'distributionId', 'transferId', 'companyTransactionId', 'action']) if (query[field]) filter[field] = query[field]
  return FinanceAudit.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(query.limit) || 100, 500))
    .populate('actor', 'name role')
    .populate('paymentId', 'paymentCode')
    .populate('projectId', 'projectName')
    .populate('transferId', 'transferCode')
    .populate('companyTransactionId', 'transactionCode type amount')
}
