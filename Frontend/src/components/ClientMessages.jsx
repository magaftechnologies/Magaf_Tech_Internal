import Icon from './Icon'

export function MessageCenter({
  client,
  conversations,
  messages,
  projects,
  requests,
  selectedConversation,
  activeMessages,
  setConversation,
  text,
  setText,
  files,
  setFiles,
  send,
  busy,
  startGeneral,
  user,
}) {
  const conversationProject = (conversation) => projects.find((project) => project.id === conversation.projectId)
  const conversationRequest = (conversation) => requests.find((request) => request.id === conversation.projectRequestId)
  const allConversations = conversations.slice().sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')))

  return <div className="client-chat-layout">
    <aside className="client-chat-list">
      <div className="client-chat-list-head"><strong>Conversations</strong><button className="button button-outline button-small" onClick={startGeneral}>New general message</button></div>
      {allConversations.map((conversation) => {
        const project = conversationProject(conversation)
        const request = conversationRequest(conversation)
        const unread = messages.filter((item) => item.conversationId === conversation.id && item.senderRole === 'TEAM' && !(item.readReceipts || []).some((receipt) => receipt.userId === user.id)).length
        return <button className={`client-chat-conversation ${selectedConversation?.id === conversation.id ? 'selected' : ''}`} key={conversation.id} onClick={() => setConversation(conversation)}>
          <span className="client-chat-avatar">{(project?.name || request?.projectName)?.slice(0, 1) || client.name.slice(0, 1)}</span>
          <span><strong>{project?.name || request?.projectName || 'General conversation'}</strong><small>{conversation.lastMessage || 'No messages yet'}</small></span>
          <time>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}</time>
          {unread > 0 && <b className="client-nav-count">{unread}</b>}
        </button>
      })}
      {!allConversations.length && <MessageEmpty text="Your conversations will appear here."/>}
    </aside>
    <section className="client-chat-thread">
      {selectedConversation ? <>
        <header className="client-chat-header">
          <span className="client-chat-avatar"><Icon name="briefcase" size={16}/></span>
          <span><strong>{conversationProject(selectedConversation)?.name || conversationRequest(selectedConversation)?.projectName || 'MAGAF client team'}</strong><small>{conversationProject(selectedConversation) ? `${conversationProject(selectedConversation).status} · Project conversation` : conversationRequest(selectedConversation) ? 'Project request conversation' : 'General client conversation'}</small></span>
          <span className="client-demo-live"><i/>Secure conversation</span>
        </header>
        <div className="client-chat-messages">
          {activeMessages.map((item) => <MessageBubble key={item.id} item={item} own={item.senderRole === 'CLIENT'} clientView/>)}
          {!activeMessages.length && <MessageEmpty text="Start the conversation with your MAGAF team."/>}
        </div>
        <form className="client-chat-composer" onSubmit={send}>
          <label className="chat-attach-button" title="Attach files"><Icon name="paperclip" size={17}/><input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,application/zip,video/*,audio/*" onChange={(event) => setFiles(Array.from(event.target.files || []))}/></label>
          <input aria-label="Write a message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a project message…"/>
          <button type="submit" className="button button-primary" disabled={busy || (!text.trim() && !files.length)}><Icon name="arrow" size={15}/>{busy ? 'Sending…' : 'Send'}</button>
          {files.length > 0 && <small>{files.length} attachment{files.length === 1 ? '' : 's'} selected</small>}
        </form>
      </> : <div className="client-chat-empty"><Icon name="message" size={25}/><h2>Select a conversation</h2><p>Choose a project thread or start a general conversation with the MAGAF team.</p><button className="button button-primary" onClick={startGeneral}>Start general conversation</button></div>}
    </section>
  </div>
}

export function MessageBubble({ item, own, clientView = false, internal = false }) {
  const receipts = item.readReceipts || []
  const teamReaders = receipts.filter((receipt) => receipt.role === 'TEAM')
  const clientRead = receipts.some((receipt) => receipt.role === 'CLIENT')
  const author = internal ? `${own ? 'You' : item.senderName} · Team` : own ? `You · ${item.senderName}` : clientView ? `MAGAF Team · ${item.senderName}` : `${item.senderName} · Client`

  return <article className={`client-message-bubble ${own ? 'own' : ''}`}>
    <span className="client-message-author">{author}</span>
    <p>{item.text || 'Shared an attachment'}</p>
    {item.attachments?.map((attachment) => <a key={attachment.id || attachment.name} className="client-message-attachment" href={attachment.url || '#'} target="_blank" rel="noreferrer"><Icon name="file" size={14}/>{attachment.name}</a>)}
    <footer>
      <time>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</time>
      {clientView && own && (item.teamReadCount > 0 || teamReaders.length > 0) && <small>Seen by MAGAF Team</small>}
      {!clientView && own && clientRead && <small>Seen by client</small>}
      {!clientView && !own && teamReaders.length > 0 && <small>Seen by {teamReaders.map((reader) => reader.name).join(', ')}</small>}
      {!clientView && !own && clientRead && <small>Seen by client</small>}
    </footer>
  </article>
}

function MessageEmpty({ text }) {
  return <div className="client-empty"><span><Icon name="layers" size={20}/></span><p>{text}</p></div>
}
