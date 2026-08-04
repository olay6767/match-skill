import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

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

  console.error(error)
  response.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' })
}
