// 翻译服务
export class TranslationService {
  // 分类翻译映射
  private static categoryTranslations: Record<string, string> = {
    // 技术类
    'Software Development': '软件开发',
    'Frontend Development': '前端开发',
    'Backend Development': '后端开发',
    'Full Stack Development': '全栈开发',
    'Mobile Development': '移动开发',
    'DevOps': 'DevOps',
    'Data Analysis': '数据分析',
    'Data Science': '数据科学',
    'Artificial Intelligence': '人工智能',
    'Machine Learning': '机器学习',
    'Quality Assurance': '质量保证',
    'Testing': '测试',
    'Cybersecurity': '网络安全',
    'Security': '安全',
    
    // 设计类
    'UI/UX Design': 'UI/UX设计',
    'Design': '设计',
    'Graphic Design': '平面设计',
    'Product Design': '产品设计',
    'Web Design': '网页设计',
    
    // 商业类
    'Product Management': '产品管理',
    'Project Management': '项目管理',
    'Business Analysis': '商业分析',
    'Business Development': '商务拓展',
    'Operations': '运营',
    'Strategy': '战略',
    
    // 营销销售类
    'Marketing': '营销',
    'Digital Marketing': '数字营销',
    'Sales': '销售',
    'Content Writing': '内容写作',
    'Content Creation': '内容创作',
    'Copywriting': '文案写作',
    'Writing': '写作',
    
    // 客户服务类
    'Customer Support': '客户支持',
    'Customer Service': '客户服务',
    'Support': '支持',
    
    // 人力资源类
    'Human Resources': '人力资源',
    'HR': '人力资源',
    'Recruiting': '招聘',
    'Talent Acquisition': '人才招聘',
    
    // 财务法律类
    'Finance': '财务',
    'Accounting': '会计',
    'Legal': '法律',
    'Compliance': '合规',
    
    // 其他
    'Other': '其他',
    'All': '全部',
    'General': '通用',
    'Miscellaneous': '杂项'
  };

  // 工作类型翻译
  private static workTypeTranslations: Record<string, string> = {
    'Remote': '远程办公',
    'Hybrid': '混合办公',
    'On-site': '线下办公',
    'Onsite': '线下办公',
    'Office': '办公室',
    'Work from Home': '居家办公',
    'Flexible': '灵活办公'
  };

  // 地区翻译映射
  private static locationTranslations: Record<string, string> = {
    'United States': '美国',
    'USA': '美国',
    'US': '美国',
    'United Kingdom': '英国',
    'UK': '英国',
    'Canada': '加拿大',
    'Australia': '澳大利亚',
    'Germany': '德国',
    'France': '法国',
    'Netherlands': '荷兰',
    'Spain': '西班牙',
    'Italy': '意大利',
    'Sweden': '瑞典',
    'Norway': '挪威',
    'Denmark': '丹麦',
    'Finland': '芬兰',
    'Switzerland': '瑞士',
    'Austria': '奥地利',
    'Belgium': '比利时',
    'Portugal': '葡萄牙',
    'Ireland': '爱尔兰',
    'Poland': '波兰',
    'Czech Republic': '捷克',
    'Hungary': '匈牙利',
    'Romania': '罗马尼亚',
    'Bulgaria': '保加利亚',
    'Croatia': '克罗地亚',
    'Slovenia': '斯洛文尼亚',
    'Slovakia': '斯洛伐克',
    'Estonia': '爱沙尼亚',
    'Latvia': '拉脱维亚',
    'Lithuania': '立陶宛',
    'Japan': '日本',
    'South Korea': '韩国',
    'Singapore': '新加坡',
    'Hong Kong': '香港',
    'Taiwan': '台湾',
    'China': '中国',
    'India': '印度',
    'Brazil': '巴西',
    'Mexico': '墨西哥',
    'Argentina': '阿根廷',
    'Chile': '智利',
    'Colombia': '哥伦比亚',
    'Peru': '秘鲁',
    'Uruguay': '乌拉圭',
    'South Africa': '南非',
    'Israel': '以色列',
    'Turkey': '土耳其',
    'Russia': '俄罗斯',
    'Ukraine': '乌克兰',
    'Belarus': '白俄罗斯',
    'New Zealand': '新西兰',
    'Worldwide': '全球',
    'Global': '全球',
    'Remote': '远程',
    'Anywhere': '任何地方'
  };

  /**
   * 翻译分类名称
   */
  static translateCategory(englishCategory: string): string {
    // 直接匹配
    if (this.categoryTranslations[englishCategory]) {
      return this.categoryTranslations[englishCategory];
    }

    // 模糊匹配
    const lowerCategory = englishCategory.toLowerCase();
    for (const [key, value] of Object.entries(this.categoryTranslations)) {
      if (key.toLowerCase().includes(lowerCategory) || lowerCategory.includes(key.toLowerCase())) {
        return value;
      }
    }

    // 关键词匹配
    if (lowerCategory.includes('develop') || lowerCategory.includes('engineer') || lowerCategory.includes('programming')) {
      return '软件开发';
    }
    if (lowerCategory.includes('design')) {
      return '设计';
    }
    if (lowerCategory.includes('market')) {
      return '营销';
    }
    if (lowerCategory.includes('sales')) {
      return '销售';
    }
    if (lowerCategory.includes('support') || lowerCategory.includes('service')) {
      return '客户支持';
    }
    if (lowerCategory.includes('data')) {
      return '数据分析';
    }
    if (lowerCategory.includes('product')) {
      return '产品管理';
    }
    if (lowerCategory.includes('project')) {
      return '项目管理';
    }

    // 默认返回其他
    return '其他';
  }

  /**
   * 翻译工作类型
   */
  static translateWorkType(englishWorkType: string): string {
    if (this.workTypeTranslations[englishWorkType]) {
      return this.workTypeTranslations[englishWorkType];
    }

    const lowerType = englishWorkType.toLowerCase();
    if (lowerType.includes('remote') || lowerType.includes('home')) {
      return '远程办公';
    }
    if (lowerType.includes('hybrid') || lowerType.includes('flexible')) {
      return '混合办公';
    }
    if (lowerType.includes('office') || lowerType.includes('onsite') || lowerType.includes('on-site')) {
      return '线下办公';
    }

    return '远程办公'; // 默认远程
  }

  /**
   * 翻译地区名称
   */
  static translateLocation(englishLocation: string): string {
    if (this.locationTranslations[englishLocation]) {
      return this.locationTranslations[englishLocation];
    }

    // 模糊匹配
    const lowerLocation = englishLocation.toLowerCase();
    for (const [key, value] of Object.entries(this.locationTranslations)) {
      if (key.toLowerCase().includes(lowerLocation) || lowerLocation.includes(key.toLowerCase())) {
        return value;
      }
    }

    // 如果包含remote、anywhere等关键词
    if (lowerLocation.includes('remote') || lowerLocation.includes('anywhere') || lowerLocation.includes('worldwide')) {
      return '全球';
    }

    // 默认返回原文
    return englishLocation;
  }

  /**
   * 批量翻译
   */
  static batchTranslate(items: Array<{
    category?: string;
    workType?: string;
    location?: string;
  }>): Array<{
    category?: { english: string; chinese: string };
    workType?: { english: string; chinese: string };
    location?: { english: string; chinese: string };
  }> {
    return items.map(item => ({
      ...(item.category && {
        category: {
          english: item.category,
          chinese: this.translateCategory(item.category)
        }
      }),
      ...(item.workType && {
        workType: {
          english: item.workType,
          chinese: this.translateWorkType(item.workType)
        }
      }),
      ...(item.location && {
        location: {
          english: item.location,
          chinese: this.translateLocation(item.location)
        }
      })
    }));
  }

  /**
   * 添加新的翻译映射
   */
  static addCategoryTranslation(english: string, chinese: string): void {
    this.categoryTranslations[english] = chinese;
  }

  static addWorkTypeTranslation(english: string, chinese: string): void {
    this.workTypeTranslations[english] = chinese;
  }

  static addLocationTranslation(english: string, chinese: string): void {
    this.locationTranslations[english] = chinese;
  }

  /**
   * 获取所有翻译映射
   */
  static getAllTranslations() {
    return {
      categories: this.categoryTranslations,
      workTypes: this.workTypeTranslations,
      locations: this.locationTranslations
    };
  }
}