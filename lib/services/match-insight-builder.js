function clampScore(value, min = 0, max = 100) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

const DIMENSION_CONFIG = [
  {
    key: 'titleMatch',
    label: '方向一致性',
    strongThreshold: 85,
    weakThreshold: 55,
    strengthText: '岗位标题与当前求职方向高度一致',
    riskText: '岗位标题与当前求职方向信号偏弱',
    improveText: '把目标岗位名称、核心职责关键词写进简历标题和最近项目描述'
  },
  {
    key: 'roleTypeMatch',
    label: '角色类型',
    strongThreshold: 82,
    weakThreshold: 55,
    strengthText: '岗位角色类型与当前职业定位贴合',
    riskText: '岗位角色类型与当前定位存在偏差',
    improveText: '补充更贴近该岗位类型的项目经历，减少泛化表述'
  },
  {
    key: 'skillMatch',
    label: '技能覆盖',
    strongThreshold: 72,
    weakThreshold: 60,
    strengthText: '核心技能覆盖岗位要求的关键部分',
    riskText: '核心技能覆盖不足，容易在筛选环节掉队',
    improveText: '优先补齐岗位最核心的 2-3 个技能词，并用项目成果证明'
  },
  {
    key: 'keywordSimilarity',
    label: 'JD 语义关联',
    strongThreshold: 66,
    weakThreshold: 55,
    strengthText: '简历经历与 JD 职责表达高度相关',
    riskText: '简历表达与 JD 关键词关联度不高',
    improveText: '把 JD 高频职责改写进简历项目描述，强化可检索的关键词覆盖'
  },
  {
    key: 'experienceMatch',
    label: '经验层级',
    strongThreshold: 70,
    weakThreshold: 55,
    strengthText: '经验层级与岗位要求基本匹配',
    riskText: '经验层级与岗位预期存在差距',
    improveText: '突出最能证明层级的成果、负责人经历或复杂项目难度'
  },
  {
    key: 'preferenceMatch',
    label: '求职偏好',
    strongThreshold: 65,
    weakThreshold: 55,
    strengthText: '岗位类型与当前求职偏好基本一致',
    riskText: '岗位与当前偏好存在一定偏差',
    improveText: '如岗位本身足够优质，可适度放宽地区/类型偏好后再观察'
  }
]

export function normalizeMatchBreakdown(details = {}) {
  const raw = details?.breakdown || details || {}
  return {
    titleMatch: clampScore(raw.titleMatch),
    roleTypeMatch: clampScore(raw.roleTypeMatch),
    skillMatch: clampScore(raw.skillMatch),
    keywordSimilarity: clampScore(raw.keywordSimilarity),
    experienceMatch: clampScore(raw.experienceMatch),
    preferenceMatch: clampScore(raw.preferenceMatch)
  }
}

function inferConfidence(score, dimensions = []) {
  const strongCount = dimensions.filter(item => item.score >= item.strongThreshold).length
  const weakCount = dimensions.filter(item => item.score < item.weakThreshold).length

  if (score >= 90 && strongCount >= 3 && weakCount === 0) {
    return {
      label: '高',
      reason: '核心维度稳定偏强，结论主要由岗位方向、角色类型和技能覆盖共同支撑。'
    }
  }

  if (score >= 82 && strongCount >= 2 && weakCount <= 1) {
    return {
      label: '中高',
      reason: '主要优势清晰，但仍有 1 个左右维度需要补强后才能更稳。'
    }
  }

  return {
    label: '中',
    reason: '当前结论更多反映方向关联和基础适配，投递前建议补齐薄弱项。'
  }
}

function inferVerdict(score, dimensions = []) {
  const titleScore = dimensions.find(item => item.key === 'titleMatch')?.score || 0
  const roleScore = dimensions.find(item => item.key === 'roleTypeMatch')?.score || 0
  const skillScore = dimensions.find(item => item.key === 'skillMatch')?.score || 0

  if (score >= 92 && titleScore >= 85 && roleScore >= 82 && skillScore >= 72) {
    return '建议优先尝试'
  }
  if (score >= 85 && titleScore >= 75 && roleScore >= 70) {
    return '值得重点投递'
  }
  if (score >= 78) {
    return '可尝试，但建议定制简历后再投'
  }
  return '相关但不算稳妥，建议谨慎投递'
}

function buildEvidence(dimensions = []) {
  return dimensions
    .filter(item => item.score >= Math.min(70, item.strongThreshold))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => `${item.label} ${item.score}/100：${item.strengthText}`)
}

function buildRisks(dimensions = []) {
  return dimensions
    .filter(item => item.score < Math.max(65, item.weakThreshold))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map(item => `${item.label} ${item.score}/100：${item.riskText}`)
}

export function buildMatchInsights({ score = 0, details = {}, jobRow = {} } = {}) {
  const breakdown = normalizeMatchBreakdown(details)
  const dimensions = DIMENSION_CONFIG.map(config => ({
    ...config,
    score: breakdown[config.key] || 0
  }))

  const strengths = dimensions
    .filter(item => item.score >= item.strongThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.strengthText)

  const suggestions = dimensions
    .filter(item => item.score < Math.max(65, item.weakThreshold))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map(item => item.improveText)

  const evidence = buildEvidence(dimensions)
  const risks = buildRisks(dimensions)
  const confidence = inferConfidence(clampScore(score), dimensions)
  const verdict = inferVerdict(clampScore(score), dimensions)
  const roleHint = String(jobRow?.title || jobRow?.category || '该岗位').trim()

  const summaryParts = [
    `${roleHint}${verdict}。`,
    evidence.length > 0 ? `当前最强的支撑点是${evidence[0].replace(/^\S+\s\d+\/100：/, '')}。` : '',
    risks.length > 0 ? `需要重点关注的是${risks[0].replace(/^\S+\s\d+\/100：/, '')}。` : '',
    `本次判断可信度${confidence.label}，${confidence.reason}`
  ].filter(Boolean)

  return {
    summary: summaryParts.join(' '),
    verdict,
    confidence,
    strengths,
    evidence,
    risks,
    suggestions,
    breakdown,
    updatedAt: new Date().toISOString()
  }
}
