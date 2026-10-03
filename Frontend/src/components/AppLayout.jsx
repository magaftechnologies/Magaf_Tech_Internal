import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import Icon from './Icon'

const navigation = [
  { label:'WORKSPACE', links:[['Dashboard','grid','dashboard']] },
  { label:'BUSINESS', links:[['Leads','user','leads'],['Clients','users','clients'],['Project requests','file','requests'],['Deals','briefcase','deals'],['Projects','briefcase','projects'],['Payments','card','payments'],['Invoices','file','invoices']] },
  { label:'COMMUNICATION', links:[['Messages','message','messages']] },
  { label:'SERVICES', links:[['All services','layers','services'],['Software Development','code','services/software'],['Automation & AI','sparkles','services/automation'],['Advertising & Creative','megaphone','services/creative'],['Content Creation','file','services/content'],['Invitations & Events','calendar','services/events'],['Development Mentoring','graduation','services/mentoring'],['Custom Solutions','layers','services/custom'],['MAGAF Products','sparkles','services/products']] },
  { label:'OPERATIONS', links:[['Tasks','check','tasks'],['Revisions','clock','revisions'],['Content & deliverables','file','content'],['Files & assets','file','files'],['Creative assets','sparkles','assets'],['Mentoring dashboard','graduation','students'],['Targets','trend','targets']] },
  { label:'INSIGHTS', links:[['Business analytics','chart','analytics'],['Reports','file','reports'],['Product ideas','sparkles','products']] },
  { label:'TEAM', links:[['Team members','users','team'],['Settings','settings','settings']] },
]

export default function AppLayout({ route, navigate, children }) {
  const { user, logout } = useAuth()
  const { data, markNotificationRead, markAllNotificationsRead } = useData()
  const [collapsed,setCollapsed]=useState(false)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [search,setSearch]=useState('')
  const [searchOpen,setSearchOpen]=useState(false)
  const [notifications,setNotifications]=useState(false)
  const [userMenu,setUserMenu]=useState(false)
  const segment=route.split('/')[0]||'dashboard'
  const detail=route.split('/')[1]
  const pageNames={dashboard:'Dashboard',leads:'Leads',clients:'Clients',requests:'Project requests',deals:'Deals',projects:'Projects',payments:'Payments',invoices:'Invoices',messages:'Messages',services:'Services',tasks:'Tasks',revisions:'Revisions',content:'Content & deliverables',assets:'Creative assets',files:'Files & assets',targets:'Targets',analytics:'Business analytics',reports:'Reports',products:'Product ideas',team:'Team members',students:'Mentoring dashboard',settings:'Settings'}
  const unreadMessages=data.messages.filter((message)=>message.senderRole==='CLIENT'&&!(message.readReceipts||[]).some((receipt)=>receipt.userId===user?.id)).length
  const results=useMemo(()=>{
    if(search.trim().length<2)return []
    const term=search.toLowerCase()
    return [
      ...data.clients.filter(x=>[x.name,x.contact,x.phone,x.whatsapp,x.email,x.companyName].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.name,type:'Client',route:`clients/${x.id}`})),
      ...(data.students||[]).filter(x=>[x.name,x.email,x.contact,x.topics].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.name,type:'Mentoring student',route:'students'})),
      ...(data.projectRequests||[]).filter(x=>[x.projectName,x.description,x.id].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.projectName,type:'Project request',route:'requests'})),
      ...data.leads.filter(x=>[x.name,x.contact,x.phone,x.email].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.name,type:'Lead',route:`leads/${x.id}`})),
      ...data.projects.filter(x=>[x.name,x.id,x.repositoryUrl].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.name,type:'Project',route:`projects/${x.id}`})),
      ...data.deals.filter(x=>[x.title,x.id,x.clientId].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.title,type:'Deal',route:`deals/${x.id}`})),
      ...data.services.filter(x=>x.name.toLowerCase().includes(term)).map(x=>({label:x.shortName,type:'Service',route:`services/${x.id}`})),
      ...data.payments.filter(x=>(x.reference||x.id).toLowerCase().includes(term)).map(x=>({label:x.reference||x.id,type:'Payment',route:'payments'})),
      ...data.payments.filter(x=>x.invoiceId?.toLowerCase().includes(term)).map(x=>({label:x.invoiceId,type:'Invoice',route:'payments'})),
      ...data.invoices.filter(x=>[x.invoiceNumber,x.notes].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.invoiceNumber,type:'Invoice',route:'invoices'})),
      ...data.files.filter(x=>[x.name,x.description,x.category,x.url].some(value=>value?.toLowerCase().includes(term))).map(x=>({label:x.name,type:'File',route:'files'})),
      ...data.tasks.filter(x=>x.title.toLowerCase().includes(term)).map(x=>({label:x.title,type:'Task',route:'tasks'})),
    ].slice(0,7)
  },[search,data])
  const openRoute=(path)=>{navigate(path);setMobileOpen(false);setSearchOpen(false);setSearch('')}
  const openNotification=(item)=>{
    markNotificationRead(item.id)
    if(item.route)navigate(item.route)
    else if(item.conversationId)navigate(`messages/${item.conversationId}`)
    else if(item.recordId)navigate(item.type==='payment'?'payments':item.type==='invoice'?'invoices':item.type==='request'?'requests':item.type==='student'||item.type==='session'?'students':item.type==='client'?`clients/${item.recordId}`:item.type==='deal'?`deals/${item.recordId}`:item.type==='project'||item.type==='revision'||item.type==='approval'||item.type==='file'?`projects/${item.recordId}`:'dashboard')
    setNotifications(false)
  }
  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
    {mobileOpen&&<button className="mobile-scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileOpen?'mobile-open':''}`}>
      <div className="brand-lockup"><span className="brand-mark">M<span>.</span></span><span className="brand-copy"><strong>MAGAF</strong><small>BUSINESS HUB</small></span><button className="collapse-button" onClick={()=>setCollapsed(!collapsed)} aria-label="Collapse sidebar">‹</button></div>
      <div className="workspace-switch"><span className="workspace-avatar">M</span><span><strong>MAGAF Technologies</strong><small>Internal workspace</small></span><b>⌄</b></div>
      <nav className="side-nav" aria-label="Main navigation">{navigation.map(group=><div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.links.map(([label,icon,path])=>{const active=route===path||(!detail&&segment===path.split('/')[0]&&path==='services');return <button className={`nav-link ${active?'active':''}`} key={path} title={collapsed?label:undefined} onClick={()=>openRoute(path)}><Icon name={icon} size={17}/><span>{label}</span>{path==='leads'&&<small className="nav-count">{data.leads.filter(l=>!['Converted','Lost'].includes(l.status)).length}</small>}{path==='messages'&&unreadMessages>0&&<small className="nav-count">{unreadMessages}</small>}</button>})}</div>)}</nav>
      <div className="sidebar-bottom"><div className="demo-card"><span className="demo-dot"/><span><strong>DEMO MODE</strong><small>Sample workspace data</small></span></div><button className="sidebar-user" onClick={()=>logout()}><span className="user-avatar">{user?.name?.slice(0,1)||'M'}</span><span><strong>{user?.name||'Founder'}</strong><small>{user?.role||'Team member'}</small></span><Icon name="logout" size={16}/></button></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={13}/><strong>{pageNames[segment]||segment}</strong>{detail&&<><Icon name="chevron" size={13}/><strong className="crumb-detail">{data.clients.find(x=>x.id===detail)?.name||data.projects.find(x=>x.id===detail)?.name||data.deals.find(x=>x.id===detail)?.title||data.leads.find(x=>x.id===detail)?.name||detail}</strong></>}</div></div><div className="topbar-right"><div className="global-search"><Icon name="search" size={16}/><input value={search} onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearch(e.target.value);setSearchOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'&&results[0])openRoute(results[0].route)}} placeholder="Search anything…" aria-label="Global search"/><kbd>⌘ K</kbd>{searchOpen&&search.length>=2&&<div className="search-results">{results.length?results.map(item=><button key={`${item.type}${item.route}`} onClick={()=>openRoute(item.route)}><span className="result-icon"><Icon name={item.type==='Client'?'users':item.type==='Lead'?'user':item.type==='Project'||item.type==='Deal'?'briefcase':item.type==='Service'?'layers':item.type==='Payment'?'card':'file'} size={16}/></span><span><strong>{item.label}</strong><small>{item.type}</small></span><Icon name="arrow" size={14}/></button>):<p>No matches found.</p>}</div>}</div><div className="topbar-menu-anchor"><button className={`icon-button notification-button ${notifications?'selected':''}`} onClick={()=>setNotifications(!notifications)} aria-label={`Notifications, ${(data.notifications||[]).filter(item=>!item.read).length} unread`}><Icon name="bell"/>{(data.notifications||[]).some(item=>!item.read)&&<i/>}</button>{notifications&&<div className="popover notification-popover"><div className="popover-head"><strong>Notifications</strong><button onClick={markAllNotificationsRead}>Mark all read</button></div>{(data.notifications||[]).map((item,i)=><button className={`notification-row ${item.read?'read':''}`} key={item.id||item.title} onClick={()=>openNotification(item)}><span className={`notice-dot notice-${i%3}`}/><span><b>{item.title}</b><small>{item.detail} · {item.time}</small></span></button>)}</div>}</div><button className="help-button" title="Help">?</button><div className="topbar-menu-anchor"><button className="topbar-profile" onClick={()=>setUserMenu(!userMenu)}><span className="user-avatar">{user?.name?.slice(0,1)||'M'}</span><span>{user?.name||'Founder'}</span><b>⌄</b></button>{userMenu&&<div className="popover user-popover"><strong>{user?.name}</strong><small>{user?.email}</small><button onClick={logout}><Icon name="logout" size={15}/> Sign out</button></div>}</div></div></header>
      <div className="content-area">{children}</div>
      <footer className="app-footer"><span>MAGAF Technologies <i/> Internal Operating System</span><span>Prototype · v0.1 <b>DEMO DATA</b></span></footer>
    </main>
  </div>
}
