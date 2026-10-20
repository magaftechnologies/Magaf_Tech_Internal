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
    if (user.mustChangePassword) {
      const isAllowedPasswordRoute = req.baseUrl === '/api/auth'
        && ((req.method === 'GET' && req.path === '/me') || (req.method === 'POST' && req.path === '/change-password'))
      if (!payload.passwordChangeOnly || !isAllowedPasswordRoute) {
        throw Object.assign(new Error('Change your temporary password before accessing the workspace.'), { statusCode: 403 })
      }
    }
    req.user = user
    req.auth = payload
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') error.statusCode = 401
    next(error)
  }
}
