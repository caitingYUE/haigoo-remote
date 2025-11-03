// RSS数据到统一岗位表的映射服务
import { 
  UnifiedJob, 
  RawRssJob, 
  JobCategory, 
  JobLevel, 
  JobType, 
  IndustryType, 
  LocationType, 
  LocationRestriction,
  LanguageLevel,
  LanguageRequirement,
  SalaryRange,
  SalaryPeriod,
  DataQuality,
  MappingConfig
} from '../types/unified-job-types';
import { Job as RSSJob } from '../types/rss-types';
import { translationMappingService } from './translation-mapping-service';

export class JobMappingService {
  private mappingConfig: MappingConfig;
  
  constructor() {
    this.mappingConfig = this.initializeMappingConfig();
  }

  /**
   * 将RSS岗位数据映射为统一岗位数据
   */
  public async mapRssJobToUnified(rssJob: RSSJob, rawRssJob?: RawRssJob): Promise<UnifiedJob> {
    const unifiedJob: UnifiedJob = {
      id: this.generateUnifiedId(rssJob),
      
      // 岗位信息映射
      jobTitle: this.cleanJobTitle(rssJob.title),
      jobCategory: this.mapJobCategory(rssJob),
      jobLevel: this.mapJobLevel(rssJob),
      jobType: this.mapJobType(rssJob),
      
      // 企业信息映射
      companyName: rssJob.company || '未知企业',
      companyWebsite: this.extractCompanyWebsite(rssJob),
      companyLinkedIn: this.extractCompanyLinkedIn(rssJob),
      industryType: this.mapIndustryType(rssJob),
      
      // 发布信息
      publishDate: rssJob.publishedAt,
      expiryDate: undefined, // RSS数据中没有过期日期字段
      
      // 地理和工作方式
      locationRestriction: this.mapLocationRestriction(rssJob),
      isRemote: rssJob.isRemote || false,
      timezone: this.extractTimezone(rssJob),
      
      // 技能和要求
      skillTags: this.extractSkillTags(rssJob),
      languageRequirements: this.extractLanguageRequirements(rssJob),
      
      // 薪资信息
      salaryRange: this.mapSalaryRange(rssJob),
      currency: this.extractCurrency(rssJob),
      
      // 岗位详情
      description: rssJob.description,
      requirements: rssJob.requirements || [],
      responsibilities: this.extractResponsibilities(rssJob),
      benefits: rssJob.benefits || [],
      
      // 数据来源
      sourceUrl: rssJob.url,
      sourcePlatform: rssJob.source,
      
      // 元数据
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataQuality: this.calculateDataQuality(rssJob),
      
      // RSS原始数据关联
      originalRssId: rawRssJob?.id
    };

    return unifiedJob;
  }

  /**
   * 生成统一岗位ID
   */
  private generateUnifiedId(rssJob: RSSJob): string {
    const hash = this.simpleHash(`${rssJob.title}-${rssJob.company}-${rssJob.publishedAt}`);
    return `unified-${hash}`;
  }

  /**
   * 清理岗位标题
   */
  private cleanJobTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fff-]/g, '')
      .trim();
  }

  /**
   * 映射岗位分类
   */
  private mapJobCategory(rssJob: RSSJob): JobCategory {
    const title = rssJob.title?.toLowerCase() || '';
    const description = rssJob.description?.toLowerCase() || '';
    const combined = `${title} ${description}`;
    
    // 使用翻译映射服务进行智能分类
    return translationMappingService.normalizeJobCategory(combined);
  }

  /**
   * 映射岗位级别
   */
  private mapJobLevel(rssJob: RSSJob): JobLevel {
    const title = rssJob.title || '';
    
    // 使用翻译映射服务进行智能级别识别
    return translationMappingService.normalizeJobLevel(title);
  }

  /**
   * 映射岗位类型
   */
  private mapJobType(rssJob: RSSJob): JobType {
    const title = rssJob.title?.toLowerCase() || '';
    const description = rssJob.description?.toLowerCase() || '';
    const combined = `${title} ${description}`;
    
    // 使用翻译映射服务进行智能类型识别
    return translationMappingService.normalizeJobType(combined);
  }

  /**
   * 映射行业类型
   */
  private mapIndustryType(rssJob: RSSJob): IndustryType {
    const company = rssJob.company?.toLowerCase() || '';
    const description = rssJob.description?.toLowerCase() || '';
    const combined = `${company} ${description}`;
    
    // 使用翻译映射服务进行智能行业识别
    return translationMappingService.normalizeIndustryType(combined);
  }

  /**
   * 映射地理限制
   */
  private mapLocationRestriction(rssJob: RSSJob): LocationRestriction {
    const location = (rssJob.location || '').toLowerCase();
    const restriction = (rssJob.remoteLocationRestriction || '').toLowerCase();
    const isRemote = rssJob.isRemote;
    
    if (isRemote && (restriction.includes('anywhere') || restriction.includes('global') || restriction.includes('不限'))) {
      return {
        type: LocationType.NO_RESTRICTION,
        description: '全球远程'
      };
    }
    
    if (location.includes('remote') || location.includes('远程')) {
      if (restriction) {
        return {
          type: LocationType.SPECIFIC_REGIONS,
          regions: [restriction],
          description: `远程工作，限制：${restriction}`
        };
      }
      return {
        type: LocationType.NO_RESTRICTION,
        description: '远程工作'
      };
    }
    
    if (location) {
      return {
        type: LocationType.SPECIFIC_REGIONS,
        regions: [location],
        description: `现场办公：${location}`
      };
    }
    
    return {
      type: LocationType.NO_RESTRICTION,
      description: '地点待定'
    };
  }

  /**
   * 提取技能标签
   */
  private extractSkillTags(rssJob: RSSJob): string[] {
    const title = rssJob.title || '';
    const description = rssJob.description || '';
    const requirements = rssJob.requirements || '';
    
    const text = `${title} ${description} ${requirements}`.toLowerCase();
    
    // 基础技能关键词列表
    const skillKeywords = [
      // 编程语言
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
      // 前端技术
      'react', 'vue', 'angular', 'html', 'css', 'sass', 'less', 'webpack', 'vite',
      // 后端技术
      'node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'rails',
      // 数据库
      'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      // 云服务
      'aws', 'azure', 'gcp', 'docker', 'kubernetes',
      // 工具
      'git', 'jenkins', 'jira', 'confluence'
    ];
    
    const foundSkills: string[] = [];
    
    skillKeywords.forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });
    
    // 使用翻译映射服务进行去重和标准化
    return translationMappingService.normalizeSkillTags(foundSkills);
  }

  /**
   * 提取语言要求
   */
  private extractLanguageRequirements(rssJob: RSSJob): LanguageRequirement[] {
    const requirements: LanguageRequirement[] = [];
    const text = `${rssJob.title} ${rssJob.description || ''}`.toLowerCase();
    
    // 英语要求检测
    if (this.containsAny(text, ['english', 'native english', 'fluent english', '英语'])) {
      let level = LanguageLevel.CONVERSATIONAL;
      if (text.includes('native') || text.includes('母语')) level = LanguageLevel.NATIVE;
      else if (text.includes('fluent') || text.includes('流利')) level = LanguageLevel.FLUENT;
      else if (text.includes('business') || text.includes('商务')) level = LanguageLevel.BUSINESS;
      
      requirements.push({
        language: 'English',
        level,
        required: true
      });
    }
    
    // 中文要求检测
    if (this.containsAny(text, ['chinese', 'mandarin', '中文', '普通话'])) {
      requirements.push({
        language: '中文',
        level: LanguageLevel.CONVERSATIONAL,
        required: false
      });
    }
    
    return requirements;
  }

  /**
   * 映射薪资范围
   */
  private mapSalaryRange(rssJob: RSSJob): SalaryRange | undefined {
    if (!rssJob.salary) return undefined;
    
    const salaryText = rssJob.salary.toLowerCase();
    const numbers = salaryText.match(/\d+/g);
    
    if (!numbers) return undefined;
    
    const currency = this.extractCurrencyFromSalary(salaryText);
    const period = this.extractPeriodFromSalary(salaryText);
    
    if (numbers.length >= 2) {
      return {
        min: parseInt(numbers[0]) * this.getSalaryMultiplier(salaryText),
        max: parseInt(numbers[1]) * this.getSalaryMultiplier(salaryText),
        currency,
        period,
        negotiable: salaryText.includes('negotiable') || salaryText.includes('面议')
      };
    } else if (numbers.length === 1) {
      const amount = parseInt(numbers[0]) * this.getSalaryMultiplier(salaryText);
      return {
        min: amount,
        max: amount,
        currency,
        period,
        negotiable: true
      };
    }
    
    return undefined;
  }

  /**
   * 计算数据质量
   */
  private calculateDataQuality(rssJob: RSSJob): DataQuality {
    const requiredFields = ['title', 'company', 'location', 'description', 'url'];
    const optionalFields = ['salary', 'requirements', 'benefits', 'tags'];
    
    let completeness = 0;
    const missingFields: string[] = [];
    
    // 检查必需字段
    requiredFields.forEach(field => {
      if (rssJob[field as keyof RSSJob]) {
        completeness += 0.6 / requiredFields.length;
      } else {
        missingFields.push(field);
      }
    });
    
    // 检查可选字段
    optionalFields.forEach(field => {
      if (rssJob[field as keyof RSSJob]) {
        completeness += 0.4 / optionalFields.length;
      }
    });
    
    const accuracy = this.calculateAccuracy(rssJob);
    const freshness = this.calculateFreshness(rssJob);
    
    const score = Math.round((completeness * 0.4 + accuracy * 0.4 + freshness * 0.2) * 100);
    
    return {
      score,
      completeness,
      accuracy,
      freshness,
      missingFields,
      issues: this.identifyDataIssues(rssJob)
    };
  }

  // 辅助方法
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private normalizeSkill(skill: string): string {
    return skill.trim().toLowerCase().replace(/[^\w\s]/g, '');
  }

  private extractCompanyWebsite(rssJob: RSSJob): string | undefined {
    // 从描述中提取网站链接的逻辑
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const matches = (rssJob.description || '').match(urlRegex);
    return matches?.[0];
  }

  private extractCompanyLinkedIn(rssJob: RSSJob): string | undefined {
    const linkedinRegex = /linkedin\.com\/company\/[a-zA-Z0-9-]+/g;
    const matches = (rssJob.description || '').match(linkedinRegex);
    return matches?.[0] ? `https://${matches[0]}` : undefined;
  }

  private extractTimezone(rssJob: RSSJob): string | undefined {
    const text = `${rssJob.location || ''} ${rssJob.remoteLocationRestriction || ''}`;
    const timezoneRegex = /(UTC|GMT|EST|PST|CST|MST)[+-]?\d*/gi;
    const matches = text.match(timezoneRegex);
    return matches?.[0];
  }

  private extractResponsibilities(rssJob: RSSJob): string[] {
    // 从描述中提取职责的简单实现
    const description = rssJob.description || '';
    const responsibilities: string[] = [];
    
    const lines = description.split('\n');
    lines.forEach(line => {
      if (line.includes('责任') || line.includes('职责') || line.includes('Responsibilities')) {
        responsibilities.push(line.trim());
      }
    });
    
    return responsibilities;
  }

  private extractCurrency(rssJob: RSSJob): string {
    if (!rssJob.salary) return 'USD';
    
    const salaryText = rssJob.salary.toLowerCase();
    if (salaryText.includes('¥') || salaryText.includes('cny') || salaryText.includes('人民币')) return 'CNY';
    if (salaryText.includes('€') || salaryText.includes('eur')) return 'EUR';
    if (salaryText.includes('£') || salaryText.includes('gbp')) return 'GBP';
    
    return 'USD';
  }

  private extractCurrencyFromSalary(salaryText: string): string {
    if (salaryText.includes('¥') || salaryText.includes('cny')) return 'CNY';
    if (salaryText.includes('€') || salaryText.includes('eur')) return 'EUR';
    if (salaryText.includes('£') || salaryText.includes('gbp')) return 'GBP';
    return 'USD';
  }

  private extractPeriodFromSalary(salaryText: string): SalaryPeriod {
    if (salaryText.includes('hour') || salaryText.includes('小时')) return SalaryPeriod.HOURLY;
    if (salaryText.includes('day') || salaryText.includes('日')) return SalaryPeriod.DAILY;
    if (salaryText.includes('week') || salaryText.includes('周')) return SalaryPeriod.WEEKLY;
    if (salaryText.includes('month') || salaryText.includes('月')) return SalaryPeriod.MONTHLY;
    return SalaryPeriod.YEARLY;
  }

  private getSalaryMultiplier(salaryText: string): number {
    if (salaryText.includes('k') || salaryText.includes('千')) return 1000;
    if (salaryText.includes('万')) return 10000;
    return 1;
  }

  private calculateAccuracy(rssJob: RSSJob): number {
    // 简单的准确性评估
    let score = 1.0;
    
    // 检查标题是否合理
    if (!rssJob.title || rssJob.title.length < 3) score -= 0.2;
    
    // 检查公司名称
    if (!rssJob.company || rssJob.company.length < 2) score -= 0.2;
    
    // 检查URL有效性
    if (!rssJob.url || !rssJob.url.startsWith('http')) score -= 0.1;
    
    return Math.max(0, score);
  }

  private calculateFreshness(rssJob: RSSJob): number {
    const publishDate = new Date(rssJob.publishedAt);
    const now = new Date();
    const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 1) return 1.0;
    if (daysDiff <= 7) return 0.8;
    if (daysDiff <= 30) return 0.6;
    if (daysDiff <= 90) return 0.4;
    return 0.2;
  }

  private identifyDataIssues(rssJob: RSSJob): string[] {
    const issues: string[] = [];
    
    if (!rssJob.title) issues.push('缺少岗位标题');
    if (!rssJob.company) issues.push('缺少企业名称');
    if (!rssJob.location) issues.push('缺少工作地点');
    if (!rssJob.description) issues.push('缺少岗位描述');
    if (rssJob.title && rssJob.title.length > 100) issues.push('岗位标题过长');
    
    return issues;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private initializeMappingConfig(): MappingConfig {
    return {
      fieldMappings: {
        jobTitle: ['title', 'position', 'role'],
        companyName: ['company', 'employer', 'organization'],
        location: ['location', 'address', 'city'],
        salary: ['salary', 'compensation', 'pay', 'wage']
      },
      valueMappings: {
        jobType: {
          'full-time': 'full_time',
          'part-time': 'part_time',
          'contract': 'contract',
          'freelance': 'freelance'
        }
      },
      translationMappings: {
        'remote': ['远程', 'remote work', '在家办公'],
        'full-time': ['全职', '正式员工', 'permanent'],
        'senior': ['高级', '资深', 'sr', 'staff']
      },
      defaultValues: {
        jobType: JobType.FULL_TIME,
        industryType: IndustryType.OTHER,
        jobCategory: JobCategory.OTHER
      },
      validationRules: {
        jobTitle: { required: true, type: 'string', minLength: 2, maxLength: 100 },
        companyName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        sourceUrl: { required: true, type: 'string', pattern: '^https?://' }
      }
    };
  }
}

export const jobMappingService = new JobMappingService();