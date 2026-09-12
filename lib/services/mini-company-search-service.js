import distance from 'natural/lib/natural/distance/levenshtein_distance.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'

export function normalizeCompanyName(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '').trim()
}

function companyNames(company) {
  let translations = company.translations || {}
  if (typeof translations === 'string') {
    try { translations = JSON.parse(translations) } catch { translations = {} }
  }
  return [...new Set([company.name, translations?.name, translations?.company, translations?.companyName]
    .filter((name) => typeof name === 'string' && name.trim().length <= 255)
    .map(normalizeCompanyName).filter(Boolean))]
}

function parseJson(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
}

function collectNamedText(value, key = '') {
  if (typeof value === 'string') return /(name|title|company)/i.test(key) ? [value] : []
  if (Array.isArray(value)) return value.flatMap((item) => collectNamedText(item, key))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([childKey, childValue]) => collectNamedText(childValue, childKey))
}

function companySearchCandidates(company) {
  const translations = parseJson(company.translations)
  const titleValues = [
    company.public_job_search_terms,
    company.public_job_titles,
    company.job_titles,
    company.publicJobSearchTerms,
    company.publicJobTitles,
    company.jobs,
    company.publicJobs
  ].flatMap((value) => Array.isArray(value) ? value : [value])
  return [...new Set([
    ...companyNames(company),
    normalizeCompanyName(company.name),
    ...collectNamedText(translations).map(normalizeCompanyName),
    ...titleValues.flatMap((value) => {
      if (typeof value === 'string') return [normalizeCompanyName(value)]
      return collectNamedText(value).map(normalizeCompanyName)
    })
  ].filter(Boolean))]
}

function candidateEditRatio(query, candidate) {
  if (!query || !candidate) return Infinity
  if (query === candidate) return 0
  const budget = candidate.length < 4 ? 0 : Math.floor(candidate.length * 0.3)
  if (Math.abs(candidate.length - query.length) > budget) return Infinity
  const edits = distance.DamerauLevenshteinDistance(query, candidate)
  return edits <= budget ? edits / Math.max(candidate.length, query.length) : Infinity
}

function roleFamilies(value) {
  const aliases = {
    product: ['产品', 'product', 'pm'], project: ['项目', 'project', 'program'],
    engineering: ['研发', '工程', 'software', 'developer', 'engineer', '开发', '技术', '测试', 'qa', '运维'],
    design: ['设计', 'design', 'ux', 'ui', '视觉', '交互'], data: ['数据', 'data', 'analytics', '分析'],
    marketing: ['市场', 'marketing', '品牌', 'growth', '增长'], sales: ['销售', 'sales', '商务', '客户成功'],
    operations: ['运营', 'operations', 'community', '内容', '编辑', '采购'], research: ['研究', 'research', '咨询'],
    finance: ['财务', 'finance', 'accounting', '会计', '投资'], hr: ['人力', 'hr', '招聘', '行政', '法务']
  }
  const text = String(value || '').toLowerCase()
  return Object.entries(aliases).filter(([, terms]) => terms.some((term) => text.includes(term))).map(([key]) => key)
}

function profileTerms(profile) {
  if (!profile) return []
  const source = typeof profile === 'string' ? parseJson(profile) : profile
  return [...new Set([
    ...(Array.isArray(source.roleFamilies) ? source.roleFamilies : []),
    ...(Array.isArray(source.role_families) ? source.role_families : []),
    ...(Array.isArray(source.roleTerms) ? source.roleTerms : []),
    ...(Array.isArray(source.roles) ? source.roles : []),
    ...(Array.isArray(source.targetRolesNow) ? source.targetRolesNow : []),
    source.targetRoles, source.careerGoal
  ].flatMap((value) => roleFamilies(value).concat(String(value || '').toLowerCase().split(/[,，、|/]+/)))
    .map((value) => String(value || '').trim()).filter(Boolean))]
}

/**
 * Rank a public company snapshot without pushing user input into SQL.
 * Free search only accepts a whole company/job candidate within the 30% edit budget;
 * member search additionally supports literal normalized substring matches.
 */
export function rankDirectoryCompanies(companies, searchOrOptions = '', options = {}) {
  const objectOptions = searchOrOptions && typeof searchOrOptions === 'object' ? searchOrOptions : null
  const search = objectOptions ? objectOptions.search : searchOrOptions
  const resolvedOptions = objectOptions || options
  const mode = ['exact', 'free'].includes(resolvedOptions.mode) ? 'free' : 'member'
  const sortBy = resolvedOptions.sortBy === 'relevance' ? 'relevance' : 'latest'
  const profile = resolvedOptions.profile || (resolvedOptions.roleFamilies ? { roleFamilies: resolvedOptions.roleFamilies } : null)
  const rawSearch = String(search || '').trim()
  if (/[\%_]/.test(rawSearch)) return { companies: [], ids: [], scores: new Map(), outcome: 'not_found' }
  const normalizedSearch = normalizeCompanyName(search)
  if (rawSearch && !normalizedSearch) return { companies: [], ids: [], scores: new Map(), outcome: 'not_found' }
  const candidates = (Array.isArray(companies) ? companies : []).map((company) => ({
    company,
    companyTexts: companyNames(company),
    jobTexts: companySearchCandidates(company).filter((text) => !companyNames(company).includes(text)),
    texts: companySearchCandidates(company),
    roleFamilies: [...new Set([
      ...(Array.isArray(company.role_families) ? company.role_families : []),
      ...(Array.isArray(company.roleFamilies) ? company.roleFamilies : []),
      company.open_role_categories,
      company.openRoleCategories,
      company.public_job_search_terms,
      company.public_job_titles
    ].flatMap((value) => [value, ...roleFamilies(value)]).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))]
  }))
  let ranked = candidates
  let outcome = null
  if (normalizedSearch) {
    if (normalizedSearch.length > 80 || normalizedSearch.length < 2) {
      return { companies: [], ids: [], scores: new Map(), outcome: 'too_broad' }
    }
    ranked = candidates.map((item) => {
      const scoreType = (texts, base) => {
        const exact = texts.some((text) => text === normalizedSearch)
        const literal = texts.some((text) => text.includes(normalizedSearch))
        const typo = Math.min(...texts.map((text) => candidateEditRatio(normalizedSearch, text)))
        if (exact) return base
        if (mode === 'member' && literal) return base + (texts.some((text) => text.startsWith(normalizedSearch)) ? 0.2 : 0.4)
        return Number.isFinite(typo) ? base + 1 + typo : Infinity
      }
      const companyScore = scoreType(item.companyTexts, 0)
      const jobScore = scoreType(item.jobTexts, 10)
      return { ...item, score: Math.min(companyScore, jobScore) }
    }).filter((item) => Number.isFinite(item.score))
    if (mode === 'free' && ranked.length > 5) {
      return { companies: [], ids: [], scores: new Map(), outcome: 'too_broad' }
    }
    if (!ranked.length) {
      const broad = normalizedSearch.length < 4 || candidates.some((item) => item.texts.some((text) => text.includes(normalizedSearch)))
      return { companies: [], ids: [], scores: new Map(), outcome: broad ? 'too_broad' : 'not_found' }
    }
    outcome = 'matched'
  }
  const terms = [...new Set([
    ...profileTerms(profile),
    ...(Array.isArray(resolvedOptions.roleFamilies) ? resolvedOptions.roleFamilies : [])
  ].map((term) => String(term || '').trim().toLowerCase()).filter(Boolean))]
  ranked.sort((a, b) => {
    if (sortBy === 'relevance' && terms.length) {
      const aFamilies = new Set(a.roleFamilies)
      const bFamilies = new Set(b.roleFamilies)
      const aOverlap = terms.filter((term) => aFamilies.has(term)).length
      const bOverlap = terms.filter((term) => bFamilies.has(term)).length
      if (aOverlap !== bOverlap) return bOverlap - aOverlap
      if (a.score !== b.score) return a.score - b.score
    } else if (normalizedSearch && a.score !== b.score) {
      return a.score - b.score
    }
    if (sortBy === 'relevance') {
      // Relevance must remain meaningful even before a user has saved role
      // preferences. Broader current opportunity is a stable fallback signal.
      const aOpenJobCount = Number(a.company.openJobCount || a.company.open_job_count || 0)
      const bOpenJobCount = Number(b.company.openJobCount || b.company.open_job_count || 0)
      if (aOpenJobCount !== bOpenJobCount) return bOpenJobCount - aOpenJobCount
    }
    const aLatest = Date.parse(a.company.latestPublicJobAt || a.company.public_opportunity_updated_at || a.company.publicOpportunityUpdatedAt || 0) || 0
    const bLatest = Date.parse(b.company.latestPublicJobAt || b.company.public_opportunity_updated_at || b.company.publicOpportunityUpdatedAt || 0) || 0
    return bLatest - aLatest
      || String(a.company.name || '').localeCompare(String(b.company.name || ''))
      || String(a.company.company_id || a.company.id).localeCompare(String(b.company.company_id || b.company.id))
  })
  const visible = mode === 'free' && !normalizedSearch ? ranked.slice(0, 12) : ranked
  const scores = new Map(visible.map((item) => [String(item.company.company_id || item.company.id), item.score]))
  return {
    companies: visible.map((item) => item.company),
    ids: visible.map((item) => String(item.company.company_id || item.company.id)),
    scores,
    outcome
  }
}

export function matchCompanyNames(companies, search) {
  const query = normalizeCompanyName(search)
  if (!query || query.length > 80) return { ids: [], outcome: 'too_broad' }
  const candidates = companies.map((company) => ({ id: company.company_id, names: companyNames(company) }))
  const exact = candidates.filter((company) => company.names.includes(query))
  if (exact.length) return { ids: exact.slice(0, 5).map((company) => company.id), outcome: 'matched' }
  const ranked = candidates.map((company) => ({
    id: company.id,
    score: Math.min(...company.names.map((name) => {
      const budget = name.length < 4 ? 0 : Math.floor(name.length * 0.3)
      if (Math.abs(name.length - query.length) > budget || query.length < 3) return Infinity
      const edits = distance.DamerauLevenshteinDistance(query, name)
      return edits <= budget ? edits / name.length : Infinity
    }))
  })).filter((company) => Number.isFinite(company.score)).sort((a, b) => a.score - b.score || String(a.id).localeCompare(String(b.id)))
  // A query matching many brands is no longer a request for a specific company.
  if (ranked.length > 5) return { ids: [], outcome: 'too_broad' }
  if (ranked.length) return { ids: ranked.map((company) => company.id), outcome: 'matched' }
  const broad = query.length < 4 || candidates.some((company) => company.names.some((name) => name.includes(query)))
  return { ids: [], outcome: broad ? 'too_broad' : 'not_found' }
}

let names = []
let expiresAt = 0
let pending = null

export async function searchNamedCompanies(search) {
  if (Date.now() >= expiresAt) {
    if (!pending) pending = neonHelper.query(
      "SELECT company_id, name, translations FROM trusted_companies WHERE status = 'active' ORDER BY company_id"
    ).then((rows) => { names = rows || []; expiresAt = Date.now() + 5 * 60 * 1000 })
    try { await pending } finally { pending = null }
  }
  return matchCompanyNames(names, search)
}
