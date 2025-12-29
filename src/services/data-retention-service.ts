import { Job as RSSJob } from '../types/rss-types';
import { UnifiedJob } from '../types/unified-job-types';

export interface DataRetentionConfig {
  retentionDays: number;
  cleanupIntervalHours: number;
  maxRecords: number;
  enableAutoCleanup: boolean;
}

export interface RetentionStats {
  totalRecords: number;
  expiredRecords: number;
  cleanedRecords: number;
  lastCleanup: Date | null;
  nextCleanup: Date | null;
  storageUsage: {
    rssData: number;
    unifiedData: number;
    total: number;
  };
}

export class DataRetentionService {
  private config: DataRetentionConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<DataRetentionConfig> = {}) {
    this.config = {
      retentionDays: 7,
      cleanupIntervalHours: 24,
      maxRecords: 10000,
      enableAutoCleanup: true,
      ...config
    };

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 启动自动清理定时器
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, intervalMs);
  }

  /**
   * 停止自动清理
   */
  public stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 检查记录是否过期
   */
  public isExpired(date: string | Date): boolean {
    const recordDate = typeof date === 'string' ? new Date(date) : date;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - this.config.retentionDays);
    
    return recordDate < expiryDate;
  }

  /**
   * 过滤掉过期的RSS数据
   */
  public filterValidRSSJobs(jobs: RSSJob[]): RSSJob[] {
    return jobs.filter(job => {
      const publishDate = new Date(job.publishedAt);
      return !this.isExpired(publishDate);
    });
  }

  /**
   * 过滤掉过期的统一数据
   */
  public filterValidUnifiedJobs(jobs: UnifiedJob[]): UnifiedJob[] {
    return jobs.filter(job => {
      const publishDate = new Date(job.publishDate);
      return !this.isExpired(publishDate);
    });
  }

  /**
   * 执行数据清理
   */
  public async performCleanup(): Promise<RetentionStats> {
    console.log('开始执行数据清理...');
    
    try {
      // 模拟从存储中获取数据
      const rssJobs = await this.getRSSJobsFromStorage();
      const unifiedJobs = await this.getUnifiedJobsFromStorage();

      // 计算过期记录
      const expiredRSSJobs = rssJobs.filter(job => this.isExpired(job.publishedAt));
      const expiredUnifiedJobs = unifiedJobs.filter(job => this.isExpired(job.publishDate));

      // 过滤有效记录
      const validRSSJobs = this.filterValidRSSJobs(rssJobs);
      const validUnifiedJobs = this.filterValidUnifiedJobs(unifiedJobs);

      // 检查是否超过最大记录数限制
      const trimmedRSSJobs = this.trimToMaxRecords(validRSSJobs);
      const trimmedUnifiedJobs = this.trimToMaxRecords(validUnifiedJobs);

      // 保存清理后的数据
      await this.saveRSSJobsToStorage(trimmedRSSJobs);
      await this.saveUnifiedJobsToStorage(trimmedUnifiedJobs);

      const stats: RetentionStats = {
        totalRecords: rssJobs.length + unifiedJobs.length,
        expiredRecords: expiredRSSJobs.length + expiredUnifiedJobs.length,
        cleanedRecords: (rssJobs.length - trimmedRSSJobs.length) + (unifiedJobs.length - trimmedUnifiedJobs.length),
        lastCleanup: new Date(),
        nextCleanup: this.getNextCleanupTime(),
        storageUsage: {
          rssData: this.calculateStorageSize(trimmedRSSJobs),
          unifiedData: this.calculateStorageSize(trimmedUnifiedJobs),
          total: this.calculateStorageSize([...trimmedRSSJobs, ...trimmedUnifiedJobs])
        }
      };

      console.log('数据清理完成:', stats);
      return stats;

    } catch (error) {
      console.error('数据清理失败:', error);
      throw error;
    }
  }

  /**
   * 限制记录数量到最大值
   */
  private trimToMaxRecords<T extends { publishedAt?: string; publishDate?: string }>(
    records: T[]
  ): T[] {
    if (records.length <= this.config.maxRecords) {
      return records;
    }

    // 按发布时间排序，保留最新的记录
    return records
      .sort((a, b) => {
        const dateA = new Date(a.publishedAt || a.publishDate || 0);
        const dateB = new Date(b.publishedAt || b.publishDate || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, this.config.maxRecords);
  }

  /**
   * 获取下次清理时间
   */
  private getNextCleanupTime(): Date {
    const next = new Date();
    next.setHours(next.getHours() + this.config.cleanupIntervalHours);
    return next;
  }

  /**
   * 计算存储大小（字节）
   */
  private calculateStorageSize(data: any[]): number {
    return JSON.stringify(data).length;
  }

  /**
   * 获取保留统计信息
   */
  public async getRetentionStats(): Promise<RetentionStats> {
    const rssJobs = await this.getRSSJobsFromStorage();
    const unifiedJobs = await this.getUnifiedJobsFromStorage();

    const expiredRSSJobs = rssJobs.filter(job => this.isExpired(job.publishedAt));
    const expiredUnifiedJobs = unifiedJobs.filter(job => this.isExpired(job.publishDate));

    return {
      totalRecords: rssJobs.length + unifiedJobs.length,
      expiredRecords: expiredRSSJobs.length + expiredUnifiedJobs.length,
      cleanedRecords: 0,
      lastCleanup: this.getLastCleanupTime(),
      nextCleanup: this.getNextCleanupTime(),
      storageUsage: {
        rssData: this.calculateStorageSize(rssJobs),
        unifiedData: this.calculateStorageSize(unifiedJobs),
        total: this.calculateStorageSize([...rssJobs, ...unifiedJobs])
      }
    };
  }

  /**
   * 更新保留配置
   */
  public updateConfig(newConfig: Partial<DataRetentionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableAutoCleanup && !this.cleanupTimer) {
      this.startAutoCleanup();
    } else if (!this.config.enableAutoCleanup && this.cleanupTimer) {
      this.stopAutoCleanup();
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): DataRetentionConfig {
    return { ...this.config };
  }

  // 模拟存储操作 - 实际项目中应该连接到真实的数据库
  private async getRSSJobsFromStorage(): Promise<RSSJob[]> {
    try {
      const stored = localStorage.getItem('rss_jobs');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to parse rss_jobs from storage', e);
      return [];
    }
  }

  private async getUnifiedJobsFromStorage(): Promise<UnifiedJob[]> {
    try {
      const stored = localStorage.getItem('unified_jobs');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to parse unified_jobs from storage', e);
      return [];
    }
  }

  private async saveRSSJobsToStorage(jobs: RSSJob[]): Promise<void> {
    localStorage.setItem('rss_jobs', JSON.stringify(jobs));
  }

  private async saveUnifiedJobsToStorage(jobs: UnifiedJob[]): Promise<void> {
    localStorage.setItem('unified_jobs', JSON.stringify(jobs));
  }

  private getLastCleanupTime(): Date | null {
    const stored = localStorage.getItem('last_cleanup');
    return stored ? new Date(stored) : null;
  }

  /**
   * 手动触发清理
   */
  public async manualCleanup(): Promise<RetentionStats> {
    return await this.performCleanup();
  }

  /**
   * 清空所有数据
   */
  public async clearAllData(): Promise<void> {
    localStorage.removeItem('rss_jobs');
    localStorage.removeItem('unified_jobs');
    localStorage.removeItem('last_cleanup');
    console.log('所有数据已清空');
  }

  /**
   * 导出数据
   */
  public async exportData(): Promise<{ rssJobs: RSSJob[]; unifiedJobs: UnifiedJob[] }> {
    const rssJobs = await this.getRSSJobsFromStorage();
    const unifiedJobs = await this.getUnifiedJobsFromStorage();
    
    return {
      rssJobs: this.filterValidRSSJobs(rssJobs),
      unifiedJobs: this.filterValidUnifiedJobs(unifiedJobs)
    };
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    this.stopAutoCleanup();
  }
}

// 创建默认实例
export const dataRetentionService = new DataRetentionService();