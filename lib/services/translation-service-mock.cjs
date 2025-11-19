/**
 * Mock翻译服务 - 用于测试和开发
 * 使用简单的规则模拟翻译，而不依赖外部API
 * 
 * 优点：
 * 1. 无需网络请求，响应快速
 * 2. 无API限流问题
 * 3. 在任何环境都能稳定运行
 * 4. 便于调试和测试
 */

// 简单的职位相关翻译字典（扩展版）
const translationDict = {
  // 职位类型 - 开发类
  'Senior': '高级',
  'Junior': '初级',
  'Lead': '首席',
  'Staff': '资深',
  'Principal': '首席',
  'Software Engineer': '软件工程师',
  'Frontend Developer': '前端开发工程师',
  'Backend Developer': '后端开发工程师',
  'Full Stack Developer': '全栈开发工程师',
  'Full-Stack Developer': '全栈开发工程师',
  'DevOps Engineer': 'DevOps工程师',
  'Mobile Developer': '移动开发工程师',
  'iOS Developer': 'iOS开发工程师',
  'Android Developer': 'Android开发工程师',
  'Web Developer': 'Web开发工程师',
  'Cloud Engineer': '云计算工程师',
  'Site Reliability Engineer': '网站可靠性工程师',
  'SRE': '网站可靠性工程师',
  
  // 职位类型 - 数据/AI类
  'Data Scientist': '数据科学家',
  'Data Engineer': '数据工程师',
  'Data Analyst': '数据分析师',
  'Machine Learning Engineer': '机器学习工程师',
  'AI Engineer': 'AI工程师',
  'ML Engineer': '机器学习工程师',
  
  // 职位类型 - 产品/设计类
  'Product Manager': '产品经理',
  'Product Designer': '产品设计师',
  'UI/UX Designer': 'UI/UX设计师',
  'UX Designer': 'UX设计师',
  'UI Designer': 'UI设计师',
  'Graphic Designer': '平面设计师',
  
  // 职位类型 - 其他技术类
  'QA Engineer': '测试工程师',
  'Test Engineer': '测试工程师',
  'Security Engineer': '安全工程师',
  'Technical Writer': '技术文档工程师',
  'Engineering Manager': '工程经理',
  'Technical Lead': '技术主管',
  'Team Lead': '团队负责人',
  'Architect': '架构师',
  'Solutions Architect': '解决方案架构师',
  
  // 职位类型 - 业务类
  'Sales': '销售',
  'Marketing': '市场营销',
  'Business Analyst': '业务分析师',
  'Account Manager': '客户经理',
  'Customer Success': '客户成功',
  'Support': '支持',
  'Content': '内容',
  'Writer': '写作',
  'Editor': '编辑',
  
  // 工作类型
  'Remote': '远程',
  'Full-time': '全职',
  'Part-time': '兼职',
  'Contract': '合同',
  'Freelance': '自由职业',
  'Temporary': '临时',
  'Internship': '实习',
  
  // 经验等级
  'Entry Level': '入门级',
  'Mid Level': '中级',
  'Mid-Level': '中级',
  'Experienced': '有经验',
  'Expert': '专家',
  
  // 常用动词
  'We are looking for': '我们正在寻找',
  'Join our team': '加入我们的团队',
  'Join us': '加入我们',
  'Join': '加入',
  'Apply': '申请',
  'Apply now': '立即申请',
  'Build': '构建',
  'Develop': '开发',
  'Design': '设计',
  'Create': '创建',
  'Manage': '管理',
  'Lead': '领导',
  'Work': '工作',
  'Help': '帮助',
  'Support': '支持',
  
  // 常用名词
  'Required': '要求',
  'Requirements': '要求',
  'Responsibilities': '职责',
  'Experience': '经验',
  'Skills': '技能',
  'Qualifications': '资格',
  'Benefits': '福利',
  'Salary': '薪资',
  'Location': '地点',
  'Team': '团队',
  'Company': '公司',
  'Project': '项目',
  'Product': '产品',
  
  // 技能相关
  'Programming': '编程',
  'Coding': '编码',
  'Development': '开发',
  'Testing': '测试',
  'Debugging': '调试',
  'Deployment': '部署',
  'Monitoring': '监控',
  'Optimization': '优化',
  
  // 工作方式
  'Remote work': '远程工作',
  'Remote-first': '远程优先',
  'Flexible hours': '弹性工作时间',
  'Flexible': '灵活',
  'Work from home': '在家工作',
  'Work from anywhere': '随地办公',
  'Hybrid': '混合',
  
  // 福利相关
  'Competitive salary': '有竞争力的薪资',
  'Competitive': '有竞争力',
  'Health insurance': '健康保险',
  'Paid time off': '带薪休假',
  'Vacation': '假期',
  'Stock options': '股票期权',
  'Equity': '股权',
  'Bonus': '奖金',
  'Training': '培训',
  'Career growth': '职业发展',
  'Professional development': '职业发展',
}

/**
 * Mock翻译单个文本
 * @param {string} text - 需要翻译的文本
 * @returns {string} 翻译后的文本
 */
function mockTranslateText(text) {
  if (!text || typeof text !== 'string') {
    return text
  }

  let translated = text

  // 使用字典进行简单替换
  for (const [en, zh] of Object.entries(translationDict)) {
    const regex = new RegExp(en, 'gi')
    translated = translated.replace(regex, zh)
  }

  // 如果没有任何翻译，添加一个标记
  if (translated === text) {
    translated = `[译] ${text}`
  }

  return translated
}

/**
 * 批量Mock翻译文本
 * @param {string[]} texts - 需要翻译的文本数组
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
async function translateBatch(texts) {
  if (!texts || texts.length === 0) {
    return []
  }

  console.log(`🔤 Mock翻译 ${texts.length} 个文本`)
  
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 100))

  const translated = texts.map(text => mockTranslateText(text))
  
  console.log(`✅ Mock翻译完成`)
  return translated
}

/**
 * Mock翻译单个岗位
 * @param {object} job - 岗位数据
 * @returns {Promise<object>} 翻译后的岗位数据
 */
async function translateJob(job) {
  if (!job) {
    return job
  }

  try {
    // 如果已经翻译过，直接返回
    if (job.translations && job.translations.title) {
      console.log(`⏭️ 岗位 [${job.id}] 已翻译，跳过`)
      return job
    }

    // 准备需要翻译的字段
    const textsToTranslate = []
    const textKeys = []

    if (job.title) {
      textsToTranslate.push(job.title)
      textKeys.push('title')
    }

    if (job.description) {
      const desc = job.description.substring(0, 500)
      textsToTranslate.push(desc)
      textKeys.push('description')
    }

    if (job.location) {
      textsToTranslate.push(job.location)
      textKeys.push('location')
    }

    if (job.type || job.jobType) {
      textsToTranslate.push(job.type || job.jobType)
      textKeys.push('type')
    }

    if (textsToTranslate.length === 0) {
      return {
        ...job,
        translations: {},
        isTranslated: false
      }
    }

    // 批量翻译
    const translations = await translateBatch(textsToTranslate)

    // 构建翻译对象
    const translationObj = {}
    textKeys.forEach((key, index) => {
      translationObj[key] = translations[index] || textsToTranslate[index]
    })

    // 公司名称不翻译
    if (job.company) {
      translationObj.company = job.company
    }

    return {
      ...job,
      translations: translationObj,
      translatedAt: new Date().toISOString(),
      isTranslated: true
    }
  } catch (error) {
    console.error(`❌ Mock翻译岗位失败 [${job.id}]:`, error.message)
    return {
      ...job,
      translations: null,
      isTranslated: false
    }
  }
}

/**
 * 批量Mock翻译岗位
 * @param {object[]} jobs - 岗位数据数组
 * @returns {Promise<object[]>} 翻译后的岗位数组
 */
async function translateJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    return []
  }

  console.log(`🌍 开始Mock批量翻译 ${jobs.length} 个岗位...`)
  const startTime = Date.now()

  try {
    // 筛选需要翻译的岗位
    const jobsToTranslate = jobs.filter(job => !job.isTranslated)
    console.log(`📝 需要翻译: ${jobsToTranslate.length}/${jobs.length}`)

    if (jobsToTranslate.length === 0) {
      console.log(`✅ 所有岗位已翻译`)
      return jobs
    }

    // 并发翻译，但限制并发数
    const batchSize = 10
    const translatedJobs = []

    for (let i = 0; i < jobsToTranslate.length; i += batchSize) {
      const batch = jobsToTranslate.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(job => translateJob(job))
      )
      translatedJobs.push(...batchResults)
      
      console.log(`  翻译进度: ${Math.min(i + batchSize, jobsToTranslate.length)}/${jobsToTranslate.length}`)
    }

    const duration = Date.now() - startTime
    const successCount = translatedJobs.filter(j => j.isTranslated).length
    
    console.log(`✅ Mock批量翻译完成: ${successCount}/${translatedJobs.length} 成功, 耗时 ${duration}ms`)

    // 合并翻译结果
    const result = jobs.map(job => {
      if (job.isTranslated) return job
      return translatedJobs.find(t => t.id === job.id) || job
    })

    return result

  } catch (error) {
    console.error('❌ Mock批量翻译失败:', error)
    // 失败时返回原数据
    return jobs
  }
}

module.exports = {
  translateBatch,
  translateJob,
  translateJobs
}

