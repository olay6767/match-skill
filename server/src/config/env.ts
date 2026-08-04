import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const projectDirectory = path.resolve(serverDirectory, '..')

dotenv.config({ path: path.join(projectDirectory, '.env.database'), quiet: true })
dotenv.config({ path: path.join(serverDirectory, '.env'), override: true, quiet: true })

const nodeEnvironment = process.env.NODE_ENV ?? 'development'
const developmentJwtSecret = 'local-development-only-change-before-production'

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  DB_USER: z.string().min(1).default('match_skill_app'),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1).default('match_skill'),
  JWT_SECRET: z.string().min(32),
  DEV_ADMIN_EMAIL: z.email().default('admin@matchskill.com'),
  DEV_ADMIN_PASSWORD: z.string().min(8).default('admin1234'),
  DEV_ADMIN_NAME: z.string().min(1).default('Local Administrator'),
})

const rawEnvironment = {
  ...process.env,
  NODE_ENV: nodeEnvironment,
  DB_PASSWORD: process.env.DB_PASSWORD || process.env.MARIADB_PASSWORD,
  JWT_SECRET:
    process.env.JWT_SECRET ??
    (nodeEnvironment === 'production' ? undefined : developmentJwtSecret),
}

export const env = environmentSchema.parse(rawEnvironment)
