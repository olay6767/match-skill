import type { RequestHandler } from 'express'
import { ApiError } from '../lib/http.js'

export const requireSuperAdmin: RequestHandler = (request, _response, next) => {
  if (request.admin?.role !== 'super_admin') {
    next(new ApiError(403, 'หน้านี้อนุญาตเฉพาะ Super Admin'))
    return
  }
  next()
}
