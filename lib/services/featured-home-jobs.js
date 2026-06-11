import { buildDailyFeaturedSelection } from './featured-home-selection.js'

function dedupeJobsById(rows = []) {
  const seen = new Set()
  const output = []

  for (const row of rows) {
    const jobId = row?.job_id || row?.jobId
    if (!jobId || seen.has(jobId)) continue
    seen.add(jobId)
    output.push(row)
  }

  return output
}

function buildFeaturedHomeBaseSelect(jobsTable = 'jobs') {
  return `
    SELECT
      j.job_id,
      j.title,
      j.company,
      j.company_id,
      j.location,
      j.region,
      j.salary,
      j.url,
      j.source,
      j.tags,
      j.status,
      j.is_remote,
      j.category,
      j.job_type,
      j.experience_level,
      j.is_trusted,
      j.can_refer,
      j.member_only,
      j.is_featured,
      j.featured_reason,
      j.published_at,
      j.created_at,
      j.updated_at,
      tc.website as trusted_website,
      tc.logo as trusted_logo,
      tc.cached_logo_url as trusted_cached_logo_url,
      tc.logo_cache_status as trusted_logo_cache_status,
      tc.logo_cache_hash as trusted_logo_cache_hash,
      tc.industry as trusted_industry,
      tc.address as trusted_address,
      tc.description as trusted_description,
      tc.translations as trusted_translations,
      tc.company_rating as trusted_company_rating,
      tc.rating_source as trusted_rating_source,
      tc.hiring_email as trusted_hiring_email,
      tc.email_type as trusted_email_type
    FROM ${jobsTable} j
    INNER JOIN trusted_companies tc ON j.company_id = tc.company_id
    WHERE j.status = 'active'
      AND j.is_approved = true
      AND j.company_id IS NOT NULL
  `
}

export async function getFeaturedHomeSelectedJobs({
  neonHelper,
  jobsTable = 'jobs',
  limit = 6,
  candidateLimit = 100
}) {
  const featuredQuery = `
    ${buildFeaturedHomeBaseSelect(jobsTable)}
      AND j.is_featured = true
      AND (
        j.published_at > NOW() - INTERVAL '7 days'
        OR j.updated_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY COALESCE(j.updated_at, j.published_at, j.created_at) DESC
    LIMIT ${candidateLimit}
  `

  const featuredRows = dedupeJobsById(await neonHelper.query(featuredQuery) || [])
  const pinnedRows = featuredRows.filter((row) => {
    const updatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : 0
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false
    return Date.now() - updatedAt <= 24 * 60 * 60 * 1000
  })
  const featuredSelection = buildDailyFeaturedSelection(featuredRows, limit, {
    pinnedItems: pinnedRows,
    pinnedLimit: Math.min(pinnedRows.length, 2)
  })
  if (featuredSelection.length >= limit) {
    return featuredSelection
  }

  const fallbackQuery = `
    ${buildFeaturedHomeBaseSelect(jobsTable)}
      AND COALESCE(j.is_featured, false) = false
      AND j.published_at > NOW() - INTERVAL '7 days'
    ORDER BY COALESCE(j.published_at, j.updated_at, j.created_at) DESC
    LIMIT ${candidateLimit}
  `

  const fallbackRows = dedupeJobsById(await neonHelper.query(fallbackQuery) || [])
  const mergedRows = dedupeJobsById([...featuredRows, ...fallbackRows])

  if (mergedRows.length >= limit) {
    return buildDailyFeaturedSelection(mergedRows, limit, {
      pinnedItems: pinnedRows,
      pinnedLimit: Math.min(pinnedRows.length, 2)
    })
  }

  const extendedFallbackQuery = `
    ${buildFeaturedHomeBaseSelect(jobsTable)}
      AND COALESCE(j.is_featured, false) = false
      AND j.published_at > NOW() - INTERVAL '30 days'
    ORDER BY COALESCE(j.published_at, j.updated_at, j.created_at) DESC
    LIMIT ${candidateLimit}
  `

  const extendedFallbackRows = dedupeJobsById(await neonHelper.query(extendedFallbackQuery) || [])
  return buildDailyFeaturedSelection(dedupeJobsById([...mergedRows, ...extendedFallbackRows]), limit, {
    pinnedItems: pinnedRows,
    pinnedLimit: Math.min(pinnedRows.length, 2)
  })
}
