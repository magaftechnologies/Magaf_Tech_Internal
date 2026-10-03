import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import Icon from './Icon'
import { MessageBubble } from './ClientPortal'

const readFile=(file)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('File read failed'));reader.readAsDataURL(file)})

export default function TeamMessages({conversationId:routeConversationId}){
  const {user}=useAuth()
  const {data,ensureConversation,sendMessage,markConversationRead,addFile}=useData()
  const [selectedId,setSelectedId]=useState(routeConversationId||'')
  const [text,setText]=useState('')
  const [files,setFiles]=useState([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const conversations=data.conversations.slice().sort((a,b)=>String(b.lastMessageAt||'').localeCompare(String(a.lastMessageAt||'')))
  const selected=conversations.find((item)=>item.id===selectedId)
  const messages=data.messages.filter((item)=>item.conversationId===selectedId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
  const unread=(conversation)=>data.messages.filter((item)=>item.conversationId===conversation.id&&item.senderRole==='CLIENT'&&!(item.readReceipts||[]).some((receipt)=>receipt.userId===user.id)).length
  const client=data.clients.find((item)=>item.id===selected?.clientId)
  const project=data.projects.find((item)=>item.id===selected?.projectId)
  useEffect(()=>{if(selected)markConversationRead(selected.id)},[selectedId,data.messages.length,selected,markConversationRead])
  const createGeneral=()=>{
    const defaultClient=data.clients[0]
    if(!defaultClient)return
    const conversation=ensureConversation(defaultClient.id)
    setSelectedId(conversation.id)
  }
  const submit=async(event)=>{
    event.preventDefault()
    if(!selected)return
    setBusy(true)
    setError('')
    try{
      const attachments=[]
      for(const file of files){
        if(file.size>1_500_000)throw new Error(`${file.name} exceeds the 1.5 MB local-demo limit; use a shared external link instead.`)
        const record=addFile({clientId:selected.clientId,projectId:selected.projectId||undefined,projectRequestId:selected.projectRequestId||undefined,conversationId:selected.id,name:file.name,type:file.type||'File',size:file.size,fileData:await readFile(file),category:file.type?.startsWith('audio/')?'Audio':file.type?.startsWith('video/')?'Video':file.type?.startsWith('image/')?'Image':'Document',uploadedBy:'MAGAF Team',uploadedAt:new Date().toISOString().slice(0,10),visibility:'Client',description:'Shared in a MAGAF conversation'})
        attachments.push({id:record.id,name:record.name,type:record.type,url:record.fileData})
      }
      sendMessage({conversationId:selected.id,text,attachments})
      setText('')
      setFiles([])
    }catch(failure){console.error('Unable to send team message.',failure);setError(failure.message||'Could not send this message.')}
    finally{setBusy(false)}
  }
  return <div className="page-stack team-message-page">
    <div className="page-heading"><div><span className="eyebrow">CLIENT COMMUNICATION</span><h1>Messages</h1><p>Client and project conversations shared with the client portal.</p></div><button className="button button-outline" onClick={createGeneral}><Icon name="plus" size={15}/>Start general conversation</button></div>
    <section className="team-chat-layout panel">
      <aside className="team-chat-list"><div className="team-chat-list-title"><strong>Conversations</strong><span>{conversations.length}</span></div>{conversations.map((conversation)=>{const conversationClient=data.clients.find((item)=>item.id===conversation.clientId);const conversationProject=data.projects.find((item)=>item.id===conversation.projectId);const conversationRequest=data.projectRequests.find((item)=>item.id===conversation.projectRequestId);const count=unread(conversation);return <button className={`team-chat-conversation ${selectedId===conversation.id?'selected':''}`} key={conversation.id} onClick={()=>setSelectedId(conversation.id)}><span className="team-chat-avatar">{conversationClient?.name?.slice(0,1)||'M'}</span><span><strong>{conversationClient?.name||'Client'}</strong><small>{conversationProject?.name||conversationRequest?.projectName||(conversation.projectRequestId?'Project request':'General conversation')}</small><small>{conversation.lastMessage||'No messages yet'}</small></span>{count>0&&<b className="team-chat-unread">{count}</b>}</button>})}</aside>
      <section className="team-chat-content">{selected?<><header className="team-chat-header"><span className="team-chat-avatar">{client?.name?.slice(0,1)||'M'}</span><span><strong>{client?.name||'Client'}</strong><small>{project?`${project.name} · ${project.status}`:selected.projectRequestId?'Project request conversation':'General client conversation'}</small></span><span className="team-chat-mode"><i/>Shared demo data</span></header><div className="team-chat-messages">{messages.map((item)=><MessageBubble key={item.id} item={item} own={item.senderRole==='TEAM'}/>)}</div>{error&&<p className="form-error team-chat-error">{error}</p>}<form className="team-chat-composer" onSubmit={submit}><label className="chat-attach-button" title="Attach files"><Icon name="paperclip" size={17}/><input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,video/*,audio/*" onChange={(event)=>setFiles(Array.from(event.target.files||[]))}/></label><input aria-label="Write a team message" value={text} onChange={(event)=>setText(event.target.value)} placeholder="Write a message to this client…"/><button className="button button-primary" disabled={busy||(!text.trim()&&!files.length)}><Icon name="arrow" size={15}/>{busy?'Sending…':'Send'}</button>{files.length>0&&<small>{files.length} file{files.length===1?'':'s'} selected</small>}</form></>:<div className="team-chat-empty"><Icon name="message" size={26}/><h2>Select a conversation</h2><p>Client and project conversations will appear here when a client starts a message.</p></div>}</section>
    </section>
  </div>
}
