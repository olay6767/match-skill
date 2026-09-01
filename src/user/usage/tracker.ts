type UsageEventType = 'session' | 'page_view' | 'interaction' | 'heartbeat'

type UsageMetadata = {
  activityId?: number
  phase?: 'pre' | 'post'
  questionNumber?: number
  totalQuestions?: number
}

const anonymousIdKey = 'seda:usage-anonymous-id'
const clientSessionIdKey = 'seda:usage-session-id'
let trackingStarted = false
let lastTrackedPath = ''
let lastActiveAt = Date.now()
let pendingActiveSeconds = 0
let wasVisible = typeof document !== 'undefined' ? !document.hidden : true
const activeForms = new Map<HTMLFormElement, string>()
const trackedFormFields = new WeakMap<HTMLFormElement, Set<string>>()

function randomUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

function storageId(storage: Storage, key: string) {
  try {
    const existing = storage.getItem(key)
    if (existing) return existing
    const created = randomUuid()
    storage.setItem(key, created)
    return created
  } catch {
    return randomUuid()
  }
}

function safePath(path = window.location.pathname) {
  return (path.split(/[?#]/, 1)[0] || '/')
    .replace(/^\/s\/[^/]+(?=\/|$)/, '/s/:token')
    .replace(/\/{2,}/g, '/')
    .slice(0, 255)
}

function referrerHost() {
  if (!document.referrer) return null
  try { return new URL(document.referrer).host.slice(0, 255) || null } catch { return null }
}

function studentHistorySession() {
  try {
    for (const key of ['seda:user-portal-session', 'seda-student-history-session']) {
      const raw = sessionStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { historySession?: unknown; expiresAt?: unknown }
      if (typeof parsed.historySession === 'string' && typeof parsed.expiresAt === 'string' && Date.parse(parsed.expiresAt) > Date.now()) return parsed.historySession
    }
    return null
  } catch { return null }
}

function currentSurveySession() {
  const token = window.location.pathname.match(/^\/s\/([^/]+)/)?.[1]
  if (!token) return null
  try {
    const raw = sessionStorage.getItem(`seda-survey-session:${token}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { surveySession?: unknown; expiresAt?: unknown }
    return typeof parsed.surveySession === 'string' && typeof parsed.expiresAt === 'string' && Date.parse(parsed.expiresAt) > Date.now()
      ? parsed.surveySession : null
  } catch { return null }
}

function addActiveTime() {
  const now = Date.now()
  if (wasVisible) pendingActiveSeconds += Math.max(0, Math.min(300, Math.round((now - lastActiveAt) / 1_000)))
  lastActiveAt = now
}

function analyticsKey(value: string | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return (normalized || fallback).slice(0, 28)
}

function formAnalyticsName(form: HTMLFormElement) {
  return analyticsKey(form.dataset.usageForm || form.id, 'unnamed_form')
}

function recordFormStart(form: HTMLFormElement) {
  if (activeForms.has(form)) return
  const formName = formAnalyticsName(form)
  activeForms.set(form, formName)
  trackUserEvent('interaction', `form_started:${formName}`)
}

function recordAbandonedForms() {
  for (const formName of activeForms.values()) trackUserEvent('interaction', `form_abandoned:${formName}`)
  activeForms.clear()
}

export function trackUserEvent(eventType: UsageEventType, eventName: string, metadata?: UsageMetadata, durationSeconds = 0) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const historySession = studentHistorySession()
  const surveySession = currentSurveySession()
  if (historySession) headers.set('X-Student-History-Session', historySession)
  if (surveySession) headers.set('X-Survey-Session', surveySession)
  const body = {
    clientSessionId: storageId(sessionStorage, clientSessionIdKey),
    anonymousId: storageId(localStorage, anonymousIdKey),
    eventType,
    eventName,
    pagePath: safePath(),
    occurredAt: new Date().toISOString(),
    durationSeconds: Math.max(0, Math.min(300, Math.round(durationSeconds))),
    referrerHost: referrerHost(),
    client: {
      language: navigator.language || null,
      screenWidth: window.screen?.width ?? null,
      screenHeight: window.screen?.height ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    },
    ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
  }
  void fetch('/api/user-usage/events', {
    method: 'POST', credentials: 'include', headers, body: JSON.stringify(body), keepalive: true,
  }).catch(() => undefined)
}

function flushHeartbeat() {
  addActiveTime()
  const seconds = pendingActiveSeconds
  pendingActiveSeconds = 0
  if (seconds > 0) trackUserEvent('heartbeat', 'active_time', undefined, seconds)
}

export function trackPageView(path: string) {
  const normalized = safePath(path)
  if (normalized === lastTrackedPath) return
  if (lastTrackedPath) recordAbandonedForms()
  lastTrackedPath = normalized
  trackUserEvent('page_view', 'view')
}

export function ensureUserUsageTracking() {
  if (trackingStarted) return
  trackingStarted = true
  trackUserEvent('session', 'start')

  window.setInterval(flushHeartbeat, 30_000)
  document.addEventListener('visibilitychange', () => {
    addActiveTime()
    wasVisible = !document.hidden
    if (!wasVisible && pendingActiveSeconds > 0) {
      const seconds = pendingActiveSeconds
      pendingActiveSeconds = 0
      trackUserEvent('heartbeat', 'active_time', undefined, seconds)
    }
  })
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const namedTarget = event.target.closest<HTMLElement>('[data-usage-action]')
    const action = namedTarget?.dataset.usageAction
    if (action) {
      trackUserEvent('interaction', action)
      return
    }
    const interactiveTarget = event.target.closest('button, a[href]')
    if (interactiveTarget) trackUserEvent('interaction', interactiveTarget.tagName === 'A' ? 'link_click' : 'button_click')
  }, { capture: true })
  document.addEventListener('focusin', (event) => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) return
    const form = event.target.form
    if (!form) return
    recordFormStart(form)
    const formName = formAnalyticsName(form)
    const fieldName = analyticsKey(event.target.dataset.usageField || event.target.name || event.target.id || event.target.type, 'field')
    const fields = trackedFormFields.get(form) ?? new Set<string>()
    if (!fields.has(fieldName)) {
      fields.add(fieldName)
      trackedFormFields.set(form, fields)
      trackUserEvent('interaction', `form_field:${formName}:${fieldName}`)
    }
  }, { capture: true })
  document.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement)) return
    const formName = formAnalyticsName(event.target)
    recordFormStart(event.target)
    trackUserEvent('interaction', `form_submitted:${formName}`)
    activeForms.delete(event.target)
  }, { capture: true })
  window.addEventListener('pagehide', () => {
    addActiveTime()
    recordAbandonedForms()
    trackUserEvent('session', 'end', undefined, pendingActiveSeconds)
    pendingActiveSeconds = 0
  })
}
