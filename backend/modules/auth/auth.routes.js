import { Router } from 'express'
import * as controller from './auth.controller.js'
import { changePasswordRules, loginRules } from '../../validators/authValidators.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'

const router = Router()
router.post('/login', loginRules, validate, controller.login)
router.get('/me', authenticate, controller.me)
router.post('/change-password', authenticate, changePasswordRules, validate, controller.changePassword)
export default router
