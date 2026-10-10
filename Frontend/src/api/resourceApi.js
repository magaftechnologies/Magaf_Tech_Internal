import { apiData, listAll } from './http'

export function createResourceApi(resource, route = resource) {
  return {
    getAll: (query) => listAll(`/${route}`, query),
    getById: (id) => apiData(`/${route}/${encodeURIComponent(id)}`),
    create: (record) => apiData(`/${route}`, { method: 'POST', body: record }),
    update: (id, changes) => apiData(`/${route}/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
    remove: (id) => apiData(`/${route}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    resource,
  }
}
