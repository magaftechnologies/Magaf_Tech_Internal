import { useState } from 'react'
import { useData } from '../context/DataContext'
import { dealPaid, invoicePaid, paymentValue, projectPaid } from '../utils/calculations'
import Icon from './Icon'

const definitions = {
  leads: { title:'Add lead', fields:[['name','Business name','text',true],['contact','Contact person','text',true],['phone','Phone','tel'],['email','Email','email'],['category','Business category','text'],['location','Location','text'],['source','Lead source','select',['Google Maps','Instagram','LinkedIn','WhatsApp','Email','Phone Call','Referral','Networking','Freelance Platform','Website','Other']],['serviceId','Interested service','services'],['potentialValue','Potential value (₹)','number'],['assignedTo','Assigned founder','people'],['status','Lead status','select',['New','Contacted','Interested','Meeting Scheduled','Proposal Sent','Negotiation','Follow-up']]] },
  clients: { title:'Add client', fields:[['name','Business name','text',true],['contact','Contact person','text',true],['phone','Phone','tel'],['whatsapp','WhatsApp number','tel'],['email','Email','email'],['alternateContact','Alternate contact','text'],['category','Business category','text'],['industry','Industry','text'],['businessDescription','Business description','textarea'],['targetAudience','Target audience','text'],['businessSize','Business size','select',['Solo','Small','Medium','Enterprise']],['address','Address','text'],['city','City','text'],['state','State','text'],['country','Country','text'],['location','Location / region','text'],['website','Website','url'],['instagram','Instagram','url'],['linkedin','LinkedIn','url'],['serviceId','Primary service','services'],['source','Acquisition source','select',['Google Maps','Instagram','LinkedIn','WhatsApp','Email','Phone Call','Referral','Networking','Freelance Platform','Website','Other']],['leadDate','Lead date','date'],['firstContactDate','First contact date','date'],['lastContactDate','Last contact date','date'],['assignedTo','Assigned team member','people'],['priority','Priority','select',['Low','Medium','High']],['relationshipStatus','Relationship status','select',['New','Contacted','Qualified','Proposal Sent','Negotiation','Converted','Active','Completed','Inactive','Lost','Deal Accepted','Onboarding','Retainer','Paused','Archived']],['status','Client status','select',['Lead','Contacted','Qualified','Proposal Sent','Negotiation','Converted','Active','Completed','Inactive','Lost','Deal Accepted','Onboarding','Active Client','Project Completed','Retainer','Paused','Archived','Returning']],['notes','Internal notes','textarea']] },
  projects: { title:'Create project', fields:[['name','Project name','text',true],['clientId','Client','clients',true],['serviceId','Service','services',true],['dealId','Related deal','deals'],['type','Project type','select',['Business Website','Landing Page','Web Application','Mobile Application','Dashboard','Portal','Booking System','Lead Generation Website','E-commerce','Custom Software','Advertisement Video','Promotional Video','Reel','Social Media Creative','AI Automation','Digital Invitation','Other']],['description','Description','textarea'],['requirements','Requirements','textarea'],['startDate','Start date','date'],['deadline','Deadline','date'],['deliveryDate','Delivery date','date'],['agreedAmount','Agreed amount (₹)','number',true],['assignedTo','Assigned founder','people'],['priority','Priority','select',['Low','Medium','High','Urgent']],['status','Status','select',['Draft','Proposal','Awaiting Client','Deal Accepted','Payment Pending','Planning','Requirement Gathering','Design','Development','In Progress','Review','Client Review','Revision','Approved','Ready for Delivery','Deployment','Delivered','Completed','On Hold','Cancelled']],['technologyStack','Technology stack','text'],['repositoryUrl','Repository URL','url'],['liveUrl','Live URL','url'],['hosting','Hosting information','text'],['domain','Domain information','text'],['notes','Internal notes','textarea']] },
  deals: { title:'Create deal', fields:[['title','Deal / project title','text',true],['clientId','Client','clients',true],['serviceId','Service','services',true],['description','Description','textarea'],['quotedAmount','Quoted amount (₹)','number',true],['agreedAmount','Final agreed amount (₹)','number'],['discount','Discount (₹)','number'],['advanceRequired','Advance required (₹)','number'],['expectedCloseDate','Expected close date','date'],['assignedTo','Assigned founder','people'],['status','Deal status','select',['Lead','Contacted','Discussion','Requirement Gathering','Proposal Sent','Negotiation','Accepted','Rejected','Cancelled','In Progress','Completed','New','On Hold']],['notes','Internal notes','textarea']] },
  payments: { title:'Record payment', fields:[['clientId','Client','clients'],['studentId','Mentoring student','students'],['dealId','Deal','deals'],['projectId','Project','projects'],['invoiceId','Invoice','invoices'],['amount','Amount received (₹)','number',true],['date','Payment date','date',true],['type','Payment type','select',['Advance','Partial Payment','Milestone Payment','Final Payment','Refund','Other']],['method','Payment method','select',['UPI','Bank Transfer','Cash','Other']],['reference','Transaction reference','text'],['notes','Notes','textarea']] },
  invoices: { title:'Create invoice record', fields:[['invoiceNumber','Invoice number','text',true],['clientId','Client','clients',true],['dealId','Deal','deals'],['projectId','Project','projects'],['amount','Invoice amount (₹)','number',true],['issueDate','Issue date','date',true],['dueDate','Due date','date'],['paymentStatus','Payment status','select',['Not Paid','Partially Paid','Fully Paid','Payment Pending','Overdue']],['notes','Notes','textarea']] },
  tasks: { title:'Add task', fields:[['title','Task','text',true],['description','Description','textarea'],['clientId','Client','clients'],['projectId','Project','projects'],['assignedTo','Assigned to','people'],['priority','Priority','select',['Low','Medium','High','Urgent']],['status','Status','select',['Todo','In Progress','Review','Completed','Blocked']],['deadline','Deadline','date'],['clientVisible','Visible in client portal','select',['No','Yes']]] },
  assets: { title:'Add creative asset', fields:[['name','Asset name','text',true],['type','Asset type','select',['Reference image','Client logo','Product image','Video','Prompt','Draft','Final output','Other']],['clientId','Client','clients'],['projectId','Project','projects'],['version','Version','text'],['prompt','Prompt / brief','textarea'],['url','Output or source URL','url'],['status','Status','select',['Input','Generating','Draft','Revision','Approved','Final','Delivered']],['notes','Notes','textarea']] },
  files: { title:'Add project file or link', fields:[['name','Name / file label','text',true],['category','File category','select',['Input','Reference','Working','Output','Final','Client Provided','Other']],['clientId','Client','clients'],['projectId','Project','projects'],['linkProvider','External link provider','select',['Google Drive','Dropbox','GitHub','Live Website','YouTube','Other']],['url','External / Drive / live URL','url'],['description','Description','textarea'],['version','Version','text'],['status','File / approval status','select',['Draft','Pending Approval','Approved','Changes Requested','Final','Delivered']],['visibility','Visibility','select',['Internal','Client']],['uploadedBy','Uploaded by','select',['MAGAF Team','Client']]] },
  content: { title:'Add content deliverable', fields:[['name','Content / campaign name','text',true],['clientId','Client','clients'],['projectId','Project','projects'],['serviceId','Service','services'],['platform','Platform','text'],['contentType','Content type','text'],['topic','Topic','text'],['status','Status','select',['Idea','Script','Production','Review','Client Approval','Scheduled','Published','Completed']],['scheduledDate','Scheduled date','date'],['url','Deliverable URL','url']] },
  products: { title:'Add MAGAF product', fields:[['name','Product name','text',true],['description','Description','textarea'],['problem','Problem to solve','textarea'],['target','Target audience','text'],['stage','Product stage','select',['Idea','Validation','Prototype','MVP','Beta','Launched','Paused','Retired']],['users','Users','number'],['revenue','Revenue (₹)','number'],['technology','Technology','text'],['repository','Repository URL','url'],['url','Product URL','url'],['roadmap','Roadmap','textarea'],['priority','Priority','select',['Low','Medium','High']],['notes','Notes','textarea']] },
  students: { title:'Add mentoring learner', fields:[['name','Student name','text',true],['contact','Phone','tel'],['email','Email','email'],['college','College','text'],['degree','Degree','text'],['branch','Branch','text'],['year','Year of study','text'],['goal','Course / learning goal','text'],['level','Current level','select',['Beginner','Intermediate','Advanced']],['topics','Topics / subjects','text'],['enrollmentDate','Enrollment date','date'],['sessionType','Session type','select',['1:1','Group','Project guidance']],['sessionDate','Next session date','date'],['sessionDuration','Session duration','text'],['agreedAmount','Total agreed fee (₹)','number'],['sessionsCompleted','Sessions completed','number'],['sessionsRemaining','Sessions remaining','number'],['mentor','Assigned mentor','people'],['status','Status','select',['New','Active','Paused','Completed']],['progress','Progress notes','textarea'],['notes','Notes','textarea']] },
  team: { title:'Add team member', fields:[['name','Name','text',true],['role','Role / focus','text'],['email','Email','email'],['phone','Phone','tel'],['status','Status','select',['Active','Inactive']],['skills','Skills','text']] },
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

export default function RecordModal({ type, onClose, initial = {}, recordId }) {
  const { data, addLead, addClient, addProject, addPayment, addTask, addAsset, addFile, addDeal, addInvoice, addCommunication, addGeneric, patch } = useData()
  const [values, setValues] = useState(initial)
  const [error, setError] = useState('')
  const [selectedFiles,setSelectedFiles]=useState([])
  const [saving,setSaving]=useState(false)
  const definition = definitions[type]
  const serviceId = values.serviceId || initial.serviceId
  const serviceFields = type==='projects'?projectServiceFields[serviceId]||[]:[]
  if (!definition) return null
  const submit = async (event) => {
    event.preventDefault()
    const field = definition.fields.find(([name, , , required]) => required === true && !values[name])
    if (field) { setError(`${field[1]} is required.`); return }
    if(['projects','deals'].includes(type)&&values.serviceId&&data.services.find((service)=>service.id===values.serviceId)?.supportsProjects===false){setError('Mentoring is managed through student enrollments, not client projects or deals.');return}
    const paymentInvoice=type==='payments'?data.invoices.find((item)=>item.id===values.invoiceId):null
    const paymentProject=type==='payments'?data.projects.find((item)=>item.id===values.projectId||item.id===paymentInvoice?.projectId):null
    const paymentDeal=type==='payments'?data.deals.find((item)=>item.id===values.dealId||item.id===paymentInvoice?.dealId):null
    const paymentStudent=type==='payments'?data.students.find((item)=>item.id===values.studentId):null
    if(type==='payments'&&[values.studentId,values.projectId,values.dealId,values.invoiceId].filter(Boolean).length>1){setError('Link a payment to one project, deal, invoice, or mentoring student.');return}
    if(type==='payments'&&!values.projectId&&!values.dealId&&!values.studentId&&!paymentInvoice){setError('Choose a project, deal, invoice or mentoring student for this payment.');return}
    if(type==='payments'&&!values.clientId&&!paymentInvoice&&!paymentProject&&!paymentDeal&&!paymentStudent){setError('Choose a client or mentoring student for this payment.');return}
    if(type==='payments'&&Number(values.amount)<=0){setError('Enter an amount greater than zero.');return}
    if (type === 'payments' && paymentStudent) {
      const studentPayments=data.payments.filter((payment)=>payment.studentId===paymentStudent.id)
      const paid=studentPayments.length?studentPayments.reduce((sum,payment)=>sum+paymentValue(payment),0):Number(paymentStudent.paidAmount||0)
      const balance=Math.max(0,Number(paymentStudent.agreedAmount||0)-paid)
      if(values.type==='Refund'&&Number(values.amount)>paid){setError(`Refund exceeds the amount paid of ₹${paid.toLocaleString('en-IN')}.`);return}
      if(values.type!=='Refund'&&Number(values.amount)>balance){setError(`Payment exceeds the remaining mentoring balance of ₹${balance.toLocaleString('en-IN')}.`);return}
    } else if (type === 'payments' && (values.projectId||values.dealId)) {
      const project = paymentProject
      const deal=paymentDeal
      const relevantProject=project||data.projects.find((item)=>item.id===deal?.projectId)
      const relevantDeal=deal||data.deals.find((item)=>item.id===relevantProject?.dealId)
      if(project&&deal&&deal.projectId&&deal.projectId!==project.id){setError('The selected deal does not belong to the selected project.');return}
      const paid=paymentInvoice?invoicePaid(data,paymentInvoice):relevantProject?projectPaid(data,relevantProject):relevantDeal?dealPaid(data,relevantDeal):0
      if(values.type==='Refund'&&Number(values.amount)>paid){setError(`Refund exceeds the amount paid of ₹${paid.toLocaleString('en-IN')}.`);return}
      if (values.type!=='Refund') {
        const balance = Math.max(0, Number(paymentInvoice?.amount||relevantProject?.agreedAmount||relevantDeal?.agreedAmount||relevantDeal?.quotedAmount||0)-paid)
        if (Number(values.amount) > balance) { setError(`Payment exceeds the remaining project balance of ₹${balance.toLocaleString('en-IN')}.`); return }
      }
    }
    if(type==='files'&&selectedFiles.length>5){setError('Choose up to 5 files per upload.');return}
    if(type==='files'&&selectedFiles.some((file)=>file.size>1_500_000)){setError('Each file must be 1.5 MB or smaller in this local demo. Use a Drive link for larger files.');return}
    const payload = { ...values }
    if (type === 'projects' || type === 'payments' || type === 'deals' || type === 'invoices' || type === 'products' || type === 'students' || type==='mentoringSessions') ['agreedAmount','paidAmount','amount','quotedAmount','discount','advanceRequired','estimatedMonthlyCost','revisionCount','sessionCount','sessionFee','sessionsCompleted','sessionsRemaining','durationMinutes','users','revenue'].forEach((key) => { if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]) })
    if(type==='projects'&&serviceFields.length)payload.serviceDetails={...(initial.serviceDetails||{}),...Object.fromEntries(serviceFields.map(([key])=>[key,payload[key]]))}
    if(type==='tasks')payload.clientVisible=payload.clientVisible==='Yes'
    if(recordId) {
      patch(type==='team'?'users':type,recordId,payload)
    } else if (type === 'invoices') {
      const project=data.projects.find(item=>item.id===payload.projectId)
      const deal=data.deals.find(item=>item.id===payload.dealId)
      if(project&&deal&&deal.projectId&&deal.projectId!==project.id){setError('The selected deal is not connected to that project.');return}
      payload.clientId=payload.clientId||project?.clientId||deal?.clientId
      payload.projectId=payload.projectId||deal?.projectId
      payload.dealId=payload.dealId||project?.dealId
      payload.paymentStatus=payload.paymentStatus||'Payment Pending'
      addInvoice(payload)
    } else if (type === 'payments') {
      const project = paymentProject
      const deal=paymentDeal
      const student=paymentStudent
      payload.clientId=payload.clientId||paymentInvoice?.clientId||project?.clientId||deal?.clientId
      payload.serviceId = student?.serviceId || project?.serviceId || deal?.serviceId || data.clients.find((item) => item.id === payload.clientId)?.serviceId
      payload.projectId=payload.projectId||paymentInvoice?.projectId||deal?.projectId
      payload.dealId=payload.dealId||paymentInvoice?.dealId||project?.dealId
      if(!payload.projectId&&deal?.projectId)payload.projectId=deal.projectId
      if(!payload.dealId&&project?.dealId)payload.dealId=project.dealId
      if(payload.type==='Refund')payload.status='Refunded'
      try { addPayment(payload) }
      catch (paymentError) { setError(paymentError.message); return }
    } else if(type==='files') {
      setSaving(true)
      try {
        const records=await Promise.all(selectedFiles.map(async(file)=>({name:file.name,type:file.type||'File',size:file.size,category:payload.category,clientId:payload.clientId,projectId:payload.projectId,linkProvider:payload.linkProvider,url:payload.url,description:payload.description,version:payload.version||'1',status:payload.status||'Draft',visibility:payload.visibility||'Internal',uploadedBy:payload.uploadedBy||'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10),fileData:file.size?await readFile(file):undefined})))
        if(records.length) records.forEach(addFile)
        else addFile(payload)
      } catch(readError) {
        console.error('Unable to read selected file.',readError)
        setError('The selected file could not be read. Try another file or add an external link.')
        setSaving(false)
        return
      }
    } else if (type === 'leads') addLead(payload)
    else if (type === 'clients') addClient(payload)
    else if (type === 'projects') addProject(payload)
    else if (type === 'tasks') addTask(payload)
    else if (type === 'assets') addAsset(payload)
    else if (type === 'deals') addDeal(payload)
    else if(type==='communications')addCommunication(payload)
    else addGeneric(type === 'team' ? 'users' : type, payload)
    onClose()
  }
  const options = (kind) => kind === 'services' ? data.services.filter((item)=>!['projects','deals'].includes(type)||item.supportsProjects!==false||recordId&&item.id===initial.serviceId).map((item) => [item.id,item.shortName || item.name]) : kind === 'clients' ? data.clients.map((item) => [item.id,item.name]) : kind === 'students' ? data.students.map((item)=>[item.id,item.name]) : kind === 'projects' ? data.projects.filter((item) => !values.clientId || item.clientId === values.clientId).map((item) => [item.id,item.name]) : kind==='deals'?data.deals.filter((item)=>!values.clientId||item.clientId===values.clientId).map((item)=>[item.id,item.title]):kind==='invoices'?data.invoices.filter((item)=>!values.clientId||item.clientId===values.clientId).map((item)=>[item.id,item.invoiceNumber||item.id]):data.users.map((item) => [item.name,item.name])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="eyebrow">MAGAF WORKSPACE</span><h2 id="modal-title">{recordId?`Edit ${definition.title.replace(/^Add |^Create /,'')}`:definition.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div>
      <form onSubmit={submit}><div className="form-grid">{definition.fields.map((field) => <ModalField key={field[0]} field={field} values={values} setValues={setValues} options={options}/>)}{serviceFields.length>0&&<div className="service-form-divider">{data.services.find(item=>item.id===serviceId)?.shortName} project details</div>}{serviceFields.map((field)=> <ModalField key={field[0]} field={field} values={values} setValues={setValues} options={options}/>)}{type==='files'&&<label className="field full file-picker">Upload multiple files<input type="file" multiple onChange={(event)=>setSelectedFiles(Array.from(event.target.files||[]))}/><small>Up to 5 files · 1.5 MB per file · Large files can be added as Drive or external links.</small>{selectedFiles.length>0&&<span className="selected-files">{selectedFiles.map((file)=>file.name).join(' · ')}</span>}</label>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}><Icon name="plus" size={16}/>{saving?'Saving files…':'Save record'}</button></div></form>
    </section>
  </div>
}
function ModalField({field,values,setValues,options}){
  const [name,label,kind,requiredOrChoices,choices]=field
  const required=requiredOrChoices===true
  const selectChoices=Array.isArray(requiredOrChoices)?requiredOrChoices:choices
  return <label className={kind==='textarea'?'field full':'field'}>{label}{required&&<span className="required"> *</span>}{kind==='select'||['services','clients','projects','people','deals','invoices','students'].includes(kind)?<select required={required} value={values[name]||''} onChange={(event)=>setValues({...values,[name]:event.target.value})}><option value="">Select {label.toLowerCase()}</option>{(selectChoices||options(kind)).map((option)=><option key={Array.isArray(option)?option[0]:option} value={Array.isArray(option)?option[0]:option}>{Array.isArray(option)?option[1]:option}</option>)}</select>:kind==='textarea'?<textarea rows="3" value={values[name]||''} onChange={(event)=>setValues({...values,[name]:event.target.value})} placeholder={`Add ${label.toLowerCase()}…`}/>:<input type={kind||'text'} required={required} min={kind==='number'?0:undefined} value={values[name]??''} onChange={(event)=>setValues({...values,[name]:event.target.value})} placeholder={kind==='number'?'0':''}/>}</label>
}
const readFile=(file)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('File read failed'));reader.readAsDataURL(file)})
