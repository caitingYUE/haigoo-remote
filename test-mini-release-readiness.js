import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
}

const gateway = read('./lib/api-handlers/mini-gateway.js')
const cloudrun = read('./cloudrun/index.mjs')
const migration = read('./server-utils/dal/migrations/056_mini_launch_readiness.sql')
const hardeningMigration = read('./server-utils/dal/migrations/057_mini_security_and_consistency.sql')
const auth = read('./api/auth.js')
const userHelper = read('./server-utils/user-helper.js')
const bugReports = read('./lib/api-handlers/bug-reports.js')
const app = read('./miniprogram/src/app.ts')
const profile = read('./miniprogram/src/pages/profile/index.tsx')
const jobsService = read('./miniprogram/src/services/jobs-service.ts')
const projectConfig = JSON.parse(read('./miniprogram/project.config.json'))
const developmentExample = read('./miniprogram/.env.development.example')
const productionExample = read('./miniprogram/.env.production.example')

for (const action of [
  'request_password_reset',
  'unbind_wechat',
  'delete_account',
  'feedback',
  'events',
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
assert.ok(jobsService.includes('getMiniSessionCacheKey()'), 'job response cache must be isolated by WeChat session')
assert.ok(app.includes('getUpdateManager'), 'Mini Program must prompt for ready updates')
assert.ok(!profile.includes('简历与职业方向'), 'unfinished resume entry must stay hidden')
assert.ok(!profile.includes('推荐偏好'), 'unfinished preference entry must stay hidden')
assert.equal(projectConfig.setting.minified, true, 'release upload must be minified')
assert.equal(projectConfig.setting.uploadWithSourceMap, false, 'release upload must not include source maps')
assert.notEqual(developmentExample, productionExample, 'development and production examples must remain distinct')

console.log('mini release-readiness contract checks passed')
