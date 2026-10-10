import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-the-test-suite'
process.env.CLOUDINARY_CLOUD_NAME = ''
process.env.CLOUDINARY_API_KEY = ''
process.env.CLOUDINARY_API_SECRET = ''

let mongo
let app
let models
let teamToken
let clientAToken
let clientBToken
let clientA
let clientB
let service
let projectA
let projectB

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 30000 } })
  const database = await import('../config/database.js')
  await database.connectDatabase(mongo.getUri())
  app = (await import('../app.js')).default
  models = await import('../models/index.js')
})

beforeEach(async () => {
  await Promise.all(Object.values(models).filter((model) => model?.deleteMany).map((model) => model.deleteMany({})))
  const passwordHash = await bcrypt.hash('SecureTestPassword123!', 4)
  const team = await models.User.create({ name: 'Test Manager', email: 'manager@test.magaf', passwordHash, role: 'manager', portalType: 'team' })
  const teamReader = await models.User.create({ name: 'Second Manager', email: 'manager2@test.magaf', passwordHash, role: 'manager', portalType: 'team' })
  clientA = await models.Client.create({ name: 'Client A', email: 'a@test.magaf', status: 'active', assignedTeamMembers: [team._id, teamReader._id] })
  clientB = await models.Client.create({ name: 'Client B', email: 'b@test.magaf', status: 'active' })
  const clientAUser = await models.User.create({ name: 'Client A User', email: 'portal-a@test.magaf', passwordHash, role: 'client', portalType: 'client', clientId: clientA._id })
  const clientBUser = await models.User.create({ name: 'Client B User', email: 'portal-b@test.magaf', passwordHash, role: 'client', portalType: 'client', clientId: clientB._id })
  clientA.userId = clientAUser._id
  clientB.userId = clientBUser._id
  await Promise.all([clientA.save(), clientB.save()])
  service = await models.Service.create({ name: 'Software Development', slug: 'software-development', isActive: true })
  projectA = await models.Project.create({ projectName: 'Client A Project', clientId: clientA._id, serviceId: service._id, finalAmount: 10000, quotedAmount: 10000, balanceAmount: 10000, status: 'planning' })
  projectB = await models.Project.create({ projectName: 'Client B Project', clientId: clientB._id, serviceId: service._id, finalAmount: 15000, quotedAmount: 15000, balanceAmount: 15000, status: 'planning', internalNotes: 'Private' })
  const logins = await Promise.all([
    request(app).post('/api/auth/login').send({ email: team.email, password: 'SecureTestPassword123!' }),
    request(app).post('/api/auth/login').send({ email: clientAUser.email, password: 'SecureTestPassword123!' }),
    request(app).post('/api/auth/login').send({ email: clientBUser.email, password: 'SecureTestPassword123!' }),
  ])
  teamToken = logins[0].body.data.token
  clientAToken = logins[1].body.data.token
  clientBToken = logins[2].body.data.token
})

async function createPaymentProof({ user, clientId, projectId, ownerType = 'team' }) {
  return models.FileAsset.create({
    fileCode: `FILE-PROOF-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ownerType,
    ownerId: user._id,
    clientId,
    projectId,
    uploadedBy: user._id,
    category: 'payment_proof',
    fileType: 'image',
    mimeType: 'image/png',
    fileName: 'payment-receipt.png',
    originalName: 'payment-receipt.png',
    cloudinaryPublicId: `test/payment-proof-${Date.now()}`,
    cloudinaryUrl: 'https://example.test/payment-receipt.png',
    resourceType: 'image',
    size: 120,
    visibility: ownerType === 'client' ? 'client' : 'internal',
  })
}

after(async () => {
  const database = await import('../config/database.js')
  await database.disconnectDatabase()
  await mongo?.stop()
})

test('MAGAF backend enforces client isolation and synchronizes core business flows', async (t) => {
  await t.test('health and JWT session endpoints return consistent structures', async () => {
    const health = await request(app).get('/health').expect(200)
    assert.equal(health.body.success, true)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal(me.body.data.user.clientId.toString(), clientA._id.toString())
    const rejected = await request(app).post('/api/auth/login').send({ email: 'portal-a@test.magaf', password: 'incorrect-password' }).expect(401)
    assert.equal(rejected.body.success, false)
  })

  await t.test('password changes revoke the old JWT and allow the replacement session', async () => {
    const changed = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ currentPassword: 'SecureTestPassword123!', newPassword: 'NewSecurePassword123!' })
      .expect(200)
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${teamToken}`).expect(401)
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${changed.body.data.token}`).expect(200)
    await request(app).post('/api/auth/login').send({ email: 'manager@test.magaf', password: 'SecureTestPassword123!' }).expect(401)
    await request(app).post('/api/auth/login').send({ email: 'manager@test.magaf', password: 'NewSecurePassword123!' }).expect(200)
  })

  await t.test('client queries cannot discover another client project or profile', async () => {
    const privateDeal = await models.Deal.create({
      clientId: clientA.id, serviceId: service.id, projectId: projectA.id,
      title: 'Private project deal', quotedAmount: 10000, agreedAmount: 10000,
      notes: 'Internal deal notes.',
    })
    projectA.dealId = privateDeal.id
    await projectA.save()
    const projects = await request(app).get('/api/projects').set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal(projects.body.data.length, 1)
    assert.equal(projects.body.data[0].id, projectA.id)
    assert.equal('internalNotes' in projects.body.data[0], false)
    assert.equal('projectManager' in projects.body.data[0], false)
    assert.equal('notes' in projects.body.data[0].dealId, false)
    assert.equal('assignedTo' in projects.body.data[0].dealId, false)
    await request(app).get(`/api/projects/${projectB.id}`).set('Authorization', `Bearer ${clientAToken}`).expect(404)
    const clients = await request(app).get('/api/clients').set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal(clients.body.data.length, 1)
    assert.equal(clients.body.data[0].id, clientA.id)
    await models.Activity.create({
      actor: await models.User.findOne({ email: 'manager@test.magaf' }),
      action: 'project.updated',
      entityType: 'project',
      entityId: projectA.id,
      clientId: clientA.id,
      description: 'Project status updated.',
      metadata: { internalNote: 'Do not expose' },
    })
    const activities = await request(app).get('/api/activities').set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal('metadata' in activities.body.data[0], false)
    assert.equal('email' in activities.body.data[0].actor, false)
    const clientDashboard = await request(app).get('/api/dashboard/client').set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal('metadata' in clientDashboard.body.data.recentActivity[0], false)
    assert.equal('actor' in clientDashboard.body.data.recentActivity[0], false)
    await request(app).get('/api/clients').expect(401)
  })

  await t.test('requests are owner-scoped and convert with linked information intact', async () => {
    const created = await request(app).post('/api/project-requests').set('Authorization', `Bearer ${clientAToken}`).send({
      clientId: clientB.id, serviceId: service.id, projectName: 'New client-owned request',
      description: 'A sufficiently detailed request for testing ownership and conversion.',
      businessGoal: 'Demonstrate request conversion.', requirements: 'Keep the provided brief.',
      estimatedBudget: 5000, referenceLinks: [{ title: 'Reference', url: 'https://example.com/brief' }],
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    const requestId = created.body.data.id
    assert.equal(created.body.data.clientId, clientA.id)
    assert.equal((await request(app).get(`/api/project-requests/${requestId}`).set('Authorization', `Bearer ${clientBToken}`).expect(404)).body.success, false)
    const linked = await request(app).post('/api/files/links').set('Authorization', `Bearer ${clientAToken}`).send({
      title: 'Client requirements folder', url: 'https://drive.google.com/drive/folders/demo',
      projectRequestId: requestId, category: 'reference',
    }).expect(201)
    await request(app).get(`/api/files/${linked.body.data.id}`).set('Authorization', `Bearer ${clientBToken}`).expect(404)
    await request(app).patch(`/api/project-requests/${requestId}`).set('Authorization', `Bearer ${teamToken}`).send({ status: 'accepted', proposedPrice: 4800 }).expect(200)
    const converted = await request(app).post(`/api/project-requests/${requestId}/convert`).set('Authorization', `Bearer ${teamToken}`).send({ agreedAmount: 4800 }).expect(201)
    assert.equal(converted.body.data.requestId, requestId)
    assert.equal(converted.body.data.clientId, clientA.id)
    assert.equal(converted.body.data.finalAmount, 4800)
    const updatedRequest = await models.ProjectRequest.findById(requestId)
    assert.equal(updatedRequest.convertedProjectId.toString(), converted.body.data.id)
    const movedFile = await models.FileAsset.findById(linked.body.data.id)
    assert.equal(movedFile.projectId.toString(), converted.body.data.id)
    const clientView = await request(app).get(`/api/projects/${converted.body.data.id}`).set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal('teamNotes' in clientView.body.data, false)
  })

  await t.test('only finance-capable team users record revenue and project balance is derived', async () => {
    const denied = await request(app).post('/api/payments').set('Authorization', `Bearer ${clientAToken}`).send({ projectId: projectA.id, amount: 2500, status: 'paid' }).expect(403)
    assert.equal(denied.body.success, false)
    await request(app).post('/api/payments').auth(teamToken, { type: 'bearer' })
      .send({ projectId: projectA.id, amount: 2500, paymentType: 'advance', paymentMethod: 'upi' })
      .expect(400)
    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const proof = await createPaymentProof({ user: teamUser, clientId: clientA.id, projectId: projectA.id })
    const recorded = await request(app).post('/api/payments').set('Authorization', `Bearer ${teamToken}`).send({
      projectId: projectA.id, amount: 2500, status: 'paid', paymentType: 'advance', paymentMethod: 'upi', proofFiles: [proof.id],
    }).expect(201)
    assert.equal(recorded.body.data.status, 'paid')
    assert.equal(recorded.body.data.verificationStatus, 'not_required')
    assert.equal(recorded.body.data.paymentSource, 'internal_admin')
    assert.equal((await models.FileAsset.findById(proof.id)).approvalStatus, 'approved')
    await request(app).patch(`/api/files/${proof.id}`).auth(teamToken, { type: 'bearer' })
      .send({ approvalStatus: 'pending' }).expect(409)
    await models.FileAsset.findByIdAndUpdate(proof.id, { approvalStatus: 'pending' })
    const projectFiles = await request(app).get(`/api/files?projectId=${projectA.id}`)
      .auth(teamToken, { type: 'bearer' }).expect(200)
    assert.equal(projectFiles.body.data.find((file) => file.id === proof.id).approvalStatus, 'approved')
    await request(app).patch(`/api/payments/${recorded.body.data.id}/verification`)
      .auth(teamToken, { type: 'bearer' }).send({ action: 'verify' }).expect(409)
    const project = await models.Project.findById(projectA.id)
    assert.equal(project.paidAmount, 2500)
    assert.equal(project.balanceAmount, 7500)
    const dashboard = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${teamToken}`).expect(200)
    assert.equal(dashboard.body.data.revenue.paid, 2500)
    const serviceAnalytics = await request(app).get('/api/analytics/services').set('Authorization', `Bearer ${teamToken}`).expect(200)
    assert.equal(serviceAnalytics.body.data[0].revenue, 2500)
    await request(app).post('/api/payments').set('Authorization', `Bearer ${teamToken}`).send({ projectId: projectA.id, amount: 9000, status: 'paid' }).expect(409)
  })

  await t.test('payments retain their deal and invoice links and reject cross-client associations', async () => {
    const finance = await models.User.create({
      name: 'Finance User', email: 'finance@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'finance', portalType: 'team',
    })
    const financeLogin = await request(app).post('/api/auth/login').send({ email: finance.email, password: 'SecureTestPassword123!' }).expect(200)
    const financeToken = financeLogin.body.data.token
    const deal = await models.Deal.create({
      clientId: clientA.id, serviceId: service.id, projectId: projectA.id,
      title: 'Project deal', quotedAmount: 10000, agreedAmount: 10000, status: 'accepted',
    })
    projectA.dealId = deal.id
    await projectA.save()
    const invoice = await models.Invoice.create({
      invoiceCode: 'MAG-INV-TEST-01', clientId: clientA.id, projectId: projectA.id,
      dealId: deal.id, amount: 3000, status: 'issued', notes: 'Internal invoice notes.',
    })
    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const proof = await createPaymentProof({ user: teamUser, clientId: clientA.id, projectId: projectA.id })

    const payment = await request(app).post('/api/payments')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ dealId: deal.id, invoiceId: invoice.id, amount: 2000, status: 'paid', paymentType: 'advance', paymentMethod: 'upi', proofFiles: [proof.id], notes: 'Internal payment note.' })
      .expect(201)
    assert.equal(payment.body.data.clientId, clientA.id)
    assert.equal(payment.body.data.projectId, projectA.id)
    assert.equal(payment.body.data.dealId, deal.id)
    assert.equal(payment.body.data.invoiceId, invoice.id)
    assert.equal((await models.Project.findById(projectA.id)).paidAmount, 2000)
    assert.equal((await models.Invoice.findById(invoice.id)).status, 'partially_paid')

    await request(app).post('/api/payments')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ clientId: clientB.id, invoiceId: invoice.id, amount: 1000, status: 'paid' })
      .expect(404)

    const clientPayments = await request(app).get('/api/payments').set('Authorization', `Bearer ${clientAToken}`).auth(clientAToken, { type: 'bearer' }).expect(200)
    assert.equal(clientPayments.body.data[0].invoiceId.invoiceCode, invoice.invoiceCode)
    assert.equal('notes' in clientPayments.body.data[0].invoiceId, false)
    assert.equal('notes' in clientPayments.body.data[0], false)
  })

  await t.test('client payment submissions require evidence, stay out of revenue until verified, and support reviewed disputes', async () => {
    assert.ok(clientBToken)
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${clientBToken}`).expect(200)
    const clientUser = await models.User.findOne({ email: 'portal-b@test.magaf' })
    const proof = await models.FileAsset.create({
      fileCode: 'FILE-PROOF-B01',
      ownerType: 'client',
      ownerId: clientUser.id,
      clientId: clientB.id,
      uploadedBy: clientUser.id,
      category: 'payment_proof',
      fileType: 'image',
      mimeType: 'image/png',
      fileName: 'payment-receipt.png',
      originalName: 'payment-receipt.png',
      cloudinaryPublicId: 'test/payment-proof-b01',
      cloudinaryUrl: 'https://example.test/payment-receipt.png',
      resourceType: 'image',
      size: 120,
      visibility: 'client',
    })
    await request(app).post('/api/payments/client-submissions').set('Authorization', `******`)
      .auth(clientBToken, { type: 'bearer' }).send({ amount: 3000, paymentMethod: 'upi', projectId: projectB.id, transactionId: 'UPI-WITHOUT-PROOF' })
      .then((response) => assert.equal(response.status, 400, JSON.stringify(response.body)))
    const crossClient = await request(app).post('/api/payments/client-submissions').set('Authorization', `******`)
      .auth(clientBToken, { type: 'bearer' }).send({ amount: 3000, paymentMethod: 'upi', projectId: projectA.id, proofFiles: [proof.id] })
      .expect(404)
    assert.equal(crossClient.body.success, false)
    const submitted = await request(app).post('/api/payments/client-submissions').set('Authorization', `******`)
      .auth(clientBToken, { type: 'bearer' }).send({ amount: 3000, paymentMethod: 'upi', projectId: projectB.id, proofFiles: [proof.id] })
      .expect(201)
    const paymentId = submitted.body.data.id
    assert.equal(submitted.body.data.status, 'submitted')
    assert.equal(submitted.body.data.verificationStatus, 'submitted')
    assert.equal((await models.FileAsset.findById(proof.id)).approvalStatus, 'pending')
    await request(app).patch(`/api/payments/${paymentId}/verification`)
      .auth(teamToken, { type: 'bearer' })
      .send({ action: 'request_correction', note: 'Please confirm the transaction reference.' })
      .expect(200)
    assert.equal((await models.FileAsset.findById(proof.id)).approvalStatus, 'changes_requested')
    const corrected = await request(app).patch(`/api/payments/${paymentId}/resubmission`)
      .auth(clientBToken, { type: 'bearer' })
      .send({ amount: 3000, paymentMethod: 'upi', transactionId: 'UPI-B-456', proofFiles: [proof.id] })
      .expect(200)
    assert.equal(corrected.body.data.id, paymentId)
    assert.equal(corrected.body.data.status, 'submitted')
    assert.equal(corrected.body.data.verificationStatus, 'submitted')
    assert.equal((await models.FileAsset.findById(proof.id)).approvalStatus, 'pending')
    const correctedView = await request(app).get('/api/payments').auth(clientBToken, { type: 'bearer' }).expect(200)
    assert.equal(correctedView.body.data.find((item) => item.id === paymentId).verificationNote, 'Please confirm the transaction reference.')
    await request(app).patch(`/api/payments/${paymentId}`)
      .auth(teamToken, { type: 'bearer' })
      .send({ status: 'paid', verificationReview: true })
      .expect(409)
    assert.equal((await models.Project.findById(projectB.id)).paidAmount, 0)
    assert.equal(await models.Payment.countDocuments({ projectId: projectB.id, status: 'paid' }), 0)
    await request(app).patch(`/api/payments/${paymentId}/verification`).set('Authorization', `******`)
      .auth(teamToken, { type: 'bearer' }).send({ action: 'verify' })
      .expect(200)
    assert.equal((await models.Project.findById(projectB.id)).paidAmount, 3000)
    assert.equal((await models.Payment.findById(paymentId)).isFinalPayment, false)
    assert.equal((await models.FileAsset.findById(proof.id)).approvalStatus, 'approved')
    const finalProof = await createPaymentProof({ user: clientUser, clientId: clientB.id, projectId: projectB.id, ownerType: 'client' })
    const clientFinalPayment = await request(app).post('/api/payments/client-submissions')
      .auth(clientBToken, { type: 'bearer' })
      .send({ amount: 12000, paymentMethod: 'upi', projectId: projectB.id, proofFiles: [finalProof.id] })
      .expect(201)
    assert.equal(clientFinalPayment.body.data.isFinalPayment, false)
    const clientFinalized = await request(app).patch(`/api/payments/${clientFinalPayment.body.data.id}/verification`)
      .auth(teamToken, { type: 'bearer' })
      .send({ action: 'verify' })
      .expect(200)
    assert.equal(clientFinalized.body.data.isFinalPayment, true)
    assert.equal((await models.Project.findById(projectB.id)).finalPaymentId.toString(), clientFinalPayment.body.data.id)
    const clientPayments = await request(app).get('/api/payments').set('Authorization', `******`).auth(clientBToken, { type: 'bearer' }).expect(200)
    const clientPayment = clientPayments.body.data.find((item) => item.id === paymentId)
    assert.equal('paymentHistory' in clientPayment, false)
    assert.equal(clientPayment.verificationNote, undefined)
    await request(app).post(`/api/payments/${paymentId}/disputes`).set('Authorization', `******`)
      .auth(clientBToken, { type: 'bearer' }).send({ claimedAmount: 2900, reference: 'UPI-B-123', explanation: 'The received amount does not match the amount I transferred.' })
      .expect(201)
    const updatedClientPayments = await request(app).get('/api/payments').set('Authorization', `******`).auth(clientBToken, { type: 'bearer' }).expect(200)
    const dispute = updatedClientPayments.body.data.find((item) => item.id === paymentId).disputes[0]
    assert.equal(dispute.status, 'open')
    assert.equal('reviewedBy' in dispute, false)
    await request(app).patch(`/api/payments/${paymentId}/disputes/${dispute.id}`).set('Authorization', `******`)
      .auth(teamToken, { type: 'bearer' }).send({ status: 'resolved', response: 'We confirmed your transfer and corrected the transaction record.' })
      .expect(200)
    const resolvedClientPayments = await request(app).get('/api/payments').set('Authorization', `******`).auth(clientBToken, { type: 'bearer' }).expect(200)
    assert.equal(resolvedClientPayments.body.data.find((item) => item.id === paymentId).disputes[0].status, 'resolved')
  })

  await t.test('internal cash receipts require a second approver while client cash submissions require team verification', async () => {
    const createFounder = async (name, email, role) => {
      const founder = await models.User.create({
        name,
        email,
        passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
        role,
        portalType: 'team',
      })
      const login = await request(app).post('/api/auth/login').send({ email, password: 'SecureTestPassword123!' }).expect(200)
      return { founder, token: login.body.data.token }
    }
    const first = await createFounder('First Founder', 'founder1@test.magaf', 'super_admin')
    const second = await createFounder('Second Founder', 'founder2@test.magaf', 'admin')
    const recorded = await request(app).post('/api/payments').set('Authorization', `******`)
      .auth(first.token, { type: 'bearer' }).send({ clientId: clientB.id, projectId: projectB.id, amount: 5000, paymentMethod: 'cash', status: 'paid' })
      .expect(201)
    const paymentId = recorded.body.data.id
    assert.equal(recorded.body.data.status, 'under_verification')
    assert.equal(recorded.body.data.verificationStatus, 'awaiting_second_approval')
    assert.equal((await models.Project.findById(projectB.id)).paidAmount, 0)
    await request(app).patch(`/api/payments/${paymentId}`).set('Authorization', `******`)
      .auth(first.token, { type: 'bearer' }).send({ status: 'paid' })
      .expect(409)
    await request(app).patch(`/api/payments/${paymentId}/cash-approval`).set('Authorization', `******`).auth(first.token, { type: 'bearer' }).expect(403)
    const approved = await request(app).patch(`/api/payments/${paymentId}/cash-approval`).set('Authorization', `******`).auth(second.token, { type: 'bearer' }).expect(200)
    assert.equal(approved.body.data.status, 'paid')
    assert.equal(approved.body.data.cashApprovedBy, second.founder.id)
    assert.equal((await models.Project.findById(projectB.id)).paidAmount, 5000)
    const finalCash = await request(app).post('/api/payments')
      .auth(second.token, { type: 'bearer' })
      .send({ clientId: clientB.id, projectId: projectB.id, amount: 10000, paymentMethod: 'cash' })
      .expect(201)
    assert.equal(finalCash.body.data.isFinalPayment, false)
    const finalCashApproval = await request(app).patch(`/api/payments/${finalCash.body.data.id}/cash-approval`)
      .auth(teamToken, { type: 'bearer' })
      .expect(200)
    assert.equal(finalCashApproval.body.data.isFinalPayment, true)
    assert.equal((await models.Project.findById(projectB.id)).finalPaymentId.toString(), finalCash.body.data.id)

    const clientCash = await request(app).post('/api/payments/client-submissions')
      .auth(clientAToken, { type: 'bearer' })
      .send({ amount: 200, paymentMethod: 'cash', projectId: projectA.id })
      .expect(201)
    assert.equal(clientCash.body.data.status, 'submitted')
    assert.equal(clientCash.body.data.verificationStatus, 'submitted')
    await request(app).patch(`/api/payments/${clientCash.body.data.id}/verification`)
      .auth(teamToken, { type: 'bearer' }).send({ action: 'verify' }).expect(200)
    assert.equal((await models.Project.findById(projectA.id)).paidAmount, 200)
  })

  await t.test('project distribution is finalized only once after full payment and snapshots founder-pool contributions', async () => {
    const founder = await models.User.create({
      name: 'Allocation Founder',
      email: 'allocation-founder@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'super_admin',
      portalType: 'team',
    })
    const login = await request(app).post('/api/auth/login')
      .send({ email: founder.email, password: 'SecureTestPassword123!' })
      .expect(200)
    const project = await models.Project.create({
      projectName: 'Allocation Snapshot Project',
      clientId: clientA.id,
      serviceId: service.id,
      finalAmount: 2000,
      quotedAmount: 2000,
      balanceAmount: 2000,
      status: 'planning',
    })
    await request(app).put(`/api/finance/projects/${project.id}/distribution-rules`)
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ companySharePercent: 60, founderShares: [{ userId: founder.id, percent: 100 }] })
      .expect(200)
    await request(app).put(`/api/finance/projects/${project.id}/distribution-rules`)
      .auth(teamToken, { type: 'bearer' })
      .send({ companySharePercent: 50, founderShares: [{ userId: founder.id, percent: 50 }] })
      .expect(403)
    await request(app).put(`/api/finance/projects/${project.id}/distribution-rules`)
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ companySharePercent: 90, founderShares: [{ userId: founder.id, percent: 20 }] })
      .expect(400)
    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const firstProof = await createPaymentProof({ user: teamUser, clientId: clientA.id, projectId: project.id })
    const receipt = await request(app).post('/api/payments')
      .auth(teamToken, { type: 'bearer' })
      .send({ projectId: project.id, amount: 1250, paymentMethod: 'upi', status: 'paid', proofFiles: [firstProof.id] })
      .expect(201)
    const paymentId = receipt.body.data.id
    assert.equal(receipt.body.data.status, 'paid')
    assert.equal(receipt.body.data.verificationStatus, 'not_required')
    assert.equal(receipt.body.data.isFinalPayment, false)
    assert.equal(await models.RevenueDistribution.countDocuments({ projectId: project.id }), 0)
    const finalProof = await createPaymentProof({ user: teamUser, clientId: clientA.id, projectId: project.id })
    const finalReceipt = await request(app).post('/api/payments')
      .auth(teamToken, { type: 'bearer' })
      .send({ projectId: project.id, amount: 750, paymentMethod: 'upi', status: 'paid', proofFiles: [finalProof.id] })
      .expect(201)
    assert.equal((await models.Project.findById(project.id)).paymentStatus, 'paid')
    assert.equal((await models.Project.findById(project.id)).finalPaymentId.toString(), finalReceipt.body.data.id)
    assert.equal(finalReceipt.body.data.isFinalPayment, true)
    assert.equal(await models.RevenueDistribution.countDocuments({ projectId: project.id }), 0)
    const beforeChange = await request(app).post(`/api/finance/projects/${project.id}/distribution`)
      .auth(login.body.data.token, { type: 'bearer' }).send({}).expect(201)
    assert.equal(beforeChange.body.data.grossAmount, 2000)
    assert.equal(beforeChange.body.data.companyAmount, 1200)
    assert.equal(beforeChange.body.data.founderPoolAmount, 800)
    assert.equal(beforeChange.body.data.allocations.find((item) => item.recipientType === 'founder').amount, 800)
    assert.equal(beforeChange.body.data.allocations.find((item) => item.recipientType === 'founder').contributionPercentage, 100)
    await request(app).put(`/api/finance/projects/${project.id}/distribution-rules`)
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ companySharePercent: 25, founderShares: [{ userId: founder.id, percent: 100 }] })
      .expect(409)
    const unchanged = await models.RevenueDistribution.findById(beforeChange.body.data.id)
    assert.equal(unchanged.companySharePercent, 60)
    const summary = await request(app).get(`/api/finance/distributions/summary?projectId=${project.id}`)
      .auth(teamToken, { type: 'bearer' })
      .expect(200)
    assert.equal(summary.body.data.find((row) => row.recipientType === 'company').amount, 1200)
    assert.equal(summary.body.data.find((row) => row.recipientType === 'founder').amount, 800)
    await request(app).post('/api/finance/founder-transfers')
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ fromFounderId: founder.id, toOwnerType: 'company', distributionId: beforeChange.body.data.id, amount: 300, reason: 'Fund company operations' })
      .expect(201)
    let balances = await request(app).get(`/api/finance/distributions/summary?projectId=${project.id}`)
      .auth(teamToken, { type: 'bearer' })
      .expect(200)
    assert.equal(balances.body.data.find((row) => row.recipientType === 'company').amount, 1500)
    assert.equal(balances.body.data.find((row) => row.recipientType === 'founder').amount, 500)
    await request(app).post('/api/finance/founder-transfers')
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ fromFounderId: founder.id, toOwnerType: 'company', amount: 100, reason: 'Global available balance transfer' })
      .expect(201)
    await request(app).post('/api/finance/company-transactions')
      .auth(teamToken, { type: 'bearer' })
      .send({ type: 'external_funding', amount: 10, description: 'Unauthorized funding entry' })
      .expect(403)
    await request(app).post('/api/finance/company-transactions')
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ type: 'investment', amount: 1300, description: 'Company equipment' })
      .expect(201)
    await request(app).post('/api/finance/company-transactions')
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ type: 'investment', amount: 400, description: 'Over budget investment' })
      .expect(409)
    await request(app).post('/api/finance/company-transactions')
      .auth(login.body.data.token, { type: 'bearer' })
      .send({ type: 'external_funding', amount: 50, description: 'Founder advance' })
      .expect(201)
    balances = await request(app).get('/api/finance/distributions/summary')
      .auth(teamToken, { type: 'bearer' })
      .expect(200)
    assert.equal(balances.body.data.find((row) => row.recipientType === 'company').amount, 350)
    assert.equal(balances.body.data.find((row) => row.recipientType === 'company').externalFunding, 50)
    assert.equal(balances.body.data.find((row) => row.recipientType === 'company').investments, 1300)
    const companyTransactions = await request(app).get('/api/finance/company-transactions')
      .auth(teamToken, { type: 'bearer' })
      .expect(200)
    assert.equal(companyTransactions.body.data.length, 2)
    assert.equal((await models.RevenueDistribution.findById(beforeChange.body.data.id)).companyAmount, 1200)
    const audit = await request(app).get(`/api/finance/audit?projectId=${project.id}`)
      .auth(login.body.data.token, { type: 'bearer' })
      .expect(200)
    assert.ok(audit.body.data.some((entry) => entry.action === 'revenue_distribution.finalized' && entry.after.allocations.length === 2))
    assert.ok(audit.body.data.some((entry) => entry.action === 'revenue_distribution.finalized'))
  })

  await t.test('distribution correction and reversal preserve balances and permit a later finalization', async () => {
    const founder = await models.User.create({
      name: 'Reversal Founder',
      email: 'reversal-founder@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'super_admin',
      portalType: 'team',
    })
    const login = await request(app).post('/api/auth/login')
      .send({ email: founder.email, password: 'SecureTestPassword123!' }).expect(200)
    const token = login.body.data.token
    const project = await models.Project.create({
      projectName: 'Reversal Test Project',
      clientId: clientA.id,
      serviceId: service.id,
      finalAmount: 2000,
      quotedAmount: 2000,
      balanceAmount: 0,
      status: 'planning',
    })
    const payment = await models.Payment.create({
      clientId: clientA.id,
      projectId: project.id,
      amount: 2000,
      status: 'paid',
      paymentMethod: 'upi',
      verificationStatus: 'verified',
      recordedBy: founder.id,
    })
    await request(app).put(`/api/finance/projects/${project.id}/distribution-rules`)
      .auth(token, { type: 'bearer' })
      .send({ companySharePercent: 60, founderShares: [{ userId: founder.id, percent: 100 }] })
      .expect(200)
    const original = await request(app).post(`/api/finance/projects/${project.id}/distribution`)
      .auth(token, { type: 'bearer' }).send({}).expect(201)
    const correctionResponse = await request(app).patch(`/api/finance/distributions/${original.body.data.id}`)
      .auth(token, { type: 'bearer' })
      .send({ companySharePercent: 50, founderShares: [{ userId: founder.id, percent: 100 }], reason: 'Correct allocation percentages' })
    assert.equal(correctionResponse.status, 200, JSON.stringify(correctionResponse.body))
    const corrected = correctionResponse
    assert.equal(corrected.body.data.companyAmount, 1000)
    assert.equal((await models.Project.findById(project.id)).companySharePercent, 50)
    const transfer = await request(app).post('/api/finance/founder-transfers')
      .auth(token, { type: 'bearer' })
      .send({ fromFounderId: founder.id, toOwnerType: 'company', distributionId: corrected.body.data.id, amount: 100, reason: 'Operations contribution' })
      .expect(201)
    await request(app).post(`/api/finance/distributions/${corrected.body.data.id}/reversal`)
      .auth(token, { type: 'bearer' }).send({ reason: 'Reverse allocation' }).expect(409)
    await request(app).post(`/api/finance/founder-transfers/${transfer.body.data.id}/reversal`)
      .auth(token, { type: 'bearer' }).send({ reason: 'Undo operations contribution' }).expect(200)
    await request(app).post(`/api/finance/distributions/${corrected.body.data.id}/reversal`)
      .auth(token, { type: 'bearer' }).send({ reason: 'Correct historical allocation' }).expect(201)
    const net = await request(app).get(`/api/finance/distributions/summary?projectId=${project.id}`)
      .auth(token, { type: 'bearer' }).expect(200)
    assert.equal(net.body.data.find((row) => row.recipientType === 'company').amount, 0)
    assert.equal(net.body.data.find((row) => row.recipientType === 'founder').amount, 0)
    const next = await request(app).post(`/api/finance/projects/${project.id}/distribution`)
      .auth(token, { type: 'bearer' }).send({}).expect(201)
    assert.notEqual(next.body.data.id, original.body.data.id)
    assert.equal(next.body.data.companyAmount, 1000)
    const investments = await Promise.all([
      request(app).post('/api/finance/company-transactions')
        .auth(token, { type: 'bearer' }).send({ type: 'investment', amount: 700, description: 'Concurrent investment A' }),
      request(app).post('/api/finance/company-transactions')
        .auth(token, { type: 'bearer' }).send({ type: 'investment', amount: 700, description: 'Concurrent investment B' }),
    ])
    assert.deepEqual(investments.map((result) => result.status).sort(), [201, 409])
    await request(app).post(`/api/finance/distributions/${next.body.data.id}/reversal`)
      .auth(token, { type: 'bearer' }).send({ reason: 'Attempt to reverse spent funds' }).expect(409)
    assert.equal(await models.Payment.findById(payment.id).then((row) => row.status), 'paid')
    const history = await request(app).get('/api/finance/founder-transfers')
      .auth(token, { type: 'bearer' }).expect(200)
    assert.equal(history.body.data.find((row) => row.id === transfer.body.data.id).status, 'reversed')
    await models.FinanceLock.create({ key: 'owner:company:INR', token: 'expired-lock', expiresAt: new Date(Date.now() - 1000) })
    await request(app).post('/api/finance/company-transactions')
      .auth(token, { type: 'bearer' })
      .send({ type: 'external_funding', amount: 1, description: 'Verify expired lock recovery' })
      .expect(201)
    assert.equal(await models.FinanceLock.exists({ key: 'owner:company:INR' }), null)
  })

  await t.test('concurrent client payment reviews cannot overpay a project', async () => {
    const project = await models.Project.create({
      projectName: 'Concurrent Verification Project',
      clientId: clientA.id,
      serviceId: service.id,
      finalAmount: 1000,
      quotedAmount: 1000,
      balanceAmount: 1000,
      status: 'planning',
    })
    const clientUser = await models.User.findById(clientA.userId)
    const proofs = await Promise.all([
      createPaymentProof({ user: clientUser, clientId: clientA.id, projectId: project.id, ownerType: 'client' }),
      createPaymentProof({ user: clientUser, clientId: clientA.id, projectId: project.id, ownerType: 'client' }),
    ])
    const submissions = await Promise.all(proofs.map((proof) => request(app).post('/api/payments/client-submissions')
      .auth(clientAToken, { type: 'bearer' })
      .send({ amount: 600, paymentMethod: 'upi', projectId: project.id, proofFiles: [proof.id] })
      .expect(201)))
    const reviews = await Promise.all(submissions.map((submission) => request(app).patch(`/api/payments/${submission.body.data.id}/verification`)
      .auth(teamToken, { type: 'bearer' }).send({ action: 'verify' })))
    assert.deepEqual(reviews.map((result) => result.status).sort(), [200, 409])
    const paid = await models.Payment.aggregate([
      { $match: { projectId: project._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    assert.equal(paid[0].total, 600)
  })

  await t.test('payment accounts show only active client instructions and remain linked to client submissions', async () => {
    const finance = await models.User.create({
      name: 'Account Finance',
      email: 'account-finance@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'finance',
      portalType: 'team',
    })
    const financeLogin = await request(app).post('/api/auth/login')
      .send({ email: finance.email, password: 'SecureTestPassword123!' })
      .expect(200)
    const active = await request(app).post('/api/finance/payment-accounts')
      .auth(financeLogin.body.data.token, { type: 'bearer' })
      .send({
        name: 'MAGAF UPI',
        method: 'upi',
        upiId: 'magaf@bank',
        instructions: 'Use your invoice number in the payment note.',
        internalNotes: 'Finance review notes only.',
      })
      .expect(201)
    await request(app).post('/api/finance/payment-accounts')
      .auth(financeLogin.body.data.token, { type: 'bearer' })
      .send({ name: 'Inactive UPI', method: 'upi', upiId: 'inactive@bank', isActive: false })
      .expect(201)
    const clientAccounts = await request(app).get('/api/finance/payment-accounts')
      .auth(clientAToken, { type: 'bearer' })
      .expect(200)
    assert.equal(clientAccounts.body.data.length, 1)
    assert.equal(clientAccounts.body.data[0].upiId, 'magaf@bank')
    assert.equal('internalNotes' in clientAccounts.body.data[0], false)
    const clientUser = await models.User.findOne({ email: 'portal-a@test.magaf' })
    const clientProof = await createPaymentProof({ user: clientUser, clientId: clientA.id, projectId: projectA.id, ownerType: 'client' })
    const submission = await request(app).post('/api/payments/client-submissions')
      .auth(clientAToken, { type: 'bearer' })
      .send({
        amount: 25,
        paymentMethod: 'upi',
        paymentAccountId: active.body.data.id,
        projectId: projectA.id,
        transactionId: 'UPI-ACCOUNT-LINK-01',
        proofFiles: [clientProof.id],
      })
    assert.equal(submission.status, 201, JSON.stringify(submission.body))
    assert.equal(submission.body.data.paymentAccountId, active.body.data.id)
    assert.equal(submission.body.data.receivingAccount, 'MAGAF UPI')
    await request(app).patch(`/api/finance/payment-accounts/${active.body.data.id}`)
      .auth(financeLogin.body.data.token, { type: 'bearer' })
      .send({ isActive: false })
      .expect(200)
    const deactivatedAccounts = await request(app).get('/api/finance/payment-accounts')
      .auth(clientAToken, { type: 'bearer' })
      .expect(200)
    assert.equal(deactivatedAccounts.body.data.length, 0)
  })

  await t.test('lead conversion creates one linked client and rejects duplicate conversion', async () => {
    const lead = await models.Lead.create({ name: 'Prospective Client', email: 'prospect@test.magaf', companyName: 'Prospect Labs', serviceId: service.id })
    const converted = await request(app).post(`/api/leads/${lead.id}/convert`).set('Authorization', `Bearer ${teamToken}`)
    assert.equal(converted.status, 201, JSON.stringify(converted.body))
    assert.equal(converted.body.data.name, 'Prospect Labs')
    const savedLead = await models.Lead.findById(lead.id)
    assert.equal(savedLead.status, 'converted')
    assert.equal(savedLead.convertedClientId.toString(), converted.body.data.id)
    await request(app).post(`/api/leads/${lead.id}/convert`).set('Authorization', `Bearer ${teamToken}`).expect(409)
  })

  await t.test('paid expenses are reflected in server-calculated net dashboard revenue', async () => {
    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const proof = await createPaymentProof({ user: teamUser, clientId: clientA.id, projectId: projectA.id })
    await request(app).post('/api/payments').set('Authorization', `Bearer ${teamToken}`).send({ projectId: projectA.id, amount: 2500, status: 'paid', paymentMethod: 'upi', proofFiles: [proof.id] }).expect(201)
    await request(app).post('/api/expenses').set('Authorization', `Bearer ${teamToken}`).send({
      category: 'software', description: 'Development tooling', amount: 700, status: 'paid',
    }).expect(201)
    const dashboard = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${teamToken}`)
    assert.equal(dashboard.body.data.revenue.paidExpenses, 700)
    assert.equal(dashboard.body.data.revenue.netAfterExpenses, 1800)
    await request(app).get('/api/expenses').set('Authorization', `Bearer ${clientAToken}`).expect(403)
  })

  await t.test('all-time revenue analytics uses historical receipts and monthly buckets', async () => {
    await models.Payment.create({
      amount: 2400,
      paymentMethod: 'upi',
      status: 'paid',
      paymentDate: new Date('2024-03-15T12:00:00.000Z'),
      clientId: clientA.id,
      projectId: projectA.id,
      serviceId: service.id,
    })
    const response = await request(app).get('/api/dashboard/revenue?range=all_time')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .expect(200)
    assert.equal(response.body.data.interval, 'month')
    assert.equal(response.body.data.series[0].date, '2024-03')
    assert.equal(response.body.data.series[0].revenue, 2400)
  })

  await t.test('message threads enforce client isolation and record multiple team read receipts', async () => {
    const conversation = await request(app).post('/api/conversations').set('Authorization', `Bearer ${clientAToken}`).send({ projectId: projectA.id }).expect(201)
    const message = await request(app).post('/api/messages').set('Authorization', `Bearer ${clientAToken}`).send({ conversationId: conversation.body.data.id, content: 'Please review the attached requirement.' }).expect(201)
    await request(app).get(`/api/conversations/${conversation.body.data.id}/messages`).set('Authorization', `Bearer ${clientBToken}`).expect(404)
    const manager = await models.User.findOne({ email: 'manager@test.magaf' })
    const second = await models.User.findOne({ email: 'manager2@test.magaf' })
    const teamTokens = await Promise.all([manager, second].map(async (user, index) => {
      const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'SecureTestPassword123!' })
      return login.body.data.token
    }))
    await request(app).patch(`/api/messages/${message.body.data.id}/read`).set('Authorization', `Bearer ${teamTokens[0]}`).expect(200)
    await request(app).patch(`/api/messages/${message.body.data.id}/read`).set('Authorization', `Bearer ${teamTokens[1]}`).expect(200)
    await request(app).get(`/api/conversations/${conversation.body.data.id}/messages`)
      .set('Authorization', `Bearer ${teamTokens[0]}`).expect(200)
    const stored = await models.Message.findById(message.body.data.id)
    assert.equal(stored.readReceipts.length, 2)
    const clientMessages = await request(app).get(`/api/conversations/${conversation.body.data.id}/messages`).set('Authorization', `Bearer ${clientAToken}`).expect(200)
    assert.equal(clientMessages.body.data[0].teamReadCount, 2)
    assert.equal(clientMessages.body.data[0].readReceipts.length, 0)
    const managerNotice = await models.Notification.findOne({ recipient: manager._id, relatedEntityId: conversation.body.data.id, type: 'message' })
    assert.ok(managerNotice)
    await request(app).post('/api/messages')
      .auth(teamTokens[0], { type: 'bearer' })
      .send({ conversationId: conversation.body.data.id, content: 'We have reviewed your requirement.' })
      .expect(201)
    const clientNotice = await request(app).get('/api/notifications').auth(clientAToken, { type: 'bearer' }).expect(200)
    assert.ok(clientNotice.body.data.some((notification) => notification.relatedEntityId === conversation.body.data.id && notification.type === 'message'))
  })

  await t.test('mentoring payments, sessions and service extensions use their connected models', async () => {
    const mentoringService = await models.Service.create({ name: 'Mentoring', slug: 'development-mentoring', isActive: true })
    const student = await models.Student.create({ name: 'Test Student', serviceId: mentoringService.id, status: 'active', sessionsRemaining: 2 })
    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const proof = await createPaymentProof({ user: teamUser })
    const mentoringPayment = await request(app).post('/api/mentoring/payments').set('Authorization', `Bearer ${teamToken}`).send({ studentId: student.id, amount: 1500, status: 'paid', paymentMethod: 'upi', proofFiles: [proof.id] }).expect(201)
    assert.equal(mentoringPayment.body.data.paymentType, 'mentoring_fee')
    const session = await request(app).post('/api/mentoring/sessions').set('Authorization', `Bearer ${teamToken}`).send({
      studentId: student.id, date: new Date().toISOString(), topic: 'Node.js fundamentals',
    }).expect(201)
    await request(app).patch(`/api/mentoring/sessions/${session.body.data.id}`).set('Authorization', `Bearer ${teamToken}`).send({ status: 'completed' }).expect(200)
    const updatedStudent = await models.Student.findById(student.id)
    assert.equal(updatedStudent.sessionsCompleted, 1)
    assert.equal(updatedStudent.sessionsRemaining, 1)
    assert.equal(updatedStudent.paidAmount, 1500)

    const advertisingService = await models.Service.create({ name: 'Advertising', slug: 'advertising-creative', isActive: true })
    const advertisingProject = await models.Project.create({ projectName: 'Campaign', clientId: clientA.id, serviceId: advertisingService.id, finalAmount: 5000, balanceAmount: 5000 })
    const creative = await request(app).post('/api/advertising/projects').set('Authorization', `Bearer ${teamToken}`).send({ projectId: advertisingProject.id, creativeType: 'short_video' }).expect(201)
    assert.equal(creative.body.data.projectId, advertisingProject.id)
    assert.equal(creative.body.data.quotedAmount, 5000)

    const startDate = new Date(Date.now() - 86400000).toISOString()
    const endDate = new Date(Date.now() + 86400000).toISOString()
    const target = await request(app).post('/api/targets').set('Authorization', `Bearer ${teamToken}`).send({ targetType: 'revenue', period: 'custom', targetValue: 1000, startDate, endDate }).expect(201)
    const targetList = await request(app).get('/api/targets').set('Authorization', `Bearer ${teamToken}`).expect(200)
    assert.equal(targetList.body.data.find((item) => item.id === target.body.data.id).currentValue, 1500)
  })

  await t.test('lead targets calculate their current progress on the backend', async () => {
    await models.Lead.create({ name: 'Target Lead', companyName: 'Target Labs', serviceId: service.id })
    const startDate = new Date(Date.now() - 86400000).toISOString()
    const endDate = new Date(Date.now() + 86400000).toISOString()
    const target = await request(app).post('/api/targets').set('Authorization', `Bearer ${teamToken}`).send({
      targetType: 'leads', period: 'custom', targetValue: 3, startDate, endDate,
    }).expect(201)
    const listed = await request(app).get('/api/targets').set('Authorization', `Bearer ${teamToken}`).expect(200)
    assert.equal(listed.body.data.find((item) => item.id === target.body.data.id).currentValue, 1)
    const acquisition = await request(app).get('/api/analytics/acquisition').set('Authorization', `Bearer ${teamToken}`).expect(200)
    assert.equal(acquisition.body.data.leadConversion.total, 1)
    assert.equal(acquisition.body.data.leadSources[0].count, 1)
  })

  await t.test('project status updates follow valid delivery transitions', async () => {
    await request(app).patch(`/api/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ status: 'completed' })
      .expect(409)
    await request(app).patch(`/api/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ status: 'in_progress' })
      .expect(200)
    await request(app).patch(`/api/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ status: 'review' })
      .expect(200)
  })

  await t.test('role restrictions and request validation fail closed', async () => {
    const created = await models.User.create({ name: 'Developer', email: 'dev@test.magaf', passwordHash: await bcrypt.hash('SecureTestPassword123!', 4), role: 'developer', portalType: 'team' })
    const login = await request(app).post('/api/auth/login').send({ email: created.email, password: 'SecureTestPassword123!' })
    await request(app).post('/api/payments').set('Authorization', `Bearer ${login.body.data.token}`).send({ projectId: projectA.id, amount: 100, status: 'paid' }).expect(403)
    const invalid = await request(app).post('/api/projects').set('Authorization', `Bearer ${teamToken}`).send({ projectName: 'Missing relationships' }).expect(400)
    assert.equal(invalid.body.success, false)
    assert.equal('stack' in invalid.body, false)
  })

  await t.test('assignment directory and records exclude client portal users', async () => {
    const clientUser = await models.User.findOne({ email: 'portal-a@test.magaf' })
    const misconfiguredClient = await models.User.create({
      name: 'Misconfigured Client',
      email: 'client-team-portal@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'client',
      portalType: 'team',
    })
    const teamUsers = await request(app).get('/api/team-members')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .expect(200)
    assert.equal(teamUsers.body.data.some((user) => user.id === clientUser.id), false)
    assert.equal(teamUsers.body.data.some((user) => user.id === misconfiguredClient.id), false)
    assert.equal(teamUsers.body.data.every((user) => user.role !== 'client'), true)

    const adminUser = await models.User.create({
      name: 'Test Admin',
      email: 'admin@test.magaf',
      passwordHash: await bcrypt.hash('SecureTestPassword123!', 4),
      role: 'admin',
      portalType: 'team',
    })
    const adminLogin = await request(app).post('/api/auth/login')
      .send({ email: adminUser.email, password: 'SecureTestPassword123!' })
    const listedUsers = await request(app).get('/api/users')
      .set('Authorization', ['Bearer', adminLogin.body.data.token].join(' '))
      .expect(200)
    assert.equal(listedUsers.body.data.some((user) => user.id === clientUser.id), false)
    await request(app).get(`/api/users/${clientUser.id}`)
      .set('Authorization', ['Bearer', adminLogin.body.data.token].join(' '))
      .expect(404)

    await request(app).get('/api/team-members')
      .set('Authorization', ['Bearer', clientAToken].join(' '))
      .expect(403)

    await request(app).post('/api/projects')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .send({
        projectName: 'Reject client assignment',
        clientId: clientA.id,
        serviceId: service.id,
        projectManager: clientUser.id,
        assignedTeamMembers: [clientUser.id],
      })
      .expect(400)

    await request(app).post('/api/projects')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .send({
        projectName: 'Reject client-role assignment',
        clientId: clientA.id,
        serviceId: service.id,
        projectManager: misconfiguredClient.id,
      })
      .expect(400)

    await request(app).patch(`/api/projects/${projectA.id}`)
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .send({ assignedTeamMembers: [clientUser.id] })
      .expect(400)

    await request(app).post('/api/tasks')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .send({ projectId: projectA.id, title: 'Reject client task owner', assignedTo: clientUser.id })
      .expect(400)

    const teamUser = await models.User.findOne({ email: 'manager@test.magaf' })
    const assigned = await request(app).post('/api/projects')
      .set('Authorization', ['Bearer', teamToken].join(' '))
      .send({
        projectName: 'Internal team assignment',
        clientId: clientA.id,
        serviceId: service.id,
        projectManager: teamUser.id,
        assignedTeamMembers: [teamUser.id],
      })
      .expect(201)
    assert.equal(assigned.body.data.projectManager.toString(), teamUser.id.toString())
  })

  await t.test('Cloudinary-unconfigured uploads reject files explicitly and accept ZIP archives without fake records', async () => {
    const result = await request(app).post('/api/files/upload').set('Authorization', `Bearer ${teamToken}`)
      .field('projectId', projectA.id)
      .attach('files', Buffer.from('%PDF-1.7 demo test'), { filename: 'requirement.pdf', contentType: 'application/pdf' })
      .expect(503)
    assert.match(result.body.message, /Cloudinary is not configured/)
    const archive = await request(app).post('/api/files/upload').auth(teamToken, { type: 'bearer' })
      .field('projectId', projectA.id)
      .attach('files', Buffer.from('PK\u0003\u0004archive fixture'), { filename: 'project-materials.zip', contentType: 'application/x-zip-compressed' })
      .expect(503)
    assert.match(archive.body.message, /Cloudinary is not configured/)
    assert.equal(await models.FileAsset.countDocuments(), 0)
  })
})
