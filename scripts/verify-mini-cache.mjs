import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1] || 'development'
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
  throw new Error('Usage: node scripts/verify-mini-cache.mjs --target=development|production')
}

const { envId, serviceName } = environments[target]

function parseEnvironment(value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
  }
  return { ...value }
}

function unwrapDocument(value) {
  if (!value || typeof value !== 'object') return null
  return value._id && value.payload ? value : value.data || value
}

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require(path.join(rootDir, 'cloudrun/node_modules/@cloudbase/node-sdk'))

const service = await getCloudrunService(envId)
const detail = await service.detail({ serverName: serviceName })
const environment = parseEnvironment(detail.ServerConfig?.EnvParams)
let secretId = String(environment.TENCENTCLOUD_SECRETID || '')
let secretKey = String(environment.TENCENTCLOUD_SECRETKEY || '')
let sessionToken = String(environment.TENCENTCLOUD_SESSIONTOKEN || '')
if (!secretId || !secretKey) {
  const cliCredential = await checkAndGetCredential(true)
  secretId = String(cliCredential.secretId || '')
  secretKey = String(cliCredential.secretKey || '')
  sessionToken = String(cliCredential.token || '')
}

const app = cloudbase.init({ env: envId, secretId, secretKey, sessionToken })
const db = app.database()

async function readAll(collectionName, total) {
  const pageSize = 100
  const pages = Math.ceil(total / pageSize)
  const results = await Promise.all(Array.from({ length: pages }, (_, page) => (
    db.collection(collectionName).skip(page * pageSize).limit(pageSize).get()
  )))
  return results.flatMap((result) => Array.isArray(result.data) ? result.data : [])
}

const [listCount, detailCount, featuredCount, rankedCount, stateResult, sampleResult] = await Promise.all([
  db.collection('mini_job_list').count(),
  db.collection('mini_jobs').count(),
  db.collection('mini_job_list').where({ featured: true }).count(),
  db.collection('mini_job_list').where({ defaultRank: db.command.exists(true) }).count(),
  db.collection('mini_sync_state').doc('jobs').get(),
  db.collection('mini_job_list').limit(3).get()
])
const allListDocuments = (await readAll('mini_job_list', Number(listCount.total || 0)))
  .map(unwrapDocument)
  .filter(Boolean)
const cachedLogoCount = allListDocuments.filter((item) => (
  String(item.payload?.cachedLogoUrl || item.payload?.cachedCompanyLogoUrl || '').startsWith('cloud://')
)).length
const state = unwrapDocument(stateResult.data?.[0]) || {}
const samples = (Array.isArray(sampleResult.data) ? sampleResult.data : [])
  .map(unwrapDocument)
  .filter(Boolean)
  .map((item) => ({
    id: item.jobId || item.payload?.id,
    title: item.payload?.title,
    company: item.payload?.company,
    featured: Boolean(item.featured),
    defaultRank: Number.isFinite(Number(item.defaultRank)) ? Number(item.defaultRank) : null,
    hasCachedLogo: String(item.cachedLogoUrl || item.payload?.cachedLogoUrl || '').startsWith('cloud://')
  }))

console.log(JSON.stringify({
  target,
  envId,
  serviceName,
  listDocuments: Number(listCount.total || 0),
  detailDocuments: Number(detailCount.total || 0),
  featuredDocuments: Number(featuredCount.total || 0),
  rankedDocuments: Number(rankedCount.total || 0),
  cachedLogoDocuments: cachedLogoCount,
  state: {
    cacheReady: Boolean(state.cacheReady),
    fullSyncInProgress: Boolean(state.fullSyncInProgress),
    jobsSourceOrigin: state.jobsSourceOrigin || null,
    cacheModelVersion: state.cacheModelVersion || null,
    lastSyncAt: state.lastSyncAt || null,
    lastFullSyncAt: state.lastFullSyncAt || null
  },
  samples
}, null, 2))
