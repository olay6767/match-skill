import type { RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ApiError } from '../lib/http.js'

export const sessionCookieName = 'match_skill_session'

type AdminToken = JwtPayload & {
  sub: string
  email: string
  role: string
}

function isAdminToken(value: string | JwtPayload): value is AdminToken {
  return (
    typeof value !== 'string' &&
    typeof value.sub === 'string' &&
    typeof value.email === 'string' &&
    typeof value.role === 'string'
  )
}

export const requireAdmin: RequestHandler = (request, _response, next) => {
  const token = request.cookies?.[sessionCookieName]
  if (!token) {
    next(new ApiError(401, 'กรุณาเข้าสู่ระบบผู้ดูแลระบบ'))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    if (!isAdminToken(payload)) throw new Error('Invalid token payload')

    request.admin = {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role,
    }
    next()
  } catch {
    next(new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'))
  }
}
