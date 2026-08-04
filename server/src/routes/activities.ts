import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'

const activityStatusSchema = z.enum(['processing', 'completed', 'draft', 'open', 'closed'])

const activityBodySchema = z.object({
  name: z.string().trim().min(2).max(255),
  detail: z.string().trim().max(255).default(''),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  targetGroup: z.string().trim().max(120).nullable().default(null),
  preTestDurationMinutes: z.coerce.number().int().min(1).max(480).default(15),
  postTestDurationMinutes: z.coerce.number().int().min(1).max(480).default(15),
  participantLimit: z.coerce.number().int().min(0).max(1_000_000).default(0),
  status: activityStatusSchema.default('draft'),
  preTest: z.coerce.number().min(0).max(100).default(0),
  postTest: z.coerce.number().min(0).max(100).default(0),
})

function validateTimeRange(
  value: { startTime?: string | null; endTime?: string | null },
  context: z.RefinementCtx,
) {
  if (value.startTime && value.endTime && value.startTime >= value.endTime) {
    context.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'เวลาปิดรับแบบสอบถามต้องอยู่หลังเวลาเปิด',
    })
  }
}

const updateActivitySchema = activityBodySchema.partial().superRefine((value, context) => {
  validateTimeRange(value, context)
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: 'custom', message: 'กรุณาส่งข้อมูลที่ต้องการแก้ไข' })
  }
})

type ActivityRow = {
  id: number
  name: string
  detail: string | null
  activity_date: Date | string | null
  start_time: string | null
  end_time: string | null
  target_group: string | null
  pre_test_duration_minutes: number
  post_test_duration_minutes: number
  participant_limit: number
  status: 'processing' | 'completed' | 'draft' | 'open' | 'closed'
  pre_test_percent: number | string
  post_test_percent: number | string
  participant_count: number | string
}

const activitySelect = `
  SELECT
    a.id,
    a.name,
    a.detail,
    a.activity_date,
    a.start_time,
    a.end_time,
    a.target_group,
    a.pre_test_duration_minutes,
    a.post_test_duration_minutes,
    a.participant_limit,
    a.status,
    a.pre_test_percent,
    a.post_test_percent,
    COUNT(ap.participant_id) AS participant_count
  FROM activities a
  LEFT JOIN activity_participants ap ON ap.activity_id = a.id
`

const activityStyles: Record<ActivityRow['status'], { tone: string; icon: string }> = {
  processing: { tone: 'blue', icon: '◉' },
  completed: { tone: 'orange', icon: '♙' },
  draft: { tone: 'slate', icon: '◎' },
  open: { tone: 'purple', icon: '✧' },
  closed: { tone: 'slate', icon: '◎' },
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

function serializeActivity(row: ActivityRow) {
  const style = activityStyles[row.status]
  return {
    id: Number(row.id),
    name: row.name,
    detail: row.detail ?? '',
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
    participantLimit: Number(row.participant_limit),
    participants: `${Number(row.participant_count)} / ${Number(row.participant_limit)}`,
    preTest: Number(row.pre_test_percent),
    postTest: Number(row.post_test_percent),
    status: row.status,
    tone: style.tone,
    icon: style.icon,
  }
}

async function findActivity(id: number) {
  const rows = await pool.query<ActivityRow[]>(
    `${activitySelect}
     WHERE a.id = ?
     GROUP BY a.id, a.name, a.detail, a.activity_date, a.start_time, a.end_time,
       a.target_group, a.pre_test_duration_minutes, a.post_test_duration_minutes,
       a.participant_limit,
       a.status, a.pre_test_percent, a.post_test_percent`,
    [id],
  )
  return rows[0] ? serializeActivity(rows[0]) : null
}

export const activitiesRouter = Router()
activitiesRouter.use(requireAdmin)

activitiesRouter.get('/', async (_request, response) => {
  const rows = await pool.query<ActivityRow[]>(
    `${activitySelect}
     GROUP BY a.id, a.name, a.detail, a.activity_date, a.start_time, a.end_time,
       a.target_group, a.pre_test_duration_minutes, a.post_test_duration_minutes,
       a.participant_limit,
       a.status, a.pre_test_percent, a.post_test_percent
     ORDER BY a.created_at DESC, a.id DESC`,
  )
  response.json({ activities: rows.map(serializeActivity) })
})

activitiesRouter.get('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const activity = await findActivity(id)
  if (!activity) throw new ApiError(404, 'ไม่พบกิจกรรม')
  response.json({ activity })
})

activitiesRouter.post('/', async (request, response) => {
  const body = activityBodySchema.superRefine(validateTimeRange).parse(request.body)
  const result = await pool.query(
    `INSERT INTO activities
      (name, detail, activity_date, start_time, end_time, target_group,
       pre_test_duration_minutes, post_test_duration_minutes,
       participant_limit, status, pre_test_percent, post_test_percent, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.name,
      body.detail || null,
      body.activityDate,
      body.startTime,
      body.endTime,
      body.targetGroup || null,
      body.preTestDurationMinutes,
      body.postTestDurationMinutes,
      body.participantLimit,
      body.status,
      body.preTest,
      body.postTest,
      request.admin!.id,
    ],
  )
  const activity = await findActivity(Number(result.insertId))
  response.status(201).json({ activity })
})

activitiesRouter.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const body = updateActivitySchema.parse(request.body)
  const updates: string[] = []
  const values: Array<string | number | null> = []

  const addUpdate = (column: string, value: string | number | null) => {
    updates.push(`${column} = ?`)
    values.push(value)
  }

  if (body.name !== undefined) addUpdate('name', body.name)
  if (body.detail !== undefined) addUpdate('detail', body.detail || null)
  if (body.activityDate !== undefined) addUpdate('activity_date', body.activityDate)
  if (body.startTime !== undefined) addUpdate('start_time', body.startTime)
  if (body.endTime !== undefined) addUpdate('end_time', body.endTime)
  if (body.targetGroup !== undefined) addUpdate('target_group', body.targetGroup || null)
  if (body.preTestDurationMinutes !== undefined) addUpdate('pre_test_duration_minutes', body.preTestDurationMinutes)
  if (body.postTestDurationMinutes !== undefined) addUpdate('post_test_duration_minutes', body.postTestDurationMinutes)
  if (body.participantLimit !== undefined) addUpdate('participant_limit', body.participantLimit)
  if (body.status !== undefined) addUpdate('status', body.status)
  if (body.preTest !== undefined) addUpdate('pre_test_percent', body.preTest)
  if (body.postTest !== undefined) addUpdate('post_test_percent', body.postTest)

  values.push(id)
  const result = await pool.query(
    `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`,
    values,
  )
  if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบกิจกรรม')

  response.json({ activity: await findActivity(id) })
})

activitiesRouter.delete('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const result = await pool.query('DELETE FROM activities WHERE id = ?', [id])
  if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบกิจกรรม')
  response.status(204).end()
})

activitiesRouter.post('/:id/participants', async (request, response) => {
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
