function cleanText(value, maxLength = 240) {
  if (value == null || typeof value === 'object') return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (/^[{[]/.test(text) || /["'](?:min|max|currency|amount|value|type)["']\s*:/.test(text)) return ''
  return text.slice(0, maxLength)
}

function canonicalJobId(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 255)
}

function cleanList(value, limit = 12) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : []
  return values.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, limit)
}

function cleanLongText(value, maxLength = 8000) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  if (!source || /^[{[]/.test(source)) return ''
  return source
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

function cleanObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function timestamp(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Read the allowlisted public company catalog from Formal. This intentionally
 * fails closed when the snapshot contract is unavailable: the legacy job feed
 * does not contain enough company metadata to update a company master record.
 */
export async function readFormalCompanyCatalog(request, {
  pageSize = 100,
  maxCompanies = 5000,
  maxJobs = 20000
} = {}) {
  const safePageSize = Math.min(250, Math.max(1, Number(pageSize) || 100))
  const first = await request('company_catalog_snapshot', {
      target: 'formal',
      query: { page: 1, pageSize: safePageSize }
    })
    const totalCompanies = Number(first?.totalCompanies || 0)
    const totalJobs = Number(first?.totalJobs || 0)
    if (!Number.isInteger(totalCompanies) || !Number.isInteger(totalJobs) || totalCompanies < 0 || totalJobs < 0) throw new Error('formal catalog returned invalid totals')
    if (totalCompanies > maxCompanies || totalJobs > maxJobs) throw new Error('formal catalog exceeds CloudRun safety cap')
    const responsePageSize = Math.min(250, Math.max(1, Number(first?.pageSize) || safePageSize))
    const pages = Math.max(1, Math.ceil(totalCompanies / responsePageSize))
    const companies = [...(Array.isArray(first?.companies) ? first.companies : [])]
    const jobs = [...(Array.isArray(first?.jobs) ? first.jobs : [])]
    for (let page = 2; page <= pages; page += 1) {
      const next = await request('company_catalog_snapshot', {
        target: 'formal',
        query: { page, pageSize: responsePageSize }
      })
      if (String(next?.version || '') !== String(first?.version || '')
        || Number(next?.totalCompanies || 0) !== totalCompanies
        || Number(next?.totalJobs || 0) !== totalJobs) {
        throw new Error('formal catalog changed while pages were being read')
      }
      if (!Array.isArray(next?.companies) || !Array.isArray(next?.jobs)) throw new Error('formal catalog returned an invalid page')
      companies.push(...next.companies)
      jobs.push(...next.jobs)
    }
    if (companies.length !== totalCompanies || jobs.length !== totalJobs) throw new Error('formal catalog page totals do not match')
  return {
    source: 'snapshot',
    version: String(first?.version || ''),
    generatedAt: first?.generatedAt || new Date().toISOString(),
    totalCompanies,
    totalJobs,
    companies,
    jobs
  }
}

function salaryLabel(value) {
  const text = cleanText(value, 120)
  if (text) return text
  const salary = cleanObject(value)
  const display = cleanText(salary.display, 120)
  if (display) return display
  const min = Number(salary.min)
  const max = Number(salary.max)
  const hasMin = Number.isFinite(min) && min > 0
  const hasMax = Number.isFinite(max) && max > 0
  if (!hasMin && !hasMax) return ''
  if (hasMin && hasMax && min > max) return ''
  // Do not invent USD/year when the source omits currency or period.
  const currency = cleanText(salary.currency, 16)
  const period = cleanText(salary.period, 32)
  const symbol = ({ USD: '$', EUR: '€', CNY: '¥' })[currency.toUpperCase()] || (currency ? `${currency} ` : '')
  const unit = ({ hourly: '时', monthly: '月', yearly: '年', package: '总包' })[period] || period
  const amount = (number) => number >= 1000 && number % 1000 === 0 ? `${number / 1000}k` : String(number)
  const range = hasMin && hasMax ? (min === max ? amount(min) : `${amount(min)}–${amount(max)}`)
    : hasMin ? `${amount(min)} 起` : `最高 ${amount(max)}`
  return `${symbol}${range}${unit ? `/${unit}` : ''}`
}

function jobTypeLabel(value) {
  const text = cleanText(value, 80)
  const key = text.toLowerCase().replace(/[\s_-]+/g, '')
  return new Map([
    ['fulltime', '全职'], ['parttime', '兼职'], ['contract', '合同工'],
    ['contractor', '合同工'], ['freelance', '自由职业'], ['internship', '实习'],
    ['intern', '实习'], ['temporary', '临时工'], ['volunteer', '志愿者']
  ]).get(key) || text
}

export function buildCompanyHiringSignals(records = []) {
  const signals = new Map()
  for (const record of records) {
    const job = record?.payload || record
    const status = String(record?.status || job?.status || '').toLowerCase()
    const companyId = String(job?.companyId || '').trim()
    if (!companyId || !job?.id || !job?.title || ['closed', 'expired', 'inactive'].includes(status)) continue
    const updatedAt = job?.updatedAt || job?.publishedAt || record?.updatedAt || record?.publishedAt || null
    const current = signals.get(companyId) || { openJobCount: 0, publicOpportunityUpdatedAt: null }
    current.openJobCount += 1
    if (timestamp(updatedAt) > timestamp(current.publicOpportunityUpdatedAt)) current.publicOpportunityUpdatedAt = updatedAt
    signals.set(companyId, current)
  }
  return signals
}

export function buildCompanyJobMetadata(records = [], companyIds = null) {
  const wanted = companyIds ? new Set(companyIds) : null
  const result = new Map()
  for (const record of records) {
    const job = record?.payload || record || {}
    const companyId = String(job.companyId || '').trim() || (job.company ? `name:${String(job.company).trim().toLowerCase()}` : '')
    const status = String(record?.status || job.status || '').toLowerCase()
    if (!companyId || (wanted && !wanted.has(companyId)) || !job.title || job.memberOnly || job.isApproved === false
      || ['closed', 'expired', 'inactive'].includes(status)) continue
    const current = result.get(companyId) || { openRoleCategories: [], jobs: [], publicOpportunityUpdatedAt: null, newJobsUntil: null }
    const summary = job.summary || mapCompanyJobSummary(job, String(job.companyId || ''), job.company || '')
    if (summary && !current.jobs.some((item) => item.id === summary.id)) current.jobs.push(summary)
    const firstSeenAt = job.firstSeenAt || job.createdAt || summary?.firstSeenAt || summary?.publishedAt || null
    if (timestamp(firstSeenAt) > timestamp(current.publicOpportunityUpdatedAt)) {
      current.publicOpportunityUpdatedAt = firstSeenAt
      current.newJobsUntil = new Date(timestamp(firstSeenAt) + 72 * 60 * 60 * 1000).toISOString()
    }
    let categories = job.category
    if (typeof categories === 'string' && categories.trim().startsWith('[')) {
      try { categories = JSON.parse(categories) } catch { categories = [] }
    }
    // Preserve stored categories and source order; never infer categories from
    // titles. The shared taxonomy normalizer removes broad/unknown UI labels.
    for (const category of cleanList(categories)) {
      if (!current.openRoleCategories.includes(category)) current.openRoleCategories.push(category)
    }
    result.set(companyId, current)
  }
  return result
}

export function companyJobMetadata(snapshot, companyId, companyName = '') {
  const entries = [snapshot.get(companyId), snapshot.get(`name:${String(companyName).trim().toLowerCase()}`)].filter(Boolean)
  return {
    openRoleCategories: [...new Set(entries.flatMap((item) => item.openRoleCategories))],
    jobs: [...new Map(entries.flatMap((item) => item.jobs).map((job) => [job.id, job])).values()]
      .sort((a, b) => timestamp(b.firstSeenAt || b.publishedAt) - timestamp(a.firstSeenAt || a.publishedAt) || a.id.localeCompare(b.id)),
    publicOpportunityUpdatedAt: entries.map((item) => item.publicOpportunityUpdatedAt).sort((a, b) => timestamp(b) - timestamp(a))[0] || null,
    newJobsUntil: entries.map((item) => item.newJobsUntil).sort((a, b) => timestamp(b) - timestamp(a))[0] || null
  }
}

export function createCompanyJobMetadataLoader(fetchPage, { ttlMs = 60000, now = Date.now } = {}) {
  let snapshot = null
  let expiresAt = 0
  let pending = null
  return async () => {
    if (snapshot && now() < expiresAt) return snapshot
    if (pending) return pending
    pending = (async () => {
      const first = await fetchPage(1)
      if (!Array.isArray(first?.jobs) || !Number.isFinite(Number(first.total))) throw new Error('公开岗位分类数据暂时不可用')
      const total = Number(first.total)
      if (total < 0 || total > 20000) throw new Error('公开岗位分类数据超出读取范围')
      const pages = Math.max(1, Math.ceil(total / 100))
      const records = []
      const collect = (batch) => {
        if (!Array.isArray(batch?.jobs)) throw new Error('公开岗位分类数据不完整')
        // Retain only metadata, never cache full job descriptions here.
        for (const job of batch.jobs) records.push({
          id: job.id, companyId: job.companyId, company: job.company,
          title: job.title, category: job.category, status: job.status,
          memberOnly: job.memberOnly, isApproved: job.isApproved,
          firstSeenAt: job.firstSeenAt || job.createdAt || null,
          summary: mapCompanyJobSummary(job, String(job.companyId || ''), job.company || '')
        })
      }
      collect(first)
      for (let page = 2; page <= pages; page += 3) {
        const batch = await Promise.all(Array.from({ length: Math.min(3, pages - page + 1) }, (_, offset) => fetchPage(page + offset)))
        batch.forEach(collect)
      }
      if (records.length < total) throw new Error('公开岗位分类数据不完整，请重试')
      snapshot = buildCompanyJobMetadata(records)
      expiresAt = now() + ttlMs
      return snapshot
    })()
    try { return await pending } finally { pending = null }
  }
}

export function buildHiringCompanyPage({ companies = [], signals, search = '', industry = '', page = 1, pageSize = 20 }) {
  const normalizedSearch = String(search || '').trim().toLowerCase()
  const normalizedIndustry = String(industry || '').trim()
  const enriched = companies
    .map((company) => {
      const signal = signals.get(String(company?.id || ''))
      return signal ? { ...company, ...signal, hasPublicOpportunity: true } : null
    })
    .filter(Boolean)
  const industries = new Map()
  for (const company of enriched) {
    const name = cleanText(company.industry, 80)
    if (name) industries.set(name, Number(industries.get(name) || 0) + 1)
  }
  const filtered = enriched
    .filter((company) => !normalizedIndustry || company.industry === normalizedIndustry)
    .filter((company) => !normalizedSearch || [company.name, company.industry, company.description].join(' ').toLowerCase().includes(normalizedSearch))
    .sort((a, b) => timestamp(b.publicOpportunityUpdatedAt) - timestamp(a.publicOpportunityUpdatedAt) || String(a.name).localeCompare(String(b.name), 'zh-CN'))
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20))
  const offset = (safePage - 1) * safePageSize
  return {
    companies: filtered.slice(offset, offset + safePageSize),
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
    hasMore: offset + safePageSize < filtered.length,
    industries: [...industries.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, 24)
  }
}

export function mapCompanyJobSummary(job, companyId, companyName = '') {
  if (!job) return null
  const expectedCompanyId = String(companyId || '').trim()
  const actualCompanyId = String(job.companyId || '').trim()
  const expectedCompanyName = cleanText(companyName, 255).toLowerCase()
  const actualCompanyName = cleanText(job.company, 255).toLowerCase()
  const sameCompany = actualCompanyId === expectedCompanyId
    || (!actualCompanyId && expectedCompanyName && actualCompanyName === expectedCompanyName)
  if (!sameCompany) return null
  const id = canonicalJobId(job.id || job.jobId)
  const titleOriginal = cleanText(job.title, 255)
  const translations = cleanObject(job.translations)
  const titleZh = cleanText(translations.title, 255)
  if (!id || !titleOriginal) return null
  return {
    id,
    companyId: actualCompanyId,
    company: cleanText(job.company, 255),
    title: titleZh || titleOriginal,
    titleZh,
    titleOriginal,
    category: cleanText(job.category, 120),
    location: cleanText(translations.location, 160) || cleanText(job.location, 160) || cleanText(job.region, 160),
    salary: salaryLabel(translations.salary) || salaryLabel(job.salary),
    jobType: jobTypeLabel(cleanText(translations.type, 80) || cleanText(translations.jobType, 80) || cleanText(job.jobType, 80) || cleanText(job.type, 80)),
    sourceLabel: String(job.sourceType || '').toLowerCase() === 'official' || job.isTrusted
      ? '岗位来自企业官网'
      : '岗位来自公开招聘渠道',
    experienceLevel: cleanText(translations.experienceLevel, 80) || ({ entry: '入门', junior: '初级', mid: '中级', senior: '高级', lead: '负责人', executive: '高管', internship: '实习' })[String(job.experienceLevel || '').toLowerCase()] || cleanText(job.experienceLevel, 80),
    firstSeenAt: job.firstSeenAt || job.createdAt || null,
    publishedAt: job.publishedAt || job.published_at || null,
    updatedAt: job.updatedAt || job.publishedAt || null
  }
}

export function mapCompanyJobDetail(job, companyId, companyName = '') {
  const summary = mapCompanyJobSummary(job, companyId, companyName)
  if (!summary) return null
  const officialApplyUrl = /^https?:\/\//i.test(String(job.url || job.sourceUrl || '').trim())
    ? String(job.url || job.sourceUrl).trim().slice(0, 2048)
    : ''
  const email = String(job.hiringEmail || '').trim().slice(0, 320)
  const translations = cleanObject(job.translations)
  const descriptionOriginal = cleanLongText(job.originalDescription || job.description)
  const descriptionZh = cleanLongText(translations.description)
  const requirementsOriginal = cleanList(job.requirements)
  const requirementsZh = cleanList(translations.requirements)
  const benefitsOriginal = cleanList(job.benefits)
  const benefitsZh = cleanList(translations.benefits)
  return {
    ...summary,
    company: cleanText(job.company, 255),
    category: cleanText(job.category, 120),
    description: descriptionZh || descriptionOriginal,
    descriptionZh,
    descriptionOriginal,
    requirements: requirementsZh.length ? requirementsZh : requirementsOriginal,
    requirementsZh,
    requirementsOriginal,
    benefits: benefitsZh.length ? benefitsZh : benefitsOriginal,
    benefitsZh,
    benefitsOriginal,
    officialApplyUrl,
    publicApplicationEmail: !officialApplyUrl && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    sourceLabel: '岗位与申请方式整理自企业官网及公开渠道'
  }
}
