import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {companyTop100Snapshot,getCompanyTop100Edition,validateCompanyTop100Edition} from './lib/services/company-top100-service.js'
import {prepareCompanyTop100Edition,writeCompanyTop100Edition} from './scripts/update-company-top100-edition.mjs'
for (const [date,quarter,next] of [['2026-01-31','2026 Q1','2026-04-10'],['2026-03-31','2026 Q1','2026-04-10'],['2026-04-01','2026 Q2','2026-07-10'],['2026-09-30','2026 Q3','2026-10-10'],['2026-10-01','2026 Q4','2027-01-10'],['2026-12-31','2026 Q4','2027-01-10']]) assert.deepEqual(getCompanyTop100Edition({version:'test',researchedAt:date}),{version:'test',researchedAt:date,quarter,nextReviewAt:next})
assert.throws(()=>getCompanyTop100Edition({version:'test',researchedAt:'2026-02-30'}))
const next=structuredClone(companyTop100Snapshot);next.version='2027-01-10.v1';next.researchedAt='2027-01-10';next.companies.forEach(row=>row.reviewedAt=next.researchedAt)
assert.throws(()=>prepareCompanyTop100Edition(next,companyTop100Snapshot,'2026-10-10'))
assert.throws(()=>prepareCompanyTop100Edition(companyTop100Snapshot,companyTop100Snapshot,'2027-01-10'))
const edition=prepareCompanyTop100Edition(next,companyTop100Snapshot,'2027-01-10')
const bad=structuredClone(next);bad.companies[0].reviewedAt='2027-01-11';assert.throws(()=>prepareCompanyTop100Edition(bad,companyTop100Snapshot,'2027-01-12'))
const stale=structuredClone(next);stale.companies[0].reviewedAt='2026-10-10';assert.throws(()=>prepareCompanyTop100Edition(stale,companyTop100Snapshot,'2027-01-10'))
const wrongVersion=structuredClone(next);wrongVersion.version='2026-10-10.v2';assert.throws(()=>prepareCompanyTop100Edition(wrongVersion,companyTop100Snapshot,'2027-01-10'))
assert.deepEqual(validateCompanyTop100Edition(edition,next),edition)
for (const extra of ['companies','scores','userId']) assert.throws(()=>validateCompanyTop100Edition({...edition,[extra]:[]},next))
assert.throws(()=>validateCompanyTop100Edition({...edition,quarter:'2026 Q4'},next))
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'top100-edition-'))
try {await assert.rejects(writeCompanyTop100Edition(next,{...edition,companies:[]},dir));assert.equal((await fs.readdir(dir)).length,0);await writeCompanyTop100Edition(next,edition,dir);assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'company-top100-edition.json'),'utf8')),edition);assert.equal(JSON.parse(await fs.readFile(path.join(dir,'company-top100-current.json'),'utf8')).version,edition.version);assert.equal((await fs.readdir(dir)).length,2)} finally {await fs.rm(dir,{recursive:true,force:true})}
console.log('PASS: quarter boundaries, honest edition metadata, no unchanged/future releases, reviewed-date consistency and paired staging')
