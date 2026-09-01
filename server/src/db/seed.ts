import argon2 from 'argon2'
import { env } from '../config/env.js'
import { pool } from './pool.js'

export async function ensureAdminSeed() {
  const production = env.NODE_ENV === 'production'
  const email = production ? env.BOOTSTRAP_ADMIN_EMAIL : env.DEV_ADMIN_EMAIL
  const password = production ? env.BOOTSTRAP_ADMIN_PASSWORD : env.DEV_ADMIN_PASSWORD
  const name = production ? env.BOOTSTRAP_ADMIN_NAME : env.DEV_ADMIN_NAME

  if (!email && !password) return
  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together')
  }

  const rows = await pool.query<{ id: number }[]>(
    'SELECT id FROM admins WHERE email = ? LIMIT 1',
    [email.toLowerCase()],
  )

  if (rows.length > 0) return

  const passwordHash = await argon2.hash(password)
  await pool.query(
    `INSERT INTO admins (email, password_hash, full_name, role)
     VALUES (?, ?, ?, 'super_admin')`,
    [email.toLowerCase(), passwordHash, name],
  )
}
