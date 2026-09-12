import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createPublicSnapshotCache } from './lib/services/public-snapshot-cache.js'

let time = Date.parse('2026-09-06T00:00:00Z')
let reads = 0
let release
const pending = new Promise(resolve => { release = resolve })
const cache = createPublicSnapshotCache({ ttlMs: 100, maxEntries: 2, now: () => time })
const load = async () => { reads++; await pending; return { rows: [{ name: 'Test only' }] } }
const a = cache('public', load), b = cache('public', load)
release()
const [first, second] = await Promise.all([a, b])
assert.equal(reads, 1)
first.rows[0].name = 'changed by caller'
assert.equal(second.rows[0].name, 'Test only')
assert.equal((await cache('public', load)).rows[0].name, 'Test only')
time += 100
await cache('public', load)
assert.equal(reads, 2, 'expired snapshots refresh, never silently extend freshness')
await assert.rejects(cache('failure', async () => { throw new Error('offline') }), /offline/)
assert.equal(await cache('failure', async () => 'recovered'), 'recovered')
await cache('third', async () => 'third')
await cache('public', load)
assert.equal(reads, 3, 'bounded cache evicts older keys')

const gateway = fs.readFileSync('lib/api-handlers/mini-gateway.js', 'utf8')
const directorySource = gateway.slice(gateway.indexOf('const companyDirectorySnapshotSql'), gateway.indexOf('async function readMiniNotes('))
assert.match(directorySource, /public-directory-v2/)
assert.match(directorySource, /JOIN jobs j ON j\.job_id = h\.source_job_id/)
assert.match(directorySource, /j\.is_approved IS TRUE/)
assert.match(directorySource, /COALESCE\(j\.member_only, FALSE\) IS FALSE/)
assert.doesNotMatch(directorySource, /searchNamedCompanies|ILIKE|current_job\.job_id IS NULL/)

// CloudRun must return stable CloudBase IDs; temporary URL resolution belongs
// to the Mini Program client where the current CloudBase identity is available.
const cloud = fs.readFileSync('cloudrun/index.mjs', 'utf8')
const logoFileId = `cloud://test-env.bucket/mini-company-logos/company-${'a'.repeat(24)}-${'b'.repeat(16)}.png`
const logos = [{ id: 'company', logoFileId, logoUrl: '', hasPublicOpportunity: true, openJobCount: 1 }]
assert.doesNotMatch(cloud, /async function attachPublicImageUrls/)
assert.match(cloud, /async function attachCompanyLogos[\s\S]+return hydrated\s*\n\}/)

const loadTs = (file, dependencies) => {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => dependencies[name], console, Map, Set, Date })
  return module.exports
}
let nativeLookups = 0
const assets = {
  resolveCloudFileUrls: async ids => {
    nativeLookups += ids.filter(value => String(value).startsWith('cloud://')).length
    return new Map(ids.filter(Boolean).map(value => [value, value]))
  },
  isRenderableImageSource: value => /^https?:|^cloud:/.test(value || '')
}
let directoryCompanies = logos
const content = loadTs('miniprogram/src/services/content-service.ts', {
  './cloud-asset-service': assets,
  './api-client': { requestJson: async () => ({ companies: directoryCompanies, access: { scope: 'free_fixed' } }) }
})
assert.equal((await content.fetchCompanies()).companies[0].logoUrl, logoFileId)
assert.equal(nativeLookups, 1)
directoryCompanies = [{ id: 'direct', name: 'Direct', logoFileId, logoUrl: 'https://assets.example/direct.png' }]
assert.equal((await content.fetchCompanies()).companies[0].logoUrl, 'https://assets.example/direct.png')
assert.equal(nativeLookups, 1, 'an existing HTTPS logo must bypass private CloudBase signing')
directoryCompanies = [
  { id: 'legacy', name: 'Legacy Gateway' },
  { id: 'string-fields', name: 'String Fields', hasPublicOpportunity: 'true', openJobCount: '2' },
  { id: 'closed', name: 'Closed', hasPublicOpportunity: false, openJobCount: 2 },
  { id: 'zero-jobs', name: 'Zero Jobs', hasPublicOpportunity: true, openJobCount: 0 }
]
assert.deepEqual(
  (await content.fetchCompanies()).companies.map(({ id }) => id),
  ['legacy', 'string-fields'],
  'old gateway fields remain compatible while explicit closed companies stay hidden'
)
const careerSource = fs.readFileSync('miniprogram/src/services/career-match-service.ts', 'utf8')
const followFn = careerSource.slice(careerSource.indexOf('export async function fetchCompanyFollows('), careerSource.indexOf('export function markCareerWatchUpdatesRead('))
const followModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(followFn, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: followModule, exports: followModule.exports, ...assets, requestJson: async () => ({ follows: logos }) })
assert.equal((await followModule.exports.fetchCompanyFollows()).follows[0].logoUrl, logoFileId)
assert.equal(nativeLookups, 2)
const routeStart = cloud.indexOf("    if (req.method === 'GET' && url.pathname === '/mini/companies') {")
const routeEnd = cloud.indexOf("    if (req.method === 'GET' && /^\\/mini\\/companies", routeStart)
assert.ok(routeStart > 0 && routeEnd > routeStart)
let finishDirectory, metadataStarted = false
const directoryGate = new Promise(resolve => { finishDirectory = resolve })
const route = vm.runInNewContext(`(async () => { ${cloud.slice(routeStart, routeEnd)} })`, {
  req: { method: 'GET' }, res: {}, url: new URL('https://test.example/mini/companies'), requestId: 'test',
  getSession: () => null, gatewayRequest: () => directoryGate,
  readCurrentCompanyJobMetadata: async () => { metadataStarted = true; return new Map() },
  attachCompanyLogos: async companies => companies,
  companyJobMetadata: () => ({ openRoleCategories: ['真实岗位分类测试输入'], jobs: [], publicOpportunityUpdatedAt: null, newJobsUntil: null }),
  send: (_res, _status, payload) => payload
})
const routeResult = route()
assert.equal(metadataStarted, true, 'public job metadata starts before the directory query finishes')
finishDirectory({ companies: [{ id: 'test-company' }], access: { scope: 'free_fixed' } })
assert.equal((await routeResult).companies[0].openRoleCategories[0], '真实岗位分类测试输入')
console.log('Company cache checks passed: live access, scope/query isolation, expiry, NEW deadlines, concurrency, failure recovery, mutation isolation and old-client Logo hydration.')
