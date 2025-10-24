// import { kv } from '@vercel/kv'; // 暂时注释，需要安装包
import { Job } from '../types/rss-types';

export interface StoredJobData {
  jobs: Job[];
  lastSync: string;
  stats: {
    totalJobs: number;
    sources: string[];
    lastWeekJobs: number;
  };
}

export class VercelStorageService {
  private static readonly JOBS_KEY = 'haigoo:jobs';
  private static readonly STATS_KEY = 'haigoo:stats';
  private static readonly LAST_SYNC_KEY = 'haigoo:last_sync';
  
  /**
   * 保存职位数据到 Vercel KV
   */
  async saveJobs(jobs: Job[]): Promise<void> {
    try {
      // 过滤近一周的数据
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentJobs = jobs.filter(job => {
        const jobDate = new Date(job.publishedAt);
        return jobDate >= oneWeekAgo;
      });

      // 去重处理
      const uniqueJobs = this.removeDuplicates(recentJobs);
      
      // 保存到 KV (暂时使用 localStorage 模拟)
      if (typeof window !== 'undefined') {
        localStorage.setItem(VercelStorageService.JOBS_KEY, JSON.stringify(uniqueJobs));
        localStorage.setItem(VercelStorageService.LAST_SYNC_KEY, new Date().toISOString());
      }
      
      // 更新统计信息
      await this.updateStats(uniqueJobs);
      
      console.log(`已保存 ${uniqueJobs.length} 个职位到存储`);
    } catch (error) {
      console.error('保存职位数据失败:', error);
      throw error;
    }
  }

  /**
   * 从存储加载职位数据
   */
  async loadJobs(): Promise<Job[]> {
    try {
      if (typeof window !== 'undefined') {
        const jobs = localStorage.getItem(VercelStorageService.JOBS_KEY);
        return jobs ? JSON.parse(jobs) : [];
      }
      return [];
    } catch (error) {
      console.error('加载职位数据失败:', error);
      return [];
    }
  }

  /**
   * 添加新职位（增量更新）
   */
  async addJobs(newJobs: Job[]): Promise<void> {
    try {
      const existingJobs = await this.loadJobs();
      const allJobs = [...existingJobs, ...newJobs];
      await this.saveJobs(allJobs);
    } catch (error) {
      console.error('添加职位数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<StoredJobData['stats']> {
    try {
      if (typeof window !== 'undefined') {
        const stats = localStorage.getItem(VercelStorageService.STATS_KEY);
        return stats ? JSON.parse(stats) : {
          totalJobs: 0,
          sources: [],
          lastWeekJobs: 0
        };
      }
      return {
        totalJobs: 0,
        sources: [],
        lastWeekJobs: 0
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        totalJobs: 0,
        sources: [],
        lastWeekJobs: 0
      };
    }
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<string | null> {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(VercelStorageService.LAST_SYNC_KEY);
      }
      return null;
    } catch (error) {
      console.error('获取最后同步时间失败:', error);
      return null;
    }
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(VercelStorageService.JOBS_KEY);
        localStorage.removeItem(VercelStorageService.STATS_KEY);
        localStorage.removeItem(VercelStorageService.LAST_SYNC_KEY);
      }
      console.log('已清除所有存储数据');
    } catch (error) {
      console.error('清除数据失败:', error);
      throw error;
    }
  }

  /**
   * 更新统计信息
   */
  private async updateStats(jobs: Job[]): Promise<void> {
    const sources = [...new Set(jobs.map(job => job.source))];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const lastWeekJobs = jobs.filter(job => {
      const jobDate = new Date(job.publishedAt);
      return jobDate >= oneWeekAgo;
    }).length;

    const stats = {
      totalJobs: jobs.length,
      sources,
      lastWeekJobs
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(VercelStorageService.STATS_KEY, JSON.stringify(stats));
    }
  }

  /**
   * 去重处理
   */
  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = `${job.title}-${job.company}-${job.location}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 获取完整的存储数据
   */
  async getStoredData(): Promise<StoredJobData> {
    try {
      const [jobs, stats, lastSync] = await Promise.all([
        this.loadJobs(),
        this.getStats(),
        this.getLastSyncTime()
      ]);

      return {
        jobs,
        stats,
        lastSync: lastSync || new Date().toISOString()
      };
    } catch (error) {
      console.error('获取存储数据失败:', error);
      return {
        jobs: [],
        stats: { totalJobs: 0, sources: [], lastWeekJobs: 0 },
        lastSync: new Date().toISOString()
      };
    }
  }
}

// 导出单例实例
export const vercelStorageService = new VercelStorageService();