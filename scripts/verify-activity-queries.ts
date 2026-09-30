import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { env } from '../server/src/config/env.js'
import { pool } from '../server/src/db/pool.js'
import { activitiesRouter } from '../server/src/routes/activities.js'
import { errorHandler } from '../server/src/lib/http.js'
import { getActivityAnalysisCatalog } from '../server/src/services/activityAnalysisService.js'

assert(['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST), 'Local database only')
assert.notEqual(env.NODE_ENV, 'production', 'Production is not a test target')
const connection = await pool.getConnection()
const originalQuery = pool.query
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined
try {
  const version = await connection.query('SELECT VERSION() AS version')
  console.log(JSON.stringify({ database: version[0].version, fixtures: 'session temporary tables only' }))
  // Temporary tables shadow the real tables only on this dedicated connection.
  for (const table of ['activities', 'survey_responses', 'admins', 'students', 'response_answers']) {
    const definitions = await connection.query(`SHOW CREATE TABLE ${table}`)
    const definition = String(definitions[0]['Create Table'])
      .replace(/^CREATE TABLE/, 'CREATE TEMPORARY TABLE')
      .replace(/^\s*CONSTRAINT[^\n]*\n/gm, '')
      .replace(/,\n\)/g, '\n)')
    await connection.query(definition)
  }
  await connection.query('SET SESSION sort_buffer_size = 32768')
  await connection.query("INSERT INTO admins (id,email,password_hash,full_name,role) VALUES (1,'fixture@example.invalid','unused','Fixture Admin','super_admin')")
  for (let id = 1; id <= 3; id++) {
    await connection.query('INSERT INTO students (id,student_code,email) VALUES (?,?,?)', [id, `B000000${id}`, `fixture${id}@example.invalid`])
  }
  const image = 'data:image/png;base64,' + 'A'.repeat(2_000_000)
  for (let id = 1; id <= 12; id++) {
    const date = `2026-09-${String(id).padStart(2, '0')}`
    await connection.query(`INSERT INTO activities
      (id,name,detail,activity_date,created_at,status,target_group,participant_limit,cover_image_data,assessment_image_data,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, `Fixture ${id}`, `Description ${id}`, date, `${date} 12:00:00`, id % 2 ? 'draft' : 'active', id % 2 ? 'A' : 'B', 10, image, image, 1])
  }
  await connection.query(`INSERT INTO survey_responses (activity_id,student_id,phase)
    VALUES (12,1,'pre'),(12,1,'post'),(12,2,'pre'),(11,3,'post')`)

  // Exercise the actual routes and SQL with a synthetic local admin session.
  pool.query = connection.query.bind(connection) as typeof pool.query
  const app = express()
  app.use(cookieParser())
  app.use('/api/activities', activitiesRouter)
  app.use(errorHandler)
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const token = jwt.sign({ sub: '1', email: 'fixture@example.invalid', role: 'super_admin', sessionVersion: 1 }, env.JWT_SECRET, { expiresIn: '5m' })
  const get = async (path: string, status = 200) => {
    const response = await fetch(url + path, { headers: { Cookie: `match_skill_session=${token}` } })
    assert.equal(response.status, status, `HTTP status for ${path}`)
    return response.json()
  }
  const list = await get('/api/activities?page=1&pageSize=5')
  assert.deepEqual(list.activities.map((item: { id: number }) => item.id), [12,11,10,9,8])
  assert.equal(list.pagination.total, 12)
  assert.equal(list.pagination.totalPages, 3)
  assert.equal(list.activities[0].participants, '2 / 10')
  assert.equal(list.activities[0].preResponses, 2)
  assert.equal(list.activities[0].postResponses, 1)
  assert.equal(list.activities[0].preTest, 100)
  assert.equal(list.activities[0].postTest, 50)
  assert.equal(list.activities[0].imageData, image)
  assert.equal(list.activities[0].assessmentImageData, image)
  assert.equal(list.activities[1].participants, '1 / 10')
  assert.equal(list.activities[2].participants, '0 / 10')
  const lastPage = await get('/api/activities?page=99&pageSize=5')
  assert.deepEqual(lastPage.activities.map((item: { id: number }) => item.id), [2,1])
  assert.equal(lastPage.pagination.page, 3)
  const filtered = await get('/api/activities?status=active&from=2026-09-03&to=2026-09-08&targetGroup=B&pageSize=5')
  assert.deepEqual(filtered.activities.map((item: { id: number }) => item.id), [8,6,4])
  const search = await get('/api/activities?q=Description%2012&pageSize=5')
  assert.equal(search.activities.length, 1)
  const detail = await get('/api/activities/12')
  assert.equal(detail.activity.preResponses, 2)
  assert.equal(detail.activity.postResponses, 1)
  const empty = await get('/api/activities?q=missing-fixture&pageSize=5')
  assert.equal(empty.activities.length, 0)
  await get('/api/activities/999', 404)
  assert.equal((await fetch(url + '/api/activities')).status, 401)
  console.log('PASS activities: pagination, filters, detail, unique participants, Pre/Post counts, 2 MB images, empty results and authentication')

  const catalog = await getActivityAnalysisCatalog({ page: 1, pageSize: 10 })
  assert.equal(catalog.pagination.total, 12)
  assert.equal(catalog.activities[0]?.id, 12)
  assert.equal(catalog.activities[0]?.attendeeCount, 2)
  assert.equal(catalog.activities[0]?.evaluatorCount, 1)
  assert.equal(catalog.activities[0]?.assessmentResponseCount, 2)
  console.log('PASS analytics: catalog query succeeds with the same large-image fixtures')
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
  pool.query = originalQuery
  await connection.end()
  await pool.end()
}
