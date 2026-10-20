import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './discussion.service.js'

export const list = asyncHandler(async (req, res) => success(res, await service.listDiscussions(req.user), 'Discussions retrieved.'))
export const create = asyncHandler(async (req, res) => success(res, await service.createDiscussion(req.body, req.user), 'Discussion created.', 201))
export const messages = asyncHandler(async (req, res) => success(res, await service.listMessages(req.params.id, req.user), 'Discussion replies retrieved.'))
export const postMessage = asyncHandler(async (req, res) => success(res, await service.postMessage(req.params.id, req.body, req.user), 'Reply posted.', 201))
export const update = asyncHandler(async (req, res) => success(res, await service.updateDiscussion(req.params.id, req.body, req.user), 'Discussion updated.'))
export const updateMessage = asyncHandler(async (req, res) => success(res, await service.updateMessage(req.params.id, req.params.messageId, req.body, req.user), 'Reply updated.'))
export const deleteMessage = asyncHandler(async (req, res) => success(res, await service.deleteMessage(req.params.id, req.params.messageId, req.user), 'Reply removed.'))
export const archive = asyncHandler(async (req, res) => success(res, await service.archiveDiscussion(req.params.id, req.user), 'Discussion archived.'))
