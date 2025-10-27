export interface RSSSource {
  name: string;
  category: string;
  url: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
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
}

// 标准化的工作分类
export type JobCategory = 
  // 技术类
  | '全栈开发'
  | '前端开发'
  | '后端开发'
  | '移动开发'
  | '软件开发'
  | 'DevOps'
  | '数据分析'
  | '数据科学'
  | '人工智能'
  | '质量保证'
  | '网络安全'
  
  // 设计类
  | 'UI/UX设计'
  | '平面设计'
  | '产品设计'
  
  // 商业类
  | '产品管理'
  | '项目管理'
  | '商业分析'
  
  // 市场营销类
  | '市场营销'
  | '销售'
  | '内容写作'
  
  // 客户服务类
  | '客户支持'
  
  // 人力资源类
  | '人力资源'
  | '招聘'
  
  // 财务法律类
  | '财务'
  | '法律'
  | '会计'
  
  // 运营类
  | '运营'
  | '商务拓展'
  | '咨询'
  | '教育培训'
  
  // 其他
  | '其他'
  | '全部';

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
}

export interface JobStats {
  total: number;
  byCategory: Record<JobCategory, number>;
  bySource: Record<string, number>;
  byJobType: Record<Job['jobType'], number>;
  byExperienceLevel: Record<Job['experienceLevel'], number>;
  recentlyAdded: number; // 最近24小时新增
  activeJobs: number;
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