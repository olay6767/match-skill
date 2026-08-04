import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAdmin } from '../middleware/auth.js'

type CountRow = { total: number | string }

export const dashboardRouter = Router()
dashboardRouter.use(requireAdmin)

dashboardRouter.get('/summary', async (_request, response) => {
  const [totalRows, activeRows, participantRows, completedRows] = await Promise.all([
    pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM activities'),
    pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM activities
       WHERE status IN ('processing', 'open')`,
    ),
    pool.query<CountRow[]>(
      'SELECT COUNT(DISTINCT participant_id) AS total FROM activity_participants',
    ),
    pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM activities WHERE status = 'completed'`,
    ),
  ])

  response.json({
    summary: {
      totalActivities: Number(totalRows[0]?.total ?? 0),
      activeActivities: Number(activeRows[0]?.total ?? 0),
      participatingStudents: Number(participantRows[0]?.total ?? 0),
      completedAssessments: Number(completedRows[0]?.total ?? 0),
    },
  })
})
