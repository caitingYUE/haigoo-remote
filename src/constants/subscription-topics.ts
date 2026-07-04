import { JOB_CATEGORY_OPTIONS } from '../../lib/shared/job-categories.js'

export const MAX_SUBSCRIPTION_TOPICS = 3

export const SUBSCRIPTION_TOPIC_ALIASES: Record<string, string[]> = {
  '后端开发': ['backend', 'backend engineer', 'server side', 'java', 'python', 'go', 'node', '服务端'],
  '前端开发': ['frontend', 'front-end', 'frontend engineer', 'fe', 'react', 'vue', 'web 前端'],
  '全栈开发': ['full stack', 'fullstack', 'full-stack', '全栈工程师'],
  '移动开发': ['mobile', 'ios', 'android', 'flutter', 'react native', '移动端'],
  '数据开发': ['data engineer', '数据工程', 'etl', 'bi 开发', '数仓'],
  '服务器开发': ['server', 'server engineer', '服务端开发'],
  '算法工程师': ['algorithm', '算法', 'machine learning engineer', 'ml engineer', 'ai engineer', '人工智能', '机器学习', '大模型'],
  '测试/QA': ['qa', 'test', 'testing', 'quality assurance', '测试工程师'],
  '运维/SRE': ['devops', 'sre', 'site reliability', '运维', '云原生', 'infrastructure'],
  '网络安全': ['security', 'cyber security', '安全工程师', '信息安全'],
  '操作系统/内核': ['os', 'kernel', 'linux kernel', '系统开发'],
  '技术支持': ['technical support', 'support engineer', '技术客服'],
  '硬件开发': ['hardware', 'embedded', '嵌入式', '芯片'],
  '架构师': ['architect', 'solution architect', '架构'],
  'CTO/技术管理': ['cto', '技术负责人', 'engineering manager', '技术管理', '研发管理'],
  '软件开发': ['software engineer', 'software developer', '软件工程师', '开发工程师'],
  '产品经理': ['pm', 'product manager', 'product owner', '产品管理', '产品负责人', 'ai 产品经理', 'ai产品经理', 'aigc 产品经理'],
  '产品设计': ['product designer', '产品体验', '交互设计'],
  '项目管理': ['project manager', 'program manager', 'project management', '项目经理', '项目管理'],
  'UI/UX设计': ['ui', 'ux', 'ui/ux', 'ux designer', 'ui designer', '用户体验', '界面设计'],
  '视觉设计': ['visual designer', '视觉', '品牌设计'],
  '平面设计': ['graphic designer', 'graphic', '平面'],
  '用户研究': ['user research', 'ux research', '用户调研', '用研'],
  '市场营销': ['marketing', 'digital marketing', '品牌营销', '增长营销'],
  '销售': ['sales', '销售代表', '销售经理'],
  '客户经理': ['account manager', 'customer success', '客户成功', '客户经理', 'am', 'cs'],
  '客户服务': ['customer service', 'customer support', '客服', '客户支持'],
  '运营': ['operations', 'operation', '运营专员', '产品运营', '用户运营', '海外运营'],
  '增长黑客': ['growth', 'growth hacker', '增长', '增长运营'],
  '内容创作': ['content', 'copywriter', 'writer', '文案', '编辑', '内容运营'],
  '商务拓展': ['bd', 'business development', 'partnership', '商务', '渠道'],
  '人力资源': ['hr', 'human resources', '人事'],
  '招聘': ['recruiter', 'talent acquisition', '招聘专员'],
  '财务': ['finance', 'accounting', '会计'],
  '法务': ['legal', 'law', '律师'],
  '行政': ['admin', 'administration', '行政助理'],
  '管理': ['management', 'manager', '管理岗'],
  '数据分析': ['data analyst', 'analytics', '数据分析师', 'bi'],
  '商业分析': ['business analyst', 'ba', '商业分析师'],
  '数据科学': ['data scientist', 'data science', '数据科学家'],
  '教育培训': ['education', 'training', 'teacher', '培训'],
  '咨询': ['consulting', 'consultant', '顾问'],
  '投资': ['investment', 'vc', 'pe', '投融资'],
  '游戏': ['game', 'gaming', '游戏策划', '游戏运营'],
  '其他': ['other']
}

export const LEGACY_SUBSCRIPTION_TOPIC_MAP: Record<string, string> = {
  'full-stack': '全栈开发',
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动开发',
  devops: '运维/SRE',
  qa: '测试/QA',
  security: '网络安全',
  data: '数据分析',
  'ai-ml': '算法工程师',
  'product-management': '产品经理',
  'project-management': '项目管理',
  'ui-ux': 'UI/UX设计',
  marketing: '市场营销',
  sales: '销售',
  content: '内容创作',
  'customer-support': '客户服务',
  hr: '人力资源',
  finance: '财务',
  legal: '法务'
}

export const SUBSCRIPTION_TOPICS = JOB_CATEGORY_OPTIONS.map(label => ({
  value: label,
  label,
  aliases: SUBSCRIPTION_TOPIC_ALIASES[label] || []
}))

export function normalizeSubscriptionTopicValue(value: string) {
  const nextValue = String(value || '').trim()
  return LEGACY_SUBSCRIPTION_TOPIC_MAP[nextValue] || nextValue
}

export function getSubscriptionTopicSearchText(topic: { value: string; label: string; aliases?: readonly string[] }) {
  return [topic.value, topic.label, ...(topic.aliases || [])]
    .join(' ')
    .toLowerCase()
}
