# Haigoo 数据格式规范文档

## 1. 数据架构概览

### 1.1 数据流向图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  RSS原始数据     │───▶│  数据解析转换    │───▶│  标准化岗位数据  │
│  (XML格式)      │    │  (TypeScript)   │    │  (JSON格式)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  外部RSS源      │    │  数据清洗验证    │    │  本地存储        │
│  - WeWork      │    │  - 去重         │    │  - localStorage │
│  - Remotive    │    │  - 分类映射      │    │  - 缓存策略      │
│  - Himalayas   │    │  - 字段标准化    │    │  - 版本控制      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 数据类型层次
```
RSSFeedItem (原始RSS数据)
    ↓ 解析转换
Job (标准岗位数据)
    ↓ 聚合处理
PageJob (页面展示数据)
    ↓ 历史记录
HistoryJob (推荐历史数据)
```

## 2. RSS原始数据格式

### 2.1 通用RSS XML结构
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSS源标题</title>
    <description>RSS源描述</description>
    <link>RSS源链接</link>
    <item>
      <title>岗位标题</title>
      <description><![CDATA[岗位描述HTML内容]]></description>
      <link>岗位链接</link>
      <pubDate>发布时间</pubDate>
      <category>岗位分类</category>
      <!-- 各RSS源特有字段 -->
    </item>
  </channel>
</rss>
```

### 2.2 各RSS源特有字段

#### WeWorkRemotely
```xml
<item>
  <title>Company: Job Title</title>
  <description>岗位描述</description>
  <link>岗位链接</link>
  <pubDate>发布时间</pubDate>
  <region>地区</region>
  <country>国家（含国旗emoji）</country>
  <state>州/省</state>
  <type>工作类型</type>
  <skills>技能要求</skills>
</item>
```

**特点**:
- 标题格式: `公司名: 岗位名称`
- 国家字段包含emoji标识
- 有详细的地理位置信息
- 工作类型字段明确

#### Remotive
```xml
<item>
  <title>岗位标题</title>
  <description>岗位描述</description>
  <link>岗位链接</link>
  <pubDate>发布时间</pubDate>
  <company>公司名称</company>
  <location>工作地点</location>
</item>
```

**特点**:
- 有独立的公司字段
- 地点信息相对简洁
- 描述内容丰富

#### Himalayas
```xml
<item>
  <title>岗位标题</title>
  <description>岗位描述</description>
  <link>岗位链接</link>
  <pubDate>发布时间</pubDate>
  <!-- 使用命名空间的自定义字段 -->
  <himalayasJobs:company>公司名称</himalayasJobs:company>
  <himalayasJobs:location>工作地点</himalayasJobs:location>
  <himalayasJobs:salary>薪资信息</himalayasJobs:salary>
  <himalayasJobs:jobType>工作类型</himalayasJobs:jobType>
</item>
```

**特点**:
- 使用XML命名空间
- 字段结构化程度高
- 薪资信息相对准确

#### NoDesk
```xml
<item>
  <title>岗位标题</title>
  <description>岗位描述</description>
  <link>岗位链接</link>
  <pubDate>发布时间</pubDate>
  <category>分类</category>
</item>
```

**特点**:
- 结构简单
- 主要依赖描述内容解析
- 分类信息基本

### 2.3 RSS数据接口定义

```typescript
export interface RSSFeedItem {
  // 必需字段
  title: string;                    // 岗位标题
  description: string;              // 岗位描述（HTML格式）
  link: string;                     // 岗位链接
  pubDate: string;                  // 发布时间（RFC 2822格式）
  
  // 可选字段
  category?: string;                // 岗位分类
  company?: string;                 // 公司名称
  location?: string;                // 工作地点
  salary?: string;                  // 薪资信息
  jobType?: string;                 // 工作类型
  workType?: 'remote' | 'hybrid' | 'onsite';  // 工作方式
  experienceLevel?: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';  // 经验等级
  
  // 薪资结构化信息
  salaryRange?: {
    min?: number;                   // 最低薪资
    max?: number;                   // 最高薪资
    currency?: string;              // 货币类型
    period?: 'hourly' | 'monthly' | 'yearly';  // 薪资周期
  };
  
  remoteLocationRestriction?: string;  // 远程工作地理限制
}

export interface ParsedRSSData {
  source: string;                   // RSS源名称
  category: string;                 // RSS源分类
  items: RSSFeedItem[];            // 岗位列表
  lastUpdated: Date;               // 最后更新时间
}
```

## 3. 标准化岗位数据格式

### 3.1 核心Job接口
```typescript
export interface Job {
  // 基础标识
  id: string;                      // 唯一标识符（基于URL和源生成）
  title: string;                   // 岗位标题
  company: string;                 // 公司名称
  location: string;                // 工作地点
  description: string;             // 岗位描述（清理后的纯文本）
  url: string;                     // 岗位链接
  
  // 时间信息
  publishedAt: string;             // 发布时间（ISO 8601格式）
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
  
  // 分类信息
  source: string;                  // 数据源
  category: JobCategory;           // 标准化分类
  
  // 工作详情
  salary?: string;                 // 薪资信息（原始格式）
  jobType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  
  // 远程工作
  isRemote: boolean;               // 是否远程工作
  remoteLocationRestriction?: string;  // 远程工作地理限制
  
  // 附加信息
  tags: string[];                  // 技能标签
  requirements: string[];          // 岗位要求
  benefits: string[];              // 福利待遇
  
  // 状态管理
  status: 'active' | 'inactive' | 'archived';  // 岗位状态
}
```

### 3.2 标准化分类系统
```typescript
export type JobCategory = 
  // 技术类
  | '全栈开发'      // Full-stack Development
  | '前端开发'      // Frontend Development  
  | '后端开发'      // Backend Development
  | '移动开发'      // Mobile Development
  | '软件开发'      // Software Development
  | 'DevOps'       // DevOps & System Administration
  | '数据分析'      // Data Analysis
  | '数据科学'      // Data Science
  | '人工智能'      // AI & Machine Learning
  | '质量保证'      // Quality Assurance
  | '网络安全'      // Cybersecurity
  
  // 设计类
  | 'UI/UX设计'    // UI/UX Design
  | '平面设计'      // Graphic Design
  | '产品设计'      // Product Design
  
  // 商业类
  | '产品管理'      // Product Management
  | '项目管理'      // Project Management
  | '商业分析'      // Business Analysis
  
  // 市场营销类
  | '市场营销'      // Marketing
  | '销售'         // Sales
  | '内容写作'      // Content Writing
  
  // 客户服务类
  | '客户支持'      // Customer Support
  
  // 人力资源类
  | '人力资源'      // Human Resources
  | '招聘'         // Recruiting
  
  // 财务法律类
  | '财务'         // Finance
  | '法律'         // Legal
  | '会计'         // Accounting
  
  // 运营类
  | '运营'         // Operations
  | '商务拓展'      // Business Development
  | '咨询'         // Consulting
  | '教育培训'      // Education & Training
  
  // 其他
  | '其他'         // Other
  | '全部';        // All
```

### 3.3 分类映射规则
```typescript
const CATEGORY_MAPPING: Record<string, JobCategory> = {
  // 编程开发类
  'programming': '软件开发',
  'full-stack': '全栈开发',
  'frontend': '前端开发',
  'backend': '后端开发',
  'mobile': '移动开发',
  'devops': 'DevOps',
  'sysadmin': 'DevOps',
  
  // 数据类
  'data': '数据分析',
  'analytics': '数据分析',
  'data-science': '数据科学',
  'machine-learning': '人工智能',
  'ai': '人工智能',
  
  // 设计类
  'design': 'UI/UX设计',
  'ui': 'UI/UX设计',
  'ux': 'UI/UX设计',
  'graphic': '平面设计',
  
  // 商业类
  'product': '产品管理',
  'project-management': '项目管理',
  'business': '商业分析',
  
  // 市场营销类
  'marketing': '市场营销',
  'sales': '销售',
  'content': '内容写作',
  'writing': '内容写作',
  
  // 支持类
  'support': '客户支持',
  'customer': '客户支持',
  'hr': '人力资源',
  'finance': '财务',
  'legal': '法律',
  'qa': '质量保证',
  'testing': '质量保证',
  
  // 默认分类
  'other': '其他',
  'all': '全部'
};
```

## 4. 数据转换和清洗规则

### 4.1 数据转换流程
```typescript
class DataTransformer {
  // 1. RSS数据解析
  parseRSSItem(item: Element, source: RSSSource): RSSFeedItem {
    // 基础字段提取
    const title = this.extractTitle(item);
    const description = this.extractDescription(item);
    const link = this.extractLink(item);
    const pubDate = this.extractPubDate(item);
    
    // 源特定字段解析
    const sourceSpecific = this.parseBySource(item, source, title, description);
    
    return {
      title,
      description,
      link,
      pubDate,
      ...sourceSpecific
    };
  }
  
  // 2. 数据清洗
  cleanData(item: RSSFeedItem): RSSFeedItem {
    return {
      ...item,
      title: this.cleanTitle(item.title),
      description: this.cleanDescription(item.description),
      company: this.cleanCompanyName(item.company),
      location: this.cleanLocation(item.location),
      salary: this.cleanSalary(item.salary)
    };
  }
  
  // 3. 标准化转换
  convertToJob(item: RSSFeedItem, source: string): Job {
    const id = this.generateJobId(item.link, source);
    const category = this.mapCategory(item.category, source);
    const jobType = this.standardizeJobType(item.jobType);
    const experienceLevel = this.extractExperienceLevel(item.title, item.description);
    
    return {
      id,
      title: item.title,
      company: item.company || this.extractCompany(item.title, item.description),
      location: item.location || this.extractLocation(item.title, item.description),
      description: this.stripHtml(item.description),
      url: item.link,
      publishedAt: this.standardizeDate(item.pubDate),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source,
      category,
      salary: item.salary,
      jobType,
      experienceLevel,
      isRemote: this.isRemoteJob(item.title, item.description),
      remoteLocationRestriction: item.remoteLocationRestriction,
      tags: this.extractTags(item.title, item.description),
      requirements: this.extractRequirements(item.description),
      benefits: this.extractBenefits(item.description),
      status: 'active'
    };
  }
}
```

### 4.2 数据清洗规则

#### 标题清洗
```typescript
cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')           // 合并多个空格
    .replace(/[^\w\s\-\(\)]/g, '')  // 移除特殊字符
    .trim()                         // 去除首尾空格
    .substring(0, 200);             // 限制长度
}
```

#### 描述清洗
```typescript
cleanDescription(description: string): string {
  return description
    .replace(/<[^>]*>/g, '')        // 移除HTML标签
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // 移除HTML实体
    .replace(/\s+/g, ' ')           // 合并多个空格
    .trim()                         // 去除首尾空格
    .substring(0, 2000);            // 限制长度
}
```

#### 公司名清洗
```typescript
cleanCompanyName(company?: string): string {
  if (!company) return '';
  
  return company
    .replace(/\b(Inc|LLC|Ltd|Corp|Co)\b\.?/gi, '') // 移除公司后缀
    .replace(/[^\w\s]/g, '')        // 移除特殊字符
    .trim()
    .substring(0, 100);
}
```

#### 地点清洗
```typescript
cleanLocation(location?: string): string {
  if (!location) return '';
  
  return location
    .replace(/🇺🇸|🇬🇧|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇪🇸|🇮🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮/g, '') // 移除国旗emoji
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}
```

### 4.3 数据验证规则
```typescript
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

const JOB_VALIDATION_RULES: Record<keyof Job, ValidationRule> = {
  id: { required: true, type: 'string', minLength: 1 },
  title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
  company: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  location: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  description: { required: true, type: 'string', minLength: 10, maxLength: 2000 },
  url: { required: true, type: 'string', pattern: /^https?:\/\/.+/ },
  publishedAt: { required: true, type: 'string', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
  source: { required: true, type: 'string', minLength: 1 },
  category: { required: true, type: 'string', enum: Object.values(JobCategory) },
  jobType: { required: true, type: 'string', enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'] },
  experienceLevel: { required: true, type: 'string', enum: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'] },
  isRemote: { required: true, type: 'boolean' },
  status: { required: true, type: 'string', enum: ['active', 'inactive', 'archived'] }
};
```

## 5. 数据存储规范

### 5.1 本地存储结构
```typescript
// localStorage键名规范
const STORAGE_KEYS = {
  JOBS: 'haigoo_jobs',                    // 岗位数据
  RSS_SOURCES: 'haigoo_rss_sources',      // RSS源配置
  USER_PREFERENCES: 'haigoo_preferences', // 用户偏好
  CACHE_METADATA: 'haigoo_cache_meta',    // 缓存元数据
  RECOMMENDATION_HISTORY: 'haigoo_rec_history' // 推荐历史
};

// 存储数据结构
interface StorageData {
  jobs: Job[];                    // 岗位列表
  metadata: {
    version: string;              // 数据版本
    lastUpdated: string;          // 最后更新时间
    totalCount: number;           // 总数量
    sources: string[];            // 数据源列表
  };
  checksum: string;               // 数据校验和
}
```

### 5.2 缓存策略
```typescript
interface CacheConfig {
  ttl: number;                    // 生存时间（毫秒）
  maxSize: number;                // 最大缓存大小
  compressionEnabled: boolean;    // 是否启用压缩
  versionControl: boolean;        // 是否启用版本控制
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  jobs: {
    ttl: 24 * 60 * 60 * 1000,     // 24小时
    maxSize: 10000,                // 最多10000条记录
    compressionEnabled: true,
    versionControl: true
  },
  rss_data: {
    ttl: 6 * 60 * 60 * 1000,      // 6小时
    maxSize: 50000,                // 最多50000条记录
    compressionEnabled: true,
    versionControl: false
  }
};
```

### 5.3 数据版本控制
```typescript
interface DataVersion {
  version: string;                // 版本号（语义化版本）
  timestamp: string;              // 版本时间戳
  changes: VersionChange[];       // 变更记录
  compatibility: string[];        // 兼容版本列表
}

interface VersionChange {
  type: 'add' | 'modify' | 'remove';  // 变更类型
  field: string;                      // 变更字段
  description: string;                // 变更描述
  migration?: string;                 // 迁移脚本
}

// 版本迁移示例
const VERSION_MIGRATIONS = {
  '1.0.0': (data: any) => data,
  '1.1.0': (data: any) => {
    // 添加新字段
    return data.map((job: any) => ({
      ...job,
      tags: job.tags || [],
      requirements: job.requirements || [],
      benefits: job.benefits || []
    }));
  },
  '1.2.0': (data: any) => {
    // 修改字段格式
    return data.map((job: any) => ({
      ...job,
      publishedAt: new Date(job.publishedAt).toISOString()
    }));
  }
};
```

## 6. 数据质量保证

### 6.1 数据完整性检查
```typescript
interface DataQualityCheck {
  name: string;
  description: string;
  check: (data: Job[]) => QualityResult;
}

interface QualityResult {
  passed: boolean;
  score: number;          // 0-100分
  issues: QualityIssue[];
  suggestions: string[];
}

interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  count: number;
  examples: string[];
}

const DATA_QUALITY_CHECKS: DataQualityCheck[] = [
  {
    name: 'completeness',
    description: '数据完整性检查',
    check: (data) => checkCompleteness(data)
  },
  {
    name: 'consistency',
    description: '数据一致性检查',
    check: (data) => checkConsistency(data)
  },
  {
    name: 'accuracy',
    description: '数据准确性检查',
    check: (data) => checkAccuracy(data)
  },
  {
    name: 'uniqueness',
    description: '数据唯一性检查',
    check: (data) => checkUniqueness(data)
  }
];
```

### 6.2 去重策略
```typescript
interface DeduplicationConfig {
  strategy: 'url' | 'content' | 'hybrid';
  threshold: number;              // 相似度阈值
  fields: string[];               // 比较字段
  priority: string[];             // 数据源优先级
}

const DEDUPLICATION_CONFIG: DeduplicationConfig = {
  strategy: 'hybrid',
  threshold: 0.85,
  fields: ['title', 'company', 'url'],
  priority: ['WeWorkRemotely', 'Remotive', 'Himalayas', 'NoDesk']
};

// 去重算法
function deduplicateJobs(jobs: Job[]): Job[] {
  const uniqueJobs: Job[] = [];
  const seenHashes = new Set<string>();
  
  for (const job of jobs) {
    const hash = generateJobHash(job);
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      uniqueJobs.push(job);
    }
  }
  
  return uniqueJobs;
}

function generateJobHash(job: Job): string {
  const content = `${job.title}|${job.company}|${job.url}`;
  return btoa(content).substring(0, 16);
}
```

## 7. 错误处理和监控

### 7.1 错误分类
```typescript
enum DataErrorType {
  PARSE_ERROR = 'parse_error',           // 解析错误
  VALIDATION_ERROR = 'validation_error', // 验证错误
  NETWORK_ERROR = 'network_error',       // 网络错误
  STORAGE_ERROR = 'storage_error',       // 存储错误
  TRANSFORMATION_ERROR = 'transform_error' // 转换错误
}

interface DataError {
  type: DataErrorType;
  source: string;
  message: string;
  timestamp: string;
  data?: any;
  stack?: string;
}
```

### 7.2 监控指标
```typescript
interface DataMetrics {
  // 数据量指标
  totalJobs: number;
  newJobsToday: number;
  activeJobs: number;
  
  // 质量指标
  completenessScore: number;
  accuracyScore: number;
  duplicateRate: number;
  
  // 性能指标
  parseTime: number;
  transformTime: number;
  storageTime: number;
  
  // 错误指标
  errorRate: number;
  errorCount: number;
  lastError?: DataError;
}
```

## 8. API接口规范

### 8.1 RSS代理接口
```typescript
// GET /api/rss-proxy
interface RSSProxyRequest {
  url: string;                    // RSS源URL
}

interface RSSProxyResponse {
  success: boolean;
  data?: string;                  // XML数据
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    contentType: string;
    contentLength: number;
    lastModified?: string;
    etag?: string;
  };
}
```

### 8.2 数据同步接口
```typescript
// POST /api/sync
interface SyncRequest {
  sources?: string[];             // 指定同步的源
  force?: boolean;                // 强制同步
}

interface SyncResponse {
  success: boolean;
  data: {
    totalProcessed: number;
    newJobs: number;
    updatedJobs: number;
    errors: DataError[];
    duration: number;
  };
}
```

## 9. 开发和维护指南

### 9.1 添加新RSS源
1. **更新RSS源列表**
   ```typescript
   // 在 rss-service.ts 中添加
   { name: 'NewSource', category: '分类', url: 'RSS_URL' }
   ```

2. **实现源特定解析器**
   ```typescript
   private parseNewSource(item: Element, title: string, description: string): any {
     // 实现特定解析逻辑
   }
   ```

3. **更新分类映射**
   ```typescript
   // 在 CATEGORY_MAPPING 中添加映射规则
   ```

4. **测试和验证**
   - 数据解析正确性
   - 分类映射准确性
   - 性能影响评估

### 9.2 数据格式升级
1. **版本号更新**
2. **迁移脚本编写**
3. **向后兼容性测试**
4. **文档更新**

### 9.3 性能优化建议
- **批量处理**: 使用批量操作减少I/O
- **缓存策略**: 合理设置缓存TTL
- **数据压缩**: 启用数据压缩减少存储空间
- **异步处理**: 使用异步操作提高响应速度

---

**文档版本**: v1.0  
**最后更新**: 2025年11月  
**维护者**: Haigoo开发团队