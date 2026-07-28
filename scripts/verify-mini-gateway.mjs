import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1]
const originOverride = process.argv.find((argument) => argument.startsWith('--origin='))?.slice('--origin='.length)
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
  throw new Error('Usage: node scripts/verify-mini-gateway.mjs --target=development|production [--origin=https://...]')
}

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

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))

const selected = environments[target]
const service = await getCloudrunService(selected.envId)
const detail = await service.detail({ serverName: selected.serviceName })
const environment = parseEnvironment(detail.ServerConfig?.EnvParams)
const origin = String(originOverride || environment.HAIGOO_API_ORIGIN || '').replace(/\/+$/, '')
const gatewaySecret = String(environment.MINI_GATEWAY_SHARED_SECRET || '')
const bypassSecret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET || '')

if (!origin || !gatewaySecret) throw new Error('CloudRun gateway configuration is incomplete')

const action = 'sync'
const query = { page: '1', limit: '1' }
const timestamp = String(Date.now())
const bodyHash = crypto.createHash('sha256').update(stableJson(query)).digest('hex')
const signature = crypto.createHmac('sha256', gatewaySecret)
  .update(`GET:${action}:${timestamp}:${bodyHash}`)
  .digest('hex')
const params = new URLSearchParams({ action, ...query })
const response = await fetch(`${origin}/api/mini?${params}`, {
  signal: AbortSignal.timeout(20000),
  headers: {
    Accept: 'application/json',
    ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
    'X-Haigoo-Mini-Timestamp': timestamp,
    'X-Haigoo-Mini-Signature': signature
  }
})
const payload = await response.json().catch(() => null)

if (!response.ok || !payload?.success) {
  throw new Error(`Gateway check failed: HTTP ${response.status} ${payload?.error || 'invalid response'}`)
}

console.log(JSON.stringify({
  target,
  envId: selected.envId,
  serviceName: selected.serviceName,
  origin,
  status: response.status,
  returnedJobs: Array.isArray(payload.jobs) ? payload.jobs.length : null,
  totalJobs: Number(payload.total || 0)
}, null, 2))
