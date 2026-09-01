import path from 'node:path'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const projectDirectory = path.resolve(serverDirectory, '..')

dotenv.config({ path: path.join(projectDirectory, '.env.database'), quiet: true })
dotenv.config({ path: path.join(serverDirectory, '.env'), override: true, quiet: true })

const nodeEnvironment = process.env.NODE_ENV ?? 'development'
const developmentJwtSecret = 'local-development-only-change-before-production'

function localNetworkFrontendUrl(port: number) {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.family === 'IPv4' && !item.internal)
  const privateAddress = addresses.find((item) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
  const address = privateAddress ?? addresses[0]
  return address ? `http://${address.address}:${port}` : `http://localhost:${port}`
}

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_FRONTEND_URL: z.url(),
  USER_FRONTEND_URL: z.url(),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  DB_USER: z.string().min(1).default('match_skill_app'),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1).default('match_skill'),
  JWT_SECRET: z.string().min(32),
  DEV_ADMIN_EMAIL: z.email().default('admin@matchskill.com'),
  DEV_ADMIN_PASSWORD: z.string().min(8).default('admin1234'),
  DEV_ADMIN_NAME: z.string().min(1).default('Local Administrator'),
  BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).default('Production Administrator'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
})

const rawEnvironment = {
  ...process.env,
  NODE_ENV: nodeEnvironment,
  ADMIN_FRONTEND_URL:
    process.env.ADMIN_FRONTEND_URL ??
    process.env.FRONTEND_URL ??
    (nodeEnvironment === 'development' ? localNetworkFrontendUrl(5173) : 'http://localhost:5173'),
  USER_FRONTEND_URL:
    process.env.USER_FRONTEND_URL ??
    process.env.FRONTEND_URL ??
    (nodeEnvironment === 'development' ? localNetworkFrontendUrl(5174) : 'http://localhost:5174'),
  DB_PASSWORD: process.env.DB_PASSWORD || process.env.MARIADB_PASSWORD,
  JWT_SECRET:
    process.env.JWT_SECRET ??
    (nodeEnvironment === 'production' ? undefined : developmentJwtSecret),
}

export const env = environmentSchema.parse(rawEnvironment)
