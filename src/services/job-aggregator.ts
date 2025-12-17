import { Job, JobCategory, JobFilter, JobStats, SyncStatus, AdminDashboardData } from '../types/rss-types';
import { rssService, RSSFeedItem, ParsedRSSData } from './rss-service';
import { translationMappingService } from './translation-mapping-service';
import { getStorageAdapter } from './storage-factory';
import { CloudStorageAdapter } from './cloud-storage-adapter';
import { recommendationHistoryService } from './recommendation-history-service';
import { Job as PageJob } from '../types';
import { processedJobsService } from './processed-jobs-service';
import { CompanyService } from './company-service';

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
   * 将RSS Job转换为Page Job格式（用于推荐历史）
   */
  convertRSSJobToPageJob(rssJob: Job): PageJob {
    // 处理薪资信息
    let salary: { min: number; max: number; currency: string } | undefined = undefined;

    if (rssJob.salary && typeof rssJob.salary === 'string' && rssJob.salary.trim()) {
      const salaryText = rssJob.salary.trim();

      // 排除明显不是薪资的文本
      const excludePatterns = [
        /\$[\d,]+\s*(?:million|billion|k|thousand)\s*(?:company|business|startup|funding|investment|valuation|revenue)/i,
        /\$[\d,]+\s*(?:in|of)\s*(?:funding|investment|revenue|sales)/i,
        /\$[\d,]+\s*(?:raised|funded|invested)/i
      ];

      let isExcluded = false;
      for (const excludePattern of excludePatterns) {
        if (excludePattern.test(salaryText)) {
          isExcluded = true;
          break;
        }
      }

      if (!isExcluded) {
        // 尝试从字符串中解析薪资信息
        const salaryMatch = salaryText.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*[-–—到至]\s*(\d+(?:,\d+)*(?:\.\d+)?)/);
        if (salaryMatch) {
          const min = parseInt(salaryMatch[1].replace(/,/g, ''));
          const max = parseInt(salaryMatch[2].replace(/,/g, ''));
          if (min >= 1000 && max >= 1000 && min > 0 && max > 0) {
            salary = { min, max, currency: 'USD' };
          }
        } else {
          const singleMatch = salaryText.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
          if (singleMatch) {
            const amount = parseInt(singleMatch[1].replace(/,/g, ''));
            if ((amount >= 1000) || (amount >= 10 && salaryText.toLowerCase().includes('hour'))) {
              salary = { min: amount, max: amount, currency: 'USD' };
            }
          }
        }

        // 检测货币类型
        if (salary) {
          if (salaryText.includes('¥') || salaryText.includes('CNY') || salaryText.includes('人民币')) {
            salary.currency = 'CNY';
          } else if (salaryText.includes('$') || salaryText.includes('USD')) {
            salary.currency = 'USD';
          } else if (salaryText.includes('€') || salaryText.includes('EUR')) {
            salary.currency = 'EUR';
          }
        }
      }
    }

    // 确定工作类型
    let jobType: PageJob['type'] = 'full-time';
    if (rssJob.jobType) {
      switch (rssJob.jobType) {
        case 'full-time':
          jobType = 'full-time';
          break;
        case 'part-time':
          jobType = 'part-time';
          break;
        case 'contract':
          jobType = 'contract';
          break;
        case 'freelance':
          jobType = 'freelance';
          break;
        case 'internship':
          jobType = 'internship';
          break;
        default:
          jobType = rssJob.isRemote ? 'remote' : 'full-time';
      }
    } else if (rssJob.isRemote) {
      jobType = 'remote';
    }

    // 计算推荐分数
    let recommendationScore = 60; // 基础分数

    if (rssJob.isRemote) recommendationScore += 20;
    if (rssJob.tags && rssJob.tags.length > 0) {
      recommendationScore += Math.min(rssJob.tags.length * 3, 15);
    }
    if (rssJob.description && rssJob.description.length > 100) {
      recommendationScore += 10;
    }
    if (rssJob.company && rssJob.company.trim()) {
      recommendationScore += 5;
    }
    recommendationScore += Math.random() * 15;

    return {
      id: rssJob.id,
      title: rssJob.title,
      company: rssJob.company || undefined,
      location: rssJob.location || 'Remote',
      type: jobType,
      salary,
      description: rssJob.description || undefined,
      requirements: rssJob.requirements || [],
      responsibilities: rssJob.benefits || [],
      skills: rssJob.tags || [],
      publishedAt: rssJob.publishedAt || new Date().toISOString().split('T')[0],
      expiresAt: undefined,
      source: rssJob.source || 'RSS',
      sourceUrl: rssJob.url || '#',
      recommendationScore,
      experienceLevel: rssJob.experienceLevel,
      category: rssJob.category,
      isRemote: rssJob.isRemote,
      remoteLocationRestriction: rssJob.remoteLocationRestriction,
      isFeatured: rssJob.isFeatured
    };
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
        console.log(`成功保存 ${this.jobs.length} 个职位到存储`);
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
      '客户支持': '客户服务',
      '产品职位': '产品经理',
      '全栈编程': '全栈开发',
      '后端编程': '后端开发',
      '前端编程': '前端开发',
      '所有编程': '软件开发',
      '管理和财务': '财务',
      '设计': 'UI/UX设计',
      'DevOps和系统管理员': '运维/SRE',

      // Remotive 分类映射
      '软件开发': '软件开发',
      '客户服务': '客户服务',
      '营销': '市场营销',
      '销售/业务': '销售',
      '产品': '产品经理',
      '项目管理': '项目管理',
      '数据分析': '数据分析',
      'DevOps/系统管理员': '运维/SRE',
      '金融/法律': '财务',
      '人力资源': '人力资源',
      '质量保证': '测试/QA',
      '写作': '内容创作',

      // JobsCollider 分类映射
      '网络安全': '网络安全',
      '商业': '销售',
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
      '运维/SRE': [
        'devops', 'infrastructure', 'deployment', 'ci/cd', 'docker', 'kubernetes',
        'aws', 'cloud', 'sysadmin', 'site reliability', 'platform engineer',
        'infrastructure engineer', 'cloud engineer', 'systems engineer'
      ],
      '数据科学': [
        'data scientist', 'machine learning', 'ai', 'artificial intelligence',
        'deep learning', 'ml engineer', 'research scientist', 'ai engineer'
      ],
      '产品经理': [
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
      '客户服务': [
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
        'accountant', 'financial manager', 'finance manager', 'treasury',
        'bookkeeper', 'financial reporting', 'tax preparation', 'audit', 'cpa'
      ],

      '数据开发': [],
      '服务器开发': [],
      '操作系统/内核': [],
      '技术支持': [],
      '硬件开发': [],
      '架构师': [],
      'CTO/技术管理': [],
      '用户研究': [],
      '视觉设计': [],
      '客户经理': [],
      '增长黑客': [],
      '行政': [],
      '管理': [],
      '投资': [],
      '法务': [
        'legal', 'lawyer', 'attorney', 'compliance', 'paralegal', 'legal counsel',
        'general counsel', 'compliance officer'
      ],
      '内容创作': [
        'writer', 'content writer', 'copywriter', 'technical writer', 'blogger',
        'content creator', 'editor', 'communications', 'content marketing',
        'social media manager', 'content strategist', 'creative director', 'brand storyteller'
      ],
      '测试/QA': [
        'qa', 'quality assurance', 'tester', 'test engineer', 'qa engineer',
        'quality engineer', 'test automation', 'testing', 'software tester',
        'automation engineer', 'test lead'
      ],
      '运营': [
        'operations', 'business operations', 'ops manager', 'operations manager',
        'business ops', 'operational excellence'
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
      '算法工程师': [
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
      '其他': []
    };

    // 改进的源分类映射 - 更准确的映射关系
    const sourceCategoryMap: Record<string, JobCategory> = {
      // 英文源分类映射
      'Sales and Marketing': '销售',
      'Marketing': '市场营销',
      'Sales': '销售',
      'Customer Support': '客户服务',
      'Customer Service': '客户服务',
      'Human Resources': '人力资源',
      'Finance': '财务',
      'Legal': '法务',
      'Writing': '内容创作',
      'Design': 'UI/UX设计',
      'Product': '产品经理',
      'Project Management': '项目管理',
      'Data': '数据分析',
      'DevOps': '运维/SRE',
      'QA': '测试/QA',
      'Operations': '运营',
      'Business Development': '销售',
      'Consulting': '咨询',
      'Education': '教育培训',

      // 中文源分类映射
      '前端编程': '前端开发',
      '后端编程': '后端开发',
      '全栈编程': '全栈开发',
      '所有编程': '软件开发',
      '软件开发': '软件开发',
      'DevOps和系统管理员': '运维/SRE',
      'DevOps/系统管理员': '运维/SRE',
      '数据分析': '数据分析',
      '数据': '数据分析',
      '产品职位': '产品经理',
      '产品': '产品经理',
      '项目管理': '项目管理',
      '设计': 'UI/UX设计',
      '营销': '市场营销',
      '销售和市场营销': '销售',
      '销售/业务': '销售',
      '销售量': '销售',
      '销售': '销售',
      '客户支持': '客户服务',
      '客户服务': '客户服务',
      '人力资源': '人力资源',
      '财务与法律': '财务',
      '金融/法律': '财务',
      '金融': '财务',
      '写作': '内容创作',
      '质量保证': '测试/QA',
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
      return '产品经理';
    }

    // 基于关键词匹配 - 按优先级顺序检查
    const priorityOrder: JobCategory[] = [
      '销售', '市场营销', '产品经理', '前端开发', '后端开发', '全栈开发',
      '软件开发', '运维/SRE', '数据科学', '数据分析', 'UI/UX设计', '客户服务'
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
   * Determine job region based on location and tags
   */
  private async determineJobRegion(location: string, tags: string[]): Promise<'domestic' | 'overseas' | undefined> {
    try {
      const categories = await processedJobsService.getLocationCategories();
      const norm = (v: string) => (v || '').toLowerCase();
      const loc = norm(location);
      const tagSet = new Set(tags.map(t => norm(t)));

      const pool = new Set([loc, ...Array.from(tagSet)]);
      const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)));

      const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc);
      const domesticHit = hit(categories.domesticKeywords);
      const overseasHit = hit(categories.overseasKeywords);

      if (globalHit) return undefined; // Global jobs appear in both, so we don't force a specific region here, or we can default to one. 
      // Actually, based on requirements, we want to classify them. 
      // If it's global, it shows up in both. But for the "region" field, maybe we can leave it undefined or use a specific value?
      // The requirement says: "classify... into Domestic and Overseas". 
      // Let's use the same logic as frontend: if it hits domestic, it's domestic. If overseas, overseas.
      // If global, it's effectively both.

      if (domesticHit) return 'domestic';
      if (overseasHit) return 'overseas';

      // Default fallback based on simple heuristics if categories fail
      if (loc.includes('china') || loc.includes('cn') || loc.includes('beijing') || loc.includes('shanghai')) return 'domestic';
      return 'overseas';
    } catch (e) {
      console.warn('Failed to determine region:', e);
      return 'overseas'; // Default to overseas for English RSS feeds
    }
  }

  /**
   * 将RSS项目转换为Job对象 - 使用基于规则的解析
   */
  private async convertRSSItemToJob(item: RSSFeedItem, source: string, sourceCategory: string): Promise<Job> {
    const id = this.generateJobId(item.link, source);
    const category = this.categorizeJob(item.title, item.description, sourceCategory);
    const now = new Date().toISOString();
    const tags = this.extractTags(item.title, item.description, item.skills);
    const region = await this.determineJobRegion(item.location || '', tags);
    const companyWebsite = CompanyService.extractCompanyUrlFromDescription(item.description || '');

    return {
      id,
      title: item.title,
      company: item.company || this.extractCompanyFromDescription(item.description),
      location: item.location || 'Remote',
      description: item.description,
      url: item.link,
      companyWebsite,
      publishedAt: item.pubDate || now,
      source,
      category,
      salary: item.salary,
      jobType: (item.jobType as Job['jobType']) || 'full-time',
      experienceLevel: item.experienceLevel || this.determineExperienceLevel(item.title, item.description),
      remoteLocationRestriction: item.remoteLocationRestriction,
      tags,
      requirements: this.extractRequirements(item.description),
      benefits: this.extractBenefits(item.description),
      isRemote: item.workType === 'remote' || this.isRemoteJob(item.title, item.description, item.location),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      region
    };
  }

  /**
   * 备用转换方法（当AI解析失败时使用）
   */
  private convertRSSItemToJobFallback(item: RSSFeedItem, source: string, sourceCategory: string): Job {
    const id = this.generateJobId(item.link, source);
    const category = this.categorizeJob(item.title, item.description, sourceCategory);
    const now = new Date().toISOString();
    const companyWebsite = CompanyService.extractCompanyUrlFromDescription(item.description || '');

    return {
      id,
      title: item.title,
      company: item.company || this.extractCompanyFromDescription(item.description),
      location: item.location || 'Remote',
      description: item.description,
      url: item.link,
      companyWebsite,
      publishedAt: item.pubDate || now,
      source,
      category,
      salary: item.salary,
      jobType: (item.jobType as Job['jobType']) || 'full-time',
      experienceLevel: this.determineExperienceLevel(item.title, item.description),
      remoteLocationRestriction: undefined,
      tags: this.extractTags(item.title, item.description, item.skills),
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
  private extractTags(title: string, description: string, rssSkills?: string[]): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const commonTags = [
      'remote', 'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js',
      'python', 'java', 'php', 'ruby', 'go', 'rust', 'docker', 'kubernetes',
      'aws', 'azure', 'gcp', 'sql', 'mongodb', 'postgresql', 'mysql',
      'agile', 'scrum', 'ci/cd', 'git', 'api', 'rest', 'graphql'
    ];

    const matched = commonTags.filter(tag => text.includes(tag));
    const combined = [...matched, ...(rssSkills || [])];
    // 使用映射服务进行标准化与去重
    const normalized = translationMappingService.normalizeSkillTags(combined);
    return normalized;
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

      // 生成并保存今日推荐到历史记录
      if (this.jobs.length > 0) {
        try {
          console.log('生成今日推荐数据...');
          const convertedJobs = this.jobs.map(job => this.convertRSSJobToPageJob(job));

          // 按推荐分数排序，选择前6个岗位（分为2组，每组3个）
          const topRecommendations = convertedJobs
            .filter(job => job.recommendationScore && job.recommendationScore > 0) // 只选择有推荐分数的岗位
            .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
            .slice(0, 6); // 确保每天推荐6个岗位

          if (topRecommendations.length >= 6) {
            await recommendationHistoryService.saveDailyRecommendation(topRecommendations);
            console.log(`已保存 ${topRecommendations.length} 个今日推荐到历史记录（分为2组，每组3个岗位）`);
          } else {
            console.warn(`推荐岗位数量不足：只有 ${topRecommendations.length} 个岗位，需要至少6个`);
            // 如果岗位不足6个，仍然保存现有的推荐
            if (topRecommendations.length > 0) {
              await recommendationHistoryService.saveDailyRecommendation(topRecommendations);
              console.log(`已保存 ${topRecommendations.length} 个今日推荐到历史记录（岗位数量不足）`);
            }
          }
        } catch (error) {
          console.error('保存推荐历史失败:', error);
        }
      }

      // 设置下次同步时间（1小时后）
      this.syncStatus.nextSync = new Date(Date.now() + 60 * 60 * 1000);

      console.log(`同步完成。新增 ${this.syncStatus.newJobsAdded} 个职位，更新 ${this.syncStatus.updatedJobs} 个职位，总共处理 ${this.syncStatus.totalJobsProcessed} 个职位`);
      console.log(`当前总职位数: ${this.jobs.length}`);

      // 更新同步状态中的最后同步时间
      if (this.storageAdapter) {
        await this.storageAdapter.saveJobs(this.jobs);
      }
      // 通过后端API将岗位写入KV，确保生产环境使用真实数据
      try {
        await this.persistProcessedJobsToAPI();
      } catch (err) {
        console.error('通过API写入KV失败:', err);
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
    let skippedJobs = 0;

    console.log(`[RSS Debug] Source: ${data.source}, Items found: ${data.items.length}`);

    for (const item of data.items) {
      try {
        // Basic validation
        if (!item.title || !item.link) {
          console.warn(`[RSS Debug] Skipping invalid item: ${JSON.stringify(item).slice(0, 100)}`);
          skippedJobs++;
          continue;
        }

        const job = await this.convertRSSItemToJob(item, data.source, data.category);

        // Check if job is too old (e.g., > 30 days)
        const pubDate = new Date(job.publishedAt);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (pubDate < thirtyDaysAgo) {
          // console.log(`[RSS Debug] Skipping old job: ${job.title} (${job.publishedAt})`);
          // skippedJobs++;
          // continue;
          // For now, let's NOT skip old jobs to see if that's the issue, or log it but keep it.
        }

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
        skippedJobs++;
      }
    }

    console.log(`${data.source} - ${data.category} 处理完成: 新增 ${newJobs} 个，更新 ${updatedJobs} 个，跳过 ${skippedJobs} 个职位`);
  }

  /**
   * 从API刷新职位数据（获取服务端处理后的最新数据）
   */
  async refreshJobsFromAPI(): Promise<Job[]> {
    try {
      console.log('正在从服务端API刷新职位数据...');
      // 获取所有处理后的职位数据（默认限制为1000条，可根据需要调整）
      const processedJobs = await processedJobsService.getAllProcessedJobs(1000);

      if (processedJobs && processedJobs.length > 0) {
        // 转换类型: ProcessedJob -> RSSJob
        const jobs: Job[] = processedJobs.map(job => ({
          id: job.id,
          title: job.title,
          company: job.company || 'Unknown Company',
          location: job.location,
          description: job.description || '',
          url: job.sourceUrl || '#',
          companyWebsite: job.companyWebsite,
          publishedAt: job.publishedAt,
          source: job.source,
          category: (job.category as JobCategory) || '其他',
          salary: job.salary ? `${job.salary.min}-${job.salary.max} ${job.salary.currency}` : undefined,
          jobType: (job.type as any) || 'full-time',
          experienceLevel: job.experienceLevel || 'Entry',
          remoteLocationRestriction: job.remoteLocationRestriction,
          tags: job.skills || [],
          requirements: job.requirements || [],
          benefits: job.benefits || [], // Fix: benefits map correctly
          isRemote: job.isRemote || false,
          status: 'active',
          createdAt: job.publishedAt,
          updatedAt: new Date().toISOString(),
          region: job.region,

          // Sync Fields
          companyIndustry: job.companyIndustry,
          companyTags: job.companyTags,
          companyLogo: job.logo,
          companyDescription: job.companyDescription,
          companyId: job.companyId
        }));

        // 更新内存中的数据
        this.jobs = jobs;

        // 同时更新本地存储，以便下次加载
        if (this.storageAdapter) {
          await this.storageAdapter.saveJobs(jobs);
        }

        console.log(`成功从API刷新了 ${jobs.length} 个职位数据`);
        return jobs;
      } else {
        console.warn('API返回的职位数据为空');
        return this.jobs;
      }
    } catch (error) {
      console.error('刷新职位数据失败:', error);
      return this.jobs;
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

      if (filter.isFeatured !== undefined) {
        filteredJobs = filteredJobs.filter(job => !!job.isFeatured === filter.isFeatured);
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
  async updateJobStatus(jobId: string, status: Job['status']): Promise<boolean> {
    const jobIndex = this.jobs.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      this.jobs[jobIndex].status = status;
      this.jobs[jobIndex].updatedAt = new Date().toISOString();
      await this.saveJobsToStorage(); // Save to local/cloud adapter

      // Also persist to API for server consistency
      this.syncJobToAPI(this.jobs[jobIndex]).catch(err => console.error('Failed to sync job status to API:', err));

      return true;
    }
    return false;
  }

  /**
   * 删除岗位
   */
  deleteJob(jobId: string): boolean {
    const index = this.jobs.findIndex(job => job.id === jobId);
    if (index !== -1) {
      this.jobs.splice(index, 1);
      this.saveJobsToStorage();

      // Also delete from API
      fetch(`/api/data/processed-jobs?id=${jobId}`, { method: 'DELETE' })
        .catch(err => console.error('Failed to delete job from API:', err));

      return true;
    }
    return false;
  }

  /**
   * 更新岗位精选状态
   */
  async updateJobFeaturedStatus(jobId: string, isFeatured: boolean): Promise<boolean> {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      job.isFeatured = isFeatured;
      await this.saveJobsToStorage();

      // Persist to API
      this.syncJobToAPI(job).catch(err => console.error('Failed to sync featured status to API:', err));

      return true;
    }
    return false;
  }

  /**
   * 更新岗位内部数据 (Member Only Fields)
   */
  async updateJobInternalData(jobId: string, data: {
    riskRating?: Job['riskRating'];
    haigooComment?: string;
    hiddenFields?: Job['hiddenFields'];
  }): Promise<boolean> {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      if (data.riskRating !== undefined) job.riskRating = data.riskRating;
      if (data.haigooComment !== undefined) job.haigooComment = data.haigooComment;
      if (data.hiddenFields !== undefined) job.hiddenFields = data.hiddenFields;
      
      job.updatedAt = new Date().toISOString();
      await this.saveJobsToStorage();

      // Persist to API
      this.syncJobToAPI(job).catch(err => console.error('Failed to sync internal data to API:', err));

      return true;
    }
    return false;
  }

  /**
   * Helper to sync a single job to the backend API
   */
  private async syncJobToAPI(job: Job): Promise<void> {
    try {
      const resp = await fetch('/api/data/processed-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: [job],
          mode: 'upsert' // Use upsert mode to avoid deleting other jobs
        })
      });
      if (!resp.ok) {
        throw new Error(`Failed to sync job: ${resp.status}`);
      }
    } catch (error) {
      console.error('syncJobToAPI error:', error);
      throw error;
    }
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
   * 将当前聚合岗位通过API持久化到KV
   */
  private async persistProcessedJobsToAPI(): Promise<void> {
    try {
      const resp = await fetch('/api/data/processed-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: this.jobs })
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`POST /api/data/processed-jobs failed: ${resp.status} ${text}`);
      }
    } catch (error) {
      console.error('persistProcessedJobsToAPI error:', error);
      throw error;
    }
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
        console.log('存储数据已清除');
      }

      // 清除服务端数据库中的数据
      try {
        await processedJobsService.clearAllJobs();
        console.log('服务端数据库数据已清除');
      } catch (e) {
        console.error('清除服务端数据库失败 (但这不影响本地清除):', e);
      }

      console.log('所有数据清除完成');
    } catch (error) {
      console.error('清除数据失败:', error);
      throw error;
    }
  }
}

export const jobAggregator = new JobAggregator();