import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const globalModules = execFileSync('npm', ['root', '-g'], {
  cwd: rootDir,
  encoding: 'utf8'
}).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  }
  return { ...value }
}

async function getServiceEnvironment(envId, serviceName) {
  const service = await getCloudrunService(envId)
  const detail = await service.detail({ serverName: serviceName })
  return parseEnvironment(detail.ServerConfig?.EnvParams)
}

function assertPaymentEnvironment(environment, expectedVirtualEnv, label) {
  if (!environment.WECHAT_VIRTUAL_PAYMENT_OFFER_ID) {
    throw new Error(`${label} is missing WECHAT_VIRTUAL_PAYMENT_OFFER_ID`)
  }
  if (String(environment.WECHAT_VIRTUAL_PAYMENT_APP_KEY || '').length < 16) {
    throw new Error(`${label} is missing WECHAT_VIRTUAL_PAYMENT_APP_KEY`)
  }
  if (Number(environment.WECHAT_VIRTUAL_PAYMENT_ENV) !== expectedVirtualEnv) {
    throw new Error(`${label} has an unexpected WECHAT_VIRTUAL_PAYMENT_ENV`)
  }
}

async function expectUnsignedCallbackRejection(origin, headers = {}) {
  const response = await fetch(`${origin}/api/wechat-virtual-payment-notify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      Event: 'runtime_probe',
      Env: origin.includes('mini-preview') ? 1 : 0
    }),
    signal: AbortSignal.timeout(10_000)
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status !== 401 || Number(payload?.ErrCode) !== 401) {
    throw new Error(`${origin} did not reject the unsigned callback at the application layer`)
  }
  return response.status
}

const developmentEnvironment = await getServiceEnvironment(
  'haigoo-dev-d2gctbzxma401b345',
  'haigoo-mini'
)
const productionEnvironment = await getServiceEnvironment(
  'cloud1-d8ggt7rbl273f83c7',
  'haigoo-mini-prod'
)
assertPaymentEnvironment(developmentEnvironment, 1, 'Development CloudRun')
assertPaymentEnvironment(productionEnvironment, 0, 'Production CloudRun')

const bypassSecret = String(developmentEnvironment.VERCEL_AUTOMATION_BYPASS_SECRET || '')
if (bypassSecret.length < 16) {
  throw new Error('Development CloudRun is missing VERCEL_AUTOMATION_BYPASS_SECRET')
}

const [previewStatus, productionStatus] = await Promise.all([
  expectUnsignedCallbackRejection('https://mini-preview.haigooremote.com', {
    'x-vercel-protection-bypass': bypassSecret
  }),
  expectUnsignedCallbackRejection('https://haigooremote.com')
])

console.log(JSON.stringify({
  developmentPaymentEnvironment: 1,
  productionPaymentEnvironment: 0,
  previewCallbackApplicationStatus: previewStatus,
  productionCallbackApplicationStatus: productionStatus,
  unsignedCallbacksRejected: true
}, null, 2))
