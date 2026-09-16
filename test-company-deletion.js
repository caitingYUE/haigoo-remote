import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { DEACTIVATE_COMPANY_SQL } from './lib/services/company-deactivation.js'

// Exercise the real browser service with HTTP responses, without touching live companies.
const module = { exports: {} }
let nextResponse, lastRequest
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/trusted-companies-service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, {
    module, exports: module.exports, URLSearchParams, console,
    require: () => ({ splitTagInput: value => value }),
    localStorage: { getItem: () => 'test-token' },
    fetch: async (url, options) => { lastRequest = { url, ...options }; return nextResponse }
})
const service = module.exports.trustedCompaniesService
nextResponse = { ok: false, status: 409, json: async () => ({ success: false, code: 'COMPANY_HISTORY_EXISTS', error: '已有招聘历史' }) }
const blocked = await service.deleteCompany('company & one')
assert.equal(blocked.code, 'COMPANY_HISTORY_EXISTS')
assert.equal(blocked.error, '已有招聘历史')
assert.equal(lastRequest.method, 'DELETE')
assert.equal(new URL(lastRequest.url, 'https://example.test').searchParams.get('id'), 'company & one')
nextResponse = { ok: true, status: 200, json: async () => ({ success: false, error: '未成功' }) }
assert.equal((await service.deleteCompany('one')).success, false)
nextResponse = { ok: false, status: 502, json: async () => { throw new Error('HTML response') } }
assert.match((await service.deleteCompany('one')).error, /502/)
nextResponse = { ok: true, status: 200, json: async () => ({ success: true }) }
assert.equal((await service.deleteCompany('one', true)).success, true)
assert.equal(lastRequest.method, 'POST')
assert.equal(new URL(lastRequest.url, 'https://example.test').searchParams.get('action'), 'deactivate')
assert.equal(lastRequest.headers.Authorization, 'Bearer test-token')

const page = fs.readFileSync('src/pages/AdminTrustedCompaniesPage.tsx', 'utf8')
const handleSource = page.slice(page.indexOf('const handleDelete ='), page.indexOf('const handleSubmit ='))
let confirmations = [], calls = [], refreshed = 0
const runDelete = vm.runInNewContext(`${handleSource.replace('(id: string)', '(id)')}; handleDelete`, {
    confirm: () => confirmations.shift(), console,
    alert: message => { throw new Error(`Unexpected alert: ${message}`) },
    trustedCompaniesService: { deleteCompany: async (...args) => {
        calls.push(args)
        return args[1] ? { success: true } : blocked
    } },
    setCompanies: () => {}, loadCompanies: async () => { refreshed++ }
})
confirmations = [true, false]
await runDelete('one')
assert.equal(calls.length, 1, 'Cancelling deactivation must not send POST')
assert.equal(refreshed, 0)
calls = []; confirmations = [true, true]
await runDelete('one')
assert.equal(calls.length, 2)
assert.equal(calls[1][1], true)
assert.equal(refreshed, 1)

// Optional PostgreSQL check: all test data lives in temporary tables dropped at commit.
// TEST_DATABASE_URL must be provided explicitly; never modify persistent tables.
if (process.env.TEST_DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.TEST_DATABASE_URL)
    const temporarySql = DEACTIVATE_COMPANY_SQL
        .replace(/\btrusted_companies\b/g, 'pg_temp.delete_test_companies')
        .replace(/\bcompany_job_history\b/g, 'pg_temp.delete_test_history')
        .replace(/\bjobs\b/g, 'pg_temp.delete_test_jobs')
    const handler = fs.readFileSync('lib/api-handlers/trusted-companies.js', 'utf8')
    const deletionSql = handler.match(/const deleted = await neonHelper.query\(`([\s\S]*?)`, \[id\]\)/)[1]
        .replace(/\btrusted_companies\b/g, 'pg_temp.delete_test_companies')
        .replace(/\bextracted_companies\b/g, 'pg_temp.delete_test_extracted')
        .replace(/\bjobs\b/g, 'pg_temp.delete_test_jobs')
    const results = await sql.transaction([
        sql.query(`CREATE TEMP TABLE delete_test_companies (company_id text PRIMARY KEY, name text, status text, job_count int, updated_at timestamptz) ON COMMIT DROP`),
        sql.query(`CREATE TEMP TABLE delete_test_jobs (job_id text PRIMARY KEY, company_id text, company text, status text, updated_at timestamptz) ON COMMIT DROP`),
        sql.query(`CREATE TEMP TABLE delete_test_history (history_id text PRIMARY KEY, company_id text REFERENCES delete_test_companies(company_id) ON DELETE RESTRICT, is_public_opportunity boolean, closed_at timestamptz, updated_at timestamptz) ON COMMIT DROP`),
        sql.query(`INSERT INTO pg_temp.delete_test_companies VALUES ('a','Same name','active',2,NOW()), ('b','Same name','active',1,NOW())`),
        sql.query(`INSERT INTO pg_temp.delete_test_jobs VALUES ('own','a','Same name','active',NOW()), ('legacy',NULL,'Same name','active',NOW()), ('other','b','Same name','active',NOW())`),
        sql.query(`INSERT INTO pg_temp.delete_test_history VALUES ('history','a',TRUE,NULL,NOW())`),
        sql.query(temporarySql, ['missing']),
        sql.query(temporarySql, ['a']),
        sql.query(`SELECT * FROM pg_temp.delete_test_jobs ORDER BY job_id`),
        sql.query(`SELECT * FROM pg_temp.delete_test_history`),
        sql.query(`SELECT * FROM pg_temp.delete_test_companies ORDER BY company_id`),
        sql.query(`CREATE TEMP TABLE delete_test_extracted (company_id text PRIMARY KEY, name text) ON COMMIT DROP`),
        sql.query(`INSERT INTO pg_temp.delete_test_extracted VALUES ('e','Extracted')`),
        sql.query(`INSERT INTO pg_temp.delete_test_jobs VALUES ('ej','e','Extracted','active',NOW())`),
        sql.query(deletionSql, ['missing']),
        sql.query(deletionSql, ['b']),
        sql.query(deletionSql, ['e']),
        sql.query(`SELECT * FROM pg_temp.delete_test_jobs ORDER BY job_id`),
        sql.query(`SELECT * FROM pg_temp.delete_test_companies ORDER BY company_id`)
    ])
    assert.equal(results[6].length, 0)
    assert.equal(results[7][0].hidden_jobs, 2)
    assert.equal(results[8].find(j => j.job_id === 'other').status, 'active')
    assert.equal(results[8].find(j => j.job_id === 'own').status, 'inactive')
    assert.equal(results[8].find(j => j.job_id === 'legacy').status, 'inactive')
    assert.equal(results[9].length, 1, 'History must be preserved')
    assert.equal(results[9][0].is_public_opportunity, false)
    assert.ok(results[9][0].closed_at)
    assert.equal(results[10][0].status, 'inactive')
    assert.equal(results[10][0].job_count, 0)
    assert.equal(results[10][1].status, 'active')
    assert.equal(results[14].length, 0, 'Unknown ID must not report deletion success')
    assert.equal(results[15][0].company_id, 'b')
    assert.equal(results[16][0].company_id, 'e', 'Extracted company fallback must work with Neon arrays')
    assert.equal(results[17].find(j => j.job_id === 'ej').status, 'inactive')
    assert.equal(results[17].find(j => j.job_id === 'other').status, 'inactive')
    assert.equal(results[18].length, 1, 'Historical company remains intact')
    console.log('Company deactivation PostgreSQL temporary-table checks passed')
}
console.log('Company deletion HTTP response checks passed')
