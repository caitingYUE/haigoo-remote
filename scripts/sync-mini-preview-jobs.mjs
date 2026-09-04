import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import dotenv from 'dotenv'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const envFile = process.argv.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length)
const apply = process.argv.includes('--apply')

if (!envFile || !fs.existsSync(path.resolve(envFile))) {
  throw new Error('Usage: node scripts/sync-mini-preview-jobs.mjs --env-file=/path/to/preview.env [--apply]')
}
const previewEnvironment = dotenv.parse(fs.readFileSync(path.resolve(envFile)))
if (previewEnvironment.VERCEL_ENV !== 'preview' || !previewEnvironment.DATABASE_URL) {
  throw new Error('Job synchronization is restricted to a configured Preview database')
}

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
const service = await getCloudrunService('haigoo-dev-d2gctbzxma401b345')
const detail = await service.detail({ serverName: 'haigoo-mini' })
const rawEnvironment = detail.ServerConfig?.EnvParams
const cloudrunEnvironment = typeof rawEnvironment === 'string'
  ? JSON.parse(rawEnvironment)
  : Array.isArray(rawEnvironment)
    ? Object.fromEntries(rawEnvironment.map((item) => [item.Key || item.key, item.Value || item.value]))
    : { ...(rawEnvironment || {}) }
const origin = String(cloudrunEnvironment.HAIGOO_JOBS_API_ORIGIN || '').replace(/\/+$/, '')
const secret = String(cloudrunEnvironment.MINI_JOBS_GATEWAY_SHARED_SECRET || '')
if (!origin || secret.length < 32) throw new Error('Formal read-only jobs gateway is unavailable')

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

async function readPage(page) {
  const query = { page: String(page), limit: '100', sortBy: 'recent' }
  const timestamp = String(Date.now())
  const bodyHash = crypto.createHash('sha256').update(stableJson(query)).digest('hex')
  const signature = crypto.createHmac('sha256', secret).update(`GET:sync:${timestamp}:${bodyHash}`).digest('hex')
  const response = await fetch(`${origin}/api/mini?${new URLSearchParams({ action: 'sync', ...query })}`, {
    signal: AbortSignal.timeout(30000),
    headers: {
      Accept: 'application/json',
      'X-Haigoo-Mini-Timestamp': timestamp,
      'X-Haigoo-Mini-Signature': signature
    }
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success || !Array.isArray(payload.jobs)) {
    throw new Error(`Formal jobs page ${page} failed with HTTP ${response.status}`)
  }
  return payload
}

const first = await readPage(1)
const jobs = [...first.jobs]
for (let page = 2; page <= Number(first.totalPages || 1); page += 1) {
  const result = await readPage(page)
  jobs.push(...result.jobs)
}

Object.assign(process.env, previewEnvironment)
const [{ default: neonHelper }, matchService] = await Promise.all([
  import('../server-utils/dal/neon-helper.js'),
  import('../lib/services/mini-company-match-service.js')
])
if (!neonHelper.isConfigured) throw new Error('Preview database is unavailable')
const companies = await neonHelper.query(`SELECT company_id FROM trusted_companies WHERE status = 'active'`)
const companyIds = new Set((companies || []).map((row) => String(row.company_id)))
const currentJobs = jobs.filter((job) => companyIds.has(String(job.companyId || job.company_id || '')))
const currentJobIds = [...new Set(currentJobs.map((job) => String(job.id || job.job_id || '')).filter(Boolean))]

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  formalJobs: jobs.length,
  previewCompanies: companyIds.size,
  eligibleJobs: currentJobs.length
}, null, 2))
if (!apply) process.exit(0)
if (currentJobIds.length < 5) throw new Error('Refusing to replace Preview history with fewer than five current jobs')

await neonHelper.query(
  `UPDATE company_job_history
      SET closed_at = COALESCE(closed_at, NOW()), is_public_opportunity = FALSE, updated_at = NOW()
    WHERE closed_at IS NULL
      AND NOT (source_job_id = ANY($1::text[]))`,
  [currentJobIds]
)

let nextIndex = 0
const workers = Array.from({ length: Math.min(8, currentJobs.length) }, async () => {
  while (nextIndex < currentJobs.length) {
    const job = currentJobs[nextIndex]
    nextIndex += 1
    await matchService.archiveJobSnapshot({ ...job, status: 'active', isApproved: true })
  }
})
await Promise.all(workers)

const invalidSnapshots = await neonHelper.query(
  `DELETE FROM career_watch_feed_snapshots snapshots
    WHERE EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_array_length(COALESCE(snapshots.fixed_recommendations, '[]'::jsonb)) > 0
              THEN snapshots.fixed_recommendations
            ELSE COALESCE(snapshots.recommendations, '[]'::jsonb)
          END
        ) recommendation
       WHERE NOT ((recommendation->>'jobId') = ANY($1::text[]))
    )
    RETURNING user_id`,
  [currentJobIds]
)

const companyQueue = [...companyIds]
let companyIndex = 0
await Promise.all(Array.from({ length: Math.min(6, companyQueue.length) }, async () => {
  while (companyIndex < companyQueue.length) {
    const companyId = companyQueue[companyIndex]
    companyIndex += 1
    await matchService.rebuildCompanyHiringProfile(companyId)
  }
}))
console.log(JSON.stringify({
  applied: true,
  currentJobs: currentJobIds.length,
  invalidSnapshotsRemoved: invalidSnapshots?.length || 0
}, null, 2))
