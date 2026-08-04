import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { closePool, pool } from './db/pool.js'
import { ensureSchema } from './db/schema.js'
import { ensureDevelopmentAdmin } from './db/seed.js'
import { errorHandler, notFoundHandler } from './lib/http.js'
import { activitiesRouter } from './routes/activities.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { participantsRouter } from './routes/participants.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', async (_request, response) => {
  await pool.query('SELECT 1 AS connected')
  response.json({ status: 'ok', database: 'connected' })
})

app.use('/api/auth', authRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/participants', participantsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use(notFoundHandler)
app.use(errorHandler)

await ensureSchema()
await ensureDevelopmentAdmin()

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
