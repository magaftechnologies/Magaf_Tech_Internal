import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { clientOutstanding, clientPaid, clientProjects, currency, invoiceStatus, projectOutstanding, projectPaid } from '../utils/calculations'
import Icon from './Icon'

const readFile=(file)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('File read failed'));reader.readAsDataURL(file)})

export default function ClientPortal() {
  const {user,logout}=useAuth()
  const {data,addFile,addRevision,setDeliverableStatus,patch}=useData()
  const client=data.clients.find((item)=>item.id===user.clientId)
  const [activeProject,setActiveProject]=useState('')
  const [revisionProject,setRevisionProject]=useState('')
  const [revisionText,setRevisionText]=useState('')
  const [uploadProject,setUploadProject]=useState('')
  const [uploadFiles,setUploadFiles]=useState([])
  const [uploadUrl,setUploadUrl]=useState('')
  const [uploadDescription,setUploadDescription]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  if(!client)return <main className="portal-invalid"><section className="panel"><h1>Client profile unavailable</h1><p>This demo portal account is no longer connected to a client record.</p><button className="button button-primary" onClick={logout}>Return to sign in</button></section></main>
  const projects=clientProjects(data,client.id)
  const projectIds=new Set(projects.map((project)=>project.id))
  const deals=data.deals.filter((deal)=>deal.clientId===client.id)
  const payments=data.payments.filter((payment)=>payment.clientId===client.id)
  const invoices=data.invoices.filter((invoice)=>invoice.clientId===client.id)
  const dealIds=new Set(deals.map((deal)=>deal.id))
  const clientNotifications=data.notifications.filter((item)=>item.recordId===client.id||projects.some((project)=>project.id===item.recordId)||dealIds.has(item.recordId))
  const files=data.files.filter((file)=>(file.clientId===client.id||projectIds.has(file.projectId))&&file.visibility==='Client')
  const visibleTasks=data.tasks.filter((task)=>(task.clientId===client.id||projectIds.has(task.projectId))&&task.clientVisible===true)
  const milestones=data.milestones.filter((item)=>projects.some((project)=>project.id===item.projectId)&&item.clientVisible)
  const revisions=data.revisions.filter((item)=>(item.clientId===client.id||projectIds.has(item.projectId))&&item.clientVisible)
  const activity=(()=>{
    const entries=[]
    projects.forEach((project)=>{
      entries.push({id:`start-${project.id}`,date:project.startDate||project.createdAt,title:'Project started',detail:project.name})
      if(project.status==='Completed')entries.push({id:`done-${project.id}`,date:project.completedAt||project.deadline,title:'Project completed',detail:project.name})
    })
    files.forEach((file)=>entries.push({id:`file-${file.id}`,date:file.uploadedAt,title:file.uploadedBy==='Client'?'You shared a file':'A deliverable was shared',detail:file.name}))
    revisions.forEach((revision)=>entries.push({id:`revision-${revision.id}`,date:revision.date,title:'Revision update',detail:revision.description}))
    payments.forEach((payment)=>entries.push({id:`payment-${payment.id}`,date:payment.date,title:'Payment recorded',detail:`${currency(payment.amount)} · ${payment.type||payment.method}`}))
    return entries.filter((item)=>item.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8)
  })()
  const selectedProject=projects.find((project)=>project.id===activeProject)
  const projectFiles=selectedProject?files.filter((file)=>file.projectId===selectedProject.id):files
  const submitRevision=(event)=>{
    event.preventDefault()
    if(!revisionProject||!revisionText.trim()){setMessage('Choose a project and add revision details.');return}
    addRevision({projectId:revisionProject,clientId:client.id,description:revisionText.trim(),requestedBy:client.contact||client.name})
    setRevisionText('')
    setRevisionProject('')
    setMessage('Revision request sent to the MAGAF team.')
  }
  const submitUpload=async(event)=>{
    event.preventDefault()
    if(!uploadProject||(!uploadFiles.length&&!uploadUrl.trim())){setMessage('Choose a project and select a file or add a link.');return}
    if(uploadFiles.length>5||uploadFiles.some((file)=>file.size>1_500_000)){setMessage('Choose up to 5 files, each 1.5 MB or smaller. For larger files, share a Drive link.');return}
    setBusy(true)
    try{
      const records=await Promise.all(uploadFiles.map(async(file)=>({
        name:file.name,type:file.type||'File',size:file.size,category:'Client Files',clientId:client.id,projectId:uploadProject,
        uploadedBy:'Client',uploadedAt:new Date().toISOString().slice(0,10),visibility:'Client',
        description:uploadDescription,fileData:await readFile(file),
      })))
      records.forEach(addFile)
      if(uploadUrl.trim())addFile({name:uploadDescription||'Client shared link',type:'Link',category:'Client Files',clientId:client.id,projectId:uploadProject,uploadedBy:'Client',uploadedAt:new Date().toISOString().slice(0,10),visibility:'Client',description:uploadDescription,url:uploadUrl.trim()})
      setUploadFiles([])
      setUploadUrl('')
      setUploadDescription('')
      setMessage('Your files have been shared with the MAGAF team.')
    }catch(error){console.error('Unable to upload client files.',error);setMessage('Could not read one of the selected files. Please try again.')}
    finally{setBusy(false)}
  }
  const approve=(file)=>{setDeliverableStatus(file.id,'Approved');setMessage(`${file.name} approved.`)}
  const requestChanges=(file,feedback)=>{setDeliverableStatus(file.id,'Changes Requested');patch('files',file.id,{clientFeedback:feedback});setMessage('Your feedback has been sent to the MAGAF team.')}
  return <main className="client-portal">
    <header className="portal-header"><div className="portal-brand"><span className="brand-mark">M<span>.</span></span><span><strong>MAGAF</strong><small>CLIENT PORTAL</small></span></div><div className="portal-header-right"><span className="portal-secure"><i/> Private client workspace</span><button className="portal-user" onClick={logout}><span className="user-avatar">{(client.contact||client.name).slice(0,1)}</span><span>{client.contact||client.name}</span><Icon name="logout" size={15}/></button></div></header>
    <div className="portal-content"><section className="portal-welcome"><div><span className="eyebrow">YOUR MAGAF WORKSPACE</span><h1>Welcome, <em>{(client.contact||client.name).split(' ')[0]}.</em></h1><p>Your projects, shared files and next steps — all in one place.</p></div><span className="portal-client-chip"><span className="avatar">{client.name.slice(0,1)}</span><span><b>{client.name}</b><small>{client.category||'Client'}</small></span></span></section>
      <section className="portal-summary"><PortalStat label="Active projects" value={projects.filter((project)=>!['Completed','Cancelled'].includes(project.status)).length} icon="briefcase"/><PortalStat label="Completed" value={projects.filter((project)=>project.status==='Completed').length} icon="check"/><PortalStat label="Amount paid" value={currency(clientPaid(data,client.id))} icon="trend"/><PortalStat label="Balance due" value={currency(clientOutstanding(data,client.id))} icon="card"/></section>
      {message&&<div className="portal-message" role="status"><Icon name="check" size={15}/>{message}<button onClick={()=>setMessage('')} aria-label="Dismiss">×</button></div>}
      <div className="portal-main-grid"><section className="portal-section"><div className="portal-section-heading"><div><span className="eyebrow">YOUR WORK</span><h2>Projects</h2></div><span className="portal-count">{projects.length} total</span></div>{projects.length?projects.map((project)=>{
        const service=data.services.find((item)=>item.id===project.serviceId)
          const value=Number(project.agreedAmount||0)
          const paid=projectPaid(data,project)
        const progress=project.progress??(project.status==='Completed'?100:project.status==='Client Review'?76:project.status==='In Progress'?48:project.status==='Planning'?12:30)
        const deal=deals.find((item)=>item.id===project.dealId)
        return <button className={`portal-project-card ${activeProject===project.id?'selected':''}`} key={project.id} onClick={()=>setActiveProject(activeProject===project.id?'':project.id)}><span className="portal-project-icon"><Icon name={service?.icon||'briefcase'} size={18}/></span><span className="portal-project-main"><strong>{project.name}</strong><small>{service?.shortName||'MAGAF service'} · Due {project.deadline||'To be confirmed'}</small><span className="portal-progress"><i style={{width:`${progress}%`}}/></span><small className="portal-project-bottom"><span>{progress}% complete</span><span className={`portal-status ${project.status==='Completed'?'done':''}`}>{project.status}</span></small></span><span className="portal-project-finance"><b>{currency(value)}</b><small>{currency(paid)} paid</small><small>{deal?.paymentStatus|| (projectOutstanding(data,project)===0?'Fully Paid':paid?'Partially Paid':'Payment Pending')}</small></span><Icon name="chevron" size={15}/></button>
      }):<PortalEmpty text="Your active work and projects will appear here."/>}
      {selectedProject&&<ProjectWorkspace project={selectedProject} service={data.services.find((item)=>item.id===selectedProject.serviceId)} files={projectFiles} milestones={milestones.filter((item)=>item.projectId===selectedProject.id)} tasks={visibleTasks.filter((task)=>task.projectId===selectedProject.id)} revisions={revisions.filter((item)=>item.projectId===selectedProject.id)} paid={projectPaid(data,selectedProject)} balance={projectOutstanding(data,selectedProject)} onApprove={approve} onRequestChanges={requestChanges}/>}</section>
      <aside className="portal-side">            <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">SHARED WITH YOU</span><h2>Recent deliverables</h2></div></div>{files.filter((file)=>['Final','Output','Final Deliverables','Client Review','Generated Assets'].includes(file.category)||['Final','Approved','Delivered','Client Review','Pending Approval'].includes(file.status)).slice(0,5).map((file)=><PortalFile key={file.id} file={file} onApprove={approve} onRequestChanges={requestChanges}/>)}
        {!files.length&&<PortalEmpty text="Shared files and approved deliverables will show up here."/>}</section>
        <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">UP NEXT</span><h2>Project milestones</h2></div></div>{milestones.slice(0,6).map((milestone)=><div className="portal-milestone" key={milestone.id}><span className={`portal-milestone-dot ${milestone.status==='Completed'?'complete':''}`}/><span><strong>{milestone.name}</strong><small>{milestone.completedAt?`Completed ${milestone.completedAt}`:`Target ${milestone.dueDate||'TBC'}`}</small></span></div>)}{!milestones.length&&<PortalEmpty text="Milestones will appear here as the team plans your work."/>}</section>
        <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">YOUR COMMERCIALS</span><h2>Deals & invoices</h2></div></div>{deals.map(deal=><div className="portal-timeline-item" key={deal.id}><span className="portal-timeline-dot"/><div><strong>{deal.title}</strong><small>Deal: {deal.status} · Payment: {deal.paymentStatus||'Payment Pending'}</small></div></div>)}{invoices.map(invoice=><div className="portal-timeline-item" key={invoice.id}><span className="portal-timeline-dot"/><div><strong>{invoice.invoiceNumber}</strong><small>{currency(invoice.amount)} · {invoiceStatus(data,invoice)}</small><small>Due {invoice.dueDate||'Not specified'}</small></div></div>)}{!deals.length&&!invoices.length&&<PortalEmpty text="Deals and invoice records will appear here when shared with your client profile."/>}</section>
        <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">PROJECT UPDATES</span><h2>Timeline</h2></div></div>{activity.slice(0,5).map(item=><div className="portal-timeline-item" key={item.id}><span className="portal-timeline-dot"/><div><strong>{item.title}</strong><small>{item.detail}</small><time>{item.date}</time></div></div>)}{!activity.length&&<PortalEmpty text="Updates will appear here as your project progresses."/>}</section>
        <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">NOTIFICATIONS</span><h2>Recent updates</h2></div></div>{clientNotifications.slice(0,5).map((item)=><div className="portal-timeline-item" key={item.id}><span className="portal-timeline-dot"/><div><strong>{item.title}</strong><small>{item.detail}</small><time>{item.time||'Recently'}</time></div></div>)}{!clientNotifications.length&&<PortalEmpty text="There are no recent notifications."/>}</section>
      </aside></div>
      <div className="portal-actions-grid"><section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">NEED A CHANGE?</span><h2>Request a revision</h2></div><Icon name="sparkles" size={18}/></div><form className="portal-form" onSubmit={submitRevision}><label className="field">Project<select value={revisionProject} onChange={(event)=>setRevisionProject(event.target.value)}><option value="">Select a project</option>{projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="field">What would you like us to change?<textarea rows="3" value={revisionText} onChange={(event)=>setRevisionText(event.target.value)} placeholder="Describe the requested change…"/></label><button className="button button-primary" disabled={!projects.length}><Icon name="arrow" size={15}/> Send revision request</button></form>{revisions.length>0&&<div className="revision-list">{revisions.slice(0,3).map((revision)=><div key={revision.id}><span className="status-pill">{revision.status}</span><p>{revision.description}</p><small>Revision {revision.number||''} · {revision.date}</small></div>)}</div>}</section>
      <section className="portal-panel"><div className="portal-section-heading"><div><span className="eyebrow">SHARE MATERIALS</span><h2>Upload project files</h2></div><Icon name="file" size={18}/></div><form className="portal-form" onSubmit={submitUpload}><label className="field">Project<select value={uploadProject} onChange={(event)=>setUploadProject(event.target.value)}><option value="">Select a project</option>{projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="field">Select files<input type="file" multiple onChange={(event)=>setUploadFiles(Array.from(event.target.files||[]))}/><small>Up to 5 files, 1.5 MB each in demo mode.</small></label>{uploadFiles.length>0&&<div className="selected-files">{uploadFiles.map((file)=>file.name).join(' · ')}</div>}<label className="field">Google Drive / external link<input type="url" value={uploadUrl} onChange={(event)=>setUploadUrl(event.target.value)} placeholder="https://drive.google.com/…"/></label><label className="field">What are you sharing?<input value={uploadDescription} onChange={(event)=>setUploadDescription(event.target.value)} placeholder="Logo, reference video, requirements…"/></label><button className="button button-primary" disabled={busy}><Icon name="plus" size={15}/>{busy?'Sharing…':'Share with MAGAF'}</button></form></section></div>
      <section className="portal-payment-panel"><div className="portal-section-heading"><div><span className="eyebrow">ACCOUNT SUMMARY</span><h2>Deals & payments</h2></div></div><div className="table-scroll"><table><thead><tr><th>Project / deal</th><th>Deal status</th><th>Agreed amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{projects.map((project)=>{const deal=deals.find((item)=>item.projectId===project.id);const paid=projectPaid(data,project);return <tr key={project.id}><td>{project.name}</td><td>{deal?.status||project.status}</td><td>{currency(project.agreedAmount)}</td><td>{currency(paid)}</td><td>{currency(projectOutstanding(data,project))}</td></tr>})}{deals.filter((deal)=>!deal.projectId&&!projects.some((project)=>project.dealId===deal.id)).map((deal)=><tr key={deal.id}><td>{deal.title}</td><td>{deal.status}</td><td>{currency(deal.agreedAmount||deal.quotedAmount)}</td><td>{currency(deal.paidAmount||0)}</td><td>{currency(Math.max(0,Number(deal.agreedAmount||deal.quotedAmount||0)-Number(deal.paidAmount||0)))}</td></tr>)}</tbody></table></div>{!projects.length&&!deals.length&&<PortalEmpty text="Your agreements and payment history will appear here."/>}</section>
      <footer className="portal-footer"><span>MAGAF Technologies · Secure client workspace</span><span>Need help? Contact your MAGAF project lead.</span></footer>
    </div>
  </main>
}

function ProjectWorkspace({project,service,files,milestones,tasks,revisions,paid,balance,onApprove,onRequestChanges}){
  const requirements=Array.isArray(project.requirements)?project.requirements:String(project.requirements||'').split('\n').filter(Boolean)
  return <section className="portal-workspace"><div className="portal-section-heading"><div><span className="eyebrow">PROJECT WORKSPACE</span><h2>{project.name}</h2></div><span className="portal-status">{project.status}</span></div><div className="portal-workspace-grid"><div><h3>Overview</h3><PortalInfo label="Service" value={service?.shortName}/><PortalInfo label="Project status" value={project.status}/><PortalInfo label="Deadline" value={project.deadline||'To be confirmed'}/><PortalInfo label="Project value" value={currency(project.agreedAmount)}/><PortalInfo label="Paid" value={currency(paid)}/><PortalInfo label="Balance" value={currency(balance)}/></div><div><h3>Requirements</h3>{requirements.length?requirements.map((requirement,index)=><p className="portal-requirement" key={`${index}${requirement}`}>{requirement}</p>):<p className="portal-muted">{project.clientRequirements||'The project team will share confirmed requirements here.'}</p>}</div></div>
    {milestones.length>0&&<div className="portal-inline-section"><h3>Milestones</h3>{milestones.map((milestone)=><div className="portal-milestone" key={milestone.id}><span className={`portal-milestone-dot ${milestone.status==='Completed'?'complete':''}`}/><span><strong>{milestone.name}</strong><small>{milestone.status} · {milestone.completedAt||milestone.dueDate||'Date to be confirmed'}</small></span></div>)}</div>}
    {tasks.length>0&&<div className="portal-inline-section"><h3>Pending actions</h3>{tasks.map((task)=><div className="portal-public-row" key={task.id}><Icon name="check" size={14}/><span>{task.title}</span><small>{task.status}</small></div>)}</div>}
    {revisions.length>0&&<div className="portal-inline-section"><h3>Revision history</h3>{revisions.map((revision)=><div className="portal-public-row" key={revision.id}><Icon name="clock" size={14}/><span>{revision.description}</span><small>{revision.status}</small></div>)}</div>}
    <div className="portal-inline-section"><h3>Project files & shared deliverables</h3>{files.length?files.map((file)=><PortalFile key={file.id} file={file} onApprove={onApprove} onRequestChanges={onRequestChanges}/>):<PortalEmpty text="Files will appear here once shared with your account."/>}</div>
  </section>
}
function PortalFile({file,onApprove,onRequestChanges}){const [feedback,setFeedback]=useState('');const [showFeedback,setShowFeedback]=useState(false);const image=file.type?.toLowerCase().includes('image')||/\.(png|jpe?g|gif|webp)$/i.test(file.name);const video=file.type?.toLowerCase().includes('video')||/\.(mp4|mov|webm)$/i.test(file.name);const href=file.fileData||file.url;const needsApproval=['Client Review','Pending Approval'].includes(file.status);return <div className="portal-file"><span className="portal-file-preview">{image&&href?<img src={href} alt=""/>:video?<Icon name="sparkles" size={18}/>:<Icon name="file" size={18}/>}</span><span className="portal-file-info"><strong>{file.name}</strong><small>{file.category||file.type} · {file.uploadedAt||'Shared with you'}</small><small>{file.description||file.status||''}</small>{file.clientFeedback&&<small>Feedback: {file.clientFeedback}</small>}</span>{video&&href?<a className="portal-file-action" href={href} target="_blank" rel="noreferrer">Play ↗</a>:href?<a className="portal-file-action" href={href} target="_blank" rel="noreferrer" download={file.fileData?file.name:undefined}>Open ↗</a>:null}{needsApproval&&<><button className="mini-action" onClick={()=>onApprove(file)}>Approve</button><button className="mini-action" onClick={()=>setShowFeedback(!showFeedback)}>Request changes</button></>}{showFeedback&&<form className="portal-feedback-form" onSubmit={(event)=>{event.preventDefault();if(feedback.trim()){onRequestChanges(file,feedback.trim());setShowFeedback(false);setFeedback('')}}}><textarea aria-label={`Feedback for ${file.name}`} rows="2" value={feedback} onChange={(event)=>setFeedback(event.target.value)} placeholder="Describe requested changes…"/><button className="button button-primary button-small" disabled={!feedback.trim()}>Send feedback</button></form>}</div>}
function PortalInfo({label,value}){return <div className="portal-info"><span>{label}</span><strong>{value||'—'}</strong></div>}
function PortalStat({label,value,icon}){return <div className="portal-stat"><span className="portal-stat-icon"><Icon name={icon} size={17}/></span><span><small>{label}</small><strong>{value}</strong></span></div>}
function PortalEmpty({text}){return <div className="portal-empty"><Icon name="layers" size={19}/><span>{text}</span></div>}
