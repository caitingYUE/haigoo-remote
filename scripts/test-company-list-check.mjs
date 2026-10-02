import './test-list-source-coverage.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { scanListing } from '../lib/services/job-sync/list-scanner.js'
import { comparable,compareListing,listingEligibility,listingIdentity } from '../lib/services/job-sync/list-policy.js'
import { createListWorkflow } from '../lib/services/job-sync/list-workflow.js'
import { companyRecordedPendingCounts } from '../lib/services/job-sync/counts.js'

const url=n=>`https://jobs.lever.co/acme/12345678-1234-1234-1234-${String(n).padStart(12,'0')}`
const role=n=>({id:`12345678-1234-1234-1234-${String(n).padStart(12,'0')}`,text:`Engineer ${n}`,hostedUrl:url(n),categories:{location:'APAC'},workplaceType:'remote',descriptionPlain:'This description must never be read or persisted.'})
const source={url:'https://jobs.lever.co/acme/'}
let remote=[role(1),role(3)],requests=[]
const fetcher=async u=>{requests.push(u);assert.match(u,/^https:\/\/api.lever.co\/v0\/postings\/acme\?/);const offset=Number(new URL(u).searchParams.get('skip'));return {url:u,status:200,text:JSON.stringify(remote.slice(offset,offset+100))}}
let result=await scanListing(source,{fetcher})
assert.equal(result.complete,true)
assert.equal(requests.length,1)
assert.equal(result.jobs[0].description,undefined)
assert.equal(listingEligibility({location:'Remote APAC'}),'eligible')
assert.equal(listingEligibility({location:'Remote'}),'unknown')
assert.equal(listingEligibility({location:'Worldwide non-remote'}),'excluded')
assert.equal(listingEligibility({location:'Worldwide remote only applicants in the United States'}),'unknown')
assert.equal(listingEligibility({location:'Worldwide onsite',is_remote:false}),'excluded')
assert.equal(listingEligibility({location:'Global remote excluding China'}),'excluded')
assert.equal(listingIdentity(url(1)+'?utm_source=x'),listingIdentity(url(1)))
assert.notEqual(listingIdentity(url(1)),listingIdentity(url(1).replace('/acme/','/other/')))
assert.notEqual(listingIdentity('https://example.com/careers/role?ref=a'),listingIdentity('https://example.com/careers/role?ref=b'))
assert.notEqual(listingIdentity('https://apply.workable.com/acme/j/AbC'),listingIdentity('https://apply.workable.com/acme/j/abc'))
assert.notEqual(listingIdentity(url(1)),listingIdentity(url(1).replace('jobs.lever','jobs.eu.lever')))
assert.equal(comparable(source.url,url(1).replace('jobs.lever','jobs.eu.lever')),false)
const existing=[{job_id:'one',url:url(1),status:'active',is_approved:false},{job_id:'two',url:url(2),status:'active',is_approved:true}]
let comparison=compareListing(source,result,existing)
assert.deepEqual(comparison.findings.map(x=>x.kind).sort(),['missing','new'])
assert.equal(comparison.unknown,false)
const missing=comparison.findings.find(f=>f.kind==='missing')
const dismissedMissing={...comparison,dismissed:[missing.key]}
const changedLink=compareListing(source,result,existing.map(j=>j.job_id==='two'?{...j,url:url(4)}:j),dismissedMissing)
assert.equal(changedLink.dismissed.length,0,'Acknowledgement must not suppress a different job URL on the same record')
assert.notEqual(changedLink.findings.find(f=>f.kind==='missing').key,missing.key)
assert.equal(compareListing(source,result,existing,dismissedMissing).dismissed.length,1)
const legacy={...comparison,findings:comparison.findings.map(f=>f.kind==='missing'?{...f,key:'missing:legacy-job-id-hash'}:f),dismissed:['missing:legacy-job-id-hash']}
assert.deepEqual(compareListing(source,result,existing,legacy).dismissed,[missing.key],'Existing acknowledgements survive the key upgrade')
const lessMetadata={...result,jobs:result.jobs.map(j=>({...j,location:'',is_remote:undefined}))}
assert.equal(compareListing(source,lessMetadata,existing,comparison).findings.filter(f=>f.kind==='new').length,1,'Missing metadata must not discard an earlier confirmed alert')
assert.equal(compareListing(source,{...result,complete:false},existing).findings.some(f=>f.kind==='missing'),false)
assert.equal(compareListing(source,{...result,jobs:[],complete:true},existing).findings[0].kind,'missing')
assert.equal(compareListing({url:'https://jobs.lever.co/other/'},result,existing).findings.some(f=>f.kind==='missing'),false)
remote=Array.from({length:102},(_,n)=>role(n));requests=[]
result=await scanListing(source,{fetcher});assert.equal(result.jobs.length,102);assert.equal(requests.length,2)
requests=[];result=await scanListing(source,{fetcher,maxPages:1});assert.equal(result.complete,false);assert.equal(result.jobs.length,100)
const html=await scanListing({url:'https://example.com/careers'},{fetcher:async u=>({url:u,status:200,text:'<li><a href="/careers/dev">Engineer</a><span>Remote APAC</span></li>'})})
assert.equal(html.complete,false);assert.equal(listingEligibility(html.jobs[0]),'eligible')
const scanHtml=text=>scanListing({url:'https://example.com/careers'},{fetcher:async u=>({url:u,status:200,text})})
const globalTitle=await scanHtml('<li><a href="/careers/sales">Global Accounts Manager</a><span>Remote USA</span></li>')
assert.equal(listingEligibility(globalTitle.jobs[0]),'excluded','Title is not eligibility geography')
const postal=await scanHtml('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Engineer',url:'/careers/dev',jobLocationType:'TELECOMMUTE',jobLocation:{address:{'@type':'PostalAddress',addressLocality:'Shanghai',addressCountry:'China'}},description:'Do not read details'})+'</script>')
assert.equal(listingEligibility(postal.jobs[0]),'eligible')
assert.equal(postal.jobs[0].description,undefined)
const pg=new PGlite(),q=async (sql,params=[]) => (await pg.query(sql,params)).rows
await pg.exec(`CREATE TABLE trusted_companies(company_id text PRIMARY KEY,name text,status text,careers_page text); CREATE TABLE jobs(job_id text PRIMARY KEY,company_id text,title text,url text,status text,is_approved boolean,crawl_deleted_at timestamptz,description text,translations jsonb);`)
await pg.exec(await fs.readFile(new URL('../server-utils/dal/migrations/094_company_list_checks.sql',import.meta.url),'utf8'))
await q("INSERT INTO trusted_companies VALUES('acme','Acme','active',$1),('linkedin','LinkedIn','active','https://www.linkedin.com/company/acme/jobs')",[source.url])
for(const j of existing) await q("INSERT INTO jobs VALUES($1,'acme',$1,$2,$3,$4,NULL,'Manual content','{\"title\":\"人工翻译\"}')",[j.job_id,j.url,j.status,j.is_approved])
const fingerprint=async()=>JSON.stringify([await q('SELECT * FROM jobs ORDER BY job_id'),await q('SELECT * FROM trusted_companies ORDER BY company_id')])
const before=await fingerprint()
remote=[role(1),role(3)];result=await scanListing(source,{fetcher})
let scans=0,barrier=null,outcome=result
const service=createListWorkflow({query:q,scan:async()=>{scans++;if(barrier)await barrier;return outcome}})
let counter=0
const start=(ids=['acme'],extra={})=>service.post({action:'start',companyIds:ids,requestId:`request-${++counter}`,...extra},'admin')
const step=run=>service.post({action:'step',runId:run.run.id,companyId:run.run.companyIds[0]},'admin')
const state=async()=> (await service.get({companyId:'acme'})).states.acme
let run=await start();assert.equal(scans,0)
const replay=await service.post({action:'start',companyIds:['acme'],requestId:`request-${counter}`},'admin');assert.equal(run.run.id,replay.run.id)
await step(run);assert.equal(scans,1);await step(run);assert.equal(scans,1)
assert.equal((await state()).findings.length,2)
const first=await state()
assert.equal((await service.get({runId:run.run.id})).run.attempts[0].result.findings,undefined,'Progress must not repeat full findings and candidates for every company')
await service.post({action:'dismiss',companyId:'acme',key:first.findings.find(f=>f.kind==='new').key,checkedAt:first.checked_at},'admin')
assert.equal((await state()).findings.length,1)
outcome={jobs:[],complete:false,pages:2,reason:'timeout'}
run=await start();await step(run);assert.equal((await state()).failures,1);assert.equal((await state()).findings.length,1)
await step(run);assert.equal((await state()).failures,1)
run=await start();await step(run);assert.equal((await state()).status,'skipped');assert.equal((await state()).failures,2)
const count=scans;await step(await start());assert.equal(scans,count)
assert.equal((await state()).pages,2,'Skipping preserves the last actual check evidence')
outcome=result;await step(await start(['acme'],{reset:true}));assert.equal((await state()).failures,0);assert.equal((await state()).status,'checked');assert.equal((await state()).findings.length,1)
const linked=await start(['linkedin']);const prior=scans;await step(linked);assert.equal(scans,prior)
assert.equal((await service.get({companyId:'linkedin'})).states.linkedin.status,'skipped')
// Ignored additions reappear after a verified absence/reappearance event.
outcome={...result,jobs:result.jobs.filter(j=>j.url!==url(3))};await step(await start());outcome=result;await step(await start());assert.equal((await state()).findings.length,2)
// Per-company lock rejects overlapping page checks without counting a failure.
let release;barrier=new Promise(resolve=>{release=resolve})
run=await start();const pending=step(run);await new Promise(resolve=>setTimeout(resolve,30));const busy=await step(await start());assert.equal(busy.busy,true);release();await pending;barrier=null
assert.equal(await fingerprint(),before,'All scans and acknowledgements must preserve every jobs/company field')
// Changing the source during HTTP invalidates late results.
barrier=new Promise(resolve=>{release=resolve});run=await start();const stale=step(run);await new Promise(resolve=>setTimeout(resolve,30));await q("UPDATE trusted_companies SET careers_page='https://jobs.lever.co/new' WHERE company_id='acme'");release();await stale;barrier=null
assert.equal((await service.get({runId:run.run.id})).run.attempts[0].status,'stale')
assert.equal((await state()).status,'unchecked')
// A list-only production rollout needs migration 094, not retired crawler columns.
await pg.exec('ALTER TABLE jobs DROP COLUMN crawl_deleted_at')
await q('UPDATE trusted_companies SET careers_page=$1 WHERE company_id=$2',[source.url,'acme'])
const legacyBefore=await fingerprint()
assert.equal((await companyRecordedPendingCounts(['acme'],q)).acme,1)
await step(await start(['acme'],{reset:true}))
assert.equal((await state()).status,'checked')
assert.equal(await fingerprint(),legacyBefore,'Schema compatibility must not alter business data')
console.log('PASS: list-only requests, pagination, identity/scope, eligibility, no false absence, deduplication, persistence, acknowledgements, failure threshold/reset, LinkedIn, concurrency, source fencing, zero job/company side effects')
await pg.close()
