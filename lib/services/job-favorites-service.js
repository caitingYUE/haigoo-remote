import neonHelper from '../../server-utils/dal/neon-helper.js'

let snapshotColumns = null
let schemaPending = null
let schemaExpiresAt = 0

async function supportsSnapshots() {
  if (snapshotColumns !== null && Date.now() < schemaExpiresAt) return snapshotColumns
  if (!schemaPending) schemaPending = (async () => {
    const rows = await neonHelper.query(`SELECT attname FROM pg_attribute
      WHERE attrelid = 'favorites'::regclass AND NOT attisdropped
        AND attname IN ('job_title_snapshot', 'company_name_snapshot')`)
    snapshotColumns = rows?.length === 2
    schemaExpiresAt = Date.now() + 5 * 60 * 1000
    return snapshotColumns
  })()
  try { return await schemaPending } finally { schemaPending = null }
}

// Website and mini program write the same user/job pair. Older databases may
// lack optional snapshot columns; never make the favorite depend on them.
export async function saveJobFavorite(userId, jobId, snapshot = {}) {
  const withSnapshot = await supportsSnapshots()
  await neonHelper.query(
    withSnapshot
      ? `INSERT INTO favorites (user_id, job_id, job_title_snapshot, company_name_snapshot, created_at)
         VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id, job_id) DO NOTHING`
      : `INSERT INTO favorites (user_id, job_id, created_at)
         VALUES ($1, $2, NOW()) ON CONFLICT (user_id, job_id) DO NOTHING`,
    withSnapshot ? [userId, jobId, snapshot.title || '', snapshot.company || ''] : [userId, jobId]
  )
}

export async function readJobFavorites(userId) {
  // Access optional fields as JSON so both historical schemas are readable.
  return neonHelper.query(`SELECT f.job_id, f.created_at,
      to_jsonb(f)->>'job_title_snapshot' AS job_title_snapshot,
      to_jsonb(f)->>'company_name_snapshot' AS company_name_snapshot
    FROM favorites f WHERE f.user_id = $1
      AND f.created_at > NOW() - INTERVAL '1 year'
    ORDER BY f.created_at DESC, f.job_id`, [userId])
}
