import { asyncHandler } from '../../utils/asyncHandler.js'
import { paginationMeta } from '../../utils/pagination.js'
import { success } from '../../utils/response.js'
import * as service from './resource.service.js'

export const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.params.resource, req.user, req.query)
  return success(res, result.items, 'Records retrieved.', 200, result.pagination)
})
export const teamMembers = asyncHandler(async (_req, res) => success(res, await service.listTeamMembers(), 'Eligible team members retrieved.'))
export const get = asyncHandler(async (req, res) => success(res, await service.getById(req.params.resource, req.params.id, req.user), 'Record retrieved.'))
export const create = asyncHandler(async (req, res) => success(res, await service.create(req.params.resource, req.body, req.user), 'Record created.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.update(req.params.resource, req.params.id, req.body, req.user), 'Record updated.'))
export const remove = asyncHandler(async (req, res) => success(res, await service.remove(req.params.resource, req.params.id, req.user), 'Record archived.'))
