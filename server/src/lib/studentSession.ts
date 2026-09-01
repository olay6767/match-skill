import crypto from 'node:crypto'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from './http.js'

const studentSessionSchema = z.string().regex(/^[a-f0-9]{64}$/)
type StudentSessionRow = { student_id: number | string }

export function hashStudentSession(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createStudentSession(studentId: number) {
  const historySession = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await pool.query('DELETE FROM student_history_sessions WHERE student_id = ? OR expires_at <= NOW()', [studentId])
  await pool.query(
    'INSERT INTO student_history_sessions (student_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [studentId, hashStudentSession(historySession), expiresAt],
  )
  return { historySession, expiresAt: expiresAt.toISOString() }
}

export async function requireStudentSession(rawSession: unknown) {
  const parsed = studentSessionSchema.safeParse(rawSession)
  if (!parsed.success) throw new ApiError(401, 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  const rows = await pool.query<StudentSessionRow[]>(
    'SELECT student_id FROM student_history_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
    [hashStudentSession(parsed.data)],
  )
  const session = rows[0]
  if (!session) throw new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  return Number(session.student_id)
}
