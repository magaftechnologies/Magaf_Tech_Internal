export function paginationFromQuery(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25))
  return { page, limit, skip: (page - 1) * limit }
}

export function paginationMeta(total, page, limit) {
  return { page, limit, total, pages: Math.ceil(total / limit) }
}
