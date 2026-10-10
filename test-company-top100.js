import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { companyTop100Snapshot as data, validateCompanyTop100, createCompanyTop100Handler, getCompanyTop100LiveData, getCompanyTop100AccessUser } from './lib/services/company-top100-service.js'

assert.equal(data.companies.length, 100)
assert.equal(data.companies.filter(c => c.tier === 'A').length, 49)
assert.equal(data.companies.filter(c => c.components.payment === null).length, 77)
assert.equal(data.companies[0].name, 'Nagarro')
const duplicate = structuredClone(data); duplicate.companies[1].companyId = duplicate.companies[0].companyId
assert.throws(() => validateCompanyTop100(duplicate))
const badScore = structuredClone(data); badScore.companies[0].score = 99
assert.throws(() => validateCompanyTop100(badScore))
const unsafeSource = structuredClone(data); unsafeSource.companies[0].sources = ['javascript:alert(1)']
assert.throws(() => validateCompanyTop100(unsafeSource))
for (const mutate of [
    d => { d.companies[0].score = NaN },
    d => { d.weights.mainland = -1; d.weights.remote = 46 },
    d => { d.researchedAt = '2026-02-30' },
    d => { d.companies[0].reviewedAt = '2026-99-99' },
    d => { d.companies[0].remoteClass = 'invented' },
    d => { d.companies[0].roles = null },
    d => { d.companies[0].sources = ['https://user:secret@example.com/path'] }
]) { const changed = structuredClone(data); mutate(changed); assert.throws(() => validateCompanyTop100(changed)) }
const secret = 'isolated-test-secret-not-a-production-credential'
const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 86400000).toISOString()
const users = {
    full: { status: 'active', member_status: 'active', member_type: 'quarter', member_expire_at: future },
    trial: { status: 'active', member_status: 'active', member_type: 'trial_week', member_expire_at: future },
    free: { status: 'active', member_status: 'none' },
    expired: { status: 'active', member_status: 'active', member_type: 'quarter', member_expire_at: past },
    refunded: { status: 'active', member_status: 'refunded', member_type: 'quarter', member_expire_at: future },
    future: { status: 'active', member_status: 'active', member_type: 'quarter', member_cycle_start_at: future, member_expire_at: future },
    disabled: { status: 'disabled', roles: { admin: true } },
    admin: { status: 'active', roles: { admin: true } }
}
for (const type of ['starter','quarter_pro','year','half_year','annual']) users[type] = { ...users.full, member_type: type }
let enrichCalls = 0
const h = createCompanyTop100Handler({
    extractToken: req => req.headers.authorization?.replace('Bearer ', ''),
    verifyToken: token => jwt.verify(token, secret),
    getUser: id => Promise.resolve(users[id]), isAdmin: user => Boolean(user.roles?.admin),
    enrich: async entries => { enrichCalls++; return entries.map(e => ({ ...e, jobCount: null, availability: 'unknown' })) }
})
const invoke = async (id, query = {}, tokenOverride) => {
    const headers = {}, res = { statusCode: null, body: null, setHeader: (key,value) => { headers[key] = value }, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    const token = tokenOverride ?? (id ? jwt.sign({ userId: id, memberType: 'annual' }, secret) : null)
    await h({ method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {}, query }, res)
    assert.equal(headers['Cache-Control'], 'private, no-store')
    return res
}
for (const id of [null,'free','trial','expired','refunded','future','disabled','unknown']) {
    const res = await invoke(id)
    assert([401,403].includes(res.statusCode), `${id} must not have access`)
    assert.equal(res.body.companies, undefined)
    assert.equal(res.body.total, undefined)
}
assert.equal((await invoke('full', {}, 'invalid-token')).statusCode, 401)
assert.equal((await invoke('full', {}, jwt.sign({ userId: 'full' }, secret, { expiresIn: -1 }))).statusCode, 401)
assert.equal(enrichCalls, 0, 'Unauthorized requests cannot read the ranking')
for (const id of ['full','starter','quarter_pro','year','half_year','annual','admin']) {
    const res = await invoke(id)
    assert.equal(res.statusCode, 200); assert.equal(res.body.companies.length, 100)
}
assert.equal((await invoke('full', { companyId: data.companies[0].companyId })).body.companies.length, 1)
assert.equal((await invoke('full', { companyId: 'unknown-id' })).statusCode, 404)
assert.equal((await invoke('full', { companyId: ['invalid'] })).statusCode, 400)
const pair = data.companies.slice(0,2)
const live = await getCompanyTop100LiveData(pair, async sql => sql.startsWith('SELECT *') ? [{ company_id: pair[0].companyId, name: 'Updated company name', status: 'active', website: pair[0].website }] : [{ company_id: pair[0].companyId, count: 3 }])
assert.equal(live[0].rank, 1); assert.equal(live[0].score, pair[0].score); assert.equal(live[0].name, 'Updated company name'); assert.equal(live[0].jobCount, 3)
assert.equal(live[1].availability, 'unavailable'); assert.equal(live[1].jobCount, null)
const noStats = await getCompanyTop100LiveData(pair, async sql => { if (!sql.startsWith('SELECT *')) throw Error('stats unavailable'); return pair.map(c => ({ company_id: c.companyId, status: 'active' })) })
assert.equal(noStats[0].jobCount, null, 'A failed count query must never become zero')
const unknown = await getCompanyTop100LiveData(pair, async () => { throw Error('query failed') })
assert.equal(unknown[0].availability, 'unknown'); assert.equal(unknown[0].jobCount, null)
console.log('PASS: ranking integrity, all100 identities, unknown contract values, current membership guards, no unauthorized payload, exact company selection and live-data degradation')

const nullQueries = await getCompanyTop100LiveData(pair, async () => null)
assert.equal(nullQueries[0].availability, 'unknown')
assert.equal(nullQueries[0].jobCount, null)
const invalidCounts = await getCompanyTop100LiveData(pair, async sql => sql.startsWith('SELECT *') ? pair.map(c => ({company_id:c.companyId,status:'active'})) : [{company_id:pair[0].companyId,count:'not-a-count'}])
assert.equal(invalidCounts[0].jobCount, null)
assert.equal(invalidCounts[1].jobCount, 0)
console.log('PASS: malformed snapshots and null/invalid database responses remain safe')

assert.equal((await invoke('full', {companyId:''})).statusCode,400)
assert.equal((await invoke('full', {companyId:'   '})).statusCode,400)

await assert.rejects(getCompanyTop100AccessUser('full',async()=>null),/verification unavailable/)
assert.equal(await getCompanyTop100AccessUser('missing',async()=>[]),null)
const accessQueries=[]
const authoritative=await getCompanyTop100AccessUser('full',async(sql,params)=>{accessQueries.push(sql);assert.deepEqual(params,['full']);return [{...users.full,roles:'{"admin":"false","user":true}'}]})
assert.equal(authoritative.roles.admin,false)
assert.equal(accessQueries.length,1)
assert.ok(accessQueries.every(sql=>sql.trim().startsWith('SELECT')))
console.log('PASS: access verification is authoritative, read-only, fail-closed and has no local-user fallback')
