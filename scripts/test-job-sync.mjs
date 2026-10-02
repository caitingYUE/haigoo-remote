import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {
  canonicalUrl,
  externalIdentity,
  eligibility,
  scanCompleteness,
  diffFacts,
  nextMissing
} from '../lib/services/job-sync/policy.js'
import {
  isPublicAddress,
  validatePublicUrl,
  requireJson
} from '../lib/services/job-sync/http.js'
import { scanPage, verifyPosting } from '../lib/services/job-sync/adapters.js'
import { planObservations } from '../lib/services/job-sync/engine.js'
const description =
  'Remote engineering role with worldwide applicants welcome. Build and maintain reliable products with our team.'
const url = 'https://jobs.lever.co/example/12345678-1234-1234-1234-123456789abc'
const item = {
  external_id: '12345678-1234-1234-1234-123456789abc',
  title: 'Engineer',
  url,
  description,
  is_remote: true,
  location: 'Worldwide'
}
const source = {
  id: 's',
  revision: 1,
  adapter: 'lever',
  url: 'https://jobs.lever.co/example',
  config: { board: 'example' },
  capabilities: { absence: true },
  last_complete_at: null,
  complete_count: null
}
const run = { id: 'r', evidence: { list_complete: true } }
const job = {
  job_id: 'j',
  company_id: 'co',
  sync_revision: 0,
  title: '人工标题',
  description: '人工维护内容',
  url,
  status: 'active',
  is_approved: true,
  member_only: true
}
const json = (value) => ({
  status: 200,
  text: JSON.stringify(value),
  url: 'https://example.com'
})
assert.equal(
  canonicalUrl('https://a.com/jobs?utm_source=x&gh_jid=1&job=2'),
  'https://a.com/jobs?gh_jid=1&job=2'
)
assert.equal(externalIdentity(url), item.external_id)
for (const address of [
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  '::1',
  '::ffff:127.0.0.1',
  'fd00::1',
  '100.64.0.1'
])
  assert.equal(isPublicAddress(address), false)
assert.throws(() => validatePublicUrl('http://2130706433/admin'))
assert.throws(() => validatePublicUrl('https://a.com:444/admin'))
assert.throws(() => requireJson({ status: 404, text: '{}' }), /不代表岗位关闭/)
assert.equal(eligibility(item).status, 'eligible')
assert.equal(
  eligibility({
    ...item,
    location: 'APAC',
    description: 'Remote role, Mandarin language required'
  }).status,
  'eligible'
)
assert.equal(
  eligibility({ ...item, description: 'Remote role, US-only' }).status,
  'excluded'
)
assert.equal(
  scanCompleteness({ complete: true, count: 0, previousCount: 4 }).trusted,
  false
)
assert.equal(
  scanCompleteness({ complete: true, count: 60, previousCount: 100 }).trusted,
  false
)
assert.equal(
  scanCompleteness({ complete: false, count: 100, previousCount: 100 }).trusted,
  false
)
assert.equal(
  nextMissing(
    { first_missing_at: '2026-09-19T00:00:00Z', missing_count: 1 },
    '2026-09-19T23:59:00Z'
  ).verify,
  false
)
assert.deepEqual(
  diffFacts({ title: 'Source' }, { title: 'Source' }, { title: '人工标题' }),
  {}
)
let calls = []
const leverFetch = async (request) => {
  calls.push(request)
  const offset = Number(new URL(request).searchParams.get('skip'))
  return json(
    Array.from({ length: offset === 0 ? 100 : 21 }, (_, i) => ({
      id: String(offset + i),
      text: `Engineer ${offset + i}`,
      descriptionPlain: description,
      hostedUrl: `https://jobs.lever.co/example/${offset + i}`,
      categories: { location: 'Worldwide' },
      workplaceType: 'remote'
    }))
  )
}
const first = await scanPage(source, null, { fetcher: leverFetch }),
  second = await scanPage(source, first.next, { fetcher: leverFetch })
assert.equal(first.jobs.length + second.jobs.length, 121)
assert.equal(first.complete, false)
assert.equal(second.complete, true)
assert.match(calls[1], /skip=100/)
const greenhouse = { ...source, adapter: 'greenhouse' }
assert.equal(
  (
    await scanPage(greenhouse, null, {
      fetcher: async () =>
        json({
          jobs: Array.from({ length: 304 }, (_, i) => ({
            id: i,
            title: 'Engineer',
            content: description,
            absolute_url: `https://boards.greenhouse.io/example/jobs/${i}`,
            location: { name: 'Worldwide' }
          })),
          meta: { total: 304 }
        })
    })
  ).jobs.length,
  304
)
await assert.rejects(
  scanPage(greenhouse, null, {
    fetcher: async () => json({ jobs: [], meta: { total: 1 } })
  }),
  /不一致/
)
const workableRole = {
  shortcode: 'abc',
  title: 'Coach',
  url: 'https://apply.workable.com/j/abc',
  description,
  telecommuting: true
}
const htmlSource = {
  ...source,
  adapter: 'html',
  config: { completeList: true }
}
const htmlFetch = async (request) => ({
  status: 200,
  url: request,
  text: `<script type="application/ld+json">${JSON.stringify({
    '@type': 'JobPosting',
    identifier: { value: request.includes('page=2') ? 'second' : 'first' },
    title: 'Engineer',
    description,
    url: request + '/job'
  })}</script>${request.includes('page=2') ? '' : '<a rel="next" href="?page=2">Next</a>'}`
})
const htmlFirst = await scanPage(htmlSource, null, { fetcher: htmlFetch })
assert.equal(
  htmlFirst.complete,
  false,
  'structured data on page one cannot establish a complete list'
)
assert.ok(htmlFirst.next)
const htmlLast = await scanPage(htmlSource, htmlFirst.next, {
  fetcher: htmlFetch
})
assert.equal(htmlLast.complete, true)
assert.equal(htmlLast.jobs[0].external_id, 'second')
const workablePage = await scanPage({ ...source, adapter: 'workable' }, null, {
  fetcher: async () =>
    json({
      jobs: [
        { ...workableRole, country: 'China' },
        { ...workableRole, country: 'Singapore' }
      ]
    })
})
assert.equal(workablePage.jobs.length, 1)
assert.equal(workablePage.jobs[0].location, 'China; Singapore')
await assert.rejects(
  scanPage({ ...source, adapter: 'workable' }, null, {
    fetcher: async () =>
      json({
        jobs: [workableRole, { ...workableRole, title: 'Conflicting role' }]
      })
  }),
  /冲突/
)
assert.equal(
  (
    await verifyPosting(
      { ...item, payload: item },
      {
        fetcher: async () => ({
          status: 200,
          url,
          text: '<title>Just a moment</title><body>Verify you are human</body>'
        })
      }
    )
  ).state,
  'unknown'
)
assert.equal(
  (
    await verifyPosting(
      { ...item, payload: item },
      { fetcher: async () => ({ status: 503, url, text: 'down' }) }
    )
  ).state,
  'unknown'
)
assert.equal(
  (
    await verifyPosting(
      { ...item, payload: item },
      {
        fetcher: async () => ({
          status: 200,
          url: 'https://jobs.lever.co/',
          text: 'Home'
        })
      }
    )
  ).state,
  'unknown'
)
assert.equal(
  (
    await verifyPosting(
      { ...item, payload: item },
      { fetcher: async () => ({ status: 410, url, text: '' }) }
    )
  ).state,
  'closed'
)
const base = {
  source,
  run,
  items: [item],
  previous: [],
  published: [job],
  mappings: [{ company_id: 'co', rule: {} }],
  now: '2026-09-20T00:00:00Z'
}
let plan = await planObservations(base)
assert.equal(plan.observations[0].job_id, 'j')
assert.equal(plan.candidates[0].kind, 'update')
assert.equal(plan.candidates[0].queue, 'baseline')
assert.equal(job.title, '人工标题')
assert.equal(job.status, 'active')
const prior = {
  ...plan.observations[0],
  source_id: 's',
  version: 1,
  first_missing_at: '2026-09-19T00:00:00Z',
  missing_count: 1
}
plan = await planObservations({
  ...base,
  previous: [prior],
  source: {
    ...source,
    last_complete_at: '2026-09-19T00:00:00Z',
    complete_count: 1
  }
})
assert.equal(
  plan.candidates.length,
  0,
  'unchanged source must not overwrite manual text'
)
plan = await planObservations({
  ...base,
  items: [
    {
      ...item,
      url: 'https://jobs.lever.co/example/87654321-1234-1234-1234-123456789abc',
      external_id: 'other'
    }
  ],
  previous: [prior],
  source: {
    ...source,
    last_complete_at: '2026-09-19T00:00:00Z',
    complete_count: 1
  },
  verify: async () => ({ state: 'closed', reason: 'HTTP 410' })
})
assert.equal(plan.candidates.filter((c) => c.kind === 'close').length, 1)
plan = await planObservations({
  ...base,
  items: [],
  previous: [prior],
  verify: async () => ({ state: 'unknown', reason: 'temporarily unavailable' })
})
assert.equal(plan.candidates.length, 0)
assert.equal(
  plan.observations[0].missing_count,
  prior.missing_count,
  'zero results must not advance absence evidence'
)
const conflictingSource = await planObservations({
  ...base,
  items: [],
  previous: [prior],
  otherObservations: [{ job_id: 'j', state: 'open', last_seen_at: base.now }],
  verify: async () => ({ state: 'closed', reason: 'HTTP 410' })
})
assert.equal(
  conflictingSource.candidates.length,
  0,
  'fresh positive evidence from another source prevents closure'
)
console.log(
  'PASS policy, identities, pagination, blocked sources, manual preservation and absence guards'
)

const { PGlite } = await import(
    process.env.PGLITE_MODULE
      ? pathToFileURL(process.env.PGLITE_MODULE).href
      : '@electric-sql/pglite'
  ),
  pg = new PGlite()
try {
  await pg.exec(`CREATE TABLE trusted_companies(company_id text PRIMARY KEY,name text,status text DEFAULT 'active',website text,logo text,hiring_email text,member_only boolean,can_refer boolean,job_count integer,updated_at timestamptz);
    CREATE TABLE jobs(job_id text PRIMARY KEY,title text,description text,url text,company_id text,company text,company_website text,company_logo text,location text,salary text,job_type text,experience_level text,category text,tags jsonb,requirements jsonb,benefits jsonb,is_remote boolean,region text,timezone text,china_friendly boolean,published_at timestamptz NOT NULL,translations jsonb,is_translated boolean,status text,is_approved boolean,source text,source_type text,is_trusted boolean,member_only boolean,can_refer boolean,is_manually_edited boolean,created_at timestamptz,updated_at timestamptz,haigoo_comment text);
    INSERT INTO trusted_companies(company_id,name,member_only,can_refer) VALUES('co','Company',true,true);
    INSERT INTO jobs(job_id,title,description,url,company_id,status,is_approved,member_only,can_refer,haigoo_comment,published_at) VALUES('j','Manual title','${description}','${url}','co','active',true,true,true,'Protected',NOW());`)
  await pg.exec(
    await readFile(
      new URL(
        '../server-utils/dal/migrations/091_trusted_job_sync.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  const q = async (sql, params = []) => (await pg.query(sql, params)).rows
  await pg.exec(
    `CREATE TABLE mini_company_update_events(company_id text,event_type text,event_hash text,source_job_id text,has_public_opportunity boolean,job_snapshot jsonb,occurred_at timestamptz);`
  )
  const reminderMigration = await readFile(
    new URL(
      '../server-utils/dal/migrations/089_mini_wechat_reminder_delivery.sql',
      import.meta.url
    ),
    'utf8'
  )
  await pg.exec(
    reminderMigration.slice(
      reminderMigration.indexOf(
        'CREATE OR REPLACE FUNCTION mini_job_is_public'
      ),
      reminderMigration.indexOf(
        'CREATE OR REPLACE FUNCTION mini_capture_company_opportunities'
      )
    )
  )
  await q(
    "INSERT INTO job_sync_sources(id,source_key,url,adapter,enabled,capabilities) VALUES('s','s',$1,'lever',true,'{\"absence\":true}')",
    [source.url]
  )
  await q("INSERT INTO job_sync_source_companies VALUES('s','co','{}')")
  const before = JSON.stringify(await q('SELECT * FROM jobs'))
  await q(
    "INSERT INTO job_sync_runs(id,source_id,source_revision) VALUES('r','s',1)"
  )
  assert.equal((await q("SELECT * FROM claim_job_sync_run('token')")).length, 1)
  assert.equal(
    (await q("SELECT * FROM claim_job_sync_run('duplicate')")).length,
    0
  )
  await assert.rejects(
    q("SELECT save_job_sync_page('r','wrong','[]',NULL)"),
    /SCAN_CONFLICT/
  )
  await q("SELECT save_job_sync_page('r','token',$1,NULL)", [
    JSON.stringify([item])
  ])
  const realJob = (await q("SELECT * FROM jobs WHERE job_id='j'"))[0]
  const scan = await planObservations({ ...base, published: [realJob] })
  await q("SELECT finish_job_sync_run('r','token',$1,$2,$3)", [
    JSON.stringify(scan.observations),
    JSON.stringify(scan.candidates),
    JSON.stringify(scan.result)
  ])
  assert.equal(
    JSON.stringify(await q('SELECT * FROM jobs')),
    before,
    'scan may not change published data'
  )
  const candidate = scan.candidates[0]
  const approve = (id, version = 1, patch = candidate.patch) =>
    q(
      "SELECT review_job_sync_candidate($1,$2,'admin','approve',$3,'co','checked') AS value",
      [id, version, JSON.stringify(patch)]
    )
  await assert.rejects(
    approve(candidate.id, 1, { ...candidate.patch, member_only: false }),
    /FIELD_NOT_ALLOWED/
  )
  assert.equal(
    JSON.stringify(await q('SELECT * FROM jobs')),
    before,
    'failed publication must roll back'
  )
  await approve(candidate.id)
  let published = (await q("SELECT * FROM jobs WHERE job_id='j'"))[0]
  assert.equal(published.title, 'Engineer')
  assert.equal(published.member_only, true)
  assert.equal(published.haigoo_comment, 'Protected')
  assert.equal((await q('SELECT * FROM job_sync_audit')).length, 1)
  assert.equal((await q('SELECT * FROM job_sync_outbox')).length, 1)
  await approve(candidate.id)
  assert.equal(
    (await q('SELECT * FROM job_sync_audit')).length,
    1,
    'duplicate approval must be idempotent'
  )
  // Concurrent manual edit must reject an old proposal without changing any candidate/audit.
  const sj = (await q('SELECT * FROM job_sync_source_jobs'))[0]
  await q(
    `INSERT INTO job_sync_candidates(id,source_job_id,company_id,job_id,create_job_id,kind,base_revision,source_version,dedupe_key,patch,evidence)
    VALUES('stale',$1,'co','j','unused','update',$2,$3,'stale','{"title":"Bad overwrite"}','{"source_revision":1}')`,
    [sj.id, published.sync_revision, sj.version]
  )
  await q("UPDATE jobs SET title='Concurrent edit' WHERE job_id='j'")
  await assert.rejects(
    approve('stale', 1, { title: 'Bad overwrite' }),
    /JOB_CONFLICT/
  )
  assert.equal(
    (await q("SELECT title FROM jobs WHERE job_id='j'"))[0].title,
    'Concurrent edit'
  )
  assert.equal(
    (await q("SELECT status FROM job_sync_candidates WHERE id='stale'"))[0]
      .status,
    'pending'
  )
  // New, close and reopen stay isolated until the same atomic reviewer acts.
  await q(
    `INSERT INTO job_sync_candidates(id,company_id,create_job_id,kind,dedupe_key,patch) VALUES('new','co','new-job','create','new',$1)`,
    [JSON.stringify(item)]
  )
  const createPatch = {
    title: 'New role',
    description,
    url,
    is_remote: true,
    location: 'Worldwide'
  }
  await approve('new', 1, createPatch)
  assert.equal(
    (await q("SELECT member_only FROM jobs WHERE job_id='new-job'"))[0]
      .member_only,
    true
  )
  for (const kind of ['close', 'reopen']) {
    const current = (
      await q("SELECT sync_revision FROM jobs WHERE job_id='j'")
    )[0]
    await q(
      `INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,patch) VALUES($1,'co','j','unused',$1,$2,$1,'{}')`,
      [kind, current.sync_revision]
    )
    await approve(kind, 1, {})
    assert.equal(
      (await q("SELECT status FROM jobs WHERE job_id='j'"))[0].status,
      kind === 'close' ? 'inactive' : 'active'
    )
  }
  await q(
    "INSERT INTO job_sync_runs(id,source_id,source_revision) VALUES('expired','s',1)"
  )
  await q("SELECT * FROM claim_job_sync_run('old-token')")
  await q(
    "UPDATE job_sync_runs SET lease_until=NOW()-INTERVAL '1 second' WHERE id='expired'"
  )
  await q("SELECT * FROM claim_job_sync_run('new-token')")
  await assert.rejects(
    q("SELECT finish_job_sync_run('expired','old-token','[]','[]','{}')"),
    /SCAN_CONFLICT/
  )
  await q(
    "SELECT configure_job_sync_source('s',1,$1,'lever','{}',false,'{}')",
    [source.url]
  )
  await assert.rejects(
    q("SELECT save_job_sync_page('expired','new-token','[]',NULL)"),
    /SCAN_CONFLICT/
  )
  // Exercise the real admin handler against the isolated database, including authorization.
  await pg.exec(
    await readFile(
      new URL(
        '../server-utils/dal/migrations/092_job_sync_manual_gate.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  const { default: helper } = await import('../server-utils/dal/neon-helper.js')
  const { default: userHelper } = await import('../server-utils/user-helper.js')
  const { generateToken } = await import('../server-utils/auth-helpers.js')
  const { default: handler } = await import('../api/admin/job-sync.js')
  const savedQuery = helper.query,
    savedUser = userHelper.getUserById
  helper.query = q
  userHelper.getUserById = async (id) => ({
    id,
    email: 'fixture@example.com',
    roles: { admin: id === 'admin' }
  })
  const request = async (method, body = {}, user = 'admin', query = {}) => {
    const response = {
      statusCode: 200,
      setHeader() {},
      status(code) {
        this.statusCode = code
        return this
      },
      json(data) {
        this.data = data
        return this
      }
    }
    await handler(
      {
        method,
        body,
        query,
        headers: user
          ? { authorization: `Bearer ${generateToken({ userId: user })}` }
          : {}
      },
      response
    )
    return response
  }
  try {
    const { runTask } = await import('../lib/services/job-sync/worker.js')
    await q("UPDATE job_sync_sources SET enabled=true WHERE id='s'")
    await q(
      "INSERT INTO job_sync_runs(id,source_id,source_revision,mode,requested_by,scope_company_id) SELECT 'resume',id,revision,'preflight','admin','co' FROM job_sync_sources WHERE id='s'"
    )
    const firstRun = (
      await q("SELECT * FROM claim_job_sync_run('resume-first')")
    )[0]
    const checkpointController = new AbortController()
    const unchangedBefore = JSON.stringify(
      await q('SELECT * FROM jobs ORDER BY job_id')
    )
    const yielded = await runTask(firstRun, {
      signal: checkpointController.signal,
      deadline: Date.now() + 60000,
      scan: async () => {
        checkpointController.abort()
        return {
          jobs: [
            {
              ...item,
              external_id: 'resume-1',
              url: 'https://example.com/jobs/resume-1'
            }
          ],
          next: { offset: 1 },
          complete: false
        }
      }
    })
    assert.equal(yielded.status, 'queued')
    const resumedRun = (
      await q("SELECT * FROM claim_job_sync_run('resume-second')")
    )[0]
    assert.equal(resumedRun.cursor.adapter.offset, 1)
    const finished = await runTask(resumedRun, {
      signal: new AbortController().signal,
      deadline: Date.now() + 60000,
      scan: async (_, cursor) => {
        assert.equal(cursor.offset, 1)
        return {
          jobs: [
            {
              ...item,
              external_id: 'resume-2',
              url: 'https://example.com/jobs/resume-2'
            }
          ],
          next: null,
          complete: true
        }
      },
      verifyDetail: async () => ({ state: 'unknown', reason: 'fixture' })
    })
    assert.equal(finished.status, 'complete')
    assert.equal(
      (
        await q(
          "SELECT COUNT(*)::integer AS n FROM job_sync_run_items WHERE run_id='resume'"
        )
      )[0].n,
      2
    )
    assert.equal(
      JSON.stringify(await q('SELECT * FROM jobs ORDER BY job_id')),
      unchangedBefore
    )
    assert.equal((await request('GET', {}, null)).statusCode, 403)
    assert.equal(
      (await request('POST', { action: 'draft' }, 'reader')).statusCode,
      403
    )
    const overview = await request('GET', {}, 'admin', {
      companyId: 'co',
      queue: 'changes'
    })
    assert.equal(overview.statusCode, 200, JSON.stringify(overview.data))
    assert.ok(overview.data.sources.length)
    const revisionBefore = JSON.stringify(
      await q('SELECT * FROM jobs ORDER BY job_id')
    )
    await q(
      "UPDATE trusted_companies SET member_only=false WHERE company_id='co'"
    )
    for (const action of ['draft', 'review', 'enqueue', 'source', 'bootstrap', 'bind']) {
      assert.equal((await request('POST', {action, companyId:'co'})).statusCode, 410,
        'retired workflow mutations must be rejected')
    }
    assert.equal(JSON.stringify(await q('SELECT * FROM jobs ORDER BY job_id')), revisionBefore)
    // Keep legacy database/outbox regression coverage through direct fixture setup;
    // the retired HTTP interface must never be used to create or approve candidates.
    const draft = {id:'legacy-db-draft', create_job_id:'legacy-db-public-job'}
    await q(`INSERT INTO job_sync_candidates(id,company_id,create_job_id,kind,dedupe_key,patch)
      VALUES($1,'co',$2,'create',$1,'{}')`,[draft.id,draft.create_job_id])
    await approve(draft.id, 1, {...createPatch,title:'Manual remote engineer',url:'https://example.com/jobs/manual-fixture'})
    assert.equal(
      (await q('SELECT * FROM mini_company_update_events')).length,
      1,
      'only approved new public jobs create opportunity events'
    )
    const [publishedDraft] = await q('SELECT * FROM jobs WHERE job_id=$1', [
      draft.create_job_id
    ])
    await q(
      `INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,patch) VALUES('content-only','co',$1,'unused','update',$2,'content-only','{}')`,
      [publishedDraft.job_id, publishedDraft.sync_revision]
    )
    await approve('content-only', 1, { title: 'Edited public title' })
    assert.equal(
      (await q('SELECT * FROM mini_company_update_events')).length,
      1,
      'content edits must not create opportunity events'
    )
    for (const kind of ['close', 'reopen']) {
      const [current] = await q(
        'SELECT sync_revision FROM jobs WHERE job_id=$1',
        [publishedDraft.job_id]
      )
      await q(
        `INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,patch) VALUES($1,'co',$2,'unused',$3,$4,$1,'{}')`,
        ['public-' + kind, publishedDraft.job_id, kind, current.sync_revision]
      )
      await approve('public-' + kind, 1, {})
    }
    assert.deepEqual(
      (
        await q(
          'SELECT event_type FROM mini_company_update_events ORDER BY occurred_at'
        )
      ).map((r) => r.event_type),
      ['job_added', 'job_reopened']
    )
    const { drainOutbox } = await import('../lib/services/job-sync/worker.js')
    const pendingOutbox = (
      await q("SELECT * FROM job_sync_outbox WHERE status='pending'")
    ).length
    let historyCalls = 0,
      profileCalls = 0
    assert.equal(
      await drainOutbox(1, {
        reconcileCompanyDirectoryHistory: async (companyId, options) => {
          assert.equal(companyId, 'co')
          assert.equal(options.rebuild, false)
          historyCalls++
        },
        rebuildCompanyHiringProfile: async () => {
          profileCalls++
        }
      }),
      pendingOutbox
    )
    assert.equal(
      historyCalls,
      1,
      'one company rebuild covers all its pending publication effects'
    )
    assert.equal(profileCalls, 1)
    assert.equal(
      (await q("SELECT * FROM job_sync_outbox WHERE status='done'")).length,
      pendingOutbox
    )
    await q(
      "UPDATE job_sync_outbox SET status='pending',available_at=NOW() WHERE id=(SELECT MIN(id) FROM job_sync_outbox)"
    )
    await drainOutbox(1, {
      reconcileCompanyDirectoryHistory: async () => {
        throw new Error('fixture retry')
      },
      rebuildCompanyHiringProfile: async () => {
        throw new Error('must not run')
      }
    })
    const [retryEffect] = await q(
      "SELECT *, available_at>NOW() AS backed_off FROM job_sync_outbox WHERE status='pending'"
    )
    assert.equal(retryEffect.last_error, 'fixture retry')
    assert.equal(retryEffect.backed_off, true)
    assert.equal(retryEffect.lease_token, null)
    await pg.exec(`CREATE FUNCTION reject_fixture_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor='fail' THEN RAISE EXCEPTION 'FIXTURE_AUDIT_FAILURE'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_fixture_audit BEFORE INSERT ON job_sync_audit FOR EACH ROW EXECUTE FUNCTION reject_fixture_audit();
      INSERT INTO job_sync_candidates(id,company_id,create_job_id,kind,dedupe_key,patch) VALUES('rollback','co','rolled-back-job','create','rollback','{}');`)
    await assert.rejects(
      q(
        "SELECT review_job_sync_candidate('rollback',1,'fail','approve',$1,'co',NULL)",
        [JSON.stringify(createPatch)]
      ),
      /FIXTURE_AUDIT_FAILURE/
    )
    assert.equal(
      (await q("SELECT * FROM jobs WHERE job_id='rolled-back-job'")).length,
      0
    )
    assert.equal(
      (await q('SELECT * FROM mini_company_update_events')).length,
      2,
      'failed audit rolls back the job and its notification event together'
    )
    assert.equal(
      (
        await request('POST', {
          action: 'review',
          candidateId: 'stale',
          version: 1,
          baseRevision: -1,
          decision: 'approve',
          patch: {}
        })
      ).statusCode,
      410
    )
    const { runSafetyCases } = await import('./job-sync-safety-cases.mjs')
    await runSafetyCases({ pg, q, request, runTask })
  } finally {
    helper.query = savedQuery
    userHelper.getUserById = savedUser
  }
  console.log(
    'PASS PostgreSQL migration, isolation, atomic rollback, revision conflicts, manual fields, new/close/reopen, idempotency and lease fencing'
  )
} finally {
  await pg.close()
}
