type SkillSignal = {
  label: string
  patterns: Array<string | RegExp>
  roles?: string[]
  soft?: boolean
}

const ROLE_PATTERNS: Record<string, RegExp[]> = {
  product: [/产品经理|产品运营|product manager|product owner|产品规划|产品策略/i],
  marketing: [/市场|营销|增长|品牌|内容|投放|媒介|marketing|growth|brand|seo|sem/i],
  operations: [/运营|operations|community|用户运营|活动运营|项目运营|交付/i],
  business: [/商务|销售|渠道|客户成功|business development|sales|account manager|customer success|bd\b/i],
  data: [/数据分析|商业分析|data analyst|business analyst|analytics|bi\b/i],
  design: [/设计|designer|ux|ui|视觉|用户研究/i],
  hr: [/招聘|recruit|talent|hr|人力资源/i],
  tech: [/工程师|开发|算法|研发|程序|engineer|developer|devops|sre|data scientist/i]
}

const SKILL_SIGNALS: SkillSignal[] = [
  { label: '产品规划', patterns: ['产品规划', '产品路线图', 'roadmap', 'product strategy'], roles: ['product'] },
  { label: '需求分析', patterns: ['需求分析', '需求挖掘', 'requirement analysis', 'user story'], roles: ['product'] },
  { label: 'PRD', patterns: ['prd', '产品文档', '产品需求文档'], roles: ['product'] },
  { label: '用户研究', patterns: ['用户研究', '用户访谈', 'ux research', 'user research'], roles: ['product', 'design'] },
  { label: '竞品分析', patterns: ['竞品分析', '市场分析', 'competitive analysis'], roles: ['product', 'marketing'] },
  { label: 'A/B测试', patterns: ['a/b', 'ab测试', 'ab test', '实验设计'], roles: ['product', 'marketing', 'data'] },
  { label: '增长策略', patterns: ['增长策略', 'growth strategy', '增长实验'], roles: ['marketing', 'product'] },
  { label: 'GTM策略', patterns: ['gtm', 'go to market', 'go-to-market'], roles: ['marketing', 'product', 'business'] },
  { label: '定价策略', patterns: ['定价策略', 'pricing strategy'], roles: ['product', 'business'] },
  { label: '数据分析', patterns: ['数据分析', 'data analysis', '分析洞察', 'business analysis'], roles: ['data', 'product', 'marketing'] },
  { label: '商业分析', patterns: ['商业分析', 'business analyst', 'business analysis'], roles: ['data', 'business'] },
  { label: 'SQL', patterns: ['sql', 'mysql', 'postgresql'], roles: ['data', 'tech', 'product'] },
  { label: 'Excel', patterns: ['excel', '数据透视表', 'vlookup'], roles: ['data', 'operations', 'business'] },
  { label: 'Tableau', patterns: ['tableau'], roles: ['data'] },
  { label: 'Power BI', patterns: ['power bi', /\bbi\b/i], roles: ['data'] },
  { label: 'Google Analytics', patterns: ['google analytics', 'ga4', /\bga\b/i], roles: ['marketing', 'data'] },
  { label: 'SEO', patterns: ['seo', '搜索优化'], roles: ['marketing'] },
  { label: 'SEM', patterns: ['sem', '搜索投放'], roles: ['marketing'] },
  { label: '内容营销', patterns: ['内容营销', 'content marketing', '内容策划'], roles: ['marketing'] },
  { label: '文案写作', patterns: ['文案', 'copywriting', '内容写作'], roles: ['marketing'] },
  { label: '品牌营销', patterns: ['品牌营销', 'brand marketing', '品牌传播'], roles: ['marketing'] },
  { label: '广告投放', patterns: ['广告投放', 'performance marketing', '广告优化'], roles: ['marketing'] },
  { label: '社媒运营', patterns: ['社媒运营', 'social media', 'social campaign'], roles: ['marketing', 'operations'] },
  { label: '活动运营', patterns: ['活动运营', 'campaign', '活动策划'], roles: ['marketing', 'operations'] },
  { label: '社区运营', patterns: ['社区运营', 'community management', 'community'], roles: ['operations', 'marketing'] },
  { label: '用户运营', patterns: ['用户运营', '用户增长', 'retention'], roles: ['operations', 'marketing'] },
  { label: '私域运营', patterns: ['私域', 'crm运营', 'wechat ecosystem', '微信生态'], roles: ['operations', 'marketing'] },
  { label: '电商运营', patterns: ['电商运营', 'e-commerce', 'shopify', 'amazon'], roles: ['operations', 'marketing'] },
  { label: '跨境电商', patterns: ['跨境电商', 'cross-border ecommerce', '海外电商'], roles: ['operations', 'business'] },
  { label: 'KOL合作', patterns: ['kol', 'koc', '达人合作', 'influencer'], roles: ['marketing'] },
  { label: '邮件营销', patterns: ['邮件营销', 'email marketing', 'newsletter'], roles: ['marketing'] },
  { label: '小红书运营', patterns: ['小红书', 'xiaohongshu'], roles: ['marketing'] },
  { label: '抖音运营', patterns: ['抖音', 'tiktok'], roles: ['marketing'] },
  { label: 'CRM', patterns: ['crm', '客户关系管理'], roles: ['business', 'marketing', 'operations'] },
  { label: 'Salesforce', patterns: ['salesforce'], roles: ['business', 'operations'] },
  { label: 'HubSpot', patterns: ['hubspot'], roles: ['business', 'marketing'] },
  { label: '商务拓展', patterns: ['商务拓展', 'business development', /\bbd\b/i], roles: ['business'] },
  { label: '渠道拓展', patterns: ['渠道拓展', 'channel sales', 'partner'], roles: ['business', 'sales'] },
  { label: '客户成功', patterns: ['客户成功', 'customer success'], roles: ['business', 'operations'] },
  { label: '线索转化', patterns: ['线索转化', 'lead generation', 'lead nurture'], roles: ['business', 'marketing'] },
  { label: '销售管理', patterns: ['销售管理', 'sales management', 'pipeline'], roles: ['business'] },
  { label: '项目管理', patterns: ['项目管理', 'project management', '项目推进'], roles: ['product', 'operations', 'business'] },
  { label: '流程优化', patterns: ['流程优化', 'process improvement', '运营优化'], roles: ['operations', 'business'] },
  { label: 'SOP', patterns: ['sop', '标准流程', '标准化流程'], roles: ['operations'] },
  { label: '供应链管理', patterns: ['供应链', 'supply chain', '采购管理'], roles: ['operations'] },
  { label: '招聘', patterns: ['招聘', 'recruiting', 'talent acquisition'], roles: ['hr'] },
  { label: '雇主品牌', patterns: ['雇主品牌', 'employer branding'], roles: ['hr', 'marketing'] },
  { label: '培训体系', patterns: ['培训体系', 'learning and development', '组织发展'], roles: ['hr'] },
  { label: 'Figma', patterns: ['figma'], roles: ['design', 'product'] },
  { label: 'Notion', patterns: ['notion'], roles: ['product', 'operations'] },
  { label: 'Jira', patterns: ['jira'], roles: ['product', 'tech'] },
  { label: 'Python', patterns: ['python'], roles: ['tech', 'data'] },
  { label: 'JavaScript', patterns: ['javascript'], roles: ['tech'] },
  { label: 'TypeScript', patterns: ['typescript'], roles: ['tech'] },
  { label: 'React', patterns: ['react'], roles: ['tech'] },
  { label: 'Node.js', patterns: ['node.js', 'nodejs'], roles: ['tech'] },
  { label: 'Docker', patterns: ['docker'], roles: ['tech'] },
  { label: 'Kubernetes', patterns: ['kubernetes', 'k8s'], roles: ['tech'] },
  { label: '机器学习', patterns: ['机器学习', 'machine learning'], roles: ['tech', 'data'] },
  { label: '英语沟通', patterns: ['英语', '英文', 'english', 'bilingual'], roles: ['product', 'marketing', 'business', 'operations'], soft: true },
  { label: '沟通协作', patterns: ['沟通能力', '沟通协作', 'cross-functional', 'stakeholder'], roles: ['product', 'marketing', 'business', 'operations'], soft: true },
  { label: '跨部门协作', patterns: ['跨部门', '跨团队', 'cross functional', '跨职能'], roles: ['product', 'operations', 'business'], soft: true },
  { label: '数据驱动', patterns: ['数据驱动', 'data-driven'], roles: ['product', 'marketing', 'operations'], soft: true },
  { label: 'OKR/KPI', patterns: ['okr', 'kpi'], roles: ['operations', 'business', 'hr'], soft: true }
]

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\u3000/g, ' ')
    .replace(/[（）()【】\[\]]/g, ' ')
    .replace(/[，、；：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countOccurrences(text: string, pattern: string | RegExp): number {
  if (pattern instanceof RegExp) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    const regex = new RegExp(pattern.source, flags)
    return Array.from(text.matchAll(regex)).length
  }

  if (!pattern) return 0
  return text.includes(pattern.toLowerCase()) ? 1 : 0
}

function resolveRoleHints(text: string): string[] {
  return Object.entries(ROLE_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([role]) => role)
}

export function extractJobSkillKeywords(params: {
  title?: string
  description?: string
  requirements?: string[] | string
  category?: string
  translations?: { description?: string | null } | null
  limit?: number
}): string[] {
  const baseText = [
    params.title,
    params.category,
    params.description,
    Array.isArray(params.requirements) ? params.requirements.join('\n') : params.requirements,
    params.translations?.description
  ].filter(Boolean).join('\n')

  const normalizedText = normalizeText(baseText)
  if (!normalizedText) return []

  const roleHints = resolveRoleHints(normalizedText)
  const scores = new Map<string, number>()

  for (const signal of SKILL_SIGNALS) {
    let score = 0
    for (const pattern of signal.patterns) {
      score += countOccurrences(normalizedText, pattern) * 3
    }

    if (score === 0) continue

    if (signal.roles?.some((role) => roleHints.includes(role))) score += 2
    if (signal.soft) score -= 1

    scores.set(signal.label, Math.max(score, 1))
  }

  const hardSkills = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([label]) => label)

  const limit = Math.max(4, Math.min(params.limit || 12, 16))
  const preferred = hardSkills.filter((label) => {
    const signal = SKILL_SIGNALS.find((item) => item.label === label)
    return !signal?.soft
  })
  const soft = hardSkills.filter((label) => !preferred.includes(label))

  return [...preferred, ...soft].slice(0, limit)
}
