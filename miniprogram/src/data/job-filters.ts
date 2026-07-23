export interface JobCategoryFilter {
  label: string
  value: string
  featured?: boolean
}

// Keep these values aligned with the website homepage's manual-selection tabs.
// The mini-program applies the same category rules to the complete job pool.
export const MINI_JOB_CATEGORY_FILTERS: JobCategoryFilter[] = [
  { label: '🔥 热门', value: '', featured: true },
  { label: '自由职业', value: 'freelance' },
  { label: '人事行政', value: '人力资源,招聘,财务,会计,法务,行政,管理,客户服务,HR,Recruiter,Talent Acquisition,Finance,Legal,Admin' },
  { label: '产品设计', value: '产品经理,产品设计,营销设计,网站和营销设计,视觉设计,平面设计,创意设计,UI/UX设计,用户研究,增长黑客,Product Manager,Product Designer,Marketing Designer,Visual Designer,Graphic Designer,Creative Designer,UI,UX,Growth' },
  { label: '技术研发', value: '前端开发,后端开发,全栈开发,软件开发,移动开发,算法工程师,测试/QA,数据开发,数据库工程师,平台工程师,服务器开发,运维/SRE,网络安全,架构师,技术支持,工程,开发,Engineer,Developer,Frontend,Backend,Full Stack,Software,QA,DevOps,Data Engineer' },
  { label: '运营营销', value: 'Marketing,Digital Marketing,Content,Social Media,Growth,Operations,Project Manager,市场,营销,运营,增长' },
  { label: '销售商务', value: 'Sales,Account Manager,Business Development,Customer Success,销售,客户经理,BD,商务' }
]
