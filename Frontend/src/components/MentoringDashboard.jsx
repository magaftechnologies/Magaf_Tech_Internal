import { useState } from 'react'
import { useData } from '../context/DataContext'
import { currency, studentBalance, studentPaid } from '../utils/calculations'
import Icon from './Icon'

const statusOptions=['All statuses','New','Active','Paused','Completed']

export default function MentoringDashboard({quickAdd}){
  const {data,patch}=useData()
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('All statuses')
  const [topic,setTopic]=useState('All topics')
  const students=data.students.filter((student)=>(student.serviceId||'mentoring')==='mentoring')
  const sessions=data.mentoringSessions||[]
  const studentIds=new Set(students.map((student)=>student.id))
  const payments=data.payments.filter((payment)=>payment.studentId&&studentIds.has(payment.studentId))
  const paid=payments.reduce((sum,payment)=>sum+(payment.type==='Refund'?-Number(payment.amount||0):Number(payment.amount||0)),0)
  const revenue=data.payments.filter((payment)=>payment.serviceId==='mentoring'||payment.studentId&&studentIds.has(payment.studentId)).reduce((sum,payment)=>sum+(payment.type==='Refund'?-Number(payment.amount||0):Number(payment.amount||0)),0)
  const agreed=students.reduce((sum,student)=>sum+Number(student.agreedAmount||0),0)
  const pending=students.reduce((sum,student)=>sum+studentBalance(data,student),0)
  const topicCounts={}
  students.forEach((student)=>String(student.topics||'').split(/[,;]/).map((item)=>item.trim()).filter(Boolean).forEach((item)=>{topicCounts[item]=(topicCounts[item]||0)+1}))
  const topics=Object.entries(topicCounts).sort((a,b)=>b[1]-a[1])
  const topicOptions=[...new Set(students.flatMap((student)=>String(student.topics||'').split(/[,;]/).map((item)=>item.trim()).filter(Boolean)))].sort()
  const filtered=students.filter((student)=>(status==='All statuses'||student.status===status)&&
    (topic==='All topics'||String(student.topics||'').split(/[,;]/).map((item)=>item.trim()).includes(topic))&&
    (!query||[student.name,student.contact,student.email,student.college,student.topics,student.mentor].some((value)=>value?.toLowerCase().includes(query.toLowerCase()))))
  const upcoming=sessions.filter((session)=>session.status==='Scheduled'&&session.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5)
  const cards=[
    ['Total students',students.length,'All mentoring enrollments','users'],
    ['Active students',students.filter((student)=>student.status==='Active').length,'Currently learning','graduation'],
    ['Completed',students.filter((student)=>student.status==='Completed').length,'Finished enrollments','check'],
    ['New students',students.filter((student)=>student.status==='New').length,'Awaiting onboarding','user'],
    ['Mentoring revenue',currency(revenue),'Included in MAGAF total revenue','trend'],
    ['Paid by students',currency(paid),'Ledger-linked student payments','card'],
    ['Pending balance',currency(pending),'Across active enrollments','clock'],
    ['Agreed fees',currency(agreed),'Student enrollment fees','chart'],
  ]
  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">SERVICE WORKSPACE · STUDENT-BASED</span><h1>Mentoring dashboard</h1><p>Track student enrollment, learning progress, sessions and collections separately from client projects.</p></div><button className="button button-primary" onClick={()=>quickAdd('students')}><Icon name="plus" size={16}/> Add student</button></div>
    <section className="mentoring-kpis">{cards.map(([label,value,caption,icon])=><article className="panel mentoring-kpi" key={label}><span className="mentoring-kpi-icon"><Icon name={icon} size={17}/></span><small>{label}</small><strong>{value}</strong><span>{caption}</span></article>)}</section>
    <div className="dashboard-grid analytics-grid mentoring-analytics">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LEARNING INTERESTS</span><h2>Students by topic</h2></div></div>{topics.length?topics.slice(0,8).map(([name,count])=><div className="mentoring-topic" key={name}><span>{name}</span><div className="service-comparison-track"><i style={{width:`${count/Math.max(...topics.map((item)=>item[1]),1)*100}%`}}/></div><b>{count}</b></div>):<div className="chart-empty">Topics will appear as students enroll.</div>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ENROLLMENT HEALTH</span><h2>Students by status</h2></div></div><div className="mentoring-status-list">{statusOptions.slice(1).map((item)=><div key={item}><span className={`status-pill ${item.toLowerCase()}`}>{item}</span><strong>{students.filter((student)=>student.status===item).length}</strong></div>)}</div><div className="mentoring-upcoming"><div className="panel-heading"><div><span className="eyebrow">SCHEDULE</span><h2>Upcoming sessions</h2></div><button className="text-action" onClick={()=>quickAdd('mentoringSessions')}>Add session <Icon name="plus" size={13}/></button></div>{upcoming.length?upcoming.map((session)=><div className="mentoring-session" key={session.id}><span><strong>{data.students.find((student)=>student.id===session.studentId)?.name||'Student'}</strong><small>{session.topic} · {session.mentor||'Mentor not assigned'}</small></span><time>{session.date}</time><select aria-label={`Update session ${session.topic}`} value={session.status} onChange={(event)=>patch('mentoringSessions',session.id,{status:event.target.value})}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></div>):<p className="chart-empty">No upcoming mentoring sessions. Add a session to create a schedule.</p>}</div></section>
    </div>
    <section className="panel table-panel mentoring-students"><div className="panel-heading"><div><span className="eyebrow">ENROLLMENT RECORDS</span><h2>Students</h2></div><button className="button button-outline button-small" onClick={()=>quickAdd('mentoringSessions')}><Icon name="calendar" size={14}/> Schedule session</button></div>
      <div className="record-filters"><label className="search-field mentoring-search"><Icon name="search" size={15}/><input aria-label="Search mentoring students" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search students…"/></label><select aria-label="Filter mentoring students by status" value={status} onChange={(event)=>setStatus(event.target.value)}>{statusOptions.map((item)=><option key={item}>{item}</option>)}</select><select aria-label="Filter mentoring students by topic" value={topic} onChange={(event)=>setTopic(event.target.value)}><option>All topics</option>{topicOptions.map((item)=><option key={item}>{item}</option>)}</select><span className="table-count">{filtered.length} students</span></div>
      {filtered.length?<div className="table-scroll"><table><thead><tr><th>Student</th><th>Topics</th><th>Mentor</th><th>Sessions</th><th>Agreed</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((student)=><tr key={student.id}><td><strong>{student.name}</strong><small className="student-contact">{student.college||student.email||student.contact}</small></td><td>{student.topics||'—'}</td><td>{student.mentor||'Unassigned'}</td><td>{Number(student.sessionsCompleted||0)} done · {Number(student.sessionsRemaining||0)} remaining</td><td>{currency(student.agreedAmount)}</td><td>{currency(studentPaid(data,student))}</td><td>{currency(studentBalance(data,student))}</td><td><span className="status-pill">{student.status}</span></td><td className="row-actions"><button className="mini-action" onClick={()=>quickAdd('payments',{studentId:student.id,serviceId:'mentoring'})}>Record payment</button><button className="mini-action" onClick={()=>quickAdd('mentoringSessions',{studentId:student.id,mentor:student.mentor})}>Schedule</button><button className="mini-action" onClick={()=>quickAdd('students',student,student.id)}>Edit</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><h3>No students match these filters</h3><p>Try changing the topic or status filter.</p></div>}
    </section>
  </div>
}
