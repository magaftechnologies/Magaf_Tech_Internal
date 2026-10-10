import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { checkApiConnection } from '../api/http'
import { clientProjects, currency, invoiceStatus, projectOutstanding, projectPaid } from '../utils/calculations'
import AccountSecurity from './AccountSecurity'
import { MessageCenter } from './ClientMessages'
import Icon from './Icon'

const navGroups=[
  {label:'WORK',items:[['My Projects','briefcase','projects'],['Project Requests','file','requests'],['Deliverables & Files','layers','deliverables']]},
  {label:'COMMUNICATION',items:[['Messages','message','messages'],['Notifications','bell','notifications']]},
  {label:'FINANCE',items:[['Payments & Billing','card','payments']]},
  {label:'SERVICES',items:[['MAGAF Services','sparkles','services']]},
  {label:'ACCOUNT',items:[['Profile','user','profile']]},
]
const dateText=(value)=>value?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'
const fileCategory=(file)=>file.type?.startsWith('video/')?'Video':file.type?.startsWith('audio/')?'Audio':file.type?.startsWith('image/')?'Image':file.type?.includes('pdf')?'Document':file.name?.toLowerCase().endsWith('.zip')?'Archive':'Requirement'

export default function ClientPortal(){
  const {user,logout}=useAuth()
  const {data,dashboard,error:apiError,addFile,addRevision,addProjectRequest,submitClientPayment,resubmitClientPayment,createPaymentDispute,setDeliverableStatus,ensureConversation,sendMessage,markConversationRead,addRequestInformation,updateClientProfile,markNotificationRead,markAllNotificationsRead}=useData()
  const client=data.clients.find((item)=>item.id===user.clientId)
  const [page,setPage]=useState('dashboard')
  const [projectId,setProjectId]=useState('')
  const [requestId,setRequestId]=useState('')
  const [projectTab,setProjectTab]=useState('Overview')
  const [conversationId,setConversationId]=useState('')
  const [requestService,setRequestService]=useState('')
  const [message,setMessage]=useState('')
  const [requestLog,setRequestLog]=useState([])
  const [backendCheckBusy,setBackendCheckBusy]=useState(false)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [requestForm,setRequestForm]=useState({serviceId:'',projectName:'',description:'',businessGoal:'',requirements:'',expectedDeliverables:'',estimatedBudget:'',desiredDeadline:'',priority:'Medium',technologyInformation:'',referenceLinks:'',clientNotes:''})
  const [requestFiles,setRequestFiles]=useState([])
  const [additionalText,setAdditionalText]=useState('')
  const [additionalFiles,setAdditionalFiles]=useState([])
  const [requestBusy,setRequestBusy]=useState(false)
  const [chatText,setChatText]=useState('')
  const [chatFiles,setChatFiles]=useState([])
  const [chatBusy,setChatBusy]=useState(false)
  const [projectFilter,setProjectFilter]=useState('All')
  const [revisionText,setRevisionText]=useState('')
  const [uploadFiles,setUploadFiles]=useState([])
  const [uploadLink,setUploadLink]=useState('')
  const [uploadDescription,setUploadDescription]=useState('')
  const [uploadBusy,setUploadBusy]=useState(false)
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [paymentDraft,setPaymentDraft]=useState({amount:'',paymentMethod:'upi',projectId:'',invoiceId:'',paymentAccountId:'',transactionId:'',files:[]})
  const [disputeDraft,setDisputeDraft]=useState(null)
  const [profileDraft,setProfileDraft]=useState(null)
  const [recording,setRecording]=useState(false)
  const [voiceFile,setVoiceFile]=useState(null)
  const [voicePreviewUrl,setVoicePreviewUrl]=useState('')
  const mediaRecorder=useRef(null)
  const recordingChunks=useRef([])
  const projects=client?clientProjects(data,client.id):[]
  const projectIds=new Set(projects.map((project)=>project.id))
  const requests=data.projectRequests.filter((request)=>request.clientId===client?.id)
  const requestIds=new Set(requests.map((request)=>request.id))
  const deals=data.deals.filter((deal)=>deal.clientId===client?.id)
  const payments=data.payments.filter((payment)=>payment.clientId===client?.id||projectIds.has(payment.projectId)||deals.some((deal)=>deal.id===payment.dealId))
  const invoices=data.invoices.filter((invoice)=>invoice.clientId===client?.id)
  const files=data.files.filter((file)=>(file.clientId===client?.id||projectIds.has(file.projectId)||requestIds.has(file.projectRequestId))&&file.visibility==='Client')
  const conversations=data.conversations.filter((conversation)=>conversation.clientId===client?.id)
  const clientMessages=data.messages.filter((item)=>conversations.some((conversation)=>conversation.id===item.conversationId))
  const unreadMessages=clientMessages.filter((item)=>item.senderRole==='TEAM'&&!(item.readReceipts||[]).some((receipt)=>receipt.userId===user.id)).length
  const notifications=data.notifications.filter((item)=>(item.clientId===client?.id||projectIds.has(item.projectId)||requestIds.has(item.recordId))&&item.recipientRole!=='TEAM')
  const unreadNotifications=notifications.filter((item)=>!(item.readBy||[]).some((receipt)=>receipt.userId===user.id)).length
  const unreadRequestUpdates=notifications.filter((item)=>item.type==='request'&&!(item.readBy||[]).some((receipt)=>receipt.userId===user.id)).length
  const selectedProject=projects.find((project)=>project.id===projectId)
  const selectedRequest=requests.find((request)=>request.id===requestId)
  const selectedConversation=conversations.find((item)=>item.id===conversationId)
  const activeMessages=selectedConversation?clientMessages.filter((item)=>item.conversationId===selectedConversation.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)):[]
  const projectService=(id)=>data.services.find((service)=>service.id===id)
  const projectDeal=(project)=>deals.find((deal)=>deal.id===project.dealId)||deals.find((deal)=>deal.projectId===project.id)
  const serviceOptions=data.services.filter((service)=>service.supportsRequests!==false&&service.status!=='Inactive')
  const portalActivity=data.activities.filter((item)=>item.clientId===client?.id||projectIds.has(item.projectId)||projectIds.has(item.recordId)||requestIds.has(item.recordId)).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')))
  const clientDeliverables=files.filter((file)=>file.category?.toLowerCase().includes('final')||['Final','Delivered','Approved'].includes(file.status)||file.type==='Link')
  const pendingRequests=requests.filter((request)=>!['Rejected','Cancelled','Converted to Project'].includes(request.status))
  const clientPaidAmount=dashboard?.payments?.paid||0
  const clientOutstandingAmount=dashboard?.payments?.outstanding||0
  const projectTabs=['Overview','Timeline','Requirements','Files','Deliverables','Payments','Messages','Activity']
  const navigate=(destination,options={})=>{
    setPage(destination)
    if(options.projectId)setProjectId(options.projectId)
    if(options.requestId)setRequestId(options.requestId)
    if(options.conversationId)setConversationId(options.conversationId)
    if(options.projectTab)setProjectTab(options.projectTab)
    setMobileOpen(false)
    setMessage('')
  }
  const startProjectConversation=async(project)=>{const conversation=await ensureConversation(client.id,project.id);if(conversation)navigate('messages',{conversationId:conversation.id})}
  const startRequestConversation=async(request)=>{const conversation=await ensureConversation(client.id,null,request.id);if(conversation)navigate('messages',{conversationId:conversation.id})}
  const startGeneralConversation=async()=>{const conversation=conversations[0]||await ensureConversation(client.id);if(conversation){setConversationId(conversation.id);navigate('messages',{conversationId:conversation.id})}}
  const updateRequestField=(field,value)=>setRequestForm((current)=>({...current,[field]:value}))
  const logRequestStep=(step,status,detail)=>setRequestLog((current)=>[
    ...current,
    {id:`${Date.now()}-${current.length}`,time:new Date().toLocaleTimeString(),step,status,detail},
  ].slice(-12))
  const describeApiError=(error)=>{
    const validationDetails=(error.errors||[]).map((item)=>[item.path||item.param,item.msg].filter(Boolean).join(': ')).filter(Boolean)
    return [error.message,...validationDetails].filter(Boolean).join(' — ')
  }
  const checkRequestBackend=async()=>{
    setBackendCheckBusy(true)
    logRequestStep('Backend check','pending','Checking backend, database, and client access…')
    try{
      const result=await checkApiConnection()
      logRequestStep('Backend check','success',`Backend reachable; database ${result.database}; client access verified.`)
    }catch(error){
      const status=error.status?` HTTP ${error.status}.`:''
      logRequestStep('Backend check','error',`${describeApiError(error)||'Backend check failed.'}${status}`)
    }finally{setBackendCheckBusy(false)}
  }
  const storeUploads=async(selectedFiles,linkText,association)=>{
    if(selectedFiles.length>10)throw new Error('Upload up to 10 files at a time.')
    const records=[]
    for(const file of selectedFiles){
      const record=await addFile({...association,rawFile:file,name:file.name,type:file.type||'File',category:fileCategory(file),description:'Client-provided project material',visibility:'Client'},{throwOnError:true})
      if(!record)throw new Error(apiError||'The selected file could not be uploaded.')
      records.push(record)
    }
    if(linkText.trim()){
      const urls=linkText.split(/\r?\n/).map((url)=>url.trim()).filter(Boolean)
      for(const url of urls){
        let parsed
        try{parsed=new URL(url)}catch{throw new Error(`Invalid link: ${url}`)}
        if(parsed.protocol!=='https:')throw new Error('Shared links must use HTTPS.')
        const record=await addFile({...association,name:parsed.hostname,type:'Link',category:'Reference',url,description:'Client-provided external reference',visibility:'Client'},{throwOnError:true})
        if(!record)throw new Error(apiError||'The link could not be shared.')
        records.push(record)
      }
    }
    return records
  }
  const submitRequest=async(event)=>{
    event.preventDefault()
    logRequestStep('Form validation','pending','Checking required fields and reference links…')
    const projectName=requestForm.projectName.trim()
    const description=requestForm.description.trim()
    if(!requestForm.serviceId||projectName.length<2){const detail='Choose a service and enter a project name with at least 2 characters.';logRequestStep('Form validation','error',detail);setMessage(detail);return}
    if(description.length<10){const detail='Project description must be at least 10 characters.';logRequestStep('Form validation','error',detail);setMessage(detail);return}
    if(description.length>10000){const detail='Project description must be 10,000 characters or fewer.';logRequestStep('Form validation','error',detail);setMessage(detail);return}
    const referenceLinks=requestForm.referenceLinks.split(/\r?\n/).map((value)=>value.trim()).filter(Boolean)
    for(const link of referenceLinks){
      let parsed
      try{parsed=new URL(link)}catch{const detail=`Enter a complete HTTPS URL for each reference link, or remove “${link}”.`;logRequestStep('Form validation','error',detail);setMessage(detail);return}
      if(parsed.protocol!=='https:'){const detail='Reference links must use HTTPS.';logRequestStep('Form validation','error',detail);setMessage(detail);return}
    }
    const uploads=[...requestFiles,...(voiceFile?[voiceFile]:[])]
    if(uploads.length>10){const detail='Upload up to 10 files with each request.';logRequestStep('Form validation','error',detail);setMessage(detail);return}
    logRequestStep('Form validation','success','Required fields and reference links look valid.')
    setRequestBusy(true)
    let savedRequest=null
    try{
      logRequestStep('Request API','pending','Sending project request to the backend…')
      savedRequest=await addProjectRequest({...requestForm,projectName,description,estimatedBudget:Number(requestForm.estimatedBudget||0),clientId:client.id})
      if(!savedRequest)throw new Error('The project request could not be submitted.')
      logRequestStep('Request API','success',`Backend saved the request (${savedRequest.id}).`)
      setRequestForm({serviceId:'',projectName:'',description:'',businessGoal:'',requirements:'',expectedDeliverables:'',estimatedBudget:'',desiredDeadline:'',priority:'Medium',technologyInformation:'',referenceLinks:'',clientNotes:''})
      setRequestFiles([])
      setVoiceFile(null)
      if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl)
      setVoicePreviewUrl('')
      setRequestService('')
      setRequestId(savedRequest.id)
      setPage('requests')
      if(uploads.length||referenceLinks.length)logRequestStep('Attachments','pending',`Uploading ${uploads.length} file(s) and ${referenceLinks.length} link(s)…`)
      await storeUploads(uploads,requestForm.referenceLinks,{clientId:client.id,projectRequestId:savedRequest.id})
      if(uploads.length||referenceLinks.length)logRequestStep('Attachments','success','All attachments were uploaded.')
      setMessage('Your project request and attachments were submitted.')
    }catch(error){
      console.error('Unable to submit project request.',error)
      logRequestStep(savedRequest?'Attachments':'Request API','error',`${describeApiError(error)||'Submission failed.'}${error.status?` HTTP ${error.status}.`:''}`)
      setMessage(savedRequest
        ? `Your request was saved, but its attachments could not all be uploaded. Open the saved request to add files later. ${error.message||''}`.trim()
        : error.message||'Could not submit this request. Please try again.')
    }
    finally{setRequestBusy(false)}
  }
  const addRequestInfo=async(event)=>{
    event.preventDefault()
    if(!selectedRequest)return
    if(!additionalText.trim()&&!additionalFiles.length){setMessage('Add a note or attach at least one file.');return}
    setRequestBusy(true)
    try{
      const records=await storeUploads(additionalFiles,'',{clientId:client.id,projectRequestId:selectedRequest.id})
      const saved=await addRequestInformation({requestId:selectedRequest.id,text:additionalText})
      if(!saved)throw new Error(apiError||'The additional information could not be saved.')
      setAdditionalFiles([])
      setAdditionalText('')
      setMessage(`Additional information shared${records.length?` with ${records.length} file${records.length===1?'':'s'}`:''}.`)
    }catch(error){console.error('Unable to add request information.',error);setMessage(error.message||'Could not add request information.')}
    finally{setRequestBusy(false)}
  }
  const sendChat=async(event)=>{
    event.preventDefault()
    if(!selectedConversation||(!chatText.trim()&&!chatFiles.length))return
    setChatBusy(true)
    try{
      const uploaded=await storeUploads(chatFiles,'',{clientId:client.id,projectId:selectedConversation.projectId||undefined,projectRequestId:selectedConversation.projectRequestId||undefined,conversationId:selectedConversation.id,category:'Reference'})
      const sent=await sendMessage({conversationId:selectedConversation.id,text:chatText,attachments:uploaded})
      if(!sent)throw new Error(apiError||'The message could not be sent.')
      setChatText('')
      setChatFiles([])
    }catch(error){console.error('Unable to send client message.',error);setMessage(error.message||'Could not send this message.')}
    finally{setChatBusy(false)}
  }
  const submitProjectFiles=async(event)=>{
    event.preventDefault()
    if(!selectedProject||(!uploadFiles.length&&!uploadLink.trim())){setMessage('Choose files or provide an external link.');return}
    setUploadBusy(true)
    try{
      const uploaded=await storeUploads(uploadFiles,uploadLink,{clientId:client.id,projectId:selectedProject.id,description:uploadDescription||'Client-shared project material'})
      setUploadFiles([]);setUploadLink('');setUploadDescription('')
      setMessage(`${uploaded.length} file${uploaded.length===1?'':'s'} shared with MAGAF.`)
    }catch(error){console.error('Unable to upload project materials.',error);setMessage(error.message||'Could not share these files.')}
    finally{setUploadBusy(false)}
  }
  const submitRevision=async(event)=>{
    event.preventDefault()
    if(!selectedProject||!revisionText.trim()){setMessage('Describe the revision you need.');return}
    const revision=await addRevision({projectId:selectedProject.id,clientId:client.id,description:revisionText.trim()})
    if(!revision){setMessage(apiError||'Your revision request could not be sent.');return}
    setRevisionText('')
    setMessage('Revision request sent to the MAGAF team.')
  }
  const submitPayment=async(event)=>{
    event.preventDefault()
    if(!Number(paymentDraft.amount)||Number(paymentDraft.amount)<=0){setMessage('Enter a payment amount greater than zero.');return}
    if(paymentDraft.paymentMethod!=='cash'&&!paymentDraft.files.length){setMessage('Upload payment proof for non-cash payments.');return}
    setPaymentBusy(true)
    try{
      const uploaded=await Promise.all(paymentDraft.files.map((file)=>addFile({rawFile:file,category:'payment_proof',projectId:paymentDraft.projectId||undefined,visibility:'Client'},{throwOnError:true})))
      const submission={
        amount:Number(paymentDraft.amount),
        paymentMethod:paymentDraft.paymentMethod,
        projectId:paymentDraft.projectId||undefined,
        invoiceId:paymentDraft.invoiceId||undefined,
        paymentAccountId:paymentDraft.paymentAccountId||undefined,
        transactionId:paymentDraft.transactionId.trim()||undefined,
        paymentDate:new Date().toISOString(),
        proofFiles:uploaded.map((file)=>file.id),
      }
      const result=paymentDraft.paymentId
        ?await resubmitClientPayment(paymentDraft.paymentId,submission)
        :await submitClientPayment(submission)
      const updating=Boolean(paymentDraft.paymentId)
      setPaymentDraft({amount:'',paymentMethod:'upi',projectId:'',invoiceId:'',paymentAccountId:'',transactionId:'',files:[]})
      setMessage(`Payment ${result.paymentCode||''} ${updating?'resubmitted':'submitted'}. MAGAF will review it before it affects your balance.`)
    }catch(error){setMessage(error.message||'Payment could not be submitted.')}
    finally{setPaymentBusy(false)}
  }
  const submitDispute=async(event)=>{
    event.preventDefault()
    if(!disputeDraft)return
    setPaymentBusy(true)
    try{
      const uploaded=await Promise.all(disputeDraft.files.map((file)=>addFile({rawFile:file,category:'payment_proof',visibility:'Client'},{throwOnError:true})))
      await createPaymentDispute(disputeDraft.paymentId,{
        claimedAmount:Number(disputeDraft.amount),
        reference:disputeDraft.reference.trim()||undefined,
        explanation:disputeDraft.explanation.trim(),
        proofFiles:uploaded.map((file)=>file.id),
      })
      setDisputeDraft(null)
      setMessage('Your payment issue was sent to the MAGAF finance team.')
    }catch(error){setMessage(error.message||'Your payment issue could not be submitted.')}
    finally{setPaymentBusy(false)}
  }
  const requestDeliverableChanges=async(file)=>{
    const feedback=window.prompt(`What would you like changed in "${file.name}"?`)
    if(!feedback?.trim())return
    const revision=await addRevision({projectId:file.projectId,clientId:client.id,description:`${file.name}: ${feedback.trim()}`})
    if(!revision){setMessage(apiError||'Your revision request could not be sent.');return}
    setMessage('Your revision request has been sent to the MAGAF team.')
  }
  const beginVoiceRecording=async()=>{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setMessage('Voice recording is not available in this browser. Choose an audio file instead.');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      const recorder=new MediaRecorder(stream)
      recordingChunks.current=[]
      recorder.ondataavailable=(event)=>{if(event.data.size)recordingChunks.current.push(event.data)}
      recorder.onstop=()=>{const blob=new Blob(recordingChunks.current,{type:recorder.mimeType||'audio/webm'});const file=new File([blob],`voice-requirement-${Date.now()}.webm`,{type:blob.type});setVoiceFile(file);setVoicePreviewUrl(URL.createObjectURL(blob));stream.getTracks().forEach((track)=>track.stop())}
      mediaRecorder.current=recorder
      recorder.start()
      setRecording(true)
      setMessage('Recording voice requirement. Select Stop when finished.')
    }catch(error){console.error('Unable to start voice recording.',error);setMessage('Microphone access was unavailable. You can attach an audio file instead.')}
  }
  const stopVoiceRecording=()=>{if(mediaRecorder.current?.state==='recording'){mediaRecorder.current.stop();setRecording(false);setMessage('Voice note ready to attach.')}}
  const openRequestForm=(serviceId='')=>{setRequestService(serviceId);setRequestForm((current)=>({...current,serviceId}));navigate('requests');setRequestId('')}
  const markNotification=(item)=>{markNotificationRead(item.id);if(item.conversationId)navigate('messages',{conversationId:item.conversationId});else if(item.type==='payment')navigate('payments');else if(item.type==='request')navigate('requests',{requestId:item.recordId});else if(item.projectId)navigate('project-detail',{projectId:item.projectId})}

  useEffect(()=>{
    if(page==='messages'&&selectedConversation)markConversationRead(selectedConversation.id)
  },[page,conversationId,clientMessages.length,selectedConversation,markConversationRead])
  useEffect(()=>()=>{if(mediaRecorder.current?.state==='recording')mediaRecorder.current.stop();if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl)},[voicePreviewUrl])

  const filteredProjects=projects.filter((project)=>{
    if(projectFilter==='All')return true
    if(projectFilter==='Active')return !['Completed','Cancelled'].includes(project.status)
    if(projectFilter==='In Progress')return ['In Progress','Development','Production','Testing'].includes(project.status)
    if(projectFilter==='Review')return ['Review','Client Review','Revision','Revision Requested'].includes(project.status)
    return project.status===projectFilter
  })
  const activePage=page==='project-detail'?'projects':page
  const welcomeName=(client?.contact||client?.name||'Client').split(' ')[0]
  if(!client)return <main className="portal-invalid"><section className="panel"><h1>Client profile unavailable</h1><p>Your account is not currently connected to a client record. Contact the MAGAF team for assistance.</p><button className="button button-primary" onClick={logout}>Return to sign in</button></section></main>

  return <div className={`client-app ${mobileOpen?'client-menu-open':''}`}>
    {mobileOpen&&<button className="client-scrim" aria-label="Close client navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside className="client-sidebar">
      <div className="client-brand"><span className="brand-mark">M<span>.</span></span><span><strong>MAGAF</strong><small>CLIENT PORTAL</small></span><button className="client-mobile-close" aria-label="Close menu" onClick={()=>setMobileOpen(false)}>×</button></div>
      <div className="client-workspace-card"><span className="avatar">{client.name.slice(0,1)}</span><span><strong>{client.name}</strong><small>Private client workspace</small></span></div>
      <nav className="client-nav" aria-label="Client portal navigation">
        <button className={`client-nav-link ${activePage==='dashboard'?'active':''}`} onClick={()=>navigate('dashboard')}><Icon name="grid" size={17}/>Dashboard</button>
        {navGroups.map((group)=><div className="client-nav-group" key={group.label}><span>{group.label}</span>{group.items.map(([label,icon,destination])=><button className={`client-nav-link ${activePage===destination?'active':''}`} key={destination} onClick={()=>navigate(destination)}><Icon name={icon} size={17}/>{label}{destination==='messages'&&unreadMessages>0&&<b className="client-nav-count">{unreadMessages}</b>}{destination==='requests'&&unreadRequestUpdates>0&&<b className="client-nav-count">{unreadRequestUpdates}</b>}{destination==='notifications'&&unreadNotifications>0&&<b className="client-nav-count">{unreadNotifications}</b>}</button>)}</div>)}
      </nav>
      <div className="client-sidebar-foot"><span><i/> SECURE PORTAL · Private client view</span><button onClick={logout}><Icon name="logout" size={16}/>Sign out</button></div>
    </aside>
    <main className="client-main">
      <header className="client-topbar"><button className="client-menu-toggle" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Icon name="menu"/></button><div><small>MAGAF CLIENT WORKSPACE</small><strong>{page==='project-detail'?selectedProject?.name||'Project workspace':page==='request-detail'?'Request details':pageTitle(activePage)}</strong></div><div className="client-topbar-right"><span><i/> Secure connection</span><button onClick={()=>navigate('notifications')} aria-label={`Notifications, ${unreadNotifications} unread`}><Icon name="bell" size={18}/>{unreadNotifications>0&&<b>{unreadNotifications}</b>}</button><button className="client-topbar-profile" onClick={()=>navigate('profile')}><span className="avatar">{welcomeName.slice(0,1)}</span><span>{welcomeName}</span></button></div></header>
      <div className="client-page-area">
        {message&&<div className="client-toast" role="status"><Icon name="check" size={15}/><span>{message}</span><button aria-label="Dismiss" onClick={()=>setMessage('')}>×</button></div>}
        {requestLog.length>0&&<section className="client-request-log" aria-label="Project request diagnostic log" aria-live="polite"><div><strong>Submission diagnostics</strong><button type="button" onClick={()=>setRequestLog([])}>Clear log</button></div><ol>{requestLog.map((entry)=><li key={entry.id} className={`status-${entry.status}`}><time>{entry.time}</time><strong>{entry.step}</strong><span>{entry.detail}</span></li>)}</ol></section>}
        {page==='dashboard'&&<section className="client-page-stack">
          <div className="client-welcome"><div><span className="eyebrow">YOUR MAGAF WORKSPACE</span><h1>Welcome, <em>{welcomeName}.</em></h1><p>Track project progress, share requirements and stay connected with your team.</p></div><button className="button button-primary" onClick={()=>openRequestForm()}><Icon name="plus" size={15}/>Request new project</button></div>
          <div className="client-stat-grid"><ClientStat icon="briefcase" label="Active projects" value={dashboard?.projects?.active??projects.filter((item)=>!['Completed','Cancelled'].includes(item.status)).length}/><ClientStat icon="check" label="Completed projects" value={dashboard?.projects?.completed??projects.filter((item)=>item.status==='Completed').length}/><ClientStat icon="file" label="Pending requests" value={dashboard?.requests?.pending??pendingRequests.length}/><ClientStat icon="card" label="Pending payments" value={currency(clientOutstandingAmount)}/><ClientStat icon="trend" label="Total paid" value={currency(clientPaidAmount)}/><ClientStat icon="wallet" label="Outstanding balance" value={currency(clientOutstandingAmount)}/></div>
          <div className="client-quick-actions"><button onClick={()=>openRequestForm()}><Icon name="plus" size={16}/>Request project</button><button onClick={()=>navigate('projects')}><Icon name="briefcase" size={16}/>View projects</button><button onClick={()=>navigate('payments')}><Icon name="card" size={16}/>View payments</button><button onClick={startGeneralConversation}><Icon name="message" size={16}/>Open messages{unreadMessages>0&&<b>{unreadMessages}</b>}</button></div>
          <div className="client-dashboard-grid"><section className="client-panel"><PanelTitle eyebrow="YOUR WORK" title="Recent projects" action="View all" onAction={()=>navigate('projects')}/>{projects.slice(0,4).map((project)=><ProjectRow key={project.id} project={project} service={projectService(project.serviceId)} onClick={()=>navigate('project-detail',{projectId:project.id})}/>)||null}{!projects.length&&<Empty text="Your projects will appear here once work begins."/>}</section>
            <section className="client-panel"><PanelTitle eyebrow="CONVERSATION" title="Latest messages" action="Open messages" onAction={()=>navigate('messages')}/>{conversations.slice().sort((a,b)=>String(b.lastMessageAt||'').localeCompare(String(a.lastMessageAt||''))).slice(0,3).map((conversation)=>{const project=projects.find((item)=>item.id===conversation.projectId);return <button className="client-activity-row" key={conversation.id} onClick={()=>navigate('messages',{conversationId:conversation.id})}><span className="client-list-icon"><Icon name="message" size={16}/></span><span><strong>{project?.name||'General conversation'}</strong><small>{conversation.lastMessage||'Start a conversation'}</small></span>{clientMessages.some((item)=>item.conversationId===conversation.id&&item.senderRole==='TEAM'&&!(item.readReceipts||[]).some((receipt)=>receipt.userId===user.id))&&<i className="client-unread-dot"/>}</button>})}{!conversations.length&&<Empty text="Messages from your MAGAF team will appear here."/>}</section>
            <section className="client-panel"><PanelTitle eyebrow="UP NEXT" title="Upcoming deadlines" action="View projects" onAction={()=>navigate('projects')}/>{projects.filter((item)=>item.deadline&&!['Completed','Cancelled'].includes(item.status)).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,4).map((project)=><div className="client-deadline-row" key={project.id}><span className="client-deadline-date">{new Date(`${project.deadline}T12:00:00`).toLocaleDateString('en-IN',{month:'short',day:'numeric'})}</span><span><strong>{project.name}</strong><small>{project.status} · {project.assignedTo||'MAGAF team'}</small></span></div>)}</section>
            <section className="client-panel"><PanelTitle eyebrow="RECENTLY SHARED" title="Deliverables" action="Browse files" onAction={()=>navigate('deliverables')}/>{clientDeliverables.slice(0,4).map((file)=><FileRow key={file.id} file={file} project={projects.find((item)=>item.id===file.projectId)} />)}{!clientDeliverables.length&&<Empty text="Shared deliverables will appear here."/>}</section>
          </div>
          <section className="client-panel"><PanelTitle eyebrow="RECENT ACTIVITY" title="Workspace updates" action="View activity" onAction={()=>navigate('notifications')}/><ActivityList items={portalActivity.slice(0,5)} data={data}/></section>
        </section>}
        {page==='projects'&&<section className="client-page-stack"><PageHeading eyebrow="WORK" title="My Projects" description="A clear view of your current and completed MAGAF work." action="Request a project" onAction={()=>openRequestForm()}/><div className="client-filter-bar">{['All','Active','In Progress','Review','Delivered','Completed','On Hold'].map((filter)=><button key={filter} className={projectFilter===filter?'selected':''} onClick={()=>setProjectFilter(filter)}>{filter}</button>)}<span>{filteredProjects.length} projects</span></div>{filteredProjects.length?<div className="client-project-grid">{filteredProjects.map((project)=><ProjectCard key={project.id} project={project} service={projectService(project.serviceId)} deal={projectDeal(project)} data={data} onClick={()=>navigate('project-detail',{projectId:project.id})}/>)}</div>:<Empty text="No projects match this filter."/>}</section>}
        {page==='project-detail'&&selectedProject&&<section className="client-page-stack"><button className="client-back" onClick={()=>navigate('projects')}>← Back to my projects</button><div className="client-project-hero"><span className="client-service-icon"><Icon name={projectService(selectedProject.serviceId)?.icon||'briefcase'} size={21}/></span><div><span className="eyebrow">PROJECT · {selectedProject.id.toUpperCase()}</span><h1>{selectedProject.name}</h1><p>{projectService(selectedProject.serviceId)?.shortName||'MAGAF service'} · Updated {dateText(selectedProject.updatedAt||selectedProject.createdAt)}</p></div><span className="client-status">{selectedProject.status}</span></div><div className="client-tabbar">{projectTabs.map((tab)=><button className={projectTab===tab?'active':''} key={tab} onClick={()=>{setProjectTab(tab);if(tab==='Messages')startProjectConversation(selectedProject)}}>{tab}</button>)}</div>
          {projectTab==='Overview'&&<div className="client-detail-grid"><section className="client-panel"><PanelTitle eyebrow="PROJECT OVERVIEW" title="Delivery details"/><InfoRow label="Project ID" value={selectedProject.id}/><InfoRow label="Service" value={projectService(selectedProject.serviceId)?.shortName}/><InfoRow label="Project status" value={selectedProject.status}/><InfoRow label="Deal status" value={projectDeal(selectedProject)?.status||'—'}/><InfoRow label="Payment status" value={selectedProject.paymentStatus||projectDeal(selectedProject)?.paymentStatus||'Pending'}/><InfoRow label="Start date" value={dateText(selectedProject.startDate)}/><InfoRow label="Deadline" value={dateText(selectedProject.deadline)}/><InfoRow label="Assigned team member" value={selectedProject.assignedTo||'MAGAF Team'}/><p className="client-description">{selectedProject.description||'No project description has been added.'}</p><Progress value={selectedProject.progress??0}/></section><section className="client-panel"><PanelTitle eyebrow="PROJECT FINANCIALS" title="Payment summary"/><InfoRow label="Agreed amount" value={currency(selectedProject.agreedAmount)}/><InfoRow label="Amount paid" value={currency(projectPaid(data,selectedProject))}/><InfoRow label="Balance" value={currency(projectOutstanding(data,selectedProject))}/><button className="button button-primary" onClick={()=>navigate('payments')}>View payment history</button><form className="client-revision-quick" onSubmit={submitRevision}><label className="field">Request a revision<textarea rows="2" value={revisionText} onChange={(event)=>setRevisionText(event.target.value)} placeholder="Tell us what should change…"/></label><button className="button button-outline button-small">Send revision request</button></form></section></div>}
          {projectTab==='Timeline'&&<section className="client-panel"><PanelTitle eyebrow="PROJECT HISTORY" title="Timeline"/><ActivityList items={projectTimeline(data,selectedProject,files,payments,clientMessages)} data={data}/></section>}
          {projectTab==='Requirements'&&<section className="client-panel"><PanelTitle eyebrow="PROJECT BRIEF" title="Requirements and scope"/><InfoRow label="Original request" value={selectedProject.requestId||selectedProject.sourceRequestId||'Manually created'}/><InfoRow label="Business goal" value={selectedProject.businessGoal||selectedProject.requestSnapshot?.businessGoal}/><InfoRow label="Requirements" value={selectedProject.requirements}/><InfoRow label="Expected deliverables" value={selectedProject.expectedDeliverables||selectedProject.requestSnapshot?.expectedDeliverables}/><InfoRow label="Technology information" value={selectedProject.technologyInformation||selectedProject.requestSnapshot?.technologyInformation}/><InfoRow label="Client notes" value={selectedProject.clientNotes||selectedProject.requestSnapshot?.clientNotes}/>{(selectedProject.referenceLinks||[]).split(/\r?\n/).filter(Boolean).map((url)=><a key={url} className="client-external-link" href={url} target="_blank" rel="noreferrer">{url}</a>)}</section>}
          {projectTab==='Files'&&<section className="client-page-stack"><FilesPanel files={files.filter((file)=>file.projectId===selectedProject.id)} onOpenMessage={()=>startProjectConversation(selectedProject)}/><section className="client-panel"><PanelTitle eyebrow="SHARE MATERIALS" title="Upload project files"/><form className="client-request-form" onSubmit={submitProjectFiles}><label className="field span-two">Select multiple files<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip,video/*,audio/*" onChange={(event)=>setUploadFiles(Array.from(event.target.files||[]))}/><small>Files are shared with the MAGAF team. Local demo limit: 1.5 MB per file.</small></label><label className="field">External / Google Drive URL<input type="url" value={uploadLink} onChange={(event)=>setUploadLink(event.target.value)} placeholder="https://drive.google.com/…"/></label><label className="field">Description<input value={uploadDescription} onChange={(event)=>setUploadDescription(event.target.value)} placeholder="Logo, requirements, reference video…"/></label><button className="button button-primary" disabled={uploadBusy}>{uploadBusy?'Sharing…':'Share project materials'}</button></form></section></section>}
          {projectTab==='Deliverables'&&<section className="client-panel"><PanelTitle eyebrow="FINAL WORK & APPROVALS" title="Deliverables"/><div className="client-file-grid">{files.filter((file)=>file.projectId===selectedProject.id&&(clientDeliverables.includes(file)||file.status)).map((file)=><div className="client-deliverable-card" key={file.id}><FileCard file={file}/>{!['Approved','Delivered'].includes(file.status)&&<div className="client-deliverable-actions"><button className="button button-primary button-small" onClick={()=>{setDeliverableStatus(file.id,'Approved');setMessage(`${file.name} approved.`)}}>Approve</button><button className="button button-outline button-small" onClick={()=>requestDeliverableChanges(file)}>Request changes</button></div>}</div>)}</div>{!files.some((file)=>file.projectId===selectedProject.id&&(clientDeliverables.includes(file)||file.status))&&<Empty text="No deliverables have been shared for this project yet."/>}</section>}
          {projectTab==='Payments'&&<PaymentsTable payments={payments.filter((item)=>item.projectId===selectedProject.id||(selectedProject.dealId&&item.dealId===selectedProject.dealId))} projects={projects} data={data}/>}
          {projectTab==='Messages'&&<section className="client-panel"><PanelTitle eyebrow="PROJECT CONVERSATION" title={selectedProject.name}/><button className="button button-primary" onClick={()=>startProjectConversation(selectedProject)}>Open project messages</button></section>}
          {projectTab==='Activity'&&<section className="client-page-stack"><section className="client-panel"><PanelTitle eyebrow="PROJECT HISTORY" title="Activity"/><ActivityList items={projectTimeline(data,selectedProject,files,payments,clientMessages)} data={data}/></section><section className="client-panel"><PanelTitle eyebrow="REVISION REQUESTS" title="Ask for a change"/><form className="client-request-form" onSubmit={submitRevision}><label className="field span-two">What would you like MAGAF to revise?<textarea rows="3" value={revisionText} onChange={(event)=>setRevisionText(event.target.value)} placeholder="Describe the change and which deliverable it affects."/></label><button className="button button-primary">Submit revision request</button></form>{data.revisions.filter((item)=>item.projectId===selectedProject.id&&item.clientVisible).map((item)=><div className="client-additional-note" key={item.id}><StatusPill>{item.status}</StatusPill><p>{item.description}</p><small>{dateText(item.date)}</small></div>)}</section></section>}
        </section>}
        {page==='requests'&&<section className="client-page-stack"><PageHeading eyebrow="WORK" title="Project Requests" description="Submit a brief, attach all your project materials, and follow every request from review through conversion." action="New request" onAction={()=>{setRequestId('');setRequestService('');document.getElementById('client-request-form')?.scrollIntoView({behavior:'smooth'})}}/>{requestId&&selectedRequest?<RequestDetail request={selectedRequest} files={files.filter((file)=>file.projectRequestId===selectedRequest.id)} data={data} setAdditionalText={setAdditionalText} additionalText={additionalText} setAdditionalFiles={setAdditionalFiles} submitAdditional={addRequestInfo} busy={requestBusy} openMessages={()=>startRequestConversation(selectedRequest)} openProject={()=>navigate('project-detail',{projectId:selectedRequest.convertedProjectId})} back={()=>setRequestId('')}/>:<><div className="client-request-grid"><section className="client-panel"><PanelTitle eyebrow="REQUEST HISTORY" title="Your requests"/>{requests.length?requests.map((request)=><button className="client-request-row" key={request.id} onClick={()=>setRequestId(request.id)}><span><strong>{request.projectName}</strong><small>{projectService(request.serviceId)?.shortName} · Submitted {dateText(request.submittedAt||request.createdAt)}</small></span><span className="client-status">{request.status}</span><small>{files.filter((file)=>file.projectRequestId===request.id).length} attachments</small></button>):<Empty text="You have not submitted a project request yet."/>}</section>
            <section className="client-panel"><PanelTitle eyebrow="HOW IT WORKS" title="From request to delivery"/><div className="client-steps">{['Share your brief','MAGAF reviews scope','Agree on pricing','Project workspace opens'].map((item,index)=><div key={item}><span>{index+1}</span><strong>{item}</strong></div>)}</div><p className="client-muted">Submitted requests are visible to your MAGAF team in the shared workspace. You can add information or message the team at any time.</p></section></div>
            <section className="client-panel" id="client-request-form"><PanelTitle eyebrow="PROJECT BRIEF" title="Create a request"/><form className="client-request-form" onSubmit={submitRequest}>
              <label className="field">Project name<input required value={requestForm.projectName} onChange={(event)=>updateRequestField('projectName',event.target.value)} placeholder="e.g. Online store for our new collection"/></label>
              <label className="field">Requested service<select required value={requestForm.serviceId||requestService} onChange={(event)=>updateRequestField('serviceId',event.target.value)}><option value="">Choose a MAGAF service</option>{serviceOptions.map((service)=><option key={service.id} value={service.id}>{service.shortName||service.name}</option>)}</select></label>
              <label className="field span-two">Project description<textarea required rows="3" value={requestForm.description} onChange={(event)=>updateRequestField('description',event.target.value)} placeholder="Describe the work you have in mind."/></label>
              <label className="field">Business / project goal<textarea rows="2" value={requestForm.businessGoal} onChange={(event)=>updateRequestField('businessGoal',event.target.value)} placeholder="What should this help you achieve?"/></label>
              <label className="field">Requirements<textarea rows="2" value={requestForm.requirements} onChange={(event)=>updateRequestField('requirements',event.target.value)} placeholder="Features, constraints, existing materials…"/></label>
              <label className="field">Expected deliverables<textarea rows="2" value={requestForm.expectedDeliverables} onChange={(event)=>updateRequestField('expectedDeliverables',event.target.value)} placeholder="What should MAGAF hand over?"/></label>
              <label className="field">Existing technology / special requirements<textarea rows="2" value={requestForm.technologyInformation} onChange={(event)=>updateRequestField('technologyInformation',event.target.value)}/></label>
              <label className="field">Preferred deadline<input type="date" value={requestForm.desiredDeadline} onChange={(event)=>updateRequestField('desiredDeadline',event.target.value)}/></label>
              <label className="field">Estimated budget (₹)<input type="number" min="0" value={requestForm.estimatedBudget} onChange={(event)=>updateRequestField('estimatedBudget',event.target.value)}/></label>
              <label className="field">Priority<select value={requestForm.priority} onChange={(event)=>updateRequestField('priority',event.target.value)}>{['Low','Medium','High','Urgent'].map((priority)=><option key={priority}>{priority}</option>)}</select></label>
              <label className="field">Additional notes<textarea rows="2" value={requestForm.clientNotes} onChange={(event)=>updateRequestField('clientNotes',event.target.value)}/></label>
              <label className="field span-two">Reference links<textarea rows="2" value={requestForm.referenceLinks} onChange={(event)=>updateRequestField('referenceLinks',event.target.value)} placeholder="Full HTTPS URL, one per line — Drive, Figma, GitHub, YouTube…"/><small>Each link must start with https://. Leave blank if you have no reference links.</small></label>
              <label className="field span-two">Images, PDFs, documents, video or audio<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip,video/*,audio/*" onChange={(event)=>setRequestFiles(Array.from(event.target.files||[]))}/><small>Attach up to 10 files. File uploads require MAGAF’s file storage service to be configured.</small></label>
              {requestFiles.length>0&&<div className="client-selected-files span-two">{requestFiles.map((file)=><span key={`${file.name}-${file.lastModified}`}>{file.name} · {formatSize(file.size)}</span>)}</div>}
              <div className="client-voice-box span-two"><div><strong>Voice explanation</strong><small>Record a short audio requirement or attach an audio file above.</small></div>{recording?<button type="button" className="button button-danger" onClick={stopVoiceRecording}>Stop recording</button>:<button type="button" className="button button-outline" onClick={beginVoiceRecording}><Icon name="mic" size={15}/>Record voice note</button>}{voiceFile&&<div className="voice-preview"><audio controls src={voicePreviewUrl}/><span>{voiceFile.name}</span><button type="button" onClick={()=>{setVoiceFile(null);URL.revokeObjectURL(voicePreviewUrl);setVoicePreviewUrl('')}}>Remove</button></div>}</div>
              <div className="client-request-form-actions span-two"><button className="button button-outline" type="button" disabled={backendCheckBusy||requestBusy} onClick={checkRequestBackend}>{backendCheckBusy?'Checking backend…':'Test backend connection'}</button><button className="button button-primary" disabled={requestBusy}>{requestBusy?'Submitting…':'Submit project request'}<Icon name="arrow" size={15}/></button></div>
            </form></section></>}</section>}
        {page==='request-detail'&&selectedRequest&&<RequestDetail request={selectedRequest} files={files.filter((file)=>file.projectRequestId===selectedRequest.id)} data={data} setAdditionalText={setAdditionalText} additionalText={additionalText} setAdditionalFiles={setAdditionalFiles} submitAdditional={addRequestInfo} busy={requestBusy} openMessages={()=>startRequestConversation(selectedRequest)} openProject={()=>navigate('project-detail',{projectId:selectedRequest.convertedProjectId})} back={()=>navigate('requests')}/>}
        {page==='messages'&&<section className="client-page-stack"><PageHeading eyebrow="COMMUNICATION" title="Messages" description="Project-specific and general conversations with your MAGAF team."/><MessageCenter client={client} conversations={conversations} messages={clientMessages} projects={projects} requests={requests} selectedConversation={selectedConversation} activeMessages={activeMessages} setConversation={(conversation)=>{setConversationId(conversation.id);markConversationRead(conversation.id)}} text={chatText} setText={setChatText} files={chatFiles} setFiles={setChatFiles} send={sendChat} busy={chatBusy} startGeneral={startGeneralConversation} user={user}/></section>}
        {page==='notifications'&&<section className="client-page-stack"><PageHeading eyebrow="COMMUNICATION" title="Activity & Notifications" description="Updates related to your projects, requests, messages, files and payments." action="Mark all read" onAction={markAllNotificationsRead}/><section className="client-panel"><PanelTitle eyebrow="YOUR WORKSPACE" title="Recent updates"/>{notifications.slice().sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||''))).map((item)=><button className={`client-notification ${item.readBy?.some((receipt)=>receipt.userId===user.id)?'read':''}`} key={item.id} onClick={()=>markNotification(item)}><span className="client-list-icon"><Icon name={item.type==='payment'?'card':item.type==='message'?'message':item.type==='request'?'file':'bell'} size={16}/></span><span><strong>{item.title}</strong><small>{item.detail} · {item.time||dateText(item.timestamp)}</small></span>{!item.readBy?.some((receipt)=>receipt.userId===user.id)&&<i className="client-unread-dot"/>}</button>)}
            <h2 className="client-subheading">Activity history</h2><ActivityList items={portalActivity} data={data}/></section></section>}
        {page==='payments'&&<section className="client-page-stack"><PageHeading eyebrow="FINANCE" title="Payments & Billing" description="Review your project agreements, submit payment details and track finance updates."/><div className="client-stat-grid client-finance-stats"><ClientStat icon="chart" label="Total project amount" value={currency(clientPaidAmount+clientOutstandingAmount)}/><ClientStat icon="trend" label="Total paid" value={currency(clientPaidAmount)}/><ClientStat icon="card" label="Total pending" value={currency(clientOutstandingAmount)}/></div><section className="client-panel"><PanelTitle eyebrow="PAYMENT SUBMISSION" title={paymentDraft.paymentId?'Update payment evidence':'Report a payment'}/><p>Submit a transaction reference or proof for MAGAF to review. A submission does not change your balance until the team verifies it.</p><form className="client-request-form" onSubmit={submitPayment}><label className="field">Pay to account<select value={paymentDraft.paymentAccountId} onChange={(event)=>setPaymentDraft({...paymentDraft,paymentAccountId:event.target.value})}><option value="">Not specified</option>{(data.paymentAccounts||[]).filter((account)=>account.method===paymentDraft.paymentMethod||account.method==="other").map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="field">Amount (INR)<input required type="number" min="0.01" step="0.01" value={paymentDraft.amount} onChange={(event)=>setPaymentDraft({...paymentDraft,amount:event.target.value})}/></label><label className="field">Payment method<select value={paymentDraft.paymentMethod} onChange={(event)=>setPaymentDraft({...paymentDraft,paymentMethod:event.target.value})}>{[['upi','UPI'],['bank_transfer','Bank transfer'],['cash','Cash'],['card','Card'],['online','Online'],['other','Other']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="field">Project (optional)<select value={paymentDraft.projectId} onChange={(event)=>setPaymentDraft({...paymentDraft,projectId:event.target.value,invoiceId:''})}><option value="">Choose project</option>{projects.map((project)=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label className="field">Invoice (optional)<select value={paymentDraft.invoiceId} onChange={(event)=>setPaymentDraft({...paymentDraft,invoiceId:event.target.value})}><option value="">Choose invoice</option>{invoices.filter((invoice)=>!paymentDraft.projectId||invoice.projectId===paymentDraft.projectId).map((invoice)=><option value={invoice.id} key={invoice.id}>{invoice.invoiceNumber} · {currency(invoice.amount)}</option>)}</select></label><label className="field span-two">Transaction reference<input value={paymentDraft.transactionId} onChange={(event)=>setPaymentDraft({...paymentDraft,transactionId:event.target.value})} maxLength="160" placeholder="UPI reference, bank transaction ID, etc."/></label><label className="field span-two">Payment proof<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip" onChange={(event)=>setPaymentDraft({...paymentDraft,files:Array.from(event.target.files||[]).slice(0,5)})}/><small>Up to 5 files. Upload requires MAGAF file storage to be configured.</small></label>{paymentDraft.files.length>0&&<div className="client-selected-files span-two">{paymentDraft.files.map((file)=><span key={`${file.name}-${file.lastModified}`}>{file.name} · {formatSize(file.size)}</span>)}</div>}<div className="client-request-form-actions span-two"><button className="button button-primary" disabled={paymentBusy}>{paymentBusy?'Submitting…':paymentDraft.paymentId?'Resubmit for verification':'Submit for verification'}<Icon name="arrow" size={15}/></button>{paymentDraft.paymentId&&<button className="button button-outline" type="button" onClick={()=>setPaymentDraft({amount:'',paymentMethod:'upi',projectId:'',invoiceId:'',paymentAccountId:'',transactionId:'',files:[]})}>Cancel update</button>}</div></form></section><div className="client-detail-grid"><section className="client-panel"><PanelTitle eyebrow="TRANSACTION HISTORY" title="Payments"/><PaymentsTable payments={payments} projects={projects} data={data} onCorrection={(payment)=>setPaymentDraft({paymentId:payment.id,amount:String(payment.amount),paymentMethod:payment.paymentMethod||'upi',projectId:payment.projectId||'',invoiceId:payment.invoiceId||'',paymentAccountId:payment.paymentAccountId||'',transactionId:payment.transactionId||'',files:[]})} onDispute={(payment)=>setDisputeDraft({paymentId:payment.id,amount:String(payment.amount),reference:'',explanation:'',files:[]})}/>{disputeDraft&&<form className="client-request-form" onSubmit={submitDispute}><h3 className="span-two">Report an issue with this payment</h3><label className="field">Amount you paid (INR)<input required type="number" min="0" step="0.01" value={disputeDraft.amount} onChange={(event)=>setDisputeDraft({...disputeDraft,amount:event.target.value})}/></label><label className="field">Your transaction reference<input value={disputeDraft.reference} maxLength="160" onChange={(event)=>setDisputeDraft({...disputeDraft,reference:event.target.value})}/></label><label className="field span-two">Explain the issue<textarea required minLength="10" maxLength="4000" rows="3" value={disputeDraft.explanation} onChange={(event)=>setDisputeDraft({...disputeDraft,explanation:event.target.value})} placeholder="Describe what you paid and what needs to be corrected."/></label><label className="field span-two">Supporting proof<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip" onChange={(event)=>setDisputeDraft({...disputeDraft,files:Array.from(event.target.files||[]).slice(0,5)})}/></label><div className="client-request-form-actions span-two"><button className="button button-outline" type="button" onClick={()=>setDisputeDraft(null)}>Cancel</button><button className="button button-primary" disabled={paymentBusy}>{paymentBusy?'Sending…':'Send payment issue'}</button></div></form>}</section><section className="client-panel client-demo-pay-panel"><PanelTitle eyebrow="PAYMENT STATUS" title="Invoices & review"/><p>Online payment processing is not connected. Report a payment above; your outstanding balance changes after MAGAF verifies the submission.</p>{invoices.map((invoice)=><div className="client-invoice-row" key={invoice.id}><span><strong>{invoice.invoiceNumber}</strong><small>Due {dateText(invoice.dueDate)}</small></span><span>{currency(invoice.amount)} · {invoiceStatus(data,invoice)}</span></div>)}</section></div></section>}
        {page==='deliverables'&&<section className="client-page-stack"><PageHeading eyebrow="YOUR FILES" title="Deliverables & Files" description="Find final work, shared documents, approved assets and project links in one place."/><div className="client-file-grid">{files.slice().sort((a,b)=>String(b.uploadedAt||'').localeCompare(String(a.uploadedAt||''))).map((file)=><FileCard file={file} project={projects.find((item)=>item.id===file.projectId)} key={file.id}/>)}</div>{!files.length&&<Empty text="Files shared with you will appear here."/>}</section>}
        {page==='services'&&<section className="client-page-stack"><PageHeading eyebrow="MAGAF TECHNOLOGIES" title="Services" description="Explore MAGAF's service capabilities and start a request when you are ready."/><div className="client-service-grid">{serviceOptions.map((service)=><article className="client-service-card" key={service.id}><span className="client-service-icon"><Icon name={service.icon||'layers'} size={20}/></span><span className="eyebrow">{service.category}</span><h2>{service.shortName||service.name}</h2><p>{service.description}</p><ul>{(service.offerings||[]).slice(0,5).map((offering)=><li key={offering}>{offering}</li>)}</ul><button className="button button-outline" onClick={()=>openRequestForm(service.id)}>Request this service <Icon name="arrow" size={14}/></button></article>)}</div></section>}
        {page==='profile'&&<section className="client-page-stack"><PageHeading eyebrow="ACCOUNT" title="Profile" description="Review your client profile and update contact details."/><section className="client-panel client-profile-panel"><div className="client-profile-heading"><span className="avatar">{client.name.slice(0,1)}</span><span><strong>{client.name}</strong><small>Client since {dateText(client.createdAt)}</small></span></div><form className="client-profile-form" onSubmit={async(event)=>{event.preventDefault();const draft=profileDraft||client;const changes=Object.fromEntries(['contact','phone','whatsapp','address','city','state','country','website'].map((key)=>[key,draft[key]||'']));const updated=await updateClientProfile(changes);setMessage(updated?'Your contact profile has been updated.':apiError||'Your contact profile could not be updated.')}}>{[['name','Company / client name',true],['contact','Contact person'],['email','Email','email'],['phone','Phone','tel'],['address','Address'],['city','City'],['state','State'],['country','Country'],['website','Website','url'],['category','Industry',true]].map(([key,label,type])=><label className="field" key={key}>{label}<input value={(profileDraft||client)[key]||''} type={type===true?'text':type||'text'} disabled={type===true||key==='email'} onChange={(event)=>setProfileDraft({...(profileDraft||client),[key]:event.target.value})}/></label>)}<button className="button button-primary">Save contact details</button></form><p className="client-muted">Company name, industry and login email are managed by the MAGAF team. Internal notes and other client records are not editable here.</p></section><AccountSecurity/></section>}
      </div>
      <footer className="client-footer"><span>MAGAF Technologies · Client workspace</span><span>Securely synced with the MAGAF backend</span></footer>
    </main>
  </div>
}

function pageTitle(page){return({dashboard:'Dashboard',projects:'My Projects',requests:'Project Requests','project-detail':'Project Workspace','request-detail':'Project Request',messages:'Messages',notifications:'Activity & Notifications',payments:'Payments & Billing',deliverables:'Deliverables & Files',services:'MAGAF Services',profile:'Profile'})[page]||'Dashboard'}
function formatSize(size){return size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(0)} KB`:`${(size/1048576).toFixed(1)} MB`}
function ClientStat({icon,label,value}){return <article className="client-stat"><span><Icon name={icon} size={17}/></span><small>{label}</small><strong>{value}</strong></article>}
function PanelTitle({eyebrow,title,action,onAction}){return <div className="client-panel-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action&&<button onClick={onAction}>{action} <Icon name="arrow" size={13}/></button>}</div>}
function PageHeading({eyebrow,title,description,action,onAction}){
  return <div className="client-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action&&<button className="button button-primary" onClick={onAction}>{action==='Mark all read'?null:<Icon name="plus" size={14} />}{action}</button>}</div>
}
function Empty({text}){return <div className="client-empty"><span><Icon name="layers" size={20}/></span><p>{text}</p></div>}
function StatusPill({children}){return <span className={`client-status status-${String(children||'pending').toLowerCase().replaceAll(' ','-')}`}>{children||'Pending'}</span>}
function ProjectRow({project,service,onClick}){return <button className="client-project-row" onClick={onClick}><span className="client-list-icon"><Icon name={service?.icon||'briefcase'} size={16}/></span><span><strong>{project.name}</strong><small>{service?.shortName||'MAGAF service'} · Due {project.deadline||'To be confirmed'}</small></span><StatusPill>{project.status}</StatusPill><Icon name="chevron" size={15}/></button>}
function ProjectCard({project,service,deal,data,onClick}){const paid=projectPaid(data,project);return <button className="client-project-card" onClick={onClick}><div className="client-project-card-head"><span className="client-service-icon"><Icon name={service?.icon||'briefcase'} size={18}/></span><StatusPill>{project.status}</StatusPill></div><span className="eyebrow">{project.id.toUpperCase()}</span><h2>{project.name}</h2><p>{service?.shortName||'MAGAF service'} · Updated {dateText(project.updatedAt||project.createdAt)}</p><div className="client-project-card-facts"><span>Deal<strong>{deal?.status||'—'}</strong></span><span>Payment<strong>{project.paymentStatus||deal?.paymentStatus||'Pending'}</strong></span><span>Deadline<strong>{dateText(project.deadline)}</strong></span></div><div className="client-card-progress"><span><i style={{width:`${Math.max(0,Math.min(100,project.progress||0))}%`}}/></span><small>{project.progress||0}% complete</small></div><div className="client-card-financial"><span>Agreed <strong>{currency(project.agreedAmount)}</strong></span><span>Paid <strong>{currency(paid)}</strong></span><span>Balance <strong>{currency(projectOutstanding(data,project))}</strong></span></div><div className="client-project-card-foot"><span>Assigned to {project.assignedTo||'MAGAF Team'}</span><span>Open workspace →</span></div></button>}
function Progress({value}){return <div className="client-progress"><div><span>Project progress</span><b>{value}%</b></div><i><span style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></i></div>}
function InfoRow({label,value}){return <div className="client-info-row"><span>{label}</span><strong>{value||'—'}</strong></div>}
function FileRow({file,project}){return <a className="client-activity-row client-file-row" href={file.fileData||file.url||'#'} target="_blank" rel="noreferrer" download={file.fileData?file.name:undefined}><span className="client-list-icon"><Icon name={file.type?.includes('Video')?'sparkles':'file'} size={16}/></span><span><strong>{file.name}</strong><small>{project?.name||file.category} · {dateText(file.uploadedAt)}</small></span><Icon name="arrow" size={14}/></a>}
function FileCard({file,project}){
  const url=file.fileData||file.url
  const mime=String(file.type||'').toLowerCase()
  const isAudio=mime.startsWith('audio/')||mime==='audio'
  const isVideo=mime.startsWith('video/')||mime==='video'
  const isImage=mime.startsWith('image/')||mime==='image'
  return <article className="client-file-card"><span className="client-file-type"><Icon name={isVideo?'sparkles':isAudio?'mic':isImage?'image':'file'} size={19}/></span><span className="eyebrow">{file.category||file.type||'FILE'}</span><h2>{file.name}</h2><p>{project?.name||'Shared with your account'}</p><small>{dateText(file.uploadedAt)} · {file.size?formatSize(file.size):'External resource'}</small>{isAudio&&url&&<audio className="client-media-preview" controls src={url} />}{isVideo&&url&&<video className="client-media-preview" controls src={url} />}{isImage&&url&&<img className="client-image-preview" src={url} alt={file.name} />}{file.description&&<p>{file.description}</p>}<a className="button button-outline" href={url||'#'} target="_blank" rel="noreferrer" download={file.fileData?file.name:undefined}>{file.url?'Open / download':'Preview file'} <Icon name="arrow" size={14}/></a></article>
}
function FilesPanel({files,onOpenMessage}){return <section className="client-panel"><PanelTitle eyebrow="PROJECT FILES" title="Shared files"/><div className="client-file-grid">{files.map((file)=><FileCard key={file.id} file={file}/>)}</div>{!files.length&&<Empty text="No client-visible files have been shared for this project yet."/>}<button className="button button-outline" onClick={onOpenMessage}>Ask a question about these files</button></section>}
function PaymentsTable({payments,projects,data,onDispute,onCorrection}){
 return <>{(data.paymentAccounts||[]).length>0&&<section className="client-payment-instructions"><div><span className="eyebrow">PAY MAGAF</span><h3>Official payment methods</h3></div>{data.paymentAccounts.map((account)=><article key={account.id}><strong>{account.name}</strong><span>{account.method==='upi'?`UPI · ${account.upiId||'—'}`:account.method==='bank_transfer'?`${account.bankName||'Bank transfer'} · ${account.accountHolder||''}`:account.method}</span>{account.accountNumber&&<small>Account: {account.accountNumber} · IFSC: {account.ifscCode||'—'}</small>}{account.instructions&&<p>{account.instructions}</p>}</article>)}</section>}
 {payments.length?<div className="client-table-wrap"><table><thead><tr><th>Project</th><th>Transaction</th><th>Amount</th><th>Date</th><th>Method</th><th>Status / action</th></tr></thead><tbody>{payments.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map((payment)=>{const openDispute=(payment.disputes||[]).some((dispute)=>['Open','Information Requested'].includes(dispute.status));return <tr key={payment.id}><td>{projects.find((project)=>project.id===payment.projectId)?.name||data.deals.find((deal)=>deal.id===payment.dealId)?.title||'Project payment'}</td><td>{payment.reference||payment.id}</td><td>{currency(payment.amount)}</td><td>{dateText(payment.date)}</td><td>{payment.method||'—'}</td><td><StatusPill>{payment.status||'Paid'}</StatusPill>{payment.verificationStatus&&<small className="client-payment-review-status">{payment.verificationStatus}</small>}{payment.verificationNote&&<small className="client-payment-review-status">MAGAF note: {payment.verificationNote}</small>}{(payment.disputes||[]).slice().reverse().map((dispute)=><small className="client-payment-review-status" key={dispute.id}>Issue: {dispute.status}{dispute.response?` · ${dispute.response}`:''}</small>)}{onCorrection&&payment.paymentSource==='client_portal'&&payment.status==='Correction Requested'&&<button className="client-payment-dispute-action" onClick={()=>onCorrection(payment)}>Update submission</button>}{onDispute&&['Paid','Partially Paid','Rejected'].includes(payment.status)&&!openDispute&&<button className="client-payment-dispute-action" onClick={()=>onDispute(payment)}>Report an issue</button>}</td></tr>})}</tbody></table></div>:<Empty text="No payments have been recorded for your account yet."/>}</>
}
function ActivityList({items,data}){return items.length?<div className="client-activity-list">{items.map((item)=><div className="client-activity-item" key={item.id}><span className="client-activity-dot"/><span><strong>{item.title||item.type}</strong><small>{item.detail||data.projects.find((project)=>project.id===item.projectId)?.name||''}</small></span><time>{item.timestamp?new Date(item.timestamp).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):dateText(item.date)}</time></div>)}</div>:<Empty text="No activity has been recorded yet."/>}
function projectTimeline(data,project,files,payments,messages){
  const events=[
    ...data.activities.filter((item)=>item.recordId===project.id||item.projectId===project.id).map((item)=>({id:item.id,title:item.title,detail:item.detail,timestamp:item.timestamp})),
    ...(data.milestones||[]).filter((item)=>item.projectId===project.id).map((item)=>({id:`timeline-${item.id}`,title:item.status==='Completed'?'Milestone completed':'Milestone scheduled',detail:item.name,timestamp:item.completedAt||item.dueDate})),
    ...files.filter((item)=>item.projectId===project.id).map((item)=>({id:`timeline-${item.id}`,title:item.uploadedBy==='Client'?'Client shared a file':'File shared with you',detail:item.name,timestamp:item.uploadedAt})),
    ...payments.filter((item)=>item.projectId===project.id||item.dealId===project.dealId).map((item)=>({id:`timeline-${item.id}`,title:'Payment recorded',detail:`${currency(item.amount)} · ${item.method||'Payment'}`,timestamp:item.date})),
    ...messages.filter((item)=>item.projectId===project.id).map((item)=>({id:`timeline-${item.id}`,title:item.senderRole==='CLIENT'?'You sent a message':'MAGAF team message',detail:item.text||'Attachment shared',timestamp:item.createdAt})),
    ...(data.messageReads||[]).filter((item)=>item.projectId===project.id&&item.role==='TEAM').map((item)=>({id:`timeline-${item.id}`,title:'MAGAF team viewed a message',detail:'Message read receipt recorded',timestamp:item.readAt})),
  ]
  return events.sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||''))).slice(0,30)
}
function RequestDetail({request,files,data,setAdditionalText,additionalText,setAdditionalFiles,submitAdditional,busy,openMessages,openProject,back}){
  const service=data.services.find((item)=>item.id===request.serviceId)
  return <section className="client-page-stack"><button className="client-back" onClick={back}>← Back to requests</button><section className="client-panel"><div className="client-request-detail-head"><div><span className="eyebrow">REQUEST · {request.id.toUpperCase()}</span><h1>{request.projectName}</h1><p>{service?.shortName||'MAGAF service'} · Submitted {dateText(request.submittedAt||request.createdAt)}</p></div><StatusPill>{request.status}</StatusPill></div><div className="client-info-grid"><InfoRow label="Description" value={request.description}/><InfoRow label="Business goal" value={request.businessGoal||request.problemStatement}/><InfoRow label="Requirements" value={request.requirements}/><InfoRow label="Expected deliverables" value={request.expectedDeliverables}/><InfoRow label="Estimated budget" value={currency(request.estimatedBudget)}/><InfoRow label="Preferred deadline" value={dateText(request.desiredDeadline)}/><InfoRow label="Priority" value={request.priority}/><InfoRow label="Technology information" value={request.technologyInformation}/><InfoRow label="Team update" value={request.informationRequested}/></div>{request.clientAdditionalInfo?.map((entry)=><div className="client-additional-note" key={entry.id}><small>Additional information · {dateText(entry.createdAt)}</small><p>{entry.text}</p></div>)}<div className="client-file-grid">{files.map((file)=><FileCard key={file.id} file={file}/>)}</div><div className="client-request-detail-actions"><button className="button button-outline" onClick={openMessages}><Icon name="message" size={15}/>Message MAGAF about this request</button>{request.convertedProjectId&&<button className="button button-primary" onClick={openProject}><Icon name="briefcase" size={15}/>Open converted project</button>}</div></section>{request.status!=='Rejected'&&request.status!=='Cancelled'&&request.status!=='Converted to Project'&&<section className="client-panel"><PanelTitle eyebrow="REQUEST FOLLOW-UP" title="Add information or files"/><form className="client-request-form" onSubmit={submitAdditional}><label className="field span-two">Additional details<textarea rows="3" value={additionalText} onChange={(event)=>setAdditionalText(event.target.value)} placeholder="Add the information requested or clarify your brief."/></label><label className="field span-two">Upload more reference files<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip,video/*,audio/*" onChange={(event)=>setAdditionalFiles(Array.from(event.target.files||[]))}/></label><button className="button button-primary" disabled={busy}>Share additional information</button></form></section>}</section>
}
