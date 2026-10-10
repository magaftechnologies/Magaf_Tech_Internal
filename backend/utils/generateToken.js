import jwt from 'jsonwebtoken'
import { env } from '../config/environment.js'

export function generateToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, portalType: user.portalType, clientId: user.clientId?.toString(), ver: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}
