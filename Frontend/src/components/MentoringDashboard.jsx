import { useState } from 'react'
import { useData } from '../context/DataContext'
import { currency, paymentValue, studentBalance, studentPaid } from '../utils/calculations'
import Icon from './Icon'

const statusOptions=['All statuses','Inquiry','Enrolled','Active','Paused','Completed','Dropped']

export default function MentoringDashboard({quickAdd,navigate}){
  const {data,patch,loading,error}=useData()
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('All statuses')
  const [topic,setTopic]=useState('All topics')
  const mentoringService=data.services.find((service)=>service.supportsStudents||service.legacyKey==='mentoring')
  const students=data.students.filter((student)=>!student.serviceId||!mentoringService||student.serviceId===mentoringService.id)
  const sessions=data.mentoringSessions||[]
  const studentIds=new Set(students.map((student)=>student.id))
  const payments=data.payments.filter((payment)=>payment.studentId&&studentIds.has(payment.studentId))
  const mentoringMetrics=data.dashboardSummary?.mentoring
  const monthStart=new Date()
  monthStart.setDate(1)
  monthStart.setHours(0,0,0,0)
  const newThisMonth=mentoringMetrics?.newThisMonth??students.filter((student)=>new Date(student.createdAt)>=monthStart).length
  const recentEnrollments=[...students].sort((left,right)=>new Date(right.createdAt||right.enrollmentDate||0)-new Date(left.createdAt||left.enrollmentDate||0)).slice(0,5)
  const recentPayments=payments.filter((payment)=>payment.status==='Paid').sort((left,right)=>new Date(right.date||right.paymentDate||right.createdAt||0)-new Date(left.date||left.paymentDate||left.createdAt||0)).slice(0,5)
  const paid=mentoringMetrics?.collected??payments.reduce((sum,payment)=>sum+paymentValue(payment),0)
  const agreed=mentoringMetrics?.agreedFees??students.reduce((sum,student)=>sum+Number(student.agreedAmount||0),0)
  const pending=mentoringMetrics?.outstanding??students.reduce((sum,student)=>sum+studentBalance(data,student),0)
  const topics=(mentoringMetrics?.topics||[]).map(({topic:label,students:count})=>[label,count])
  const topicOptions=[...new Set(students.flatMap((student)=>String(student.topics||'').split(/[,;]/).map((item)=>item.trim()).filter(Boolean)))].sort()
  const filtered=students.filter((student)=>(status==='All statuses'||student.status===status)&&
    (topic==='All topics'||String(student.topics||'').split(/[,;]/).map((item)=>item.trim()).includes(topic))&&
    (!query||[student.studentCode,student.name,student.phone,student.email,student.college,student.courseName,student.topics,student.mentor].some((value)=>value?.toLowerCase().includes(query.toLowerCase()))))
  const upcoming=sessions.filter((session)=>session.status==='Scheduled'&&session.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5)
  const cards=[
    ['Total students',mentoringMetrics?.students??students.length,'Unique student records','users'],
    ['Total enrollments',mentoringMetrics?.enrollments??students.filter((student)=>['Enrolled','Active','Paused','Completed'].includes(student.status)).length,'Eligible mentorship enrollments','graduation'],
    ['Active students',mentoringMetrics?.activeStudents??students.filter((student)=>student.status==='Active').length,'Currently learning','graduation'],
    ['Completed',mentoringMetrics?.completedStudents??students.filter((student)=>student.status==='Completed').length,'Finished enrollments','check'],
    ['New this month',newThisMonth,'New student enrollments','user'],
    ['Mentoring Collections',currency(paid),'Included in Total Collected Revenue','card'],
    ['Total Contracted Value',currency(agreed),'Agreed fees for eligible enrollments','chart'],
    ['Outstanding Balance',currency(pending),'Remaining on eligible enrollments','clock'],
    ['Payments pending',mentoringMetrics?.pendingPayments??payments.filter((payment)=>['Submitted','Under Verification','Correction Requested'].includes(payment.status)).length,'Awaiting verification','clock'],
  ]
  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">SERVICE WORKSPACE · STUDENT-BASED</span><h1>Mentoring dashboard</h1><p>Track student enrollment, learning progress, sessions and collections separately from client projects.</p></div><div className="heading-actions"><button className="button button-outline" onClick={()=>quickAdd('payments')}><Icon name="card" size={16}/> Add student payment</button><button className="button button-primary" onClick={()=>quickAdd('students')}><Icon name="plus" size={16}/> Add student</button></div></div>
    <section className="mentoring-kpis">{cards.map(([label,value,caption,icon])=><article className="panel mentoring-kpi" key={label}><span className="mentoring-kpi-icon"><Icon name={icon} size={17}/></span><small>{label}</small><strong>{value}</strong><span>{caption}</span></article>)}</section>
    <div className="dashboard-grid mentoring-recent">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ENROLLMENTS</span><h2>New students</h2></div></div>{recentEnrollments.length?recentEnrollments.map((student)=><button className="detail-list-row" key={student.id} onClick={()=>navigate?.(`students/${student.id}`)}><span className="avatar">{student.name?.slice(0,1)||'S'}</span><span><strong>{student.name}</strong><small>{student.courseName||'Learning track not specified'} · {student.enrollmentDate?new Date(student.enrollmentDate).toLocaleDateString('en-IN'):'Enrollment date not set'}</small></span><span className="status-pill">{student.status}</span></button>):<p className="chart-empty">No student enrollments yet.</p>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT PAYMENT ACTIVITY</span><h2>Student payments</h2></div></div>{recentPayments.length?recentPayments.map((payment)=>{const student=data.students.find((item)=>item.id===payment.studentId);return <button className="detail-list-row" key={payment.id} onClick={()=>navigate?.(`students/${payment.studentId}?payment=${payment.id}`)}><span className="mentoring-kpi-icon"><Icon name="card" size={16}/></span><span><strong>{student?.name||'Student'} · {currency(payment.amount)}</strong><small>{payment.method||payment.paymentMethod||'Payment'} · {payment.date?new Date(payment.date).toLocaleDateString('en-IN'):'Date not set'}</small></span><span className="status-pill">{payment.status}</span></button>}):<p className="chart-empty">No student payments recorded yet.</p>}</section>
    </div>
    <div className="dashboard-grid analytics-grid mentoring-analytics">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ENROLLED LEARNERS · UNIQUE STUDENT COUNTS</span><h2>Students by Topic</h2></div></div>{topics.length?topics.slice(0,8).map(([name,count])=><div className="mentoring-topic" key={name} title={`${count} enrolled ${count===1?'student':'students'} in ${name}`}><span title={name}>{name}</span><div className="service-comparison-track"><i style={{width:`${count/Math.max(...topics.map((item)=>item[1]),1)*100}%`}}/></div><b>{count}</b></div>):<div className="chart-empty" role={error?'alert':'status'}>{loading?'Loading topic analytics…':error?'Topic analytics could not be loaded. Please refresh and try again.':'No enrolled students have topics assigned yet.'}</div>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ENROLLMENT HEALTH</span><h2>Students by status</h2></div></div><div className="mentoring-status-list">{statusOptions.slice(1).map((item)=><div key={item}><span className={`status-pill ${item.toLowerCase()}`}>{item}</span><strong>{students.filter((student)=>student.status===item).length}</strong></div>)}</div><div className="mentoring-upcoming"><div className="panel-heading"><div><span className="eyebrow">SCHEDULE</span><h2>Upcoming sessions</h2></div><button className="text-action" onClick={()=>quickAdd('mentoringSessions')}>Add session <Icon name="plus" size={13}/></button></div>{upcoming.length?upcoming.map((session)=><div className="mentoring-session" key={session.id}><span><strong>{data.students.find((student)=>student.id===session.studentId)?.name||'Student'}</strong><small>{session.topic} · {session.mentor||'Mentor not assigned'}</small></span><time>{session.date}</time><select aria-label={`Update session ${session.topic}`} value={session.status} onChange={(event)=>patch('mentoringSessions',session.id,{status:event.target.value})}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></div>):<p className="chart-empty">No upcoming mentoring sessions. Add a session to create a schedule.</p>}</div></section>
    </div>
    <section className="panel table-panel mentoring-students"><div className="panel-heading"><div><span className="eyebrow">ENROLLMENT RECORDS</span><h2>Students</h2></div><button className="button button-outline button-small" onClick={()=>quickAdd('mentoringSessions')}><Icon name="calendar" size={14}/> Schedule session</button></div>
      <div className="record-filters"><label className="search-field mentoring-search"><Icon name="search" size={15}/><input aria-label="Search mentoring students" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search students…"/></label><select aria-label="Filter mentoring students by status" value={status} onChange={(event)=>setStatus(event.target.value)}>{statusOptions.map((item)=><option key={item}>{item}</option>)}</select><select aria-label="Filter mentoring students by topic" value={topic} onChange={(event)=>setTopic(event.target.value)}><option>All topics</option>{topicOptions.map((item)=><option key={item}>{item}</option>)}</select><span className="table-count">{filtered.length} students</span></div>
      {filtered.length?<div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Student</th><th>Course / track</th><th>Topics</th><th>Mentor</th><th>Agreed</th><th>Collected</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((student)=><tr key={student.id}><td className="ref-id">{student.studentCode||student.id}</td><td><button className="student-link" onClick={()=>navigate?.(`students/${student.id}`)}><strong>{student.name}</strong></button><small className="student-contact">{student.email||student.phone||student.college||'—'}</small></td><td>{student.courseName||student.goal||'—'}</td><td>{student.topics||'—'}</td><td>{student.mentor||'Unassigned'}</td><td>{currency(student.agreedAmount)}</td><td>{currency(studentPaid(data,student))}</td><td>{currency(studentBalance(data,student))}</td><td><span className="status-pill">{student.status}</span></td><td className="row-actions"><button className="mini-action" onClick={()=>quickAdd('payments',{studentId:student.id,serviceId:student.serviceId})}>Record payment</button><button className="mini-action" onClick={()=>quickAdd('mentoringSessions',{studentId:student.id,mentor:student.mentor})}>Schedule</button><button className="mini-action" onClick={()=>quickAdd('students',student,student.id)}>Edit</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><h3>No students match these filters</h3><p>Try changing the topic or status filter.</p></div>}
    </section>
  </div>
}
