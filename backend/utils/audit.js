import { Activity } from '../models/index.js'

export async function recordActivity({ actor, action, entityType, entityId, description, metadata = {}, clientId, projectId }) {
  return Activity.create({ actor, action, entityType, entityId, description, metadata, clientId, projectId })
}
