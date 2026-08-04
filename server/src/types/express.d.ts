export {}

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number
        email: string
        role: string
      }
    }
  }
}
