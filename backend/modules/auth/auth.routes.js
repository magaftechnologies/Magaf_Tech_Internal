import { Router } from 'express'
import * as controller from './auth.controller.js'
import { changePasswordRules, loginRules } from '../../validators/authValidators.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { allowRoles, requireTeam } from '../../middleware/roleMiddleware.js'
import { param } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/environment.js'

const router = Router()
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => env.nodeEnv === 'test' }), loginRules, validate, controller.login)
router.get('/me', authenticate, controller.me)
router.post('/change-password', authenticate, changePasswordRules, validate, controller.changePassword)
router.post('/users/:userId/reset-password', authenticate, requireTeam, allowRoles('super_admin', 'admin'), param('userId').isMongoId(), validate, controller.resetUserPassword)
export default router
