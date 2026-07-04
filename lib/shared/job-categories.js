export const JOB_CATEGORY_OPTIONS = [
  '后端开发', '前端开发', '全栈开发', '移动开发', '数据开发', '服务器开发',
  '算法工程师', '测试/QA', '运维/SRE', '网络安全', '操作系统/内核',
  '技术支持', '硬件开发', '架构师', 'CTO/技术管理', '软件开发',
  '平台工程师', '数据库工程师', '安全工程师', '浏览器开发', '部署工程师',
  '网络工程师', '机械工程师', '变压器工程师',
  '产品经理', '产品设计', '项目管理', 'UI/UX设计', '视觉设计', '平面设计', '用户研究',
  '设计', '创意设计', '营销设计',
  '市场营销', '销售', '客户经理', '客户服务', '运营', '增长黑客', '内容创作', '商务拓展',
  '编辑/出版', '视频剪辑',
  '人力资源', '招聘', '财务', '法务', '行政', '管理', '采购', '供应链',
  '心理咨询师', '医生/护理', '营养师', '健身教练/指导',
  '数据分析', '商业分析', '数据科学', '教育培训', '课程导师', '研究员',
  '语言翻译', 'AI训练师', '经济学家', '咨询', '投资', '游戏', '其他'
]

export function normalizeJobCategoryList(input = []) {
  const values = Array.isArray(input) ? input : String(input || '').split(',')
  const whitelist = new Set(JOB_CATEGORY_OPTIONS)

  return values
    .map((value) => String(value || '').trim())
    .filter((value) => value && whitelist.has(value))
}
