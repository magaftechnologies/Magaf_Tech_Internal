export const services = [
  { id: 'software', name: 'Software Development & Digital Solutions', shortName: 'Software Development', category: 'Technology', icon: 'code', description: 'Websites, applications and custom business systems.', offerings: ['Business websites', 'Web applications', 'Dashboards', 'Booking systems', 'E-commerce'] },
  { id: 'automation', name: 'Business Automation & AI Solutions', shortName: 'Automation & AI', category: 'Technology', icon: 'sparkles', description: 'Practical AI assistants and workflow automation for growing teams.', offerings: ['AI chat agents', 'Lead qualification', 'Workflow automation', 'Knowledge assistants'] },
  { id: 'creative', name: 'Advertising & Creative Business Promotions', shortName: 'Advertising & Creative', category: 'Creative', icon: 'megaphone', description: 'Campaign-ready video, imagery and promotional creative.', offerings: ['Promotional videos', 'Reels', 'Posters', 'Social creatives', 'Campaign concepts'] },
  { id: 'content', name: 'Content Creation', shortName: 'Content Creation', category: 'Creative', icon: 'file', description: 'Consistent, on-brand content built around your audience.', offerings: ['Social posts', 'Captions', 'Content calendars', 'Scripts', 'Short videos'] },
  { id: 'events', name: 'Digital Invitations & Event Products', shortName: 'Digital Invitations', category: 'Digital Products', icon: 'calendar', description: 'Beautiful interactive invitations and mobile-first event pages.', offerings: ['Digital invitations', 'RSVP pages', 'Event pages', 'QR invitations'] },
  { id: 'mentoring', name: 'Programming & Development Mentoring', shortName: 'Development Mentoring', category: 'Education', icon: 'graduation', description: 'Personalized programming guidance, project support and interview prep.', offerings: ['Programming fundamentals', 'Web development', 'Project guidance', 'Interview preparation'] },
  { id: 'custom', name: 'Other / Custom Solutions', shortName: 'Custom Solutions', category: 'Custom', icon: 'layers', description: 'Thoughtful solutions for unique business requirements.', offerings: ['Discovery', 'Custom delivery', 'Ongoing support'] },
  { id: 'products', name: 'MAGAF Public Products', shortName: 'Public Products', category: 'Product Studio', icon: 'sparkles', description: 'Internal tracking for MAGAF-owned SaaS, AI and developer products.', offerings: ['SaaS products', 'AI tools', 'Developer tools', 'Productivity utilities'] },
]

const people = ['Chandu', 'Dileep', 'Ramesh']
export const users = people.map((name, i) => ({ id: `u${i + 1}`, name, role: ['Founder', 'Technology', 'Operations'][i], email: `${name.toLowerCase()}@magaf.in`, status: 'Active' }))

const rawClients = [
  ['cl1', 'Sunrise Public School', 'Anusha Reddy', 'Education', 'Hyderabad', 'software', 'Active', 'Google Maps'],
  ['cl2', 'GreenLeaf Family Clinic', 'Dr. Vivek Rao', 'Healthcare', 'Secunderabad', 'creative', 'Active', 'Referral'],
  ['cl3', 'Brew & Bloom Cafe', 'Karthik Varma', 'Restaurant', 'Hyderabad', 'content', 'Active', 'Instagram'],
  ['cl4', 'Nexora Learning Hub', 'Priya Sharma', 'Education', 'Warangal', 'mentoring', 'Active', 'LinkedIn'],
  ['cl5', 'Urban Aura Salon', 'Meghana Reddy', 'Beauty', 'Hyderabad', 'creative', 'Active', 'WhatsApp'],
  ['cl6', 'FitCore Studio', 'Rahul Kumar', 'Fitness', 'Vijayawada', 'automation', 'Active', 'Networking'],
  ['cl7', 'Kaveri Handlooms', 'Srinivas Rao', 'Retail', 'Guntur', 'software', 'Active', 'Google Maps'],
  ['cl8', 'AsterByte Labs', 'Nikhil Jain', 'Startup', 'Hyderabad', 'custom', 'Returning', 'Freelance Platform'],
  ['cl9', 'Lotus Dental Care', 'Sana Khan', 'Healthcare', 'Hyderabad', 'software', 'Active', 'Instagram'],
  ['cl10', 'Deccan Spice House', 'Arjun Reddy', 'Restaurant', 'Warangal', 'creative', 'Active', 'Google Maps'],
  ['cl11', 'Little Steps Academy', 'Madhavi Rao', 'Education', 'Vijayawada', 'events', 'Active', 'Referral'],
  ['cl12', 'Vertex Commerce', 'Teja Kumar', 'E-commerce', 'Hyderabad', 'automation', 'Active', 'LinkedIn'],
]
export const clients = rawClients.map(([id, name, contact, category, location, serviceId, status, source], i) => ({
  id, name, contact, category, location, serviceId, status, source, email: `${contact.split(' ')[0].toLowerCase()}@${['sunrise.edu.in','greenleaf.in','brewandbloom.in','nexora.in','urbanaura.in','fitcore.in','kaveri.in','asterbyte.io','lotusdental.in','deccanspice.in','littlesteps.edu.in','vertexcommerce.in'][i]}`,
  phone: `+91 98${String(41000000 + i * 183271).slice(0, 8)}`, website: '', notes: '', createdAt: i >= 5 ? `2026-10-${String((i - 4) * 3).padStart(2, '0')}` : `2026-0${(i % 5) + 1}-${String((i * 3) + 4).padStart(2, '0')}`, leadId: `l${i + 1}`,
}))

const projectRows = [
  ['p1','School website & admissions portal','cl1','software','Development','Completed',28000,28000,'Chandu','High'],
  ['p2','Clinic launch campaign','cl2','creative','Creative','In Progress',12000,7000,'Dileep','High'],
  ['p3','Monthly social content','cl3','content','Content','In Progress',9000,4500,'Ramesh','Medium'],
  ['p4','Full-stack mentoring cohort','cl4','mentoring','Mentoring','In Progress',18000,12000,'Chandu','Medium'],
  ['p5','Salon festive reels','cl5','creative','Creative','Completed',6500,6500,'Dileep','Medium'],
  ['p6','Lead follow-up assistant','cl6','automation','Automation','Testing',24000,12000,'Ramesh','High'],
  ['p7','Handloom ecommerce store','cl7','software','Development','Development',42000,20000,'Chandu','Urgent'],
  ['p8','Inventory workflow audit','cl8','custom','Consulting','Completed',8500,8500,'Dileep','Low'],
  ['p9','School annual day invite','cl1','events','Invitation','Completed',4500,4500,'Ramesh','Low'],
  ['p10','New product short videos','cl8','creative','Creative','Client Review',14000,7000,'Dileep','High'],
  ['p11','Python project guidance','cl4','mentoring','Mentoring','In Progress',7000,3500,'Chandu','Medium'],
  ['p12','Cafe content calendar','cl3','content','Content','Proposal',6000,0,'Ramesh','Low'],
  ['p13','Dental clinic website refresh','cl9','software','Website','Planning',32000,0,'Chandu','High'],
  ['p14','Festive food promotion','cl10','creative','Creative','Client Review',9500,4500,'Dileep','Medium'],
  ['p15','School digital invitation','cl11','events','Invitation','Requirement Collection',5000,1500,'Ramesh','Low'],
  ['p16','Commerce support assistant','cl12','automation','AI Assistant','Paused',28000,8000,'Chandu','High'],
]
export const projects = projectRows.map(([id, name, clientId, serviceId, type, status, agreedAmount, paidAmount, assignedTo, priority], i) => ({
  id, dealId:`d${i+1}`, name, clientId, serviceId, type, status, agreedAmount, paidAmount, assignedTo, priority, progress:status==='Completed'?100:status==='Client Review'?75:status==='In Progress'?48:20, description: `${type} delivery for ${clients.find(c => c.id === clientId)?.name}.`, requirements:[`${type} scope and deliverables`, 'Client review before final delivery'], startDate: `2026-09-${String((i % 20) + 1).padStart(2,'0')}`, deadline: `2026-10-${String((i % 25) + 1).padStart(2,'0')}`, notes: '', support: 'Internal',
}))

const leadRows = [
  ['l1','Sunrise Public School','software','Google Maps','Converted','₹28,000','Chandu'],
  ['l2','GreenLeaf Family Clinic','creative','Referral','Converted','₹12,000','Dileep'],
  ['l3','Brew & Bloom Cafe','content','Instagram','Converted','₹15,000','Ramesh'],
  ['l4','Nexora Learning Hub','mentoring','LinkedIn','Converted','₹25,000','Chandu'],
  ['l5','Urban Aura Salon','creative','WhatsApp','Converted','₹8,000','Dileep'],
  ['l6','FitCore Studio','automation','Networking','Converted','₹24,000','Ramesh'],
  ['l7','Kaveri Handlooms','software','Google Maps','Converted','₹42,000','Chandu'],
  ['l8','AsterByte Labs','custom','Freelance Platform','Converted','₹22,500','Dileep'],
  ['l9','Lotus Dental Care','software','Instagram','Proposal Sent','₹32,000','Chandu'],
  ['l10','Deccan Spice House','creative','Google Maps','Interested','₹9,500','Dileep'],
  ['l11','Little Steps Academy','events','Referral','Contacted','₹5,000','Ramesh'],
  ['l12','Vertex Commerce','automation','LinkedIn','New','₹35,000','Chandu'],
]
export const leads = leadRows.map(([id, name, serviceId, source, status, potentialValue, assignedTo], i) => ({
  id, name, contact: ['Anusha Reddy','Dr. Vivek Rao','Karthik Varma','Priya Sharma','Meghana Reddy','Rahul Kumar','Srinivas Rao','Nikhil Jain','Sana Khan','Arjun Reddy','Madhavi Rao','Teja Kumar'][i],
  serviceId, source, status, potentialValue, assignedTo, category: ['Education','Healthcare','Restaurant','Education','Beauty','Fitness','Retail','Startup','Healthcare','Restaurant','Education','E-commerce'][i], location: ['Hyderabad','Secunderabad','Hyderabad','Warangal','Hyderabad','Vijayawada','Guntur','Hyderabad'][i % 8], phone: `+91 99${String(43102700 + i * 21233).slice(0,8)}`,
  email: `hello${i+1}@example.in`, nextFollowUp: `2026-10-${String((i % 25) + 1).padStart(2,'0')}`, notes: '', createdAt: `2026-09-${String(i + 2).padStart(2,'0')}`,
}))

const recentPaymentDates = Array.from({ length: 5 }, (_, index) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (4 - index))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})
export const payments = projects.flatMap((p, i) => p.paidAmount ? Array.from({length:3},(_,part)=>{
  const chunk=Math.floor(p.paidAmount/3)
  const amount=part===2?p.paidAmount-chunk*2:chunk
  const date=i===0&&part<2?recentPaymentDates[part*2+1]:i===1?recentPaymentDates[part*2]:`2026-${String(((i+part)%6)+5).padStart(2,'0')}-${String(((i*2+part)%18)+1).padStart(2,'0')}`
  return {id:`pay${i*3+part+1}`,clientId:p.clientId,projectId:p.id,serviceId:p.serviceId,amount,date,method:['UPI','Bank Transfer','Cash'][(i+part)%3],type:['Advance','Partial Payment','Milestone Payment'][part],status:'Paid',reference:`MAG-${2600+i*3+part}`,notes:''}
}):[])
export const tasks = [
  { id:'t1', title:'Send homepage preview to Sunrise', projectId:'p1', clientId:'cl1', assignedTo:'Chandu', priority:'High', status:'Completed', deadline:'2026-10-02' },
  { id:'t2', title:'Edit clinic campaign cut', projectId:'p2', clientId:'cl2', assignedTo:'Dileep', priority:'Urgent', status:'In Progress', deadline:'2026-10-05' },
  { id:'t3', title:'Draft October content calendar', projectId:'p3', clientId:'cl3', assignedTo:'Ramesh', priority:'Medium', status:'Todo', deadline:'2026-10-07' },
  { id:'t4', title:'Test lead qualification flow', projectId:'p6', clientId:'cl6', assignedTo:'Ramesh', priority:'High', status:'Review', deadline:'2026-10-08' },
  { id:'t5', title:'Finalize handloom product copy', projectId:'p7', clientId:'cl7', assignedTo:'Chandu', priority:'Medium', status:'Todo', deadline:'2026-10-11' },
]
export const targets = { month: 'October 2026', clients: 10, revenue: 100000, projects: 15, leads: 100 }
export const activities = [
  { id:'a1', type:'payment', title:'₹7,000 payment received', detail:'GreenLeaf Family Clinic · Campaign', time:'Today, 10:42 AM', recordId:'cl2' },
  { id:'a2', type:'project', title:'Project moved to testing', detail:'Lead follow-up assistant · FitCore Studio', time:'Today, 9:18 AM', recordId:'p6' },
  { id:'a3', type:'lead', title:'New lead added', detail:'Vertex Commerce · Automation & AI', time:'Yesterday, 4:30 PM', recordId:'l12' },
  { id:'a4', type:'project', title:'Project completed', detail:'Salon festive reels · Urban Aura Salon', time:'Yesterday, 2:10 PM', recordId:'p5' },
  { id:'a5', type:'payment', title:'₹12,000 payment received', detail:'Nexora Learning Hub · Mentoring cohort', time:'Oct 1, 11:05 AM', recordId:'cl4' },
  { id:'a6', type:'lead', title:'Proposal sent', detail:'Lotus Dental Care · Website redesign', time:'Sep 30, 3:20 PM', recordId:'l9' },
  { id:'a7', type:'project', title:'New project confirmed', detail:'Handloom ecommerce store · Kaveri Handlooms', time:'Sep 29, 1:45 PM', recordId:'p7' },
  { id:'a8', type:'payment', title:'₹8,500 payment received', detail:'AsterByte Labs · Workflow audit', time:'Sep 27, 10:15 AM', recordId:'cl8' },
  { id:'a9', type:'client', title:'Client relationship renewed', detail:'AsterByte Labs · Returning client', time:'Sep 26, 4:40 PM', recordId:'cl8' },
  { id:'a10', type:'project', title:'Creative review requested', detail:'New product short videos · AsterByte Labs', time:'Sep 25, 2:30 PM', recordId:'p10' },
  { id:'a11', type:'task', title:'New task assigned', detail:'Finalize handloom product copy · Chandu', time:'Sep 24, 9:50 AM', recordId:'t5' },
  { id:'a12', type:'lead', title:'Discovery call scheduled', detail:'Little Steps Academy · Digital invitation', time:'Sep 23, 12:10 PM', recordId:'l11' },
]
export const assets = [
  { id:'as1', name:'GreenLeaf clinic logo', type:'Client logo', clientId:'cl2', projectId:'p2', version:'1', status:'Input', url:'https://example.com/greenleaf-logo', notes:'Demo placeholder link' },
  { id:'as2', name:'Campaign concept prompt', type:'Prompt', clientId:'cl2', projectId:'p2', version:'2', status:'Approved', prompt:'Warm, reassuring care for every family. Use natural light and calm green tones.', url:'', notes:'Demo prompt' },
  { id:'as3', name:'Clinic launch draft', type:'Draft', clientId:'cl2', projectId:'p2', version:'1', status:'Revision', url:'https://example.com/clinic-draft', notes:'Sample preview URL' },
  { id:'as4', name:'Salon festive reel final', type:'Final output', clientId:'cl5', projectId:'p5', version:'3', status:'Delivered', url:'https://example.com/salon-reel', notes:'Demo deliverable link' },
  { id:'as5', name:'Clinic campaign approved cut', type:'Final output', clientId:'cl2', projectId:'p2', version:'3', status:'Client Review', url:'https://example.com/clinic-campaign-preview', notes:'Client review preview' },
  { id:'as6', name:'Sunrise admissions portal launch guide', type:'Final output', clientId:'cl1', projectId:'p1', version:'1', status:'Delivered', url:'https://example.com/sunrise-launch-guide', notes:'Client handover link' },
]
export const content = [
  { id:'ct1', name:'October cafe content calendar', clientId:'cl3', projectId:'p3', serviceId:'content', platform:'Instagram', contentType:'Content calendar', topic:'Seasonal menu and behind the scenes', status:'Review', scheduledDate:'2026-10-06', url:'' },
  { id:'ct2', name:'Coffee origins reel', clientId:'cl3', projectId:'p3', serviceId:'content', platform:'Instagram', contentType:'Short video', topic:'Meet the roaster', status:'Production', scheduledDate:'2026-10-09', url:'' },
  { id:'ct3', name:'Admissions open carousel', clientId:'cl1', projectId:'p1', serviceId:'content', platform:'Instagram', contentType:'Social post', topic:'2027 admissions', status:'Published', scheduledDate:'2026-09-20', url:'https://example.com/admissions' },
  { id:'ct4', name:'Student success story', clientId:'cl4', projectId:'p4', serviceId:'content', platform:'LinkedIn', contentType:'Educational content', topic:'Learning through projects', status:'Idea', scheduledDate:'2026-10-12', url:'' },
]
export const products = [{ id:'idea1', name:'AI Tech Stack Converter', problem:'Help small teams compare implementation paths for a business workflow.', target:'Early-stage product teams', stage:'Idea', priority:'Medium', notes:'Internal product idea only · Not an existing MAGAF product' }]
export const invoices = projects.slice(0, 4).map((project, index) => ({
  id: `inv${String(index + 1).padStart(3, '0')}`,
  invoiceNumber: `MAG-INV-2026-${String(index + 1).padStart(3, '0')}`,
  clientId: project.clientId,
  projectId: project.id,
  dealId: project.dealId,
  amount: project.agreedAmount,
  issueDate: project.startDate,
  dueDate: project.deadline,
  paymentStatus: project.paidAmount >= project.agreedAmount ? 'Fully Paid' : project.paidAmount > 0 ? 'Partially Paid' : 'Payment Pending',
  notes: 'Demo invoice record only. No PDF has been generated.',
}))
export const students = [
  { id:'st1', name:'Aarav Mehta', contact:'+91 98765 43210', email:'aarav@example.in', goal:'Build a full-stack portfolio project', level:'Intermediate', topics:'React, Node.js, SQL', mentor:'Chandu', sessionType:'1:1', status:'Active', sessionsCompleted:6, sessionsRemaining:4, progress:'Built API and starting frontend' },
  { id:'st2', name:'Sanjana Rao', contact:'+91 98123 45678', email:'sanjana@example.in', goal:'Strengthen Python and data structures', level:'Beginner', topics:'Python, DSA, OOP', mentor:'Ramesh', sessionType:'1:1', status:'Active', sessionsCompleted:3, sessionsRemaining:5, progress:'Practicing core programming' },
  { id:'st3', name:'Vikram Nair', contact:'+91 99001 22445', email:'vikram@example.in', goal:'Prepare for junior developer interviews', level:'Advanced', topics:'Java, Collections, Interview preparation', mentor:'Chandu', sessionType:'1:1', status:'Paused', sessionsCompleted:8, sessionsRemaining:2, progress:'Resuming after exams' },
]
export const deals = [
  ...projects.map((project, index) => ({
    id:`d${index+1}`, clientId:project.clientId, serviceId:project.serviceId, projectId:project.id, paidAmount:project.paidAmount,
    title:project.name, description:project.description, quotedAmount:project.agreedAmount + (index % 3) * 1500,
    agreedAmount:project.agreedAmount, discount:(index % 3) * 1500, advanceRequired:Math.round(project.agreedAmount * .3),
    status:project.status==='Cancelled'?'Cancelled':project.status==='Completed'?'Completed':index % 5 === 0?'Negotiation':'Accepted',
    paymentStatus:project.paidAmount>=project.agreedAmount?'Paid':project.paidAmount?'Partially Paid':'Unpaid',
    expectedCloseDate:`2026-10-${String((index%20)+5).padStart(2,'0')}`, assignedTo:project.assignedTo,
    createdAt:project.startDate, notes:'',
  })),
  ...leads.slice(8).map((lead,index)=>({
    id:`d${projects.length+index+1}`, leadId:lead.id, clientId:lead.status==='Converted'?clients.find((client)=>client.leadId===lead.id)?.id:undefined, serviceId:lead.serviceId,
    title:`${lead.name} · ${services.find((service)=>service.id===lead.serviceId)?.shortName||'Discovery'}`,
    description:`Potential ${lead.category.toLowerCase()} engagement.`, quotedAmount:Number(lead.potentialValue.replace(/[^\d]/g,'')),
    agreedAmount:0, discount:0, advanceRequired:0,
    status:lead.status==='Converted'?'Accepted':lead.status==='Proposal Sent'?'Proposal Sent':lead.status==='Interested'?'Negotiation':lead.status==='Contacted'?'Contacted':'New',
    expectedCloseDate:lead.nextFollowUp, assignedTo:lead.assignedTo, createdAt:lead.createdAt, notes:'',
  })),
]
export const files = assets.map((asset)=>({
  id:asset.id, name:asset.name, type:asset.type.toLowerCase().includes('video')?'Video':asset.type.toLowerCase().includes('logo')||asset.type.toLowerCase().includes('image')?'Image':'Link',
  category:asset.type==='Final output'?'Final Deliverables':asset.type==='Prompt'?'Working Files':'Reference Material',
  clientId:asset.clientId, projectId:asset.projectId, uploadedBy:'MAGAF Team', uploadedAt:'2026-10-02',
  description:asset.notes, visibility:['Delivered','Client Review'].includes(asset.status)?'Client':'Internal', url:asset.url, prompt:asset.prompt, status:asset.status,
}))
export const milestones = projects.flatMap((project,index)=>[
  { id:`m${index+1}a`,projectId:project.id,name:'Requirements confirmed',status:'Completed',dueDate:project.startDate,completedAt:project.startDate,clientVisible:true },
  { id:`m${index+1}b`,projectId:project.id,name:'First review',status:project.status==='Completed'?'Completed':index%2?'In Progress':'Upcoming',dueDate:project.deadline,clientVisible:true },
  { id:`m${index+1}c`,projectId:project.id,name:'Final delivery',status:project.status==='Completed'?'Completed':'Upcoming',dueDate:project.deadline,clientVisible:true },
])
export const revisions = [
  { id:'rev1',projectId:'p2',clientId:'cl2',number:1,requestedBy:'Client',date:'2026-10-02',description:'Please use the updated clinic contact number in the end card.',status:'In Progress',clientVisible:true },
]
export const communications = [
  { id:'com1',clientId:'cl2',projectId:'p2',date:'2026-10-02',channel:'WhatsApp',person:'Dr. Vivek Rao',summary:'Shared campaign direction and clinic branding references.',followUpDate:'2026-10-05',notes:'Client prefers warm, family-focused language.' },
  { id:'com2',clientId:'cl7',projectId:'p7',date:'2026-10-01',channel:'Phone',person:'Srinivas Rao',summary:'Confirmed initial product categories for the online store.',followUpDate:'2026-10-06',notes:'Internal: confirm catalog spreadsheet before importing.' },
]
export const initialData = { services, clients, leads, deals, projects, payments, invoices, tasks, targets, activities, users, assets, files, content, products, students, milestones, revisions, communications, notifications: [
  {id:'n1',type:'follow-up',title:'Follow-up due today',detail:'Lotus Dental Care proposal',time:'Today'},
  {id:'n2',type:'deadline',title:'Project deadline approaching',detail:'Clinic launch campaign · Oct 5',time:'Today'},
  {id:'n3',type:'payment',title:'Partial payment received',detail:'GreenLeaf Family Clinic · ₹7,000',time:'Today'},
], companySettings:{ name:'MAGAF Technologies', currency:'INR', timezone:'Asia/Kolkata' } }
