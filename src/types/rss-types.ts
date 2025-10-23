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
  salary?: string;
  jobType: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship';
  category: JobCategory;
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
}

export type JobCategory = 
  | '软件开发'
  | '前端开发'
  | '后端开发'
  | '全栈开发'
  | 'DevOps'
  | '数据科学'
  | '数据分析'
  | '产品管理'
  | '项目管理'
  | 'UI/UX设计'
  | '平面设计'
  | '市场营销'
  | '数字营销'
  | '销售'
  | '客户服务'
  | '客户支持'
  | '人力资源'
  | '财务'
  | '法律'
  | '写作'
  | '内容创作'
  | '质量保证'
  | '测试'
  | '运营'
  | '商务拓展'
  | '咨询'
  | '教育培训'
  | '其他';

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