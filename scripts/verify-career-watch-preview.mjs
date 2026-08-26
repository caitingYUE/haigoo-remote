import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const origin = 'https://mini-preview.haigooremote.com'
const envId = 'haigoo-dev-d2gctbzxma401b345'
const serviceName = 'haigoo-mini'

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  return { ...value }
}

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
const service = await getCloudrunService(envId)
const detail = await service.detail({ serverName: serviceName })
const environment = parseEnvironment(detail.ServerConfig?.EnvParams)
const bypassSecret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET || '')

const response = await fetch(`${origin}/api/career-watch`, {
  signal: AbortSignal.timeout(20000),
  headers: {
    Accept: 'application/json',
    ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {})
  }
})
const payload = await response.json().catch(() => null)
if (!response.ok || !payload?.success || !payload?.filterOptions) {
  throw new Error(`Career Watch check failed: HTTP ${response.status} ${payload?.error || 'invalid response'}`)
}

const options = payload.filterOptions
const valid = options.roles?.length > 0
  && options.industries?.length > 0
  && options.roles.every((item) => item.value && item.label && Number(item.count) > 0)
  && options.industries.every((item) => item.value === item.label && Number(item.count) > 0)
if (!valid) throw new Error('Career Watch returned an empty or non-database-backed option set')

const [{ default: neonHelper }, { computeCareerWatchFeed }] = await Promise.all([
  import('../server-utils/dal/neon-helper.js'),
  import('../lib/services/career-watch-service.js')
])
const identities = await neonHelper.query('SELECT user_id FROM mini_wechat_identities ORDER BY linked_at ASC LIMIT 1', [])
if (!identities?.[0]?.user_id) throw new Error('Preview has no bound account available for a read-only Match check')
const profile = {
  status: 'active',
  roleFamilies: [options.roles[0].value],
  activePreferenceKeys: ['industry'],
  companyPreferences: { industries: [options.industries[0].value] },
  toleranceMode: 'balanced'
}
const feed = await computeCareerWatchFeed({ userId: identities[0].user_id, profile, isMember: false })
if (!feed.recommendations.length) throw new Error('Real-data Match check returned no recommendations')

console.log(JSON.stringify({
  origin,
  status: response.status,
  roles: options.roles.length,
  teamSizes: options.teamSizes.length,
  ratings: options.ratings.length,
  companyAges: options.companyAges.length,
  industries: options.industries.map((item) => item.value),
  publicRecommendations: payload.recommendations?.length || 0,
  matchedRecommendations: feed.recommendations.length
}, null, 2))
