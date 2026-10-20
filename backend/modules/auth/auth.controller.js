import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as authService from './auth.service.js'

export const login = asyncHandler(async (req, res) => success(res, await authService.login(req.body), 'Signed in.'))
export const me = asyncHandler(async (req, res) => success(res, { user: authService.sessionUser(req.user) }))
export const changePassword = asyncHandler(async (req, res) => success(res, await authService.changePassword(req.body, req.user, req.auth), 'Password changed. Sign in again on other devices.'))
export const resetUserPassword = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, private')
  return success(res, await authService.resetUserPassword(req.params.userId, req.user), 'Temporary password generated. It will only be shown once.')
})
