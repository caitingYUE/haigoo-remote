import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {companyTop100Snapshot,getCompanyTop100LiveData} from './lib/services/company-top100-service.js'
const compile=async entry=>{const b=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
const service=await compile('./src/services/company-top100-service.ts'), nav=await compile('./src/utils/company-top100-navigation.ts')
const rows=await getCompanyTop100LiveData(companyTop100Snapshot.companies,async sql=>sql.startsWith('SELECT *')?companyTop100Snapshot.companies.map(r=>({company_id:r.companyId,status:'active'})):[])
const response={success:true,version:companyTop100Snapshot.version,researchedAt:companyTop100Snapshot.researchedAt,total:100,weights:companyTop100Snapshot.weights,companies:rows}
assert.ok(service.isCompanyTop100Response(response))
for(const mutate of [d=>{d.companies=[]},d=>{d.companies[0].roles=null},d=>{d.companies[0].sources=['javascript:bad']},d=>{d.companies[0].remoteClass='unknown'},d=>{d.companies[0].score=NaN},d=>{d.companies[0].applicationNote={unexpected:true}},d=>{d.companies[0].basics.employeeCount={invalid:true}},d=>{d.companies[0].jobCount=-1},d=>{d.companies[1].companyId=d.companies[0].companyId}]){const bad=structuredClone(response);mutate(bad);assert.equal(service.isCompanyTop100Response(bad),false)}
const single={...response,companies:[response.companies[0]]};assert.ok(service.isCompanyTop100Response(single,rows[0].companyId));assert.equal(service.isCompanyTop100Response(single,rows[1].companyId),false)
const original=globalThis.fetch
try{
 for(const status of [401,403,503]){globalThis.fetch=async()=>new Response(JSON.stringify({code:'FIXTURE_ERROR'}),{status});await assert.rejects(service.getCompanyTop100('fixture',new AbortController().signal),e=>e.status===status)}
 globalThis.fetch=async()=>new Response(JSON.stringify({...response,companies:[]}),{status:200});await assert.rejects(service.getCompanyTop100('fixture',new AbortController().signal),e=>e.code==='INVALID_RANKING_RESPONSE')
 let options;globalThis.fetch=async(url,args)=>{options=args;return new Response(JSON.stringify(response),{status:200})};assert.equal((await service.getCompanyTop100('fixture',new AbortController().signal)).companies.length,100);assert.equal(options.cache,'no-store')
}finally{globalThis.fetch=original}
for(const path of ['https://evil.example','//evil.example','/\\evil.example','/profile?tab=settings','/trusted-companies/top-100/other','/en/../profile','/%2F%2Fevil.example'])assert.equal(nav.getTop100ReturnTo(path),null,path)
const back='/en/trusted-companies/top-100?tier=B&q=Supabase&expanded=company_123';assert.equal(nav.getTop100ReturnTo(back),back)
const path=nav.top100ProfilePath('feedback',back,'company_123','2026-10-10.v1','公司 & Research');const query=new URL(path,'https://haigooremote.com').searchParams
assert.equal(query.get('returnTo'),back);assert.equal(query.get('companyId'),'company_123');assert.equal(query.get('rankingVersion'),'2026-10-10.v1');assert.equal(query.get('companyName'),'公司 & Research')
console.log('PASS: malformed client responses, session/membership errors, no-store and safe contextual return paths')

const sourceUrl=nav.top100FeedbackSourceUrl('/profile',new URL(path,'https://haigooremote.com').search)
assert.equal(new URL(sourceUrl,'https://haigooremote.com').searchParams.get('returnTo'),null)
assert.ok(!sourceUrl.includes('q%3D') && !sourceUrl.includes('tier%3D'))
assert.equal(new URL(sourceUrl,'https://haigooremote.com').searchParams.get('companyId'),'company_123')
