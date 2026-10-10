import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import { env } from './config/environment.js'
import apiRoutes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'

const app = express()
const allowedOrigins = env.clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean)

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  
  origin(origin, callback) {
  
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { statusCode: 403 }))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/')) return next()
  const unsafeKey = (value) => {
    if (!value || typeof value !== 'object') return false
    return Object.entries(value).some(([key, nested]) => key.startsWith('$') || key.includes('.') || unsafeKey(nested))
  }
  if (unsafeKey(req.body)) return res.status(400).json({ success: false, message: 'Unsafe request field detected.', errors: [] })
  return next()
})
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => env.nodeEnv === 'test' }))
app.get('/health', (_req, res) => res.json({ success: true, message: 'MAGAF API is healthy.', data: { database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', environment: env.nodeEnv } }))
app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)

export default app
