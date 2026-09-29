import { Router } from 'express'
import { z } from 'zod'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { createStudentSession, requireStudentSession } from '../lib/studentSession.js'
import { normalizeStudentCode } from '../lib/studentEducation.js'

type ProfileRow = {
  student_code: string
  first_name: string | null
  last_name: string | null
  email: string
  faculty: string | null
  major: string | null
  education_level: string | null
  study_year: number | string | null
  phone: string | null
}

type ActivityRow = {
  activity_id: number | string
  activity_code: string | null
  name: string
  detail: string | null
  location: string | null
  cover_image_data: string | null
  start_date: Date | string | null
  end_date: Date | string | null
  activity_status: 'draft' | 'active' | 'closed' | 'archived'
  pre_response_id: number | string | null
  pre_submitted_at: Date | string | null
  post_response_id: number | string | null
  post_submitted_at: Date | string | null
}

type ResultRow = {
  response_id: number | string
  activity_id: number | string
  activity_code: string | null
  activity_name: string
  activity_status: string
  phase: 'pre' | 'post'
  submitted_at: Date | string
  competency_id: number | string
  competency_name: string
  display_order: number | string
  level_value: number | string
}

type ProgressRow = {
  activity_id: number | string
  activity_code: string | null
  activity_name: string
  activity_date: Date | string | null
  phase: 'pre' | 'post'
  competency_id: number | string
  competency_name: string
  display_order: number | string
  score_average: number | string
}

const studentCodeSchema = z.string().transform(normalizeStudentCode)
  .pipe(z.string().regex(/^[BMD]\d{7}$/, 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'))
const loginSchema = z.object({ studentCode: studentCodeSchema })
const activityIdSchema = z.coerce.number().int().positive()
const loginRateBuckets = new Map<string, { count: number; resetAt: number }>()
const loginRateWindowMs = 10 * 60 * 1000
const loginRateLimit = 10

function ensureDatabaseAvailable() {
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบนักศึกษายังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง')
}

function enforceLoginRateLimit(key: string) {
  const now = Date.now()
  for (const [key, bucket] of loginRateBuckets) if (bucket.resetAt <= now) loginRateBuckets.delete(key)
  const bucket = loginRateBuckets.get(key)
  if (bucket && bucket.count >= loginRateLimit) throw new ApiError(429, 'เข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง')
}

function recordLoginFailure(key: string) {
  const now = Date.now()
  const bucket = loginRateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    loginRateBuckets.set(key, { count: 1, resetAt: now + loginRateWindowMs })
    return
  }
  bucket.count += 1
}

function toIso(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapActivity(row: ActivityRow) {
  return {
    activityId: Number(row.activity_id), activityCode: row.activity_code, name: row.name,
    detail: row.detail, location: row.location, imageData: row.cover_image_data,
    startDate: toIso(row.start_date), endDate: toIso(row.end_date), activityStatus: row.activity_status,
    preResponse: row.pre_response_id ? { responseId: Number(row.pre_response_id), submittedAt: toIso(row.pre_submitted_at)! } : null,
    postResponse: row.post_response_id ? { responseId: Number(row.post_response_id), submittedAt: toIso(row.post_submitted_at)! } : null,
  }
}

function groupResults(rows: ResultRow[]) {
  const grouped = new Map<number, {
    responseId: number; activityId: number; activityCode: string | null; activityName: string
    activityStatus: string; phase: 'pre' | 'post'; submittedAt: string
    competencies: Array<{ competencyId: number; name: string; displayOrder: number; levelValue: number }>
  }>()
  for (const row of rows) {
    const responseId = Number(row.response_id)
    let result = grouped.get(responseId)
    if (!result) {
      result = { responseId, activityId: Number(row.activity_id), activityCode: row.activity_code, activityName: row.activity_name, activityStatus: row.activity_status, phase: row.phase, submittedAt: toIso(row.submitted_at)!, competencies: [] }
      grouped.set(responseId, result)
    }
    result.competencies.push({ competencyId: Number(row.competency_id), name: row.competency_name, displayOrder: Number(row.display_order), levelValue: Number(row.level_value) })
  }
  return [...grouped.values()]
}

function roundScore(value: number) {
  return Number(value.toFixed(2))
}

function groupProgress(rows: ProgressRow[]) {
  const activities = new Map<number, {
    activityId: number
    activityCode: string | null
    name: string
    activityDate: string | null
    competencies: Map<number, { competencyId: number; name: string; displayOrder: number; pre: number | null; post: number | null }>
  }>()
  for (const row of rows) {
    const activityId = Number(row.activity_id)
    let activity = activities.get(activityId)
    if (!activity) {
      activity = { activityId, activityCode: row.activity_code, name: row.activity_name, activityDate: toIso(row.activity_date), competencies: new Map() }
      activities.set(activityId, activity)
    }
    const competencyId = Number(row.competency_id)
    let competency = activity.competencies.get(competencyId)
    if (!competency) {
      competency = { competencyId, name: row.competency_name, displayOrder: Number(row.display_order), pre: null, post: null }
      activity.competencies.set(competencyId, competency)
    }
    competency[row.phase] = roundScore(Number(row.score_average))
  }
  return [...activities.values()].map((activity) => {
    const competencies = [...activity.competencies.values()].sort((left, right) => left.displayOrder - right.displayOrder).map((competency) => ({
      ...competency,
      change: competency.pre === null || competency.post === null ? null : roundScore(competency.post - competency.pre),
    }))
    const preValues = competencies.flatMap((competency) => competency.pre === null ? [] : [competency.pre])
    const postValues = competencies.flatMap((competency) => competency.post === null ? [] : [competency.post])
    const preAverage = preValues.length ? roundScore(preValues.reduce((sum, value) => sum + value, 0) / preValues.length) : null
    const postAverage = postValues.length ? roundScore(postValues.reduce((sum, value) => sum + value, 0) / postValues.length) : null
    return {
      activityId: activity.activityId,
      activityCode: activity.activityCode,
      name: activity.name,
      activityDate: activity.activityDate,
      preAverage,
      postAverage,
      change: preAverage === null || postAverage === null ? null : roundScore(postAverage - preAverage),
      competencies,
    }
  }).filter((activity) => activity.preAverage !== null && activity.postAverage !== null)
    .sort((left, right) => String(right.activityDate ?? '').localeCompare(String(left.activityDate ?? '')) || right.activityId - left.activityId)
}

const activitySelect = `
  SELECT a.id AS activity_id, a.code AS activity_code, a.name, a.detail, a.location,
    a.cover_image_data, a.start_date, a.end_date, a.status AS activity_status,
    MAX(CASE WHEN sr.phase = 'pre' THEN sr.id END) AS pre_response_id,
    MAX(CASE WHEN sr.phase = 'pre' THEN sr.submitted_at END) AS pre_submitted_at,
    MAX(CASE WHEN sr.phase = 'post' THEN sr.id END) AS post_response_id,
    MAX(CASE WHEN sr.phase = 'post' THEN sr.submitted_at END) AS post_submitted_at
  FROM survey_responses sr
  JOIN activities a ON a.id = sr.activity_id`

export const studentPortalRouter = Router()

studentPortalRouter.post('/login', async (request, response) => {
  const input = loginSchema.parse(request.body)
  const rateLimitKey = `${request.ip ?? 'unknown'}:${input.studentCode}`
  enforceLoginRateLimit(rateLimitKey)
  ensureDatabaseAvailable()
  const rows = await pool.query<Array<{ id: number | string; portal_onboarding_completed_at: Date | string | null }>>('SELECT id, portal_onboarding_completed_at FROM students WHERE student_code = ? LIMIT 1', [input.studentCode])
  const student = rows[0]
  if (!student) {
    recordLoginFailure(rateLimitKey)
    throw new ApiError(401, 'ไม่พบรหัสนักศึกษา')
  }
  loginRateBuckets.delete(rateLimitKey)
  response.json({
    ...(await createStudentSession(Number(student.id))),
    studentCode: input.studentCode,
    onboardingCompleted: Boolean(student.portal_onboarding_completed_at),
  })
})

studentPortalRouter.use(async (request, response, next) => {
  try {
    ensureDatabaseAvailable()
    response.locals.studentId = await requireStudentSession(request.get('x-student-history-session'))
    next()
  } catch (error) { next(error) }
})

studentPortalRouter.get('/me', async (_request, response) => {
  const rows = await pool.query<ProfileRow[]>(
    'SELECT student_code, first_name, last_name, email, faculty, major, education_level, study_year, phone FROM students WHERE id = ? LIMIT 1',
    [response.locals.studentId],
  )
  const student = rows[0]
  if (!student) throw new ApiError(404, 'ไม่พบข้อมูลนักศึกษา')
  response.json({ profile: { studentCode: student.student_code, firstName: student.first_name ?? '', lastName: student.last_name ?? '', email: student.email, faculty: student.faculty, major: student.major, educationLevel: student.education_level, studyYear: student.study_year === null ? null : Number(student.study_year), phone: student.phone } })
})

studentPortalRouter.post('/onboarding-complete', async (_request, response) => {
  await pool.query(
    'UPDATE students SET portal_onboarding_completed_at = COALESCE(portal_onboarding_completed_at, NOW()) WHERE id = ?',
    [response.locals.studentId],
  )
  response.json({ ok: true })
})

studentPortalRouter.get('/activities', async (_request, response) => {
  const rows = await pool.query<ActivityRow[]>(
    `${activitySelect}
      WHERE sr.student_id = ?
      GROUP BY a.id, a.code, a.name, a.detail, a.location, a.cover_image_data, a.start_date, a.end_date, a.status
      ORDER BY COALESCE(a.start_date, DATE(MAX(sr.submitted_at))) DESC, a.id DESC`,
    [response.locals.studentId],
  )
  response.json({ activities: rows.map(mapActivity) })
})

studentPortalRouter.get('/progress', async (_request, response) => {
  const studentId = Number(response.locals.studentId)
  const rows = await pool.query<ProgressRow[]>(
    `SELECT a.id AS activity_id, a.code AS activity_code, a.name AS activity_name,
      COALESCE(a.activity_date, a.start_date) AS activity_date, sr.phase,
      c.id AS competency_id, c.name AS competency_name, c.display_order,
      AVG(ra.score) AS score_average
     FROM survey_responses sr
     JOIN (
       SELECT activity_id, phase, MAX(id) AS response_id
       FROM survey_responses
       WHERE student_id = ?
       GROUP BY activity_id, phase
     ) latest ON latest.response_id = sr.id
     JOIN (
       SELECT activity_id
       FROM survey_responses
       WHERE student_id = ?
       GROUP BY activity_id
       HAVING SUM(phase = 'pre') > 0 AND SUM(phase = 'post') > 0
     ) paired ON paired.activity_id = sr.activity_id
     JOIN activities a ON a.id = sr.activity_id
     JOIN response_answers ra ON ra.response_id = sr.id
     JOIN competencies c ON c.id = ra.competency_id
     WHERE sr.student_id = ?
     GROUP BY a.id, a.code, a.name, a.activity_date, a.start_date, sr.phase, c.id, c.name, c.display_order
     ORDER BY COALESCE(a.activity_date, a.start_date) DESC, a.id DESC, c.display_order ASC, c.id ASC`,
    [studentId, studentId, studentId],
  )
  response.json({ activities: groupProgress(rows) })
})

studentPortalRouter.get('/activities/:activityId', async (request, response) => {
  const activityId = activityIdSchema.parse(request.params.activityId)
  const studentId = Number(response.locals.studentId)
  const activities = await pool.query<ActivityRow[]>(
    `${activitySelect}
      WHERE sr.student_id = ? AND a.id = ?
      GROUP BY a.id, a.code, a.name, a.detail, a.location, a.cover_image_data, a.start_date, a.end_date, a.status
      LIMIT 1`,
    [studentId, activityId],
  )
  const activity = activities[0]
  if (!activity) throw new ApiError(404, 'ไม่พบกิจกรรมนี้')
  const results = await pool.query<ResultRow[]>(
    `SELECT sr.id AS response_id, sr.activity_id, a.code AS activity_code, a.name AS activity_name,
      a.status AS activity_status, sr.phase, sr.submitted_at, c.id AS competency_id,
      c.name AS competency_name, c.display_order, ra.score AS level_value
     FROM survey_responses sr
     JOIN activities a ON a.id = sr.activity_id
     JOIN response_answers ra ON ra.response_id = sr.id
     JOIN competencies c ON c.id = ra.competency_id
     WHERE sr.activity_id = ? AND sr.student_id = ?
     ORDER BY sr.submitted_at ASC, c.display_order ASC, c.id ASC`,
    [activityId, studentId],
  )
  response.json({ activity: { ...mapActivity(activity), results: groupResults(results) } })
})
