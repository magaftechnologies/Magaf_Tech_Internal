import { createContext, useContext, useEffect, useState } from 'react'
import { initialData } from '../data/mockData'
import { dealPaid, invoicePaid, invoiceStatus, paymentValue, projectPaid } from '../utils/calculations'
import { enrichServices } from '../services/serviceRegistry'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)
const STORAGE_KEY = 'magaf-os-data-v1'
const id = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const readData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialData
    const persisted = JSON.parse(saved)
    const shouldMigrate=Number(persisted.schemaVersion||0)<initialData.schemaVersion
    const savedStudents=persisted.students||initialData.students
    const migratedStudents=shouldMigrate?[
      ...initialData.students.map((student)=>({...student,...savedStudents.find((item)=>item.id===student.id)})),
      ...savedStudents.filter((student)=>!initialData.students.some((seed)=>seed.id===student.id)),
    ]:savedStudents
    return {
      ...initialData,
      ...persisted,
      schemaVersion:initialData.schemaVersion,
      services: enrichServices(persisted.services ? [...persisted.services, ...initialData.services.filter((service) => !persisted.services.some((item) => item.id === service.id))] : initialData.services),
      invoices: persisted.invoices || initialData.invoices,
      targets:{...initialData.targets,...persisted.targets},
      students:migratedStudents,
      conversations:persisted.conversations||initialData.conversations,
      messages:persisted.messages||initialData.messages,
      messageReads:persisted.messageReads||initialData.messageReads,
      activities:persisted.activities||initialData.activities,
      notifications:persisted.notifications||initialData.notifications,
      payments:shouldMigrate?[
        ...(persisted.payments||initialData.payments),
        ...initialData.payments.filter((payment)=>payment.studentId&&!(persisted.payments||[]).some((item)=>item.id===payment.id)),
      ]:(persisted.payments||initialData.payments),
    }
  } catch (error) {
    console.error('Unable to load saved demo data.', error)
    return initialData
  }
}

export function DataProvider({ children }) {
  const [data, setData] = useState(readData)
  const { user } = useAuth()
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
    catch (error) { console.error('Unable to persist demo data.', error) }
  }, [data])
  useEffect(() => {
    const syncFromStorage=(event)=>{
      if(event.key!==STORAGE_KEY||!event.newValue)return
      try{setData(JSON.parse(event.newValue))}
      catch(error){console.error('Unable to sync shared demo data.',error)}
    }
    window.addEventListener('storage',syncFromStorage)
    return()=>window.removeEventListener('storage',syncFromStorage)
  },[])
  const update = (collection, updater) => setData((current) => ({ ...current, [collection]: typeof updater === 'function' ? updater(current[collection] || []) : updater }))
  const add = (collection, item, prefix = collection.slice(0, 2)) => {
    const date = new Date().toISOString().slice(0, 10)
    const record = { id: id(prefix), createdAt: date, updatedAt: date, ...item }
    update(collection, (records) => [record, ...records])
    return record
  }
  const patch = (collection, recordId, changes) => {
    const previous = data[collection]?.find((record) => record.id === recordId)
    const today = new Date().toISOString().slice(0, 10)
    const progressByStatus = { Draft:0,Planning: 5,Proposal:5,'Awaiting Client':8,'Deal Accepted':10,'Payment Pending':10,'Requirement Gathering':12,Design:25,Development:48,'In Progress':48,Review:65,'Client Review':76,Revision:82,'Revision Requested':80,Approved:88,'Ready for Delivery':95,Deployment:94,Delivered:100,Completed:100,'On Hold':previous?.progress||0,Paused:previous?.progress||0 }
    const projectChanges = collection === 'projects' && changes.status && changes.status !== previous?.status
      ? { progress: progressByStatus[changes.status] ?? previous?.progress ?? 0, ...(changes.status === 'Completed' ? { completedAt: today } : {}) }
      : {}
    update(collection, (records) => records.map((record) => record.id === recordId ? { ...record, ...projectChanges, ...changes, updatedAt: today } : record))
    if (collection === 'projects' && previous?.status !== changes.status && changes.status) {
      addActivity('project', changes.status === 'Completed' ? 'Project completed' : 'Project status updated', `${previous?.name || 'Project'} · ${changes.status}`, recordId,{clientId:previous?.clientId,projectId:recordId,recipientRole:'CLIENT',route:`projects/${recordId}`})
      if (changes.status === 'Completed' && previous.dealId) {
        update('deals', (records) => records.map((deal) => deal.id === previous.dealId ? { ...deal, status: 'Completed', updatedAt: new Date().toISOString().slice(0, 10) } : deal))
      }
    }
    if (collection === 'projects' && (changes.agreedAmount !== undefined || changes.paidAmount !== undefined) && previous?.dealId) {
      const projectAmount = Number(changes.agreedAmount ?? previous.agreedAmount ?? 0)
      const projectPaidAmount = Number(changes.paidAmount ?? previous.paidAmount ?? 0)
      update('deals', (records) => records.map((deal) => deal.id === previous.dealId ? {
        ...deal,
        agreedAmount: projectAmount,
        paidAmount: projectPaidAmount,
        paymentStatus: projectPaidAmount >= projectAmount ? 'Fully Paid' : projectPaidAmount ? 'Partially Paid' : 'Payment Pending',
        updatedAt: new Date().toISOString().slice(0, 10),
      } : deal))
    }
    if (collection === 'tasks' && previous?.status !== changes.status && changes.status) {
      update('tasks', (records) => records.map((record) => record.id === recordId && changes.status === 'Completed' ? { ...record, completedAt: today } : record))
      addActivity('task', changes.status === 'Completed' ? 'Task completed' : 'Task status updated', `${previous?.title || 'Task'} · ${changes.status}`, recordId)
    }
    if (collection === 'mentoringSessions' && previous?.status !== changes.status && changes.status) {
      addActivity('session',`Mentoring session ${changes.status.toLowerCase()}`,previous?.topic||'Session',previous?.studentId)
      if(changes.status==='Completed'&&previous?.studentId){
        update('students',(records)=>records.map((student)=>student.id===previous.studentId?{...student,sessionsCompleted:Number(student.sessionsCompleted||0)+1,sessionsRemaining:Math.max(0,Number(student.sessionsRemaining||0)-1),updatedAt:today}:student))
      }
    }
    if (collection === 'revisions' && previous?.status !== changes.status && changes.status) {
      if (changes.status === 'Completed') update('revisions', (records) => records.map((record) => record.id === recordId ? { ...record, completedAt: today } : record))
      addActivity('revision', `Revision ${changes.status.toLowerCase()}`, previous?.description || 'Project revision', previous?.projectId || previous?.clientId)
    }
    if (collection === 'projectRequests' && previous?.status !== changes.status && changes.status) {
      addActivity('request', `Project request ${changes.status.toLowerCase()}`, previous?.projectName || 'Project request', recordId,{clientId:previous?.clientId,recipientRole:'CLIENT',route:'requests'})
    }
  }
  const addActivity = (type, title, detail, recordId, scope = {}) => {
    const timestamp = new Date().toISOString()
    update('activities', (records) => [{ id: id('a'), type, title, detail, timestamp, time: 'Just now', recordId, ...scope }, ...records])
    if (['client', 'deal', 'payment', 'project', 'revision', 'approval', 'file', 'invoice', 'request', 'message', 'deliverable'].includes(type)) {
      update('notifications', (records) => [{ id: id('n'), type, title, detail, timestamp, time: 'Just now', recordId, read: false, readBy: [], ...scope }, ...records])
    }
  }
  const actions = {
    addLead: (item) => { const record = add('leads', item, 'l'); addActivity('lead', 'New lead added', item.name, record.id); return record },
    addClient: (item) => { const record = add('clients', { status: 'Active', ...item }, 'cl'); addActivity('client', 'New client added', item.name, record.id); return record },
    addInvoice: (item) => { const record = add('invoices', { paymentStatus: 'Payment Pending', ...item }, 'inv'); addActivity('invoice', 'Invoice record created', record.invoiceNumber || record.id, record.clientId); return record },
    addCommunication: (item) => { const record = add('communications', item, 'com'); addActivity('communication', 'Client communication logged', `${record.channel || 'Contact'} · ${record.summary}`, record.clientId); return record },
    addProjectRequest: (item) => {
      if (!data.clients.some((client) => client.id === item.clientId)) throw new Error('A valid client profile is required for this request.')
      if (item.status!=='Draft'&&!data.services.some((service) => service.id === item.serviceId)) throw new Error('Choose an available MAGAF service.')
      const record=add('projectRequests',{status:'Submitted',priority:'Medium',submittedAt:new Date().toISOString().slice(0,10),...item},'req')
      addActivity('request','New client project request',record.projectName,record.id,{clientId:record.clientId,recipientRole:'TEAM',route:`requests`})
      return record
    },
    reviewProjectRequest: (requestId,status,teamNotes) => {
      const request=data.projectRequests.find((item)=>item.id===requestId)
      if(!request)throw new Error('Project request not found.')
      if(!['Draft','Under Review','Need More Information','Accepted','Rejected','Cancelled'].includes(status))throw new Error('Unsupported project request status.')
      patch('projectRequests',requestId,{status,...(teamNotes!==undefined?(status==='Need More Information'?{informationRequested:teamNotes}:{teamNotes}):{})})
      return request
    },
    convertProjectRequest: (requestId,agreedAmount) => {
      const request=data.projectRequests.find((item)=>item.id===requestId)
      if(!request)throw new Error('Project request not found.')
      if(!['Accepted','Under Review','Submitted'].includes(request.status))throw new Error('Only an active request can be converted.')
      const amount=Number(agreedAmount??request.proposedPrice??request.estimatedBudget??0)
      if(!Number.isFinite(amount)||amount<0)throw new Error('Enter a valid agreed amount.')
      const deal=add('deals',{clientId:request.clientId,serviceId:request.serviceId,title:request.projectName,description:request.description,quotedAmount:Number(request.estimatedBudget||amount),agreedAmount:amount,paidAmount:0,paymentStatus:'Not Paid',status:'Accepted',createdFromRequestId:request.id,notes:request.teamNotes||''},'deal')
      const project=actions.addProject({clientId:request.clientId,serviceId:request.serviceId,dealId:deal.id,sourceRequestId:request.id,requestId:request.id,requestSnapshot:{...request},name:request.projectName,description:request.description,problemStatement:request.problemStatement,businessGoal:request.businessGoal,expectedOutcome:request.expectedOutcome,expectedDeliverables:request.expectedDeliverables,requirements:request.requirements,technologyInformation:request.technologyInformation,referenceLinks:request.referenceLinks,clientNotes:request.clientNotes,priority:request.priority,deadline:request.desiredDeadline,agreedAmount:amount,paidAmount:0,status:'Planning',notes:request.teamNotes||''})
      patch('deals',deal.id,{projectId:project.id})
      patch('projectRequests',request.id,{status:'Converted to Project',convertedDealId:deal.id,convertedProjectId:project.id})
      update('files',(records)=>records.map((file)=>file.projectRequestId===request.id?{...file,projectId:project.id}:file))
      addActivity('project','Request converted to project',project.name,project.id,{clientId:request.clientId,projectId:project.id,route:`projects/${project.id}`})
      return project
    },
    addStudent: (item) => {
      const record=add('students',{serviceId:'mentoring',status:'Active',paidAmount:0,sessionsCompleted:0,sessionsRemaining:0,...item},'st')
      addActivity('student','Mentoring student enrolled',record.name,record.id)
      return record
    },
    addProject: (item) => {
      const deal=data.deals.find((candidate)=>candidate.id===item.dealId)
      const agreedAmount=Number(item.agreedAmount??deal?.agreedAmount??deal?.quotedAmount??0)
      const paidAmount=Math.min(agreedAmount,Number(item.paidAmount??deal?.paidAmount??0))
      const record=add('projects',{status:'Planning',priority:'Medium',progress:0,...item,agreedAmount,paidAmount,paymentStatus:paidAmount>=agreedAmount&&agreedAmount>0?'Paid':paidAmount?'Partially Paid':'Pending'},'p')
      if(deal)patch('deals',deal.id,{clientId:record.clientId||deal.clientId,projectId:record.id,agreedAmount:record.agreedAmount,paidAmount:record.paidAmount,paymentStatus:record.paidAmount>=record.agreedAmount?'Paid':record.paidAmount?'Partially Paid':'Unpaid'})
      update('milestones',(records)=>[...records,{id:id('m'),projectId:record.id,name:'Requirements confirmed',status:'Upcoming',completionPercentage:0,dueDate:record.startDate,clientVisible:true},{id:id('m'),projectId:record.id,name:'First client review',status:'Upcoming',completionPercentage:0,dueDate:record.deadline,clientVisible:true},{id:id('m'),projectId:record.id,name:'Final delivery',status:'Upcoming',completionPercentage:0,dueDate:record.deadline,clientVisible:true}])
      addActivity('project','Project created',record.name,record.id,{clientId:record.clientId,projectId:record.id,route:`projects/${record.id}`})
      return record
    },
    ensureConversation: (clientId, projectId, projectRequestId) => {
      if (!data.clients.some((client) => client.id === clientId)) throw new Error('A valid client profile is required for a conversation.')
      if (projectId && !data.projects.some((project) => project.id === projectId && project.clientId === clientId)) throw new Error('The project is not connected to this client.')
      if (projectRequestId && !data.projectRequests.some((request) => request.id === projectRequestId && request.clientId === clientId)) throw new Error('The request is not connected to this client.')
      const existing=data.conversations.find((conversation)=>conversation.clientId===clientId&&(conversation.projectId||'')===(projectId||'')&&(conversation.projectRequestId||'')===(projectRequestId||''))
      return existing||add('conversations',{clientId,projectId:projectId||null,projectRequestId:projectRequestId||null,participantIds:[clientId,...data.users.map((person)=>person.id)],createdBy:user?.id||'system',lastMessageAt:null},'conv')
    },
    sendMessage: ({clientId,projectId,conversationId,text,attachments=[]}) => {
      if (!String(text||'').trim()&&!attachments.length) throw new Error('Write a message or attach a file before sending.')
      const conversation=conversationId?data.conversations.find((item)=>item.id===conversationId):actions.ensureConversation(clientId,projectId)
      if(!conversation)throw new Error('Conversation not found.')
      if(user?.kind==='CLIENT'&&conversation.clientId!==user.clientId)throw new Error('You do not have access to this conversation.')
      const timestamp=new Date().toISOString()
      const senderRole=user?.kind==='CLIENT'?'CLIENT':'TEAM'
      const message=add('messages',{conversationId:conversation.id,clientId:conversation.clientId,projectId:conversation.projectId||null,projectRequestId:conversation.projectRequestId||null,senderId:user?.id||'system',senderName:user?.name||'MAGAF Team',senderRole,recipientId:senderRole==='CLIENT'?'TEAM':conversation.clientId,recipientIds:(conversation.participantIds||[]).filter((participant)=>participant!==(user?.id||'system')),text:String(text||'').trim(),attachments,status:'Sent',createdAt:timestamp,readReceipts:[]},'msg')
      update('conversations',(records)=>records.map((item)=>item.id===conversation.id?{...item,lastMessageAt:timestamp,lastMessage:message.text||attachments[0]?.name||'Attachment shared',lastSenderId:message.senderId}:item))
      addActivity('message',message.senderRole==='CLIENT'?'New client message':'New MAGAF message',message.text||'Attachment shared',message.id,{clientId:conversation.clientId,projectId:conversation.projectId,conversationId:conversation.id,recipientRole:message.senderRole==='CLIENT'?'TEAM':'CLIENT',route:`messages/${conversation.id}`})
      return message
    },
    markConversationRead: (conversationId) => {
      const conversation=data.conversations.find((item)=>item.id===conversationId)
      if(!conversation)return
      if(user?.kind==='CLIENT'&&conversation.clientId!==user.clientId)throw new Error('You do not have access to this conversation.')
      const reader={userId:user?.id||'system',name:user?.name||'MAGAF Team',role:user?.kind==='CLIENT'?'CLIENT':'TEAM'}
      const unread=data.messages.filter((message)=>message.conversationId===conversationId&&message.senderRole!==reader.role&&!(message.readReceipts||[]).some((receipt)=>receipt.userId===reader.userId))
      if(!unread.length)return
      update('messages',(records)=>records.map((message)=>{
        if(message.conversationId!==conversationId||message.senderRole===reader.role)return message
        const receipts=message.readReceipts||[]
        if(receipts.some((receipt)=>receipt.userId===reader.userId))return message
        return {...message,readReceipts:[...receipts,{...reader,readAt:new Date().toISOString()}],status:'Read'}
      }))
      if(unread.length)update('messageReads',(records)=>[...records,...unread.map((message)=>({id:id('read'),messageId:message.id,conversationId,clientId:conversation.clientId,projectId:conversation.projectId||null,userId:reader.userId,userName:reader.name,role:reader.role,readAt:new Date().toISOString()}))])
    },
    addRequestInformation: ({requestId,text,files=[]}) => {
      const request=data.projectRequests.find((item)=>item.id===requestId)
      if(!request)throw new Error('Project request not found.')
      if(user?.kind==='CLIENT'&&request.clientId!==user.clientId)throw new Error('You do not have access to this request.')
      patch('projectRequests',requestId,{clientAdditionalInfo:[...(request.clientAdditionalInfo||[]),{id:id('info'),text:String(text||'').trim(),createdAt:new Date().toISOString(),createdBy:user?.id||'unknown'}]})
      files.forEach((file)=>actions.addFile({...file,clientId:request.clientId,projectRequestId:requestId,uploadedBy:user?.kind==='CLIENT'?'Client':'MAGAF Team',visibility:'Client',uploadedAt:new Date().toISOString().slice(0,10)}))
      addActivity('request','Additional request information shared',request.projectName,requestId,{clientId:request.clientId,recipientRole:'TEAM',route:'requests'})
    },
    updateClientProfile: (clientId,changes) => {
      if(user?.kind==='CLIENT'&&user.clientId!==clientId)throw new Error('You cannot edit another client profile.')
      const allowed=['contact','email','phone','address','city','state','country','website']
      const safeChanges=Object.fromEntries(Object.entries(changes).filter(([key])=>allowed.includes(key)))
      patch('clients',clientId,safeChanges)
    },
    addPayment: (item) => {
      const deal = data.deals.find((record) => record.id === item.dealId)
      const project = data.projects.find((record) => record.id === item.projectId) || data.projects.find((record) => record.id === deal?.projectId)
      const linkedDeal = deal || data.deals.find((record) => record.id === project?.dealId)
      const invoice = data.invoices.find((record) => record.id === item.invoiceId || record.invoiceNumber === item.invoiceId)
      const student = data.students.find((record) => record.id === item.studentId)
      const amount=Number(item.amount)
      const studentPayments=data.payments.filter((payment)=>payment.studentId===student?.id).reduce((sum,payment)=>sum+paymentValue(payment),0)
      const paid=invoice ? invoicePaid(data, invoice) : project ? projectPaid(data, project) : linkedDeal ? dealPaid(data, linkedDeal) : student ? (data.payments.some((payment)=>payment.studentId===student.id)?studentPayments:Number(student.paidAmount||0)) : 0
      const value=Number(invoice?.amount ?? project?.agreedAmount ?? linkedDeal?.agreedAmount ?? linkedDeal?.quotedAmount ?? student?.agreedAmount ?? 0)
      if(!invoice&&!project&&!linkedDeal&&!student)throw new Error('Link this payment to a project, deal, invoice, or mentoring student.')
      if(!Number.isFinite(amount)||amount<=0)throw new Error('Payment amount must be greater than zero.')
      if(item.type==='Refund'&&amount>paid)throw new Error(`Refund exceeds the amount paid of ₹${paid.toLocaleString('en-IN')}.`)
      if(item.type!=='Refund'&&amount>Math.max(0,value-paid))throw new Error(`Payment exceeds the remaining balance of ₹${Math.max(0,value-paid).toLocaleString('en-IN')}.`)
      const payment = add('payments', { date: new Date().toISOString().slice(0, 10), status: item.type==='Refund'?'Refunded':'Paid', type:'Partial Payment', method: 'UPI', ...item }, 'pay')
      const delta = paymentValue(payment)
      if (project) {
        const paidAmount = Math.min(Number(project.agreedAmount || 0), Math.max(0,Number(project.paidAmount || 0) + delta))
        patch('projects', project.id, { paidAmount,paymentStatus:paidAmount>=Number(project.agreedAmount||0)?'Paid':paidAmount?'Partially Paid':'Pending' })
      }
      if (linkedDeal) {
        const paidAmount = Math.min(Number(linkedDeal.agreedAmount || linkedDeal.quotedAmount || 0), Math.max(0,Number(project?.paidAmount ?? linkedDeal.paidAmount ?? 0) + delta))
        patch('deals', linkedDeal.id, { paidAmount, paymentStatus:paidAmount>=Number(linkedDeal.agreedAmount||linkedDeal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid' })
      }
      if(student){
        const studentPaidNow=Math.max(0,(data.payments.some((payment)=>payment.studentId===student.id)?studentPayments:Number(student.paidAmount||0))+delta)
        patch('students',student.id,{paidAmount:Math.min(Number(student.agreedAmount||0),studentPaidNow),paymentStatus:studentPaidNow>=Number(student.agreedAmount||0)?'Paid':studentPaidNow?'Partially Paid':'Pending'})
      }
      data.invoices.filter((invoice) => invoice.id === payment.invoiceId || invoice.invoiceNumber === payment.invoiceId || (
        (invoice.projectId === project?.id || invoice.dealId === linkedDeal?.id)
        && data.invoices.filter((sibling) => (invoice.projectId && sibling.projectId === invoice.projectId) || (invoice.dealId && sibling.dealId === invoice.dealId)).length === 1
      )).forEach((invoice) => {
        const invoicePaid = data.payments.filter((entry) => entry.id === payment.id || entry.invoiceId === invoice.id || entry.invoiceId === invoice.invoiceNumber || (
          !entry.invoiceId && ((invoice.projectId && entry.projectId === invoice.projectId) || (invoice.dealId && entry.dealId === invoice.dealId))
        )).reduce((sum, entry) => sum + paymentValue(entry), 0)
        const invoiceStatus = invoicePaid >= Number(invoice.amount || 0) ? 'Fully Paid' : invoicePaid > 0 ? 'Partially Paid' : 'Payment Pending'
        patch('invoices', invoice.id, { paymentStatus: invoiceStatus })
      })
      addActivity('payment', `${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(payment.amount)} ${payment.type==='Refund'?'refund recorded':'payment received'}`, student?.name || data.clients.find((client) => client.id === payment.clientId)?.name || 'Client', payment.projectId||student?.id||payment.clientId,{clientId:payment.clientId,projectId:payment.projectId,recipientRole:'CLIENT',route:'payments'})
      return payment
    },
    addTask: (item) => { const record = add('tasks', { status: 'Todo', priority: 'Medium', ...item }, 't'); addActivity('task', 'Task created', record.title, record.id); return record },
    addMentoringSession: (item) => { const record=add('mentoringSessions',{status:'Scheduled',...item},'ms'); addActivity('session','Mentoring session scheduled',record.topic,record.studentId); return record },
    addAsset: (item) => {
      const record=add('assets',item,'asset')
      if(item.projectId||item.clientId) add('files',{...item,assetId:record.id,category:item.category||'Working',visibility:item.visibility||'Internal',uploadedBy:item.uploadedBy||'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10)},'file')
      if(record.projectId) addActivity('file','Asset added',record.name,record.projectId)
      return record
    },
    addFile: (item) => {
      const record=add('files',{category:'Other',visibility:'Internal',uploadedBy:'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10),...item},'file')
      record.attachmentId=record.attachmentId||record.id
      record.fileName=record.fileName||record.name
      record.fileType=record.fileType||record.type
      record.fileSize=record.fileSize??record.size
      record.fileUrl=record.fileUrl||record.fileData||record.url||''
      record.requestId=record.requestId||record.projectRequestId
      update('files',(records)=>records.map((file)=>file.id===record.id?record:file))
      addActivity('file',item.uploadedBy==='Client'?'Client uploaded a file':'File added',record.name,record.projectId||record.clientId)
      return record
    },
    addDeal: (item) => {
      const record=add('deals',{quotedAmount:0,agreedAmount:0,paidAmount:0,discount:0,advanceRequired:0,paymentStatus:'Unpaid',status:'New',...item},'deal')
      addActivity('deal','Deal created',record.title,record.id)
      if(record.status==='Accepted'&&record.clientId){
        const project=actions.addProject({dealId:record.id,clientId:record.clientId,serviceId:record.serviceId,name:record.title,description:record.description,agreedAmount:Number(record.agreedAmount||record.quotedAmount||0),status:'Planning',assignedTo:record.assignedTo})
        patch('deals',record.id,{projectId:project.id})
      }
      return record
    },
    updateDealStatus: (dealId,status) => {
      const deal=data.deals.find((item)=>item.id===dealId)
      if(!deal)return null
      patch('deals',dealId,{status})
      let project=deal.projectId?data.projects.find((item)=>item.id===deal.projectId):null
      let clientId=deal.clientId
      if(status==='Accepted'&&!clientId&&deal.leadId){
        const lead=data.leads.find((item)=>item.id===deal.leadId)
        if(lead) clientId=actions.convertLead(lead,false).id
      }
      if(status==='Accepted'&&clientId&&!project){
        project=actions.addProject({dealId,clientId,serviceId:deal.serviceId,name:deal.title,description:deal.description,agreedAmount:Number(deal.agreedAmount||deal.quotedAmount||0),paidAmount:Number(deal.paidAmount||0),status:'Planning',assignedTo:deal.assignedTo})
        patch('deals',dealId,{clientId,projectId:project.id,paymentStatus:Number(deal.paidAmount||0)>=Number(deal.agreedAmount||deal.quotedAmount||0)?'Paid':Number(deal.paidAmount||0)>0?'Partially Paid':'Unpaid'})
      }
      if(status==='Accepted'&&clientId){
        const client=data.clients.find((item)=>item.id===clientId)
        if(client&&['Lead','Contacted','Qualified','Proposal Sent','Negotiation'].includes(client.status))patch('clients',client.id,{status:'Active'})
        if(deal.leadId)patch('leads',deal.leadId,{status:'Converted',convertedClientId:clientId})
      }
      if(project&&status==='Completed')patch('projects',project.id,{status:'Completed',progress:100,completedAt:new Date().toISOString().slice(0,10)})
      if(project&&(status==='Cancelled'||status==='Rejected'))patch('projects',project.id,{status:'Cancelled'})
      if(project&&status==='On Hold')patch('projects',project.id,{status:'Paused'})
      addActivity('deal',`Deal ${status.toLowerCase()}`,deal.title,dealId)
      return project
    },
    addRevision: (item) => {
      const record=add('revisions',{status:'Requested',clientVisible:true,date:new Date().toISOString().slice(0,10),...item},'rev')
      if(item.projectId) patch('projects',item.projectId,{status:'Revision Requested'})
      addActivity('revision','Revision requested',item.description,item.projectId||item.clientId)
      return record
    },
    setDeliverableStatus: (fileId,status) => {
      const file=data.files.find((item)=>item.id===fileId)
      if(!file)return
      const visibility=status==='Approved'||status==='Final'||status==='Delivered'?'Client':file.visibility
      patch('files',fileId,{status,visibility})
      patch('assets',file.assetId||fileId,{status})
      if(status==='Changes Requested'&&file.projectId)patch('projects',file.projectId,{status:'Revision Requested'})
      if(['Approved','Delivered','Changes Requested','Pending Approval'].includes(status))addActivity('approval',`Deliverable ${status.toLowerCase()}`,file.name,file.projectId||file.clientId)
      if(status==='Approved'||status==='Delivered'){
        if(file.projectId) patch('projects',file.projectId,{status:status==='Delivered'?'Completed':'Approved'})
      }
    },
    completeMilestone: (milestoneId) => {
      const milestone=data.milestones.find((item)=>item.id===milestoneId)
      if(!milestone)return
      patch('milestones',milestoneId,{status:'Completed',completionPercentage:100,completedAt:new Date().toISOString().slice(0,10)})
      const projectMilestones=data.milestones.filter((item)=>item.projectId===milestone.projectId)
      const completed=projectMilestones.filter((item)=>item.id===milestoneId||item.status==='Completed').length
      patch('projects',milestone.projectId,{progress:Math.round(completed/projectMilestones.length*100)})
      addActivity('milestone','Project milestone completed',milestone.name,milestone.projectId)
    },
    addGeneric: (collection, item) => collection==='students'?actions.addStudent(item):collection==='mentoringSessions'?actions.addMentoringSession(item):collection==='services'?add('services',enrichServices([{...item,id:item.id||id('svc')}])[0],'svc'):add(collection, item),
    markNotificationRead: (notificationId) => update('notifications',(records)=>records.map((record)=>record.id===notificationId?{...record,readBy:[...(record.readBy||[]).filter((receipt)=>receipt.userId!==user?.id),{userId:user?.id||'system',role:user?.kind==='CLIENT'?'CLIENT':'TEAM',readAt:new Date().toISOString()}],...(user?.kind==='CLIENT'?{}:{read:true})}:record)),
    markAllNotificationsRead: () => update('notifications', (records) => records.map((record) => ({ ...record, readBy:[...(record.readBy||[]).filter((receipt)=>receipt.userId!==user?.id),{userId:user?.id||'system',role:user?.kind==='CLIENT'?'CLIENT':'TEAM',readAt:new Date().toISOString()}],...(user?.kind==='CLIENT'?{}:{read:true}) }))),
    removeRecord: (collection, recordId) => {
      const record = data[collection]?.find((item) => item.id === recordId)
      if (!record) return
      if (collection === 'clients') {
        const projectIds = data.projects.filter((project) => project.clientId === recordId).map((project) => project.id)
        const requestIds=data.projectRequests.filter((request)=>request.clientId===recordId).map((request)=>request.id)
        update('projects', (records) => records.filter((project) => project.clientId !== recordId))
        update('payments', (records) => records.filter((payment) => payment.clientId !== recordId))
        update('tasks', (records) => records.filter((task) => task.clientId !== recordId && !projectIds.includes(task.projectId)))
        update('assets', (records) => records.filter((asset) => asset.clientId !== recordId && !projectIds.includes(asset.projectId)))
        update('files',(records)=>records.filter((file)=>file.clientId!==recordId&&!projectIds.includes(file.projectId)&&!requestIds.includes(file.projectRequestId)))
        update('projectRequests',(records)=>records.filter((request)=>request.clientId!==recordId))
        update('deals',(records)=>records.filter((deal)=>deal.clientId!==recordId))
        update('revisions',(records)=>records.filter((revision)=>revision.clientId!==recordId))
        update('invoices',(records)=>records.filter((invoice)=>invoice.clientId!==recordId))
        update('communications',(records)=>records.filter((communication)=>communication.clientId!==recordId))
        update('leads', (records) => records.map((lead) => lead.convertedClientId === recordId ? { ...lead, convertedClientId: undefined } : lead))
      }
      if (collection === 'projects') {
        update('payments', (records) => records.filter((payment) => payment.projectId !== recordId))
        update('tasks', (records) => records.filter((task) => task.projectId !== recordId))
        update('assets', (records) => records.filter((asset) => asset.projectId !== recordId))
        update('files',(records)=>records.filter((file)=>file.projectId!==recordId))
        update('milestones',(records)=>records.filter((milestone)=>milestone.projectId!==recordId))
        update('revisions',(records)=>records.filter((revision)=>revision.projectId!==recordId))
        update('invoices',(records)=>records.filter((invoice)=>invoice.projectId!==recordId))
        update('deals',(records)=>records.map((deal)=>deal.projectId===recordId?{...deal,projectId:undefined}:deal))
      }
      if (collection === 'payments' && record.projectId) {
        const paidAmount = Math.max(0,data.payments.filter((payment) => payment.projectId === record.projectId && payment.id !== recordId).reduce((sum, payment) => sum + paymentValue(payment), 0))
        const project=data.projects.find((item)=>item.id===record.projectId)
        const projectPaidAmount=Math.min(paidAmount,Number(project?.agreedAmount||0))
        patch('projects', record.projectId, { paidAmount:projectPaidAmount,paymentStatus:projectPaidAmount>=Number(project?.agreedAmount||0)&&Number(project?.agreedAmount||0)>0?'Paid':projectPaidAmount?'Partially Paid':'Pending' })
        const deal=data.deals.find((item)=>item.id===record.dealId)||data.deals.find((item)=>item.id===project?.dealId)
        if(deal)patch('deals',deal.id,{paidAmount:Math.min(paidAmount,Number(deal.agreedAmount||deal.quotedAmount||0)),paymentStatus:paidAmount>=Number(deal.agreedAmount||deal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid'})
      }
      if(collection==='payments'&&record.dealId&&!record.projectId){
        const deal=data.deals.find((item)=>item.id===record.dealId)
        const paidAmount=Math.max(0,data.payments.filter((payment)=>payment.dealId===record.dealId&&payment.id!==recordId).reduce((sum,payment)=>sum+paymentValue(payment),0))
        if(deal)patch('deals',deal.id,{paidAmount:Math.min(paidAmount,Number(deal.agreedAmount||deal.quotedAmount||0)),paymentStatus:paidAmount>=Number(deal.agreedAmount||deal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid'})
      }
      if(collection==='payments'&&record.studentId){
        const student=data.students.find((item)=>item.id===record.studentId)
        const paidAmount=Math.max(0,data.payments.filter((payment)=>payment.studentId===record.studentId&&payment.id!==recordId).reduce((sum,payment)=>sum+paymentValue(payment),0))
        if(student)patch('students',student.id,{paidAmount:Math.min(paidAmount,Number(student.agreedAmount||0)),paymentStatus:paidAmount>=Number(student.agreedAmount||0)?'Paid':paidAmount?'Partially Paid':'Pending'})
      }
      if(collection==='students'){
        update('payments',(records)=>records.filter((payment)=>payment.studentId!==recordId))
        update('mentoringSessions',(records)=>records.filter((session)=>session.studentId!==recordId))
      }
      if(collection==='payments'){
        const remainingData={...data,payments:data.payments.filter((payment)=>payment.id!==recordId)}
        data.invoices.filter((invoice)=>invoice.id===record.invoiceId||invoice.invoiceNumber===record.invoiceId||(
          (record.projectId&&invoice.projectId===record.projectId)||(record.dealId&&invoice.dealId===record.dealId)
        )).forEach((invoice)=>patch('invoices',invoice.id,{paymentStatus:invoiceStatus(remainingData,invoice)}))
      }
      update(collection, (records) => records.filter((item) => item.id !== recordId))
    },
    patch,
    update,
    convertLead: (lead, createProject) => {
      let client = data.clients.find((record) => record.leadId === lead.id)
      if (!client) client = actions.addClient({ name: lead.name, contact: lead.contact, category: lead.category, location: lead.location, phone: lead.phone, email: lead.email, serviceId: lead.serviceId, source: lead.source, leadId: lead.id, status: 'Active' })
      patch('leads', lead.id, { status: 'Converted', convertedClientId: client.id })
      addActivity('lead', 'Lead converted', lead.name, lead.id)
      if (createProject) actions.addProject({ name: `${lead.name} · ${data.services.find((service) => service.id === lead.serviceId)?.shortName || 'New project'}`, clientId: client.id, serviceId: lead.serviceId, agreedAmount: Number(String(lead.potentialValue || '0').replace(/[^\d]/g, '')), assignedTo: lead.assignedTo })
      return client
    },
    reset: () => setData(initialData),
  }
  const value = { data, ...actions }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
