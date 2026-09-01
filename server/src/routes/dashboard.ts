import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAdmin } from '../middleware/auth.js'
import { isDatabaseAvailable } from '../db/availability.js'

type SummaryRow = { pre_count: number | string; post_count: number | string; paired_count: number | string }

const filterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activityId: z.coerce.number().int().positive().optional(),
  activityIds: z.string().regex(/^\d+(,\d+)*$/).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น', path: ['to'],
})

const recentActivitiesSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activityId: z.coerce.number().int().positive().optional(),
  activityIds: z.string().regex(/^\d+(,\d+)*$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(20).default(5),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น', path: ['to'],
})

function selectedActivityIds(filters: { activityId?: number; activityIds?: string }) {
  if (filters.activityIds) return [...new Set(filters.activityIds.split(',').map(Number))]
  return filters.activityId ? [filters.activityId] : []
}

function responseFilter(filters: z.infer<typeof filterSchema>, alias = 'sr') {
  const clauses: string[] = []
  const values: Array<string | number> = []
  if (filters.from) { clauses.push(`DATE(${alias}.submitted_at) >= ?`); values.push(filters.from) }
  if (filters.to) { clauses.push(`DATE(${alias}.submitted_at) <= ?`); values.push(filters.to) }
  const activityIds = selectedActivityIds(filters)
  if (activityIds.length) {
    clauses.push(`${alias}.activity_id IN (${activityIds.map(() => '?').join(', ')})`)
    values.push(...activityIds)
  }
  clauses.push(pairedResponseCondition(alias))
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values }
}

function pairedResponseCondition(alias = 'sr') {
  return `EXISTS (
    SELECT 1 FROM survey_responses paired_response
    WHERE paired_response.activity_id = ${alias}.activity_id
      AND paired_response.student_id = ${alias}.student_id
    GROUP BY paired_response.activity_id, paired_response.student_id
    HAVING SUM(paired_response.phase = 'pre') > 0 AND SUM(paired_response.phase = 'post') > 0
  )`
}

export const dashboardRouter = Router()
dashboardRouter.use(requireAdmin)

dashboardRouter.get('/summary', async (request, response) => {
  const filters = filterSchema.parse(request.query)
  if (!isDatabaseAvailable()) {
    response.json({ summary: { preCount: 0, postCount: 0, pairedCount: 0, completionRate: null } })
    return
  }
  const filter = responseFilter(filters)
  const rows = await pool.query<SummaryRow[]>(
    `SELECT
      COALESCE(SUM(CASE WHEN sr.phase = 'pre' THEN 1 ELSE 0 END), 0) AS pre_count,
      COALESCE(SUM(CASE WHEN sr.phase = 'post' THEN 1 ELSE 0 END), 0) AS post_count,
      COUNT(DISTINCT CONCAT(sr.student_id, ':', sr.activity_id)) AS paired_count
     FROM survey_responses sr ${filter.sql}`,
    filter.values,
  )
  const preCount = Number(rows[0]?.pre_count ?? 0)
  const postCount = Number(rows[0]?.post_count ?? 0)
  const pairedCount = Number(rows[0]?.paired_count ?? 0)
  response.json({ summary: {
    preCount, postCount, pairedCount,
    completionRate: preCount > 0 ? Number(((pairedCount / preCount) * 100).toFixed(1)) : null,
  } })
})

dashboardRouter.get('/competency-growth', async (request, response) => {
  const filters = filterSchema.parse(request.query)
  if (!isDatabaseAvailable()) { response.json({ competencies: [] }); return }
  const filter = responseFilter(filters)
  const rows = await pool.query<Array<Record<string, string | number | null>>>(
     `SELECT c.id, c.code, c.name,
      AVG(CASE WHEN sr.phase = 'pre' THEN ra.score END) AS pre_average,
      AVG(CASE WHEN sr.phase = 'post' THEN ra.score END) AS post_average,
      AVG(CASE WHEN sr.phase IN ('pre', 'post') THEN ra.score END) AS combined_average,
      MAX(CASE WHEN sr.phase = 'pre' THEN ra.score END) AS pre_maximum,
      MAX(CASE WHEN sr.phase = 'post' THEN ra.score END) AS post_maximum,
      MIN(CASE WHEN sr.phase = 'pre' THEN ra.score END) AS pre_minimum,
      MIN(CASE WHEN sr.phase = 'post' THEN ra.score END) AS post_minimum,
      COUNT(DISTINCT CASE WHEN sr.phase = 'pre' THEN sr.id END) AS pre_count,
     COUNT(DISTINCT CASE WHEN sr.phase = 'post' THEN sr.id END) AS post_count
     FROM competencies c
     JOIN survey_templates t ON t.id = c.template_id AND t.status = 'active'
     LEFT JOIN response_answers ra ON ra.competency_id = c.id
     LEFT JOIN survey_responses sr ON sr.id = ra.response_id
     ${filter.sql ? filter.sql.replace('WHERE', 'AND') : ''}
     GROUP BY c.id, c.code, c.name, c.display_order
     ORDER BY c.display_order`, filter.values,
  )
  response.json({ competencies: rows.map((row) => {
    const preAverage = row.pre_average === null ? null : Number(Number(row.pre_average).toFixed(2))
    const postAverage = row.post_average === null ? null : Number(Number(row.post_average).toFixed(2))
    const combinedAverage = row.combined_average === null ? null : Number(Number(row.combined_average).toFixed(2))
    const preMaximum = row.pre_maximum === null ? null : Number(row.pre_maximum)
    const postMaximum = row.post_maximum === null ? null : Number(row.post_maximum)
    const preMinimum = row.pre_minimum === null ? null : Number(row.pre_minimum)
    const postMinimum = row.post_minimum === null ? null : Number(row.post_minimum)
    return {
      id: Number(row.id), code: row.code, name: row.name,
      preAverage, postAverage, combinedAverage, preMaximum, postMaximum, preMinimum, postMinimum,
      growth: preAverage === null || postAverage === null ? null : Number((postAverage - preAverage).toFixed(2)),
      preCount: Number(row.pre_count), postCount: Number(row.post_count),
    }
  }) })
})

dashboardRouter.get('/recent-activities', async (request, response) => {
  const query = recentActivitiesSchema.parse(request.query)
  if (!isDatabaseAvailable()) {
    response.json({ activities: [], pagination: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 0 } })
    return
  }
  const activityIds = selectedActivityIds(query)
  const activityWhere = activityIds.length ? `WHERE a.id IN (${activityIds.map(() => '?').join(', ')})` : ''
  const countRows = await pool.query<Array<{ total: number | string }>>(`SELECT COUNT(*) AS total FROM activities a ${activityWhere}`, activityIds)
  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  const page = totalPages > 0 ? Math.min(query.page, totalPages) : 1
  const responseConditions = [pairedResponseCondition('sr')]
  const responseValues: string[] = []
  if (query.from) { responseConditions.push('DATE(sr.submitted_at) >= ?'); responseValues.push(query.from) }
  if (query.to) { responseConditions.push('DATE(sr.submitted_at) <= ?'); responseValues.push(query.to) }
  const rows = await pool.query<Array<Record<string, string | number | Date | null>>>(
    `SELECT a.id, a.name, a.detail, a.activity_date, a.status, a.participant_limit,
      COUNT(DISTINCT sr.student_id) AS participant_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'pre' THEN sr.id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'post' THEN sr.id END) AS post_count
     FROM activities a
     LEFT JOIN survey_responses sr ON sr.activity_id = a.id AND ${responseConditions.join(' AND ')}
     ${activityWhere}
     GROUP BY a.id
     ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`, [...responseValues, ...activityIds, query.pageSize, (page - 1) * query.pageSize],
  )
  response.json({ activities: rows.map((row) => ({
    id: Number(row.id), name: row.name, detail: row.detail ?? '',
    activityDate: row.activity_date instanceof Date ? row.activity_date.toISOString().slice(0, 10) : row.activity_date,
    status: row.status, participantLimit: Number(row.participant_limit), participantCount: Number(row.participant_count),
    preCount: Number(row.pre_count), postCount: Number(row.post_count),
  })), pagination: { page, pageSize: query.pageSize, total, totalPages } })
})

dashboardRouter.get('/activities', async (_request, response) => {
  if (!isDatabaseAvailable()) { response.json({ activities: [] }); return }
  const rows = await pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM activities ORDER BY name')
  response.json({ activities: rows.map((row) => ({ id: Number(row.id), name: row.name })) })
})
