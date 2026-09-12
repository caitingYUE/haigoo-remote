import type { MiniCompany, MiniCompanyJob } from '../types'
import type { WatchFeedItem } from '../services/career-match-service'

const ROLE_LABELS: Array<[RegExp, string]> = [
  [/front[ -]?end|前端/i, '前端'], [/back[ -]?end|后端/i, '后端'], [/full[ -]?stack|全栈/i, '全栈'],
  [/ios|android|mobile|移动端|客户端/i, '移动端'],
  [/product|产品/i, '产品'], [/project|项目/i, '项目'], [/design|\bui\b|\bux\b|设计/i, '设计'],
  [/data|数据|分析/i, '数据'], [/research|研究/i, '研究'], [/market|growth|品牌|市场|增长/i, '市场'],
  [/operation|运营/i, '运营'], [/sales|account executive|销售|商务/i, '销售'],
  [/customer success|customer support|客户成功|客户支持/i, '客户成功'],
  [/finance|accounting|财务|会计/i, '财务'], [/recruit|talent|human resource|招聘|人力/i, '人力'],
  [/engineer|developer|software|devops|platform|cloud|security|quality|\bqa\b|test|工程|开发|测试|运维|安全|平台/i, '研发'],
  [/content|writer|editor|内容|编辑/i, '内容'], [/consult|咨询/i, '咨询']
]

export function normalizeMatchReason(value: string) {
  return String(value || '')
    .replace(/^(推荐关注|为什么推荐|推荐理由)[：:]?\s*/, '')
    .replace(/[，、；;]{2,}/g, '，')
    .replace(/\s+/g, ' ')
    .trim()
}

export function roleLabelsFromTitles(titles: string[] = []) {
  const labels: string[] = []
  for (const title of titles) {
    const label = ROLE_LABELS.find(([pattern]) => pattern.test(String(title || '')))?.[1]
    if (label && !labels.includes(label)) labels.push(label)
    if (labels.length === 2) break
  }
  return labels
}

export function formatOpenRoleSummary(labels: string[] = [], openJobCount = 0) {
  const visible = labels.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 2)
  if (visible.length === 1) return `${visible[0]}岗位可申请`
  if (visible.length > 1) return `${visible.join('、')}可申请`
  return openJobCount > 0 ? `${openJobCount} 个公开岗位` : '查看企业当前岗位'
}

export function companyOpenRoleSummary(company: Pick<MiniCompany, 'publicJobTitles' | 'openJobCount' | 'jobs'>) {
  const jobTitles = [
    ...(company.publicJobTitles || []),
    ...((company.jobs || []) as MiniCompanyJob[]).flatMap((job) => [job.titleZh, job.title, job.titleOriginal])
  ].filter((title): title is string => Boolean(String(title || '').trim()))
  return formatOpenRoleSummary(roleLabelsFromTitles(jobTitles), company.openJobCount || 0)
}

export function conciseCompanyDescription(value: string) {
  const normalized = String(value || '')
    .replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const sentences = normalized.split(/[。！？!?]|\.\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean)
  // Extract an existing positioning sentence; do not generate unsupported claims.
  const positioning = sentences.find((part) => part.length <= 86 && /(?:是一家|是一个|提供|专注于|致力于|帮助|\b(?:provides?|helps?|builds?|is an?|platform for)\b)/i.test(part))
  const text = positioning || normalized
  return text.length > 86 ? `${text.slice(0, 85)}…` : text
}

type MatchCompanySignals = WatchFeedItem & {
  jobLocation?: string
  jobTimezone?: string
  salary?: string | number
  jobSalary?: string | number
}

function directionMatchLabel(company: WatchFeedItem) {
  const roles = (company.openRoleLabels.length ? company.openRoleLabels : roleLabelsFromTitles([company.jobTitle]))
    .map(String).map((item) => item.trim()).filter(Boolean).slice(0, 2)
  if (roles.length) return roles.join(' / ')
  const label = String(company.scoreBreakdown?.direction?.label || '').split('·').pop()?.trim() || ''
  return label && !/未设置|待补充/.test(label) ? label : ''
}

function remoteCultureLabels(company: WatchFeedItem) {
  const signals = company as MatchCompanySignals
  const location = String(signals.jobLocation || '').trim()
  const timezone = String(signals.jobTimezone || '').trim()
  const salary = signals.jobSalary ?? signals.salary
  const matchedLabels = [
    ...company.preferenceStatuses.filter((item) => item.status === 'matched').map((item) => item.label),
    ...company.reasons
  ].map((item) => String(item || '').trim())
  const labels: string[] = []
  const domesticFriendly = Boolean(location && /(中国|国内|北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|苏州|厦门|香港|澳门|china|chinese)/i.test(location))
  if (domesticFriendly) {
    labels.push('国内友好')
  }
  const outsideApac = /(美国|美洲|欧洲|英国|非洲|CET|GMT\s*[+-]?0|UTC\s*[+-]?0|US|EST|PST|PDT|GMT-)/i.test(timezone)
    || (!domesticFriendly && /\bCST\b/i.test(timezone))
  if (timezone && !outsideApac) {
    labels.push('亚太时区友好')
  }
  if (salary !== undefined && salary !== null && String(salary).trim()) labels.push('薪酬透明')
  for (const label of matchedLabels) {
    if (/(国内友好|亚太时区友好|薪酬透明)/.test(label) && !labels.includes(label)) labels.push(label)
  }
  return labels
}

export function buildMatchCardPresentation(company: WatchFeedItem) {
  return {
    meta: [company.industry, company.headquarters].filter(Boolean).join(' · '),
    ratingLabel: company.rating !== null ? company.rating.toFixed(1) : '',
    ratingSource: company.ratingSource,
    showNumericScore: Number.isFinite(Number(company.score)),
    descriptionSnippet: conciseCompanyDescription(company.description) || '暂未收录企业简介',
    directionMatch: directionMatchLabel(company),
    remoteCulture: remoteCultureLabels(company),
    jobTitle: company.jobTitle || '暂无数据',
    jobLocation: String(company.jobLocation || '').trim(),
    scoreBreakdown: company.scoreBreakdown
  }
}
