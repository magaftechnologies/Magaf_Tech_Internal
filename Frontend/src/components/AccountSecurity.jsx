import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Icon from './Icon'

export default function AccountSecurity({ forceChange = false }) {
  const { user, changePassword, logout } = useAuth()
  const [currentPassword,setCurrentPassword]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  const submit=async(event)=>{
    event.preventDefault()
    setError('')
    setMessage('')
    if(newPassword.length<10){setError('Use at least 10 characters for your new password.');return}
    if(newPassword!==confirmPassword){setError('The new passwords do not match.');return}
    setBusy(true)
    try{
      await changePassword({currentPassword,newPassword})
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated. Other active sessions have been signed out.')
    }catch(changeError){setError(changeError.message||'Unable to update your password.')}
    finally{setBusy(false)}
  }

  const form=<form className="client-request-form account-security-form" onSubmit={submit}>
    <label className="field">Current password<input type="password" autoComplete="current-password" minLength={6} required value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)}/></label>
    <label className="field">New password<input type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(event)=>setNewPassword(event.target.value)}/></label>
    <label className="field span-two">Confirm new password<input type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)}/></label>
    {error&&<p className="form-error span-two" role="alert">{error}</p>}
    {message&&<p className="form-success span-two" role="status">{message}</p>}
    <button className="button button-primary" disabled={busy}>{busy?'Updating…':'Update password'} <Icon name="arrow" size={15}/></button>
  </form>

  if(forceChange)return <main className="login-screen password-required"><section className="login-main"><div className="login-form-wrap"><span className="demo-tag"><i/> SECURE YOUR ACCOUNT</span><h2>Set a new password</h2><p>Your administrator-provided password is temporary. Change it before entering the workspace.</p>{form}<button type="button" className="button button-quiet" onClick={logout}>Sign out</button></div></section></main>
  return <section className="panel account-security-panel"><div className="panel-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2>Change password</h2></div><span className="security-user">{user.email}</span></div>{form}</section>
}
