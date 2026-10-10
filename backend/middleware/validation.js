export function requireFields(...fields) {
  return (req, _res, next) => {
    const missing = fields.filter((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === '')
    if (missing.length) {
      const error = new Error(`Required fields are missing: ${missing.join(', ')}`)
      error.statusCode = 400
      return next(error)
    }
    return next()
  }
}
