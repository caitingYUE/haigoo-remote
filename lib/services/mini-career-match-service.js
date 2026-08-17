import { redactResumeForModel } from './member-crm-career-agent.js'

const RETENTION_DAYS = { '30_days': 30, '90_days': 90 }

function likelyNameLine(line, index, lines) {
  if (index > 2) return false
  const value = line.trim()
  const next = lines.slice(index + 1, index + 4).join(' ')
  const contactNearby = /@|(?:电话|手机|邮箱|微信|phone|mobile|email|wechat|已移除个人信息|已移除邮箱|已移除电话)|\+?\d[\d\s().-]{7,}/i.test(next)
  return contactNearby && (/^[\u3400-\u9fff·]{2,5}$/.test(value) || /^[A-Za-z]+(?:[ '-][A-Za-z]+){1,3}$/.test(value))
}

export function redactCareerText(value) {
  const base = redactResumeForModel(value)
  const lines = base.split('\n')
  return lines
    .map((line, index) => likelyNameLine(line, index, lines) ? '[已移除姓名]' : line)
    .join('\n')
    .replace(/(?:身份证|id\s*(?:card|number))\s*[:：]?\s*[0-9Xx-]{8,}/gi, '[已移除证件信息]')
    .replace(/(?:QQ|钉钉|telegram)\s*[:：]?\s*\S+/gi, '[已移除联系方式]')
    .trim()
}

export function retentionExpiry(policy, now = new Date()) {
  const days = RETENTION_DAYS[policy]
  if (!days) return null
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function careerCompleteness(careerText, intake = {}) {
  const text = String(careerText || '')
  const checks = [
    { key: 'experience', label: '工作或项目经历', complete: text.length >= 120 },
    { key: 'outcomes', label: '成果与职责', complete: /(?:负责|完成|推动|提升|降低|增长|项目|managed|built|led|improved|increased)/i.test(text) },
    { key: 'constraints', label: '远程工作条件', complete: Boolean(intake.location && intake.timezone && intake.workMode) },
    { key: 'goal', label: '职业目标', complete: Boolean(intake.careerGoal || intake.targetRoles) }
  ]
  return { checks, completeCount: checks.filter((item) => item.complete).length, total: checks.length }
}

function textTokens(value) {
  return [...new Set(String(value || '').toLowerCase().split(/[^a-z0-9\u3400-\u9fff+#.]+/).filter((item) => item.length > 1))]
}

export function rankCareerCompanies(companies, candidateProfile, intake = {}, limit = 6) {
  const signals = [
    candidateProfile?.headline,
    ...(candidateProfile?.primaryFunctions || []),
    ...(candidateProfile?.transferableSkills || []),
    ...(candidateProfile?.domainAssets || []),
    ...(candidateProfile?.targetRolesNow || []),
    intake.careerGoal,
    intake.targetRoles
  ].filter(Boolean)
  const tokens = textTokens(signals.join(' '))

  return companies.map((company) => {
    const companyText = [company.name, company.industry, company.description, ...(company.tags || []), ...(company.specialties || [])].join(' ').toLowerCase()
    const matched = tokens.filter((token) => companyText.includes(token)).slice(0, 4)
    const score = matched.length * 4 + Math.min(3, Number(company.rating || 0) / 2)
    const reasons = matched.length
      ? [`业务与「${matched.slice(0, 2).join('、')}」相关`, company.specialties?.[0] ? `可以重点了解：${company.specialties[0]}` : '可以继续查看企业详情']
      : [company.industry ? `可以了解 ${company.industry} 领域的工作方式` : '可以用来了解远程企业', '暂时没有足够信息判断是否适合你']
    return {
      id: String(company.id || company.company_id || ''),
      name: String(company.name || ''),
      industry: String(company.industry || '其他'),
      description: String(company.description || ''),
      fitLevel: matched.length >= 2 ? 'current' : matched.length ? 'explore' : 'research',
      reasons,
      caution: '是否招聘及具体要求，请以企业官方信息为准。',
      _score: score
    }
  }).sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, 'zh-CN')).slice(0, limit).map(({ _score, ...company }) => company)
}

export function userCareerResult(artifact, intake, companies) {
  return {
    summary: { headline: artifact.summary.headline, positioning: artifact.summary.positioning },
    strengths: artifact.strengths,
    careerPaths: artifact.careerPaths,
    candidateProfile: artifact.candidateProfile,
    clarificationQuestions: artifact.clarificationQuestions.slice(0, 3),
    remoteReadiness: [
      { key: 'timezone', label: '时区与所在地', confirmed: Boolean(intake.timezone && intake.location) },
      { key: 'schedule', label: '可工作时间', confirmed: Boolean(intake.weeklyHours || intake.availability) },
      { key: 'language', label: '工作语言', confirmed: Boolean(intake.languages) },
      { key: 'work_mode', label: '工作方式', confirmed: Boolean(intake.workMode) }
    ],
    companies
  }
}
