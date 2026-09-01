import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { isMailConfigured, sendStudentHistoryOtpEmail } from '../lib/mail.js'
import { normalizeStudentCode } from '../lib/studentEducation.js'

type StudentRow = { id: number }
type HistorySessionRow = { student_id: number }
type HistoryItemRow = {
  response_id: number
  activity_id: number
  activity_code: string | null
  activity_name: string
  activity_status: string
  phase: 'pre' | 'post'
  submitted_at: Date | string
}
type AnswerRow = { competency_id: number; name: string; display_order: number; score: number }

const studentCodeSchema = z.string().transform(normalizeStudentCode)
  .pipe(z.string().regex(/^[BMD]\d{7}$/, 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'))
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('กรุณากรอกอีเมลที่ถูกต้อง'))
const requestOtpSchema = z.object({ studentCode: studentCodeSchema, email: emailSchema })
const verifyOtpSchema = requestOtpSchema.extend({ otp: z.string().trim().regex(/^\d{6}$/, 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก') })
const historySessionSchema = z.string().regex(/^[a-f0-9]{64}$/, 'เซสชันดูประวัติไม่ถูกต้องหรือหมดอายุ')

const genericRequestMessage = 'หากข้อมูลที่ระบุตรงกับระบบ เราได้ส่งรหัสยืนยันไปยังอีเมลแล้ว'
const invalidOtpMessage = 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่'
const otpLifetimeMs = 10 * 60 * 1000
const historySessionLifetimeMs = 30 * 60 * 1000
const maxOtpFailures = 5
const rateWindowMs = 15 * 60 * 1000
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function enforceRateLimit(scope: 'request' | 'verify', ip: string, identifier: string, limit: number) {
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key)
  const key = `${scope}:${ip}:${hash(identifier)}`
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rateWindowMs })
    return
  }
  if (bucket.count >= limit) throw new ApiError(429, 'ลองใหม่อีกครั้งในภายหลัง')
  bucket.count += 1
}

function ensureDatabaseAvailable() {
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบประวัติการประเมินยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง')
}

async function findStudent(studentCode: string, email: string) {
  const rows = await pool.query<StudentRow[]>(
    'SELECT id FROM students WHERE student_code = ? AND LOWER(email) = ? LIMIT 1',
    [studentCode, email],
  )
  return rows[0]
}

async function requireHistorySession(rawSession: string) {
  const rows = await pool.query<HistorySessionRow[]>(
    'SELECT student_id FROM student_history_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
    [hash(rawSession)],
  )
  const session = rows[0]
  if (!session) throw new ApiError(401, 'เซสชันดูประวัติไม่ถูกต้องหรือหมดอายุ')
  return Number(session.student_id)
}

function serializeHistoryItem(row: HistoryItemRow) {
  return {
    responseId: Number(row.response_id),
    activityId: Number(row.activity_id),
    activityCode: row.activity_code,
    activityName: row.activity_name,
    activityStatus: row.activity_status,
    phase: row.phase,
    status: 'submitted' as const,
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
  }
}

export const studentHistoryRouter = Router()

studentHistoryRouter.post('/request-otp', async (request, response) => {
  const input = requestOtpSchema.parse(request.body)
  enforceRateLimit('request', request.ip ?? 'unknown', `${input.studentCode}:${input.email}`, 5)
  ensureDatabaseAvailable()
  const student = await findStudent(input.studentCode, input.email)
  let developmentOtp: string | undefined

  if (student) {
    const otp = crypto.randomInt(100_000, 1_000_000).toString()
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query('UPDATE student_history_otp_challenges SET used_at = NOW() WHERE student_id = ? AND used_at IS NULL', [student.id])
      await connection.query(
        'INSERT INTO student_history_otp_challenges (student_id, otp_hash, expires_at) VALUES (?, ?, ?)',
        [student.id, hash(otp), new Date(Date.now() + otpLifetimeMs)],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    if (isMailConfigured()) {
      try {
        await sendStudentHistoryOtpEmail(input.email, otp)
      } catch {
        console.error('Unable to send student history OTP')
      }
    } else if (env.NODE_ENV !== 'production') {
      developmentOtp = otp
    }
  }

  response.status(202).json({
    message: genericRequestMessage,
    ...(developmentOtp ? { developmentOtp } : {}),
  })
})

studentHistoryRouter.post('/verify-otp', async (request, response) => {
  const input = verifyOtpSchema.parse(request.body)
  enforceRateLimit('verify', request.ip ?? 'unknown', `${input.studentCode}:${input.email}`, 5)
  ensureDatabaseAvailable()
  const student = await findStudent(input.studentCode, input.email)
  if (!student) throw new ApiError(400, invalidOtpMessage)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const challenges = await connection.query<Array<{ id: number; otp_hash: string; failed_attempts: number }>>(
      `SELECT id, otp_hash, failed_attempts
       FROM student_history_otp_challenges
       WHERE student_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC, id DESC
       LIMIT 1 FOR UPDATE`,
      [student.id],
    )
    const challenge = challenges[0]
    if (!challenge || Number(challenge.failed_attempts) >= maxOtpFailures || hash(input.otp) !== challenge.otp_hash) {
      if (challenge) {
        const failedAttempts = Number(challenge.failed_attempts) + 1
        await connection.query(
          'UPDATE student_history_otp_challenges SET failed_attempts = ?, used_at = CASE WHEN ? >= ? THEN NOW() ELSE used_at END WHERE id = ?',
          [failedAttempts, failedAttempts, maxOtpFailures, challenge.id],
        )
      }
      await connection.commit()
      response.status(400).json({ message: invalidOtpMessage })
      return
    }

    const historySession = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + historySessionLifetimeMs)
    await connection.query('UPDATE student_history_otp_challenges SET used_at = NOW() WHERE id = ?', [challenge.id])
    await connection.query(
      'INSERT INTO student_history_sessions (student_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [student.id, hash(historySession), expiresAt],
    )
    await connection.commit()
    response.json({ historySession, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

studentHistoryRouter.get('/', async (request, response) => {
  const historySession = historySessionSchema.parse(request.get('x-student-history-session') ?? '')
  ensureDatabaseAvailable()
  const studentId = await requireHistorySession(historySession)
  const rows = await pool.query<HistoryItemRow[]>(
    `SELECT sr.id AS response_id, a.id AS activity_id, a.code AS activity_code, a.name AS activity_name,
      a.status AS activity_status, sr.phase, sr.submitted_at
     FROM survey_responses sr
     JOIN activities a ON a.id = sr.activity_id
     WHERE sr.student_id = ?
     ORDER BY sr.submitted_at DESC, sr.id DESC`,
    [studentId],
  )
  response.json({ history: rows.map(serializeHistoryItem) })
})

studentHistoryRouter.get('/responses/:responseId', async (request, response) => {
  const historySession = historySessionSchema.parse(request.get('x-student-history-session') ?? '')
  const responseId = z.coerce.number().int().positive().parse(request.params.responseId)
  ensureDatabaseAvailable()
  const studentId = await requireHistorySession(historySession)
  const responses = await pool.query<HistoryItemRow[]>(
    `SELECT sr.id AS response_id, a.id AS activity_id, a.code AS activity_code, a.name AS activity_name,
      a.status AS activity_status, sr.phase, sr.submitted_at
     FROM survey_responses sr
     JOIN activities a ON a.id = sr.activity_id
     WHERE sr.id = ? AND sr.student_id = ?
     LIMIT 1`,
    [responseId, studentId],
  )
  const item = responses[0]
  if (!item) throw new ApiError(404, 'ไม่พบผลการประเมิน')
  const answers = await pool.query<AnswerRow[]>(
    `SELECT c.id AS competency_id, c.name, c.display_order, ra.score
     FROM response_answers ra
     JOIN competencies c ON c.id = ra.competency_id
     WHERE ra.response_id = ?
     ORDER BY c.display_order ASC, c.id ASC`,
    [responseId],
  )
  response.json({
    response: {
      ...serializeHistoryItem(item),
      competencies: answers.map((answer) => ({
        competencyId: Number(answer.competency_id),
        name: answer.name,
        displayOrder: Number(answer.display_order),
        levelValue: Number(answer.score),
      })),
    },
  })
})
