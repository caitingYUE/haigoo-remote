import { randomUUID } from 'node:crypto'
import { db } from './store.js'
import { finishPreflight, assessPreflight } from './preflight.js'
import { scanPage, verifyPosting } from './adapters.js'
import { hash } from './policy.js'
import { planObservations } from './engine.js'

export async function runTask(
  run,
  { signal, deadline, scan = scanPage, verifyDetail = verifyPosting }
) {
  const [source] = await db('SELECT * FROM job_sync_sources WHERE id=$1', [
    run.source_id
  ])
  await db(
    'UPDATE job_sync_sources SET last_attempt_at=NOW() WHERE id=$1 AND revision=$2',
    [source.id, run.source_revision]
  )
  let cursor = run.cursor || {},
    evidence = { ...run.evidence },
    pages = 0
  try {
    if (!['preflight', 'capture'].includes(run.mode) || !run.requested_by)
      throw new Error('PREFLIGHT_REQUIRED')
    if (Date.now() - Date.parse(run.created_at) > 3600000)
      throw new Error('本次预检已超过一小时，请重新检测以获取完整且新鲜的清单')
    while (!cursor.finished) {
      if (signal.aborted || Date.now() > deadline - 10000)
        throw new Error('BUDGET_YIELD')
      const page = await scan(source, cursor.adapter, { signal })
      if (page.next && hash(page.next) === hash(cursor.adapter || {}))
        throw new Error('分页未前进，暂停来源检查')
      // Carry failures across every page and every invocation.
      evidence = {
        ...evidence,
        partial: evidence.partial || page.reason || null,
        list_complete: !page.next && page.complete,
        total: page.total ?? evidence.total
      }
      const next = { adapter: page.next, finished: !page.next, evidence }
      await db('SELECT save_job_sync_page($1,$2,$3,$4)', [
        run.id,
        run.lease_token,
        JSON.stringify(page.jobs),
        JSON.stringify(next)
      ])
      cursor = next
      pages++
      if (pages > 200) throw new Error('本轮分页数量异常，需复核来源')
    }
    evidence = cursor.evidence || evidence
    const [rows, previous, published, mappings, pending] = await Promise.all([
      db('SELECT payload FROM job_sync_run_items WHERE run_id=$1', [run.id]),
      db('SELECT * FROM job_sync_source_jobs WHERE source_id=$1', [source.id]),
      db(
        'SELECT j.* FROM jobs j JOIN job_sync_source_companies m ON m.company_id=j.company_id WHERE m.source_id=$1',
        [source.id]
      ),
      db('SELECT * FROM job_sync_source_companies WHERE source_id=$1', [
        source.id
      ]),
      db(
        "SELECT c.* FROM job_sync_candidates c JOIN job_sync_source_jobs sj ON sj.id=c.source_job_id WHERE sj.source_id=$1 AND c.status='pending'",
        [source.id]
      )
    ])
    if (evidence.total != null && Number(evidence.total) !== rows.length)
      evidence.partial = '采集数量与来源总数不一致'
    const items = rows.map((r) => r.payload)
    if (run.mode === 'preflight')
      return await finishPreflight(run, source, items, evidence)
    if (
      !run.confirmed_by ||
      Date.now() - Date.parse(run.preflight_at) > 3600000 ||
      !assessPreflight(source, items, evidence).preflight_passed
    )
      throw new Error('PREFLIGHT_REQUIRED')
    const verifications = run.evidence?.verifications || {}
    const otherObservations = await db(
      `SELECT other.job_id,other.state,other.last_seen_at FROM job_sync_source_jobs other JOIN job_sync_sources s ON s.id=other.source_id
      WHERE s.enabled AND other.source_id<>$1 AND other.job_id IN (SELECT job_id FROM job_sync_source_jobs WHERE source_id=$1 AND job_id IS NOT NULL)`,
      [source.id]
    )
    const verify = async (observation, options) => {
      if (
        verifications[observation.id] &&
        Date.now() - Date.parse(verifications[observation.id].checked_at) <
          3600000
      )
        return verifications[observation.id]
      if (signal.aborted || Date.now() > deadline - 25000)
        throw new Error('BUDGET_YIELD')
      const result = await verifyDetail(observation, options)
      if (signal.aborted) throw new Error('BUDGET_YIELD')
      verifications[observation.id] = {
        ...result,
        checked_at: new Date().toISOString()
      }
      await db(
        `UPDATE job_sync_runs SET evidence=jsonb_set(evidence,'{verifications}',$3::jsonb) WHERE id=$1 AND lease_token=$2 AND lease_until>NOW()`,
        [run.id, run.lease_token, JSON.stringify(verifications)]
      )
      return result
    }
    const plan = await planObservations({
      source,
      run: { ...run, evidence },
      items,
      scopeCompany: run.scope_company_id,
      previous,
      published,
      mappings,
      pending,
      otherObservations,
      verify,
      signal
    })
    await db('SELECT finish_job_sync_run($1,$2,$3,$4,$5)', [
      run.id,
      run.lease_token,
      JSON.stringify(plan.observations),
      JSON.stringify(plan.candidates),
      JSON.stringify(plan.result)
    ])
    return plan.result
  } catch (error) {
    if (signal.aborted || error.message === 'BUDGET_YIELD') {
      await db(
        "UPDATE job_sync_runs SET status='queued',lease_token=NULL,lease_until=NULL,available_at=NOW() WHERE id=$1 AND lease_token=$2 AND lease_until>NOW()",
        [run.id, run.lease_token]
      )
      return { status: 'queued', reason: '已保存进度，下次继续' }
    }
    if (/CONFLICT/.test(error.message))
      return { status: 'conflict', reason: error.message }
    const status = ['blocked', 'partial'].includes(error.status)
      ? error.status
      : 'failed'
    await db('SELECT finish_job_sync_run($1,$2,$3,$4,$5)', [
      run.id,
      run.lease_token,
      '[]',
      '[]',
      JSON.stringify({ status, trusted_complete: false, error: error.message })
    ])
    if (error.retryAfter)
      await db(
        "UPDATE job_sync_sources SET next_run_at=GREATEST(next_run_at,NOW()+($2||' seconds')::interval) WHERE id=$1",
        [source.id, error.retryAfter]
      )
    return { status, error: error.message }
  }
}

export async function drainOutbox(limit = 10, dependencies) {
  const { reconcileCompanyDirectoryHistory, rebuildCompanyHiringProfile } =
    dependencies || (await import('../mini-company-match-service.js'))
  let done = 0
  for (let i = 0; i < limit; i++) {
    const token = randomUUID()
    const tasks = await db(
      `WITH anchor AS (SELECT company_id FROM job_sync_outbox WHERE available_at<=NOW() AND (status='pending' OR (status='running' AND lease_until<NOW())) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE job_sync_outbox SET status='running',lease_token=$1,lease_until=NOW()+INTERVAL '4 minutes',attempts=attempts+1
      WHERE company_id=(SELECT company_id FROM anchor) AND available_at<=NOW() AND (status='pending' OR (status='running' AND lease_until<NOW())) RETURNING *`,
      [token]
    )
    const task = tasks[0]
    if (!task) break
    try {
      await reconcileCompanyDirectoryHistory(task.company_id, {
        rebuild: false
      })
      await rebuildCompanyHiringProfile(task.company_id)
      await db(
        "UPDATE job_sync_outbox SET status='done',last_error=NULL,lease_token=NULL,lease_until=NULL WHERE lease_token=$1 AND lease_until>NOW()",
        [token]
      )
      done += tasks.length
    } catch (error) {
      await db(
        "UPDATE job_sync_outbox SET status='pending',last_error=$2,available_at=NOW()+INTERVAL '10 minutes'*LEAST(attempts,144),lease_token=NULL,lease_until=NULL WHERE lease_token=$1 AND lease_until>NOW()",
        [token, error.message]
      )
    }
  }
  return done
}

export async function runWorker({ budgetMs = 180000, concurrency = 4 } = {}) {
  if (process.env.JOB_SYNC_ENABLED !== 'true')
    return { paused: true, reason: 'JOB_SYNC_ENABLED 未启用' }
  const deadline = Date.now() + Math.min(budgetMs, 180000),
    controller = new AbortController(),
    timer = setTimeout(
      () => controller.abort(),
      Math.max(1, deadline - Date.now() - 3000)
    )
  const results = []
  try {
    // Only drain explicitly requested work. Never discover or enqueue sources on a timer.
    await db(
      "UPDATE job_sync_runs SET status='cancelled',finished_at=NOW(),error='预检已过期，请重新检测' WHERE mode='capture' AND status='queued' AND preflight_at<NOW()-INTERVAL '1 hour'"
    )
    await Promise.all(
      Array.from({ length: Math.min(4, concurrency) }, async () => {
        while (Date.now() < deadline - 15000 && !controller.signal.aborted) {
          const [run] = await db('SELECT * FROM claim_job_sync_run($1)', [
            randomUUID()
          ])
          if (!run) break
          results.push({
            taskId: run.id,
            ...(await runTask(run, { signal: controller.signal, deadline }))
          })
        }
      })
    )
    // Keep raw daily page captures for 90 days; approved evidence and audit remain.
    await db(
      "DELETE FROM job_sync_run_items WHERE run_id IN (SELECT id FROM job_sync_runs WHERE finished_at<NOW()-INTERVAL '90 days')"
    )
    await db(
      "DELETE FROM job_sync_source_versions v WHERE observed_at<NOW()-INTERVAL '90 days' AND NOT EXISTS(SELECT 1 FROM job_sync_candidates c WHERE c.source_job_id=v.source_job_id AND c.source_version=v.version)"
    )
  } finally {
    clearTimeout(timer)
  }
  return { results }
}
