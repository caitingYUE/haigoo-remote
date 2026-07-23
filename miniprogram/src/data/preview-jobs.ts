import type { MiniJob } from '../types'

const baseApplication = {
  mode: 'website' as const,
  hasWebsiteApply: true,
  hasEmailApply: false,
  hasReferral: false
}

export const previewJobs: MiniJob[] = [
  ['全球市场资深软件工程师（后端）', 'Airbnb', '后端开发', ['技术主管', '架构设计', '英语流利']],
  ['软件工程师，社区支持工程', 'Remote People', '软件开发', ['软件开发', '大型后端系统', '英语流利']],
  ['社区支持工程部机器学习工程师', 'LILT', '人工智能', ['ML 工程', 'Gen AI', 'LLM']],
  ['全球产品经理', 'GitLab', '产品经理', ['B2B 产品', '远程协作', 'SaaS']],
  ['品牌与内容市场经理', 'Automattic', '市场营销', ['内容营销', '品牌策略', '英语流利']],
  ['远程招聘顾问', 'Deel', '人力资源', ['全球招聘', '人才发展', '远程协作']]
].map(([title, company, category, tags], index) => ({
  id: `preview-${index + 1}`,
  title: String(title),
  company: String(company),
  companyColor: '#f2f0ff',
  logoUrl: '/assets/haigoo-avatar.png',
  location: '全球远程',
  type: '全职',
  salary: '薪资 Open',
  category: String(category),
  tags: tags as string[],
  featured: index < 3,
  application: baseApplication,
  description: '加入一支分布式国际团队，在清晰的远程协作机制下参与产品和业务建设。',
  responsibilities: ['与跨职能团队协作推进核心项目', '持续提升产品、工程与交付质量'],
  requirements: ['具备相关岗位经验', '可以使用英语进行异步协作'],
  benefits: ['全球远程', '灵活工作时间'],
  companyIndustry: '互联网与软件服务',
  companyAddress: '全球分布式团队',
  companyDescription: `${company} 是一家支持全球分布式协作的远程友好企业。`,
  companyWebsite: 'https://haigooremote.com',
  companyTags: ['远程友好', '全球团队'],
  publishedLabel: index === 0 ? '5 小时前' : `${index + 1} 天前`
}))

export const previewCategories = [
  { label: '后端开发', value: '后端开发', count: 96 },
  { label: '市场营销', value: '市场营销', count: 82 },
  { label: '产品经理', value: '产品经理', count: 68 },
  { label: '人力资源', value: '人力资源', count: 54 },
  { label: '人工智能', value: '人工智能', count: 47 },
  { label: '软件开发', value: '软件开发', count: 41 }
]
