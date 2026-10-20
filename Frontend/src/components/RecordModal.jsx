import { useState } from 'react'
import { useData } from '../context/DataContext'
import Icon from './Icon'

const definitions = {
  leads: { title:'Add lead', fields:[['name','Business name','text',true],['contact','Contact person','text',true],['phone','Phone','tel'],['email','Email','email'],['category','Business category','text'],['location','Location','text'],['source','Lead source','select',['Google Maps','Instagram','LinkedIn','WhatsApp','Email','Phone Call','Referral','Networking','Freelance Platform','Website','Other']],['serviceId','Interested service','services'],['potentialValue','Potential value (₹)','number'],['assignedTo','Assigned team member','people'],['status','Lead status','select',['New','Contacted','Interested','Meeting Scheduled','Proposal Sent','Negotiation','Follow-up']]] },
  clients: { title:'Add client', fields:[['name','Business name','text',true],['contact','Contact person','text',true],['phone','Phone','tel'],['whatsapp','WhatsApp number','tel'],['email','Email','email'],['alternateContact','Alternate contact','text'],['category','Business category','text'],['industry','Industry','text'],['businessDescription','Business description','textarea'],['targetAudience','Target audience','text'],['businessSize','Business size','select',['Solo','Small','Medium','Enterprise']],['address','Address','text'],['city','City','text'],['state','State','text'],['country','Country','text'],['location','Location / region','text'],['website','Website','url'],['instagram','Instagram','url'],['linkedin','LinkedIn','url'],['serviceId','Primary service','services'],['source','Acquisition source','select',['Google Maps','Instagram','LinkedIn','WhatsApp','Email','Phone Call','Referral','Networking','Freelance Platform','Website','Other']],['assignedTo','Assigned team member','people'],['status','Client status','select',['Lead','Contacted','Qualified','Proposal Sent','Negotiation','Active','Inactive','Completed','Lost']],['createPortalAccount','Create client portal account?','select',['No','Yes']],['portalPassword','Temporary portal password','password'],['portalPasswordConfirm','Confirm temporary password','password'],['notes','Internal notes','textarea']] },
  projects: { title:'Create project', fields:[['name','Project name','text',true],['clientId','Client','clients',true],['serviceId','Service','services',true],['dealId','Related deal','deals'],['type','Project type','select',['Business Website','Landing Page','Web Application','Mobile Application','Dashboard','Portal','Booking System','Lead Generation Website','E-commerce','Custom Software','Advertisement Video','Promotional Video','Reel','Social Media Creative','AI Automation','Digital Invitation','Other']],['description','Description','textarea'],['requirements','Requirements','textarea'],['startDate','Start date','date'],['deadline','Deadline','date'],['deliveryDate','Delivery date','date'],['agreedAmount','Agreed amount (₹)','number',true],['assignedToId','Assigned team member','people'],['priority','Priority','select',['Low','Medium','High','Urgent']],['status','Status','select',['Draft','Proposal','Awaiting Client','Deal Accepted','Payment Pending','Planning','Requirement Gathering','Design','Development','In Progress','Review','Client Review','Revision','Approved','Ready for Delivery','Deployment','Delivered','Completed','On Hold','Cancelled']],['technologyStack','Technology stack','text'],['repositoryUrl','Repository URL','url'],['liveUrl','Live URL','url'],['hosting','Hosting information','text'],['domain','Domain information','text'],['notes','Internal notes','textarea']] },
  deals: { title:'Create deal', fields:[['title','Deal / project title','text',true],['clientId','Client','clients',true],['serviceId','Service','services',true],['description','Description','textarea'],['quotedAmount','Quoted amount (₹)','number',true],['agreedAmount','Final agreed amount (₹)','number'],['discount','Discount (₹)','number'],['advanceRequired','Advance required (₹)','number'],['expectedCloseDate','Expected close date','date'],['assignedTo','Assigned team member','people'],['status','Deal status','select',['Lead','Contacted','Discussion','Requirement Gathering','Proposal Sent','Negotiation','Accepted','Rejected','Cancelled','In Progress','Completed','New','On Hold']],['notes','Internal notes','textarea']] },
  payments: { title:'Record payment', fields:[['clientId','Client','clients'],['studentId','Mentoring student','students'],['dealId','Deal','deals'],['projectId','Project','projects'],['invoiceId','Invoice','invoices'],['amount','Amount received (₹)','number',true],['date','Payment date','date',true],['type','Payment type','select',['Advance','Partial Payment','Milestone Payment','Final Payment','Refund','Other']],['method','Payment method','select',['UPI','Bank Transfer','Cash','Card','Online','Other']],['reference','Transaction reference','text'],['notes','Notes','textarea']] },
  invoices: { title:'Create invoice record', fields:[['invoiceNumber','Invoice number','text',true],['clientId','Client','clients',true],['dealId','Deal','deals'],['projectId','Project','projects'],['amount','Invoice amount (₹)','number',true],['issueDate','Issue date','date',true],['dueDate','Due date','date'],['paymentStatus','Payment status','select',['Not Paid','Partially Paid','Fully Paid','Payment Pending','Overdue']],['notes','Notes','textarea']] },
  tasks: { title:'Add task', fields:[['title','Task','text',true],['description','Description','textarea'],['projectId','Project','projects',true],['assignedToId','Assigned to','people'],['priority','Priority','select',['Low','Medium','High','Urgent']],['status','Status','select',['Todo','In Progress','Review','Completed']],['deadline','Deadline','date']] },
  assets: { title:'Add creative asset', fields:[['name','Asset name','text',true],['type','Asset type','select',['Reference image','Client logo','Product image','Video','Prompt','Draft','Final output','Other']],['clientId','Client','clients'],['projectId','Project','projects'],['version','Version','text'],['prompt','Prompt / brief','textarea'],['url','Output or source URL','url'],['status','Status','select',['Input','Generating','Draft','Revision','Approved','Final','Delivered']],['notes','Notes','textarea']] },
  files: { title:'Add project file or link', fields:[['name','Name / file label','text',true],['category','File category','select',['Input','Reference','Working','Output','Final','Client Provided','Other']],['clientId','Client','clients'],['projectId','Project','projects'],['linkProvider','External link provider','select',['Google Drive','Dropbox','GitHub','Live Website','YouTube','Other']],['url','External / Drive / live URL','url'],['description','Description','textarea'],['version','Version','text'],['status','File / approval status','select',['Draft','Pending Approval','Approved','Changes Requested','Final','Delivered']],['visibility','Visibility','select',['Internal','Client']],['uploadedBy','Uploaded by','select',['MAGAF Team','Client']]] },
  content: { title:'Add content deliverable', fields:[['projectId','Project','projects',true],['platform','Platform','text'],['contentType','Content type','text'],['topic','Topic','text'],['status','Status','select',['Idea','Script','Production','Review','Client Approval','Scheduled','Published','Completed']],['scheduledDate','Scheduled date','date'],['url','Deliverable URL','url']] },
  products: { title:'Add MAGAF product', fields:[['name','Product name','text',true],['description','Description','textarea'],['problem','Problem to solve','textarea'],['target','Target audience','text'],['stage','Product stage','select',['Idea','Validation','Prototype','MVP','Beta','Launched','Paused','Retired']],['users','Users','number'],['revenue','Revenue (₹)','number'],['technology','Technology','text'],['repository','Repository URL','url'],['url','Product URL','url'],['roadmap','Roadmap','textarea'],['priority','Priority','select',['Low','Medium','High']],['notes','Notes','textarea']] },
  students: { title:'Enroll mentoring student', fields:[['name','Student name','text',true],['phone','Phone','tel'],['email','Email','email'],['college','College','text'],['degree','Degree','text'],['branch','Branch','text'],['year','Year of study','text'],['courseName','Course / learning track','text'],['goal','Learning goal','text'],['level','Current level','select',['Beginner','Intermediate','Advanced']],['topics','Topics / modules','text'],['enrollmentDate','Enrollment date','date'],['agreedAmount','Total agreed fee (₹)','number'],['sessionsRemaining','Planned sessions','number'],['mentorId','Assigned mentor','mentors'],['status','Learning status','select',['Inquiry','Enrolled','Active','Paused','Completed','Dropped']],['notes','Notes','textarea']] },
  team: { title:'Add team member', fields:[['name','Full name','text',true],['email','Email','email',true],['phone','Phone','tel'],['role','Role','select',['super_admin','admin','manager','team_member','sales','developer','designer','mentor','finance']],['designation','Designation / responsibility','text'],['department','Department','text'],['profileImage','Profile image URL','url'],['status','Account status','select',['Active','Inactive']]] },
  communications: { title:'Log client communication', fields:[['clientId','Client','clients',true],['projectId','Project','projects'],['date','Date','date',true],['channel','Channel','select',['WhatsApp','Phone','Email','Instagram','LinkedIn','Meeting','Other']],['person','Contact person','text'],['summary','Summary','textarea',true],['followUpDate','Follow-up date','date'],['notes','Internal notes','textarea']] },
  mentoringSessions: { title:'Schedule mentoring session', fields:[['studentId','Student','students',true],['topic','Topic / session focus','text',true],['date','Session date','date',true],['durationMinutes','Duration (minutes)','number'],['mentor','Mentor','people'],['status','Status','select',['Scheduled','Completed','Cancelled']],['notes','Session notes','textarea']] },
  services: { title:'Add service', fields:[['name','Service name','text',true],['shortName','Short name','text'],['category','Category','text'],['description','Description','textarea']] },
}
const projectServiceFields = {
  software:[['technologyStack','Technology stack'],['frontend','Frontend'],['backend','Backend'],['database','Database'],['hosting','Hosting'],['domain','Domain'],['pagesModules','Pages / modules'],['features','Features'],['deploymentStatus','Deployment status','select',['Not started','Staging','Production']],['repositoryUrl','Repository URL','url'],['demoUrl','Demo URL','url'],['productionUrl','Production URL','url']],
  automation:[['businessProblem','Business problem'],['currentWorkflow','Current workflow'],['proposedAutomation','Proposed automation'],['aiProvider','AI provider'],['model','AI model'],['apiDependency','API dependency / integration'],['testingStatus','Testing status','select',['Not started','Testing','Passed','Blocked']],['deploymentStatus','Deployment status','select',['Not started','Staging','Production']],['maintenance','Maintenance plan'],['estimatedMonthlyCost','Estimated monthly third-party cost (₹)','number'],['costBearer','Who bears this cost?','select',['MAGAF','Client','Shared','Not applicable']]],
  creative:[['campaignName','Campaign name'],['creativeType','Creative type'],['platform','Platform'],['duration','Duration'],['aspectRatio','Aspect ratio'],['campaignObjective','Campaign objective'],['targetAudience','Target audience'],['script','Script','textarea'],['voiceover','Voiceover'],['creativePrompt','AI prompt','textarea'],['revisionCount','Revision count','number'],['approvalStatus','Approval status','select',['Pending','Client Review','Revision Requested','Approved']],['publishingStatus','Publishing status','select',['Not scheduled','Scheduled','Published']],['liveUrl','Final live link','url']],
  content:[['contentType','Content type'],['platform','Platform'],['topic','Topic'],['contentPillar','Content pillar'],['caption','Caption','textarea'],['script','Script','textarea'],['publishingDate','Publishing date','date'],['approvalStatus','Approval','select',['Pending','Client Review','Approved']]],
  events:[['eventType','Event type','select',['Wedding','Birthday','Engagement','Anniversary','Corporate event','Party','Cultural / religious event','Other']],['eventDate','Event date','date'],['venue','Venue'],['design','Design direction'],['rsvpUrl','RSVP link','url'],['mapUrl','Map URL','url'],['countdown','Countdown required','select',['Yes','No']],['photoGalleryUrl','Photo gallery URL','url'],['videoUrl','Video URL','url'],['invitationUrl','Invitation URL','url'],['qrCodeUrl','QR code URL','url'],['finalUrl','Final event page URL','url']],
  mentoring:[['studentName','Student / learner'],['courseTopic','Course / topic'],['learningPlan','Learning plan','textarea'],['sessionCount','Session count','number'],['sessionDuration','Session duration'],['scheduledSessions','Scheduled sessions','textarea'],['assignments','Assignments / resources','textarea'],['progressNotes','Progress notes','textarea']],
}

export default function RecordModal({ type, onClose, onSaved, initial = {}, recordId }) {
  const { data, error:apiError, loading, addLead, addClient, addProject, addPayment, addTask, addAsset, addFile, addDeal, addInvoice, addCommunication, addGeneric, patch } = useData()
  const [values, setValues] = useState(()=>({ ...(type==='clients'?{createPortalAccount:'No',status:'Active'}:{}), ...(type==='team'&&!initial.role?{role:'team_member',status:'Active'}:{}), ...(type==='students'&&!initial.enrollmentDate?{enrollmentDate:new Date().toISOString().slice(0,10)}:{}), ...initial }))
  const [error, setError] = useState('')
  const [selectedFiles,setSelectedFiles]=useState([])
  const [saving,setSaving]=useState(false)
  const definition = definitions[type]
  const serviceId = values.serviceId || initial.serviceId
  const serviceKey=data.services.find((service)=>service.id===serviceId)?.legacyKey
  const serviceFields = type==='projects'?projectServiceFields[serviceKey]||[]:[]
  if (!definition) return null
  const submit = async (event) => {
    event.preventDefault()
    const field = definition.fields.find(([name, , , required]) => required === true && !values[name])
    if (field) { setError(`${field[1]} is required.`); return }
    if(type==='students'&&!recordId&&(!String(values.courseName||'').trim()||values.agreedAmount===''||values.agreedAmount===undefined)){setError('Course / learning track and total agreed fee are required for enrollment.');return}
    if(['projects','deals'].includes(type)&&values.serviceId&&data.services.find((service)=>service.id===values.serviceId)?.supportsProjects===false){setError('Mentoring is managed through student enrollments, not client projects or deals.');return}
    const paymentInvoice=type==='payments'?data.invoices.find((item)=>item.id===values.invoiceId):null
    const paymentProject=type==='payments'?data.projects.find((item)=>item.id===values.projectId||item.id===paymentInvoice?.projectId):null
    const paymentDeal=type==='payments'?data.deals.find((item)=>item.id===values.dealId||item.id===paymentInvoice?.dealId):null
    const paymentStudent=type==='payments'?data.students.find((item)=>item.id===values.studentId):null
    if(type==='payments'&&values.studentId&&[values.clientId,values.projectId,values.dealId,values.invoiceId].some(Boolean)){setError('Mentorship payments must be linked only to a student.');return}
    if(type==='payments'&&[values.studentId,values.projectId,values.dealId,values.invoiceId].filter(Boolean).length>1){setError('Link a payment to one project, deal, invoice, or mentoring student.');return}
    if(type==='payments'&&!values.projectId&&!values.dealId&&!values.studentId&&!paymentInvoice){setError('Choose a project, deal, invoice or mentoring student for this payment.');return}
    if(type==='payments'&&!values.clientId&&!paymentInvoice&&!paymentProject&&!paymentDeal&&!paymentStudent){setError('Choose a client or mentoring student for this payment.');return}
    if(type==='payments'&&Number(values.amount)<=0){setError('Enter an amount greater than zero.');return}
    if(type==='payments'&&!recordId&&values.method!=='Cash'&&!selectedFiles.length){setError('Attach payment receipt proof for non-cash payments.');return}
    if(type==='files'&&selectedFiles.length>10){setError('Choose up to 10 files per upload.');return}
    if(type==='payments'&&selectedFiles.length>5){setError('Choose up to 5 payment proof files.');return}
    if(type==='files'&&!selectedFiles.length&&!values.url){setError('Choose files or add a secure HTTPS link.');return}
    if(type==='clients'&&values.createPortalAccount==='Yes'){
      if(!values.email){setError('An email address is required for the client portal account.');return}
      if(!values.portalPassword||values.portalPassword.length<10){setError('Set a temporary portal password of at least 10 characters.');return}
      if(values.portalPassword!==values.portalPasswordConfirm){setError('The temporary passwords do not match.');return}
    }
    const payload = { ...values }
    if(type==='students'&&recordId){
      const unchangedMentor=(values.mentorId||'')===(initial.mentorId||'')
      delete payload.assignedMentor
      delete payload.mentor
      if(unchangedMentor)delete payload.mentorId
      else if(!payload.mentorId)payload.mentorId=null
    }
    if (type === 'projects' || type === 'payments' || type === 'deals' || type === 'invoices' || type === 'products' || type === 'students' || type==='mentoringSessions') ['agreedAmount','paidAmount','amount','quotedAmount','discount','advanceRequired','estimatedMonthlyCost','revisionCount','sessionCount','sessionFee','sessionsCompleted','sessionsRemaining','durationMinutes','users','revenue'].forEach((key) => { if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]) })
    if(type==='projects'&&serviceFields.length)payload.serviceDetails={...(initial.serviceDetails||{}),...Object.fromEntries(serviceFields.map(([key])=>[key,payload[key]]))}
    setSaving(true)
    setError('')
    try {
      let result
      if(recordId) {
        result=await patch(type==='team'?'users':type,recordId,payload)
      } else if(type==='clients') {
        payload.createPortalAccount=payload.createPortalAccount==='Yes'
        result=await addClient(payload)
      } else if(type === 'invoices') {
      const project=data.projects.find(item=>item.id===payload.projectId)
      const deal=data.deals.find(item=>item.id===payload.dealId)
      if(project&&deal&&deal.projectId&&deal.projectId!==project.id){setError('The selected deal is not connected to that project.');return}
      payload.clientId=payload.clientId||project?.clientId||deal?.clientId
      payload.projectId=payload.projectId||deal?.projectId
      payload.dealId=payload.dealId||project?.dealId
      payload.paymentStatus=payload.paymentStatus||'Payment Pending'
      result=await addInvoice(payload)
      } else if (type === 'payments') {
      const project = paymentProject
      const deal=paymentDeal
      const student=paymentStudent
      payload.clientId=payload.clientId||paymentInvoice?.clientId||project?.clientId||deal?.clientId
      payload.serviceId = student?.serviceId || project?.serviceId || deal?.serviceId || data.clients.find((item) => item.id === payload.clientId)?.serviceId
      payload.projectId=payload.projectId||paymentInvoice?.projectId||deal?.projectId
      payload.dealId=payload.dealId||paymentInvoice?.dealId
      if(!payload.projectId&&deal?.projectId)payload.projectId=deal.projectId
      if(payload.type==='Refund')payload.status='Refunded'
      const proofFiles=[]
      for(const file of selectedFiles){
        const uploaded=await addFile({
          name:file.name,
          rawFile:file,
          category:'payment_proof',
          clientId:payload.clientId,
          projectId:payload.projectId,
          visibility:'Internal',
          description:`Payment proof for ${student?.name || (payload.projectId ? data.projects.find((item)=>item.id===payload.projectId)?.name || 'project' : 'client payment')}`,
        },{throwOnError:true})
        if(!uploaded)throw new Error(apiError||'Payment proof could not be uploaded.')
        proofFiles.push(uploaded.id)
      }
      payload.proofFiles=proofFiles
      result=await addPayment(payload)
      } else if(type==='files') {
        const records=[]
        for(const file of selectedFiles){
          const record=await addFile({name:file.name,rawFile:file,category:payload.category,clientId:payload.clientId,projectId:payload.projectId,description:payload.description,visibility:payload.visibility||'Internal'})
          if(!record)throw new Error(apiError||'File upload failed. Check the backend and Cloudinary configuration.')
          records.push(record)
        }
        if(payload.url){
          const record=await addFile({name:payload.name||'Shared link',url:payload.url,category:payload.category,clientId:payload.clientId,projectId:payload.projectId,description:payload.description,visibility:payload.visibility||'Internal'})
          if(!record)throw new Error(apiError||'The external link could not be saved.')
          records.push(record)
        }
        result=records[0]
      } else if (type === 'leads') result=await addLead(payload)
      else if (type === 'projects') result=await addProject(payload)
      else if (type === 'tasks') result=await addTask(payload)
      else if (type === 'assets') result=await addAsset(payload)
      else if (type === 'deals') result=await addDeal(payload)
      else if(type==='communications')result=await addCommunication(payload)
      else result=await addGeneric(type === 'team' ? 'users' : type, payload)
      if(!result){setError(apiError||'The record could not be saved.');return}
      onSaved?.(result,type)
      onClose()
    } catch(saveError) {
      setError(saveError.message||apiError||'The record could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const assignedMentorId=values.mentorId||initial.mentorId||''
  const mentorOptions=(data.teamMembers||[]).filter((person)=>person.isActive!==false)
  if(assignedMentorId&&!mentorOptions.some((person)=>person.id===assignedMentorId)){
    mentorOptions.push({id:assignedMentorId,name:initial.mentor||'Current assignment',role:'unavailable'})
  }
  const options = (kind) => kind === 'services' ? data.services.filter((item)=>!['projects','deals'].includes(type)||item.supportsProjects!==false||recordId&&item.id===initial.serviceId).map((item) => [item.id,item.shortName || item.name]) : kind === 'clients' ? data.clients.map((item)=>[item.id,item.name]) : kind === 'students' ? data.students.map((item)=>[item.id,item.name]) : kind === 'projects' ? data.projects.filter((item)=>!values.clientId||item.clientId===values.clientId).map((item)=>[item.id,item.name]) : kind==='deals'?data.deals.filter((item)=>!values.clientId||item.clientId===values.clientId).map((item)=>[item.id,item.title]):kind==='invoices'?data.invoices.filter((item)=>!values.clientId||item.clientId===values.clientId).map((item)=>[item.id,item.invoiceNumber||item.id]):kind==='mentors'?mentorOptions.map((item)=>[item.id,`${item.name} · ${item.role.replaceAll('_',' ')}`]):(data.teamMembers||[]).map((item)=>[item.id,item.name])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="eyebrow">MAGAF WORKSPACE</span><h2 id="modal-title">{recordId?`Edit ${definition.title.replace(/^Add |^Create /,'')}`:definition.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div>
      <form onSubmit={submit}><div className="form-grid">{definition.fields.filter(([name])=>type!=='clients'||!['portalPassword','portalPasswordConfirm'].includes(name)||values.createPortalAccount==='Yes').map((field) => <ModalField key={field[0]} field={field} values={values} setValues={setValues} options={options} loading={loading} apiError={apiError}/>)}{serviceFields.length>0&&<div className="service-form-divider">{data.services.find(item=>item.id===serviceId)?.shortName} project details</div>}{serviceFields.map((field)=> <ModalField key={field[0]} field={field} values={values} setValues={setValues} options={options} loading={loading} apiError={apiError}/>)}{type==='files'&&<label className="field full file-picker">Upload multiple files<input type="file" multiple accept="image/*,application/pdf,application/zip,.zip,.doc,.docx,.txt,video/*,audio/*" onChange={(event)=>setSelectedFiles(Array.from(event.target.files||[]))}/><small>Up to 10 files per upload, including ZIP archives. File size and type are validated by the MAGAF API.</small>{selectedFiles.length>0&&<span className="selected-files">{selectedFiles.map((file)=>file.name).join(' · ')}</span>}</label>      }{type==='payments'&&<label className="field full file-picker">Payment proof / receipt{values.method!=='Cash'&&!recordId&&<span className="required"> *</span>}<input type="file" multiple required={!recordId&&values.method!=='Cash'} accept="image/*,application/pdf,.doc,.docx,.txt" onChange={(event)=>setSelectedFiles(Array.from(event.target.files||[]).slice(0,5))}/><small>{values.method==='Cash'?'Cash payments do not need a receipt and require approval by another team member.':'Attach the receipt for this payment. It will be recorded as paid without a separate verification step. Up to 5 files.'}</small>{selectedFiles.length>0&&<span className="selected-files">{selectedFiles.map((file)=>file.name).join(' · ')}</span>}</label>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}><Icon name="plus" size={16}/>{saving?'Saving…':'Save record'}</button></div></form>
    </section>
  </div>
}
function ModalField({field,values,setValues,options,loading,apiError}){
  const [name,label,kind,requiredOrChoices,choices]=field
  const required=requiredOrChoices===true
  const selectChoices=Array.isArray(requiredOrChoices)?requiredOrChoices:choices
  const isSelect=kind==='select'||['services','clients','projects','people','mentors','deals','invoices','students'].includes(kind)
  const choicesForField=selectChoices||options(kind)
  const emptyMentorMessage=loading?'Loading eligible mentors…':apiError?'Mentor list could not be loaded. Please refresh and try again.':'No active mentors available.'
  return <label className={kind==='textarea'?'field full':'field'}>{label}{required&&<span className="required"> *</span>}{isSelect?<select required={required} value={values[name]||''} onChange={(event)=>setValues({...values,[name]:event.target.value})}><option value="">{kind==='mentors'&&choicesForField.length===0?emptyMentorMessage:`Select ${label.toLowerCase()}`}</option>{choicesForField.map((option)=><option key={Array.isArray(option)?option[0]:option} value={Array.isArray(option)?option[0]:option}>{Array.isArray(option)?option[1]:option}</option>)}</select>:kind==='textarea'?<textarea rows="3" value={values[name]||''} onChange={(event)=>setValues({...values,[name]:event.target.value})} placeholder={`Add ${label.toLowerCase()}…`}/>:<input type={kind||'text'} required={required} min={kind==='number'?0:undefined} value={values[name]??''} onChange={(event)=>setValues({...values,[name]:event.target.value})} placeholder={kind==='number'?'0':''}/>}</label>
}
