import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const migrationName = String(process.argv[2] || '').trim()
if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(migrationName)) {
  throw new Error('Usage: node scripts/run-sql-migration.mjs <NNN_migration_name.sql>')
}

const databaseUrl = process.env.NEON_DATABASE_DATABASE_URL || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('NEON_DATABASE_DATABASE_URL or DATABASE_URL is required')

const migrationPath = path.resolve('server-utils/dal/migrations', migrationName)
const migrationsRoot = path.resolve('server-utils/dal/migrations') + path.sep
if (!migrationPath.startsWith(migrationsRoot) || !fs.existsSync(migrationPath)) {
  throw new Error(`Migration not found: ${migrationName}`)
}

const source = fs.readFileSync(migrationPath, 'utf8')
const statements = source
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

const sql = neon(databaseUrl)
await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`, [])

const existing = await sql.query(
  'SELECT migration_name FROM schema_migrations WHERE migration_name = $1 LIMIT 1',
  [migrationName]
)
if (existing.length > 0) {
  console.log(`${migrationName} already applied`)
  process.exit(0)
}

await sql.transaction([
  ...statements.map((statement) => sql.query(statement, [])),
  sql.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [migrationName])
])
console.log(`${migrationName} applied successfully (${statements.length} statements)`)
