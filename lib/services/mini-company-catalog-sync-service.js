import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'

const MAX_PAGE_SIZE = 250
const MAX_COMPANIES = 5000
const MAX_JOBS = 20000
const MAX_CATALOG_REMOVAL_RATIO = 0.2
const PUBLIC_COMPANY_KEYS = new Set([
  'id', 'companyId', 'name', 'translations', 'description', 'industry', 'tags',
  'specialties', 'address', 'employeeCount', 'foundedYear', 'rating', 'ratingSource',
  'logo', 'website', 'careersPage', 'hiringEmail'
])
const PUBLIC_JOB_KEYS = new Set([
  'id', 'jobId', 'companyId', 'title', 'translations', 'description', 'category',
  'roleFamilies', 'tags', 'industry', 'experienceLevel', 'location', 'timezone',
  'url', 'sourceUrl', 'hiringEmail', 'publishedAt', 'sourcePublishedAt',
  'firstSeenAt', 'source', 'status', 'isApproved', 'memberOnly'
])
const FORBIDDEN_KEYS = new Set([
  'referralContacts', 'referral_contacts', 'contacts', 'users', 'orders', 'payments',
  'password', 'passwordHash', 'password_hash', 'openid', 'sessionToken', 'accessToken'
])
const SNAPSHOT_KEYS = new Set(['version', 'generatedAt', 'page', 'pageSize', 'totalCompanies', 'totalJobs', 'companies', 'jobs'])

const text = (value, max = 20000) => String(value ?? '').trim().slice(0, max)
const safeUrl = (value) => {
  const candidate = text(value, 2048)
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}
const safeEmail = (value) => {
  const candidate = text(value, 320).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : ''
}
const safeTimestamp = (value) => {
  if (value == null || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}
const safeArray = (value, max = 50) => Array.isArray(value) ? value.map((item) => text(item, 255)).filter(Boolean).slice(0, max) : []
const safeJson = (value, fallback = {}) => value && typeof value === 'object' && !Array.isArray(value) ? value : fallback

function assertNoPrivateKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrivateKeys(item)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`private field ${key} is not allowed in catalog`)
    assertNoPrivateKeys(nested)
  }
}

function assertPublicObject(value, label, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  assertNoPrivateKeys(value)
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`private field ${key} is not allowed in catalog`)
    if (!allowedKeys.has(key)) throw new Error(`unsupported ${label} field ${key}`)
  }
}

function normalizeCompany(input) {
  assertPublicObject(input, 'company', PUBLIC_COMPANY_KEYS)
  const id = text(input.id || input.companyId, 255)
  const name = text(input.name, 255)
  if (!id || !name) throw new Error('catalog company requires id and name')
  return {
    id,
    name,
    translations: safeJson(input.translations),
    description: text(input.description),
    industry: text(input.industry, 255),
    tags: safeArray(input.tags, 24),
    specialties: safeArray(input.specialties, 24),
    address: text(input.address, 500),
    employeeCount: text(input.employeeCount, 100),
    foundedYear: text(input.foundedYear, 20),
    rating: Number.isFinite(Number(input.rating)) ? Number(input.rating) : null,
    ratingSource: text(input.ratingSource, 100),
    logo: safeUrl(input.logo),
    website: safeUrl(input.website),
    careersPage: safeUrl(input.careersPage),
    hiringEmail: safeEmail(input.hiringEmail)
  }
}

function normalizeJob(input, companyIds) {
  assertPublicObject(input, 'job', PUBLIC_JOB_KEYS)
  const id = text(input.id || input.jobId, 255)
  const companyId = text(input.companyId, 255)
  const title = text(input.title, 255)
  const status = text(input.status, 32).toLowerCase()
  const isApproved = input.isApproved === true
  const memberOnly = input.memberOnly === true
  const url = safeUrl(input.url || input.sourceUrl)
  const hiringEmail = safeEmail(input.hiringEmail)
  if (!id || !companyId || !companyIds.has(companyId) || !title) throw new Error('catalog job references a missing company or has no title')
  if (status !== 'active' || !isApproved || memberOnly) throw new Error(`job ${id} must be an approved public active job`)
  if (!url && !hiringEmail) throw new Error(`job ${id} has no public application method`)
  return {
    id,
    companyId,
    title,
    translations: safeJson(input.translations),
    description: text(input.description),
    category: text(input.category, 255),
    roleFamilies: safeArray(input.roleFamilies, 12),
    tags: safeArray(input.tags, 40),
    industry: text(input.industry, 255),
    experienceLevel: text(input.experienceLevel, 100),
    location: text(input.location, 255),
    timezone: text(input.timezone, 100),
    url,
    hiringEmail,
    publishedAt: safeTimestamp(input.publishedAt || input.sourcePublishedAt),
    firstSeenAt: safeTimestamp(input.firstSeenAt),
    source: text(input.source, 100) || 'formal_catalog',
    status,
    isApproved,
    memberOnly
  }
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function validateCompanyCatalogSnapshot(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('catalog snapshot must be an object')
  assertNoPrivateKeys(payload)
  for (const key of Object.keys(payload)) if (FORBIDDEN_KEYS.has(key)) throw new Error(`private field ${key} is not allowed in catalog`)
  for (const key of Object.keys(payload)) if (!SNAPSHOT_KEYS.has(key)) throw new Error(`unsupported catalog field ${key}`)
  const companies = Array.isArray(payload.companies) ? payload.companies.map(normalizeCompany) : []
  const companyIds = new Set(companies.map((company) => company.id))
  if (companyIds.size !== companies.length) throw new Error('catalog contains duplicate company ids')
  const jobs = Array.isArray(payload.jobs) ? payload.jobs.map((job) => normalizeJob(job, companyIds)) : []
  const jobIds = new Set(jobs.map((job) => job.id))
  if (jobIds.size !== jobs.length) throw new Error('catalog contains duplicate job ids')
  if (companies.length > MAX_COMPANIES || jobs.length > MAX_JOBS) throw new Error('catalog exceeds safety limits')
  if (payload.totalCompanies != null && Number(payload.totalCompanies) !== companies.length) throw new Error('catalog company count mismatch')
  if (payload.totalJobs != null && Number(payload.totalJobs) !== jobs.length) throw new Error('catalog job count mismatch')
  return {
    version: text(payload.version, 128) || stableHash({ companies, jobs }).slice(0, 32),
    generatedAt: text(payload.generatedAt, 80) || new Date().toISOString(),
    page: Math.max(1, Number(payload.page) || 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Number(payload.pageSize) || companies.length || 1)),
    totalCompanies: companies.length,
    totalJobs: jobs.length,
    companies,
    jobs
  }
}

function queryClient(client) {
  return client || neonHelper
}

const catalogRowsSql = `
  WITH eligible AS (
    SELECT tc.company_id, tc.name, tc.translations, tc.description, tc.industry, tc.tags,
           tc.specialties, tc.address, tc.employee_count, tc.founded_year, tc.company_rating,
           tc.rating_source, tc.logo, tc.website, tc.careers_page, tc.hiring_email,
           j.job_id, j.title, j.translations AS job_translations, j.description AS job_description,
           j.category, j.tags AS job_tags, j.industry AS job_industry, j.experience_level,
           j.location, j.timezone, j.url, j.published_at, j.source,
           COALESCE(h.first_seen_at, j.created_at, j.updated_at, NOW()) AS first_seen_at,
           h.source_published_at
      FROM trusted_companies tc
      JOIN jobs j ON j.company_id = tc.company_id
       AND j.status = 'active' AND j.is_approved IS TRUE AND COALESCE(j.member_only, FALSE) IS FALSE
       AND (NULLIF(BTRIM(j.url), '') ~* '^https?://[^[:space:]]+$'
         OR NULLIF(BTRIM(tc.hiring_email), '') ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')
      LEFT JOIN company_job_history h ON h.company_id = tc.company_id
       AND h.source_job_id = j.job_id AND h.closed_at IS NULL AND h.is_public_opportunity IS TRUE
     WHERE tc.status = 'active'
  ), company_page AS (
    SELECT company_id FROM eligible GROUP BY company_id
    ORDER BY MAX(first_seen_at) DESC NULLS LAST, MIN(name) ASC, company_id ASC
    LIMIT $1 OFFSET $2
  )
  SELECT eligible.* FROM eligible JOIN company_page USING (company_id)
  ORDER BY eligible.company_id, eligible.first_seen_at DESC NULLS LAST, eligible.job_id`

export async function readPublicCompanyCatalogPage({ page = 1, pageSize = 100, client = null } = {}) {
  const sql = queryClient(client)
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 100))
  const [rows, countRows] = await Promise.all([
    sql.query(catalogRowsSql, [safePageSize, (safePage - 1) * safePageSize]),
    sql.query(`SELECT COUNT(DISTINCT tc.company_id)::int AS total_companies, COUNT(*)::int AS total_jobs,
                      MAX(GREATEST(COALESCE(h.updated_at, '-infinity'::timestamptz), COALESCE(j.updated_at, '-infinity'::timestamptz), COALESCE(h.first_seen_at, '-infinity'::timestamptz))) AS latest_source_change
                 FROM trusted_companies tc JOIN jobs j ON j.company_id = tc.company_id
                  AND j.status = 'active' AND j.is_approved IS TRUE AND COALESCE(j.member_only, FALSE) IS FALSE
                  AND (NULLIF(BTRIM(j.url), '') ~* '^https?://[^[:space:]]+$' OR NULLIF(BTRIM(tc.hiring_email), '') ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')
                 LEFT JOIN company_job_history h ON h.company_id = tc.company_id AND h.source_job_id = j.job_id
                  AND h.closed_at IS NULL AND h.is_public_opportunity IS TRUE
                WHERE tc.status = 'active'`)
  ])
  const groups = new Map()
  for (const row of rows || []) {
    if (!groups.has(row.company_id)) groups.set(row.company_id, {
      id: text(row.company_id, 255), name: text(row.name, 255), translations: safeJson(row.translations),
      description: text(row.description), industry: text(row.industry, 255), tags: safeArray(row.tags, 24),
      specialties: safeArray(row.specialties, 24), address: text(row.address, 500), employeeCount: text(row.employee_count, 100),
      foundedYear: text(row.founded_year, 20), rating: Number.isFinite(Number(row.company_rating)) ? Number(row.company_rating) : null,
      ratingSource: text(row.rating_source, 100), logo: safeUrl(row.logo), website: safeUrl(row.website), careersPage: safeUrl(row.careers_page),
      hiringEmail: safeEmail(row.hiring_email)
    })
  }
  const jobs = (rows || []).map((row) => ({
    id: text(row.job_id, 255), companyId: text(row.company_id, 255), title: text(row.title, 255),
    translations: safeJson(row.job_translations), description: text(row.job_description), category: text(row.category, 255),
    tags: safeArray(row.job_tags, 40), industry: text(row.job_industry, 255), experienceLevel: text(row.experience_level, 100),
    location: text(row.location, 255), timezone: text(row.timezone, 100), url: safeUrl(row.url),
    hiringEmail: safeEmail(row.hiring_email), publishedAt: row.source_published_at || row.published_at || null,
    firstSeenAt: row.first_seen_at || null, source: text(row.source, 100), status: 'active', isApproved: true, memberOnly: false
  }))
  const totals = countRows?.[0] || {}
  const totalCompanies = Number(totals.total_companies || 0)
  const totalJobs = Number(totals.total_jobs || 0)
  // The version is deliberately page-independent. CloudRun can therefore
  // detect a source changing halfway through a full read instead of treating
  // each page as a separate catalog.
  const version = stableHash({ totalCompanies, totalJobs, latestSourceChange: totals.latest_source_change || null }).slice(0, 32)
  return {
    version,
    generatedAt: new Date().toISOString(),
    page: safePage,
    pageSize: safePageSize,
    totalCompanies,
    totalJobs,
    hasMore: safePage * safePageSize < totalCompanies,
    companies: [...groups.values()],
    jobs
  }
}

function statement(text, params) { return { text, params } }

export async function applyPreviewCompanyCatalogSnapshot(payload, { allowImport = false, client = null, environment = process.env } = {}) {
  if (String(environment.VERCEL_ENV || '') !== 'preview') throw new Error('catalog import is Preview-only')
  if (!allowImport || String(environment.MINI_ALLOW_CATALOG_IMPORT || '').toLowerCase() !== 'true') throw new Error('catalog import is disabled')
  const snapshot = validateCompanyCatalogSnapshot(payload)
  if (!snapshot.companies.length && !snapshot.jobs.length) throw new Error('empty catalog snapshot is not importable')
  const sql = client || neonHelper.getClient()
  if (!sql || typeof sql.transaction !== 'function' || typeof sql.query !== 'function') throw new Error('Neon transaction client unavailable')
  const existingProjectionRows = await sql.query(
    `SELECT COUNT(*)::int AS projection_jobs FROM jobs WHERE source_type = 'mini_catalog_projection'`,
    []
  )
  const existingProjectionJobs = Number(existingProjectionRows?.[0]?.projection_jobs || 0)
  if (existingProjectionJobs > 0 && snapshot.jobs.length < Math.ceil(existingProjectionJobs * (1 - MAX_CATALOG_REMOVAL_RATIO))) {
    throw new Error(`catalog removal ratio exceeds ${Math.round(MAX_CATALOG_REMOVAL_RATIO * 100)}% safety limit`)
  }
  const statements = []
  for (const company of snapshot.companies) statements.push(statement(`
    INSERT INTO trusted_companies (company_id, name, translations, description, industry, tags, specialties, address, employee_count, founded_year, company_rating, rating_source, logo, website, careers_page, hiring_email, status, updated_at)
    VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', NOW())
    ON CONFLICT (company_id) DO UPDATE SET name=EXCLUDED.name, translations=CASE WHEN EXCLUDED.translations='{}'::jsonb THEN trusted_companies.translations ELSE EXCLUDED.translations END, description=COALESCE(NULLIF(EXCLUDED.description, ''), trusted_companies.description), industry=COALESCE(NULLIF(EXCLUDED.industry, ''), trusted_companies.industry), tags=CASE WHEN EXCLUDED.tags='[]'::jsonb THEN trusted_companies.tags ELSE EXCLUDED.tags END, specialties=CASE WHEN EXCLUDED.specialties='[]'::jsonb THEN trusted_companies.specialties ELSE EXCLUDED.specialties END, address=COALESCE(NULLIF(EXCLUDED.address, ''), trusted_companies.address), employee_count=COALESCE(NULLIF(EXCLUDED.employee_count, ''), trusted_companies.employee_count), founded_year=COALESCE(NULLIF(EXCLUDED.founded_year, ''), trusted_companies.founded_year), company_rating=COALESCE(EXCLUDED.company_rating, trusted_companies.company_rating), rating_source=COALESCE(NULLIF(EXCLUDED.rating_source, ''), trusted_companies.rating_source), logo=COALESCE(NULLIF(EXCLUDED.logo, ''), trusted_companies.logo), website=COALESCE(NULLIF(EXCLUDED.website, ''), trusted_companies.website), careers_page=COALESCE(NULLIF(EXCLUDED.careers_page, ''), trusted_companies.careers_page), hiring_email=COALESCE(EXCLUDED.hiring_email, trusted_companies.hiring_email), status='active', updated_at=NOW()`, [company.id, company.name, JSON.stringify(company.translations), company.description, company.industry, JSON.stringify(company.tags), JSON.stringify(company.specialties), company.address, company.employeeCount, company.foundedYear, company.rating, company.ratingSource, company.logo, company.website, company.careersPage, company.hiringEmail || null]))
  for (const job of snapshot.jobs) statements.push(statement(`
    INSERT INTO jobs (job_id, title, company, description, url, published_at, source, category, tags, experience_level, location, timezone, status, company_id, source_type, is_trusted, member_only, is_approved, translations, industry, created_at, updated_at)
    SELECT $1, $2, tc.name, $3, $4, $5::timestamptz, $6, $7, $8::jsonb, $9, $10, $11, 'active', $12::text, 'mini_catalog_projection', TRUE, FALSE, TRUE, $13::jsonb, $14, COALESCE($15::timestamptz, NOW()), NOW()
      FROM trusted_companies tc WHERE tc.company_id = $12::text
    ON CONFLICT (job_id) DO UPDATE SET title=EXCLUDED.title, company=EXCLUDED.company, description=EXCLUDED.description, url=EXCLUDED.url, published_at=EXCLUDED.published_at, source=EXCLUDED.source, category=EXCLUDED.category, tags=EXCLUDED.tags, experience_level=EXCLUDED.experience_level, location=EXCLUDED.location, timezone=EXCLUDED.timezone, status='active', company_id=EXCLUDED.company_id, source_type='mini_catalog_projection', is_trusted=TRUE, member_only=FALSE, is_approved=TRUE, translations=EXCLUDED.translations, industry=EXCLUDED.industry, updated_at=NOW()`, [job.id, job.title, job.description, job.url, job.publishedAt || null, job.source, job.category, JSON.stringify(job.tags), job.experienceLevel, job.location, job.timezone, job.companyId, JSON.stringify(job.translations), job.industry, job.firstSeenAt || null]))
  for (const job of snapshot.jobs) {
    const fallbackHash = crypto.createHash('sha256').update(`${job.url || job.id}\n${job.id}`).digest('hex')
    statements.push(statement(`
      UPDATE company_job_history SET source_url_hash=CASE WHEN EXISTS (SELECT 1 FROM company_job_history collision WHERE collision.company_id=$1::text AND collision.source_url_hash=encode(digest(COALESCE(NULLIF($3::text, ''), $2::text), 'sha256'), 'hex') AND collision.source_job_id<>$2::text) THEN $12 ELSE encode(digest(COALESCE(NULLIF($3::text, ''), $2::text), 'sha256'), 'hex') END, title=$4, description=$5, category=$6, role_families=$13::jsonb, industry=$7, experience_level=$8, location=$9, timezone=$10, last_seen_at=NOW(), source_published_at=$11::timestamptz, closed_at=NULL, is_public_opportunity=TRUE, updated_at=NOW()
       WHERE company_id=$1::text AND source_job_id=$2::text`, [job.companyId, job.id, job.url, job.title, job.description, job.category, job.industry, job.experienceLevel, job.location, job.timezone, job.publishedAt || null, fallbackHash, JSON.stringify(job.roleFamilies)]))
    statements.push(statement(`
      INSERT INTO company_job_history (company_id, source_job_id, source_url_hash, title, description, category, role_families, normalized_skills, industry, experience_level, location, timezone, first_seen_at, last_seen_at, source_published_at, closed_at, payload_hash, evidence_quality, is_public_opportunity, updated_at)
      SELECT $1::text, $2::text, CASE WHEN EXISTS (SELECT 1 FROM company_job_history collision WHERE collision.company_id=$1::text AND collision.source_url_hash=encode(digest(COALESCE(NULLIF($3::text, ''), $2::text), 'sha256'), 'hex')) THEN $13 ELSE encode(digest(COALESCE(NULLIF($3::text, ''), $2::text), 'sha256'), 'hex') END, $4, $5, $6, $14::jsonb, '[]'::jsonb, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()), NOW(), $12::timestamptz, NULL, encode(digest($2::text, 'sha256'), 'hex'), 0.9, TRUE, NOW()
       WHERE NOT EXISTS (SELECT 1 FROM company_job_history WHERE company_id=$1::text AND source_job_id=$2::text)
         AND NOT EXISTS (SELECT 1 FROM company_job_history WHERE company_id=$1::text AND source_url_hash=encode(digest(COALESCE(NULLIF($3::text, ''), $2::text), 'sha256'), 'hex'))`, [job.companyId, job.id, job.url, job.title, job.description, job.category, job.industry, job.experienceLevel, job.location, job.timezone, job.firstSeenAt || null, job.publishedAt || null, fallbackHash, JSON.stringify(job.roleFamilies)]))
  }
  const ids = snapshot.jobs.map((job) => job.id)
  statements.push(statement(`UPDATE jobs SET status='inactive', updated_at=NOW() WHERE source_type='mini_catalog_projection' AND NOT (job_id = ANY($1::text[]))`, [ids]))
  statements.push(statement(`UPDATE company_job_history h SET closed_at=COALESCE(h.closed_at, NOW()), is_public_opportunity=FALSE, updated_at=NOW() WHERE h.source_job_id IN (SELECT j.job_id FROM jobs j WHERE j.source_type='mini_catalog_projection') AND NOT (h.source_job_id = ANY($1::text[]))`, [ids]))
  const results = await sql.transaction(statements.map(({ text: sqlText, params }) => sql.query(sqlText, params)))
  return { imported: true, version: snapshot.version, companies: snapshot.companies.length, jobs: snapshot.jobs.length, statements: statements.length, transactionResultCount: Array.isArray(results) ? results.length : null }
}

export { MAX_COMPANIES, MAX_JOBS, MAX_PAGE_SIZE }
