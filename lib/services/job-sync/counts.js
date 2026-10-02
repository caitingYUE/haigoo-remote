import { db } from './store.js'

export async function companyReviewCounts(companyIds, query = db) {
  if (!companyIds.length) return {}
  const [schema] = await query(
    "SELECT to_regclass('public.job_sync_candidates') AS candidates, to_regclass('public.job_crawl_items') AS manual_items"
  )
  const candidates = schema?.manual_items
    ? `UNION SELECT i.company_id,i.job_id AS item FROM job_crawl_items i JOIN jobs j ON j.job_id=i.job_id
       WHERE i.status IN ('draft','pending') AND j.status='active' AND j.crawl_deleted_at IS NULL
       AND (j.is_approved IS NOT TRUE OR (i.status='draft' AND i.kind<>'create')) AND i.company_id=ANY($1::text[])`
    : schema?.candidates
    ? `UNION SELECT company_id,COALESCE(job_id,'candidate:'||COALESCE(source_job_id,id)) AS item FROM job_sync_candidates WHERE status='pending' AND company_id=ANY($1::text[])`
    : ''
  const rows = await query(
    `SELECT company_id,COUNT(*)::integer AS count FROM (
    SELECT company_id,job_id AS item FROM jobs WHERE company_id=ANY($1::text[]) AND status='active' AND is_approved IS NOT TRUE
    ${candidates}) pending GROUP BY company_id`,
    [companyIds]
  )
  return Object.fromEntries(rows.map((r) => [r.company_id, Number(r.count)]))
}

// The simplified page counts real manually editable jobs only. Legacy crawl
// proposals remain in history and must not inflate the ordinary jobs modal.
export async function companyRecordedPendingCounts(companyIds, query = db) {
  if (!companyIds.length) return {}
  const rows = await query(`SELECT company_id,COUNT(*)::integer AS count FROM jobs j WHERE company_id=ANY($1::text[]) AND status='active' AND is_approved IS NOT TRUE AND (to_jsonb(j)->>'crawl_deleted_at') IS NULL GROUP BY company_id`, [companyIds])
  return Object.fromEntries(rows.map(r => [r.company_id, Number(r.count)]))
}
