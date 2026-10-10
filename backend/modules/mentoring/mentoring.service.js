import { randomBytes } from 'node:crypto'
import { MentoringSession, Notification, Student, User } from '../../models/index.js'
import { recordActivity } from '../../utils/audit.js'

export async function listSessions(query = {}) {
  const filter = {}
  if (query.studentId) filter.studentId = query.studentId
  if (query.status) filter.status = query.status
  if (query.mentorId) filter.mentorId = query.mentorId
  return MentoringSession.find(filter).sort({ date: 1 }).populate('studentId mentorId')
}

export async function createSession(input, user) {
  const student = await Student.findById(input.studentId)
  if (!student) throw Object.assign(new Error('Mentoring student not found.'), { statusCode: 404 })
  const session = await MentoringSession.create({ ...input, sessionCode: `MS-${randomBytes(3).toString('hex').toUpperCase()}`, mentorId: input.mentorId || user._id, createdBy: user._id })
  const mentor = await User.findById(session.mentorId).select('_id')
  if (mentor) await Notification.create({ recipient: mentor._id, type: 'mentoring_session', title: 'Mentoring session scheduled', message: session.topic, relatedEntity: 'mentoring_session', relatedEntityId: session._id })
  await recordActivity({ actor: user._id, action: 'mentoring_session.created', entityType: 'mentoring_session', entityId: session._id, description: `Mentoring session scheduled: ${session.topic}.` })
  return session
}

export async function updateSession(id, input, user) {
  const session = await MentoringSession.findById(id)
  if (!session) throw Object.assign(new Error('Mentoring session not found.'), { statusCode: 404 })
  const wasCompleted = session.status === 'completed'
  for (const field of ['date', 'startTime', 'endTime', 'topic', 'description', 'status', 'notes', 'resources', 'attachments']) {
    if (input[field] !== undefined) session[field] = input[field]
  }
  await session.save()
  const isCompleted = session.status === 'completed'
  if (wasCompleted !== isCompleted) {
    const student = await Student.findById(session.studentId)
    if (student) {
      const delta = isCompleted ? 1 : -1
      student.sessionsCompleted = Math.max(0, student.sessionsCompleted + delta)
      student.sessionsRemaining = Math.max(0, student.sessionsRemaining - delta)
      await student.save()
    }
  }
  await recordActivity({ actor: user._id, action: 'mentoring_session.updated', entityType: 'mentoring_session', entityId: session._id, description: `Mentoring session ${session.status}.` })
  return session
}
