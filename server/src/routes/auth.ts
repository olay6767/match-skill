import { Router } from 'express'
import argon2 from 'argon2'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin, sessionCookieName } from '../middleware/auth.js'
import { isDatabaseAvailable } from '../db/availability.js'
import { isMailConfigured, sendPasswordResetEmail } from '../lib/mail.js'

type AdminRow = {
  id: number
  email: string
  password_hash: string
  full_name: string
  role: string
  is_active: number | boolean
  session_version: number
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  remember: z.boolean().default(false),
})

const passwordSchema = z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128)
const accountIsActive = (value: number | boolean) => value === true || value === 1
const forgotPasswordSchema = z.object({ email: z.email() })
const resetPasswordSchema = z.object({ token: z.string().min(32), password: passwordSchema })
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

function requestMetadata(request: { ip?: string; get(name: string): string | undefined }) {
  return [request.ip ?? null, request.get('user-agent')?.slice(0, 255) ?? null]
}

async function writeAuthLog(
  request: Parameters<typeof requestMetadata>[0],
  email: string,
  action: string,
  adminId: number | null,
) {
  const [ipAddress, userAgent] = requestMetadata(request)
  await pool.query(
    `INSERT INTO admin_auth_logs (admin_id, email, action, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [adminId, email, action, ipAddress, userAgent],
  )
}

export const authRouter = Router()

authRouter.post('/login', async (request, response) => {
  const credentials = loginSchema.parse(request.body)
  const normalizedEmail = credentials.email.toLowerCase()
  let admin: AdminRow | undefined

  if (isDatabaseAvailable()) {
    const rows = await pool.query<AdminRow[]>(
      `SELECT id, email, password_hash, full_name, role, is_active, session_version
       FROM admins WHERE email = ? LIMIT 1`,
      [normalizedEmail],
    )
    admin = rows[0]
  } else if (
    env.NODE_ENV !== 'production' &&
    normalizedEmail === env.DEV_ADMIN_EMAIL.toLowerCase() &&
    credentials.password === env.DEV_ADMIN_PASSWORD
  ) {
    admin = {
      id: 1,
      email: env.DEV_ADMIN_EMAIL.toLowerCase(),
      password_hash: '',
      full_name: env.DEV_ADMIN_NAME,
      role: 'super_admin',
      is_active: true,
      session_version: 1,
    }
  }

  const passwordValid = admin && (
    !isDatabaseAvailable() || await argon2.verify(admin.password_hash, credentials.password)
  )
  if (!admin || !accountIsActive(admin.is_active) || !passwordValid) {
    if (isDatabaseAvailable()) await writeAuthLog(request, normalizedEmail, 'login_failure', admin ? Number(admin.id) : null)
    throw new ApiError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  const adminId = Number(admin.id)
  const expiresIn = credentials.remember ? '7d' : '8h'
  const token = jwt.sign(
    { email: admin.email, role: admin.role, sessionVersion: Number(admin.session_version) },
    env.JWT_SECRET,
    { subject: String(adminId), expiresIn },
  )
  if (isDatabaseAvailable()) await writeAuthLog(request, admin.email, 'login_success', adminId)

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

authRouter.post('/forgot-password', async (request, response) => {
  const { email } = forgotPasswordSchema.parse(request.body)
  const normalizedEmail = email.toLowerCase()
  if (!isDatabaseAvailable()) {
    throw new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อม กรุณาลองใหม่ภายหลัง')
  }
  const rows = await pool.query<Pick<AdminRow, 'id' | 'email'>[]>(
    'SELECT id, email FROM admins WHERE email = ? LIMIT 1',
    [normalizedEmail],
  )
  const admin = rows[0]
  let resetUrl: string | undefined

  if (admin) {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await pool.query('UPDATE admin_password_reset_tokens SET used_at = NOW() WHERE admin_id = ? AND used_at IS NULL', [admin.id])
    await pool.query(
      `INSERT INTO admin_password_reset_tokens (admin_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [admin.id, tokenHash],
    )
    resetUrl = `${env.ADMIN_FRONTEND_URL}/admin/reset-password?token=${rawToken}`
    if (env.NODE_ENV === 'production') {
      if (!isMailConfigured()) throw new ApiError(503, 'ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ')
      await sendPasswordResetEmail(admin.email, resetUrl)
    }
    await writeAuthLog(request, normalizedEmail, 'password_reset_requested', Number(admin.id))
    if (env.NODE_ENV !== 'production') console.info(`Development password reset URL: ${resetUrl}`)
  }

  response.json({
    message: 'หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งคำแนะนำสำหรับตั้งรหัสผ่านใหม่',
    ...(env.NODE_ENV !== 'production' && resetUrl ? { resetUrl } : {}),
  })
})

authRouter.post('/reset-password', async (request, response) => {
  const { token, password } = resetPasswordSchema.parse(request.body)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const rows = await pool.query<Array<{ token_id: number; admin_id: number; email: string }>>(
    `SELECT t.id AS token_id, a.id AS admin_id, a.email
     FROM admin_password_reset_tokens t
     JOIN admins a ON a.id = t.admin_id
     WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  )
  const record = rows[0]
  if (!record) throw new ApiError(400, 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว')

  const passwordHash = await argon2.hash(password)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, record.admin_id])
    await connection.query('UPDATE admin_password_reset_tokens SET used_at = NOW() WHERE admin_id = ? AND used_at IS NULL', [record.admin_id])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  await writeAuthLog(request, record.email, 'password_reset_completed', Number(record.admin_id))
  response.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว' })
})

authRouter.post('/change-password', requireAdmin, async (request, response) => {
  const body = changePasswordSchema.parse(request.body)
  const rows = await pool.query<AdminRow[]>('SELECT id, email, password_hash, full_name, role, is_active, session_version FROM admins WHERE id = ? LIMIT 1', [request.admin!.id])
  const admin = rows[0]
  if (!admin || !(await argon2.verify(admin.password_hash, body.currentPassword))) {
    throw new ApiError(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง')
  }
  await pool.query('UPDATE admins SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [await argon2.hash(body.newPassword), admin.id])
  await writeAuthLog(request, admin.email, 'password_changed', Number(admin.id))
  response.clearCookie(sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' })
  response.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' })
})
