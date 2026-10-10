export function allowRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      const error = new Error('Authentication required.')
      error.statusCode = 401
      return next(error)
    }
    if (!roles.includes(req.user.role)) {
      const error = new Error('You do not have permission to perform this action.')
      error.statusCode = 403
      return next(error)
    }
    return next()
  }
}

export function requireTeam(req, res, next) {
  if (req.user?.portalType !== 'team') return res.status(403).json({ success: false, message: 'Internal team access required.', errors: [] })
  return next()
}

export function requireClient(req, res, next) {
  if (req.user?.portalType !== 'client' || !req.user.clientId) return res.status(403).json({ success: false, message: 'Client portal access required.', errors: [] })
  return next()
}
