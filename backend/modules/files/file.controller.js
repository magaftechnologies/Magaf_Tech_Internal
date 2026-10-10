import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './file.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listFiles(req.user, req.query), 'Files retrieved.'))
export const upload = asyncHandler(async (req, res) => success(res, await service.uploadFiles(req.files, req.body, req.user), 'File upload completed.', 201))
export const createLink = asyncHandler(async (req, res) => success(res, await service.createExternalLink(req.body, req.user), 'External link added.', 201))
export const get = asyncHandler(async (req, res) => success(res, await service.getFile(req.params.id, req.user), 'File retrieved.'))
export const update = asyncHandler(async (req, res) => success(res, await service.updateFile(req.params.id, req.body, req.user), 'File updated.'))
export const remove = asyncHandler(async (req, res) => success(res, await service.deleteFile(req.params.id, req.user), 'File removed.'))
