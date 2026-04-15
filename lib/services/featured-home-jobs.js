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
      j.*,
      tc.website as trusted_website,
      tc.logo as trusted_logo,
      tc.industry as trusted_industry,
      tc.hiring_email as trusted_hiring_email,
      tc.email_type as trusted_email_type
    FROM ${jobsTable} j
    INNER JOIN trusted_companies tc ON j.company_id = tc.company_id
    WHERE j.status = 'active'
      AND j.is_approved = true
      AND j.company_id IS NOT NULL
      AND j.published_at > NOW() - INTERVAL '30 days'
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
    ORDER BY j.published_at DESC
    LIMIT ${candidateLimit}
  `

  const featuredRows = dedupeJobsById(await neonHelper.query(featuredQuery) || [])
  const featuredSelection = buildDailyFeaturedSelection(featuredRows, limit)
  if (featuredSelection.length >= limit) {
    return featuredSelection
  }

  const fallbackQuery = `
    ${buildFeaturedHomeBaseSelect(jobsTable)}
      AND COALESCE(j.is_featured, false) = false
    ORDER BY j.published_at DESC
    LIMIT ${candidateLimit}
  `

  const fallbackRows = dedupeJobsById(await neonHelper.query(fallbackQuery) || [])
  const mergedRows = dedupeJobsById([...featuredRows, ...fallbackRows])

  return buildDailyFeaturedSelection(mergedRows, limit)
}
