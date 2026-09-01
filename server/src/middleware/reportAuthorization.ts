import type { RequestHandler } from 'express'
import { ApiError } from '../lib/http.js'

const exportRoles = new Set(['super_admin'])

export const requireReportExportPermission: RequestHandler = (request, _response, next) => {
  if (!request.admin || !exportRoles.has(request.admin.role)) {
    next(new ApiError(403, 'บัญชีนี้ไม่มีสิทธิ์ส่งออกรายงาน'))
    return
  }
  next()
}
