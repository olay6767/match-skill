import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireReportExportPermission } from '../middleware/reportAuthorization.js'
import { createFinalExport, createRawExport, createSummaryExport, type ReportFilters } from '../services/exportService.js'

const exportSchema = z.object({
  activityId: z.coerce.number().int().positive(),
})
const historySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(10).max(100).default(20) })

type ExportType = 'raw' | 'summary' | 'final'

async function writeExportLog(request: Request, exportType: ExportType, filters: ReportFilters, filename: string) {
  const [ipAddress, userAgent] = requestMetadata(request)
  await pool.query(`INSERT INTO export_logs (admin_id, export_type, activity_id, filters_json, file_name, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [request.admin!.id, exportType, filters.activityId, JSON.stringify(filters), filename, ipAddress, userAgent])
}

function requestMetadata(request: Pick<Request, 'ip' | 'get'>) {
  return [request.ip ?? null, request.get('user-agent')?.slice(0, 255) ?? null] as const
}

function encodeDownloadFilename(filename: string) {
  return encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

async function download(request: Request, response: Response, exportType: ExportType) {
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบฐานข้อมูลยังไม่พร้อมสำหรับการส่งออกรายงาน')
  const filters = exportSchema.parse(request.body)
  const exportFile = exportType === 'raw'
    ? await createRawExport(filters)
    : exportType === 'final'
      ? await createFinalExport(filters)
      : await createSummaryExport(filters)
  await writeExportLog(request, exportType, filters, exportFile.filename)
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  response.setHeader('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeDownloadFilename(exportFile.filename)}`)
  response.setHeader('Cache-Control', 'no-store')
  response.send(exportFile.buffer)
}

export const reportsRouter = Router()
reportsRouter.use(requireAdmin, requireReportExportPermission)

reportsRouter.post('/raw-export', async (request, response) => download(request, response, 'raw'))
reportsRouter.post('/summary-export', async (request, response) => download(request, response, 'summary'))
reportsRouter.post('/final-export', async (request, response) => download(request, response, 'final'))
reportsRouter.get('/export-history', async (request, response) => {
  if (!isDatabaseAvailable()) { response.json({ history: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); return }
  const query = historySchema.parse(request.query)
  const totalRows = await pool.query<Array<{ total: number | string }>>('SELECT COUNT(*) AS total FROM export_logs')
  const total = Number(totalRows[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  const page = totalPages ? Math.min(query.page, totalPages) : 1
  const rows = await pool.query<Array<Record<string, string | number | Date | null>>>(`SELECT e.id, e.export_type, e.filters_json, e.file_name, e.created_at,
      a.code AS activity_code, a.name AS activity_name, ad.email AS admin_email
    FROM export_logs e JOIN admins ad ON ad.id = e.admin_id LEFT JOIN activities a ON a.id = e.activity_id
    ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?`, [query.pageSize, (page - 1) * query.pageSize])
  response.json({ history: rows.map((row) => ({
    id: Number(row.id), type: row.export_type, fileName: row.file_name, activityCode: row.activity_code, activityName: row.activity_name,
    adminEmail: row.admin_email, filters: typeof row.filters_json === 'string' ? JSON.parse(row.filters_json) : row.filters_json,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  })), pagination: { page, pageSize: query.pageSize, total, totalPages } })
})
