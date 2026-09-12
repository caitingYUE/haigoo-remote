import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const target = process.argv.includes('--production') ? 'production' : 'development'
const before = process.argv.includes('--before')
const env = target === 'production' ? 'cloud1-d8ggt7rbl273f83c7' : 'haigoo-dev-d2gctbzxma401b345'
const service = target === 'production' ? 'haigoo-mini-prod' : 'haigoo-mini'
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require(path.join(root, 'cloudrun/node_modules/@cloudbase/node-sdk'))
const credential = await checkAndGetCredential(true)
const app = cloudbase.init({ env, secretId: credential.secretId, secretKey: credential.secretKey, sessionToken: credential.token })
const result = { checkedAt: new Date().toISOString(), target, phase: before ? 'before' : 'after', guestOnly: true, requests: [], images: [] }
async function get(route, status = 200) {
  const started = Date.now()
  const response = await app.callContainer({ name: service, method: 'GET', path: route })
  assert.equal(response.statusCode, status, route)
  result.requests.push({ route, elapsedMs: Date.now() - started, status: response.statusCode })
  return typeof response.data === 'string' ? JSON.parse(response.data) : response.data
}
let companies
for (let i = 0; i < 4; i++) {
  const data = await get(`/mini/companies?page=1&pageSize=${i % 2 ? 12 : 20}`)
  assert.equal(data.access.scope, 'free_fixed')
  assert.ok(data.companies.length > 0 && data.companies.length <= 12)
  assert.equal(data.hasMore, false)
  assert.ok(Number.isFinite(Date.parse(data.serverTime)))
  companies = data.companies
}
result.companyCount = companies.length
result.directLogoCount = companies.filter(company => /^https:\/\//.test(company.logoUrl || '')).length
if (!before) {
  assert.equal(result.directLogoCount, companies.length, 'all current directory logos remain available')
  for (const company of companies) {
    assert.equal(company.logoFileId, company.logoUrl, 'old list/follow clients must skip private cloud lookups')
    const start = Date.now()
    const image = await fetch(company.logoUrl, { signal: AbortSignal.timeout(15000) })
    assert.equal(image.status, 200, company.name)
    assert.match(image.headers.get('content-type'), /^image\//)
    const bytes = (await image.arrayBuffer()).byteLength
    assert.ok(bytes > 0)
    result.images.push({ name: company.name, status: image.status, bytes, elapsedMs: Date.now() - start })
  }
  const search = await get('/mini/companies?search=Supabas')
  assert.equal(search.searchOutcome, 'matched')
  assert.ok(search.companies.some(company => company.name === 'Supabase'))
  assert.equal((await get('/mini/companies?search=Supa')).searchOutcome, 'too_broad')
  const detail = await get(`/mini/companies/${encodeURIComponent(search.companies[0].id)}`)
  assert.equal(detail.access.contacts, false)
  assert.ok(!detail.company.contacts?.length)
  assert.match(detail.company.logoUrl, /^https:\/\//)
  await get('/mini/match/follows', 401)
  await get('/mini/career-watch', 401)
}
const output = path.join(root, 'artifacts/mini-company-cache-2026-09-06')
await fs.mkdir(output, { recursive: true })
await fs.writeFile(path.join(output, `${target}-${before ? 'before' : 'after'}.json`), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
