function cleanText(value, maxLength = 240) {
  if (value == null || typeof value === 'object') return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (/^[\[{]/.test(text) || /["'](?:min|max|currency|amount|value|type)["']\s*:/.test(text)) return ''
  return text.slice(0, maxLength)
}

function cleanList(value, limit = 12) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : []
  return values.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, limit)
}

function cleanLongText(value, maxLength = 8000) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  if (!source || /^[\[{]/.test(source)) return ''
  return source
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

function timestamp(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
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

export function mapCompanyJobSummary(job, companyId) {
  if (!job || String(job.companyId || '').trim() !== String(companyId || '').trim()) return null
  const id = cleanText(job.id || job.jobId, 255)
  const title = cleanText(job.title, 255)
  if (!id || !title) return null
  return {
    id,
    title,
    location: cleanText(job.location || job.region, 160),
    salary: cleanText(job.salary, 120),
    jobType: cleanText(job.type || job.jobType, 80),
    updatedAt: job.updatedAt || job.publishedAt || null
  }
}

export function mapCompanyJobDetail(job, companyId) {
  const summary = mapCompanyJobSummary(job, companyId)
  if (!summary) return null
  const officialApplyUrl = /^https?:\/\//i.test(String(job.url || job.sourceUrl || '').trim())
    ? String(job.url || job.sourceUrl).trim().slice(0, 2048)
    : ''
  const email = String(job.hiringEmail || '').trim().slice(0, 320)
  return {
    ...summary,
    company: cleanText(job.company, 255),
    category: cleanText(job.category, 120),
    description: cleanLongText(job.description),
    requirements: cleanList(job.requirements),
    benefits: cleanList(job.benefits),
    officialApplyUrl,
    publicApplicationEmail: !officialApplyUrl && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    sourceLabel: '岗位与申请方式整理自企业官网及公开渠道'
  }
}
