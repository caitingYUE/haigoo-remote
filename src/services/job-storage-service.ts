import { Job, JobStats, SyncStatus } from '../types/rss-types.js';

export interface StoredJobData {
  jobs: Job[];
  lastSync: Date;
  syncStats: JobStats;
  version: string;
}

export interface JobStorageOptions {
  maxJobs?: number;
  maxDays?: number;
  autoCleanup?: boolean;
}

class JobStorageService {
  private readonly STORAGE_KEY = 'haigoo_jobs_data';
  private readonly BACKUP_KEY_PREFIX = 'haigoo_jobs_backup_';
  private readonly MAX_BACKUPS = 5;
  private readonly DEFAULT_OPTIONS: JobStorageOptions = {
    maxJobs: 1000,
    maxDays: 7,
    autoCleanup: true
  };

  constructor(private options: JobStorageOptions = {}) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
  }

  /**
   * 保存职位数据到localStorage
   */
  async saveJobs(jobs: Job[]): Promise<void> {
    try {
      // 过滤近一周的数据
      const filteredJobs = this.filterRecentJobs(jobs);
      
      // 限制数据量
      const limitedJobs = this.limitJobsCount(filteredJobs);
      
      // 创建存储数据结构
      const storageData: StoredJobData = {
        jobs: limitedJobs,
        lastSync: new Date(),
        syncStats: this.calculateStats(limitedJobs),
        version: '1.0'
      };

      // 保存到主存储
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData));
      
      // 创建备份
      this.createBackup(storageData);
      
      // 清理旧备份
      this.cleanupOldBackups();
      
      console.log(`✅ 成功保存 ${limitedJobs.length} 个职位数据`);
    } catch (error) {
      console.error('保存职位数据失败:', error);
      throw new Error('数据保存失败，请检查浏览器存储空间');
    }
  }

  /**
   * 从localStorage加载职位数据
   */
  async loadJobs(): Promise<Job[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const data: StoredJobData = JSON.parse(stored);
      
      // 验证数据版本和完整性
      if (!this.validateStoredData(data)) {
        console.warn('存储数据格式不正确，返回空数组');
        return [];
      }

      // 转换日期字符串为Date对象
      const jobs = data.jobs.map(job => ({
        ...job,
        publishedAt: typeof job.publishedAt === 'string' ? job.publishedAt : new Date(job.publishedAt).toISOString(),
        createdAt: typeof job.createdAt === 'string' ? job.createdAt : new Date(job.createdAt).toISOString(),
        updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : new Date(job.updatedAt).toISOString()
      }));

      // 如果启用自动清理，过滤过期数据
      if (this.options.autoCleanup) {
        const filteredJobs = this.filterRecentJobs(jobs);
        if (filteredJobs.length !== jobs.length) {
          // 如果有数据被清理，重新保存
          await this.saveJobs(filteredJobs);
          return filteredJobs;
        }
      }

      console.log(`📖 成功加载 ${jobs.length} 个职位数据`);
      return jobs;
    } catch (error) {
      console.error('加载职位数据失败:', error);
      return [];
    }
  }

  /**
   * 添加新职位（去重）
   */
  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const mergedJobs = this.mergeJobs(existingJobs, newJobs);
    await this.saveJobs(mergedJobs);
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<JobStats | null> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const data: StoredJobData = JSON.parse(stored);
      return data.syncStats;
    } catch (error) {
      console.error('获取存储统计失败:', error);
      return null;
    }
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const data: StoredJobData = JSON.parse(stored);
      return new Date(data.lastSync);
    } catch (error) {
      console.error('获取最后同步时间失败:', error);
      return null;
    }
  }

  /**
   * 清空所有存储数据
   */
  async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.cleanupAllBackups();
      console.log('✅ 已清空所有职位数据');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw error;
    }
  }

  /**
   * 恢复备份数据
   */
  async restoreFromBackup(backupIndex: number = 0): Promise<boolean> {
    try {
      const backups = this.getAvailableBackups();
      if (backupIndex >= backups.length) {
        throw new Error('备份索引超出范围');
      }

      const backupKey = backups[backupIndex];
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error('备份数据不存在');
      }

      localStorage.setItem(this.STORAGE_KEY, backupData);
      console.log(`✅ 已从备份恢复数据: ${backupKey}`);
      return true;
    } catch (error) {
      console.error('恢复备份失败:', error);
      return false;
    }
  }

  /**
   * 获取可用备份列表
   */
  getAvailableBackups(): string[] {
    const backups: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.BACKUP_KEY_PREFIX)) {
        backups.push(key);
      }
    }
    return backups.sort().reverse(); // 最新的在前
  }

  /**
   * 过滤近期职位数据
   */
  private filterRecentJobs(jobs: Job[]): Job[] {
    if (!this.options.maxDays) return jobs;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.maxDays);

    return jobs.filter(job => {
      const publishDate = new Date(job.publishedAt);
      return publishDate >= cutoffDate;
    });
  }

  /**
   * 限制职位数量
   */
  private limitJobsCount(jobs: Job[]): Job[] {
    if (!this.options.maxJobs || jobs.length <= this.options.maxJobs) {
      return jobs;
    }

    // 按发布时间排序，保留最新的
    return jobs
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, this.options.maxJobs);
  }

  /**
   * 合并职位数据（去重）
   */
  private mergeJobs(existingJobs: Job[], newJobs: Job[]): Job[] {
    const jobMap = new Map<string, Job>();

    // 先添加现有职位
    existingJobs.forEach(job => {
      jobMap.set(job.id, job);
    });

    // 添加新职位（会覆盖相同ID的职位）
    newJobs.forEach(job => {
      jobMap.set(job.id, {
        ...job,
        updatedAt: new Date().toISOString() // 更新时间戳
      });
    });

    return Array.from(jobMap.values());
  }

  /**
   * 计算统计信息
   */
  private calculateStats(jobs: Job[]): JobStats {
    const stats: JobStats = {
      total: jobs.length,
      byCategory: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      byJobType: {} as Record<string, number>,
      byExperienceLevel: {} as Record<string, number>,
      recentlyAdded: 0,
      activeJobs: 0
    };

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    jobs.forEach(job => {
      // 按分类统计
      stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1;
      
      // 按来源统计
      stats.bySource[job.source] = (stats.bySource[job.source] || 0) + 1;
      
      // 按工作类型统计
      stats.byJobType[job.jobType] = (stats.byJobType[job.jobType] || 0) + 1;
      
      // 按经验级别统计
      stats.byExperienceLevel[job.experienceLevel] = (stats.byExperienceLevel[job.experienceLevel] || 0) + 1;
      
      // 最近添加的职位
      if (new Date(job.createdAt) >= oneDayAgo) {
        stats.recentlyAdded++;
      }
      
      // 活跃职位
      if (job.status === 'active') {
        stats.activeJobs++;
      }
    });

    return stats;
  }

  /**
   * 验证存储数据格式
   */
  private validateStoredData(data: any): data is StoredJobData {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.jobs) &&
      data.lastSync &&
      data.version
    );
  }

  /**
   * 创建数据备份
   */
  private createBackup(data: StoredJobData): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `${this.BACKUP_KEY_PREFIX}${timestamp}`;
      localStorage.setItem(backupKey, JSON.stringify(data));
    } catch (error) {
      console.warn('创建备份失败:', error);
    }
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(): void {
    try {
      const backups = this.getAvailableBackups();
      if (backups.length > this.MAX_BACKUPS) {
        const toDelete = backups.slice(this.MAX_BACKUPS);
        toDelete.forEach(key => {
          localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.warn('清理备份失败:', error);
    }
  }

  /**
   * 清理所有备份
   */
  private cleanupAllBackups(): void {
    const backups = this.getAvailableBackups();
    backups.forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

// 创建单例实例
export const jobStorageService = new JobStorageService({
  maxJobs: 1000,
  maxDays: 7,
  autoCleanup: true
});

export default JobStorageService;