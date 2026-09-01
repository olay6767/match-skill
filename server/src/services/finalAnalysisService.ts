import { pool } from '../db/pool.js'

export type FinalAnalysisPhase = 'pre' | 'post'

export type FinalAnalysisFilters = {
  activityId: number
  majors: string[]
  educationLevels: string[]
  studyYears: number[]
  phases: FinalAnalysisPhase[]
}

type ResponseScoreRow = {
  response_id: number | string
  student_id: number | string
  student_code: string
  major: string | null
  education_level: string | null
  study_year: number | string | null
  phase: 'pre' | 'post'
  score: number | string
  answer_count: number | string
}

type ScaleRow = { minimum_score: number | string | null; maximum_score: number | string | null }

type ScoreEntry = {
  responseId: number
  studentId: number
  studentCode: string
  major: string
  educationLevel: string | null
  studyYear: number | null
  phase: 'pre' | 'post'
  score: number
  answerCount: number
}

export type DescriptiveStatistics = {
  n: number
  mean: number | null
  sd: number | null
  minimum: number | null
  maximum: number | null
}

type BoxPlotStatistics = {
  n: number
  minimum: number | null
  q1: number | null
  median: number | null
  q3: number | null
  maximum: number | null
  outliers: number[]
}

const missingMajorLabel = 'ไม่ระบุสาขา'

function finiteNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rounded(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(decimals))
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function calculateDescriptiveStatistics(values: number[]): DescriptiveStatistics {
  const valid = values.filter(Number.isFinite)
  const average = mean(valid)
  const variance = average === null || valid.length < 2
    ? null
    : valid.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (valid.length - 1)
  return {
    n: valid.length,
    mean: rounded(average),
    sd: rounded(variance === null ? null : Math.sqrt(variance)),
    minimum: valid.length ? rounded(Math.min(...valid)) : null,
    maximum: valid.length ? rounded(Math.max(...valid)) : null,
  }
}

function percentile(sorted: number[], proportion: number) {
  if (!sorted.length) return null
  if (sorted.length === 1) return sorted[0]!
  const position = (sorted.length - 1) * proportion
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + ((sorted[upper]! - sorted[lower]!) * (position - lower))
}

export function calculateBoxPlotStatistics(values: number[]): BoxPlotStatistics {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return { n: 0, minimum: null, q1: null, median: null, q3: null, maximum: null, outliers: [] }
  const q1 = percentile(sorted, 0.25)!
  const median = percentile(sorted, 0.5)!
  const q3 = percentile(sorted, 0.75)!
  const iqr = q3 - q1
  const lowerFence = q1 - (1.5 * iqr)
  const upperFence = q3 + (1.5 * iqr)
  const withinFences = sorted.filter((value) => value >= lowerFence && value <= upperFence)
  const outliers = sorted.filter((value) => value < lowerFence || value > upperFence)
  return {
    n: sorted.length,
    minimum: rounded(withinFences[0] ?? sorted[0]!),
    q1: rounded(q1),
    median: rounded(median),
    q3: rounded(q3),
    maximum: rounded(withinFences.at(-1) ?? sorted.at(-1)!),
    outliers: outliers.map((value) => rounded(value)!),
  }
}

function improvementPercentage(preMean: number | null, postMean: number | null) {
  return preMean !== null && postMean !== null && preMean !== 0
    ? rounded(((postMean - preMean) / preMean) * 100, 2)
    : null
}

function createDistribution(preScores: number[], postScores: number[], minimumScore: number, maximumScore: number) {
  if (maximumScore <= 0 || maximumScore < minimumScore) return []
  const span = maximumScore - minimumScore + 1
  const binCount = Math.min(10, Math.max(1, Math.ceil(span)))
  const width = span / binCount
  return Array.from({ length: binCount }, (_, index) => {
    const from = minimumScore + (index * width)
    const to = index === binCount - 1 ? maximumScore : minimumScore + ((index + 1) * width)
    const includes = (score: number) => index === binCount - 1 ? score >= from && score <= to : score >= from && score < to
    return {
      from: rounded(from)!,
      to: rounded(to)!,
      label: index === binCount - 1 ? `${from.toFixed(2)}–${to.toFixed(2)}` : `${from.toFixed(2)}–<${to.toFixed(2)}`,
      preCount: preScores.filter(includes).length,
      postCount: postScores.filter(includes).length,
    }
  })
}

function uniqueStudentCount(entries: ScoreEntry[]) {
  return new Set(entries.map((entry) => entry.studentId)).size
}

function phaseEntries(entries: ScoreEntry[], phase: 'pre' | 'post') {
  return entries.filter((entry) => entry.phase === phase)
}

function pairEntries(entries: ScoreEntry[]) {
  const students = new Map<number, { pre?: ScoreEntry; post?: ScoreEntry }>()
  entries.forEach((entry) => {
    const student = students.get(entry.studentId) ?? {}
    student[entry.phase] = entry
    students.set(entry.studentId, student)
  })
  return Array.from(students.values()).filter((student): student is { pre: ScoreEntry; post: ScoreEntry } => Boolean(student.pre && student.post))
}

function majorStatistics(entries: ScoreEntry[], phases: FinalAnalysisPhase[]) {
  const showPre = phases.includes('pre')
  const showPost = phases.includes('post')
  const visibleEntries = entries.filter((entry) => (showPre && entry.phase === 'pre') || (showPost && entry.phase === 'post'))
  const majors = Array.from(new Set(visibleEntries.map((entry) => entry.major)))
  return majors.map((major) => {
    const group = entries.filter((entry) => entry.major === major)
    const pre = phaseEntries(group, 'pre')
    const post = phaseEntries(group, 'post')
    const pairs = pairEntries(group)
    const preStats = calculateDescriptiveStatistics(pre.map((entry) => entry.score))
    const postStats = calculateDescriptiveStatistics(post.map((entry) => entry.score))
    const pairedPreStats = calculateDescriptiveStatistics(pairs.map((pair) => pair.pre.score))
    const pairedPostStats = calculateDescriptiveStatistics(pairs.map((pair) => pair.post.score))
    const pairedDifference = calculateDescriptiveStatistics(pairs.map((pair) => pair.post.score - pair.pre.score))
    const differences = pairs.map((pair) => pair.post.score - pair.pre.score)
    const improvedCount = differences.filter((value) => value > 0.0005).length
    const decreasedCount = differences.filter((value) => value < -0.0005).length
    const unchangedCount = pairs.length - improvedCount - decreasedCount
    const comparisonEnabled = showPre && showPost
    const changePercentage = comparisonEnabled ? improvementPercentage(pairedPreStats.mean, pairedPostStats.mean) : null
    const rankingScore = comparisonEnabled ? changePercentage : showPost && postStats.mean !== null ? postStats.mean : showPre ? preStats.mean : null
    return {
      major,
      studentCount: uniqueStudentCount(group.filter((entry) => (showPre && entry.phase === 'pre') || (showPost && entry.phase === 'post'))),
      pairedCount: pairs.length,
      pre: showPre ? preStats : calculateDescriptiveStatistics([]),
      post: showPost ? postStats : calculateDescriptiveStatistics([]),
      pairedPreMean: comparisonEnabled ? pairedPreStats.mean : null,
      pairedPostMean: comparisonEnabled ? pairedPostStats.mean : null,
      meanDifference: comparisonEnabled ? pairedDifference.mean : null,
      improvementPercentage: changePercentage,
      improved: { count: comparisonEnabled ? improvedCount : 0, percentage: pairs.length && comparisonEnabled ? rounded((improvedCount / pairs.length) * 100, 2) : null },
      unchanged: { count: comparisonEnabled ? unchangedCount : 0, percentage: pairs.length && comparisonEnabled ? rounded((unchangedCount / pairs.length) * 100, 2) : null },
      decreased: { count: comparisonEnabled ? decreasedCount : 0, percentage: pairs.length && comparisonEnabled ? rounded((decreasedCount / pairs.length) * 100, 2) : null },
      rankingScore,
    }
  })
}

function buildInsights(input: {
  phases: FinalAnalysisPhase[]
  pairedCount: number
  pairedPreMean: number | null
  pairedPreSd: number | null
  pairedPostMean: number | null
  pairedPostSd: number | null
  improvementPercentage: number | null
  improvedCount: number
  improvedPercentage: number | null
  unchangedCount: number
  decreasedCount: number
  unpairedPreCount: number
  unpairedPostCount: number
  majors: ReturnType<typeof majorStatistics>
}) {
  const insights: string[] = []
  const showPre = input.phases.includes('pre')
  const showPost = input.phases.includes('post')
  if (showPre && showPost) {
    if (input.pairedCount === 0) insights.push('ยังไม่มีนักศึกษาที่ทำครบทั้ง Pre-test และ Post-test จึงยังคำนวณผลต่างแบบจับคู่ไม่ได้')
    else {
      const difference = rounded((input.pairedPostMean ?? 0) - (input.pairedPreMean ?? 0)) ?? 0
      const direction = difference > 0 ? 'เพิ่มขึ้น' : difference < 0 ? 'ลดลง' : 'ไม่เปลี่ยนแปลง'
      insights.push(`จากผู้ตอบที่จับคู่ได้ ${input.pairedCount} คน คะแนน Pre-test เฉลี่ย ${input.pairedPreMean?.toFixed(2) ?? '—'} ± ${input.pairedPreSd?.toFixed(2) ?? '—'} และ Post-test เฉลี่ย ${input.pairedPostMean?.toFixed(2) ?? '—'} ± ${input.pairedPostSd?.toFixed(2) ?? '—'} โดยคะแนน${direction} ${Math.abs(difference).toFixed(2)} คะแนน (${input.improvementPercentage === null ? '—' : `${input.improvementPercentage > 0 ? '+' : ''}${input.improvementPercentage.toFixed(2)}%`})`)
      insights.push(`ผู้ตอบที่คะแนนดีขึ้น ${input.improvedCount} คน เท่าเดิม ${input.unchangedCount} คน และลดลง ${input.decreasedCount} คน`)
      if (input.improvedPercentage !== null) insights.push(`คิดเป็นผู้ตอบที่คะแนนดีขึ้น ${input.improvedPercentage.toFixed(2)}% ของผู้ที่มีข้อมูลครบคู่`)
    }
  } else {
    insights.push(`กำลังแสดงข้อมูล ${showPre ? 'Pre-test' : 'Post-test'} เพียงช่วงเดียว การเปรียบเทียบแบบจับคู่จึงถูกพักไว้ชั่วคราว`)
  }
  if (input.unpairedPreCount || input.unpairedPostCount) insights.push(`มีข้อมูลที่ยังจับคู่ไม่ได้: Pre-test ${input.unpairedPreCount} คน และ Post-test ${input.unpairedPostCount} คน ข้อมูลยังคงอยู่ในระบบแต่ไม่ถูกนำไปคำนวณผลต่าง`)
  const ranked = input.majors.filter((item) => item.rankingScore !== null).sort((left, right) => right.rankingScore! - left.rankingScore!)
  const highestPost = [...input.majors].filter((item) => item.post.mean !== null).sort((left, right) => right.post.mean! - left.post.mean!)[0]
  if (highestPost) insights.push(`สาขาที่มีคะแนนเฉลี่ย Post-test สูงสุดคือ ${highestPost.major} (${highestPost.post.mean!.toFixed(2)} คะแนน)`)
  if (showPre && showPost && ranked[0]) insights.push(`สาขาที่มีร้อยละการพัฒนาสูงสุดคือ ${ranked[0].major} (${ranked[0].rankingScore! > 0 ? '+' : ''}${ranked[0].rankingScore!.toFixed(2)}%)`)
  return insights
}

export async function getFinalAnalysis(filters: FinalAnalysisFilters) {
  const clauses = ['sr.activity_id = ?']
  const values: Array<string | number> = [filters.activityId]
  if (filters.majors.length) {
    const namedMajors = filters.majors.filter((major) => major !== missingMajorLabel)
    const majorConditions: string[] = []
    if (filters.majors.includes(missingMajorLabel)) majorConditions.push("(s.major IS NULL OR s.major = '')")
    if (namedMajors.length) {
      majorConditions.push(`s.major IN (${namedMajors.map(() => '?').join(', ')})`)
      values.push(...namedMajors)
    }
    clauses.push(`(${majorConditions.join(' OR ')})`)
  }
  if (filters.educationLevels.length) {
    clauses.push(`s.education_level IN (${filters.educationLevels.map(() => '?').join(', ')})`)
    values.push(...filters.educationLevels)
  }
  if (filters.studyYears.length) {
    clauses.push(`s.study_year IN (${filters.studyYears.map(() => '?').join(', ')})`)
    values.push(...filters.studyYears)
  }

  const [rows, scaleRows, majorRows, educationRows, studyYearRows] = await Promise.all([
    pool.query<ResponseScoreRow[]>(`
      SELECT sr.id AS response_id, sr.student_id, s.student_code, s.major, s.education_level, s.study_year,
        sr.phase, AVG(ra.score) AS score, COUNT(ra.id) AS answer_count
      FROM survey_responses sr
      JOIN students s ON s.id = sr.student_id
      JOIN response_answers ra ON ra.response_id = sr.id
      WHERE ${clauses.join(' AND ')}
      GROUP BY sr.id, sr.student_id, s.student_code, s.major, s.education_level, s.study_year, sr.phase
      ORDER BY s.student_code ASC, sr.phase ASC`, values),
    pool.query<ScaleRow[]>(`
      SELECT MIN(cl.level) AS minimum_score, MAX(cl.level) AS maximum_score
      FROM activities a
      JOIN questions q ON q.template_id = a.survey_template_id
      JOIN competency_levels cl ON cl.competency_id = q.competency_id
      WHERE a.id = ?`, [filters.activityId]),
    pool.query<Array<{ value: string | null }>>(`SELECT DISTINCT NULLIF(TRIM(s.major), '') AS value FROM survey_responses sr JOIN students s ON s.id = sr.student_id WHERE sr.activity_id = ? ORDER BY value`, [filters.activityId]),
    pool.query<Array<{ value: string | null }>>(`SELECT DISTINCT NULLIF(TRIM(s.education_level), '') AS value FROM survey_responses sr JOIN students s ON s.id = sr.student_id WHERE sr.activity_id = ? ORDER BY value`, [filters.activityId]),
    pool.query<Array<{ value: number | string | null }>>(`SELECT DISTINCT s.study_year AS value FROM survey_responses sr JOIN students s ON s.id = sr.student_id WHERE sr.activity_id = ? AND s.study_year IS NOT NULL ORDER BY s.study_year`, [filters.activityId]),
  ])

  const entries: ScoreEntry[] = rows.map((row) => ({
    responseId: finiteNumber(row.response_id),
    studentId: finiteNumber(row.student_id),
    studentCode: row.student_code,
    major: row.major?.trim() || missingMajorLabel,
    educationLevel: row.education_level?.trim() || null,
    studyYear: row.study_year === null ? null : finiteNumber(row.study_year),
    phase: row.phase,
    score: finiteNumber(row.score),
    answerCount: finiteNumber(row.answer_count),
  }))
  const pre = phaseEntries(entries, 'pre')
  const post = phaseEntries(entries, 'post')
  const pairs = pairEntries(entries)
  const showPre = filters.phases.includes('pre')
  const showPost = filters.phases.includes('post')
  const comparisonEnabled = showPre && showPost
  const selectedEntries = entries.filter((entry) => (showPre && entry.phase === 'pre') || (showPost && entry.phase === 'post'))
  const preStats = showPre ? calculateDescriptiveStatistics(pre.map((entry) => entry.score)) : calculateDescriptiveStatistics([])
  const postStats = showPost ? calculateDescriptiveStatistics(post.map((entry) => entry.score)) : calculateDescriptiveStatistics([])
  const pairedPre = calculateDescriptiveStatistics(pairs.map((pair) => pair.pre.score))
  const pairedPost = calculateDescriptiveStatistics(pairs.map((pair) => pair.post.score))
  const pairedDifferences = pairs.map((pair) => pair.post.score - pair.pre.score)
  const pairedDifference = calculateDescriptiveStatistics(pairedDifferences)
  const improvedCount = comparisonEnabled ? pairedDifferences.filter((value) => value > 0.0005).length : 0
  const decreasedCount = comparisonEnabled ? pairedDifferences.filter((value) => value < -0.0005).length : 0
  const unchangedCount = comparisonEnabled ? pairs.length - improvedCount - decreasedCount : 0
  const scale = scaleRows[0]
  const observedScores = entries.map((entry) => entry.score)
  const minimumScore = scale?.minimum_score === null || scale?.minimum_score === undefined
    ? (observedScores.length ? Math.min(...observedScores) : 0)
    : finiteNumber(scale.minimum_score)
  const maximumScore = scale?.maximum_score === null || scale?.maximum_score === undefined
    ? (observedScores.length ? Math.max(...observedScores) : 0)
    : finiteNumber(scale.maximum_score)
  const majors = majorStatistics(entries, filters.phases)
  const pairedStudentIds = new Set(pairs.map((pair) => pair.pre.studentId))
  const unpairedPreCount = showPre ? pre.filter((entry) => !pairedStudentIds.has(entry.studentId)).length : 0
  const unpairedPostCount = showPost ? post.filter((entry) => !pairedStudentIds.has(entry.studentId)).length : 0
  const insights = buildInsights({
    phases: filters.phases,
    pairedCount: comparisonEnabled ? pairs.length : 0,
    pairedPreMean: comparisonEnabled ? pairedPre.mean : null,
    pairedPreSd: comparisonEnabled ? pairedPre.sd : null,
    pairedPostMean: comparisonEnabled ? pairedPost.mean : null,
    pairedPostSd: comparisonEnabled ? pairedPost.sd : null,
    improvementPercentage: comparisonEnabled ? improvementPercentage(pairedPre.mean, pairedPost.mean) : null,
    improvedCount,
    improvedPercentage: pairs.length && comparisonEnabled ? rounded((improvedCount / pairs.length) * 100, 2) : null,
    unchangedCount,
    decreasedCount,
    unpairedPreCount,
    unpairedPostCount,
    majors,
  })

  return {
    filters: {
      selected: { majors: filters.majors, educationLevels: filters.educationLevels, studyYears: filters.studyYears, phases: filters.phases },
      options: {
        majors: majorRows.map((row) => row.value?.trim() || missingMajorLabel).filter((value, index, list) => list.indexOf(value) === index),
        educationLevels: educationRows.flatMap((row) => row.value ? [row.value] : []),
        studyYears: studyYearRows.flatMap((row) => row.value === null ? [] : [finiteNumber(row.value)]),
      },
    },
    scale: { minimum: minimumScore, maximum: maximumScore },
    summary: {
      respondentCount: uniqueStudentCount(selectedEntries),
      preMean: preStats.mean,
      postMean: postStats.mean,
      pairedCount: comparisonEnabled ? pairs.length : 0,
      pairedPreMean: comparisonEnabled ? pairedPre.mean : null,
      pairedPostMean: comparisonEnabled ? pairedPost.mean : null,
      meanDifference: comparisonEnabled ? pairedDifference.mean : null,
      improvementPercentage: comparisonEnabled ? improvementPercentage(pairedPre.mean, pairedPost.mean) : null,
      maximum: selectedEntries.length ? rounded(Math.max(...selectedEntries.map((entry) => entry.score))) : null,
      minimum: selectedEntries.length ? rounded(Math.min(...selectedEntries.map((entry) => entry.score))) : null,
      sampleSd: calculateDescriptiveStatistics(selectedEntries.map((entry) => entry.score)).sd,
    },
    descriptive: { pre: preStats, post: postStats },
    paired: {
      enabled: comparisonEnabled,
      count: comparisonEnabled ? pairs.length : 0,
      pre: comparisonEnabled ? pairedPre : calculateDescriptiveStatistics([]),
      post: comparisonEnabled ? pairedPost : calculateDescriptiveStatistics([]),
      difference: comparisonEnabled ? pairedDifference : calculateDescriptiveStatistics([]),
      improved: { count: improvedCount, percentage: pairs.length && comparisonEnabled ? rounded((improvedCount / pairs.length) * 100, 2) : null },
      unchanged: { count: unchangedCount, percentage: pairs.length && comparisonEnabled ? rounded((unchangedCount / pairs.length) * 100, 2) : null },
      decreased: { count: decreasedCount, percentage: pairs.length && comparisonEnabled ? rounded((decreasedCount / pairs.length) * 100, 2) : null },
      unpairedPreCount,
      unpairedPostCount,
    },
    majors,
    distribution: createDistribution(showPre ? pre.map((entry) => entry.score) : [], showPost ? post.map((entry) => entry.score) : [], minimumScore, maximumScore),
    boxPlot: {
      pre: calculateBoxPlotStatistics(showPre ? pre.map((entry) => entry.score) : []),
      post: calculateBoxPlotStatistics(showPost ? post.map((entry) => entry.score) : []),
    },
    insights,
  }
}
