import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { mapCompanyJobDetail, buildCompanyJobMetadata } from './cloudrun/company-directory.mjs'

const read = (file) => fs.readFileSync(file, 'utf8')
function load(source, dependencies = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    }, Map, Set, Promise, Date, console
  })
  return module.exports
}
// Test-only records never enter an application bundle or a remote database.
for (const modern of [false, true]) {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('pg_attribute')) return modern ? [{ attname: 'job_title_snapshot' }, { attname: 'company_name_snapshot' }] : []
    return []
  }
  const store = load(read('lib/services/job-favorites-service.js'), { '../../server-utils/dal/neon-helper.js': { default: { query } } })
  await Promise.all([store.saveJobFavorite('user-a', 'job-1', { title: '工程师', company: '企业' }), store.saveJobFavorite('user-b', 'job-2')])
  assert.equal(calls.filter((call) => call.sql.includes('pg_attribute')).length, 1, 'concurrent requests share schema detection')
  const writes = calls.filter((call) => call.sql.includes('INSERT'))
  assert.equal(writes.length, 2)
  for (const write of writes) {
    assert.equal(write.sql.includes('job_title_snapshot'), modern, 'legacy writes must not reference missing columns')
    assert.match(write.sql, /ON CONFLICT \(user_id, job_id\) DO NOTHING/)
  }
  assert.equal(writes[0].params[0], 'user-a')
  assert.equal(writes[1].params[0], 'user-b')
  await store.readJobFavorites('user-a')
  assert.match(calls.at(-1).sql, /to_jsonb\(f\)->>'job_title_snapshot'/)
  assert.equal(calls.at(-1).params[0], 'user-a')
}
const broken = load(read('lib/services/job-favorites-service.js'), { '../../server-utils/dal/neon-helper.js': { default: { query: async () => { throw new Error('database unavailable') } } } })
await assert.rejects(broken.saveJobFavorite('user-a', 'job-1'), /database unavailable/, 'never report success on database errors')

const { formatJobApplicationCopy } = load(read('miniprogram/src/utils/job-application-copy.ts'))
const job = mapCompanyJobDetail({ id: 'j', companyId: 'c', company: '企业', title: 'Engineer', category: '前端开发', jobType: 'full-time', experienceLevel: 'senior', location: 'Remote', translations: { title: '前端工程师', location: '全球远程' }, url: 'https://example.com/apply' }, 'c')
assert.equal(formatJobApplicationCopy(job, '', 'url', job.officialApplyUrl), '【前端工程师】 【企业】\n全球远程｜前端开发｜全职｜高级\n申请链接：https://example.com/apply')
assert.equal(formatJobApplicationCopy({ title: 'Engineer', company: 'Company' }, '', 'email', 'jobs@example.com'), '【Engineer】 【Company】\n申请邮箱：jobs@example.com')
const presentation = load(read('miniprogram/src/utils/match-card-presentation.ts'))
assert.equal(presentation.conciseCompanyDescription('欢迎加入。我们是一家开发协作工具的企业。团队遍布全球。'), '我们是一家开发协作工具的企业')
assert.equal(presentation.conciseCompanyDescription('Team news. We provide tools for developers. Join us.'), 'We provide tools for developers')
assert.equal(presentation.conciseCompanyDescription(''), '')
assert.ok(presentation.conciseCompanyDescription('很长的企业介绍'.repeat(30)).length <= 86)
const watch = read('lib/services/career-watch-service.js')
assert.match(watch.slice(watch.indexOf('async function applyLiveRecommendationState'), watch.indexOf('function careerWatchSnapshotMeta')), /description: localizedCompanyDescription\(latest\)/)

const jsx = (type, props) => ({ type, props })
const { default: Deck } = load(read('miniprogram/src/components/match-company-deck/index.tsx'), {
  'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/components': { View: 'view', Swiper: 'swiper', SwiperItem: 'swiper-item' },
  '../../utils/match-deck': { wrapDeckIndex: (i, count) => count > 0 ? (i % count + count) % count : 0 }, './index.scss': {}
})
const changes = []
const tree = Deck({ items: [{ companyId: 'a' }, { companyId: 'b' }, { companyId: 'c' }], snapshotId: 'fixed', activeIndex: 2, onActiveIndexChange: (...args) => changes.push(args), renderCard: () => null })
const swiper = tree.props.children
assert.equal(swiper.type, 'swiper'); assert.equal(swiper.props.duration, 280); assert.equal(swiper.props.circular, true)
swiper.props.onChange({ detail: { current: 0, source: '' } }); assert.equal(changes.length, 0)
swiper.props.onChange({ detail: { current: 0, source: 'touch' } }); assert.deepEqual(changes[0], [0, 'left'])
assert.equal(Deck({ items: [], activeIndex: 0 }), null)

const cloud = read('cloudrun/index.mjs')
const routes = cloud.slice(cloud.indexOf("    if (req.method === 'GET' && url.pathname === '/mini/favorites')"), cloud.indexOf("    if (req.method === 'GET' && url.pathname === '/mini/applications')"))
const runRoute = (method, path, body, deps = {}) => vm.runInNewContext(`(async () => { ${routes} })()`, {
  req: { method }, res: {}, url: new URL(`https://local.test${path}`), getSession: () => ({ userId: 'user-a', openid: 'account-a' }),
  readBody: async () => body, send: (_, status, payload) => ({ status, payload }), canonicalJobId: (id) => String(id).trim(), ...deps
})
let metadataReads = 0
const favoriteData = [{ jobId: 'j', createdAt: '2026-09-05', title: 'old title', company: '企业' }]
const deps = { gatewayRequest: async () => ({ favorites: favoriteData }), readCurrentCompanyJobMetadata: async () => { metadataReads++; return buildCompanyJobMetadata([{ id: 'j', companyId: 'c', company: '企业', title: 'Engineer', translations: { title: '工程师' } }]) } }
assert.equal((await runRoute('GET', '/mini/favorites?idsOnly=true', {}, deps)).payload.favoriteJobIds[0], 'j')
assert.equal(metadataReads, 0)
assert.equal((await runRoute('GET', '/mini/favorites', {}, deps)).payload.favorites[0].job.title, '工程师')
assert.equal(metadataReads, 1)
assert.equal((await runRoute('GET', '/mini/favorites', {}, { getSession: () => null })).status, 401)
let upstreamReads = 0
const postDeps = { fetchUpstreamJob: async () => { upstreamReads++; return null }, gatewayRequest: async (_, args) => args.body }
assert.equal((await runRoute('POST', '/mini/favorites', { jobId: 'deleted', favorite: false }, postDeps)).status, 200)
assert.equal(upstreamReads, 0, 'removal must work for missing or closed postings')
assert.equal((await runRoute('POST', '/mini/favorites', { jobId: 'deleted', favorite: true }, postDeps)).status, 404)
assert.equal((await runRoute('POST', '/mini/favorites', { jobId: '', favorite: true }, postDeps)).status, 400)
for (const file of ['lib/api-handlers/mini-gateway.js', 'lib/api-handlers/user-profile.js']) assert.match(read(file), /saveJobFavorite\(/)
assert.match(read('miniprogram/src/app.config.ts'), /pages\/favorite-jobs\/index/)
assert.match(read('miniprogram/src/pages/profile/index.tsx'), /pages\/favorite-jobs\/index/)
const detailPage = read('miniprogram/src/pages/job-detail/index.tsx')
const toggleSource = detailPage.slice(detailPage.indexOf('  const toggleFavorite ='), detailPage.indexOf('  if (error)'))
let writes = 0
let refreshedFavorite = null
await vm.runInNewContext(`${toggleSource}; toggleFavorite()`, {
  favoriteBusy: false, favorite: null, jobId: 'j', companyId: 'c', hasAuthenticatedSession: () => true,
  setFavoriteBusy: () => {}, fetchFavoriteJobIds: async () => new Set(['j']),
  setJobFavorite: async () => { writes++ }, setFavorite: (value) => { refreshedFavorite = value }, showToast: () => {}
})
assert.equal(refreshedFavorite, true)
assert.equal(writes, 0, 'retrying an unknown favorite state must not silently remove a saved job')
const secondPage = await runRoute('GET', '/mini/favorites?page=2', {}, {
  ...deps, gatewayRequest: async () => ({ favorites: Array.from({ length: 31 }, (_, i) => ({ jobId: `j${i}` })) })
})
assert.equal(secondPage.payload.favorites.length, 1)
assert.equal(secondPage.payload.favorites[0].jobId, 'j30')
assert.equal(secondPage.payload.hasMore, false)
assert.equal(secondPage.payload.favorites[0].job, null)
console.log('Favorites legacy/modern schema, account isolation, source validation, pagination route, native swipe, factual intro and copy regressions passed')

// A legacy payload must not masquerade as two unavailable saved jobs.
let favoriteResponse = { favorites: [{ jobId: 'j' }], jobs: [job] }
const favoritesClient = load(read('miniprogram/src/services/content-service.ts'), {
  './api-client': { requestJson: async () => favoriteResponse }, './cloud-asset-service': {}
})
await assert.rejects(favoritesClient.fetchFavoriteJobs(), /收藏记录暂时无法加载/)
favoriteResponse = { favorites: [{ jobId: 'j', job }], page: 1, hasMore: false }
assert.equal((await favoritesClient.fetchFavoriteJobs()).favorites[0].job.title, '前端工程师')
favoriteResponse = { favorites: [{ jobId: 'gone', job: null }], page: 1, hasMore: false }
assert.equal((await favoritesClient.fetchFavoriteJobs()).favorites[0].job, null, 'explicit unavailable record remains removable')

const followsSource = read('lib/services/mini-company-match-service.js')
  .split('export async function setCompanyFollow')[1].split('export async function listCompanyFollows')[0]
for (const active of [true, false]) {
  const queries = []
  const result = await vm.runInNewContext(`(async () => { async function setCompanyFollow${followsSource}; return setCompanyFollow({ user: { user_id: 'u' }, companyId: 'c', active: ${active} }); })()`, {
    FOLLOWS_TABLE: 'mini_company_follows', neonHelper: {
      query: async (sql, params) => { queries.push({ sql, params }); return [{}] },
      getClient: () => ({ query: (sql, params) => { queries.push({ sql, params }); return { sql, params } }, transaction: async () => [[{ user_id: 'u' }], [{ company_id: 'c' }]] })
    }
  })
  assert.equal(result.followed, active)
  const insert = queries.find(({ sql }) => sql.includes('INSERT'))
  assert.equal(insert.params[2], active ? 'active' : 'inactive')
  assert.match(insert.sql, /\$3::varchar, \(\$3::varchar = 'active'\)/, 'status insert and comparison must share an explicit Postgres type')
  assert.match(insert.sql, /WHEN EXCLUDED.status = 'inactive'.*THEN FALSE/)
}
console.log('Legacy favorites response rejection and follow/unfollow SQL parameter typing passed')
