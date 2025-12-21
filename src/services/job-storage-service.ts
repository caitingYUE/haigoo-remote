import { Job, JobStats } from '../types/rss-types.js';

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
      console.log('已清空所有职位数据');
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
      console.log(`已从备份恢复数据: ${backupKey}`);
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