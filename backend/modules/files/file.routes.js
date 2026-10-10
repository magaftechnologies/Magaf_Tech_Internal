import { Router } from 'express'
import { authenticate } from '../../middleware/authMiddleware.js'
import { upload } from '../../middleware/uploadMiddleware.js'
import { validate } from '../../middleware/validationMiddleware.js'
import { objectIdParam } from '../../validators/businessValidators.js'
import * as controller from './file.controller.js'

const router = Router()
router.use(authenticate)
router.get('/', controller.list)
router.post('/upload', upload.array('files', 10), controller.upload)
router.post('/links', controller.createLink)
router.get('/:id', objectIdParam(), validate, controller.get)
router.patch('/:id', objectIdParam(), validate, controller.update)
router.delete('/:id', objectIdParam(), validate, controller.remove)
export default router
