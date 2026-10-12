import assert from 'node:assert/strict'
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mariadb from 'mariadb'

// Deliberately fixed: this harness creates synthetic records and must never target production.
const baseUrl = 'http://127.0.0.1:3012'
const database = 'codex_survey_load_test'
const databasePort = 33082
const userCount = 120
const reportPath = new URL('../outputs/full-load-120-report.json', import.meta.url)
const token = randomBytes(32).toString('hex')
const runId = randomUUID()
const report = {
  startedAt: new Date().toISOString(),
  users: userCount,
  environment: 'isolated localhost API and MariaDB; synthetic student records',
  limitations: ['HTTP/API simulation, not 120 real mobile browsers', 'Local hardware and network, not Railway/Vercel capacity certification'],
  stages: [],
  assertions: [],
}
let connection

function check(name, condition) {
  report.assertions.push({ name, passed: Boolean(condition) })
  assert.ok(condition, name)
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}

async function request(path, options = {}, binary = false) {
  assert.ok(path.startsWith('/api/'), 'Only relative API paths are allowed')
  const url = new URL(path, baseUrl)
  assert.equal(url.origin, baseUrl, 'Local API origin only')
  const startedAt = performance.now()
  try {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    // Media stays binary; decoding megabytes as JSON would distort the load generator.
    const body = binary || bytes.length === 0 ? null : JSON.parse(bytes.toString('utf8'))
    return { status: response.status, body, bytes: bytes.length, digest: binary ? createHash('sha256').update(bytes).digest('hex') : null,
      etag: response.headers.get('etag'), contentType: response.headers.get('content-type'), ms: performance.now() - startedAt }
  } catch {
    return { status: 0, body: null, bytes: 0, ms: performance.now() - startedAt }
  }
}

function recordStage(name, results, expectedStatuses, extra = {}) {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses]
  const failures = results.filter((result) => !expected.includes(result.status))
  const times = results.map((result) => result.ms)
  const statusCounts = Object.fromEntries([...new Set(results.map((result) => result.status))].sort((a, b) => a - b)
    .map((status) => [status, results.filter((result) => result.status === status).length]))
  const stage = { name, requests: results.length, expectedStatuses: expected, passed: results.length - failures.length,
    failed: failures.length, statusCounts, p50Ms: +percentile(times, 0.5).toFixed(1), p95Ms: +percentile(times, 0.95).toFixed(1),
    p99Ms: +percentile(times, 0.99).toFixed(1), maxMs: +Math.max(...times).toFixed(1), transferredBytes: results.reduce((sum, item) => sum + item.bytes, 0), ...extra }
  report.stages.push(stage)
  console.log(JSON.stringify({ stage: name, requests: stage.requests, failed: stage.failed, p95Ms: stage.p95Ms }))
  assert.equal(failures.length, 0, `${name}: unexpected HTTP statuses ${JSON.stringify(statusCounts)}`)
}

function jsonOptions(method, body, headers = {}) {
  return { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }
}
const sessionOptions = (session) => ({ headers: { 'x-survey-session': session } })
const path = (suffix = '') => `/api/public/surveys/${token}${suffix}`

async function createJpegFixture() {
  const original = await readFile(new URL('../src/assets/21.jpg', import.meta.url))
  assert.equal(original.readUInt16BE(0), 0xffd8, 'Fixture must be an existing JPEG')
  // Add legal JPEG COM segments after SOI. This preserves the original image while
  // modelling a 2.4 MB base64 database field without adding a large tracked fixture.
  const targetBytes = 1_800_000
  let paddingBytes = targetBytes - original.length
  const comments = []
  while (paddingBytes >= 4) {
    const length = Math.min(65_537, paddingBytes)
    const segment = Buffer.alloc(length, 0x20)
    segment.writeUInt16BE(0xfffe, 0)
    segment.writeUInt16BE(length - 2, 2)
    comments.push(segment)
    paddingBytes -= length
  }
  const image = Buffer.concat([original.subarray(0, 2), ...comments, original.subarray(2)])
  return { dataUrl: `data:image/jpeg;base64,${image.toString('base64')}`, bytes: image.length,
    digest: createHash('sha256').update(image).digest('hex') }
}

async function seed() {
  assert.equal(new URL(baseUrl).hostname, '127.0.0.1', 'Loopback API only')
  assert.equal(new URL(baseUrl).port, '3012', 'Dedicated test API port only')
  assert.equal(database, 'codex_survey_load_test', 'Dedicated test database only')
  assert.equal(databasePort, 33082, 'Dedicated test database port only')
  assert.ok(process.env.SURVEY_LOAD_DB_PASSWORD, 'Set SURVEY_LOAD_DB_PASSWORD for the disposable local database')
  connection = await mariadb.createConnection({ host: '127.0.0.1', port: databasePort, database, user: 'root',
    password: process.env.SURVEY_LOAD_DB_PASSWORD, connectTimeout: 10_000 })
  const identity = await connection.query('SELECT DATABASE() AS name')
  assert.equal(identity[0].name, database, 'Unexpected database identity')
  const templates = await connection.query("SELECT id FROM survey_templates WHERE status = 'active' ORDER BY version DESC LIMIT 1")
  assert.ok(templates[0], 'Start the API first so its schema and question seed exist')
  const image = await createJpegFixture()
  const activity = await connection.query(`INSERT INTO activities
    (code, name, status, survey_template_id, pre_test_enabled, post_test_enabled, pre_test_duration_minutes, cover_image_data)
    VALUES (?, ?, 'active', ?, TRUE, FALSE, 30, ?)`,
  [`load-${runId}`, 'Synthetic 120-user load verification', templates[0].id, image.dataUrl])
  const activityId = Number(activity.insertId)
  await connection.query('UPDATE activities SET assessment_image_data = ? WHERE id = ?', [image.dataUrl, activityId])
  await connection.query("INSERT INTO qr_codes (activity_id, phase, token) VALUES (?, 'pre', ?)", [activityId, token])
  let firstCode
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomInt(1_000_000, 8_999_000)
    const existing = await connection.query('SELECT COUNT(*) AS total FROM students WHERE student_code BETWEEN ? AND ?',
      [`B${candidate}`, `B${candidate + userCount - 1}`])
    if (Number(existing[0].total) === 0) { firstCode = candidate; break }
  }
  assert.ok(firstCode, 'Could not allocate unused synthetic student codes')
  const users = Array.from({ length: userCount }, (_, index) => ({
    studentCode: `B${firstCode + index}`, firstName: `Load${index + 1}`, lastName: 'Tester', faculty: 'Engineering', major: 'Software',
    studyYear: 2, email: `${runId}-${index}@example.test`, phone: `080${String(index + 1).padStart(7, '0')}`, pdpaConsented: true,
  }))
  report.fixture = { activityId, imageBytes: image.bytes, base64FieldBytes: Buffer.byteLength(image.dataUrl), imagesPerUser: 2 }
  return { activityId, image, users }
}

async function run() {
  recordStage('health-before-load', [await request('/api/health')], 200)
  const { activityId, image, users } = await seed()
  const pages = await Promise.all(users.map(() => request(path())))
  recordStage('load-survey-page', pages, 200)
  check('survey JSON is compact and references media URL', pages.every((result) => result.bytes < 32_768 && result.body?.activity?.imageData === path('/media/cover')))

  const covers = await Promise.all(users.map(() => request(path('/media/cover'), {}, true)))
  recordStage('download-120-cover-images', covers, 200)
  check('every cover is the full binary JPEG', covers.every((result) => result.bytes === image.bytes && result.digest === image.digest && result.contentType?.startsWith('image/jpeg')))
  recordStage('conditional-cover-request', [await request(path('/media/cover'), { headers: { 'if-none-match': covers[0].etag } }, true)], 304)

  const identifications = await Promise.all(users.map((user) => request(path('/identify'), jsonOptions('POST', { studentCode: user.studentCode }))))
  recordStage('identify-120-new-students', identifications, 200)
  check('every new student enters registration', identifications.every((result) => result.body?.next === 'registration'))
  const registrations = await Promise.all(users.map((user) => request(path('/identify'), jsonOptions('POST', user))))
  recordStage('register-120-and-start-session', registrations, 200)
  const sessions = registrations.map((result) => result.body?.surveySession)
  check('every registration returns an assessment session', registrations.every((result) => result.body?.next === 'assessment') && sessions.every((value) => typeof value === 'string'))

  const questions = await Promise.all(sessions.map((session) => request(path('/questions'), sessionOptions(session))))
  recordStage('load-nine-questions', questions, 200)
  check('questions JSON is compact with nine questions and media URL', questions.every((result) => result.bytes < 65_536 && result.body?.questions?.length === 9 && result.body?.activity?.imageData === path('/media/assessment')))
  const assessments = await Promise.all(users.map(() => request(path('/media/assessment'), {}, true)))
  recordStage('download-120-assessment-images', assessments, 200)
  check('every assessment image matches fixture', assessments.every((result) => result.bytes === image.bytes && result.digest === image.digest))
  recordStage('conditional-assessment-request', [await request(path('/media/assessment'), { headers: { 'if-none-match': assessments[0].etag } }, true)], 304)
  const answers = questions.map((result) => result.body.questions.map((question, index) => ({ questionId: question.questionId, competencyId: question.competencyId, levelValue: (index % 7) + 1 })))

  const rescanned = await request(path('/identify'), jsonOptions('POST', { studentCode: users[0].studentCode }))
  recordStage('rescan-existing-student', [rescanned], 200)
  const aliasSession = rescanned.body?.surveySession
  recordStage('original-and-rescanned-tabs-remain-valid', await Promise.all([sessions[0], aliasSession].map((session) => request(path('/questions'), sessionOptions(session)))), 200)
  const reentries = []
  for (let attempt = 0; attempt < 25; attempt += 1) reentries.push(await request(path('/identify'), jsonOptions('POST', { studentCode: users[1].studentCode })))
  recordStage('25-successful-reentries-do-not-trigger-failure-limit', reentries, 200)
  const aliases = await connection.query(`SELECT COUNT(*) AS total FROM survey_session_access_tokens a JOIN survey_sessions s ON s.id = a.survey_session_id
    JOIN students st ON st.id = s.student_id WHERE s.activity_id = ? AND st.student_code = ?`, [activityId, users[1].studentCode])
  check('resumed access aliases are capped at five', Number(aliases[0].total) === 5)
  recordStage('pruned-alias-is-rejected', [await request(path('/questions'), sessionOptions(reentries[0].body.surveySession))], 401)
  recordStage('primary-and-latest-alias-remain-valid', await Promise.all([sessions[1], reentries.at(-1).body.surveySession].map((session) => request(path('/questions'), sessionOptions(session)))), 200)
  recordStage('unknown-session-is-rejected', [await request(path('/questions'), sessionOptions(randomBytes(32).toString('hex')))], 401)

  const usageIds = users.map(() => ({ clientSessionId: randomUUID(), anonymousId: randomUUID() }))
  const telemetry = async () => {
    const results = []
    for (let eventIndex = 0; eventIndex < 10; eventIndex += 1) {
      results.push(...await Promise.all(users.map((_, index) => request('/api/user-usage/events', jsonOptions('POST', {
        ...usageIds[index], eventType: eventIndex === 0 ? 'page_view' : 'interaction', eventName: eventIndex === 0 ? 'survey_loaded' : `assessment_event_${eventIndex}`,
        pagePath: '/s/:token/assessment', occurredAt: new Date().toISOString(), durationSeconds: 0,
        client: { language: 'th-TH', screenWidth: 390, screenHeight: 844, timezone: 'Asia/Bangkok' },
        metadata: { activityId, phase: 'pre', questionNumber: Math.max(1, eventIndex), totalQuestions: 9 },
      }, { 'x-survey-session': sessions[index] })))))
    }
    return results
  }
  const drafts = async () => {
    const results = []
    for (let index = 0; index < 9; index += 1) results.push(...await Promise.all(sessions.map((session, userIndex) => request(path('/draft'), jsonOptions('PUT', { surveySession: session, ...answers[userIndex][index] })))))
    return results
  }
  const [telemetryResults, draftResults] = await Promise.all([telemetry(), drafts()])
  recordStage('1200-telemetry-events-during-assessment', telemetryResults, 202)
  check('all telemetry events accepted for persistence', telemetryResults.every((result) => result.body?.accepted === true))
  recordStage('save-1080-drafts-with-telemetry', draftResults, 204)
  const restored = await Promise.all(sessions.map((session) => request(path('/questions'), sessionOptions(session))))
  recordStage('reload-retains-all-draft-answers', restored, 200)
  check('all 1080 saved answers survive reload', restored.every((result, index) => JSON.stringify([...result.body.draftAnswers].sort((a, b) => a.questionId - b.questionId)) === JSON.stringify([...answers[index]].sort((a, b) => a.questionId - b.questionId))))

  const submissions = await Promise.all(sessions.map((session, index) => Promise.all([0, 1].map(() => request(path('/responses'), jsonOptions('POST', { surveySession: session, answers: answers[index] }))))))
  recordStage('submit-twice-concurrently-per-user', submissions.flat(), [201, 409])
  check('exactly one successful submission per student', submissions.every((pair) => pair.filter((result) => result.status === 201).length === 1 && pair.filter((result) => result.status === 409).length === 1))
  const results = await Promise.all(sessions.map((session) => request(path('/result'), sessionOptions(session))))
  recordStage('load-120-results', results, 200)
  check('results have nine scores and compact media references', results.every((result) => result.bytes < 32_768 && result.body?.competencies?.length === 9 && result.body?.activity?.imageData === path('/media/assessment')))
  recordStage('rescanned-tab-can-load-submitted-result', [await request(path('/result'), sessionOptions(aliasSession))], 200)

  const counts = await connection.query(`SELECT COUNT(DISTINCT r.id) AS responses, COUNT(a.id) AS answers
    FROM survey_responses r JOIN response_answers a ON a.response_id = r.id WHERE r.activity_id = ?`, [activityId])
  check('database contains exactly 120 responses and 1080 answers', Number(counts[0].responses) === 120 && Number(counts[0].answers) === 1080)
  report.database = { responses: Number(counts[0].responses), answers: Number(counts[0].answers) }

  const placeholders = usageIds.map(() => '?').join(',')
  const usageParams = usageIds.map((item) => item.clientSessionId)
  const pollStarted = performance.now()
  let usageCounts
  do {
    const rows = await connection.query(`SELECT COUNT(DISTINCT s.id) AS sessions, COUNT(e.id) AS events, COUNT(DISTINCT s.student_id) AS students
      FROM user_usage_sessions s LEFT JOIN user_usage_events e ON e.usage_session_id = s.id WHERE s.client_session_id IN (${placeholders})`, usageParams)
    usageCounts = rows[0]
    if (Number(usageCounts.events) === 1200) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  } while (performance.now() - pollStarted < 30_000)
  check('all 1200 telemetry events persist within 30 seconds of polling', Number(usageCounts.events) === 1200 && Number(usageCounts.sessions) === 120 && Number(usageCounts.students) === 120)
  const counters = await connection.query(`SELECT COUNT(*) AS total FROM user_usage_sessions WHERE client_session_id IN (${placeholders}) AND event_count = 10 AND page_view_count = 1 AND interaction_count = 9`, usageParams)
  check('stable browser sessions retain correct telemetry counters', Number(counters[0].total) === 120)
  report.database.telemetrySessions = Number(usageCounts.sessions)
  report.database.telemetryEvents = Number(usageCounts.events)
  report.database.telemetryPollMs = Math.round(performance.now() - pollStarted)

  await connection.query(`UPDATE survey_sessions s JOIN students st ON st.id = s.student_id SET s.expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    WHERE s.activity_id = ? AND st.student_code = ?`, [activityId, users[2].studentCode])
  recordStage('expired-session-is-rejected', [await request(path('/result'), sessionOptions(sessions[2]))], 401)
  recordStage('health-after-load', [await request('/api/health')], 200)
  report.completedUsers = 120
  report.failedUsers = 0
}

try {
  await run()
  report.passed = true
} catch (error) {
  report.passed = false
  // Assertions are deliberately data-free; connector errors are sanitized.
  report.error = error?.code === 'ERR_ASSERTION' ? error.message : 'Harness failed; check local API/database availability and test configuration'
  process.exitCode = 1
} finally {
  if (connection) await connection.end()
  report.finishedAt = new Date().toISOString()
  report.totalRequests = report.stages.reduce((sum, stage) => sum + stage.requests, 0)
  await mkdir(new URL('../outputs/', import.meta.url), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ passed: report.passed, users: report.completedUsers ?? 0, requests: report.totalRequests, error: report.error, report: fileURLToPath(reportPath) }))
}
