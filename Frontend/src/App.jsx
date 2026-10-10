import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import AppLayout from './components/AppLayout'
import Dashboard from './components/Dashboard'
import RecordsPage from './components/RecordsPage'
import RecordDetail from './components/RecordDetail'
import RecordModal from './components/RecordModal'
import ClientPortal from './components/ClientPortal'
import TeamMessages from './components/TeamMessages'
import AccountSecurity from './components/AccountSecurity'
import FinanceProfile from './components/FinanceProfile'
import Icon from './components/Icon'
import './App.css'
import './integration.css'

function LoginScreen() {
  const { login } = useAuth()
  const [accountType, setAccountType] = useState('TEAM')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login({ email, password, remember })
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in. Check your credentials and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-screen"><div className="login-aside"><div className="login-brand"><span className="brand-mark">M<span>.</span></span><span><b>MAGAF</b><small>TECHNOLOGIES</small></span></div><div className="login-story"><span className="eyebrow">THE OPERATING SYSTEM FOR WHAT'S NEXT</span><h1>Build with<br/><em>intention.</em></h1><p>One workspace for the work, relationships and momentum behind MAGAF.</p><div className="login-orbit"><span className="orbit-center">M</span><span className="orbit-tag orbit-one">Marketing</span><span className="orbit-tag orbit-two">Automation</span><span className="orbit-tag orbit-three">Growth</span><span className="orbit-tag orbit-four">Future</span></div></div><span className="login-quote">“Small, thoughtful steps create remarkable momentum.”</span></div><section className="login-main"><div className="login-form-wrap"><span className="demo-tag"><i/> {accountType==='TEAM'?'INTERNAL TEAM ACCESS':'CLIENT PORTAL ACCESS'}</span><h2>{accountType==='TEAM'?'Welcome back':'Welcome to your portal'}</h2><p>{accountType==='TEAM'?'Sign in to your MAGAF workspace.':'View your projects, files and shared deliverables.'}</p><div className="account-switch"><button className={accountType==='TEAM'?'selected':''} onClick={()=>{setAccountType('TEAM');setError('')}}>Team workspace</button><button className={accountType==='CLIENT'?'selected':''} onClick={()=>{setAccountType('CLIENT');setError('')}}>Client portal</button></div><form onSubmit={submit}><label className="field">Email address<input type="email" required autoComplete="username" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder={accountType==='TEAM'?'name@magaf.in':'you@company.com'}/></label><label className="field">Password<div className="password-wrap"><input type={showPassword?'text':'password'} required autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div></label><div className="login-options"><label><input type="checkbox" checked={remember} onChange={(event)=>setRemember(event.target.checked)}/> Remember me</label><button type="button" onClick={()=>setError('For password assistance, contact a MAGAF administrator.')}>Forgot password?</button></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button button-primary login-submit" disabled={busy}>{busy?'Signing in…':`Continue to ${accountType==='TEAM'?'workspace':'client portal'}`} <Icon name="arrow" size={16}/></button></form><div className="login-demo-note"><Icon name="shield" size={16}/><span><b>Secure internal access</b><small>Sign-in is verified by the MAGAF backend. Your role controls workspace access.</small></span></div><span className="login-copyright">© 2026 MAGAF Technologies · Internal use only</span></div></section></main>
}

function Workspace() {
  const [route,setRoute]=useState(()=>location.hash.replace(/^#\/?/,'')||'dashboard')
  const [modal,setModal]=useState(null)
  useEffect(()=>{const updateRoute=()=>setRoute(location.hash.replace(/^#\/?/,'')||'dashboard');window.addEventListener('hashchange',updateRoute);return()=>window.removeEventListener('hashchange',updateRoute)},[])
  const navigate=(path)=>{location.hash=`/${path}`;setRoute(path)}
  const quickAdd=(type,initial={},recordId)=>setModal({type,initial,recordId})
  const [routePath,routeQuery='']=route.split('?')
  const [page,id,subId]=routePath.split('/')
  const routeParams=new URLSearchParams(routeQuery)
  let content
  if(page==='dashboard'||!page)content=<Dashboard navigate={navigate} quickAdd={quickAdd}/>
  else if(page==='messages')content=<TeamMessages key={id||'all'} conversationId={id}/>
  else if(page==='finance'&&id==='company')content=<FinanceProfile ownerType="company" navigate={navigate}/>
  else if(page==='finance'&&id==='founders'&&subId)content=<FinanceProfile ownerType="founder" ownerId={subId} navigate={navigate}/>
  else if(id)content=<RecordDetail type={page} id={id} navigate={navigate} quickAdd={quickAdd} focusPaymentId={routeParams.get('payment')} autoOpenDistribution={routeParams.get('distribution')==='1'}/>
  else if(page==='settings')content=<Settings navigate={navigate}/>
  else content=<RecordsPage page={page} navigate={navigate} quickAdd={quickAdd} initialRecipient={routeParams.get('recipient')}/>
  return <><AppLayout route={routePath} navigate={navigate}>{content}</AppLayout>{modal&&<RecordModal type={modal.type} initial={modal.initial} recordId={modal.recordId} onClose={()=>setModal(null)} onSaved={(record,recordType)=>{if(recordType==='payments'&&record.isFinalPayment&&record.projectId)navigate(`projects/${record.projectId}?payment=${record.id}&distribution=1`)}}/>}</>
}

function Settings({navigate}) {
  const {user}=useAuth()
  const {data,refresh,savePaymentAccount}=useData()
  const canManageFinance=['super_admin','admin','finance'].includes(user.role)
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">WORKSPACE PREFERENCES</span><h1>Settings</h1><p>Manage your MAGAF workspace access and data connection.</p></div></div><section className="panel settings-panel"><div className="settings-section"><span className="settings-icon"><Icon name="briefcase"/></span><div className="settings-copy"><h2>Company profile</h2><p>Workspace identity and regional preferences.</p></div><div className="settings-fields"><label className="field">Company name<input value={data.companySettings.name} readOnly/></label><label className="field">Default currency<input value="INR · Indian Rupee" readOnly/></label><label className="field">Signed in as<input value={`${user.name} · ${user.role.replaceAll('_',' ')}`} readOnly/></label></div></div><div className="settings-section"><span className="settings-icon"><Icon name="users"/></span><div className="settings-copy"><h2>Team & services</h2><p>Manage the founders and service directory.</p></div><button className="button button-outline" onClick={()=>navigate('team')}>View team</button><button className="button button-outline" onClick={()=>navigate('services')}>View services</button></div><div className="settings-section"><span className="settings-icon"><Icon name="refresh"/></span><div className="settings-copy"><h2>Backend data</h2><p>Business records are synchronized with MAGAF's API and database.</p></div><button className="button button-outline" onClick={refresh}>Refresh data</button></div><div className="settings-footnote"><span><i className="live-dot"/> LIVE BACKEND · {data.clients.length} client records in this workspace</span><small>Operational records are never stored as local demo data.</small></div></section><PaymentAccountsSettings accounts={data.paymentAccounts||[]} saveAccount={savePaymentAccount} canManage={canManageFinance}/>{['super_admin','admin'].includes(user.role)&&<FinanceAuditPanel entries={data.financeAudit||[]}/>}<AccountSecurity/></div>
}

function PaymentAccountsSettings({accounts,saveAccount,canManage}){
  const empty={name:'',method:'upi',accountHolder:'',bankName:'',accountNumber:'',ifscCode:'',upiId:'',instructions:'',internalNotes:'',displayOrder:0}
  const [draft,setDraft]=useState(empty)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const save=async(event)=>{
    event.preventDefault()
    setBusy(true);setError('')
    try{await saveAccount(draft);setDraft(empty)}
    catch(saveError){setError(saveError.message||'Payment account could not be saved.')}
    finally{setBusy(false)}
  }
  const edit=(account)=>setDraft({...empty,...account})
  const deactivate=async(account)=>{
    if(!window.confirm(`Deactivate ${account.name}? Clients will no longer see it.`))return
    try{await saveAccount({...account,isActive:false})}
    catch(saveError){setError(saveError.message||'Payment account could not be deactivated.')}
  }
  return <section className="panel finance-settings-panel"><div className="panel-heading"><div><span className="eyebrow">CLIENT BILLING</span><h2>Payment accounts & instructions</h2><p>Only active accounts and their client-ready instructions are shown in the client portal.</p></div></div><div className="finance-account-list">{accounts.map((account)=><article className="finance-account-card" key={account.id}><div><strong>{account.name}</strong><span className="status-pill">{account.isActive?'Active':'Inactive'}</span><p>{account.method==='upi'?`UPI · ${account.upiId||'—'}`:account.method==='bank_transfer'?`${account.bankName||'Bank'} · ${account.accountHolder||'—'} · ${account.accountNumber||'—'} · ${account.ifscCode||'—'}`:account.method}</p>{account.instructions&&<small>{account.instructions}</small>}</div>{canManage&&<div className="finance-account-actions"><button className="button button-outline button-small" onClick={()=>edit(account)}>Edit</button>{account.isActive&&<button className="button button-outline button-small" onClick={()=>deactivate(account)}>Deactivate</button>}</div>}</article>)}{!accounts.length&&<p className="finance-hint">No payment accounts have been configured.</p>}</div>{canManage&&<form className="client-request-form finance-account-form" onSubmit={save}><h3 className="span-two">{draft.id?'Edit payment account':'Add payment account'}</h3><label className="field">Display name<input required maxLength="100" value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})}/></label><label className="field">Payment method<select value={draft.method} onChange={(event)=>setDraft({...draft,method:event.target.value})}>{[['upi','UPI'],['bank_transfer','Bank transfer'],['cash','Cash'],['other','Other']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{draft.method==='bank_transfer'&&<><label className="field">Bank name<input value={draft.bankName||''} onChange={(event)=>setDraft({...draft,bankName:event.target.value})}/></label><label className="field">Account holder<input value={draft.accountHolder||''} onChange={(event)=>setDraft({...draft,accountHolder:event.target.value})}/></label><label className="field">Account number<input value={draft.accountNumber||''} onChange={(event)=>setDraft({...draft,accountNumber:event.target.value})}/></label><label className="field">IFSC code<input value={draft.ifscCode||''} onChange={(event)=>setDraft({...draft,ifscCode:event.target.value.toUpperCase()})}/></label></>}{draft.method==='upi'&&<label className="field">UPI ID<input required value={draft.upiId||''} onChange={(event)=>setDraft({...draft,upiId:event.target.value})}/></label>}<label className="field span-two">Client payment instructions<textarea maxLength="2000" rows="2" value={draft.instructions||''} onChange={(event)=>setDraft({...draft,instructions:event.target.value})}/></label><label className="field span-two">Internal notes (not shown to clients)<textarea maxLength="2000" rows="2" value={draft.internalNotes||''} onChange={(event)=>setDraft({...draft,internalNotes:event.target.value})}/></label>{error&&<p className="form-error span-two" role="alert">{error}</p>}<div className="client-request-form-actions span-two"><button className="button button-primary" disabled={busy}>{busy?'Saving…':draft.id?'Save account':'Add account'}</button>{draft.id&&<button className="button button-outline" type="button" onClick={()=>setDraft(empty)}>Cancel edit</button>}</div></form>}</section>
}

function FinanceAuditPanel({entries}){
  return <section className="panel finance-audit-panel"><div className="panel-heading"><div><span className="eyebrow">FINANCIAL CONTROLS</span><h2>Immutable finance audit history</h2><p>Before/after snapshots for payment updates, account changes, distribution rules and disputes.</p></div></div>{entries.length?<div className="table-scroll"><table><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Payment / project</th><th>Change snapshot</th></tr></thead><tbody>{entries.slice(0,50).map((entry)=><tr key={entry.id||entry._id}><td>{entry.createdAt?new Date(entry.createdAt).toLocaleString('en-IN'):''}</td><td>{entry.action}</td><td>{entry.actor?.name||'Team'}</td><td>{entry.paymentId?.paymentCode||entry.projectId?.projectName||'Finance record'}</td><td><code>{JSON.stringify({before:entry.before,after:entry.after})}</code></td></tr>)}</tbody></table></div>:<p className="finance-hint">Finance changes will be recorded here.</p>}</section>
}

function AppGate() {
  const {user,loading:authLoading}=useAuth()
  const {loading:dataLoading,error,dismissError}=useData()
  if(authLoading)return <main className="login-screen"><div className="loading-state">Restoring secure session…</div></main>
  if(!user)return <LoginScreen/>
  if(user.mustChangePassword)return <AccountSecurity forceChange/>
  if(dataLoading)return <main className="login-screen"><div className="loading-state">Loading your MAGAF workspace…</div></main>
  if(user.kind==='CLIENT')return <><ClientPortal/>{error&&<div className="api-error-banner" role="alert"><span>{error}</span><button onClick={dismissError} aria-label="Dismiss error">×</button></div>}</>
  return <><Workspace/>{error&&<div className="api-error-banner" role="alert"><span>{error}</span><button onClick={dismissError} aria-label="Dismiss error">×</button></div>}</>
}

export default function App(){return <AuthProvider><DataProvider><AppGate/></DataProvider></AuthProvider>}
