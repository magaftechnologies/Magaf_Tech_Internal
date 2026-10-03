const key = 'magaf-os-data-v1'
const read = () => {
  try { return JSON.parse(localStorage.getItem(key) || '{}') }
  catch (error) { console.error('Unable to read mock API data.', error); throw error }
}
const write = (collection, records) => {
  const data = read()
  localStorage.setItem(key, JSON.stringify({ ...data, [collection]: records }))
}
export const readMockData = read
export const writeMockCollection = write
export const createResourceApi = (collection) => ({
  async getAll() { return read()[collection] || [] },
  async getById(id) { return (read()[collection] || []).find((record) => record.id === id) || null },
  async create(record) { const created = { id: `${collection.slice(0,2)}-${Date.now()}`, ...record }; write(collection, [created, ...(read()[collection] || [])]); return created },
  async update(id, changes) { const records = read()[collection] || []; const next = records.map((record) => record.id === id ? { ...record, ...changes } : record); write(collection, next); return next.find((record) => record.id === id) || null },
  async remove(id) { const records = read()[collection] || []; write(collection, records.filter((record) => record.id !== id)) },
})
