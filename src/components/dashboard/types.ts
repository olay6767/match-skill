export type ActivityStatus = 'processing' | 'completed' | 'draft' | 'open' | 'closed'

export type ActivityFilter = 'all' | 'processing' | 'completed'

export type Activity = {
  id: number
  name: string
  detail: string
  date: string
  activityDate: string | null
  startTime: string | null
  endTime: string | null
  targetGroup: string | null
  preTestDurationMinutes: number
  postTestDurationMinutes: number
  participantLimit: number
  participants: string
  preTest: number
  postTest: number
  status: ActivityStatus
  tone: string
  icon: string
}

export type CreateActivityInput = {
  name: string
  detail: string
  activityDate: string | null
  startTime?: string | null
  endTime?: string | null
  targetGroup?: string | null
  preTestDurationMinutes?: number
  postTestDurationMinutes?: number
  participantLimit: number
  status: ActivityStatus
}

export type UpdateActivityInput = Partial<CreateActivityInput>

export type DashboardSummary = {
  totalActivities: number
  activeActivities: number
  participatingStudents: number
  completedAssessments: number
}

export type DemoAction = (label: string) => void
