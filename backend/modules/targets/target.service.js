import { randomBytes } from 'node:crypto'
import { Target } from '../../models/index.js'
import { currentTarget } from '../analytics/analytics.service.js'
import { recordActivity } from '../../utils/audit.js'

export async function listTargets(query = {}) {
  const filter = {}
  if (query.status) filter.status = query.status
  if (query.targetType) filter.targetType = query.targetType
  const targets = await Target.find(filter).sort({ startDate: -1 }).populate('serviceId createdBy')
  return Promise.all(targets.map(async (target) => {
    const currentValue = await currentTarget(target)
    return { ...target.toJSON(), currentValue, progress: target.targetValue ? Math.min(100, Math.round(currentValue / target.targetValue * 10000) / 100) : 0 }
  }))
}

export async function createTarget(input, user) {
  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) throw Object.assign(new Error('Target dates must be valid and startDate must not exceed endDate.'), { statusCode: 400 })
  const target = await Target.create({ ...input, startDate, endDate, targetCode: `TGT-${randomBytes(3).toString('hex').toUpperCase()}`, createdBy: user._id })
  await recordActivity({ actor: user._id, action: 'target.created', entityType: 'target', entityId: target._id, description: `${target.targetType} ${target.period} target created.` })
  return target
}

export async function updateTarget(id, input, user) {
  const target = await Target.findById(id)
  if (!target) throw Object.assign(new Error('Target not found.'), { statusCode: 404 })
  for (const key of ['targetType', 'period', 'targetValue', 'startDate', 'endDate', 'serviceId', 'status']) if (input[key] !== undefined) target[key] = input[key]
  await target.save()
  await recordActivity({ actor: user._id, action: 'target.updated', entityType: 'target', entityId: target._id, description: `${target.targetType} target updated.` })
  return target
}
