import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'

export const FACT_FIELDS = [
  'title',
  'description',
  'url',
  'location',
  'salary',
  'job_type',
  'requirements',
  'benefits',
  'is_remote',
  'timezone',
  'published_at'
]
export const REVIEW_FIELDS = [...FACT_FIELDS, 'translations']
export const cleanText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
export function plainText(html) {
  const $ = cheerio.load(String(html || ''))
  $('script,style,noscript,nav,footer,header').remove()
  $('p,li,br,h1,h2,h3,h4').each((_, el) => $(el).append('\n'))
  return $.text()
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}
export function canonicalUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    for (const key of [...u.searchParams.keys()])
      if (/^(utm_|gh_src$|source$|trid$|rsid$|ref$)/i.test(key))
        u.searchParams.delete(key)
    u.searchParams.sort()
    u.hostname = u.hostname.toLowerCase()
    u.pathname = u.pathname.replace(/\/$/, '') || '/'
    return u.href
  } catch {
    return ''
  }
}
export function externalIdentity(raw) {
  try {
    const u = new URL(raw)
    for (const key of ['gh_jid', 'ashby_jid', 'ats_id', 'job'])
      if (u.searchParams.has(key)) return u.searchParams.get(key)
    const parts = u.pathname.split('/').filter(Boolean)
    if (/(^|\.)greenhouse\.io$/.test(u.hostname)) {
      const index = parts.indexOf('jobs')
      return index >= 0 ? parts[index + 1] || null : null
    }
    if (/(^|\.)(lever\.co|ashbyhq\.com)$/.test(u.hostname))
      return parts.find((p) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(p)) || null
    if (/(^|\.)workable\.com$/.test(u.hostname)) {
      const idx = parts.indexOf('j')
      return idx >= 0 ? parts[idx + 1] : null
    }
    if (u.hostname === 'jobs.smartrecruiters.com' && /^\d{8,}/.test(parts[1] || '')) return parts[1].match(/^\d+/)[0]
    if (u.hostname === 'jobs.deel.com' && parts[1] === 'job-details' && /^[a-f0-9-]{36}$/i.test(parts[2] || '')) return parts[2]
    return null
  } catch {
    return null
  }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])])
    )
  return typeof value === 'string' ? cleanText(value) : value
}
export const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)) ?? 'null')
    .digest('hex')
export function sourceFacts(item) {
  const facts = {}
  for (const key of FACT_FIELDS) {
    const value = item[key]
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && !value.length)
    )
      continue
    if (
      typeof value === 'string' &&
      /^(unknown|n\/?a|not specified|未提供|未知|待定)$/i.test(value.trim())
    )
      continue
    facts[key] = value
  }
  if (facts.url) facts.url = canonicalUrl(facts.url)
  if (facts.description) facts.description = plainText(facts.description)
  if (facts.title) facts.title = cleanText(facts.title)
  return facts
}
export function eligibility(facts) {
  const text = cleanText(`${facts.location || ''} ${facts.description || ''}`)
  const remote =
    facts.is_remote === true ||
    /\b(remote|work from anywhere|work from home)\b|远程/i.test(text)
  if (
    facts.is_remote === false ||
    /\b(onsite|on-site) only\b|必须到岗|不支持远程/i.test(text)
  )
    return { status: 'excluded', reason: '来源明确要求现场工作' }
  if (
    /\b(?:must (?:be |reside |live )|only (?:in |within )|restricted to |based (?:only )?in )(?:the )?(?:US|USA|United States|UK|United Kingdom|Canada|Europe|EU|Australia)\b|\b(?:US|USA|UK|EU|Canada|Europe|Australia)[ -]only\b/i.test(
      text
    )
  )
    return { status: 'excluded', reason: '来源明确限制其他招聘地域' }
  if (
    /\b(?:must|require[ds]?|need to)\b.{0,70}\b(?:residenc[ey]|citizen|work (?:permit|authorization)|authori[sz]ed to work|based in|reside in)\b|签证|工作许可|工作授权|公民身份/i.test(
      text
    )
  )
    return {
      status: 'unknown',
      reason: '存在常住地、身份或工作许可要求，需要人工核实适用范围'
    }
  const location = String(facts.location || '')
  if (
    remote &&
    /\b(worldwide|anywhere|global|mainland china|china|hong kong|taiwan|macao|macau|APAC|Asia Pacific)\b|全球|中国|香港|澳门|台湾|亚太|不限地区/i.test(
      location
    ) &&
    !/\b(exclud(?:e|es|ing)|except|not (?:available|eligible))\b.{0,50}\bchina\b/i.test(
      text
    )
  )
    return {
      status: 'eligible',
      reason:
        '来源明确远程且覆盖中国、港澳台、APAC 或全球；具体常住地和许可仍以原文为准'
    }
  return {
    status: 'unknown',
    reason: remote
      ? '已识别远程；中国常住申请资格仍需确认'
      : '工作方式及中国申请资格需要确认'
  }
}
export function diffFacts(previous, incoming, published) {
  const patch = {}
  for (const key of FACT_FIELDS) {
    if (incoming[key] === undefined) continue
    if (previous && hash(previous[key] ?? null) === hash(incoming[key]))
      continue
    if (hash(published?.[key] ?? null) !== hash(incoming[key]))
      patch[key] = incoming[key]
  }
  return patch
}
export function scanCompleteness({ complete, count, previousCount }) {
  const drop = previousCount != null ? previousCount - count : 0
  if (!complete) return { trusted: false, reason: '列表尚未完整读取' }
  if (count === 0)
    return {
      trusted: false,
      reason: '列表为空，需复核来源；不据此批量判定失效'
    }
  if (previousCount > 0 && drop >= 5 && drop / previousCount > 0.3)
    return { trusted: false, reason: '岗位数量异常下降，暂停缺失判断' }
  return { trusted: true, reason: null }
}
export function nextMissing(prior, now) {
  const since = prior.first_missing_at || now
  const count = (prior.missing_count || 0) + 1
  return {
    first_missing_at: since,
    missing_count: count,
    verify: count >= 2 && Date.parse(now) - Date.parse(since) >= 86400000
  }
}
export function validateReviewPatch(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new Error('审核内容必须为字段对象')
  for (const [key, val] of Object.entries(value)) {
    if (!REVIEW_FIELDS.includes(key))
      throw new Error(`不可自动修改字段：${key}`)
    if (
      ['tags', 'requirements', 'benefits'].includes(key) &&
      (!Array.isArray(val) || val.some((x) => typeof x !== 'string'))
    )
      throw new Error(`${key} 必须为文本列表`)
    if (
      ['is_remote', 'china_friendly'].includes(key) &&
      typeof val !== 'boolean' &&
      val !== null
    )
      throw new Error(`${key} 必须为布尔值`)
    if (
      key === 'translations' &&
      (val === null ||
        typeof val !== 'object' ||
        Array.isArray(val) ||
        Object.values(val).some((x) => typeof x !== 'string'))
    )
      throw new Error('译文必须为文本字段对象')
    if (
      ![
        'tags',
        'requirements',
        'benefits',
        'translations',
        'is_remote',
        'china_friendly'
      ].includes(key) &&
      typeof val !== 'string' &&
      val !== null
    )
      throw new Error(`${key} 必须为文本`)
  }
  return value
}
