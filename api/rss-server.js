// Vercel Serverless Function for RSS Processing
import fetch from 'node-fetch';
import { DOMParser } from 'xmldom';

// RSS源配置
const RSS_SOURCES = [
  // WeWorkRemotely
  { name: 'WeWorkRemotely', category: '全部', url: 'https://weworkremotely.com/remote-jobs.rss' },
  { name: 'WeWorkRemotely', category: '客户支持', url: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss' },
  { name: 'WeWorkRemotely', category: '产品职位', url: 'https://weworkremotely.com/categories/remote-product-jobs.rss' },
  { name: 'WeWorkRemotely', category: '全栈编程', url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '后端编程', url: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '前端编程', url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '所有编程', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '销售和市场营销', url: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss' },
  { name: 'WeWorkRemotely', category: '管理和财务', url: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss' },
  { name: 'WeWorkRemotely', category: '设计', url: 'https://weworkremotely.com/categories/remote-design-jobs.rss' },
  { name: 'WeWorkRemotely', category: 'DevOps和系统管理员', url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss' },
  { name: 'WeWorkRemotely', category: '其他', url: 'https://weworkremotely.com/categories/all-other-remote-jobs.rss' },

  // Remotive
  { name: 'Remotive', category: '全部', url: 'https://remotive.com/remote-jobs/feed' },
  { name: 'Remotive', category: '软件开发', url: 'https://remotive.com/remote-jobs/feed/software-dev' },
  { name: 'Remotive', category: '客户服务', url: 'https://remotive.com/remote-jobs/feed/customer-support' },
  { name: 'Remotive', category: '设计', url: 'https://remotive.com/remote-jobs/feed/design' },
  { name: 'Remotive', category: '营销', url: 'https://remotive.com/remote-jobs/feed/marketing' },
  { name: 'Remotive', category: '销售/业务', url: 'https://remotive.com/remote-jobs/feed/sales-business' },
  { name: 'Remotive', category: '产品', url: 'https://remotive.com/remote-jobs/feed/product' },
  { name: 'Remotive', category: '项目管理', url: 'https://remotive.com/remote-jobs/feed/project-management' },
  { name: 'Remotive', category: '数据分析', url: 'https://remotive.com/remote-jobs/feed/data' },
  { name: 'Remotive', category: 'DevOps/系统管理员', url: 'https://remotive.com/remote-jobs/feed/devops' },
  { name: 'Remotive', category: '金融/法律', url: 'https://remotive.com/remote-jobs/feed/finance-legal' },
  { name: 'Remotive', category: '人力资源', url: 'https://remotive.com/remote-jobs/feed/hr' },
  { name: 'Remotive', category: '质量保证', url: 'https://remotive.com/remote-jobs/feed/qa' },
  { name: 'Remotive', category: '写作', url: 'https://remotive.com/remote-jobs/feed/writing' },
  { name: 'Remotive', category: '所有其他', url: 'https://remotive.com/remote-jobs/feed/all-others' },

  // JobsCollider
  { name: 'JobsCollider', category: '全部', url: 'https://jobscollider.com/remote-jobs.rss' },
  { name: 'JobsCollider', category: '软件开发', url: 'https://jobscollider.com/remote-software-development-jobs.rss' },
  { name: 'JobsCollider', category: '网络安全', url: 'https://jobscollider.com/remote-software-development-jobs.rss' },
  { name: 'JobsCollider', category: '客户服务', url: 'https://jobscollider.com/remote-customer-service-jobs.rss' },
  { name: 'JobsCollider', category: '设计', url: 'https://jobscollider.com/remote-design-jobs.rss' },
  { name: 'JobsCollider', category: '营销', url: 'https://jobscollider.com/remote-marketing-jobs.rss' },
  { name: 'JobsCollider', category: '销售', url: 'https://jobscollider.com/remote-sales-jobs.rss' },
  { name: 'JobsCollider', category: '产品', url: 'https://jobscollider.com/remote-product-jobs.rss' },
  { name: 'JobsCollider', category: '商业', url: 'https://jobscollider.com/remote-business-jobs.rss' },
  { name: 'JobsCollider', category: '数据', url: 'https://jobscollider.com/remote-data-jobs.rss' },
  { name: 'JobsCollider', category: 'DevOps', url: 'https://jobscollider.com/remote-devops-jobs.rss' },
  { name: 'JobsCollider', category: '财务与法律', url: 'https://jobscollider.com/remote-finance-legal-jobs.rss' },
  { name: 'JobsCollider', category: '人力资源', url: 'https://jobscollider.com/remote-human-resources-jobs.rss' },
  { name: 'JobsCollider', category: '质量保证', url: 'https://jobscollider.com/remote-qa-jobs.rss' },
  { name: 'JobsCollider', category: '写作', url: 'https://jobscollider.com/remote-writing-jobs.rss' },
  { name: 'JobsCollider', category: '项目管理', url: 'https://jobscollider.com/remote-project-management-jobs.rss' },
  { name: 'JobsCollider', category: '所有其他', url: 'https://jobscollider.com/remote-all-others-jobs.rss' },

  // Himalayas
  { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' },

  // NoDesk
  { name: 'NoDesk', category: '全部', url: 'https://nodesk.substack.com/feed' }
];

// 标准分类定义
const STANDARD_CATEGORIES = [
  { english: 'Software Development', chinese: '软件开发' },
  { english: 'Frontend Development', chinese: '前端开发' },
  { english: 'Backend Development', chinese: '后端开发' },
  { english: 'Full Stack Development', chinese: '全栈开发' },
  { english: 'Mobile Development', chinese: '移动开发' },
  { english: 'DevOps', chinese: 'DevOps' },
  { english: 'Data Analysis', chinese: '数据分析' },
  { english: 'Data Science', chinese: '数据科学' },
  { english: 'Artificial Intelligence', chinese: '人工智能' },
  { english: 'Machine Learning', chinese: '机器学习' },
  { english: 'Quality Assurance', chinese: '质量保证' },
  { english: 'Testing', chinese: '测试' },
  { english: 'Cybersecurity', chinese: '网络安全' },
  { english: 'Security', chinese: '安全' },
  { english: 'UI/UX Design', chinese: 'UI/UX设计' },
  { english: 'Design', chinese: '设计' },
  { english: 'Graphic Design', chinese: '平面设计' },
  { english: 'Product Design', chinese: '产品设计' },
  { english: 'Web Design', chinese: '网页设计' },
  { english: 'Product Management', chinese: '产品管理' },
  { english: 'Project Management', chinese: '项目管理' },
  { english: 'Business Analysis', chinese: '商业分析' },
  { english: 'Business Development', chinese: '商务拓展' },
  { english: 'Operations', chinese: '运营' },
  { english: 'Strategy', chinese: '战略' },
  { english: 'Marketing', chinese: '营销' },
  { english: 'Digital Marketing', chinese: '数字营销' },
  { english: 'Sales', chinese: '销售' },
  { english: 'Content Writing', chinese: '内容写作' },
  { english: 'Content Creation', chinese: '内容创作' },
  { english: 'Copywriting', chinese: '文案写作' },
  { english: 'Writing', chinese: '写作' },
  { english: 'Customer Support', chinese: '客户支持' },
  { english: 'Customer Service', chinese: '客户服务' },
  { english: 'Support', chinese: '支持' },
  { english: 'Human Resources', chinese: '人力资源' },
  { english: 'HR', chinese: '人力资源' },
  { english: 'Recruiting', chinese: '招聘' },
  { english: 'Talent Acquisition', chinese: '人才招聘' },
  { english: 'Finance', chinese: '财务' },
  { english: 'Accounting', chinese: '会计' },
  { english: 'Legal', chinese: '法律' },
  { english: 'Compliance', chinese: '合规' },
  { english: 'Other', chinese: '其他' },
  { english: 'All', chinese: '全部' },
  { english: 'General', chinese: '通用' },
  { english: 'Miscellaneous', chinese: '杂项' }
];

// 翻译服务
class TranslationService {
  static categoryTranslations = {
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
    'UI/UX Design': 'UI/UX设计',
    'Design': '设计',
    'Graphic Design': '平面设计',
    'Product Design': '产品设计',
    'Web Design': '网页设计',
    'Product Management': '产品管理',
    'Project Management': '项目管理',
    'Business Analysis': '商业分析',
    'Business Development': '商务拓展',
    'Operations': '运营',
    'Strategy': '战略',
    'Marketing': '营销',
    'Digital Marketing': '数字营销',
    'Sales': '销售',
    'Content Writing': '内容写作',
    'Content Creation': '内容创作',
    'Copywriting': '文案写作',
    'Writing': '写作',
    'Customer Support': '客户支持',
    'Customer Service': '客户服务',
    'Support': '支持',
    'Human Resources': '人力资源',
    'HR': '人力资源',
    'Recruiting': '招聘',
    'Talent Acquisition': '人才招聘',
    'Finance': '财务',
    'Accounting': '会计',
    'Legal': '法律',
    'Compliance': '合规',
    'Other': '其他',
    'All': '全部',
    'General': '通用',
    'Miscellaneous': '杂项'
  };

  static workTypeTranslations = {
    'Remote': '远程办公',
    'Hybrid': '混合办公',
    'On-site': '线下办公',
    'Onsite': '线下办公',
    'Office': '办公室',
    'Work from Home': '居家办公',
    'Flexible': '灵活办公'
  };

  static locationTranslations = {
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

  static translateCategory(englishCategory) {
    if (this.categoryTranslations[englishCategory]) {
      return this.categoryTranslations[englishCategory];
    }

    const lowerCategory = englishCategory.toLowerCase();
    for (const [key, value] of Object.entries(this.categoryTranslations)) {
      if (key.toLowerCase().includes(lowerCategory) || lowerCategory.includes(key.toLowerCase())) {
        return value;
      }
    }

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

    return '其他';
  }

  static translateWorkType(englishWorkType) {
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

    return '远程办公';
  }

  static translateLocation(englishLocation) {
    if (this.locationTranslations[englishLocation]) {
      return this.locationTranslations[englishLocation];
    }

    const lowerLocation = englishLocation.toLowerCase();
    for (const [key, value] of Object.entries(this.locationTranslations)) {
      if (key.toLowerCase().includes(lowerLocation) || lowerLocation.includes(key.toLowerCase())) {
        return value;
      }
    }

    if (lowerLocation.includes('remote') || lowerLocation.includes('anywhere') || lowerLocation.includes('worldwide')) {
      return '全球';
    }

    return englishLocation;
  }
}

// 分类映射
const CATEGORY_MAPPINGS = [
  // WeWorkRemotely 映射
  { source: 'WeWorkRemotely', originalCategories: ['全部'], standardCategory: 'All', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['客户支持'], standardCategory: 'Customer Support', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['产品职位'], standardCategory: 'Product Management', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['全栈编程'], standardCategory: 'Full Stack Development', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['后端编程'], standardCategory: 'Backend Development', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['前端编程'], standardCategory: 'Frontend Development', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['所有编程'], standardCategory: 'Software Development', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['销售和市场营销'], standardCategory: 'Marketing', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['管理和财务'], standardCategory: 'Finance', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['设计'], standardCategory: 'Design', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['DevOps和系统管理员'], standardCategory: 'DevOps', workTypes: ['remote'] },
  { source: 'WeWorkRemotely', originalCategories: ['其他'], standardCategory: 'Other', workTypes: ['remote'] },

  // Remotive 映射
  { source: 'Remotive', originalCategories: ['全部'], standardCategory: 'All', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['软件开发'], standardCategory: 'Software Development', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['客户服务'], standardCategory: 'Customer Support', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['设计'], standardCategory: 'Design', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['营销'], standardCategory: 'Marketing', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['销售/业务'], standardCategory: 'Sales', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['产品'], standardCategory: 'Product Management', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['项目管理'], standardCategory: 'Project Management', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['数据分析'], standardCategory: 'Data Analysis', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['DevOps/系统管理员'], standardCategory: 'DevOps', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['金融/法律'], standardCategory: 'Finance', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['人力资源'], standardCategory: 'Human Resources', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['质量保证'], standardCategory: 'Quality Assurance', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['写作'], standardCategory: 'Content Writing', workTypes: ['remote'] },
  { source: 'Remotive', originalCategories: ['所有其他'], standardCategory: 'Other', workTypes: ['remote'] },

  // JobsCollider 映射
  { source: 'JobsCollider', originalCategories: ['全部'], standardCategory: 'All', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['软件开发'], standardCategory: 'Software Development', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['网络安全'], standardCategory: 'Cybersecurity', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['客户服务'], standardCategory: 'Customer Support', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['设计'], standardCategory: 'Design', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['营销'], standardCategory: 'Marketing', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['销售'], standardCategory: 'Sales', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['产品'], standardCategory: 'Product Management', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['商业'], standardCategory: 'Business Analysis', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['数据'], standardCategory: 'Data Analysis', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['DevOps'], standardCategory: 'DevOps', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['财务与法律'], standardCategory: 'Finance', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['人力资源'], standardCategory: 'Human Resources', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['质量保证'], standardCategory: 'Quality Assurance', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['写作'], standardCategory: 'Content Writing', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['项目管理'], standardCategory: 'Project Management', workTypes: ['remote'] },
  { source: 'JobsCollider', originalCategories: ['所有其他'], standardCategory: 'Other', workTypes: ['remote'] },

  // Himalayas 映射
  { source: 'Himalayas', originalCategories: ['全部'], standardCategory: 'All', workTypes: ['remote', 'hybrid', 'onsite'] },

  // NoDesk 映射
  { source: 'NoDesk', originalCategories: ['全部'], standardCategory: 'All', workTypes: ['remote'] }
];

// 分类映射服务
class CategoryMappingService {
  static getStandardCategory(originalCategory, source) {
    const mapping = CATEGORY_MAPPINGS.find(m => 
      m.source === source && 
      m.originalCategories.some(cat => 
        cat.toLowerCase().includes(originalCategory.toLowerCase()) ||
        originalCategory.toLowerCase().includes(cat.toLowerCase())
      )
    );
    
    return mapping ? mapping.standardCategory : 'Other';
  }

  static getChineseName(standardCategory) {
    const category = STANDARD_CATEGORIES.find(c => c.english === standardCategory);
    return category ? category.chinese : TranslationService.translateCategory(standardCategory);
  }

  static getEnglishName(chineseName) {
    const category = STANDARD_CATEGORIES.find(c => c.chinese === chineseName);
    return category ? category.english : chineseName;
  }

  static detectWorkType(title, description, location) {
    const text = `${title} ${description} ${location}`.toLowerCase();
    
    if (text.includes('remote') || text.includes('work from home') || text.includes('anywhere')) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
      return 'hybrid';
    }
    if (text.includes('on-site') || text.includes('office') || text.includes('onsite')) {
      return 'onsite';
    }
    
    return 'remote'; // 默认远程
  }

  static mapLocation(originalLocation) {
    return TranslationService.translateLocation(originalLocation);
  }

  static getAllStandardCategories() {
    return STANDARD_CATEGORIES;
  }
}

// RSS抓取函数
async function fetchRSSFeed(url, retries = 2) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; RSS-Reader/1.0; +http://example.com/bot)'
  ];

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal,
        redirect: 'follow',
        compress: true
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 特殊处理某些错误状态码
        if (response.status === 403 || response.status === 429 || response.status === 1015) {
          console.warn(`Rate limited or blocked for ${url}, status: ${response.status}`);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // 更长的等待时间
            continue;
          }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
        console.warn(`Unexpected content type for ${url}: ${contentType}`);
      }

      const text = await response.text();
      
      // 基本的XML格式验证
      if (!text.trim().startsWith('<?xml') && !text.includes('<rss') && !text.includes('<feed')) {
        throw new Error('Response does not appear to be valid XML/RSS');
      }

      return text;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${url}:`, error.message);
      if (i === retries - 1) {
        // 最后一次尝试失败，记录详细错误
        console.error(`Final attempt failed for ${url}:`, {
          error: error.message,
          name: error.name,
          stack: error.stack?.split('\n')[0]
        });
        throw error;
      }
      // 指数退避策略
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}

// XML解析函数
function parseRSSFeed(xmlText, source, category) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = doc.getElementsByTagName('item');
    const jobs = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      const title = getTextContent(item, 'title');
      const link = getTextContent(item, 'link');
      const description = getTextContent(item, 'description');
      const pubDate = getTextContent(item, 'pubDate');
      const guid = getTextContent(item, 'guid') || link;

      if (!title || !link) continue;

      // 提取公司名称
      const company = extractCompany(title, description, source);
      
      // 提取地区信息
      const location = extractLocation(title, description);
      
      // 标准化分类
      const standardCategory = CategoryMappingService.getStandardCategory(category, source);
      
      // 检测工作类型
      const workType = CategoryMappingService.detectWorkType(title, description, location);
      
      // 创建增强的工作对象
      const job = {
        id: generateJobId(guid, source),
        title: cleanText(title),
        company: company,
        location: {
          english: location,
          chinese: TranslationService.translateLocation(location)
        },
        description: cleanText(description),
        category: {
          standard: standardCategory,
          english: standardCategory,
          chinese: CategoryMappingService.getChineseName(standardCategory)
        },
        workType: {
          type: workType,
          english: workType.charAt(0).toUpperCase() + workType.slice(1),
          chinese: TranslationService.translateWorkType(workType)
        },
        source: source,
        sourceUrl: link,
        publishedAt: parseDate(pubDate),
        lastUpdated: new Date().toISOString(),
        originalCategory: category,
        isRemote: workType === 'remote',
        status: 'active'
      };

      jobs.push(job);
    }

    return jobs;
  } catch (error) {
    console.error(`Error parsing RSS feed from ${source}:`, error);
    return [];
  }
}

// 辅助函数
function getTextContent(element, tagName) {
  const nodes = element.getElementsByTagName(tagName);
  return nodes.length > 0 ? nodes[0].textContent || nodes[0].nodeValue || '' : '';
}

function extractCompany(title, description, source) {
  // 根据不同源的格式提取公司名称
  if (source === 'WeWorkRemotely') {
    const match = title.match(/^(.+?):/);
    return match ? match[1].trim() : 'Unknown Company';
  }
  
  if (source === 'Remotive') {
    const match = title.match(/at (.+?)$/);
    return match ? match[1].trim() : 'Unknown Company';
  }
  
  // 通用提取逻辑
  const companyPatterns = [
    /Company:\s*(.+)/i,
    /at\s+(.+?)(?:\s|$)/i,
    /(.+?)\s*-\s*.+/,
    /^(.+?):/
  ];
  
  for (const pattern of companyPatterns) {
    const match = (title + ' ' + description).match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return 'Unknown Company';
}

function extractLocation(title, description) {
  const locationPatterns = [
    /Location:\s*(.+)/i,
    /\((.+?)\)$/,
    /Remote|Anywhere|Worldwide/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2,3})?/
  ];
  
  const text = title + ' ' + description;
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0].trim();
    }
  }
  
  return 'Remote';
}

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&[^;]+;/g, ' ') // 移除HTML实体
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();
}

function parseDate(dateString) {
  if (!dateString) return new Date();
  
  try {
    return new Date(dateString);
  } catch (error) {
    return new Date();
  }
}

function generateJobId(guid, source) {
  const hash = require('crypto').createHash('md5').update(guid + source).digest('hex');
  return hash.substring(0, 16);
}

// 主处理函数
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { source, category, limit = 50 } = req.query;
    
    // 过滤RSS源
    let sources = RSS_SOURCES;
    if (source) {
      sources = sources.filter(s => s.name.toLowerCase() === source.toLowerCase());
    }
    if (category && category !== '全部') {
      sources = sources.filter(s => s.category === category);
    }

    console.log(`Processing ${sources.length} RSS sources...`);

    // 批量处理RSS源，限制并发数量
    const batchSize = 5; // 限制并发数量
    const results = [];
    
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      const batchPromises = batch.map(async (rssSource) => {
        try {
          console.log(`Fetching ${rssSource.name} - ${rssSource.category}...`);
          const xmlText = await fetchRSSFeed(rssSource.url);
          const jobs = parseRSSFeed(xmlText, rssSource.name, rssSource.category);
          console.log(`Successfully processed ${jobs.length} jobs from ${rssSource.name}`);
          return jobs;
        } catch (error) {
          console.error(`Failed to process ${rssSource.name} - ${rssSource.category}:`, error.message);
          return []; // 返回空数组而不是失败
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 批次间短暂延迟，避免过于频繁的请求
      if (i + batchSize < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    let allJobs = results.flat();

    // 去重
    const uniqueJobs = [];
    const seenIds = new Set();
    
    for (const job of allJobs) {
      if (!seenIds.has(job.id)) {
        seenIds.add(job.id);
        uniqueJobs.push(job);
      }
    }

    // 排序（最新的在前）
    uniqueJobs.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // 限制数量
    const limitedJobs = uniqueJobs.slice(0, parseInt(limit));

    // 统计信息
    const stats = {
      total: limitedJobs.length,
      sources: [...new Set(limitedJobs.map(job => job.source))],
      categories: [...new Set(limitedJobs.map(job => job.category.chinese))],
      workTypes: [...new Set(limitedJobs.map(job => job.workType.chinese))],
      lastUpdated: new Date().toISOString(),
      processedSources: sources.length,
      successfulSources: results.filter(r => r.length > 0).length
    };

    console.log(`Processing completed: ${stats.total} jobs from ${stats.successfulSources}/${stats.processedSources} sources`);

    res.status(200).json({
      success: true,
      data: limitedJobs,
      stats: stats,
      message: `Successfully processed ${limitedJobs.length} jobs from ${stats.successfulSources} out of ${stats.processedSources} sources`
    });

  } catch (error) {
    console.error('RSS processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to process RSS feeds'
    });
  }
}