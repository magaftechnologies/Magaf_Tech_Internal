import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as authService from './auth.service.js'

export const login = asyncHandler(async (req, res) => success(res, await authService.login(req.body), 'Signed in.'))
export const me = asyncHandler(async (req, res) => success(res, { user: req.user }))
export const changePassword = asyncHandler(async (req, res) => success(res, await authService.changePassword(req.body, req.user), 'Password changed. Sign in again on other devices.'))
