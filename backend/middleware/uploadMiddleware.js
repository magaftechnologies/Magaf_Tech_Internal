import multer from 'multer'
import { env } from '../config/environment.js'

const permittedMimeTypes = /^(image\/(jpeg|png|webp|gif|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|wav|webm|ogg)|application\/(pdf|zip|x-zip-compressed|vnd\.openxmlformats-officedocument\..+|msword|vnd\.ms-excel)|text\/(plain|csv))$/

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxFileSizeBytes, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!permittedMimeTypes.test(file.mimetype)) return callback(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { statusCode: 415 }))
    return callback(null, true)
  },
})
