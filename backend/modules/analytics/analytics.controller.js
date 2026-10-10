import { asyncHandler } from '../../utils/asyncHandler.js'
import { success } from '../../utils/response.js'
import * as service from './analytics.service.js'

export const dashboard = asyncHandler(async (_req, res) => success(res, await service.dashboardSummary(), 'Dashboard summary retrieved.'))
export const revenue = asyncHandler(async (req, res) => success(res, await service.revenueTimeSeries(req.query), 'Revenue series retrieved.'))
export const services = asyncHandler(async (_req, res) => success(res, await service.serviceAnalytics(), 'Service analytics retrieved.'))
export const revenueBreakdown = asyncHandler(async (req, res) => success(res, await service.revenueBreakdown(req.query), 'Revenue analytics retrieved.'))
export const clients = asyncHandler(async (_req, res) => success(res, await service.clientAnalytics(), 'Client analytics retrieved.'))
export const projects = asyncHandler(async (_req, res) => success(res, await service.projectAnalytics(), 'Project analytics retrieved.'))
export const acquisition = asyncHandler(async (_req, res) => success(res, await service.acquisitionAnalytics(), 'Acquisition analytics retrieved.'))
