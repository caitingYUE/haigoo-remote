import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

// Guest-only, public-data verification; never creates a session or writes follows.
const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const credential = await checkAndGetCredential(true)
const cloudbase = require(path.join(root, 'cloudrun/node_modules/@cloudbase/node-sdk'))
const app = cloudbase.init({ env: 'haigoo-dev-d2gctbzxma401b345', secretId: credential.secretId, secretKey: credential.secretKey, sessionToken: credential.token })
const get = async (route) => {
  const response = await app.callContainer({ name: 'haigoo-mini', method: 'GET', path: route })
  assert.equal(response.statusCode, 200, route)
  return typeof response.data === 'string' ? JSON.parse(response.data) : response.data
}
const results = []
const directory = await get('/mini/companies')
assert.ok(directory.companies.length <= 12)
assert.equal(directory.hasMore, false)
for (const [query, expected] of [['Supabas', 'Supabase'], ['Appwrit', 'Appwrite']]) {
  const started = Date.now()
  const response = await get(`/mini/companies?search=${encodeURIComponent(query)}&industry=unrelated-filter`)
  assert.equal(response.searchOutcome, 'matched')
  const company = response.companies.find((item) => item.name === expected)
  assert.ok(company, query)
  const detail = await get(`/mini/companies/${encodeURIComponent(company.id)}`)
  assert.equal(detail.company.name, expected)
  assert.equal(detail.access.contacts, false)
  assert.ok(!detail.company.contacts?.length)
  const sample = detail.company.jobs?.[0]
  if (sample) {
    const job = await get(`/mini/companies/${encodeURIComponent(company.id)}/jobs/${encodeURIComponent(sample.id)}`)
    assert.equal(job.job.id, sample.id)
    assert.ok(job.job.officialApplyUrl || job.job.publicApplicationEmail, 'real application destination')
  }
  results.push({ query, company: expected, outsideDefaultList: !directory.companies.some((item) => item.id === company.id), guestDetail: true, jobs: detail.company.jobs?.length || 0, elapsedMs: Date.now() - started })
}
const broad = await get('/mini/companies?search=Supa')
assert.equal(broad.searchOutcome, 'too_broad')
assert.equal(broad.companies.length, 0)
const missing = await get('/mini/companies?search=ZZNonexistentCompanyZZ')
assert.equal(missing.searchOutcome, 'not_found')
assert.equal(missing.companies.length, 0)
const result = { checkedAt: new Date().toISOString(), guestOnly: true, defaultCount: directory.companies.length, results, broadQueryBlocked: true, missingNameEmpty: true }
fs.writeFileSync(path.join(root, 'artifacts/mini-company-acquisition-2026-09-06/live-check.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
