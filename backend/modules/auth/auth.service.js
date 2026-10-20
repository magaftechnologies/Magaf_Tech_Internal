import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { User } from '../../models/index.js'
import { generateToken } from '../../utils/generateToken.js'
import { recordActivity } from '../../utils/audit.js'

const publicUser = (user) => ({
  id: user._id.toString(), name: user.name, email: user.email, role: user.role,
  portalType: user.portalType, clientId: user.clientId?.toString(), profileImage: user.profileImage,
  mustChangePassword: Boolean(user.mustChangePassword),
})

export const sessionUser = (user) => publicUser(user)

const invalidCredentials = () => Object.assign(new Error('Invalid email or password.'), { statusCode: 401 })

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw invalidCredentials()
  let passwordChangeOnly = false
  if (user.mustChangePassword) {
    const now = new Date()
    if ((user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= now) || user.temporaryPasswordUsedAt) throw invalidCredentials()
    const consumed = await User.findOneAndUpdate({
      _id: user._id,
      tokenVersion: user.tokenVersion,
      mustChangePassword: true,
      $and: [
        { $or: [
          { temporaryPasswordExpiresAt: { $gt: now } },
          { temporaryPasswordExpiresAt: null },
          { temporaryPasswordExpiresAt: { $exists: false } },
        ] },
        { $or: [{ temporaryPasswordUsedAt: null }, { temporaryPasswordUsedAt: { $exists: false } }] },
      ],
    }, { $set: {
      temporaryPasswordUsedAt: now,
      temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
      lastLogin: now,
    } }, { new: true })
    if (!consumed) throw invalidCredentials()
    passwordChangeOnly = true
    Object.assign(user, { lastLogin: now, temporaryPasswordUsedAt: now })
  } else {
    user.lastLogin = new Date()
    await user.save()
  }
  await recordActivity({ actor: user._id, action: 'auth.login', entityType: 'user', entityId: user._id, description: `${user.name} signed in.` })
  return {
    token: generateToken(user, passwordChangeOnly ? { passwordChangeOnly: true, expiresIn: '20m' } : undefined),
    user: publicUser(user),
  }
}

export async function changePassword({ currentPassword, newPassword }, authenticatedUser, authClaims = {}) {
  const user = await User.findById(authenticatedUser._id).select('+passwordHash')
  const forcedChangeAllowed = user?.mustChangePassword
    && authClaims.passwordChangeOnly === true
    && Boolean(user.temporaryPasswordUsedAt)
  if (!user || (!forcedChangeAllowed && !(await bcrypt.compare(currentPassword || '', user.passwordHash)))) {
    throw Object.assign(new Error('Current password is incorrect.'), { statusCode: 400 })
  }
  if (currentPassword && await bcrypt.compare(newPassword, user.passwordHash)) {
    throw Object.assign(new Error('Choose a password different from your current password.'), { statusCode: 400 })
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.mustChangePassword = false
  user.temporaryPasswordExpiresAt = undefined
  user.temporaryPasswordUsedAt = undefined
  user.tokenVersion += 1
  await user.save()
  return { token: generateToken(user), user: publicUser(user) }
}

export async function resetUserPassword(userId, actor) {
  const user = await User.findOne({ _id: userId, portalType: 'team', role: { $ne: 'client' } })
  if (!user) throw Object.assign(new Error('Team user not found.'), { statusCode: 404 })
  if (actor.role !== 'super_admin' && user.role === 'super_admin') {
    throw Object.assign(new Error('Only a super administrator can reset a super administrator account.'), { statusCode: 403 })
  }
  const temporaryPassword = randomBytes(18).toString('base64url')
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12)
  user.mustChangePassword = true
  user.temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  user.temporaryPasswordUsedAt = undefined
  user.tokenVersion += 1
  await user.save()
  await recordActivity({
    actor: actor._id,
    action: 'auth.password.reset',
    entityType: 'user',
    entityId: user._id,
    description: `Administrator reset the password for ${user.name}.`,
  })
  return { temporaryPassword, expiresAt: user.temporaryPasswordExpiresAt }
}
