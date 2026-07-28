import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
}

const gateway = read('./lib/api-handlers/mini-gateway.js')
const cloudrun = read('./cloudrun/index.mjs')
const migration = read('./server-utils/dal/migrations/056_mini_launch_readiness.sql')
const hardeningMigration = read('./server-utils/dal/migrations/057_mini_security_and_consistency.sql')
const referralContactsMigration = read('./server-utils/dal/migrations/058_trusted_company_referral_contacts.sql')
const auth = read('./api/auth.js')
const userHelper = read('./server-utils/user-helper.js')
const bugReports = read('./lib/api-handlers/bug-reports.js')
const app = read('./miniprogram/src/app.ts')
const profile = read('./miniprogram/src/pages/profile/index.tsx')
const jobsService = read('./miniprogram/src/services/jobs-service.ts')
const jobsPage = read('./miniprogram/src/pages/jobs/index.tsx')
const jobFilters = read('./miniprogram/src/data/job-filters.ts')
const jobCard = read('./miniprogram/src/components/job-card/index.tsx')
const jobApplication = read('./miniprogram/src/utils/job-application.ts')
const jobDetail = read('./miniprogram/src/pages/job-detail/index.tsx')
const brandHeader = read('./miniprogram/src/components/brand-header/index.tsx')
const miniIcon = read('./miniprogram/src/components/mini-icon/index.tsx')
const homePage = read('./miniprogram/src/pages/index/index.tsx')
const websiteNotice = read('./miniprogram/src/components/website-notice/index.tsx')
const membershipPage = read('./miniprogram/src/pages/learning/index.tsx')
const processedJobs = read('./lib/api-handlers/processed-jobs.js')
const projectConfig = JSON.parse(read('./miniprogram/project.config.json'))
const developmentExample = read('./miniprogram/.env.development.example')
const productionExample = read('./miniprogram/.env.production.example')
const deployScript = read('./scripts/deploy-mini-cloudrun.mjs')
const taroConfig = read('./miniprogram/config/index.ts')
const miniPackage = JSON.parse(read('./miniprogram/package.json'))
const rootPackage = JSON.parse(read('./package.json'))

for (const action of [
  'request_password_reset',
  'unbind_wechat',
  'delete_account',
  'feedback',
  'events',
  'application_usage',
  'application_status'
]) {
  assert.match(gateway, new RegExp(`['"]${action}['"]`), `gateway must expose ${action}`)
}

for (const route of [
  '/mini/account/request-password-reset',
  '/mini/account/unbind',
  '/mini/account/delete',
  '/mini/feedback',
  '/mini/events',
  '/mini/application-usage',
  'application-status'
]) {
  assert.ok(cloudrun.includes(route), `CloudRun must proxy ${route}`)
}

assert.ok(migration.includes('mini_rate_limits'), 'rate-limit migration must exist')
assert.ok(migration.includes('mini_account_consents'), 'consent migration must exist')
assert.ok(migration.includes('mini_idempotency_keys'), 'idempotency migration must exist')
assert.ok(hardeningMigration.includes('consume_mini_job_views'), 'browse allowance must be serialized in the database')
assert.ok(hardeningMigration.includes('pg_advisory_xact_lock'), 'concurrent browse requests must share an identity lock')
assert.ok(hardeningMigration.includes('reset_token'), 'password reset must not overwrite email verification tokens')
assert.ok(referralContactsMigration.includes('ADD COLUMN IF NOT EXISTS referral_contacts'), 'trusted-company referral contacts must have a repeatable migration')
assert.ok(gateway.includes("['openid', openid]"), 'gateway must rate-limit OpenID independently')
assert.ok(gateway.includes("['email', email]"), 'gateway must rate-limit email independently')
assert.ok(gateway.includes("['client', clientKey]"), 'gateway must rate-limit client IP independently')
assert.ok(gateway.includes('accepted_at = NOW()'), 'consent time must be recorded by the server')
assert.ok(gateway.includes("action: 'unbind_wechat'"), 'unbind password checks must be rate-limited')
assert.ok(gateway.includes("action: 'delete_account'"), 'account deletion password checks must be rate-limited')
assert.ok(gateway.includes("action: 'favorite'"), 'favorite writes must honor idempotency keys')
assert.ok(gateway.includes("action: 'subscription'"), 'subscription writes must honor idempotency keys')
assert.ok(gateway.includes("action: 'application_status'"), 'application confirmation writes must honor idempotency keys')
assert.ok(gateway.includes('expires_at <= NOW()'), 'expired idempotency keys must be reclaimable')
assert.ok(auth.includes('resetToken'), 'password reset must use the dedicated reset token')
assert.ok(auth.includes('hashPasswordResetToken(resetToken)'), 'password reset tokens must be hashed at rest')
assert.ok(!auth.includes('JSON.stringify(user)'), 'authentication logs must not serialize complete user records')
assert.ok(!bugReports.includes('JSON.stringify(req.headers)'), 'request logs must not serialize authorization headers')
assert.ok(auth.includes("action: 'login'"), 'website login failures must be rate-limited')
assert.ok(auth.includes("limit: 5"), 'login and sensitive account checks must stop repeated guessing')
assert.ok(!auth.slice(auth.indexOf('async function handleRequestPasswordReset'), auth.indexOf('async function handleResetPassword')).includes('verificationToken:'), 'password reset request must preserve email verification tokens')
assert.ok(userHelper.includes('delete_interactions AS'), 'account deletion must clean application history')
assert.ok(userHelper.includes('delete_mini_views AS'), 'account deletion must clean Mini Program browse history')
assert.ok(cloudrun.includes('readAllListDocuments'), 'list cache must not silently stop at 1000 jobs')
assert.ok(cloudrun.includes("if (query.search)"), 'search must use the canonical upstream query rules')
assert.ok(cloudrun.includes("source: 'upstream-cold-cache'"), 'cold-cache pagination response must be explicit')
assert.ok(cloudrun.includes('MAX_REQUEST_BODY_BYTES'), 'CloudRun must cap request bodies')
assert.ok(cloudrun.includes("error.statusCode = 413"), 'oversized requests must return 413')
assert.ok(cloudrun.includes("url.pathname === '/mini/browse-status'"), 'list pages need a non-consuming browse status endpoint')
assert.ok(cloudrun.includes('canVisitorOpenJob'), 'visitor detail access must stay inside the default 20-job preview')
assert.ok(cloudrun.includes("body: { openid: session.openid, consume: false, mode: 'status' }"), 'browse status checks must not consume quota')
assert.ok(gateway.includes("MINI_BROWSE_QUOTA_VERSION || 'detail-v2'"), 'detail-only quota must not inherit legacy list-impression counters')
assert.ok(cloudrun.includes('CACHE_MODEL_VERSION'), 'job cache schema changes must trigger a full rebuild')
assert.ok(cloudrun.includes('editorialFeatured'), 'website-default sorting must remain separate from hot-application filtering')
assert.ok(cloudrun.includes('defaultRankStart'), 'default Mini Program ordering must preserve the website sync order')
assert.ok(cloudrun.includes('canRefer: _canRefer') && !cloudrun.includes('referralDifference'), 'unsupported referral metadata must not enter Mini Program cache or sorting')
assert.ok(cloudrun.includes('`${jobsApiOrigin}${source.startsWith'), 'relative formal Logo URLs must resolve against the formal job origin')
assert.ok(cloudrun.includes("'x-vercel-protection-bypass'"), 'development CloudRun must support protected Preview gateways')
assert.ok(deployScript.includes("apiOrigin: 'https://haigooremote.com'"), 'production deployment must pin the formal gateway origin')
assert.ok(deployScript.includes("apiOrigin: 'https://mini-preview.haigooremote.com'"), 'development deployment must pin the stable Preview gateway origin')
assert.ok(deployScript.includes("jobsApiOrigin: 'https://haigooremote.com'"), 'development job reads must pin the formal read-only source')
assert.ok(deployScript.includes('MINI_GATEWAY_READONLY_SECRET'), 'formal job reads must use a scoped Vercel secret')
assert.ok(deployScript.includes('CloudRun must use'), 'CloudRun deployment must reject a gateway origin from the wrong environment')
assert.ok(taroConfig.includes("'dist-prod' : 'dist'"), 'production and development bundles must use separate output roots')
assert.ok(miniPackage.scripts['build:weapp:prod'].includes('prepare:weapp:prod'), 'production builds must prepare an isolated WeChat project')
assert.ok(rootPackage.scripts['deploy:mini-preview'], 'Preview gateway promotion must have a repeatable command')
assert.ok(rootPackage.scripts['check:mini-gateway:dev'], 'development gateway must have a repeatable smoke check')
assert.ok(rootPackage.scripts['check:mini-jobs:dev'], 'formal development job reads must have a repeatable smoke check')
assert.ok(rootPackage.scripts['check:mini-cache:dev'], 'development CloudBase cache must have a repeatable diagnostic')
assert.ok(jobsService.includes('getMiniSessionCacheKey()'), 'job response cache must be isolated by WeChat session')
assert.ok(jobsService.includes("'/mini/browse-status'"), 'the job list must refresh remaining quota without consuming it')
assert.ok(jobsPage.includes('browse.remaining <= 20'), 'quota copy must only appear near the free limit')
assert.ok(jobsPage.includes('免费版本可享有100次查看额度，完整功能可前往网站或了解 Club 权益。'), 'quota copy must use the approved customer-facing message')
assert.ok(jobsPage.includes('登录查看完整岗位'), 'guest job filters must expose a prominent login entry')
assert.ok(jobFilters.indexOf("{ label: '全部'") < jobFilters.indexOf("{ label: '🔥 热门'"), 'all jobs must appear before the hot tab')
assert.ok(processedJobs.includes('HAVING COUNT(DISTINCT hot_uji.user_id) >= 10'), 'hot jobs must follow the website application threshold')
assert.ok(jobCard.includes('🔥 热门申请'), 'hot job cards must use the approved spaced application label')
assert.ok(jobCard.includes("getApplicationMethods(job)"), 'job cards must render every available application method')
assert.ok(jobApplication.includes("methods.push({ type: 'website'") && jobApplication.includes("methods.push({ type: 'email'"), 'website and email application labels must coexist')
assert.ok(!jobApplication.includes('referral') && !jobApplication.includes('内推'), 'Mini Program must not fabricate an unsupported referral application mode')
assert.ok(jobApplication.includes('BOSS邮箱直申') && jobApplication.includes('HR邮箱直申'), 'direct-email labels must match the website vocabulary')
assert.ok(jobDetail.includes('fetchApplicationUsage') && jobDetail.includes('免费申请额度会与网站同步'), 'job detail must expose synchronized application quotas')
assert.ok(jobDetail.includes("applicationMethods.length > 1") && jobDetail.includes('选择申请方式'), 'job detail must support multiple application entry points')
assert.ok(!jobDetail.includes('APPLICATION OPTIONS'), 'job detail must not add a decorative English application heading')
assert.ok(brandHeader.includes('海狗远程') && brandHeader.includes("isMember ? 'Club' : 'Free'"), 'home header must show the Chinese brand and authenticated membership status')
assert.ok(brandHeader.includes('{authenticated ? (') && !brandHeader.includes('haigoo-avatar'), 'guest header must not render mock account identity')
assert.ok(miniIcon.includes('/assets/icons/${name}.png'), 'visible Mini Program icons must use packaged image assets')
assert.ok(taroConfig.includes("../assets/icons"), 'packaged Mini Program builds must copy local icon assets')
assert.ok(homePage.includes('home-page__club-icon'), 'home membership service must include a Club icon')
assert.ok(websiteNotice.includes('https://haigooremote.com/') && websiteNotice.includes('小程序主要展示岗位信息'), 'home and profile website notice must use the formal domain')
assert.ok(membershipPage.includes('Club Starter') && membershipPage.includes('Club Member') && membershipPage.includes('Club Partner'), 'the free membership tab must explain all three plans')
assert.ok(membershipPage.includes('haigoo-advisor.png') && membershipPage.includes('haigoo-community.webp'), 'membership consultation and community QR entries must be present')
assert.ok(!jobsService.includes('previewJobs') && !jobsService.includes('previewResponse'), 'job loading failures must never fall back to fabricated preview data')
assert.equal(fs.existsSync(new URL('./miniprogram/src/data/preview-jobs.ts', import.meta.url)), false, 'preview job fixtures must not ship')
assert.equal(fs.existsSync(new URL('./miniprogram/src/data/mock-data.ts', import.meta.url)), false, 'unused Mini Program mock data must not ship')
assert.ok(app.includes('getUpdateManager'), 'Mini Program must prompt for ready updates')
assert.ok(!profile.includes('简历与职业方向'), 'unfinished resume entry must stay hidden')
assert.ok(!profile.includes('推荐偏好'), 'unfinished preference entry must stay hidden')
assert.equal(projectConfig.setting.minified, true, 'release upload must be minified')
assert.equal(projectConfig.setting.uploadWithSourceMap, false, 'release upload must not include source maps')
assert.notEqual(developmentExample, productionExample, 'development and production examples must remain distinct')

console.log('mini release-readiness contract checks passed')
