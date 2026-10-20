import jwt from 'jsonwebtoken'
import { env } from '../config/environment.js'

export function generateToken(user, options = {}) {
  const { passwordChangeOnly = false, expiresIn = env.jwtExpiresIn } = options
  return jwt.sign({
    sub: user._id.toString(),
    role: user.role,
    portalType: user.portalType,
    clientId: user.clientId?.toString(),
    ver: user.tokenVersion || 0,
    ...(passwordChangeOnly ? { passwordChangeOnly: true } : {}),
  }, env.jwtSecret, { expiresIn })
}
