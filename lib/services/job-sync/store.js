import { randomUUID } from 'node:crypto'
import neonHelper from '../../../server-utils/dal/neon-helper.js'
import { detectSource, ADAPTERS } from './adapters.js'
import { validatePublicUrl } from './http.js'
import { canonicalUrl, externalIdentity, sourceFacts, hash } from './policy.js'
import { catalogSource } from './catalog.js'

export const db = (sql, params = []) => neonHelper.query(sql, params)
export async function atomic(queries) {
  const client = neonHelper.getClient()
  if (!client) throw new Error('Database not configured')
  return client.transaction(
    queries.map(([sql, params = []]) => client.query(sql, params))
  )
}
export async function initializeCohort(companyId = '') {
  const companies = await db(
    `SELECT c.* FROM trusted_companies c WHERE c.status='active' AND (($1<>'' AND c.company_id=$1) OR ($1='' AND EXISTS(SELECT 1 FROM jobs j WHERE j.company_id=c.company_id AND j.status='active' AND j.is_approved IS TRUE)))`,
    [companyId]
  )
  const records = companies.map((co) => {
    const seed = catalogSource(co),
      url = seed.url || co.careers_page || co.website || '',
      detected = url ? detectSource(url) : detectSource('')
    const adapter = seed.adapter || detected.adapter,
      config = { ...detected.config, ...seed.config }
    return {
      id: randomUUID(),
      company_id: co.company_id,
      source_key:
        adapter === 'manual'
          ? `manual:${co.company_id}`
          : `${adapter}:${canonicalUrl(url)}`,
      url,
      adapter,
      config,
      capabilities:
        adapter === 'manual'
          ? { discover: false, details: false, updates: false, absence: false }
          : { ...detected.capabilities, ...seed.capabilities },
      rule: seed.rule || {}
    }
  })
  const serialized = JSON.stringify(records)
  await atomic([
    [
      `INSERT INTO job_sync_sources(id,source_key,url,adapter,config,capabilities,next_run_at)
      SELECT DISTINCT ON (r.source_key) r.id,r.source_key,r.url,r.adapter,r.config,r.capabilities,NOW()+(abs(hashtext(r.source_key)::bigint)%1440)*INTERVAL '1 minute'
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,source_key text,url text,adapter text,config jsonb,capabilities jsonb,company_id text)
      WHERE NOT EXISTS(SELECT 1 FROM job_sync_source_companies m WHERE m.company_id=r.company_id) ON CONFLICT(source_key) DO NOTHING`,
      [serialized]
    ],
    [
      `INSERT INTO job_sync_source_companies(source_id,company_id,rule)
      SELECT s.id,r.company_id,r.rule FROM jsonb_to_recordset($1::jsonb) AS r(source_key text,company_id text,rule jsonb) JOIN job_sync_sources s ON s.source_key=r.source_key
      WHERE NOT EXISTS(SELECT 1 FROM job_sync_source_companies m WHERE m.company_id=r.company_id) ON CONFLICT DO NOTHING`,
      [serialized]
    ]
  ])
  const jobs = await db(
    `SELECT j.*,s.id AS sync_source_id,s.adapter AS sync_adapter,s.config AS sync_config FROM jobs j
    JOIN job_sync_source_companies m ON m.company_id=j.company_id JOIN job_sync_sources s ON s.id=m.source_id
    WHERE j.company_id=ANY($1::text[])`,
    [companies.map((c) => c.company_id)]
  )
  const bindings = []
  for (const j of jobs) {
    let detected
    try {
      detected = detectSource(j.url)
    } catch {
      continue
    }
    const externalId = externalIdentity(j.url)
    if (
      !externalId ||
      !['greenhouse', 'ashby', 'lever', 'workable'].includes(j.sync_adapter) ||
      detected.adapter !== j.sync_adapter ||
      String(detected.config.board).toLowerCase() !==
        String(j.sync_config.board).toLowerCase()
    )
      continue
    const payload = { ...sourceFacts(j), _unverified: true }
    bindings.push({
      id: randomUUID(),
      source_id: j.sync_source_id,
      external_id: externalId,
      job_id: j.job_id,
      company_id: j.company_id,
      payload,
      content_hash: hash(payload)
    })
  }
  await db(
    `INSERT INTO job_sync_source_jobs(id,source_id,external_id,job_id,company_id,payload,content_hash)
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(id text,source_id text,external_id text,job_id text,company_id text,payload jsonb,content_hash text) ON CONFLICT DO NOTHING`,
    [JSON.stringify(bindings)]
  )
  return {
    companies: companies.length,
    exactBindingCandidates: bindings.length
  }
}
export async function addSource(companyId, url) {
  validatePublicUrl(url)
  const [company] = await db(
    'SELECT company_id FROM trusted_companies WHERE company_id=$1',
    [companyId]
  )
  if (!company) throw new Error('请选择企业')
  const detected = detectSource(url),
    key = `${detected.adapter}:${canonicalUrl(url)}`
  await atomic([
    [
      'INSERT INTO job_sync_sources(id,source_key,url,adapter,config,capabilities) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_key) DO NOTHING',
      [
        randomUUID(),
        key,
        url,
        detected.adapter,
        JSON.stringify(detected.config),
        JSON.stringify(detected.capabilities)
      ]
    ],
    [
      'INSERT INTO job_sync_source_companies(source_id,company_id,rule) SELECT id,$2,\'{"requiresReview":true}\' FROM job_sync_sources WHERE source_key=$1 ON CONFLICT DO NOTHING',
      [key, companyId]
    ]
  ])
}
export async function ensureCompanySources(companyId) {
  const existing = await db(
    'SELECT s.* FROM job_sync_sources s JOIN job_sync_source_companies m ON m.source_id=s.id WHERE m.company_id=$1',
    [companyId]
  )
  if (existing.length) return existing
  const [co] = await db('SELECT * FROM trusted_companies WHERE company_id=$1', [
    companyId
  ])
  if (!co) throw new Error('企业不存在')
  const seed = catalogSource(co),
    url = seed.url || co.careers_page || co.website || ''
  const detected = url ? detectSource(url) : detectSource(''),
    adapter = seed.adapter || detected.adapter,
    config = { ...detected.config, ...seed.config }
  const sourceKey =
    adapter === 'manual'
      ? `manual:${companyId}`
      : `${adapter}:${canonicalUrl(url)}`
  const id = randomUUID()
  await atomic([
    [
      'INSERT INTO job_sync_sources(id,source_key,url,adapter,config,capabilities) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_key) DO NOTHING',
      [
        id,
        sourceKey,
        url,
        adapter,
        JSON.stringify(config),
        JSON.stringify({ ...detected.capabilities, ...seed.capabilities })
      ]
    ],
    [
      'INSERT INTO job_sync_source_companies(source_id,company_id,rule) SELECT id,$2,$3 FROM job_sync_sources WHERE source_key=$1 ON CONFLICT DO NOTHING',
      [sourceKey, companyId, JSON.stringify(seed.rule || {})]
    ]
  ])
  const sources = await db(
    'SELECT s.* FROM job_sync_sources s JOIN job_sync_source_companies m ON m.source_id=s.id WHERE m.company_id=$1',
    [companyId]
  )
  for (const source of sources) await seedExistingBindings(source, companyId)
  return sources
}
export async function seedExistingBindings(source, companyId) {
  const jobs = await db('SELECT * FROM jobs WHERE company_id=$1', [companyId])
  for (const job of jobs) {
    if (
      !job.url ||
      !['greenhouse', 'ashby', 'lever', 'workable'].includes(source.adapter)
    )
      continue
    let detected
    try {
      detected = detectSource(job.url)
    } catch {
      continue
    }
    if (
      detected.adapter !== source.adapter ||
      String(detected.config.board).toLowerCase() !==
        String(source.config.board).toLowerCase()
    )
      continue
    const externalId = externalIdentity(job.url)
    if (!externalId) continue
    const payload = { ...sourceFacts(job), _unverified: true }
    await db(
      `INSERT INTO job_sync_source_jobs(id,source_id,external_id,job_id,company_id,payload,content_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [
        randomUUID(),
        source.id,
        externalId,
        job.job_id,
        companyId,
        JSON.stringify(payload),
        hash(payload)
      ]
    )
  }
}
export async function enqueueCompany(companyId, actor) {
  if (!companyId || !actor) throw new Error('请在当前企业下先进行人工预检')
  const sources = await ensureCompanySources(companyId),
    tasks = []
  for (const s of sources) {
    if (!s.enabled) {
      tasks.push({ sourceId: s.id, error: '来源尚未启用，请先检查来源配置' })
      continue
    }
    tasks.push(await enqueue(s.id, { actor, companyId }))
  }
  return tasks
}
export async function enqueue(sourceId, { actor, companyId } = {}) {
  if (!actor || !companyId) throw new Error('请在当前企业下先进行人工预检')
  await db(
    `INSERT INTO job_sync_runs(id,source_id,source_revision,mode,requested_by,scope_company_id) SELECT $1,s.id,s.revision,'preflight',$3,$4 FROM job_sync_sources s WHERE s.id=$2 AND s.enabled AND s.adapter<>'manual' AND EXISTS(SELECT 1 FROM job_sync_source_companies WHERE source_id=s.id AND company_id=$4) ON CONFLICT DO NOTHING`,
    [randomUUID(), sourceId, actor, companyId]
  )
  const [run] = await db(
    "SELECT id,source_id,status FROM job_sync_runs WHERE source_id=$1 AND scope_company_id=$2 AND mode IN ('preflight','capture') AND status IN ('queued','running')",
    [sourceId, companyId]
  )
  if (!run) throw new Error('来源未启用')
  return { taskId: run.id, sourceId: run.source_id, status: run.status }
}
export async function saveSource(input) {
  const {
    id,
    url,
    adapter,
    enabled = false,
    capabilities = {},
    revision,
    companyId,
    ownershipRule
  } = input
  const config = { ...input.config }
  if (!ADAPTERS.includes(adapter)) throw new Error('不支持此适配器')
  if (adapter !== 'manual') validatePublicUrl(url)
  if (
    ['greenhouse', 'ashby', 'lever', 'workable', 'smartrecruiters'].includes(
      adapter
    ) &&
    !config.board
  )
    throw new Error('需要招聘系统的 board 标识')
  if (adapter === 'workday' && (!config.site || !config.tenant))
    throw new Error('需要 Workday tenant 和 site')
  if (adapter === 'manual' && enabled)
    throw new Error('人工来源不能启用自动扫描')
  if (companyId && ownershipRule) {
    const rule = {
      requiresReview: ownershipRule.requiresReview === true,
      ...(ownershipRule.contains
        ? { contains: String(ownershipRule.contains).slice(0, 300) }
        : {})
    }
    config.ownershipVersion = hash(rule)
    const results = await atomic([
      [
        'SELECT configure_job_sync_source($1,$2,$3,$4,$5,$6,$7) AS value',
        [
          id,
          revision,
          url,
          adapter,
          JSON.stringify(config),
          enabled,
          JSON.stringify(capabilities)
        ]
      ],
      [
        'UPDATE job_sync_source_companies SET rule=$3 WHERE source_id=$1 AND company_id=$2',
        [id, companyId, JSON.stringify(rule)]
      ]
    ])
    return results[0][0].value
  }
  const [result] = await db(
    'SELECT configure_job_sync_source($1,$2,$3,$4,$5,$6,$7) AS value',
    [
      id,
      revision,
      url,
      adapter,
      JSON.stringify(config),
      enabled,
      JSON.stringify(capabilities)
    ]
  )
  return result.value
}
