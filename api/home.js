import neonHelper from '../server-utils/dal/neon-helper.js'
import { getFeaturedHomeSelectedJobs } from '../lib/services/featured-home-jobs.js'
import { resolveCachedLogoUrlFromRow } from '../lib/services/company-image-asset-service.js'
import { getPreviewFeaturedJobs, getPreviewFeaturedCompaniesResponse } from '../lib/dev-preview-data.js'

const JOBS_TABLE = 'jobs'
const NEON_CONFIGURED = !!neonHelper?.isConfigured

function isLocalPreviewRequest(req) {
  const host = String(req?.headers?.host || req?.headers?.['x-forwarded-host'] || '').toLowerCase()
  return host.includes('localhost') || host.includes('127.0.0.1')
}

function mapHomeJob(row = {}) {
  return {
    id: row.job_id,
    title: row.title,
    company: row.company,
    companyId: row.company_id,
    logo: row.company_logo || row.logo || row.trusted_logo || '',
    cachedLogoUrl: resolveCachedLogoUrlFromRow(row),
    location: row.location,
    region: row.region,
    salary: row.salary,
    url: row.url,
    sourceUrl: row.url,
    source: row.source,
    tags: row.tags || [],
    status: row.status,
    isRemote: row.is_remote,
    category: row.category,
    jobType: row.job_type,
    type: row.job_type,
    experienceLevel: row.experience_level,
    isTrusted: row.is_trusted,
    canRefer: row.can_refer,
    memberOnly: Boolean(row.member_only),
    isFeatured: row.is_featured,
    featuredReason: row.featured_reason,
    companyIndustry: row.company_industry || row.trusted_industry,
    companyWebsite: row.company_website || row.trusted_website,
    companyAddress: row.company_address || row.trusted_address,
    companyRating: row.company_rating || row.trusted_company_rating,
    ratingSource: row.rating_source || row.trusted_rating_source,
    publishedAt: row.published_at,
    createdAt: row.created_at
  }
}

function mapHomeCompany(row = {}) {
  return {
    id: row.company_id,
    name: row.name,
    website: row.website,
    careersPage: row.careers_page,
    linkedin: row.linkedin,
    description: row.description,
    logo: row.logo,
    cachedLogoUrl: resolveCachedLogoUrlFromRow(row),
    coverImage: '',
    industry: row.industry,
    tags: row.tags || [],
    source: row.source,
    jobCount: parseInt(row.approved_job_count || '0', 10),
    canRefer: row.can_refer || false,
    memberOnly: row.member_only || false,
    lastCrawledAt: row.last_crawled_at,
    translations: row.translations,
    address: row.address,
    employeeCount: row.employee_count,
    foundedYear: row.founded_year,
    specialties: row.specialties || [],
    companyRating: row.company_rating,
    ratingSource: row.rating_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getHomeFeaturedJobs(req, res) {
  if (!NEON_CONFIGURED) {
    if (isLocalPreviewRequest(req)) return res.status(200).json({ jobs: getPreviewFeaturedJobs(6) })
    return res.status(503).json({ error: 'Database not configured' })
  }

  const selectedRows = await getFeaturedHomeSelectedJobs({
    neonHelper,
    jobsTable: JOBS_TABLE,
    limit: 6
  })

  return res.status(200).json({ jobs: (selectedRows || []).map(mapHomeJob) })
}

async function getHomeTickerJobs(req, res) {
  const requestedLimit = Number.parseInt(String(req.query?.limit || '48'), 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 12), 48) : 48

  if (!NEON_CONFIGURED) {
    if (isLocalPreviewRequest(req)) return res.status(200).json({ jobs: getPreviewFeaturedJobs(Math.min(limit, 16)) })
    return res.status(503).json({ error: 'Database not configured' })
  }

  const rows = await neonHelper.query(`
    SELECT
      j.job_id,
      j.title,
      j.company,
      j.company_id,
      tc.logo as trusted_logo,
      tc.cached_logo_url as trusted_cached_logo_url,
      tc.logo_cache_status as trusted_logo_cache_status,
      tc.logo_cache_hash as trusted_logo_cache_hash,
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
      j.created_at
    FROM ${JOBS_TABLE} j
    LEFT JOIN trusted_companies tc ON j.company_id = tc.company_id
    WHERE j.status = 'active'
      AND COALESCE(j.is_approved, false) = true
    ORDER BY j.published_at DESC NULLS LAST, j.created_at DESC NULLS LAST
    LIMIT $1
  `, [limit])

  return res.status(200).json({ jobs: (rows || []).map(mapHomeJob) })
}

async function getHomeFeaturedCompanies(req, res) {
  if (!NEON_CONFIGURED) {
    if (isLocalPreviewRequest(req)) return res.status(200).json(getPreviewFeaturedCompaniesResponse())
    return res.status(503).json({ error: 'Database not configured' })
  }

  const selectedRows = await getFeaturedHomeSelectedJobs({
    neonHelper,
    jobsTable: JOBS_TABLE,
    limit: 6
  })
  const uniqueCompanyIds = []
  for (const row of selectedRows || []) {
    const companyId = row?.company_id || row?.companyId
    if (!companyId || uniqueCompanyIds.includes(companyId)) continue
    uniqueCompanyIds.push(companyId)
    if (uniqueCompanyIds.length >= 6) break
  }

  if (uniqueCompanyIds.length === 0) return res.status(200).json({ companies: [], stats: {} })

  const placeholders = uniqueCompanyIds.map((_, index) => `$${index + 1}`).join(',')
  const companyRows = await neonHelper.query(`
    SELECT tc.*, j_agg.approved_job_count
    FROM trusted_companies tc
    INNER JOIN (
      SELECT company_id, COUNT(*) AS approved_job_count
      FROM jobs
      WHERE status = 'active' AND is_approved = true
      GROUP BY company_id
    ) j_agg ON tc.company_id = j_agg.company_id
    WHERE tc.company_id IN (${placeholders})
  `, uniqueCompanyIds)

  const orderedRows = uniqueCompanyIds
    .map((id) => (companyRows || []).find((row) => row.company_id === id))
    .filter(Boolean)
  const companies = orderedRows.map(mapHomeCompany)

  const statsRows = await neonHelper.query(`
    SELECT company_id, category, COUNT(*) as count
    FROM jobs
    WHERE company_id IN (${placeholders}) AND status = 'active' AND is_approved = true
    GROUP BY company_id, category
  `, uniqueCompanyIds)

  const statsById = {}
  for (const row of statsRows || []) {
    if (!statsById[row.company_id]) statsById[row.company_id] = { total: 0, categories: {} }
    const count = parseInt(row.count || '0', 10)
    statsById[row.company_id].total += count
    const category = row.category || '其他'
    statsById[row.company_id].categories[category] = (statsById[row.company_id].categories[category] || 0) + count
  }

  const stats = {}
  for (const company of companies) {
    if (statsById[company.id]) stats[company.name] = statsById[company.id]
  }

  return res.status(200).json({ companies, stats })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const action = String(req.query?.action || '').trim()
    if (action === 'featured_jobs') return await getHomeFeaturedJobs(req, res)
    if (action === 'ticker_jobs') return await getHomeTickerJobs(req, res)
    if (action === 'featured_companies') return await getHomeFeaturedCompanies(req, res)
    return res.status(400).json({ error: 'Unsupported home action' })
  } catch (error) {
    console.error('[home-api] request failed:', error)
    return res.status(500).json({ error: 'Failed to fetch home data' })
  }
}
