import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
}

const gateway = read('./lib/api-handlers/mini-gateway.js')
const cloudrun = read('./cloudrun/index.mjs')
const migration = read('./server-utils/dal/migrations/056_mini_launch_readiness.sql')
const app = read('./miniprogram/src/app.ts')
const profile = read('./miniprogram/src/pages/profile/index.tsx')
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
  assert.match(gateway, new RegExp(`['\"]${action}['\"]`), `gateway must expose ${action}`)
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
assert.ok(gateway.includes("['openid', openid]"), 'gateway must rate-limit OpenID independently')
assert.ok(gateway.includes("['email', email]"), 'gateway must rate-limit email independently')
assert.ok(gateway.includes("['client', clientKey]"), 'gateway must rate-limit client IP independently')
assert.ok(gateway.includes('accepted_at = NOW()'), 'consent time must be recorded by the server')
assert.ok(app.includes('getUpdateManager'), 'Mini Program must prompt for ready updates')
assert.ok(!profile.includes('简历与职业方向'), 'unfinished resume entry must stay hidden')
assert.ok(!profile.includes('推荐偏好'), 'unfinished preference entry must stay hidden')
assert.equal(projectConfig.setting.minified, true, 'release upload must be minified')
assert.equal(projectConfig.setting.uploadWithSourceMap, false, 'release upload must not include source maps')
assert.notEqual(developmentExample, productionExample, 'development and production examples must remain distinct')

console.log('mini release-readiness contract checks passed')
