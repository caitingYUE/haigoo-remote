/**
 * 推荐历史服务
 * 管理过往推荐数据的存储和检索
 */

import { Job } from '../types'

export interface DailyRecommendation {
  date: string // YYYY-MM-DD 格式
  jobs: Job[]
  updateTime: string // ISO 时间戳
  totalJobs: number
}

export interface RecommendationHistory {
  [date: string]: DailyRecommendation
}

class RecommendationHistoryService {
  private readonly STORAGE_KEY = 'haigoo_recommendation_history'
  private readonly MAX_HISTORY_DAYS = 7

  /**
   * 保存当日推荐数据
   */
  saveDailyRecommendation(jobs: Job[]): void {
    try {
      const today = this.getTodayDateString()
      const history = this.getHistory()
      
      const dailyRecommendation: DailyRecommendation = {
        date: today,
        jobs: jobs.slice(0, 6), // 只保存前6个推荐职位
        updateTime: new Date().toISOString(),
        totalJobs: jobs.length
      }

      history[today] = dailyRecommendation
      
      // 清理超过7天的历史数据
      this.cleanOldHistory(history)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('保存推荐历史失败:', error)
    }
  }

  /**
   * 获取完整历史记录
   */
  getHistory(): RecommendationHistory {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('获取推荐历史失败:', error)
      return {}
    }
  }

  /**
   * 获取指定日期的推荐数据
   */
  getRecommendationByDate(date: string): DailyRecommendation | null {
    const history = this.getHistory()
    return history[date] || null
  }

  /**
   * 获取过往N天的推荐数据（不包括今天）
   */
  getPastRecommendations(days: number = 7): DailyRecommendation[] {
    const history = this.getHistory()
    const today = this.getTodayDateString()
    const pastDates = this.getPastDates(days)
    
    return pastDates
      .filter(date => date !== today) // 排除今天
      .map(date => history[date])
      .filter(Boolean) // 过滤掉不存在的数据
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // 按日期倒序
  }

  /**
   * 获取可用的历史日期列表
   */
  getAvailableDates(): string[] {
    const history = this.getHistory()
    const today = this.getTodayDateString()
    
    return Object.keys(history)
      .filter(date => date !== today) // 排除今天
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // 按日期倒序
  }

  /**
   * 检查今天是否已有推荐数据
   */
  hasTodayRecommendation(): boolean {
    const today = this.getTodayDateString()
    const history = this.getHistory()
    return !!history[today]
  }

  /**
   * 获取今天的推荐数据
   */
  getTodayRecommendation(): DailyRecommendation | null {
    const today = this.getTodayDateString()
    return this.getRecommendationByDate(today)
  }

  /**
   * 清理历史数据
   */
  clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const history = this.getHistory()
    const dates = Object.keys(history)
    const totalDays = dates.length
    const totalJobs = Object.values(history).reduce((sum, day) => sum + day.totalJobs, 0)
    const avgJobsPerDay = totalDays > 0 ? Math.round(totalJobs / totalDays) : 0

    return {
      totalDays,
      totalJobs,
      avgJobsPerDay,
      oldestDate: dates.length > 0 ? Math.min(...dates.map(d => new Date(d).getTime())) : null,
      newestDate: dates.length > 0 ? Math.max(...dates.map(d => new Date(d).getTime())) : null
    }
  }

  // 私有方法

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  }

  private getPastDates(days: number): string[] {
    const dates: string[] = []
    const today = new Date()
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    return dates
  }

  private cleanOldHistory(history: RecommendationHistory): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_HISTORY_DAYS)
    const cutoffString = cutoffDate.toISOString().split('T')[0]

    Object.keys(history).forEach(date => {
      if (date < cutoffString) {
        delete history[date]
      }
    })
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
}

// 创建单例实例
export const recommendationHistoryService = new RecommendationHistoryService()