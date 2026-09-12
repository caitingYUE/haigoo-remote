import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

// Read-only release preflight. Credentials stay in process memory.
const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1] || 'development'
const environments = {
  development: { envId: 'haigoo-dev-d2gctbzxma401b345', serviceName: 'haigoo-mini' },
  production: { envId: 'cloud1-d8ggt7rbl273f83c7', serviceName: 'haigoo-mini-prod' }
}
assert.ok(environments[target], 'target must be development or production')
const selected = environments[target]
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require('../cloudrun/node_modules/@cloudbase/node-sdk')
const credential = await checkAndGetCredential(true)
const app = cloudbase.init({ env: selected.envId, secretId: credential.secretId, secretKey: credential.secretKey, sessionToken: credential.token })
const checks = []
const routes = [
  { method: 'GET', path: '/health', expected: 200 },
  { method: 'GET', path: '/mini/career-watch/options', expected: 200 },
  { method: 'GET', path: '/mini/membership/plans', expected: 200 },
  // Empty credentials stop before WeChat and prove the deployed login route is reachable.
  { method: 'POST', path: '/mini/auth/session', expected: 400, data: {} },
  { method: 'GET', path: '/mini/match/follows', expected: 401 },
  { method: 'GET', path: '/mini/career-watch', expected: 401 },
  // A missing refresh route returns 404. An unauthenticated request must reach
  // the deployed handler and be rejected before any user data is touched.
  { method: 'POST', path: '/mini/career-watch/refresh', expected: 401, data: {} }
]
for (const route of routes) {
  const response = await app.callContainer({
    name: selected.serviceName,
    method: route.method,
    path: route.path,
    ...(route.data ? { data: route.data } : {})
  })
  assert.equal(response.statusCode, route.expected, `${route.method} ${route.path}`)
  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  checks.push({ method: route.method, route: route.path, status: response.statusCode,
    ...(route.path === '/health' ? { sourceRevision: data.sourceRevision, version: data.version } : {}),
    ...(route.path === '/mini/membership/plans' ? { paymentAvailable: data.paymentAvailable, plans: data.plans?.map(({ id, price, purchaseAvailable }) => ({ id, price, purchaseAvailable })) } : {})
  })
}
const membershipCheck = checks.find(({ route }) => route === '/mini/membership/plans')
assert.equal(membershipCheck.paymentAvailable, true, `${target} virtual payment must be available`)
assert.deepEqual(membershipCheck.plans?.map(({ id, price }) => ({ id, price })), [
  { id: 'club_starter_monthly', price: 99 },
  { id: 'mini_club_quarter_2026', price: 199 },
  { id: 'mini_club_half_year_2026', price: 699 }
])
const hash = crypto.createHash('sha256')
for (const name of ['index.mjs', 'company-directory.mjs', 'sync-policy.mjs', 'virtual-payment-reconciliation.mjs']) hash.update(fs.readFileSync(`cloudrun/${name}`))
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), target, localCloudrunRevision: hash.digest('hex'), checks }, null, 2))
