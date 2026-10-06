import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { isDatabaseAvailable } from '../db/availability.js'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'
import { educationLevelFromStudentCode, normalizeStudentCode } from '../lib/studentEducation.js'
import { parseStoredFormTheme } from '../lib/formTheme.js'
import { createStudentSession } from '../lib/studentSession.js'

type Phase = 'pre' | 'post'
type SurveyStatus = 'invalid' | 'not_open' | 'open' | 'closed' | 'archived'

type SurveyRow = {
  qr_id: number
  activity_id: number
  name: string
  cover_image_data: string | null
  form_theme_json: string | null
  phase: Phase
  duration_minutes: number | string
  window_status: SurveyStatus
}
type ReadableSurveyRow = SurveyRow & { window_status: Exclude<SurveyStatus, 'invalid'> }
type SurveySessionRow = {
  session_id: number
  qr_id: number
  activity_id: number
  student_id: number
  activity_name: string
  activity_image_data: string | null
  form_theme_json: string | null
  survey_template_id: number | null
  phase: Phase
  window_status: SurveyStatus
}
type SurveySessionAnswerRow = {
  question_id: number
  competency_id: number
  score: number
}
type ExistingSurveySessionRow = {
  id: number
  expires_at: Date | string
}
type QuestionRow = {
  question_id: number
  competency_id: number
  name: string
  definition: string
  display_order: number
  level: number
  title: string
  description: string
  example: string | null
}
type ResultResponseRow = {
  id: number
  phase: Phase
  submitted_at: Date | string
}
type ResultAnswerRow = {
  competency_id: number
  name: string
  display_order: number
  score: number
}

const surveyTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'QR Code ไม่ถูกต้อง')
const studentCodeSchema = z.string().transform(normalizeStudentCode)
  .pipe(z.string().regex(/^[BMD]\d{7}$/, 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'))
const studyYearsByDegree: Record<string, number[]> = {
  B: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}
function isAllowedStudyYear(studentCode: string, studyYear: number) {
  return studyYearsByDegree[studentCode.charAt(0)]?.includes(studyYear) ?? false
}
const identifySchema = z.object({
  studentCode: studentCodeSchema,
  firstName: z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100).optional(),
  lastName: z.string().trim().min(1, 'กรุณากรอกนามสกุล').max(100).optional(),
  faculty: z.string().trim().min(1, 'กรุณากรอกสำนักวิชา').max(150).optional(),
  major: z.string().trim().min(1, 'กรุณากรอกสาขาวิชา').max(150).optional(),
  studyYear: z.coerce.number().int().min(1, 'กรุณาระบุชั้นปี').max(10).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email('กรุณากรอกอีเมลที่ถูกต้อง')).optional(),
  phone: z.string().trim().min(8, 'กรุณากรอกเบอร์โทร').max(30).optional(),
  pdpaConsented: z.boolean().optional(),
})
const registrationSchema = z.object({
  firstName: z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100),
  lastName: z.string().trim().min(1, 'กรุณากรอกนามสกุล').max(100),
  studentCode: studentCodeSchema,
  faculty: z.string().trim().min(1, 'กรุณากรอกสำนักวิชา').max(150),
  major: z.string().trim().min(1, 'กรุณากรอกสาขาวิชา').max(150),
  studyYear: z.coerce.number().int().min(1, 'กรุณาระบุชั้นปี').max(10),
  email: z.string().trim().toLowerCase().pipe(z.email('กรุณากรอกอีเมลที่ถูกต้อง')),
  phone: z.string().trim().min(8, 'กรุณากรอกเบอร์โทร').max(30),
  pdpaConsented: z.boolean().refine((value) => value, 'กรุณายอมรับข้อตกลงคุ้มครองข้อมูลส่วนบุคคล'),
}).superRefine((value, context) => {
  if (!isAllowedStudyYear(value.studentCode, value.studyYear)) {
    context.addIssue({ code: 'custom', path: ['studyYear'], message: 'ชั้นปีไม่สอดคล้องกับระดับการศึกษาตามรหัสนักศึกษา' })
  }
})
const surveySessionSchema = z.string().regex(/^[a-f0-9]{64}$/, 'เซสชันแบบประเมินไม่ถูกต้องหรือหมดอายุ')
const surveyAnswerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  competencyId: z.coerce.number().int().positive(),
  levelValue: z.coerce.number().int().min(1).max(7),
})
const draftAnswerSchema = surveyAnswerSchema.extend({
  surveySession: surveySessionSchema,
})
const submitResponseSchema = z.object({
  surveySession: surveySessionSchema,
  answers: z.array(surveyAnswerSchema).length(9, 'กรุณาตอบแบบประเมินให้ครบทั้ง 9 ข้อ'),
}).superRefine((value, context) => {
  const questionIds = new Set<number>()
  for (const [index, answer] of value.answers.entries()) {
    if (questionIds.has(answer.questionId)) context.addIssue({ code: 'custom', path: ['answers', index, 'questionId'], message: 'ไม่สามารถเลือกคำตอบของสมรรถนะเดิมซ้ำได้' })
    questionIds.add(answer.questionId)
  }
})

const identifyAttemptWindowMs = 10 * 60 * 1000
const identifyAttemptLimit = 10
const identifyAttempts = new Map<string, { count: number; resetAt: number }>()

function limitIdentifyAttempts(token: string, studentCode: string) {
  const now = Date.now()
  for (const [key, value] of identifyAttempts) {
    if (value.resetAt <= now) identifyAttempts.delete(key)
  }

  // Students commonly share one public IP through campus Wi-Fi or the Vercel
  // proxy. Keep retries isolated to the student and survey instead.
  const key = `${token}:${studentCode}`
  const current = identifyAttempts.get(key)
  if (!current || current.resetAt <= now) {
    identifyAttempts.set(key, { count: 1, resetAt: now + identifyAttemptWindowMs })
    return
  }
  if (current.count >= identifyAttemptLimit) throw new ApiError(429, 'ลองใหม่อีกครั้งในภายหลัง')
  current.count += 1
}

function surveyStatusQuery(lock = false, includePresentation = true) {
  const presentationFields = includePresentation
    ? "a.name, a.cover_image_data, a.form_theme_json,"
    : "'' AS name, NULL AS cover_image_data, NULL AS form_theme_json,"

  return `SELECT
    q.id AS qr_id,
    q.activity_id,
    ${presentationFields}
    q.phase,
    CASE WHEN q.phase = 'pre' THEN a.pre_test_duration_minutes ELSE a.post_test_duration_minutes END AS duration_minutes,
    CASE
      WHEN q.revoked_at IS NOT NULL THEN 'invalid'
      WHEN a.status = 'archived' THEN 'archived'
      WHEN q.phase = 'pre' AND a.pre_close_at IS NOT NULL AND a.pre_close_at <= NOW() THEN 'closed'
      WHEN q.phase = 'post' AND a.post_close_at IS NOT NULL AND a.post_close_at <= NOW() THEN 'closed'
      WHEN q.phase = 'pre' AND a.pre_test_enabled = FALSE THEN 'not_open'
      WHEN q.phase = 'post' AND a.post_test_enabled = FALSE THEN 'not_open'
      ELSE 'open'
    END AS window_status
   FROM qr_codes q
   JOIN activities a ON a.id = q.activity_id
   WHERE q.token = ?
   LIMIT 1${lock ? ' FOR UPDATE' : ''}`
}

function surveySessionQuery(lock = false) {
  return `SELECT
    ss.id AS session_id,
    q.id AS qr_id,
    ss.activity_id,
    ss.student_id,
    a.name AS activity_name,
    a.assessment_image_data AS activity_image_data,
    a.form_theme_json,
    a.survey_template_id,
    ss.phase,
    CASE
      WHEN q.revoked_at IS NOT NULL THEN 'invalid'
      WHEN a.status = 'archived' THEN 'archived'
      WHEN q.phase = 'pre' AND a.pre_close_at IS NOT NULL AND a.pre_close_at <= NOW() THEN 'closed'
      WHEN q.phase = 'post' AND a.post_close_at IS NOT NULL AND a.post_close_at <= NOW() THEN 'closed'
      WHEN q.phase = 'pre' AND a.pre_test_enabled = FALSE THEN 'not_open'
      WHEN q.phase = 'post' AND a.post_test_enabled = FALSE THEN 'not_open'
      ELSE 'open'
    END AS window_status
   FROM survey_sessions ss
   JOIN qr_codes q ON q.id = ss.qr_code_id
   JOIN activities a ON a.id = ss.activity_id
   WHERE q.token = ? AND ss.session_hash = ? AND ss.expires_at > NOW()
   LIMIT 1${lock ? ' FOR UPDATE' : ''}`
}

async function findSurvey(token: string) {
  const rows = await pool.query<SurveyRow[]>(surveyStatusQuery(), [token])
  return rows[0]
}

function ensureReadableSurvey(survey: SurveyRow | undefined): ReadableSurveyRow {
  if (!survey || survey.window_status === 'invalid') throw new ApiError(410, 'QR Code ไม่ถูกต้องหรือถูกยกเลิกแล้ว')
  return survey as ReadableSurveyRow
}

function ensureDatabaseAvailable() {
  if (!isDatabaseAvailable()) throw new ApiError(503, 'ระบบประเมินยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง')
}

function sessionHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function ensureOpenSurveySession(session: SurveySessionRow | undefined) {
  if (!session || session.window_status === 'invalid') throw new ApiError(401, 'เซสชันแบบประเมินไม่ถูกต้องหรือหมดอายุ')
  if (session.window_status !== 'open') {
    const statusMessage: Record<Exclude<SurveyStatus, 'invalid' | 'open'>, string> = {
      not_open: 'แบบประเมินยังไม่เปิด',
      closed: 'แบบประเมินปิดรับแล้ว',
      archived: 'กิจกรรมนี้ถูกเก็บถาวรแล้ว',
    }
    throw new ApiError(409, statusMessage[session.window_status])
  }
  if (!session.survey_template_id) throw new ApiError(409, 'กิจกรรมนี้ยังไม่ได้กำหนดแบบประเมิน')
  return session as SurveySessionRow & { survey_template_id: number; window_status: 'open' }
}

function ensureResultSurveySession(session: SurveySessionRow | undefined) {
  if (!session || session.window_status === 'invalid') throw new ApiError(401, 'เซสชันแบบประเมินไม่ถูกต้องหรือหมดอายุ')
  return session
}

function questionsQuery() {
  return `SELECT q.id AS question_id, c.id AS competency_id, c.name, c.definition, q.display_order,
    l.level, l.title, l.description, l.example
    FROM questions q
    JOIN competencies c ON c.id = q.competency_id
    JOIN competency_levels l ON l.competency_id = c.id
    WHERE q.template_id = ? AND q.is_required = TRUE
    ORDER BY q.display_order ASC, q.id ASC, l.level ASC`
}

function serializeQuestions(rows: QuestionRow[]) {
  const questions = new Map<number, {
    questionId: number
    competencyId: number
    name: string
    definition: string
    displayOrder: number
    levels: Array<{ levelValue: number; title: string; description: string; example: string | null }>
  }>()

  for (const row of rows) {
    const questionId = Number(row.question_id)
    if (!questions.has(questionId)) {
      questions.set(questionId, {
        questionId,
        competencyId: Number(row.competency_id),
        name: row.name,
        definition: row.definition,
        displayOrder: Number(row.display_order),
        levels: [],
      })
    }
    questions.get(questionId)!.levels.push({
      levelValue: Number(row.level),
      title: row.title,
      description: row.description,
      example: row.example,
    })
  }

  const items = [...questions.values()]
  if (items.length !== 9 || items.some((question) => question.levels.length !== 7)) {
    throw new ApiError(409, 'แบบประเมินของกิจกรรมนี้ตั้งค่าไม่ครบ')
  }
  return items
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ER_DUP_ENTRY'
}

function resultAnswersQuery() {
  return `SELECT c.id AS competency_id, c.name, c.display_order, ra.score
    FROM response_answers ra
    JOIN competencies c ON c.id = ra.competency_id
    WHERE ra.response_id = ?
    ORDER BY c.display_order ASC, c.id ASC`
}

function serializeResultAnswers(rows: ResultAnswerRow[]) {
  return rows.map((row) => ({
    competencyId: Number(row.competency_id),
    name: row.name,
    displayOrder: Number(row.display_order),
    levelValue: Number(row.score),
  }))
}

function serializeSurvey(survey: SurveyRow) {
  return {
    activity: { id: Number(survey.activity_id), name: survey.name, imageData: survey.cover_image_data, formTheme: parseStoredFormTheme(survey.form_theme_json) },
    phase: survey.phase,
    status: survey.window_status as Exclude<SurveyStatus, 'invalid'>,
  }
}

export const publicSurveyRouter = Router()

publicSurveyRouter.get('/:token', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  ensureDatabaseAvailable()
  const survey = ensureReadableSurvey(await findSurvey(token))
  response.json(serializeSurvey(survey))
})

publicSurveyRouter.post('/:token/identify', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  ensureDatabaseAvailable()
  const input = identifySchema.parse(request.body)
  limitIdentifyAttempts(token, input.studentCode)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const surveyRows = await connection.query<SurveyRow[]>(surveyStatusQuery(true, false), [token])
    const survey = ensureReadableSurvey(surveyRows[0])
    if (survey.window_status !== 'open') {
      const statusMessage: Record<Exclude<SurveyStatus, 'invalid' | 'open'>, string> = {
        not_open: 'แบบประเมินยังไม่เปิด',
        closed: 'แบบประเมินปิดรับแล้ว',
        archived: 'กิจกรรมนี้ถูกเก็บถาวรแล้ว',
      }
      throw new ApiError(409, statusMessage[survey.window_status])
    }

    const students = await connection.query<Array<{ id: number }>>(
      'SELECT id FROM students WHERE student_code = ? LIMIT 1 FOR UPDATE',
      [input.studentCode],
    )

    let studentId = Number(students[0]?.id)
    if (!studentId) {
      const hasRegistrationDetails = input.firstName !== undefined && input.lastName !== undefined && input.faculty !== undefined && input.major !== undefined && input.studyYear !== undefined && input.email !== undefined && input.phone !== undefined && input.pdpaConsented !== undefined
      if (!hasRegistrationDetails) {
        await connection.commit()
        response.json({ next: 'registration' })
        return
      }
      const registration = registrationSchema.parse(input)
      const created = await connection.query(
        `INSERT INTO students (student_code, email, first_name, last_name, full_name, faculty, major, education_level, study_year, phone, pdpa_consented_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [registration.studentCode, registration.email, registration.firstName, registration.lastName, `${registration.firstName} ${registration.lastName}`, registration.faculty, registration.major, educationLevelFromStudentCode(registration.studentCode), registration.studyYear, registration.phone],
      )
      studentId = Number(created.insertId)
    }

    const existingResponses = await connection.query<Array<{ id: number }>>(
      `SELECT id FROM survey_responses
       WHERE activity_id = ? AND student_id = ? AND phase = ?
       LIMIT 1`,
      [survey.activity_id, studentId, survey.phase],
    )
    const durationMinutes = Math.max(1, Number(survey.duration_minutes) || 15)
    if (existingResponses[0]) {
      const surveySession = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
      await connection.query(
        `INSERT INTO survey_sessions (session_hash, qr_code_id, activity_id, student_id, phase, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionHash(surveySession), survey.qr_id, survey.activity_id, studentId, survey.phase, expiresAt],
      )
      await connection.commit()
      response.json({ next: 'result', alreadySubmitted: true, resumed: false, surveySession, expiresAt: expiresAt.toISOString() })
      return
    }

    const incompleteSessions = await connection.query<ExistingSurveySessionRow[]>(
      `SELECT id, expires_at
       FROM survey_sessions
       WHERE activity_id = ? AND student_id = ? AND phase = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1 FOR UPDATE`,
      [survey.activity_id, studentId, survey.phase],
    )
    const previousSession = incompleteSessions[0]
    if (previousSession) {
      const expiresAt = previousSession.expires_at instanceof Date ? previousSession.expires_at : new Date(previousSession.expires_at)
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new ApiError(409, 'เวลาทำแบบประเมินหมดแล้ว จึงไม่สามารถเริ่มจับเวลาใหม่ได้')
      }
      const surveySession = crypto.randomBytes(32).toString('hex')
      await connection.query(
        'UPDATE survey_sessions SET session_hash = ?, qr_code_id = ? WHERE id = ?',
        [sessionHash(surveySession), survey.qr_id, previousSession.id],
      )
      await connection.commit()
      response.json({ next: 'assessment', alreadySubmitted: false, resumed: true, surveySession, expiresAt: expiresAt.toISOString() })
      return
    }

    const surveySession = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    await connection.query(
      `INSERT INTO survey_sessions (session_hash, qr_code_id, activity_id, student_id, phase, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionHash(surveySession), survey.qr_id, survey.activity_id, studentId, survey.phase, expiresAt],
    )
    await connection.commit()
    response.json({ next: 'assessment', alreadySubmitted: false, resumed: false, surveySession, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

publicSurveyRouter.get('/:token/result', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  const surveySession = surveySessionSchema.parse(request.get('x-survey-session') ?? '')
  ensureDatabaseAvailable()
  const sessionRows = await pool.query<SurveySessionRow[]>(surveySessionQuery(), [token, sessionHash(surveySession)])
  const session = ensureResultSurveySession(sessionRows[0])
  const responseRows = await pool.query<ResultResponseRow[]>(
    `SELECT id, phase, submitted_at
     FROM survey_responses
     WHERE activity_id = ? AND student_id = ?
     ORDER BY submitted_at ASC, id ASC`,
    [session.activity_id, session.student_id],
  )
  const currentResponse = responseRows.find((item) => item.phase === session.phase)
  if (!currentResponse) throw new ApiError(404, 'ไม่พบผลการประเมิน')
  const answers = serializeResultAnswers(await pool.query<ResultAnswerRow[]>(resultAnswersQuery(), [Number(currentResponse.id)]))
  if (answers.length !== 9) throw new ApiError(409, 'ผลการประเมินนี้มีข้อมูลไม่ครบ')

  const preResponse = responseRows.find((item) => item.phase === 'pre')
  const postResponse = responseRows.find((item) => item.phase === 'post')
  let comparison: { pre: ReturnType<typeof serializeResultAnswers>; post: ReturnType<typeof serializeResultAnswers> } | null = null
  if (preResponse && postResponse) {
    const [preRows, postRows] = await Promise.all([
      pool.query<ResultAnswerRow[]>(resultAnswersQuery(), [Number(preResponse.id)]),
      pool.query<ResultAnswerRow[]>(resultAnswersQuery(), [Number(postResponse.id)]),
    ])
    const pre = serializeResultAnswers(preRows)
    const post = serializeResultAnswers(postRows)
    if (pre.length === 9 && post.length === 9) comparison = { pre, post }
  }

  response.json({
    activity: { id: Number(session.activity_id), name: session.activity_name, imageData: session.activity_image_data, formTheme: parseStoredFormTheme(session.form_theme_json) },
    phase: session.phase,
    submittedAt: currentResponse.submitted_at instanceof Date ? currentResponse.submitted_at.toISOString() : currentResponse.submitted_at,
    competencies: answers,
    comparison,
  })
})

publicSurveyRouter.post('/:token/portal-session', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  const surveySession = surveySessionSchema.parse(request.get('x-survey-session') ?? '')
  ensureDatabaseAvailable()
  const sessionRows = await pool.query<SurveySessionRow[]>(surveySessionQuery(), [token, sessionHash(surveySession)])
  const session = ensureResultSurveySession(sessionRows[0])
  const submitted = await pool.query<Array<{ id: number }>>(
    `SELECT id
     FROM survey_responses
     WHERE activity_id = ? AND student_id = ? AND phase = ?
     LIMIT 1`,
    [session.activity_id, session.student_id, session.phase],
  )
  if (!submitted[0]) throw new ApiError(409, 'กรุณาส่งแบบประเมินให้เรียบร้อยก่อนเปิด Student Portal')
  response.json(await createStudentSession(Number(session.student_id)))
})

publicSurveyRouter.get('/:token/questions', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  const surveySession = surveySessionSchema.parse(request.get('x-survey-session') ?? '')
  ensureDatabaseAvailable()
  const rows = await pool.query<SurveySessionRow[]>(surveySessionQuery(), [token, sessionHash(surveySession)])
  const session = ensureOpenSurveySession(rows[0])
  const existingResponses = await pool.query<Array<{ id: number }>>(
    'SELECT id FROM survey_responses WHERE activity_id = ? AND student_id = ? AND phase = ? LIMIT 1',
    [session.activity_id, session.student_id, session.phase],
  )
  if (existingResponses[0]) throw new ApiError(409, 'คุณได้ส่งแบบประเมินนี้แล้ว')
  const questionRows = await pool.query<QuestionRow[]>(questionsQuery(), [session.survey_template_id])
  const questions = serializeQuestions(questionRows)
  const draftRows = await pool.query<SurveySessionAnswerRow[]>(
    `SELECT question_id, competency_id, score
     FROM survey_session_answers
     WHERE survey_session_id = ?
     ORDER BY question_id ASC`,
    [session.session_id],
  )
  response.json({
    activity: { id: Number(session.activity_id), name: session.activity_name, imageData: session.activity_image_data, formTheme: parseStoredFormTheme(session.form_theme_json) },
    phase: session.phase,
    questions,
    draftAnswers: draftRows.map((row) => ({
      questionId: Number(row.question_id),
      competencyId: Number(row.competency_id),
      levelValue: Number(row.score),
    })),
  })
})

publicSurveyRouter.put('/:token/draft', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  const input = draftAnswerSchema.parse(request.body)
  ensureDatabaseAvailable()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const sessionRows = await connection.query<SurveySessionRow[]>(surveySessionQuery(true), [token, sessionHash(input.surveySession)])
    const session = ensureOpenSurveySession(sessionRows[0])
    const questionRows = await connection.query<QuestionRow[]>(questionsQuery(), [session.survey_template_id])
    const question = serializeQuestions(questionRows).find((item) => item.questionId === input.questionId)
    if (!question || question.competencyId !== input.competencyId || !question.levels.some((level) => level.levelValue === input.levelValue)) {
      throw new ApiError(400, 'มีคำตอบที่ไม่ตรงกับแบบประเมินนี้')
    }
    await connection.query(
      `INSERT INTO survey_session_answers (survey_session_id, question_id, competency_id, score)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE competency_id = VALUES(competency_id), score = VALUES(score), updated_at = CURRENT_TIMESTAMP`,
      [session.session_id, input.questionId, input.competencyId, input.levelValue],
    )
    await connection.commit()
    response.status(204).end()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

publicSurveyRouter.post('/:token/responses', async (request, response) => {
  const token = surveyTokenSchema.parse(request.params.token ?? '')
  const input = submitResponseSchema.parse(request.body)
  ensureDatabaseAvailable()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const sessionRows = await connection.query<SurveySessionRow[]>(surveySessionQuery(true), [token, sessionHash(input.surveySession)])
    const session = ensureOpenSurveySession(sessionRows[0])
    const questionRows = await connection.query<QuestionRow[]>(questionsQuery(), [session.survey_template_id])
    const questions = serializeQuestions(questionRows)
    const questionById = new Map(questions.map((question) => [question.questionId, question]))

    for (const answer of input.answers) {
      const question = questionById.get(answer.questionId)
      if (!question || answer.competencyId !== question.competencyId || !question.levels.some((level) => level.levelValue === answer.levelValue)) {
        throw new ApiError(400, 'มีคำตอบที่ไม่ตรงกับแบบประเมินนี้')
      }
    }
    if (new Set(input.answers.map((answer) => answer.questionId)).size !== questions.length) {
      throw new ApiError(400, 'กรุณาตอบแบบประเมินให้ครบทั้ง 9 ข้อ')
    }

    const existingResponses = await connection.query<Array<{ id: number }>>(
      'SELECT id FROM survey_responses WHERE activity_id = ? AND student_id = ? AND phase = ? LIMIT 1 FOR UPDATE',
      [session.activity_id, session.student_id, session.phase],
    )
    if (existingResponses[0]) {
      await connection.rollback()
      response.status(409).json({ message: 'คุณได้ส่งแบบประเมินนี้แล้ว', next: 'result' })
      return
    }

    const created = await connection.query(
      'INSERT INTO survey_responses (activity_id, student_id, phase) VALUES (?, ?, ?)',
      [session.activity_id, session.student_id, session.phase],
    )
    const responseId = Number(created.insertId)
    for (const answer of input.answers) {
      await connection.query(
        'INSERT INTO response_answers (response_id, competency_id, score) VALUES (?, ?, ?)',
        [responseId, answer.competencyId, answer.levelValue],
      )
    }
    await connection.query('DELETE FROM survey_session_answers WHERE survey_session_id = ?', [session.session_id])
    await connection.commit()
    response.status(201).json({ responseId, next: 'result' })
  } catch (error) {
    await connection.rollback()
    if (isDuplicateKeyError(error)) {
      response.status(409).json({ message: 'คุณได้ส่งแบบประเมินนี้แล้ว', next: 'result' })
      return
    }
    throw error
  } finally {
    connection.release()
  }
})
