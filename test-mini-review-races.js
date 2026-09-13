import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const tick = () => new Promise(setImmediate)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function harness(file, dependencies = {}) {
  let cursor = 0, shown, hidden, scope = 'account-a', authenticated = true, now = Date.now()
  const timers = new Map()
  class Clock extends Date { static now() { return now } }
  const slots = [], events = new Map(), modules = new Map()
  const taro = {
    useDidShow: fn => { shown = fn }, useDidHide: fn => { hidden = fn }, usePullDownRefresh() {}, useReachBottom() {}, useResize() {},
    useRouter: () => ({ params: { id: 'company' } }),
    eventCenter: { trigger() {}, on() {}, off() {} }, getStorageSync: () => null,
    showToast() {}, stopPullDownRefresh() {}, nextTick() {}, navigateTo() {}
  }
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useCallback: fn => fn, useMemo: fn => fn(),
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps?.some((value, i) => !Object.is(value, previous.deps[i]))) { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() } } }
  }
  function load(relative) {
    const resolved = relative.replace(/\.tsx?$/, '')
    if (modules.has(resolved)) return modules.get(resolved)
    const module = { exports: {} }
    const mocks = {
      react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
      '@tarojs/taro': { ...taro, default: taro },
      '@tarojs/components': new Proxy({}, { get: (_, key) => key }),
      '../../services/session': { getMiniUser: () => ({ userId: scope }), hasAuthenticatedSession: () => authenticated, careerWatchStorageKey: id => id },
      '../../services/mini-auth-service': { refreshWechatSession: async () => ({}), refreshWechatSessionIfStale: async () => null },
      '../../services/company-follow-state': { onCompanyFollowChange: fn => { events.set('follow', fn); return () => {} } },
      '../../hooks/use-retained-resource': null,
      '../../utils/company-update-badge': { companyUpdateDeadline: () => 0 },
      '../../utils/company-role-summary': { buildCompanyRoleSummary: () => ({ segments: [], suffix: '可关注', ariaLabel: '' }) },
      '../../utils/runtime-compat': { formatCalendarDate: () => '' },
      ...dependencies
    }
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(relative, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
    }).outputText, { module, exports: module.exports, require(name) {
      if (name === '../../hooks/use-retained-resource') return {
        ...load('miniprogram/src/hooks/use-retained-resource.ts'), miniContentScope: () => scope
      }
      if (name === '../services/retained-resource-cache' || name === '../../services/retained-resource-cache') return load('miniprogram/src/services/retained-resource-cache.ts')
      if (name === '../services/session') return { getMiniUser: () => ({ userId: scope }), getMiniSessionCacheKey: () => scope }
      if (name === '../services/api-client') return { ApiRequestError: class extends Error {} }
      if (name in mocks) return mocks[name]
      if (name.includes('/components/') || name.includes('use-mini-share')) return { default: name.includes('use-mini-share') ? () => {} : name }
      if (name.endsWith('.scss') || name.includes('/utils/')) return {}
      throw new Error(`Unexpected dependency: ${name}`)
    }, setTimeout, clearTimeout, setInterval: fn => { const id = Symbol(); timers.set(id, fn); return id }, clearInterval: id => timers.delete(id), console, Date: Clock, Error })
    modules.set(resolved, module.exports)
    return module.exports
  }
  const Component = load(file).default
  const render = () => { cursor = 0; return Component() }
  return { slots, events, render, show: () => shown(), hide: () => hidden(), advance: ms => { now += ms; for (const fn of timers.values()) fn() }, timers, account(value) { scope = value; authenticated = value !== 'guest' } }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of [tree.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match }
  return null
}
const requests = [], followRequests = []
const companyData = name => ({ success: true, companies: [{ id: name, name, hasPublicOpportunity: true, openJobCount: 1 }], page: 1, pageSize: 20, total: 1, hasMore: false, access: { scope: 'free_fixed', searchMode: 'exact' }, industries: [] })
const companies = harness('miniprogram/src/pages/companies/index.tsx', {
  '../../services/content-service': { fetchCompanies: params => { const request = deferred(); requests.push({ ...request, params }); return request.promise } },
  '../../services/career-match-service': { fetchCompanyFollows: () => { const r = deferred(); followRequests.push(r); return r.promise }, fetchCareerWatch: async () => null }
})
companies.render(); companies.show(); await tick()
assert.equal(requests[0].params.sortBy, 'latest', 'directory defaults to latest sorting')
requests[0].resolve(companyData('initial')); await tick()
companies.account('account-b'); companies.render(); companies.show(); await tick()
assert.equal(companies.slots[0], null, 'account switch clears directory before the next response')
requests[1].resolve(companyData('b')); await tick()
followRequests[1].resolve({ follows: [{ company_id: 'b' }] }); await tick()
followRequests[0].resolve({ follows: [{ company_id: 'private-a' }] }); await tick()
assert.deepEqual([...companies.slots[6]], ['b'], 'old personal badges cannot cross account boundaries')
// A later server snapshot cannot undo a successful local follow mutation.
let search = find(companies.render(), node => String(node.type).includes('editorial-search'))
search.props.onInput('older'); search = find(companies.render(), node => String(node.type).includes('editorial-search')); search.props.onSubmit(); await tick()
search.props.onInput('newer'); search = find(companies.render(), node => String(node.type).includes('editorial-search')); search.props.onSubmit(); await tick()
requests[3].resolve(companyData('newer')); await tick()
companies.events.get('follow')({ companyId: 'newer', followed: true })
followRequests[2].resolve({ follows: [] }); await tick()
requests[2].resolve(companyData('older')); await tick()
assert.equal(companies.slots[0].companies[0].name, 'newer', 'latest search wins')
assert.equal(companies.slots[10], 'newer', 'late response cannot restore an older submitted query')
assert.ok(companies.slots[6].has('newer'), 'late follow snapshot cannot undo a confirmed follow')
search = find(companies.render(), node => String(node.type).includes('editorial-search')); search.props.onInput('failed');
search = find(companies.render(), node => String(node.type).includes('editorial-search')); search.props.onSubmit(); await tick()
requests[4].reject(new Error('offline')); await tick()
assert.equal(companies.slots[0].companies[0].name, 'newer', 'failed refresh keeps the previous directory visible')
search = find(companies.render(), node => String(node.type).includes('editorial-search')); search.props.onSubmit(); await tick()
assert.equal(requests[5].params.search, 'failed', 'retry uses the failed query, not the previous successful query')
requests[5].resolve(companyData('failed')); await tick()

let sortToggle = find(companies.render(), node => node.props?.className === 'companies-sort-toggle')
assert.equal(sortToggle?.props?.['aria-role'], 'button', 'directory exposes the sort menu trigger')
assert.equal(sortToggle.props['aria-expanded'], false)
sortToggle.props.onClick({ stopPropagation() {} })
await tick()
assert.equal(requests.length, 6, 'opening the menu does not request data')
const relevance = find(companies.render(), node => node.props?.['data-sort'] === 'relevance')
assert.equal(relevance.props['aria-selected'], false)
relevance.props.onClick()
await tick()
assert.equal(requests[6].params.sortBy, 'relevance', 'sort changes restart the directory request')
assert.equal(companies.slots[0].companies[0].name, 'failed', 'old sort remains visible while the new sort loads')
requests[6].resolve(companyData('relevance')); await tick()
assert.equal(companies.slots[0].companies[0].name, 'relevance', 'new sort result replaces the old list')
sortToggle = find(companies.render(), node => node.props?.className === 'companies-sort-toggle')
assert.equal(sortToggle.props['aria-label'], '当前按相关度排序')

let nextDetail = deferred()
const detail = harness('miniprogram/src/pages/company-detail/index.tsx', {
  '../../services/content-service': { fetchCompanyDetail: () => nextDetail.promise },
  '../../services/career-match-service': { fetchCompanyFollows: async () => ({ follows: [] }), fetchCareerWatch: async () => null }
})
detail.render(); detail.show()
nextDetail.resolve({ company: { id: 'company', contacts: [{ email: 'member-only@example.com' }] }, access: { contacts: true } }); await tick()
assert.equal(detail.slots[0].company.contacts.length, 1)
nextDetail = deferred(); detail.show(); await tick()
assert.equal(detail.slots[0].company.contacts.length, 1, 'same-account back navigation keeps the retained detail visible')
nextDetail.resolve({ company: { id: 'company', contacts: [{ email: 'member-only@example.com' }] }, access: { contacts: true } }); await tick()
nextDetail = deferred(); detail.account('guest'); detail.show()
assert.equal(detail.slots[0], null, 'returning guest cannot see previously loaded member contacts while validation runs')
nextDetail.resolve({ company: { id: 'company', contacts: [] }, access: { contacts: false } }); await tick()
assert.equal(detail.slots[0].company.contacts.length, 0)
console.log('Mini page races passed: account isolation, query ordering/retry, follow mutation ordering and contact access revalidation')

// Visible-page automatic sync, narrow transient status and no work while hidden.
const autoRequests = []
const automatic = harness('miniprogram/src/pages/companies/index.tsx', {
  '../../services/content-service': { fetchCompanies: params => { const request = deferred(); autoRequests.push({ ...request, params }); return request.promise } },
  '../../services/career-match-service': { fetchCompanyFollows: async () => ({ follows: [] }), fetchCareerWatch: async () => null }
})
automatic.render(); automatic.show(); await tick()
autoRequests[0].resolve(companyData('original')); await tick()
let autoTree = automatic.render()
assert.equal(find(autoTree, n => n.props?.className === 'companies-load-more'), null, 'single page has no permanent refresh entry')
assert.equal(find(autoTree, n => n.props?.className === 'companies-refreshing'), null)
automatic.show(); await tick(); assert.equal(autoRequests.length, 1, 'rapid tab return reuses cache')
automatic.advance(120001); await tick(); autoTree = automatic.render()
assert.equal(autoRequests.length, 2)
assert.ok(find(autoTree, n => n.props?.className === 'companies-refreshing'))
assert.ok(find(autoTree, n => n.props?.className === 'company-list'), 'old cards remain during update')
autoRequests[1].resolve(companyData('updated')); await tick(); autoTree = automatic.render()
assert.equal(automatic.slots[0].companies[0].name, 'updated')
assert.equal(find(autoTree, n => n.props?.className === 'companies-refreshing'), null, 'status collapses on completion')
const sameData = automatic.slots[0]
automatic.advance(120001); await tick()
autoRequests[2].resolve({ ...companyData('updated'), serverTime: new Date().toISOString() }); await tick(); automatic.render()
assert.equal(automatic.slots[0], sameData, 'unchanged data keeps its reference despite a new server timestamp')
automatic.advance(120001); await tick(); autoRequests[3].reject(Error('offline')); await tick(); autoTree = automatic.render()
assert.equal(automatic.slots[0], sameData)
assert.equal(find(autoTree, n => n.props?.className === 'companies-refreshing'), null, 'failure also collapses status')
automatic.hide(); automatic.render(); automatic.advance(120001); await tick()
assert.equal(autoRequests.length, 4, 'hidden pages do not poll')
automatic.show(); await tick(); assert.equal(autoRequests.length, 5, 'stale return automatically checks')
autoRequests[4].resolve(companyData('returned')); await tick()
console.log('PASS: automatic directory sync, cache freshness, stable cards, transient narrow status, unchanged payloads, offline retention and hidden-page pause')
