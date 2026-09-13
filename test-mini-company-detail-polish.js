import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import path from 'node:path'
import ts from 'typescript'
import { buildCompanyJobMetadata, companyJobMetadata, createCompanyJobMetadataLoader, mapCompanyJobSummary } from './cloudrun/company-directory.mjs'
import * as companyPresentation from './lib/shared/mini-company-presentation.js'
import { JOB_CATEGORY_OPTIONS } from './lib/shared/job-categories.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
function loadTs(path, dependencies) {
  const module = { exports: {} }
  const source = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, console, Date, Map, Set, Promise })
  return module.exports
}

// Synthetic inputs are confined to automated checks, never application data.
const localized = mapCompanyJobSummary({
  id: 'job', companyId: 'company', title: 'Engineer', type: 'full-time', jobType: '全职',
  location: 'Remote', salary: { min: 120000, max: 160000, currency: 'USD', period: 'yearly' },
  translations: { title: '工程师', location: '全球远程', type: '全职' },
  publishedAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-05T12:00:00Z'
}, 'company')
assert.equal(localized.title, '工程师')
assert.equal(localized.location, '全球远程')
assert.equal(localized.jobType, '全职')
assert.equal(localized.salary, '$120k–160k/年')
assert.equal(localized.publishedAt, '2026-09-01T12:00:00Z')
const original = mapCompanyJobSummary({ id: 'job', companyId: 'company', title: 'Engineer',
  type: 'full-time', jobType: '兼职', location: 'Berlin', salary: '{"min":120,"max":160}',
  updatedAt: '2026-09-05', translations: { title: ' ', location: {}, type: '' }
}, 'company')
assert.equal(original.title, 'Engineer')
assert.equal(original.location, 'Berlin')
assert.equal(original.jobType, '兼职')
assert.equal(original.salary, '120–160')
assert.equal(original.publishedAt, null, 'update time must never masquerade as publication time')
assert.equal(mapCompanyJobSummary({ id: 'j', companyId: 'c', title: 'Job', jobType: 'full-time' }, 'c').jobType, '全职')
assert.equal(mapCompanyJobSummary({ id: 'j', companyId: 'c', title: 'Job', jobType: 'part_time' }, 'c').jobType, '兼职')
assert.equal(mapCompanyJobSummary({ id: 'j', companyId: 'c', title: 'Job', jobType: 'unrecognized type' }, 'c').jobType, 'unrecognized type')
assert.equal(mapCompanyJobSummary({ id: 'j', companyId: 'c', title: 'Job', salary: '{"min":9,"max":1}' }, 'c').salary, '')

const calls = []
let storage = {}
const taro = {
  getStorageSync: () => storage,
  setStorageSync: (_, value) => { storage = value },
  cloud: { getTempFileURL: async ({ fileList }) => {
    calls.push(fileList)
    return { fileList: fileList.map((fileID) => ({ fileID, status: 0, tempFileURL: `https://assets.example/${fileID.slice(8)}`, maxAge: 3600 })) }
  } }
}
const assets = loadTs('./miniprogram/src/services/cloud-asset-service.ts', { '@tarojs/taro': { default: taro } })
const ids = Array.from({ length: 75 }, (_, i) => `cloud://env/logo${i}`)
const startedAt = Date.now()
const [first, second] = await Promise.all([assets.resolveCloudFileUrls(ids), assets.resolveCloudFileUrls(ids)])
assert.equal(calls.length, 2, 'overlapping requests must share batches, including later batches')
assert.ok(calls.every((batch) => batch.length <= 50))
assert.equal(first.size, 75)
assert.equal(second.get(ids[74]), first.get(ids[74]))
assert.ok(storage[ids[0]].expiresAt - startedAt > 3_000_000, 'maxAge is seconds, not milliseconds')
await assets.resolveCloudFileUrls(ids)
assert.equal(calls.length, 2, 'warm cache must skip URL requests')
assets.invalidateCloudFileUrl(ids[0])
await assets.resolveCloudFileUrls([ids[0]])
assert.equal(calls.length, 3)
await assets.resolveCloudFileUrls(Array.from({ length: 420 }, (_, i) => `cloud://env/extra${i}`))
assert.ok(Object.keys(storage).length <= 400)

const brokenStorage = loadTs('./miniprogram/src/services/cloud-asset-service.ts', { '@tarojs/taro': { default: {
  getStorageSync: () => { throw new Error('unavailable') },
  setStorageSync: () => { throw new Error('full') },
  cloud: taro.cloud
} } })
assert.match((await brokenStorage.resolveCloudFileUrls([ids[0]])).get(ids[0]), /^https:/)
const offline = loadTs('./miniprogram/src/services/cloud-asset-service.ts', { '@tarojs/taro': { default: {
  getStorageSync: () => ({ 'cloud://bad': { url: {}, expiresAt: Infinity } }), setStorageSync: () => {},
  cloud: { getTempFileURL: async () => { throw new Error('offline test') } }
} } })
assert.equal((await offline.resolveCloudFileUrls([ids[0]])).get(ids[0]), ids[0], 'cloud ID remains a native fallback')

const client = loadTs('./miniprogram/src/services/career-match-service.ts', {
  '@tarojs/taro': { default: taro },
  './retained-resource-cache': { invalidateMiniResource() {} },
  './api-client': { requestJson: async () => ({ success: true, follows: [{ company_id: 'c', logoFileId: ids[0] }] }) },
  './cloud-asset-service': assets,
  './session': {},
  '../utils/runtime-compat': {}
})
assert.match((await client.fetchCompanyFollows()).follows[0].logoUrl, /^https:/)

const roleSummary = loadTs('./miniprogram/src/utils/company-role-summary.ts', {
  '../../../lib/shared/mini-company-presentation': companyPresentation
}).buildCompanyRoleSummary
const roleOptions = { roleGroups: [{ options: [
  { value: '前端开发', families: ['engineering'] }, { value: '产品经理', families: ['product'] },
  { value: '后端开发', families: ['engineering'] }, { value: '财务', families: ['finance'] }
] }] }
const orderedRoles = roleSummary(['财务', '后端开发', '产品经理', '前端开发'],
  { customRoleTerms: ['产品经理', '前端开发'], roleFamilies: ['engineering'] }, roleOptions)
assert.equal(orderedRoles.ariaLabel, '产品经理、前端开发等方向可关注')
assert.equal(orderedRoles.segments.map((role) => role.label).join('|'), '产品经理|前端开发', 'compact copy keeps two complete role names')
assert.equal(orderedRoles.segments.filter((role) => role.matched).length, 2, 'exact choices must not highlight unrelated family members')
assert.equal(roleSummary(['财务', '后端开发', '前端开发'], { customRoleTerms: [], roleFamilies: ['engineering'] }, roleOptions).ariaLabel,
  '后端开发、前端开发等方向可关注', 'resume family fallback stays personalized')
assert.equal(roleSummary(['财务', '产品经理'], null, roleOptions).ariaLabel, '财务、产品经理等方向可关注')
assert.equal(roleSummary(['软件开发', '前端开发', '其他'], null, roleOptions).ariaLabel, '前端开发方向可关注')
assert.equal(roleSummary(['设计', '品牌设计'], null, roleOptions).ariaLabel, '品牌设计方向可关注', 'real categories outside preference options must remain visible')
assert.equal(roleSummary(['财务', '品牌设计'], { customRoleTerms: ['品牌设计'], roleFamilies: [] }, roleOptions).segments[0].matched,
  true, 'a custom direction can match a real category outside the option list')
assert.equal(roleSummary([], null, roleOptions).segments.length, 0, 'missing categories cannot become fabricated directions')
assert.equal(roleSummary(JOB_CATEGORY_OPTIONS, { customRoleTerms: ['财务'], roleFamilies: [] }, roleOptions).segments[0].label,
  '财务', 'a matching category beyond the first twelve must still move to the front')

const metadata = buildCompanyJobMetadata([
  { status: 'active', payload: { companyId: 'real-test-id', title: 'A', category: '产品经理', cachedLogoUrl: 'cloud://test/logo' } },
  { status: 'active', payload: { companyId: 'real-test-id', title: 'B', category: '["前端开发","产品经理"]' } },
  { status: 'closed', payload: { companyId: 'real-test-id', title: 'C', category: '财务' } },
  { status: 'active', payload: { companyId: 'other', title: 'D', category: '财务' } }
], ['real-test-id'])
assert.deepEqual(metadata.get('real-test-id').openRoleCategories, ['产品经理', '前端开发'])
assert.equal(metadata.size, 1)
const legacyMetadata = buildCompanyJobMetadata([
  { id: 'new', companyId: 'c', company: 'Company', title: 'New', category: '财务', publishedAt: '2026-09-01' },
  { id: 'legacy', company: 'Company', title: 'Legacy', category: '产品经理', publishedAt: '2026-08-01' },
  { id: 'unrelated', company: 'Other Company', title: 'Other', category: '销售' }
])
const combined = companyJobMetadata(legacyMetadata, 'c', 'Company')
assert.deepEqual(combined.openRoleCategories, ['财务', '产品经理'])
assert.deepEqual(combined.jobs.map((job) => job.id), ['new', 'legacy'], 'ID-linked jobs cannot hide name-linked public jobs')

let metadataTime = 0
let metadataRequests = 0
let metadataFailed = false
const loadMetadata = createCompanyJobMetadataLoader(async (page) => {
  metadataRequests++
  if (metadataFailed && page === 2) throw new Error('upstream interrupted')
  return { total: 101, jobs: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({
    id: `${page}-${i}`, companyId: 'c', title: 'Test job', category: page === 1 ? '产品经理' : '财务'
  })) }
}, { now: () => metadataTime, ttlMs: 100 })
const [metadataA, metadataB] = await Promise.all([loadMetadata(), loadMetadata()])
assert.equal(metadataRequests, 2, 'all companies and overlapping requests share one paginated snapshot')
assert.equal(metadataA, metadataB)
assert.deepEqual(metadataA.get('c').openRoleCategories, ['产品经理', '财务'])
await loadMetadata()
assert.equal(metadataRequests, 2)
metadataTime = 101
metadataFailed = true
await assert.rejects(loadMetadata(), /upstream interrupted/, 'failed refresh must not present historical categories as current')
metadataFailed = false
await loadMetadata()
assert.equal(metadataRequests, 6, 'failed refresh can retry without caching a partial result')

let jobRequests = 0
let failJobRequest = false
const jobClient = loadTs('./miniprogram/src/services/content-service.ts', {
  './cloud-asset-service': assets,
  './retained-resource-cache': { invalidateMiniResource() {} },
  './api-client': { requestJson: async () => {
    jobRequests++
    if (failJobRequest) throw new Error('permission denied')
    return { success: true, company: { id: 'c', name: 'Company', logoFileId: ids[0] }, job: { title: 'Job' } }
  } }
})
assert.match((await jobClient.fetchCompanyJob('c', 'j')).company.logoUrl, /^https:/)
assert.equal(jobRequests, 1, 'logo hydration must not request company detail separately')
failJobRequest = true
await assert.rejects(jobClient.fetchCompanyJob('c', 'j'), /permission denied/)
assert.equal(jobRequests, 2, 'failed detail must not call an incompatible legacy route')

// Exercise the server cache without network or CloudBase writes. Different
// source origins must never share assets or preview authentication headers.
const cloudrun = read('./cloudrun/index.mjs')
const extract = (start, end) => cloudrun.slice(cloudrun.indexOf(start), cloudrun.indexOf(end))
const imageRequests = []
const imageCache = vm.createContext({
  crypto, path, URL, Date, Map, Promise, Boolean, String, Number, console, AbortSignal,
  apiOrigin: 'https://preview.example', vercelAutomationBypassSecret: 'test-only',
  contentAssetMemory: new Map(), contentAssetPending: new Map(), contentAssetFailureUntil: new Map(),
  os: { tmpdir: () => '/tmp' }, mkdtemp: async () => '/tmp/test-only', rm: async () => {},
  fs: { createWriteStream: () => ({}), createReadStream: () => ({}) },
  Readable: { fromWeb: () => ({}) }, byteLimitTransform: () => ({}), MAX_LOGO_BYTES: 1024,
  pipeline: async () => {}, cloudApp: { uploadFile: async ({ cloudPath }) => ({ fileID: `cloud://test/${cloudPath}` }) },
  fetch: async (source, options) => {
    imageRequests.push({ source, options })
    return { ok: true, headers: { get: () => 'image/webp' }, body: {} }
  }
})
vm.runInContext(extract('function contentOriginUrl(', 'function byteLimitTransform(')
  + extract('async function cacheContentImage(', 'async function attachNoteCovers('), imageCache)
const imageInput = { ownerType: 'company', ownerId: 'test', sourcePath: '/api/company-assets?companyId=test&type=logo&v=1', folder: 'logos' }
const previewLogo = await imageCache.cacheContentImage(imageInput)
const formalLogo = await imageCache.cacheContentImage({ ...imageInput, sourceOrigin: 'https://jobs.example' })
assert.notEqual(previewLogo.fileId, formalLogo.fileId, 'origin changes must invalidate the asset cache')
assert.equal(imageRequests[0].options.headers['x-vercel-protection-bypass'], 'test-only')
assert.equal(imageRequests[0].options.redirect, 'error', 'preview credentials cannot follow redirects')
assert.equal(Object.keys(imageRequests[1].options.headers).length, 0)
assert.match(imageRequests[1].source, /^https:\/\/jobs.example\/api\/company-assets\?/)
await imageCache.cacheContentImage({ ...imageInput, sourceOrigin: 'https://jobs.example' })
assert.equal(imageRequests.length, 2, 'warm server cache must avoid downloading again')
await imageCache.cacheContentImage({ ...imageInput, sourcePath: imageInput.sourcePath.replace('v=1', 'v=2') })
assert.equal(imageRequests.length, 3, 'version changes must refresh the cached image')
await imageCache.cacheContentImage({ ...imageInput, sourcePath: 'https://external.example/logo.webp' })
assert.equal(Object.keys(imageRequests[3].options.headers).length, 0, 'external images cannot receive preview credentials')
assert.match(cloudrun, /sourceOrigin: fallbackSourcePath.startsWith\('\/api\/company-assets\?'\) \? jobsApiOrigin : apiOrigin/)

const detail = read('./miniprogram/src/pages/company-detail/index.tsx')
const styles = read('./miniprogram/src/pages/company-detail/index.scss')
assert.doesNotMatch(detail, /暂未收录企业联系人/)
assert.doesNotMatch(styles, /company-detail__identity\s*>|company-detail__section-heading\s*>\s*text:last-child/)
assert.match(detail, /formatCalendarDate\(job.publishedAt\)/)
assert.match(detail, /boundingClientRect/)
assert.match(detail, /footerHeight/)
assert.doesNotMatch(styles, /company-job__salary\s*\{\s*display:\s*none/)
assert.doesNotMatch(read('./miniprogram/src/pages/followed-companies/index.tsx'), /followed-company__status|暂无开放岗位/)
assert.match(read('./miniprogram/src/components/mini-icon/index.scss'), /\.mini-icon\.nut-icon[\s\S]*color: inherit/)
assert.doesNotMatch(read('./miniprogram/src/components/company-follow-action/index.scss'), /not\(\.is-followed\) \.mini-icon/)
assert.doesNotMatch(read('./miniprogram/src/services/content-service.ts'), /MINI_PLAN_FALLBACKS/)
console.log('mini company detail polish: localization, source integrity, cache, hydration and UI regression checks passed')
