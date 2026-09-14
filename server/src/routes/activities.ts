import { Router } from 'express'
import type { PoolConnection } from 'mariadb'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/superAdminAuthorization.js'
import { isDatabaseAvailable } from '../db/availability.js'
import { defaultFormTheme, formThemeSchema, parseStoredFormTheme } from '../lib/formTheme.js'

const activityStatusSchema = z.enum(['draft', 'active', 'closed', 'archived'])

const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
const activityImageData = z.string()
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'รูปภาพต้องเป็น PNG, JPEG หรือ WebP')
  .max(2_500_000, 'ขนาดรูปภาพหลังปรับแล้วต้องไม่เกิน 2 MB')
  .nullable()

const activityFieldSchemas = {
  name: z.string().trim().min(2).max(255),
  detail: z.string().trim().max(10_000),
  imageData: activityImageData,
  assessmentImageData: activityImageData,
  formTheme: formThemeSchema,
  location: z.string().trim().max(255).nullable(),
  startDate: nullableDate,
  surveyTemplateId: z.coerce.number().int().positive().nullable(),
  targetGroup: z.string().trim().max(120).nullable(),
  participantLimit: z.coerce.number().int().min(0).max(1_000_000),
  preTestDurationMinutes: z.coerce.number().int().min(1).max(1_440),
  postTestDurationMinutes: z.coerce.number().int().min(1).max(1_440),
}

const activityBodySchema = z.object({
  ...activityFieldSchemas,
  detail: activityFieldSchemas.detail.default(''),
  imageData: activityFieldSchemas.imageData.default(null),
  assessmentImageData: activityFieldSchemas.assessmentImageData.default(null),
  formTheme: activityFieldSchemas.formTheme.default(defaultFormTheme),
  location: activityFieldSchemas.location.default(null),
  startDate: activityFieldSchemas.startDate.default(null),
  surveyTemplateId: activityFieldSchemas.surveyTemplateId.default(null),
  targetGroup: activityFieldSchemas.targetGroup.default(null),
  participantLimit: activityFieldSchemas.participantLimit.default(0),
  preTestDurationMinutes: activityFieldSchemas.preTestDurationMinutes.default(15),
  postTestDurationMinutes: activityFieldSchemas.postTestDurationMinutes.default(15),
})
const updateActivitySchema = z.object(activityFieldSchemas).partial().refine((value) => Object.keys(value).length > 0, 'กรุณาส่งข้อมูลที่ต้องการแก้ไข')
const phaseSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  closeAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'เวลาปิดไม่ถูกต้อง').nullable().optional(),
}).refine((value) => value.enabled !== undefined || value.closeAt !== undefined, 'กรุณาระบุข้อมูลที่ต้องการเปลี่ยน')

type ActivityRow = {
  id: number
  created_at: Date | string
  code: string | null
  name: string
  detail: string | null
  cover_image_data: string | null
  assessment_image_data: string | null
  form_theme_json: string | null
  location: string | null
  start_date: Date | string | null
  end_date: Date | string | null
  pre_open_at: Date | string | null
  pre_close_at: Date | string | null
  post_open_at: Date | string | null
  post_close_at: Date | string | null
  survey_template_id: number | null
  activity_date: Date | string | null
  start_time: string | null
  end_time: string | null
  target_group: string | null
  pre_test_duration_minutes: number
  post_test_duration_minutes: number
  pre_test_enabled: number | boolean | string
  post_test_enabled: number | boolean | string
  participant_limit: number
  status: 'draft' | 'active' | 'closed' | 'archived'
  pre_test_percent: number | string
  post_test_percent: number | string
  participant_count: number | string
  pre_response_count: number | string
  post_response_count: number | string
}

const activitySelect = `
  SELECT
    a.id,
    a.created_at,
    a.code,
    a.name,
    a.detail,
    a.cover_image_data,
    a.assessment_image_data,
    a.form_theme_json,
    a.location,
    a.start_date,
    a.end_date,
    DATE_FORMAT(a.pre_open_at, '%Y-%m-%dT%H:%i') AS pre_open_at,
    DATE_FORMAT(a.pre_close_at, '%Y-%m-%dT%H:%i') AS pre_close_at,
    DATE_FORMAT(a.post_open_at, '%Y-%m-%dT%H:%i') AS post_open_at,
    DATE_FORMAT(a.post_close_at, '%Y-%m-%dT%H:%i') AS post_close_at,
    a.survey_template_id,
    a.activity_date,
    a.start_time,
    a.end_time,
    a.target_group,
    a.pre_test_duration_minutes,
    a.post_test_duration_minutes,
    a.pre_test_enabled,
    a.post_test_enabled,
    a.participant_limit,
    a.status,
    (
      SELECT COUNT(DISTINCT sr.student_id)
      FROM survey_responses sr
      WHERE sr.activity_id = a.id
    ) AS participant_count,
    (
      SELECT COUNT(*)
      FROM survey_responses sr
      WHERE sr.activity_id = a.id AND sr.phase = 'pre'
    ) AS pre_response_count,
    (
      SELECT COUNT(*)
      FROM survey_responses sr
      WHERE sr.activity_id = a.id AND sr.phase = 'post'
    ) AS post_response_count
  FROM activities a
`

const activityStyles: Record<ActivityRow['status'], { tone: string; icon: string }> = {
  draft: { tone: 'slate', icon: '◎' },
  active: { tone: 'purple', icon: '✧' },
  closed: { tone: 'slate', icon: '◎' },
  archived: { tone: 'slate', icon: '◎' },
}

function formatDate(value: Date | string | null) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function serializeDate(value: Date | string | null) { return value instanceof Date ? value.toISOString().slice(0, 10) : value }
function serializeDateTime(value: Date | string | null) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 16)
  return String(value).replace(' ', 'T').slice(0, 16)
}

function serializeActivity(row: ActivityRow) {
  const style = activityStyles[row.status]
  const participants = Number(row.participant_count)
  const preResponses = Number(row.pre_response_count)
  const postResponses = Number(row.post_response_count)
  return {
    id: Number(row.id),
    createdAt: serializeDateTime(row.created_at),
    code: row.code ?? '',
    name: row.name,
    detail: row.detail ?? '',
    imageData: row.cover_image_data,
    assessmentImageData: row.assessment_image_data,
    formTheme: parseStoredFormTheme(row.form_theme_json),
    location: row.location,
    startDate: serializeDate(row.start_date),
    endDate: serializeDate(row.end_date),
    preOpenAt: serializeDateTime(row.pre_open_at),
    preCloseAt: serializeDateTime(row.pre_close_at),
    postOpenAt: serializeDateTime(row.post_open_at),
    postCloseAt: serializeDateTime(row.post_close_at),
    surveyTemplateId: row.survey_template_id ? Number(row.survey_template_id) : null,
    date: formatDate(row.activity_date),
    activityDate:
      row.activity_date instanceof Date
        ? row.activity_date.toISOString().slice(0, 10)
        : row.activity_date,
    startTime: row.start_time,
    endTime: row.end_time,
    targetGroup: row.target_group,
    preTestDurationMinutes: Number(row.pre_test_duration_minutes),
    postTestDurationMinutes: Number(row.post_test_duration_minutes),
    preTestEnabled: Number(row.pre_test_enabled) === 1,
    postTestEnabled: Number(row.post_test_enabled) === 1,
    participantLimit: Number(row.participant_limit),
    participants: `${participants} / ${Number(row.participant_limit)}`,
    preResponses,
    postResponses,
    preTest: participants > 0 ? Number(((preResponses / participants) * 100).toFixed(1)) : 0,
    postTest: participants > 0 ? Number(((postResponses / participants) * 100).toFixed(1)) : 0,
    status: row.status,
    tone: style.tone,
    icon: style.icon,
  }
}

async function findActivity(id: number) {
  const rows = await pool.query<ActivityRow[]>(
    `${activitySelect}
     WHERE a.id = ?`,
    [id],
  )
  return rows[0] ? serializeActivity(rows[0]) : null
}

async function addTimeToIncompleteSurveySessions(connection: PoolConnection, activityId: number, phase: 'pre' | 'post', minutes: number) {
  if (minutes <= 0) return
  await connection.query(
    `UPDATE survey_sessions ss
     SET ss.expires_at = TIMESTAMPADD(MINUTE, ?, GREATEST(ss.expires_at, NOW()))
     WHERE ss.activity_id = ? AND ss.phase = ?
       AND NOT EXISTS (
         SELECT 1 FROM survey_responses sr
         WHERE sr.activity_id = ss.activity_id AND sr.student_id = ss.student_id AND sr.phase = ss.phase
       )`,
    [minutes, activityId, phase],
  )
}

async function resumeIncompleteSurveySessions(connection: PoolConnection, activityId: number, phase: 'pre' | 'post', durationMinutes: number, closeAt: Date | string | null) {
  const nextExpirySql = closeAt
    ? 'LEAST(TIMESTAMPADD(MINUTE, ?, NOW()), ?)'
    : 'TIMESTAMPADD(MINUTE, ?, NOW())'
  const values: Array<number | string | Date> = closeAt
    ? [durationMinutes, closeAt, activityId, phase]
    : [durationMinutes, activityId, phase]
  await connection.query(
    `UPDATE survey_sessions ss
     SET ss.expires_at = GREATEST(ss.expires_at, ${nextExpirySql})
     WHERE ss.activity_id = ? AND ss.phase = ?
       AND NOT EXISTS (
         SELECT 1 FROM survey_responses sr
         WHERE sr.activity_id = ss.activity_id AND sr.student_id = ss.student_id AND sr.phase = ss.phase
       )`,
    values,
  )
}

export const activitiesRouter = Router()
activitiesRouter.use(requireAdmin)

const listQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.union([z.literal('all'), activityStatusSchema]).default('all'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetGroup: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { path: ['to'], message: 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น' })

activitiesRouter.get('/', async (request, response) => {
  const query = listQuerySchema.parse(request.query)
  if (!isDatabaseAvailable()) {
    response.json({ activities: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 }, targetGroups: [] })
    return
  }
  const conditions: string[] = []
  const values: Array<string | number> = []
  if (query.q) { conditions.push('(a.name LIKE ? OR a.detail LIKE ?)'); values.push(`%${query.q}%`, `%${query.q}%`) }
  if (query.status !== 'all') { conditions.push('a.status = ?'); values.push(query.status) }
  if (query.from) { conditions.push('a.activity_date >= ?'); values.push(query.from) }
  if (query.to) { conditions.push('a.activity_date <= ?'); values.push(query.to) }
  if (query.targetGroup) { conditions.push('a.target_group = ?'); values.push(query.targetGroup) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRows = await pool.query<Array<{ total: number | string }>>(`SELECT COUNT(*) AS total FROM activities a ${where}`, values)
  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  const page = totalPages > 0 ? Math.min(query.page, totalPages) : 1
  const rows = await pool.query<ActivityRow[]>(
    `${activitySelect}
     ${where}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...values, query.pageSize, (page - 1) * query.pageSize],
  )
  const groups = await pool.query<Array<{ target_group: string }>>('SELECT DISTINCT target_group FROM activities WHERE target_group IS NOT NULL AND target_group <> \'\' ORDER BY target_group')
  response.json({ activities: rows.map(serializeActivity), pagination: { page, pageSize: query.pageSize, total, totalPages }, targetGroups: groups.map((row) => row.target_group) })
})

activitiesRouter.get('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const activity = await findActivity(id)
  if (!activity) throw new ApiError(404, 'ไม่พบกิจกรรม')
  response.json({ activity })
})

activitiesRouter.post('/', async (request, response) => {
  const body = activityBodySchema.parse(request.body)
  const connection = await pool.getConnection()
  let activityId: number

  try {
    await connection.beginTransaction()
    const result = await connection.query(
      `INSERT INTO activities
        (name, detail, cover_image_data, assessment_image_data, form_theme_json, location, start_date, survey_template_id, activity_date, target_group,
         pre_test_duration_minutes, post_test_duration_minutes, participant_limit, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        body.name, body.detail || null, body.imageData, body.assessmentImageData, JSON.stringify(body.formTheme), body.location || null,
        body.startDate, body.surveyTemplateId, body.startDate, body.targetGroup || null,
        body.preTestDurationMinutes, body.postTestDurationMinutes, body.participantLimit, request.admin!.id,
      ],
    ) as { insertId: number | bigint }
    activityId = Number(result.insertId)
    const code = `ACT-${String(activityId).padStart(6, '0')}`
    await connection.query('UPDATE activities SET code = ? WHERE id = ?', [code, activityId])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const activity = await findActivity(activityId!)
  response.status(201).json({ activity })
})

activitiesRouter.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const body = updateActivitySchema.parse(request.body)
  const existing = await findActivity(id)
  if (!existing) throw new ApiError(404, 'ไม่พบกิจกรรม')
  activityBodySchema.parse({ ...existing, ...body })
  const updates: string[] = []
  const values: Array<string | number | null> = []

  const addUpdate = (column: string, value: string | number | null) => {
    updates.push(`${column} = ?`)
    values.push(value)
  }

  if (body.name !== undefined) addUpdate('name', body.name)
  if (body.detail !== undefined) addUpdate('detail', body.detail || null)
  if (body.imageData !== undefined) addUpdate('cover_image_data', body.imageData)
  if (body.assessmentImageData !== undefined) addUpdate('assessment_image_data', body.assessmentImageData)
  if (body.formTheme !== undefined) addUpdate('form_theme_json', JSON.stringify(body.formTheme))
  if (body.location !== undefined) addUpdate('location', body.location || null)
  if (body.startDate !== undefined) { addUpdate('start_date', body.startDate); addUpdate('activity_date', body.startDate) }
  if (body.surveyTemplateId !== undefined) addUpdate('survey_template_id', body.surveyTemplateId)
  if (body.targetGroup !== undefined) addUpdate('target_group', body.targetGroup || null)
  if (body.participantLimit !== undefined) addUpdate('participant_limit', body.participantLimit)
  if (body.preTestDurationMinutes !== undefined) addUpdate('pre_test_duration_minutes', body.preTestDurationMinutes)
  if (body.postTestDurationMinutes !== undefined) addUpdate('post_test_duration_minutes', body.postTestDurationMinutes)

  const preExtension = body.preTestDurationMinutes === undefined ? 0 : Math.max(0, body.preTestDurationMinutes - existing.preTestDurationMinutes)
  const postExtension = body.postTestDurationMinutes === undefined ? 0 : Math.max(0, body.postTestDurationMinutes - existing.postTestDurationMinutes)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    values.push(id)
    const result = await connection.query(
      `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`,
      values,
    )
    if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบกิจกรรม')
    await addTimeToIncompleteSurveySessions(connection, id, 'pre', preExtension)
    await addTimeToIncompleteSurveySessions(connection, id, 'post', postExtension)
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  response.json({ activity: await findActivity(id) })
})

activitiesRouter.delete('/:id', requireSuperAdmin, async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const activities = await connection.query<Array<{ id: number }>>(
      'SELECT id FROM activities WHERE id = ? FOR UPDATE',
      [id],
    )
    if (!activities[0]) throw new ApiError(404, 'ไม่พบกิจกรรม')

    // Delete dependent records first so deleting an activity works even after it has collected responses.
    await connection.query('DELETE FROM survey_sessions WHERE activity_id = ?', [id])
    await connection.query('DELETE FROM qr_codes WHERE activity_id = ?', [id])
    await connection.query('DELETE FROM survey_responses WHERE activity_id = ?', [id])
    await connection.query('DELETE FROM activity_logs WHERE activity_id = ?', [id])
    await connection.query('DELETE FROM activity_participants WHERE activity_id = ?', [id])
    await connection.query('DELETE FROM activities WHERE id = ?', [id])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  response.status(204).end()
})

activitiesRouter.patch('/:id/status', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const { status } = z.object({ status: activityStatusSchema }).parse(request.body)
  const rows = await pool.query<Array<{ status: ActivityRow['status'] }>>('SELECT status FROM activities WHERE id = ? LIMIT 1', [id])
  if (!rows[0]) throw new ApiError(404, 'ไม่พบกิจกรรม')

  // Kept for backwards compatibility: opening or closing an activity changes both phases together.
  if (status === 'archived') {
    await pool.query("UPDATE activities SET status = 'archived', archived_at = COALESCE(archived_at, NOW()) WHERE id = ?", [id])
  } else {
    const enabled = status === 'active'
    await pool.query(
      'UPDATE activities SET status = ?, pre_test_enabled = ?, post_test_enabled = ?, archived_at = NULL WHERE id = ?',
      [status, enabled, enabled, id],
    )
  }
  response.json({ activity: await findActivity(id) })
})

activitiesRouter.patch('/:id/phases/:phase', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const phase = z.enum(['pre', 'post']).parse(request.params.phase)
  const settings = phaseSettingsSchema.parse(request.body)
  if (settings.closeAt) {
    const closeAtTime = new Date(settings.closeAt).getTime()
    if (Number.isNaN(closeAtTime) || closeAtTime <= Date.now()) throw new ApiError(400, 'เวลาปิดต้องอยู่ในอนาคต')
  }

  const column = phase === 'pre' ? 'pre_test_enabled' : 'post_test_enabled'
  const closeColumn = phase === 'pre' ? 'pre_close_at' : 'post_close_at'
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const rows = await connection.query<Array<{
      status: ActivityRow['status']
      pre_test_enabled: number | boolean
      post_test_enabled: number | boolean
      pre_close_at: Date | string | null
      post_close_at: Date | string | null
      pre_test_duration_minutes: number
      post_test_duration_minutes: number
    }>>(
      `SELECT status, pre_test_enabled, post_test_enabled, pre_close_at, post_close_at,
              pre_test_duration_minutes, post_test_duration_minutes
       FROM activities WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    )
    const activity = rows[0]
    if (!activity) throw new ApiError(404, 'ไม่พบกิจกรรม')
    if (activity.status === 'archived') throw new ApiError(409, 'กิจกรรมนี้ถูกเก็บถาวรแล้ว')

    const updates: string[] = []
    const values: Array<string | number | boolean | null> = []
    if (settings.enabled !== undefined) {
      const otherPhaseEnabled = phase === 'pre' ? Boolean(Number(activity.post_test_enabled)) : Boolean(Number(activity.pre_test_enabled))
      const nextStatus: ActivityRow['status'] = settings.enabled || otherPhaseEnabled ? 'active' : 'closed'
      updates.push(column + ' = ?', 'status = ?', 'archived_at = NULL')
      values.push(settings.enabled, nextStatus)
    }
    if (settings.closeAt !== undefined) {
      updates.push(closeColumn + ' = ?')
      values.push(settings.closeAt ? settings.closeAt.replace('T', ' ') : null)
    }

    values.push(id)
    await connection.query('UPDATE activities SET ' + updates.join(', ') + ' WHERE id = ?', values)

    const currentEnabled = phase === 'pre' ? Boolean(Number(activity.pre_test_enabled)) : Boolean(Number(activity.post_test_enabled))
    const nextEnabled = settings.enabled ?? currentEnabled
    const currentCloseAt = phase === 'pre' ? activity.pre_close_at : activity.post_close_at
    const nextCloseAt = settings.closeAt !== undefined ? settings.closeAt : currentCloseAt
    const closeAtTime = nextCloseAt ? new Date(nextCloseAt).getTime() : null
    const windowWillBeOpen = nextEnabled && (closeAtTime === null || closeAtTime > Date.now())
    if (windowWillBeOpen && (settings.enabled === true || settings.closeAt !== undefined)) {
      const durationMinutes = phase === 'pre' ? Number(activity.pre_test_duration_minutes) : Number(activity.post_test_duration_minutes)
      await resumeIncompleteSurveySessions(connection, id, phase, Math.max(1, durationMinutes || 15), nextCloseAt)
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  response.json({ activity: await findActivity(id) })
})

activitiesRouter.get('/meta/templates', async (_request, response) => {
  const rows = await pool.query<Array<{ id: number; name: string }>>("SELECT id, name FROM survey_templates WHERE status = 'active' ORDER BY name")
  response.json({ templates: rows.map((row) => ({ id: Number(row.id), name: row.name })) })
})

activitiesRouter.post('/:id/participants', requireSuperAdmin, async (request, response) => {
  const activityId = z.coerce.number().int().positive().parse(request.params.id)
  const { participantId } = z.object({
    participantId: z.coerce.number().int().positive(),
  }).parse(request.body)

  await pool.query(
    `INSERT IGNORE INTO activity_participants (activity_id, participant_id)
     VALUES (?, ?)`,
    [activityId, participantId],
  )
  response.status(204).end()
})
