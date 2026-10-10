import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './target.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listTargets(req.query), 'Targets retrieved.'))
export const create = asyncHandler(async (req, res) => success(res, await service.createTarget(req.body, req.user), 'Target created.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updateTarget(req.params.id, req.body, req.user), 'Target updated.'))
