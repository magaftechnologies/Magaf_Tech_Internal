import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'
import { env } from '../config/environment.js'

export async function authenticate(req, _res, next) {
  try {
    const [scheme, token] = String(req.headers.authorization || '').split(' ')
    if (scheme !== 'Bearer' || !token) {
      const error = new Error('Authentication required.')
      error.statusCode = 401
      throw error
    }
    const payload = jwt.verify(token, env.jwtSecret)
    const user = await User.findById(payload.sub).select('-passwordHash')
    if (!user || !user.isActive || (payload.ver ?? 0) !== (user.tokenVersion || 0)) {
      const error = new Error('This account is unavailable.')
      error.statusCode = 401
      throw error
    }
    req.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') error.statusCode = 401
    next(error)
  }
}
