import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import { convertLead } from './lead.service.js'

export const convert = asyncHandler(async (req, res) => success(res, await convertLead(req.params.id, req.body, req.user), 'Lead converted into a client.', 201))
