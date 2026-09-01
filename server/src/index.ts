import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { closePool, pool } from './db/pool.js'
import { ensureSchema } from './db/schema.js'
import { ensureDevelopmentAdmin } from './db/seed.js'
import { isDatabaseAvailable, setDatabaseAvailable } from './db/availability.js'
import { errorHandler, notFoundHandler } from './lib/http.js'
import { activitiesRouter } from './routes/activities.js'
import { analyticsRouter } from './routes/analytics.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { participantsRouter } from './routes/participants.js'
import { qrRouter } from './routes/qr.js'
import { publicSurveyRouter } from './routes/publicSurvey.js'
import { reportsRouter } from './routes/reports.js'
import { competenciesRouter, surveyTemplatesRouter } from './routes/surveyTemplates.js'
import { studentsRouter } from './routes/students.js'
import { studentHistoryRouter } from './routes/studentHistory.js'
import { studentPortalRouter } from './routes/studentPortal.js'
import { staffRouter } from './routes/staff.js'
import { userUsageRouter } from './routes/userUsage.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin: [env.ADMIN_FRONTEND_URL, env.USER_FRONTEND_URL],
  credentials: true,
}))
app.use(express.json({ limit: '4mb' }))
app.use(cookieParser())

app.get('/api/health', async (_request, response) => {
  if (isDatabaseAvailable()) await pool.query('SELECT 1 AS connected')
  response.json({
    status: 'ok',
    database: isDatabaseAvailable() ? 'connected' : 'unavailable-development-fallback',
  })
})

app.use('/api/auth', authRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/activities/:id/qr', qrRouter)
app.use('/api/public/surveys', publicSurveyRouter)
app.use('/api/survey-templates', surveyTemplatesRouter)
app.use('/api/competencies', competenciesRouter)
app.use('/api/students', studentsRouter)
app.use('/api/student-history', studentHistoryRouter)
app.use('/api/student-portal', studentPortalRouter)
app.use('/api/participants', participantsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/staff', staffRouter)
app.use('/api/user-usage', userUsageRouter)
app.use(notFoundHandler)
app.use(errorHandler)

try {
  await ensureSchema()
  await ensureDevelopmentAdmin()
} catch (error) {
  if (env.NODE_ENV === 'production') throw error
  setDatabaseAvailable(false)
  console.warn('Database unavailable. Starting with development authentication fallback.')
}

const server = app.listen(env.PORT, () => {
  console.log(`Match Skill API listening on http://localhost:${env.PORT}`)
})

async function shutdown() {
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
