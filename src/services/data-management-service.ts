import { ClassificationService } from './classification-service';
import { Job, JobStats, SyncStatus, RSSSource, SyncError, JobCategory } from '../types/rss-types';
import { RSSFeedItem, ParsedRSSData, rssService } from './rss-service';
import { CompanyService } from './company-service';
import { getStorageAdapter } from './storage-factory';
import { CloudStorageAdapter } from './cloud-storage-adapter';

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
  private storageAdapter: CloudStorageAdapter | null = null;

  private readonly STATS_KEY = 'haigoo:data_stats';
  private readonly RETENTION_DAYS = 7;
  private readonly MAX_STORAGE_SIZE = 20 * 1024 * 1024; // 20MB

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      this.storageAdapter = await getStorageAdapter({
        provider: 'vercel-kv',
        maxDays: this.RETENTION_DAYS
      });
    } catch (error) {
      console.error('Failed to initialize storage adapter:', error);
    }
  }

  /**
   * 同步所有RSS源数据
   * @param skipProcessing 是否跳过处理步骤（仅拉取原始数据）
   */
  async syncAllRSSData(skipProcessing: boolean = false): Promise<SyncStatus> {
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

    try {
      const sources = rssService.getRSSSources();
      syncStatus.totalSources = sources.length;

      console.log(`开始同步 ${sources.length} 个RSS源... (跳过处理: ${skipProcessing})`);

      // 并发同步所有RSS源
      const syncPromises = sources.map(async (source, index) => {
        try {
          console.log(`[${index + 1}/${sources.length}] 同步 ${source.name} - ${source.category}`);

          const rawData = await this.fetchAndStoreRawData(source);

          let processedJobs: ProcessedJobData[] = [];
          if (!skipProcessing) {
            processedJobs = await this.processRawData(rawData);
            syncStatus.newJobsAdded += processedJobs.length;
          }

          syncStatus.successfulSources++;
          syncStatus.totalJobsProcessed += rawData.length;

          console.log(`✅ ${source.name} - ${source.category}: ${rawData.length} 原始数据` +
            (skipProcessing ? '' : `, ${processedJobs.length} 处理后职位`));
        } catch (error) {
          syncStatus.failedSources++;
          const syncError: SyncError = {
            source: source.name,
            url: source.url,
            error: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date()
          };
          syncStatus.errors.push(syncError);
          console.error(`❌ ${source.name} - ${source.category}: ${syncError.error}`);
        }
      });

      await Promise.all(syncPromises);

      // 清理过期数据
      await this.cleanupOldData();

      // 更新统计信息
      await this.updateStorageStats();

      syncStatus.isRunning = false;
      syncStatus.nextSync = new Date(Date.now() + 60 * 60 * 1000); // 1小时后

      console.log(`🎉 同步完成: ${syncStatus.successfulSources}/${syncStatus.totalSources} 成功, ${syncStatus.totalJobsProcessed} 个职位处理`);

    } catch (error) {
      syncStatus.isRunning = false;
      const syncError: SyncError = {
        source: 'System',
        url: '',
        error: `全局同步错误: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      };
      syncStatus.errors.push(syncError);
      console.error('同步过程中发生错误:', error);
    }

    return syncStatus;
  }

  /**
   * 获取并存储原始RSS数据
   */
  private async fetchAndStoreRawData(source: RSSSource): Promise<RawRSSData[]> {
    try {
      const xmlData = await rssService.fetchRSSFeed(source.url);
      const items = rssService.parseRSSFeed(xmlData, source);

      const rawDataList: RawRSSData[] = items.map(item => ({
        id: this.generateRawDataId(item.link, source.name),
        source: source.name,
        category: source.category,
        url: source.url,
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
        rawContent: JSON.stringify(item),
        fetchedAt: new Date(),
        status: 'raw'
      }));

      // 存储原始数据（增量追加）
      await this.saveRawData(rawDataList, 'append');

      return rawDataList;
    } catch (error) {
      console.error(`获取RSS数据失败 ${source.name}:`, error);
      throw error;
    }
  }

  /**
   * 处理原始数据为标准职位格式
   */
  private async processRawData(rawDataList: RawRSSData[]): Promise<ProcessedJobData[]> {
    const processedJobs: ProcessedJobData[] = [];

    for (const rawData of rawDataList) {
      try {
        const rssItem: RSSFeedItem = JSON.parse(rawData.rawContent);

        // 使用现有的转换逻辑（现在是异步的）
        const job = await this.convertRSSItemToProcessedJob(rssItem, rawData);

        processedJobs.push(job);

        // 更新原始数据状态
        rawData.status = 'processed';
      } catch (error) {
        rawData.status = 'error';
        rawData.processingError = error instanceof Error ? error.message : '处理失败';
        console.error(`处理原始数据失败 ${rawData.id}:`, error);
      }
    }

    // 保存处理后的数据（增量追加）
    await this.saveProcessedJobs(processedJobs, 'append');

    return processedJobs;
  }

  /**
   * 转换RSS项目为处理后的职位数据
   */
  private async convertRSSItemToProcessedJob(item: RSSFeedItem, rawData: RawRSSData): Promise<ProcessedJobData> {
    // 基础职位信息
    const baseJob: Job = {
      id: this.generateJobId(item.link, rawData.source),
      title: item.title,
      company: item.company || this.extractCompany(item.title, item.description),
      description: item.description,
      location: item.location || this.extractLocation(item.description),
      salary: item.salary,
      jobType: (item.jobType as Job['jobType']) || 'full-time',
      experienceLevel: item.experienceLevel || this.determineExperienceLevel(item.title, item.description),
      publishedAt: new Date(item.pubDate).toISOString(),
      source: rawData.source,
      url: item.link,
      companyWebsite: this.extractCompanyWebsite(item.description, item.link),
      category: this.categorizeJob(item.title, item.description, rawData.category),
      tags: this.extractTags(item.title, item.description),
      requirements: this.extractRequirements(item.description),
      benefits: this.extractBenefits(item.description),
      remoteLocationRestriction: item.remoteLocationRestriction,
      isRemote: this.isRemoteJob(item.title, item.description),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Generate AI summary (30-50 characters)
    try {
      const summaryResult = await this.generateJobSummary(
        baseJob.title,
        baseJob.description || '',
        baseJob.requirements
      );
      if (summaryResult) {
        baseJob.summary = summaryResult;
      }
    } catch (error) {
      console.warn(`Failed to generate summary for job ${baseJob.id}:`, error);
      // Continue without summary - it's optional
    }

    // 扩展为处理后的职位数据
    const processedJob: ProcessedJobData = {
      ...baseJob,
      rawDataId: rawData.id,
      processedAt: new Date(),
      processingVersion: '1.0.0',
      isManuallyEdited: false,
      editHistory: []
    };

    return processedJob;
  }

  /**
   * 生成岗位简介（30-50字）
   */
  private async generateJobSummary(
    title: string,
    description: string,
    responsibilities: string[]
  ): Promise<string | undefined> {
    try {
      const response = await fetch('/api/ai?action=generate-job-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          responsibilities
        })
      });

      if (!response.ok) {
        throw new Error(`Summary API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.summary : undefined;
    } catch (error) {
      console.error('Generate job summary error:', error);
      return undefined;
    }
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
      if (!this.storageAdapter) {
        await this.initializeStorage();
      }

      const allRawData = await this.loadRawData();

      // 应用过滤器
      let filteredData = allRawData;

      if (filters?.source) {
        filteredData = filteredData.filter(item => item.source === filters.source);
      }

      if (filters?.category) {
        filteredData = filteredData.filter(item => item.category === filters.category);
      }

      if (filters?.status) {
        filteredData = filteredData.filter(item => item.status === filters.status);
      }

      if (filters?.dateRange) {
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.fetchedAt);
          return itemDate >= filters.dateRange!.start && itemDate <= filters.dateRange!.end;
        });
      }

      // 按获取时间排序（最新的在前）
      filteredData.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());

      // 分页
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        total,
        page,
        pageSize,
        totalPages
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
    company?: string;
    // 新增：关键词搜索（岗位名称/公司/描述/地点/标签）
    search?: string;
    isRemote?: boolean;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
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
      if (filters?.search) queryParams.append('search', filters.search);
      if (filters?.isRemote !== undefined) queryParams.append('isRemote', filters.isRemote.toString());
      
      // 处理日期范围
      if (filters?.dateRange) {
        queryParams.append('dateFrom', filters.dateRange.start.toISOString().split('T')[0]);
        queryParams.append('dateTo', filters.dateRange.end.toISOString().split('T')[0]);
      }

      // 添加时间戳避免缓存
      queryParams.append('_t', Date.now().toString());

      // 调用后端API进行真正的分页查询
      const resp = await fetch(`/api/data/processed-jobs?${queryParams.toString()}`);
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
      const allJobs = await this.loadProcessedJobs();
      const filteredJobs = allJobs.filter(job => job.id !== jobId);

      if (filteredJobs.length === allJobs.length) {
        return false; // 未找到要删除的职位
      }

      await this.saveProcessedJobs(filteredJobs);
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
   * 重新处理所有职位的URL
   */
  async reprocessJobUrls(): Promise<{ updated: number }> {
    try {
      const allJobs = await this.loadProcessedJobs();
      let updatedCount = 0;

      const updatedJobs = allJobs.map(job => {
        const url = CompanyService.extractCompanyUrlFromDescription(job.description || '');
        // 如果提取到了URL，且与当前不同（或者当前为空），则更新
        if (url && url !== job.companyWebsite) {
          updatedCount++;
          return { ...job, companyWebsite: url };
        }
        return job;
      });

      if (updatedCount > 0) {
        await this.saveProcessedJobs(updatedJobs, 'replace');
      }

      return { updated: updatedCount };
    } catch (error) {
      console.error('重新处理URL失败:', error);
      return { updated: 0 };
    }
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
      console.warn('API获取存储统计失败，回退本地计算:', error);
      try {
        const [rawData, processedJobs] = await Promise.all([
          this.loadRawData(),
          this.loadProcessedJobs()
        ]);
        const sources = rssService.getRSSSources();
        const sourceStats = sources.map(source => {
          const rawCount = rawData.filter(item => item.source === source.name && item.category === source.category).length;
          const processedCount = processedJobs.filter(job => job.source === source.name).length;
          const errorCount = rawData.filter(item => item.source === source.name && item.status === 'error').length;
          const lastSyncItems = rawData.filter(item => item.source === source.name && item.category === source.category);
          const lastSync = lastSyncItems.length > 0 ? new Date(Math.max(...lastSyncItems.map(item => new Date(item.fetchedAt).getTime()))) : undefined;
          return { name: `${source.name} - ${source.category}`, rawCount, processedCount, errorCount, lastSync };
        });
        return {
          totalRawData: rawData.length,
          totalProcessedJobs: processedJobs.length,
          storageSize: JSON.stringify(rawData).length + JSON.stringify(processedJobs).length,
          dataRetentionDays: this.RETENTION_DAYS,
          sources: sourceStats
        };
      } catch (fallbackError) {
        console.error('获取存储统计失败（回退也失败）:', fallbackError);
        return {
          totalRawData: 0,
          totalProcessedJobs: 0,
          storageSize: 0,
          dataRetentionDays: this.RETENTION_DAYS,
          sources: []
        };
      }
    }
  }

  /**
   * 清理过期数据
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const [rawData, processedJobs] = await Promise.all([
        this.loadRawData(),
        this.loadProcessedJobs()
      ]);

      // 清理过期的原始数据
      const recentRawData = rawData.filter(item => new Date(item.fetchedAt) > cutoffDate);

      // 清理过期的处理后数据
      const recentProcessedJobs = processedJobs.filter(job => new Date(job.publishedAt) > cutoffDate);

      await Promise.all([
        this.saveRawData(recentRawData, 'replace'),
        this.saveProcessedJobs(recentProcessedJobs, 'replace')
      ]);

      const removedRaw = rawData.length - recentRawData.length;
      const removedProcessed = processedJobs.length - recentProcessedJobs.length;

      if (removedRaw > 0 || removedProcessed > 0) {
        console.log(`🧹 清理完成: 移除 ${removedRaw} 个原始数据, ${removedProcessed} 个处理后数据`);
      }
    } catch (error) {
      console.error('清理过期数据失败:', error);
    }
  }

  /**
   * 更新存储统计信息
   */
  private async updateStorageStats(): Promise<void> {
    try {
      const stats = await this.getStorageStats();

      if (this.storageAdapter) {
        // 这里可以保存统计信息到存储
        console.log('📊 存储统计:', {
          原始数据: stats.totalRawData,
          处理后数据: stats.totalProcessedJobs,
          存储大小: `${(stats.storageSize / 1024 / 1024).toFixed(2)}MB`
        });
      }
    } catch (error) {
      console.error('更新存储统计失败:', error);
    }
  }

  // 私有辅助方法
  private async saveRawData(data: RawRSSData[], mode: 'append' | 'replace' = 'append'): Promise<void> {
    try {
      const CHUNK_SIZE = 200
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE)
        const resp = await fetch('/api/data/raw-rss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk, mode })
        })
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`POST /api/data/raw-rss failed: ${resp.status} ${text}`)
        }
      }
    } catch (error) {
      console.error('保存原始数据到API失败:', error)
      throw error
    }
  }

  private async loadRawData(): Promise<RawRSSData[]> {
    try {
      const resp = await fetch(`/api/data/raw-rss?page=1&limit=10000&_t=${Date.now()}`)
      if (!resp.ok) throw new Error(`GET /api/data/raw-rss failed: ${resp.status}`)
      const json = await resp.json()
      return Array.isArray(json?.items) ? json.items : (Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      console.error('加载原始数据API失败:', error)
      return []
    }
  }

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

  private async loadProcessedJobs(): Promise<ProcessedJobData[]> {
    try {
      const resp = await fetch(`/api/data/processed-jobs?page=1&limit=1000&_t=${Date.now()}`)
      if (!resp.ok) {
        throw new Error(`GET /api/data/processed-jobs failed: ${resp.status}`)
      }
      const json = await resp.json()
      return Array.isArray(json?.jobs) ? json.jobs : []
    } catch (error) {
      console.error('加载处理后数据API失败:', error)
      throw error
    }
  }

  // 辅助方法（从job-aggregator复制）
  private generateRawDataId(url: string, source: string): string {
    return `raw_${this.simpleHash(url + source)}`;
  }

  private generateJobId(url: string, source: string): string {
    return `job_${this.simpleHash(url + source)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private extractCompany(title: string, description: string): string {
    // 简化的公司提取逻辑
    const companyMatch = title.match(/at\s+([^-,\n]+)/i) ||
      description.match(/Company:\s*([^,\n]+)/i) ||
      description.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:looking|hiring|seeking)/i);

    return companyMatch ? companyMatch[1].trim() : 'Unknown Company';
  }

  private extractLocation(description: string): string {
    const locationMatch = description.match(/Location:\s*([^,\n]+)/i) ||
      description.match(/Based in\s+([^,\n]+)/i) ||
      description.match(/Remote.*?from\s+([^,\n]+)/i);

    return locationMatch ? locationMatch[1].trim() : 'Remote';
  }

  private extractCompanyWebsite(description?: string, jobLink?: string): string | undefined {
    if (!description) return undefined;
    // 1) 先尝试从“公司官网/Website/Official”等标签附近提取URL
    const labeledUrlRegex = /(?:公司官网|企业官网|公司网站|官网|company\s*(?:website|site|page)?|official\s*(?:site|page)|website)\s*[:：]?\s*(https?:\/\/[^\s"'<)\]\u3002\uFF0C\uFF1B]+)/i;
    const labeledMatch = description.match(labeledUrlRegex);
    const cleanUrl = (u: string): string => {
      // 去除结尾多余标点或括号/方括号
      return u.replace(/[\)\]\.,;:!\u3002\uFF0C\uFF1B]+$/, '');
    }
    if (labeledMatch && labeledMatch[1]) {
      return cleanUrl(labeledMatch[1]);
    }

    // 2) 否则匹配所有URL，按域名和路径进行优先级筛选
    const urlRegex = /(https?:\/\/[^\s"'<)\]\u3002\uFF0C\uFF1B]+)/g;
    const rawMatches = description.match(urlRegex) || [];
    if (rawMatches.length === 0) return undefined;
    const jobDomain = jobLink ? this.getDomain(jobLink) : undefined;
    const excludeDomains = new Set([
      'weworkremotely.com', 'remotive.com', 'himalayas.app', 'nodesk.co', 'remoteok.com', 'indeed.com', 'linkedin.com',
      'lever.co', 'greenhouse.io', 'workable.com', 'ashbyhq.com', 'jobs.github.com', 'stackoverflow.com', 'angel.co',
      'medium.com', 'twitter.com', 'facebook.com', 'instagram.com', 'youtube.com', 't.co', 'bit.ly', 'goo.gl'
    ]);

    // 评分：排除聚合/社交域，排除与jobLink相同域；优先路径短且无查询参数
    const candidates = rawMatches
      .map(u => cleanUrl(u))
      .map(u => {
        const hostname = this.getDomain(u) || '';
        let score = 0;
        // 排除项给负分
        if (excludeDomains.has(hostname)) score -= 100;
        if (jobDomain && hostname === jobDomain) score -= 50;
        try {
          const parsed = new URL(u);
          const pathSegs = parsed.pathname.split('/').filter(Boolean).length;
          const hasQuery = !!parsed.search;
          // 路径越短、无查询分数越高
          score += (5 - Math.min(pathSegs, 5));
          if (!hasQuery) score += 2;
        } catch { }
        return { url: u, hostname, score };
      })
      .sort((a, b) => b.score - a.score);

    // 返回最高分候选
    return candidates[0]?.url || rawMatches[0];
  }

  private getDomain(url: string): string | undefined {
    try {
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  private isRemoteJob(title: string, description: string): boolean {
    const remoteKeywords = ['remote', 'work from home', 'distributed', 'anywhere'];
    const text = (title + ' ' + description).toLowerCase();
    return remoteKeywords.some(keyword => text.includes(keyword));
  }

  private determineExperienceLevel(title: string, description: string): 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' {
    return ClassificationService.determineExperienceLevel(title, description);
  }

  private categorizeJob(title: string, description: string, sourceCategory: string): JobCategory {
    // 优先使用 ClassificationService 进行分类
    const category = ClassificationService.classifyJob(title, description);
    if (category !== '其他') {
      return category;
    }

    // 尝试匹配源分类到标准分类
    const categoryMap: Record<string, JobCategory> = {
      'tech': '后端开发', // 默认为后端，或者泛指开发
      'software engineering': '后端开发',
      'web development': '前端开发',
      'design': 'UI/UX设计',
      'marketing': '市场营销',
      'sales': '销售',
      'product': '产品经理',
      'data': '数据分析',
      'customer support': '客户服务',
      'devops': '运维/SRE'
    };

    const mappedCategory = categoryMap[sourceCategory.toLowerCase()];
    return mappedCategory || '其他';
  }

  private extractTags(title: string, description: string): string[] {
    const techKeywords = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'python', 'java',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'flutter', 'react native',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins',
      'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch'
    ];

    const text = (title + ' ' + description).toLowerCase();
    return techKeywords.filter(keyword => text.includes(keyword));
  }

  private extractRequirements(description: string): string[] {
    const requirementSection = description.match(/(?:requirements?|qualifications?|skills?):?\s*(.*?)(?:\n\n|$)/is);
    if (requirementSection) {
      return requirementSection[1]
        .split(/[•\-\n]/)
        .map(req => req.trim())
        .filter(req => req.length > 10)
        .slice(0, 5);
    }
    return [];
  }

  private extractBenefits(description: string): string[] {
    const benefitSection = description.match(/(?:benefits?|perks?|we offer):?\s*(.*?)(?:\n\n|$)/is);
    if (benefitSection) {
      return benefitSection[1]
        .split(/[•\-\n]/)
        .map(benefit => benefit.trim())
        .filter(benefit => benefit.length > 5)
        .slice(0, 5);
    }
    return [];
  }
}

// 导出单例实例
export const dataManagementService = new DataManagementService();
