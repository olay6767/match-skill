export type StudentPortalSession = {
  historySession: string
  expiresAt: string
  studentCode?: string
  onboardingCompleted?: boolean
}

export type UserProfile = {
  studentCode: string
  firstName: string
  lastName: string
  email: string
  faculty: string | null
  major: string | null
  educationLevel: string | null
  studyYear: number | null
  phone: string | null
}

export type ResponseSummary = { responseId: number; submittedAt: string }

export type JoinedActivity = {
  activityId: number
  activityCode: string | null
  name: string
  detail: string | null
  location: string | null
  imageData: string | null
  startDate: string | null
  endDate: string | null
  activityStatus: 'draft' | 'active' | 'closed' | 'archived'
  preResponse: ResponseSummary | null
  postResponse: ResponseSummary | null
}

export type CompetencyResult = {
  competencyId: number
  name: string
  displayOrder: number
  levelValue: number
}

export type StudentResult = {
  responseId: number
  activityId: number
  activityCode: string | null
  activityName: string
  activityStatus: string
  phase: 'pre' | 'post'
  submittedAt: string
  competencies: CompetencyResult[]
}

export type UserActivityDetail = JoinedActivity & { results: StudentResult[] }

export type UserProgressCompetency = {
  competencyId: number
  name: string
  displayOrder: number
  pre: number | null
  post: number | null
  change: number | null
}

export type UserProgressActivity = {
  activityId: number
  activityCode: string | null
  name: string
  activityDate: string | null
  preAverage: number
  postAverage: number
  change: number
  competencies: UserProgressCompetency[]
}
