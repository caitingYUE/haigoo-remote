import { jobAggregator } from './job-aggregator';

export interface SchedulerConfig {
  syncInterval: number; // 同步间隔（毫秒）
  maxRetries: number; // 最大重试次数
  retryDelay: number; // 重试延迟（毫秒）
  enabled: boolean; // 是否启用定时同步
  dailySyncTime?: string; // 每日同步时间，格式：'HH:MM'，如 '10:00'
  enableDailySync?: boolean; // 是否启用每日定时同步
}

export class JobScheduler {
  private config: SchedulerConfig;
  private syncTimer: number | null = null;
  private dailySyncTimer: number | null = null;
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private syncCount = 0;
  private errorCount = 0;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      syncInterval: 30 * 60 * 1000, // 30分钟
      maxRetries: 3,
      retryDelay: 5 * 60 * 1000, // 5分钟
      enabled: true,
      dailySyncTime: '10:00',
      enableDailySync: true,
      ...config
    };
  }

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      console.log('Scheduler already running or disabled');
      return;
    }

    this.isRunning = true;
    console.log('Starting job scheduler...');

    // 立即执行一次同步
    this.performSync().catch(error => {
      console.error('Initial sync failed:', error);
    });

    // 设置定时器进行周期性同步
    this.syncTimer = window.setInterval(() => {
      this.performSync().catch(error => {
        console.error('Scheduled sync failed:', error);
      });
    }, this.config.syncInterval);

    // 如果启用了每日定时同步，设置每日同步
    if (this.config.enableDailySync && this.config.dailySyncTime) {
      this.scheduleDailySync();
    }
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    this.isRunning = false;

    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.dailySyncTimer) {
      window.clearTimeout(this.dailySyncTimer);
      this.dailySyncTimer = null;
    }

    console.log('Job scheduler stopped');
  }

  /**
   * 设置每日定时同步
   */
  private scheduleDailySync(): void {
    if (!this.config.dailySyncTime) return;

    const now = new Date();
    const [hours, minutes] = this.config.dailySyncTime.split(':').map(Number);
    
    const nextSync = new Date();
    nextSync.setHours(hours, minutes, 0, 0);
    
    // 如果今天的时间已过，设置为明天
    if (nextSync <= now) {
      nextSync.setDate(nextSync.getDate() + 1);
    }
    
    const timeUntilSync = nextSync.getTime() - now.getTime();
    
    this.dailySyncTimer = window.setTimeout(() => {
      this.performSync().catch(error => {
        console.error('Daily sync failed:', error);
      });
      // 设置下一次每日同步
      this.scheduleDailySync();
    }, timeUntilSync);
    
    console.log(`Next daily sync scheduled for: ${nextSync.toLocaleString()}`);
  }

  private async performSync(retryCount = 0): Promise<void> {
    try {
      console.log(`Starting sync attempt ${retryCount + 1}...`);
      this.lastSyncTime = new Date();
      
      await jobAggregator.syncAllJobs();
      
      this.syncCount++;
      console.log(`Sync completed successfully. Total syncs: ${this.syncCount}`);
    } catch (error) {
      this.errorCount++;
      console.error(`Sync failed (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < this.config.maxRetries) {
        console.log(`Retrying in ${this.config.retryDelay / 1000} seconds...`);
        setTimeout(() => {
          this.performSync(retryCount + 1);
        }, this.config.retryDelay);
      } else {
        console.error(`Max retries (${this.config.maxRetries}) reached. Giving up.`);
      }
    }
  }

  async triggerSync(): Promise<void> {
    console.log('Manual sync triggered');
    await this.performSync();
  }

  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.config = { ...this.config, ...newConfig };
    
    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      lastSyncTime: this.lastSyncTime,
      syncCount: this.syncCount,
      errorCount: this.errorCount,
      nextDailySync: this.getNextDailySyncTime(),
      config: this.config
    };
  }

  getStats() {
    return {
      totalSyncs: this.syncCount,
      totalErrors: this.errorCount,
      successRate: this.syncCount > 0 ? ((this.syncCount - this.errorCount) / this.syncCount * 100).toFixed(2) + '%' : '0%',
      lastSyncTime: this.lastSyncTime,
      isRunning: this.isRunning
    };
  }

  private getNextDailySyncTime(): Date | null {
    if (!this.config.enableDailySync || !this.config.dailySyncTime) {
      return null;
    }

    const now = new Date();
    const [hours, minutes] = this.config.dailySyncTime.split(':').map(Number);
    
    const nextSync = new Date();
    nextSync.setHours(hours, minutes, 0, 0);
    
    if (nextSync <= now) {
      nextSync.setDate(nextSync.getDate() + 1);
    }
    
    return nextSync;
  }

  resetStats(): void {
    this.syncCount = 0;
    this.errorCount = 0;
  }
}

export const jobScheduler = new JobScheduler({
  syncInterval: 30 * 60 * 1000, // 30分钟
  maxRetries: 3,
  retryDelay: 5 * 60 * 1000, // 5分钟
  enabled: true,
  dailySyncTime: '10:00', // 每天早上10点
  enableDailySync: true
});

export const SchedulerPresets = {
  development: {
    syncInterval: 5 * 60 * 1000, // 5分钟
    maxRetries: 2,
    retryDelay: 2 * 60 * 1000, // 2分钟
    enabled: true,
    dailySyncTime: '10:00',
    enableDailySync: true
  },
  
  production: {
    syncInterval: 30 * 60 * 1000, // 30分钟
    maxRetries: 3,
    retryDelay: 5 * 60 * 1000, // 5分钟
    enabled: true,
    dailySyncTime: '10:00',
    enableDailySync: true
  },
  
  highFrequency: {
    syncInterval: 10 * 60 * 1000, // 10分钟
    maxRetries: 5,
    retryDelay: 2 * 60 * 1000, // 2分钟
    enabled: true,
    dailySyncTime: '10:00',
    enableDailySync: true
  },
  
  lowFrequency: {
    syncInterval: 2 * 60 * 60 * 1000, // 2小时
    maxRetries: 2,
    retryDelay: 10 * 60 * 1000, // 10分钟
    enabled: true,
    dailySyncTime: '10:00',
    enableDailySync: true
  },
  
  disabled: {
    syncInterval: 30 * 60 * 1000,
    maxRetries: 3,
    retryDelay: 5 * 60 * 1000,
    enabled: false,
    enableDailySync: false
  }
};

export function configureSchedulerForEnvironment(env: 'development' | 'production' = 'production') {
  const config = SchedulerPresets[env];
  if (config) {
    jobScheduler.updateConfig(config);
    console.log(`Scheduler configured for ${env} environment`);
  }
}

export class BrowserScheduler {
  private static instance: BrowserScheduler | null = null;
  private scheduler: JobScheduler;
  private isInitialized = false;

  private constructor() {
    this.scheduler = jobScheduler;
  }

  static getInstance(): BrowserScheduler {
    if (!BrowserScheduler.instance) {
      BrowserScheduler.instance = new BrowserScheduler();
    }
    return BrowserScheduler.instance;
  }

  init(): void {
    if (this.isInitialized) {
      console.log('Browser scheduler already initialized');
      return;
    }

    console.log('Initializing browser scheduler...');
    
    // 页面可见性变化时的处理
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.scheduler.getStatus().isRunning) {
        console.log('Page became visible, triggering sync...');
        this.scheduler.triggerSync().catch(console.error);
      }
    });

    // 网络状态变化时的处理
    window.addEventListener('online', () => {
      console.log('Network connection restored, triggering sync...');
      this.scheduler.triggerSync().catch(console.error);
    });

    // 开发环境下暴露到全局对象
    if (import.meta.env.DEV) {
      (window as any).jobScheduler = this.scheduler;
      console.log('Job scheduler exposed to window.jobScheduler for debugging');
    }

    // 启动调度器
    this.scheduler.start();
    this.isInitialized = true;
    
    console.log('Browser scheduler initialized successfully');
  }

  getScheduler(): JobScheduler {
    return this.scheduler;
  }

  destroy(): void {
    this.scheduler.stop();
    this.isInitialized = false;
  }
}

export const browserScheduler = BrowserScheduler.getInstance();