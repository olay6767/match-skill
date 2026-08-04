import { Router } from 'express'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin, sessionCookieName } from '../middleware/auth.js'

type AdminRow = {
  id: number
  email: string
  password_hash: string
  full_name: string
  role: string
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  remember: z.boolean().default(false),
})

export const authRouter = Router()

authRouter.post('/login', async (request, response) => {
  const credentials = loginSchema.parse(request.body)
  const rows = await pool.query<AdminRow[]>(
    `SELECT id, email, password_hash, full_name, role
     FROM admins WHERE email = ? LIMIT 1`,
    [credentials.email.toLowerCase()],
  )
  const admin = rows[0]

  if (!admin || !(await argon2.verify(admin.password_hash, credentials.password))) {
    throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  const adminId = Number(admin.id)
  const expiresIn = credentials.remember ? '7d' : '8h'
  const token = jwt.sign(
    { email: admin.email, role: admin.role },
    env.JWT_SECRET,
    { subject: String(adminId), expiresIn },
  )

  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    ...(credentials.remember ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
  })
  response.json({
    admin: { id: adminId, email: admin.email, name: admin.full_name, role: admin.role },
  })
})

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  })
  response.status(204).end()
})

authRouter.get('/me', requireAdmin, (request, response) => {
  response.json({ admin: request.admin })
})
