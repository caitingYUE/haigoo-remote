// RSS源分类映射配置
export interface CategoryMapping {
  // 原始分类名称（来自RSS源）
  original: string;
  // 标准化分类名称（平台统一分类）
  standard: string;
  // 中文分类名称
  chinese: string;
  // 英文分类名称
  english: string;
  // 分类描述
  description?: string;
}

// 工作类型映射
export interface WorkTypeMapping {
  keywords: string[];
  type: 'remote' | 'hybrid' | 'onsite';
  chinese: string;
  english: string;
}

// 标准分类定义
export const STANDARD_CATEGORIES = {
  // 技术类
  FULL_STACK: 'full-stack',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  MOBILE: 'mobile',
  DEVOPS: 'devops',
  DATA: 'data',
  AI_ML: 'ai-ml',
  QA: 'qa',
  SECURITY: 'security',
  
  // 设计类
  UI_UX: 'ui-ux',
  GRAPHIC_DESIGN: 'graphic-design',
  PRODUCT_DESIGN: 'product-design',
  
  // 商业类
  PRODUCT_MANAGEMENT: 'product-management',
  PROJECT_MANAGEMENT: 'project-management',
  BUSINESS_ANALYSIS: 'business-analysis',
  
  // 营销销售类
  MARKETING: 'marketing',
  SALES: 'sales',
  CONTENT: 'content',
  
  // 客户服务类
  CUSTOMER_SUPPORT: 'customer-support',
  
  // 人力资源类
  HR: 'hr',
  RECRUITING: 'recruiting',
  
  // 财务法律类
  FINANCE: 'finance',
  LEGAL: 'legal',
  ACCOUNTING: 'accounting',
  
  // 其他
  OTHER: 'other',
  ALL: 'all'
} as const;

// 分类映射表
export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // WeWorkRemotely 映射
  { original: '全部', standard: STANDARD_CATEGORIES.ALL, chinese: '全部', english: 'All Jobs' },
  { original: '客户支持', standard: STANDARD_CATEGORIES.CUSTOMER_SUPPORT, chinese: '客户支持', english: 'Customer Support' },
  { original: '产品职位', standard: STANDARD_CATEGORIES.PRODUCT_MANAGEMENT, chinese: '产品管理', english: 'Product Management' },
  { original: '全栈编程', standard: STANDARD_CATEGORIES.FULL_STACK, chinese: '全栈开发', english: 'Full Stack Development' },
  { original: '后端编程', standard: STANDARD_CATEGORIES.BACKEND, chinese: '后端开发', english: 'Backend Development' },
  { original: '前端编程', standard: STANDARD_CATEGORIES.FRONTEND, chinese: '前端开发', english: 'Frontend Development' },
  { original: '所有编程', standard: STANDARD_CATEGORIES.FULL_STACK, chinese: '软件开发', english: 'Software Development' },
  { original: '销售和市场营销', standard: STANDARD_CATEGORIES.MARKETING, chinese: '销售营销', english: 'Sales & Marketing' },
  { original: '管理和财务', standard: STANDARD_CATEGORIES.FINANCE, chinese: '管理财务', english: 'Management & Finance' },
  { original: '设计', standard: STANDARD_CATEGORIES.UI_UX, chinese: '设计', english: 'Design' },
  { original: 'DevOps和系统管理员', standard: STANDARD_CATEGORIES.DEVOPS, chinese: 'DevOps', english: 'DevOps & System Admin' },
  { original: '其他', standard: STANDARD_CATEGORIES.OTHER, chinese: '其他', english: 'Other' },
  
  // Remotive 映射
  { original: '软件开发', standard: STANDARD_CATEGORIES.FULL_STACK, chinese: '软件开发', english: 'Software Development' },
  { original: '客户服务', standard: STANDARD_CATEGORIES.CUSTOMER_SUPPORT, chinese: '客户服务', english: 'Customer Service' },
  { original: '营销', standard: STANDARD_CATEGORIES.MARKETING, chinese: '营销', english: 'Marketing' },
  { original: '销售/业务', standard: STANDARD_CATEGORIES.SALES, chinese: '销售', english: 'Sales' },
  { original: '产品', standard: STANDARD_CATEGORIES.PRODUCT_MANAGEMENT, chinese: '产品管理', english: 'Product Management' },
  { original: '项目管理', standard: STANDARD_CATEGORIES.PROJECT_MANAGEMENT, chinese: '项目管理', english: 'Project Management' },
  { original: '数据分析', standard: STANDARD_CATEGORIES.DATA, chinese: '数据分析', english: 'Data Analysis' },
  { original: 'DevOps/系统管理员', standard: STANDARD_CATEGORIES.DEVOPS, chinese: 'DevOps', english: 'DevOps' },
  { original: '金融/法律', standard: STANDARD_CATEGORIES.FINANCE, chinese: '金融法律', english: 'Finance & Legal' },
  { original: '人力资源', standard: STANDARD_CATEGORIES.HR, chinese: '人力资源', english: 'Human Resources' },
  { original: '质量保证', standard: STANDARD_CATEGORIES.QA, chinese: '质量保证', english: 'Quality Assurance' },
  { original: '写作', standard: STANDARD_CATEGORIES.CONTENT, chinese: '内容写作', english: 'Content Writing' },
  { original: '所有其他', standard: STANDARD_CATEGORIES.OTHER, chinese: '其他', english: 'Other' },
  
  // JobsCollider 映射
  { original: '网络安全', standard: STANDARD_CATEGORIES.SECURITY, chinese: '网络安全', english: 'Cybersecurity' },
  { original: '销售', standard: STANDARD_CATEGORIES.SALES, chinese: '销售', english: 'Sales' },
  { original: '商业', standard: STANDARD_CATEGORIES.BUSINESS_ANALYSIS, chinese: '商业分析', english: 'Business Analysis' },
  { original: '数据', standard: STANDARD_CATEGORIES.DATA, chinese: '数据分析', english: 'Data' },
  { original: 'DevOps', standard: STANDARD_CATEGORIES.DEVOPS, chinese: 'DevOps', english: 'DevOps' },
  { original: '财务与法律', standard: STANDARD_CATEGORIES.FINANCE, chinese: '财务法律', english: 'Finance & Legal' },
  { original: '所有其他', standard: STANDARD_CATEGORIES.OTHER, chinese: '其他', english: 'Other' },
  
  // 英文原始分类映射
  { original: 'Programming', standard: STANDARD_CATEGORIES.FULL_STACK, chinese: '编程开发', english: 'Programming' },
  { original: 'Customer Support', standard: STANDARD_CATEGORIES.CUSTOMER_SUPPORT, chinese: '客户支持', english: 'Customer Support' },
  { original: 'Design', standard: STANDARD_CATEGORIES.UI_UX, chinese: '设计', english: 'Design' },
  { original: 'Marketing', standard: STANDARD_CATEGORIES.MARKETING, chinese: '营销', english: 'Marketing' },
  { original: 'Sales', standard: STANDARD_CATEGORIES.SALES, chinese: '销售', english: 'Sales' },
  { original: 'Product', standard: STANDARD_CATEGORIES.PRODUCT_MANAGEMENT, chinese: '产品', english: 'Product' },
  { original: 'Data Science', standard: STANDARD_CATEGORIES.DATA, chinese: '数据科学', english: 'Data Science' },
  { original: 'Machine Learning', standard: STANDARD_CATEGORIES.AI_ML, chinese: '机器学习', english: 'Machine Learning' },
  { original: 'DevOps', standard: STANDARD_CATEGORIES.DEVOPS, chinese: 'DevOps', english: 'DevOps' },
  { original: 'QA', standard: STANDARD_CATEGORIES.QA, chinese: '质量保证', english: 'Quality Assurance' },
  { original: 'Finance', standard: STANDARD_CATEGORIES.FINANCE, chinese: '金融', english: 'Finance' },
  { original: 'Legal', standard: STANDARD_CATEGORIES.LEGAL, chinese: '法律', english: 'Legal' },
  { original: 'HR', standard: STANDARD_CATEGORIES.HR, chinese: '人力资源', english: 'Human Resources' },
  { original: 'Writing', standard: STANDARD_CATEGORIES.CONTENT, chinese: '写作', english: 'Writing' },
  { original: 'Content', standard: STANDARD_CATEGORIES.CONTENT, chinese: '内容', english: 'Content' }
];

// 工作类型映射
export const WORK_TYPE_MAPPINGS: WorkTypeMapping[] = [
  {
    keywords: ['remote', '远程', 'work from home', 'wfh', 'telecommute', 'distributed'],
    type: 'remote',
    chinese: '远程办公',
    english: 'Remote'
  },
  {
    keywords: ['hybrid', '混合', 'flexible', 'part remote', 'semi-remote'],
    type: 'hybrid',
    chinese: '混合办公',
    english: 'Hybrid'
  },
  {
    keywords: ['onsite', 'on-site', '现场', 'office', 'in-person', 'local'],
    type: 'onsite',
    chinese: '现场办公',
    english: 'On-site'
  }
];

// 地区映射
export const LOCATION_MAPPINGS = {
  // 常见国家/地区映射
  'US': { chinese: '美国', english: 'United States' },
  'USA': { chinese: '美国', english: 'United States' },
  'United States': { chinese: '美国', english: 'United States' },
  'UK': { chinese: '英国', english: 'United Kingdom' },
  'United Kingdom': { chinese: '英国', english: 'United Kingdom' },
  'Canada': { chinese: '加拿大', english: 'Canada' },
  'Australia': { chinese: '澳大利亚', english: 'Australia' },
  'Germany': { chinese: '德国', english: 'Germany' },
  'France': { chinese: '法国', english: 'France' },
  'Netherlands': { chinese: '荷兰', english: 'Netherlands' },
  'Singapore': { chinese: '新加坡', english: 'Singapore' },
  'Japan': { chinese: '日本', english: 'Japan' },
  'China': { chinese: '中国', english: 'China' },
  'India': { chinese: '印度', english: 'India' },
  'Brazil': { chinese: '巴西', english: 'Brazil' },
  'Mexico': { chinese: '墨西哥', english: 'Mexico' },
  'Spain': { chinese: '西班牙', english: 'Spain' },
  'Italy': { chinese: '意大利', english: 'Italy' },
  'Poland': { chinese: '波兰', english: 'Poland' },
  'Sweden': { chinese: '瑞典', english: 'Sweden' },
  'Norway': { chinese: '挪威', english: 'Norway' },
  'Denmark': { chinese: '丹麦', english: 'Denmark' },
  'Switzerland': { chinese: '瑞士', english: 'Switzerland' },
  'Austria': { chinese: '奥地利', english: 'Austria' },
  'Belgium': { chinese: '比利时', english: 'Belgium' },
  'Ireland': { chinese: '爱尔兰', english: 'Ireland' },
  'Portugal': { chinese: '葡萄牙', english: 'Portugal' },
  'Finland': { chinese: '芬兰', english: 'Finland' },
  'Czech Republic': { chinese: '捷克', english: 'Czech Republic' },
  'Hungary': { chinese: '匈牙利', english: 'Hungary' },
  'Romania': { chinese: '罗马尼亚', english: 'Romania' },
  'Bulgaria': { chinese: '保加利亚', english: 'Bulgaria' },
  'Croatia': { chinese: '克罗地亚', english: 'Croatia' },
  'Estonia': { chinese: '爱沙尼亚', english: 'Estonia' },
  'Latvia': { chinese: '拉脱维亚', english: 'Latvia' },
  'Lithuania': { chinese: '立陶宛', english: 'Lithuania' },
  'Slovenia': { chinese: '斯洛文尼亚', english: 'Slovenia' },
  'Slovakia': { chinese: '斯洛伐克', english: 'Slovakia' },
  'Greece': { chinese: '希腊', english: 'Greece' },
  'Turkey': { chinese: '土耳其', english: 'Turkey' },
  'Israel': { chinese: '以色列', english: 'Israel' },
  'South Africa': { chinese: '南非', english: 'South Africa' },
  'New Zealand': { chinese: '新西兰', english: 'New Zealand' },
  'South Korea': { chinese: '韩国', english: 'South Korea' },
  'Taiwan': { chinese: '台湾', english: 'Taiwan' },
  'Hong Kong': { chinese: '香港', english: 'Hong Kong' },
  'Malaysia': { chinese: '马来西亚', english: 'Malaysia' },
  'Thailand': { chinese: '泰国', english: 'Thailand' },
  'Philippines': { chinese: '菲律宾', english: 'Philippines' },
  'Indonesia': { chinese: '印度尼西亚', english: 'Indonesia' },
  'Vietnam': { chinese: '越南', english: 'Vietnam' },
  'Argentina': { chinese: '阿根廷', english: 'Argentina' },
  'Chile': { chinese: '智利', english: 'Chile' },
  'Colombia': { chinese: '哥伦比亚', english: 'Colombia' },
  'Peru': { chinese: '秘鲁', english: 'Peru' },
  'Uruguay': { chinese: '乌拉圭', english: 'Uruguay' },
  'Costa Rica': { chinese: '哥斯达黎加', english: 'Costa Rica' },
  'Panama': { chinese: '巴拿马', english: 'Panama' },
  'Ecuador': { chinese: '厄瓜多尔', english: 'Ecuador' },
  'Bolivia': { chinese: '玻利维亚', english: 'Bolivia' },
  'Paraguay': { chinese: '巴拉圭', english: 'Paraguay' },
  'Venezuela': { chinese: '委内瑞拉', english: 'Venezuela' },
  'Worldwide': { chinese: '全球', english: 'Worldwide' },
  'Global': { chinese: '全球', english: 'Global' },
  'Remote': { chinese: '远程', english: 'Remote' },
  'Anywhere': { chinese: '任何地方', english: 'Anywhere' }
};

// 分类映射服务类
export class CategoryMappingService {
  /**
   * 将原始分类映射到标准分类
   */
  static mapCategory(originalCategory: string): CategoryMapping | null {
    const mapping = CATEGORY_MAPPINGS.find(
      m => m.original.toLowerCase() === originalCategory.toLowerCase() ||
           m.english.toLowerCase() === originalCategory.toLowerCase() ||
           m.chinese.toLowerCase() === originalCategory.toLowerCase()
    );
    return mapping || null;
  }

  /**
   * 获取标准分类的中文名称
   */
  static getChineseName(standardCategory: string): string {
    const mapping = CATEGORY_MAPPINGS.find(m => m.standard === standardCategory);
    return mapping?.chinese || standardCategory;
  }

  /**
   * 获取标准分类的英文名称
   */
  static getEnglishName(standardCategory: string): string {
    const mapping = CATEGORY_MAPPINGS.find(m => m.standard === standardCategory);
    return mapping?.english || standardCategory;
  }

  /**
   * 检测工作类型
   */
  static detectWorkType(title: string, description: string): WorkTypeMapping | null {
    const text = `${title} ${description}`.toLowerCase();
    
    for (const mapping of WORK_TYPE_MAPPINGS) {
      if (mapping.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return mapping;
      }
    }
    
    // 默认为远程工作（因为大部分RSS源都是远程工作）
    return WORK_TYPE_MAPPINGS[0];
  }

  /**
   * 映射地区名称
   */
  static mapLocation(location: string): { chinese: string; english: string } {
    const cleanLocation = location.trim();
    const mapping = LOCATION_MAPPINGS[cleanLocation as keyof typeof LOCATION_MAPPINGS];
    
    if (mapping) {
      return mapping;
    }
    
    // 如果没有找到映射，返回原始值
    return {
      chinese: cleanLocation,
      english: cleanLocation
    };
  }

  /**
   * 获取所有标准分类
   */
  static getAllStandardCategories(): Array<{ id: string; chinese: string; english: string }> {
    const uniqueCategories = new Map<string, { chinese: string; english: string }>();
    
    CATEGORY_MAPPINGS.forEach(mapping => {
      if (!uniqueCategories.has(mapping.standard)) {
        uniqueCategories.set(mapping.standard, {
          chinese: mapping.chinese,
          english: mapping.english
        });
      }
    });
    
    return Array.from(uniqueCategories.entries()).map(([id, names]) => ({
      id,
      ...names
    }));
  }
}