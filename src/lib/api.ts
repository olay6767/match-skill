import type {
  Activity,
  CreateActivityInput,
  DashboardSummary,
  UpdateActivityInput,
} from '../components/dashboard/types'

type AdminSession = {
  id: number
  email: string
  name?: string
  role: string
}

type ApiErrorPayload = {
  message?: string
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((payload as ApiErrorPayload).message ?? 'ไม่สามารถเชื่อมต่อระบบได้')
  }
  return payload as T
}

export async function loginAdmin(email: string, password: string, remember: boolean) {
  const payload = await apiRequest<{ admin: AdminSession }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember }),
  })
  return payload.admin
}

export async function logoutAdmin() {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
}

export async function getCurrentAdmin() {
  const payload = await apiRequest<{ admin: AdminSession }>('/auth/me')
  return payload.admin
}

export async function getActivities() {
  const payload = await apiRequest<{ activities: Activity[] }>('/activities')
  return payload.activities
}

export async function createActivity(input: CreateActivityInput) {
  const payload = await apiRequest<{ activity: Activity }>('/activities', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.activity
}

export async function updateActivity(id: number, input: UpdateActivityInput) {
  const payload = await apiRequest<{ activity: Activity }>(`/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return payload.activity
}

export async function deleteActivity(id: number) {
  await apiRequest<void>(`/activities/${id}`, { method: 'DELETE' })
}

export async function getDashboardSummary() {
  const payload = await apiRequest<{ summary: DashboardSummary }>('/dashboard/summary')
  return payload.summary
}
