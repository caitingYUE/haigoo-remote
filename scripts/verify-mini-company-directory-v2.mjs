import assert from 'node:assert/strict'
import fs from 'node:fs'
import { rankDirectoryCompanies } from '../lib/services/mini-company-search-service.js'
import { validateCompanyCatalogSnapshot } from '../lib/services/mini-company-catalog-sync-service.js'

const gateway = fs.readFileSync(new URL('../lib/api-handlers/mini-gateway.js', import.meta.url), 'utf8')
const cloudrun = fs.readFileSync(new URL('../cloudrun/index.mjs', import.meta.url), 'utf8')
const miniPage = fs.readFileSync(new URL('../miniprogram/src/pages/companies/index.tsx', import.meta.url), 'utf8')

assert.match(gateway, /company_catalog_snapshot/)
assert.match(gateway, /j\.is_approved IS TRUE/)
assert.doesNotMatch(gateway, /job_record\.job_id IS NULL|current_job\.job_id IS NULL/)
assert.match(cloudrun, /sortBy: url\.searchParams\.get\('sortBy'\)/)
assert.match(miniPage, /搜索企业或岗位名称/)

const companies = [
  { id: 'new', name: 'Acme', public_job_search_terms: ['Product Manager'], latestPublicJobAt: '2026-09-09T00:00:00Z', roleFamilies: ['product'] },
  { id: 'old', name: 'Beta', public_job_search_terms: ['Designer'], latestPublicJobAt: '2026-09-01T00:00:00Z', roleFamilies: ['design'] }
]
assert.deepEqual(rankDirectoryCompanies(companies, { search: 'Prodcut Manager', mode: 'exact', sortBy: 'latest' }).ids, ['new'])
assert.deepEqual(rankDirectoryCompanies(companies, { search: '', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: ['product'] }).ids, ['new', 'old'])
assert.deepEqual(rankDirectoryCompanies(companies, { search: '%_', mode: 'fuzzy', sortBy: 'latest' }).ids, [])

const snapshot = validateCompanyCatalogSnapshot({
  version: 'local-check',
  totalCompanies: 1,
  totalJobs: 1,
  companies: [{ id: 'c1', name: 'Acme', website: 'https://acme.example.com' }],
  jobs: [{ id: 'j1', companyId: 'c1', title: 'Product Manager', status: 'active', isApproved: true, memberOnly: false, url: 'https://acme.example.com/jobs/1' }]
})
assert.equal(snapshot.jobs.length, 1)
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks: 9, status: 'passed' }, null, 2))
