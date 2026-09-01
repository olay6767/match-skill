import { clearStudentPortalSession, getStudentPortalSession } from './session'
import type { JoinedActivity, StudentPortalSession, UserActivityDetail, UserProfile, UserProgressActivity } from './types'

export class StudentPortalApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const session = getStudentPortalSession()
    if (!session) throw new StudentPortalApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    headers.set('X-Student-History-Session', session.historySession)
  }
  const response = await fetch(`/api/student-portal${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok) {
    if (response.status === 401) clearStudentPortalSession()
    throw new StudentPortalApiError(response.status, payload.message ?? 'ไม่สามารถเชื่อมต่อระบบได้')
  }
  return payload as T
}

export function loginStudentPortal(studentCode: string) {
  return request<StudentPortalSession>('/login', { method: 'POST', body: JSON.stringify({ studentCode }) })
}

export function getStudentPortalProfile() {
  return request<{ profile: UserProfile }>('/me', {}, true)
}

export function getStudentPortalActivities() {
  return request<{ activities: JoinedActivity[] }>('/activities', {}, true)
}

export function getStudentPortalProgress() {
  return request<{ activities: UserProgressActivity[] }>('/progress', {}, true)
}

export function getStudentPortalActivity(activityId: number) {
  return request<{ activity: UserActivityDetail }>(`/activities/${encodeURIComponent(activityId)}`, {}, true)
}
