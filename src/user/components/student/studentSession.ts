import type { SurveySessionStartResult } from '../../../lib/api'

export type StoredSurveySession = Pick<SurveySessionStartResult, 'next' | 'alreadySubmitted' | 'resumed' | 'surveySession' | 'expiresAt'>

export function surveySessionStorageKey(token: string) {
  return `seda-survey-session:${token}`
}

export function getStoredSurveySession(token: string): StoredSurveySession | null {
  try {
    const raw = window.sessionStorage.getItem(surveySessionStorageKey(token))
    if (!raw) return null
    const item = JSON.parse(raw) as Partial<StoredSurveySession>
    if ((item.next !== 'assessment' && item.next !== 'result') || typeof item.alreadySubmitted !== 'boolean' || typeof item.resumed !== 'boolean' || typeof item.surveySession !== 'string' || typeof item.expiresAt !== 'string' || Number.isNaN(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(surveySessionStorageKey(token))
      return null
    }
    return item as StoredSurveySession
  } catch {
    return null
  }
}

export function saveStoredSurveySession(token: string, session: StoredSurveySession) {
  window.sessionStorage.setItem(surveySessionStorageKey(token), JSON.stringify(session))
}

export function setStoredSurveySessionNext(token: string, next: StoredSurveySession['next']) {
  const session = getStoredSurveySession(token)
  if (session) saveStoredSurveySession(token, { ...session, next })
}
