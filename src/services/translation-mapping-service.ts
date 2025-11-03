// 中英文字段智能映射和去重服务
import { JobCategory, JobLevel, JobType, IndustryType, LocationType } from '../types/unified-job-types';

export interface TranslationMapping {
  english: string;
  chinese: string;
  synonyms: string[]; // 同义词列表
  category: 'job_category' | 'job_level' | 'job_type' | 'industry' | 'skill' | 'location' | 'other';
}

export class TranslationMappingService {
  private mappings: Map<string, TranslationMapping> = new Map();
  
  constructor() {
    this.initializeMappings();
  }

  /**
   * 标准化和去重技能标签
   */
  public normalizeSkillTags(tags: string[]): string[] {
    const normalizedTags = new Set<string>();
    
    tags.forEach(tag => {
      const normalized = this.normalizeSkill(tag);
      if (normalized) {
        normalizedTags.add(normalized);
      }
    });
    
    return Array.from(normalizedTags);
  }

  /**
   * 标准化单个技能
   */
  public normalizeSkill(skill: string): string | null {
    if (!skill || skill.trim().length === 0) return null;
    
    const cleanSkill = skill.trim().toLowerCase();
    
    // 查找映射
    const mapping = this.findSkillMapping(cleanSkill);
    if (mapping) {
      return mapping.english; // 统一使用英文作为标准
    }
    
    // 如果没有找到映射，返回清理后的原始值
    return this.cleanSkillName(skill);
  }

  /**
   * 标准化岗位分类
   */
  public normalizeJobCategory(category: string): JobCategory {
    const cleanCategory = category.trim().toLowerCase();
    
    // 开发相关
    if (this.matchesAny(cleanCategory, [
      'developer', 'engineer', 'programming', 'coding', 'software', 'development',
      'frontend', 'backend', 'fullstack', 'full-stack', 'web development',
      '开发', '工程师', '程序员', '编程', '软件开发', '前端', '后端', '全栈'
    ])) {
      return JobCategory.DEVELOPMENT;
    }
    
    // 产品相关
    if (this.matchesAny(cleanCategory, [
      'product manager', 'product owner', 'pm', 'product', 'product management',
      '产品经理', '产品', '产品管理', '产品负责人'
    ])) {
      return JobCategory.PRODUCT;
    }
    
    // 设计相关
    if (this.matchesAny(cleanCategory, [
      'designer', 'design', 'ui', 'ux', 'ui/ux', 'graphic design', 'visual design',
      '设计师', '设计', '界面设计', '用户体验', '视觉设计', '平面设计'
    ])) {
      return JobCategory.DESIGN;
    }
    
    // 数据科学相关
    if (this.matchesAny(cleanCategory, [
      'data scientist', 'data analyst', 'data science', 'machine learning', 'ai', 'analytics',
      '数据科学家', '数据分析师', '数据科学', '机器学习', '人工智能', '数据分析'
    ])) {
      return JobCategory.DATA_SCIENCE;
    }
    
    // 运维相关
    if (this.matchesAny(cleanCategory, [
      'devops', 'sre', 'infrastructure', 'system admin', 'cloud engineer',
      '运维', '系统管理员', '云计算工程师', '基础设施'
    ])) {
      return JobCategory.DEVOPS;
    }
    
    // 市场营销相关
    if (this.matchesAny(cleanCategory, [
      'marketing', 'digital marketing', 'growth', 'seo', 'sem', 'social media',
      '市场营销', '数字营销', '增长', '营销', '推广', '社交媒体'
    ])) {
      return JobCategory.MARKETING;
    }
    
    // 销售相关
    if (this.matchesAny(cleanCategory, [
      'sales', 'account manager', 'business development', 'bd', 'sales manager',
      '销售', '客户经理', '商务拓展', '销售经理', '业务发展'
    ])) {
      return JobCategory.SALES;
    }
    
    // 质量保证相关
    if (this.matchesAny(cleanCategory, [
      'qa', 'qc', 'quality assurance', 'test', 'testing', 'tester',
      '质量保证', '测试', '测试工程师', '质量控制'
    ])) {
      return JobCategory.QA;
    }
    
    // 安全相关
    if (this.matchesAny(cleanCategory, [
      'security', 'cybersecurity', 'information security', 'security engineer',
      '安全', '网络安全', '信息安全', '安全工程师'
    ])) {
      return JobCategory.SECURITY;
    }
    
    return JobCategory.OTHER;
  }

  /**
   * 标准化岗位级别
   */
  public normalizeJobLevel(level: string): JobLevel {
    const cleanLevel = level.trim().toLowerCase();
    
    if (this.matchesAny(cleanLevel, [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'c-level',
      '首席执行官', '首席技术官', '首席财务官', '首席运营官', '首席'
    ])) {
      return JobLevel.C_LEVEL;
    }
    
    if (this.matchesAny(cleanLevel, [
      'vp', 'vice president', 'vice-president',
      '副总裁', '副总'
    ])) {
      return JobLevel.VP;
    }
    
    if (this.matchesAny(cleanLevel, [
      'director', 'head of', 'department head',
      '总监', '部门负责人', '负责人'
    ])) {
      return JobLevel.DIRECTOR;
    }
    
    if (this.matchesAny(cleanLevel, [
      'manager', 'team lead', 'team leader', 'lead', 'principal',
      '经理', '主管', '团队负责人', '负责人', '首席'
    ])) {
      return JobLevel.MANAGER;
    }
    
    if (this.matchesAny(cleanLevel, [
      'senior', 'sr', 'staff', 'expert',
      '高级', '资深', '专家'
    ])) {
      return JobLevel.SENIOR;
    }
    
    if (this.matchesAny(cleanLevel, [
      'mid', 'middle', 'intermediate', 'regular',
      '中级', '中等', '普通'
    ])) {
      return JobLevel.MID;
    }
    
    if (this.matchesAny(cleanLevel, [
      'junior', 'jr', 'entry', 'entry-level', 'graduate', 'fresh',
      '初级', '入门', '应届', '新手', '毕业生'
    ])) {
      return JobLevel.JUNIOR;
    }
    
    if (this.matchesAny(cleanLevel, [
      'intern', 'internship', 'trainee',
      '实习生', '实习', '培训生'
    ])) {
      return JobLevel.INTERN;
    }
    
    return JobLevel.UNKNOWN;
  }

  /**
   * 标准化岗位类型
   */
  public normalizeJobType(type: string): JobType {
    const cleanType = type.trim().toLowerCase();
    
    if (this.matchesAny(cleanType, [
      'full-time', 'fulltime', 'full time', 'permanent', 'regular',
      '全职', '正式', '长期', '永久'
    ])) {
      return JobType.FULL_TIME;
    }
    
    if (this.matchesAny(cleanType, [
      'part-time', 'parttime', 'part time', 'casual',
      '兼职', '非全职', '临时'
    ])) {
      return JobType.PART_TIME;
    }
    
    if (this.matchesAny(cleanType, [
      'contract', 'contractor', 'consulting', 'project-based',
      '合同', '外包', '项目制', '咨询'
    ])) {
      return JobType.CONTRACT;
    }
    
    if (this.matchesAny(cleanType, [
      'freelance', 'freelancer', 'independent', 'self-employed',
      '自由职业', '独立', '自雇'
    ])) {
      return JobType.FREELANCE;
    }
    
    if (this.matchesAny(cleanType, [
      'intern', 'internship', 'trainee', 'apprentice',
      '实习', '实习生', '培训生', '学徒'
    ])) {
      return JobType.INTERNSHIP;
    }
    
    if (this.matchesAny(cleanType, [
      'temporary', 'temp', 'short-term', 'seasonal',
      '临时', '短期', '季节性'
    ])) {
      return JobType.TEMPORARY;
    }
    
    return JobType.FULL_TIME; // 默认全职
  }

  /**
   * 标准化行业类型
   */
  public normalizeIndustryType(industry: string): IndustryType {
    const cleanIndustry = industry.trim().toLowerCase();
    
    if (this.matchesAny(cleanIndustry, [
      'technology', 'tech', 'software', 'it', 'internet', 'saas', 'fintech', 'edtech',
      '科技', '技术', '软件', '互联网', '信息技术', '金融科技', '教育科技'
    ])) {
      return IndustryType.TECHNOLOGY;
    }
    
    if (this.matchesAny(cleanIndustry, [
      'healthcare', 'health', 'medical', 'pharma', 'pharmaceutical', 'biotech', 'hospital',
      '医疗', '健康', '医药', '生物技术', '制药', '医院'
    ])) {
      return IndustryType.HEALTHCARE;
    }
    
    if (this.matchesAny(cleanIndustry, [
      'finance', 'financial', 'banking', 'investment', 'insurance', 'fintech',
      '金融', '银行', '投资', '保险', '金融服务'
    ])) {
      return IndustryType.FINANCE;
    }
    
    if (this.matchesAny(cleanIndustry, [
      'education', 'educational', 'school', 'university', 'learning', 'training', 'edtech',
      '教育', '学校', '大学', '培训', '学习', '教育科技'
    ])) {
      return IndustryType.EDUCATION;
    }
    
    if (this.matchesAny(cleanIndustry, [
      'retail', 'e-commerce', 'ecommerce', 'shopping', 'consumer', 'marketplace',
      '零售', '电商', '购物', '消费', '市场'
    ])) {
      return IndustryType.RETAIL;
    }
    
    if (this.matchesAny(cleanIndustry, [
      'manufacturing', 'production', 'factory', 'industrial', 'automotive',
      '制造', '生产', '工厂', '工业', '汽车'
    ])) {
      return IndustryType.MANUFACTURING;
    }
    
    return IndustryType.OTHER;
  }

  /**
   * 去重和合并相似的技能标签
   */
  public deduplicateSkills(skills: string[]): string[] {
    const skillGroups = new Map<string, Set<string>>();
    
    // 按标准化后的技能分组
    skills.forEach(skill => {
      const normalized = this.normalizeSkill(skill);
      if (normalized) {
        if (!skillGroups.has(normalized)) {
          skillGroups.set(normalized, new Set());
        }
        skillGroups.get(normalized)!.add(skill);
      }
    });
    
    // 返回每组的代表性技能
    return Array.from(skillGroups.keys());
  }

  /**
   * 查找技能映射
   */
  private findSkillMapping(skill: string): TranslationMapping | null {
    // 直接匹配
    if (this.mappings.has(skill)) {
      return this.mappings.get(skill)!;
    }
    
    // 同义词匹配
    for (const [key, mapping] of this.mappings) {
      if (mapping.synonyms.some(synonym => 
        synonym.toLowerCase() === skill || 
        skill.includes(synonym.toLowerCase()) ||
        synonym.toLowerCase().includes(skill)
      )) {
        return mapping;
      }
    }
    
    return null;
  }

  /**
   * 清理技能名称
   */
  private cleanSkillName(skill: string): string {
    return skill
      .trim()
      .replace(/[^\w\s\+\#\.-]/g, '') // 保留常见的技术符号
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * 检查是否匹配任何关键词
   */
  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => 
      text === keyword.toLowerCase() || 
      text.includes(keyword.toLowerCase()) ||
      keyword.toLowerCase().includes(text)
    );
  }

  /**
   * 初始化映射数据
   */
  private initializeMappings(): void {
    const mappingData: TranslationMapping[] = [
      // 编程语言
      { english: 'JavaScript', chinese: 'JavaScript', synonyms: ['js', 'javascript', 'ecmascript'], category: 'skill' },
      { english: 'TypeScript', chinese: 'TypeScript', synonyms: ['ts', 'typescript'], category: 'skill' },
      { english: 'Python', chinese: 'Python', synonyms: ['python', 'py'], category: 'skill' },
      { english: 'Java', chinese: 'Java', synonyms: ['java'], category: 'skill' },
      { english: 'C++', chinese: 'C++', synonyms: ['cpp', 'c++', 'cplusplus'], category: 'skill' },
      { english: 'C#', chinese: 'C#', synonyms: ['csharp', 'c#', 'c sharp'], category: 'skill' },
      { english: 'Go', chinese: 'Go', synonyms: ['golang', 'go'], category: 'skill' },
      { english: 'Rust', chinese: 'Rust', synonyms: ['rust'], category: 'skill' },
      { english: 'PHP', chinese: 'PHP', synonyms: ['php'], category: 'skill' },
      { english: 'Ruby', chinese: 'Ruby', synonyms: ['ruby'], category: 'skill' },
      { english: 'Swift', chinese: 'Swift', synonyms: ['swift'], category: 'skill' },
      { english: 'Kotlin', chinese: 'Kotlin', synonyms: ['kotlin'], category: 'skill' },
      
      // 前端框架
      { english: 'React', chinese: 'React', synonyms: ['react', 'reactjs', 'react.js'], category: 'skill' },
      { english: 'Vue', chinese: 'Vue', synonyms: ['vue', 'vuejs', 'vue.js'], category: 'skill' },
      { english: 'Angular', chinese: 'Angular', synonyms: ['angular', 'angularjs'], category: 'skill' },
      { english: 'Svelte', chinese: 'Svelte', synonyms: ['svelte'], category: 'skill' },
      
      // 后端框架
      { english: 'Node.js', chinese: 'Node.js', synonyms: ['nodejs', 'node', 'node.js'], category: 'skill' },
      { english: 'Express', chinese: 'Express', synonyms: ['express', 'expressjs'], category: 'skill' },
      { english: 'Django', chinese: 'Django', synonyms: ['django'], category: 'skill' },
      { english: 'Flask', chinese: 'Flask', synonyms: ['flask'], category: 'skill' },
      { english: 'Spring', chinese: 'Spring', synonyms: ['spring', 'spring boot', 'springboot'], category: 'skill' },
      
      // 数据库
      { english: 'MySQL', chinese: 'MySQL', synonyms: ['mysql'], category: 'skill' },
      { english: 'PostgreSQL', chinese: 'PostgreSQL', synonyms: ['postgresql', 'postgres'], category: 'skill' },
      { english: 'MongoDB', chinese: 'MongoDB', synonyms: ['mongodb', 'mongo'], category: 'skill' },
      { english: 'Redis', chinese: 'Redis', synonyms: ['redis'], category: 'skill' },
      
      // 云服务
      { english: 'AWS', chinese: 'AWS', synonyms: ['aws', 'amazon web services'], category: 'skill' },
      { english: 'Azure', chinese: 'Azure', synonyms: ['azure', 'microsoft azure'], category: 'skill' },
      { english: 'GCP', chinese: 'GCP', synonyms: ['gcp', 'google cloud', 'google cloud platform'], category: 'skill' },
      
      // 工具
      { english: 'Docker', chinese: 'Docker', synonyms: ['docker'], category: 'skill' },
      { english: 'Kubernetes', chinese: 'Kubernetes', synonyms: ['kubernetes', 'k8s'], category: 'skill' },
      { english: 'Git', chinese: 'Git', synonyms: ['git'], category: 'skill' },
      
      // 工作方式
      { english: 'Remote', chinese: '远程', synonyms: ['remote', '远程', 'work from home', '在家办公', 'wfh'], category: 'location' },
      { english: 'Hybrid', chinese: '混合', synonyms: ['hybrid', '混合', 'flexible', '灵活'], category: 'location' },
      { english: 'On-site', chinese: '现场', synonyms: ['onsite', 'on-site', '现场', '办公室', 'office'], category: 'location' },
      
      // 岗位级别
      { english: 'Senior', chinese: '高级', synonyms: ['senior', 'sr', '高级', '资深'], category: 'job_level' },
      { english: 'Junior', chinese: '初级', synonyms: ['junior', 'jr', '初级', '入门'], category: 'job_level' },
      { english: 'Mid-level', chinese: '中级', synonyms: ['mid', 'middle', '中级', '中等'], category: 'job_level' },
      
      // 岗位类型
      { english: 'Full-time', chinese: '全职', synonyms: ['full-time', 'fulltime', '全职', '正式'], category: 'job_type' },
      { english: 'Part-time', chinese: '兼职', synonyms: ['part-time', 'parttime', '兼职', '非全职'], category: 'job_type' },
      { english: 'Contract', chinese: '合同', synonyms: ['contract', '合同', '外包'], category: 'job_type' },
      { english: 'Freelance', chinese: '自由职业', synonyms: ['freelance', '自由职业', '独立'], category: 'job_type' }
    ];
    
    mappingData.forEach(mapping => {
      this.mappings.set(mapping.english.toLowerCase(), mapping);
      this.mappings.set(mapping.chinese, mapping);
      mapping.synonyms.forEach(synonym => {
        this.mappings.set(synonym.toLowerCase(), mapping);
      });
    });
  }
}

export const translationMappingService = new TranslationMappingService();