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
  wechatMiniProgramState,
  MINI_MATCH_ALGORITHM_VERSION
} from './lib/services/mini-company-match-service.js'
import { mapCompanyJobSummary } from './cloudrun/company-directory.mjs'

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

assert.equal(mapCompanyJobSummary({ id: 'official-job', companyId: 'company-1', title: 'Product Manager', sourceType: 'official' }, 'company-1')?.sourceLabel, '岗位来自企业官网')
assert.equal(mapCompanyJobSummary({ id: 'public-job', companyId: 'company-1', title: 'Product Manager', sourceType: 'rss' }, 'company-1')?.sourceLabel, '岗位来自公开招聘渠道')

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

const originalVercelEnv = process.env.VERCEL_ENV
const originalWechatState = process.env.WECHAT_MINI_PROGRAM_STATE
delete process.env.WECHAT_MINI_PROGRAM_STATE
process.env.VERCEL_ENV = 'preview'
assert.equal(wechatMiniProgramState(), 'trial')
process.env.VERCEL_ENV = 'production'
assert.equal(wechatMiniProgramState(), 'formal')
process.env.WECHAT_MINI_PROGRAM_STATE = 'developer'
assert.equal(wechatMiniProgramState(), 'developer')
if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
else process.env.VERCEL_ENV = originalVercelEnv
if (originalWechatState === undefined) delete process.env.WECHAT_MINI_PROGRAM_STATE
else process.env.WECHAT_MINI_PROGRAM_STATE = originalWechatState

const gateway = fs.readFileSync(new URL('./lib/api-handlers/mini-gateway.js', import.meta.url), 'utf8')
const matchService = fs.readFileSync(new URL('./lib/services/mini-company-match-service.js', import.meta.url), 'utf8')
const appConfig = fs.readFileSync(new URL('./miniprogram/src/app.config.ts', import.meta.url), 'utf8')
const matchPage = fs.readFileSync(new URL('./miniprogram/src/pages/index/index.tsx', import.meta.url), 'utf8')
const watchPage = fs.readFileSync(new URL('./miniprogram/src/pages/index/career-watch-page.tsx', import.meta.url), 'utf8')
const matchCard = fs.readFileSync(new URL('./miniprogram/src/components/match-company-card/index.tsx', import.meta.url), 'utf8')
const matchCardStyles = fs.readFileSync(new URL('./miniprogram/src/components/match-company-card/index.scss', import.meta.url), 'utf8')
const matchCardPresentation = fs.readFileSync(new URL('./miniprogram/src/utils/match-card-presentation.ts', import.meta.url), 'utf8')
const companyDetail = fs.readFileSync(new URL('./miniprogram/src/pages/company-detail/index.tsx', import.meta.url), 'utf8')
const contentService = fs.readFileSync(new URL('./miniprogram/src/services/content-service.ts', import.meta.url), 'utf8')
assert.match(gateway, /websiteUrl: safeExternalUrl\(row\.website\)/)
assert.match(gateway, /COMPANY_NOT_IN_FREE_DIRECTORY/)
assert.match(gateway, /contacts \} : \{\}/)
assert.match(gateway, /contactCount: contacts\.length/)
assert.match(gateway, /\.\.\.\(viewer\.capabilities\.canAccessCompanyContacts \? \{ contacts \} : \{\}\)/)
assert.match(gateway, /contacts: viewer\.capabilities\.canAccessCompanyContacts && contacts\.length > 0/)
assert.match(gateway, /publicJobTitles:/)
assert.match(gateway, /\.\.\.\(source \? \{ source \} : \{\}\)/)
assert.match(gateway, /JSON\.parse\(value\)/)
assert.match(gateway, /events\.has_public_opportunity/)
assert.match(gateway, /hasPublicOpportunity: Boolean\(row\.has_public_opportunity\)/)
assert.match(gateway, /tc\.translations->>'name'/)
assert.doesNotMatch(gateway, /tc\.aliases/)
assert.match(matchService, /message\/subscribe\/send/)
assert.match(matchService, /miniprogram_state: wechatMiniProgramState\(\)/)
assert.match(matchService, /member_status IN \('active', 'pro', 'lifetime'\)/)
assert.match(matchService, /member_cycle_start_at IS NULL/)
assert.match(matchService, /custom_role_terms/)
assert.match(matchService, /page: `pages\/company-detail\/index\?id=/)
assert.doesNotMatch(matchService, /page: `pages\/web-view/)
assert.match(matchService, /const hasRecentMatch = \(recentRuns \|\| \[\]\)\.some/)
assert.match(matchService, /cachedRecommendations\.length > 0 \|\| !hasRecentMatch/)
assert.match(appConfig, /pages\/web-view\/index/)
for (const label of ["text: '企业'", "text: 'Match'", "text: '笔记'"]) assert.match(appConfig, new RegExp(label))
assert.doesNotMatch(appConfig, /pagePath:\s*'pages\/profile\/index'/)
assert.doesNotMatch(matchPage, /createMatchApplyTicket/)
assert.match(matchPage, /CareerWatchPage/)
assert.doesNotMatch(matchPage, /LegacyMatch|parseCareerResume|analyzeCareerProfile/)
assert.doesNotMatch(matchCard, /match-company-card__opportunity-icon/)
assert.doesNotMatch(matchCard, /presentation\.[a-zA-Z]+ \|\| '暂无数据'/)
assert.match(matchCard, /presentation\.jobLocation/)
assert.match(matchCard, />去申请</)
assert.doesNotMatch(matchCard, /查看职位详情 →|>可申请</)
assert.match(matchCard, /presentation\.descriptionSnippet \? <Text/)
assert.match(matchCard, /hasJudgments \? <View/)
assert.match(matchCardStyles, /grid-template-columns: minmax\(0, 1fr\) 132px/)
assert.match(matchCardStyles, /\.match-company-card__identity-main \{ display: flex;[^}]+flex-direction: column/)
assert.doesNotMatch(matchCardStyles, /\.match-company-card__fit \{[^}]*flex:\s*1/)
assert.match(matchCardPresentation, /roles\.join\('\s*\/\s*'\)/)
assert.match(matchCardPresentation, /jobLocation: String\(company\.jobLocation \|\| ''\)\.trim\(\)/)
assert.match(matchCardPresentation, /conciseCompanyDescription\(company\.description\) \|\| '暂未收录企业简介'/)
assert.doesNotMatch(matchCardPresentation, /factualChineseDescription/)
assert.match(matchCard, /formatCalendarDate\(company\.updatedAt\)/)
assert.match(matchCard, /非会员仅一次/)
assert.match(matchCard, /会员日更中/)
assert.match(matchCard, /onOpenJob\(company\)/)
assert.match(matchCardStyles, /match-company-card__freshness/)
assert.match(watchPage, /方向与企业/)
assert.match(watchPage, /fixed_free/)
assert.match(companyDetail, /setClipboardData/)
assert.match(companyDetail, /公开岗位/)
assert.match(companyDetail, /pages\/job-detail\/index/)
assert.match(companyDetail, /企业联系人/)
assert.match(companyDetail, /会员专属 · 开通后可查看已收录联系人/)
assert.match(companyDetail, /company-detail__member-badge/)
assert.doesNotMatch(companyDetail, /company-job__source/)
assert.match(companyDetail, /company-detail__jobs-source'>岗位来自企业官网/)
assert.match(companyDetail, /Number\(company\.contactCount \|\| 0\) > 0/)
assert.ok(companyDetail.indexOf('{contactSection}') > companyDetail.indexOf("activeTab === 'overview'"))
assert.ok(companyDetail.indexOf('{contactSection}') < companyDetail.indexOf("activeTab === 'jobs'"))
assert.match(contentService, /if \(!response\.access\.contacts\) delete company\.contacts/)

const companyDirectoryMapper = fs.readFileSync(new URL('./cloudrun/company-directory.mjs', import.meta.url), 'utf8')
const companyCloudRun = fs.readFileSync(new URL('./cloudrun/index.mjs', import.meta.url), 'utf8')
assert.match(companyDirectoryMapper, /sameCompany/)
assert.match(companyCloudRun, /query: \{ id: jobId, page: '1', limit: '1', sortBy: 'recent' \}/)
assert.match(companyDirectoryMapper, /sourceLabel:/)
assert.match(companyDirectoryMapper, /岗位来自企业官网/)
assert.match(companyDirectoryMapper, /岗位来自公开招聘渠道/)
assert.match(companyCloudRun, /query: \{ companyId: id, page: '1', limit: '100', sortBy: 'recent' \}/)
assert.match(companyCloudRun, /if \(!jobs\.length && companyName\)/)

const matchDraft = fs.readFileSync(new URL('./miniprogram/src/utils/match-draft.ts', import.meta.url), 'utf8')
assert.match(matchDraft, /MATCH_DRAFT_TTL_MS = 24 \* 60 \* 60 \* 1000/)
assert.match(matchDraft, /draft\.retention === 'session'/)
assert.match(matchDraft, /LEGACY_MATCH_DRAFT_KEY/)

console.log('mini company match checks passed')
