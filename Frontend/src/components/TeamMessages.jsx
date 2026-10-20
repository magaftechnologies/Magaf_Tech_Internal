import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import Icon from './Icon'
import { MessageBubble } from './ClientMessages'

export default function TeamMessages({conversationId:routeConversationId}){
  const {user}=useAuth()
  const {data,ensureConversation,sendMessage,markConversationRead,addFile}=useData()
  const [selectedId,setSelectedId]=useState(routeConversationId||'')
  const [text,setText]=useState('')
  const [files,setFiles]=useState([])
  const [recipientId,setRecipientId]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const conversations=data.conversations.slice().sort((a,b)=>String(b.lastMessageAt||'').localeCompare(String(a.lastMessageAt||'')))
  const selected=conversations.find((item)=>item.id===selectedId)
  const messages=data.messages.filter((item)=>item.conversationId===selectedId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
  const unread=(conversation)=>data.messages.filter((item)=>item.conversationId===conversation.id&&(item.senderRole==='CLIENT'||conversation.conversationType==='internal')&&item.senderId!==user.id&&!(item.readReceipts||[]).some((receipt)=>receipt.userId===user.id)).length
  const client=data.clients.find((item)=>item.id===selected?.clientId)
  const project=data.projects.find((item)=>item.id===selected?.projectId)
  const teammate=(conversation)=>conversation?.participants?.find((participant)=>participant.userId!==user.id)?.user||null
  useEffect(()=>{if(selected)markConversationRead(selected.id)},[selectedId,data.messages.length,selected,markConversationRead])
  const createGeneral=async()=>{
    const defaultClient=data.clients[0]
    if(!defaultClient)return
    try{
      const conversation=await ensureConversation(defaultClient.id)
      if(conversation)setSelectedId(conversation.id)
      else setError('A general conversation could not be started.')
    }catch(failure){console.error('Unable to start general conversation.',failure);setError(failure.message||'A general conversation could not be started.')}
  }
  const createInternal=async()=>{
    if(!recipientId)return
    try{
      const conversation=await ensureConversation({recipientId})
      if(conversation)setSelectedId(conversation.id)
      else setError('A team conversation could not be started.')
    }catch(failure){console.error('Unable to start team conversation.',failure);setError(failure.message||'A team conversation could not be started.')}
  }
  const submit=async(event)=>{
    event.preventDefault()
    if(!selected)return
    setBusy(true)
    setError('')
    try{
      const attachments=[]
      for(const file of files){
        const record=await addFile({clientId:selected.clientId,projectId:selected.projectId||undefined,projectRequestId:selected.projectRequestId||undefined,conversationId:selected.conversationType==='internal'?selected.id:undefined,rawFile:file,name:file.name,type:file.type||'File',category:file.type?.startsWith('audio/')?'Audio':file.type?.startsWith('video/')?'Video':file.type?.startsWith('image/')?'Image':'Document',visibility:selected.conversationType==='internal'?'Internal':'Client',description:'Shared in a MAGAF conversation'})
        if(!record)throw new Error('An attachment could not be uploaded.')
        attachments.push(record)
      }
      const sent=await sendMessage({conversationId:selected.id,text,attachments})
      if(!sent)throw new Error('The message could not be sent.')
      setText('')
      setFiles([])
    }catch(failure){console.error('Unable to send team message.',failure);setError(failure.message||'Could not send this message.')}
    finally{setBusy(false)}
  }
  return <div className="page-stack team-message-page">
    <div className="page-heading"><div><span className="eyebrow">TEAM & CLIENT COMMUNICATION</span><h1>Messages</h1><p>Private team chats and client/project conversations in one place.</p></div><div className="detail-actions"><select aria-label="Choose teammate" value={recipientId} onChange={(event)=>setRecipientId(event.target.value)}><option value="">Choose teammate</option>{data.teamMembers.filter((member)=>member.id!==user.id).map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select><button className="button button-outline" onClick={createInternal} disabled={!recipientId}><Icon name="plus" size={15}/>Start team chat</button><button className="button button-outline" onClick={createGeneral}><Icon name="plus" size={15}/>Start client conversation</button></div></div>
    <section className="team-chat-layout panel">
      <aside className="team-chat-list"><div className="team-chat-list-title"><strong>Conversations</strong><span>{conversations.length}</span></div>{conversations.map((conversation)=>{const conversationClient=data.clients.find((item)=>item.id===conversation.clientId);const person=teammate(conversation);const conversationProject=data.projects.find((item)=>item.id===conversation.projectId);const conversationRequest=data.projectRequests.find((item)=>item.id===conversation.projectRequestId);const count=unread(conversation);return <button className={`team-chat-conversation ${selectedId===conversation.id?'selected':''}`} key={conversation.id} onClick={()=>setSelectedId(conversation.id)}><span className="team-chat-avatar">{(person?.name||conversationClient?.name)?.slice(0,1)||'M'}</span><span><strong>{person?.name||conversationClient?.name||'Client'}</strong><small>{conversation.conversationType==='internal'?'Internal team chat':conversationProject?.name||conversationRequest?.projectName||(conversation.projectRequestId?'Project request':'General conversation')}</small><small>{conversation.lastMessage||'No messages yet'}</small></span>{count>0&&<b className="team-chat-unread">{count}</b>}</button>})}</aside>
      <section className="team-chat-content">{selected?<><header className="team-chat-header"><span className="team-chat-avatar">{(selected.conversationType==='internal'?teammate(selected)?.name:client?.name)?.slice(0,1)||'M'}</span><span><strong>{selected.conversationType==='internal'?teammate(selected)?.name||'Team member':client?.name||'Client'}</strong><small>{selected.conversationType==='internal'?'Private internal conversation':project?`${project.name} · ${project.status}`:selected.projectRequestId?'Project request conversation':'General client conversation'}</small></span><span className="team-chat-mode"><i/>Live backend</span></header><div className="team-chat-messages">{messages.map((item)=><MessageBubble key={item.id} item={item} own={item.senderId===user.id} internal={selected.conversationType==='internal'}/>)}</div>{error&&<p className="form-error team-chat-error">{error}</p>}<form className="team-chat-composer" onSubmit={submit}><label className="chat-attach-button" title="Attach files"><Icon name="paperclip" size={17}/><input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,video/*,audio/*" onChange={(event)=>setFiles(Array.from(event.target.files||[]))}/></label><input aria-label="Write a message" value={text} onChange={(event)=>setText(event.target.value)} placeholder={selected.conversationType==='internal'?'Write a private team message…':'Write a message to this client…'}/><button className="button button-primary" disabled={busy||(!text.trim()&&!files.length)}><Icon name="arrow" size={15}/>{busy?'Sending…':'Send'}</button>{files.length>0&&<small>{files.length} file{files.length===1?'':'s'} selected</small>}</form></>:<div className="team-chat-empty"><Icon name="message" size={26}/><h2>Select a conversation</h2><p>Start a private team chat or open a client conversation.</p></div>}</section>
    </section>
  </div>
}
