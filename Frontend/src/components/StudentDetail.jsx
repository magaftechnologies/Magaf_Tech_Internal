import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { currency, paymentValue, studentBalance, studentPaid } from '../utils/calculations'
import Icon from './Icon'

const idOf = (value) => value && typeof value === 'object' ? value.id || value._id : value

export default function StudentDetail({ id, paymentId, navigate, quickAdd }) {
  const { data } = useData()
  const { user } = useAuth()
  const student = data.students.find((record) => record.id === id)
  const payments = data.payments.filter((payment) => String(payment.studentId) === String(id))
    .sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0))
  const collected = student ? studentPaid(data, student) : 0
  const agreed = Number(student?.agreedAmount || 0)
  const balance = student ? studentBalance(data, student) : 0
  const paidPayments = payments.filter((payment) => paymentValue(payment) > 0)
  const pendingPayments = payments.filter((payment) => ['Submitted', 'Under Verification', 'Correction Requested'].includes(payment.status))
  const canEdit = ['super_admin', 'admin', 'manager', 'mentor'].includes(user?.role)
  const canRecordPayment = ['super_admin', 'admin', 'manager', 'mentor', 'finance'].includes(user?.role)

  useEffect(() => {
    if (!paymentId) return undefined
    const timer = window.setTimeout(() => {
      document.getElementById(`student-payment-${paymentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [paymentId, payments.length])

  if (!student) {
    return <div className="page-stack"><button className="back-link" onClick={() => navigate('students')}><Icon name="chevron" size={15}/> Mentoring dashboard</button><section className="panel empty-state"><h2>Student not found</h2><p>This student may have been removed or is not available to your account.</p></section></div>
  }

  const paymentStatus = collected > agreed ? 'Overpayment review required'
    : agreed > 0 && collected >= agreed ? 'Fully Paid'
      : collected > 0 ? 'Partially Paid'
        : pendingPayments.length ? 'Pending Verification' : 'Unpaid'
  const latestPayment = paidPayments[0]
  const activity = (data.activities || []).filter((item) =>
    String(item.recordId) === String(id) || payments.some((payment) => String(item.recordId) === String(payment.id)))

  return <div className="page-stack">
    <button className="back-link" onClick={() => navigate('students')}><Icon name="chevron" size={15}/> Mentoring dashboard</button>
    <section className="detail-hero panel">
      <span className="avatar avatar-large">{student.name?.slice(0, 1) || 'S'}</span>
      <div className="detail-hero-copy"><div className="eyebrow">STUDENT PROFILE · {student.studentCode || student.id}</div><h1>{student.name}</h1><p>{student.courseName || student.goal || 'Learning track not specified'} · {student.status}</p></div>
      <div className="detail-actions">
        {canEdit && <button className="button button-outline" onClick={() => quickAdd('students', student, student.id)}><Icon name="settings" size={15}/> Edit student</button>}
        {canRecordPayment && <button className="button button-primary" onClick={() => quickAdd('payments', { studentId: student.id, serviceId: student.serviceId })}><Icon name="card" size={15}/> Add payment</button>}
      </div>
    </section>
    <div className="summary-strip">
      <Summary label="Agreed fee" value={currency(agreed)}/>
      <Summary label="Verified collected" value={currency(collected)}/>
      <Summary label="Outstanding balance" value={currency(balance)}/>
      <Summary label="Payment status" value={paymentStatus}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>Enrollment & contact</h2></div></div>
        <Info label="Email" value={student.email}/>
        <Info label="Phone" value={student.phone}/>
        <Info label="Enrollment date" value={student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString('en-IN') : '—'}/>
        <Info label="Course / learning track" value={student.courseName || student.goal}/>
        <Info label="Topics / modules" value={student.topics}/>
        <Info label="Mentor" value={student.mentor || 'Unassigned'}/>
        <Info label="Learning status" value={student.status}/>
        <Info label="Sessions" value={`${Number(student.sessionsCompleted || 0)} completed · ${Number(student.sessionsRemaining || 0)} remaining`}/>
        <Info label="Learning notes" value={student.notes}/>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">FINANCIAL OVERVIEW</span><h2>Enrollment collections</h2></div></div>
        <Info label="Agreed enrollment fee" value={currency(agreed)}/>
        <Info label="Total verified collected" value={currency(collected)}/>
        <Info label="Outstanding balance" value={currency(balance)}/>
        <Info label="Pending verification" value={`${pendingPayments.length} payment${pendingPayments.length === 1 ? '' : 's'}`}/>
        <Info label="Verified payment count" value={paidPayments.length}/>
        <Info label="Latest verified payment" value={latestPayment ? new Date(latestPayment.date || latestPayment.createdAt).toLocaleDateString('en-IN') : '—'}/>
        <Info label="Payment status" value={paymentStatus}/>
        {collected > agreed && <p className="form-error" role="alert">Verified collections exceed the current agreement by {currency(collected - agreed)}. An authorized financial resolution is required.</p>}
      </section>
    </div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><span className="eyebrow">AUTHORITATIVE PAYMENT RECORDS</span><h2>Payment history</h2></div><span className="table-count">{payments.length} payment records</span></div>
      {payments.length ? <div className="table-scroll"><table><thead><tr><th>Payment ID</th><th>Amount</th><th>Date</th><th>Method · source</th><th>Reference</th><th>Status</th><th>Recorded by</th><th>Verified by</th><th>Proof</th></tr></thead><tbody>{payments.map((payment) => <tr id={`student-payment-${payment.id}`} className={String(paymentId) === String(payment.id) ? 'payment-row-focused' : ''} key={payment.id}>
        <td className="ref-id">{payment.paymentCode || payment.id}</td>
        <td>{currency(payment.amount)}</td>
        <td>{payment.date ? new Date(payment.date).toLocaleDateString('en-IN') : '—'}</td>
        <td>{payment.method || payment.paymentMethod || '—'} · {payment.paymentSource === 'client_portal' ? 'Client' : 'Internal'}</td>
        <td>{payment.transactionId || '—'}</td>
        <td><span className="status-pill">{payment.status}</span></td>
        <td>{payment.recordedBy?.name || payment.submittedBy?.name || '—'}<small>{payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-IN') : ''}</small></td>
        <td>{payment.verifiedBy?.name || payment.approvedBy?.name || payment.cashApprovedBy?.name || '—'}<small>{payment.verifiedAt || payment.cashApprovedAt ? new Date(payment.verifiedAt || payment.cashApprovedAt).toLocaleString('en-IN') : ''}</small></td>
        <td>{(payment.proofFiles || []).map((file, index) => {
          const url = typeof file === 'object' ? file.cloudinaryUrl || file.url : null
          return url ? <a key={idOf(file) || index} href={url} target="_blank" rel="noreferrer">{file.originalName || file.fileName || `Proof ${index + 1}`} ↗</a> : null
        })}</td>
      </tr>)}</tbody></table></div> : <div className="empty-state"><h3>No payments recorded</h3><p>Student payments appear here from the shared payment ledger.</p></div>}
    </section>
    {activity.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AUDIT & ACTIVITY</span><h2>Recent student activity</h2></div></div>{activity.slice(0, 8).map((item) => <div className="timeline-row" key={item.id}><span className="timeline-dot"/><span><strong>{item.title || item.action}</strong><small>{item.detail || item.description} · {item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : ''}</small></span></div>)}</section>}
  </div>
}

function Summary({ label, value }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong></div>
}

function Info({ label, value }) {
  return <div className="info-row"><span>{label}</span><strong>{value || '—'}</strong></div>
}
