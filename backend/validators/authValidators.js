import { body } from 'express-validator'

export const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 128 }),
]

export const changePasswordRules = [
  body('currentPassword').isString().isLength({ min: 6, max: 128 }),
  body('newPassword').isString().isLength({ min: 10, max: 128 }),
]

export const registerClientRules = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 10, max: 128 }),
]
