import { randomUUID } from 'node:crypto'
import { db } from './store.js'
import { canonicalUrl, externalIdentity, hash } from './policy.js'
import { verifyPosting } from './adapters.js'

// A generic form/email/home page cannot establish the state of a particular role.
export function postingIdentity(url) {
  const known = externalIdentity(url)
  if (known) return known
  try {
    const u = new URL(url)
    if (
      (/\/(?:jobs?|careers?|positions|postings|vacancies|o)\/(?!join(?:\/|$)|search(?:\/|$)|vacancy-apply|vacancy-search)[^/]+/i.test(
        u.pathname
      ) || /\/[a-f0-9]{32}\/job\/?$/i.test(u.pathname)) &&
      !/forms\.|docs\.|linkedin\.com/i.test(u.hostname)
    )
      return canonicalUrl(url)
  } catch {
    /* Invalid links are unknown. */
  }
  return null
}

export async function checkExistingUrls({
  companyId = '',
  limit = 10,
  verify = verifyPosting,
  budgetMs = 150000
} = {}) {
  const jobs = await db(
    `SELECT j.* FROM jobs j JOIN trusted_companies co ON co.company_id=j.company_id AND co.status='active'
    LEFT JOIN job_sync_url_checks ck ON ck.job_id=j.job_id
    WHERE j.status='active' AND length(COALESCE(j.description,''))>=50 AND j.url ~ '^https?://' AND ($1='' OR j.company_id=$1)
    AND ($1<>'' OR ck.job_id IS NULL OR ck.job_revision IS DISTINCT FROM j.sync_revision OR ck.checked_at<NOW()-INTERVAL '24 hours')
    ORDER BY CASE WHEN ck.job_revision IS DISTINCT FROM j.sync_revision THEN 0 ELSE 1 END,ck.checked_at NULLS FIRST,j.job_id LIMIT $2`,
    [companyId, Math.min(100, Math.max(1, limit))]
  )
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), budgetMs)
  const results = []
  try {
    for (const job of jobs) {
      if (controller.signal.aborted) break
      const identity = postingIdentity(job.url)
      const result = identity
        ? await verify(
            {
              external_id: identity,
              payload: { url: job.url, title: job.title }
            },
            { signal: controller.signal }
          )
        : {
            state: 'unknown',
            reason: '通用表单、邮箱或无法确定岗位身份，需人工核实'
          }
      if (controller.signal.aborted) break
      await db('SELECT record_job_sync_url_check($1,$2,$3,$4,$5,$6,$7)', [
        job.job_id,
        job.sync_revision,
        job.url,
        result.state,
        result.reason,
        randomUUID(),
        hash(['url-check', job.job_id, job.sync_revision, job.url])
      ])
      results.push({ jobId: job.job_id, ...result })
    }
  } finally {
    clearTimeout(timer)
  }
  return { checked: results.length, results }
}
