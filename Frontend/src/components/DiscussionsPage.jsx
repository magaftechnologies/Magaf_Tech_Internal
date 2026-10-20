import { useEffect, useMemo, useState } from 'react'
import { discussionsApi } from '../api/discussions.api'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import Icon from './Icon'

const idOf = (value) => typeof value === 'object' ? value?.id || value?._id : value
const normalizeDiscussion = (discussion) => ({
  ...discussion,
  id: idOf(discussion.id || discussion._id),
  serviceId: idOf(discussion.serviceId),
  createdById: idOf(discussion.createdBy),
  createdByName: discussion.createdBy?.name || 'Team member',
  participants: (discussion.participants || []).map((person) => ({ id: idOf(person), name: person.name })),
})
const dateLabel = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export default function DiscussionsPage({ id, navigate }) {
  const { user } = useAuth()
  const { data, addFile, refresh } = useData()
  const [discussions, setDiscussions] = useState([])
  const [messages, setMessages] = useState([])
  const [messageThreadId, setMessageThreadId] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [participants, setParticipants] = useState([])
  const [reply, setReply] = useState('')
  const [files, setFiles] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState([])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await discussionsApi.getAll()
      setDiscussions((rows || []).map(normalizeDiscussion))
    } catch (failure) {
      setError(failure.message || 'Discussions could not be loaded.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let alive = true
    discussionsApi.getAll()
      .then((rows) => { if (alive) setDiscussions((rows || []).map(normalizeDiscussion)) })
      .catch((failure) => { if (alive) setError(failure.message || 'Discussions could not be loaded.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  const selected = discussions.find((discussion) => discussion.id === id)
  const selectedMessages = messageThreadId === selected?.id ? messages : []
  useEffect(() => {
    const selectedId = selected?.id
    if (!selectedId) return undefined
    let alive = true
    discussionsApi.getMessages(selectedId)
      .then((rows) => { if (alive) { setMessages(rows || []); setMessageThreadId(selectedId) } })
      .catch((failure) => { if (alive) setError(failure.message || 'Replies could not be loaded.') })
    return () => { alive = false }
  }, [selected?.id])

  const filtered = useMemo(() => discussions.filter((discussion) => {
    const matchesText = `${discussion.title} ${discussion.category || ''} ${discussion.createdByName}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (!serviceFilter || discussion.serviceId === serviceFilter) && (!statusFilter || discussion.status === statusFilter)
  }), [discussions, query, serviceFilter, statusFilter])
  const serviceName = (current) => data.services.find((service) => service.id === current.serviceId)?.shortName || 'Service'

  const create = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await discussionsApi.create({ title, serviceId, category, description, participants })
      const normalized = normalizeDiscussion(created)
      setCreating(false)
      setTitle('')
      setCategory('')
      setDescription('')
      setParticipants([])
      await load()
      navigate(`discussions/${normalized.id}`)
    } catch (failure) {
      setError(failure.message || 'Discussion could not be created.')
    } finally {
      setSaving(false)
    }
  }
  const submitReply = async (event) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      let attachments = uploadedFiles
      for (const file of files) {
        const uploaded = await addFile({
          discussionId: selected.id,
          rawFile: file,
          name: file.name,
          category: file.type.startsWith('image/') ? 'input' : file.type.startsWith('video/') ? 'reference' : 'other',
          description: `Shared in ${selected.title}`,
          visibility: 'Internal',
        })
        if (!uploaded?.id) throw new Error(`Could not upload ${file.name}.`)
        attachments = [...attachments, uploaded.id]
        setUploadedFiles(attachments)
      }
      const newMessage = await discussionsApi.postMessage(selected.id, { content: reply, attachments })
      setMessages((current) => [...current, newMessage])
      setMessageThreadId(selected.id)
      setReply('')
      setFiles([])
      setUploadedFiles([])
      await load()
      await refresh()
    } catch (failure) {
      setError(failure.message || 'Reply could not be sent.')
    } finally {
      setSaving(false)
    }
  }
  const updateStatus = async (status) => {
    try {
      const updated = normalizeDiscussion(await discussionsApi.update(selected.id, { status }))
      setDiscussions((current) => current.map((discussion) => discussion.id === updated.id ? updated : discussion))
    } catch (failure) {
      setError(failure.message || 'Discussion status could not be updated.')
    }
  }
  const archive = async () => {
    if (!selected || !window.confirm(`Archive "${selected.title}"? Its discussion history will remain stored.`)) return
    try {
      await discussionsApi.archive(selected.id)
      await load()
      navigate('discussions')
    } catch (failure) {
      setError(failure.message || 'Discussion could not be archived.')
    }
  }
  const editReply = async (message) => {
    const content = window.prompt('Edit your reply', message.content || '')
    if (content === null || content.trim() === (message.content || '')) return
    try {
      const updated = await discussionsApi.updateMessage(selected.id, message.id || message._id, { content })
      setMessages((current) => current.map((item) => (item.id || item._id) === (updated.id || updated._id) ? updated : item))
    } catch (failure) {
      setError(failure.message || 'Reply could not be edited.')
    }
  }
  const deleteReply = async (message) => {
    if (!window.confirm('Remove this reply? The action will remain in the audit history.')) return
    try {
      const removed = await discussionsApi.deleteMessage(selected.id, message.id || message._id)
      setMessages((current) => current.map((item) => (item.id || item._id) === (removed.id || removed._id) ? removed : item))
    } catch (failure) {
      setError(failure.message || 'Reply could not be removed.')
    }
  }
  const editTitle = async () => {
    const nextTitle = window.prompt('Edit discussion title', selected.title)
    if (nextTitle === null || !nextTitle.trim() || nextTitle.trim() === selected.title) return
    try {
      const updated = normalizeDiscussion(await discussionsApi.update(selected.id, { title: nextTitle }))
      setDiscussions((current) => current.map((discussion) => discussion.id === updated.id ? updated : discussion))
    } catch (failure) {
      setError(failure.message || 'Discussion could not be edited.')
    }
  }

  return <div className="page-stack discussion-page">
    <div className="page-heading"><div><span className="eyebrow">SERVICE-WISE COLLABORATION</span><h1>Discussions</h1><p>Persistent internal threads for growing and operating each MAGAF service.</p></div>{['admin', 'super_admin'].includes(user?.role) && <button className="button button-primary" onClick={() => setCreating((value) => !value)}><Icon name="plus" size={15}/>{creating ? 'Close' : 'New discussion'}</button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {creating && <form className="panel form-grid" onSubmit={create}>
      <label className="field">Discussion title<input required maxLength="200" value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <label className="field">Service<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Choose service</option>{data.services.filter((service) => service.status === 'Active').map((service) => <option key={service.id} value={service.id}>{service.shortName}</option>)}</select></label>
      <label className="field">Topic / category<input maxLength="120" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Growth, delivery, curriculum…"/></label>
      <label className="field">Participants<select multiple value={participants} onChange={(event) => setParticipants(Array.from(event.target.selectedOptions, (option) => option.value))}>{data.teamMembers.filter((member) => member.id !== user.id).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label className="field">Opening message<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="3"/></label>
      <button className="button button-primary" disabled={saving || !serviceId || !title.trim()}>{saving ? 'Creating…' : 'Create discussion'}</button>
    </form>}
    <div className="record-filters"><input aria-label="Search discussions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions…"/><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="">All services</option>{data.services.map((service) => <option key={service.id} value={service.id}>{service.shortName}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div>
    <div className="dashboard-grid">
      <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">SERVICE THREADS</span><h2>{filtered.length} discussions</h2></div></div>{loading ? <p>Loading discussions…</p> : filtered.length ? filtered.map((discussion) => <button key={discussion.id} className={`detail-list-row ${id === discussion.id ? 'selected' : ''}`} onClick={() => navigate(`discussions/${discussion.id}`)}><span className="avatar">{serviceName(discussion).slice(0, 1)}</span><span><strong>{discussion.title}</strong><small>{serviceName(discussion)} · {discussion.status.replaceAll('_', ' ')} · {dateLabel(discussion.lastActivityAt)}</small></span><Icon name="arrow" size={15}/></button>) : <div className="empty-state"><h3>No discussions found</h3><p>Create a service thread to begin a persistent discussion.</p></div>}</section>
      <section className="panel">
        {selected ? <><div className="panel-heading"><div><span className="eyebrow">{serviceName(selected)} · {selected.category || 'DISCUSSION'}</span><h2>{selected.title}</h2><small>Started by {selected.createdByName} · {dateLabel(selected.createdAt)}</small></div><div className="detail-actions">{(selected.createdById === user.id || ['admin', 'super_admin'].includes(user.role)) && <button className="button button-outline" onClick={editTitle}>Edit title</button>}<select aria-label="Discussion status" value={selected.status} onChange={(event) => updateStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select>{(selected.createdById === user.id || ['admin', 'super_admin'].includes(user.role)) && <button className="button button-outline" onClick={archive}>Archive</button>}</div></div><div className="discussion-history">{selectedMessages.map((message) => <article key={message.id || message._id} className="discussion-message"><div><strong>{message.senderId?.name || 'Team member'}</strong><small>{dateLabel(message.createdAt)}{message.updatedAt !== message.createdAt ? ' · edited' : ''}</small>{!message.isDeleted && (message.senderId?.id === user.id || ['admin', 'super_admin'].includes(user.role)) && <><button className="mini-action" type="button" onClick={() => editReply(message)}>Edit</button><button className="mini-action" type="button" onClick={() => deleteReply(message)}>Delete</button></>}</div>{message.isDeleted ? <p>This reply was removed.</p> : message.content && <p>{message.content}</p>}{!message.isDeleted && (message.attachments || []).map((attachment) => <a key={attachment.id || attachment._id} href={attachment.cloudinaryUrl} target="_blank" rel="noreferrer">{attachment.originalName || attachment.fileName}</a>)}</article>)}</div><form className="team-chat-composer" onSubmit={submitReply}><label className="chat-attach-button" title="Attach internal files"><Icon name="paperclip" size={17}/><input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,video/mp4,video/webm,video/quicktime" onChange={(event) => setFiles(Array.from(event.target.files || []))}/></label><input aria-label="Write a discussion reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Continue this service discussion…"/><button className="button button-primary" disabled={saving || (!reply.trim() && !files.length && !uploadedFiles.length)}>{saving ? 'Sending…' : 'Reply'}</button>{files.length > 0 && <small>{files.map((file) => file.name).join(', ')}</small>}{uploadedFiles.length > 0 && <small>{uploadedFiles.length} file(s) uploaded; submit to attach</small>}</form></> : <div className="empty-state"><h3>Select a discussion</h3><p>Choose a service thread to review its history and add a reply.</p></div>}
      </section>
    </div>
  </div>
}
