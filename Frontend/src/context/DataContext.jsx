import { createContext, useContext, useEffect, useState } from 'react'
import { initialData } from '../data/mockData'
import { dealPaid, invoicePaid, invoiceStatus, paymentValue, projectPaid } from '../utils/calculations'

const DataContext = createContext(null)
const STORAGE_KEY = 'magaf-os-data-v1'
const id = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const readData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialData
    const persisted = JSON.parse(saved)
    return {
      ...initialData,
      ...persisted,
      services: persisted.services ? [...persisted.services, ...initialData.services.filter((service) => !persisted.services.some((item) => item.id === service.id))] : initialData.services,
      invoices: persisted.invoices || initialData.invoices,
    }
  } catch (error) {
    console.error('Unable to load saved demo data.', error)
    return initialData
  }
}

export function DataProvider({ children }) {
  const [data, setData] = useState(readData)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
    catch (error) { console.error('Unable to persist demo data.', error) }
  }, [data])
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
    const progressByStatus = { Planning: 5, 'Requirement Gathering': 12, Design: 25, Development: 48, 'In Progress': 48, Review: 65, 'Client Review': 76, Revision: 82, 'Revision Requested': 80, Approved: 88, Deployment: 94, Delivered: 100, Completed: 100, 'On Hold': previous?.progress || 0, Paused: previous?.progress || 0 }
    const projectChanges = collection === 'projects' && changes.status && changes.status !== previous?.status
      ? { progress: progressByStatus[changes.status] ?? previous?.progress ?? 0, ...(changes.status === 'Completed' ? { completedAt: today } : {}) }
      : {}
    update(collection, (records) => records.map((record) => record.id === recordId ? { ...record, ...projectChanges, ...changes, updatedAt: today } : record))
    if (collection === 'projects' && previous?.status !== changes.status && changes.status) {
      addActivity('project', changes.status === 'Completed' ? 'Project completed' : 'Project status updated', `${previous?.name || 'Project'} · ${changes.status}`, recordId)
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
    if (collection === 'revisions' && previous?.status !== changes.status && changes.status) {
      if (changes.status === 'Completed') update('revisions', (records) => records.map((record) => record.id === recordId ? { ...record, completedAt: today } : record))
      addActivity('revision', `Revision ${changes.status.toLowerCase()}`, previous?.description || 'Project revision', previous?.projectId || previous?.clientId)
    }
  }
  const addActivity = (type, title, detail, recordId) => {
    const timestamp = new Date().toISOString()
    update('activities', (records) => [{ id: id('a'), type, title, detail, timestamp, time: 'Just now', recordId }, ...records])
    if (['client', 'deal', 'payment', 'project', 'revision', 'approval', 'file', 'invoice'].includes(type)) {
      update('notifications', (records) => [{ id: id('n'), type, title, detail, timestamp, time: 'Just now', recordId, read: false }, ...records])
    }
  }
  const actions = {
    addLead: (item) => { const record = add('leads', item, 'l'); addActivity('lead', 'New lead added', item.name, record.id); return record },
    addClient: (item) => { const record = add('clients', { status: 'Active', ...item }, 'cl'); addActivity('client', 'New client added', item.name, record.id); return record },
    addInvoice: (item) => { const record = add('invoices', { paymentStatus: 'Payment Pending', ...item }, 'inv'); addActivity('invoice', 'Invoice record created', record.invoiceNumber || record.id, record.clientId); return record },
    addCommunication: (item) => { const record = add('communications', item, 'com'); addActivity('communication', 'Client communication logged', `${record.channel || 'Contact'} · ${record.summary}`, record.clientId); return record },
    addProject: (item) => {
      const deal=data.deals.find((candidate)=>candidate.id===item.dealId)
      const agreedAmount=Number(item.agreedAmount??deal?.agreedAmount??deal?.quotedAmount??0)
      const paidAmount=Math.min(agreedAmount,Number(item.paidAmount??deal?.paidAmount??0))
      const record=add('projects',{status:'Planning',priority:'Medium',progress:0,...item,agreedAmount,paidAmount},'p')
      if(deal)patch('deals',deal.id,{clientId:record.clientId||deal.clientId,projectId:record.id,agreedAmount:record.agreedAmount,paidAmount:record.paidAmount,paymentStatus:record.paidAmount>=record.agreedAmount?'Paid':record.paidAmount?'Partially Paid':'Unpaid'})
      update('milestones',(records)=>[...records,{id:id('m'),projectId:record.id,name:'Requirements confirmed',status:'Upcoming',completionPercentage:0,dueDate:record.startDate,clientVisible:true},{id:id('m'),projectId:record.id,name:'First client review',status:'Upcoming',completionPercentage:0,dueDate:record.deadline,clientVisible:true},{id:id('m'),projectId:record.id,name:'Final delivery',status:'Upcoming',completionPercentage:0,dueDate:record.deadline,clientVisible:true}])
      addActivity('project','Project created',record.name,record.id)
      return record
    },
    addPayment: (item) => {
      const deal = data.deals.find((record) => record.id === item.dealId)
      const project = data.projects.find((record) => record.id === item.projectId) || data.projects.find((record) => record.id === deal?.projectId)
      const linkedDeal = deal || data.deals.find((record) => record.id === project?.dealId)
      const invoice = data.invoices.find((record) => record.id === item.invoiceId || record.invoiceNumber === item.invoiceId)
      const amount=Number(item.amount)
      const paid=invoice ? invoicePaid(data, invoice) : project ? projectPaid(data, project) : linkedDeal ? dealPaid(data, linkedDeal) : 0
      const value=Number(invoice?.amount ?? project?.agreedAmount ?? linkedDeal?.agreedAmount ?? linkedDeal?.quotedAmount ?? 0)
      if(!Number.isFinite(amount)||amount<=0)throw new Error('Payment amount must be greater than zero.')
      if(item.type==='Refund'&&amount>paid)throw new Error(`Refund exceeds the amount paid of ₹${paid.toLocaleString('en-IN')}.`)
      if(item.type!=='Refund'&&amount>Math.max(0,value-paid))throw new Error(`Payment exceeds the remaining balance of ₹${Math.max(0,value-paid).toLocaleString('en-IN')}.`)
      const payment = add('payments', { date: new Date().toISOString().slice(0, 10), status: item.type==='Refund'?'Refunded':'Paid', type:'Partial Payment', method: 'UPI', ...item }, 'pay')
      const delta = paymentValue(payment)
      if (project) {
        const paidAmount = Math.min(Number(project.agreedAmount || 0), Math.max(0,Number(project.paidAmount || 0) + delta))
        patch('projects', project.id, { paidAmount })
      }
      if (linkedDeal) {
        const paidAmount = Math.min(Number(linkedDeal.agreedAmount || linkedDeal.quotedAmount || 0), Math.max(0,Number(project?.paidAmount ?? linkedDeal.paidAmount ?? 0) + delta))
        patch('deals', linkedDeal.id, { paidAmount, paymentStatus:paidAmount>=Number(linkedDeal.agreedAmount||linkedDeal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid' })
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
      addActivity('payment', `${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(payment.amount)} ${payment.type==='Refund'?'refund recorded':'payment received'}`, data.clients.find((client) => client.id === payment.clientId)?.name || 'Client', payment.clientId)
      return payment
    },
    addTask: (item) => { const record = add('tasks', { status: 'Todo', priority: 'Medium', ...item }, 't'); addActivity('task', 'Task created', record.title, record.id); return record },
    addAsset: (item) => {
      const record=add('assets',item,'asset')
      if(item.projectId||item.clientId) add('files',{...item,assetId:record.id,category:item.category||'Working',visibility:item.visibility||'Internal',uploadedBy:item.uploadedBy||'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10)},'file')
      if(record.projectId) addActivity('file','Asset added',record.name,record.projectId)
      return record
    },
    addFile: (item) => {
      const record=add('files',{category:'Other',visibility:'Internal',uploadedBy:'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10),...item},'file')
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
    addGeneric: (collection, item) => add(collection, item),
    markNotificationRead: (notificationId) => patch('notifications', notificationId, { read: true }),
    markAllNotificationsRead: () => update('notifications', (records) => records.map((record) => ({ ...record, read: true }))),
    removeRecord: (collection, recordId) => {
      const record = data[collection]?.find((item) => item.id === recordId)
      if (!record) return
      if (collection === 'clients') {
        const projectIds = data.projects.filter((project) => project.clientId === recordId).map((project) => project.id)
        update('projects', (records) => records.filter((project) => project.clientId !== recordId))
        update('payments', (records) => records.filter((payment) => payment.clientId !== recordId))
        update('tasks', (records) => records.filter((task) => task.clientId !== recordId && !projectIds.includes(task.projectId)))
        update('assets', (records) => records.filter((asset) => asset.clientId !== recordId && !projectIds.includes(asset.projectId)))
        update('files',(records)=>records.filter((file)=>file.clientId!==recordId&&!projectIds.includes(file.projectId)))
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
        patch('projects', record.projectId, { paidAmount: Math.min(paidAmount, Number(data.projects.find((project) => project.id === record.projectId)?.agreedAmount || 0)) })
        const project=data.projects.find((item)=>item.id===record.projectId)
        const deal=data.deals.find((item)=>item.id===record.dealId)||data.deals.find((item)=>item.id===project?.dealId)
        if(deal)patch('deals',deal.id,{paidAmount:Math.min(paidAmount,Number(deal.agreedAmount||deal.quotedAmount||0)),paymentStatus:paidAmount>=Number(deal.agreedAmount||deal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid'})
      }
      if(collection==='payments'&&record.dealId&&!record.projectId){
        const deal=data.deals.find((item)=>item.id===record.dealId)
        const paidAmount=Math.max(0,data.payments.filter((payment)=>payment.dealId===record.dealId&&payment.id!==recordId).reduce((sum,payment)=>sum+paymentValue(payment),0))
        if(deal)patch('deals',deal.id,{paidAmount:Math.min(paidAmount,Number(deal.agreedAmount||deal.quotedAmount||0)),paymentStatus:paidAmount>=Number(deal.agreedAmount||deal.quotedAmount||0)?'Paid':paidAmount?'Partially Paid':'Unpaid'})
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
