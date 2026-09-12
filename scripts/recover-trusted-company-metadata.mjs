import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const confirm = args.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length)
const envFileArg = args.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length)
const envFile = path.resolve(rootDir, envFileArg || '.env.production.local')

assert.ok(fs.existsSync(envFile), `Environment file not found: ${envFile}`)
const environment = dotenv.parse(fs.readFileSync(envFile))
const productionUrl = environment.NEON_DATABASE_DATABASE_URL || environment.DATABASE_URL
const sourceUrl = process.env.RECOVERY_SOURCE_DATABASE_URL
assert.ok(productionUrl, 'Production database URL is missing')
assert.ok(sourceUrl, 'RECOVERY_SOURCE_DATABASE_URL is required')
assert.notEqual(new URL(productionUrl).hostname, new URL(sourceUrl).hostname, 'Recovery source must not be the production endpoint')
if (apply) assert.equal(confirm, 'restore-26-companies', 'Apply requires --confirm=restore-26-companies')

const production = neon(productionUrl)
const source = neon(sourceUrl)
const incidentStart = "timestamp '2026-09-10 18:00:00'"
const incidentEnd = "timestamp '2026-09-11 13:00:00'"
const sourceCutoff = new Date('2026-09-10T10:15:00Z')

const fields = [
  { name: 'industry', type: 'text' },
  { name: 'tags', type: 'jsonb' },
  { name: 'translations', type: 'jsonb' },
  { name: 'employee_count', type: 'text' },
  { name: 'hiring_email', type: 'text' },
  { name: 'email_type', type: 'text' },
  { name: 'referral_contacts', type: 'jsonb' },
  { name: 'founded_year', type: 'text' },
  { name: 'specialties', type: 'jsonb' },
  { name: 'company_rating', type: 'text' },
  { name: 'rating_source', type: 'text' }
]
const fieldNames = fields.map(({ name }) => name)
const selectFields = ['company_id', 'name', ...fieldNames].join(', ')

function isEmpty(value) {
  if (value == null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return typeof value === 'object' && Object.keys(value).length === 0
}

function isIncidentDefault(field, value) {
  if (field === 'industry') return isEmpty(value) || value === '其他' || value === 'Other'
  if (field === 'company_rating') return isEmpty(value) || String(value).trim() === '0'
  return isEmpty(value)
}

function normalizeSourceValue(field, value, sourceRow) {
  if (field === 'industry' && (value === '其他' || value === 'Other')) return null
  if (field === 'company_rating' && String(value || '').trim() === '0') return null
  if (field === 'rating_source' && String(sourceRow.company_rating || '').trim() === '0') return null
  if (field === 'hiring_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return null
  return value
}

function parameterValue(field, value) {
  return field.type === 'jsonb' ? JSON.stringify(value) : value
}

const victims = await production.query(`
  SELECT ${selectFields}, updated_at::text AS expected_updated_at
    FROM trusted_companies
   WHERE last_crawled_at >= ${incidentStart}
     AND last_crawled_at < ${incidentEnd}
     AND ABS(EXTRACT(EPOCH FROM (updated_at - last_crawled_at))) < 900
   ORDER BY name
`, [])
assert.equal(victims.length, 41, `Expected 41 incident companies, found ${victims.length}`)

const sourceRows = await source.query(
  `SELECT ${selectFields}, updated_at FROM trusted_companies WHERE company_id = ANY($1::text[])`,
  [victims.map((company) => company.company_id)]
)
const sourceById = new Map(sourceRows.map((company) => [company.company_id, company]))
const plan = []

for (const current of victims) {
  const prior = sourceById.get(current.company_id)
  if (!prior) continue
  assert.ok(new Date(prior.updated_at) < sourceCutoff, `${current.name} source row is not pre-incident`)
  const restore = {}
  for (const field of fieldNames) {
    const sourceValue = normalizeSourceValue(field, prior[field], prior)
    if (isIncidentDefault(field, current[field]) && !isEmpty(sourceValue)) restore[field] = sourceValue
  }
  if (Object.keys(restore).length > 0) plan.push({ current, restore })
}

assert.equal(plan.length, 26, `Expected 26 recoverable companies, found ${plan.length}`)
const fieldCounts = Object.fromEntries(fieldNames.map((field) => [field, 0]))
for (const { restore } of plan) {
  for (const field of Object.keys(restore)) fieldCounts[field] += 1
}

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  incidentCompanies: victims.length,
  recoverableCompanies: plan.length,
  missingSourceCompanies: victims.filter((company) => !sourceById.has(company.company_id)).map((company) => company.name),
  fieldCounts,
  companies: plan.map(({ current, restore }) => ({ name: current.name, fields: Object.keys(restore) }))
}
console.log(JSON.stringify(summary, null, 2))
if (!apply) process.exit(0)

const backup = {
  createdAt: new Date().toISOString(),
  incidentWindow: { start: '2026-09-10 18:00:00 Asia/Shanghai', end: '2026-09-11 13:00:00 Asia/Shanghai' },
  companies: plan.map(({ current, restore }) => ({
    companyId: current.company_id,
    name: current.name,
    expectedUpdatedAt: current.expected_updated_at,
    original: Object.fromEntries(fieldNames.map((field) => [field, current[field]])),
    restored: restore
  }))
}
const backupText = `${JSON.stringify(backup, null, 2)}\n`
const backupHash = crypto.createHash('sha256').update(backupText).digest('hex')
const backupDir = path.join(rootDir, 'audit', 'production-recovery')
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 })
const backupPath = path.join(backupDir, `trusted-company-metadata-${Date.now()}.json`)
fs.writeFileSync(backupPath, backupText, { mode: 0o600, flag: 'wx' })

const updateQueries = plan.map(({ current, restore }) => {
  const restoreFields = fields.filter(({ name }) => Object.hasOwn(restore, name))
  const values = restoreFields.map((field) => parameterValue(field, restore[field.name]))
  const setClauses = restoreFields.map((field, index) => (
    `${field.name} = $${index + 1}${field.type === 'jsonb' ? '::jsonb' : ''}`
  ))
  const idIndex = values.length + 1
  const updatedAtIndex = values.length + 2
  return production.query(`
    WITH updated AS (
      UPDATE trusted_companies
         SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE company_id = $${idIndex}
         AND updated_at = $${updatedAtIndex}::timestamp
       RETURNING company_id
    )
    SELECT 1 / COUNT(*)::int AS optimistic_lock_guard FROM updated
  `, [...values, current.company_id, current.expected_updated_at])
})

await production.transaction(updateQueries)

const verifyRows = await production.query(
  `SELECT ${selectFields} FROM trusted_companies WHERE company_id = ANY($1::text[])`,
  [plan.map(({ current }) => current.company_id)]
)
const verifiedById = new Map(verifyRows.map((company) => [company.company_id, company]))
for (const { current, restore } of plan) {
  const saved = verifiedById.get(current.company_id)
  assert.ok(saved, `Missing company after recovery: ${current.name}`)
  for (const field of Object.keys(restore)) {
    assert.deepEqual(saved[field], restore[field], `${current.name}.${field} did not persist`)
  }
}

console.log(JSON.stringify({
  applied: true,
  recoveredCompanies: plan.length,
  backupFile: path.relative(rootDir, backupPath),
  backupSha256: backupHash,
  verifiedCompanies: verifyRows.length
}, null, 2))
