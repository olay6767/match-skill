import type { StudentPortalSession } from './types'

const sessionKey = 'seda:user-portal-session'

export function saveStudentPortalSession(session: StudentPortalSession) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session))
}

export function clearStudentPortalSession() {
  sessionStorage.removeItem(sessionKey)
}

export function getStudentPortalSession(): StudentPortalSession | null {
  const raw = sessionStorage.getItem(sessionKey)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as StudentPortalSession
    if (!session.historySession || Date.parse(session.expiresAt) <= Date.now()) {
      clearStudentPortalSession()
      return null
    }
    return session
  } catch {
    clearStudentPortalSession()
    return null
  }
}
