import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(rootDir, 'cloudrun')
const cloudbaseSdkPath = path.join(sourceDir, 'node_modules/@cloudbase/node-sdk')
const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1]
const configureVercel = process.argv.includes('--configure-vercel')
const configureJobsSource = process.argv.includes('--configure-jobs-source')
const syncPreviewContract = process.argv.includes('--sync-preview-contract')
const previewEnvFile = process.argv.find((argument) => argument.startsWith('--preview-env-file='))?.slice('--preview-env-file='.length) || ''

if (!['development', 'production'].includes(target)) {
  throw new Error('Usage: node scripts/deploy-mini-cloudrun.mjs --target=development|production [--configure-vercel] [--configure-jobs-source] [--sync-preview-contract --preview-env-file=/path/to/preview.env]')
}
if (syncPreviewContract && (target !== 'development' || !previewEnvFile)) {
  throw new Error('--sync-preview-contract is development-only and requires --preview-env-file')
}
await fs.access(cloudbaseSdkPath).catch(() => {
  throw new Error('CloudRun dependencies are missing. Run `npm ci --prefix cloudrun` before deployment.')
})

const environments = {
  development: {
    envId: 'haigoo-dev-d2gctbzxma401b345',
    serviceName: 'haigoo-mini',
    minNum: 1,
    maxNum: 1,
    apiOrigin: 'https://mini-preview.haigooremote.com',
    jobsApiOrigin: 'https://haigooremote.com'
  },
  production: {
    envId: 'cloud1-d8ggt7rbl273f83c7',
    serviceName: 'haigoo-mini-prod',
    minNum: 1,
    maxNum: 2,
    apiOrigin: 'https://haigooremote.com'
  }
}
const development = environments.development
const deployment = environments[target]

function randomSecret() {
  return crypto.randomBytes(48).toString('base64url')
}

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  }
  return { ...value }
}

function safeConfig(baseConfig, environment, minNum, maxNum) {
  return {
    OpenAccessTypes: ['OA', 'MINIAPP'],
    Cpu: baseConfig.Cpu ?? 0,
    Mem: baseConfig.Mem ?? 0,
    MinNum: minNum,
    MaxNum: Math.max(minNum, Number(maxNum)),
    PolicyDetails: baseConfig.PolicyDetails || [],
    CustomLogs: baseConfig.CustomLogs || '',
    EnvParams: JSON.stringify(environment),
    InitialDelaySeconds: baseConfig.InitialDelaySeconds || 0,
    Port: 8080,
    HasDockerfile: true,
    Dockerfile: 'Dockerfile',
    BuildDir: '',
    Tag: ''
  }
}

async function copyDeploymentSource() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `haigoo-mini-${target}-`))
  for (const filename of ['Dockerfile', 'index.mjs', 'company-directory.mjs', 'sync-policy.mjs', 'virtual-payment-reconciliation.mjs', 'package.json', 'package-lock.json', 'container.config.json']) {
    await fs.copyFile(path.join(sourceDir, filename), path.join(tempDir, filename))
  }
  return tempDir
}

function upsertVercelSecret(name, secret, environment = 'production') {
  let result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', name, environment, '--sensitive'],
    { cwd: rootDir, input: `${secret}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
  if (result.status !== 0 && `${result.stderr}\n${result.stdout}`.toLowerCase().includes('already exists')) {
    result = spawnSync(
      'npx',
      ['vercel', 'env', 'update', name, environment, '--sensitive', '--yes'],
      { cwd: rootDir, input: `${secret}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
  }
  if (result.status !== 0) {
    throw new Error(`Unable to configure Vercel ${environment} secret ${name}: ${result.stderr || result.stdout}`)
  }
  console.log(`Vercel ${environment} secret ${name} configured.`)
}

function readExistingAutomationBypass() {
  const payload = JSON.parse(execFileSync('npx', [
    'vercel', 'project', 'protection', 'haigoo-remote', '--json'
  ], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  }))
  const candidates = [payload?.protectionBypass, payload?.project?.protectionBypass, payload]
    .filter((value) => value && typeof value === 'object')
    .flatMap((value) => Object.entries(value))
    .filter(([, value]) => value?.scope === 'automation-bypass')
  const selected = candidates.find(([, value]) => value?.isEnvVar === true) || candidates[0]
  if (!selected?.[0]) throw new Error('No existing Vercel automation bypass is available for development CloudRun')
  return selected[0]
}

function readPreviewContract() {
  const absolutePath = path.resolve(previewEnvFile)
  return fs.readFile(absolutePath, 'utf8').then((source) => {
    const environment = dotenv.parse(source)
    if (environment.VERCEL_ENV !== 'preview') {
      throw new Error('Preview contract file must contain VERCEL_ENV=preview')
    }
    return {
      bypassSecret: readExistingAutomationBypass()
    }
  })
}

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))

const developmentService = await getCloudrunService(development.envId)
const developmentDetail = await developmentService.detail({ serverName: development.serviceName })
const developmentConfig = developmentDetail.ServerConfig || {}
const developmentEnvironment = parseEnvironment(developmentConfig.EnvParams)
const requiredSharedValues = ['HAIGOO_API_ORIGIN', 'WECHAT_MINI_APP_ID', 'WECHAT_MINI_APP_SECRET']
for (const key of requiredSharedValues) {
  if (!developmentEnvironment[key]) throw new Error(`Development CloudRun is missing ${key}`)
}

const targetService = target === 'development'
  ? developmentService
  : await getCloudrunService(deployment.envId)
let existingDetail = null
try {
  existingDetail = await targetService.detail({ serverName: deployment.serviceName })
} catch (error) {
  if (!['ResourceNotFound', 'InvalidParameter'].includes(error?.code)) throw error
}

let targetEnvironment
if (target === 'development') {
  const jobsGatewaySecret = String(developmentEnvironment.MINI_JOBS_GATEWAY_SHARED_SECRET || '') || (
    configureJobsSource ? randomSecret() : ''
  )
  if (!jobsGatewaySecret) {
    throw new Error('Development CloudRun is missing MINI_JOBS_GATEWAY_SHARED_SECRET; run once with --configure-jobs-source')
  }
  if (configureJobsSource) {
    upsertVercelSecret('MINI_GATEWAY_READONLY_SECRET', jobsGatewaySecret)
  }
  targetEnvironment = {
    ...developmentEnvironment,
    TCB_ENV: deployment.envId,
    HAIGOO_API_ORIGIN: deployment.apiOrigin,
    HAIGOO_JOBS_API_ORIGIN: deployment.jobsApiOrigin,
    MINI_JOBS_GATEWAY_SHARED_SECRET: jobsGatewaySecret,
    MINI_CATALOG_SOURCE_SECRET: String(developmentEnvironment.MINI_CATALOG_SOURCE_SECRET || jobsGatewaySecret),
    MINI_CATALOG_SYNC_ENABLED: 'true',
    MINI_CATALOG_SYNC_INTERVAL_MS: '3600000',
    MINI_CATALOG_SYNC_MAX_RECORDS: '5000',
    MINI_MATCH_FIXED_SNAPSHOT_ENABLED: 'true',
    NODE_ENV: 'production'
  }
} else if (existingDetail) {
  targetEnvironment = parseEnvironment(existingDetail.ServerConfig?.EnvParams)
} else {
  targetEnvironment = {
    TCB_ENV: deployment.envId,
    HAIGOO_API_ORIGIN: deployment.apiOrigin,
    MINI_GATEWAY_SHARED_SECRET: randomSecret(),
    MINI_SESSION_SECRET: randomSecret(),
    WECHAT_MINI_APP_ID: developmentEnvironment.WECHAT_MINI_APP_ID,
    WECHAT_MINI_APP_SECRET: developmentEnvironment.WECHAT_MINI_APP_SECRET,
    MINI_SYNC_SECRET: randomSecret(),
    MINI_SYNC_PAGES_PER_RUN: '3',
    MINI_SYNC_WRITE_CONCURRENCY: '4',
    MINI_LOGO_CONCURRENCY: '1',
    MINI_CACHE_REFRESH_MS: '3600000',
    MINI_FULL_SYNC_INTERVAL_MS: '86400000',
    MINI_SYNC_INTERVAL_MS: '3600000',
    MINI_SYNC_LEASE_MS: '900000',
    MINI_LOGO_RETRY_MS: '86400000',
    MINI_LIST_MEMORY_CACHE_MS: '300000',
    MINI_SYNC_STATE_MEMORY_CACHE_MS: '60000',
    MINI_STALE_CLEANUP_MAX_RATIO: '0.2',
    MINI_LOGO_MAX_BYTES: developmentEnvironment.MINI_LOGO_MAX_BYTES || '2097152',
    NODE_ENV: 'production'
  }
  if (!configureVercel) {
    throw new Error('The first production deployment requires --configure-vercel')
  }
  upsertVercelSecret('MINI_GATEWAY_PRODUCTION_SECRET', targetEnvironment.MINI_GATEWAY_SHARED_SECRET)
}

if (syncPreviewContract) {
  const previewContract = await readPreviewContract()
  targetEnvironment = {
    ...targetEnvironment,
    VERCEL_AUTOMATION_BYPASS_SECRET: previewContract.bypassSecret
  }
}

// Apply the current bounded synchronization policy to existing services too;
// otherwise legacy 8-way workers and hourly full-sync settings survive deploys.
targetEnvironment = {
  ...targetEnvironment,
  MINI_SYNC_PAGES_PER_RUN: '3',
  MINI_SYNC_WRITE_CONCURRENCY: '4',
  MINI_LOGO_CONCURRENCY: '1',
  MINI_CACHE_REFRESH_MS: '3600000',
  MINI_FULL_SYNC_INTERVAL_MS: '86400000',
  MINI_SYNC_INTERVAL_MS: '3600000',
  MINI_SYNC_LEASE_MS: '900000',
  MINI_LOGO_RETRY_MS: '86400000',
  MINI_LIST_MEMORY_CACHE_MS: '300000',
  MINI_SYNC_STATE_MEMORY_CACHE_MS: '60000',
  MINI_STALE_CLEANUP_MAX_RATIO: '0.2',
  MINI_MATCH_FIXED_SNAPSHOT_ENABLED: 'true',
  ...(target === 'development' ? {
    MINI_CATALOG_SYNC_ENABLED: 'true',
    MINI_CATALOG_SYNC_INTERVAL_MS: '3600000',
    MINI_CATALOG_SYNC_MAX_RECORDS: '5000',
    MINI_CATALOG_SOURCE_SECRET: String(targetEnvironment.MINI_CATALOG_SOURCE_SECRET || targetEnvironment.MINI_JOBS_GATEWAY_SHARED_SECRET || '')
  } : {})
}

for (const key of [
  'MINI_GATEWAY_SHARED_SECRET',
  'MINI_SESSION_SECRET',
  'WECHAT_MINI_APP_SECRET'
]) {
  if (!targetEnvironment[key]) throw new Error(`Target CloudRun is missing ${key}`)
}
const hasPaymentOffer = Boolean(targetEnvironment.WECHAT_VIRTUAL_PAYMENT_OFFER_ID)
const hasPaymentKey = Boolean(targetEnvironment.WECHAT_VIRTUAL_PAYMENT_APP_KEY)
if (hasPaymentOffer !== hasPaymentKey) {
  throw new Error('WECHAT_VIRTUAL_PAYMENT_OFFER_ID and WECHAT_VIRTUAL_PAYMENT_APP_KEY must be configured together')
}
if (target === 'production' && hasPaymentOffer && Number(targetEnvironment.WECHAT_VIRTUAL_PAYMENT_ENV || 0) !== 0) {
  throw new Error('Production CloudRun must use WECHAT_VIRTUAL_PAYMENT_ENV=0')
}
if (target === 'development' && hasPaymentOffer && Number(targetEnvironment.WECHAT_VIRTUAL_PAYMENT_ENV) !== 1) {
  throw new Error('Development CloudRun must use WECHAT_VIRTUAL_PAYMENT_ENV=1')
}
if (!hasPaymentOffer) {
  console.warn('Virtual payment is not configured; payment endpoints will return 503 until both WeChat credentials are added')
}
if (target === 'development' && !targetEnvironment.VERCEL_AUTOMATION_BYPASS_SECRET) {
  throw new Error('Development CloudRun is missing VERCEL_AUTOMATION_BYPASS_SECRET')
}
if (targetEnvironment.HAIGOO_API_ORIGIN !== deployment.apiOrigin) {
  throw new Error(`${target} CloudRun must use ${deployment.apiOrigin}`)
}
if (target === 'development' && targetEnvironment.HAIGOO_JOBS_API_ORIGIN !== deployment.jobsApiOrigin) {
  throw new Error(`Development CloudRun jobs source must use ${deployment.jobsApiOrigin}`)
}

const baseConfig = existingDetail?.ServerConfig || developmentConfig
const tempDir = await copyDeploymentSource()
const sourceHash = crypto.createHash('sha256')
for (const file of ['index.mjs', 'company-directory.mjs', 'sync-policy.mjs', 'virtual-payment-reconciliation.mjs']) sourceHash.update(await fs.readFile(path.join(tempDir, file)))
const expectedSourceRevision = sourceHash.digest('hex')
try {
  await targetService.deploy({
    serverName: deployment.serviceName,
    targetPath: tempDir,
    serverConfig: safeConfig(baseConfig, targetEnvironment, deployment.minNum, deployment.maxNum)
  })
} finally {
  await fs.rm(tempDir, { recursive: true, force: true })
}

// The SDK only submits an asynchronous deployment. A normal service status can
// still describe its previous version; verify the code actually serving traffic.
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require(cloudbaseSdkPath)
const credential = await checkAndGetCredential(true)
const runtime = cloudbase.init({ env: deployment.envId, secretId: credential.secretId, secretKey: credential.secretKey, sessionToken: credential.token })
let verifiedResponses = 0
for (let attempt = 0; attempt < 60 && verifiedResponses < 2; attempt++) {
  try {
    const response = await runtime.callContainer({ name: deployment.serviceName, method: 'GET', path: '/health' })
    const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    verifiedResponses = response.statusCode === 200 && payload?.sourceRevision === expectedSourceRevision ? verifiedResponses + 1 : 0
  } catch { verifiedResponses = 0 }
  if (verifiedResponses < 2) {
    if (attempt % 6 === 0) console.log('Waiting for the uploaded source to serve development/production traffic...')
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
}
if (verifiedResponses < 2) throw new Error('Deployment not verified: running source does not match the uploaded source')
const deployed = await targetService.detail({ serverName: deployment.serviceName })
const deployedConfig = deployed.ServerConfig || {}
const accessTypes = deployedConfig.OpenAccessTypes || []
if (accessTypes.includes('PUBLIC') || !accessTypes.includes('MINIAPP')) {
  throw new Error(`Unsafe access configuration after deployment: ${accessTypes.join(',')}`)
}
if (Number(deployedConfig.MinNum) !== deployment.minNum) {
  throw new Error(`Unexpected minimum instance count: ${deployedConfig.MinNum}`)
}
if (Number(deployedConfig.MaxNum) !== deployment.maxNum) {
  throw new Error(`Unexpected maximum instance count: ${deployedConfig.MaxNum}`)
}

console.log(JSON.stringify({
  target,
  envId: deployment.envId,
  serviceName: deployment.serviceName,
  sourceRevision: expectedSourceRevision,
  accessTypes,
  minNum: deployedConfig.MinNum,
  maxNum: deployedConfig.MaxNum,
  status: deployed.BaseInfo?.Status || null
}, null, 2))

if (target === 'production' && configureVercel) {
  console.log('Required next command: npx vercel --prod --yes')
}
