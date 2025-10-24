import { Job, JobStats } from '../types/rss-types';

// 条件导入 @vercel/kv，只在服务端环境使用
let kv: any = null;

// 检查是否在服务端环境
const isServerSide = typeof window === 'undefined';

if (isServerSide) {
  try {
    // 动态导入 @vercel/kv
    import('@vercel/kv').then(module => {
      kv = module.kv;
    }).catch(() => {
      console.warn('Vercel KV not available in server environment');
    });
  } catch (error) {
    console.warn('Failed to import @vercel/kv:', error);
  }
}

export interface StorageStats {
  totalJobs: number;
  lastSync: Date | null;
  storageSize: number;
  provider: string;
}

export interface StorageConfig {
  provider: 'vercel-kv' | 'localStorage';
  maxJobs?: number;
  maxDays?: number;
}

export interface CloudStorageProvider {
  saveJobs(jobs: Job[]): Promise<void>;
  loadJobs(): Promise<Job[]>;
  addJobs(newJobs: Job[]): Promise<void>;
  getStats(): Promise<StorageStats>;
  getLastSyncTime(): Promise<Date | null>;
  clearAllData(): Promise<void>;
  isAvailable(): Promise<boolean>;
}

class VercelKVProvider implements CloudStorageProvider {
  private readonly JOBS_KEY = 'haigoo:jobs';
  private readonly STATS_KEY = 'haigoo:stats';
  private readonly SYNC_TIME_KEY = 'haigoo:last_sync';

  async isAvailable(): Promise<boolean> {
    // 在客户端环境，Vercel KV 不可用
    if (typeof window !== 'undefined') {
      return false;
    }
    
    // 检查是否在 Vercel 环境且 KV 已初始化
    try {
      const isVercel = typeof globalThis !== 'undefined' && 
                      (globalThis as any).process?.env?.VERCEL;
      return isVercel && kv !== null;
    } catch {
      return false;
    }
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    try {
      // 过滤最近7天的职位
      const recentJobs = this.filterRecentJobs(jobs);
      
      // 去重
      const uniqueJobs = this.removeDuplicates(recentJobs);
      
      // 保存到 KV
      await kv.set(this.JOBS_KEY, JSON.stringify(uniqueJobs));
      
      // 更新统计信息
      await this.updateStats(uniqueJobs);
      
      // 更新同步时间
      await kv.set(this.SYNC_TIME_KEY, new Date().toISOString());
      
      console.log(`✅ 已保存 ${uniqueJobs.length} 个职位到 Vercel KV`);
    } catch (error) {
      console.error('保存职位到 Vercel KV 失败:', error);
      throw error;
    }
  }

  async loadJobs(): Promise<Job[]> {
    try {
      const jobsData = await kv.get(this.JOBS_KEY);
      if (!jobsData) {
        return [];
      }
      
      const jobs = typeof jobsData === 'string' ? JSON.parse(jobsData) : jobsData;
      console.log(`📖 从 Vercel KV 加载了 ${jobs.length} 个职位`);
      return jobs;
    } catch (error) {
      console.error('从 Vercel KV 加载职位失败:', error);
      return [];
    }
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const allJobs = [...existingJobs, ...newJobs];
    await this.saveJobs(allJobs);
  }

  async getStats(): Promise<StorageStats> {
    try {
      const statsData = await kv.get(this.STATS_KEY);
      const jobs = await this.loadJobs();
      
      if (statsData && typeof statsData === 'object') {
        return {
          ...statsData as StorageStats,
          totalJobs: jobs.length,
          provider: 'vercel-kv'
        };
      }
      
      return this.getDefaultStats();
    } catch (error) {
      console.error('获取 Vercel KV 统计信息失败:', error);
      return this.getDefaultStats();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const syncTime = await kv.get(this.SYNC_TIME_KEY);
      return syncTime ? new Date(syncTime as string) : null;
    } catch (error) {
      console.error('获取最后同步时间失败:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await kv.del(this.JOBS_KEY);
      await kv.del(this.STATS_KEY);
      await kv.del(this.SYNC_TIME_KEY);
      console.log('✅ 已清除所有 Vercel KV 数据');
    } catch (error) {
      console.error('清除 Vercel KV 数据失败:', error);
      throw error;
    }
  }

  private filterRecentJobs(jobs: Job[]): Job[] {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return jobs.filter(job => new Date(job.publishedAt) >= sevenDaysAgo);
  }

  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      if (seen.has(job.id)) {
        return false;
      }
      seen.add(job.id);
      return true;
    });
  }

  private async updateStats(jobs: Job[]): Promise<void> {
    try {
      const stats: StorageStats = {
        totalJobs: jobs.length,
        lastSync: new Date(),
        storageSize: JSON.stringify(jobs).length,
        provider: 'vercel-kv'
      };
      
      await kv.set(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('更新统计信息失败:', error);
    }
  }

  private getDefaultStats(): StorageStats {
    return {
      totalJobs: 0,
      lastSync: null,
      storageSize: 0,
      provider: 'vercel-kv'
    };
  }
}

class LocalStorageProvider implements CloudStorageProvider {
  private readonly JOBS_KEY = 'haigoo:jobs';
  private readonly STATS_KEY = 'haigoo:stats';
  private readonly SYNC_TIME_KEY = 'haigoo:last_sync';

  async isAvailable(): Promise<boolean> {
    return typeof localStorage !== 'undefined';
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    try {
      const recentJobs = this.filterRecentJobs(jobs);
      const uniqueJobs = this.removeDuplicates(recentJobs);
      
      localStorage.setItem(this.JOBS_KEY, JSON.stringify(uniqueJobs));
      await this.updateStats(uniqueJobs);
      localStorage.setItem(this.SYNC_TIME_KEY, new Date().toISOString());
      
      console.log(`✅ 已保存 ${uniqueJobs.length} 个职位到 localStorage`);
    } catch (error) {
      console.error('保存职位到 localStorage 失败:', error);
      throw error;
    }
  }

  async loadJobs(): Promise<Job[]> {
    try {
      const jobsData = localStorage.getItem(this.JOBS_KEY);
      if (!jobsData) {
        return [];
      }
      
      const jobs = JSON.parse(jobsData);
      console.log(`📖 从 localStorage 加载了 ${jobs.length} 个职位`);
      return jobs;
    } catch (error) {
      console.error('从 localStorage 加载职位失败:', error);
      return [];
    }
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const allJobs = [...existingJobs, ...newJobs];
    await this.saveJobs(allJobs);
  }

  async getStats(): Promise<StorageStats> {
    try {
      const statsData = localStorage.getItem(this.STATS_KEY);
      const jobs = await this.loadJobs();
      
      if (statsData) {
        const stats = JSON.parse(statsData);
        return {
          ...stats,
          totalJobs: jobs.length,
          provider: 'localStorage'
        };
      }
      
      return this.getDefaultStats();
    } catch (error) {
      console.error('获取 localStorage 统计信息失败:', error);
      return this.getDefaultStats();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const syncTime = localStorage.getItem(this.SYNC_TIME_KEY);
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('获取最后同步时间失败:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem(this.JOBS_KEY);
      localStorage.removeItem(this.STATS_KEY);
      localStorage.removeItem(this.SYNC_TIME_KEY);
      console.log('✅ 已清除所有 localStorage 数据');
    } catch (error) {
      console.error('清除 localStorage 数据失败:', error);
      throw error;
    }
  }

  private filterRecentJobs(jobs: Job[]): Job[] {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return jobs.filter(job => new Date(job.publishedAt) >= sevenDaysAgo);
  }

  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      if (seen.has(job.id)) {
        return false;
      }
      seen.add(job.id);
      return true;
    });
  }

  private async updateStats(jobs: Job[]): Promise<void> {
    try {
      const stats: StorageStats = {
        totalJobs: jobs.length,
        lastSync: new Date(),
        storageSize: JSON.stringify(jobs).length,
        provider: 'localStorage'
      };
      
      localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('更新统计信息失败:', error);
    }
  }

  private getDefaultStats(): StorageStats {
    return {
      totalJobs: 0,
      lastSync: null,
      storageSize: 0,
      provider: 'localStorage'
    };
  }
}

export class CloudStorageAdapter {
  private provider: CloudStorageProvider;

  constructor(config: StorageConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: StorageConfig): CloudStorageProvider {
    switch (config.provider) {
      case 'vercel-kv':
        return new VercelKVProvider();
      case 'localStorage':
      default:
        return new LocalStorageProvider();
    }
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    return this.provider.saveJobs(jobs);
  }

  async loadJobs(): Promise<Job[]> {
    return this.provider.loadJobs();
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    return this.provider.addJobs(newJobs);
  }

  async getStats(): Promise<StorageStats> {
    return this.provider.getStats();
  }

  async getLastSyncTime(): Promise<Date | null> {
    return this.provider.getLastSyncTime();
  }

  async clearAllData(): Promise<void> {
    return this.provider.clearAllData();
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }
}

// 创建存储适配器实例
export const createStorageAdapter = async (config?: Partial<StorageConfig>): Promise<CloudStorageAdapter> => {
  const defaultConfig: StorageConfig = {
    provider: 'localStorage',
    maxJobs: 1000,
    maxDays: 7
  };

  const finalConfig = { ...defaultConfig, ...config };

  // 如果指定使用 Vercel KV，先检查是否可用
  if (finalConfig.provider === 'vercel-kv') {
    const kvProvider = new VercelKVProvider();
    const isAvailable = await kvProvider.isAvailable();
    
    if (!isAvailable) {
      console.warn('Vercel KV 不可用，回退到 localStorage');
      finalConfig.provider = 'localStorage';
    }
  }

  return new CloudStorageAdapter(finalConfig);
};

// 默认存储适配器（自动检测环境）
const isVercelEnvironment = typeof window === 'undefined' && 
  typeof globalThis !== 'undefined' && 
  (globalThis as any).process?.env?.VERCEL;

// 使用立即执行函数来避免 top-level await
let cloudStorageAdapter: CloudStorageAdapter;

(async () => {
  cloudStorageAdapter = await createStorageAdapter({
    provider: isVercelEnvironment ? 'vercel-kv' : 'localStorage'
  });
})();

export { cloudStorageAdapter };