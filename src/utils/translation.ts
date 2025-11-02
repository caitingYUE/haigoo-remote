// 简化的翻译工具
export interface TranslationDict {
  [key: string]: string;
}

// 基础翻译字典
const basicTranslations: TranslationDict = {
  // 职位标题
  'Senior Frontend Developer': '高级前端开发工程师',
  'Lead Software Engineer': '首席软件工程师',
  'Full Stack Developer': '全栈开发工程师',
  'Backend Developer': '后端开发工程师',
  'DevOps Engineer': '运维开发工程师',
  'Product Manager': '产品经理',
  'UI/UX Designer': 'UI/UX设计师',
  'Data Scientist': '数据科学家',
  'Machine Learning Engineer': '机器学习工程师',
  'Junior Crypto Analyst & Trader (Remote, Training Included)': '初级加密货币分析师和交易员（远程，包含培训）',
  'Junior Crypto Analyst': '初级加密货币分析师',
  'Crypto Analyst': '加密货币分析师',
  'Trader': '交易员',
  'Analyst': '分析师',
  'Training Included': '包含培训',
  
  // 公司名称
  'WhiteBridge-Ltd': 'WhiteBridge有限公司',
  'WhiteBridge': 'WhiteBridge',
  
  // 地点
  'Sevilla': '塞维利亚',
  'Spain': '西班牙',
  'Sevilla, Spain': '西班牙塞维利亚',
  
  // 工作类型
  'Full-time': '全职',
  'Part-time': '兼职',
  'Contract': '合同工',
  'Remote': '远程',
  'Hybrid': '混合办公',
  'On-site': '现场办公',
  
  // 常用词汇
  'Job description': '职位描述',
  'Company information': '公司信息',
  'Similar jobs': '相似职位',
  'Requirements': '要求',
  'Benefits': '福利',
  'Apply now': '立即申请',
  'Save job': '收藏职位',
  'Share': '分享',
  'AI Match': 'AI匹配度',
  'Based on your profile': '基于您的档案',
  'Company size': '公司规模',
  'Industry': '行业',
  'Founded': '成立时间',
  'Funding stage': '融资阶段',
  'employees': '员工',
  'Technology/Internet': '科技/互联网',
  'Series B': 'B轮',
  
  // 福利相关
  'Competitive salary and equity package': '具有竞争力的薪资和股权包',
  'Flexible working hours and remote work options': '灵活的工作时间和远程工作选择',
  'Health, dental, and vision insurance': '健康、牙科和视力保险',
  'Professional development budget': '专业发展预算',
  
  // 职位描述相关
  'Work with analytical tools and participate in discussions with a team of traders': '使用分析工具并与交易团队进行讨论',
  'The gradual formation and improvement of your own trading strategy': '逐步形成和完善您自己的交易策略',
  'What We Offer': '我们提供的福利',
  'experience': '经验',
  'years': '年',
  'with': '使用',
  'and': '和',
  'or': '或',
  'work': '工作',
  'team': '团队',
  'company': '公司',
  'project': '项目',
  'development': '开发',
  'software': '软件',
  'skills': '技能',
  'required': '必需的',
  'preferred': '优先的',
  'analytical': '分析',
  'tools': '工具',
  'participate': '参与',
  'discussions': '讨论',
  'traders': '交易员',
  'gradual': '逐步的',
  'formation': '形成',
  'improvement': '改进',
  'trading': '交易',
  'strategy': '策略',
  'offer': '提供'
};

// 简化的翻译函数 - 修复原文和翻译内容混乱问题
export const translateText = (text: string, useTranslation: boolean = true): string => {
  if (!useTranslation || !text) {
    return text;
  }

  // 清理文本，移除多余的HTML标签和特殊字符
  let cleanText = text
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&[a-zA-Z0-9#]+;/g, '') // 移除HTML实体
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();

  // 直接匹配完整翻译
  if (basicTranslations[cleanText]) {
    return basicTranslations[cleanText];
  }

  // 对于较短的文本，尝试词汇替换
  if (cleanText.length < 100) {
    let translatedText = cleanText;
    
    // 按优先级进行替换
    const priorityReplacements: Array<[string, string]> = [
      ['Junior Crypto Analyst & Trader (Remote, Training Included)', '初级加密货币分析师和交易员（远程，包含培训）'],
      ['Junior Crypto Analyst', '初级加密货币分析师'],
      ['WhiteBridge-Ltd', 'WhiteBridge有限公司'],
      ['Sevilla, Spain', '西班牙塞维利亚'],
      ['Full-time', '全职'],
      ['Remote', '远程'],
      ['experience', '经验'],
      ['years', '年'],
      ['with', '使用'],
      ['and', '和'],
      ['work', '工作'],
      ['team', '团队'],
      ['company', '公司'],
      ['development', '开发'],
      ['required', '必需的']
    ];

    priorityReplacements.forEach(([english, chinese]) => {
      const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      translatedText = translatedText.replace(regex, chinese);
    });

    return translatedText;
  }

  // 对于长文本，返回原文
  return cleanText;
};

// 格式化职位描述 - 优化为序号和点列表格式
export const formatJobDescription = (description: string): string => {
  if (!description) return '';
  
  return description
    .replace(/\n\s*\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 将项目符号转换为HTML列表
    .replace(/^[\s]*[-•*]\s+(.+)$/gm, '• $1')
    // 将数字列表转换为序号格式
    .replace(/^[\s]*(\d+)[\.\)]\s+(.+)$/gm, '$1. $2');
};

// 提取职位摘要
export const extractJobSummary = (description: string): string => {
  if (!description) return '';
  
  // 移除HTML标签
  const cleanText = description.replace(/<[^>]*>/g, '').trim();
  
  // 检查是否有明确的摘要标识
  const summaryMarkers = [
    /^(summary|overview|about|description)[:：]/im,
    /^(职位概要|职位摘要|岗位概述|关于职位)[:：]/im
  ];
  
  let hasSummaryMarker = false;
  for (const marker of summaryMarkers) {
    if (marker.test(cleanText)) {
      hasSummaryMarker = true;
      break;
    }
  }
  
  // 如果没有明确的摘要标识，且文本很短或很长，则不提取摘要
  if (!hasSummaryMarker) {
    // 如果文本太短（少于100字符）或太长（超过2000字符），可能不适合作为摘要
    if (cleanText.length < 100 || cleanText.length > 2000) {
      return '';
    }
    
    // 检查是否是纯粹的职位描述列表（包含大量项目符号或编号）
    const listItemCount = (cleanText.match(/^[\s]*[-•*]\s+/gm) || []).length + 
                         (cleanText.match(/^[\s]*\d+[\.\)]\s+/gm) || []).length;
    if (listItemCount > 5) {
      return ''; // 如果有太多列表项，可能不适合作为摘要
    }
  }
  
  // 按句子分割，取前两句
  const sentences = cleanText.split(/[.!?。！？]/).filter(s => s.trim().length > 10);
  
  // 如果句子太少，可能不是有效的摘要
  if (sentences.length < 2) {
    return '';
  }
  
  const summary = sentences.slice(0, 2).join('。') + (sentences.length > 2 ? '。' : '');
  
  // 如果摘要太短或太长，返回空
  if (summary.length < 50 || summary.length > 300) {
    return '';
  }
  
  return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
};

// 分段职位描述 - 简化分段逻辑，保持原文完整性
export const segmentJobDescription = (description: string) => {
  if (!description) return { sections: [] };
  
  // 清理描述文本，但保持基本结构
  const cleanDescription = description
    // 先将块级标签转换为换行，保留段落结构
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, '\n')
    // 将强调标签转换为Markdown以便后续渲染保留加粗/斜体
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // 移除其他HTML标签
    .replace(/<[^>]*>/g, '')
    // 处理HTML实体
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    // 保留段落间距并清理多余空白
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // 如果文本较短或没有明显的分段标志，直接返回完整内容
  if (cleanDescription.length < 500 || !cleanDescription.includes('\n')) {
    return { 
      sections: [{ 
        title: '职位详情', 
        content: cleanDescription 
      }] 
    };
  }
  
  // 只在有明确分段标志时才进行分段
  const naturalSections = [];
  const strongSectionMarkers = [
    /^(Job Description|职位描述|工作内容)[:：]/im,
    /^(Requirements|Qualifications|要求|任职要求|资格要求)[:：]/im,
    /^(Responsibilities|职责|工作职责)[:：]/im,
    /^(Benefits|What We Offer|福利|薪资福利|我们提供)[:：]/im,
    /^(About (Us|the Company)|关于我们|公司介绍)[:：]/im
  ];
  
  // 按自然段落分割，但只在有强标志时分段
  const paragraphs = cleanDescription.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  
  if (paragraphs.length <= 2) {
    // 段落太少，不分段
    return { 
      sections: [{ 
        title: '职位详情', 
        content: cleanDescription 
      }] 
    };
  }
  
  let currentSection = '';
  let currentTitle = '职位详情';
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    let foundMarker = false;
    
    // 检查是否有强分段标志
    for (const marker of strongSectionMarkers) {
      if (marker.test(trimmed)) {
        // 保存之前的段落
        if (currentSection) {
          naturalSections.push({
            title: currentTitle,
            content: currentSection.trim()
          });
        }
        
        // 开始新段落
        currentTitle = trimmed.split(/[:：]/)[0].trim();
        currentSection = trimmed;
        foundMarker = true;
        break;
      }
    }
    
    if (!foundMarker) {
      // 添加到当前段落
      currentSection += (currentSection ? '\n\n' : '') + trimmed;
    }
  }
  
  // 添加最后一个段落
  if (currentSection) {
    naturalSections.push({
      title: currentTitle,
      content: currentSection.trim()
    });
  }
  
  // 如果没有找到有效的分段，返回完整内容
  if (naturalSections.length === 0 || naturalSections.length === 1) {
    return { 
      sections: [{ 
        title: '职位详情', 
        content: cleanDescription 
      }] 
    };
  }
  
  return { sections: naturalSections };
};