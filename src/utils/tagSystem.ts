/**
 * 海狗招聘标签系统 v2.0
 * 
 * 功能特性：
 * 1. 统一标签库管理
 * 2. 标签分类规范
 * 3. 视觉规范标准化
 * 4. 标签云布局算法
 * 5. 同义标签合并
 * 6. 优先级排序
 */

// 标签类型定义
export interface JobTag {
  id: string;
  label: string;
  category: TagCategory;
  priority: TagPriority;
  color: TagColor;
  aliases: string[]; // 同义词
  description?: string;
}

export type TagCategory = 
  | 'job_type'        // 岗位类型
  | 'work_mode'       // 工作模式
  | 'experience'      // 经验要求
  | 'urgency'         // 紧急程度
  | 'skill'           // 技能要求
  | 'benefit'         // 福利待遇
  | 'company_size'    // 公司规模
  | 'industry';       // 行业类型

export type TagPriority = 'high' | 'medium' | 'low';

export interface TagColor {
  background: string;
  text: string;
  border: string;
  hover: {
    background: string;
    text: string;
    border: string;
  };
}

// 标准化标签库
export const STANDARD_TAG_LIBRARY: Record<string, JobTag> = {
  // 岗位类型标签
  'frontend-developer': {
    id: 'frontend-developer',
    label: '前端开发',
    category: 'job_type',
    priority: 'high',
    color: {
      background: 'rgba(59, 130, 246, 0.1)',
      text: '#3B82F6',
      border: 'rgba(59, 130, 246, 0.2)',
      hover: {
        background: 'rgba(59, 130, 246, 0.2)',
        text: '#2563EB',
        border: 'rgba(59, 130, 246, 0.3)'
      }
    },
    aliases: ['前端工程师', 'Frontend Engineer', 'FE', '前端', 'React开发', 'Vue开发']
  },
  
  'backend-developer': {
    id: 'backend-developer',
    label: '后端开发',
    category: 'job_type',
    priority: 'high',
    color: {
      background: 'rgba(16, 185, 129, 0.1)',
      text: '#10B981',
      border: 'rgba(16, 185, 129, 0.2)',
      hover: {
        background: 'rgba(16, 185, 129, 0.2)',
        text: '#059669',
        border: 'rgba(16, 185, 129, 0.3)'
      }
    },
    aliases: ['后端工程师', 'Backend Engineer', 'BE', '后端', 'Java开发', 'Python开发', 'Node.js开发']
  },
  
  'fullstack-developer': {
    id: 'fullstack-developer',
    label: '全栈开发',
    category: 'job_type',
    priority: 'high',
    color: {
      background: 'rgba(139, 92, 246, 0.1)',
      text: '#8B5CF6',
      border: 'rgba(139, 92, 246, 0.2)',
      hover: {
        background: 'rgba(139, 92, 246, 0.2)',
        text: '#7C3AED',
        border: 'rgba(139, 92, 246, 0.3)'
      }
    },
    aliases: ['全栈工程师', 'Fullstack Engineer', '全栈', 'Full Stack Developer']
  },
  
  'ui-ux-designer': {
    id: 'ui-ux-designer',
    label: 'UI/UX设计',
    category: 'job_type',
    priority: 'high',
    color: {
      background: 'rgba(236, 72, 153, 0.1)',
      text: '#EC4899',
      border: 'rgba(236, 72, 153, 0.2)',
      hover: {
        background: 'rgba(236, 72, 153, 0.2)',
        text: '#DB2777',
        border: 'rgba(236, 72, 153, 0.3)'
      }
    },
    aliases: ['UI设计师', 'UX设计师', '产品设计师', 'Product Designer', '交互设计师']
  },
  
  'product-manager': {
    id: 'product-manager',
    label: '产品经理',
    category: 'job_type',
    priority: 'high',
    color: {
      background: 'rgba(245, 158, 11, 0.1)',
      text: '#F59E0B',
      border: 'rgba(245, 158, 11, 0.2)',
      hover: {
        background: 'rgba(245, 158, 11, 0.2)',
        text: '#D97706',
        border: 'rgba(245, 158, 11, 0.3)'
      }
    },
    aliases: ['PM', 'Product Manager', '产品', '产品负责人', 'Product Owner']
  },
  
  'data-scientist': {
    id: 'data-scientist',
    label: '数据科学',
    category: 'job_type',
    priority: 'medium',
    color: {
      background: 'rgba(6, 182, 212, 0.1)',
      text: '#06B6D4',
      border: 'rgba(6, 182, 212, 0.2)',
      hover: {
        background: 'rgba(6, 182, 212, 0.2)',
        text: '#0891B2',
        border: 'rgba(6, 182, 212, 0.3)'
      }
    },
    aliases: ['数据科学家', 'Data Scientist', '数据分析师', 'Data Analyst', '机器学习工程师']
  },
  
  // 工作模式标签
  'remote': {
    id: 'remote',
    label: '远程工作',
    category: 'work_mode',
    priority: 'high',
    color: {
      background: 'rgba(6, 182, 212, 0.1)',
      text: '#06B6D4',
      border: 'rgba(6, 182, 212, 0.2)',
      hover: {
        background: 'rgba(6, 182, 212, 0.2)',
        text: '#0891B2',
        border: 'rgba(6, 182, 212, 0.3)'
      }
    },
    aliases: ['远程', 'Remote', 'WFH', 'Work From Home', '在家办公']
  },
  
  'hybrid': {
    id: 'hybrid',
    label: '混合办公',
    category: 'work_mode',
    priority: 'medium',
    color: {
      background: 'rgba(139, 92, 246, 0.1)',
      text: '#8B5CF6',
      border: 'rgba(139, 92, 246, 0.2)',
      hover: {
        background: 'rgba(139, 92, 246, 0.2)',
        text: '#7C3AED',
        border: 'rgba(139, 92, 246, 0.3)'
      }
    },
    aliases: ['混合', 'Hybrid', '弹性办公', 'Flexible Work']
  },
  
  'onsite': {
    id: 'onsite',
    label: '现场办公',
    category: 'work_mode',
    priority: 'low',
    color: {
      background: 'rgba(107, 114, 128, 0.1)',
      text: '#6B7280',
      border: 'rgba(107, 114, 128, 0.2)',
      hover: {
        background: 'rgba(107, 114, 128, 0.2)',
        text: '#4B5563',
        border: 'rgba(107, 114, 128, 0.3)'
      }
    },
    aliases: ['现场', 'Onsite', '办公室', 'Office']
  },
  
  // 经验要求标签
  'entry-level': {
    id: 'entry-level',
    label: '初级',
    category: 'experience',
    priority: 'medium',
    color: {
      background: 'rgba(34, 197, 94, 0.1)',
      text: '#22C55E',
      border: 'rgba(34, 197, 94, 0.2)',
      hover: {
        background: 'rgba(34, 197, 94, 0.2)',
        text: '#16A34A',
        border: 'rgba(34, 197, 94, 0.3)'
      }
    },
    aliases: ['入门级', 'Entry Level', '0-2年', '应届生', 'Junior']
  },
  
  'mid-level': {
    id: 'mid-level',
    label: '中级',
    category: 'experience',
    priority: 'medium',
    color: {
      background: 'rgba(245, 158, 11, 0.1)',
      text: '#F59E0B',
      border: 'rgba(245, 158, 11, 0.2)',
      hover: {
        background: 'rgba(245, 158, 11, 0.2)',
        text: '#D97706',
        border: 'rgba(245, 158, 11, 0.3)'
      }
    },
    aliases: ['中级', 'Mid Level', '2-5年', 'Intermediate']
  },
  
  'senior-level': {
    id: 'senior-level',
    label: '高级',
    category: 'experience',
    priority: 'high',
    color: {
      background: 'rgba(239, 68, 68, 0.1)',
      text: '#EF4444',
      border: 'rgba(239, 68, 68, 0.2)',
      hover: {
        background: 'rgba(239, 68, 68, 0.2)',
        text: '#DC2626',
        border: 'rgba(239, 68, 68, 0.3)'
      }
    },
    aliases: ['高级', 'Senior Level', '5年以上', 'Senior', 'Lead']
  },
  
  // 紧急程度标签
  'urgent': {
    id: 'urgent',
    label: '急招',
    category: 'urgency',
    priority: 'high',
    color: {
      background: 'rgba(239, 68, 68, 0.1)',
      text: '#EF4444',
      border: 'rgba(239, 68, 68, 0.2)',
      hover: {
        background: 'rgba(239, 68, 68, 0.2)',
        text: '#DC2626',
        border: 'rgba(239, 68, 68, 0.3)'
      }
    },
    aliases: ['紧急', 'Urgent', '急聘', '立即入职']
  },
  
  'flexible': {
    id: 'flexible',
    label: '时间灵活',
    category: 'urgency',
    priority: 'low',
    color: {
      background: 'rgba(16, 185, 129, 0.1)',
      text: '#10B981',
      border: 'rgba(16, 185, 129, 0.2)',
      hover: {
        background: 'rgba(16, 185, 129, 0.2)',
        text: '#059669',
        border: 'rgba(16, 185, 129, 0.3)'
      }
    },
    aliases: ['灵活', 'Flexible', '弹性时间', '自由安排']
  }
};

// 标签分类配置
export const TAG_CATEGORY_CONFIG: Record<TagCategory, {
  name: string;
  priority: number;
  maxTags: number;
  description: string;
}> = {
  job_type: {
    name: '岗位类型',
    priority: 1,
    maxTags: 2,
    description: '职位的主要类型和专业领域'
  },
  work_mode: {
    name: '工作模式',
    priority: 2,
    maxTags: 1,
    description: '工作地点和办公方式'
  },
  experience: {
    name: '经验要求',
    priority: 3,
    maxTags: 1,
    description: '所需的工作经验水平'
  },
  urgency: {
    name: '紧急程度',
    priority: 4,
    maxTags: 1,
    description: '招聘的紧急程度和时间要求'
  },
  skill: {
    name: '技能要求',
    priority: 5,
    maxTags: 3,
    description: '所需的专业技能和工具'
  },
  benefit: {
    name: '福利待遇',
    priority: 6,
    maxTags: 2,
    description: '公司提供的福利和待遇'
  },
  company_size: {
    name: '公司规模',
    priority: 7,
    maxTags: 1,
    description: '公司的规模和发展阶段'
  },
  industry: {
    name: '行业类型',
    priority: 8,
    maxTags: 1,
    description: '公司所属的行业领域'
  }
};

// 标签处理工具类
export class TagProcessor {
  /**
   * 标准化标签文本，合并同义词
   */
  static normalizeTag(tagText: string): JobTag | null {
    const normalizedText = tagText.trim().toLowerCase();
    
    // 直接匹配标准标签
    for (const tag of Object.values(STANDARD_TAG_LIBRARY)) {
      if (tag.label.toLowerCase() === normalizedText) {
        return tag;
      }
      
      // 匹配同义词
      if (tag.aliases.some(alias => alias.toLowerCase() === normalizedText)) {
        return tag;
      }
    }
    
    return null;
  }
  
  /**
   * 处理标签列表，去重和标准化
   */
  static processTags(tagTexts: string[]): JobTag[] {
    const processedTags: JobTag[] = [];
    const seenIds = new Set<string>();
    
    for (const tagText of tagTexts) {
      const normalizedTag = this.normalizeTag(tagText);
      
      if (normalizedTag && !seenIds.has(normalizedTag.id)) {
        processedTags.push(normalizedTag);
        seenIds.add(normalizedTag.id);
      }
    }
    
    return this.sortTagsByPriority(processedTags);
  }
  
  /**
   * 按优先级和类别排序标签
   */
  static sortTagsByPriority(tags: JobTag[]): JobTag[] {
    return tags.sort((a, b) => {
      // 首先按类别优先级排序
      const categoryPriorityA = TAG_CATEGORY_CONFIG[a.category].priority;
      const categoryPriorityB = TAG_CATEGORY_CONFIG[b.category].priority;
      
      if (categoryPriorityA !== categoryPriorityB) {
        return categoryPriorityA - categoryPriorityB;
      }
      
      // 然后按标签优先级排序
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * 限制每个类别的标签数量
   */
  static limitTagsByCategory(tags: JobTag[]): JobTag[] {
    const categoryCount: Record<TagCategory, number> = {} as any;
    const limitedTags: JobTag[] = [];
    
    for (const tag of tags) {
      const currentCount = categoryCount[tag.category] || 0;
      const maxCount = TAG_CATEGORY_CONFIG[tag.category].maxTags;
      
      if (currentCount < maxCount) {
        limitedTags.push(tag);
        categoryCount[tag.category] = currentCount + 1;
      }
    }
    
    return limitedTags;
  }
  
  /**
   * 生成标签云布局
   */
  static generateTagCloudLayout(tags: JobTag[], maxTags: number = 8): JobTag[] {
    // 1. 处理和标准化标签
    const processedTags = this.processTags(tags.map(tag => tag.label));
    
    // 2. 按类别限制数量
    const limitedTags = this.limitTagsByCategory(processedTags);
    
    // 3. 限制总数量
    return limitedTags.slice(0, maxTags);
  }
}

// 标签样式生成器
export class TagStyleGenerator {
  /**
   * 生成标签的CSS样式
   */
  static generateTagStyle(tag: JobTag): React.CSSProperties {
    return {
      backgroundColor: tag.color.background,
      color: tag.color.text,
      border: `1px solid ${tag.color.border}`,
      height: '28px',
      borderRadius: '4px',
      padding: '0 10px',
      fontSize: '12px',
      fontWeight: '500',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.15s ease-out',
      cursor: 'default'
    };
  }
  
  /**
   * 生成悬停状态样式
   */
  static generateHoverStyle(tag: JobTag): React.CSSProperties {
    return {
      backgroundColor: tag.color.hover.background,
      color: tag.color.hover.text,
      border: `1px solid ${tag.color.hover.border}`,
      transform: 'translateY(-1px)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    };
  }
  
  /**
   * 生成标签容器样式
   */
  static generateContainerStyle(): React.CSSProperties {
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      alignItems: 'center'
    };
  }
}

// 标签搜索和过滤
export class TagFilter {
  /**
   * 根据类别过滤标签
   */
  static filterByCategory(tags: JobTag[], category: TagCategory): JobTag[] {
    return tags.filter(tag => tag.category === category);
  }
  
  /**
   * 根据优先级过滤标签
   */
  static filterByPriority(tags: JobTag[], priority: TagPriority): JobTag[] {
    return tags.filter(tag => tag.priority === priority);
  }
  
  /**
   * 搜索标签
   */
  static searchTags(query: string): JobTag[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return Object.values(STANDARD_TAG_LIBRARY);
    }
    
    return Object.values(STANDARD_TAG_LIBRARY).filter(tag => {
      return (
        tag.label.toLowerCase().includes(normalizedQuery) ||
        tag.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery)) ||
        tag.description?.toLowerCase().includes(normalizedQuery)
      );
    });
  }
  
  /**
   * 获取推荐标签
   */
  static getRecommendedTags(existingTags: JobTag[], limit: number = 5): JobTag[] {
    const existingIds = new Set(existingTags.map(tag => tag.id));
    const allTags = Object.values(STANDARD_TAG_LIBRARY);
    
    // 过滤掉已存在的标签
    const availableTags = allTags.filter(tag => !existingIds.has(tag.id));
    
    // 按优先级排序并限制数量
    return TagProcessor.sortTagsByPriority(availableTags).slice(0, limit);
  }
}

// 导出便捷函数
export const tagUtils = {
  normalize: TagProcessor.normalizeTag,
  process: TagProcessor.processTags,
  sort: TagProcessor.sortTagsByPriority,
  limit: TagProcessor.limitTagsByCategory,
  generateLayout: TagProcessor.generateTagCloudLayout,
  generateStyle: TagStyleGenerator.generateTagStyle,
  generateHoverStyle: TagStyleGenerator.generateHoverStyle,
  generateContainerStyle: TagStyleGenerator.generateContainerStyle,
  filterByCategory: TagFilter.filterByCategory,
  filterByPriority: TagFilter.filterByPriority,
  search: TagFilter.searchTags,
  getRecommended: TagFilter.getRecommendedTags
};

export default tagUtils;