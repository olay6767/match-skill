import type {
  Activity,
  CreateActivityInput,
  DashboardSummary,
  DashboardFilters,
  CompetencyGrowth,
  RecentActivity,
  ActivityOption,
  ActivityListFilters,
  ActivityListResult,
  ActivityStatus,
  ActivityQrData,
  ActivityQr,
  SurveyTemplate,
  SurveyTemplateSummary,
  CompetencyLevel,
  Student,
  StudentListResult,
  StudentResponse,
  UpdateActivityInput,
} from '../admin/components/dashboard/types'
import type { FormTheme } from '../shared/formTheme'

type AdminSession = {
  id: number
  email: string
  name?: string
  role: string
}

type ApiErrorPayload = {
  message?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | undefined
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  unauthorizedHandler = handler
}

async function apiRequest<T>(path: string, init?: RequestInit, handleUnauthorized = true): Promise<T> {
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
    if (response.status === 401 && handleUnauthorized) unauthorizedHandler?.()
    throw new ApiError((payload as ApiErrorPayload).message ?? 'ไม่สามารถเชื่อมต่อระบบได้', response.status)
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
  const payload = await apiRequest<{ admin: AdminSession }>('/auth/me', undefined, false)
  return payload.admin
}

export async function requestPasswordReset(email: string) {
  return apiRequest<{ message: string; resetUrl?: string }>('/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ token, password }),
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/auth/change-password', {
    method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function getActivities() {
  const payload = await apiRequest<{ activities: Activity[] }>('/activities')
  return payload.activities
}

export async function getActivity(id: number) {
  const payload = await apiRequest<{ activity: Activity }>(`/activities/${id}`)
  return payload.activity
}

export async function getActiveSurveyTemplates() {
  const payload = await apiRequest<{ templates: Array<{ id: number; name: string }> }>('/activities/meta/templates')
  return payload.templates
}

export async function getActivityQr(activityId: number) {
  return apiRequest<ActivityQrData>(`/activities/${activityId}/qr`)
}

export async function generateActivityQr(activityId: number, phase: 'pre' | 'post') {
  const payload = await apiRequest<{ qrCode: ActivityQr }>(`/activities/${activityId}/qr`, { method: 'POST', body: JSON.stringify({ phase }) })
  return payload.qrCode
}

export async function regenerateActivityQr(activityId: number, qrId: number) {
  const payload = await apiRequest<{ qrCode: ActivityQr }>(`/activities/${activityId}/qr/${qrId}/regenerate`, { method: 'POST' })
  return payload.qrCode
}

export async function getPublicSurveyStatus(token: string) {
  return apiRequest<PublicSurveyInfo>(`/public/surveys/${token}`, undefined, false)
}

export type PublicSurveyInfo = {
  activity: { id: number; name: string; imageData: string | null; formTheme: FormTheme }
  phase: 'pre' | 'post'
  status: 'not_open' | 'open' | 'closed' | 'archived'
}

export type IdentifyPublicSurveyInput = {
  studentCode: string
  firstName?: string
  lastName?: string
  faculty?: string
  major?: string
  studyYear?: number
  email?: string
  phone?: string
  pdpaConsented?: boolean
}

export type SurveySessionStartResult = {
  next: 'assessment' | 'result'
  alreadySubmitted: boolean
  resumed: boolean
  surveySession: string
  expiresAt: string
}

export type IdentifyPublicSurveyResult = SurveySessionStartResult | { next: 'registration' }

export async function identifyPublicSurvey(token: string, input: IdentifyPublicSurveyInput) {
  return apiRequest<IdentifyPublicSurveyResult>(`/public/surveys/${token}/identify`, {
    method: 'POST',
    body: JSON.stringify(input),
  }, false)
}

export type PublicSurveyQuestion = {
  questionId: number
  competencyId: number
  name: string
  definition: string
  displayOrder: number
  levels: Array<{ levelValue: number; title: string; description: string; example: string | null }>
}

export type PublicSurveyQuestions = {
  activity: { id: number; name: string; imageData: string | null; formTheme: FormTheme }
  phase: 'pre' | 'post'
  questions: PublicSurveyQuestion[]
  draftAnswers: Array<{ questionId: number; competencyId: number; levelValue: number }>
}

export type SubmitPublicSurveyInput = {
  surveySession: string
  answers: Array<{ questionId: number; competencyId: number; levelValue: number }>
}

export async function getPublicSurveyQuestions(token: string, surveySession: string) {
  return apiRequest<PublicSurveyQuestions>(`/public/surveys/${token}/questions`, {
    headers: { 'X-Survey-Session': surveySession },
  }, false)
}

export async function savePublicSurveyDraft(token: string, input: { surveySession: string; questionId: number; competencyId: number; levelValue: number }) {
  await apiRequest<void>(`/public/surveys/${token}/draft`, {
    method: 'PUT',
    body: JSON.stringify(input),
    keepalive: true,
  }, false)
}

export async function submitPublicSurvey(token: string, input: SubmitPublicSurveyInput) {
  return apiRequest<{ responseId: number; next: 'result' }>(`/public/surveys/${token}/responses`, {
    method: 'POST',
    body: JSON.stringify(input),
  }, false)
}

export type PublicSurveyResult = {
  activity: { id: number; name: string; imageData: string | null; formTheme: FormTheme }
  phase: 'pre' | 'post'
  submittedAt: string
  competencies: Array<{ competencyId: number; name: string; displayOrder: number; levelValue: number }>
  comparison: {
    pre: Array<{ competencyId: number; name: string; displayOrder: number; levelValue: number }>
    post: Array<{ competencyId: number; name: string; displayOrder: number; levelValue: number }>
  } | null
}

export async function getPublicSurveyResult(token: string, surveySession: string) {
  return apiRequest<PublicSurveyResult>(`/public/surveys/${token}/result`, {
    headers: { 'X-Survey-Session': surveySession },
  }, false)
}

export async function createPublicSurveyPortalSession(token: string, surveySession: string) {
  return apiRequest<{ historySession: string; expiresAt: string }>(`/public/surveys/${token}/portal-session`, {
    method: 'POST',
    headers: { 'X-Survey-Session': surveySession },
  }, false)
}

export type StudentHistoryItem = {
  responseId: number
  activityId: number
  activityCode: string | null
  activityName: string
  activityStatus: string
  phase: 'pre' | 'post'
  status: 'submitted'
  submittedAt: string
}

export type StudentHistoryResponse = StudentHistoryItem & {
  competencies: Array<{ competencyId: number; name: string; displayOrder: number; levelValue: number }>
}

export async function requestStudentHistoryOtp(input: { studentCode: string; email: string }) {
  return apiRequest<{ message: string; developmentOtp?: string }>('/student-history/request-otp', {
    method: 'POST',
    body: JSON.stringify(input),
  }, false)
}

export async function verifyStudentHistoryOtp(input: { studentCode: string; email: string; otp: string }) {
  return apiRequest<{ historySession: string; expiresAt: string }>('/student-history/verify-otp', {
    method: 'POST',
    body: JSON.stringify(input),
  }, false)
}

export async function getStudentHistory(historySession: string) {
  return apiRequest<{ history: StudentHistoryItem[] }>('/student-history', {
    headers: { 'X-Student-History-Session': historySession },
  }, false)
}

export async function getStudentHistoryResponse(responseId: number, historySession: string) {
  return apiRequest<{ response: StudentHistoryResponse }>(`/student-history/responses/${responseId}`, {
    headers: { 'X-Student-History-Session': historySession },
  }, false)
}

export async function getSurveyTemplates() { const payload=await apiRequest<{templates:SurveyTemplateSummary[]}>('/survey-templates'); return payload.templates }
export async function getSurveyTemplate(id:number) { const payload=await apiRequest<{template:SurveyTemplate}>(`/survey-templates/${id}`); return payload.template }
export async function cloneSurveyTemplate(id:number) { return apiRequest<{templateId:number}>(`/survey-templates/${id}/clone`,{method:'POST'}) }
export async function activateSurveyTemplate(id:number) { return apiRequest<{message:string}>(`/survey-templates/${id}/activate`,{method:'POST'}) }
export async function deleteSurveyTemplate(id:number) { return apiRequest<void>(`/survey-templates/${id}`,{method:'DELETE'}) }
export async function updateCompetency(id:number,input:{name:string;definition:string}) { return apiRequest<{message:string}>(`/competencies/${id}`,{method:'PATCH',body:JSON.stringify(input)}) }
export async function updateCompetencyLevel(id:number,level:CompetencyLevel) { return apiRequest<{message:string}>(`/competencies/${id}/levels/${level.level}`,{method:'PATCH',body:JSON.stringify(level)}) }

export async function getStudents(filters:{q:string;faculty:string;activityId:string;page:number;pageSize:number}){const p=new URLSearchParams({page:String(filters.page),pageSize:String(filters.pageSize)});if(filters.q)p.set('q',filters.q);if(filters.faculty)p.set('faculty',filters.faculty);if(filters.activityId)p.set('activityId',filters.activityId);return apiRequest<StudentListResult>(`/students?${p}`)}
export async function getStudent(id:number){const p=await apiRequest<{student:Student}>(`/students/${id}`);return p.student}
export async function updateStudent(id:number,input:Partial<Student>){const p=await apiRequest<{student:Student}>(`/students/${id}`,{method:'PATCH',body:JSON.stringify(input)});return p.student}
export async function getStudentResponses(id:number){const p=await apiRequest<{responses:StudentResponse[]}>(`/students/${id}/responses`);return p.responses}

export async function getActivityList(filters: ActivityListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page), pageSize: String(filters.pageSize),
  })
  if (filters.q) params.set('q', filters.q)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.targetGroup) params.set('targetGroup', filters.targetGroup)
  return apiRequest<ActivityListResult>(`/activities?${params}`)
}

export async function updateActivityStatus(id: number, status: ActivityStatus) {
  const payload = await apiRequest<{ activity: Activity }>(`/activities/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })
  return payload.activity
}

export async function updateActivityPhase(id: number, phase: 'pre' | 'post', input: { enabled?: boolean; closeAt?: string | null }) {
  const payload = await apiRequest<{ activity: Activity }>(`/activities/${id}/phases/${phase}`, {
    method: 'PATCH', body: JSON.stringify(input),
  })
  return payload.activity
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

function dashboardQuery(filters: DashboardFilters) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.activityIds.length) params.set('activityIds', filters.activityIds.join(','))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getDashboardSummary(filters: DashboardFilters) {
  const payload = await apiRequest<{ summary: DashboardSummary }>(`/dashboard/summary${dashboardQuery(filters)}`)
  return payload.summary
}

export async function getCompetencyGrowth(filters: DashboardFilters) {
  const payload = await apiRequest<{ competencies: CompetencyGrowth[] }>(`/dashboard/competency-growth${dashboardQuery(filters)}`)
  return payload.competencies
}

export async function getRecentActivities(page = 1, pageSize = 5, filters: DashboardFilters = { from: '', to: '', activityIds: [] }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.activityIds.length) params.set('activityIds', filters.activityIds.join(','))
  return apiRequest<{
    activities: RecentActivity[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>(`/dashboard/recent-activities?${params}`)
}

export async function getDashboardActivityOptions() {
  const payload = await apiRequest<{ activities: ActivityOption[] }>('/dashboard/activities')
  return payload.activities
}

export type AnalyticsFilters = {
  from: string
  to: string
  activityId: string
  compareActivityId: string
  faculty: string
  educationLevel: string
}

export type AnalyticsOverview = {
  preCount: number
  postCount: number
  pairedCount: number
  studentCount: number
  completionRate: number | null
}

export type AnalyticsFilterOptions = {
  activities: Array<{ id: number; name: string }>
  faculties: string[]
  educationLevels: string[]
}

export type AnalyticsCompetency = {
  id: number
  code: string
  name: string
  displayOrder: number
  preAverage: number | null
  postAverage: number | null
  growth: number | null
  preCount: number
  postCount: number
  pairedCount: number
}

export type AnalyticsBreakdown = {
  label: string
  studentCount: number
  preCount: number
  postCount: number
  pairedCount: number
}

export type AnalyticsStudent = {
  id: number
  studentCode: string
  firstName: string
  lastName: string
  faculty: string | null
  educationLevel: string | null
  activityCount: number
  preCount: number
  postCount: number
  preAverage: number | null
  postAverage: number | null
  growth: number | null
  latestSubmittedAt: string
}

function analyticsQuery(filters: AnalyticsFilters, page?: number, pageSize?: number) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.activityId) params.set('activityId', filters.activityId)
  if (filters.faculty) params.set('faculty', filters.faculty)
  if (filters.educationLevel) params.set('educationLevel', filters.educationLevel)
  if (page) params.set('page', String(page))
  if (pageSize) params.set('pageSize', String(pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getAnalyticsOverview(filters: AnalyticsFilters) {
  return apiRequest<{ overview: AnalyticsOverview; filters: AnalyticsFilterOptions }>(`/analytics/overview${analyticsQuery(filters)}`)
}

export async function getAnalyticsCompetencies(filters: AnalyticsFilters) {
  return apiRequest<{ competencies: AnalyticsCompetency[] }>(`/analytics/competencies${analyticsQuery(filters)}`)
}

export async function getAnalyticsParticipants(filters: AnalyticsFilters) {
  return apiRequest<{ faculties: AnalyticsBreakdown[]; educationLevels: AnalyticsBreakdown[] }>(`/analytics/participants${analyticsQuery(filters)}`)
}

export async function getAnalyticsStudents(filters: AnalyticsFilters, page: number, pageSize = 20) {
  return apiRequest<{ students: AnalyticsStudent[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/analytics/students${analyticsQuery(filters, page, pageSize)}`)
}

export type FinalAnalysisPhase = 'pre' | 'post'
export type FinalAnalysisFilters = { activityId: number; faculties: string[]; majors: string[]; educationLevels: string[]; studyYears: string[]; phases: FinalAnalysisPhase[] }
export type DescriptiveStatistics = { n: number; mean: number | null; sd: number | null; minimum: number | null; maximum: number | null }
export type FinalAnalysisGroup = {
  studentCount: number
  pairedCount: number
  pre: DescriptiveStatistics
  post: DescriptiveStatistics
  pairedPreMean: number | null
  pairedPostMean: number | null
  meanDifference: number | null
  improvementPercentage: number | null
  improved: { count: number; percentage: number | null }
  unchanged: { count: number; percentage: number | null }
  decreased: { count: number; percentage: number | null }
  rankingScore: number | null
}
export type FinalAnalysisFaculty = FinalAnalysisGroup & { faculty: string }
export type FinalAnalysisMajor = FinalAnalysisGroup & { major: string }
export type FinalAnalysisResult = {
  filters: {
    selected: { faculties: string[]; majors: string[]; educationLevels: string[]; studyYears: number[]; phases: FinalAnalysisPhase[] }
    options: { faculties: string[]; majors: string[]; educationLevels: string[]; studyYears: number[] }
  }
  scale: { minimum: number; maximum: number }
  summary: {
    respondentCount: number
    preMean: number | null
    postMean: number | null
    pairedCount: number
    pairedPreMean: number | null
    pairedPostMean: number | null
    meanDifference: number | null
    improvementPercentage: number | null
    maximum: number | null
    minimum: number | null
    sampleSd: number | null
  }
  descriptive: { pre: DescriptiveStatistics; post: DescriptiveStatistics }
  paired: {
    enabled: boolean
    count: number
    pre: DescriptiveStatistics
    post: DescriptiveStatistics
    difference: DescriptiveStatistics
    improved: { count: number; percentage: number | null }
    unchanged: { count: number; percentage: number | null }
    decreased: { count: number; percentage: number | null }
    unpairedPreCount: number
    unpairedPostCount: number
  }
  faculties: FinalAnalysisFaculty[]
  majors: FinalAnalysisMajor[]
  distribution: Array<{ from: number; to: number; label: string; preCount: number; postCount: number }>
  boxPlot: {
    pre: { n: number; minimum: number | null; q1: number | null; median: number | null; q3: number | null; maximum: number | null; outliers: number[] }
    post: { n: number; minimum: number | null; q1: number | null; median: number | null; q3: number | null; maximum: number | null; outliers: number[] }
  }
  insights: string[]
}

export async function getFinalAnalysis(filters: FinalAnalysisFilters) {
  const params = new URLSearchParams({ activityId: String(filters.activityId) })
  filters.faculties.forEach((faculty) => params.append('faculty', faculty))
  filters.majors.forEach((major) => params.append('major', major))
  filters.educationLevels.forEach((level) => params.append('educationLevel', level))
  filters.studyYears.forEach((year) => params.append('studyYear', year))
  filters.phases.forEach((phase) => params.append('phase', phase))
  return apiRequest<FinalAnalysisResult>(`/analytics/final-analysis?${params}`)
}

export type ActivityAnalysisFilters = {
  q: string
  from: string
  to: string
  category: string
  organizer: string
  status: '' | ActivityStatus
  evaluation: '' | 'has' | 'none'
}

export type ActivityAnalysisCard = {
  id: number
  name: string
  detail: string
  imageData: string | null
  date: string | null
  category: string
  organizer: string
  status: ActivityStatus
  surveyTemplateId: number | null
  participantLimit: number
  attendeeCount: number
  evaluatorCount: number
  assessmentResponseCount: number
  averageScore: number | null
  minimumScore: number | null
  maximumScore: number | null
  preCount: number
  postCount: number
  pairedCount: number
  unpairedPreCount: number
  unpairedPostCount: number
  preAverage: number | null
  postAverage: number | null
  meanDifference: number | null
  improvementPercentage: number | null
  responseRate: number | null
  hasEvaluation: boolean
}

export type ActivityAnalysisCatalogResult = {
  activities: ActivityAnalysisCard[]
  filters: { categories: string[]; organizers: string[] }
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export type CombinedAnalysisMode = 'comparison'
export type CombinedAnalysisMetric = 'score' | 'growth' | 'response' | 'attendees'
export type CombinedAnalysisSort = CombinedAnalysisMetric | 'date' | 'name'
export type CombinedParticipantFilters = { majors?: string[]; educationLevel?: string; studyYear?: number }
export type CombinedParticipantFiltersByActivity = Record<string, CombinedParticipantFilters>
export type CombinedAnalysisInput = {
  activityIds: number[]
  mode: CombinedAnalysisMode
  metric: CombinedAnalysisMetric
  chartLimit: number
  page: number
  pageSize: number
  sort: CombinedAnalysisSort
  direction: 'asc' | 'desc'
  filters?: Partial<ActivityAnalysisFilters>
  participantFiltersByActivity?: CombinedParticipantFiltersByActivity
}

export type CombinedAnalysisReport = {
  mode: CombinedAnalysisMode
  selectedActivities: Array<{ id: number; name: string }>
  participantFilters: {
    selectedByActivity: Record<string, { majors: string[]; educationLevel: string; studyYear: number | null }>
    optionsByActivity: Record<string, { majors: string[]; educationLevels: string[]; studyYears: number[] }>
  }
  summary: {
    selectedCount: number
    attendeeTotal: number
    evaluatorTotal: number
    assessmentResponseTotal: number
    preCountTotal: number
    postCountTotal: number
    pairedCountTotal: number
    unpairedPreTotal: number
    unpairedPostTotal: number
    responseRate: number | null
    weightedAverageScore: number | null
    averagePreScore: number | null
    averagePostScore: number | null
    meanDifference: number | null
    improvementPercentage: number | null
    scoreCount: number
    commentsCount: number
    noEvaluationCount: number
  }
  highlights: {
    highestScoreActivity: { id: number; name: string; value: number | null } | null
    mostImprovedActivity: { id: number; name: string; value: number | null } | null
  }
  insights: string[]
  categorySummary: Array<{ label: string; activityCount: number; averageScore: number | null }>
  organizerSummary: Array<{ label: string; activityCount: number; averageScore: number | null }>
  monthSummary: Array<{ label: string; activityCount: number; averageScore: number | null }>
  facultyStatistics: Array<{ faculty: string; pre: DescriptiveStatistics; post: DescriptiveStatistics }>
  commonCompetencies: Array<{ code: string; name: string; activityCount: number; averageScore: number | null; preAverage: number | null; postAverage: number | null; meanDifference: number | null; minimumScore: number | null; maximumScore: number | null; answerCount: number; preCount: number; postCount: number; pairedCount: number }>
  comparison: {
    items: ActivityAnalysisCard[]
    top: ActivityAnalysisCard[]
    bottom: ActivityAnalysisCard[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
    warning: string | null
  }
}

function activityAnalysisQuery(filters: Partial<ActivityAnalysisFilters> & { page?: number; pageSize?: number }) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.category) params.set('category', filters.category)
  if (filters.organizer) params.set('organizer', filters.organizer)
  if (filters.status) params.set('status', filters.status)
  if (filters.evaluation) params.set('evaluation', filters.evaluation)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getActivityAnalysisCatalog(filters: ActivityAnalysisFilters, page = 1, pageSize = 24) {
  return apiRequest<ActivityAnalysisCatalogResult>(`/analytics/activity-selection${activityAnalysisQuery({ ...filters, page, pageSize })}`)
}

export async function getActivityAnalysisIds(filters: ActivityAnalysisFilters) {
  const payload = await apiRequest<{ ids: Array<Pick<ActivityAnalysisCard, 'id' | 'name' | 'date' | 'category' | 'organizer' | 'status' | 'hasEvaluation'>> }>(`/analytics/activity-selection/ids${activityAnalysisQuery(filters)}`)
  return payload.ids
}

export async function getCombinedActivityAnalysis(input: CombinedAnalysisInput) {
  return apiRequest<CombinedAnalysisReport>('/analytics/combined', { method: 'POST', body: JSON.stringify(input) })
}

export async function downloadCombinedActivityAnalysis(input: CombinedAnalysisInput) {
  const response = await fetch('/api/analytics/combined-export', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload
    throw new ApiError(payload.message ?? 'ไม่สามารถสร้างรายงานวิเคราะห์กิจกรรมได้', response.status)
  }
  const encodedName = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  return { blob: await response.blob(), filename: encodedName ? decodeURIComponent(encodedName) : 'activity-analysis.xlsx' }
}

export type ReportExportFilters = { activityId: string }
export type ReportExportType = 'raw' | 'summary' | 'final' | 'combined_analysis'
export type ExportHistoryItem = {
  id: number
  type: ReportExportType
  fileName: string
  activityCode: string | null
  activityName: string | null
  adminEmail: string
  filters: { activityId: number }
  createdAt: string
}

export async function downloadReport(type: ReportExportType, filters: ReportExportFilters) {
  const endpoint = type === 'raw' ? 'raw-export' : type === 'final' ? 'final-export' : 'summary-export'
  const response = await fetch(`/api/reports/${endpoint}`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filters),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload
    throw new ApiError(payload.message ?? 'ไม่สามารถสร้างไฟล์รายงานได้', response.status)
  }
  const encodedName = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  return { blob: await response.blob(), filename: encodedName ? decodeURIComponent(encodedName) : type === 'final' ? 'Final.xlsx' : `SEDA_${type}_report.xlsx` }
}

export async function getExportHistory(page = 1, pageSize = 20) {
  return apiRequest<{ history: ExportHistoryItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/reports/export-history?page=${page}&pageSize=${pageSize}`)
}

export type StaffRole = 'super_admin' | 'staff'
export type StaffAccount = { id: number; email: string; fullName: string; role: StaffRole; isActive: boolean; createdAt: string; updatedAt: string }
export type StaffAuditItem = { id: number; action: 'created' | 'role_changed' | 'enabled' | 'disabled' | 'password_reset'; actorEmail: string; targetEmail: string; details: Record<string, unknown> | null; createdAt: string }

export async function getStaff() { const payload = await apiRequest<{ staff: StaffAccount[] }>('/staff'); return payload.staff }
export async function getStaffAuditHistory() { const payload = await apiRequest<{ history: StaffAuditItem[] }>('/staff/audit-history'); return payload.history }
export async function createStaff(input: { fullName: string; email: string; password: string; role: StaffRole }) { const payload = await apiRequest<{ staff: StaffAccount }>('/staff', { method: 'POST', body: JSON.stringify(input) }); return payload.staff }
export async function updateStaff(id: number, input: { role?: StaffRole; isActive?: boolean }) { const payload = await apiRequest<{ staff: StaffAccount }>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); return payload.staff }
export async function resetStaffPassword(id: number, newPassword: string) { return apiRequest<{ message: string }>(`/staff/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }) }
