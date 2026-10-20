export const ROLES = Object.freeze(['super_admin', 'admin', 'team_member', 'manager', 'sales', 'developer', 'designer', 'mentor', 'finance', 'client'])
export const CLIENT_STATUSES = Object.freeze(['lead', 'contacted', 'discussion', 'proposal_sent', 'negotiation', 'active', 'inactive', 'completed', 'lost'])
export const PROJECT_STATUSES = Object.freeze(['draft', 'requested', 'pending_review', 'accepted', 'rejected', 'planning', 'in_progress', 'review', 'approved', 'revision', 'completed', 'delivered', 'cancelled', 'on_hold'])
export const REQUEST_STATUSES = Object.freeze(['submitted', 'under_review', 'need_more_information', 'quoted', 'accepted', 'rejected', 'converted_to_project', 'cancelled'])
export const PAYMENT_STATUSES = Object.freeze(['pending', 'submitted', 'under_verification', 'partially_paid', 'paid', 'rejected', 'correction_requested', 'disputed', 'failed', 'refunded', 'cancelled'])
export const FILE_VISIBILITIES = Object.freeze(['internal', 'client', 'public_if_required'])
export const MESSAGE_TYPES = Object.freeze(['text', 'image', 'video', 'audio', 'voice', 'file', 'system'])
export const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'review', 'completed', 'cancelled'])
export const STUDENT_STATUSES = Object.freeze(['inquiry', 'enrolled', 'active', 'paused', 'completed', 'dropped'])
export const ROLES_WITH_ALL_ACCESS = Object.freeze(['super_admin', 'admin'])
//s
export const SERVICE_SLUGS = Object.freeze({
  software: 'software-development',
  automation: 'business-automation',
  advertising: 'advertising-creative',
  content: 'content-creation',
  invitations: 'digital-invitations',
  mentoring: 'development-mentoring',
  products: 'magaf-products',
})
