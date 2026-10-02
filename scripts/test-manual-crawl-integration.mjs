import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createManualWorkflow } from '../lib/services/job-sync/manual-workflow.js'
import { companyReviewCounts } from '../lib/services/job-sync/counts.js'

// Real PostgreSQL functions and real ATS adapters; the only substituted boundary
// is outbound HTTP. No credentials, production database or live crawl is used.
const { PGlite } = await import(process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite')
const pg = new PGlite()
const query = async (sql, params = []) => (await pg.query(sql, params)).rows
const description = 'Remote engineering role with worldwide applicants welcome. Build reliable software and collaborate with our distributed team.'
const roleId = n => `12345678-1234-1234-1234-${String(n).padStart(12, '0')}`
const roleUrl = (n, board = 'acme') => `https://jobs.lever.co/${board}/${roleId(n)}`
const role = (n, title = `Engineer ${n}`) => ({
  id: roleId(n), text: title, hostedUrl: roleUrl(n), descriptionPlain: description,
  categories: { location: 'Worldwide', commitment: 'Full-time' }, workplaceType: 'remote'
})
let listed = [role(1), role(100)]
let listingFailure = false
let listingBarrier = null
const requests = []
const publishedEffects = []
const fetcher = async (url) => {
  requests.push(url)
  if (url.startsWith('https://api.lever.co/v0/postings/acme?')) {
    if (listingBarrier) await listingBarrier()
    if (listingFailure) throw new Error('Fixture network timeout')
    return { url, status: 200, text: JSON.stringify(listed) }
  }
  if (url.startsWith('https://jobs.lever.co/acme/')) {
    if (url === roleUrl(2)) return { url, status: 410, text: 'This job is no longer available.' }
    if (url === roleUrl(3)) return { url, status: 403, text: 'Access denied' }
    const n = Number(url.slice(-12))
    return { url, status: 200, text: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title: `Engineer ${n}`,
      url, description, hiringOrganization: { name: 'Acme' }
    })}</script>` }
  }
  throw new Error(`Unexpected outbound fixture request: ${url}`)
}
const service = createManualWorkflow({ query, fetcher, publish: async (...args) => { publishedEffects.push(args) } })
const post = async body => service.post({...((body.action==='retry') ? {requestId: crypto.randomUUID()} : {}), ...body}, 'qa@example.com')
const sessionOf = response => response.session || response
let requestNumber = 0
const start = async (mode, companyIds = ['acme'], extra = {}) => sessionOf(await post({
  action: 'start', mode, companyIds, requestId: `qa-${++requestNumber}`, ...extra
}))
const read = async id => sessionOf(await service.get({ sessionId: id }))
const finish = async session => {
  let value = session
  for (let i = 0; value.status === 'running' && i < 100; i++) value = sessionOf(await post({ action: 'step', sessionId: value.id }))
  assert.notEqual(value.status, 'running', 'bounded workflow should reach review/completion')
  return value
}
const decide = (session, item, decision, patch = {}) => post({ action: 'decide', sessionId: session.id,
  itemId: item.id, version: item.version, decision, patch, eligibilityConfirmed: true })
const fingerprint = async () => JSON.stringify(await query('SELECT * FROM jobs ORDER BY job_id'))
const check = label => console.log(`PASS ${label}`)

try {
  await pg.exec(`
    CREATE TABLE trusted_companies(company_id text PRIMARY KEY,name text,status text DEFAULT 'active',careers_page text,website text,logo text,hiring_email text,member_only boolean,can_refer boolean,job_count integer,updated_at timestamptz);
    CREATE TABLE jobs(job_id text PRIMARY KEY,title text,description text,url text,company_id text,company text,company_website text,company_logo text,location text,salary text,job_type text,experience_level text,category text,tags jsonb,requirements jsonb,benefits jsonb,is_remote boolean,region text,timezone text,china_friendly boolean,published_at timestamptz NOT NULL,translations jsonb,is_translated boolean,status text,is_approved boolean,source text,source_type text,is_trusted boolean,member_only boolean,can_refer boolean,is_manually_edited boolean,created_at timestamptz,updated_at timestamptz,haigoo_comment text);
    INSERT INTO trusted_companies(company_id,name,careers_page,website,member_only,can_refer) VALUES
    ('acme','Acme','https://jobs.lever.co/acme','https://acme.example',true,true),
    ('other','Other','https://jobs.lever.co/other','https://other.example',false,false),
    ('missing','Missing',NULL,'https://missing.example',false,false);
  `)
  for (const file of ['091_trusted_job_sync.sql', '092_job_sync_manual_gate.sql', '093_manual_crawl_workflow.sql']) {
    await pg.exec(await readFile(new URL(`../server-utils/dal/migrations/${file}`, import.meta.url), 'utf8'))
  }
  for (let i = 1; i <= 12; i++) await query(`INSERT INTO jobs(job_id,title,description,url,company_id,location,is_remote,status,is_approved,category,tags,member_only,can_refer,haigoo_comment,published_at)
    VALUES($1,$2,$3,$4,'acme','Worldwide',true,'active',true,'人工分类','["人工标签"]',true,true,'保留人工说明',NOW())`, [`job-${i}`, `Manual engineer ${i}`, description, roleUrl(i)])
  await query(`INSERT INTO jobs(job_id,title,description,url,company_id,status,is_approved,published_at) VALUES('other-job','Other company',$1,$2,'other','active',true,NOW())`, [description, roleUrl(1, 'other')])
  await query(`INSERT INTO job_sync_sources(id,source_key,url,adapter,config) VALUES('old-source','old-source','https://jobs.lever.co/obsolete','lever','{"board":"obsolete"}')`)
  await query(`INSERT INTO job_sync_source_companies(source_id,company_id) VALUES('old-source','acme')`)
  const currentSource = await service.sourceFor((await query("SELECT * FROM trusted_companies WHERE company_id='acme'"))[0])
  assert.equal(currentSource.config.board, 'acme')
  check('current recruitment URL overrides a stale legacy source')

  await query("UPDATE jobs SET translations='{\"title\":\"旧岗位标题\",\"company\":\"人工企业译名\"}',is_translated=true WHERE job_id='job-1'")
  const baseline = await fingerprint()
  let preflight = await start('preflight')
  assert.deepEqual(preflight.companyIds, ['acme'])
  assert.equal(requests.length, 0, 'creating/reading a task does not fetch without step')
  await service.get({ companyIds: 'acme' })
  await read(preflight.id)
  assert.equal(requests.length, 0, 'GET must be side effect free')
  check('start and reads never fetch implicitly')
  preflight = await finish(preflight)
  assert.equal(await fingerprint(), baseline, 'preflight must never mutate jobs')
  assert.equal(preflight.companies[0].canApprove, true)
  assert.equal((await service.get({ companyIds: 'acme' })).qualifications.acme.status, 'unreviewed', 'machine success alone does not grant qualification')
  await post({ action: 'qualify', sessionId: preflight.id, companyId: 'acme', decision: 'approved' })
  assert.equal((await service.get({ companyIds: 'acme' })).qualifications.acme.status, 'approved')
  assert.equal(await fingerprint(), baseline, 'human preflight approval must never publish jobs')
  check('preflight and approval never mutate jobs; machine success needs human approval')

  const skipped = await start('update', ['other'])
  assert.equal(skipped.companies[0].status, 'skipped')
  check('update excludes companies without human approval')
  const updateStart = await start('update')
  const repeatedStart = await post({ action: 'start', mode: 'update', companyIds: ['acme'], requestId: `qa-${requestNumber}` })
  assert.equal(repeatedStart.session.id, updateStart.id)
  check('repeated start requests are idempotent')
  const requestOffset = requests.length
  let update = await finish(updateStart)
  assert.equal(update.companies[0].progress.checked, 12)
  for (let i = 1; i <= 12; i++) assert.ok(requests.slice(requestOffset).includes(roleUrl(i)), `published job ${i} must be verified`)
  assert.equal(await fingerprint(), baseline)
  assert.equal((await companyReviewCounts(['acme'], query)).acme || 0, 0)
  check('all 12 published jobs are checked without mutation or transient pending counts')
  const created = update.items.find(i => i.kind === 'create')
  const changed = update.items.find(i => i.kind === 'update')
  const closed = update.items.find(i => i.kind === 'close')
  const unknown = update.items.find(i => i.kind === 'unknown')
  assert.equal(closed.jobId, 'job-2')
  assert.equal(unknown.jobId, 'job-3')
  await assert.rejects(decide(update, unknown, 'delete'), /INVALID_DELETE/)
  await assert.rejects(decide(update, unknown, 'pending'), /EVIDENCE_STALE/)
  check('410 is explicit closure; 403 never supports demotion or deletion')
  await assert.rejects(decide(update, created, 'draft', {company_id: 'other'}), /不可修改字段/)
  await assert.rejects(decide({...update, id: preflight.id}, created, 'draft'), /ITEM_SCOPE_INVALID/)
  check('review enforces company and session boundaries')
  const draftResult = await decide(update, created, 'draft', { title: 'Reviewed new engineer' })
  const createdJobId = draftResult.result.jobId
  let saved = (await query('SELECT * FROM jobs WHERE job_id=$1', [createdJobId]))[0]
  assert.equal(saved.title, 'Reviewed new engineer')
  assert.equal(saved.is_approved, false)
  assert.equal(saved.company_id, 'acme')
  assert.equal(saved.member_only, true)
  assert.equal(saved.can_refer, true)
  assert.equal((await companyReviewCounts(['acme'], query)).acme, 1)
  check('new draft is a real company job, preserves company access flags and counts once')
  const effectsBeforeReplay = publishedEffects.length
  const replay = await decide(update, created, 'draft', { title: 'Reviewed new engineer' })
  assert.equal(replay.result.replayed, true)
  assert.equal(publishedEffects.length, effectsBeforeReplay)
  await assert.rejects(decide(update, created, 'draft', { title: 'Changed retransmission' }), /REVIEW_CONFLICT/)
  check('exact decision replay avoids duplicate jobs and side effects; stale edits conflict')
  const beforeChange = (await query("SELECT * FROM jobs WHERE job_id='job-1'"))[0]
  await decide(update, changed, 'draft', { title: 'Reviewed update engineer' })
  assert.deepEqual((await query("SELECT * FROM jobs WHERE job_id='job-1'"))[0], beforeChange)
  assert.equal((await companyReviewCounts(['acme'], query)).acme, 2)
  check('saved update draft preserves every online field and adds one review count')
  update = await read(update.id)
  await decide(update, update.items.find(i => i.id === changed.id), 'publish')
  saved = (await query("SELECT * FROM jobs WHERE job_id='job-1'"))[0]
  assert.equal(saved.title, 'Reviewed update engineer')
  assert.equal(saved.is_approved, true)
  assert.equal(saved.category, '人工分类')
  assert.deepEqual(saved.tags, ['人工标签'])
  assert.equal(saved.haigoo_comment, '保留人工说明')
  assert.equal(saved.translations.title, undefined)
  assert.equal(saved.translations.company, '人工企业译名')
  assert.equal(saved.is_translated, false)
  assert.equal((await companyReviewCounts(['acme'], query)).acme, 1)
  check('publish applies reviewed content and preserves manually managed metadata')
  await decide(update, closed, 'delete')
  saved = (await query("SELECT * FROM jobs WHERE job_id='job-2'"))[0]
  assert.equal(saved.status, 'inactive')
  assert.ok(saved.crawl_deleted_at)
  const history = await service.get({companyId: 'acme'})
  const deleted = history.reviewItems.find(i => i.id === closed.id)
  assert.equal(deleted.status, 'deleted')
  const restored = await post({action:'restore',itemId:deleted.id,version:deleted.version})
  saved = (await query("SELECT * FROM jobs WHERE job_id='job-2'"))[0]
  assert.equal(saved.crawl_deleted_at, null)
  assert.equal(saved.is_approved, false)
  assert.equal(restored.session.items.find(i => i.id === deleted.id).kind, 'update')
  assert.equal((await companyReviewCounts(['acme'], query)).acme, 2)
  check('soft deletion is recoverable and restores to pending without duplicate counts')

  const rejectedDecision = await start('preflight', ['other'])
  const failed = await finish(rejectedDecision)
  await post({action:'qualify',sessionId:failed.id,companyId:'other',decision:'rejected'})
  assert.equal((await service.get({companyIds:'other'})).qualifications.other.status, 'rejected')
  check('human rejection persists an uncrawlable badge')

  let missing = await finish(await start('preflight', ['missing']))
  assert.equal(missing.companies[0].status, 'failed')
  missing = sessionOf(await post({action:'retry',sessionId:missing.id,companyId:'missing',url:'https://jobs.lever.co/acme'}))
  assert.equal(missing.companies[0].retries, 0)
  missing = await finish(missing)
  await post({action:'qualify',sessionId:missing.id,companyId:'missing',decision:'approved'})
  assert.equal((await query("SELECT careers_page FROM trusted_companies WHERE company_id='missing'"))[0].careers_page, 'https://jobs.lever.co/acme')
  check('missing recruitment URL can be supplied and saved only on explicit qualification')

  listingFailure = true
  let retries = await finish(await start('preflight', ['acme'], {forcePreflight:true}))
  for(let i = 1; i <= 5; i++) {
    retries = await finish(sessionOf(await post({action:'retry',sessionId:retries.id,companyId:'acme'})))
    assert.equal(retries.companies[0].retries, i)
  }
  const requestsAtLimit = requests.length
  await assert.rejects(post({action:'retry',sessionId:retries.id,companyId:'acme'}), /5 次重试/)
  await assert.rejects(post({action:'continue',sessionId:retries.id}), /继续重试/)
  await post({action:'step',sessionId:retries.id})
  assert.equal(requests.length, requestsAtLimit)
  const beforeListFailure = await fingerprint()
  const failedListUpdate = await finish(await start('update'))
  assert(failedListUpdate.companies[0].progress.checked>0)
  assert.match(failedListUpdate.companies[0].partial,/列表读取失败/)
  assert.equal(await fingerprint(),beforeListFailure)
  check('list failure still checks existing published jobs without changing them')
  listingFailure = false
  check('five manual retries are enforced and read/step/continue cannot retry failed fetches')

  let entered, release
  const enteredPromise = new Promise(resolve => { entered = resolve })
  const releasePromise = new Promise(resolve => { release = resolve })
  listingBarrier = async () => { entered(); await releasePromise }
  const cancelled = await start('update')
  const inFlight = post({action:'step',sessionId:cancelled.id})
  await enteredPromise
  await post({action:'cancel',sessionId:cancelled.id})
  release()
  await inFlight
  listingBarrier = null
  const cancelledRead = await read(cancelled.id)
  assert.equal(cancelledRead.status, 'cancelled')
  assert.equal(cancelledRead.items.length, 0)
  const afterCancelRequests = requests.length
  await post({action:'step',sessionId:cancelled.id})
  assert.equal(requests.length, afterCancelRequests)
  check('cancellation during HTTP fences late results and stops subsequent requests')

  const partialService = createManualWorkflow({query,fetcher,publish:async()=>{},scan:async(source,cursor,options)=>{
    await options.fetcher('https://api.lever.co/v0/postings/acme?mode=json')
    return {jobs:[{...role(500),title:'Sample role',description,url:roleUrl(500)}],next:null,complete:false,reason:'未验证列表完整性'}
  }})
  const partialStart = await start('preflight',['acme'],{forcePreflight:true})
  const partial = (await partialService.post({action:'step',sessionId:partialStart.id},'qa@example.com')).session
  assert.equal(partial.companies[0].canApprove,true)
  assert.equal(partial.companies[0].raw,undefined,'session list does not include full evidence')
  await partialService.post({action:'qualify',sessionId:partial.id,companyId:'acme',decision:'approved'},'qa@example.com')
  check('complete sample can pass preflight even when whole-list completeness is unknown')
  let batch = await finish(await start('preflight',['other','acme'],{forcePreflight:true}))
  assert.equal(batch.companies[0].status,'failed')
  batch = await finish(sessionOf(await post({action:'skip',sessionId:batch.id,companyId:'other'})))
  assert.equal(batch.companies[1].canApprove,true)
  check('skipping the failed first company allows the remaining page companies to run')
  const beforeEmpty = await fingerprint()
  listed = []
  const empty = await finish(await start('preflight', ['acme'], {forcePreflight:true}))
  assert.equal(empty.companies[0].canApprove, false)
  await assert.rejects(post({action:'qualify',sessionId:empty.id,companyId:'acme',decision:'approved'}), /不能通过/)
  assert.equal(await fingerprint(), beforeEmpty)
  listed = [role(1), role(100)]
  check('zero-result preflight cannot pass or modify existing jobs')

  listed = Array.from({length:35},(_,n)=>({...role(200+n),descriptionPlain:description.repeat(60)}))
  const bulk = await finish(await start('update',['acme']))
  assert(bulk.itemsTotal>=35)
  assert.equal(bulk.items.length,25)
  assert(Buffer.byteLength(JSON.stringify(bulk))<100000, 'session lists must not repeat large raw responses')
  const bulkPage2 = (await service.get({sessionId:bulk.id,focusCompanyId:'acme',offset:25})).session
  assert.equal(bulkPage2.items.length,bulk.itemsTotal-25)
  assert.equal(bulkPage2.itemsOffset,25)
  const fullSample = (await service.get({itemId:bulkPage2.items[0].id})).item
  assert(fullSample.raw.requests[0].body.length)
  assert(fullSample.draft.description.length>5000)
  listed = [role(1), role(100)]
  check('large source responses are paginated; full fields and real evidence load on demand')

  await query("UPDATE jobs SET url='https://jobs.lever.co/acme' WHERE job_id='job-12'")
  const generic = await finish(await start('update'))
  assert.equal(generic.items.find(i => i.jobId==='job-12').kind, 'unknown')
  assert(!requests.includes('https://jobs.lever.co/acme'), 'generic board URL must not be verified as a specific job')
  check('generic application pages remain unknown and cannot be inferred closed')

  const failureService = createManualWorkflow({query,fetcher,publish:async()=>{throw new Error('Fixture unavailable cache')}})
  let persistedDraft = (await read(update.id)).items.find(i => i.id===created.id)
  const cacheFailure = await failureService.post({action:'decide',sessionId:update.id,itemId:persistedDraft.id,
    version:persistedDraft.version,decision:'draft',patch:{title:'Saved despite cache failure'}}, 'qa@example.com')
  assert(cacheFailure.publicationError)
  assert.equal((await read(update.id)).publicationErrors[0].status, 'failed')
  assert.equal((await query('SELECT title FROM jobs WHERE job_id=$1',[createdJobId]))[0].title, 'Saved despite cache failure')
  await post({action:'retry-publication',sessionId:update.id,companyId:'acme'})
  assert.equal((await read(update.id)).publicationErrors.length, 0)
  check('cache failure retains the saved job and durable warning; explicit retry clears it')

  // Publishing from the existing company editor must not leave a phantom pending count.
  await query('UPDATE jobs SET is_approved=true WHERE job_id=$1',[createdJobId])
  assert.equal((await companyReviewCounts(['acme'],query)).acme, 1)
  assert(!(await service.get({companyId:'acme'})).reviewItems.some(i=>i.id===created.id))
  check('ordinary editor publication removes saved-create history and pending count')

  await query("UPDATE trusted_companies SET careers_page='https://jobs.lever.co/changed' WHERE company_id='acme'")
  assert.equal((await service.get({companyIds:'acme'})).qualifications.acme.status, 'unreviewed')
  const draftForSourceCheck = (await read(update.id)).items.find(i => i.id === created.id)
  await assert.rejects(decide(update, draftForSourceCheck, 'publish'), /SOURCE_CONFLICT/)
  assert.equal((await query("SELECT * FROM jobs WHERE job_id='other-job'"))[0].title, 'Other company')
  check('changed recruitment URL invalidates qualification and blocks stale review publishing')

  await query("INSERT INTO trusted_companies(company_id,name,careers_page,website) VALUES('citi','花旗','https://jobs.citi.com/search-jobs','https://www.citigroup.com/global')")
  const citiUrl='https://jobs.citi.com/job/pune/engineer/287/12345'
  await query("INSERT INTO jobs(job_id,title,description,url,company_id,status,is_approved,published_at) VALUES('citi-job','Engineer',$1,$2,'citi','active',true,NOW())",[description,citiUrl])
  let employer='Early Career'
  const citiService=createManualWorkflow({query,fetcher:async url=>({url,status:200,text:`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:'Engineer',description,url:citiUrl,hiringOrganization:{name:employer}})}</script>`})})
  const citiBaseline=await fingerprint()
  for(const expected of [true,false]) {
    let s=(await citiService.post({action:'start',mode:'preflight',companyIds:['citi'],requestId:crypto.randomUUID()},'qa@example.com')).session
    s=(await citiService.post({action:'step',sessionId:s.id},'qa@example.com')).session
    assert.equal(s.companies[0].canApprove,expected)
    assert.equal((await citiService.get({companyIds:'citi'})).qualifications.citi.status,'unreviewed')
    employer='Unrelated staffing company'
  }
  assert.equal(await fingerprint(),citiBaseline)
  check('official Citi audience-label correction permits manual review but still rejects unrelated employers and never grants qualification')

  await query("INSERT INTO trusted_companies(company_id,name,careers_page,website) VALUES('legacy-html','Legacy','https://legacy.example/careers','https://legacy.example')")
  await query(`INSERT INTO job_sync_sources(id,source_key,url,adapter,config) VALUES('legacy-html','legacy-html','https://legacy.example/careers','manual','{"rolloutTier":"B"}')`)
  await query("INSERT INTO job_sync_source_companies(source_id,company_id) VALUES('legacy-html','legacy-html')")
  const legacyService=createManualWorkflow({query,fetcher:async url=>({url,status:200,text:`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:'Engineer',description,url:'https://legacy.example/career/engineer',hiringOrganization:{name:'Legacy'}})}</script>`})})
  let legacy=(await legacyService.post({action:'start',mode:'preflight',companyIds:['legacy-html'],requestId:crypto.randomUUID()},'qa@example.com')).session
  legacy=(await legacyService.post({action:'step',sessionId:legacy.id},'qa@example.com')).session
  assert.equal(legacy.companies[0].canApprove,true)
  legacy=(await legacyService.post({action:'qualify',sessionId:legacy.id,companyId:'legacy-html',decision:'approved'},'qa@example.com')).session
  assert.equal((await legacyService.get({companyIds:'legacy-html'})).qualifications['legacy-html'].status,'approved')
  assert.equal((await query("SELECT adapter FROM job_sync_sources WHERE id='legacy-html'"))[0].adapter,'manual')
  check('legacy rollout-only manual marker can be manually rechecked without rewriting source configuration or bypassing approval')
  console.log('Manual crawl integration checks passed.')
} catch (error) {
  console.error(error.stack)
  process.exitCode = 1
} finally {
  await pg.close()
}
