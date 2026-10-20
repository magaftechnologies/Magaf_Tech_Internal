import { apiData } from './http'

export const discussionsApi = {
  getAll: () => apiData('/discussions'),
  create: (discussion) => apiData('/discussions', { method: 'POST', body: discussion }),
  getMessages: (id) => apiData(`/discussions/${encodeURIComponent(id)}/messages`),
  postMessage: (id, message) => apiData(`/discussions/${encodeURIComponent(id)}/messages`, { method: 'POST', body: message }),
  updateMessage: (id, messageId, changes) => apiData(`/discussions/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: changes }),
  deleteMessage: (id, messageId) => apiData(`/discussions/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }),
  update: (id, changes) => apiData(`/discussions/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  archive: (id) => apiData(`/discussions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
