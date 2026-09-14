import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy-for-tests-only'

const {
  buildCompanyContactPreview,
  maskCompanyContactName,
  normalizeOpenRoleCategories
} = await import('./lib/shared/mini-company-presentation.js')
const { buildMiniCompanyContactPayload, mapMiniCompany } = await import('./lib/api-handlers/mini-gateway.js')
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

assert.equal(maskCompanyContactName('张三'), '张*')
assert.equal(maskCompanyContactName('欧阳娜娜'), '欧***')
assert.equal(maskCompanyContactName('Jane Smith'), 'J*** S***')
assert.equal(maskCompanyContactName('Q'), 'Q')
assert.equal(maskCompanyContactName(''), '联系人')

const preview = buildCompanyContactPreview({
  id: 'contact-1',
  name: 'Jane Smith',
  title: 'VP People',
  email: 'jane@example.com',
  linkedin: 'https://linkedin.example/jane'
})
assert.deepEqual(preview, { id: 'contact-1', maskedName: 'J*** S***', title: 'VP People' })
assert.doesNotMatch(JSON.stringify(preview), /jane@example|linkedin|Jane Smith/)

assert.deepEqual(
  normalizeOpenRoleCategories(['软件开发', '前端开发', '后端开发', '前端开发', '其他']),
  ['前端开发', '后端开发']
)
assert.deepEqual(
  normalizeOpenRoleCategories(['设计', 'UI/UX设计', '产品经理']),
  ['UI/UX设计', '产品经理']
)
assert.deepEqual(normalizeOpenRoleCategories(['unknown', '', null]), [])

const rawContacts = [{
  id: 'private-contact-id',
  name: 'Jane Smith',
  title: 'VP People',
  hiringEmail: 'jane@example.com',
  linkedin: 'https://www.linkedin.com/in/jane-smith'
}, {
  name: 'Recruiting Team',
  title: 'Recruiting',
  hiringEmail: 'jobs@example.com'
}]
const publicApplicationEmails = new Set(['jobs@example.com'])
const lockedPayload = buildMiniCompanyContactPayload({ rawContacts, publicApplicationEmails })
assert.deepEqual(lockedPayload, {
  contactCount: 1,
  contactPreviews: [{ id: 'preview-1', maskedName: 'J*** S***', title: 'VP People' }]
})
const lockedJson = JSON.stringify(lockedPayload)
assert.doesNotMatch(lockedJson, /Jane Smith|jane@example|linkedin|private-contact-id|jobs@example/i)

const memberPayload = buildMiniCompanyContactPayload({
  rawContacts,
  publicApplicationEmails,
  canAccessContacts: true
})
assert.equal(memberPayload.contacts?.length, 1)
assert.equal(memberPayload.contacts?.[0].email, 'jane@example.com')
assert.doesNotMatch(JSON.stringify(memberPayload), /jobs@example/i)

const categorizedCompany = mapMiniCompany({
  company_id: 'company-role',
  name: 'Role Co',
  open_role_categories: ['软件开发', '前端开发', '产品经理']
})
assert.deepEqual(categorizedCompany.openRoleCategories, ['前端开发', '产品经理'])

const gateway = read('./lib/api-handlers/mini-gateway.js')
const matchService = read('./lib/services/mini-company-match-service.js')
const cloudrun = read('./cloudrun/index.mjs')
const careerClient = read('./miniprogram/src/services/career-match-service.ts')
const contentClient = read('./miniprogram/src/services/content-service.ts')
const appConfig = read('./miniprogram/src/app.config.ts')
const profilePage = read('./miniprogram/src/pages/profile/index.tsx')
const followedPage = read('./miniprogram/src/pages/followed-companies/index.tsx')
const companyDetailPage = read('./miniprogram/src/pages/company-detail/index.tsx')

assert.match(gateway, /mini_company_follows follows/)
assert.match(gateway, /contactPreviews/)
assert.match(gateway, /contactPreview:/)
assert.match(gateway, /publicApplicationEmails/)
assert.match(gateway, /tc\.status = 'active' OR EXISTS/)
assert.match(matchService, /in_app_enabled = \(EXCLUDED\.status = 'active'\)/)
assert.match(matchService, /SELECT \$1::varchar, \$2::varchar, \$3::varchar, \(\$3::varchar = 'active'\), FALSE, 'not_requested', NOW\(\)/)
assert.match(matchService, /wechat_enabled = CASE[\s\S]*EXCLUDED\.status = 'inactive'/)
assert.match(matchService, /wechat_template_status = CASE[\s\S]*'not_requested'/)
assert.match(matchService, /openRoleCategories/)
assert.match(matchService, /followedAt/)
assert.match(matchService, /SELECT company_id, name FROM trusted_companies WHERE company_id = \$1 LIMIT 1/)
assert.match(cloudrun, /attachFollowLogos/)
assert.match(careerClient, /CompanyFollowSummary/)
assert.match(contentClient, /fetchCompanyDetail/)
assert.doesNotMatch(contentClient, /delete company\.contact/)
assert.match(appConfig, /pages\/followed-companies\/index/)
assert.match(profilePage, /pages\/followed-companies\/index/)
assert.match(followedPage, /fetchCompanyFollows/)
assert.match(followedPage, /WechatReminderAction/)
assert.match(followedPage, /CompanyFollowAction/)
assert.match(companyDetailPage, /WechatReminderAction/)
assert.match(companyDetailPage, /unfollowedLabel='订阅匹配更新'/)
assert.doesNotMatch(companyDetailPage, /requestSubscribeMessage|unfollowCompany|取消订阅/)

console.log('mini company contacts and follows checks passed')
