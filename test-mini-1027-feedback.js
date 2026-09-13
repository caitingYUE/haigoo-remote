import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createPublicSnapshotCache } from './lib/services/public-snapshot-cache.js'

const read = file => fs.readFileSync(file, 'utf8')
let now = Date.parse('2026-09-06T08:00:00Z')
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])) }
  static now() { return now }
}
function load(file, dependencies = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    }, Date: Clock, Error, console, process: { env: {} }, setTimeout, clearTimeout
  })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const contacts = load('miniprogram/src/utils/company-contacts-copy.ts')
const person = { name: ' Jane\nDoe ', title: 'VP People', email: 'jane@example.com', linkedin: 'https://linkedin.com/in/jane' }
assert.equal(contacts.buildCompanyContactsCopy('Acme', [person]), 'Acme\n联系人: Jane Doe｜VP People｜jane@example.com｜https://linkedin.com/in/jane')
assert.equal(contacts.buildCompanyContactsCopy('Acme', [person, { name: 'Alex' }]), 'Acme\n联系人1: Jane Doe｜VP People｜jane@example.com｜https://linkedin.com/in/jane\n联系人2: Alex｜｜｜')

const rows = Array.from({ length: 20 }, (_, index) => ({
  company_id: `company-${index}`, name: `Test Company ${index}`, role_families: ['engineering'],
  source_job_id: `job-${index}`, title: 'Engineer', location: 'Remote',
  last_seen_at: new Date(now).toISOString(), source_published_at: new Date(now).toISOString(),
  is_public_opportunity: true, url: `https://example.com/jobs/${index}`
}))
const snapshots = new Map()
let writes = 0, candidateReads = 0, failWrite = false, conflictOnce = false
const query = async (sql, params = []) => {
  if (sql.includes('SELECT * FROM career_watch_feed_snapshots')) return snapshots.has(params[0]) ? [plain(snapshots.get(params[0]))] : []
  if (sql.includes('INSERT INTO career_watch_feed_snapshots')) {
    if (failWrite) throw new Error('database write unavailable')
    if (conflictOnce) {
      conflictOnce = false
      const winner = { ...snapshots.get(params[0]), snapshot_revision: (snapshots.get(params[0])?.snapshot_revision || 0) + 1, generated_at: new Date(now + 1).toISOString(), recent_match_batches: [{ companyIds: snapshots.get(params[0])?.recommendations?.map(item => item.companyId) || [], refreshKey: 'cross-instance', generatedAt: new Date(now + 1).toISOString() }, ...(snapshots.get(params[0])?.recent_match_batches || [])].slice(0, 3) }
      snapshots.set(params[0], winner)
      return []
    }
    const previous = snapshots.get(params[0])
    if (previous && (previous.snapshot_revision !== params[6] || previous.profile_version !== params[7])) return []
    writes++
    now++
    const value = { ...previous, snapshot_revision: previous ? previous.snapshot_revision + 1 : 0, user_id: params[0], profile_version: params[1], recommendations: JSON.parse(params[2]), followed_updates: JSON.parse(params[3]), empty_reason: params[4], recent_match_batches: JSON.parse(params[5]), generated_at: new Date(now).toISOString() }
    snapshots.set(params[0], value)
    return [{ generated_at: value.generated_at }]
  }
  if (sql.includes('LIMIT 2500')) { candidateReads++; return rows }
  if (sql.includes('JOIN company_job_history h')) return rows
  return []
}
const service = load('lib/services/career-watch-service.js', {
  '../../server-utils/dal/neon-helper.js': { default: { query } },
  '../shared/job-categories.js': { JOB_CATEGORY_OPTIONS: [] },
  './mini-company-match-service.js': { roleFamiliesForText: () => ['engineering'] },
  './public-snapshot-cache.js': { createPublicSnapshotCache: options => createPublicSnapshotCache({ ...options, now: () => now }) }
})
const profile = { version: 1, status: 'active', roleFamilies: ['engineering'], customRoleTerms: [], activePreferenceKeys: [], companyPreferences: {}, toleranceMode: 'balanced' }
const options = { userId: 'member-a', profile, isMember: true }
const batches = []
for (let index = 0; index < 5; index++) {
  const result = await service.getCareerWatchFeed({ ...options, refreshKey: `visit-${index}` })
  assert.equal(result.recommendations.length, 5)
  const ids = result.recommendations.map(item => item.companyId)
  for (const prior of batches.slice(-3)) assert.equal(ids.filter(id => prior.includes(id)).length, 0, 'avoid each of the previous three batches')
  batches.push(ids)
}
assert.equal(candidateReads, 1, 'per-visit ranking reuses the short-lived public candidate catalog')
assert.equal(snapshots.get('member-a').recent_match_batches.length, 3, 'bounded history')
const writeCount = writes
const stored = plain(snapshots.get('member-a'))
const retried = await service.getCareerWatchFeed({ ...options, refreshKey: 'visit-4' })
assert.equal(retried.generatedAt, stored.generated_at, 'entry retries are idempotent')
assert.equal(writes, writeCount)
now += 86400000
const statusOnly = await service.getCareerWatchFeed(options)
assert.equal(statusOnly.generatedAt, stored.generated_at, 'profile and directory reads do not rotate a member feed')
assert.equal(writes, writeCount)
const [concurrentA, concurrentB] = await Promise.all([
  service.getCareerWatchFeed({ ...options, refreshKey: 'concurrent' }),
  service.getCareerWatchFeed({ ...options, refreshKey: 'concurrent' })
])
assert.equal(concurrentA.generatedAt, concurrentB.generatedAt)
assert.equal(writes, writeCount + 1)
conflictOnce = true
const raced = await service.getCareerWatchFeed({ ...options, refreshKey: 'cross-instance' })
assert.equal(raced.generatedAt, snapshots.get('member-a').generated_at, 'losing a conditional write reads the winning snapshot')
failWrite = true
const stale = await service.getCareerWatchFeed({ ...options, refreshKey: 'offline' })
assert.equal(stale.stale, true)
assert.equal(stale.generatedAt, snapshots.get('member-a').generated_at, 'failed refresh never changes the displayed computation date')
failWrite = false

const originalDate = '2025-01-01T00:00:00.000Z'
const fixed = [...stored.recommendations.slice(0, 4), { ...stored.recommendations[0], companyId: 'closed-company' }]
snapshots.set('free-a', { profile_version: 1, recommendations: stored.recommendations, fixed_recommendations: fixed, fixed_generated_at: originalDate, generated_at: '2026-08-01T00:00:00Z' })
const beforeFree = writes
const free = await service.getCareerWatchFeed({ userId: 'free-a', profile, fixedFree: true, refreshKey: 'attempt-refresh' })
assert.equal(free.generatedAt, originalDate)
assert.equal(free.validUntil, null)
assert.deepEqual(plain(free.recommendations.map(item => item.companyId)), fixed.map(item => item.companyId))
assert.equal(free.recommendations.at(-1).openJobCount, 0, 'closed roles do not replace fixed companies or remain applyable')
assert.equal(free.recommendations.at(-1).applyUrl, '')
assert.equal(writes, beforeFree)
await assert.rejects(service.getCareerWatchFeed({ userId: 'missing-free', profile, fixedFree: true }), /原匹配结果/)
// With a small eligible pool, use real companies only and prefer the oldest batch.
const fallback = await service.computeCareerWatchFeed({ ...options, limit: 5, recentBatches: [
  { companyIds: rows.slice(0, 10).map(row => row.company_id) },
  { companyIds: rows.slice(10).map(row => row.company_id) }
] })
assert.ok(fallback.recommendations.every(item => Number(item.companyId.split('-')[1]) >= 10))

// Execute the actual retention hook with minimal React state primitives.
let state = [], user = { userId: 'a', isMember: true, memberType: 'quarter' }, token = 'a', notices = []
class ApiRequestError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode } }
const hook = load('miniprogram/src/hooks/use-retained-resource.ts', {
  '../services/retained-resource-cache': load('miniprogram/src/services/retained-resource-cache.ts'),
  react: { useState: value => { const index = state.length; state.push(value); return [value, next => { state[index] = typeof next === 'function' ? next(state[index]) : next }] }, useRef: value => ({ current: value }), useCallback: callback => callback, useEffect: () => {} },
  '@tarojs/taro': { showToast: notice => { notices.push(notice); return Promise.resolve() } },
  '../services/api-client': { ApiRequestError },
  '../services/session': { getMiniUser: () => user, getMiniSessionCacheKey: () => token }
}).default()
let reads = 0
const fetchList = async () => { reads++; return ['first'] }
await hook.load('companies', fetchList)
assert.deepEqual(state[0], ['first']); assert.equal(state[1], false)
await hook.load('companies', fetchList)
assert.equal(reads, 1, 'rapid tab returns do not fetch')
now += 60001
let release
const refreshing = hook.load('companies', () => new Promise(resolve => { release = resolve }), true)
assert.deepEqual(state[0], ['first']); assert.equal(state[1], false, 'background refresh never shows full skeleton')
await new Promise(resolve => setImmediate(resolve))
release(['new']); await refreshing
await hook.load('companies', async () => { throw new Error('offline') }, true)
assert.deepEqual(state[0], ['new']); assert.equal(notices.length, 1)
const oldPending = hook.load('companies', () => new Promise(resolve => { release = resolve }), true)
await new Promise(resolve => setImmediate(resolve))
user = { userId: 'b', isMember: false }; token = 'b'
const changedAccount = hook.load('companies', async () => ['free'])
assert.equal(state[0], null, 'old account data is cleared immediately')
await changedAccount
release(['member-secret']); await oldPending
assert.deepEqual(state[0], ['free'], 'late old-account response cannot replace current data')
await hook.load('companies', async () => { throw new ApiRequestError('expired', 403) }, true)
assert.equal(state[0], null); assert.equal(state[2], 'expired')
await hook.load('companies', async () => [])
await hook.load('companies', async () => { throw new Error('must use cached empty result') })
assert.deepEqual(state[0], [], 'empty successful lists are valid cache entries')
await hook.load('sync-failure', () => { throw new Error('synchronous failure') })
assert.deepEqual(state[0], [], 'a synchronous refresh failure keeps the previous result visible')
assert.equal(notices.length, 2, 'a synchronous refresh failure uses the retained-content notice')
await hook.load('sync-failure', async () => ['recovered'])
assert.deepEqual(state[0], ['recovered'], 'a synchronous loader failure must release pending and permit retry')
user = { userId: 'b', isMember: true, memberExpireAt: new Date(now + 1000).toISOString() }
await hook.load('companies', async () => ['member-only'])
now += 1001
const expiredMembership = hook.load('companies', async () => ['public'])
assert.equal(state[0], null, 'expiry invalidates retained member content before the server responds')
await expiredMembership
assert.deepEqual(state[0], ['public'])

const gateway = read('lib/api-handlers/mini-gateway.js')
const badgeSql = gateway.slice(gateway.indexOf('CASE WHEN h.first_seen_at'), gateway.indexOf('AS new_jobs_until') + 17)
assert.match(badgeSql, /first_seen_at <= NOW\(\)/)
assert.match(badgeSql, /j\.created_at <= NOW\(\)/)
assert.doesNotMatch(badgeSql, /h\.(?:source_published_at|last_seen_at|updated_at)/)
assert.match(badgeSql, /INTERVAL '72 hours'/)
assert.match(read('cloudrun/index.mjs'), /career_watch_refresh.*method: 'POST'/)
const matchService = read('miniprogram/src/services/career-match-service.ts')
assert.match(matchService, /careerWatchRefreshUnsupported = false/)
assert.match(matchService, /statusCode === 404/)
assert.match(matchService, /suppressErrorLog: true/)
assert.match(matchService, /requestJson<unknown>\('\/mini\/career-watch', \{ authenticated: true \}\)/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), /formatCalendarDate\(watch\?\.generatedAt\)/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), />你的掌上<\/Text>/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), /watch-brand__title--accent'>远程工作助手<\/Text>/)
assert.doesNotMatch(read('miniprogram/src/pages/index/career-watch-page.tsx'), /根据你的需要，匹配值得关注的远程企业。/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), /经过审核的真实企业与远程岗位信息/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), /关注企业，及时接收岗位更新提醒/)
assert.match(read('miniprogram/src/pages/index/career-watch-page.tsx'), /掌上笔记，随时随地提升远程技能/)

const { companyUpdateDeadline } = load('miniprogram/src/utils/company-update-badge.ts')
const badgeNow = Date.parse('2026-09-06T00:00:00Z')
assert.equal(companyUpdateDeadline({ publicOpportunityUpdatedAt: '2026-09-03T00:00:00Z' }, badgeNow), 0)
assert.equal(companyUpdateDeadline({ publicOpportunityUpdatedAt: '2026-09-03T00:00:01Z' }, badgeNow), badgeNow + 1000)
assert.equal(companyUpdateDeadline({ publicOpportunityUpdatedAt: '2026-09-07T00:00:00Z' }, badgeNow), 0)
assert.equal(companyUpdateDeadline({ newJobsUntil: 'invalid', publicOpportunityUpdatedAt: '2026-09-06T00:00:00Z' }, badgeNow), badgeNow + 72 * 3600000)
assert.equal(companyUpdateDeadline({ newJobsUntil: '2026-09-05T00:00:00Z', publicOpportunityUpdatedAt: '2026-09-06T00:00:00Z' }, badgeNow), 0, 'authoritative expired deadline must not be extended')
assert.equal(companyUpdateDeadline({}, badgeNow), 0)

// A delayed 401 belongs to the session that sent it, never a newly logged-in user.
let activeToken = 'old-session', clears = 0, finishRequest
const api = load('miniprogram/src/services/api-client.ts', {
  '@tarojs/taro': { default: { cloud: { callContainer: () => new Promise(resolve => { finishRequest = resolve }) } } },
  '../config/api': { CLOUD_ENV_ID: 'test', CLOUD_SERVICE_NAME: 'test' },
  './cloud-runtime': { waitForCloudRuntime: async () => {} },
  './session': { getMiniSessionToken: () => activeToken, clearMiniSession: () => { clears++; activeToken = '' } }
})
const expiredRequest = api.requestJson('/test', { authenticated: true }).catch(error => error.statusCode)
await new Promise(setImmediate)
activeToken = 'new-session'
finishRequest({ statusCode: 401, data: {} })
assert.equal(await expiredRequest, 401)
assert.equal(clears, 0)
const currentExpired = api.requestJson('/test', { authenticated: true }).catch(error => error.statusCode)
await new Promise(setImmediate)
finishRequest({ statusCode: 401, data: {} })
assert.equal(await currentExpired, 401)
assert.equal(clears, 1)
activeToken = 'service-auth-session'
const serviceAuthFailure = api.requestJson('/test', { authenticated: true }).catch(error => error.statusCode)
await new Promise(setImmediate)
finishRequest({ statusCode: 401, data: { code: 'UPSTREAM_GATEWAY_AUTH_FAILED', error: 'Unauthorized gateway request' } })
assert.equal(await serviceAuthFailure, 401)
assert.equal(clears, 1, 'an internal gateway credential failure must not log out the end user')
activeToken = 'account-a'
const staleSuccess = api.requestJson('/test', { authenticated: true }).catch(error => error.payload.code)
await new Promise(setImmediate)
activeToken = 'account-b'
finishRequest({ statusCode: 200, data: { privateData: 'belongs to account-a' } })
assert.equal(await staleSuccess, 'SESSION_CHANGED', 'a late successful response must not expose another account data')
assert.equal(activeToken, 'account-b')

console.log('1.0.27 feedback checks passed: contact copy, visit rotation, fixed results, concurrency, retained lists, NEW boundaries and session isolation')
