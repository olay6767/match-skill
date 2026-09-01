import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/superAdminAuthorization.js'

const participantSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.email().nullable().optional(),
})

export const participantsRouter = Router()
participantsRouter.use(requireAdmin, requireSuperAdmin)

participantsRouter.get('/', async (_request, response) => {
  const participants = await pool.query(
    `SELECT id, name, email, created_at AS createdAt
     FROM participants ORDER BY created_at DESC, id DESC`,
  )
  response.json({ participants })
})

participantsRouter.post('/', async (request, response) => {
  const body = participantSchema.parse(request.body)
  const result = await pool.query(
    'INSERT INTO participants (name, email) VALUES (?, ?)',
    [body.name, body.email?.toLowerCase() ?? null],
  )
  const rows = await pool.query(
    `SELECT id, name, email, created_at AS createdAt
     FROM participants WHERE id = ?`,
    [result.insertId],
  )
  response.status(201).json({ participant: rows[0] })
})

participantsRouter.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const body = participantSchema.partial().parse(request.body)
  if (body.name === undefined && body.email === undefined) {
    throw new ApiError(400, 'กรุณาส่งข้อมูลที่ต้องการแก้ไข')
  }

  const updates: string[] = []
  const values: Array<string | number | null> = []
  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.email !== undefined) {
    updates.push('email = ?')
    values.push(body.email?.toLowerCase() ?? null)
  }
  values.push(id)

  const result = await pool.query(
    `UPDATE participants SET ${updates.join(', ')} WHERE id = ?`,
    values,
  )
  if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบผู้เข้าร่วม')

  const rows = await pool.query(
    `SELECT id, name, email, created_at AS createdAt
     FROM participants WHERE id = ?`,
    [id],
  )
  response.json({ participant: rows[0] })
})

participantsRouter.delete('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const result = await pool.query('DELETE FROM participants WHERE id = ?', [id])
  if (result.affectedRows === 0) throw new ApiError(404, 'ไม่พบผู้เข้าร่วม')
  response.status(204).end()
})
