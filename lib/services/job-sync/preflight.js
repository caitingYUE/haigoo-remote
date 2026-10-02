import { db } from './store.js'
import { scanCompleteness } from './policy.js'

export function assessPreflight(source, items, evidence) {
  const quality = scanCompleteness({
    complete: evidence.list_complete === true && !evidence.partial,
    count: items.length,
    previousCount: source.complete_count
  })
  const incomplete = items.filter(
    (j) =>
      j.detail_error ||
      !j.title ||
      !j.url ||
      !j.external_id ||
      !j.description ||
      j.description.length < 50
  ).length
  const duplicate =
    new Set(items.map((j) => j.external_id)).size !== items.length
  const totalMismatch =
    evidence.total != null && Number(evidence.total) !== items.length
  const passed = quality.trusted && !incomplete && !duplicate && !totalMismatch
  return {
    ...evidence,
    preflight_passed: passed,
    trusted_complete: false,
    count: items.length,
    incomplete_details: incomplete,
    error: passed
      ? null
      : quality.reason ||
        evidence.partial ||
        (duplicate
          ? '岗位身份重复'
          : totalMismatch
            ? '数量与来源总数不一致'
            : `${incomplete} 条岗位详情不完整`),
    samples: items
      .slice(0, 5)
      .map((j) => ({
        title: j.title,
        url: j.url,
        description_length: j.description?.length || 0
      }))
  }
}

export async function finishPreflight(run, source, items, evidence) {
  const report = assessPreflight(source, items, evidence)
  const rows = await db(
    `UPDATE job_sync_runs r SET status=$3,evidence=$4,error=$5,preflight_at=NOW(),finished_at=NOW(),lease_token=NULL,lease_until=NULL
    FROM job_sync_sources s WHERE r.id=$1 AND r.source_id=s.id AND r.lease_token=$2 AND r.lease_until>NOW() AND r.mode='preflight' AND r.status='running' AND s.enabled AND s.revision=r.source_revision RETURNING r.id`,
    [
      run.id,
      run.lease_token,
      report.preflight_passed ? 'complete' : 'partial',
      JSON.stringify(report),
      report.error
    ]
  )
  if (!rows.length) throw new Error('PREFLIGHT_CONFLICT')
  return { status: report.preflight_passed ? 'complete' : 'partial', ...report }
}
