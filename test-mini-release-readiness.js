import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
}

const gateway = read('./lib/api-handlers/mini-gateway.js')
const processedJobs = read('./lib/api-handlers/processed-jobs.js')
const cloudrun = read('./cloudrun/index.mjs')
const migration = read('./server-utils/dal/migrations/073_mini_content_consultation.sql')
const careerMigration = read('./server-utils/dal/migrations/075_mini_career_match.sql')
const appConfig = read('./miniprogram/src/app.config.ts')
const contentService = read('./miniprogram/src/services/content-service.ts')
const cloudAssetService = read('./miniprogram/src/services/cloud-asset-service.ts')
const home = read('./miniprogram/src/pages/index/index.tsx')
const companies = read('./miniprogram/src/pages/companies/index.tsx')
const companyDetail = read('./miniprogram/src/pages/company-detail/index.tsx')
const growth = read('./miniprogram/src/pages/growth/index.tsx')
const noteDetail = read('./miniprogram/src/pages/note-detail/index.tsx')
const consultation = read('./miniprogram/src/pages/consultation/index.tsx')
const membership = read('./miniprogram/src/pages/membership/index.tsx')
const profile = read('./miniprogram/src/pages/profile/index.tsx')
const virtualPaymentClient = read('./miniprogram/src/services/virtual-payment-service.ts')
const virtualPaymentCallback = read('./api/wechat-virtual-payment-notify.js')
const crmApi = read('./api/admin/member-crm.js')
const crmPage = read('./src/pages/AdminMemberCrmPage.tsx')
const miniSourcePaths = fs.readdirSync(new URL('./miniprogram/src/pages/', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

for (const action of ['content_home', 'companies', 'company', 'growth_notes', 'growth_note', 'membership_plans', 'consultations', 'career_state', 'career_resume_parse', 'career_profile', 'career_analyze', 'career_delete']) {
  assert.match(gateway, new RegExp(`['"]${action}['"]`), `Gateway must expose ${action}`)
}
for (const route of ['/mini/home', '/mini/companies', '/mini/growth/notes', '/mini/membership/plans', '/mini/consultations', '/mini/consultations/me', '/mini/match', '/mini/match/resume/parse', '/mini/match/profile', '/mini/match/analyze', '/mini/match/data']) {
  assert.ok(cloudrun.includes(route), `CloudRun must proxy ${route}`)
}

assert.ok(appConfig.includes('custom: true'), 'center Match navigation must use a custom tab bar')
assert.ok(appConfig.includes("text: '企业'") && appConfig.includes("text: 'Match'") && appConfig.includes("text: '笔记'"), 'tab labels must match the Match-centered Mini Program')
assert.ok(!appConfig.includes("pagePath: 'pages/profile/index'"), 'profile must open from the avatar instead of the tab bar')
for (const removedPage of ['jobs', 'job-detail', 'activity', 'learning']) {
  assert.equal(miniSourcePaths.includes(removedPage), false, `${removedPage} must not ship in the Mini Program client`)
}
assert.ok(!contentService.includes('/mini/jobs'), 'content client must not call job APIs')
assert.ok(contentService.includes('responseCache'), 'content reads should deduplicate repeat CloudBase container calls')
assert.ok(cloudAssetService.includes('getTempFileURL') && cloudAssetService.includes('fileList'), 'CloudBase file IDs must be resolved in batches before rendering')
assert.ok(!home.includes('JobCard') && !companies.includes('岗位') && !companyDetail.includes('申请入口'), 'content pages must not render job conversion UI')
assert.ok(home.includes('parseCareerResume') && home.includes('analyzeCareerProfile') && home.includes('本次 Match 免费'), 'center page must provide the Match workflow')
assert.ok(contentService.includes('previewLimit') && companies.includes('searchEnabled') && companies.includes('fullDirectory'), 'company UI must follow server access metadata')
assert.ok(companyDetail.includes('CEO 洞察') && !companyDetail.includes('Careers'), 'company detail must expose insight without careers CTA')
assert.ok(growth.includes('fetchGrowthNotes') && noteDetail.includes('fetchGrowthNote'), 'growth pages must use the new note APIs')
assert.ok(noteDetail.includes('note.notes?.map') && noteDetail.includes("className='note-lock'") && noteDetail.includes('查看会员方案'), 'note detail must cover unlocked and locked states')

assert.ok(gateway.includes("accessTier === 'free' || canAccessPaidContent"), 'note access must reuse canonical access tier rules')
assert.ok(gateway.includes("if (!detail || !unlocked) return note"), 'locked note mapping must return before adding body and audio')
assert.ok(gateway.includes("rights_status IN ('owned', 'licensed')"), 'audio must require owned or licensed rights')
assert.ok(gateway.includes("cloud_file_id LIKE 'cloud://%'"), 'audio must be cached in CloudBase')
assert.ok(migration.includes('corporate_learning_audio_assets') && migration.includes('authorization_reference'), 'audio rights evidence must be persisted')

for (const planId of ['club_starter_monthly', 'club_half_year', 'club_annual']) {
  assert.ok(gateway.includes(planId), `membership plan API must allow ${planId}`)
}
assert.ok(gateway.includes("systemSettingsService.getSetting('membership_plan_config')"), 'plan pricing must come from system settings')
assert.ok(!membership.includes('const MEMBER_PLANS'), 'client must not hardcode plan prices')
assert.ok(membership.includes('paymentAvailable') && membership.includes('isVirtualPaymentSupported'), 'payment buttons must follow server and device capability')
assert.ok(membership.includes('暂时无法购买'), 'unsupported payment environments must show a safe state')
assert.ok(virtualPaymentClient.includes('requestVirtualPayment'), 'supported environments must use official virtual payment')
assert.ok(virtualPaymentCallback.includes('hasValidSignature(req)'), 'payment callbacks must stay authenticated')

assert.ok(migration.includes('member_crm_consultation_requests'), 'consultation CRM table must exist')
assert.ok(migration.includes('UNIQUE (user_id, idempotency_key)'), 'consultation submission must be idempotent')
assert.ok(consultation.includes('MINI_PRIVACY_VERSION') && consultation.includes('acceptedAt'), 'consultation consent must be auditable')
assert.ok(gateway.includes("action: 'consultations'"), 'consultation write must use gateway idempotency')
assert.ok(gateway.includes("action, entity_type, entity_id, metadata"), 'consultation source must be written to CRM audit')
assert.ok(crmApi.includes("resource === 'consultations'"), 'CRM must expose a consultation queue API')
assert.ok(crmPage.includes('ConsultationQueue') && crmPage.includes('咨询待联系'), 'CRM must render the pending consultation queue')

assert.ok(profile.includes('会员与权益') && profile.includes('职业咨询') && profile.includes('订单记录') && profile.includes('账号与安全'), 'profile must contain only 1.0 account and service entries')
assert.ok(profile.includes('职业资料'), 'profile must expose career data retention and deletion')
assert.ok(!profile.includes('收藏岗位') && !profile.includes('岗位订阅') && !profile.includes('申请入口记录'), 'profile must not expose removed job workflows')

// Old server routes remain during the 1.0 rollback window, while no client route references them.
assert.ok(cloudrun.includes("url.pathname === '/mini/jobs'"), 'legacy server job list route must remain for one release')
assert.ok(gateway.includes("action === 'sync'"), 'legacy job synchronization must remain available')
assert.ok(gateway.includes('trustedCompaniesOnly: true'), 'Mini synchronization must request trusted-company jobs only')
assert.ok(processedJobs.includes('queryParams.trustedCompaniesOnly') && processedJobs.includes("mini_trusted_company.status = 'active'"), 'sync queries must enforce the active trusted-company boundary')
assert.ok(cloudrun.includes('2026-08-18-trusted-companies-only-v1'), 'trusted-company filter must invalidate the old Mini cache model')
assert.ok(cloudrun.includes('MINI_ENABLE_LEGACY_JOB_CACHE') && cloudrun.includes('legacy_job_cache_disabled'), 'legacy background job cache must be opt-in in Mini Program 1.0')
assert.ok(cloudrun.includes('if (!legacyJobCacheEnabled) return fetchUpstreamJobs(query)'), 'disabled legacy cache must not serve stale RSS documents')
assert.ok(cloudrun.includes("contentAssetDocument = 'content-images'") && cloudrun.includes('attachCompanyLogos'), 'content image uploads must use a persistent shared asset index')

assert.ok(careerMigration.includes('mini_career_profiles') && careerMigration.includes('retention_policy'), 'career profile retention must be persisted separately')
assert.ok(careerMigration.includes('mini_career_entitlements'), 'first free Match entitlement must survive career-data deletion')
assert.ok(gateway.includes('rawFileStored: false') && gateway.includes('redactCareerText'), 'resume parsing must not retain raw files and must redact before analysis')

console.log('mini 1.0 release-readiness contract checks passed')
