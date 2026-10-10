import { useData } from '../context/DataContext'
import { currency } from '../utils/calculations'
import Icon from './Icon'

const idOf = (value) => String(value?.id || value?._id || value || '')

export default function FinanceProfile({ ownerType, ownerId, navigate }) {
  const { data, reverseFounderTransfer } = useData()
  const company = ownerType === 'company'
  const summary = data.distributionSummary.find((row) => row.recipientType === (company ? 'company' : 'founder')
    && (company || idOf(row.founderId) === ownerId))
  const name = company ? 'MAGAF Technologies' : summary?.name || data.teamMembers.find((member) => member.id === ownerId)?.name || 'Founder'
  const allocations = (data.revenueDistributions || []).filter((distribution) => distribution.entryType === 'receipt')
    .flatMap((distribution) => {
      const allocation = distribution.allocations?.find((item) => company
        ? item.recipientType === 'company'
        : item.recipientType === 'founder' && idOf(item.founderId) === ownerId)
      return allocation ? [{ distribution, allocation }] : []
    })
  const transfers = (data.founderTransfers || []).filter((transfer) => company
    ? transfer.toOwnerType === 'company'
    : idOf(transfer.fromFounderId) === ownerId || idOf(transfer.toFounderId) === ownerId)
  const transactions = company ? data.companyTransactions || [] : []
  const reverseTransfer = async (transfer) => {
    if (!window.confirm('Reverse this founder transfer?')) return
    const reason = window.prompt('Reason for reversing this transfer?')
    if (reason === null) return
    if (reason.trim().length < 3) {
      window.alert('Enter a reason of at least 3 characters.')
      return
    }
    try {
      await reverseFounderTransfer(transfer.id, reason.trim())
    } catch (error) {
      window.alert(error.message || 'Transfer reversal failed.')
    }
  }

  return <div className="page-stack">
    <button className="back-link" onClick={() => navigate('payments')}><Icon name="chevron" size={15}/> Back to financial overview</button>
    <section className="detail-hero panel"><span className="service-card-icon"><Icon name={company ? 'briefcase' : 'users'} size={21}/></span><div className="detail-hero-copy"><div className="eyebrow">{company ? 'COMPANY FINANCIAL PROFILE' : 'FOUNDER FINANCIAL PROFILE'}</div><h1>{name}</h1><p>Project allocations are historical earnings; transfers and company transactions change current available balance separately.</p></div></section>
    <div className="summary-strip">
      <Summary label={company ? 'Total project allocations' : 'Total allocated'} value={currency(summary?.allocatedAmount || 0)}/>
      <Summary label="Transfers received" value={currency(summary?.transfersReceived || 0)}/>
      <Summary label="Transfers sent" value={currency(summary?.transfersSent || 0)}/>
      {company&&<><Summary label="External funding" value={currency(summary?.externalFunding || 0)}/><Summary label="Investments" value={currency(summary?.investments || 0)}/></>}
      <Summary label="Current available balance" value={currency(summary?.amount || 0)}/>
    </div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">PROJECT-BY-PROJECT EARNINGS</span><h2>Distribution history</h2></div></div>
      {allocations.length?<div className="table-scroll"><table><thead><tr><th>Project</th><th>Project amount</th><th>Company allocation</th><th>Founder share</th><th>Effective share</th><th>Owner allocation</th><th>Status</th><th>Finalized</th></tr></thead><tbody>{allocations.map(({ distribution, allocation })=><tr key={distribution.id}><td><button className="inline-link" onClick={()=>navigate(`projects/${idOf(distribution.projectId)}`)}>{distribution.projectId?.projectName || 'Project'}</button></td><td>{currency(distribution.grossAmount)}</td><td>{distribution.companySharePercent}% · {currency(distribution.companyAmount)}</td><td>{allocation.recipientType==='founder'?`${allocation.contributionPercentage ?? allocation.percent}% of founder pool`:'—'}</td><td>{allocation.effectiveProjectPercentage ?? allocation.percent}%</td><td>{currency(allocation.amount)}</td><td>{distribution.status}</td><td>{distribution.finalizedAt?new Date(distribution.finalizedAt).toLocaleDateString('en-IN'):'—'}</td></tr>)}</tbody></table></div>:<p className="finance-hint">No project allocations yet.</p>}
    </section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">INTERNAL TRANSFERS</span><h2>Transfer history</h2></div></div>
      {transfers.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Project</th><th>From</th><th>To</th><th>Amount</th><th>Reason / status</th><th>Action</th></tr></thead><tbody>{transfers.map((transfer)=><tr key={transfer.id}><td>{transfer.finalizedAt?new Date(transfer.finalizedAt).toLocaleDateString('en-IN'):'—'}</td><td>{transfer.projectId?.projectName||'All allocations'}</td><td>{transfer.fromFounderId?.name||'—'}</td><td>{transfer.toOwnerType==='company'?'MAGAF Technologies':transfer.toFounderId?.name||'—'}</td><td>{currency(transfer.amount)}</td><td>{transfer.reason||'—'} · {transfer.status}</td><td>{transfer.status==='finalized'&&<button className="mini-action" onClick={()=>reverseTransfer(transfer)}>Reverse</button>}</td></tr>)}</tbody></table></div>:<p className="finance-hint">No transfer history yet.</p>}
    </section>
    {company&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">COMPANY FUNDS</span><h2>Funding & investment history</h2></div></div>
      {transactions.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th><th>Recorded by</th></tr></thead><tbody>{transactions.map((transaction)=><tr key={transaction.id}><td>{transaction.occurredAt?new Date(transaction.occurredAt).toLocaleDateString('en-IN'):'—'}</td><td>{transaction.type==='investment'?'Investment':'External funding'}</td><td>{transaction.description}</td><td>{transaction.reference||'—'}</td><td>{transaction.type==='investment'?'−':'+'}{currency(transaction.amount)}</td><td>{transaction.createdBy?.name||'—'}</td></tr>)}</tbody></table></div>:<p className="finance-hint">No external funding or investment transactions yet.</p>}
    </section>}
  </div>
}

function Summary({ label, value }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong></div>
}
