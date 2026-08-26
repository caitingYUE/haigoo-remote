import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import dotenv from 'dotenv'

const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1]
const originOverride = process.argv.find((argument) => argument.startsWith('--origin='))?.slice('--origin='.length)
const scope = process.argv.find((argument) => argument.startsWith('--scope='))?.split('=')[1] || 'account'
const requestedAction = process.argv.find((argument) => argument.startsWith('--action='))?.split('=')[1] || 'sync'
const featured = process.argv.find((argument) => argument.startsWith('--featured='))?.split('=')[1]
const search = process.argv.find((argument) => argument.startsWith('--search='))?.slice('--search='.length) || ''
const includeLogo = process.argv.includes('--include-logo')
const openid = process.argv.find((argument) => argument.startsWith('--openid='))?.slice('--openid='.length) || ''
const envFile = process.argv.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length) || ''
const useVercelCurl = process.argv.includes('--vercel-curl')
const environments = {
  development: {
    envId: 'haigoo-dev-d2gctbzxma401b345',
    serviceName: 'haigoo-mini'
  },
  production: {
    envId: 'cloud1-d8ggt7rbl273f83c7',
    serviceName: 'haigoo-mini-prod'
  }
}

if (!environments[target]) {
  throw new Error('Usage: node scripts/verify-mini-gateway.mjs --target=development|production [--scope=account|jobs] [--origin=https://...] [--featured=true]')
}
if (!['account', 'jobs'].includes(scope)) throw new Error('Scope must be account or jobs')
if (!['sync', 'content_home', 'companies', 'match_feed', 'career_watch_options'].includes(requestedAction)) throw new Error('Unsupported verification action')

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  }
  return { ...value }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

const selected = environments[target]
let environment
if (envFile) {
  const resolvedEnvFile = path.resolve(envFile)
  if (!fs.existsSync(resolvedEnvFile)) throw new Error(`Environment file not found: ${resolvedEnvFile}`)
  environment = dotenv.parse(fs.readFileSync(resolvedEnvFile))
} else {
  const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
  const require = createRequire(import.meta.url)
  require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
  const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
  const service = await getCloudrunService(selected.envId)
  const detail = await service.detail({ serverName: selected.serviceName })
  environment = parseEnvironment(detail.ServerConfig?.EnvParams)
}
const useJobsScope = scope === 'jobs'
const origin = String(originOverride || (
  useJobsScope ? environment.HAIGOO_JOBS_API_ORIGIN : environment.HAIGOO_API_ORIGIN
) || '').replace(/\/+$/, '')
const gatewaySecret = String((
  useJobsScope ? environment.MINI_JOBS_GATEWAY_SHARED_SECRET : environment.MINI_GATEWAY_SHARED_SECRET
) || '')
const bypassSecret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET || '')

if (!origin || !gatewaySecret) throw new Error('CloudRun gateway configuration is incomplete')

const action = requestedAction
const query = action === 'content_home' || action === 'match_feed'
  ? { openid }
  : action === 'companies'
    ? { openid, page: '1', pageSize: '5' }
  : action === 'career_watch_options'
    ? {}
  : { page: '1', limit: '20', ...(featured === 'true' ? { featured: 'true' } : {}), ...(search ? { search } : {}) }
const timestamp = String(Date.now())
const bodyHash = crypto.createHash('sha256').update(stableJson(query)).digest('hex')
const signature = crypto.createHmac('sha256', gatewaySecret)
  .update(`GET:${action}:${timestamp}:${bodyHash}`)
  .digest('hex')
const params = new URLSearchParams({ action, ...query })
const requestHeaders = {
  Accept: 'application/json',
  ...(!useJobsScope && bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
  'X-Haigoo-Mini-Timestamp': timestamp,
  'X-Haigoo-Mini-Signature': signature
}
let responseStatus
let payload
if (useVercelCurl) {
  const output = execFileSync('npx', [
    'vercel', 'curl', `/api/mini?${params}`,
    '--deployment', origin,
    '--yes', '--',
    '--silent', '--show-error', '--write-out', '\n%{http_code}',
    ...Object.entries(requestHeaders).flatMap(([key, value]) => ['--header', `${key}: ${value}`])
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const lines = output.trimEnd().split('\n')
  responseStatus = Number(lines.pop())
  payload = JSON.parse(lines.join('\n') || 'null')
} else {
  const response = await fetch(`${origin}/api/mini?${params}`, {
    signal: AbortSignal.timeout(20000),
    headers: requestHeaders
  })
  responseStatus = response.status
  payload = await response.json().catch(() => null)
}

if (responseStatus < 200 || responseStatus >= 300 || !payload?.success) {
  const errorSummary = typeof payload?.error === 'string' ? payload.error : 'invalid response'
  throw new Error(`Gateway check failed: HTTP ${responseStatus} ${errorSummary}`)
}
if (action === 'career_watch_options' && !Array.isArray(payload.filterOptions?.roles)) {
  throw new Error('Gateway check failed: Career Watch option contract is missing')
}
if (action === 'career_watch_options' && payload.capabilities?.wechatSubscriptionAvailable !== true) {
  throw new Error('Gateway check failed: WeChat subscription configuration is unavailable')
}
if (action === 'companies') {
  const validScopes = new Set(['match_required', 'free_fixed', 'member_all'])
  if (!Array.isArray(payload.companies) || !validScopes.has(payload.access?.scope)) {
    throw new Error('Gateway check failed: company access contract is missing')
  }
}

console.log(JSON.stringify({
  target,
  envId: selected.envId,
  serviceName: selected.serviceName,
  scope,
  origin,
  status: responseStatus,
  returnedCompanies: Array.isArray(payload.companies) ? payload.companies.length : null,
  returnedNotes: Array.isArray(payload.notes) ? payload.notes.length : null,
  returnedJobs: Array.isArray(payload.jobs) ? payload.jobs.length : null,
  returnedRecommendations: Array.isArray(payload.recommendations) ? payload.recommendations.length : null,
  returnedRoleGroups: Array.isArray(payload.filterOptions?.roleGroups) ? payload.filterOptions.roleGroups.length : null,
  returnedRoles: Array.isArray(payload.filterOptions?.roles) ? payload.filterOptions.roles.length : null,
  companyAccessScope: payload.access?.scope || null,
  profile: payload.profile ? {
    exists: Boolean(payload.profile.exists),
    completeness: payload.profile.completeness ?? null,
    profileId: payload.profile.profile_id || payload.profile.profileId || null
  } : null,
  matchMeta: payload.meta || null,
  sampleJobs: Array.isArray(payload.jobs)
    ? payload.jobs.slice(0, 3).map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        companyId: job.companyId || null,
        ...(includeLogo ? {
          logo: job.logo || null,
          companyLogo: job.companyLogo || null,
          cachedLogoUrl: job.cachedLogoUrl || null,
          cachedCompanyLogoUrl: job.cachedCompanyLogoUrl || null
        } : {})
      }))
    : [],
  totalJobs: Number(payload.total || 0)
}, null, 2))
