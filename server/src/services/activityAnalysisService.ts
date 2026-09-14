import { pool } from '../db/pool.js'

export type ActivityAnalysisMode = 'comparison'
export type ActivityAnalysisMetric = 'score' | 'growth' | 'response' | 'attendees'
export type ActivityAnalysisSort = ActivityAnalysisMetric | 'date' | 'name'
export type ActivityAnalysisDirection = 'asc' | 'desc'

export type ActivityAnalysisFilters = {
  q?: string
  from?: string
  to?: string
  category?: string
  organizer?: string
  status?: 'draft' | 'active' | 'closed' | 'archived'
  evaluation?: 'has' | 'none'
}

export type ParticipantAnalysisFilters = {
  major?: string
  educationLevel?: string
  studyYear?: number
}

export type ParticipantAnalysisFiltersByActivity = Record<string, ParticipantAnalysisFilters>

export type ActivityAnalysisListInput = ActivityAnalysisFilters & {
  page: number
  pageSize: number
}

export type CombinedActivityAnalysisInput = {
  activityIds: number[]
  mode: ActivityAnalysisMode
  metric: ActivityAnalysisMetric
  chartLimit: number
  page: number
  pageSize: number
  sort: ActivityAnalysisSort
  direction: ActivityAnalysisDirection
  filters?: ActivityAnalysisFilters
  participantFiltersByActivity?: ParticipantAnalysisFiltersByActivity
}

type ActivityMetricRow = {
  id: number | string
  name: string
  detail: string | null
  cover_image_data: string | null
  activity_date: Date | string | null
  target_group: string | null
  status: 'draft' | 'active' | 'closed' | 'archived'
  survey_template_id: number | string | null
  participant_limit: number | string
  organizer: string | null
  attendee_count: number | string
  evaluator_count: number | string
  pre_count: number | string
  post_count: number | string
  paired_count: number | string
  assessment_response_count: number | string
  score_sum: number | string
  score_count: number | string
  pre_score_sum: number | string
  pre_score_count: number | string
  post_score_sum: number | string
  post_score_count: number | string
  score_min: number | string | null
  score_max: number | string | null
}

type SummaryRow = {
  selected_count: number | string
  attendee_total: number | string
  evaluator_total: number | string
  assessment_response_total: number | string
  score_sum_total: number | string
  score_count_total: number | string
  pre_count_total: number | string
  post_count_total: number | string
  paired_count_total: number | string
  pre_score_sum_total: number | string
  pre_score_count_total: number | string
  post_score_sum_total: number | string
  post_score_count_total: number | string
  evaluated_activity_count: number | string
  template_count: number | string
}

type GroupRow = { label: string | null; activity_count: number | string; score_sum: number | string; score_count: number | string }
type CompetencyRow = { code: string; name: string; activity_count: number | string; score_average: number | string | null; pre_average: number | string | null; post_average: number | string | null; score_min: number | string | null; score_max: number | string | null; answer_count: number | string; pre_count: number | string; post_count: number | string; paired_count: number | string }

function participantConditions(filters: ParticipantAnalysisFilters | undefined, alias: string) {
  const clauses: string[] = []
  const values: Array<string | number> = []
  if (filters?.major) { clauses.push(`NULLIF(TRIM(${alias}.major), '') = ?`); values.push(filters.major) }
  if (filters?.educationLevel) { clauses.push(`NULLIF(TRIM(${alias}.education_level), '') = ?`); values.push(filters.educationLevel) }
  if (filters?.studyYear !== undefined) { clauses.push(`${alias}.study_year = ?`); values.push(filters.studyYear) }
  return { condition: clauses.join(' AND '), values }
}

function participantConditionsByActivity(activityIds: number[] | undefined, filters: ParticipantAnalysisFiltersByActivity | undefined, studentAlias: string, responseAlias: string) {
  if (!activityIds?.length) return { condition: '', values: [] as Array<string | number> }
  const values: Array<string | number> = []
  const clauses = activityIds.map((activityId) => {
    const participantFilter = participantConditions(filters?.[String(activityId)], studentAlias)
    values.push(activityId, ...participantFilter.values)
    return `(${responseAlias}.activity_id = ?${participantFilter.condition ? ` AND ${participantFilter.condition}` : ''})`
  })
  return { condition: clauses.join(' OR '), values }
}

function metricJoins(activityIds?: number[], filters?: ParticipantAnalysisFiltersByActivity) {
  const responseFilter = participantConditionsByActivity(activityIds, filters, 'response_student', 'sr')
  const assessmentFilter = participantConditionsByActivity(activityIds, filters, 'assessment_student', 'sr')
  return { sql: `
    LEFT JOIN (
    SELECT sr.activity_id,
      COUNT(DISTINCT sr.student_id) AS respondent_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'pre' THEN sr.student_id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'post' THEN sr.student_id END) AS post_count
    FROM survey_responses sr
    JOIN students response_student ON response_student.id = sr.student_id
    ${responseFilter.condition ? `WHERE ${responseFilter.condition}` : ''}
    GROUP BY sr.activity_id
  ) response_counts ON response_counts.activity_id = a.id
  LEFT JOIN (
    SELECT student_scores.activity_id,
      COUNT(*) AS paired_count,
      COALESCE(SUM(student_scores.assessment_response_count), 0) AS assessment_response_count,
      COALESCE(SUM(student_scores.score_sum), 0) AS score_sum,
      COALESCE(SUM(student_scores.score_count), 0) AS score_count,
      COALESCE(SUM(student_scores.pre_score_sum), 0) AS pre_score_sum,
      COALESCE(SUM(student_scores.pre_score_count), 0) AS pre_score_count,
      COALESCE(SUM(student_scores.post_score_sum), 0) AS post_score_sum,
      COALESCE(SUM(student_scores.post_score_count), 0) AS post_score_count,
      MIN(student_scores.student_average) AS score_min,
      MAX(student_scores.student_average) AS score_max
    FROM (
      SELECT sr.activity_id, sr.student_id,
        COUNT(DISTINCT sr.id) AS assessment_response_count,
        COALESCE(SUM(ra.score), 0) AS score_sum,
        COUNT(ra.id) AS score_count,
        COALESCE(SUM(CASE WHEN sr.phase = 'pre' THEN ra.score ELSE 0 END), 0) AS pre_score_sum,
        COUNT(CASE WHEN sr.phase = 'pre' THEN ra.id END) AS pre_score_count,
        COALESCE(SUM(CASE WHEN sr.phase = 'post' THEN ra.score ELSE 0 END), 0) AS post_score_sum,
        COUNT(CASE WHEN sr.phase = 'post' THEN ra.id END) AS post_score_count,
        AVG(ra.score) AS student_average
      FROM survey_responses sr
      JOIN students assessment_student ON assessment_student.id = sr.student_id
      JOIN (
        SELECT activity_id, student_id
        FROM survey_responses
        GROUP BY activity_id, student_id
        HAVING SUM(phase = 'pre') > 0 AND SUM(phase = 'post') > 0
      ) paired ON paired.activity_id = sr.activity_id AND paired.student_id = sr.student_id
      LEFT JOIN response_answers ra ON ra.response_id = sr.id
      ${assessmentFilter.condition ? `WHERE ${assessmentFilter.condition}` : ''}
      GROUP BY sr.activity_id, sr.student_id
    ) student_scores
    GROUP BY student_scores.activity_id
  ) assessment ON assessment.activity_id = a.id
  `, values: [...responseFilter.values, ...assessmentFilter.values] }
}

const activityMetricColumns = `
  a.id, a.name, a.detail, a.cover_image_data, a.activity_date, a.target_group, a.status,
  a.survey_template_id, a.participant_limit, creator.full_name AS organizer,
  COALESCE(response_counts.respondent_count, 0) AS attendee_count,
  COALESCE(assessment.paired_count, 0) AS evaluator_count,
  COALESCE(response_counts.pre_count, 0) AS pre_count,
  COALESCE(response_counts.post_count, 0) AS post_count,
  COALESCE(assessment.paired_count, 0) AS paired_count,
  COALESCE(assessment.assessment_response_count, 0) AS assessment_response_count,
  COALESCE(assessment.score_sum, 0) AS score_sum,
  COALESCE(assessment.score_count, 0) AS score_count,
  COALESCE(assessment.pre_score_sum, 0) AS pre_score_sum,
  COALESCE(assessment.pre_score_count, 0) AS pre_score_count,
  COALESCE(assessment.post_score_sum, 0) AS post_score_sum,
  COALESCE(assessment.post_score_count, 0) AS post_score_count,
  assessment.score_min,
  assessment.score_max
`

function number(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function round(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(decimals))
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : null
}

function date(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function thailandDateStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function filterWhere(filters: ActivityAnalysisFilters, includeIds?: number[]) {
  const clauses: string[] = []
  const values: Array<string | number> = []
  if (includeIds) {
    clauses.push(`a.id IN (${includeIds.map(() => '?').join(', ')})`)
    values.push(...includeIds)
  }
  if (filters.q) { clauses.push('(a.name LIKE ? OR a.detail LIKE ? OR a.code LIKE ?)'); values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`) }
  if (filters.from) { clauses.push('a.activity_date >= ?'); values.push(filters.from) }
  if (filters.to) { clauses.push('a.activity_date <= ?'); values.push(filters.to) }
  if (filters.category) { clauses.push('a.target_group = ?'); values.push(filters.category) }
  if (filters.organizer) { clauses.push('creator.full_name = ?'); values.push(filters.organizer) }
  if (filters.status) { clauses.push('a.status = ?'); values.push(filters.status) }
  const pairedEvaluation = `EXISTS (
    SELECT 1 FROM survey_responses evaluation_response
    WHERE evaluation_response.activity_id = a.id
    GROUP BY evaluation_response.student_id
    HAVING SUM(evaluation_response.phase = 'pre') > 0 AND SUM(evaluation_response.phase = 'post') > 0
  )`
  if (filters.evaluation === 'has') clauses.push(pairedEvaluation)
  if (filters.evaluation === 'none') clauses.push(`NOT ${pairedEvaluation}`)
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values }
}

function selectedBase(filters: ActivityAnalysisFilters, activityIds: number[], participantFiltersByActivity?: ParticipantAnalysisFiltersByActivity) {
  const where = filterWhere(filters, activityIds)
  const metrics = metricJoins(activityIds, participantFiltersByActivity)
  return {
    sql: `
      SELECT ${activityMetricColumns}
      FROM activities a
      LEFT JOIN admins creator ON creator.id = a.created_by
      ${metrics.sql}
      ${where.where}`,
    values: [...metrics.values, ...where.values],
  }
}

function serializeActivity(row: ActivityMetricRow) {
  const attendeeCount = number(row.attendee_count)
  const evaluatorCount = number(row.evaluator_count)
  const preCount = number(row.pre_count)
  const postCount = number(row.post_count)
  const pairedCount = number(row.paired_count)
  const scoreCount = number(row.score_count)
  const preScoreCount = number(row.pre_score_count)
  const postScoreCount = number(row.post_score_count)
  const averageScore = scoreCount ? round(number(row.score_sum) / scoreCount) : null
  const preAverage = preScoreCount ? round(number(row.pre_score_sum) / preScoreCount) : null
  const postAverage = postScoreCount ? round(number(row.post_score_sum) / postScoreCount) : null
  const meanDifference = preAverage === null || postAverage === null ? null : round(postAverage - preAverage)
  return {
    id: number(row.id), name: row.name, detail: row.detail ?? '', imageData: row.cover_image_data,
    date: date(row.activity_date), category: row.target_group ?? 'ไม่ระบุหมวด', organizer: row.organizer ?? 'ไม่ระบุผู้จัด',
    status: row.status, surveyTemplateId: row.survey_template_id === null ? null : number(row.survey_template_id),
    participantLimit: number(row.participant_limit), attendeeCount, evaluatorCount,
    assessmentResponseCount: number(row.assessment_response_count), averageScore,
    preCount, postCount, pairedCount,
    unpairedPreCount: Math.max(0, preCount - pairedCount), unpairedPostCount: Math.max(0, postCount - pairedCount),
    preAverage, postAverage, meanDifference,
    minimumScore: scoreCount && row.score_min !== null ? number(row.score_min) : null,
    maximumScore: scoreCount && row.score_max !== null ? number(row.score_max) : null,
    improvementPercentage: preAverage !== null && postAverage !== null && preAverage !== 0 ? round(((postAverage - preAverage) / preAverage) * 100) : null,
    responseRate: ratio(pairedCount, preCount),
    hasEvaluation: pairedCount > 0,
  }
}

function groupSummary(rows: GroupRow[]) {
  return rows.map((row) => {
    const scoreCount = number(row.score_count)
    return { label: row.label || 'ไม่ระบุ', activityCount: number(row.activity_count), averageScore: scoreCount ? round(number(row.score_sum) / scoreCount) : null }
  })
}

export async function getActivityAnalysisCatalog(input: ActivityAnalysisListInput) {
  const filters: ActivityAnalysisFilters = input
  const query = filterWhere(filters)
  const [countRows, activityRows, categories, organizers] = await Promise.all([
    pool.query<Array<{ total: number | string }>>(`SELECT COUNT(*) AS total FROM activities a LEFT JOIN admins creator ON creator.id = a.created_by ${query.where}`, query.values),
    pool.query<ActivityMetricRow[]>(`
      SELECT ${activityMetricColumns}
      FROM activities a
      LEFT JOIN admins creator ON creator.id = a.created_by
      ${metricJoins().sql}
      ${query.where}
      ORDER BY a.activity_date DESC, a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?`, [...query.values, input.pageSize, (input.page - 1) * input.pageSize]),
    pool.query<Array<{ value: string }>>(`SELECT DISTINCT target_group AS value FROM activities WHERE target_group IS NOT NULL AND target_group <> '' ORDER BY target_group`),
    pool.query<Array<{ value: string }>>(`SELECT DISTINCT full_name AS value FROM admins WHERE full_name IS NOT NULL AND full_name <> '' ORDER BY full_name`),
  ])
  const total = number(countRows[0]?.total)
  const totalPages = total ? Math.ceil(total / input.pageSize) : 0
  const page = totalPages ? Math.min(input.page, totalPages) : 1
  if (page !== input.page && totalPages) return getActivityAnalysisCatalog({ ...input, page })
  return {
    activities: activityRows.map(serializeActivity),
    filters: { categories: categories.map((row) => row.value), organizers: organizers.map((row) => row.value) },
    pagination: { page, pageSize: input.pageSize, total, totalPages },
  }
}

export async function getActivityAnalysisIds(filters: ActivityAnalysisFilters) {
  const query = filterWhere(filters)
  const rows = await pool.query<Array<{ id: number | string; name: string; activity_date: Date | string | null; target_group: string | null; organizer: string | null; status: ActivityMetricRow['status']; has_evaluation: number | boolean | string }>>(`SELECT a.id, a.name, a.activity_date, a.target_group, creator.full_name AS organizer, a.status, EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.activity_id = a.id GROUP BY sr.student_id HAVING SUM(sr.phase = 'pre') > 0 AND SUM(sr.phase = 'post') > 0) AS has_evaluation FROM activities a LEFT JOIN admins creator ON creator.id = a.created_by ${query.where} ORDER BY a.id`, query.values)
  return rows.map((row) => ({ id: number(row.id), name: row.name, date: date(row.activity_date), category: row.target_group ?? 'ไม่ระบุหมวด', organizer: row.organizer ?? 'ไม่ระบุผู้จัด', status: row.status, hasEvaluation: Boolean(Number(row.has_evaluation)) }))
}

function orderBy(sort: ActivityAnalysisSort, direction: ActivityAnalysisDirection) {
  const expression: Record<ActivityAnalysisSort, string> = {
    name: 'name', date: 'activity_date', score: 'CASE WHEN score_count > 0 THEN score_sum / score_count END',
    growth: 'CASE WHEN pre_score_count > 0 AND post_score_count > 0 THEN (post_score_sum / post_score_count) - (pre_score_sum / pre_score_count) END',
    response: 'CASE WHEN pre_count > 0 THEN paired_count / pre_count END', attendees: 'attendee_count',
  }
  return `${expression[sort]} ${direction.toUpperCase()}, name ASC, id ASC`
}

async function selectedActivityNames(activityIds: number[]) {
  const rows = await pool.query<Array<{ id: number | string; name: string }>>(`SELECT id, name FROM activities WHERE id IN (${activityIds.map(() => '?').join(', ')}) ORDER BY name`, activityIds)
  return rows.map((row) => ({ id: number(row.id), name: row.name }))
}

export async function getCombinedActivityAnalysis(input: CombinedActivityAnalysisInput) {
  const activityIds = Array.from(new Set(input.activityIds))
  const filters = input.filters ?? {}
  const base = selectedBase(filters, activityIds, input.participantFiltersByActivity)
  const competencyParticipantFilter = participantConditionsByActivity(activityIds, input.participantFiltersByActivity, 'competency_student', 'sr')
  const summarySql = `WITH selected AS (${base.sql})
    SELECT COUNT(*) AS selected_count, COALESCE(SUM(attendee_count), 0) AS attendee_total,
      COALESCE(SUM(evaluator_count), 0) AS evaluator_total,
      COALESCE(SUM(assessment_response_count), 0) AS assessment_response_total,
      COALESCE(SUM(score_sum), 0) AS score_sum_total, COALESCE(SUM(score_count), 0) AS score_count_total,
      COALESCE(SUM(pre_count), 0) AS pre_count_total, COALESCE(SUM(post_count), 0) AS post_count_total,
      COALESCE(SUM(paired_count), 0) AS paired_count_total,
      COALESCE(SUM(pre_score_sum), 0) AS pre_score_sum_total, COALESCE(SUM(pre_score_count), 0) AS pre_score_count_total,
      COALESCE(SUM(post_score_sum), 0) AS post_score_sum_total, COALESCE(SUM(post_score_count), 0) AS post_score_count_total,
      COALESCE(SUM(evaluator_count > 0), 0) AS evaluated_activity_count,
      COUNT(DISTINCT survey_template_id) AS template_count
    FROM selected`
  const countSql = `WITH selected AS (${base.sql}) SELECT COUNT(*) AS total FROM selected`
  const pageSql = `WITH selected AS (${base.sql}) SELECT * FROM selected ORDER BY ${orderBy(input.sort, input.direction)} LIMIT ? OFFSET ?`
  const topSql = `WITH selected AS (${base.sql}) SELECT * FROM selected ORDER BY ${orderBy(input.metric, 'desc')}${input.chartLimit > 0 ? ' LIMIT ?' : ''}`
  const bottomSql = `WITH selected AS (${base.sql}) SELECT * FROM selected ORDER BY ${orderBy(input.metric, 'asc')}${input.chartLimit > 0 ? ' LIMIT ?' : ''}`
  const scoreTopSql = `WITH selected AS (${base.sql}) SELECT * FROM selected WHERE score_count > 0 ORDER BY ${orderBy('score', 'desc')} LIMIT 1`
  const improvementTopSql = `WITH selected AS (${base.sql}) SELECT * FROM selected WHERE pre_score_count > 0 AND post_score_count > 0 ORDER BY ${orderBy('growth', 'desc')} LIMIT 1`
  const categorySql = `WITH selected AS (${base.sql})
    SELECT target_group AS label, COUNT(*) AS activity_count, COALESCE(SUM(score_sum), 0) AS score_sum, COALESCE(SUM(score_count), 0) AS score_count
    FROM selected GROUP BY target_group ORDER BY score_count DESC, label ASC LIMIT 10`
  const organizerSql = `WITH selected AS (${base.sql})
    SELECT organizer AS label, COUNT(*) AS activity_count, COALESCE(SUM(score_sum), 0) AS score_sum, COALESCE(SUM(score_count), 0) AS score_count
    FROM selected GROUP BY organizer ORDER BY score_count DESC, label ASC LIMIT 10`
  const monthSql = `WITH selected AS (${base.sql})
    SELECT DATE_FORMAT(activity_date, '%Y-%m') AS label, COUNT(*) AS activity_count, COALESCE(SUM(score_sum), 0) AS score_sum, COALESCE(SUM(score_count), 0) AS score_count
    FROM selected WHERE activity_date IS NOT NULL GROUP BY DATE_FORMAT(activity_date, '%Y-%m') ORDER BY label ASC`
  const competencySql = `WITH selected AS (${base.sql})
    SELECT c.code, c.name, COUNT(DISTINCT sr.activity_id) AS activity_count, AVG(ra.score) AS score_average,
      AVG(CASE WHEN sr.phase = 'pre' THEN ra.score END) AS pre_average,
      AVG(CASE WHEN sr.phase = 'post' THEN ra.score END) AS post_average,
      MIN(ra.score) AS score_min, MAX(ra.score) AS score_max, COUNT(ra.id) AS answer_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'pre' THEN sr.id END) AS pre_count,
      COUNT(DISTINCT CASE WHEN sr.phase = 'post' THEN sr.id END) AS post_count,
      COUNT(DISTINCT CONCAT(sr.activity_id, ':', sr.student_id)) AS paired_count
    FROM survey_responses sr
    JOIN students competency_student ON competency_student.id = sr.student_id
    JOIN response_answers ra ON ra.response_id = sr.id
    JOIN competencies c ON c.id = ra.competency_id
    WHERE sr.activity_id IN (SELECT id FROM selected)
      AND EXISTS (
        SELECT 1 FROM survey_responses paired_response
        WHERE paired_response.activity_id = sr.activity_id
          AND paired_response.student_id = sr.student_id
        GROUP BY paired_response.activity_id, paired_response.student_id
        HAVING SUM(paired_response.phase = 'pre') > 0 AND SUM(paired_response.phase = 'post') > 0
      )
      ${competencyParticipantFilter.condition ? `AND ${competencyParticipantFilter.condition}` : ''}
    GROUP BY c.code, c.name
    ORDER BY c.name ASC`
  const participantOptionsSql = `
    SELECT DISTINCT sr.activity_id, NULLIF(TRIM(s.major), '') AS major,
      NULLIF(TRIM(s.education_level), '') AS education_level,
      s.study_year
    FROM survey_responses sr
    JOIN students s ON s.id = sr.student_id
    WHERE sr.activity_id IN (${activityIds.map(() => '?').join(', ')})
      AND EXISTS (
        SELECT 1 FROM survey_responses paired_response
        WHERE paired_response.activity_id = sr.activity_id AND paired_response.student_id = sr.student_id
        GROUP BY paired_response.activity_id, paired_response.student_id
        HAVING SUM(paired_response.phase = 'pre') > 0 AND SUM(paired_response.phase = 'post') > 0
      )`
  const [summaryRows, countRows, pageRows, topRows, bottomRows, scoreTopRows, improvementTopRows, categoryRows, organizerRows, monthRows, competencyRows, selectedActivities, participantOptionRows] = await Promise.all([
    pool.query<SummaryRow[]>(summarySql, base.values),
    pool.query<Array<{ total: number | string }>>(countSql, base.values),
    pool.query<ActivityMetricRow[]>(pageSql, [...base.values, input.pageSize, (input.page - 1) * input.pageSize]),
    pool.query<ActivityMetricRow[]>(topSql, input.chartLimit > 0 ? [...base.values, input.chartLimit] : base.values),
    pool.query<ActivityMetricRow[]>(bottomSql, input.chartLimit > 0 ? [...base.values, input.chartLimit] : base.values),
    pool.query<ActivityMetricRow[]>(scoreTopSql, base.values),
    pool.query<ActivityMetricRow[]>(improvementTopSql, base.values),
    pool.query<GroupRow[]>(categorySql, base.values),
    pool.query<GroupRow[]>(organizerSql, base.values),
    pool.query<GroupRow[]>(monthSql, base.values),
    pool.query<CompetencyRow[]>(competencySql, [...base.values, ...competencyParticipantFilter.values]),
    selectedActivityNames(activityIds),
    pool.query<Array<{ activity_id: number | string; major: string | null; education_level: string | null; study_year: number | string | null }>>(participantOptionsSql, activityIds),
  ])
  const summary = summaryRows[0]
  const attendeeTotal = number(summary?.attendee_total)
  const evaluatorTotal = number(summary?.evaluator_total)
  const scoreCountTotal = number(summary?.score_count_total)
  const preCountTotal = number(summary?.pre_count_total)
  const postCountTotal = number(summary?.post_count_total)
  const pairedCountTotal = number(summary?.paired_count_total)
  const preScoreCountTotal = number(summary?.pre_score_count_total)
  const postScoreCountTotal = number(summary?.post_score_count_total)
  const averagePreScore = preScoreCountTotal ? round(number(summary?.pre_score_sum_total) / preScoreCountTotal) : null
  const averagePostScore = postScoreCountTotal ? round(number(summary?.post_score_sum_total) / postScoreCountTotal) : null
  const meanDifference = averagePreScore === null || averagePostScore === null ? null : round(averagePostScore - averagePreScore)
  const improvementPercentage = averagePreScore === null || averagePostScore === null || averagePreScore === 0 ? null : round(((averagePostScore - averagePreScore) / averagePreScore) * 100)
  const total = number(countRows[0]?.total)
  const totalPages = total ? Math.ceil(total / input.pageSize) : 0
  const page = totalPages ? Math.min(input.page, totalPages) : 1
  if (page !== input.page && totalPages) return getCombinedActivityAnalysis({ ...input, page })
  const categorySummary = groupSummary(categoryRows)
  const organizerSummary = groupSummary(organizerRows)
  const monthSummary = groupSummary(monthRows)
  const bestCategory = categorySummary.filter((row) => row.averageScore !== null).sort((left, right) => right.averageScore! - left.averageScore!)[0]
  const topActivity = scoreTopRows[0] ? serializeActivity(scoreTopRows[0]) : null
  const mostImprovedActivity = improvementTopRows[0] ? serializeActivity(improvementTopRows[0]) : null
  const insights: string[] = []
  if (averagePreScore !== null && averagePostScore !== null && meanDifference !== null) insights.push(`ผู้ตอบที่ทำครบคู่มีคะแนนเฉลี่ยรวมจาก ${averagePreScore.toFixed(2)} ใน Pre-test เป็น ${averagePostScore.toFixed(2)} ใน Post-test (${meanDifference >= 0 ? '+' : ''}${meanDifference.toFixed(2)} คะแนน)`)
  if (topActivity?.averageScore !== null && topActivity?.averageScore !== undefined) insights.push(`กิจกรรมที่มีคะแนนประเมินเฉลี่ยสูงสุดคือ ${topActivity.name} (${topActivity.averageScore.toFixed(2)})`)
  if (mostImprovedActivity?.meanDifference !== null && mostImprovedActivity?.meanDifference !== undefined) insights.push(`กิจกรรมที่มีคะแนนเพิ่มขึ้นมากที่สุดคือ ${mostImprovedActivity.name} (${mostImprovedActivity.meanDifference >= 0 ? '+' : ''}${mostImprovedActivity.meanDifference.toFixed(2)} คะแนน)`)
  if (bestCategory?.averageScore !== null && bestCategory?.averageScore !== undefined) insights.push(`กลุ่มเป้าหมาย ${bestCategory.label} มีคะแนนประเมินเฉลี่ยถ่วงน้ำหนักสูงสุด (${bestCategory.averageScore.toFixed(2)})`)
  if (preCountTotal > pairedCountTotal || postCountTotal > pairedCountTotal) insights.push(`มีข้อมูลที่ยังไม่ครบคู่: Pre-test ${Math.max(0, preCountTotal - pairedCountTotal)} รายการ และ Post-test ${Math.max(0, postCountTotal - pairedCountTotal)} รายการ ซึ่งไม่ถูกนำมาคำนวณผลต่าง`)
  if (!insights.length) insights.push('ยังมีข้อมูลไม่เพียงพอสำหรับการสรุปผลในส่วนนี้')

  return {
    mode: input.mode, selectedActivities,
    participantFilters: {
      selectedByActivity: Object.fromEntries(activityIds.map((activityId) => {
        const selectedFilter = input.participantFiltersByActivity?.[String(activityId)]
        return [activityId, { major: selectedFilter?.major ?? '', educationLevel: selectedFilter?.educationLevel ?? '', studyYear: selectedFilter?.studyYear ?? null }]
      })),
      optionsByActivity: Object.fromEntries(activityIds.map((activityId) => {
        const rows = participantOptionRows.filter((row) => number(row.activity_id) === activityId)
        return [activityId, {
          majors: Array.from(new Set(rows.flatMap((row) => row.major ? [row.major] : []))).sort((left, right) => left.localeCompare(right, 'th')),
          educationLevels: Array.from(new Set(rows.flatMap((row) => row.education_level ? [row.education_level] : []))).sort((left, right) => left.localeCompare(right, 'th')),
          studyYears: Array.from(new Set(rows.flatMap((row) => row.study_year === null ? [] : [number(row.study_year)]))).sort((left, right) => left - right),
        }]
      })),
    },
    summary: {
      selectedCount: number(summary?.selected_count), attendeeTotal, evaluatorTotal,
      assessmentResponseTotal: number(summary?.assessment_response_total),
      preCountTotal, postCountTotal, pairedCountTotal,
      unpairedPreTotal: Math.max(0, preCountTotal - pairedCountTotal), unpairedPostTotal: Math.max(0, postCountTotal - pairedCountTotal),
      responseRate: ratio(pairedCountTotal, preCountTotal), weightedAverageScore: scoreCountTotal ? round(number(summary?.score_sum_total) / scoreCountTotal) : null,
      averagePreScore, averagePostScore, meanDifference, improvementPercentage,
      scoreCount: scoreCountTotal, commentsCount: 0,
      noEvaluationCount: Math.max(0, number(summary?.selected_count) - number(summary?.evaluated_activity_count)),
    },
    highlights: {
      highestScoreActivity: topActivity ? { id: topActivity.id, name: topActivity.name, value: topActivity.averageScore } : null,
      mostImprovedActivity: mostImprovedActivity ? { id: mostImprovedActivity.id, name: mostImprovedActivity.name, value: mostImprovedActivity.meanDifference } : null,
    },
    insights, categorySummary, organizerSummary, monthSummary,
    commonCompetencies: competencyRows.map((row) => {
      const preAverage = row.pre_average === null ? null : round(number(row.pre_average))
      const postAverage = row.post_average === null ? null : round(number(row.post_average))
      return { code: row.code, name: row.name, activityCount: number(row.activity_count), averageScore: row.score_average === null ? null : round(number(row.score_average)), preAverage, postAverage, meanDifference: preAverage === null || postAverage === null ? null : round(postAverage - preAverage), minimumScore: row.score_min === null ? null : number(row.score_min), maximumScore: row.score_max === null ? null : number(row.score_max), answerCount: number(row.answer_count), preCount: number(row.pre_count), postCount: number(row.post_count), pairedCount: number(row.paired_count) }
    }),
    comparison: {
      items: pageRows.map(serializeActivity), top: topRows.map(serializeActivity), bottom: bottomRows.map(serializeActivity),
      pagination: { page, pageSize: input.pageSize, total, totalPages },
      warning: number(summary?.template_count) > 1 ? 'บางกิจกรรมใช้แบบประเมินต่างกัน จึงแสดงเฉพาะข้อมูลที่สามารถเปรียบเทียบร่วมกันได้' : null,
    },
  }
}

export async function createCombinedActivityAnalysisExport(input: CombinedActivityAnalysisInput) {
  const report = await getCombinedActivityAnalysis({ ...input, page: 1, pageSize: Math.max(input.activityIds.length, 1), chartLimit: 0 })
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SEDA Activity Evaluation System'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Activity Analysis')
  sheet.columns = [{ width: 34 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 15 }, { width: 14 }]
  sheet.mergeCells('A1:I1')
  sheet.getCell('A1').value = 'รายงานเปรียบเทียบกิจกรรม'
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF203D63' } }
  sheet.getCell('A1').alignment = { horizontal: 'center' }
  sheet.getCell('A2').value = 'สร้างเมื่อ'
  sheet.getCell('B2').value = new Date()
  sheet.getCell('B2').numFmt = 'yyyy-mm-dd hh:mm'
  sheet.getCell('A3').value = 'รูปแบบการวิเคราะห์'
  sheet.getCell('B3').value = 'เปรียบเทียบกิจกรรม'
  sheet.getCell('A4').value = 'ตัวกรองที่ใช้'
  sheet.mergeCells('B4:I4')
  const filterLabels: Record<string, string> = { q: 'คำค้น', from: 'ตั้งแต่', to: 'ถึง', category: 'กลุ่มเป้าหมาย', organizer: 'ผู้จัด', status: 'สถานะ', evaluation: 'ข้อมูลประเมิน' }
  const activeFilters = Object.entries(input.filters ?? {}).filter(([, value]) => Boolean(value)).map(([key, value]) => `${filterLabels[key] ?? key}: ${value}`)
  const participantFilterLabels: Record<string, string> = { major: 'สาขาวิชา', educationLevel: 'ระดับการศึกษา', studyYear: 'ชั้นปี / กลุ่มรุ่น' }
  const activityNames = new Map(report.selectedActivities.map((activity) => [String(activity.id), activity.name]))
  Object.entries(input.participantFiltersByActivity ?? {}).forEach(([activityId, filters]) => {
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '').forEach(([key, value]) => {
      activeFilters.push(`${activityNames.get(activityId) ?? `กิจกรรม #${activityId}`} · ${participantFilterLabels[key] ?? key}: ${value}`)
    })
  })
  sheet.getCell('B4').value = activeFilters.length ? activeFilters.join(' | ') : 'ไม่ใช้ตัวกรอง'
  sheet.getCell('B4').alignment = { wrapText: true }
  let row = 6
  sheet.mergeCells(`A${row}:I${row}`)
  sheet.getCell(row, 1).value = `รายการกิจกรรมที่เลือกทั้งหมด (${report.selectedActivities.length} กิจกรรม)`
  sheet.getCell(row, 1).font = { bold: true, color: { argb: 'FF203D63' } }
  row += 1
  sheet.getRow(row).values = ['ลำดับ', 'ชื่อกิจกรรม']
  sheet.getRow(row).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5E8AB6' } }
  report.selectedActivities.forEach((activity, index) => { row += 1; sheet.getRow(row).values = [index + 1, activity.name] })
  row += 2
  sheet.getCell(row, 1).value = 'KPI Summary'
  sheet.getCell(row, 1).font = { bold: true, color: { argb: 'FF203D63' } }
  row += 1
  const kpis: Array<[string, number | null]> = [
    ['ผู้เข้าร่วมรวม', report.summary.attendeeTotal], ['ผู้ตอบแบบประเมิน', report.summary.evaluatorTotal],
    ['อัตราการตอบ (%)', report.summary.responseRate], ['คะแนนประเมินเฉลี่ยถ่วงน้ำหนัก', report.summary.weightedAverageScore],
  ]
  kpis.forEach(([label, value]) => { sheet.getCell(row, 1).value = label; sheet.getCell(row, 2).value = value; row += 1 })
  row += 1
  const tableHeaderRow = row
  sheet.getRow(tableHeaderRow).values = ['กิจกรรม', 'หมวด/กลุ่มเป้าหมาย', 'ผู้จัด', 'วันที่จัด', 'ผู้เข้าร่วม', 'ผู้ตอบแบบประเมิน', 'คะแนนต่ำสุด', 'คะแนนเฉลี่ย', 'คะแนนสูงสุด']
  const header = sheet.getRow(tableHeaderRow)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF385F8D' } }
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  sheet.views = [{ state: 'frozen', ySplit: tableHeaderRow }]
  report.comparison.items.forEach((item) => sheet.addRow([item.name, item.category, item.organizer, item.date, item.attendeeCount, item.evaluatorCount, item.minimumScore, item.averageScore, item.maximumScore]))
  for (let dataRow = tableHeaderRow + 1; dataRow <= sheet.rowCount; dataRow += 1) {
    sheet.getCell(dataRow, 7).numFmt = '0.00'
    sheet.getCell(dataRow, 8).numFmt = '0.00'
    sheet.getCell(dataRow, 9).numFmt = '0.00'
  }
  sheet.getRow(sheet.rowCount + 2).getCell(1).value = 'ข้อสรุปสำคัญ'
  sheet.getRow(sheet.rowCount).font = { bold: true, color: { argb: 'FF203D63' } }
  report.insights.forEach((insight) => sheet.addRow([insight]))
  return { filename: `activity-${report.mode}-${thailandDateStamp()}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) }
}
