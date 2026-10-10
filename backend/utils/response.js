export function success(res, data, message = 'OK', statusCode = 200, meta) {
  return res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) })
}

export function failure(res, message, statusCode = 400, errors = []) {
  return res.status(statusCode).json({ success: false, message, errors })
}
