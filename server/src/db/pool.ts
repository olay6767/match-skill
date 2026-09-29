import mariadb from 'mariadb'
import { env } from '../config/env.js'

export const pool = mariadb.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  allowPublicKeyRetrieval: env.NODE_ENV !== 'production',
  connectTimeout: 5_000,
  connectionLimit: 5,
  acquireTimeout: 10_000,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: true,
})

export async function closePool() {
  await pool.end()
}
