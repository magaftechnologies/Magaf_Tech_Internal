import { randomBytes } from 'node:crypto'
import { Client, Lead } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

export async function convertLead(id, input = {}, user) {
  const lead = await Lead.findById(id)
  if (!lead) throw Object.assign(new Error('Lead not found.'), { statusCode: 404 })
  if (lead.convertedClientId || lead.status === 'converted') throw Object.assign(new Error('This lead has already been converted.'), { statusCode: 409 })
  const client = await Client.create({
    name: input.businessName || lead.companyName || lead.name,
    businessName: input.businessName || lead.companyName,
    contactName: lead.contactName || lead.name,
    email: lead.email,
    phone: lead.phone,
    industry: input.industry,
    city: lead.city,
    source: lead.source,
    serviceId: lead.serviceId,
    status: 'active',
    assignedTeamMembers: lead.assignedTo ? [lead.assignedTo] : [],
    clientCode: `CL-${randomBytes(3).toString('hex').toUpperCase()}`,
    createdBy: user._id,
  })
  const claimedLead = await Lead.findOneAndUpdate(
    { _id: lead._id, status: { $ne: 'converted' }, convertedClientId: { $exists: false } },
    { $set: { convertedClientId: client._id, status: 'converted', updatedBy: user._id } },
    { new: true },
  )
  if (!claimedLead) {
    await Client.findByIdAndDelete(client._id)
    throw Object.assign(new Error('This lead has already been converted.'), { statusCode: 409 })
  }
  await recordActivity({ actor: user._id, action: 'lead.converted', entityType: 'lead', entityId: lead._id, clientId: client._id, description: `${lead.name} converted into client ${client.name}.` })
  return client
}
