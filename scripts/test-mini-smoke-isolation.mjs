import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertPreviewDatabaseIsolation } from './preview-database-safety.mjs'

const production = { VERCEL_ENV: 'production', NEON_DATABASE_DATABASE_URL: 'postgres://u:p@ep-production.neon.tech/db' }
const preview = { VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://u:p@ep-preview.neon.tech/db', WECHAT_MINI_APP_ID: 'wx0000000000000000' }
assert.equal(assertPreviewDatabaseIsolation(preview, production), true)
for (const config of [
  { ...preview, VERCEL_ENV: 'production' },
  { ...preview, DATABASE_URL: production.NEON_DATABASE_DATABASE_URL },
  { ...preview, DATABASE_URL: 'postgres://other:password@ep-production-pooler.neon.tech/other' },
  { ...preview, NEON_DATABASE_DATABASE_URL: production.NEON_DATABASE_DATABASE_URL },
  { ...preview, DATABASE_URL: '' }
]) assert.throws(() => assertPreviewDatabaseIsolation(config, production))
assert.throws(() => assertPreviewDatabaseIsolation(preview, { VERCEL_ENV: 'production' }))

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-smoke-isolation-'))
const script = new URL('./setup-mini-smoke-identities.mjs', import.meta.url).pathname
const writeEnv = (name, config) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n'), { mode: 0o600 })
  return file
}
try {
  const previewFile = writeEnv('preview.env', preview)
  const productionFile = writeEnv('production.env', production)
  // Reproduce both inherited secrets and the default .env that caused the incident.
  writeEnv('.env', production)
  const env = { ...process.env, ...production, MINI_SMOKE_ALLOW_SETUP: 'true' }
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 10000 })
  const args = [`--env-file=${previewFile}`, `--production-env-file=${productionFile}`, '--dry-run']
  const safe = run(args)
  assert.equal(safe.status, 0, safe.stderr)
  assert.deepEqual(JSON.parse(safe.stdout), {
    environment: 'preview', databaseIsolationVerified: true, dryRun: true, prepared: [], customerRecordsChanged: false
  })
  assert.notEqual(run([`--production-env-file=${productionFile}`, '--dry-run']).status, 0, 'ambient Preview variables cannot replace an explicit file')
  const wrong = writeEnv('wrong.env', { ...preview, DATABASE_URL: production.NEON_DATABASE_DATABASE_URL })
  // No dry-run: a mislabeled production target must be rejected before any SQL.
  const blocked = run([`--env-file=${wrong}`, `--production-env-file=${productionFile}`])
  assert.notEqual(blocked.status, 0)
  assert.match(blocked.stderr, /Preview must use a separate database endpoint/)
  assert(!blocked.stderr.includes('postgres://'), 'guard errors must not expose connection credentials')
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}
console.log('Mini smoke isolation passed: explicit config, inherited/default .env ignored, pooled production aliases rejected before SQL, dry-run makes no database calls.')
