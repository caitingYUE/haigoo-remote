import { Job, JobStats } from '../types/rss-types';

// 条件导入 @vercel/kv 和 redis，只在服务端环境使用
let kv: any = null;
let redis: any = null;

// 检查是否在服务端环境
const isServerSide = typeof window === 'undefined';

if (isServerSide) {
  try {
    // 动态导入 @vercel/kv
    import('@vercel/kv').then((kvModule) => {
      kv = kvModule.kv;
    }).catch(() => {
      console.warn('Vercel KV not available');
    });
  } catch (error) {
    console.warn('Vercel KV not available:', error);
  }

  try {
    // 动态导入 redis
    import('redis').then((redisModule) => {
      redis = redisModule;
    }).catch(() => {
      console.warn('Redis not available');
    });
  } catch (error) {
    console.warn('Redis not available:', error);
  }
}

export interface StorageStats {
  totalJobs: number;
  lastSync: Date | null;
  storageSize: number;
  provider: string;
}

export interface StorageConfig {
  provider: 'vercel-kv' | 'redis' | 'localStorage';
  maxJobs?: number;
  maxDays?: number;
  redisUrl?: string;
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

    try {
      if (!kv) return false;
      // 简单测试连接
      await kv.ping();
      return true;
    } catch (error) {
      console.warn('Vercel KV not available:', error);
      return false;
    }
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('Vercel KV is not available');
    }

    try {
      const filteredJobs = this.removeDuplicates(this.filterRecentJobs(jobs));
      await kv.set(this.JOBS_KEY, JSON.stringify(filteredJobs));
      await this.updateStats(filteredJobs);
      await kv.set(this.SYNC_TIME_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save jobs to Vercel KV:', error);
      throw error;
    }
  }

  async loadJobs(): Promise<Job[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      const jobsData = await kv.get(this.JOBS_KEY);
      if (!jobsData) return [];

      const jobs = typeof jobsData === 'string' ? JSON.parse(jobsData) : jobsData;
      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      console.error('Failed to load jobs from Vercel KV:', error);
      return [];
    }
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const allJobs = [...existingJobs, ...newJobs];
    await this.saveJobs(allJobs);
  }

  async getStats(): Promise<StorageStats> {
    if (!await this.isAvailable()) {
      return this.getDefaultStats();
    }

    try {
      const statsData = await kv.get(this.STATS_KEY);
      if (statsData) {
        const stats = typeof statsData === 'string' ? JSON.parse(statsData) : statsData;
        return {
          ...stats,
          lastSync: stats.lastSync ? new Date(stats.lastSync) : null,
          provider: 'vercel-kv'
        };
      }
      return this.getDefaultStats();
    } catch (error) {
      console.error('Failed to get stats from Vercel KV:', error);
      return this.getDefaultStats();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    if (!await this.isAvailable()) {
      return null;
    }

    try {
      const syncTime = await kv.get(this.SYNC_TIME_KEY);
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('Failed to get last sync time from Vercel KV:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }

    try {
      await kv.del(this.JOBS_KEY);
      await kv.del(this.STATS_KEY);
      await kv.del(this.SYNC_TIME_KEY);
    } catch (error) {
      console.error('Failed to clear data from Vercel KV:', error);
      throw error;
    }
  }

  private filterRecentJobs(jobs: Job[]): Job[] {
    const maxDays = 7;
    const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
    return jobs.filter(job => new Date(job.publishedAt) >= cutoffDate);
  }

  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set();
    return jobs.filter(job => {
      const key = `${job.title}-${job.company}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
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
      console.error('Failed to update stats in Vercel KV:', error);
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

class RedisProvider implements CloudStorageProvider {
  private readonly JOBS_KEY = 'haigoo:jobs';
  private readonly STATS_KEY = 'haigoo:stats';
  private readonly SYNC_TIME_KEY = 'haigoo:last_sync';
  private client: any = null;
  private redisUrl: string;

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  }

  async isAvailable(): Promise<boolean> {
    // 在客户端环境，Redis 不可用
    if (typeof window !== 'undefined') {
      return false;
    }

    try {
      if (!redis) return false;

      if (!this.client) {
        this.client = redis.createClient({
          url: this.redisUrl
        });
        await this.client.connect();
      }

      // 测试连接
      await this.client.ping();
      return true;
    } catch (error) {
      console.warn('Redis not available:', error);
      return false;
    }
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('Redis is not available');
    }

    try {
      const filteredJobs = this.removeDuplicates(this.filterRecentJobs(jobs));
      await this.client.set(this.JOBS_KEY, JSON.stringify(filteredJobs));
      await this.updateStats(filteredJobs);
      await this.client.set(this.SYNC_TIME_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save jobs to Redis:', error);
      throw error;
    }
  }

  async loadJobs(): Promise<Job[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      const jobsData = await this.client.get(this.JOBS_KEY);
      if (!jobsData) return [];

      const jobs = JSON.parse(jobsData);
      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      console.error('Failed to load jobs from Redis:', error);
      return [];
    }
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const allJobs = [...existingJobs, ...newJobs];
    await this.saveJobs(allJobs);
  }

  async getStats(): Promise<StorageStats> {
    if (!await this.isAvailable()) {
      return this.getDefaultStats();
    }

    try {
      const statsData = await this.client.get(this.STATS_KEY);
      if (statsData) {
        const stats = JSON.parse(statsData);
        return {
          ...stats,
          lastSync: stats.lastSync ? new Date(stats.lastSync) : null,
          provider: 'redis'
        };
      }
      return this.getDefaultStats();
    } catch (error) {
      console.error('Failed to get stats from Redis:', error);
      return this.getDefaultStats();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    if (!await this.isAvailable()) {
      return null;
    }

    try {
      const syncTime = await this.client.get(this.SYNC_TIME_KEY);
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('Failed to get last sync time from Redis:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }

    try {
      await this.client.del(this.JOBS_KEY);
      await this.client.del(this.STATS_KEY);
      await this.client.del(this.SYNC_TIME_KEY);
    } catch (error) {
      console.error('Failed to clear data from Redis:', error);
      throw error;
    }
  }

  private filterRecentJobs(jobs: Job[]): Job[] {
    const maxDays = 7;
    const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
    return jobs.filter(job => new Date(job.publishedAt) >= cutoffDate);
  }

  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set();
    return jobs.filter(job => {
      const key = `${job.title}-${job.company}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async updateStats(jobs: Job[]): Promise<void> {
    try {
      const stats: StorageStats = {
        totalJobs: jobs.length,
        lastSync: new Date(),
        storageSize: JSON.stringify(jobs).length,
        provider: 'redis'
      };
      await this.client.set(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to update stats in Redis:', error);
    }
  }

  private getDefaultStats(): StorageStats {
    return {
      totalJobs: 0,
      lastSync: null,
      storageSize: 0,
      provider: 'redis'
    };
  }
}

class LocalStorageProvider implements CloudStorageProvider {
  private readonly JOBS_KEY = 'haigoo:jobs';
  private readonly STATS_KEY = 'haigoo:stats';
  private readonly SYNC_TIME_KEY = 'haigoo:last_sync';

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  async saveJobs(jobs: Job[]): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('LocalStorage is not available');
    }

    try {
      const filteredJobs = this.removeDuplicates(this.filterRecentJobs(jobs));
      localStorage.setItem(this.JOBS_KEY, JSON.stringify(filteredJobs));
      await this.updateStats(filteredJobs);
      localStorage.setItem(this.SYNC_TIME_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save jobs to localStorage:', error);
      throw error;
    }
  }

  async loadJobs(): Promise<Job[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      const jobsData = localStorage.getItem(this.JOBS_KEY);
      if (!jobsData) return [];

      const jobs = JSON.parse(jobsData);
      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      console.error('Failed to load jobs from localStorage:', error);
      return [];
    }
  }

  async addJobs(newJobs: Job[]): Promise<void> {
    const existingJobs = await this.loadJobs();
    const allJobs = [...existingJobs, ...newJobs];
    await this.saveJobs(allJobs);
  }

  async getStats(): Promise<StorageStats> {
    if (!await this.isAvailable()) {
      return this.getDefaultStats();
    }

    try {
      const statsData = localStorage.getItem(this.STATS_KEY);
      if (statsData) {
        const stats = JSON.parse(statsData);
        return {
          ...stats,
          lastSync: stats.lastSync ? new Date(stats.lastSync) : null,
          provider: 'localStorage'
        };
      }

      // 如果没有统计数据，基于现有作业生成
      const jobs = await this.loadJobs();
      return {
        totalJobs: jobs.length,
        lastSync: null,
        storageSize: JSON.stringify(jobs).length,
        provider: 'localStorage'
      };
    } catch (error) {
      console.error('Failed to get stats from localStorage:', error);
      return this.getDefaultStats();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    if (!await this.isAvailable()) {
      return null;
    }

    try {
      const syncTime = localStorage.getItem(this.SYNC_TIME_KEY);
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('Failed to get last sync time from localStorage:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }

    try {
      localStorage.removeItem(this.JOBS_KEY);
      localStorage.removeItem(this.STATS_KEY);
      localStorage.removeItem(this.SYNC_TIME_KEY);
    } catch (error) {
      console.error('Failed to clear data from localStorage:', error);
      throw error;
    }
  }

  private filterRecentJobs(jobs: Job[]): Job[] {
    const maxDays = 7;
    const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
    return jobs.filter(job => new Date(job.publishedAt) >= cutoffDate);
  }

  private removeDuplicates(jobs: Job[]): Job[] {
    const seen = new Set();
    return jobs.filter(job => {
      const key = `${job.title}-${job.company}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
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
      console.error('Failed to update stats in localStorage:', error);
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

/**
 * @deprecated This adapter is being phased out in favor of direct API calls in DataManagementService.
 * It is currently only used by legacy components (JobAggregator).
 * Do not use for new features.
 */
export class CloudStorageAdapter {
  private provider: CloudStorageProvider;

  constructor(config: StorageConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: StorageConfig): CloudStorageProvider {
    switch (config.provider) {
      case 'vercel-kv':
        return new VercelKVProvider();
      case 'redis':
        return new RedisProvider(config.redisUrl);
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

// 创建存储适配器的工厂函数
export const createStorageAdapter = async (config?: Partial<StorageConfig>): Promise<CloudStorageAdapter> => {
  const defaultConfig: StorageConfig = {
    provider: 'localStorage',
    maxJobs: 1000,
    maxDays: 7
  };

  const finalConfig = { ...defaultConfig, ...config };

  // 在服务端环境，优先尝试 Vercel KV，然后是 Redis
  if (typeof window === 'undefined') {
    if (!finalConfig.provider || finalConfig.provider === 'localStorage') {
      const kvAdapter = new CloudStorageAdapter({ ...finalConfig, provider: 'vercel-kv' });
      if (await kvAdapter.isAvailable()) {
        return kvAdapter;
      }

      const redisAdapter = new CloudStorageAdapter({ ...finalConfig, provider: 'redis' });
      if (await redisAdapter.isAvailable()) {
        return redisAdapter;
      }
    }
  }

  return new CloudStorageAdapter(finalConfig);
};

// 检查是否在 Vercel 环境
const isVercelEnvironment = typeof window === 'undefined' &&
  typeof globalThis !== 'undefined' &&
  (globalThis as any).process?.env?.VERCEL;

// 全局存储适配器实例
let cloudStorageAdapter: CloudStorageAdapter;

(async () => {
  cloudStorageAdapter = await createStorageAdapter({
    provider: isVercelEnvironment ? 'vercel-kv' : 'localStorage'
  });
})();

export { cloudStorageAdapter };