/**
 * 推荐历史服务
 * 管理过往推荐数据的存储和检索
 */

import { Job } from '../types'
import { jobAggregator } from './job-aggregator'

export interface DailyRecommendation {
  date: string // YYYY-MM-DD 格式
  jobs: Job[]
  timestamp: number
}

class RecommendationHistoryService {
  private readonly STORAGE_KEY = 'haigoo_recommendation_history'
  private readonly MAX_DAYS = 3 // 最多保存3天的历史数据
  private readonly baseUrl = '/api'
  private readonly defaultUUID = 'default'

  /**
   * 将服务端返回的推荐数据规范化为 DailyRecommendation
   */
  private normalizeServerPayload(payload: any): DailyRecommendation | null {
    if (!payload || typeof payload !== 'object') return null
    const { date, jobs, timestamp } = payload
    if (!date || !Array.isArray(jobs)) return null
    return {
      date,
      jobs: jobs as Job[],
      timestamp: typeof timestamp === 'number' ? timestamp : new Date(`${date}T09:00:00.000Z`).getTime()
    }
  }

  /**
   * 从服务端获取某日推荐
   */
  private async fetchRecommendationFromServer(date: string, uuid: string = this.defaultUUID): Promise<DailyRecommendation | null> {
    try {
      const params = new URLSearchParams({ date, uuid })
      const resp = await fetch(`${this.baseUrl}/recommendations?${params.toString()}`)
      if (!resp.ok) return null
      const data = await resp.json().catch(() => null)
      if (data && data.success && data.data) {
        const normalized = this.normalizeServerPayload(data.data)
        return normalized
      }
      return null
    } catch (error) {
      console.warn('fetchRecommendationFromServer 失败，降级到本地:', error)
      return null
    }
  }

  /**
   * 对某日推荐的岗位列表进行时间一致性校验与清洗（postedAt 不晚于当日）
   */
  private sanitizeJobsForDate(jobs: Job[], dateString: string): Job[] {
    const endOfDay = new Date(`${dateString}T23:59:59`)
    return jobs.filter(job => {
      try {
        const posted = new Date((job as any).postedAt || (job as any).publishedAt)
        return posted.getTime() <= endOfDay.getTime()
      } catch {
        return false
      }
    })
  }

  /**
   * 保存某日推荐到服务端
   */
  private async saveRecommendationToServer(date: string, jobs: Job[], uuid: string = this.defaultUUID): Promise<DailyRecommendation | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, jobs, uuid })
      })
      if (!resp.ok) return null
      const data = await resp.json().catch(() => null)
      if (data && data.success && data.data) {
        const normalized = this.normalizeServerPayload(data.data)
        return normalized
      }
      return null
    } catch (error) {
      console.warn('saveRecommendationToServer 失败:', error)
      return null
    }
  }

  /**
   * 将某日推荐写入本地存储（存在则覆盖），并清理超期数据
   */
  private upsertLocalRecommendation(recommendation: DailyRecommendation): void {
    const history = this.getHistory()
    const idx = history.findIndex(item => item.date === recommendation.date)
    if (idx >= 0) {
      history[idx] = recommendation
    } else {
      history.unshift(recommendation)
    }
    this.cleanupOldData(history)
    this.saveHistory(history)
  }

  /**
   * 基于日期种子生成固定的推荐
   * 确保每天的推荐在刷新后保持一致
   */
  private generateDailyRecommendationSeed(dateString: string): number {
    // 使用日期字符串生成一个固定的种子
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      const char = dateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 基于种子的伪随机数生成器
   */
  private seededRandom(seed: number): () => number {
    let currentSeed = seed;
    return function() {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }

  /**
   * 获取指定日期的固定推荐职位
   */
  private getFixedRecommendationsForDate(dateString: string): Job[] {
    // 获取所有可用的职位，并确保发布时间不晚于该日期（避免历史推荐出现“今天”）
    const allJobs = jobAggregator.getJobs();
    if (allJobs.length === 0) {
      return [];
    }

    // 以本地时区计算当日的结束时间
    const endOfDay = new Date(`${dateString}T23:59:59`);
    const eligibleJobs = allJobs.filter(job => {
      try {
        const publishDate = new Date(job.publishedAt);
        return publishDate.getTime() <= endOfDay.getTime();
      } catch {
        // 无法解析发布时间的岗位直接排除，避免不确定性
        return false;
      }
    });

    if (eligibleJobs.length === 0) {
      return [];
    }

    // 生成基于日期的种子
    const seed = this.generateDailyRecommendationSeed(dateString);
    const random = this.seededRandom(seed);
    
    // 使用种子随机选择职位，确保每天的选择是固定的
    const shuffledJobs = [...eligibleJobs];
    
    // Fisher-Yates 洗牌算法，使用固定种子
    for (let i = shuffledJobs.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffledJobs[i], shuffledJobs[j]] = [shuffledJobs[j], shuffledJobs[i]];
    }
    
    // 选择前6个职位作为推荐
    const selectedJobs = shuffledJobs.slice(0, 6);
    
    // 为每个岗位添加推荐相关信息
    return selectedJobs.map((job, index) => ({
      ...this.convertRSSJobToPageJob(job),
      recommendationId: `rec_${dateString}_${index}`,
      recommendedAt: `${dateString}T09:00:00.000Z`, // 固定推荐时间为每天上午9点
      recommendationGroup: Math.floor(index / 3) + 1 // 每3个岗位为一组
    }));
  }

  /**
   * 将RSS Job转换为Page Job格式
   */
  private convertRSSJobToPageJob(rssJob: any): Job {
    return {
      ...rssJob,
      type: rssJob.jobType || rssJob.type || 'full-time',
      responsibilities: rssJob.responsibilities || [],
      skills: rssJob.tags || rssJob.skills || [],
      requirements: rssJob.requirements || [],
    } as Job;
  }

  /**
   * 确保指定日期有推荐数据
   */
  private ensureRecommendationForDate(dateString: string): void {
    const history = this.getHistory();
    const existingRecommendation = history.find(item => item.date === dateString);
    
    // 如果存在旧记录但包含发布时间晚于该日期的岗位，进行纠正
    const endOfDay = new Date(`${dateString}T23:59:59`);
    if (existingRecommendation) {
      const hasInvalid = (existingRecommendation.jobs || []).some(job => {
        try {
          const publishDate = new Date((job as any).postedAt || (job as any).publishedAt);
          return publishDate.getTime() > endOfDay.getTime();
        } catch {
          return false;
        }
      });

      if (hasInvalid) {
        const jobs = this.getFixedRecommendationsForDate(dateString);
        if (jobs.length > 0) {
          const idx = history.findIndex(item => item.date === dateString);
          const corrected: DailyRecommendation = {
            date: dateString,
            jobs,
            timestamp: new Date(`${dateString}T09:00:00.000Z`).getTime()
          };
          if (idx >= 0) {
            history[idx] = corrected;
          }
          this.cleanupOldData(history);
          this.saveHistory(history);
        }
      }
    }

    if (!existingRecommendation) {
      // 生成该日期的固定推荐
      const jobs = this.getFixedRecommendationsForDate(dateString);
      
      if (jobs.length > 0) {
        const newRecommendation: DailyRecommendation = {
          date: dateString,
          jobs,
          timestamp: new Date(`${dateString}T09:00:00.000Z`).getTime()
        };
        
        history.unshift(newRecommendation);
        this.cleanupOldData(history);
        this.saveHistory(history);
      }
    }
  }

  /**
   * 保存历史数据到localStorage
   */
  private saveHistory(history: DailyRecommendation[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('保存推荐历史失败:', error);
    }
  }

  /**
   * 获取历史数据
   */
  private getHistory(): DailyRecommendation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      // 兼容历史格式：若不是数组，进行转换或重置
      if (Array.isArray(parsed)) {
        return parsed as DailyRecommendation[];
      }
      if (parsed && typeof parsed === 'object') {
        // 兼容 { [date]: Job[] } 旧格式
        const historyArray: DailyRecommendation[] = [];
        for (const [date, jobs] of Object.entries(parsed)) {
          if (Array.isArray(jobs)) {
            historyArray.push({
              date,
              jobs: jobs as Job[],
              timestamp: new Date(`${date}T09:00:00.000Z`).getTime()
            });
          }
        }
        return historyArray;
      }
      return [];
    } catch (error) {
      console.error('读取推荐历史失败:', error);
      return [];
    }
  }

  /**
   * 清理超过指定天数的旧数据
   */
  private cleanupOldData(history: DailyRecommendation[]): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_DAYS);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // 移除超过MAX_DAYS天的数据
    const filteredHistory = history.filter(item => item.date >= cutoffDateStr);
    
    // 如果数据被清理了，更新存储
    if (filteredHistory.length !== history.length) {
      history.length = 0;
      history.push(...filteredHistory);
    }
  }

  /**
   * 获取今天的推荐（如果不存在则生成）
   */
  getTodayRecommendation(): DailyRecommendation | null {
    const today = new Date().toISOString().split('T')[0];
    this.ensureRecommendationForDate(today);
    return this.getRecommendationsByDate(today);
  }

  /**
   * 获取昨天的推荐（如果不存在则生成）
   */
  getYesterdayRecommendations(): DailyRecommendation | null {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    this.ensureRecommendationForDate(yesterdayStr);
    return this.getRecommendationsByDate(yesterdayStr);
  }

  /**
   * 获取过去指定天数的推荐（如果不存在则生成）
   */
  async getRecommendationsForPastDays(days: number): Promise<DailyRecommendation[]> {
    const recommendations: DailyRecommendation[] = []
    for (let i = 1; i <= days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // 优先从服务端拉取
      const remote = await this.fetchRecommendationFromServer(dateStr)
      if (remote && Array.isArray(remote.jobs) && remote.jobs.length > 0) {
        // 对远程数据进行时间一致性校验与清洗
        const sanitizedJobs = this.sanitizeJobsForDate(remote.jobs, dateStr)
        const needsCorrection = sanitizedJobs.length !== remote.jobs.length
        const correctedRec: DailyRecommendation = {
          date: remote.date,
          jobs: sanitizedJobs,
          timestamp: remote.timestamp
        }

        // 如检测到不一致，回写服务端以纠正历史缓存
        if (needsCorrection) {
          const saved = await this.saveRecommendationToServer(dateStr, sanitizedJobs)
          if (saved) {
            recommendations.push(saved)
            this.upsertLocalRecommendation(saved)
            continue
          }
        }

        // 无需纠正或纠正失败时，仍然使用清洗后的数据
        recommendations.push(correctedRec)
        this.upsertLocalRecommendation(correctedRec)
        continue
      }

      // 服务端没有数据，生成固定推荐并写回服务端
      const jobs = this.getFixedRecommendationsForDate(dateStr)
      if (jobs.length > 0) {
        const saved = await this.saveRecommendationToServer(dateStr, jobs)
        const rec = saved ?? {
          date: dateStr,
          jobs,
          timestamp: new Date(`${dateStr}T09:00:00.000Z`).getTime()
        }
        recommendations.push(rec)
        this.upsertLocalRecommendation(rec)
      }
    }
    return recommendations
  }

  /**
   * 根据日期获取推荐
   */
  getRecommendationsByDate(date: string): DailyRecommendation | null {
    const history = this.getHistory();
    return history.find(item => item.date === date) || null;
  }

  /**
   * 获取过往推荐（向后兼容）
   */
  getPastRecommendations(days: number = 3): DailyRecommendation[] {
    // 为向后兼容保留同步接口，但内部仍使用本地数据
    const recs: DailyRecommendation[] = []
    for (let i = 1; i <= days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const recommendation = this.getRecommendationsByDate(dateStr)
      if (recommendation) recs.push(recommendation)
    }
    return recs
  }

  /**
   * 获取可用的日期列表
   */
  getAvailableDates(): string[] {
    const history = this.getHistory();
    return history.map(item => item.date).sort((a, b) => b.localeCompare(a));
  }

  /**
   * 清空历史数据
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('清空推荐历史失败:', error);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalDays: number; totalJobs: number; oldestDate: string | null } {
    const history = this.getHistory();
    const totalDays = history.length;
    const totalJobs = history.reduce((sum, item) => sum + item.jobs.length, 0);
    const oldestDate = history.length > 0 ? 
      history.reduce((oldest, item) => item.date < oldest ? item.date : oldest, history[0].date) : 
      null;
    
    return { totalDays, totalJobs, oldestDate };
  }

  /**
   * 格式化日期显示
   */
  formatDateDisplay(dateString: string): string {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date(today);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      
      const dateStr = date.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
      
      if (dateStr === todayStr) return '今天';
      if (dateStr === yesterdayStr) return '昨天';
      if (dateStr === dayBeforeYesterdayStr) return '前天';
      
      return date.toLocaleDateString('zh-CN', { 
        month: 'long', 
        day: 'numeric',
        weekday: 'short'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 获取相对时间描述
   */
  getRelativeTimeDescription(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays === 2) return '前天';
    if (diffDays === 3) return '大前天';
    
    return `${diffDays}天前`;
  }

  /**
   * 保存每日推荐（向后兼容，但现在使用固定推荐）
   */
  async saveDailyRecommendation(jobs: Job[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    // 写入服务端
    const saved = await this.saveRecommendationToServer(today, jobs)
    const rec = saved ?? {
      date: today,
      jobs,
      timestamp: new Date(`${today}T09:00:00.000Z`).getTime()
    }
    // 同步本地缓存
    this.upsertLocalRecommendation(rec)
  }

  /**
   * 保存指定日期的推荐（向后兼容）
   */
  async saveRecommendationForDate(jobs: Job[], date: string): Promise<void> {
    const saved = await this.saveRecommendationToServer(date, jobs)
    const rec = saved ?? {
      date,
      jobs,
      timestamp: new Date(`${date}T09:00:00.000Z`).getTime()
    }
    this.upsertLocalRecommendation(rec)
  }
}

export const recommendationHistoryService = new RecommendationHistoryService()