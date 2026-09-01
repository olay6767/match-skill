export type StoredHistorySession = {
  historySession: string
  expiresAt: string
}

const storageKey = 'seda-student-history-session'

export function getStoredHistorySession(): StoredHistorySession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) return null
    const item = JSON.parse(raw) as Partial<StoredHistorySession>
    if (typeof item.historySession !== 'string' || typeof item.expiresAt !== 'string' || !/^[a-f0-9]{64}$/.test(item.historySession) || Number.isNaN(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(storageKey)
      return null
    }
    return item as StoredHistorySession
  } catch {
    return null
  }
}

export function saveHistorySession(session: StoredHistorySession) {
  window.sessionStorage.setItem(storageKey, JSON.stringify(session))
}

export function clearHistorySession() {
  window.sessionStorage.removeItem(storageKey)
}
