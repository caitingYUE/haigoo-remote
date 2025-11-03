/**
 * 推荐历史服务
 * 管理过往推荐数据的存储和检索
 */

import { Job } from '../types'

export interface DailyRecommendation {
  date: string // YYYY-MM-DD 格式
  jobs: Job[]
  timestamp: number
}

class RecommendationHistoryService {
  private readonly STORAGE_KEY = 'haigoo_recommendation_history'
  private readonly MAX_DAYS = 3 // 最多保存3天的历史数据

  // 保存每日推荐
  saveDailyRecommendation(jobs: Job[]): void {
    try {
      const today = new Date().toISOString().split('T')[0]
      const timestamp = Date.now()
      const recommendationId = `rec_${today}_${timestamp}`
      
      // 为每个岗位添加推荐时间戳和ID
      const jobsWithRecommendationData = jobs.slice(0, 6).map((job, index) => ({
        ...job,
        recommendationId,
        recommendedAt: new Date().toISOString(),
        recommendationGroup: Math.floor(index / 3) + 1 // 每3个岗位为一组
      }))
      
      const history = this.getHistory()
      
      // 检查今天是否已有推荐
      const existingIndex = history.findIndex(item => item.date === today)
      
      const newRecommendation: DailyRecommendation = {
        date: today,
        jobs: jobsWithRecommendationData,
        timestamp
      }
      
      if (existingIndex >= 0) {
        // 更新今天的推荐
        history[existingIndex] = newRecommendation
      } else {
        // 添加新的推荐
        history.unshift(newRecommendation)
      }
      
      // 清理超过3天的数据
      this.cleanupOldData(history)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('保存推荐历史失败:', error)
    }
  }

  // 保存指定日期的推荐（用于测试数据生成）
  saveRecommendationForDate(jobs: Job[], date: string): void {
    try {
      const timestamp = new Date(date).getTime()
      const recommendationId = `rec_${date}_${timestamp}`
      
      // 为每个岗位添加推荐时间戳和ID
      const jobsWithRecommendationData = jobs.slice(0, 6).map((job, index) => ({
        ...job,
        recommendationId,
        recommendedAt: new Date(date).toISOString(),
        recommendationGroup: Math.floor(index / 3) + 1 // 每3个岗位为一组
      }))
      
      const history = this.getHistory()
      
      // 检查指定日期是否已有推荐
      const existingIndex = history.findIndex(item => item.date === date)
      
      const newRecommendation: DailyRecommendation = {
        date,
        jobs: jobsWithRecommendationData,
        timestamp
      }
      
      if (existingIndex >= 0) {
        // 更新指定日期的推荐
        history[existingIndex] = newRecommendation
      } else {
        // 添加新的推荐，按日期排序插入
        history.push(newRecommendation)
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }
      
      // 清理超过3天的数据
      this.cleanupOldData(history)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('保存指定日期推荐失败:', error)
    }
  }

  // 私有方法：获取历史数据
  private getHistory(): DailyRecommendation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('读取历史数据失败:', error)
      return []
    }
  }

  // 获取指定日期的推荐
  getRecommendationsByDate(date: string): DailyRecommendation | null {
    try {
      const history = this.getHistory()
      return history.find(item => item.date === date) || null
    } catch (error) {
      console.error('获取指定日期推荐失败:', error)
      return null
    }
  }

  // 获取过往N天的推荐（不包括今天）
  getPastRecommendations(days: number = 3): DailyRecommendation[] {
    try {
      const history = this.getHistory()
      const today = new Date().toISOString().split('T')[0]
      
      // 过滤掉今天的数据，只返回过往的推荐
      return history
        .filter(item => item.date !== today)
        .slice(0, Math.min(days, this.MAX_DAYS))
    } catch (error) {
      console.error('获取历史推荐失败:', error)
      return []
    }
  }

  // 获取昨天的推荐
  getYesterdayRecommendations(): DailyRecommendation | null {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    return this.getRecommendationsByDate(yesterdayStr)
  }

  // 获取前N天的推荐（1=昨天，2=前天，3=大前天）
  getRecommendationsForPastDays(days: number): DailyRecommendation[] {
    const results: DailyRecommendation[] = []
    
    for (let i = 1; i <= Math.min(days, this.MAX_DAYS); i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const recommendation = this.getRecommendationsByDate(dateStr)
      if (recommendation) {
        results.push(recommendation)
      }
    }
    
    return results
  }

  // 获取可用的历史日期
  getAvailableDates(): string[] {
    try {
      const history = this.getHistory()
      const today = new Date().toISOString().split('T')[0]
      
      return history
        .filter(item => item.date !== today)
        .map(item => item.date)
        .slice(0, this.MAX_DAYS)
    } catch (error) {
      console.error('获取可用日期失败:', error)
      return []
    }
  }

  // 检查并获取今日推荐
  getTodayRecommendation(): DailyRecommendation | null {
    const today = new Date().toISOString().split('T')[0]
    return this.getRecommendationsByDate(today)
  }

  // 清除所有历史数据
  clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('清除历史数据失败:', error)
    }
  }

  // 获取统计信息
  getStats(): { totalDays: number; totalJobs: number; oldestDate: string | null } {
    try {
      const history = this.getHistory()
      const totalJobs = history.reduce((sum, day) => sum + day.jobs.length, 0)
      const oldestDate = history.length > 0 ? history[history.length - 1].date : null
      
      return {
        totalDays: history.length,
        totalJobs,
        oldestDate
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return { totalDays: 0, totalJobs: 0, oldestDate: null }
    }
  }

  // 私有方法：清理超过3天的旧数据
  private cleanupOldData(history: DailyRecommendation[]): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_DAYS)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]
    
    // 保留最近3天的数据
    const filtered = history.filter(item => item.date >= cutoffStr)
    
    // 如果过滤后的数据少于原数据，说明有数据被清理
    if (filtered.length < history.length) {
      history.length = 0
      history.push(...filtered)
    }
  }

  /**
   * 格式化日期显示
   */
  formatDateDisplay(dateString: string): string {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const dateStr = date.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (dateStr === todayStr) {
      return '今天'
    } else if (dateStr === yesterdayStr) {
      return '昨天'
    } else {
      const month = date.getMonth() + 1
      const day = date.getDate()
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekday = weekdays[date.getDay()]
      return `${month}月${day}日 ${weekday}`
    }
  }

  /**
   * 获取相对时间描述
   */
  getRelativeTimeDescription(dateString: string): string {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return '今天'
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays <= 7) {
      return `${diffDays}天前`
    } else {
      return '一周前'
    }
  }

  /**
   * 生成测试数据（仅用于开发测试）
   */
  generateTestData(): void {
    const testJobs: Job[] = [
      {
        id: 'test-1',
        title: 'Senior Frontend Developer',
        company: 'TechCorp',
        location: '上海',
        salary: { min: 25000, max: 35000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: '高级前端开发工程师，负责React应用开发和架构设计',
        requirements: ['3年以上前端开发经验', '熟练掌握React/Vue', '了解TypeScript'],
        responsibilities: ['负责前端架构设计', '开发高质量的用户界面', '优化前端性能'],
        skills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
        category: '前端开发',
        experienceLevel: 'Senior',
        isRemote: false,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job1',
        recommendationId: 'rec-test-1',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 1
      },
      {
        id: 'test-2',
        title: 'Full Stack Engineer',
        company: 'StartupXYZ',
        location: '北京',
        salary: { min: 20000, max: 30000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: '全栈开发工程师，负责前后端开发和系统架构',
        requirements: ['2年以上全栈开发经验', '熟悉Node.js和React', '了解数据库设计'],
        responsibilities: ['负责全栈应用开发', '设计和实现API', '数据库设计和优化'],
        skills: ['Node.js', 'React', 'MongoDB', 'Express'],
        category: '全栈开发',
        experienceLevel: 'Mid',
        isRemote: true,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job2',
        recommendationId: 'rec-test-2',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 1
      },
      {
        id: 'test-3',
        title: 'Backend Developer',
        company: 'DataTech',
        location: '深圳',
        salary: { min: 22000, max: 32000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: '后端开发工程师，负责API设计和数据库优化',
        requirements: ['3年以上Java开发经验', '熟悉Spring框架', '了解微服务架构'],
        responsibilities: ['设计和开发后端API', '数据库设计和优化', '系统性能调优'],
        skills: ['Java', 'Spring Boot', 'MySQL', 'Redis'],
        category: '后端开发',
        experienceLevel: 'Mid',
        isRemote: false,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job3',
        recommendationId: 'rec-test-3',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 2
      },
      {
        id: 'test-4',
        title: 'DevOps Engineer',
        company: 'CloudCorp',
        location: '杭州',
        salary: { min: 28000, max: 38000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: 'DevOps工程师，负责CI/CD流程和云基础设施管理',
        requirements: ['3年以上DevOps经验', '熟悉Docker和K8s', '了解云平台服务'],
        responsibilities: ['构建CI/CD流程', '管理云基础设施', '监控系统性能'],
        skills: ['Docker', 'Kubernetes', 'AWS', 'Jenkins'],
        category: 'DevOps',
        experienceLevel: 'Senior',
        isRemote: true,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job4',
        recommendationId: 'rec-test-4',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 2
      },
      {
        id: 'test-5',
        title: 'Data Scientist',
        company: 'AI Labs',
        location: '广州',
        salary: { min: 30000, max: 45000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: '数据科学家，负责机器学习模型开发和数据分析',
        requirements: ['3年以上数据科学经验', '熟悉Python和机器学习', '了解深度学习框架'],
        responsibilities: ['开发机器学习模型', '数据分析和挖掘', '模型部署和优化'],
        skills: ['Python', 'TensorFlow', 'Pandas', 'SQL'],
        category: '数据科学',
        experienceLevel: 'Senior',
        isRemote: false,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job5',
        recommendationId: 'rec-test-5',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 2
      },
      {
        id: 'test-6',
        title: 'Product Manager',
        company: 'ProductCo',
        location: '成都',
        salary: { min: 25000, max: 40000, currency: 'CNY' },
        type: 'full-time',
        postedAt: new Date().toISOString(),
        description: '产品经理，负责产品规划和需求管理',
        requirements: ['3年以上产品管理经验', '熟悉产品设计流程', '了解用户体验设计'],
        responsibilities: ['产品规划和设计', '需求分析和管理', '跨团队协作'],
        skills: ['产品设计', '需求分析', 'Axure', 'Figma'],
        category: '产品管理',
        experienceLevel: 'Mid',
        isRemote: true,
        source: 'TestSource',
        sourceUrl: 'https://example.com/job6',
        recommendationId: 'rec-test-6',
        recommendedAt: new Date().toISOString(),
        recommendationGroup: 2
      }
    ]

    // 生成昨天的推荐
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    this.saveRecommendationForDate(testJobs, yesterday.toISOString().split('T')[0])

    // 生成前天的推荐
    const dayBeforeYesterday = new Date()
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    this.saveRecommendationForDate(testJobs, dayBeforeYesterday.toISOString().split('T')[0])

    // 生成大前天的推荐
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    this.saveRecommendationForDate(testJobs, threeDaysAgo.toISOString().split('T')[0])

    console.log('测试数据已生成，包含过去3天的推荐历史')
  }
}

export const recommendationHistoryService = new RecommendationHistoryService()