import argon2 from 'argon2'
import { env } from '../config/env.js'
import { pool } from './pool.js'

export async function ensureDevelopmentAdmin() {
  if (env.NODE_ENV === 'production') return

  const rows = await pool.query<{ id: number }[]>(
    'SELECT id FROM admins WHERE email = ? LIMIT 1',
    [env.DEV_ADMIN_EMAIL.toLowerCase()],
  )

  if (rows.length > 0) return

  const passwordHash = await argon2.hash(env.DEV_ADMIN_PASSWORD)
  await pool.query(
    `INSERT INTO admins (email, password_hash, full_name, role)
     VALUES (?, ?, ?, 'admin')`,
    [env.DEV_ADMIN_EMAIL.toLowerCase(), passwordHash, env.DEV_ADMIN_NAME],
  )
}
