import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const previewOrigin = 'https://mini-preview.haigooremote.com'
const developmentEnvId = 'haigoo-dev-d2gctbzxma401b345'
const developmentServiceName = 'haigoo-mini'

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  }
  return { ...value }
}

function upsertVercelEnvironment(name, value, environment, { sensitive = true } = {}) {
  const sensitivityArgs = sensitive ? ['--sensitive'] : []
  let result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', name, environment, ...sensitivityArgs],
    { cwd: rootDir, input: `${value}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
  if (result.status !== 0 && `${result.stderr}\n${result.stdout}`.toLowerCase().includes('already exists')) {
    result = spawnSync(
      'npx',
      ['vercel', 'env', 'update', name, environment, ...sensitivityArgs, '--yes'],
      { cwd: rootDir, input: `${value}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
  }
  if (result.status !== 0) {
    throw new Error(`Unable to configure Vercel ${environment} variable ${name}: ${result.stderr || result.stdout}`)
  }
  console.log(`Vercel ${environment} variable ${name} configured`)
}

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))

const developmentService = await getCloudrunService(developmentEnvId)
const developmentDetail = await developmentService.detail({ serverName: developmentServiceName })
const developmentEnvironment = parseEnvironment(developmentDetail.ServerConfig?.EnvParams)
const bypassSecret = String(developmentEnvironment.VERCEL_AUTOMATION_BYPASS_SECRET || '')
if (bypassSecret.length < 16) {
  throw new Error('Development CloudRun is missing VERCEL_AUTOMATION_BYPASS_SECRET')
}

// This script deliberately rotates the relay secret in both environments in
// one operation. Redeploy both Vercel environments immediately afterwards.
const relaySecret = crypto.randomBytes(48).toString('base64url')
for (const environment of ['preview', 'production']) {
  upsertVercelEnvironment(
    'WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET',
    relaySecret,
    environment
  )
}
upsertVercelEnvironment(
  'WECHAT_VIRTUAL_PAYMENT_SANDBOX_CALLBACK_ORIGIN',
  previewOrigin,
  'production',
  { sensitive: false }
)
upsertVercelEnvironment(
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  bypassSecret,
  'production'
)

console.log('Payment callback relay configured. Redeploy Preview and Production before sandbox testing.')
