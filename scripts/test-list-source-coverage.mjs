import assert from 'node:assert/strict'
import {scanListing} from '../lib/services/job-sync/list-scanner.js'
import {compareListing,listingEligibility,listingIdentity} from '../lib/services/job-sync/list-policy.js'
import {SourceError} from '../lib/services/job-sync/http.js'
for(const location of ['Remote SG','Remote - Germany','Virtual, IND','Irvine, CA','Remote USA','Russia; Perm'])assert.equal(listingEligibility({location}), 'excluded',location)
for(const location of ['Remote China','Remote - APAC','Remote Beijing','Remote CN'])assert.equal(listingEligibility({location}), 'eligible',location)
for(const location of ['Remote','USA or Remote','Other locations','Beijing'])assert.equal(listingEligibility({location}), 'unknown',location)
assert.equal(listingEligibility({location:'Remote',title:'Motion Designer (EU)'}),'excluded')
assert.equal(listingEligibility({location:'Remote APAC',title:'Designer (EU)'}),'eligible','Explicit broad location is not narrowed by title')
assert.equal(listingEligibility({location:'Remote Shanghai',is_remote:false}),'excluded')
const id='12345678-1234-1234-1234-123456789012',leverUrl='https://jobs.lever.co/demo/'+id
const lever=await scanListing({url:'https://jobs.lever.co/demo'},{fetcher:async u=>({url:u,status:200,text:JSON.stringify([{id,text:'Engineer',hostedUrl:leverUrl,country:'CN',categories:{location:'Beijing',allLocations:['Beijing']},workplaceType:'remote'},{id:id.replace(/2$/,'3'),text:'Engineer',hostedUrl:leverUrl.replace(/2$/,'3'),country:'CA',categories:{location:'Canada',allLocations:['Canada','Shanghai']},workplaceType:'remote'}])})})
assert.equal(lever.jobs.length,2);assert(lever.jobs.every(j=>listingEligibility(j)==='eligible'));assert.equal(lever.jobs[0].description,undefined)
assert.equal(listingIdentity('https://www.ycombinator.com/companies/demo/jobs/SeUD1cG-old-title'),listingIdentity('https://www.ycombinator.com/companies/demo/jobs/SeUD1cG-new-title'),'YC job title slugs do not change identity')
const ycUrl='https://www.ycombinator.com/companies/demo/jobs/'
const ycJob={id:1,title:'Engineer',url:'/companies/demo/jobs/AbC1234-engineer',companyUrl:'/companies/demo',location:'Remote APAC',isIncomplete:false}
const ycHtml=(job=ycJob)=>`<main data-page='${JSON.stringify({component:'WaasShowJobsPage',props:{company:{slug:'demo'},jobPostings:[job]}})}'><a href="${ycUrl}">Jobs</a><a href="${job.url}">Engineer</a></main>`
const html=(url,text)=>scanListing({url},{fetcher:async u=>({url:u,status:200,text})})
const yc=await html(ycUrl,ycHtml());assert.equal(yc.complete,true);assert.equal(yc.jobs.length,1)
const other=await html(ycUrl,ycHtml({...ycJob,companyUrl:'/companies/other'}));assert.equal(other.complete,false);assert.equal(other.jobs.length,0)
const apply='https://threepipes.hackmamba.io/apply/positions/test123',hUrl='https://hackmamba.io/career/'
const astro={initialJobs:[1,[[0,{title:[0,'Writer'],link:[0,apply],location:[0,'Remote, Global'],slug:[0,{current:[0,'writer']}]}]]]}
const hHtml=n=>`<h2>Open Positions (${n})</h2><astro-island props='${JSON.stringify(astro)}'></astro-island><a href="${apply}">Apply</a>`
const hack=await html(hUrl,hHtml(1));assert.equal(hack.complete,true);assert.equal(hack.jobs[0].url,apply)
assert.equal(compareListing({url:hUrl},hack,[{job_id:'existing',url:apply,status:'active',is_approved:true}]).unknown,false)
assert.equal((await html(hUrl,hHtml(2))).complete,false,'Declared count disagreement cannot prove absence')
const old={key:'old',kind:'new',url:'https://airtable.com/example',title:'Old writer',detectedAt:new Date().toISOString()}
const staleHtml=`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:old.title,url:old.url,jobLocationType:'TELECOMMUTE',applicantLocationRequirements:{name:'Global'}})}</script><div class="w-dyn-empty">We don’t have any open positions</div>`
const empty=await html('https://example.com/careers',staleHtml);assert.equal(empty.jobs.length,0);assert.equal(empty.complete,false)
assert.equal(compareListing({url:'https://example.com/careers'},empty,[],{findings:[old]}).findings.length,0,'Contradictory old JSON-LD must not retain a false addition')
assert.equal((await html('https://example.com/careers',staleHtml.replace('class="w-dyn-empty"','class="w-dyn-empty" hidden'))).jobs.length,1,'Hidden empty templates do not contradict visible jobs')
const card=await html('https://example.com/careers','<div><a href="/careers/writer">Writer</a><div><span>Freelance</span><span>Remote</span><span>Global</span></div></div>')
assert.equal(listingEligibility(card.jobs[0]),'eligible','Card label boundaries must not merge words')
let requests=0
const retried=await scanListing({url:'https://jobs.lever.co/demo'},{fetcher:async u=>{if(++requests===1)throw new SourceError('来源暂时不可用（HTTP 504）');return {url:u,status:200,text:'[]'}}})
assert.equal(retried.complete,true);assert.equal(requests,2)
requests=0;await scanListing({url:'https://jobs.lever.co/demo'},{fetcher:async()=>{requests++;throw new SourceError('访问受限（HTTP 403）','blocked')}});assert.equal(requests,1)
console.log('PASS: country/multi-location metadata, list-only YC/Hackmamba, employer/count boundaries, stale JSON-LD, label separation, bounded transient retry')
