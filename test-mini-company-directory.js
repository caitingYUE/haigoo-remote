import assert from 'node:assert/strict'
import {
  buildCompanyHiringSignals,
  buildHiringCompanyPage,
  mapCompanyJobDetail,
  mapCompanyJobSummary
} from './cloudrun/company-directory.mjs'

const signals = buildCompanyHiringSignals([
  { status: 'active', updatedAt: '2026-08-25T10:00:00Z', payload: { id: 'j1', title: 'One', companyId: 'c1', publishedAt: '2026-08-24T10:00:00Z' } },
  { status: 'active', payload: { id: 'j2', title: 'Two', companyId: 'c1', updatedAt: '2026-08-26T10:00:00Z' } },
  { status: 'active', payload: { id: 'j3', title: 'Three', companyId: 'c2', updatedAt: '2026-08-24T10:00:00Z' } },
  { status: 'closed', payload: { id: 'j4', title: 'Four', companyId: 'c3', updatedAt: '2026-08-27T10:00:00Z' } },
  { payload: { id: 'j5', title: 'Five', companyId: 'c4', status: 'expired', updatedAt: '2026-08-28T10:00:00Z' } }
])
assert.equal(signals.get('c1').openJobCount, 2)
assert.equal(signals.get('c1').publicOpportunityUpdatedAt, '2026-08-26T10:00:00Z')
assert.equal(signals.has('c3'), false)
assert.equal(signals.has('c4'), false)

const page = buildHiringCompanyPage({
  companies: [
    { id: 'c1', name: 'Alpha', industry: 'SaaS', description: '' },
    { id: 'c2', name: 'Beta', industry: 'AI', description: '' },
    { id: 'c3', name: 'Closed', industry: 'AI', description: '' }
  ],
  signals,
  page: 1,
  pageSize: 20
})
assert.deepEqual(page.companies.map((company) => company.id), ['c1', 'c2'])
assert.equal(page.total, 2)
assert.deepEqual(page.industries, [{ name: 'AI', count: 1 }, { name: 'SaaS', count: 1 }])

const summary = mapCompanyJobSummary({
  id: 'j1', companyId: 'c1', title: 'Product Manager', location: 'Remote',
  salary: '[{"min":40,"max":60}]', jobType: 'full-time'
}, 'c1')
assert.equal(summary.salary, '')
assert.equal(summary.location, 'Remote')
assert.equal(mapCompanyJobSummary({ id: 'j1', companyId: 'other', title: 'Wrong company' }, 'c1'), null)

const official = mapCompanyJobDetail({
  id: 'j1', companyId: 'c1', title: 'Product Manager', company: 'Alpha',
  url: 'https://alpha.example/jobs/1', hiringEmail: 'jobs@alpha.example', requirements: ['3 years experience']
}, 'c1')
assert.equal(official.officialApplyUrl, 'https://alpha.example/jobs/1')
assert.equal(official.publicApplicationEmail, '')
assert.deepEqual(official.requirements, ['3 years experience'])
assert.equal(official.sourceLabel, '岗位与申请方式整理自企业官网及公开渠道')

const emailOnly = mapCompanyJobDetail({
  id: 'j2', companyId: 'c1', title: 'Designer', company: 'Alpha', hiringEmail: 'jobs@alpha.example'
}, 'c1')
assert.equal(emailOnly.officialApplyUrl, '')
assert.equal(emailOnly.publicApplicationEmail, 'jobs@alpha.example')

console.log('mini company directory checks passed')
