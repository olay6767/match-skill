import crypto from 'node:crypto'
import type { Request } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { hashStudentSession } from '../lib/studentSession.js'
import { requireAdmin } from '../middleware/auth.js'

const uuidSchema = z.string().uuid()
const usageEventSchema = z.object({
  clientSessionId: uuidSchema,
  anonymousId: uuidSchema,
  eventType: z.enum(['session', 'page_view', 'interaction', 'heartbeat']),
  eventName: z.string().trim().min(1).max(80).regex(/^[a-z0-9:_-]+$/i),
  pagePath: z.string().trim().min(1).max(255),
  occurredAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().int().min(0).max(300).default(0),
  referrerHost: z.string().trim().max(255).nullable().optional(),
  client: z.object({
    language: z.string().trim().max(20).nullable().optional(),
    screenWidth: z.number().int().min(0).max(65_535).nullable().optional(),
    screenHeight: z.number().int().min(0).max(65_535).nullable().optional(),
    timezone: z.string().trim().max(80).nullable().optional(),
  }).strict().optional(),
  metadata: z.object({
    activityId: z.number().int().positive().optional(),
    phase: z.enum(['pre', 'post']).optional(),
    questionNumber: z.number().int().positive().max(100).optional(),
    totalQuestions: z.number().int().positive().max(100).optional(),
  }).strict().optional(),
}).strict()

const summaryQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

type StudentRow = { student_id: number | string }
type SessionIdRow = { id: number | string }

const requestBuckets = new Map<string, { count: number; resetAt: number }>()

function safePath(path: string) {
  const withoutQuery = path.split(/[?#]/, 1)[0] || '/'
  return withoutQuery
    .replace(/^\/s\/[^/]+(?=\/|$)/, '/s/:token')
    .replace(/\/{2,}/g, '/')
    .slice(0, 255)
}

function hmacIp(request: Request) {
  const ip = request.ip
  return ip ? crypto.createHmac('sha256', env.JWT_SECRET).update(ip).digest('hex') : null
}

function enforceRateLimit(key: string) {
  const now = Date.now()
  const bucket = requestBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (bucket.count >= 180) return false
  bucket.count += 1
  return true
}

function clientDevice(userAgent = '') {
  const browserName = /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
      : /Chrome\//.test(userAgent) ? 'Chrome'
        : /Firefox\//.test(userAgent) ? 'Firefox'
          : /Safari\//.test(userAgent) ? 'Safari' : 'Other'
  const operatingSystem = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
      : /Windows/.test(userAgent) ? 'Windows'
        : /Mac OS X/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux' : 'Other'
  const deviceCategory = /iPad|Tablet/.test(userAgent) ? 'tablet'
    : /Mobile|Android|iPhone|iPod/.test(userAgent) ? 'mobile' : 'desktop'
  return { browserName, operatingSystem, deviceCategory }
}

async function optionalStudentId(request: Request) {
  const studentHistorySession = request.get('x-student-history-session')
  if (studentHistorySession && /^[a-f0-9]{64}$/.test(studentHistorySession)) {
    const rows = await pool.query<StudentRow[]>(
      'SELECT student_id FROM student_history_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
      [hashStudentSession(studentHistorySession)],
    )
    if (rows[0]) return Number(rows[0].student_id)
  }

  const surveySession = request.get('x-survey-session')
  if (surveySession && /^[a-f0-9]{64}$/.test(surveySession)) {
    const rows = await pool.query<StudentRow[]>(
      'SELECT student_id FROM survey_sessions WHERE session_hash = ? AND expires_at > NOW() LIMIT 1',
      [hashStudentSession(surveySession)],
    )
    if (rows[0]) return Number(rows[0].student_id)
  }
  return null
}

export const userUsageRouter = Router()

userUsageRouter.post('/events', async (request, response) => {
  const input = usageEventSchema.parse(request.body)
  if (!isDatabaseAvailable()) {
    response.status(202).json({ accepted: false })
    return
  }
  const ipHash = hmacIp(request)
  if (!enforceRateLimit(`${ipHash ?? 'unknown'}:${input.clientSessionId}`)) {
    response.status(202).json({ accepted: false })
    return
  }

  const studentId = await optionalStudentId(request)
  const path = safePath(input.pagePath)
  const occurredAt = new Date(input.occurredAt)
  const endedAt = input.eventType === 'session' && input.eventName === 'end' ? occurredAt : null
  const pageViewIncrement = input.eventType === 'page_view' ? 1 : 0
  const interactionIncrement = input.eventType === 'interaction' ? 1 : 0
  const device = clientDevice(request.get('user-agent'))
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(
      `INSERT INTO user_usage_sessions (
        client_session_id, anonymous_id, student_id, entry_path, last_path, referrer_host,
        device_category, browser_name, operating_system, language_code, screen_width,
        screen_height, timezone_name, ip_hash, page_view_count, interaction_count,
        event_count, active_seconds, started_at, last_seen_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        student_id = COALESCE(VALUES(student_id), student_id),
        last_path = VALUES(last_path),
        page_view_count = page_view_count + VALUES(page_view_count),
        interaction_count = interaction_count + VALUES(interaction_count),
        event_count = event_count + 1,
        active_seconds = active_seconds + VALUES(active_seconds),
        last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at)),
        ended_at = COALESCE(VALUES(ended_at), ended_at)`,
      [
        input.clientSessionId, input.anonymousId, studentId, path, path, input.referrerHost ?? null,
        device.deviceCategory, device.browserName, device.operatingSystem, input.client?.language ?? null,
        input.client?.screenWidth ?? null, input.client?.screenHeight ?? null, input.client?.timezone ?? null,
        ipHash, pageViewIncrement, interactionIncrement, input.durationSeconds, occurredAt, occurredAt, endedAt,
      ],
    )
    const sessionRows = await connection.query<SessionIdRow[]>(
      'SELECT id FROM user_usage_sessions WHERE client_session_id = ? LIMIT 1',
      [input.clientSessionId],
    )
    const usageSession = sessionRows[0]
    if (!usageSession) throw new Error('Unable to resolve the user usage session')
    await connection.query(
      `INSERT INTO user_usage_events (
        usage_session_id, student_id, event_type, event_name, page_path,
        duration_seconds, metadata_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(usageSession.id), studentId, input.eventType, input.eventName, path,
        input.durationSeconds, input.metadata ? JSON.stringify(input.metadata) : null, occurredAt,
      ],
    )
    await connection.commit()
    response.status(202).json({ accepted: true })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

userUsageRouter.get('/summary', requireAdmin, async (request, response) => {
  const query = summaryQuerySchema.parse(request.query)
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date()
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(to.getTime() - 29 * 86_400_000)
  if (!isDatabaseAvailable()) {
    response.json({ range: { from: from.toISOString(), to: to.toISOString() }, summary: { sessions: 0, visitors: 0, identifiedStudents: 0, pageViews: 0, interactions: 0, averageActiveSeconds: 0 }, topPages: [], devices: [], daily: [] })
    return
  }
  const [summaryRows, topPages, devices, daily] = await Promise.all([
    pool.query<Array<Record<string, number | string | null>>>(
      `SELECT COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors,
        COUNT(DISTINCT student_id) AS identified_students, COALESCE(SUM(page_view_count), 0) AS page_views,
        COALESCE(SUM(interaction_count), 0) AS interactions, COALESCE(AVG(active_seconds), 0) AS average_active_seconds
       FROM user_usage_sessions WHERE started_at BETWEEN ? AND ?`, [from, to],
    ),
    pool.query<Array<{ page_path: string; views: number | string }>>(
      `SELECT page_path, COUNT(*) AS views FROM user_usage_events
       WHERE event_type = 'page_view' AND occurred_at BETWEEN ? AND ?
       GROUP BY page_path ORDER BY views DESC, page_path ASC LIMIT 10`, [from, to],
    ),
    pool.query<Array<{ device_category: string; sessions: number | string }>>(
      `SELECT device_category, COUNT(*) AS sessions FROM user_usage_sessions
       WHERE started_at BETWEEN ? AND ? GROUP BY device_category ORDER BY sessions DESC`, [from, to],
    ),
    pool.query<Array<{ usage_date: Date | string; sessions: number | string; visitors: number | string; page_views: number | string }>>(
      `SELECT DATE(started_at) AS usage_date, COUNT(*) AS sessions, COUNT(DISTINCT anonymous_id) AS visitors,
        COALESCE(SUM(page_view_count), 0) AS page_views FROM user_usage_sessions
       WHERE started_at BETWEEN ? AND ? GROUP BY DATE(started_at) ORDER BY usage_date ASC`, [from, to],
    ),
  ])
  const item = summaryRows[0] ?? {
    sessions: 0, visitors: 0, identified_students: 0, page_views: 0,
    interactions: 0, average_active_seconds: 0,
  }
  response.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      sessions: Number(item.sessions), visitors: Number(item.visitors), identifiedStudents: Number(item.identified_students),
      pageViews: Number(item.page_views), interactions: Number(item.interactions),
      averageActiveSeconds: Math.round(Number(item.average_active_seconds)),
    },
    topPages: topPages.map((row) => ({ path: row.page_path, views: Number(row.views) })),
    devices: devices.map((row) => ({ device: row.device_category, sessions: Number(row.sessions) })),
    daily: daily.map((row) => ({ date: row.usage_date instanceof Date ? row.usage_date.toISOString().slice(0, 10) : String(row.usage_date), sessions: Number(row.sessions), visitors: Number(row.visitors), pageViews: Number(row.page_views) })),
  })
})
