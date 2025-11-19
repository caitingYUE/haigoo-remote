import { browserScheduler, configureSchedulerForEnvironment } from './scheduler';
import { dataRetentionService } from './data-retention-service';

/**
 * 初始化RSS数据同步调度器
 * 
 * ⚠️ 前端调度器已禁用 ⚠️
 * 
 * 原因：前端不再自动拉取RSS数据，改为从后端API获取已处理和翻译的数据
 * 
 * 数据架构：
 * 1. 后端 Cron Job（api/cron/sync-jobs.js）定时拉取RSS、翻译、保存到Redis/KV
 * 2. 前端通过 processedJobsService 从后端API获取数据
 * 3. 前端显示翻译后的内容
 * 
 * 如需手动同步，请使用：
 * - 后台管理 → 职位数据 → 处理后数据 → "翻译数据" 按钮
 * - 或调用 POST /api/cron/sync-jobs
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
    
    console.log(`[前端调度器] 环境: ${environment}`);
    
    // 配置调度器
    configureSchedulerForEnvironment(environment);
    
    // ⚠️ 禁用前端自动同步，改为从后端API获取数据
    browserScheduler.getScheduler().updateConfig({ enabled: false });
    
    console.log('✅ 前端调度器已禁用，数据将从后端API获取');
    console.log('💡 如需手动同步，请访问后台管理或调用 POST /api/cron/sync-jobs');
    
    // 不再初始化浏览器调度器
    // browserScheduler.init(); // ❌ 已禁用
    
    // 在开发环境下提供调度器控制台访问（用于调试）
    if (isDevelopment) {
      (window as any).jobScheduler = browserScheduler.getScheduler();
      (window as any).dataRetentionService = dataRetentionService;
      console.log('🛠️ Scheduler available at window.jobScheduler for debugging (disabled by default)');
      console.log('🛠️ Data retention service available at window.dataRetentionService');
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