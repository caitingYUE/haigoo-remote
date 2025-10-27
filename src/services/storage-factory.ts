import { CloudStorageAdapter, createStorageAdapter, StorageConfig } from './cloud-storage-adapter';

class StorageFactory {
  private static instance: StorageFactory;
  private adapter: CloudStorageAdapter | null = null;
  private initPromise: Promise<CloudStorageAdapter> | null = null;

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  async getAdapter(config?: Partial<StorageConfig>): Promise<CloudStorageAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeAdapter(config);
    this.adapter = await this.initPromise;
    return this.adapter;
  }

  private async initializeAdapter(config?: Partial<StorageConfig>): Promise<CloudStorageAdapter> {
    const isVercelEnvironment = typeof window === 'undefined' && 
      typeof globalThis !== 'undefined' && 
      (globalThis as any).process?.env?.VERCEL;

    // 检查是否有 Redis URL 配置（兼容浏览器环境）
    const hasRedisConfig = typeof window === 'undefined' && 
      typeof process !== 'undefined' && 
      (process.env?.REDIS_URL || config?.redisUrl);

    const defaultConfig: Partial<StorageConfig> = {
      provider: isVercelEnvironment ? 'vercel-kv' : 
                hasRedisConfig ? 'redis' : 'localStorage',
      maxJobs: 1000,
      maxDays: 7,
      redisUrl: typeof process !== 'undefined' ? process.env?.REDIS_URL : undefined
    };

    const finalConfig = { ...defaultConfig, ...config };
    return await createStorageAdapter(finalConfig);
  }
}

// 导出单例实例
export const storageFactory = StorageFactory.getInstance();

// 导出便捷方法
export const getStorageAdapter = (config?: Partial<StorageConfig>) => 
  storageFactory.getAdapter(config);