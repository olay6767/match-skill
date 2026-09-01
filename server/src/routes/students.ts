import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { educationLevelFromStudentCode, normalizeStudentCode } from '../lib/studentEducation.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/superAdminAuthorization.js'

const studentCode = z.string().transform(normalizeStudentCode).pipe(z.string().regex(/^[BMD]\d{7}$/, 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'))
const fields = z.object({
  studentCode,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email(),
  faculty: z.string().trim().max(150).nullable(),
  major: z.string().trim().max(150).nullable(),
  educationLevel: z.string().trim().max(80).nullable(),
  studyYear: z.coerce.number().int().min(1).max(10).nullable(),
  phone: z.string().trim().max(30).nullable(),
  pdpaConsentedAt: z.string().datetime({ offset: true }).nullable(),
})
const listSchema = z.object({
  q: z.string().trim().max(100).default(''),
  faculty: z.string().trim().max(150).default(''),
  activityId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
})

export const studentsRouter = Router()
studentsRouter.use(requireAdmin)

function serialize(row: Record<string, unknown>, canViewPersonalData: boolean) {
  const aggregate = {
    id: Number(row.id),
    faculty: row.faculty,
    major: row.major,
    educationLevel: row.education_level,
    studyYear: row.study_year === null || row.study_year === undefined ? null : Number(row.study_year),
    activityCount: Number(row.activity_count ?? 0),
    preCount: Number(row.pre_count ?? 0),
    postCount: Number(row.post_count ?? 0),
  }

  if (!canViewPersonalData) return aggregate

  return {
    ...aggregate,
    studentCode: row.student_code,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email,
    phone: row.phone,
    pdpaConsentedAt: row.pdpa_consented_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

studentsRouter.get('/', async (request, response) => {
  const query = listSchema.parse(request.query)
  const canViewPersonalData = request.admin?.role === 'super_admin'
  const conditions: string[] = []
  const values: Array<string | number> = []

  if (query.q) {
    const term = `%${query.q}%`
    if (canViewPersonalData) {
      conditions.push(`(s.student_code LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR CONCAT_WS(' ',s.first_name,s.last_name) LIKE ? OR s.email LIKE ? OR s.faculty LIKE ? OR s.major LIKE ? OR s.education_level LIKE ? OR s.phone LIKE ? OR EXISTS (SELECT 1 FROM survey_responses searched_response JOIN activities searched_activity ON searched_activity.id=searched_response.activity_id WHERE searched_response.student_id=s.id AND (searched_activity.code LIKE ? OR searched_activity.name LIKE ?)))`)
      values.push(term, term, term, term, term, term, term, term, term, term, term)
    } else {
      conditions.push(`(s.faculty LIKE ? OR s.major LIKE ? OR s.education_level LIKE ? OR EXISTS (SELECT 1 FROM survey_responses searched_response JOIN activities searched_activity ON searched_activity.id=searched_response.activity_id WHERE searched_response.student_id=s.id AND (searched_activity.code LIKE ? OR searched_activity.name LIKE ?)))`)
      values.push(term, term, term, term, term)
    }
  }
  if (query.faculty) {
    conditions.push('s.faculty=?')
    values.push(query.faculty)
  }
  if (query.activityId) {
    conditions.push('EXISTS (SELECT 1 FROM survey_responses x WHERE x.student_id=s.id AND x.activity_id=?)')
    values.push(query.activityId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRows = await pool.query<Array<{ total: number | string }>>(`SELECT COUNT(*) total FROM students s ${where}`, values)
  const total = Number(totalRows[0]?.total ?? 0)
  const totalPages = total ? Math.ceil(total / query.pageSize) : 0
  const page = totalPages ? Math.min(query.page, totalPages) : 1
  const personalColumns = canViewPersonalData
    ? 's.student_code,s.first_name,s.last_name,s.email,s.phone,s.pdpa_consented_at,s.created_at,s.updated_at,'
    : ''
  const rows = await pool.query<Array<Record<string, unknown>>>(`SELECT s.id,${personalColumns}s.faculty,s.major,s.education_level,s.study_year,
    COUNT(DISTINCT sr.activity_id) activity_count,
    COUNT(DISTINCT CASE WHEN sr.phase='pre' THEN sr.id END) pre_count,
    COUNT(DISTINCT CASE WHEN sr.phase='post' THEN sr.id END) post_count
    FROM students s LEFT JOIN survey_responses sr ON sr.student_id=s.id ${where}
    GROUP BY s.id ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?`, [...values, query.pageSize, (page - 1) * query.pageSize])
  const [faculties, activities] = await Promise.all([
    pool.query<Array<{ faculty: string }>>("SELECT DISTINCT faculty FROM students WHERE faculty IS NOT NULL AND faculty<>'' ORDER BY faculty"),
    pool.query<Array<{ id: number; name: string }>>('SELECT id,name FROM activities ORDER BY name'),
  ])

  response.json({
    students: rows.map((row) => serialize(row, canViewPersonalData)),
    pagination: { page, pageSize: query.pageSize, total, totalPages },
    filters: { faculties: faculties.map((item) => item.faculty), activities: activities.map((item) => ({ id: Number(item.id), name: item.name })) },
    access: { canViewPersonalData, canEdit: canViewPersonalData },
  })
})

studentsRouter.get('/:id/responses', requireSuperAdmin, async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const exists = await pool.query<Array<{ id: number }>>('SELECT id FROM students WHERE id=?', [id])
  if (!exists[0]) throw new ApiError(404, 'ไม่พบนักศึกษา')
  const rows = await pool.query<Array<Record<string, unknown>>>(`SELECT sr.id,sr.activity_id,a.code activity_code,a.name activity_name,sr.phase,sr.submitted_at
    FROM survey_responses sr JOIN activities a ON a.id=sr.activity_id WHERE sr.student_id=? ORDER BY sr.submitted_at DESC`, [id])
  response.json({ responses: rows.map((row) => ({
    id: Number(row.id), activityId: Number(row.activity_id), activityCode: row.activity_code,
    activityName: row.activity_name, phase: row.phase, submittedAt: row.submitted_at,
  })) })
})

studentsRouter.get('/:id', requireSuperAdmin, async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const rows = await pool.query<Array<Record<string, unknown>>>('SELECT * FROM students WHERE id=? LIMIT 1', [id])
  if (!rows[0]) throw new ApiError(404, 'ไม่พบนักศึกษา')
  response.json({ student: serialize(rows[0], true) })
})

studentsRouter.patch('/:id', requireSuperAdmin, async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const body = fields.partial().refine((value) => Object.keys(value).length > 0, 'กรุณาส่งข้อมูลที่ต้องการแก้ไข').parse(request.body)
  if (body.studentCode) {
    const duplicate = await pool.query<Array<{ id: number }>>('SELECT id FROM students WHERE student_code=? AND id<>? LIMIT 1', [body.studentCode, id])
    if (duplicate[0]) throw new ApiError(409, 'รหัสนักศึกษานี้มีอยู่แล้ว')
    body.educationLevel = educationLevelFromStudentCode(body.studentCode)
  }
  const columns: Record<string, string> = { studentCode: 'student_code', firstName: 'first_name', lastName: 'last_name', email: 'email', faculty: 'faculty', major: 'major', educationLevel: 'education_level', studyYear: 'study_year', phone: 'phone', pdpaConsentedAt: 'pdpa_consented_at' }
  const updates: string[] = []
  const values: Array<string | number | null> = []
  for (const [key, value] of Object.entries(body)) {
    updates.push(`${columns[key]}=?`)
    values.push(key === 'pdpaConsentedAt' && typeof value === 'string' ? value.replace('T', ' ').replace('Z', '') : value as string | number | null)
  }
  values.push(id)
  const result = await pool.query(`UPDATE students SET ${updates.join(',')},full_name=CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,'')) WHERE id=?`, values)
  if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบนักศึกษา')
  const rows = await pool.query<Array<Record<string, unknown>>>('SELECT * FROM students WHERE id=?', [id])
  response.json({ student: serialize(rows[0]!, true) })
})
