import bcrypt from 'bcryptjs'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { Service, User } from '../models/index.js'

const services = [
  ['Software Development / Digital Solutions', 'software-development', 'Technology', 'Websites, applications and business systems.', ['Web applications', 'E-commerce', 'Dashboards']],
  ['Business Automation / AI Agents', 'business-automation', 'Technology', 'Practical automation and AI workflows.', ['AI agents', 'Lead qualification', 'Workflow automation']],
  ['Advertising & Creative Promotions', 'advertising-creative', 'Creative', 'Campaign-ready promotional creative.', ['Reels', 'Video advertisements', 'Posters']],
  ['Content Creation', 'content-creation', 'Creative', 'Social, educational and brand content.', ['Social posts', 'Scripts', 'Content calendars']],
  ['Digital Invitations / Event Products', 'digital-invitations', 'Digital Products', 'Interactive digital invitations and event pages.', ['Invitations', 'RSVP pages', 'QR products']],
  ['Programming & Development Mentoring', 'development-mentoring', 'Education', 'Personalized programming and project guidance.', ['Programming fundamentals', 'Web development', 'Interview preparation']],
  ['MAGAF Products / Future Services', 'magaf-products', 'Product Studio', 'Internal productized services and owned products.', ['SaaS', 'Developer tools']],
]

function configuredFounders() {
  const source = process.env.INITIAL_FOUNDERS?.trim()
  if (!source) return []
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new Error(`INITIAL_FOUNDERS must be a JSON array: ${error.message}`)
  }
  if (!Array.isArray(parsed)) throw new Error('INITIAL_FOUNDERS must be a JSON array of { name, email } objects.')
  const founders = parsed.map((entry, index) => {
    const name = String(entry?.name || '').trim()
    const email = String(entry?.email || '').trim().toLowerCase()
    if (!name || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`INITIAL_FOUNDERS entry ${index + 1} needs a name and valid email address.`)
    }
    return { name, email, role: 'admin', portalType: 'team', isActive: true, mustChangePassword: true }
  })
  if (new Set(founders.map((founder) => founder.email)).size !== founders.length) {
    throw new Error('INITIAL_FOUNDERS cannot contain duplicate email addresses.')
  }
  return founders
}

async function seed() {
  const password = process.env.INITIAL_ADMIN_PASSWORD
  const founders = configuredFounders()
  await connectDatabase()

  const missingFounders = []
  for (const founder of founders) {
    if (await User.exists({ email: founder.email })) continue
    missingFounders.push(founder)
  }

  if (missingFounders.length) {
    if (!password) throw new Error('Set INITIAL_ADMIN_PASSWORD to create missing founder accounts.')
    const passwordHash = await bcrypt.hash(password, 12)
    const temporaryPasswordExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await User.insertMany(missingFounders.map((founder) => ({ ...founder, passwordHash, temporaryPasswordExpiresAt })), { ordered: true })
  }

  for (const [index, [name, slug, category, description, features]] of services.entries()) {
    await Service.updateOne(
      { slug },
      { $setOnInsert: { name, slug, category, description, features, displayOrder: index, isActive: true, serviceCode: `SVC-${String(index + 1).padStart(3, '0')}` } },
      { upsert: true },
    )
  }

  console.info(`Founder bootstrap complete. Created ${missingFounders.length} founder account(s) and ensured ${services.length} service definitions.`)
  console.info('No clients, projects, payments, messages, students, requests, or revenue records were created.')
}

seed().catch((error) => {
  console.error('Founder seed failed.', error)
  process.exitCode = 1
}).finally(async () => {
  await disconnectDatabase()
})
