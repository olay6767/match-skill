import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { setDatabaseAvailable } from '../db/availability.js'

const databaseConnectionErrorCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ER_GET_CONNECTION_TIMEOUT',
  'ER_CONNECTION_TIMEOUT',
  'ER_CMD_CONNECTION_CLOSED',
  'ER_SOCKET_UNEXPECTED_CLOSE',
  'PROTOCOL_CONNECTION_LOST',
])

function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  return databaseConnectionErrorCodes.has(code)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ message: 'ไม่พบ API ที่เรียก' })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next
  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'ข้อมูลที่ส่งมายังไม่ถูกต้อง',
      issues: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({ message: error.message })
    return
  }

  if (isDatabaseConnectionError(error)) {
    setDatabaseAvailable(false)
    console.error('Database connection unavailable:', error)
    response.status(503).json({ message: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง' })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' })
}
