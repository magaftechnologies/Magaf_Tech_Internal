import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { currency, dashboardStats, serviceStats, outstanding, projectOutstanding, dealBalance, clientOutstanding, invoiceStatus, paymentServiceId, paymentValue } from '../utils/calculations'
import Icon from './Icon'
import MentoringDashboard from './MentoringDashboard'

const names = { leads:'Leads',clients:'Clients',projects:'Projects',deals:'Deals',payments:'Payments',invoices:'Invoices',services:'Services',tasks:'Tasks',requests:'Project requests',revisions:'Revisions',assets:'Creative assets',files:'Files',content:'Content & deliverables',students:'Mentoring dashboard',targets:'Targets',team:'Team members',reports:'Reports',products:'Product ideas',analytics:'Business analytics' }
const collections = { leads:'leads',clients:'clients',projects:'projects',deals:'deals',payments:'payments',invoices:'invoices',services:'services',tasks:'tasks',requests:'projectRequests',revisions:'revisions',assets:'assets',files:'files',content:'content',products:'products',students:'students',team:'users' }
const detailRoutes = { clients:'clients',leads:'leads',projects:'projects',deals:'deals' }
const display = (data, key, value) => {
  if (['serviceId'].includes(key)) return data.services.find((item) => item.id === value)?.shortName || value || '—'
  if (key === 'clientId') return data.clients.find((item) => item.id === value)?.name || '—'
  if (key === 'studentId') return data.students.find((item) => item.id === value)?.name || '—'
  if (key === 'projectId') return data.projects.find((item) => item.id === value)?.name || '—'
  return value || '—'
}
const configs = {
  leads:[['name','Business'],['contact','Contact'],['serviceId','Interested in'],['source','Source'],['potentialValue','Potential value'],['status','Status']],
  clients:[['name','Client'],['contact','Contact'],['serviceId','Service'],['location','Location'],['status','Status'],['outstanding','Outstanding']],
  projects:[['name','Project'],['clientId','Client'],['serviceId','Service'],['assignedTo','Owner'],['deadline','Due date'],['status','Status'],['balance','Balance']],
  payments:[['id','Payment ID'],['clientId','Client'],['projectId','Project'],['dealId','Deal'],['invoiceId','Invoice'],['date','Date'],['method','Method'],['paymentSource','Source'],['amount','Amount'],['status','Status'],['verificationStatus','Review'],['proofFiles','Proof']],
  invoices:[['invoiceNumber','Invoice'],['clientId','Client'],['projectId','Project'],['amount','Amount'],['issueDate','Issued'],['dueDate','Due date'],['paymentStatus','Payment status']],
  deals:[['title','Deal'],['clientId','Client'],['serviceId','Service'],['quotedAmount','Quoted'],['agreedAmount','Agreed'],['paidAmount','Paid'],['balance','Balance'],['paymentStatus','Payment status'],['status','Deal status'],['expectedCloseDate','Expected close']],
  tasks:[['title','Task'],['clientId','Client'],['assignedTo','Owner'],['deadline','Due date'],['priority','Priority'],['status','Status']],
  assets:[['name','Asset'],['type','Type'],['clientId','Client'],['status','Status'],['url','Link']],
  files:[['name','File'],['category','Category'],['clientId','Client'],['projectId','Project'],['uploadedAt','Uploaded'],['visibility','Visibility'],['url','Link']],
  content:[['name','Deliverable'],['clientId','Client'],['platform','Platform'],['scheduledDate','Scheduled'],['status','Status']],
  products:[['name','Product idea'],['target','Target customer'],['stage','Stage'],['priority','Priority']],
  students:[['name','Student'],['goal','Learning goal'],['topics','Topics'],['mentor','Mentor'],['sessionsRemaining','Sessions left'],['status','Status']],
  team:[['name','Name'],['role','Focus'],['email','Email'],['status','Status']],
}
function Status({ children }) { return <span className={`status-pill ${String(children).toLowerCase().replaceAll(' ','-')}`}>{children || '—'}</span> }

export default function RecordsPage({ page, navigate, quickAdd, initialRecipient }) {
  const { data, patch, convertLead, saveTargets:saveTargetsApi, removeRecord, updateDealStatus, reviewProjectRequest, convertProjectRequest, reviewPayment, approveCashPayment, reviewDispute, saveDistributionRules, createFounderTransfer, createCompanyTransaction } = useData()
  const { user } = useAuth()
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('All statuses')
  const [serviceFilter,setServiceFilter]=useState('')
  const [clientFilter,setClientFilter]=useState('')
  const [secondaryFilter,setSecondaryFilter]=useState('')
  const [dateFilter,setDateFilter]=useState('')
  const [sort,setSort]=useState({ key:'', direction:1 })
  const [editingTarget,setEditingTarget]=useState(false)
  const [paymentActionId,setPaymentActionId]=useState('')
  const [targetDraft,setTargetDraft]=useState(()=>Object.fromEntries(['clients','leads','revenue','projects','students'].map((type)=>[type,data.targets.find((target)=>target.targetType===type&&target.period==='monthly'&&target.status==='Active')?.targetValue||0])))
  const title=names[page] || 'Workspace'
  const financialStats=dashboardStats(data)
  const rows=useMemo(()=> {
    const source=data[collections[page]] || []
    const all=page==='invoices'?source.map((item)=>({...item,paymentStatus:invoiceStatus(data,item)})):source
    const filtered=all.filter((item)=>{
      const searchMatch=JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
      const statusMatch=filter==='All statuses'||item.status===filter||item.stage===filter||item.paymentStatus===filter
      const serviceMatch=!serviceFilter||item.serviceId===serviceFilter||data.projects.find(project=>project.id===item.projectId)?.serviceId===serviceFilter||data.deals.find(deal=>deal.id===item.dealId)?.serviceId===serviceFilter||(page==='clients'&&(data.projects.some(project=>project.clientId===item.id&&project.serviceId===serviceFilter)||data.deals.some(deal=>deal.clientId===item.id&&deal.serviceId===serviceFilter)))
      const clientMatch=!clientFilter||item.clientId===clientFilter
      const secondaryMatch=!secondaryFilter||item.category===secondaryFilter||item.priority===secondaryFilter||item.paymentStatus===secondaryFilter
      const date=item.date||item.issueDate||item.createdAt||item.startDate
      const dateMatch=!dateFilter||date?.startsWith(dateFilter)
      return searchMatch&&statusMatch&&serviceMatch&&clientMatch&&secondaryMatch&&dateMatch
    })
    if(!sort.key)return filtered
    const value=(item)=>sort.key==='balance'?page==='deals'?dealBalance(data,item):projectOutstanding(data,item):sort.key==='outstanding'?clientOutstanding(data,item.id):item[sort.key]||''
    return filtered.sort((a,b)=>String(value(a)).localeCompare(String(value(b)),undefined,{numeric:true,sensitivity:'base'})*sort.direction)
  },[data,page,query,filter,serviceFilter,clientFilter,secondaryFilter,dateFilter,sort])
  const columns=configs[page] || []
  const statuses=[...new Set((data[collections[page]]||[]).map((item)=>item.status||item.stage||item.paymentStatus).filter(Boolean))]
  const usesServiceFilter=['clients','projects','deals','payments','invoices'].includes(page)
  const usesClientFilter=['projects','deals','payments','invoices'].includes(page)
  const secondaryOptions=page==='clients'?[...new Set(data.clients.map(item=>item.category).filter(Boolean))]:page==='projects'?['Low','Medium','High','Urgent']:page==='deals'||page==='payments'||page==='invoices'?['Not Paid','Partially Paid','Fully Paid','Payment Pending','Overdue','Paid','Unpaid']: []
  const saveTargets=async()=>{if(await saveTargetsApi(targetDraft))setEditingTarget(false)}
  const handlePaymentReview=async(event,payment,action)=>{
    event.stopPropagation()
    const note=action==='verify'?'':window.prompt(action==='reject'?'Reason for rejection':'What should the client correct?')
    if(note===null)return
    if(action!=='verify'&&!note.trim())return
    setPaymentActionId(payment.id)
    try{
      const updated=await reviewPayment(payment.id,{action,...(note?{note:note.trim()}:{})})
      if(action==='verify'&&updated?.status==='Paid')openDistributionProjectIfFullyPaid(updated)
    }
    catch(error){window.alert(error.message||'Payment review could not be saved.')}
    finally{setPaymentActionId('')}
  }
  const handleCashApproval=async(event,payment)=>{
    event.stopPropagation()
    if(!window.confirm(`Approve cash payment ${payment.reference||payment.id}? This will mark it as received.`))return
    setPaymentActionId(payment.id)
    try{
      const updated=await approveCashPayment(payment.id)
      if(updated?.status==='Paid')openDistributionProjectIfFullyPaid(updated)
    }
    catch(error){window.alert(error.message||'Cash payment could not be approved.')}
    finally{setPaymentActionId('')}
  }
  const openDistributionProjectIfFullyPaid=(payment)=>{
    if(!payment.projectId)return
    navigate(`projects/${payment.projectId}?payment=${payment.id}${payment.isFinalPayment?'&distribution=1':''}`)
  }
  const handleDisputeReview=async(event,payment,dispute)=>{
    event.stopPropagation()
    const status=window.prompt('Enter information_requested, resolved, or rejected:', 'resolved')
    if(!status)return
    if(!['information_requested','resolved','rejected'].includes(status.trim().toLowerCase())){window.alert('Choose information_requested, resolved, or rejected.');return}
    const response=window.prompt('Write a response for the client:')
    if(response===null||!response.trim())return
    setPaymentActionId(payment.id)
    try{await reviewDispute(payment.id,dispute.id,{status:status.trim().toLowerCase(),response:response.trim()})}
    catch(error){window.alert(error.message||'Payment issue could not be updated.')}
    finally{setPaymentActionId('')}
  }
  if(page==='requests')return <ProjectRequestsPage data={data} reviewProjectRequest={reviewProjectRequest} convertProjectRequest={convertProjectRequest}/>
  if(page==='students')return <MentoringDashboard quickAdd={quickAdd}/>
  if (page === 'services') return <div className="page-stack"><PageHeading title="Services" description="MAGAF service lines and owned product work in one operating view." action="+ Add service" onAction={()=>quickAdd('services')}/><div className="service-cards">{data.services.map((service)=>{const stats=serviceStats(data,service.id);return <button className="service-card panel" key={service.id} onClick={()=>navigate(`services/${service.id}`)}><span className="service-card-icon"><Icon name={service.icon} size={20}/></span><span className="eyebrow">{service.category} · {service.status||'Active'}</span><h2>{service.shortName}</h2><p>{service.description}</p><div className="service-card-metrics"><span><b>{service.supportsStudents?stats.students:stats.projects}</b> {service.supportsStudents?'students':'projects'}</span><span><b>{currency(stats.revenue)}</b> collected</span></div><div className="service-card-foot"><span>{service.supportsStudents?'Open mentoring dashboard':'View service details'}</span><Icon name="arrow" size={16}/></div></button>})}</div></div>
  if (page === 'revisions') return <div className="page-stack"><PageHeading title="Revisions" description="Review client feedback and move requested changes through delivery."/><section className="panel table-panel"><div className="table-toolbar"><span className="table-count">{data.revisions.length} revision requests</span></div>{data.revisions.length===0?<div className="empty-state"><span className="empty-icon"><Icon name="check" size={23}/></span><h3>No revision requests</h3><p>Client-submitted revision requests will appear here.</p></div>:<div className="table-scroll"><table><thead><tr><th>Request</th><th>Client</th><th>Project</th><th>Deliverable</th><th>Requested</th><th>Assigned to</th><th>Status</th></tr></thead><tbody>{data.revisions.map(item=><tr key={item.id}><td>{item.description||item.request||'—'}</td><td>{display(data,'clientId',item.clientId)}</td><td>{display(data,'projectId',item.projectId)}</td><td>{data.files.find(file=>file.id===item.deliverableId)?.name||'—'}</td><td>{item.date||item.createdAt||'—'}</td><td>{item.assignedTo||'Unassigned'}</td><td><select className="row-status-select" aria-label={`Update revision status for ${item.description||item.id}`} value={item.status||'Requested'} onChange={e=>patch('revisions',item.id,{status:e.target.value})}>{['Requested','Reviewing','In Progress','Completed','Rejected'].map(status=><option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>}</section></div>
  if (page === 'targets') {
    const monthKey=new Date().toISOString().slice(0,7)
    const monthTargets=data.targets.filter((target)=>target.period==='monthly'&&target.status==='Active'&&target.startDate?.slice(0,7)===monthKey)
    const cards=[['Client target','clients'],['Revenue target','revenue'],['Projects completed','projects'],['Leads generated','leads'],['Mentoring students','students']]
    return <div className="page-stack"><PageHeading title="Targets" description="Keep monthly priorities visible and grounded in actual progress." action={editingTarget?'Save targets':'Edit targets'} onAction={()=>editingTarget?saveTargets():setEditingTarget(true)}/><div className="target-summary"><span className="eyebrow">{new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'}).toUpperCase()} · MONTHLY TARGETS</span><h2>A little progress adds up.</h2><div className="target-cards">{cards.map(([label,key])=>{const target=monthTargets.find((item)=>item.targetType===key);const value=target?.targetValue||0;const current=target?.currentValue||0;return <div className="target-card panel" key={key}><div className="target-card-head"><span>{label}</span>{editingTarget?<input className="target-input" type="number" min="0" value={targetDraft[key]||0} onChange={e=>setTargetDraft({...targetDraft,[key]:Number(e.target.value)})}/>:<strong>{value?(key==='revenue'?currency(value):value):'Not set'}</strong>}</div><div className="progress-track"><i style={{width:`${value?Math.min(current/value*100,100):0}%`}}/></div><small>{key==='revenue'?currency(current):current} current <span>{value?(key==='revenue'?currency(Math.max(value-current,0)):Math.max(value-current,0)):'Set a target'}{value?' remaining':''}</span></small></div>})}</div></div></div>
  }
  if (page === 'tasks') return <div className="page-stack"><PageHeading title="Tasks" description="Keep the next action clear across client work and internal operations." action="+ Add task" onAction={()=>quickAdd('tasks')}/><div className="kanban">{['Todo','In Progress','Review','Blocked','Completed'].map((status)=><section className="kanban-column" key={status}><div className="kanban-head"><span className={`kanban-dot ${status.toLowerCase().replace(' ','-')}`}/><strong>{status}</strong><span>{data.tasks.filter(t=>t.status===status).length}</span></div>{data.tasks.filter(t=>t.status===status).map(task=><article className="task-card panel" key={task.id}><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><h3>{task.title}</h3><p>{display(data,'clientId',task.clientId)}</p><div className="task-card-foot"><span>{task.assignedTo || 'Unassigned'} · {task.deadline || 'No due date'}</span><select aria-label={`Change status of ${task.title}`} value={task.status} onChange={e=>patch('tasks',task.id,{status:e.target.value})}>{['Todo','In Progress','Review','Blocked','Completed'].map(s=><option key={s}>{s}</option>)}</select></div></article>)}<button className="kanban-add" onClick={()=>quickAdd('tasks')}><Icon name="plus" size={15}/> Add task</button></section>)}</div></div>
  if (page === 'analytics' || page === 'reports') return <AnalyticsPage page={page} data={data} navigate={navigate}/>
  const headingTitle=title
  return <div className="page-stack"><PageHeading title={headingTitle} description={page==='leads'?'Move promising conversations from first touch to signed work.':page==='clients'?'Every relationship, project and payment in one place.':page==='projects'?'A shared view of active work, delivery and ownership.':page==='deals'?'Track each opportunity separately from its payment progress.':page==='payments'?'Track collected revenue and the balances still outstanding.':`Manage your ${title.toLowerCase()} across the business.`} action={`+ Add ${page==='clients'?'client':page==='leads'?'lead':page==='projects'?'project':page==='deals'?'deal':page==='payments'?'payment':page==='invoices'?'invoice':page==='assets'?'asset':page==='files'?'file':page==='content'?'deliverable':page==='products'?'product':page==='team'?'member':page==='students'?'learner':'record'}`} onAction={()=>quickAdd(page)}/>
    {['clients','projects','deals','payments','invoices'].includes(page)&&<div className="record-filters">{usesServiceFilter&&<select value={serviceFilter} onChange={e=>setServiceFilter(e.target.value)} aria-label="Filter by service"><option value="">All services</option>{data.services.map(item=><option value={item.id} key={item.id}>{item.shortName}</option>)}</select>}{usesClientFilter&&<select value={clientFilter} onChange={e=>setClientFilter(e.target.value)} aria-label="Filter by client"><option value="">All clients</option>{data.clients.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>}{secondaryOptions.length>0&&<select value={secondaryFilter} onChange={e=>setSecondaryFilter(e.target.value)} aria-label="Filter by business type, priority or payment status"><option value="">{page==='clients'?'All business types':page==='projects'?'All priorities':'All payment statuses'}</option>{secondaryOptions.map(option=><option key={option}>{option}</option>)}</select>}{<input aria-label="Filter by month" type="month" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>}</div>}
    {page==='payments'&&<><div className="summary-strip"><Summary label="Collected" value={currency(financialStats.totalPaid)}/><Summary label="Outstanding" value={currency(financialStats.pending)}/><Summary label="Transactions" value={data.payments.length}/><Summary label="This month" value={currency(financialStats.monthRevenue)}/></div><FinanceDistributionPanel key={initialRecipient||'none'} data={data} navigate={navigate} saveRules={saveDistributionRules} createTransfer={createFounderTransfer} createCompanyTransaction={createCompanyTransaction} canConfigure={['super_admin','admin'].includes(user?.role)} initialRecipient={initialRecipient}/></>}
    <section className="panel table-panel">
      <div className="table-toolbar"><label className="search-field"><Icon name="search" size={16}/><input aria-label={`Search ${title}`} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`}/></label><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter by status"><option>All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><span className="table-count">{rows.length} records</span></div>
      {rows.length===0?<div className="empty-state"><span className="empty-icon"><Icon name="layers" size={23}/></span><h3>No {title.toLowerCase()} found</h3><p>{query?'Try a different search term.':`Your ${title.toLowerCase()} will appear here when you add your first record.`}</p>{!query&&<button className="button button-primary" onClick={()=>quickAdd(page)}>+ Add {title.slice(0,-1).toLowerCase()}</button>}</div>:<div className="table-scroll"><table><thead><tr>{columns.map(([key,label])=><th key={label}><button className="sort-button" onClick={()=>setSort(current=>({key,direction:current.key===key?-current.direction:1}))}>{label}{sort.key===key?(sort.direction===1?' ↑':' ↓'):''}</button></th>)}<th>Actions</th></tr></thead><tbody>{rows.map((item)=><tr key={item.id} className={detailRoutes[page]?'clickable-row':''} onClick={()=>detailRoutes[page]&&navigate(`${detailRoutes[page]}/${item.id}`)}>
        {columns.map(([key])=><td key={key}>
          {key==='status'||key==='priority'||key==='stage'||key==='paymentStatus'||key==='visibility'?<Status>{item[key]}</Status>
            :key==='serviceId'||key==='clientId'||key==='projectId'||key==='studentId'?display(data,key,item[key])
              :key==='dealId'?data.deals.find((deal)=>deal.id===item.dealId)?.title||'—'
                :key==='invoiceId'?data.invoices.find((invoice)=>invoice.id===item.invoiceId)?.invoiceNumber||'—'
                  :key==='paymentSource'?item.paymentSource==='client_portal'?'Client':'Internal'
                    :key==='proofFiles'?<>{(item.proofFiles||[]).map((file,index)=>{const url=typeof file==='object'?(file.cloudinaryUrl||file.url):null;return url?<a key={file.id||index} href={url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>{file.originalName||file.fileName||'View proof'} ↗ </a>:null})}</>
                      :key==='potentialValue'||key==='amount'||key==='balance'||key==='outstanding'||key==='quotedAmount'||key==='agreedAmount'||key==='paidAmount'?currency(key==='balance'?outstanding(item):key==='outstanding'?clientOutstanding(data,item.id):item[key])
                        :key==='id'?<span className="ref-id">{item[key].toUpperCase()}</span>
                          :key==='url'&&item[key]?<a href={item.fileData||item.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>Open link ↗</a>:item[key]||'—'}
        </td>)}
        <td className="row-actions">
          {page==='payments'&&item.projectId&&<button className="mini-action" onClick={e=>{e.stopPropagation();navigate(`projects/${item.projectId}?payment=${item.id}`)}}>Open project</button>}
          {page==='payments'&&!item.projectId&&['Submitted','Under Verification','Correction Requested','Disputed'].includes(item.status)&&!(item.paymentMethod?.toLowerCase()==='cash'&&item.verificationStatus==='Awaiting Second Approval')&&<><button className="mini-action" disabled={paymentActionId===item.id} onClick={e=>handlePaymentReview(e,item,'verify')}>Verify</button><button className="mini-action" disabled={paymentActionId===item.id} onClick={e=>handlePaymentReview(e,item,'request_correction')}>Request correction</button><button className="mini-action" disabled={paymentActionId===item.id} onClick={e=>handlePaymentReview(e,item,'reject')}>Reject</button></>}
          {page==='payments'&&!item.projectId&&item.paymentMethod?.toLowerCase()==='cash'&&item.verificationStatus==='Awaiting Second Approval'&&['super_admin','admin','manager','finance'].includes(user?.role)&&<button className="mini-action" disabled={paymentActionId===item.id} onClick={e=>handleCashApproval(e,item)}>Approve cash</button>}
          {page==='payments'&&!item.projectId&&(item.disputes||[]).filter(dispute=>['Open','Information Requested'].includes(dispute.status)).map(dispute=><button key={dispute.id} className="mini-action" disabled={paymentActionId===item.id} onClick={e=>handleDisputeReview(e,item,dispute)}>Review issue</button>)}
          {page==='leads'&&item.status!=='Converted'&&<button className="mini-action" onClick={e=>{e.stopPropagation();if(window.confirm(`Convert ${item.name} into a client?`))convertLead(item,false)}}>Convert to client</button>}
          {page==='projects'&&<select className="row-status-select" aria-label={`Update ${item.name} status`} value={item.status} onClick={e=>e.stopPropagation()} onChange={e=>patch('projects',item.id,{status:e.target.value})}>{['Draft','Proposal','Awaiting Client','Deal Accepted','Payment Pending','Planning','Requirement Gathering','Design','Development','In Progress','Review','Client Review','Revision','Revision Requested','Approved','Ready for Delivery','Deployment','Delivered','Completed','On Hold','Paused','Cancelled'].map(status=><option key={status}>{status}</option>)}</select>}
          {page==='deals'&&<select className="row-status-select" aria-label={`Update ${item.title} deal status`} value={item.status} onClick={e=>e.stopPropagation()} onChange={e=>updateDealStatus(item.id,e.target.value)}>{['New','Contacted','Proposal Sent','Negotiation','Accepted','Rejected','On Hold','Cancelled','Completed'].map(status=><option key={status}>{status}</option>)}</select>}
          {page==='files'&&item.status&&<select className="row-status-select" aria-label={`Update visibility for ${item.name}`} value={item.visibility||'Internal'} onClick={e=>e.stopPropagation()} onChange={e=>patch('files',item.id,{visibility:e.target.value})}><option>Internal</option><option>Client</option></select>}
          {page==='leads'&&item.status==='Converted'&&<span className="converted-label">✓ Converted</span>}
          {page!=='payments'&&<button className="delete-action" aria-label={`Delete ${item.name||item.title||item.id}`} title="Delete record" onClick={e=>{e.stopPropagation();if(window.confirm(`Delete ${item.name||item.title||item.id}?${page==='clients'||page==='projects'?' Related projects, payments, tasks and assets will also be removed.':''}`))removeRecord(collections[page],item.id)}}>×</button>}
        </td></tr>)}</tbody></table></div>}
    </section>
    {page==='leads'&&<p className="page-footnote">Converted leads keep their original source and contact history. Select a lead to review the full record.</p>}
  </div>
}
function ProjectRequestsPage({data,reviewProjectRequest,convertProjectRequest}){
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('All statuses')
 const [notes,setNotes]=useState({})
 const [prices,setPrices]=useState({})
 const requests=data.projectRequests.filter((request)=>(filter==='All statuses'||request.status===filter)&&(!query||JSON.stringify(request).toLowerCase().includes(query.toLowerCase())))
 const clientName=(id)=>data.clients.find((client)=>client.id===id)?.name||'Client record unavailable'
 const serviceName=(id)=>data.services.find((service)=>service.id===id)?.shortName||id
 const updateStatus=(request,status)=>{
  try{reviewProjectRequest(request.id,status,notes[request.id]??(status==='Need More Information'?request.informationRequested:request.teamNotes)??'')}
  catch(error){window.alert(error.message)}
 }
 const convert=async(request)=>{
  const amount=Number(prices[request.id]??request.proposedPrice??request.estimatedBudget??0)
  try{const project=await convertProjectRequest(request.id,amount);window.alert(`Request converted to project "${project.name}".`)}
  catch(error){window.alert(error.message)}
 }
 const openStatuses=['Draft','Submitted','Under Review','Need More Information','Accepted']
 return <div className="page-stack"><PageHeading title="Project requests" description="Review client-submitted briefs and convert accepted requests directly into connected deals and projects."/><div className="record-filters"><label className="search-field"><Icon name="search" size={15}/><input aria-label="Search project requests" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search requests, clients, requirements…"/></label><select aria-label="Filter project requests by status" value={filter} onChange={(event)=>setFilter(event.target.value)}><option>All statuses</option>{['Draft','Submitted','Under Review','Need More Information','Accepted','Rejected','Converted to Project','Cancelled'].map((status)=><option key={status}>{status}</option>)}</select><span className="table-count">{requests.length} requests</span></div>
 {requests.length?requests.map((request)=><article className="request-review-card panel" key={request.id}>
  <div className="request-review-head"><div><span className="eyebrow">{request.id.toUpperCase()} · {request.submittedAt||request.createdAt||'Submission date unavailable'}</span><h2>{request.projectName}</h2><p>{clientName(request.clientId)} · {serviceName(request.serviceId)}</p></div><span className="status-pill">{request.status}</span></div>
  <div className="request-review-summary"><div><span>Client description</span><p>{request.description||'—'}</p></div><div><span>Business goal / problem</span><p>{[request.businessGoal,request.problemStatement].filter(Boolean).join(' · ')||'—'}</p></div><div><span>Requirements</span><p>{request.requirements||'—'}</p></div><div><span>Expected deliverables</span><p>{request.expectedDeliverables||'—'}</p></div><div><span>Existing technology / special requirements</span><p>{request.technologyInformation||'—'}</p></div></div>
  <div className="request-review-facts"><span>Budget <b>{currency(request.estimatedBudget)}</b></span><span>Desired deadline <b>{request.desiredDeadline||'Not specified'}</b></span><span>Priority <b>{request.priority||'Medium'}</b></span><span>Preferred contact <b>{request.preferredCommunication||'Not specified'}</b></span></div>
  {request.clientNotes&&<p className="request-client-notes"><strong>Client notes:</strong> {request.clientNotes}</p>}
  {request.clientAdditionalInfo?.length>0&&<div className="request-client-notes"><strong>Client follow-up information</strong>{request.clientAdditionalInfo.map((entry)=><p key={entry.id}>{entry.text||'Additional attachments shared'} <small>{entry.createdAt}</small></p>)}</div>}
  <div className="request-attachments"><strong>Client attachments & links</strong>{data.files.filter((file)=>file.projectRequestId===request.id).length?data.files.filter((file)=>file.projectRequestId===request.id).map((file)=><a href={file.fileData||file.url||'#'} target="_blank" rel="noreferrer" download={file.fileData?file.name:undefined} key={file.id}><Icon name={file.type?.toLowerCase().includes('video')?'sparkles':'file'} size={14}/>{file.name}<small>{file.category} · {file.uploadedAt}</small></a>):<span>No attachments provided</span>}</div>
  {request.status!=='Converted to Project'&&request.status!=='Rejected'&&<><label className="field request-note-field">{request.status==='Need More Information'?'Information needed from client':'Internal team notes'}<textarea rows="2" value={notes[request.id]??(request.status==='Need More Information'?request.informationRequested:request.teamNotes)??''} onChange={(event)=>setNotes({...notes,[request.id]:event.target.value})} placeholder={request.status==='Need More Information'?'Explain what information the client should provide…':'Add an internal review note…'}/></label><div className="request-review-actions">{openStatuses.includes(request.status)&&<><button className="button button-outline button-small" onClick={()=>updateStatus(request,'Under Review')}>Mark under review</button><button className="button button-outline button-small" onClick={()=>updateStatus(request,'Need More Information')}>Request more information</button><button className="button button-danger button-small" onClick={()=>updateStatus(request,'Rejected')}>Reject</button><button className="button button-primary button-small" onClick={()=>updateStatus(request,'Accepted')}>Accept request</button></>}{request.status==='Accepted'&&<><label className="request-price">Agreed price (₹)<input type="number" min="0" value={prices[request.id]??request.proposedPrice??request.estimatedBudget??''} onChange={(event)=>setPrices({...prices,[request.id]:event.target.value})}/></label><button className="button button-primary button-small" onClick={()=>convert(request)}><Icon name="briefcase" size={14}/> Convert to project</button></>}</div></>}
  {request.status==='Converted to Project'&&<p className="request-converted-note">Converted into <strong>{data.projects.find((project)=>project.id===request.convertedProjectId)?.name||'a project'}</strong>. Request details and attachments remain linked to the project.</p>}
 </article>):<section className="panel empty-state"><h3>No matching project requests</h3><p>Client-submitted requests will appear here.</p></section>}
 </div>
}
function FinanceDistributionPanel({data,navigate,saveRules,createTransfer,createCompanyTransaction,canConfigure,initialRecipient}){
 const [projectId,setProjectId]=useState('')
 const [ruleDrafts,setRuleDrafts]=useState({})
 const [saving,setSaving]=useState(false)
 const [transferDraft,setTransferDraft]=useState({fromFounderId:'',toFounderId:'',toOwnerType:'founder',distributionId:'',amount:'',reason:''})
 const [transferError,setTransferError]=useState('')
 const [companyDraft,setCompanyDraft]=useState({type:'investment',amount:'',description:'',reference:'',occurredAt:new Date().toISOString().slice(0,10)})
 const [companyError,setCompanyError]=useState('')
 const [selectedRecipient,setSelectedRecipient]=useState(()=>{
  if(initialRecipient==='company')return {recipientType:'company',name:'MAGAF Technologies'}
  const founder=data.distributionSummary.find((row)=>row.recipientType==='founder'&&String(row.founderId?.id||row.founderId?._id||row.founderId)===String(initialRecipient))
  return founder?{recipientType:'founder',founderId:String(founder.founderId?.id||founder.founderId?._id||founder.founderId),name:founder.name}:null
 })
 const projects=data.projects||[]
 const selectedProject=projects.find((project)=>project.id===projectId)||projects[0]
 const founders=(data.teamMembers||[]).filter((member)=>['super_admin','admin'].includes(member.role)&&member.status!=='Inactive'&&member.isActive!==false)
 const finalizedDistributions=(data.revenueDistributions||[]).filter((distribution)=>distribution.entryType==='receipt'&&distribution.projectId)
 const draft=selectedProject?ruleDrafts[selectedProject.id]:null
 const shares=draft?.shares||(selectedProject?.founderShares||[]).map((share)=>({userId:share.userId?.id||share.userId?._id||share.userId,percent:Number(share.percent)}))
 const companyPercent=draft?.companyPercent??Number(selectedProject?.companySharePercent??100)
 const updateDraft=(updates)=>setRuleDrafts((current)=>({...current,[selectedProject.id]:{companyPercent,shares,...updates}}))
 const total=shares.reduce((sum,share)=>sum+Number(share.percent||0),0)
 const save=async()=>{
  if(!selectedProject)return
  if((companyPercent===100&&shares.length)||(companyPercent<100&&Math.abs(total-100)>0.001)){window.alert('Founder contributions must total 100% of the founder pool.');return}
  setSaving(true)
  try{await saveRules(selectedProject.id,{companySharePercent:Number(companyPercent),founderShares:shares})}
  catch(error){window.alert(error.message||'Revenue allocation rules could not be saved.')}
  finally{setSaving(false)}
 }
 const submitTransfer=async(event)=>{
  event.preventDefault()
  setTransferError('')
  try{
   await createTransfer({...transferDraft,amount:Number(transferDraft.amount)})
   setTransferDraft({fromFounderId:'',toFounderId:'',toOwnerType:'founder',distributionId:'',amount:'',reason:''})
  }catch(error){setTransferError(error.message||'Founder transfer could not be saved.')}
 }
 const submitCompanyTransaction=async(event)=>{
  event.preventDefault()
  setCompanyError('')
  try{
   await createCompanyTransaction({...companyDraft,amount:Number(companyDraft.amount),currency:'INR'})
   setCompanyDraft({type:companyDraft.type,amount:'',description:'',reference:'',occurredAt:new Date().toISOString().slice(0,10)})
  }catch(error){setCompanyError(error.message||'Company financial transaction could not be saved.')}
 }
 const selectedDistribution=selectedRecipient&&finalizedDistributions
  .filter((distribution)=>selectedRecipient.recipientType==='company'
   ?distribution.allocations?.some((allocation)=>allocation.recipientType==='company')||(data.founderTransfers||[]).some((transfer)=>transfer.toOwnerType==='company'&&String(transfer.distributionId?.id||transfer.distributionId?._id||transfer.distributionId)===String(distribution.id||distribution._id))
   :distribution.allocations?.some((allocation)=>allocation.recipientType==='founder'&&String(allocation.founderId?.id||allocation.founderId?._id||allocation.founderId)===selectedRecipient.founderId))
 const selectedSummary=selectedRecipient&&data.distributionSummary.find((row)=>row.recipientType===selectedRecipient.recipientType
  &&(selectedRecipient.recipientType==='company'||String(row.founderId?.id||row.founderId?._id||row.founderId)===selectedRecipient.founderId))
 const companyAvailable=Number(data.distributionSummary.find((row)=>row.recipientType==='company'&&row.currency==='INR')?.amount||0)
 const selectedTransfers=selectedRecipient&&(data.founderTransfers||[]).filter((transfer)=>{
  const fromId=String(transfer.fromFounderId?.id||transfer.fromFounderId?._id||transfer.fromFounderId)
  const toId=String(transfer.toFounderId?.id||transfer.toFounderId?._id||transfer.toFounderId)
  return selectedRecipient.recipientType==='company'?transfer.toOwnerType==='company':fromId===selectedRecipient.founderId||toId===selectedRecipient.founderId
 })
 return <section className="panel finance-distribution-panel">
  <div className="panel-heading"><div><span className="eyebrow">PROJECT-LEVEL REVENUE</span><h2>Founder & company allocations</h2></div></div>
  <div className="finance-distribution-summary">{(data.distributionSummary||[]).map((row)=><button className="summary-item finance-recipient-link" key={`${row.recipientType}-${row.founderId||row.currency}`} onClick={()=>navigate(row.recipientType==='company'?'finance/company':`finance/founders/${row.founderId?.id||row.founderId?._id||row.founderId}`)}><span>{row.name} · {row.currency}</span><strong>{currency(row.amount)}</strong><small>Allocated {currency(row.allocatedAmount)} · received {currency(row.transfersReceived)} · sent {currency(row.transfersSent)}</small></button>)}{!data.distributionSummary?.length&&<p className="finance-hint">Finalize a fully paid project from its detail page to create an immutable distribution snapshot.</p>}</div>
  {selectedRecipient&&<section className="founder-detail-panel">
   <div className="panel-heading"><div><span className="eyebrow">{selectedRecipient.recipientType==='company'?'COMPANY FINANCIAL PROFILE':'FOUNDER FINANCIAL PROFILE'}</span><h3>{selectedRecipient.name}</h3></div><button className="button button-quiet button-small" onClick={()=>setSelectedRecipient(null)}>Close detail</button></div>
   {selectedRecipient.recipientType==='founder'
    ?<div className="summary-strip"><Summary label="Total project allocations" value={currency(selectedSummary?.allocatedAmount||0)}/><Summary label="Transfers received" value={currency(selectedSummary?.transfersReceived||0)}/><Summary label="Transfers sent" value={currency(selectedSummary?.transfersSent||0)}/><Summary label="Current available" value={currency(selectedSummary?.amount||0)}/></div>
    :<div className="summary-strip"><Summary label="Project allocations" value={currency(selectedSummary?.allocatedAmount||0)}/><Summary label="Founder transfers received" value={currency(selectedSummary?.transfersReceived||0)}/><Summary label="External funding" value={currency(selectedSummary?.externalFunding||0)}/><Summary label="Investments" value={currency(selectedSummary?.investments||0)}/><Summary label="Current available" value={currency(selectedSummary?.amount||0)}/></div>}
   <div className="table-scroll"><table><thead><tr><th>Project</th><th>Project revenue</th><th>Company share</th><th>Founder contribution</th><th>Effective project share</th><th>Allocation</th></tr></thead><tbody>{selectedDistribution.map((distribution)=>{const allocation=distribution.allocations?.find((item)=>selectedRecipient.recipientType==='company'?item.recipientType==='company':item.recipientType==='founder'&&String(item.founderId?.id||item.founderId?._id||item.founderId)===selectedRecipient.founderId);return allocation?<tr key={distribution.id||distribution._id}><td>{distribution.projectId?.projectName||'Project'}</td><td>{currency(distribution.grossAmount)}</td><td>{distribution.companySharePercent}% · {currency(distribution.companyAmount??distribution.allocations?.find((item)=>item.recipientType==='company')?.amount)}</td><td>{allocation.recipientType==='founder'?`${allocation.contributionPercentage??allocation.percent}% of pool`:'—'}</td><td>{allocation.effectiveProjectPercentage??allocation.percent}%</td><td>{currency(allocation.amount)}</td></tr>:null})}</tbody></table></div>
   {selectedRecipient.recipientType==='company'&&<><h4>Funding & investment activity</h4><div className="table-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{(data.companyTransactions||[]).map((transaction)=><tr key={transaction.id}><td>{new Date(transaction.occurredAt).toLocaleDateString('en-IN')}</td><td>{transaction.type==='investment'?'Investment':'External funding'}</td><td>{transaction.description}</td><td>{transaction.reference||'—'}</td><td>{transaction.type==='investment'?'−':'+'}{currency(transaction.amount)}</td></tr>)}</tbody></table>{!data.companyTransactions?.length&&<p className="finance-hint">No external funding or investments recorded yet.</p>}</div></>}
   {!!selectedTransfers?.length&&<><h4>Transfer activity</h4><div className="table-scroll"><table><thead><tr><th>Date</th><th>Project</th><th>From</th><th>To</th><th>Amount</th><th>Reason</th></tr></thead><tbody>{selectedTransfers.map((transfer)=><tr key={transfer.id}><td>{transfer.finalizedAt?new Date(transfer.finalizedAt).toLocaleDateString('en-IN'):'—'}</td><td>{transfer.projectId?.projectName||'—'}</td><td>{transfer.fromFounderId?.name||'—'}</td><td>{transfer.toOwnerType==='company'?'MAGAF Technologies':transfer.toFounderId?.name||'—'}</td><td>{currency(transfer.amount)}</td><td>{transfer.reason||'—'}</td></tr>)}</tbody></table></div></>}
   <p className="finance-hint">Project allocations are immutable historical snapshots. Transfers, funding, and investments adjust available balance without rewriting project earnings.</p>
  </section>}
  {canConfigure&&<div className="finance-rules-editor">
   <label className="field">Project<select value={selectedProject?.id||''} onChange={(event)=>setProjectId(event.target.value)}><option value="">Select project</option>{projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
   {selectedProject&&<><label className="field">Company allocation (%)<input type="number" min="0" max="100" step="0.01" value={companyPercent} onChange={(event)=>updateDraft({companyPercent:Number(event.target.value)})}/></label>
    <p className="finance-hint">Founder pool: {(100-companyPercent).toFixed(2)}% of this project's revenue. Founder contribution percentages below divide that pool.</p>
    {shares.map((share,index)=><div className="finance-share-row" key={`${share.userId}-${index}`}><label className="field">Founder<select value={share.userId} onChange={(event)=>updateDraft({shares:shares.map((item,i)=>i===index?{...item,userId:event.target.value}:item)})}><option value="">Select founder</option>{founders.map((founder)=><option key={founder.id} value={founder.id}>{founder.name}</option>)}</select></label><label className="field">Contribution (% of founder pool)<input type="number" min="0.01" max="100" step="0.01" value={share.percent} onChange={(event)=>updateDraft({shares:shares.map((item,i)=>i===index?{...item,percent:Number(event.target.value)}:item)})}/></label><button className="button button-outline button-small" type="button" onClick={()=>updateDraft({shares:shares.filter((_,i)=>i!==index)})}>Remove</button></div>)}
    <div className="finance-rules-actions"><span className={(companyPercent===100?shares.length===0:Math.abs(total-100)<0.001)?'valid':'invalid'}>Company + founder pool = 100% · Founder contributions {total.toFixed(2)}% {companyPercent===100&&!shares.length?'':'of 100% required'}</span><button className="button button-outline button-small" onClick={()=>updateDraft({shares:[...shares,{userId:'',percent:0}]})} disabled={companyPercent===100}>Add founder</button><button className="button button-primary button-small" disabled={saving||(companyPercent===100?shares.length!==0:Math.abs(total-100)>0.001)} onClick={save}>{saving?'Saving…':'Save allocation rules'}</button></div>
   </>}
  </div>}
  {canConfigure&&finalizedDistributions.length>0&&<section className="founder-transfer-panel"><div className="panel-heading"><div><span className="eyebrow">AUDITABLE PROJECT TRANSFER</span><h3>Transfer founder allocation</h3></div></div><form className="finance-transfer-form" onSubmit={submitTransfer}><label className="field">Limit to project distribution (optional)<select value={transferDraft.distributionId} onChange={(event)=>setTransferDraft({...transferDraft,distributionId:event.target.value})}><option value="">Use all available allocations</option>{finalizedDistributions.map((distribution)=><option key={distribution.id||distribution._id} value={distribution.id||distribution._id}>{distribution.projectId?.projectName||'Project'} · {currency(distribution.grossAmount)}</option>)}</select></label><label className="field">From founder<select required value={transferDraft.fromFounderId} onChange={(event)=>setTransferDraft({...transferDraft,fromFounderId:event.target.value})}><option value="">Select founder</option>{founders.map((founder)=><option key={founder.id} value={founder.id}>{founder.name}</option>)}</select></label><label className="field">Destination<select value={transferDraft.toOwnerType} onChange={(event)=>setTransferDraft({...transferDraft,toOwnerType:event.target.value,toFounderId:''})}><option value="founder">Founder</option><option value="company">MAGAF Technologies</option></select></label>{transferDraft.toOwnerType==='founder'&&<label className="field">To founder<select required value={transferDraft.toFounderId} onChange={(event)=>setTransferDraft({...transferDraft,toFounderId:event.target.value})}><option value="">Select founder</option>{founders.filter((founder)=>founder.id!==transferDraft.fromFounderId).map((founder)=><option key={founder.id} value={founder.id}>{founder.name}</option>)}</select></label>}<label className="field">Amount (₹)<input required type="number" min="0.01" step="0.01" value={transferDraft.amount} onChange={(event)=>setTransferDraft({...transferDraft,amount:event.target.value})}/></label><label className="field">Reason (optional)<input value={transferDraft.reason} maxLength="1000" onChange={(event)=>setTransferDraft({...transferDraft,reason:event.target.value})}/></label><button className="button button-primary" type="submit">Finalize transfer</button>{transferError&&<p className="form-error" role="alert">{transferError}</p>}</form><div className="table-scroll"><table><thead><tr><th>Transfer</th><th>Project</th><th>From</th><th>To</th><th>Amount</th><th>Reason</th><th>Finalized</th></tr></thead><tbody>{(data.founderTransfers||[]).slice(0,12).map((transfer)=><tr key={transfer.id}><td>{transfer.transferCode}</td><td>{transfer.projectId?.projectName||'—'}</td><td>{transfer.fromFounderId?.name||'—'}</td><td>{transfer.toOwnerType==='company'?'MAGAF Technologies':transfer.toFounderId?.name||'—'}</td><td>{currency(transfer.amount)}</td><td>{transfer.reason||'—'}</td><td>{transfer.finalizedAt?new Date(transfer.finalizedAt).toLocaleDateString('en-IN'):'—'}</td></tr>)}</tbody></table></div></section>}
  {canConfigure&&<section className="founder-transfer-panel"><div className="panel-heading"><div><span className="eyebrow">COMPANY FINANCIAL ACTIVITY</span><h3>External funding & investments</h3></div><span className="finance-hint">Available company funds: {currency(companyAvailable)}</span></div><form className="finance-transfer-form" onSubmit={submitCompanyTransaction}><label className="field">Transaction type<select value={companyDraft.type} onChange={(event)=>setCompanyDraft({...companyDraft,type:event.target.value})}><option value="investment">Investment / company expenditure</option><option value="external_funding">External funding received</option></select></label><label className="field">Amount (₹)<input required type="number" min="0.01" step="0.01" value={companyDraft.amount} onChange={(event)=>setCompanyDraft({...companyDraft,amount:event.target.value})}/></label><label className="field">Date<input required type="date" value={companyDraft.occurredAt} onChange={(event)=>setCompanyDraft({...companyDraft,occurredAt:event.target.value})}/></label><label className="field">Purpose / source<input required maxLength="1000" value={companyDraft.description} onChange={(event)=>setCompanyDraft({...companyDraft,description:event.target.value})}/></label><label className="field">Reference (optional)<input maxLength="160" value={companyDraft.reference} onChange={(event)=>setCompanyDraft({...companyDraft,reference:event.target.value})}/></label><button className="button button-primary" type="submit">Record {companyDraft.type==='investment'?'investment':'funding'}</button>{companyError&&<p className="form-error" role="alert">{companyError}</p>}</form></section>}
  {(data.revenueDistributions||[]).length>0&&<details className="finance-distribution-history"><summary>Recent allocation snapshots ({data.revenueDistributions.length})</summary><div className="table-scroll"><table><thead><tr><th>Finalized</th><th>Payment</th><th>Project</th><th>Project revenue</th><th>Allocation snapshot</th></tr></thead><tbody>{data.revenueDistributions.slice(0,20).map((distribution)=><tr key={distribution.id||distribution._id}><td>{distribution.finalizedAt?new Date(distribution.finalizedAt).toLocaleDateString('en-IN'):''}</td><td>{distribution.paymentId?.paymentCode||'Payment'}</td><td>{distribution.projectId?.projectName||'Project'}</td><td>{currency(distribution.grossAmount)}</td><td>{(distribution.allocations||[]).map((allocation)=>`${allocation.founderName}: ${currency(allocation.amount)}`).join(' · ')}</td></tr>)}</tbody></table></div></details>}
 </section>
}
function PageHeading({title,description,action,onAction}){return <div className="page-heading"><div><span className="eyebrow">MAGAF BUSINESS HUB</span><h1>{title}</h1><p>{description}</p></div>{action&&<button className="button button-primary" onClick={onAction}><Icon name="plus" size={16}/>{action.replace('+ ','')}</button>}</div>}
function Summary({label,value}){return <div className="summary-item"><span>{label}</span><strong>{value}</strong></div>}
function AnalyticsRevenueChart({points}){
 const width=720,height=220,pad={left:54,right:16,top:18,bottom:32}
 const max=Math.max(...points.map((point)=>Math.abs(point.revenue)),1)
 const x=(index)=>pad.left+index*(width-pad.left-pad.right)/Math.max(points.length-1,1)
 const y=(value)=>height-pad.bottom-(value+max)/(2*max)*(height-pad.top-pad.bottom)
 const path=points.map((point,index)=>`${index?'L':'M'} ${x(index)} ${y(point.revenue)}`).join(' ')
 if(!points.length)return <div className="chart-empty">No settled transactions match this filter.</div>
 return <div className="revenue-line-wrap"><svg className="revenue-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Filtered collected revenue and refunds over time">
  {[-1,0,1].map((tick)=><g key={tick}><line x1={pad.left} x2={width-pad.right} y1={y(max*tick)} y2={y(max*tick)} className="line-grid"/><text x={pad.left-8} y={y(max*tick)+4} textAnchor="end" className="line-axis">{currency(max*tick)}</text></g>)}
  <path d={path} className="revenue-path"/>{points.map((point,index)=><g key={point.key}><title>{point.label}: {currency(point.revenue)}</title><circle cx={x(index)} cy={y(point.revenue)} r="4" className="revenue-point"/>{index%Math.max(1,Math.ceil(points.length/8))===0||index===points.length-1?<text x={x(index)} y={height-8} textAnchor="middle" className="line-axis">{point.label}</text>:null}</g>)}
 </svg></div>
}
function AnalyticsPage({page,data,navigate}){
 const today=new Date()
 const dateInput=(date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
 const monthAgo=new Date(today);monthAgo.setDate(monthAgo.getDate()-29)
 const [startDate,setStartDate]=useState(dateInput(monthAgo))
 const [endDate,setEndDate]=useState(dateInput(today))
 const [serviceId,setServiceId]=useState('')
 const [paymentStatus,setPaymentStatus]=useState('')
 const allPayments=data.payments||[]
 const services=data.services||[]
 const start=startDate?new Date(`${startDate}T00:00:00`):null
 const end=endDate?new Date(`${endDate}T23:59:59.999`):null
 const invalidRange=start&&end&&start>end
 const filteredPayments=invalidRange?[]:allPayments.filter((payment)=>{
  const date=new Date(payment.date||payment.createdAt)
  const dateMatch=Number.isFinite(date.getTime())&&(!start||date>=start)&&(!end||date<=end)
  const serviceMatch=!serviceId||paymentServiceId(data,payment)===serviceId
  const statusMatch=!paymentStatus||payment.status===paymentStatus
  return dateMatch&&serviceMatch&&statusMatch
 })
 const settled=filteredPayments.filter((payment)=>['Paid','Refunded'].includes(payment.status))
 const collected=settled.reduce((sum,payment)=>sum+paymentValue(payment),0)
 const mentoringRevenue=settled.filter((payment)=>services.find((item)=>item.id===paymentServiceId(data,payment))?.supportsStudents).reduce((sum,payment)=>sum+paymentValue(payment),0)
 const filteredLeads=(data.leads||[]).filter((lead)=>{
  const date=new Date(lead.createdAt)
  return (!start||date>=start)&&(!end||date<=end)&&(!serviceId||lead.serviceId===serviceId)
 })
 const leadsByStage=[['New','new'],['Contacted','contacted'],['Interested','interested'],['Qualified','qualified'],['Proposal sent','proposal sent'],['Negotiation','negotiation'],['Converted','converted'],['Lost','lost']].map(([stage,status])=>({stage,count:filteredLeads.filter((lead)=>lead.status.toLowerCase()===status).length}))
 const converted=filteredLeads.filter((lead)=>lead.status.toLowerCase()==='converted').length
 const conversion=filteredLeads.length?Math.round(converted/filteredLeads.length*100):0
 const sources=[...filteredLeads.reduce((counts,lead)=>counts.set(lead.source||'Unknown',(counts.get(lead.source||'Unknown')||0)+1),new Map())].map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count)
 const service=data.servicePerformance.map((row)=>{
  const revenue=settled.filter((payment)=>paymentServiceId(data,payment)===row.service.id).reduce((sum,payment)=>sum+paymentValue(payment),0)
  return {...row,revenue}
 }).filter((row)=>!serviceId||row.service.id===serviceId).sort((a,b)=>b.revenue-a.revenue)
 const maxRevenue=Math.max(...service.map((row)=>Math.abs(row.revenue)),1)
 const daily= start&&end&&(end-start)<62*86400000
 const trendMap=new Map()
 for(const payment of settled){
  const date=new Date(payment.date||payment.createdAt)
  const key=daily?date.toISOString().slice(0,10):date.toISOString().slice(0,7)
  trendMap.set(key,(trendMap.get(key)||0)+paymentValue(payment))
 }
 const trend=[...trendMap].sort(([a],[b])=>a.localeCompare(b)).map(([key,revenue])=>({key,revenue,label:daily?new Date(`${key}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}))
 const statusRows=[...filteredPayments.reduce((counts,payment)=>counts.set(payment.status,(counts.get(payment.status)||0)+1),new Map())].map(([status,count])=>({status,count})).sort((a,b)=>a.status.localeCompare(b.status))
 const maxStage=Math.max(...leadsByStage.map((item)=>item.count),1)
 const csvEscape=(value)=>`"${String(value??'').replaceAll('"','""')}"`
 const exportCsv=()=>{
  const rows=[['Payment','Date','Client','Project','Service','Status','Amount'],...filteredPayments.map((payment)=>[
   payment.paymentCode||payment.id,
   payment.date||payment.createdAt,
   data.clients.find((client)=>client.id===payment.clientId)?.name||'',
   data.projects.find((project)=>project.id===payment.projectId)?.name||'',
   services.find((item)=>item.id===paymentServiceId(data,payment))?.shortName||'',
   payment.status,
   paymentValue(payment),
  ])]
  const blob=new Blob([rows.map((row)=>row.map(csvEscape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download=`magaf-finance-report-${startDate||'all'}-to-${endDate||'all'}.csv`
  link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),0)
 }
 return <div className="page-stack"><PageHeading title={page==='reports'?'Reports':'Business analytics'} description="Filter revenue, lead conversion and service activity across the selected reporting period." action="Export CSV" onAction={exportCsv}/>
  <div className="record-filters analytics-filters"><label className="field">From<input type="date" value={startDate} max={endDate||undefined} onChange={(event)=>setStartDate(event.target.value)}/></label><label className="field">To<input type="date" value={endDate} min={startDate||undefined} onChange={(event)=>setEndDate(event.target.value)}/></label><label className="field">Service<select value={serviceId} onChange={(event)=>setServiceId(event.target.value)}><option value="">All services</option>{services.map((item)=><option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label><label className="field">Payment status<select value={paymentStatus} onChange={(event)=>setPaymentStatus(event.target.value)}><option value="">All statuses</option>{[...new Set(allPayments.map((payment)=>payment.status))].sort().map((status)=><option key={status}>{status}</option>)}</select></label></div>
  {invalidRange&&<p className="form-error" role="alert">The start date must be on or before the end date.</p>}
  <div className="summary-strip"><Summary label="Collected · selected period" value={currency(collected)}/><Summary label="Mentoring · selected period" value={currency(mentoringRevenue)}/><Summary label="Lead conversion · selected period" value={`${conversion}%`}/><Summary label="Payments in filter" value={filteredPayments.length}/></div>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">REVENUE TREND</span><h2>{daily?'Daily':'Monthly'} settled payments and refunds</h2></div><span className="table-count">{settled.length} settled entries</span></div><AnalyticsRevenueChart points={trend}/></section>
  <div className="dashboard-grid analytics-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">SERVICE ECONOMICS</span><h2>Revenue by service</h2></div></div>{service.map(({service:item,revenue,clients,students,projects})=><div className="analytic-row" key={item.id}><span>{item.shortName}</span><div className="progress-track"><i style={{width:`${Math.max(Math.abs(revenue)/maxRevenue*100,revenue?2:0)}%`}}/></div><b>{currency(revenue)}</b><small>{item.supportsStudents?`${students} students`:`${clients} clients · ${projects} projects`}</small></div>)}{!service.length&&<div className="chart-empty">No service matches the selected filter.</div>}</section>
   <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LEAD FUNNEL</span><h2>{filteredLeads.length} leads · {conversion}% converted</h2></div></div>{leadsByStage.map((item)=><div className="analytic-row" key={item.stage}><span>{item.stage}</span><div className="progress-track"><i style={{width:`${Math.max(item.count/maxStage*100,item.count?2:0)}%`}}/></div><b>{item.count}</b></div>)}<button className="activity-link" onClick={()=>navigate('leads')}>Explore lead pipeline <Icon name="arrow" size={14}/></button></section></div>
  <div className="dashboard-grid analytics-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">PAYMENT STATUS</span><h2>Operational payment mix</h2></div></div>{statusRows.map((item)=><div className="analytic-row" key={item.status}><span>{item.status}</span><div className="progress-track"><i className="green" style={{width:`${Math.max(item.count/Math.max(filteredPayments.length,1)*100,2)}%`}}/></div><b>{item.count}</b></div>)}{!statusRows.length&&<div className="chart-empty">No payments match the selected filters.</div>}</section>
   <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ACQUISITION CHANNELS</span><h2>Leads by source</h2></div></div>{sources.map(({source,count})=><div className="analytic-row" key={source}><span>{source}</span><div className="progress-track"><i style={{width:`${Math.max(count/(sources[0]?.count||1)*100,3)}%`}}/></div><b>{count}</b></div>)}{!sources.length&&<div className="chart-empty">No leads match the selected period and service.</div>}<button className="activity-link" onClick={()=>navigate('clients')}>Open clients <Icon name="arrow" size={14}/></button></section></div>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CENTRAL SERVICE REGISTRY</span><h2>Service scorecard</h2></div><span className="table-count">Counts are all-time · revenue follows filters</span></div><div className="table-scroll"><table><thead><tr><th>Service</th><th>Leads</th><th>Customers / students</th><th>Projects</th><th>Requests</th><th>Completed</th><th>Filtered revenue</th><th>Pending</th></tr></thead><tbody>{service.map(({service:item,leads,clients,students,projects,requests,completed,revenue,pending})=><tr key={item.id}><td><button className="table-link" onClick={()=>navigate(`services/${item.id}`)}>{item.shortName}</button></td><td>{leads}</td><td>{item.supportsStudents?students:clients}</td><td>{projects}</td><td>{requests}</td><td>{completed}</td><td>{currency(revenue)}</td><td>{currency(pending)}</td></tr>)}</tbody></table></div></section>
 </div>
}
