import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildDeterministicCareerResult,
  buildStructuredCareerProfile,
  computeCompanyMatch,
  roleFamiliesForText,
  selectBestPublicOpportunity,
  selectMatchRecommendations,
  collectRecentMatchRecommendations,
  MINI_MATCH_ALGORITHM_VERSION
} from './lib/services/mini-company-match-service.js'

const text = `产品经理，负责 B2B SaaS 产品规划与用户研究。过去四年带领跨职能团队完成从需求访谈、原型设计到上线复盘，推动注册转化提升 30%。熟悉 SQL、Figma、Notion，长期与海外团队异步协作。`
const profile = buildStructuredCareerProfile(text, {
  targetRoles: '产品经理 / Product Manager',
  location: '上海',
  timezone: 'UTC+8',
  workMode: '全职'
})

assert.ok(profile.profileHash.length === 64)
assert.ok(profile.matchingProfile.roleFamilies.includes('product'))
assert.ok(profile.matchingProfile.skills.length > 0)
assert.ok(profile.profileCompleteness > 0)
assert.deepEqual(roleFamiliesForText('Product Manager and UX Research'), ['product', 'design', 'research'])

const result = buildDeterministicCareerResult(text, { targetRoles: '产品经理', location: '上海', timezone: 'UTC+8' })
assert.match(result.summary.headline, /产品/)
assert.equal(result.companies.length, 0)
assert.equal(result.careerPaths.now.length, 1)

const directCompanyMatch = computeCompanyMatch(profile.matchingProfile, {
  company_id: 'company-direct', name: 'Direct', industry: 'SaaS', description: '', tags: []
}, [{
  history_id: 'history-direct', source_job_id: 'job-direct', title: 'Senior Product Manager',
  description: 'Lead product strategy, user research and roadmap.', category: '产品经理',
  role_families: ['product'], normalized_skills: ['userresearch'], evidence_quality: 0.9,
  is_public_opportunity: true, last_seen_at: new Date().toISOString()
}])
assert.ok(directCompanyMatch)
assert.equal(directCompanyMatch.hasPublicOpportunity, true)
assert.ok(['high', 'notable', 'explore'].includes(directCompanyMatch.fitBand))

const unrelatedOpportunity = computeCompanyMatch(profile.matchingProfile, {
  company_id: 'company-mixed', name: 'Mixed', industry: 'SaaS', description: '', tags: []
}, [{
  history_id: 'history-product', source_job_id: 'job-product', title: 'Product Manager',
  description: 'Product roadmap and user research.', category: '产品经理', role_families: ['product'],
  normalized_skills: [], evidence_quality: 0.8, is_public_opportunity: false, last_seen_at: new Date().toISOString()
}, {
  history_id: 'history-sales', source_job_id: 'job-sales', title: 'Sales Representative',
  description: 'Outbound sales.', category: '销售', role_families: ['sales'], normalized_skills: [],
  evidence_quality: 0.8, is_public_opportunity: true, last_seen_at: new Date().toISOString()
}])
assert.ok(unrelatedOpportunity)
assert.equal(unrelatedOpportunity.hasPublicOpportunity, false)

const selectedOpportunity = selectBestPublicOpportunity(profile.matchingProfile, [{
  job_id: 'job-sales', title: 'Sales Representative', description: 'Outbound sales.', category: '销售'
}, {
  job_id: 'job-product', title: 'Product Manager', description: 'Product strategy and user research.', category: '产品经理'
}])
assert.equal(selectedOpportunity?.job_id, 'job-product')

const carriedForward = selectMatchRecommendations({
  candidates: [{ companyId: 'company-direct', name: 'Direct' }],
  recentRuns: [{ generated_at: '2026-08-18T00:00:00.000Z', recommendations: [{ companyId: 'company-direct', name: 'Direct' }] }],
  activeCompanyIds: ['company-direct'],
  limit: 3,
  now: new Date('2026-08-19T00:00:00.000Z')
})
assert.equal(carriedForward.fallbackUsed, true)
assert.equal(carriedForward.recommendations[0].companyId, 'company-direct')
assert.equal(carriedForward.recommendations[0].firstMatchedAt, '2026-08-18T00:00:00.000Z')
assert.equal(selectMatchRecommendations({
  candidates: [{ companyId: 'company-new', name: 'New' }],
  recentRuns: [{ generated_at: '2026-08-18T00:00:00.000Z', recommendations: [{ companyId: 'company-old', name: 'Old' }] }],
  activeCompanyIds: ['company-new', 'company-old'],
  limit: 3,
  now: new Date('2026-08-19T00:00:00.000Z')
}).recommendations[0].companyId, 'company-new')
assert.deepEqual(collectRecentMatchRecommendations({
  runs: [
    { generated_at: '2026-08-19T00:00:00.000Z', recommendations: [{ companyId: 'company-new' }] },
    { generated_at: '2026-08-18T00:00:00.000Z', recommendations: [{ companyId: 'company-old' }, { companyId: 'company-new' }] }
  ],
  activeCompanyIds: ['company-new', 'company-old'],
  now: new Date('2026-08-19T00:00:00.000Z')
}).map((item) => item.companyId), ['company-new', 'company-old'])
const refreshedAfterSevenDays = selectMatchRecommendations({
  candidates: [{ companyId: 'company-direct', name: 'Direct' }],
  recentRuns: [{ generated_at: '2026-08-18T00:00:00.000Z', recommendations: [{ companyId: 'company-direct', name: 'Direct', firstMatchedAt: '2026-08-10T00:00:00.000Z' }] }],
  activeCompanyIds: ['company-direct'],
  limit: 3,
  now: new Date('2026-08-19T00:00:00.000Z')
})
assert.equal(refreshedAfterSevenDays.fallbackUsed, false)
assert.equal(refreshedAfterSevenDays.recommendations[0].firstMatchedAt, '2026-08-19T00:00:00.000Z')
assert.equal(MINI_MATCH_ALGORITHM_VERSION, 'company-match-v3')

const gateway = fs.readFileSync(new URL('./lib/api-handlers/mini-gateway.js', import.meta.url), 'utf8')
const matchService = fs.readFileSync(new URL('./lib/services/mini-company-match-service.js', import.meta.url), 'utf8')
const appConfig = fs.readFileSync(new URL('./miniprogram/src/app.config.ts', import.meta.url), 'utf8')
const matchPage = fs.readFileSync(new URL('./miniprogram/src/pages/index/index.tsx', import.meta.url), 'utf8')
const companyDetail = fs.readFileSync(new URL('./miniprogram/src/pages/company-detail/index.tsx', import.meta.url), 'utf8')
assert.match(gateway, /websiteUrl: companyId \? `\$\{siteOrigin\}\/company\//)
assert.match(gateway, /AS has_public_opportunity/)
assert.match(matchService, /message\/subscribe\/send/)
assert.match(matchService, /page: `pages\/company-detail\/index\?id=/)
assert.doesNotMatch(matchService, /page: `pages\/web-view/)
assert.match(matchService, /const hasRecentMatch = \(recentRuns \|\| \[\]\)\.some/)
assert.match(matchService, /cachedRecommendations\.length > 0 \|\| !hasRecentMatch/)
assert.match(appConfig, /pages\/web-view\/index/)
assert.match(matchPage, /createMatchApplyTicket/)
assert.match(matchPage, /查看申请机会/)
assert.match(companyDetail, /setClipboardData/)

const matchDraft = fs.readFileSync(new URL('./miniprogram/src/utils/match-draft.ts', import.meta.url), 'utf8')
assert.match(matchDraft, /MATCH_DRAFT_TTL_MS = 24 \* 60 \* 60 \* 1000/)
assert.match(matchDraft, /draft\.retention === 'session'/)
assert.match(matchDraft, /LEGACY_MATCH_DRAFT_KEY/)

console.log('mini company match checks passed')
