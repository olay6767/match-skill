import mariadb from 'mariadb'
import { env } from '../config/env.js'

export const pool = mariadb.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // MySQL caching_sha2_password may require full authentication after a restart.
  // Permit RSA key retrieval only in development or on Railway's private network.
  allowPublicKeyRetrieval:
    env.NODE_ENV !== 'production' || env.DB_HOST.toLowerCase().endsWith('.railway.internal'),
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
