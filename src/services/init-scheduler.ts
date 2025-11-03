import { browserScheduler, configureSchedulerForEnvironment } from './scheduler';
import { dataRetentionService } from './data-retention-service';

/**
 * 初始化RSS数据同步调度器
 */
export function initializeScheduler() {
  // 检查是否在浏览器环境
  if (typeof window === 'undefined') {
    console.warn('Scheduler initialization skipped: not in browser environment');
    return;
  }

  try {
    // 根据环境配置调度器
    const isDevelopment = import.meta.env.DEV;
    const environment = isDevelopment ? 'development' : 'production';
    
    console.log(`Initializing scheduler for ${environment} environment`);
    
    // 配置调度器
    configureSchedulerForEnvironment(environment);
    
    // 初始化浏览器调度器
    browserScheduler.init();
    
    console.log('RSS job scheduler initialized successfully');
    
    // 在开发环境下提供调度器控制台访问
    if (isDevelopment) {
      (window as any).jobScheduler = browserScheduler.getScheduler();
      (window as any).dataRetentionService = dataRetentionService;
      console.log('Scheduler available at window.jobScheduler for debugging');
      console.log('Data retention service available at window.dataRetentionService for debugging');
    }
    
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
  }
}

/**
 * 清理调度器资源
 */
export function cleanupScheduler() {
  try {
    browserScheduler.destroy();
    console.log('Scheduler cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup scheduler:', error);
  }
}

// 自动初始化（仅在浏览器环境）
if (typeof window !== 'undefined') {
  // 等待DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScheduler);
  } else {
    // DOM已经加载完成，直接初始化
    initializeScheduler();
  }
  
  // 页面卸载时清理资源
  window.addEventListener('beforeunload', cleanupScheduler);
}