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
    // 获取所有可用的职位
    const allJobs = jobAggregator.getJobs();
    
    if (allJobs.length === 0) {
      return [];
    }

    // 生成基于日期的种子
    const seed = this.generateDailyRecommendationSeed(dateString);
    const random = this.seededRandom(seed);
    
    // 使用种子随机选择职位，确保每天的选择是固定的
    const shuffledJobs = [...allJobs];
    
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
    return jobAggregator.convertRSSJobToPageJob(rssJob);
  }

  /**
   * 确保指定日期有推荐数据
   */
  private ensureRecommendationForDate(dateString: string): void {
    const history = this.getHistory();
    const existingRecommendation = history.find(item => item.date === dateString);
    
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
      return stored ? JSON.parse(stored) : [];
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
  getRecommendationsForPastDays(days: number): DailyRecommendation[] {
    const recommendations: DailyRecommendation[] = [];
    
    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      this.ensureRecommendationForDate(dateStr);
      const recommendation = this.getRecommendationsByDate(dateStr);
      
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }
    
    return recommendations;
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
    return this.getRecommendationsForPastDays(days);
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
  saveDailyRecommendation(jobs: Job[]): void {
    // 在新系统中，推荐是自动生成的，这个方法保留用于向后兼容
    console.log('使用固定推荐系统，不需要手动保存推荐');
  }

  /**
   * 保存指定日期的推荐（向后兼容）
   */
  saveRecommendationForDate(jobs: Job[], date: string): void {
    // 在新系统中，推荐是自动生成的，这个方法保留用于向后兼容
    console.log('使用固定推荐系统，不需要手动保存推荐');
  }
}

export const recommendationHistoryService = new RecommendationHistoryService()