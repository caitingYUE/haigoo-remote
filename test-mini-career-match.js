import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy-for-tests-only'

const { careerCompleteness, rankCareerCompanies, redactCareerText, retentionExpiry } = await import('./lib/services/mini-career-match-service.js')

const redacted = redactCareerText(`张三
电话：13800138000
邮箱：zhangsan@example.com
产品经理，负责 SaaS 产品规划与用户研究，推动三个跨部门项目上线。`)
assert.ok(!redacted.includes('张三'), 'likely name in resume header must be removed')
assert.ok(!redacted.includes('13800138000'), 'phone must be removed')
assert.ok(!redacted.includes('zhangsan@example.com'), 'email must be removed')
assert.match(redacted, /产品经理/, 'career facts must remain available')

const completeness = careerCompleteness(redacted.repeat(4), {
  location: '上海', timezone: 'UTC+8', workMode: '全职', careerGoal: '远程产品工作'
})
assert.equal(completeness.completeCount, 4)

const now = new Date('2026-08-14T00:00:00.000Z')
assert.equal(retentionExpiry('30_days', now)?.toISOString(), '2026-09-13T00:00:00.000Z')
assert.equal(retentionExpiry('long_term', now), null)
assert.equal(retentionExpiry('session', now), null)

const matches = rankCareerCompanies([
  { id: 'saas', name: 'SaaS Co', industry: 'SaaS', description: '产品与用户研究', tags: ['product'], specialties: ['async'], rating: 5 },
  { id: 'other', name: 'Other Co', industry: '物流', description: '运输网络', tags: [], specialties: [], rating: 4 }
], {
  headline: 'SaaS 产品经理', primaryFunctions: ['产品规划'], transferableSkills: ['用户研究'], domainAssets: ['SaaS'], targetRolesNow: ['产品经理']
}, {}, 2)
assert.equal(matches[0].id, 'saas')
assert.equal('_score' in matches[0], false, 'internal ranking score must not reach the Mini Program')
assert.match(matches[0].caution, /以企业官方信息为准/)

const agentSource = fs.readFileSync(new URL('./lib/services/member-crm-career-agent.js', import.meta.url), 'utf8')
assert.match(agentSource, /不提 AI、模型、算法、系统或内部流程/, 'user-facing Match output must avoid AI and internal-process language')

const companyMatchSource = fs.readFileSync(new URL('./lib/services/mini-company-match-service.js', import.meta.url), 'utf8')
assert.match(companyMatchSource, /loadRecommendations\(profileRow, userId\)/, 'recommendation runs must receive the authenticated user id explicitly')
assert.doesNotMatch(companyMatchSource, /profileRow\.user_id/, 'recommendation runs must not depend on an unselected profile user_id field')

console.log('mini career Match checks passed')
