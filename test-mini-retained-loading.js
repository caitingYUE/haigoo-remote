import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const hook = read('./miniprogram/src/hooks/use-retained-resource.ts')

assert.match(hook, /const CACHE_LIMIT = 40/)
assert.match(hook, /const retainedResources = new Map/)
assert.match(hook, /useRetainedResource<T>\(initialKey = ''\)/)
assert.match(hook, /scopeChanged \? null : current\.data/)
assert.match(hook, /CACHE_TTL_MS = Number\.POSITIVE_INFINITY/)
assert.match(hook, /writeRetained\(current\.scope, current\.key, value/)
assert.match(hook, /\[401, 403\]\.includes/)
assert.doesNotMatch(hook, /setStorageSync/)

const companies = read('./miniprogram/src/pages/companies/index.tsx')
const companyStyles = read('./miniprogram/src/pages/companies/index.scss')
assert.match(companies, /aria-haspopup='listbox'/)
assert.match(companies, /aria-selected=/)
assert.match(companies, /data-sort=/)
assert.match(companies, /正在更新企业/)
assert.match(companies, /company-card__rating[\s\S]*company-card__new/)
assert.match(companyStyles, /company-card__new[^}]*#168653/)
assert.doesNotMatch(companies, /useDidShow\(\(\) => \{[\s\S]{0,500}setData\(null\)/)
assert.match(companies, /refreshWechatSessionIfStale/)

const companyDetail = read('./miniprogram/src/pages/company-detail/index.tsx')
const jobDetail = read('./miniprogram/src/pages/job-detail/index.tsx')
const noteDetail = read('./miniprogram/src/pages/note-detail/index.tsx')
const membership = read('./miniprogram/src/pages/membership/index.tsx')
assert.doesNotMatch(companyDetail, /setCompany\(null\)|正在加载企业资料/)
assert.doesNotMatch(companyDetail, /useDidShow\(\(\) => \{[\s\S]{0,400}setData\(null\)/)
assert.match(companyDetail, /refreshWechatSessionIfStale/)
assert.doesNotMatch(jobDetail, /正在加载岗位信息/)
assert.doesNotMatch(noteDetail, /正在打开笔记/)
for (const source of [companyDetail, jobDetail, noteDetail, membership]) assert.match(source, /useRetainedResource/)

const matchPage = read('./miniprogram/src/pages/index/career-watch-page.tsx')
const matchCard = read('./miniprogram/src/components/match-company-card/index.tsx')
assert.match(matchPage, /function readValidCachedWatch\(\)/)
assert.match(matchPage, /useState<CareerWatchResponse \| null>\(initialWatch\)/)
assert.doesNotMatch(matchPage, /useDidShow\(\(\) => \{[\s\S]{0,500}setWatch\(null\)/)
assert.match(matchPage, /refreshWechatSessionIfStale/)
assert.doesNotMatch(matchCard, /\{active \? <CompanyFollowAction/)
assert.match(matchCard, /lazyLoad=\{false\}/)

const miniAuth = read('./miniprogram/src/services/mini-auth-service.ts')
assert.match(miniAuth, /refreshWechatSessionIfStale/)
assert.match(miniAuth, /sessionRefreshPending/)

for (const path of [
  './miniprogram/src/pages/favorite-jobs/index.tsx',
  './miniprogram/src/pages/followed-companies/index.tsx',
  './miniprogram/src/pages/payment-orders/index.tsx'
]) {
  const retainedPage = read(path)
  assert.match(retainedPage, /hasLoaded/)
  assert.match(retainedPage, /sameScope/)
  assert.match(retainedPage, /if \(sameScope && hasLoaded\.current\) return/)
}

const favorites = read('./miniprogram/src/pages/favorite-jobs/index.tsx')
const followedCompanies = read('./miniprogram/src/pages/followed-companies/index.tsx')
const paymentOrders = read('./miniprogram/src/pages/payment-orders/index.tsx')
assert.doesNotMatch(favorites, /useDidShow\(\(\) => \{ void load\(true\) \}\)/)
assert.match(followedCompanies, /onCompanyFollowChange/)
assert.doesNotMatch(paymentOrders, /useDidShow\(\(\) => \{ void loadOrders\(1, false\) \}\)/)

console.log('Mini retained loading contracts passed')
