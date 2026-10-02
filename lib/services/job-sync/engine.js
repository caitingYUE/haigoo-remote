import { randomUUID } from 'node:crypto'
import {
  canonicalUrl,
  externalIdentity,
  sourceFacts,
  hash,
  diffFacts,
  eligibility,
  scanCompleteness,
  nextMissing
} from './policy.js'
import { verifyPosting } from './adapters.js'
import { normalizeDraft } from './enrichment.js'

// Pure planning boundary: no access to the published-table writer.
export async function planObservations({
  source,
  run,
  items,
  previous,
  published,
  mappings,
  pending = [],
  otherObservations = [],
  scopeCompany,
  now = new Date().toISOString(),
  verify = verifyPosting,
  signal
}) {
  const prior = new Map(previous.map((j) => [j.external_id, j])),
    observations = [],
    candidates = [],
    checks = []
  const quality = scanCompleteness({
    complete: run.evidence?.list_complete === true && !run.evidence?.partial,
    count: items.length,
    previousCount: source.complete_count
  })
  const used = new Set(previous.filter((j) => j.job_id).map((j) => j.job_id))
  const chooseCompany = (job) => {
    if (mappings.length === 1 && !mappings[0].rule?.requiresReview)
      return mappings[0].company_id
    const matches = mappings.filter(
      (m) =>
        m.rule?.contains &&
        `${job.title} ${job.department || ''} ${job.location || ''} ${job.description || ''}`
          .toLowerCase()
          .includes(String(m.rule.contains).toLowerCase())
    )
    return matches.length === 1 ? matches[0].company_id : null
  }
  function propose(o, pub, kind, patch, evidence) {
    const eligible = eligibility(o.payload)
    if (
      kind === 'create' &&
      (eligible.status === 'excluded' || o.payload.listed === false)
    )
      return
    if (kind === 'update' && !Object.keys(patch).length) return
    const queue =
      kind === 'create' && eligible.status !== 'eligible'
        ? 'eligibility'
        : ['close', 'reopen'].includes(kind)
          ? 'changes'
          : !source.last_complete_at
            ? 'baseline'
            : 'changes'
    candidates.push({
      id: randomUUID(),
      source_job_id: o.id,
      company_id: o.company_id,
      job_id: o.job_id,
      create_job_id: randomUUID(),
      kind,
      queue,
      base_revision: pub?.sync_revision ?? null,
      source_version: o.version,
      before_payload: pub ? sourceFacts(pub) : {},
      patch,
      dedupe_key: hash([
        o.id,
        kind,
        o.content_hash,
        o.state,
        source.revision,
        o.version
      ]),
      evidence: {
        ...evidence,
        source_url: source.url,
        source_revision: source.revision,
        checked_at: now,
        initial: !source.last_complete_at
      },
      eligibility: eligible
    })
  }
  for (const item of items) {
    const p = prior.get(item.external_id),
      facts = normalizeDraft(sourceFacts(item)),
      company = p?.company_id || chooseCompany(item)
    if (scopeCompany && company && company !== scopeCompany) continue
    let jobId = p?.job_id || null
    // Bind only a unique exact identity within the known company. Never a title match.
    if (!jobId && company) {
      const matches = published.filter(
        (j) =>
          j.company_id === company &&
          !used.has(j.job_id) &&
          canonicalUrl(j.url) &&
          canonicalUrl(j.url) === canonicalUrl(item.url)
      )
      if (matches.length === 1) {
        jobId = matches[0].job_id
        used.add(jobId)
      } else if (
        !matches.length &&
        ['greenhouse', 'ashby', 'lever', 'workable'].includes(source.adapter)
      ) {
        const matchesById = published.filter(
          (j) =>
            j.company_id === company &&
            !used.has(j.job_id) &&
            externalIdentity(j.url) === item.external_id
        )
        if (matchesById.length === 1) {
          jobId = matchesById[0].job_id
          used.add(jobId)
        }
      }
    }
    // A failed detail must not erase previously observed text or propose a partial update.
    const payload = item.detail_error
      ? { ...p?.payload, ...facts, detail_error: item.detail_error }
      : { ...facts, listed: item.listed }
    const digest = hash(payload),
      changed =
        !p ||
        p.content_hash !== digest ||
        p.state !== 'open' ||
        p.job_id !== jobId
    const o = {
      id: p?.id || randomUUID(),
      external_id: item.external_id,
      expected_version: p?.version ?? null,
      version: (p?.version || 0) + (changed ? 1 : 0),
      job_id: jobId,
      company_id: company,
      payload,
      content_hash: digest,
      state: 'open',
      last_seen_at: now,
      first_missing_at: null,
      missing_count: 0
    }
    observations.push(o)
    const pub = published.find((j) => j.job_id === jobId)
    if (
      item.detail_error ||
      !payload.description ||
      payload.description.length < 50
    )
      continue
    if (!pub)
      propose(o, null, 'create', sourceFacts(payload), {
        reason: '发现来源岗位；发布前请确认未与现有岗位重复'
      })
    else {
      const existing = pending.find(
        (c) => c.source_job_id === o.id && ['update', 'reopen'].includes(c.kind)
      )
      const comparison = existing
        ? existing.evidence?.comparison_base
        : p?.payload?._unverified
          ? null
          : p?.payload
      const patch = diffFacts(comparison, payload, pub)
      if (pub.status !== 'active' || pub.is_approved !== true)
        propose(o, pub, 'reopen', patch, {
          reason: '来源岗位当前开放；现有记录需重新审核发布',
          comparison_base: comparison ?? null
        })
      else
        propose(o, pub, 'update', patch, {
          reason:
            p && !p.payload?._unverified
              ? '来源字段发生变化'
              : '首次核对现有岗位与来源内容',
          comparison_base: comparison ?? null
        })
    }
  }
  if (source.capabilities?.absence) {
    const present = new Set(items.map((j) => j.external_id))
    for (const p of previous) {
      if (scopeCompany && p.company_id !== scopeCompany) continue
      if (present.has(p.external_id) || !p.job_id) continue
      const missing = quality.trusted
          ? nextMissing(p, now)
          : {
              first_missing_at: p.first_missing_at,
              missing_count: p.missing_count || 0,
              verify: false
            },
        pub = published.find((j) => j.job_id === p.job_id)
      let evidence = {
        state: 'unknown',
        reason: '等待第二次完整扫描及详情核实'
      }
      // A targeted, explicit closure is independent evidence. A failed detail is
      // unknown; only complete scans advance the separate disappearance counter.
      if (externalIdentity(p.payload.url) || missing.verify)
        evidence = await verify(p, { signal })
      if (
        evidence.state === 'closed' &&
        otherObservations.some(
          (other) =>
            other.job_id === p.job_id &&
            other.state === 'open' &&
            Date.parse(now) - Date.parse(other.last_seen_at) < 172800000
        )
      )
        evidence = {
          state: 'unknown',
          reason: '另一已启用来源近期仍确认此岗位开放，需人工核对来源归属'
        }
      checks.push({
        job_id: p.job_id,
        url: p.payload.url,
        ...evidence,
        missing_count: missing.missing_count
      })
      // A surviving detail contradicts missing-list evidence; unknown is never a closure.
      const closed = evidence.state === 'closed',
        o = {
          ...p,
          expected_version: p.version,
          version: p.version + (closed && p.state !== 'closed' ? 1 : 0),
          state: closed ? 'closed' : p.state,
          first_missing_at: missing.first_missing_at,
          missing_count: missing.missing_count
        }
      observations.push(o)
      if (closed && pub?.status === 'active')
        propose(
          o,
          pub,
          'close',
          {},
          {
            ...evidence,
            missing_count: missing.missing_count,
            first_missing_at: missing.first_missing_at
          }
        )
    }
  }
  return {
    observations,
    candidates,
    result: {
      status: quality.trusted ? 'complete' : 'partial',
      trusted_complete: quality.trusted,
      error: quality.reason || run.evidence?.partial || null,
      count: items.length,
      checks
    }
  }
}
