import assert from 'node:assert/strict'
import { assessPreflight } from '../lib/services/job-sync/preflight.js'
import { sourceFacts, eligibility } from '../lib/services/job-sync/policy.js'
import {
  checkExistingUrls,
  postingIdentity
} from '../lib/services/job-sync/url-checks.js'
import { companyReviewCounts } from '../lib/services/job-sync/counts.js'
import { enqueue } from '../lib/services/job-sync/store.js'
import { runWorker } from '../lib/services/job-sync/worker.js'
import { verifyPosting, readDetail } from '../lib/services/job-sync/adapters.js'

export async function runSafetyCases({ pg, q, runTask, request }) {
  const fullDescription =
    'This remote engineering job accepts applicants worldwide. Work with our product team to improve accessible and reliable software.'
  const raw = {
    external_id: 'safe-role',
    title: 'Engineer',
    description: fullDescription,
    url: 'https://example.com/jobs/safe-role',
    is_remote: true,
    location: 'APAC',
    category: '自动分类',
    tags: ['猜测标签'],
    experience_level: 'Senior',
    salary: null,
    timezone: 'unknown',
    company_logo: 'bad',
    region: 'guess'
  }
  const facts = sourceFacts(raw)
  for (const key of [
    'category',
    'tags',
    'experience_level',
    'salary',
    'timezone',
    'company_logo',
    'region'
  ])
    assert.equal(key in facts, false, `never infer/clear ${key}`)
  for (const location of [
    'China',
    'Hong Kong',
    'Taiwan',
    'Macau',
    'APAC',
    'Worldwide'
  ])
    assert.equal(eligibility({ ...facts, location }).status, 'eligible')
  assert.equal(
    eligibility({
      ...facts,
      location: 'APAC',
      description: 'Remote, must have work authorization in Singapore'
    }).status,
    'unknown'
  )
  const source = { complete_count: null }
  assert.equal(
    assessPreflight({ complete_count: 10 }, [raw], { list_complete: true })
      .preflight_passed,
    false
  )
  for (const [items, evidence] of [
    [[], { list_complete: true }],
    [[raw], { list_complete: false }],
    [[{ ...raw, description: 'Loading' }], { list_complete: true }],
    [[raw, raw], { list_complete: true }],
    [[raw], { list_complete: true, total: 2 }]
  ])
    assert.equal(
      assessPreflight(source, items, evidence).preflight_passed,
      false
    )
  assert.equal(postingIdentity('https://forms.example.com/apply'), null)
  assert.equal(postingIdentity('https://example.com/careers'), null)
  assert.equal(
    postingIdentity('https://job-boards.greenhouse.io/canonical'),
    null,
    'a board homepage is not a job identity'
  )
  const detailUrl = 'https://example.com/jobs/role'
  await assert.rejects(
    readDetail(detailUrl, {
      fetcher: async () => ({
        status: 200,
        url: detailUrl,
        text: `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Different role', url: 'https://example.com/jobs/another', description: fullDescription })}</script>`
      })
    }),
    /身份不一致/
  )
  const { default: retiredCrawler } = await import(
    '../lib/cron-handlers/stream-crawl-trusted-jobs.js'
  )
  const retiredResponse = {
    status(code) {
      this.code = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
  retiredCrawler({}, retiredResponse)
  assert.equal(
    retiredResponse.code,
    410,
    'direct legacy route cannot run metadata or job writes'
  )
  const conflict = await verifyPosting(
    { external_id: detailUrl, payload: { url: detailUrl, title: 'Engineer' } },
    {
      fetcher: async () => ({
        status: 200,
        url: detailUrl,
        text: `<body>This job has been closed<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Engineer', url: detailUrl, description: fullDescription })}</script></body>`
      })
    }
  )
  assert.equal(
    conflict.state,
    'unknown',
    'contradictory structured data must not be marked closed'
  )
  for (const status of [403, 429, 503])
    assert.equal(
      (
        await verifyPosting(
          { external_id: detailUrl, payload: { url: detailUrl } },
          { fetcher: async () => ({ status, url: detailUrl, text: '' }) }
        )
      ).state,
      'unknown'
    )
  assert.equal(
    (
      await verifyPosting(
        { external_id: detailUrl, payload: { url: detailUrl } },
        {
          fetcher: async () => ({
            status: 404,
            url: 'https://example.com/',
            text: ''
          })
        }
      )
    ).state,
    'unknown'
  )

  await pg.exec(`ALTER TABLE trusted_companies ADD COLUMN industry text DEFAULT '人工企业分类'; ALTER TABLE trusted_companies ADD COLUMN tags jsonb DEFAULT '["人工企业标签"]'; ALTER TABLE trusted_companies ADD COLUMN referral_contacts jsonb DEFAULT '[{"name":"人工联系人"}]'; ALTER TABLE trusted_companies ADD COLUMN cover_image text DEFAULT 'manual-cover';
    UPDATE jobs SET category='人工岗位分类',tags='["人工标签"]',experience_level='人工等级',salary='人工薪资',timezone='人工时区' WHERE job_id='j';
    INSERT INTO job_sync_sources(id,source_key,url,adapter,enabled,capabilities) VALUES('safe-source','safe-source','https://example.com/careers','html',true,'{}');
    INSERT INTO job_sync_source_companies VALUES('safe-source','co','{}');`)
  const snapshot = async () =>
    JSON.stringify({
      jobs: await q('SELECT * FROM jobs ORDER BY job_id'),
      companies: await q('SELECT * FROM trusted_companies ORDER BY company_id'),
      events: await q(
        'SELECT * FROM mini_company_update_events ORDER BY occurred_at'
      ),
      outbox: await q('SELECT * FROM job_sync_outbox ORDER BY id')
    })
  const baseline = await snapshot()
  await assert.rejects(enqueue('safe-source'), /人工预检/)
  const task = await enqueue('safe-source', { actor: 'admin', companyId: 'co' })
  const [preflight] = await q(
    "SELECT * FROM claim_job_sync_run('safe-preflight')"
  )
  assert.equal(preflight.id, task.taskId)
  await assert.rejects(
    q(
      "SELECT finish_job_sync_run($1,$2,'[{}]','[]','{\"trusted_complete\":true}')",
      [preflight.id, preflight.lease_token]
    ),
    /PREFLIGHT_REQUIRED/
  )
  const preflightResult = await runTask(preflight, {
    signal: new AbortController().signal,
    deadline: Date.now() + 60000,
    scan: async () => ({ jobs: [raw], complete: true, next: null })
  })
  assert.equal(preflightResult.preflight_passed, true)
  assert.equal(
    (
      await q('SELECT * FROM job_sync_candidates WHERE run_id=$1', [
        task.taskId
      ])
    ).length,
    0
  )
  assert.equal(
    await snapshot(),
    baseline,
    'preflight preserves every published field, company, event and outbox'
  )
  await assert.rejects(
    q(
      "INSERT INTO job_sync_candidates(id,company_id,run_id,create_job_id,kind,dedupe_key,patch) VALUES('bypass','co',$1,'bypass','create','bypass','{}')",
      [task.taskId]
    ),
    /PREFLIGHT_REQUIRED/
  )
  await q(
    "UPDATE job_sync_runs SET preflight_at=NOW()-INTERVAL '2 hours' WHERE id=$1",
    [task.taskId]
  )
  await assert.rejects(
    q('SELECT confirm_job_sync_preflight($1,$2)', [task.taskId, 'admin']),
    /PREFLIGHT_CONFLICT/
  )
  await q('UPDATE job_sync_runs SET preflight_at=NOW() WHERE id=$1', [
    task.taskId
  ])
  await q('UPDATE job_sync_sources SET revision=revision+1 WHERE id=$1', [
    'safe-source'
  ])
  await assert.rejects(
    q('SELECT confirm_job_sync_preflight($1,$2)', [task.taskId, 'admin']),
    /PREFLIGHT_CONFLICT/
  )
  await q('UPDATE job_sync_sources SET revision=revision-1 WHERE id=$1', [
    'safe-source'
  ])
  await q('SELECT confirm_job_sync_preflight($1,$2)', [task.taskId, 'admin'])
  const [capture] = await q("SELECT * FROM claim_job_sync_run('safe-capture')")
  await runTask(capture, {
    signal: new AbortController().signal,
    deadline: Date.now() + 60000,
    scan: async () => {
      throw new Error(
        'must use exactly the snapshot the administrator confirmed'
      )
    },
    verifyDetail: async () => ({ state: 'unknown', reason: 'fixture' })
  })
  const [candidate] = await q(
    'SELECT * FROM job_sync_candidates WHERE run_id=$1',
    [task.taskId]
  )
  assert.ok(candidate)
  assert.equal(candidate.patch.category, undefined)
  assert.equal(
    await snapshot(),
    baseline,
    'confirmed capture still cannot publish anything'
  )
  const badTask = await enqueue('safe-source', {
    actor: 'admin',
    companyId: 'co'
  })
  const [badRun] = await q("SELECT * FROM claim_job_sync_run('bad-preflight')")
  const badResult = await runTask(badRun, {
    signal: new AbortController().signal,
    deadline: Date.now() + 60000,
    scan: async () => ({
      jobs: [{ ...raw, description: 'Loading...' }],
      complete: true,
      next: null
    })
  })
  assert.equal(badResult.preflight_passed, false)
  await assert.rejects(
    q('SELECT confirm_job_sync_preflight($1,$2)', [badTask.taskId, 'admin']),
    /PREFLIGHT_CONFLICT/
  )
  assert.equal(
    await snapshot(),
    baseline,
    'incomplete detail cannot be approved through the preflight gate'
  )
  const [j] = await q("SELECT * FROM jobs WHERE job_id='j'")
  await q(
    "INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,patch) VALUES('safe-update','co','j','unused','update',$1,'safe-update','{}')",
    [j.sync_revision]
  )
  for (const patch of [
    { category: '覆盖' },
    { tags: ['覆盖'] },
    { salary: null },
    { salary: '' },
    { requirements: [] },
    {}
  ])
    await assert.rejects(
      q(
        "SELECT review_job_sync_candidate('safe-update',1,'admin','approve',$1,'co',NULL)",
        [JSON.stringify(patch)]
      ),
      /PROTECTED|FORBIDDEN|ACCEPT_FIELDS/
    )
  assert.equal(
    (
      await request('POST', {
        action: 'review',
        candidateId: 'safe-update',
        version: 1,
        baseRevision: j.sync_revision,
        decision: 'approve',
        companyId: 'co',
        patch: { company_logo: 'overwrite' }
      })
    ).statusCode,
    410
  )
  assert.equal(await snapshot(), baseline)
  await q(
    "SELECT review_job_sync_candidate('safe-update',1,'admin','approve',$1,'co',NULL)",
    [JSON.stringify({ title: '人工明确接受的新标题' })]
  )
  const [updated] = await q("SELECT * FROM jobs WHERE job_id='j'")
  for (const field of [
    'category',
    'tags',
    'experience_level',
    'salary',
    'timezone',
    'member_only',
    'can_refer',
    'haigoo_comment',
    'company_logo'
  ])
    assert.deepEqual(
      updated[field],
      j[field],
      `protect ${field} during publication`
    )
  assert.deepEqual(
    (
      await q(
        "SELECT industry,tags,referral_contacts,cover_image FROM trusted_companies WHERE company_id='co'"
      )
    )[0],
    {
      industry: '人工企业分类',
      tags: ['人工企业标签'],
      referral_contacts: [{ name: '人工联系人' }],
      cover_image: 'manual-cover'
    }
  )

  const beforeChecks = await snapshot()
  await checkExistingUrls({
    companyId: 'co',
    limit: 100,
    verify: async () => ({ state: 'closed', reason: '岗位详情 HTTP 410' })
  })
  assert.equal(
    await snapshot(),
    beforeChecks,
    'dead URLs only create review candidates'
  )
  let [closed] = await q(
    "SELECT * FROM job_sync_candidates WHERE job_id='j' AND status='pending' AND evidence->>'method'='url-check'"
  )
  assert.ok(closed)
  const counts = await companyReviewCounts(['co'], q)
  assert.ok(counts.co > 0)
  await q(
    "INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,patch) VALUES('same-job','co','j','unused','update',$1,'same-job','{}')",
    [updated.sync_revision]
  )
  assert.deepEqual(
    await companyReviewCounts(['co'], q),
    counts,
    'one job is counted once across multiple suggestions'
  )
  await checkExistingUrls({
    companyId: 'co',
    limit: 100,
    verify: async () => ({ state: 'unknown', reason: 'HTTP 403' })
  })
  await assert.rejects(
    q(
      "SELECT review_job_sync_candidate($1,$2,'admin','approve','{}','co',NULL)",
      [closed.id, closed.version]
    ),
    /STALE|CONFLICT/
  )
  assert.equal(await snapshot(), beforeChecks)
  await checkExistingUrls({
    companyId: 'co',
    limit: 100,
    verify: async () => ({ state: 'closed', reason: '岗位详情 HTTP 410' })
  })
  ;[closed] = await q(
    "SELECT * FROM job_sync_candidates WHERE job_id='j' AND status='pending' AND evidence->>'method'='url-check'"
  )
  assert.ok(
    closed,
    'new valid evidence can replace a superseded unknown observation'
  )
  await q(
    "UPDATE job_sync_url_checks SET checked_at=NOW()-INTERVAL '2 days' WHERE job_id=$1",
    ['j']
  )
  await assert.rejects(
    q(
      "SELECT review_job_sync_candidate($1,$2,'admin','approve','{}','co',NULL)",
      [closed.id, closed.version]
    ),
    /STALE/
  )
  await q("UPDATE job_sync_url_checks SET checked_at=NOW() WHERE job_id='j'")
  await q(
    "SELECT review_job_sync_candidate($1,$2,'admin','approve','{}','co',NULL)",
    [closed.id, closed.version]
  )
  assert.equal(
    (await q("SELECT status FROM jobs WHERE job_id='j'"))[0].status,
    'inactive'
  )
  const [jobAfterClose] = await q("SELECT * FROM jobs WHERE job_id='j'")
  assert.equal(jobAfterClose.description, updated.description)
  assert.equal(jobAfterClose.is_approved, updated.is_approved)
  const beforeRuns = (
    await q('SELECT COUNT(*)::integer AS n FROM job_sync_runs')
  )[0].n
  const original = process.env.JOB_SYNC_ENABLED
  process.env.JOB_SYNC_ENABLED = 'true'
  try {
    await runWorker({ budgetMs: 100, concurrency: 1 })
  } finally {
    if (original === undefined) delete process.env.JOB_SYNC_ENABLED
    else process.env.JOB_SYNC_ENABLED = original
  }
  assert.equal(
    (await q('SELECT COUNT(*)::integer AS n FROM job_sync_runs'))[0].n,
    beforeRuns,
    'worker must never auto-enqueue due sources'
  )
  console.log(
    'PASS manual preflight gate, company/field preservation, URL review isolation, review counts and no automatic discovery'
  )
}
