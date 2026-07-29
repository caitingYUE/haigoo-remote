import type { SubscriptionOption } from '../services/subscription-service'

export interface SubscriptionTopicGroup {
  title: string
  keywords: readonly string[]
  options: SubscriptionOption[]
}

const SUBSCRIPTION_TOPIC_GROUPS = [
  {
    title: '技术研发',
    keywords: ['前端', '后端', '全栈', '移动', '算法', '数据开发', '测试', 'QA', '运维', 'SRE', '安全', '架构', '技术', '工程', '开发', 'CTO', '内核', '硬件', '数据库', '平台', '服务器', '浏览器', '部署']
  },
  {
    title: '产品设计',
    keywords: ['产品经理', '产品设计', '营销设计', '视觉设计', '平面设计', '创意设计', 'UI', 'UX', '项目', '增长', '用户研究']
  },
  {
    title: '市场销售',
    keywords: ['市场', '品牌', '销售', '商务', '客户经理', '营销']
  },
  {
    title: '运营客服',
    keywords: ['运营', '产品运营', '活动运营', '客户服务', '客户支持', '内容', '编辑', '出版', '视频剪辑']
  },
  {
    title: '职能服务',
    keywords: ['人力', '招聘', '财务', '会计', '法务', '行政', '管理', '采购', '供应链', '医生', '护理', '营养师', '健身教练', '心理咨询']
  },
  {
    title: '数据教育',
    keywords: ['数据分析', '商业分析', '数据科学', '教育', '培训', '课程', '导师', '研究员', '投资', '游戏', '语言翻译', '翻译', 'AI训练', '经济', '咨询']
  }
] as const

function normalizeRoleText(value: string) {
  return String(value || '').toLowerCase().replace(/\s+/g, '')
}

export function buildSubscriptionTopicGroups(options: SubscriptionOption[]): SubscriptionTopicGroup[] {
  const used = new Set<string>()
  const groups: SubscriptionTopicGroup[] = SUBSCRIPTION_TOPIC_GROUPS
    .map((group) => {
      const groupOptions = options.filter((option) => {
        const text = normalizeRoleText(`${option.label} ${option.value}`)
        return group.keywords.some((keyword) => text.includes(normalizeRoleText(keyword)))
      })
      groupOptions.forEach((option) => used.add(option.value))
      return { ...group, options: groupOptions }
    })
    .filter((group) => group.options.length > 0)

  const remaining = options.filter((option) => !used.has(option.value))
  if (remaining.length > 0) {
    groups.push({ title: '更多方向', keywords: [], options: remaining })
  }
  return groups
}
