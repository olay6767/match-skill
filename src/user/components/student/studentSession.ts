import type { SurveySessionStartResult } from '../../../lib/api'

export type StoredSurveySession = Pick<SurveySessionStartResult, 'next' | 'alreadySubmitted' | 'resumed' | 'surveySession' | 'expiresAt'>

const memorySessions = new Map<string, StoredSurveySession>()

export function surveySessionStorageKey(token: string) {
  return `seda-survey-session:${token}`
}

function isStoredSurveySession(value: Partial<StoredSurveySession>): value is StoredSurveySession {
  return (value.next === 'assessment' || value.next === 'result')
    && typeof value.alreadySubmitted === 'boolean'
    && typeof value.resumed === 'boolean'
    && typeof value.surveySession === 'string'
    && typeof value.expiresAt === 'string'
    && !Number.isNaN(Date.parse(value.expiresAt))
    && Date.parse(value.expiresAt) > Date.now()
}

export function getStoredSurveySession(token: string): StoredSurveySession | null {
  const memorySession = memorySessions.get(token)
  if (memorySession && isStoredSurveySession(memorySession)) return memorySession
  memorySessions.delete(token)

  try {
    const raw = window.sessionStorage.getItem(surveySessionStorageKey(token))
    if (!raw) return null
    const item = JSON.parse(raw) as Partial<StoredSurveySession>
    if (!isStoredSurveySession(item)) {
      window.sessionStorage.removeItem(surveySessionStorageKey(token))
      return null
    }
    memorySessions.set(token, item)
    return item
  } catch {
    return null
  }
}

export function saveStoredSurveySession(token: string, session: StoredSurveySession) {
  memorySessions.set(token, session)
  try {
    window.sessionStorage.setItem(surveySessionStorageKey(token), JSON.stringify(session))
  } catch {
    // Some in-app and private browsers block sessionStorage. The in-memory copy
    // still keeps the current tab usable for the full assessment flow.
  }
}

export function clearStoredSurveySession(token: string) {
  memorySessions.delete(token)
  try {
    window.sessionStorage.removeItem(surveySessionStorageKey(token))
  } catch {
    // The in-memory copy has already been removed.
  }
}

export function clearStoredSurveySessionIfMatches(token: string, surveySession: string) {
  if (getStoredSurveySession(token)?.surveySession !== surveySession) return false
  clearStoredSurveySession(token)
  return true
}

export function setStoredSurveySessionNext(token: string, next: StoredSurveySession['next']) {
  const session = getStoredSurveySession(token)
  if (session) saveStoredSurveySession(token, { ...session, next })
}
