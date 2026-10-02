import assert from 'node:assert/strict'
import {scanPage,verifyPosting} from '../lib/services/job-sync/adapters.js'
import {postingIdentity} from '../lib/services/job-sync/url-checks.js'
const description='A meaningful job description with sufficient detail about responsibilities, requirements and working arrangements for this role.'
const htmlSource={url:'https://careers.example.com/about',adapter:'html',config:{}}
const requests=[]
const fetcher=async url=>{
 requests.push(url)
 if(url.endsWith('/about')) return {url,status:200,text:'<a href="/vacancies/vacancy-search-results.aspx">Vacancies</a>'}
 if(url.includes('vacancy-search')) return {url,status:200,text:'<a href="/vacancies/123/engineer.html">Engineer</a><a href="/careers/join">Talent network</a>'}
 return {url,status:200,text:`<main><h1>Engineer</h1><p>${description}</p><a href="/apply">Apply Now</a></main>`}
}
const entry=await scanPage(htmlSource,null,{fetcher})
assert(entry.next.entryVisited)
const listing=await scanPage(htmlSource,entry.next,{fetcher})
assert.equal(listing.jobs.length,1)
assert.equal(listing.jobs[0].title,'Engineer')
assert(listing.jobs[0].description.includes(description))
assert(!requests.some(u=>u.endsWith('/careers/join')))
const pinpoint=await scanPage(htmlSource,null,{fetcher:async url=>({url,status:200,text:JSON.stringify({data:[{id:'42',title:'Engineer',url:'https://careers.example.com/en/jobs/42',description,key_responsibilities:'Build software',employment_type_text:'Full Time',workplace_type:'remote'}]})})})
assert.equal(pinpoint.jobs[0].is_remote,true)
assert(pinpoint.jobs[0].description.includes('Build software'))
await assert.rejects(scanPage(htmlSource,null,{fetcher:async url=>({url,status:200,text:'<html><script src="app.js"></script><div id="root"></div></html>'})}),/动态加载/)
const url='https://jobs.lever.co/acme/12345678-1234-1234-1234-123456789abc'
assert.equal((await verifyPosting({url},{fetcher:async u=>({url:u,status:200,text:JSON.stringify({id:'12345678-1234-1234-1234-123456789abc',text:'Engineer'})})})).state,'open')
assert.equal((await verifyPosting({url},{fetcher:async u=>({url:u,status:404,text:'{"error":"not found"}'})})).state,'closed')
assert.equal((await verifyPosting({url},{fetcher:async u=>({url:u,status:403,text:'Access denied'})})).state,'unknown')
assert.equal(postingIdentity('https://jobs.smartrecruiters.com/GriffithUniversity/744000148923906-consultant'),'744000148923906')
assert.equal((await verifyPosting({url:'https://jobs.smartrecruiters.com/GriffithUniversity/744000148923906-consultant'},{fetcher:async u=>({url:u,status:200,text:JSON.stringify({id:'744000148923906',name:'Consultant'})})})).state,'open')
assert.equal((await verifyPosting({url},{fetcher:async u=>({url:u,status:200,text:JSON.stringify({id:'a-different-posting',text:'Other job'})})})).state,'unknown')
assert.equal((await verifyPosting({url},{fetcher:async u=>({url:'https://example.com/error',status:404,text:'{"error":"not found"}'})})).state,'unknown')
assert(postingIdentity('https://cummins.jobs/city/role/02F86612A11E4F569C14948DD5FB078E/job/'))
assert.equal(postingIdentity('https://example.com/careers/join'),null)
const active=await verifyPosting({url:'https://careers.example.com/vacancies/123/engineer.html',external_id:'123',payload:{title:'Engineer',url:'https://careers.example.com/vacancies/123/engineer.html'}},{fetcher:async u=>({url:u,status:200,text:`<main><h1>Engineer</h1><p>${description.repeat(3)}</p><a href="/apply">Apply Now</a></main>`})})
assert.equal(active.state,'open')
console.log('PASS recruitment entry discovery, vacancy details, negotiated JSON, dynamic-page diagnostics, provider identity checks and conservative expiry checks')

const {mapDescriptionFields,salaryRangeText}=await import('../lib/services/job-sync/field-mapping.js')
const labelled='Job Type: Freelance\nLocation: Work from home\nWork Schedule: Part-time - 10+ hours per week\nRate: 15 USD/Hour'
const mapped=mapDescriptionFields({description:labelled,location:'Riyadh',job_type:'Temporary/Contract'})
assert.equal(mapped.salary,'15 USD/Hour')
assert.equal(mapped.location,'Riyadh')
assert.equal(mapped.is_remote,true)
assert.equal(mapped.job_type,'Temporary/Contract')
assert.deepEqual(mapped.field_evidence.job_type,['Freelance'])
assert.equal(mapDescriptionFields({description:labelled}).job_type,'Freelance')
assert.equal(mapDescriptionFields({description:'工作地点：上海\n薪资：20,000–30,000 CNY/月\n工作类型：全职'}).salary,'20,000–30,000 CNY/月')
assert.equal(mapDescriptionFields({description:'Location: London\nLocation: Berlin'}).location,undefined)
assert.equal(mapDescriptionFields({description:'Salary: TBD\nWe support 18 countries. Work with German customers.'}).salary,undefined)
assert.equal(mapDescriptionFields({description:labelled,salary:'USD 20/hour',is_remote:false}).salary,'USD 20/hour')
assert.equal(mapDescriptionFields({description:labelled,is_remote:false}).is_remote,false)
assert.equal(mapDescriptionFields({description:'This company used to offer remote roles. Applicants may not work from home.'}).is_remote,undefined)
assert.equal(salaryRangeText({min:0,max:20,currency:'USD',interval:'hour'}),'USD 0–20 hour')
assert.equal(salaryRangeText({value:18,currency:'USD',unitText:'HOUR'}),'USD 18 HOUR')
const batch=await scanPage({adapter:'lever',url:'https://jobs.lever.co/rws/',config:{board:'rws'}},null,{fetcher:async url=>({url,status:200,text:JSON.stringify([
 {id:'one',text:'Arabic analyst',hostedUrl:'https://jobs.lever.co/rws/one',categories:{location:'Riyadh',commitment:'Temporary/Contract'},descriptionPlain:labelled},
 {id:'two',text:'German audio transcriber',hostedUrl:'https://jobs.lever.co/rws/two',descriptionPlain:labelled.replace('15 USD','18 USD')}
])})})
assert.equal(batch.jobs[0].salary,'15 USD/Hour')
assert.equal(batch.jobs[1].salary,'18 USD/Hour')
assert(!batch.jobs[0].description.includes('18 USD'))
console.log('PASS posting-scoped salary/location/type labels, structured precedence, remote/geography separation and contradictory/missing values')

// Reproduce the public layouts that failed in the September 29 cohort.
const {readDetail}=await import('../lib/services/job-sync/adapters.js')
const proseUrl='https://agency.example/career/video-creator'
const proseHtml=`<header><h1>Video Creator</h1></header><div class="prose"><p>Make developer videos and help engineers explain complex software. Work with our distributed team and produce clear technical demonstrations.</p></div><footer>Unrelated marketing content</footer>`
const prose=await readDetail(proseUrl,{fetcher:async url=>({url,status:200,text:proseHtml})})
assert.equal(prose.title,'Video Creator')
assert(!prose.description.includes('Unrelated marketing'))
const asp=await readDetail(proseUrl,{fetcher:async url=>({url,status:200,text:`<form><div id="main"><h1>Engineer</h1><p>${description}</p><input value="Email"></div></form>`})})
assert(asp.description.includes(description))
const noApply=await scanPage(htmlSource,null,{fetcher:async url=>({url,status:200,text:url===htmlSource.url?'<a href="/vacancies/12/engineer.html">More Info</a><a href="/vacancies/vacancy-apply.aspx?VacancyID=12">Apply</a>':`<main><h1>Actual Engineer Title</h1>${description}</main>`})})
assert.equal(noApply.jobs.length,1)
assert.equal(noApply.jobs[0].title,'Actual Engineer Title')
await assert.rejects(scanPage(htmlSource,null,{fetcher:async url=>({url,status:200,text:'<main>We don’t have any open positions at the moment.</main>'})}),/当前没有开放岗位/)

const {readFlightRecords,readDeelPostings}=await import('../lib/services/job-sync/embedded-postings.js')
const uuid='12345678-1234-1234-1234-123456789abc'
const unicodeText='<p>中文工作内容。'+description+'</p>'
const props={orgSlug:'Acme',careerPageSettings:{urlSlug:'Acme',jobBoard:{id:'board'}},jobPostings:[{id:uuid,title:'Engineer',richtextDescription:'$a',job:{workArrangementEnum:'REMOTE'},jobPostingPublications:[{jobBoard:{id:'board'},currentState:{stateSlug:'published_basic'}}]}]}
const flight=`:HL["style.css","style"]\na:T${Buffer.byteLength(unicodeText).toString(16)},${unicodeText}b:${JSON.stringify(['$','$L1',null,props])}\n`
const script=x=>`<script>self.__next_f.push(${JSON.stringify([1,x])})</script>`
const flightHtml=script(flight.slice(0,90))+script(flight.slice(90))
assert.equal(readFlightRecords(flightHtml).get('a'),unicodeText)
assert.equal(readDeelPostings(flightHtml,'https://jobs.deel.com/Acme')[0].description,unicodeText)
assert.equal(readDeelPostings(flightHtml,'https://other.example/Acme'),null)
assert.throws(()=>readDeelPostings(flightHtml,'https://jobs.deel.com/Other'),/企业身份/)
assert.throws(()=>readDeelPostings(script(`b:${JSON.stringify(['$','$L1',null,props])}\n`),'https://jobs.deel.com/Acme'),/正文/)
const deel=await scanPage({adapter:'html',url:'https://jobs.deel.com/Acme'},null,{fetcher:async url=>({url,status:200,text:flightHtml})})
assert.equal(deel.jobs[0].url,`https://jobs.deel.com/Acme/job-details/${uuid}/overview`)
assert.equal(deel.jobs[0].is_remote,true)

const apiJob={buid:53296,guid:'E5CB1BDF94434A849D0336F8252713CE',title_slug:'engineer',location_exact:'Virtual, USA',title_exact:'Engineer',description,job_shift:'FULL_TIME',other:'{"WorkPlaceTypeCode":"Remote"}'}
const apiSource={adapter:'html',url:'https://pearson.jobs/workplace-type/remote/jobs/'}
const apiFetch=async(url,opts)=>{
 assert.equal(opts.headers['X-Origin'],'pearson.jobs')
 const u=new URL(url);assert.equal(u.searchParams.get('workplacetype'),'remote')
 const offset=Number(u.searchParams.get('offset'))
 return {url,status:200,text:JSON.stringify({jobs:[{...apiJob,guid:offset?'A5CB1BDF94434A849D0336F8252713CE':apiJob.guid}],meta:{canonical:'/workplace-type/remote/jobs/'},pagination:{offset,total:2,has_more_pages:offset===0}})}
}
const apiPage=await scanPage(apiSource,null,{fetcher:apiFetch})
assert.equal(apiPage.jobs[0].job_type,'Full-time')
assert.equal(apiPage.jobs[0].is_remote,true)
assert.equal(apiPage.jobs[0].url,`https://pearson.jobs/virtual-usa/engineer/${apiJob.guid}/job`)
assert.equal((await scanPage(apiSource,apiPage.next,{fetcher:apiFetch})).complete,true)
for(const mutate of [d=>{d.jobs[0].buid=999},d=>{d.meta.canonical='/jobs/'},d=>{d.pagination.offset=9},d=>{d.jobs=[]}]) {
 await assert.rejects(scanPage(apiSource,null,{fetcher:async(u,o)=>{const r=await apiFetch(u,o),d=JSON.parse(r.text);mutate(d);return {...r,text:JSON.stringify(d)}}}),/归属|范围|分页/)
}
console.log('PASS prose/ASP.NET details, posting titles, application-link exclusion, empty listings, scoped Deel data and employer/filter/pagination-safe Jobsyn APIs')
const {decodeResponseBody}=await import('../lib/services/job-sync/http.js')
const {gzipSync,brotliCompressSync,deflateSync}=await import('node:zlib')
for(const [encoding,compress] of [['gzip',gzipSync],['br',brotliCompressSync],['deflate',deflateSync]]) {
 assert.equal(decodeResponseBody(compress(Buffer.from(unicodeText)),encoding,10000),unicodeText)
 assert.throws(()=>decodeResponseBody(compress(Buffer.from('x'.repeat(20000))),encoding,100),/读取上限/)
}
const jobsynUrl=`https://pearson.jobs/virtual-usa/engineer/${apiJob.guid}/job/`
for(const [payload,state] of [[apiJob,'open'],[{...apiJob,deleted_at:'2026-01-01T00:00:00Z'},'closed'],[{...apiJob,deleted_at:null},'unknown'],[{...apiJob,buid:999},'unknown'],[{...apiJob,guid:'F'.repeat(32)},'unknown']]) {
 const result=await verifyPosting({url:jobsynUrl,external_id:apiJob.guid},{fetcher:async url=>({url,status:200,text:JSON.stringify(payload)})})
 assert.equal(result.state,state)
}
assert.equal((await verifyPosting({url:jobsynUrl,external_id:apiJob.guid},{fetcher:async url=>({url,status:404,text:'Not found'})})).state,'unknown')
assert.equal((await verifyPosting({url:deel.jobs[0].url},{fetcher:async url=>({url,status:200,text:flightHtml})})).state,'open')
assert.equal((await verifyPosting({url:deel.jobs[0].url.replace(uuid,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')},{fetcher:async url=>({url,status:200,text:flightHtml})})).state,'unknown')
assert(postingIdentity('https://hackmamba.io/career/video-creator'))
assert.equal(postingIdentity('https://example.com/vacancies/vacancy-apply.aspx?VacancyID=12'),null)
console.log('PASS bounded gzip/br/deflate decoding, exact official detail identity, explicit expiry markers and conservative missing-posting checks')
