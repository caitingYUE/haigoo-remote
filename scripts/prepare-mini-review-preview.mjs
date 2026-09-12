import assert from 'node:assert/strict'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'
const file = process.argv.find(arg => arg.startsWith('--env-file='))?.slice(11)
assert.ok(file, '--env-file required')
const env = dotenv.parse(fs.readFileSync(file))
assert.equal(env.VERCEL_ENV, 'preview', 'only Preview configuration is permitted')
assert.match(env.DATABASE_URL || '', /^postgres(?:ql)?:\/\//)
fs.chmodSync(file, 0o600)
const sql = neon(env.DATABASE_URL)
const required = ['fixed_recommendations', 'fixed_generated_at', 'snapshot_revision', 'recent_match_batches']
const inspect = async () => (await sql.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'career_watch_feed_snapshots' AND column_name = ANY($1::text[]) ORDER BY column_name", [required]))
const before = await inspect()
const missing = required.filter(name => !before.some(column => column.column_name === name))
if (missing.length) {
  assert.ok(process.argv.includes('--apply'), `Missing migration columns: ${missing.join(', ')}`)
  const statements = fs.readFileSync('server-utils/dal/migrations/084_mini_match_visit_refresh.sql', 'utf8').replace(/^--.*$/gm, '').split(';').filter(statement => statement.trim())
  await sql.transaction(statements.map(statement => sql.query(statement, [])))
}
const after = await inspect()
assert.equal(after.length, required.length)
console.log(JSON.stringify({ target: 'preview', checkedAt: new Date().toISOString(), before, missing, migrationExecuted: missing.length > 0, after }, null, 2))
