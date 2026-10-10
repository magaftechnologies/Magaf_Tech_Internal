import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './serviceWork.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listWork(req.params.kind, req.user, req.query), `${req.params.kind} records retrieved.`))
export const get = asyncHandler(async (req, res) => success(res, await service.getWork(req.params.kind, req.params.id, req.user), `${req.params.kind} record retrieved.`))
export const create = asyncHandler(async (req, res) => success(res, await service.createWork(req.params.kind, req.body, req.user), `${req.params.kind} record created.`, 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updateWork(req.params.kind, req.params.id, req.body, req.user), `${req.params.kind} record updated.`))
