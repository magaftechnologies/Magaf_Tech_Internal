import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './projectRequest.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listRequests(req.user, req.query), 'Project requests retrieved.'))
export const get = asyncHandler(async (req, res) => success(res, await service.getRequest(req.params.id, req.user), 'Project request retrieved.'))
export const create = asyncHandler(async (req, res) => success(res, await service.createRequest(req.body, req.user), 'Project request submitted.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updateRequest(req.params.id, req.body, req.user), 'Project request updated.'))
export const convert = asyncHandler(async (req, res) => success(res, await service.convertRequest(req.params.id, req.body, req.user), 'Project created from request.', 201))
