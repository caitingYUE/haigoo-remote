import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1]
const originOverride = process.argv.find((argument) => argument.startsWith('--origin='))?.slice('--origin='.length)
const scope = process.argv.find((argument) => argument.startsWith('--scope='))?.split('=')[1] || 'account'
const requestedAction = process.argv.find((argument) => argument.startsWith('--action='))?.split('=')[1] || 'sync'
const featured = process.argv.find((argument) => argument.startsWith('--featured='))?.split('=')[1]
const search = process.argv.find((argument) => argument.startsWith('--search='))?.slice('--search='.length) || ''
const includeLogo = process.argv.includes('--include-logo')
const openid = process.argv.find((argument) => argument.startsWith('--openid='))?.slice('--openid='.length) || ''
const expectedMatchState = process.argv.find((argument) => argument.startsWith('--expect-match-state='))?.split('=')[1] || ''
const expectedCompanyScope = process.argv.find((argument) => argument.startsWith('--expect-company-scope='))?.split('=')[1] || ''
const expectedCompanyTotal = process.argv.find((argument) => argument.startsWith('--expect-company-total='))?.split('=')[1] || ''
const envFile = process.argv.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length) || ''
const useVercelCurl = process.argv.includes('--vercel-curl')
const viaCloudrun = process.argv.includes('--via-cloudrun')
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
  throw new Error('Usage: node scripts/verify-mini-gateway.mjs --target=development|production [--scope=account|jobs] [--origin=https://...] [--featured=true] [--via-cloudrun]')
}
if (!['account', 'jobs'].includes(scope)) throw new Error('Scope must be account or jobs')
if (!['sync', 'content_home', 'companies', 'match_feed', 'career_watch_state', 'career_watch_options', 'membership_plans'].includes(requestedAction)) throw new Error('Unsupported verification action')
if (viaCloudrun && !['career_watch_state', 'career_watch_options', 'membership_plans', 'companies', 'content_home'].includes(requestedAction)) {
  throw new Error('CloudRun verification does not support this Mini Program route')
}
if (viaCloudrun && envFile) throw new Error('CloudRun verification requires CloudBase CLI credentials')

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

function parseResponsePayload(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

const selected = environments[target]
let environment
let cloudbaseContext = null
if (envFile) {
  const resolvedEnvFile = path.resolve(envFile)
  if (!fs.existsSync(resolvedEnvFile)) throw new Error(`Environment file not found: ${resolvedEnvFile}`)
  environment = dotenv.parse(fs.readFileSync(resolvedEnvFile))
} else {
  // `npm --prefix miniprogram run ...` injects a local npm_config_prefix into
  // child processes. Do not let the upload command redirect global CLI lookup
  // into miniprogram/lib/node_modules.
  const cleanNpmEnvironment = { ...process.env }
  delete cleanNpmEnvironment.npm_config_prefix
  delete cleanNpmEnvironment.NPM_CONFIG_PREFIX
  const globalModules = execFileSync('npm', ['root', '-g'], {
    cwd: rootDir,
    encoding: 'utf8',
    env: cleanNpmEnvironment
  }).trim()
  const require = createRequire(import.meta.url)
  require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
  const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
  const service = await getCloudrunService(selected.envId)
  const detail = await service.detail({ serverName: selected.serviceName })
  environment = parseEnvironment(detail.ServerConfig?.EnvParams)
  cloudbaseContext = { globalModules, require, detail }
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
const query = action === 'content_home' || action === 'match_feed' || action === 'career_watch_state'
  ? { openid }
  : action === 'companies'
    ? { openid, page: '1', pageSize: '5' }
  : action === 'career_watch_options' || action === 'membership_plans'
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
  ...(!useVercelCurl && !useJobsScope && bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
  'X-Haigoo-Mini-Timestamp': timestamp,
  'X-Haigoo-Mini-Signature': signature
}
let responseStatus
let payload
if (viaCloudrun) {
  const { globalModules, require, detail } = cloudbaseContext
  if (Number(detail.ServerConfig?.MinNum || 0) < 1) {
    throw new Error('CloudRun verification failed: service must keep at least one warm instance')
  }
  const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
  const cloudbase = require(path.join(rootDir, 'cloudrun/node_modules/@cloudbase/node-sdk'))
  const credential = await checkAndGetCredential(true)
  const app = cloudbase.init({
    env: selected.envId,
    secretId: credential.secretId,
    secretKey: credential.secretKey,
    sessionToken: credential.token
  })
  const sessionSecret = String(environment.MINI_SESSION_SECRET || '')
  const sessionPayload = Buffer.from(JSON.stringify({ openid, userId: 'smoke-check', exp: Date.now() + 5 * 60 * 1000 })).toString('base64url')
  const sessionSignature = sessionSecret
    ? crypto.createHmac('sha256', sessionSecret).update(sessionPayload).digest('base64url')
    : ''
  const route = {
    career_watch_state: '/mini/career-watch',
    career_watch_options: '/mini/career-watch/options',
    membership_plans: '/mini/membership/plans',
    companies: '/mini/companies?page=1&pageSize=5',
    content_home: '/mini/home'
  }[action]
  if (openid && !sessionSignature) throw new Error('CloudRun verification cannot create an authenticated test session')
  const response = await app.callContainer({
    name: selected.serviceName,
    method: 'GET',
    path: route,
    header: {
      Accept: 'application/json',
      'X-Haigoo-Request-Id': `smoke-${crypto.randomUUID()}`,
      ...(openid ? { 'X-Haigoo-Mini-Session': `${sessionPayload}.${sessionSignature}` } : {})
    }
  })
  responseStatus = response.statusCode
  payload = parseResponsePayload(response.data)
} else if (useVercelCurl) {
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
if (action === 'career_watch_state') {
  if (!['unused', 'fixed_free', 'member_dynamic'].includes(payload.matchState) || !Array.isArray(payload.recommendations)) {
    throw new Error('Gateway check failed: Career Watch state contract is missing')
  }
  if (expectedMatchState && payload.matchState !== expectedMatchState) {
    throw new Error(`Gateway check failed: expected Match state ${expectedMatchState}, received ${payload.matchState}`)
  }
}
if (action === 'career_watch_options' && payload.capabilities?.wechatSubscriptionAvailable !== true) {
  throw new Error('Gateway check failed: WeChat subscription configuration is unavailable')
}
if (action === 'membership_plans') {
  const plans = Array.isArray(payload.plans) ? payload.plans : []
  const expectedPlans = new Map([
    ['mini_club_quarter_2026', 199],
    ['mini_club_half_year_2026', 699]
  ])
  const validCatalog = plans.length === expectedPlans.size
    && plans.every((plan) => expectedPlans.get(plan.id) === Number(plan.price))
  if (!validCatalog || payload.paymentAvailable !== true) {
    throw new Error('Gateway check failed: Mini Program membership purchase catalog is unavailable or invalid')
  }
}
if (action === 'companies') {
  const validScopes = new Set(['match_required', 'free_fixed', 'member_all'])
  if (!Array.isArray(payload.companies) || !validScopes.has(payload.access?.scope)) {
    throw new Error('Gateway check failed: company access contract is missing')
  }
  if (expectedCompanyScope && payload.access?.scope !== expectedCompanyScope) {
    throw new Error(`Gateway check failed: expected company scope ${expectedCompanyScope}, received ${payload.access?.scope}`)
  }
  if (expectedCompanyTotal && Number(payload.total) !== Number(expectedCompanyTotal)) {
    throw new Error(`Gateway check failed: expected company total ${expectedCompanyTotal}, received ${payload.total}`)
  }
}

console.log(JSON.stringify({
  target,
  envId: selected.envId,
  serviceName: selected.serviceName,
  transport: viaCloudrun ? 'cloudrun' : 'gateway',
  minInstances: viaCloudrun ? Number(cloudbaseContext.detail.ServerConfig?.MinNum || 0) : null,
  scope,
  origin,
  status: responseStatus,
  returnedCompanies: Array.isArray(payload.companies) ? payload.companies.length : null,
  returnedNotes: Array.isArray(payload.notes) ? payload.notes.length : null,
  returnedJobs: Array.isArray(payload.jobs) ? payload.jobs.length : null,
  returnedRecommendations: Array.isArray(payload.recommendations) ? payload.recommendations.length : null,
  matchState: payload.matchState || null,
  returnedRoleGroups: Array.isArray(payload.filterOptions?.roleGroups) ? payload.filterOptions.roleGroups.length : null,
  returnedRoles: Array.isArray(payload.filterOptions?.roles) ? payload.filterOptions.roles.length : null,
  returnedPlans: Array.isArray(payload.plans) ? payload.plans.map((plan) => ({ id: plan.id, price: plan.price })) : null,
  paymentAvailable: typeof payload.paymentAvailable === 'boolean' ? payload.paymentAvailable : null,
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
