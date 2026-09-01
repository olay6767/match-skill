import type { RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'

export const sessionCookieName = 'match_skill_session'

type AdminToken = JwtPayload & {
  sub: string
  email: string
  role: string
  sessionVersion: number
}

function isAdminToken(value: string | JwtPayload): value is AdminToken {
  return (
    typeof value !== 'string' &&
    typeof value.sub === 'string' &&
    typeof value.email === 'string' &&
    typeof value.role === 'string' &&
    typeof value.sessionVersion === 'number'
  )
}

function accountIsActive(value: number | boolean) {
  return value === true || value === 1
}

export const requireAdmin: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.[sessionCookieName]
  if (!token) {
    next(new ApiError(401, 'กรุณาเข้าสู่ระบบผู้ดูแลระบบ'))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    if (!isAdminToken(payload)) throw new Error('Invalid token payload')

    const id = Number(payload.sub)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid admin id')
    if (isDatabaseAvailable()) {
      const rows = await pool.query<Array<{ email: string; role: string; is_active: number | boolean; session_version: number }>>(
        'SELECT email, role, is_active, session_version FROM admins WHERE id = ? LIMIT 1', [id],
      )
      const admin = rows[0]
      if (!admin || !accountIsActive(admin.is_active) || Number(admin.session_version) !== payload.sessionVersion) throw new Error('Session revoked')
      request.admin = { id, email: admin.email, role: admin.role }
    } else {
      request.admin = { id, email: payload.email, role: payload.role }
    }
    next()
  } catch {
    next(new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'))
  }
}
