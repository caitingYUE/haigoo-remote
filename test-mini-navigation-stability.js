import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

let now = Date.parse('2026-09-12T04:00:00Z')
class Clock extends Date { static now() { return now } }
const tick = () => new Promise(setImmediate)
function load(file, dependencies) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { module, exports: module.exports, Date: Clock, setTimeout, clearTimeout, require(name) {
    if (name in dependencies) return dependencies[name]
    if (name.includes('/components/')) return { default: name }
    if (name.endsWith('.scss') || name.endsWith('.jpg') || name.endsWith('.svg')) return {}
    throw new Error(`Unexpected dependency: ${name}`)
  } })
  return module.exports
}
const cache = load('miniprogram/src/services/retained-resource-cache.ts', {})
const storage = new Map()
let shown, pulls
const taro = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
  eventCenter: { trigger() {}, on() {}, off() {} }, useDidShow: fn => { shown = fn }, usePullDownRefresh: fn => { pulls = fn },
  showToast() {}, stopPullDownRefresh() {}, getSystemInfoSync: () => ({ windowWidth: 375 }),
  login: async () => ({ code: 'mock-code' })
}
const session = load('miniprogram/src/services/session.ts', { '@tarojs/taro': taro, '../config/api': { CLOUD_ENV_ID: 'test' } })
const account = { userId: 'a', isMember: true, memberType: 'quarter', memberExpireAt: '2026-10-01T00:00:00Z', token: 'first' }
session.saveMiniSession(account)
const initialKey = session.getMiniSessionCacheKey()
session.saveMiniSession({ ...account, token: 'renewed' })
assert.equal(session.getMiniSessionCacheKey(), initialKey, 'token renewal preserves page memory')
session.clearMiniSession(); session.saveMiniSession(account)
assert.notEqual(session.getMiniSessionCacheKey(), initialKey, 'logout/relogin invalidates old page memory even for the same account')
let authCalls = 0
const auth = load('miniprogram/src/services/mini-auth-service.ts', {
  '@tarojs/taro': { default: taro }, './session': session,
  './api-client': { requestJson: async () => { authCalls++; return { token: `token-${authCalls}`, user: { ...account, ...session.getMiniUser() } } } },
  './analytics-service': { trackMiniEvent: async () => {} }, '../config/legal': {}
})
await Promise.all([auth.refreshWechatSessionIfStale(), auth.refreshWechatSessionIfStale()])
assert.equal(authCalls, 1, 'overlapping navigation shares a session check')
await auth.refreshWechatSessionIfStale(); assert.equal(authCalls, 1, 'rapid navigation makes no new login request')
now += 300001
await auth.refreshWechatSessionIfStale(); assert.equal(authCalls, 2, 'remote entitlement changes are periodically checked')
session.saveMiniSession({ ...session.getMiniUser(), memberExpireAt: new Date(now + 1000).toISOString() })
now += 1001
await auth.refreshWechatSessionIfStale(); assert.equal(authCalls, 3, 'expiry bypasses the freshness window')
await auth.refreshWechatSessionIfStale(0); assert.equal(authCalls, 4, 'purchase/refund checks bypass freshness')
session.saveMiniSession({ ...account, userId: 'b' })
await auth.refreshWechatSessionIfStale(); assert.equal(authCalls, 5, 'new account cannot inherit the previous freshness window')
session.saveMiniSession(account)

function reactHarness() {
  let cursor = 0
  const slots = []
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i] },
    useMemo(fn) { return fn() }, useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++; if (!(i in slots) || deps?.some((d, n) => !Object.is(d, slots[i][n]))) { slots[i] = deps || []; fn() } }
  }
  return { react, render(fn) { cursor = 0; return fn() } }
}
const r = reactHarness()
const retained = load('miniprogram/src/hooks/use-retained-resource.ts', {
  '../services/retained-resource-cache': cache, react: r.react, '@tarojs/taro': taro, '../services/session': session, '../services/api-client': { ApiRequestError: class extends Error {} }
})
let resource = r.render(() => retained.default('companies:a')), reads = 0
await resource.load('companies:a', async () => { reads++; return ['a'] })
session.saveMiniSession({ ...account, token: 'another-renewal' })
await resource.load('companies:a', async () => { reads++; return ['wrong'] })
assert.equal(reads, 1, 'real session + hook retain content across token renewal')
await resource.load('companies:b', async () => ['b'])
await resource.load('companies:a', async () => { throw new Error('cached filter must not request') })
resource = r.render(() => retained.default('companies:a'))
assert.deepEqual(resource.data, ['a'], 'returning to a loaded filter restores its own data')
let finish
const updating = resource.load('companies:a', () => new Promise(resolve => { finish = resolve }), true)
await tick(); resource = r.render(() => retained.default('companies:a'))
assert.deepEqual(resource.data, ['a']); assert.equal(resource.loading, false, 'refresh keeps the content frame')
finish(['updated']); await updating
session.saveMiniSession({ ...account, userId: 'other' })
const switched = resource.load('companies:a', async () => ['other'])
assert.equal(r.render(() => retained.default('companies:a')).data, null, 'account change clears private content')
await switched
session.saveMiniSession(account)

const client = load('miniprogram/src/services/career-match-service.ts', {
  '@tarojs/taro': { default: taro }, './api-client': {}, './cloud-asset-service': {}, './session': session, '../utils/runtime-compat': {}
})
const watch = {
  snapshotId: 'today', matchState: 'member_dynamic', generatedAt: new Date(now).toISOString(), validUntil: new Date(now + 3600000).toISOString(),
  profile: null, recommendations: [{ companyId: 'a' }, { companyId: 'b' }, { companyId: 'c' }], followedUpdates: [], entitlements: { isMember: true }, filterOptions: { roles: [] }
}
assert.equal(client.isCareerWatchCacheValid(watch, now + 7 * 3600000), true, 'the six-hour server snapshot TTL must not rotate cards within the same product day')
assert.equal(client.isCareerWatchCacheValid(watch, now + 24 * 3600000), false)
assert.equal(client.careerWatchDailyRefreshKey(Date.parse('2026-09-12T16:00:00Z')), 'match-day:2026-09-13')
assert.equal(client.isCareerWatchCacheValid({ ...watch, matchState: 'fixed_free' }, now + 10 * 86400000), true)
storage.set(session.careerWatchStorageKey('a'), watch)
storage.set('haigoo:match-deck:a:today', 2)
const m = reactHarness(), requests = []
let nextWatch = watch
const jsx = (type, props) => ({ type, props })
const Match = load('miniprogram/src/pages/index/career-watch-page.tsx', {
  react: m.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/taro': { ...taro, default: taro },
  '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView' },
  '../../services/retained-resource-cache': cache, '../../services/session': session, '../../services/mini-auth-service': auth,
  '../../services/career-match-service': { ...client, normalizeCareerWatchResponse: value => value, fetchCareerWatch: async key => { requests.push(key); return key ? nextWatch : watch } },
  '../../services/analytics-service': { trackMiniEvent: async () => {} }, '../../hooks/use-retained-resource': retained,
  '../../hooks/use-mini-share': { default() {} }, '../../utils/match-deck': load('miniprogram/src/utils/match-deck.ts', {}),
  '../../utils/runtime-compat': { formatCalendarDate: () => '' }
}).default
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of [tree.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found }
  return null
}
const deck = tree => find(tree, node => String(node.type).includes('match-company-deck'))
let tree = m.render(Match)
assert.equal(deck(tree).props.activeIndex, 2, 'saved position is present on the first render, before swiper mounting')
shown(); await tick(); tree = m.render(Match)
shown(); await tick(); tree = m.render(Match)
assert.equal(requests.length, 0, 'valid cached Match performs no feed request on first entry or return')
assert.equal(deck(tree).props.activeIndex, 2, 'tab returns do not reset cards')
deck(tree).props.onActiveIndexChange(1, 'right'); tree = m.render(Match)
shown(); await tick(); tree = m.render(Match)
assert.equal(deck(tree).props.activeIndex, 1, 'user-selected card survives return')
now += 86400000
nextWatch = { ...watch, snapshotId: 'tomorrow', generatedAt: new Date(now).toISOString() }
shown(); await tick(); tree = m.render(Match)
assert.equal(requests.length, 2, 'expired day reads state then performs one idempotent daily refresh')
assert.equal(requests[1], client.careerWatchDailyRefreshKey())
assert.equal(deck(tree).props.snapshotId, 'today', 'new data does not replace the current deck automatically')
assert.equal(deck(tree).props.activeIndex, 1)
shown(); await tick(); tree = m.render(Match)
assert.equal(requests.length, 2, 'pending update does not re-fetch on every return')
find(tree, node => node.props?.className === 'watch-feed__update').props.onClick()
tree = m.render(Match)
assert.equal(deck(tree).props.snapshotId, 'tomorrow', 'user loads the new daily snapshot')
assert.equal(deck(tree).props.activeIndex, 0)
console.log('PASS: navigation stability — session renewal, cache isolation, filter restore, retained refresh, daily Match and manual deck updates')

// Execute the real membership page and hook, including explicit refresh and failure retention.
const memberReact = reactHarness()
const memberHook = load('miniprogram/src/hooks/use-retained-resource.ts', {
  '../services/retained-resource-cache': cache, react: memberReact.react, '@tarojs/taro': taro,
  '../services/session': session, '../services/api-client': { ApiRequestError: class extends Error {} }
})
let planReads = 0, failPlans = false
const Membership = load('miniprogram/src/pages/membership/index.tsx', {
  react: memberReact.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/taro': { ...taro, default: taro },
  '@tarojs/components': { View: 'View', Text: 'Text' }, '../../hooks/use-retained-resource': memberHook,
  '../../services/session': session, '../../services/mini-auth-service': auth,
  '../../services/content-service': { fetchMembershipPlans: async () => {
    planReads++; if (failPlans) throw new Error('offline')
    return { plans: [], membership: { isMember: true }, paymentAvailable: true }
  } },
  '../../services/analytics-service': { trackMiniEvent: async () => {} },
  '../../services/virtual-payment-service': { isVirtualPaymentSupported: () => true }, '../../utils/runtime-compat': { formatCalendarDate: () => '' }
}).default
memberReact.render(Membership); shown(); await tick(); memberReact.render(Membership)
shown(); await tick(); memberReact.render(Membership)
assert.equal(planReads, 1, 'membership navigation reuses confirmed plans and entitlement state')
await pulls(); memberReact.render(Membership)
assert.equal(planReads, 2, 'explicit refresh still requests current membership')
failPlans = true
await pulls(); tree = memberReact.render(Membership)
assert.equal(find(tree, node => String(node.type).includes('content-skeleton')), null, 'failed membership refresh keeps the loaded frame')
console.log('PASS: membership page reuses its payload on return and retains it during an explicit failed update')

// Invalidations also prevent a pre-mutation request from caching stale data.
session.saveMiniSession(account)
let finishStale
resource = r.render(() => retained.default('companies:a'))
const stale = resource.load('companies:a', () => new Promise(resolve => { finishStale = resolve }), true)
await tick(); cache.invalidateMiniResource('companies:'); finishStale(['before-mutation']); await stale
await resource.load('companies:a', async () => ['after-mutation'])
assert.deepEqual(r.render(() => retained.default('companies:a')).data, ['after-mutation'])
console.log('PASS: data mutation invalidates pending snapshots and the next load retrieves current content')

let releaseBeforeChange
const beforeChange = resource.load('companies:a', () => new Promise(resolve => { releaseBeforeChange = resolve }), true)
await tick()
cache.invalidateMiniResource('companies:')
let mutationReads = 0
await resource.load('companies:a', async () => { mutationReads++; return ['latest-mutation'] })
assert.equal(mutationReads, 1, 'invalidation must bypass an older request that is still in flight')
releaseBeforeChange(['outdated']); await beforeChange
assert.deepEqual(r.render(() => retained.default('companies:a')).data, ['latest-mutation'])

let swipes = 0
const Deck = load('miniprogram/src/components/match-company-deck/index.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/components': { View: 'View', Swiper: 'Swiper', SwiperItem: 'SwiperItem' },
  '../../utils/match-deck': load('miniprogram/src/utils/match-deck.ts', {})
}).default
const swiper = Deck({ items: watch.recommendations, snapshotId: 'test', activeIndex: 1, onActiveIndexChange: () => { swipes++ }, renderCard: () => null }).props.children
assert.equal(swiper.props.autoplay, false)
swiper.props.onChange({ detail: { current: 2, source: 'autoplay' } })
swiper.props.onChange({ detail: { current: 2, source: '' } })
assert.equal(swipes, 0, 'automatic/programmatic swiper events never change the selected card')
swiper.props.onChange({ detail: { current: 2, source: 'touch' } })
assert.equal(swipes, 1, 'a user gesture can change the card')

const profileReact = reactHarness()
const profileHook = load('miniprogram/src/hooks/use-retained-resource.ts', {
  '../services/retained-resource-cache': cache, react: profileReact.react, '@tarojs/taro': taro,
  '../services/session': session, '../services/api-client': { ApiRequestError: class extends Error {} }
})
let dashboardReads = 0
const Profile = load('miniprogram/src/pages/profile/index.tsx', {
  react: profileReact.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/taro': { ...taro, default: taro },
  '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' }, '../../hooks/use-retained-resource': profileHook,
  '../../services/session': session, '../../services/mini-auth-service': auth,
  '../../services/company-follow-state': { onCompanyFollowChange: () => () => {} },
  '../../services/career-match-service': {
    fetchCompanyFollows: async () => { dashboardReads++; return { follows: [] } },
    fetchCareerWatch: async () => nextWatch, fetchCareerMatchState: async () => ({})
  },
  '../../services/content-service': { fetchMemberServices: async () => ({ membership: session.getMiniUser(), entitlements: [] }) },
  '../../config/api': { resolveMiniAvatarUrl: () => '' }, '../../utils/runtime-compat': { formatCalendarDate: () => '' }
}).default
profileReact.render(Profile); shown(); await tick(); profileReact.render(Profile)
shown(); await tick(); profileReact.render(Profile)
assert.equal(dashboardReads, 1, 'personal center does not reload on an ordinary return')
cache.invalidateMiniResource('profile-dashboard')
shown(); await tick(); profileReact.render(Profile)
assert.equal(dashboardReads, 2, 'changed profile data triggers one background refresh')
session.saveMiniSession({ ...account, isMember: false, memberType: '' })
shown(); await tick(); tree = profileReact.render(Profile)
assert.equal(dashboardReads, 3, 'refund/entitlement change invalidates the personal center')
assert.ok(find(tree, node => node.props?.children === '开通会员，查看更多企业'), 'the refunded dashboard no longer displays an active membership')
console.log('PASS: in-flight invalidation, user-only swiper changes and personal-center refresh boundaries')
