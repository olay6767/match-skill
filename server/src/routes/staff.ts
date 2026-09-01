import { Router } from 'express'
import argon2 from 'argon2'
import { z } from 'zod'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/superAdminAuthorization.js'

const roleSchema = z.enum(['super_admin', 'staff'])
const passwordSchema = z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128)
const createSchema = z.object({ fullName: z.string().trim().min(1).max(150), email: z.email().transform((value) => value.toLowerCase()), password: passwordSchema, role: roleSchema.default('staff') })
const updateSchema = z.object({ role: roleSchema.optional(), isActive: z.boolean().optional() }).refine((value) => value.role !== undefined || value.isActive !== undefined, 'กรุณาระบุ role หรือสถานะที่ต้องการเปลี่ยน')
const resetSchema = z.object({ newPassword: passwordSchema })

type StaffRow = { id: number; email: string; full_name: string; role: 'super_admin' | 'staff'; is_active: number | boolean; created_at: Date | string; updated_at: Date | string }
type AuditAction = 'created' | 'role_changed' | 'enabled' | 'disabled' | 'password_reset'

function serialize(row: StaffRow) {
  return { id: Number(row.id), email: row.email, fullName: row.full_name, role: row.role, isActive: Boolean(row.is_active), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at }
}

async function audit(connection: Awaited<ReturnType<typeof pool.getConnection>>, actorId: number, targetId: number, action: AuditAction, details?: Record<string, unknown>) {
  await connection.query('INSERT INTO staff_audit_logs (actor_admin_id, target_admin_id, action, details_json) VALUES (?, ?, ?, ?)', [actorId, targetId, action, details ? JSON.stringify(details) : null])
}

async function guardLastSuperAdmin(connection: Awaited<ReturnType<typeof pool.getConnection>>) {
  const rows = await connection.query<Array<{ total: number | string }>>(`SELECT COUNT(*) AS total FROM admins WHERE role = 'super_admin' AND is_active = TRUE`)
  if (Number(rows[0]?.total ?? 0) <= 1) throw new ApiError(400, 'ต้องมี Super Admin ที่ใช้งานได้อย่างน้อยหนึ่งบัญชี')
}

export const staffRouter = Router()
staffRouter.use(requireAdmin, requireSuperAdmin)
staffRouter.use((_request, _response, next) => {
  if (!isDatabaseAvailable()) { next(new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อมสำหรับการจัดการบัญชี Staff')); return }
  next()
})

staffRouter.get('/', async (_request, response) => {
  const rows = await pool.query<StaffRow[]>('SELECT id, email, full_name, role, is_active, created_at, updated_at FROM admins ORDER BY is_active DESC, created_at ASC, id ASC')
  response.json({ staff: rows.map(serialize) })
})

staffRouter.get('/audit-history', async (_request, response) => {
  const rows = await pool.query<Array<Record<string, string | number | Date | null>>>(`SELECT l.id, l.action, l.details_json, l.created_at,
      actor.email AS actor_email, target.email AS target_email
    FROM staff_audit_logs l
    JOIN admins actor ON actor.id = l.actor_admin_id
    JOIN admins target ON target.id = l.target_admin_id
    ORDER BY l.created_at DESC, l.id DESC LIMIT 20`)
  response.json({ history: rows.map((row) => ({
    id: Number(row.id), action: row.action, actorEmail: row.actor_email, targetEmail: row.target_email,
    details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  })) })
})

staffRouter.post('/', async (request, response) => {
  const body = createSchema.parse(request.body)
  const passwordHash = await argon2.hash(body.password)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const existing = await connection.query<Array<{ id: number }>>('SELECT id FROM admins WHERE email = ? LIMIT 1', [body.email])
    if (existing[0]) throw new ApiError(409, 'อีเมลนี้มีบัญชี Staff อยู่แล้ว')
    const result = await connection.query('INSERT INTO admins (email, password_hash, full_name, role, is_active, session_version) VALUES (?, ?, ?, ?, TRUE, 1)', [body.email, passwordHash, body.fullName, body.role])
    const targetId = Number(result.insertId)
    await audit(connection, request.admin!.id, targetId, 'created', { role: body.role })
    await connection.commit()
    const rows = await pool.query<StaffRow[]>('SELECT id, email, full_name, role, is_active, created_at, updated_at FROM admins WHERE id = ? LIMIT 1', [targetId])
    response.status(201).json({ staff: serialize(rows[0]!) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
})

staffRouter.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const body = updateSchema.parse(request.body)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const rows = await connection.query<StaffRow[]>('SELECT id, email, full_name, role, is_active, created_at, updated_at FROM admins WHERE id = ? FOR UPDATE', [id])
    const target = rows[0]
    if (!target) throw new ApiError(404, 'ไม่พบบัญชี Staff')
    const wasActive = Boolean(target.is_active)
    if (body.isActive === false && id === request.admin!.id) throw new ApiError(400, 'ไม่สามารถปิดบัญชี Super Admin ของตนเองได้')
    if (wasActive && target.role === 'super_admin' && ((body.isActive === false) || body.role === 'staff')) await guardLastSuperAdmin(connection)
    const nextRole = body.role ?? target.role
    const nextActive = body.isActive ?? wasActive
    if (nextRole === target.role && nextActive === wasActive) throw new ApiError(400, 'ไม่มีข้อมูลที่เปลี่ยนแปลง')
    await connection.query('UPDATE admins SET role = ?, is_active = ?, session_version = session_version + 1 WHERE id = ?', [nextRole, nextActive, id])
    if (nextRole !== target.role) await audit(connection, request.admin!.id, id, 'role_changed', { from: target.role, to: nextRole })
    if (nextActive !== wasActive) await audit(connection, request.admin!.id, id, nextActive ? 'enabled' : 'disabled')
    await connection.commit()
    const updated = await pool.query<StaffRow[]>('SELECT id, email, full_name, role, is_active, created_at, updated_at FROM admins WHERE id = ? LIMIT 1', [id])
    response.json({ staff: serialize(updated[0]!) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
})

staffRouter.post('/:id/reset-password', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const { newPassword } = resetSchema.parse(request.body)
  const passwordHash = await argon2.hash(newPassword)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const target = await connection.query<Array<{ id: number }>>('SELECT id FROM admins WHERE id = ? FOR UPDATE', [id])
    if (!target[0]) throw new ApiError(404, 'ไม่พบบัญชี Staff')
    await connection.query('UPDATE admins SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [passwordHash, id])
    await audit(connection, request.admin!.id, id, 'password_reset')
    await connection.commit()
    response.json({ message: 'ตั้งรหัสผ่านใหม่และยกเลิก session เดิมแล้ว' })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
})
