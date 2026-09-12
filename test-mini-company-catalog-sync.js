import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  applyPreviewCompanyCatalogSnapshot,
  validateCompanyCatalogSnapshot
} from './lib/services/mini-company-catalog-sync-service.js'
import { readFormalCompanyCatalog } from './cloudrun/company-directory.mjs'

const company = { id: 'c-1', name: 'Safe Co', translations: { zh: '安全公司' }, website: 'https://safe.example.com' }
const job = {
  id: 'j-1', companyId: 'c-1', title: 'Product Manager', status: 'active', isApproved: true,
  memberOnly: false, url: 'https://safe.example.com/jobs/1', firstSeenAt: '2026-09-09T00:00:00Z'
}
const valid = validateCompanyCatalogSnapshot({ version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [job] })
assert.equal(valid.companies.length, 1)
assert.equal(valid.jobs[0].isApproved, true)
const dated = validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company],
  jobs: [{ ...job, publishedAt: new Date('2026-09-09T08:00:00+08:00') }]
})
assert.equal(dated.jobs[0].publishedAt, '2026-09-09T00:00:00.000Z')

assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company],
  jobs: [{ ...job, isApproved: false }]
}), /approved public active job/i)
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [{ ...company, contacts: [] }], jobs: [job]
}), /private field contacts/i)
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [{ ...company, translations: { zh: { users: [] } } }], jobs: [job]
}), /private field users/i)
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 2, totalJobs: 1, companies: [company], jobs: [job]
}), /count mismatch/i)
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [{ ...job, companyId: 'missing' }]
}), /missing company/i)
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1, generatedBy: 'admin', companies: [company], jobs: [job]
}), /unsupported catalog field/i)

const statements = []
const client = {
  query(sql, params) {
    statements.push({ sql, params })
    return Promise.resolve([])
  },
  transaction(queries) {
    assert.ok(Array.isArray(queries) && queries.length > 0)
    return Promise.all(queries)
  }
}
const imported = await applyPreviewCompanyCatalogSnapshot(
  { version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [job] },
  { allowImport: true, client, environment: { VERCEL_ENV: 'preview', MINI_ALLOW_CATALOG_IMPORT: 'true' } }
)
assert.equal(imported.imported, true)
assert.ok(statements.some(({ sql }) => /trusted_companies/i.test(sql)))
assert.ok(statements.some(({ sql }) => /mini_catalog_projection/i.test(sql)))
assert.ok(statements.some(({ sql }) => /company_job_history/i.test(sql)))
assert.ok(statements.some(({ sql }) => /role_families/i.test(sql)))
for (const { sql, params } of statements) {
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]))
  if (!placeholders.length) continue
  const max = Math.max(...placeholders)
  assert.deepEqual([...new Set(placeholders)].sort((a, b) => a - b), Array.from({ length: max }, (_, index) => index + 1))
  assert.equal(params.length, max)
}

const guardClient = {
  query(sql) {
    if (/COUNT\(\*\).*mini_catalog_projection/i.test(sql)) return Promise.resolve([{ projection_jobs: 10 }])
    throw new Error('catalog removal guard should stop before transaction')
  },
  transaction() {
    throw new Error('catalog removal guard should stop before transaction')
  }
}
await assert.rejects(() => applyPreviewCompanyCatalogSnapshot(
  { version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [job] },
  { allowImport: true, client: guardClient, environment: { VERCEL_ENV: 'preview', MINI_ALLOW_CATALOG_IMPORT: 'true' } }
), /removal ratio exceeds 20% safety limit/i)

await assert.rejects(() => applyPreviewCompanyCatalogSnapshot(
  { version: 'v1', totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [job] },
  { allowImport: true, client, environment: { VERCEL_ENV: 'production', MINI_ALLOW_CATALOG_IMPORT: 'true' } }
), /Preview-only/i)

const snapshotCalls = []
const snapshotCatalog = await readFormalCompanyCatalog(async (action, options) => {
  snapshotCalls.push({ action, options })
  return {
    version: 'snapshot-v1', generatedAt: '2026-09-10T00:00:00.000Z', page: 1, pageSize: 250,
    totalCompanies: 1, totalJobs: 1, companies: [company], jobs: [job]
  }
})
assert.equal(snapshotCatalog.source, 'snapshot')
assert.deepEqual(snapshotCalls.map(({ action }) => action), ['company_catalog_snapshot'])

const legacyCalls = []
await assert.rejects(() => readFormalCompanyCatalog(async (action) => {
  legacyCalls.push({ action })
  const error = new Error('Unknown mini gateway action')
  error.statusCode = 404
  error.payload = { error: 'Unknown mini gateway action' }
  throw error
}, { pageSize: 2 }), /Unknown mini gateway action/)
assert.deepEqual(legacyCalls.map(({ action }) => action), ['company_catalog_snapshot'])

await assert.rejects(() => readFormalCompanyCatalog(async (action) => {
  if (action === 'company_catalog_snapshot') {
    const error = new Error('Unauthorized')
    error.statusCode = 401
    throw error
  }
  throw new Error('legacy sync must not be called')
}), /Unauthorized/)

const gatewaySource = fs.readFileSync('./lib/api-handlers/mini-gateway.js', 'utf8')
assert.match(gatewaySource, /company_catalog_snapshot/)
assert.match(gatewaySource, /company_catalog_import/)
assert.match(gatewaySource, /MINI_GATEWAY_READONLY_SECRET/)
assert.match(gatewaySource, /action === 'company_catalog_import'[\s\S]+MINI_GATEWAY_SHARED_SECRET/)
assert.match(gatewaySource, /profile = await getCareerWatchProfile\(viewer\.user\.userId\)/)
const cloudRunSource = fs.readFileSync('./cloudrun/index.mjs', 'utf8')
const companyDirectorySource = fs.readFileSync('./cloudrun/company-directory.mjs', 'utf8')
assert.match(cloudRunSource, /POST' && url\.pathname === '\/internal\/catalog-sync'/)
assert.match(cloudRunSource, /MINI_CATALOG_SYNC_ENABLED/)
assert.match(companyDirectorySource, /target: 'formal'/)
assert.doesNotMatch(companyDirectorySource, /legacyCatalogCompany|legacy_sync/)
assert.match(cloudRunSource, /target: 'preview'/)
assert.match(cloudRunSource, /function scheduleCompanyCatalogSync\(\)[\s\S]+syncCompanyCatalogToPreview\(\)\.catch/)
assert.match(cloudRunSource, /catalog sync failed/)
assert.match(cloudRunSource, /POST' && url\.pathname === '\/internal\/catalog-sync'[\s\S]+await syncCompanyCatalogToPreview/)
assert.match(cloudRunSource, /server\.listen\(port,[\s\S]+if \(catalogSyncEnabled\) scheduleCompanyCatalogSync\(\)/)
assert.match(cloudRunSource, /setInterval\(scheduleCompanyCatalogSync, CATALOG_SYNC_INTERVAL_MS\)/)
assert.match(cloudRunSource, /sortBy: url\.searchParams\.get\('sortBy'\)/)
assert.match(fs.readFileSync('./lib/services/mini-company-catalog-sync-service.js', 'utf8'), /JOIN jobs j ON j\.company_id = tc\.company_id[\s\S]+LEFT JOIN company_job_history h ON h\.company_id = tc\.company_id AND h\.source_job_id = j\.job_id/)
assert.match(fs.readFileSync('./scripts/deploy-mini-preview.mjs', 'utf8'), /MINI_ALLOW_CATALOG_IMPORT/)
assert.doesNotMatch(fs.readFileSync('./scripts/deploy-mini-cloudrun.mjs', 'utf8'), /deployVercelProduction|vercel', '--prod'/)
console.log('mini company catalog sync tests passed')
