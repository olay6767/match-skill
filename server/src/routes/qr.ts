import crypto from 'node:crypto'
import { Router } from 'express'
import QRCode from 'qrcode'
import { z } from 'zod'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'

type Phase = 'pre' | 'post'
type QrRow = {
  id: number; activity_id: number; phase: Phase; token: string
  revoked_at: Date | string | null; replaced_by_id: number | null; created_at: Date | string
}

const phaseSchema = z.enum(['pre', 'post'])
const qrUrl = (token: string) => `${env.USER_FRONTEND_URL}/s/${token}`
const dateTime = (value: Date | string | null) => value instanceof Date ? value.toISOString() : value

function serializeQr(row: QrRow) {
  return { id: Number(row.id), activityId: Number(row.activity_id), phase: row.phase, url: qrUrl(row.token),
    active: !row.revoked_at, revokedAt: dateTime(row.revoked_at), replacedById: row.replaced_by_id ? Number(row.replaced_by_id) : null,
    createdAt: dateTime(row.created_at) }
}

async function ensureActivity(activityId: number) {
  const rows = await pool.query<Array<{ id: number }>>('SELECT id FROM activities WHERE id = ? LIMIT 1', [activityId])
  if (!rows[0]) throw new ApiError(404, 'ไม่พบกิจกรรม')
}

export const qrRouter = Router({ mergeParams: true })
qrRouter.use(requireAdmin)

qrRouter.get('/', async (request, response) => {
  const activityId = z.coerce.number().int().positive().parse((request.params as Record<string, string>).id)
  await ensureActivity(activityId)
  const [rows, countRows] = await Promise.all([
    pool.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE activity_id = ? ORDER BY created_at DESC, id DESC', [activityId]),
    pool.query<Array<{ pre_count: number | string; post_count: number | string; paired_count: number | string }>>(
      `SELECT SUM(phase='pre') AS pre_count, SUM(phase='post') AS post_count,
       COUNT(DISTINCT CASE WHEN phase_count = 2 THEN student_id END) AS paired_count
       FROM (SELECT sr.*, COUNT(*) OVER (PARTITION BY student_id, activity_id) AS phase_count FROM survey_responses sr WHERE activity_id = ?) x`, [activityId]),
  ])
  response.json({ qrCodes: rows.map(serializeQr), stats: { preCount: Number(countRows[0]?.pre_count ?? 0), postCount: Number(countRows[0]?.post_count ?? 0), pairedCount: Number(countRows[0]?.paired_count ?? 0) } })
})

qrRouter.post('/', async (request, response) => {
  const activityId = z.coerce.number().int().positive().parse((request.params as Record<string, string>).id)
  const { phase } = z.object({ phase: phaseSchema }).parse(request.body)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const activities = await connection.query<Array<{ id: number }>>('SELECT id FROM activities WHERE id = ? FOR UPDATE', [activityId])
    if (!activities[0]) throw new ApiError(404, 'ไม่พบกิจกรรม')
    const existing = await connection.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE activity_id = ? AND phase = ? AND revoked_at IS NULL LIMIT 1', [activityId, phase])
    if (existing[0]) { await connection.commit(); response.json({ qrCode: serializeQr(existing[0]) }); return }
    const token = crypto.randomBytes(32).toString('hex')
    const result = await connection.query('INSERT INTO qr_codes (activity_id, phase, token, created_by) VALUES (?, ?, ?, ?)', [activityId, phase, token, request.admin!.id]) as { insertId: number | bigint }
    await connection.query('INSERT INTO activity_logs (activity_id, admin_id, action, detail) VALUES (?, ?, ?, ?)', [activityId, request.admin!.id, 'qr_generated', phase])
    const rows = await connection.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE id = ?', [result.insertId])
    await connection.commit()
    if (!rows[0]) throw new Error('Created QR Code could not be loaded')
    response.status(201).json({ qrCode: serializeQr(rows[0]) })
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
})

qrRouter.post('/:qrId/regenerate', async (request, response) => {
  const activityId = z.coerce.number().int().positive().parse((request.params as Record<string, string>).id)
  const qrId = z.coerce.number().int().positive().parse(request.params.qrId)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const rows = await connection.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE id = ? AND activity_id = ? FOR UPDATE', [qrId, activityId])
    const previous = rows[0]
    if (!previous) throw new ApiError(404, 'ไม่พบ QR Code')
    if (previous.revoked_at) throw new ApiError(409, 'QR Code นี้ถูกยกเลิกแล้ว')
    const token = crypto.randomBytes(32).toString('hex')
    const result = await connection.query('INSERT INTO qr_codes (activity_id, phase, token, created_by) VALUES (?, ?, ?, ?)', [activityId, previous.phase, token, request.admin!.id]) as { insertId: number | bigint }
    await connection.query('UPDATE qr_codes SET revoked_at = NOW(), replaced_by_id = ? WHERE id = ?', [result.insertId, qrId])
    await connection.query('INSERT INTO activity_logs (activity_id, admin_id, action, detail) VALUES (?, ?, ?, ?)', [activityId, request.admin!.id, 'qr_regenerated', `${previous.phase}:${qrId}->${result.insertId}`])
    const created = await connection.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE id = ?', [result.insertId])
    await connection.commit()
    if (!created[0]) throw new Error('Regenerated QR Code could not be loaded')
    response.status(201).json({ qrCode: serializeQr(created[0]) })
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
})

qrRouter.get('/:qrId/png', async (request, response) => {
  const activityId = z.coerce.number().int().positive().parse((request.params as Record<string, string>).id)
  const qrId = z.coerce.number().int().positive().parse(request.params.qrId)
  const rows = await pool.query<QrRow[]>('SELECT id, activity_id, phase, token, revoked_at, replaced_by_id, created_at FROM qr_codes WHERE id = ? AND activity_id = ? LIMIT 1', [qrId, activityId])
  const qr = rows[0]
  if (!qr) throw new ApiError(404, 'ไม่พบ QR Code')
  if (qr.revoked_at) throw new ApiError(410, 'QR Code นี้ถูกยกเลิกแล้ว')
  const png = await QRCode.toBuffer(qrUrl(qr.token), { type: 'png', width: 720, margin: 3, errorCorrectionLevel: 'H' })
  response.setHeader('Content-Type', 'image/png')
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Content-Disposition', `attachment; filename="activity-${activityId}-${qr.phase}-qr.png"`)
  response.send(png)
})
