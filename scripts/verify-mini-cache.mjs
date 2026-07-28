import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envId = 'haigoo-dev-d2gctbzxma401b345'
const serviceName = 'haigoo-mini'

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
const cloudbase = require(path.join(rootDir, 'cloudrun/node_modules/@cloudbase/node-sdk'))

const service = await getCloudrunService(envId)
const detail = await service.detail({ serverName: serviceName })
const environment = parseEnvironment(detail.ServerConfig?.EnvParams)
const secretId = String(environment.TENCENTCLOUD_SECRETID || '')
const secretKey = String(environment.TENCENTCLOUD_SECRETKEY || '')
if (!secretId || !secretKey) {
  throw new Error('Development CloudRun does not expose credentials for the cache diagnostic')
}

const app = cloudbase.init({ env: envId, secretId, secretKey })
const db = app.database()
const [listCount, detailCount, featuredCount, stateResult, sampleResult] = await Promise.all([
  db.collection('mini_job_list').count(),
  db.collection('mini_jobs').count(),
  db.collection('mini_job_list').where({ featured: true }).count(),
  db.collection('mini_sync_state').doc('jobs').get(),
  db.collection('mini_job_list').limit(3).get()
])
const state = unwrapDocument(stateResult.data?.[0]) || {}
const samples = (Array.isArray(sampleResult.data) ? sampleResult.data : [])
  .map(unwrapDocument)
  .filter(Boolean)
  .map((item) => ({
    id: item.jobId || item.payload?.id,
    title: item.payload?.title,
    company: item.payload?.company,
    featured: Boolean(item.featured)
  }))

console.log(JSON.stringify({
  envId,
  serviceName,
  listDocuments: Number(listCount.total || 0),
  detailDocuments: Number(detailCount.total || 0),
  featuredDocuments: Number(featuredCount.total || 0),
  state: {
    cacheReady: Boolean(state.cacheReady),
    fullSyncInProgress: Boolean(state.fullSyncInProgress),
    jobsSourceOrigin: state.jobsSourceOrigin || null,
    lastSyncAt: state.lastSyncAt || null,
    lastFullSyncAt: state.lastFullSyncAt || null
  },
  samples
}, null, 2))
