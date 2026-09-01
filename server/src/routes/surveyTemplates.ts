import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'

const text = z.string().trim().min(1).max(5000)
export const surveyTemplatesRouter = Router()
surveyTemplatesRouter.use(requireAdmin)

async function editableCompetency(id: number) {
  const rows = await pool.query<Array<{ template_id: number; status: string; response_count: number | string }>>(
    'SELECT c.template_id,t.status,' +
      '(SELECT COUNT(*) FROM survey_responses sr JOIN activities a ON a.id=sr.activity_id WHERE a.survey_template_id=t.id) response_count ' +
      'FROM competencies c JOIN survey_templates t ON t.id=c.template_id WHERE c.id=?',
    [id],
  )
  const item = rows[0]
  if (!item) throw new ApiError(404, 'ไม่พบสมรรถนะ')
  if (item.status === 'active' && Number(item.response_count) > 0) {
    throw new ApiError(409, 'แบบประเมินที่เผยแพร่และมีคำตอบแล้วแก้ไขโดยตรงไม่ได้')
  }
  if (item.status === 'archived') throw new ApiError(409, 'แก้ไขแบบประเมินที่เก็บถาวรไม่ได้')
  return item
}

surveyTemplatesRouter.get('/', async (_request, response) => {
  const rows = await pool.query<Array<Record<string, string | number | null>>>(
    'SELECT t.id,t.name,t.version,t.status,t.updated_at,a.full_name updated_by,COUNT(DISTINCT c.id) competency_count ' +
      'FROM survey_templates t LEFT JOIN admins a ON a.id=t.updated_by ' +
      "LEFT JOIN competencies c ON c.template_id=t.id WHERE t.status='active' " +
      'GROUP BY t.id ORDER BY t.id DESC',
  )
  response.json({
    templates: rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      version: Number(row.version),
      status: row.status === 'active' ? 'published' : row.status,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      competencyCount: Number(row.competency_count),
    })),
  })
})

surveyTemplatesRouter.get('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const templates = await pool.query<Array<Record<string, string | number | null>>>(
    'SELECT t.*,a.full_name updated_by_name,' +
      '(SELECT COUNT(*) FROM survey_responses sr JOIN activities ac ON ac.id=sr.activity_id WHERE ac.survey_template_id=t.id) response_count ' +
      'FROM survey_templates t LEFT JOIN admins a ON a.id=t.updated_by WHERE t.id=?',
    [id],
  )
  if (!templates[0]) throw new ApiError(404, 'ไม่พบแบบประเมิน')

  const rows = await pool.query<Array<Record<string, string | number | null>>>(
    'SELECT c.id competency_id,c.code,c.name,c.definition,c.display_order,l.level,l.title,l.description,l.example ' +
      'FROM competencies c LEFT JOIN competency_levels l ON l.competency_id=c.id ' +
      'WHERE c.template_id=? ORDER BY c.display_order,l.level',
    [id],
  )
  const map = new Map<number, {
    id: number
    code: unknown
    name: unknown
    definition: unknown
    displayOrder: number
    levels: Array<unknown>
  }>()
  for (const row of rows) {
    const competencyId = Number(row.competency_id)
    if (!map.has(competencyId)) {
      map.set(competencyId, {
        id: competencyId,
        code: row.code,
        name: row.name,
        definition: row.definition,
        displayOrder: Number(row.display_order),
        levels: [],
      })
    }
    if (row.level) {
      map.get(competencyId)!.levels.push({
        level: Number(row.level),
        title: row.title,
        description: row.description,
        example: row.example,
      })
    }
  }

  const template = templates[0]
  response.json({
    template: {
      id: Number(template.id),
      name: template.name,
      version: Number(template.version),
      status: template.status === 'active' ? 'published' : template.status,
      updatedAt: template.updated_at,
      updatedBy: template.updated_by_name,
      responseCount: Number(template.response_count),
      competencies: [...map.values()],
    },
  })
})

surveyTemplatesRouter.post('/:id/clone', () => {
  throw new ApiError(409, 'ระบบใช้ Standard 9-Skill Assessment เพียงชุดเดียว จึงไม่รองรับการ Clone เวอร์ชัน')
})

surveyTemplatesRouter.post('/:id/activate', () => {
  throw new ApiError(409, 'ระบบใช้ Standard 9-Skill Assessment เพียงชุดเดียว')
})

surveyTemplatesRouter.delete('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const templates = await connection.query<Array<{ status: string; cloned_from_id: number | null }>>(
      'SELECT status,cloned_from_id FROM survey_templates WHERE id=? FOR UPDATE',
      [id],
    )
    const template = templates[0]
    if (!template) throw new ApiError(404, 'ไม่พบแบบประเมิน')
    if (template.status !== 'draft' || template.cloned_from_id === null) {
      throw new ApiError(409, 'ลบได้เฉพาะแบบประเมิน Draft ที่สร้างจากการ Clone')
    }
    const activityRows = await connection.query<Array<{ total: number | string }>>(
      'SELECT COUNT(*) AS total FROM activities WHERE survey_template_id=?',
      [id],
    )
    if (Number(activityRows[0]?.total ?? 0) > 0) {
      throw new ApiError(409, 'ไม่สามารถลบแบบประเมินที่ถูกนำไปใช้กับกิจกรรมแล้ว')
    }
    const answerRows = await connection.query<Array<{ total: number | string }>>(
      'SELECT COUNT(*) AS total FROM response_answers ra JOIN competencies c ON c.id=ra.competency_id WHERE c.template_id=?',
      [id],
    )
    if (Number(answerRows[0]?.total ?? 0) > 0) {
      throw new ApiError(409, 'ไม่สามารถลบแบบประเมินที่มีคำตอบอยู่แล้ว')
    }
    await connection.query('DELETE FROM questions WHERE template_id=?', [id])
    await connection.query('DELETE FROM competencies WHERE template_id=?', [id])
    await connection.query('DELETE FROM survey_templates WHERE id=?', [id])
    await connection.commit()
    response.status(204).end()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

surveyTemplatesRouter.patch('/competencies/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  await editableCompetency(id)
  const body = z.object({ name: text.max(255), definition: text }).parse(request.body)
  await pool.query('UPDATE competencies SET name=?,definition=?,updated_by=? WHERE id=?', [
    body.name,
    body.definition,
    request.admin!.id,
    id,
  ])
  response.json({ message: 'บันทึกสมรรถนะแล้ว' })
})

surveyTemplatesRouter.patch('/competencies/:id/levels/:level', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const level = z.coerce.number().int().min(1).max(7).parse(request.params.level)
  await editableCompetency(id)
  const body = z.object({
    title: text.max(60),
    description: text,
    example: z.string().trim().max(5000).nullable().default(null),
  }).parse(request.body)
  await pool.query(
    'UPDATE competency_levels SET title=?,description=?,example=?,updated_by=? WHERE competency_id=? AND level=?',
    [body.title, body.description, body.example || null, request.admin!.id, id, level],
  )
  response.json({ message: 'บันทึกระดับแล้ว' })
})

export const competenciesRouter = Router()
competenciesRouter.use(requireAdmin)
competenciesRouter.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  await editableCompetency(id)
  const body = z.object({ name: text.max(255), definition: text }).parse(request.body)
  await pool.query('UPDATE competencies SET name=?,definition=?,updated_by=? WHERE id=?', [
    body.name,
    body.definition,
    request.admin!.id,
    id,
  ])
  response.json({ message: 'บันทึกสมรรถนะแล้ว' })
})
competenciesRouter.patch('/:id/levels/:level', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const level = z.coerce.number().int().min(1).max(7).parse(request.params.level)
  await editableCompetency(id)
  const body = z.object({
    title: text.max(60),
    description: text,
    example: z.string().trim().max(5000).nullable().default(null),
  }).parse(request.body)
  await pool.query(
    'UPDATE competency_levels SET title=?,description=?,example=?,updated_by=? WHERE competency_id=? AND level=?',
    [body.title, body.description, body.example || null, request.admin!.id, id, level],
  )
  response.json({ message: 'บันทึกระดับแล้ว' })
})
