import { Job, SyncStatus, RSSSource, SyncError, JobCategory } from '../types/rss-types';
import { rssService } from './rss-service';

// 原始RSS数据接口
export interface RawRSSData {
  id: string;
  source: string;
  category: string;
  url: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  rawContent: string;
  fetchedAt: Date;
  status: 'raw' | 'processed' | 'error';
  processingError?: string;
}

// 处理后的职位数据
export interface ProcessedJobData extends Job {
  rawDataId: string; // 关联到原始数据的ID
  processedAt: Date;
  processingVersion: string;
  tags: string[];
  isManuallyEdited: boolean;
  editHistory: {
    field: string;
    oldValue: any;
    newValue: any;
    editedAt: Date;
    editedBy: string;
  }[];
}

// 存储统计信息
export interface StorageStats {
  totalRawData: number;
  totalProcessedJobs: number;
  storageSize: number; // bytes
  dataRetentionDays: number;
  sources: {
    name: string;
    rawCount: number;
    processedCount: number;
    errorCount: number;
    lastSync?: Date;
  }[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class DataManagementService {

  private readonly RETENTION_DAYS = 7;

  /**
   * 同步所有RSS源数据 (Backend-driven via SSE)
   * @param skipProcessing 是否跳过处理步骤（仅拉取原始数据）
   * @param onStatusUpdate 可选的状态更新回调
   */
  async syncAllRSSData(skipProcessing: boolean = false, onStatusUpdate?: (status: string) => void): Promise<SyncStatus> {
    const syncStatus: SyncStatus = {
      isRunning: true,
      lastSync: new Date(),
      nextSync: null,
      totalSources: 0,
      successfulSources: 0,
      failedSources: 0,
      totalJobsProcessed: 0,
      newJobsAdded: 0,
      updatedJobs: 0,
      errors: []
    };

    if (onStatusUpdate) onStatusUpdate('正在连接服务器启动同步任务...');

    return new Promise((resolve, reject) => {
        // Use daily-ingest task which runs fetch and process in sequence
        // Note: skipProcessing param is currently ignored by the backend daily-ingest task, 
        // which always runs both. We can enhance backend later if needed.
        const eventSource = new EventSource('/api/cron/index?task=daily-ingest');
        
        eventSource.onopen = () => {
            console.log('[Sync] SSE connection opened');
        };

        eventSource.onmessage = (event) => {
            // Generic message handler if needed
        };

        // Listen for specific events
        eventSource.addEventListener('sequence_start', (e: any) => {
            try {
                const data = JSON.parse(e.data);
                if (onStatusUpdate) onStatusUpdate(data.message);
                console.log('[Sync] Sequence Start:', data);
            } catch (err) {}
        });

        eventSource.addEventListener('task_start', (e: any) => {
            try {
                const data = JSON.parse(e.data);
                if (onStatusUpdate) onStatusUpdate(`正在执行: ${data.task === 'stream-fetch-rss' ? '抓取RSS' : '处理数据'}`);
                console.log('[Sync] Task Start:', data);
            } catch (err) {}
        });

        eventSource.addEventListener('fetch_complete', (e: any) => {
             try {
                const data = JSON.parse(e.data);
                syncStatus.totalSources = data.fetchedCount || 0; // Approx
                if (onStatusUpdate) onStatusUpdate(data.message);
            } catch (err) {}
        });

        eventSource.addEventListener('save_complete', (e: any) => {
             try {
                const data = JSON.parse(e.data);
                if (data.savedCount) {
                    syncStatus.newJobsAdded += data.savedCount; // Use this for new jobs or raw items depending on context
                }
                if (onStatusUpdate) onStatusUpdate(data.message);
            } catch (err) {}
        });

        eventSource.addEventListener('item_processing', (e: any) => {
             try {
                const data = JSON.parse(e.data);
                if (onStatusUpdate && data.message) onStatusUpdate(data.message);
            } catch (err) {}
        });

        eventSource.addEventListener('error', (e: any) => {
             try {
                const data = JSON.parse(e.data);
                console.error('[Sync] Error:', data);
                syncStatus.errors.push({
                    source: 'Backend',
                    url: '',
                    error: data.message || data.error,
                    timestamp: new Date()
                });
                // Don't close immediately on task error, sequence might continue? 
                // Actually daily-ingest sequence might fail if one task fails.
                // But let's wait for sequence_complete or close on fatal error.
            } catch (err) {}
        });

        eventSource.addEventListener('sequence_complete', (e: any) => {
            try {
                const data = JSON.parse(e.data);
                console.log('[Sync] Sequence Complete:', data);
                if (onStatusUpdate) onStatusUpdate('同步任务全部完成');
                syncStatus.isRunning = false;
                eventSource.close();
                resolve(syncStatus);
            } catch (err) {
                eventSource.close();
                resolve(syncStatus);
            }
        });

        eventSource.onerror = (err) => {
            console.error('[Sync] SSE Connection Error:', err);
            // Check readyState. If CLOSED (2), it's done.
            if (eventSource.readyState === EventSource.CLOSED) {
                // Already handled
            } else {
                eventSource.close();
                // If we haven't resolved yet
                if (syncStatus.isRunning) {
                    syncStatus.isRunning = false;
                    syncStatus.errors.push({
                        source: 'Connection',
                        url: '',
                        error: '连接中断',
                        timestamp: new Date()
                    });
                    reject(new Error('SSE Connection Error'));
                }
            }
        };
    });
  }

  /**
   * 获取原始RSS数据（分页查询）
   */
  async getRawData(page: number = 1, pageSize: number = 50, filters?: {
    source?: string;
    category?: string;
    status?: 'raw' | 'processed' | 'error';
    dateRange?: { start: Date; end: Date };
  }): Promise<PaginatedResult<RawRSSData>> {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', pageSize.toString());

      // 添加过滤器参数
      if (filters?.source) queryParams.append('source', filters.source);
      if (filters?.category) queryParams.append('category', filters.category);
      if (filters?.status) queryParams.append('status', filters.status);
      
      // 处理日期范围
      if (filters?.dateRange) {
        queryParams.append('dateFrom', filters.dateRange.start.toISOString().split('T')[0]);
        queryParams.append('dateTo', filters.dateRange.end.toISOString().split('T')[0]);
      }

      // 添加时间戳避免缓存
      queryParams.append('_t', Date.now().toString());

      // 调用后端API进行真正的分页查询
      const resp = await fetch(`/api/data/raw-rss?${queryParams.toString()}`);
      if (!resp.ok) {
        throw new Error(`GET /api/data/raw-rss failed: ${resp.status}`);
      }

      const result = await resp.json();
      
      // 转换后端API返回的数据格式为前端期望的格式
      return {
        data: result.items || [],
        total: result.total || 0,
        page: result.page || page,
        pageSize: result.pageSize || pageSize,
        totalPages: result.totalPages || 0
      };
    } catch (error) {
      console.error('获取原始数据失败:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      };
    }
  }

  /**
   * 获取处理后的职位数据（分页查询）
   */
  async getProcessedJobs(page: number = 1, pageSize: number = 50, filters?: {
    id?: string;
    category?: string;
    source?: string;
    experienceLevel?: string;
    isManuallyEdited?: boolean;
    isFeatured?: boolean;
    isApproved?: boolean;
    company?: string;
    industry?: string;
    // 新增：关键词搜索（岗位名称/公司/描述/地点/标签）
    search?: string;
    isRemote?: boolean;
    location?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    sortBy?: string;
  }): Promise<PaginatedResult<ProcessedJobData>> {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', pageSize.toString());

      // 添加过滤器参数
      if (filters?.id) queryParams.append('id', filters.id);
      if (filters?.category) queryParams.append('category', filters.category);
      if (filters?.source) queryParams.append('source', filters.source);
      if (filters?.company) queryParams.append('company', filters.company);
      if (filters?.industry) queryParams.append('industry', filters.industry);
      if (filters?.location) queryParams.append('location', filters.location);
      if (filters?.search) queryParams.append('search', filters.search);
      if (filters?.isRemote !== undefined) queryParams.append('isRemote', filters.isRemote.toString());
      if (filters?.isApproved !== undefined) queryParams.append('isApproved', filters.isApproved.toString());
      if (filters?.isFeatured !== undefined) queryParams.append('isFeatured', filters.isFeatured.toString());
      if (filters?.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters?.tags && filters.tags.length > 0) queryParams.append('tags', filters.tags.join(','));
      
      // 处理日期范围
      if (filters?.dateRange) {
        queryParams.append('dateFrom', filters.dateRange.start.toISOString().split('T')[0]);
        queryParams.append('dateTo', filters.dateRange.end.toISOString().split('T')[0]);
      }

      // 添加时间戳避免缓存
      queryParams.append('_t', Date.now().toString());

      // Get token for admin access
      const token = localStorage.getItem('haigoo_auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 调用后端API进行真正的分页查询
      const resp = await fetch(`/api/data/processed-jobs?${queryParams.toString()}`, {
        headers
      });
      if (!resp.ok) {
        throw new Error(`GET /api/data/processed-jobs failed: ${resp.status}`);
      }

      const result = await resp.json();
      
      // 转换后端API返回的数据格式为前端期望的格式
      return {
        data: result.jobs || [],
        total: result.total || 0,
        page: result.page || page,
        pageSize: result.pageSize || pageSize,
        totalPages: result.totalPages || 0
      };
    } catch (error) {
      console.error('获取处理后数据失败:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      };
    }
  }

  /**
   * 添加新的处理后职位
   */
  async addProcessedJob(job: ProcessedJobData): Promise<boolean> {
    try {
      job.isManuallyEdited = true;
      job.updatedAt = new Date().toISOString();
      await this.saveProcessedJobs([job], 'append');
      return true;
    } catch (error) {
      console.error('添加职位失败:', error);
      return false;
    }
  }

  /**
   * 更新处理后的职位数据
   */
  async updateProcessedJob(jobId: string, updates: Partial<ProcessedJobData>, editedBy: string = 'admin'): Promise<boolean> {
    try {
      // 优化：仅获取需要更新的职位，而不是全部加载
      const result = await this.getProcessedJobs(1, 1, { id: jobId });
      
      if (result.data.length === 0) {
        return false;
      }

      const currentJob = result.data[0];
      const updatedJob = { ...currentJob };
      
      // Ensure editHistory exists
      if (!updatedJob.editHistory) {
        updatedJob.editHistory = [];
      }

      // 记录编辑历史
      Object.keys(updates).forEach(field => {
        if (field !== 'editHistory' && updates[field as keyof ProcessedJobData] !== currentJob[field as keyof ProcessedJobData]) {
          updatedJob.editHistory.push({
            field,
            oldValue: currentJob[field as keyof ProcessedJobData],
            newValue: updates[field as keyof ProcessedJobData],
            editedAt: new Date(),
            editedBy
          });
        }
      });

      // 应用更新
      Object.assign(updatedJob, updates);
      updatedJob.isManuallyEdited = true;
      updatedJob.updatedAt = new Date().toISOString();

      // 使用 append 模式进行增量更新 (Upsert)，避免覆盖其他数据
      await this.saveProcessedJobs([updatedJob], 'append');

      return true;
    } catch (error) {
      console.error('更新职位数据失败:', error);
      return false;
    }
  }

  /**
   * 删除处理后的职位
   */
  async deleteProcessedJob(jobId: string): Promise<boolean> {
    try {
      const resp = await fetch(`/api/data/processed-jobs?id=${encodeURIComponent(jobId)}`, {
        method: 'DELETE'
      });

      if (!resp.ok) {
        throw new Error(`DELETE failed: ${resp.status}`);
      }

      return true;
    } catch (error) {
      console.error('删除职位失败:', error);
      return false;
    }
  }

  /**
   * 清除所有处理后的职位数据
   */
  async clearAllProcessedJobs(): Promise<boolean> {
    try {
      // Send explicit clear request to backend
      const resp = await fetch('/api/data/processed-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: [], mode: 'replace' })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to clear jobs: ${resp.status} ${text}`);
      }

      console.log('已清除所有处理后的职位数据');
      return true;
    } catch (error) {
      console.error('清除职位数据失败:', error);
      return false;
    }
  }

  /**
   * 重新处理所有职位的URL (Deprecated)
   * Functionality should be moved to backend
   */
  async reprocessJobUrls(): Promise<{ updated: number }> {
    console.warn('reprocessJobUrls is deprecated and disabled in frontend. Please implement backend task.');
    return { updated: 0 };
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // 优先从后端API读取真实统计信息（来源KV）
      const resp = await fetch(`/api/data/processed-jobs?action=stats&_t=${Date.now()}`);
      if (!resp.ok) throw new Error(`GET /api/data/processed-jobs?action=stats failed: ${resp.status}`);
      const stats = await resp.json();

      const sources = rssService.getRSSSources();
      const sourceStats = sources.map(source => ({
        name: `${source.name} - ${source.category}`,
        rawCount: 0,
        processedCount: 0,
        errorCount: 0,
        lastSync: stats?.lastSync ? new Date(stats.lastSync) : undefined
      }));

      return {
        totalRawData: 0,
        totalProcessedJobs: Number(stats?.totalJobs || 0),
        storageSize: Number(stats?.storageSize || 0),
        dataRetentionDays: this.RETENTION_DAYS,
        sources: sourceStats
      };
    } catch (error) {
      console.warn('API获取存储统计失败:', error);
       return {
          totalRawData: 0,
          totalProcessedJobs: 0,
          storageSize: 0,
          dataRetentionDays: this.RETENTION_DAYS,
          sources: []
        };
    }
  }

  /**
   * 清理过期数据
   */
  private async cleanupOldData(): Promise<void> {
    try {
      console.log('🧹 开始清理过期数据 (调用后端API)...');
      
      const sources = rssService.getRSSSources().map(s => s.name);

      const resp = await fetch(`/api/data/processed-jobs?action=cleanup&days=${this.RETENTION_DAYS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources })
      });
      
      const result = await resp.json();
      if (resp.ok && result.success) {
        console.log(`🧹 清理完成: 删除了 ${result.deleted} 个过期职位`);
      } else {
        console.warn('清理过期数据警告:', result.error || '未知错误');
      }
      
    } catch (error) {
      console.error('清理过期数据失败:', error);
    }
  }

  // 私有辅助方法
  private async saveProcessedJobs(jobs: ProcessedJobData[], mode: 'append' | 'replace' = 'append'): Promise<void> {
    try {
      // 分片上传，避免 413（请求体过大）
      const CHUNK_SIZE = 200;
      for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
        const chunk = jobs.slice(i, i + CHUNK_SIZE);
        // 如果是 'replace' 模式，只有第一批次使用 'replace'（清空旧数据），后续批次使用 'append'
        const chunkMode = (mode === 'replace' && i > 0) ? 'append' : mode;
        
        const resp = await fetch('/api/data/processed-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs: chunk, mode: chunkMode })
        })
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`POST /api/data/processed-jobs failed: ${resp.status} ${text}`)
        }
      }
    } catch (error) {
      console.error('保存处理后数据到API失败:', error)
      throw error
    }
  }

}

// 导出单例实例
export const dataManagementService = new DataManagementService();
