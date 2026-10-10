import { env } from '../config/environment.js'

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, errors: [] })
}

export function errorHandler(error, req, res, _next) {
  const status = error.statusCode || (error.name === 'MulterError' ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 : error.name === 'ValidationError' || error.name === 'CastError' ? 400 : error.code === 11000 ? 409 : 500)
  const message = error.code === 11000 ? 'A record with that unique value already exists.' : error.message || 'Internal server error.'
  if (env.nodeEnv !== 'test') console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, error)
  const errors = error.errors ? Object.values(error.errors).map((item) => ({ field: item.path, message: item.message })) : []
  res.status(status).json({ success: false, message, errors, ...(env.nodeEnv === 'development' ? { stack: error.stack } : {}) })
}
