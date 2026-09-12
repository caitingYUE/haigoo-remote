import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Read-only smoke check against the development service, using actual public
// company records and the existing CloudBase developer credentials.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require(path.join(root, 'cloudrun/node_modules/@cloudbase/node-sdk'))
const credential = await checkAndGetCredential(true)
const app = cloudbase.init({
  env: 'haigoo-dev-d2gctbzxma401b345', secretId: credential.secretId,
  secretKey: credential.secretKey, sessionToken: credential.token
})
const results = []
const directoryResponse = await app.callContainer({ name: 'haigoo-mini', method: 'GET', path: '/mini/companies' })
assert.equal(directoryResponse.statusCode, 200, 'company directory')
const directoryPayload = typeof directoryResponse.data === 'string' ? JSON.parse(directoryResponse.data) : directoryResponse.data
const companies = (directoryPayload.companies || []).slice(0, 3).map((company) => [company.name, company.id, true])
assert.equal(companies.length, 3, 'company directory smoke sample')
for (const [name, id, expectJobs] of companies) {
  const started = Date.now()
  const response = await app.callContainer({ name: 'haigoo-mini', method: 'GET', path: `/mini/companies/${id}`, header: { Accept: 'application/json' } })
  const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  assert.equal(response.statusCode, 200, `${name} response status`)
  assert.equal(payload.company?.name, name)
  assert.equal(payload.access?.contacts, false, 'guest must never get member contacts')
  assert.ok(!payload.company.contacts?.length, 'guest contact data must be redacted')
  assert.match(payload.company.logoFileId, /^(?:cloud:\/\/|https?:\/\/)/)
  if (expectJobs) assert.ok(payload.company.jobs.length > 0)
  const openRoleCategories = directoryPayload.companies.find((company) => company.id === id)?.openRoleCategories || []
  assert.ok(openRoleCategories.length > 0, `${name} real open-role categories`)
  assert.deepEqual(payload.company.openRoleCategories, openRoleCategories, `${name} list/detail must share current categories`)
  for (const category of openRoleCategories) {
    assert.ok(payload.company.jobs.some((job) => job.category === category), `${name} advertised category must have a visible job: ${category}`)
  }
  const firstJobId = payload.company.jobs[0]?.id
  const detail = await app.callContainer({ name: 'haigoo-mini', method: 'GET', path: `/mini/companies/${id}/jobs/${encodeURIComponent(firstJobId)}` })
  const jobPayload = typeof detail.data === 'string' ? JSON.parse(detail.data) : detail.data
  assert.equal(detail.statusCode, 200, `${name} job detail`)
  assert.equal(jobPayload.job?.id, firstJobId)
  assert.match(jobPayload.company?.logoFileId || '', /^(?:cloud:\/\/|https?:\/\/)/, `${name} job detail logo`)
  let logoUrl = payload.company.logoFileId
  if (logoUrl.startsWith('cloud://')) {
    const urls = await app.getTempFileURL({ fileList: [{ fileID: logoUrl, maxAge: 300 }] })
    assert.equal(urls.fileList[0]?.code, 'SUCCESS', `${name} cloud logo URL`)
    logoUrl = urls.fileList[0].tempFileURL
  }
  const logoResponse = await fetch(logoUrl, { signal: AbortSignal.timeout(15000) })
  assert.equal(logoResponse.status, 200, `${name} cloud logo download`)
  assert.match(logoResponse.headers.get('content-type') || '', /^image\//)
  const logoBytes = (await logoResponse.arrayBuffer()).byteLength
  assert.ok(logoBytes > 0 && logoBytes <= 2 * 1024 * 1024)
  for (const job of payload.company.jobs) {
    assert.ok(job.title)
    assert.doesNotMatch(job.jobType, /^(full[-_ ]?time|part[-_ ]?time)$/i)
    assert.ok(job.publishedAt && Number.isFinite(new Date(job.publishedAt).getTime()))
    assert.equal(typeof job.salary, 'string')
    assert.doesNotMatch(job.salary, /^[\[{]|\[object Object\]/)
    if (job.titleZh) assert.equal(job.title, job.titleZh)
  }
  results.push({ name, id, elapsedMs: Date.now() - started, logoReady: true, logoBytes, openRoleCategories, jobLogoReady: true, contactAccess: false,
    jobs: payload.company.jobs.map(({ id, title, jobType, location, salary, publishedAt }) => ({ id, title, jobType, location, salary, publishedAt })) })
}
// These companies require an authenticated follower for detail access. Verify
// public image availability without impersonating the signed-in app user.
const restrictedCompanyImages = []
if (process.argv.includes('--check-public-images')) {
  for (const [name, id] of [
    ['Appwrite', 'company_1764764359441_7mxvginbv'],
    ['Kraken', 'company_1764764359446_d8ki9qb29'],
    ['AlphaSights', 'company_1764764359441_f4wevit5d']
  ]) {
    const response = await fetch(`https://haigooremote.com/api/company-assets?companyId=${encodeURIComponent(id)}&type=logo`, {
      redirect: 'error', signal: AbortSignal.timeout(15000)
    })
    assert.equal(response.status, 200, `${name} public logo source`)
    assert.match(response.headers.get('content-type') || '', /^image\//)
    const bytes = (await response.arrayBuffer()).byteLength
    assert.ok(bytes > 0 && bytes <= 2 * 1024 * 1024)
    restrictedCompanyImages.push({ name, id, sourceStatus: 200, bytes, followedPageVisualVerified: false })
  }
}
const directory = path.join(root, 'artifacts/mini-company-polish-2026-09-05')
await fs.mkdir(directory, { recursive: true })
await fs.writeFile(path.join(directory, 'backend-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), environment: 'development', results, restrictedCompanyImages }, null, 2) + '\n')
console.log(JSON.stringify(results.map(({name,elapsedMs,logoBytes,jobs}) => ({name,elapsedMs,logoBytes,jobCount:jobs.length,firstJob:jobs[0]})), null, 2))
