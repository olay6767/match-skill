import type { FormTheme } from '../../../shared/formTheme'

export type ActivityStatus = 'draft' | 'active' | 'closed' | 'archived'

export type ActivityFilter = 'all' | ActivityStatus

export type Activity = {
  id: number
  createdAt: string
  code: string
  name: string
  detail: string
  imageData: string | null
  assessmentImageData: string | null
  formTheme: FormTheme
  location: string | null
  startDate: string | null
  endDate: string | null
  preOpenAt: string | null
  preCloseAt: string | null
  postOpenAt: string | null
  postCloseAt: string | null
  surveyTemplateId: number | null
  date: string
  activityDate: string | null
  startTime: string | null
  endTime: string | null
  targetGroup: string | null
  preTestDurationMinutes: number
  postTestDurationMinutes: number
  preTestEnabled: boolean
  postTestEnabled: boolean
  participantLimit: number
  participants: string
  preTest: number
  postTest: number
  preResponses?: number
  postResponses?: number
  status: ActivityStatus
  tone: string
  icon: string
}

export type CreateActivityInput = {
  name: string
  detail: string
  imageData: string | null
  assessmentImageData: string | null
  formTheme: FormTheme
  location: string | null
  startDate: string | null
  surveyTemplateId: number | null
  targetGroup?: string | null
  participantLimit: number
  preTestDurationMinutes: number
  postTestDurationMinutes: number
}

export type UpdateActivityInput = Partial<CreateActivityInput>

export type DashboardSummary = {
  preCount: number
  postCount: number
  pairedCount: number
  completionRate: number | null
}

export type DashboardFilters = { from: string; to: string; activityIds: string[] }

export type CompetencyGrowth = {
  id: number
  code: string
  name: string
  preAverage: number | null
  postAverage: number | null
  combinedAverage: number | null
  preMaximum: number | null
  postMaximum: number | null
  preMinimum: number | null
  postMinimum: number | null
  growth: number | null
  preCount: number
  postCount: number
}

export type RecentActivity = {
  id: number
  name: string
  detail: string
  activityDate: string | null
  status: ActivityStatus
  participantLimit: number
  participantCount: number
  preCount: number
  postCount: number
}

export type ActivityOption = { id: number; name: string }

export type ActivityListFilters = {
  q: string
  status: ActivityFilter
  from: string
  to: string
  targetGroup: string
  page: number
  pageSize: number
}

export type ActivityListResult = {
  activities: Activity[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  targetGroups: string[]
}

export type ActivityQr = {
  id: number
  activityId: number
  phase: 'pre' | 'post'
  url: string
  active: boolean
  revokedAt: string | null
  replacedById: number | null
  createdAt: string
}

export type ActivityQrData = {
  qrCodes: ActivityQr[]
  stats: { preCount: number; postCount: number; pairedCount: number }
}

export type CompetencyLevel = { level: number; title: string; description: string; example: string | null }
export type SurveyCompetency = { id: number; code: string; name: string; definition: string; displayOrder: number; levels: CompetencyLevel[] }
export type SurveyTemplate = { id: number; name: string; version: number; status: 'draft'|'published'|'archived'; updatedAt: string; updatedBy: string|null; responseCount: number; competencies: SurveyCompetency[] }
export type SurveyTemplateSummary = Omit<SurveyTemplate,'competencies'|'responseCount'> & { competencyCount:number }

export type Student = { id:number;studentCode:string;firstName:string;lastName:string;email:string;faculty:string|null;major:string|null;educationLevel:string|null;studyYear:number|null;phone:string|null;pdpaConsentedAt:string|null;activityCount:number;preCount:number;postCount:number;createdAt:string;updatedAt:string }
export type StudentResponse = {id:number;activityId:number;activityCode:string|null;activityName:string;phase:'pre'|'post';submittedAt:string}
export type StudentListResult={students:Student[];pagination:{page:number;pageSize:number;total:number;totalPages:number};filters:{faculties:string[];activities:Array<{id:number;name:string}>};access:{canViewPersonalData:boolean;canEdit:boolean}}

export type DemoAction = (label: string) => void
