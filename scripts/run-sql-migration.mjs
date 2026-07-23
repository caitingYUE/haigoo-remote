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

function splitSqlStatements(sqlSource) {
  const statements = []
  let current = ''
  let singleQuoted = false
  let doubleQuoted = false
  let lineComment = false
  let blockCommentDepth = 0
  let dollarTag = ''

  for (let index = 0; index < sqlSource.length; index += 1) {
    const character = sqlSource[index]
    const next = sqlSource[index + 1] || ''

    if (lineComment) {
      if (character === '\n') {
        lineComment = false
        current += '\n'
      }
      continue
    }
    if (blockCommentDepth > 0) {
      if (character === '/' && next === '*') {
        blockCommentDepth += 1
        index += 1
      } else if (character === '*' && next === '/') {
        blockCommentDepth -= 1
        index += 1
      }
      continue
    }
    if (dollarTag) {
      if (sqlSource.startsWith(dollarTag, index)) {
        current += dollarTag
        index += dollarTag.length - 1
        dollarTag = ''
      } else {
        current += character
      }
      continue
    }
    if (singleQuoted) {
      current += character
      if (character === "'" && next === "'") {
        current += next
        index += 1
      } else if (character === "'") {
        singleQuoted = false
      }
      continue
    }
    if (doubleQuoted) {
      current += character
      if (character === '"' && next === '"') {
        current += next
        index += 1
      } else if (character === '"') {
        doubleQuoted = false
      }
      continue
    }

    if (character === '-' && next === '-') {
      lineComment = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      blockCommentDepth = 1
      index += 1
      continue
    }
    if (character === "'") {
      singleQuoted = true
      current += character
      continue
    }
    if (character === '"') {
      doubleQuoted = true
      current += character
      continue
    }
    if (character === '$') {
      const match = sqlSource.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        index += dollarTag.length - 1
        continue
      }
    }
    if (character === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }
    current += character
  }

  if (singleQuoted || doubleQuoted || dollarTag || blockCommentDepth > 0) {
    throw new Error(`Migration contains an unterminated SQL construct: ${migrationName}`)
  }
  const trailing = current.trim()
  if (trailing) statements.push(trailing)
  return statements
}

const statements = splitSqlStatements(source)

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
