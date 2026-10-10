import bcrypt from 'bcryptjs'
import { User } from '../../models/index.js'
import { generateToken } from '../../utils/generateToken.js'
import { recordActivity } from '../../utils/audit.js'

const publicUser = (user) => ({
  id: user._id.toString(), name: user.name, email: user.email, role: user.role,
  portalType: user.portalType, clientId: user.clientId?.toString(), profileImage: user.profileImage,
  mustChangePassword: Boolean(user.mustChangePassword),
})

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Invalid email or password.')
    error.statusCode = 401
    throw error
  }
  user.lastLogin = new Date()
  await user.save()
  await recordActivity({ actor: user._id, action: 'auth.login', entityType: 'user', entityId: user._id, description: `${user.name} signed in.` })
  return { token: generateToken(user), user: publicUser(user) }
}

export async function changePassword({ currentPassword, newPassword }, authenticatedUser) {
  const user = await User.findById(authenticatedUser._id).select('+passwordHash')
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw Object.assign(new Error('Current password is incorrect.'), { statusCode: 400 })
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.mustChangePassword = false
  user.tokenVersion += 1
  await user.save()
  return { token: generateToken(user), user: publicUser(user) }
}
