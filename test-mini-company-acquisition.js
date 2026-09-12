import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { normalizeCompanyName, matchCompanyNames, rankDirectoryCompanies } from './lib/services/mini-company-search-service.js'

// Local test fixtures only; never persisted or served as product data.
const companies = [
  { company_id: 's', name: 'Supabase' },
  { company_id: 'x', name: 'XapoBank', translations: { name: '赛博银行' } },
  { company_id: 'ai', name: 'AI' },
  { company_id: 'arc', name: '无界方舟' }
]
assert.equal(normalizeCompanyName(' ＳＵＰＡ－BASE '), 'supabase')
for (const query of ['Supabase', 'supabas', 'supaabse', 'Supabaze']) {
  assert.deepEqual(matchCompanyNames(companies, query).ids, ['s'], query)
}
assert.deepEqual(matchCompanyNames(companies, '赛博银行').ids, ['x'])
assert.deepEqual(matchCompanyNames(companies, '无界舟').ids, ['arc'])
for (const query of ['Supa', '产品经理', 'a', '%', '_']) assert.deepEqual(matchCompanyNames(companies, query).ids, [], query)
assert.deepEqual(matchCompanyNames(companies, 'AI').ids, ['ai'])
assert.equal(matchCompanyNames(companies, 'Supa').outcome, 'too_broad')
assert.equal(matchCompanyNames(companies, 'NotARealCompany').outcome, 'not_found')
const similar = [{ company_id: 'a', name: 'Buffer' }, { company_id: 'b', name: 'Bubber' }]
assert.deepEqual(matchCompanyNames(similar, 'Buffer').ids, ['a'], 'exact beats similar names')
assert.equal(matchCompanyNames(similar, 'Bufer').outcome, 'matched')
const directoryRows = [
  { company_id: 'title', name: 'Other Co', public_job_titles: ['Product Manager'], public_opportunity_updated_at: '2026-09-08T00:00:00Z' },
  { company_id: 'translated', name: '国际公司', translations: { name: 'Global Company' }, public_job_titles: ['Engineer'], public_opportunity_updated_at: '2026-09-07T00:00:00Z' },
  { company_id: 'newpath', name: 'NewPath Conveyancing', public_job_titles: ['Remote Office Assistant'], public_opportunity_updated_at: '2026-09-09T00:00:00Z' },
  { company_id: 'supabase', name: 'Supabase', public_job_titles: ['Engineer'], public_opportunity_updated_at: '2026-09-06T00:00:00Z' }
]
assert.deepEqual(rankDirectoryCompanies(directoryRows, 'Product Manger', { mode: 'free' }).ids, ['title'])
assert.deepEqual(rankDirectoryCompanies(directoryRows, 'newpath', { mode: 'free' }).ids, ['newpath'], 'an exact company-name token remains searchable for free users')
assert.equal(rankDirectoryCompanies(directoryRows, 'supa', { mode: 'free' }).outcome, 'too_broad', 'arbitrary partial prefixes do not widen free directory access')
assert.deepEqual(rankDirectoryCompanies(directoryRows, '%', { mode: 'member' }).ids, [])
assert.equal(rankDirectoryCompanies(directoryRows, 'Product', { mode: 'member' }).ids[0], 'title')
assert.deepEqual(rankDirectoryCompanies(directoryRows, '', { mode: 'member' }).companies.map((row) => row.company_id), ['newpath', 'title', 'translated', 'supabase'])
console.log('Named company search: normalization, typo bounds, aliases, short names and exact priority passed')

const read = (file) => fs.readFileSync(file, 'utf8')
const gateway = read('lib/api-handlers/mini-gateway.js')
const directorySource = gateway.slice(gateway.indexOf('const companyDirectorySnapshotSql'), gateway.indexOf('async function readMiniNotes('))
assert.match(directorySource, /JOIN jobs j ON j\.company_id = tc\.company_id/)
assert.match(directorySource, /LEFT JOIN company_job_history h ON h\.company_id = tc\.company_id[\s\S]+h\.source_job_id = j\.job_id/)
assert.match(directorySource, /COALESCE\([\s\S]+h\.first_seen_at[\s\S]+j\.created_at[\s\S]+j\.updated_at[\s\S]+j\.published_at/)
assert.match(directorySource, /j\.is_approved IS TRUE/)
assert.match(directorySource, /COALESCE\(j\.member_only, FALSE\) IS FALSE/)
assert.match(directorySource, /new_jobs_until/)
assert.doesNotMatch(directorySource, /searchNamedCompanies|ILIKE|current_job\.job_id IS NULL/)

const detailStart = gateway.indexOf('async function handleMiniCompany(')
const detailSource = gateway.slice(detailStart, gateway.indexOf('\nasync function ', detailStart + 1))
assert.doesNotMatch(detailSource, /COMPANY_NOT_IN_FREE_DIRECTORY|const freeAccess|accessSearch/)
assert.match(detailSource, /tc.status = 'active' OR EXISTS/)
assert.match(detailSource, /canAccessCompanyContacts/)
const matchSource = read('lib/services/mini-company-match-service.js')
const audience = matchSource.slice(matchSource.indexOf('WITH recipients AS'), matchSource.indexOf('       UNION', matchSource.indexOf('WITH recipients AS')))
assert.match(audience, /follows.status = 'active'/)
assert.doesNotMatch(audience, /member_expire_at|fixedMatchRecommendations|ordinality|COUNT\(/)
const delivery = matchSource.slice(matchSource.indexOf("follows.wechat_enabled = TRUE AND follows.wechat_template_status = 'accepted'", matchSource.indexOf('WHERE inbox.event_id = $1')), matchSource.indexOf('          OR (', matchSource.indexOf('WHERE inbox.event_id = $1')))
assert.doesNotMatch(delivery, /member_expire_at|fixedMatchRecommendations|ordinality/)
assert.match(matchSource, /profiles.wechat_enabled = TRUE/)
console.log('Named discovery, public detail, private contacts and grandfathered notification contracts passed')

class ApiRequestError extends Error {
  constructor() { super('quota'); this.payload = { code: 'COMPANY_FOLLOW_LIMIT_REACHED' } }
}
for (const confirm of [true, false]) {
  const navigations = [], states = [], toasts = []
  const module = { exports: {} }
  const dependencies = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: { useState: () => [false, () => {}] },
    '@tarojs/components': { Button: 'button', Text: 'text', View: 'view' },
    '@tarojs/taro': { navigateTo: (target) => navigations.push(target.url), showModal: async () => ({ confirm, cancel: !confirm }), showToast: (toast) => toasts.push(toast) },
    '../mini-icon': { default: () => null },
    '../../services/career-match-service': { followCompany: async () => { throw new ApiRequestError() } },
    '../../services/company-follow-state': { emitCompanyFollowChange: (state) => states.push(state) },
    '../../services/analytics-service': { trackMiniEvent: async () => {} },
    '../../services/session': { hasAuthenticatedSession: () => true },
    '../../services/api-client': { ApiRequestError }, './index.scss': {}
  }
  vm.runInNewContext(ts.transpileModule(read('miniprogram/src/components/company-follow-action/index.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { module, exports: module.exports, require: (name) => dependencies[name] })
  const button = module.exports.default({ companyId: 'c', companyName: 'Test only', followed: false, onChanged: (state) => states.push(state) })
  button.props.onClick({ stopPropagation() {} })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(navigations, [confirm ? '/pages/membership/index' : '/pages/followed-companies/index'])
  assert.equal(states.length, 0, 'quota failure must not fake a successful follow or trigger its reminder callback')
  assert.equal(toasts.length, 0, 'quota modal replaces success/error toasts')
}
console.log('Quota UI passed: membership/management paths with no optimistic follow or reminder callback')

for (const confirm of [true, false]) {
  const navigations = [], states = [], toasts = []
  const module = { exports: {} }
  const dependencies = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: { useState: () => [false, () => {}] },
    '@tarojs/components': { Button: 'button', Text: 'text', View: 'view' },
    '@tarojs/taro': { default: { requestSubscribeMessage: async () => ({ template: 'accept' }) }, navigateTo: (target) => navigations.push(target.url), showModal: async () => ({ confirm, cancel: !confirm }), showToast: (toast) => toasts.push(toast) },
    '../mini-icon': { default: () => null },
    '../../services/career-match-service': { setMatchNotifications: async () => { const error = new ApiRequestError(); error.payload.code = 'COMPANY_REMINDER_LIMIT_REACHED'; throw error } },
    '../../services/company-follow-state': { emitCompanyFollowChange: (state) => states.push(state) },
    '../../services/analytics-service': { trackMiniEvent: async () => {} },
    '../../services/session': { hasAuthenticatedSession: () => true },
    '../../services/api-client': { ApiRequestError }, './index.scss': {}
  }
  vm.runInNewContext(ts.transpileModule(read('miniprogram/src/components/wechat-reminder-action/index.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { module, exports: module.exports, require: (name) => dependencies[name] })
  const button = module.exports.default({ companyId: 'c', available: true, templateId: 'template', enabled: false, onChanged: (state) => states.push(state) })
  button.props.onClick({ stopPropagation() {} })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(navigations, [confirm ? '/pages/membership/index' : '/pages/followed-companies/index'])
  assert.equal(states.length, 0, 'quota failure must not fake a successful follow or trigger its reminder callback')
  assert.equal(toasts.length, 0, 'quota modal replaces success/error toasts')
}
console.log('Reminder quota UI passed: no false enabled state, membership and management navigation verified')
