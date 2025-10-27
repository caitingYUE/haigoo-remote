import { Job, JobCategory, JobFilter, JobStats, SyncStatus, AdminDashboardData } from '../types/rss-types';
import { rssService, RSSFeedItem, ParsedRSSData } from './rss-service';
import { aiJobParser, ParsedJobInfo } from './ai-job-parser';
import { getStorageAdapter } from './storage-factory';
import { CloudStorageAdapter } from './cloud-storage-adapter';

class JobAggregator {
  private jobs: Job[] = [];
  private storageAdapter: CloudStorageAdapter | null = null;
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

  constructor() {
    // 初始化时从存储加载数据
    this.initializeStorage();
    // 启动时立即加载存储的数据
    this.loadJobsFromStorage();
    console.log('JobAggregator 初始化完成');
  }

  /**
   * 初始化存储适配器
   */
  private async initializeStorage(): Promise<void> {
    try {
      this.storageAdapter = await getStorageAdapter();
      await this.loadJobsFromStorage();
    } catch (error) {
      console.error('初始化存储失败:', error);
    }
  }

  /**
   * 从存储加载职位数据
   */
  private async loadJobsFromStorage(): Promise<void> {
    try {
      if (this.storageAdapter) {
        const storedJobs = await this.storageAdapter.loadJobs();
        if (storedJobs && storedJobs.length > 0) {
          this.jobs = storedJobs;
          console.log(`从存储加载了 ${storedJobs.length} 个职位数据`);
        } else {
          console.log('存储中没有找到职位数据');
        }
        
        // 更新同步状态
        const lastSync = await this.storageAdapter.getLastSyncTime();
        if (lastSync) {
          this.syncStatus.lastSync = lastSync;
        }
      } else {
        console.log('存储适配器未初始化，无法加载数据');
      }
    } catch (error) {
      console.error('从存储加载数据失败:', error);
      // 即使加载失败，也不要清空现有数据
    }
  }

  /**
   * 保存职位数据到存储
   */
  private async saveJobsToStorage(): Promise<void> {
    try {
      if (this.storageAdapter && this.jobs.length > 0) {
        await this.storageAdapter.saveJobs(this.jobs);
        console.log(`💾 成功保存 ${this.jobs.length} 个职位到存储`);
      } else if (!this.storageAdapter) {
        console.warn('存储适配器未初始化，无法保存数据');
      } else {
        console.log('没有职位数据需要保存');
      }
    } catch (error) {
      console.error('保存职位数据到存储失败:', error);
      // 保存失败不应该影响内存中的数据
    }
  }

  /**
   * 自动分类岗位
   */
  private categorizeJob(title: string, description: string, sourceCategory: string): JobCategory {
    // 首先尝试根据RSS源的分类进行映射
    const sourceCategoryMapping: Record<string, JobCategory> = {
      // WeWorkRemotely 分类映射
      '销售和市场营销': '市场营销',
      '客户支持': '客户支持',
      '产品职位': '产品管理',
      '全栈编程': '全栈开发',
      '后端编程': '后端开发',
      '前端编程': '前端开发',
      '所有编程': '软件开发',
      '管理和财务': '财务',
      '设计': 'UI/UX设计',
      'DevOps和系统管理员': 'DevOps',
      
      // Remotive 分类映射
      '软件开发': '软件开发',
      '客户服务': '客户支持',
      '营销': '市场营销',
      '销售/业务': '销售',
      '产品': '产品管理',
      '项目管理': '项目管理',
      '数据分析': '数据分析',
      'DevOps/系统管理员': 'DevOps',
      '金融/法律': '财务',
      '人力资源': '人力资源',
      '质量保证': '质量保证',
      '写作': '内容写作',
      
      // JobsCollider 分类映射
      '网络安全': 'DevOps',
      '商业': '商务拓展',
      '数据': '数据分析',
      '财务与法律': '财务',
      
      // RealWorkFromAnywhere 分类映射
      '开发人员': '软件开发',
      '工程师': '软件开发',
      '前端': '前端开发',
      '后端': '后端开发',
      '全栈开发': '全栈开发',
      '研究': '数据科学',
      '金融': '财务',
      '高级岗位': '软件开发',
      '行政': '运营'
    };

    // 如果RSS源分类有明确映射，优先使用
    if (sourceCategory && sourceCategoryMapping[sourceCategory]) {
      return sourceCategoryMapping[sourceCategory];
    }

    const text = `${title} ${description}`.toLowerCase();
    
    // 优化后的分类逻辑 - 更精确的关键词匹配
    const categoryKeywords: Record<JobCategory, string[]> = {
      '全部': [],
      '销售': [
        'sales', 'account executive', 'business development', 'account manager', 
        'sales representative', 'sales manager', 'sales director', 'account director',
        'business development manager', 'sales consultant', 'inside sales', 'outside sales',
        'enterprise sales', 'channel sales', 'regional sales', 'territory manager',
        'sales development', 'sales operations', 'revenue', 'quota', 'pipeline'
      ],
      '数据分析': [
        'data analyst', 'business intelligence', 'analytics', 'tableau', 'power bi', 
        'sql analyst', 'business analyst', 'data engineer', 'analytics engineer',
        'people analytics', 'workforce analytics', 'hr analytics', 'analytics analyst'
      ],
      '前端开发': [
        'frontend', 'front-end', 'react', 'vue', 'angular', 'javascript', 'typescript', 
        'html', 'css', 'ui developer', 'frontend developer', 'front end developer',
        'web developer', 'javascript developer', 'react developer', 'vue developer'
      ],
      '后端开发': [
        'backend', 'back-end', 'server', 'api', 'database', 'node.js', 'python', 
        'java', 'php', 'ruby', 'go', 'rust', 'backend developer', 'server developer',
        'api developer', 'microservices', 'backend engineer'
      ],
      '全栈开发': ['fullstack', 'full-stack', 'full stack', 'fullstack developer'],
      '软件开发': [
        'software engineer', 'software developer', 'programmer', 'coding', 'development',
        'engineer', 'developer', 'software architect', 'senior engineer', 'lead developer'
      ],
      'DevOps': [
        'devops', 'infrastructure', 'deployment', 'ci/cd', 'docker', 'kubernetes', 
        'aws', 'cloud', 'sysadmin', 'site reliability', 'platform engineer',
        'infrastructure engineer', 'cloud engineer', 'systems engineer'
      ],
      '数据科学': [
        'data scientist', 'machine learning', 'ai', 'artificial intelligence', 
        'deep learning', 'ml engineer', 'research scientist', 'ai engineer'
      ],
      '产品管理': [
        'product manager', 'product owner', 'pm', 'product strategy', 'product director',
        'senior product manager', 'associate product manager', 'product lead'
      ],
      '项目管理': [
        'project manager', 'scrum master', 'agile', 'pmp', 'program manager',
        'delivery manager', 'technical project manager'
      ],
      'UI/UX设计': [
        'ui designer', 'ux designer', 'user experience', 'user interface', 'figma', 
        'sketch', 'product designer', 'interaction designer', 'visual designer'
      ],
      '平面设计': [
        'graphic designer', 'visual designer', 'brand designer', 'creative designer',
        'art director', 'design director'
      ],
      '市场营销': [
        'marketing', 'digital marketing', 'content marketing', 'seo', 'sem', 'social media',
        'marketing manager', 'marketing director', 'brand manager', 'growth marketing',
        'performance marketing', 'email marketing', 'product marketing', 'field marketing',
        'demand generation', 'marketing coordinator', 'marketing specialist', 'campaign',
        'advertising', 'promotion', 'brand', 'communications', 'pr', 'public relations',
        'online marketing', 'paid media', 'ppc', 'google ads', 'facebook ads'
      ],
      '客户支持': [
        'customer service', 'customer support', 'help desk', 'technical support',
        'support specialist', 'customer success', 'client support', 'user support', 
        'support engineer', 'customer success manager', 'technical support engineer'
      ],
      '人力资源': [
        'human resources', 'hr', 'recruiter', 'talent acquisition', 'hr manager',
        'people operations', 'hr business partner', 'talent manager'
      ],
      '财务': [
        'finance', 'accounting', 'financial analyst', 'controller', 'cfo',
        'accountant', 'financial manager', 'finance manager', 'treasury'
      ],
      '法律': [
        'legal', 'lawyer', 'attorney', 'compliance', 'paralegal', 'legal counsel',
        'general counsel', 'compliance officer'
      ],
      '内容写作': [
        'writer', 'content writer', 'copywriter', 'technical writer', 'blogger',
        'content creator', 'editor', 'communications', 'content marketing', 
        'social media manager', 'content strategist', 'creative director', 'brand storyteller'
      ],
      '质量保证': [
        'qa', 'quality assurance', 'tester', 'test engineer', 'qa engineer',
        'quality engineer', 'test automation', 'testing', 'software tester',
        'automation engineer', 'test lead'
      ],
      '运营': [
        'operations', 'business operations', 'ops manager', 'operations manager',
        'business ops', 'operational excellence'
      ],
      '商务拓展': [
        'business development', 'bd', 'partnerships', 'strategic partnerships',
        'partnership manager', 'alliance manager'
      ],
      '咨询': [
        'consultant', 'consulting', 'advisory', 'strategy consultant',
        'management consultant', 'technical consultant'
      ],
      '教育培训': [
        'education', 'training', 'instructor', 'teacher', 'educator',
        'learning specialist', 'curriculum developer', 'training manager',
        'tutor', 'learning', 'curriculum', 'educational'
      ],
      '移动开发': [
        'mobile developer', 'ios developer', 'android developer', 'react native',
        'flutter', 'swift', 'kotlin', 'mobile app', 'app developer'
      ],
      '人工智能': [
        'artificial intelligence', 'ai engineer', 'machine learning engineer',
        'deep learning', 'neural networks', 'computer vision', 'nlp'
      ],
      '网络安全': [
        'cybersecurity', 'security engineer', 'information security', 'penetration testing',
        'security analyst', 'cyber security', 'infosec'
      ],
      '产品设计': [
        'product designer', 'design lead', 'design manager', 'user research',
        'design systems', 'design strategy'
      ],
      '商业分析': [
        'business analyst', 'business intelligence', 'data analyst', 'market research',
        'business strategy', 'process improvement'
      ],
      '招聘': [
        'recruiter', 'talent acquisition', 'hiring manager', 'recruitment',
        'talent sourcing', 'hr recruiter'
      ],
      '会计': [
        'accountant', 'accounting', 'bookkeeper', 'financial reporting',
        'tax preparation', 'audit', 'cpa'
      ],
      '其他': []
    };

    // 改进的源分类映射 - 更准确的映射关系
    const sourceCategoryMap: Record<string, JobCategory> = {
      // 英文源分类映射
      'Sales and Marketing': '销售',
      'Marketing': '市场营销',
      'Sales': '销售',
      'Customer Support': '客户支持',
      'Customer Service': '客户支持',
      'Human Resources': '人力资源',
      'Finance': '财务',
      'Legal': '法律',
      'Writing': '内容写作',
      'Design': 'UI/UX设计',
      'Product': '产品管理',
      'Project Management': '项目管理',
      'Data': '数据分析',
      'DevOps': 'DevOps',
      'QA': '质量保证',
      'Operations': '运营',
      'Business Development': '商务拓展',
      'Consulting': '咨询',
      'Education': '教育培训',
      
      // 中文源分类映射
      '前端编程': '前端开发',
      '后端编程': '后端开发',
      '全栈编程': '全栈开发',
      '所有编程': '软件开发',
      '软件开发': '软件开发',
      'DevOps和系统管理员': 'DevOps',
      'DevOps/系统管理员': 'DevOps',
      '数据分析': '数据分析',
      '数据': '数据分析',
      '产品职位': '产品管理',
      '产品': '产品管理',
      '项目管理': '项目管理',
      '设计': 'UI/UX设计',
      '营销': '市场营销',
      '销售和市场营销': '销售',
      '销售/业务': '销售',
      '销售量': '销售',
      '销售': '销售',
      '客户支持': '客户支持',
      '客户服务': '客户支持',
      '人力资源': '人力资源',
      '财务与法律': '财务',
      '金融/法律': '财务',
      '金融': '财务',
      '写作': '内容写作',
      '质量保证': '质量保证',
      '管理和财务': '财务'
    };

    // 首先尝试精确匹配源分类
    if (sourceCategoryMap[sourceCategory]) {
      return sourceCategoryMap[sourceCategory];
    }

    // 基于职位标题的优先级匹配 - 职位标题权重更高
    const titleText = title.toLowerCase();
    
    // 数据分析相关职位的特殊处理 - 优先级最高
    if (titleText.includes('people analytics') || titleText.includes('workforce analytics') || 
        titleText.includes('hr analytics') || titleText.includes('analytics analyst')) {
      return '数据分析';
    }
    
    // 销售相关职位的特殊处理
    if (titleText.includes('account executive') || titleText.includes('sales')) {
      return '销售';
    }
    
    // 市场营销相关职位的特殊处理
    if (titleText.includes('marketing') && !titleText.includes('product marketing')) {
      return '市场营销';
    }
    
    // 产品相关职位的特殊处理
    if (titleText.includes('product') && (titleText.includes('manager') || titleText.includes('owner'))) {
      return '产品管理';
    }

    // 基于关键词匹配 - 按优先级顺序检查
    const priorityOrder: JobCategory[] = [
      '销售', '市场营销', '产品管理', '前端开发', '后端开发', '全栈开发', 
      '软件开发', 'DevOps', '数据科学', '数据分析', 'UI/UX设计', '客户支持'
    ];
    
    for (const category of priorityOrder) {
      const keywords = categoryKeywords[category];
      if (keywords && keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    // 如果没有匹配到优先级分类，检查其他分类
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (!priorityOrder.includes(category as JobCategory) && keywords.some(keyword => text.includes(keyword))) {
        return category as JobCategory;
      }
    }

    return '其他';
  }

  /**
   * 将RSS项目转换为Job对象 - 使用AI解析
   */
  private async convertRSSItemToJob(item: RSSFeedItem, source: string, sourceCategory: string): Promise<Job> {
    const id = this.generateJobId(item.link, source);
    
    try {
      // 使用AI解析职位信息
      const parsedInfo: ParsedJobInfo = await aiJobParser.parseJobInfo(
        item.title,
        item.description,
        source
      );
      
      const now = new Date().toISOString();
      
      return {
        id,
        title: parsedInfo.title,
        company: parsedInfo.company,
        location: parsedInfo.location,
        description: item.description,
        url: item.link,
        publishedAt: item.pubDate || now,
        source,
        category: parsedInfo.category as JobCategory,
        salary: parsedInfo.salary,
        jobType: parsedInfo.jobType,
        experienceLevel: parsedInfo.experienceLevel,
        remoteLocationRestriction: parsedInfo.remoteLocationRestriction,
        tags: parsedInfo.tags,
        requirements: parsedInfo.requirements,
        benefits: parsedInfo.benefits,
        isRemote: this.isRemoteJob(parsedInfo.title, item.description, parsedInfo.location),
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('AI解析失败，使用备用方法:', error);
      // 备用方法：使用原有逻辑
      return this.convertRSSItemToJobFallback(item, source, sourceCategory);
    }
  }

  /**
   * 备用转换方法（当AI解析失败时使用）
   */
  private convertRSSItemToJobFallback(item: RSSFeedItem, source: string, sourceCategory: string): Job {
    const id = this.generateJobId(item.link, source);
    const category = this.categorizeJob(item.title, item.description, sourceCategory);
    const now = new Date().toISOString();
    
    return {
      id,
      title: item.title,
      company: item.company || this.extractCompanyFromDescription(item.description),
      location: item.location || 'Remote',
      description: item.description,
      url: item.link,
      publishedAt: item.pubDate || now,
      source,
      category,
      salary: item.salary,
      jobType: (item.jobType as Job['jobType']) || 'full-time',
      experienceLevel: this.determineExperienceLevel(item.title, item.description),
      remoteLocationRestriction: undefined,
      tags: this.extractTags(item.title, item.description),
      requirements: this.extractRequirements(item.description),
      benefits: this.extractBenefits(item.description),
      isRemote: this.isRemoteJob(item.title, item.description, item.location),
      status: 'active',
      createdAt: now,
      updatedAt: now
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
      console.log('同步已在运行中');
      return;
    }

    console.log('开始同步所有RSS职位数据...');
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
      console.log('开始RSS同步...');
      const rssData = await rssService.fetchAllRSSFeeds();
      console.log(`获取到 ${rssData.length} 个RSS数据源`);
      
      // 保留现有数据，进行增量更新而不是清空重建
      const oldJobsCount = this.jobs.length;
      console.log(`当前已有 ${oldJobsCount} 个职位数据，将进行增量更新`);
      
      for (const data of rssData) {
        try {
          console.log(`处理RSS数据: ${data.source} - ${data.category}, 包含 ${data.items.length} 个职位`);
          await this.processRSSData(data);
          this.syncStatus.successfulSources++;
        } catch (error) {
          console.error(`处理RSS数据失败: ${data.source}`, error);
          this.syncStatus.failedSources++;
          this.syncStatus.errors.push({
            source: data.source,
            url: '', // RSS service doesn't return URL in ParsedRSSData
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }

      // 保存数据到存储
      await this.saveJobsToStorage();

      // 设置下次同步时间（1小时后）
      this.syncStatus.nextSync = new Date(Date.now() + 60 * 60 * 1000);
      
      console.log(`同步完成。新增 ${this.syncStatus.newJobsAdded} 个职位，更新 ${this.syncStatus.updatedJobs} 个职位，总共处理 ${this.syncStatus.totalJobsProcessed} 个职位`);
      console.log(`当前总职位数: ${this.jobs.length}`);
      
      // 更新同步状态中的最后同步时间
      if (this.storageAdapter) {
        await this.storageAdapter.saveJobs(this.jobs);
      }
      
    } catch (error) {
      console.error('同步失败:', error);
      this.syncStatus.errors.push({
        source: 'System',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown sync error',
        timestamp: new Date()
      });
    } finally {
      this.syncStatus.isRunning = false;
      console.log('同步流程结束');
    }
  }

  /**
   * 处理单个RSS数据源
   */
  private async processRSSData(data: ParsedRSSData): Promise<void> {
    console.log(`开始处理RSS数据: ${data.source} - ${data.category}`);
    let newJobs = 0;
    let updatedJobs = 0;
    
    for (const item of data.items) {
      try {
        const job = await this.convertRSSItemToJob(item, data.source, data.category);
        const existingJobIndex = this.jobs.findIndex(j => j.id === job.id);
        
        if (existingJobIndex === -1) {
          // 新岗位
          this.jobs.push(job);
          this.syncStatus.newJobsAdded++;
          newJobs++;
        } else {
          // 更新现有岗位
          this.jobs[existingJobIndex] = { ...this.jobs[existingJobIndex], ...job, updatedAt: new Date().toISOString() };
          this.syncStatus.updatedJobs++;
          updatedJobs++;
        }
        
        this.syncStatus.totalJobsProcessed++;
      } catch (error) {
        console.error(`处理职位数据失败:`, item.title, error);
      }
    }
    
    console.log(`${data.source} - ${data.category} 处理完成: 新增 ${newJobs} 个，更新 ${updatedJobs} 个职位`);
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
      new Date(job.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
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
    console.log(`获取管理后台数据，当前职位数量: ${this.jobs.length}`);
    const filteredJobs = this.getJobs(filter);
    console.log(`过滤后职位数量: ${filteredJobs.length}`);
    
    return {
      jobs: filteredJobs,
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
      this.jobs[jobIndex].updatedAt = new Date().toISOString();
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
        this.jobs[jobIndex].updatedAt = new Date().toISOString();
        updatedCount++;
      }
    });
    return updatedCount;
  }

  /**
   * 清除所有数据
   */
  async clearAllData(): Promise<void> {
    try {
      console.log('开始清除所有数据...');
      
      // 清空内存中的数据
      this.jobs = [];
      
      // 重置同步状态
      this.syncStatus = {
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
      
      // 清除存储中的数据
      if (this.storageAdapter) {
        await this.storageAdapter.clearAllData();
        console.log('✅ 存储数据已清除');
      }
      
      console.log('✅ 所有数据清除完成');
    } catch (error) {
      console.error('清除数据失败:', error);
      throw error;
    }
  }
}

export const jobAggregator = new JobAggregator();