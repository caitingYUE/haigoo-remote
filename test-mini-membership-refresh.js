import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path) => fs.readFileSync(path, 'utf8')

function load(path, dependencies) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  } }).outputText, {
    module,
    exports: module.exports,
    require: (key) => {
      assert.ok(key in dependencies, `Unexpected dependency: ${key}`)
      return dependencies[key]
    }
  })
  return module.exports
}

for (const [path, payloadCall] of [
  ['miniprogram/src/pages/profile/index.tsx', 'fetchCompanyFollows'],
  ['miniprogram/src/pages/membership/index.tsx', 'fetchMembershipPlans']
]) {
  const source = read(path)
  assert.match(source, /useDidShow\(\(\) =>/)
  assert.match(source, /refreshWechatSessionIfStale\(/)
  assert.ok(
    source.indexOf('await refreshWechatSession') < source.indexOf(`${payloadCall}(`),
    `${path} must refresh the session before loading page payloads`
  )
  assert.match(source, /useRef\(0\)/, `${path} must guard overlapping page loads`)
}

const companiesPage = read('miniprogram/src/pages/companies/index.tsx')
assert.match(companiesPage, /refreshWechatSessionIfStale\(\)/)
assert.ok(
  companiesPage.indexOf('refreshWechatSessionIfStale()') < companiesPage.indexOf('else void load(false,'),
  'company directory must validate membership before restoring retained data'
)
assert.doesNotMatch(companiesPage, /useDidShow\(\(\) => \{[\s\S]{0,500}setData\(null\)/)
const watchPage = read('miniprogram/src/pages/index/career-watch-page.tsx')
assert.match(watchPage, /refreshWechatSessionIfStale\(\)/)
assert.doesNotMatch(watchPage, /useDidShow\(\(\) => \{[\s\S]{0,500}setWatch\(null\)/)
const companyDetail = read('miniprogram/src/pages/company-detail/index.tsx')
assert.match(companyDetail, /refreshWechatSessionIfStale\(\)/)
assert.ok(
  companyDetail.indexOf('refreshWechatSessionIfStale()') < companyDetail.indexOf('else void load(false)'),
  'company detail must validate membership before restoring retained data'
)
assert.doesNotMatch(companyDetail, /useDidShow\(\(\) => \{[\s\S]{0,400}setData\(null\)/)
const profilePage = read('miniprogram/src/pages/profile/index.tsx')
assert.match(profilePage, /const activeMembership = dashboardLoaded \? membership : null/)
const miniAuthSource = read('miniprogram/src/services/mini-auth-service.ts')
assert.match(miniAuthSource, /refreshWechatSessionIfStale\(maxAgeMs = 5 \* 60 \* 1000\)/)

let resolveFirst
let loginCount = 0
const saved = []
const auth = load('miniprogram/src/services/mini-auth-service.ts', {
  '@tarojs/taro': { default: { login: async () => ({ code: `code-${++loginCount}` }) } },
  './api-client': {
    requestJson: async (_path, options) => {
      const code = options.data.code
      if (code === 'code-1') return new Promise((resolve) => { resolveFirst = resolve })
      return {
        token: 'new-token',
        bound: true,
        user: { userId: 'user-1', isMember: true, memberType: 'quarter', memberExpireAt: '2027-03-08T00:00:00.000Z' }
      }
    }
  },
  './analytics-service': { trackMiniEvent: async () => {} },
  './session': {
    getMiniSessionCacheKey: () => 'user-1',
    getMiniUser: () => ({ userId: 'user-1' }),
    clearMiniSession: () => {},
    getMiniSessionToken: () => 'current-token',
    hasAuthenticatedSession: () => true,
    saveMiniSession: (session) => saved.push(session)
  },
  '../config/legal': { MINI_AGREEMENT_VERSION: 'test', MINI_PRIVACY_VERSION: 'test' }
})

const firstRefresh = auth.refreshWechatSession()
const secondRefresh = auth.refreshWechatSession()
await secondRefresh
resolveFirst({
  token: 'old-token',
  bound: true,
  user: { userId: 'user-1', isMember: true, memberType: 'starter', memberExpireAt: '2026-10-08T00:00:00.000Z' }
})
await firstRefresh

assert.equal(saved.length, 1, 'an older refresh must not overwrite the newer scoped session')
assert.equal(saved[0].token, 'new-token')
assert.equal(saved[0].memberExpireAt, '2027-03-08T00:00:00.000Z')

let resolveLogoutRefresh
let cleared = 0
const savedAfterLogout = []
const logoutAuth = load('miniprogram/src/services/mini-auth-service.ts', {
  '@tarojs/taro': { default: { login: async () => ({ code: 'logout-refresh' }) } },
  './api-client': { requestJson: async () => new Promise((resolve) => { resolveLogoutRefresh = resolve }) },
  './analytics-service': { trackMiniEvent: async () => {} },
  './session': {
    getMiniSessionCacheKey: () => 'user-1',
    getMiniUser: () => ({ userId: 'user-1' }),
    clearMiniSession: () => { cleared += 1 },
    getMiniSessionToken: () => 'current-token',
    hasAuthenticatedSession: () => true,
    saveMiniSession: (session) => savedAfterLogout.push(session)
  },
  '../config/legal': { MINI_AGREEMENT_VERSION: 'test', MINI_PRIVACY_VERSION: 'test' }
})
const logoutRefresh = logoutAuth.refreshWechatSession()
await new Promise((resolve) => setImmediate(resolve))
logoutAuth.logoutMiniAccount()
resolveLogoutRefresh({ token: 'stale-token', bound: true, user: { userId: 'old-user' } })
await logoutRefresh
assert.equal(cleared, 1)
assert.equal(savedAfterLogout.length, 0, 'an in-flight refresh must not restore a logged-out session')

let resolveBindRefresh
const savedAfterBind = []
const bindAuth = load('miniprogram/src/services/mini-auth-service.ts', {
  '@tarojs/taro': { default: { login: async () => ({ code: 'bind-refresh' }) } },
  './api-client': {
    requestJson: async (path) => path === '/mini/auth/session'
      ? new Promise((resolve) => { resolveBindRefresh = resolve })
      : { token: 'bound-token', bound: true, user: { userId: 'bound-user', memberExpireAt: '2027-06-08T00:00:00.000Z' } }
  },
  './analytics-service': { trackMiniEvent: async () => {} },
  './session': {
    getMiniSessionCacheKey: () => 'user-1',
    getMiniUser: () => ({ userId: 'user-1' }),
    clearMiniSession: () => {},
    getMiniSessionToken: () => 'current-token',
    hasAuthenticatedSession: () => true,
    saveMiniSession: (session) => savedAfterBind.push(session)
  },
  '../config/legal': { MINI_AGREEMENT_VERSION: 'test', MINI_PRIVACY_VERSION: 'test' }
})
const bindRefresh = bindAuth.refreshWechatSession()
await new Promise((resolve) => setImmediate(resolve))
await bindAuth.bindWebsiteAccount('test@example.com', 'password', true)
resolveBindRefresh({ token: 'old-token', bound: true, user: { userId: 'old-user' } })
await bindRefresh
assert.equal(savedAfterBind.length, 1, 'binding must invalidate an older refresh')
assert.equal(savedAfterBind[0].token, 'bound-token')

console.log('PASS: profile and membership payloads follow session refresh; stale refreshes cannot overwrite current membership.')
