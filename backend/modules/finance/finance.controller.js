import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './finance.service.js'

export const accounts = asyncHandler(async (req, res) => success(res, await service.listPaymentAccounts(req.user), 'Payment accounts retrieved.'))
export const createAccount = asyncHandler(async (req, res) => success(res, await service.savePaymentAccount(req.body, req.user), 'Payment account saved.', 201))
export const updateAccount = asyncHandler(async (req, res) => success(res, await service.savePaymentAccount(req.body, req.user, req.params.id), 'Payment account updated.'))
export const distributionRules = asyncHandler(async (req, res) => success(res, await service.updateDistributionRules(req.params.projectId, req.body, req.user), 'Revenue allocation rules updated.'))
export const finalizeProjectDistribution = asyncHandler(async (req, res) => success(res, await service.finalizeProjectDistribution(req.params.projectId, req.user), 'Project revenue distribution finalized.', 201))
export const updateDistribution = asyncHandler(async (req, res) => success(res, await service.updateProjectDistribution(req.params.id, req.body, req.user), 'Project distribution updated with an audit snapshot.'))
export const reverseDistribution = asyncHandler(async (req, res) => success(res, await service.reverseProjectDistribution(req.params.id, req.body.reason, req.user), 'Project distribution reversed with a compensating ledger entry.', 201))
export const createFounderTransfer = asyncHandler(async (req, res) => success(res, await service.createFounderTransfer(req.body, req.user), 'Founder allocation transfer finalized.', 201))
export const reverseFounderTransfer = asyncHandler(async (req, res) => success(res, await service.reverseFounderTransfer(req.params.id, req.body.reason, req.user), 'Founder allocation transfer reversed.'))
export const founderTransfers = asyncHandler(async (req, res) => success(res, await service.listFounderTransfers(req.query), 'Founder allocation transfers retrieved.'))
export const companyTransactions = asyncHandler(async (req, res) => success(res, await service.listCompanyTransactions(req.query), 'Company financial transactions retrieved.'))
export const createCompanyTransaction = asyncHandler(async (req, res) => success(res, await service.createCompanyTransaction(req.body, req.user), 'Company financial transaction finalized.', 201))
export const distributions = asyncHandler(async (req, res) => success(res, await service.listDistributions(req.query), 'Revenue distributions retrieved.'))
export const distributionSummary = asyncHandler(async (req, res) => success(res, await service.distributionSummary(req.query), 'Revenue distribution summary retrieved.'))
export const audit = asyncHandler(async (req, res) => success(res, await service.listFinanceAudit(req.query), 'Finance audit entries retrieved.'))
