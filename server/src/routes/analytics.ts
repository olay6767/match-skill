import { Router, type Request } from 'express'
import { z } from 'zod'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireReportExportPermission } from '../middleware/reportAuthorization.js'
import { requireSuperAdmin } from '../middleware/superAdminAuthorization.js'
import { createCombinedActivityAnalysisExport, getActivityAnalysisCatalog, getActivityAnalysisIds, getCombinedActivityAnalysis, type ActivityAnalysisDirection, type ActivityAnalysisFilters, type ActivityAnalysisMetric, type ActivityAnalysisMode, type ActivityAnalysisSort } from '../services/activityAnalysisService.js'
import { getFinalAnalysis } from '../services/finalAnalysisService.js'

const filterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activityId: z.coerce.number().int().positive().optional(),
  faculty: z.string().trim().max(150).optional(),
  educationLevel: z.string().trim().max(80).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { path: ['to'], message: 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น' })

const studentsQuerySchema = filterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
})

type Filters = z.infer<typeof filterSchema>
type SummaryRow = { pre_count: number | string; post_count: number | string; student_count: number | string }
type CompetencyRow = { id: number; code: string; name: string; display_order: number; pre_average: number | string | null; post_average: number | string | null; pre_count: number | string; post_count: number | string; paired_count: number | string }
type BreakdownRow = { label: string | null; student_count: number | string; pre_count: number | string; post_count: number | string; paired_count: number | string }
type StudentRow = { student_id: number; student_code: string; first_name: string | null; last_name: string | null; faculty: string | null; education_level: string | null; activity_count: number | string; pre_count: number | string; post_count: number | string; pre_average: number | string | null; post_average: number | string | null; latest_submitted_at: Date | string }

const activityAnalysisFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().trim().max(120).optional(),
  organizer: z.string().trim().max(150).optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
  evaluation: z.enum(['has', 'none']).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { path: ['to'], message: 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น' })

const activityAnalysisCatalogSchema = activityAnalysisFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(24),
})

const combinedAnalysisSchema = z.object({
  activityIds: z.array(z.coerce.number().int().positive()).min(2, 'เลือกกิจกรรมอย่างน้อย 2 รายการเพื่อวิเคราะห์ร่วมกัน'),
  mode: z.literal('comparison').default('comparison'),
  metric: z.enum(['score', 'growth', 'response', 'attendees']).default('score'),
  chartLimit: z.coerce.number().int().min(0).default(10),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  sort: z.enum(['score', 'growth', 'response', 'attendees', 'date', 'name']).default('score'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  filters: activityAnalysisFiltersSchema.optional(),
  participantFiltersByActivity: z.record(z.string().regex(/^\d+$/), z.object({
    major: z.string().trim().max(160).optional(),
    educationLevel: z.string().trim().max(120).optional(),
    studyYear: z.coerce.number().int().min(1).max(20).optional(),
  })).optional(),
}).transform((value) => {
  const activityIds = Array.from(new Set(value.activityIds))
  const allowedIds = new Set(activityIds.map(String))
  const participantFiltersByActivity = Object.fromEntries(Object.entries(value.participantFiltersByActivity ?? {}).filter(([activityId]) => allowedIds.has(activityId)))
  return { ...value, activityIds, participantFiltersByActivity }
})

function queryArray(value: unknown) {
  if (value === undefined || value === null || value === '') return []
  return (Array.isArray(value) ? value : [value]).flatMap((item) => String(item).split(',')).filter(Boolean)
}

const finalAnalysisSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  major: z.preprocess(queryArray, z.array(z.string().trim().min(1).max(150))),
  educationLevel: z.preprocess(queryArray, z.array(z.string().trim().min(1).max(80))),
  studyYear: z.preprocess(queryArray, z.array(z.coerce.number().int().min(1).max(10))),
  phase: z.preprocess((value) => {
    const phases = queryArray(value)
    return phases.length === 0 || phases.includes('both') ? ['pre', 'post'] : phases
  }, z.array(z.enum(['pre', 'post'])).min(1)),
}).transform((value) => ({
  activityId: value.activityId,
  majors: Array.from(new Set(value.major)),
  educationLevels: Array.from(new Set(value.educationLevel)),
  studyYears: Array.from(new Set(value.studyYear)),
  phases: Array.from(new Set(value.phase)),
}))

function filteredResponsesQuery(filters: Filters) {
  const clauses: string[] = []
  const values: Array<string | number> = []
  if (filters.from) { clauses.push('sr.submitted_at >= ?'); values.push(`${filters.from} 00:00:00`) }
  if (filters.to) { clauses.push('sr.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(filters.to) }
  if (filters.activityId) { clauses.push('sr.activity_id = ?'); values.push(filters.activityId) }
  if (filters.faculty) { clauses.push('s.faculty = ?'); values.push(filters.faculty) }
  if (filters.educationLevel) { clauses.push('s.education_level = ?'); values.push(filters.educationLevel) }
  clauses.push(`EXISTS (
    SELECT 1 FROM survey_responses paired_response
    WHERE paired_response.activity_id = sr.activity_id
      AND paired_response.student_id = sr.student_id
    GROUP BY paired_response.activity_id, paired_response.student_id
    HAVING SUM(paired_response.phase = 'pre') > 0 AND SUM(paired_response.phase = 'post') > 0
  )`)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return {
    sql: `SELECT sr.id, sr.activity_id, sr.student_id, sr.phase, sr.submitted_at,
      s.student_code, s.first_name, s.last_name, s.faculty, s.education_level
      FROM survey_responses sr
      JOIN students s ON s.id = sr.student_id
      ${where}`,
    values,
  }
}

function pairedCountQuery(filteredSql: string) {
  return `WITH filtered AS (${filteredSql})
    SELECT COUNT(DISTINCT CONCAT(student_id, ':', activity_id)) AS paired_count FROM filtered`
}

async function sharedFilterOptions() {
  const [activities, faculties, educationLevels] = await Promise.all([
    pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM activities ORDER BY name'),
    pool.query<Array<{ faculty: string }>>(`SELECT DISTINCT faculty FROM students WHERE faculty IS NOT NULL AND faculty <> '' ORDER BY faculty`),
    pool.query<Array<{ education_level: string }>>(`SELECT DISTINCT education_level FROM students WHERE education_level IS NOT NULL AND education_level <> '' ORDER BY education_level`),
  ])
  return {
    activities: activities.map((item) => ({ id: Number(item.id), name: item.name })),
    faculties: faculties.map((item) => item.faculty),
    educationLevels: educationLevels.map((item) => item.education_level),
  }
}

function round(value: number | string | null) {
  return value === null ? null : Number(Number(value).toFixed(2))
}

function requestMetadata(request: Pick<Request, 'ip' | 'get'>) {
  return [request.ip ?? null, request.get('user-agent')?.slice(0, 255) ?? null] as const
}

export const analyticsRouter = Router()
analyticsRouter.use(requireAdmin)

analyticsRouter.get('/activity-selection', async (request, response) => {
  const query = activityAnalysisCatalogSchema.parse(request.query)
  if (!isDatabaseAvailable()) {
    response.json({ activities: [], filters: { categories: [], organizers: [] }, pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } })
    return
  }
  response.json(await getActivityAnalysisCatalog(query))
})

analyticsRouter.get('/activity-selection/ids', async (request, response) => {
  const query = activityAnalysisFiltersSchema.parse(request.query)
  if (!isDatabaseAvailable()) { response.json({ ids: [] }); return }
  response.json({ ids: await getActivityAnalysisIds(query) })
})

analyticsRouter.post('/combined', async (request, response) => {
  const input = combinedAnalysisSchema.parse(request.body)
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อมสำหรับการวิเคราะห์กิจกรรม')
  response.json(await getCombinedActivityAnalysis({
    ...input,
    mode: input.mode as ActivityAnalysisMode,
    metric: input.metric as ActivityAnalysisMetric,
    sort: input.sort as ActivityAnalysisSort,
    direction: input.direction as ActivityAnalysisDirection,
    filters: input.filters as ActivityAnalysisFilters | undefined,
  }))
})

analyticsRouter.post('/combined-export', requireReportExportPermission, async (request, response) => {
  const input = combinedAnalysisSchema.parse(request.body)
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อมสำหรับการส่งออกรายงาน')
  const exportFile = await createCombinedActivityAnalysisExport({
    ...input,
    mode: input.mode as ActivityAnalysisMode,
    metric: input.metric as ActivityAnalysisMetric,
    sort: input.sort as ActivityAnalysisSort,
    direction: input.direction as ActivityAnalysisDirection,
    filters: input.filters as ActivityAnalysisFilters | undefined,
  })
  const [ipAddress, userAgent] = requestMetadata(request)
  await pool.query(`INSERT INTO export_logs (admin_id, export_type, activity_id, filters_json, file_name, ip_address, user_agent)
    VALUES (?, 'combined_analysis', NULL, ?, ?, ?, ?)`, [request.admin!.id, JSON.stringify(input), exportFile.filename, ipAddress, userAgent])
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  response.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`)
  response.setHeader('Cache-Control', 'no-store')
  response.send(exportFile.buffer)
})

analyticsRouter.get('/final-analysis', async (request, response) => {
  const filters = finalAnalysisSchema.parse(request.query)
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อมสำหรับการวิเคราะห์ผล Pre-test และ Post-test')
  response.json(await getFinalAnalysis(filters))
})

analyticsRouter.get('/overview', async (request, response) => {
  const filters = filterSchema.parse(request.query)
  if (!isDatabaseAvailable()) {
    response.json({ overview: { preCount: 0, postCount: 0, pairedCount: 0, studentCount: 0, completionRate: null }, filters: { activities: [], faculties: [], educationLevels: [] } })
    return
  }
  const filtered = filteredResponsesQuery(filters)
  const [summaryRows, pairedRows, options] = await Promise.all([
    pool.query<SummaryRow[]>(`WITH filtered AS (${filtered.sql})
      SELECT COALESCE(SUM(phase = 'pre'), 0) AS pre_count, COALESCE(SUM(phase = 'post'), 0) AS post_count,
        COUNT(DISTINCT student_id) AS student_count FROM filtered`, filtered.values),
    pool.query<Array<{ paired_count: number | string }>>(pairedCountQuery(filtered.sql), filtered.values),
    sharedFilterOptions(),
  ])
  const preCount = Number(summaryRows[0]?.pre_count ?? 0)
  const postCount = Number(summaryRows[0]?.post_count ?? 0)
  const pairedCount = Number(pairedRows[0]?.paired_count ?? 0)
  response.json({ overview: {
    preCount, postCount, pairedCount, studentCount: Number(summaryRows[0]?.student_count ?? 0),
    completionRate: preCount > 0 ? Number(((pairedCount / preCount) * 100).toFixed(1)) : null,
  }, filters: options })
})

analyticsRouter.get('/competencies', async (request, response) => {
  const filters = filterSchema.parse(request.query)
  if (!isDatabaseAvailable()) { response.json({ competencies: [] }); return }
  const filtered = filteredResponsesQuery(filters)
  const rows = await pool.query<CompetencyRow[]>(`WITH filtered AS (${filtered.sql})
    SELECT c.id, c.code, c.name, c.display_order,
      AVG(CASE WHEN f.phase = 'pre' THEN ra.score END) AS pre_average,
      AVG(CASE WHEN f.phase = 'post' THEN ra.score END) AS post_average,
      COUNT(DISTINCT CASE WHEN f.phase = 'pre' THEN f.id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN f.phase = 'post' THEN f.id END) AS post_count,
      COUNT(DISTINCT CONCAT(f.student_id, ':', f.activity_id)) AS paired_count
    FROM response_answers ra
    JOIN filtered f ON f.id = ra.response_id
    JOIN competencies c ON c.id = ra.competency_id
    GROUP BY c.id, c.code, c.name, c.display_order
    ORDER BY c.display_order ASC, c.id ASC`, filtered.values)
  response.json({ competencies: rows.map((row) => {
    const preAverage = round(row.pre_average)
    const postAverage = round(row.post_average)
    return {
      id: Number(row.id), code: row.code, name: row.name, displayOrder: Number(row.display_order), preAverage, postAverage,
      growth: preAverage === null || postAverage === null ? null : Number((postAverage - preAverage).toFixed(2)),
      preCount: Number(row.pre_count), postCount: Number(row.post_count), pairedCount: Number(row.paired_count),
    }
  }) })
})

analyticsRouter.get('/participants', async (request, response) => {
  const filters = filterSchema.parse(request.query)
  if (!isDatabaseAvailable()) { response.json({ faculties: [], educationLevels: [] }); return }
  const filtered = filteredResponsesQuery(filters)
  const breakdown = (column: 'faculty' | 'education_level') => `WITH filtered AS (${filtered.sql})
    SELECT COALESCE(${column}, 'ไม่ระบุ') AS label,
      COUNT(DISTINCT student_id) AS student_count,
      COUNT(DISTINCT CASE WHEN phase = 'pre' THEN id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN phase = 'post' THEN id END) AS post_count,
      COUNT(DISTINCT CONCAT(student_id, ':', activity_id)) AS paired_count
    FROM filtered GROUP BY ${column} ORDER BY student_count DESC, label ASC`
  const [faculties, educationLevels] = await Promise.all([
    pool.query<BreakdownRow[]>(breakdown('faculty'), filtered.values),
    pool.query<BreakdownRow[]>(breakdown('education_level'), filtered.values),
  ])
  const serialize = (rows: BreakdownRow[]) => rows.map((row) => ({ label: row.label ?? 'ไม่ระบุ', studentCount: Number(row.student_count), preCount: Number(row.pre_count), postCount: Number(row.post_count), pairedCount: Number(row.paired_count) }))
  response.json({ faculties: serialize(faculties), educationLevels: serialize(educationLevels) })
})

analyticsRouter.get('/students', requireSuperAdmin, async (request, response) => {
  const query = studentsQuerySchema.parse(request.query)
  if (!isDatabaseAvailable()) { response.json({ students: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } }); return }
  const filtered = filteredResponsesQuery(query)
  const countRows = await pool.query<Array<{ total: number | string }>>(`WITH filtered AS (${filtered.sql}) SELECT COUNT(DISTINCT student_id) AS total FROM filtered`, filtered.values)
  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  const page = totalPages ? Math.min(query.page, totalPages) : 1
  const rows = await pool.query<StudentRow[]>(`WITH filtered AS (${filtered.sql})
    SELECT student_id, student_code, first_name, last_name, faculty, education_level,
      COUNT(DISTINCT activity_id) AS activity_count,
      COUNT(DISTINCT CASE WHEN phase = 'pre' THEN filtered.id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN phase = 'post' THEN filtered.id END) AS post_count,
      AVG(CASE WHEN phase = 'pre' THEN response_answers.score END) AS pre_average,
      AVG(CASE WHEN phase = 'post' THEN response_answers.score END) AS post_average,
      MAX(submitted_at) AS latest_submitted_at
    FROM filtered LEFT JOIN response_answers ON response_answers.response_id = filtered.id
    GROUP BY student_id, student_code, first_name, last_name, faculty, education_level
    ORDER BY latest_submitted_at DESC, student_id DESC
    LIMIT ? OFFSET ?`, [...filtered.values, query.pageSize, (page - 1) * query.pageSize])
  response.json({ students: rows.map((row) => ({
    id: Number(row.student_id), studentCode: row.student_code, firstName: row.first_name ?? '', lastName: row.last_name ?? '',
    faculty: row.faculty, educationLevel: row.education_level, activityCount: Number(row.activity_count), preCount: Number(row.pre_count), postCount: Number(row.post_count),
    preAverage: round(row.pre_average), postAverage: round(row.post_average),
    growth: row.pre_average === null || row.post_average === null ? null : Number((Number(row.post_average) - Number(row.pre_average)).toFixed(2)),
    latestSubmittedAt: row.latest_submitted_at instanceof Date ? row.latest_submitted_at.toISOString() : row.latest_submitted_at,
  })), pagination: { page, pageSize: query.pageSize, total, totalPages } })
})
