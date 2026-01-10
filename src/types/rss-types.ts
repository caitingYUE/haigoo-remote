export interface RSSSource {
  id?: number;
  name: string;
  category: string;
  url: string;
  isActive?: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  companyWebsite?: string;
  publishedAt: string;
  source: string;
  category: JobCategory;
  salary?: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  remoteLocationRestriction?: string;
  tags: string[];
  requirements: string[];
  benefits: string[];
  isRemote: boolean;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  region?: 'domestic' | 'overseas' | 'both';
  timezone?: string;

  // New Company Sync Fields
  companyIndustry?: string;
  industry?: string;
  companyTags?: string[];
  companyLogo?: string;
  companyDescription?: string;
  companyId?: string;

  // AI-generated job summary (30-50 characters)
  summary?: string;

  // Featured status
  isFeatured?: boolean;
  
  // Approval status
  isApproved?: boolean;

  // Haigoo Member Fields
  riskRating?: {
    friendliness: number;
    replyRate: '低' | '中' | '高';
    avgResponseTime?: string;
    risks?: string[];
  };
  haigooComment?: string;
  hiddenFields?: {
    timezone?: string;
    englishLevel?: string;
    contractType?: string;
    [key: string]: any;
  };
}

// 标准化的工作分类
export type JobCategory =
  // 技术类
  | '全栈开发'
  | '前端开发'
  | '后端开发'
  | '移动开发' // 包含 iOS, Android
  | '算法工程师'
  | '数据开发'
  | '服务器开发'
  | '运维/SRE'
  | '测试/QA'
  | '网络安全'
  | '操作系统/内核'
  | '技术支持'
  | '硬件开发'
  | '架构师'
  | 'CTO/技术管理'
  | '软件开发' // 通用

  // 产品类
  | '产品经理'
  | '产品设计'
  | '用户研究'
  | '项目管理'

  // 设计类
  | 'UI/UX设计'
  | '平面设计'
  | '视觉设计'

  // 数据类
  | '数据分析'
  | '数据科学'
  | '商业分析'

  // 运营/市场/销售
  | '运营'
  | '市场营销'
  | '销售'
  | '客户经理'
  | '客户服务'
  | '内容创作'
  | '增长黑客'

  // 职能类
  | '人力资源'
  | '招聘'
  | '财务'
  | '法务'
  | '行政'
  | '管理' // CEO, VP, etc.

  // 其他
  | '教育培训'
  | '咨询'
  | '投资'
  | '其他'
  | '全部';

// 行业分类
export type CompanyIndustry =
  | '互联网/软件'
  | '人工智能'
  | '大健康/医疗'
  | '教育'
  | '金融/Fintech'
  | '电子商务'
  | 'Web3/区块链'
  | '游戏'
  | '媒体/娱乐'
  | '企业服务/SaaS'
  | '硬件/物联网'
  | '消费生活'
  | '其他'
  | string;

// 公司标签
export type CompanyTag =
  | 'AI+陪伴'
  | 'AI+健康'
  | 'AI基础设施'
  | '医药'
  | '远程优先'
  | '全球招聘'
  | '初创公司'
  | '独角兽'
  | '外企'
  | '出海'
  | string; // 允许自定义

// 工作类型
export type WorkType = 'remote' | 'hybrid' | 'onsite';

// 扩展的Job接口
export interface EnhancedJob {
  id: string;
  title: string;
  company: string;
  location: {
    chinese: string;
    english: string;
  };
  description: string;
  salary?: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  workType: {
    type: WorkType;
    chinese: string;
    english: string;
  };
  category: {
    standard: string;
    chinese: string;
    english: string;
  };
  source: string;
  sourceUrl: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'deleted';
  tags: string[];
  requirements: string[];
  benefits: string[];
  applicationUrl: string;
  isRemote: boolean;
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';

  // 新增字段
  originalCategory?: string; // 原始分类
  lastUpdated: string; // 最后更新时间
}

// 保持原有Job接口兼容性
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  companyWebsite?: string;
  publishedAt: string;
  source: string;
  category: JobCategory;
  salary?: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  remoteLocationRestriction?: string; // 远程工作的地理限制
  tags: string[];
  requirements: string[];
  benefits: string[];
  isRemote: boolean;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;

  // AI-generated job summary (30-50 characters)
  summary?: string;
  // Featured job flag for homepage display
  isFeatured?: boolean;
  // Approval status for public visibility
  isApproved?: boolean;
  // Translation status
  isTranslated?: boolean;
  translations?: {
    description?: string;
    title?: string;
    requirements?: string[];
    benefits?: string[];
    [key: string]: any;
  } | null;
}

export interface JobFilter {
  category?: JobCategory[];
  jobType?: Job['jobType'][];
  experienceLevel?: Job['experienceLevel'][];
  source?: string[];
  location?: string[];
  salaryRange?: {
    min?: number;
    max?: number;
  };
  keywords?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  isRemote?: boolean;
  status?: Job['status'][];
  remoteLocationRestriction?: string[];
  isFeatured?: boolean;
}

export interface JobStats {
  total: number;
  byCategory: Record<JobCategory, number>;
  bySource: Record<string, number>;
  byJobType: Record<Job['jobType'], number>;
  byExperienceLevel: Record<Job['experienceLevel'], number>;
  recentlyAdded: number; // 最近24小时新增
  activeJobs: number;
  lastSync: Date | null;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalJobsProcessed: number;
  newJobsAdded: number;
  updatedJobs: number;
  aiUpdatedJobs?: number;
  regexUpdatedJobs?: number;
  errors: SyncError[];
}

export interface SyncError {
  source: string;
  url: string;
  error: string;
  timestamp: Date;
}

export interface AdminDashboardData {
  jobs: Job[];
  stats: JobStats;
  syncStatus: SyncStatus;
  sources: RSSSource[];
}
