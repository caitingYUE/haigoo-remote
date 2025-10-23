import { Job, JobCategory, JobFilter, JobStats, SyncStatus, AdminDashboardData } from '../types/rss-types';
import { rssService, RSSFeedItem, ParsedRSSData } from './rss-service';

class JobAggregator {
  private jobs: Job[] = [];
  private syncStatus: SyncStatus = {
    isRunning: false,
    lastSync: null,
    nextSync: null,
    totalSources: 0,
    successfulSources: 0,
    failedSources: 0,
    totalJobsProcessed: 0,
    newJobsAdded: 0,
    updatedJobs: 0,
    errors: []
  };

  /**
   * 自动分类岗位
   */
  private categorizeJob(title: string, description: string, sourceCategory: string): JobCategory {
    const text = `${title} ${description}`.toLowerCase();
    
    // 基于关键词的分类逻辑
    const categoryKeywords: Record<JobCategory, string[]> = {
      '前端开发': ['frontend', 'front-end', 'react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'ui developer'],
      '后端开发': ['backend', 'back-end', 'server', 'api', 'database', 'node.js', 'python', 'java', 'php', 'ruby', 'go', 'rust'],
      '全栈开发': ['fullstack', 'full-stack', 'full stack'],
      '软件开发': ['software engineer', 'software developer', 'programmer', 'coding', 'development'],
      'DevOps': ['devops', 'infrastructure', 'deployment', 'ci/cd', 'docker', 'kubernetes', 'aws', 'cloud', 'sysadmin'],
      '数据科学': ['data scientist', 'machine learning', 'ai', 'artificial intelligence', 'deep learning', 'ml engineer'],
      '数据分析': ['data analyst', 'business intelligence', 'analytics', 'tableau', 'power bi', 'sql analyst'],
      '产品管理': ['product manager', 'product owner', 'pm', 'product strategy'],
      '项目管理': ['project manager', 'scrum master', 'agile', 'pmp'],
      'UI/UX设计': ['ui designer', 'ux designer', 'user experience', 'user interface', 'figma', 'sketch'],
      '平面设计': ['graphic designer', 'visual designer', 'brand designer', 'creative designer'],
      '市场营销': ['marketing', 'digital marketing', 'content marketing', 'seo', 'sem', 'social media'],
      '数字营销': ['digital marketing', 'online marketing', 'performance marketing', 'growth marketing'],
      '销售': ['sales', 'business development', 'account manager', 'sales representative'],
      '客户服务': ['customer service', 'customer support', 'help desk', 'technical support'],
      '客户支持': ['customer support', 'client support', 'user support'],
      '人力资源': ['human resources', 'hr', 'recruiter', 'talent acquisition'],
      '财务': ['finance', 'accounting', 'financial analyst', 'controller', 'cfo'],
      '法律': ['legal', 'lawyer', 'attorney', 'compliance', 'paralegal'],
      '写作': ['writer', 'content writer', 'copywriter', 'technical writer', 'blogger'],
      '内容创作': ['content creator', 'content marketing', 'social media manager'],
      '质量保证': ['qa', 'quality assurance', 'tester', 'test engineer'],
      '测试': ['testing', 'test automation', 'qa engineer', 'software tester'],
      '运营': ['operations', 'business operations', 'ops manager'],
      '商务拓展': ['business development', 'bd', 'partnerships', 'strategic partnerships'],
      '咨询': ['consultant', 'consulting', 'advisory', 'strategy consultant'],
      '教育培训': ['education', 'training', 'instructor', 'teacher', 'tutor'],
      '其他': []
    };

    // 首先尝试基于源分类进行映射
    const sourceCategoryMap: Record<string, JobCategory> = {
      '前端编程': '前端开发',
      '后端编程': '后端开发',
      '全栈编程': '全栈开发',
      '所有编程': '软件开发',
      '软件开发': '软件开发',
      'DevOps和系统管理员': 'DevOps',
      'DevOps/系统管理员': 'DevOps',
      'DevOps': 'DevOps',
      '数据分析': '数据分析',
      '数据': '数据分析',
      '产品职位': '产品管理',
      '产品': '产品管理',
      '项目管理': '项目管理',
      '设计': 'UI/UX设计',
      '营销': '市场营销',
      '销售和市场营销': '市场营销',
      '销售/业务': '销售',
      '销售量': '销售',
      '销售': '销售',
      '客户支持': '客户支持',
      '客户服务': '客户服务',
      '人力资源': '人力资源',
      '财务与法律': '财务',
      '金融/法律': '财务',
      '金融': '财务',
      '写作': '写作',
      '质量保证': '质量保证',
      '管理和财务': '财务'
    };

    if (sourceCategoryMap[sourceCategory]) {
      return sourceCategoryMap[sourceCategory];
    }

    // 基于关键词匹配
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category as JobCategory;
      }
    }

    return '其他';
  }

  /**
   * 将RSS项目转换为Job对象
   */
  private convertRSSItemToJob(item: RSSFeedItem, source: string, sourceCategory: string): Job {
    const id = this.generateJobId(item.link, source);
    const category = this.categorizeJob(item.title, item.description, sourceCategory);
    
    return {
      id,
      title: item.title,
      company: item.company || this.extractCompanyFromDescription(item.description),
      location: item.location || 'Remote',
      description: item.description,
      salary: item.salary,
      jobType: (item.jobType as Job['jobType']) || 'Full-time',
      category,
      source,
      sourceUrl: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      tags: this.extractTags(item.title, item.description),
      requirements: this.extractRequirements(item.description),
      benefits: this.extractBenefits(item.description),
      applicationUrl: item.link,
      isRemote: this.isRemoteJob(item.title, item.description, item.location),
      experienceLevel: this.determineExperienceLevel(item.title, item.description)
    };
  }

  /**
   * 生成唯一的Job ID
   */
  private generateJobId(url: string, source: string): string {
    const hash = this.simpleHash(`${url}-${source}`);
    return `job_${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从描述中提取公司名称
   */
  private extractCompanyFromDescription(description: string): string {
    // 简单的公司名称提取逻辑
    const companyPatterns = [
      /Company:\s*([^\n\r]+)/i,
      /Employer:\s*([^\n\r]+)/i,
      /Organization:\s*([^\n\r]+)/i
    ];

    for (const pattern of companyPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Unknown Company';
  }

  /**
   * 提取标签
   */
  private extractTags(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const commonTags = [
      'remote', 'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js',
      'python', 'java', 'php', 'ruby', 'go', 'rust', 'docker', 'kubernetes',
      'aws', 'azure', 'gcp', 'sql', 'mongodb', 'postgresql', 'mysql',
      'agile', 'scrum', 'ci/cd', 'git', 'api', 'rest', 'graphql'
    ];

    return commonTags.filter(tag => text.includes(tag));
  }

  /**
   * 提取职位要求
   */
  private extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    const requirementPatterns = [
      /requirements?:?\s*([^.]+)/gi,
      /qualifications?:?\s*([^.]+)/gi,
      /skills?:?\s*([^.]+)/gi,
      /experience:?\s*([^.]+)/gi
    ];

    for (const pattern of requirementPatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          requirements.push(match[1].trim());
        }
      }
    }

    return requirements.slice(0, 5); // 限制数量
  }

  /**
   * 提取福利待遇
   */
  private extractBenefits(description: string): string[] {
    const benefits: string[] = [];
    const benefitPatterns = [
      /benefits?:?\s*([^.]+)/gi,
      /perks?:?\s*([^.]+)/gi,
      /offers?:?\s*([^.]+)/gi
    ];

    for (const pattern of benefitPatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          benefits.push(match[1].trim());
        }
      }
    }

    return benefits.slice(0, 5); // 限制数量
  }

  /**
   * 判断是否为远程工作
   */
  private isRemoteJob(title: string, description: string, location?: string): boolean {
    const text = `${title} ${description} ${location || ''}`.toLowerCase();
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'distributed', 'anywhere', 'worldwide', 'global'];
    return remoteKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 确定经验级别
   */
  private determineExperienceLevel(title: string, description: string): Job['experienceLevel'] {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('senior') || text.includes('lead') || text.includes('principal')) {
      return 'Senior';
    }
    if (text.includes('junior') || text.includes('entry') || text.includes('graduate')) {
      return 'Entry';
    }
    if (text.includes('executive') || text.includes('director') || text.includes('vp') || text.includes('cto') || text.includes('ceo')) {
      return 'Executive';
    }
    if (text.includes('lead') || text.includes('team lead') || text.includes('tech lead')) {
      return 'Lead';
    }
    
    return 'Mid'; // 默认中级
  }

  /**
   * 同步所有RSS源的数据
   */
  async syncAllJobs(): Promise<void> {
    if (this.syncStatus.isRunning) {
      console.log('Sync is already running');
      return;
    }

    this.syncStatus = {
      isRunning: true,
      lastSync: new Date(),
      nextSync: null,
      totalSources: rssService.getRSSSources().length,
      successfulSources: 0,
      failedSources: 0,
      totalJobsProcessed: 0,
      newJobsAdded: 0,
      updatedJobs: 0,
      errors: []
    };

    try {
      console.log('Starting RSS sync...');
      const rssData = await rssService.fetchAllRSSFeeds();
      
      for (const data of rssData) {
        try {
          this.processRSSData(data);
          this.syncStatus.successfulSources++;
        } catch (error) {
          this.syncStatus.failedSources++;
          this.syncStatus.errors.push({
            source: data.source,
            url: '', // RSS service doesn't return URL in ParsedRSSData
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }

      // 设置下次同步时间（1小时后）
      this.syncStatus.nextSync = new Date(Date.now() + 60 * 60 * 1000);
      
      console.log(`Sync completed. Added ${this.syncStatus.newJobsAdded} new jobs, updated ${this.syncStatus.updatedJobs} jobs`);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncStatus.isRunning = false;
    }
  }

  /**
   * 处理单个RSS数据源
   */
  private processRSSData(data: ParsedRSSData): void {
    for (const item of data.items) {
      const job = this.convertRSSItemToJob(item, data.source, data.category);
      const existingJobIndex = this.jobs.findIndex(j => j.id === job.id);
      
      if (existingJobIndex === -1) {
        // 新岗位
        this.jobs.push(job);
        this.syncStatus.newJobsAdded++;
      } else {
        // 更新现有岗位
        this.jobs[existingJobIndex] = { ...this.jobs[existingJobIndex], ...job, updatedAt: new Date() };
        this.syncStatus.updatedJobs++;
      }
      
      this.syncStatus.totalJobsProcessed++;
    }
  }

  /**
   * 获取所有岗位
   */
  getJobs(filter?: JobFilter): Job[] {
    let filteredJobs = [...this.jobs];

    if (filter) {
      if (filter.category && filter.category.length > 0) {
        filteredJobs = filteredJobs.filter(job => filter.category!.includes(job.category));
      }
      
      if (filter.jobType && filter.jobType.length > 0) {
        filteredJobs = filteredJobs.filter(job => filter.jobType!.includes(job.jobType));
      }
      
      if (filter.experienceLevel && filter.experienceLevel.length > 0) {
        filteredJobs = filteredJobs.filter(job => filter.experienceLevel!.includes(job.experienceLevel));
      }
      
      if (filter.source && filter.source.length > 0) {
        filteredJobs = filteredJobs.filter(job => filter.source!.includes(job.source));
      }
      
      if (filter.keywords) {
        const keywords = filter.keywords.toLowerCase();
        filteredJobs = filteredJobs.filter(job => 
          job.title.toLowerCase().includes(keywords) ||
          job.description.toLowerCase().includes(keywords) ||
          job.company.toLowerCase().includes(keywords)
        );
      }
      
      if (filter.isRemote !== undefined) {
        filteredJobs = filteredJobs.filter(job => job.isRemote === filter.isRemote);
      }
      
      if (filter.status && filter.status.length > 0) {
        filteredJobs = filteredJobs.filter(job => filter.status!.includes(job.status));
      }
    }

    return filteredJobs;
  }

  /**
   * 获取岗位统计信息
   */
  getJobStats(): JobStats {
    const activeJobs = this.jobs.filter(job => job.status === 'active');
    const recentlyAdded = this.jobs.filter(job => 
      job.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    const byCategory: Record<JobCategory, number> = {} as Record<JobCategory, number>;
    const bySource: Record<string, number> = {};
    const byJobType: Record<Job['jobType'], number> = {} as Record<Job['jobType'], number>;
    const byExperienceLevel: Record<Job['experienceLevel'], number> = {} as Record<Job['experienceLevel'], number>;

    activeJobs.forEach(job => {
      byCategory[job.category] = (byCategory[job.category] || 0) + 1;
      bySource[job.source] = (bySource[job.source] || 0) + 1;
      byJobType[job.jobType] = (byJobType[job.jobType] || 0) + 1;
      byExperienceLevel[job.experienceLevel] = (byExperienceLevel[job.experienceLevel] || 0) + 1;
    });

    return {
      total: this.jobs.length,
      byCategory,
      bySource,
      byJobType,
      byExperienceLevel,
      recentlyAdded,
      activeJobs: activeJobs.length
    };
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 获取管理后台数据
   */
  getAdminDashboardData(filter?: JobFilter): AdminDashboardData {
    return {
      jobs: this.getJobs(filter),
      stats: this.getJobStats(),
      syncStatus: this.getSyncStatus(),
      sources: rssService.getRSSSources()
    };
  }

  /**
   * 更新岗位状态
   */
  updateJobStatus(jobId: string, status: Job['status']): boolean {
    const jobIndex = this.jobs.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      this.jobs[jobIndex].status = status;
      this.jobs[jobIndex].updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * 删除岗位
   */
  deleteJob(jobId: string): boolean {
    const jobIndex = this.jobs.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      this.jobs.splice(jobIndex, 1);
      return true;
    }
    return false;
  }

  /**
   * 批量更新岗位分类
   */
  batchUpdateCategory(jobIds: string[], category: JobCategory): number {
    let updatedCount = 0;
    jobIds.forEach(jobId => {
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        this.jobs[jobIndex].category = category;
        this.jobs[jobIndex].updatedAt = new Date();
        updatedCount++;
      }
    });
    return updatedCount;
  }
}

export const jobAggregator = new JobAggregator();