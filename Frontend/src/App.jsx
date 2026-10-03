import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import AppLayout from './components/AppLayout'
import Dashboard from './components/Dashboard'
import RecordsPage from './components/RecordsPage'
import RecordDetail from './components/RecordDetail'
import RecordModal from './components/RecordModal'
import ClientPortal from './components/ClientPortal'
import Icon from './components/Icon'
import './App.css'

function LoginScreen() {
  const { login, loginAsClient } = useAuth()
  const { data } = useData()
  const [name,setName]=useState('Chandu')
  const [clientId,setClientId]=useState(data.clients[0]?.id||'')
  const [accountType,setAccountType]=useState('TEAM')
  const [showPassword,setShowPassword]=useState(false)
  const [error,setError]=useState('')
  return <main className="login-screen"><div className="login-aside"><div className="login-brand"><span className="brand-mark">M<span>.</span></span><span><b>MAGAF</b><small>TECHNOLOGIES</small></span></div><div className="login-story"><span className="eyebrow">THE OPERATING SYSTEM FOR WHAT'S NEXT</span><h1>Build with<br/><em>intention.</em></h1><p>One workspace for the work, relationships and momentum behind MAGAF.</p><div className="login-orbit"><span className="orbit-center">M</span><span className="orbit-tag orbit-one">Marketing</span><span className="orbit-tag orbit-two">Automation</span><span className="orbit-tag orbit-three">Growth</span><span className="orbit-tag orbit-four">Future</span></div></div><span className="login-quote">“Small, thoughtful steps create remarkable momentum.”</span></div><section className="login-main"><div className="login-form-wrap"><span className="demo-tag"><i/> {accountType==='TEAM'?'INTERNAL TEAM ACCESS':'CLIENT PORTAL ACCESS'}</span><h2>{accountType==='TEAM'?'Welcome back':'Welcome to your portal'}</h2><p>{accountType==='TEAM'?'Sign in to your MAGAF workspace.':'View your projects, files and shared deliverables.'}</p><div className="account-switch"><button className={accountType==='TEAM'?'selected':''} onClick={()=>{setAccountType('TEAM');setError('')}}>Team workspace</button><button className={accountType==='CLIENT'?'selected':''} onClick={()=>{setAccountType('CLIENT');setError('')}}>Client portal</button></div><form onSubmit={e=>{e.preventDefault();if(accountType==='CLIENT'){const client=data.clients.find(item=>item.id===clientId);if(client)loginAsClient(client);else setError('Choose a client portal account.')}else if(!name.trim())setError('Choose a team member to continue.');else login(name)}}>{accountType==='TEAM'?<><label className="field">Team member<select value={name} onChange={e=>setName(e.target.value)}><option>Chandu</option><option>Dileep</option><option>Ramesh</option></select></label><label className="field">Email or username<input autoComplete="username" value={`${name.toLowerCase()}@magaf.in`} onChange={e=>setName(e.target.value.split('@')[0]||'')} /></label></>:<><label className="field">Demo client account<select value={clientId} onChange={e=>setClientId(e.target.value)}>{data.clients.map(client=><option value={client.id} key={client.id}>{client.name} — {client.contact}</option>)}</select></label><p className="portal-demo-warning">Demo portal access is scoped to the selected client profile. No real authentication is configured.</p></>}<label className="field">Password<div className="password-wrap"><input type={showPassword?'text':'password'} placeholder="Demo access — no password required" autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div></label><div className="login-options"><label><input type="checkbox" defaultChecked/> Remember me</label><button type="button" onClick={()=>setError('This prototype uses demo access. No password reset is configured.')}>Forgot password?</button></div>{error&&<p className="form-error">{error}</p>}<button className="button button-primary login-submit">Continue to {accountType==='TEAM'?'workspace':'client portal'} <Icon name="arrow" size={16}/></button></form><div className="login-demo-note"><Icon name="sparkles" size={16}/><span><b>Prototype access</b><small>{accountType==='TEAM'?'Select Chandu, Dileep or Ramesh to enter.':'Choose a sample client account to preview the isolated portal.'} Demo data only.</small></span></div><span className="login-copyright">© 2026 MAGAF Technologies · Internal use only</span></div></section></main>
}

function Workspace() {
  const [route,setRoute]=useState(()=>location.hash.replace(/^#\/?/,'')||'dashboard')
  const [modal,setModal]=useState(null)
  useEffect(()=>{const updateRoute=()=>setRoute(location.hash.replace(/^#\/?/,'')||'dashboard');window.addEventListener('hashchange',updateRoute);return()=>window.removeEventListener('hashchange',updateRoute)},[])
  const navigate=(path)=>{location.hash=`/${path}`;setRoute(path)}
  const quickAdd=(type,initial={},recordId)=>setModal({type,initial,recordId})
  const [page,id]=route.split('/')
  let content
  if(page==='dashboard'||!page)content=<Dashboard navigate={navigate} quickAdd={quickAdd}/>
  else if(id)content=<RecordDetail type={page} id={id} navigate={navigate} quickAdd={quickAdd}/>
  else if(page==='settings')content=<Settings navigate={navigate}/>
  else content=<RecordsPage page={page} navigate={navigate} quickAdd={quickAdd}/>
  return <><AppLayout route={route} navigate={navigate}>{content}</AppLayout>{modal&&<RecordModal type={modal.type} initial={modal.initial} recordId={modal.recordId} onClose={()=>setModal(null)}/>}</>
}
function Settings({navigate}) {
 const {reset,data,update}=useData()
 const [confirmed,setConfirmed]=useState(false)
 const [company,setCompany]=useState(data.companySettings?.name || 'MAGAF Technologies')
 return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">WORKSPACE PREFERENCES</span><h1>Settings</h1><p>Configure the MAGAF internal workspace and demo environment.</p></div></div><section className="panel settings-panel"><div className="settings-section"><span className="settings-icon"><Icon name="briefcase"/></span><div className="settings-copy"><h2>Company profile</h2><p>Workspace identity and regional preferences.</p></div><div className="settings-fields"><label className="field">Company name<input value={company} onChange={e=>setCompany(e.target.value)}/></label><label className="field">Default currency<select defaultValue={data.companySettings?.currency||'INR'}><option value="INR">INR · Indian Rupee</option></select></label><label className="field">Timezone<select defaultValue={data.companySettings?.timezone||'Asia/Kolkata'}><option>Asia/Kolkata</option></select></label></div><button className="button button-outline" onClick={()=>{update('companySettings',{...data.companySettings,name:company});window.alert('Company preferences saved.')}}>Save preferences</button></div><div className="settings-section"><span className="settings-icon"><Icon name="users"/></span><div className="settings-copy"><h2>Team & services</h2><p>Manage the founders and service directory.</p></div><button className="button button-outline" onClick={()=>navigate('team')}>View team</button><button className="button button-outline" onClick={()=>navigate('services')}>View services</button></div><div className="settings-section danger-zone"><span className="settings-icon"><Icon name="settings"/></span><div className="settings-copy"><h2>Reset demo workspace</h2><p>Restore the original sample clients, projects, payments and activity. This cannot be undone.</p></div>{confirmed?<div className="confirm-reset"><button className="button button-danger" onClick={()=>{reset();setConfirmed(false);setCompany('MAGAF Technologies')}}>Yes, reset demo data</button><button className="button button-quiet" onClick={()=>setConfirmed(false)}>Cancel</button></div>:<button className="button button-danger" onClick={()=>setConfirmed(true)}>Reset demo data</button>}</div><div className="settings-footnote"><span><i className="demo-dot"/> DEMO MODE · {data.clients.length} client records · Local browser storage</span><small>No backend or external services connected.</small></div></section></div>
}
function AppGate(){const {user}=useAuth();return user?.kind==='CLIENT'?<ClientPortal/>:user?<Workspace/>:<LoginScreen/>}
export default function App(){return <AuthProvider><DataProvider><AppGate/></DataProvider></AuthProvider>}
