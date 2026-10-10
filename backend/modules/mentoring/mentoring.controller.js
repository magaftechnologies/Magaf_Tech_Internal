import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './mentoring.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listSessions(req.query), 'Mentoring sessions retrieved.'))
export const create = asyncHandler(async (req, res) => success(res, await service.createSession(req.body, req.user), 'Mentoring session created.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updateSession(req.params.id, req.body, req.user), 'Mentoring session updated.'))
