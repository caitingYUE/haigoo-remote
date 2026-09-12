import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import neonHelper from './server-utils/dal/neon-helper.js'
import { archiveJobSnapshot, isEligibleDirectoryJob } from './lib/services/mini-company-match-service.js'
import { rankDirectoryCompanies } from './lib/services/mini-company-search-service.js'

const approved = {
  id: 'job-1',
  companyId: 'company-1',
  title: 'Product Manager',
  status: 'active',
  isApproved: true,
  memberOnly: false,
  url: 'https://example.com/jobs/1'
}

assert.equal(isEligibleDirectoryJob(approved), true)
assert.equal(isEligibleDirectoryJob({ ...approved, isApproved: undefined }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, isApproved: false }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, memberOnly: true }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, status: 'inactive' }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, url: '', hiringEmail: 'jobs@example.com' }), true)
assert.equal(isEligibleDirectoryJob({ ...approved, url: '', hiringEmail: '' }), false)

const directoryFixtures = [
  { id: 'a', name: 'Linear', public_job_search_terms: ['Product Manager', '产品经理'], latestPublicJobAt: '2026-09-09T01:00:00Z', open_role_categories: ['product'], openJobCount: 5 },
  { id: 'b', name: 'Figma', public_job_search_terms: ['Design Lead', '设计师'], latestPublicJobAt: '2026-09-09T02:00:00Z', open_role_categories: ['design'], openJobCount: 1 }
]
assert.deepEqual(rankDirectoryCompanies(directoryFixtures, { search: 'Prodcut Manager', mode: 'exact', sortBy: 'latest', roleFamilies: [] }).companies.map((item) => item.id), ['a'])
assert.equal(rankDirectoryCompanies(directoryFixtures, { search: 'Product', mode: 'exact', sortBy: 'latest', roleFamilies: [] }).outcome, 'too_broad')
assert.deepEqual(rankDirectoryCompanies(directoryFixtures, { search: '产品', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: ['product'] }).companies.map((item) => item.id), ['a'])
assert.deepEqual(rankDirectoryCompanies(directoryFixtures, { search: '%_', mode: 'fuzzy', sortBy: 'latest', roleFamilies: [] }).companies, [])
assert.deepEqual(rankDirectoryCompanies(directoryFixtures, { search: '', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: ['product'] }).companies.map((item) => item.id), ['a', 'b'])
assert.deepEqual(rankDirectoryCompanies(directoryFixtures, { search: '', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: [] }).companies.map((item) => item.id), ['a', 'b'], 'relevance should use current opportunity breadth without saved preferences')
assert.deepEqual(rankDirectoryCompanies([
  { id: 'company', name: 'Product Manager', public_job_search_terms: ['Other Role'], latestPublicJobAt: '2026-09-09T00:00:00Z' },
  { id: 'job', name: 'Other Co', public_job_search_terms: ['Product Manager'], latestPublicJobAt: '2026-09-09T02:00:00Z' }
], { search: 'Product Manager', mode: 'fuzzy', sortBy: 'latest' }).companies.map((item) => item.id), ['company', 'job'])

const originalDatabaseUrl = process.env.DATABASE_URL
const originalQuery = neonHelper.query
const archiveCalls = []
let archiveScenario = 'ineligible-new'
process.env.DATABASE_URL = 'postgresql://test.invalid/unit'
neonHelper.query = async (sql, params) => {
  archiveCalls.push({ sql, params })
  if (/SELECT status, hiring_email FROM trusted_companies/.test(sql)) {
    return [{ status: 'active', hiring_email: archiveScenario === 'email-only' ? 'jobs@example.com' : '' }]
  }
  if (/WHERE company_id = \$1 AND source_job_id = \$2/.test(sql)) {
    return archiveScenario === 'stable-url-change'
      ? [{ history_id: 'history-stable', source_url_hash: 'old-hash' }]
      : []
  }
  if (/WHERE company_id = \$1 AND source_url_hash = \$2/.test(sql)) {
    return archiveScenario === 'url-collision'
      ? [{ history_id: 'history-other', source_job_id: 'job-other' }]
      : []
  }
  if (/\b(?:INSERT INTO|UPDATE) company_job_history/.test(sql)) return [{ history_id: 'history-1' }]
  return []
}
try {
  await archiveJobSnapshot({ ...approved, isApproved: false })
  assert.equal(archiveCalls.some((call) => /INSERT INTO company_job_history/.test(call.sql)), false)
  assert.equal(archiveCalls.some((call) => /UPDATE company_job_history/.test(call.sql)), true)

  archiveCalls.length = 0
  archiveScenario = 'email-only'
  await archiveJobSnapshot({ ...approved, url: '', publishedAt: '2020-01-01T00:00:00.000Z' }, {
    firstSeenAt: '2026-09-09T00:00:00.000Z'
  })
  const emailOnlyInsert = archiveCalls.find((call) => /INSERT INTO company_job_history/.test(call.sql))
  assert.ok(emailOnlyInsert, 'trusted company email should make an approved email-only job public')
  assert.equal(emailOnlyInsert.params[12], '2026-09-09T00:00:00.000Z')
  assert.equal(emailOnlyInsert.params[13], '2020-01-01T00:00:00.000Z')

  archiveCalls.length = 0
  archiveScenario = 'stable-url-change'
  await archiveJobSnapshot({ ...approved, url: 'https://example.com/jobs/new-url' })
  assert.ok(archiveCalls.some((call) => /UPDATE company_job_history[\s\S]*SET source_url_hash = \$3/.test(call.sql)))
  assert.equal(archiveCalls.some((call) => /INSERT INTO company_job_history/.test(call.sql)), false)

  archiveCalls.length = 0
  archiveScenario = 'url-collision'
  await archiveJobSnapshot(approved)
  const collisionInsert = archiveCalls.find((call) => /INSERT INTO company_job_history/.test(call.sql))
  assert.equal(
    collisionInsert.params[2],
    crypto.createHash('sha256').update(`${approved.url}\n${approved.id}`).digest('hex')
  )
} finally {
  neonHelper.query = originalQuery
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
}

const migration = fs.readFileSync('server-utils/dal/migrations/088_harden_job_approval_default.sql', 'utf8')
assert.match(migration, /ALTER COLUMN is_approved SET DEFAULT FALSE/i)
assert.match(fs.readFileSync('src/components/AdminCompanyJobsModal.tsx', 'utf8'), /isApproved:\s*false/)

const matchService = fs.readFileSync('lib/services/mini-company-match-service.js', 'utf8')
const archiveStart = matchService.indexOf('export async function archiveJobSnapshot')
const archiveEnd = matchService.indexOf('\nexport async function rebuildCompanyHiringProfile', archiveStart)
const archiveSource = matchService.slice(archiveStart, archiveEnd)
assert.match(archiveSource, /firstSeenAt/)
assert.doesNotMatch(archiveSource, /first_seen_at\s*=\s*EXCLUDED\.first_seen_at/i)
assert.doesNotMatch(archiveSource, /isApproved\s*\?\?\s*job\.is_approved\s*\?\?\s*true/)

const processedJobs = fs.readFileSync('lib/api-handlers/processed-jobs.js', 'utf8')
assert.match(processedJobs, /isApproved:\s*j\.isApproved\s*===\s*true/)
assert.match(processedJobs, /hiringEmail:\s*String\(j\.hiringEmail\s*\|\|\s*j\.hiring_email/)
assert.match(processedJobs, /reconcileCompanyDirectoryHistory\(companyId,\s*\{\s*client:\s*sql,\s*rebuild:\s*false\s*\}\)/)
assert.match(processedJobs, /rebuildCompanyHiringProfile\(companyId\)/)
assert.match(processedJobs, /SELECT job_id, company_id FROM[^;]+WHERE job_id = \$1 LIMIT 1/)

const jobSync = fs.readFileSync('lib/services/job-sync-service.js', 'utf8')
assert.doesNotMatch(jobSync, /archiveJobSnapshot|rebuildCompanyHiringProfile/)
assert.match(jobSync, /reconcileCompanyDirectoryHistory\(companyId\)/)

const verifier = fs.readFileSync('lib/cron-handlers/stream-verify-links.js', 'utf8')
assert.doesNotMatch(verifier, /archiveJobSnapshot|rebuildCompanyHiringProfile/)
assert.ok(verifier.indexOf("SET status = 'inactive'") < verifier.indexOf('reconcileCompanyDirectoryHistory(job.effective_company_id)'))
assert.ok(verifier.indexOf('SET is_approved = false') < verifier.indexOf('reconcileCompanyDirectoryHistory(job.effective_company_id)', verifier.indexOf('SET is_approved = false')))

const trustedCompanies = fs.readFileSync('lib/api-handlers/trusted-companies.js', 'utf8')
assert.match(trustedCompanies, /SET member_only = \$2,[\s\S]+reconcileCompanyDirectoryHistory/)
assert.match(trustedCompanies, /UPDATE jobs SET status = 'inactive'[\s\S]+reconcileCompanyDirectoryHistory/)
assert.match(fs.readFileSync('lib/cron-handlers/stream-crawl-trusted-jobs.js', 'utf8'), /UPDATE jobs SET status = 'inactive'[\s\S]+reconcileCompanyDirectoryHistory/)

const miniContentService = fs.readFileSync('miniprogram/src/services/content-service.ts', 'utf8')
assert.match(miniContentService, /export type CompanyDirectorySort = 'latest' \| 'newest' \| 'relevance'/)
assert.match(miniContentService, /fetchCompanies\(params: \{[^}]*sortBy\?: CompanyDirectorySort/)
assert.match(miniContentService, /queryParams\.sortBy = sortBy/)
assert.match(miniContentService, /queryParams\.sortBy === 'newest'/)
const miniGateway = fs.readFileSync('lib/api-handlers/mini-gateway.js', 'utf8')
assert.match(miniGateway, /function normalizeMiniDirectorySort/)
assert.match(miniGateway, /requestedSort === 'newest' \? 'newest' : result\.sortBy/)
const companiesPage = fs.readFileSync('miniprogram/src/pages/companies/index.tsx', 'utf8')
assert.match(companiesPage, /搜索企业或岗位名称/)
assert.match(companiesPage, /相关度/)
assert.match(companiesPage, /companies-sort-toggle/)
assert.match(companiesPage, /aria-haspopup='listbox'/)
assert.match(companiesPage, /aria-role='option'/)
assert.match(companiesPage, /aria-selected=/)
assert.match(companiesPage, /companyResourceKey\(query, category, nextSort\)/)
assert.match(companiesPage, /sortBy, page: data\.page \+ 1/)
const companiesTypes = fs.readFileSync('miniprogram/src/types/index.ts', 'utf8')
assert.match(companiesTypes, /latestPublicJobAt\?: string \| null/)
const gateway = fs.readFileSync('lib/api-handlers/mini-gateway.js', 'utf8')
assert.doesNotMatch(gateway, /job_record\.job_id IS NULL|current_job\.job_id IS NULL/)
assert.doesNotMatch(gateway, /GREATEST\(h\.first_seen_at, COALESCE\(h\.source_published_at/)
assert.match(gateway, /j\.is_approved IS TRUE/)
assert.match(gateway, /latestPublicJobAt: row\.public_opportunity_updated_at/)
const companyCloudRun = fs.readFileSync('cloudrun/index.mjs', 'utf8')
assert.match(companyCloudRun, /readFormalCompanyJobs\(id,/)
assert.match(companyCloudRun, /企业公开岗位数据不完整，请重试/)

console.log('Strict company directory job eligibility contracts passed')
