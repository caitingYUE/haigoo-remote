// 统一岗位表类型定义
// 这是后台管理系统使用的标准化岗位数据结构

export interface UnifiedJob {
  // 基础标识
  id: string;
  
  // 岗位信息
  jobTitle: string; // 岗位名称
  jobCategory: JobCategory; // 岗位分类
  jobLevel: JobLevel; // 岗位级别
  jobType: JobType; // 岗位类型（全职、合同、兼职等）
  
  // 企业信息
  companyName: string; // 企业名称
  companyWebsite?: string; // 企业官网
  companyLinkedIn?: string; // 企业LinkedIn
  industryType: IndustryType; // 行业类型
  
  // 发布信息
  publishDate: string; // 发布日期 (ISO 8601 format)
  expiryDate?: string; // 过期日期
  
  // 地理和工作方式
  locationRestriction: LocationRestriction; // 区域限制
  isRemote: boolean; // 是否远程
  timezone?: string; // 时区要求
  
  // 技能和要求
  skillTags: string[]; // 技能标签
  languageRequirements: LanguageRequirement[]; // 语言要求
  
  // 薪资信息
  salaryRange?: SalaryRange; // 薪资范围
  currency?: string; // 货币类型
  
  // 岗位详情
  description?: string; // 岗位描述
  requirements?: string[]; // 岗位要求
  responsibilities?: string[]; // 工作职责
  benefits?: string[]; // 福利待遇
  
  // 数据来源
  sourceUrl: string; // 岗位来源链接
  sourcePlatform: string; // 来源平台名称
  
  // 元数据
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  dataQuality: DataQuality; // 数据质量评分
  
  // RSS原始数据关联
  originalRssId?: string; // 关联的RSS原始数据ID
}

// 岗位分类枚举
export enum JobCategory {
  PRODUCT = 'product', // 产品
  DEVELOPMENT = 'development', // 开发
  DESIGN = 'design', // 设计
  MARKETING = 'marketing', // 市场营销
  SALES = 'sales', // 销售
  OPERATIONS = 'operations', // 运营
  HR = 'hr', // 人力资源
  FINANCE = 'finance', // 财务
  LEGAL = 'legal', // 法务
  CUSTOMER_SERVICE = 'customer_service', // 客服
  DATA_SCIENCE = 'data_science', // 数据科学
  SECURITY = 'security', // 安全
  QA = 'qa', // 质量保证
  DEVOPS = 'devops', // 运维
  MANAGEMENT = 'management', // 管理
  OTHER = 'other' // 其他
}

// 岗位级别枚举
export enum JobLevel {
  INTERN = 'intern', // 实习生
  ENTRY = 'entry', // 初级
  JUNIOR = 'junior', // 初级+
  MID = 'mid', // 中级
  SENIOR = 'senior', // 高级
  LEAD = 'lead', // 技术负责人
  PRINCIPAL = 'principal', // 首席
  MANAGER = 'manager', // 经理
  SENIOR_MANAGER = 'senior_manager', // 高级经理
  DIRECTOR = 'director', // 总监
  VP = 'vp', // 副总裁
  C_LEVEL = 'c_level', // C级高管
  UNKNOWN = 'unknown' // 未知
}

// 岗位类型枚举
export enum JobType {
  FULL_TIME = 'full_time', // 全职
  PART_TIME = 'part_time', // 兼职
  CONTRACT = 'contract', // 合同工
  FREELANCE = 'freelance', // 自由职业
  INTERNSHIP = 'internship', // 实习
  TEMPORARY = 'temporary', // 临时工
  VOLUNTEER = 'volunteer', // 志愿者
  OTHER = 'other' // 其他
}

// 行业类型枚举
export enum IndustryType {
  TECHNOLOGY = 'technology', // 科技
  HEALTHCARE = 'healthcare', // 医疗健康
  FINANCE = 'finance', // 金融
  EDUCATION = 'education', // 教育
  RETAIL = 'retail', // 零售
  MANUFACTURING = 'manufacturing', // 制造业
  CONSULTING = 'consulting', // 咨询
  MEDIA = 'media', // 媒体
  REAL_ESTATE = 'real_estate', // 房地产
  AUTOMOTIVE = 'automotive', // 汽车
  ENERGY = 'energy', // 能源
  TELECOMMUNICATIONS = 'telecommunications', // 电信
  TRANSPORTATION = 'transportation', // 交通运输
  HOSPITALITY = 'hospitality', // 酒店餐饮
  AGRICULTURE = 'agriculture', // 农业
  GOVERNMENT = 'government', // 政府
  NON_PROFIT = 'non_profit', // 非营利组织
  STARTUP = 'startup', // 创业公司
  OTHER = 'other' // 其他
}

// 地理限制类型
export interface LocationRestriction {
  type: LocationType;
  regions?: string[]; // 具体地区列表
  countries?: string[]; // 国家列表
  timezones?: string[]; // 时区列表
  description?: string; // 自定义描述
}

export enum LocationType {
  NO_RESTRICTION = 'no_restriction', // 不限地点
  SPECIFIC_REGIONS = 'specific_regions', // 仅特定地区
  SPECIFIC_COUNTRIES = 'specific_countries', // 仅特定国家
  SPECIFIC_TIMEZONES = 'specific_timezones', // 仅特定时区
  HYBRID = 'hybrid', // 混合模式
  ON_SITE_ONLY = 'on_site_only' // 仅现场办公
}

// 语言要求
export interface LanguageRequirement {
  language: string; // 语言名称 (如: English, 中文, 日本語)
  level: LanguageLevel; // 语言水平
  required: boolean; // 是否必需
}

export enum LanguageLevel {
  BASIC = 'basic', // 基础
  CONVERSATIONAL = 'conversational', // 对话
  BUSINESS = 'business', // 商务
  FLUENT = 'fluent', // 流利
  NATIVE = 'native' // 母语
}

// 薪资范围
export interface SalaryRange {
  min?: number; // 最低薪资
  max?: number; // 最高薪资
  currency: string; // 货币 (USD, CNY, EUR, etc.)
  period: SalaryPeriod; // 薪资周期
  negotiable: boolean; // 是否可协商
}

export enum SalaryPeriod {
  HOURLY = 'hourly', // 小时
  DAILY = 'daily', // 日
  WEEKLY = 'weekly', // 周
  MONTHLY = 'monthly', // 月
  YEARLY = 'yearly' // 年
}

// 数据质量评分
export interface DataQuality {
  score: number; // 0-100 分数
  completeness: number; // 完整度 0-1
  accuracy: number; // 准确度 0-1
  freshness: number; // 新鲜度 0-1
  missingFields: string[]; // 缺失字段列表
  issues: string[]; // 数据问题列表
}

// RSS原始数据表结构
export interface RawRssJob {
  id: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
  url: string;
  publishedAt: string;
  source: string;
  category?: string;
  salary?: string;
  jobType?: string;
  experienceLevel?: string;
  remoteLocationRestriction?: string;
  tags?: string[];
  requirements?: string[];
  benefits?: string[];
  isRemote?: boolean;
  
  // RSS特有字段
  rssSource: string; // RSS源标识
  rawContent: string; // 原始内容
  parsedAt: string; // 解析时间
  
  // 处理状态
  processed: boolean; // 是否已处理
  processedAt?: string; // 处理时间
  unifiedJobId?: string; // 对应的统一岗位ID
  
  // 元数据
  createdAt: string;
  updatedAt: string;
}

// 数据映射配置
export interface MappingConfig {
  // 字段映射规则
  fieldMappings: Record<string, string[]>; // 目标字段 -> 源字段列表
  
  // 值映射规则
  valueMappings: Record<string, Record<string, string>>; // 字段 -> 值映射
  
  // 翻译映射
  translationMappings: Record<string, string[]>; // 标准值 -> 同义词列表
  
  // 默认值
  defaultValues: Record<string, any>;
  
  // 验证规则
  validationRules: Record<string, ValidationRule>;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
}

// 数据处理统计
export interface ProcessingStats {
  totalRssJobs: number; // RSS原始数据总数
  processedJobs: number; // 已处理数量
  successfulMappings: number; // 成功映射数量
  failedMappings: number; // 失败映射数量
  duplicatesRemoved: number; // 去重数量
  dataQualityAverage: number; // 平均数据质量分数
  
  // 按来源统计
  sourceStats: Record<string, SourceStats>;
  
  // 处理时间统计
  processingTime: {
    lastRun: string;
    averageTime: number; // 毫秒
    totalTime: number; // 毫秒
  };
}

export interface SourceStats {
  total: number;
  processed: number;
  failed: number;
  averageQuality: number;
}