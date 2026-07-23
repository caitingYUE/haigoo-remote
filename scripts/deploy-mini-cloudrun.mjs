import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(rootDir, 'cloudrun')
const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1]
const configureVercel = process.argv.includes('--configure-vercel')

if (!['development', 'production'].includes(target)) {
  throw new Error('Usage: node scripts/deploy-mini-cloudrun.mjs --target=development|production [--configure-vercel]')
}

const environments = {
  development: {
    envId: 'haigoo-dev-d2gctbzxma401b345',
    serviceName: 'haigoo-mini',
    minNum: 0
  },
  production: {
    envId: 'cloud1-d8ggt7rbl273f83c7',
    serviceName: 'haigoo-mini-prod',
    minNum: 1
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

function safeConfig(baseConfig, environment, minNum) {
  return {
    OpenAccessTypes: ['OA', 'MINIAPP'],
    Cpu: baseConfig.Cpu ?? 0,
    Mem: baseConfig.Mem ?? 0,
    MinNum: minNum,
    MaxNum: Math.max(2, Number(baseConfig.MaxNum || 2)),
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
  for (const filename of ['Dockerfile', 'index.mjs', 'package.json', 'package-lock.json', 'container.config.json']) {
    await fs.copyFile(path.join(sourceDir, filename), path.join(tempDir, filename))
  }
  return tempDir
}

function addVercelSecret(secret) {
  let result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', 'MINI_GATEWAY_PRODUCTION_SECRET', 'production', '--sensitive'],
    { cwd: rootDir, input: `${secret}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
  if (result.status !== 0 && `${result.stderr}\n${result.stdout}`.toLowerCase().includes('already exists')) {
    result = spawnSync(
      'npx',
      ['vercel', 'env', 'update', 'MINI_GATEWAY_PRODUCTION_SECRET', 'production', '--sensitive', '--yes'],
      { cwd: rootDir, input: `${secret}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
  }
  if (result.status !== 0) {
    throw new Error(`Unable to configure Vercel production gateway secret: ${result.stderr || result.stdout}`)
  }
  console.log('Vercel production gateway secret configured.')
  console.log('After CloudRun is created, redeploy Vercel Production so the new secret reaches the function runtime.')
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
  targetEnvironment = developmentEnvironment
} else if (existingDetail) {
  targetEnvironment = parseEnvironment(existingDetail.ServerConfig?.EnvParams)
} else {
  targetEnvironment = {
    TCB_ENV: deployment.envId,
    HAIGOO_API_ORIGIN: developmentEnvironment.HAIGOO_API_ORIGIN,
    MINI_GATEWAY_SHARED_SECRET: randomSecret(),
    MINI_SESSION_SECRET: randomSecret(),
    WECHAT_MINI_APP_ID: developmentEnvironment.WECHAT_MINI_APP_ID,
    WECHAT_MINI_APP_SECRET: developmentEnvironment.WECHAT_MINI_APP_SECRET,
    MINI_SYNC_SECRET: randomSecret(),
    MINI_SYNC_PAGES_PER_RUN: '3',
    MINI_SYNC_WRITE_CONCURRENCY: '8',
    MINI_LOGO_CONCURRENCY: '2',
    MINI_LOGO_MAX_BYTES: developmentEnvironment.MINI_LOGO_MAX_BYTES || '2097152',
    NODE_ENV: 'production'
  }
  if (!configureVercel) {
    throw new Error('The first production deployment requires --configure-vercel')
  }
  addVercelSecret(targetEnvironment.MINI_GATEWAY_SHARED_SECRET)
}

for (const key of ['MINI_GATEWAY_SHARED_SECRET', 'MINI_SESSION_SECRET', 'WECHAT_MINI_APP_SECRET']) {
  if (!targetEnvironment[key]) throw new Error(`Target CloudRun is missing ${key}`)
}

const baseConfig = existingDetail?.ServerConfig || developmentConfig
const tempDir = await copyDeploymentSource()
try {
  await targetService.deploy({
    serverName: deployment.serviceName,
    targetPath: tempDir,
    serverConfig: safeConfig(baseConfig, targetEnvironment, deployment.minNum)
  })
} finally {
  await fs.rm(tempDir, { recursive: true, force: true })
}

const deployed = await targetService.detail({ serverName: deployment.serviceName })
const deployedConfig = deployed.ServerConfig || {}
const accessTypes = deployedConfig.OpenAccessTypes || []
if (accessTypes.includes('PUBLIC') || !accessTypes.includes('MINIAPP')) {
  throw new Error(`Unsafe access configuration after deployment: ${accessTypes.join(',')}`)
}
if (Number(deployedConfig.MinNum) !== deployment.minNum) {
  throw new Error(`Unexpected minimum instance count: ${deployedConfig.MinNum}`)
}

console.log(JSON.stringify({
  target,
  envId: deployment.envId,
  serviceName: deployment.serviceName,
  accessTypes,
  minNum: deployedConfig.MinNum,
  maxNum: deployedConfig.MaxNum,
  status: deployed.BaseInfo?.Status || null
}, null, 2))

if (target === 'production' && configureVercel) {
  console.log('Required next command: npx vercel --prod --yes')
}
