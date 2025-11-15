import { Job, JobStats, SyncStatus, RSSSource, SyncError, JobCategory } from '../types/rss-types';
import { RSSFeedItem, ParsedRSSData, rssService } from './rss-service';
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
  private readonly RAW_DATA_KEY = 'haigoo:raw_data';
  private readonly PROCESSED_DATA_KEY = 'haigoo:processed_data';
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
   */
  async syncAllRSSData(): Promise<SyncStatus> {
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

      console.log(`开始同步 ${sources.length} 个RSS源...`);

      // 并发同步所有RSS源
      const syncPromises = sources.map(async (source, index) => {
        try {
          console.log(`[${index + 1}/${sources.length}] 同步 ${source.name} - ${source.category}`);
          
          const rawData = await this.fetchAndStoreRawData(source);
          const processedJobs = await this.processRawData(rawData);
          
          syncStatus.successfulSources++;
          syncStatus.totalJobsProcessed += rawData.length;
          syncStatus.newJobsAdded += processedJobs.length;
          
          console.log(`✅ ${source.name} - ${source.category}: ${rawData.length} 原始数据, ${processedJobs.length} 处理后职位`);
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
        
        // 使用现有的转换逻辑
        const job = this.convertRSSItemToProcessedJob(rssItem, rawData);
        
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
  private convertRSSItemToProcessedJob(item: RSSFeedItem, rawData: RawRSSData): ProcessedJobData {
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
    category?: string;
    source?: string;
    experienceLevel?: string;
    isManuallyEdited?: boolean;
    company?: string;
    // 新增：关键词搜索（岗位名称/公司/描述/地点/标签）
    search?: string;
    isRemote?: boolean;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
  }): Promise<PaginatedResult<ProcessedJobData>> {
    try {
      if (!this.storageAdapter) {
        await this.initializeStorage();
      }

      const allProcessedJobs = await this.loadProcessedJobs();
      
      // 应用过滤器
      let filteredJobs = allProcessedJobs;
      
      if (filters?.category) {
        filteredJobs = filteredJobs.filter(job => job.category === filters.category);
      }
      
      if (filters?.source) {
        filteredJobs = filteredJobs.filter(job => job.source === filters.source);
      }
      
      if (filters?.experienceLevel) {
        filteredJobs = filteredJobs.filter(job => job.experienceLevel === filters.experienceLevel);
      }
      
      if (filters?.isManuallyEdited !== undefined) {
        filteredJobs = filteredJobs.filter(job => job.isManuallyEdited === filters.isManuallyEdited);
      }
      
      if (filters?.company) {
        filteredJobs = filteredJobs.filter(job => 
          job.company.toLowerCase().includes(filters.company!.toLowerCase())
        );
      }

      // 关键词搜索：支持岗位名称/公司/描述/地点/标签
      if (filters?.search && filters.search.trim().length > 0) {
        const kw = filters.search.toLowerCase().trim();
        filteredJobs = filteredJobs.filter(job => {
          const inTitle = job.title?.toLowerCase().includes(kw);
          const inCompany = job.company?.toLowerCase().includes(kw);
          const inDesc = job.description?.toLowerCase().includes(kw);
          const inLocation = job.location?.toLowerCase().includes(kw);
          const inTags = Array.isArray(job.tags) && job.tags.some(t => t.toLowerCase().includes(kw));
          return inTitle || inCompany || inDesc || inLocation || inTags;
        });
      }
      
      if (filters?.isRemote !== undefined) {
        filteredJobs = filteredJobs.filter(job => job.isRemote === filters.isRemote);
      }
      
      if (filters?.tags && filters.tags.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.tags!.some(tag => 
            job.tags.some(jobTag => jobTag.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }
      
      if (filters?.dateRange) {
        filteredJobs = filteredJobs.filter(job => {
          const jobDate = new Date(job.publishedAt);
          return jobDate >= filters.dateRange!.start && jobDate <= filters.dateRange!.end;
        });
      }

      // 按发布时间排序（最新的在前）
      filteredJobs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // 分页
      const total = filteredJobs.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredJobs.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        total,
        page,
        pageSize,
        totalPages
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
   * 更新处理后的职位数据
   */
  async updateProcessedJob(jobId: string, updates: Partial<ProcessedJobData>, editedBy: string = 'admin'): Promise<boolean> {
    try {
      const allJobs = await this.loadProcessedJobs();
      const jobIndex = allJobs.findIndex(job => job.id === jobId);
      
      if (jobIndex === -1) {
        return false;
      }

      const currentJob = allJobs[jobIndex];
      const updatedJob = { ...currentJob };

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

      allJobs[jobIndex] = updatedJob;
      await this.saveProcessedJobs(allJobs, 'replace');

      return true;
    } catch (error) {
      console.error('更新职位数据失败:', error);
      return false;
    }
  }

  /**
   * 删除处理后的职位数据
   */
  async deleteProcessedJob(jobId: string): Promise<boolean> {
    try {
      const allJobs = await this.loadProcessedJobs();
      const filteredJobs = allJobs.filter(job => job.id !== jobId);
      
      if (filteredJobs.length === allJobs.length) {
        return false; // 没有找到要删除的职位
      }

      await this.saveProcessedJobs(filteredJobs, 'replace');
      return true;
    } catch (error) {
      console.error('删除职位数据失败:', error);
      return false;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // 优先从后端API读取真实统计信息（来源KV）
      const t = Date.now()
      const resp = await fetch(`/api/storage/stats?t=${t}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`GET /api/storage/stats failed: ${resp.status}`)
      const stats = await resp.json()

      const sources = rssService.getRSSSources()
      // 仅填充来源名称，其余计数由后续拓展对接到KV（当前保留0占位）
      const sourceStats = sources.map(source => ({
        name: `${source.name} - ${source.category}`,
        rawCount: 0,
        processedCount: 0,
        errorCount: 0,
        lastSync: stats?.lastSync ? new Date(stats.lastSync) : undefined
      }))

      return {
        totalRawData: 0, // 原始数据暂未入KV，保持0
        totalProcessedJobs: Number(stats?.totalJobs || 0),
        storageSize: Number(stats?.storageSize || 0),
        dataRetentionDays: this.RETENTION_DAYS,
        sources: sourceStats
      }
    } catch (error) {
      console.warn('API获取存储统计失败，回退本地计算:', error)
      try {
        const [rawData, processedJobs] = await Promise.all([
          this.loadRawData(),
          this.loadProcessedJobs()
        ])
        const sources = rssService.getRSSSources()
        const sourceStats = sources.map(source => {
          const rawCount = rawData.filter(item => item.source === source.name && item.category === source.category).length
          const processedCount = processedJobs.filter(job => job.source === source.name).length
          const errorCount = rawData.filter(item => item.source === source.name && item.status === 'error').length
          const lastSyncItems = rawData.filter(item => item.source === source.name && item.category === source.category)
          const lastSync = lastSyncItems.length > 0 ? new Date(Math.max(...lastSyncItems.map(item => new Date(item.fetchedAt).getTime()))) : undefined
          return { name: `${source.name} - ${source.category}`, rawCount, processedCount, errorCount, lastSync }
        })
        return {
          totalRawData: rawData.length,
          totalProcessedJobs: processedJobs.length,
          storageSize: JSON.stringify(rawData).length + JSON.stringify(processedJobs).length,
          dataRetentionDays: this.RETENTION_DAYS,
          sources: sourceStats
        }
      } catch (fallbackError) {
        console.error('获取存储统计失败（回退也失败）:', fallbackError)
        return {
          totalRawData: 0,
          totalProcessedJobs: 0,
          storageSize: 0,
          dataRetentionDays: this.RETENTION_DAYS,
          sources: []
        }
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
      console.warn('保存原始数据到API失败，回退到localStorage:', error)
      if (typeof window !== 'undefined') {
        const existingStr = localStorage.getItem(this.RAW_DATA_KEY)
        const existing = existingStr ? JSON.parse(existingStr) : []
        let merged = []
        if (mode === 'append') {
          merged = [...existing, ...data]
        } else {
          merged = [...data]
        }
        const cutoff = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000)
        const seen = new Set()
        const unique = merged.filter(item => {
          const key = (item.id || `${item.link}|${item.title}|${item.source}`).toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          const ts = new Date(item.fetchedAt || item.pubDate)
          return ts >= cutoff
        })
        localStorage.setItem(this.RAW_DATA_KEY, JSON.stringify(unique))
      }
    }
  }

  private async loadRawData(): Promise<RawRSSData[]> {
    try {
      const t = Date.now()
      const resp = await fetch(`/api/data/raw-rss?page=1&limit=10000&t=${t}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`GET /api/data/raw-rss failed: ${resp.status}`)
      const json = await resp.json()
      return Array.isArray(json?.items) ? json.items : (Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      console.warn('加载原始数据API失败，回退到localStorage:', error)
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem(this.RAW_DATA_KEY)
        return data ? JSON.parse(data) : []
      }
      return []
    }
  }

  private async saveProcessedJobs(jobs: ProcessedJobData[], mode: 'append' | 'replace' = 'append'): Promise<void> {
    try {
      // 分片上传，避免 413（请求体过大）
      const CHUNK_SIZE = 200;
      for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
        const chunk = jobs.slice(i, i + CHUNK_SIZE);
        const chunkMode = mode;
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
      console.warn('保存处理后数据到API失败，回退到localStorage:', error)
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.PROCESSED_DATA_KEY, JSON.stringify(jobs))
      }
    }
  }

  private async loadProcessedJobs(): Promise<ProcessedJobData[]> {
    try {
      const t = Date.now()
      const resp = await fetch(`/api/data/processed-jobs?page=1&limit=1000&t=${t}`, { cache: 'no-store' })
      if (!resp.ok) {
        throw new Error(`GET /api/data/processed-jobs failed: ${resp.status}`)
      }
      const json = await resp.json()
      return Array.isArray(json?.jobs) ? json.jobs : []
    } catch (error) {
      console.warn('加载处理后数据API失败，回退到localStorage:', error)
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem(this.PROCESSED_DATA_KEY)
        return data ? JSON.parse(data) : []
      }
      return []
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
      return u.replace(/[\)\]\.,;:!\u3002\uFF0C\uFF1B]+$/,'');
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
      'weworkremotely.com','remotive.com','himalayas.app','nodesk.co','remoteok.com','indeed.com','linkedin.com',
      'lever.co','greenhouse.io','workable.com','ashbyhq.com','jobs.github.com','stackoverflow.com','angel.co',
      'medium.com','twitter.com','facebook.com','instagram.com','youtube.com','t.co','bit.ly','goo.gl'
    ]);

    // 评分：排除聚合/社交域，排除与jobLink相同域；优先路径短且无查询参数
    const candidates = rawMatches
      .map(u => cleanUrl(u))
      .map(u => {
        let hostname = this.getDomain(u) || '';
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
        } catch {}
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
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('senior') || text.includes('sr.') || text.includes('lead')) {
      return 'Senior';
    }
    if (text.includes('junior') || text.includes('jr.') || text.includes('entry')) {
      return 'Entry';
    }
    if (text.includes('principal') || text.includes('staff') || text.includes('architect')) {
      return 'Lead';
    }
    if (text.includes('director') || text.includes('vp') || text.includes('cto') || text.includes('ceo')) {
      return 'Executive';
    }
    
    return 'Mid';
  }

  private categorizeJob(title: string, description: string, sourceCategory: string): JobCategory {
    // 简化的分类逻辑
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('frontend') || text.includes('react') || text.includes('vue') || text.includes('angular')) {
      return '前端开发';
    }
    if (text.includes('backend') || text.includes('api') || text.includes('server')) {
      return '后端开发';
    }
    if (text.includes('fullstack') || text.includes('full stack')) {
      return '全栈开发';
    }
    if (text.includes('design') || text.includes('ui') || text.includes('ux')) {
      return 'UI/UX设计';
    }
    if (text.includes('data') || text.includes('analytics') || text.includes('scientist')) {
      return '数据分析';
    }
    if (text.includes('devops') || text.includes('infrastructure') || text.includes('cloud')) {
      return 'DevOps';
    }
    if (text.includes('product') || text.includes('pm')) {
      return '产品管理';
    }
    if (text.includes('marketing') || text.includes('growth')) {
      return '市场营销';
    }
    
    // 尝试匹配源分类到标准分类
    const categoryMap: Record<string, JobCategory> = {
      'tech': '软件开发',
      'design': 'UI/UX设计',
      'marketing': '市场营销',
      'sales': '销售',
      'product': '产品管理',
      'data': '数据分析'
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