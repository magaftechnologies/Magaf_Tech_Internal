import { FinanceAudit } from '../models/index.js'

export function financialSnapshot(payment) {
  if (!payment) return null
  return {
    paymentCode: payment.paymentCode,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    paymentSource: payment.paymentSource,
    verificationStatus: payment.verificationStatus,
    transactionId: payment.transactionId,
    paymentAccountId: payment.paymentAccountId?.toString?.() || payment.paymentAccountId || null,
    receivingAccount: payment.receivingAccount || null,
    projectId: payment.projectId?.toString?.() || payment.projectId || null,
    clientId: payment.clientId?.toString?.() || payment.clientId || null,
    invoiceId: payment.invoiceId?.toString?.() || payment.invoiceId || null,
    proofFiles: (payment.proofFiles || []).map((file) => file?._id?.toString?.() || file?.toString?.() || file),
    verifiedBy: payment.verifiedBy?.toString?.() || payment.verifiedBy || null,
    cashApprovedBy: payment.cashApprovedBy?.toString?.() || payment.cashApprovedBy || null,
  }
}

export async function recordFinanceAudit({ actor, action, paymentId, projectId, accountId, distributionId, transferId, companyTransactionId, before, after, reason }) {
  return FinanceAudit.create({
    actor,
    action,
    paymentId,
    projectId,
    accountId,
    distributionId,
    transferId,
    companyTransactionId,
    before,
    after,
    reason,
  })
}
