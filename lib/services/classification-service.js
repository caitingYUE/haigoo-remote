/**
 * Classification Service (Server-side JS version)
 * Provides keyword-based classification for Jobs and Companies
 */

// Job Category Keywords
const JOB_KEYWORDS = {
    // 技术 - 开发
    'frontend': '前端开发',
    'front-end': '前端开发',
    'react': '前端开发',
    'vue': '前端开发',
    'angular': '前端开发',
    'javascript': '前端开发',
    'typescript': '前端开发',
    'web developer': '前端开发',

    'backend': '后端开发',
    'back-end': '后端开发',
    'java': '后端开发',
    'python': '后端开发',
    'golang': '后端开发',
    'go lang': '后端开发',
    'node.js': '后端开发',
    'ruby': '后端开发',
    'php': '后端开发',
    'rust': '后端开发',
    'c++': '后端开发',
    'c#': '后端开发',
    '.net': '后端开发',

    'fullstack': '全栈开发',
    'full-stack': '全栈开发',
    'full stack': '全栈开发',

    'ios': '移动开发',
    'android': '移动开发',
    'mobile': '移动开发',
    'flutter': '移动开发',
    'react native': '移动开发',
    'swift': '移动开发',
    'kotlin': '移动开发',

    'algorithm': '算法工程师',
    'machine learning': '算法工程师',
    'deep learning': '算法工程师',
    'ai engineer': '算法工程师',
    'nlp': '算法工程师',
    'cv': '算法工程师',
    'computer vision': '算法工程师',

    'data engineer': '数据开发',
    'etl': '数据开发',
    'spark': '数据开发',
    'hadoop': '数据开发',

    'server': '服务器开发',
    'distributed system': '服务器开发',

    'devops': '运维/SRE',
    'sre': '运维/SRE',
    'site reliability': '运维/SRE',
    'sysadmin': '运维/SRE',
    'infrastructure': '运维/SRE',
    'kubernetes': '运维/SRE',
    'docker': '运维/SRE',
    'aws': '运维/SRE',
    'cloud': '运维/SRE',

    'qa': '测试/QA',
    'quality assurance': '测试/QA',
    'test': '测试/QA',
    'testing': '测试/QA',
    'automation': '测试/QA',

    'security': '网络安全',
    'cyber': '网络安全',
    'infosec': '网络安全',
    'penetration': '网络安全',

    'kernel': '操作系统/内核',
    'os': '操作系统/内核',
    'linux kernel': '操作系统/内核',
    'driver': '操作系统/内核',

    'support engineer': '技术支持',
    'technical support': '技术支持',
    'customer success engineer': '技术支持',

    'hardware': '硬件开发',
    'embedded': '硬件开发',
    'firmware': '硬件开发',
    'fpga': '硬件开发',

    'architect': '架构师',
    'architecture': '架构师',

    'cto': 'CTO/技术管理',
    'vp of engineering': 'CTO/技术管理',
    'engineering manager': 'CTO/技术管理',
    'tech lead': 'CTO/技术管理',
    'team lead': 'CTO/技术管理',

    // 产品
    'product manager': '产品经理',
    'pm': '产品经理',
    'product owner': '产品经理',

    'product designer': '产品设计',

    'user researcher': '用户研究',
    'ux researcher': '用户研究',

    // 设计
    'ui': 'UI/UX设计',
    'ux': 'UI/UX设计',
    'interaction design': 'UI/UX设计',
    'visual designer': '视觉设计',
    'graphic designer': '平面设计',

    // 数据
    'data analyst': '数据分析',
    'business analyst': '商业分析',
    'data scientist': '数据科学',

    // 运营/市场/销售
    'marketing': '市场营销',
    'marketer': '市场营销',
    'seo': '市场营销',
    'content': '内容创作',
    'writer': '内容创作',
    'copywriter': '内容创作',
    'editor': '内容创作',

    'sales': '销售',
    'account executive': '销售',
    'sdr': '销售',
    'bdr': '销售',

    'account manager': '客户经理',
    'customer success manager': '客户经理',
    'csm': '客户经理',

    'customer support': '客户服务',
    'customer service': '客户服务',

    'growth': '增长黑客',
    'growth hacker': '增长黑客',

    'operations': '运营',
    'ops': '运营', // Be careful with DevOps

    // 职能
    'hr': '人力资源',
    'human resources': '人力资源',
    'people ops': '人力资源',
    'recruiter': '招聘',
    'talent acquisition': '招聘',

    'finance': '财务',
    'accountant': '财务',
    'financial': '财务',

    'legal': '法务',
    'lawyer': '法务',
    'counsel': '法务',

    'admin': '行政',
    'executive assistant': '行政',
    'office manager': '行政',

    'ceo': '管理',
    'co-founder': '管理',
    'vp': '管理',
    'director': '管理',
    'head of': '管理',

    // 其他
    'education': '教育培训',
    'teacher': '教育培训',
    'tutor': '教育培训',
    'curriculum': '教育培训',

    'consultant': '咨询',

    'investor': '投资',
    'investment': '投资',
    'venture capital': '投资'
};

// Generate Reverse Map (Category -> English Keywords)
export const CATEGORY_REVERSE_MAP = {};
for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
    if (!CATEGORY_REVERSE_MAP[category]) {
        CATEGORY_REVERSE_MAP[category] = [];
    }
    CATEGORY_REVERSE_MAP[category].push(keyword);
}

export function classifyJob(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    const titleLower = title.toLowerCase();

    // Helper to escape regex special characters
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Check keywords
    for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
        if (keyword.length <= 3 && /^[a-zA-Z0-9]+$/.test(keyword)) {
            const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
            if (regex.test(titleLower)) return category;
        } else {
            if (titleLower.includes(keyword)) return category;
        }
    }

    return '其他';
}

export function determineExperienceLevel(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    const titleLower = title.toLowerCase();

    if (/\b(c[t|e|o|f]o|vp|vice president|director|head of)\b/.test(titleLower)) {
        return 'Executive';
    }

    if (/\b(lead|principal|staff|architect|manager)\b/.test(titleLower)) {
        return 'Lead';
    }

    if (/\b(senior|sr\.?|iii|iv)\b/.test(titleLower)) {
        return 'Senior';
    }

    if (/\b(junior|jr\.?|entry|intern|internship|graduate)\b/.test(titleLower)) {
        return 'Entry';
    }

    if (/\b(executive|director|vp)\b/.test(text)) return 'Executive';
    if (/\b(principal|staff|architect)\b/.test(text)) return 'Lead';

    return 'Mid';
}

export function classifyCompany(companyName, description = '') {
    const text = (companyName + ' ' + description).toLowerCase();

    // Industry Classification
    let industry = '其他';

    if (/\b(ai|artificial intelligence|machine learning|llm|gpt|neural|deep learning)\b/.test(text)) {
        industry = '人工智能';
    } else if (/\b(crypto|blockchain|web3|defi|nft|bitcoin|ethereum|wallet|exchange|token)\b/.test(text)) {
        industry = 'Web3/区块链';
    } else if (/\b(saas|software|platform|cloud|devops|api|enterprise|b2b)\b/.test(text)) {
        industry = '企业服务/SaaS';
    } else if (/\b(fintech|finance|banking|trading|payment|invest|wealth|insurance|credit)\b/.test(text)) {
        industry = '金融/Fintech';
    } else if (/\b(ecommerce|e-commerce|retail|shop|marketplace|consumer|dtc|brand)\b/.test(text)) {
        industry = '电子商务';
    } else if (/\b(game|gaming|esports|play|entertainment|media|video|music|streaming)\b/.test(text)) {
        industry = '游戏/娱乐';
    } else if (/\b(health|medical|biotech|pharma|care|patient|doctor|hospital)\b/.test(text)) {
        industry = '大健康/医疗';
    } else if (/\b(education|edtech|learning|school|university|course|training|tutor)\b/.test(text)) {
        industry = '教育';
    } else if (/\b(hardware|iot|device|robotics|chip|semiconductor|manufacturing)\b/.test(text)) {
        industry = '硬件/物联网';
    } else if (/\b(social|community|network|dating|chat|messaging)\b/.test(text)) {
        industry = '互联网/软件';
    }

    // Tag Generation
    const tags = [];

    // AI Tags
    if (/\b(companion|chatbot|character|friend)\b/.test(text) && industry === '人工智能') tags.push('AI+陪伴');
    if (/\b(health|medical|doctor)\b/.test(text) && industry === '人工智能') tags.push('AI+健康');
    if (/\b(infrastructure|platform|tool|framework)\b/.test(text) && industry === '人工智能') tags.push('AI基础设施');
    if (/\b(agent|autonomous)\b/.test(text) && industry === '人工智能') tags.push('AI Agent');

    // General Tags
    if (/\b(remote|distributed|work from home|wfh)\b/.test(text)) tags.push('远程优先');
    if (/\b(global|worldwide|international)\b/.test(text)) tags.push('全球招聘');
    if (/\b(startup|early stage|seed|series a)\b/.test(text)) tags.push('初创公司');
    if (/\b(unicorn|billion)\b/.test(text)) tags.push('独角兽');
    if (/\b(china|chinese|asia)\b/.test(text) && !text.includes('mainland china only')) tags.push('出海');

    return {
        industry,
        tags: [...new Set(tags)] // Deduplicate tags
    };
}

export function extractSalary(text) {
    if (!text) return null;
    
    // 预处理：移除逗号，统一空格
    // Strip HTML tags first if they exist (simple check)
    const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    
    // Patterns for salary extraction
    const salaryPatterns = [
        // 1. 中文完整描述: "起薪为 80,000 美元至 100,000 美元"
        /(?:起薪|薪资|待遇|月薪|年薪|base salary|salary range|pay range|compensation)[\u4e00-\u9fa5\s\w]*?(\d{1,3}(?:,\d{3})*|\d{4,})\s*(?:美元|USD|元|RMB|CNY)?\s*(?:至|-|–|—|to)\s*(\d{1,3}(?:,\d{3})*|\d{4,})\s*(?:美元|USD|元|RMB|CNY)(?:\/[\u4e00-\u9fa5\w]+)?/i,
        
        // 2. 时薪描述: "15-18 美元/小时", "15 - 18 USD/Hour"
        /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:-|–|—|to)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:美元|USD|元|RMB)\s*\/\s*(?:小时|hour|hr)/i,

        // 3. 简单的数字范围 + 货币单位 (Loose match for "80,000 美元 至 100,000 美元")
        /(\d{1,3}(?:,\d{3})*)\s*(?:美元|USD|元|RMB)?\s*(?:至|-|–|—|to)\s*(\d{1,3}(?:,\d{3})*)\s*(?:美元|USD|元|RMB)/i,

        // 4. Standard Global with K: $100k-$150k
        /([$€£¥])\s*(\d{1,4})\s*k\s*(?:-|to|–)\s*(?:[$€£¥])?\s*(\d{1,4})\s*k/i,

        // 5. Currency Code with K: USD 100k - 150k
        /\b(USD|EUR|GBP|CNY|RMB|AUD|CAD)\s*(\d{1,4})\s*k\s*(?:-|to|–)\s*(\d{1,4})\s*k/i,
        
        // 6. K with suffix currency: 100k - 150k USD
        /(\d{1,4})\s*k\s*(?:-|to|–)\s*(\d{1,4})\s*k\s*(USD|EUR|GBP|CNY|RMB|AUD|CAD)/i,

        // 7. Full Numbers: $100,000 - $150,000
        /([$€£¥])\s*(\d{1,3}(?:,\d{3})*|\d{4,})\s*(?:-|to|–)\s*(?:[$€£¥])?\s*(\d{1,3}(?:,\d{3})*|\d{4,})/i,

        // 8. Chinese specific: 20k-30k/月
        /(\d{1,3}k\s*[-–—]\s*\d{1,3}k(?:\/[\w\u4e00-\u9fa5]+)?)/i,

        // 9. Simple Range with k: 20-40k
        /(\d{1,3}\s*[-–—]\s*\d{1,3}\s*k)/i,
        
        // 10. Wan (Ten Thousand): 20-40万
        /(\d{1,3}\s*[-–—]\s*\d{1,3}\s*万)/i
    ];

    for (const pattern of salaryPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            // Logic to format the match
            // Cases 4, 7 return currency in group 1
            if ((pattern.source.includes('[$€£¥]') || pattern.source.includes('USD')) && match[1] && match[2] && match[3]) {
                // Handling specific group structures
                // Case 4: $ 100 k ... 150 k
                if (pattern.source.includes('k\\s*(?:-|to|–)')) {
                    const currency = match[1];
                    // If matched currency code in group 1 (Case 5)
                    if (['USD','EUR','GBP','CNY','RMB'].includes(match[1])) {
                        return `${match[1]} ${match[2]}k - ${match[3]}k`;
                    }
                    // Case 6: 100 k ... 150 k ... USD (currency in group 3)
                    if (['USD','EUR','GBP','CNY','RMB'].includes(match[3])) {
                         return `${match[3]} ${match[1]}k - ${match[2]}k`;
                    }
                    // Case 4: $ ...
                    return `${currency}${match[2]}k - ${currency}${match[3]}k`;
                }
                
                // Case 7: $ 100000 ... 150000
                const currency = match[1];
                let min = parseInt(match[2].replace(/,/g, ''));
                let max = parseInt(match[3].replace(/,/g, ''));
                
                // Convert to k if large enough
                if (min >= 10000 && max >= 10000) {
                    return `${currency}${Math.round(min/1000)}k - ${currency}${Math.round(max/1000)}k`;
                }
                return `${currency}${min} - ${currency}${max}`;
            }

            // General Fallback for other patterns (1, 2, 3, 8, 9, 10)
            if (match[1] && match[2]) {
                const fullMatch = match[0];
                let currency = '';
                if (fullMatch.includes('美元') || fullMatch.includes('USD') || fullMatch.includes('$')) currency = '$'; // Simplify to symbol
                else if (fullMatch.includes('元') || fullMatch.includes('RMB') || fullMatch.includes('CNY') || fullMatch.includes('¥')) currency = '¥';
                
                let p1 = match[1].replace(/,/g, '');
                let p2 = match[2].replace(/,/g, '');
                
                // Hourly
                if (fullMatch.includes('小时') || fullMatch.includes('hour') || fullMatch.includes('/hr')) {
                    return `${currency || '$'}${p1}-${p2}/hr`;
                }
                
                // Wan
                if (fullMatch.includes('万')) {
                     return `¥${p1}0k - ¥${p2}0k`;
                }

                // Simple K conversion
                const n1 = parseInt(p1);
                const n2 = parseInt(p2);
                if (!isNaN(n1) && !isNaN(n2) && n1 > 1000 && n2 > 1000) {
                    p1 = Math.round(n1/1000) + 'k';
                    p2 = Math.round(n2/1000) + 'k';
                }
                
                // Add k if missing in p1/p2 but present in text? (Handled by regex structure usually)
                
                return `${currency || ''}${p1}-${p2}`;
            }
            
            return match[0];
        }
    }

    // Keyword fallback (from original code)
    const keywordPattern = /(?:salary|compensation|pay|remuneration|rate|薪资|薪水|月薪|年薪|待遇)(?:\s+(?:package|range|of|is|from|estimated|approx|starting))*\s*[:：]?\s*([$€£¥])?\s*(\d{1,7}k?)\s*(?:-|to|–|~)\s*([$€£¥])?\s*(\d{1,7}k?)\s*(USD|EUR|GBP|CNY|RMB|AUD|CAD)?/i;
    const keywordMatch = cleanText.match(keywordPattern);
    
    if (keywordMatch) {
        const currencySym1 = keywordMatch[1];
        const val1 = keywordMatch[2];
        const val2 = keywordMatch[4];
        const currencyCode = keywordMatch[5];
        
        let currency = '$'; 
        if (currencyCode) currency = currencyCode + ' ';
        else if (currencySym1) currency = currencySym1;
        
        return `${currency}${val1} - ${val2}`;
    }

    return null;
}

export function parseSalaryString(salaryStr) {
    if (!salaryStr || typeof salaryStr !== 'string') return null;
    
    // Normalize
    const str = salaryStr.trim();
    if (!str) return null;

    let currency = 'USD';
    let min = 0;
    let max = 0;

    // Detect currency
    if (str.includes('¥') || str.includes('CNY') || str.includes('RMB')) currency = 'CNY';
    else if (str.includes('€') || str.includes('EUR')) currency = 'EUR';
    else if (str.includes('£') || str.includes('GBP')) currency = 'GBP';
    // else default to USD

    // Extract numbers (supporting 'k')
    // Regex to match numbers like 100, 100k, 100.5
    const numRegex = /(\d+(?:,\d+)*(?:\.\d+)?)\s*k?/gi;
    const matches = [...str.matchAll(numRegex)];
    
    const parseNum = (match) => {
        let val = parseFloat(match[1].replace(/,/g, ''));
        if (match[0].toLowerCase().includes('k')) {
            val *= 1000;
        }
        return val;
    };

    if (matches.length >= 2) {
        min = parseNum(matches[0]);
        max = parseNum(matches[1]);
    } else if (matches.length === 1) {
        min = parseNum(matches[0]);
        max = min;
    } else {
        return null; // No numbers found
    }

    return { min, max, currency };
}

// Location Keywords for Whitelist Validation & Region Classification
const GLOBAL_KEYWORDS = [
  'anywhere', 'everywhere', 'worldwide', 'global',
  'remote', 'work from anywhere', 'wfa', 'distributed',
  '不限地点', '全球', '任意地点', '远程', '在家办公'
]

const MAINLAND_KEYWORDS = [
  'china', '中国', 'cn', 'chinese', 'mainland china', 'prc',
  'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou',
  'chengdu', '北京', '上海', '深圳', '广州', '杭州',
  '成都', '重庆', '南京', '武汉', '西安', '苏州',
  '天津', '大连', '青岛', '厦门', '珠海', '佛山',
  '宁波', '无锡', '长沙', '郑州', '济南', '哈尔滨',
  '沈阳', '福州', '石家庄', '合肥', '昆明', '兰州'
]

const GREATER_CHINA_KEYWORDS = [
  'hong kong', 'hongkong', 'hk', '香港',
  'macau', 'macao', '澳门',
  'taiwan', 'taipei', '台湾', '台北', '高雄'
]

const APAC_KEYWORDS = [
  'apac', 'asia pacific', 'east asia', 'southeast asia',
  'utc+8', 'gmt+8', 'cst', 'asia/shanghai', 'asia/hong_kong',
  '亚太', '东亚', '东南亚'
]

const OVERSEAS_KEYWORDS = [
  // North America
  'usa', 'united states', 'america', 'san francisco', 'new york',
  'seattle', 'boston', 'austin', 'los angeles', 'silicon valley', 'bay area',
  'portland', 'denver', 'chicago', 'atlanta', 'miami', 'dallas',
  'canada', 'toronto', 'vancouver', 'montreal', 'calgary',
  'mexico', 'mexico city',
  'hawaii', 'honolulu',
  'north america', '美国', '加拿大', '北美',

  // Europe
  'europe', 'emea', 'united kingdom', 'england', 'london', 'uk', 'britain',
  'germany', 'berlin', 'munich', 'frankfurt', 'hamburg', 'deutschland',
  'france', 'paris', 'lyon',
  'spain', 'madrid', 'barcelona',
  'italy', 'rome', 'milan',
  'netherlands', 'amsterdam', 'rotterdam',
  'belgium', 'brussels',
  'sweden', 'stockholm',
  'norway', 'oslo',
  'denmark', 'copenhagen',
  'finland', 'helsinki',
  'poland', 'warsaw',
  'czech', 'prague',
  'ireland', 'dublin',
  'switzerland', 'zurich', 'geneva',
  'austria', 'vienna',
  'portugal', 'lisbon',
  'estonia', 'latvia', 'lithuania',
  'ukraine', 'romania', 'bulgaria', 'greece', 'athens',
  '英国', '德国', '法国', '西班牙', '意大利', '荷兰', '瑞典', '挪威', '芬兰', '波兰', '爱尔兰', '瑞士', '奥地利', '葡萄牙', '欧洲',

  // Oceania
  'australia', 'sydney', 'melbourne', 'brisbane', 'perth',
  'new zealand', 'auckland', 'wellington',
  '澳洲', '澳大利亚', '新西兰',

  // Asia (Overseas)
  'japan', 'tokyo', 'osaka', 'kyoto',
  'korea', 'south korea', 'seoul', 'busan',
  'singapore',
  'malaysia', 'kuala lumpur',
  'indonesia', 'jakarta', 'bali',
  'thailand', 'bangkok',
  'vietnam', 'hanoi', 'ho chi minh',
  'philippines', 'manila',
  'india', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune',
  'pakistan', 'karachi',
  'bangladesh', 'dhaka',
  'sri lanka', 'colombo',
  'kuwait',
  '日本', '东京', '韩国', '首尔', '新加坡', '马来西亚', '印尼', '泰国', '越南', '菲律宾', '印度',

  // Middle East
  'uae', 'dubai', 'abu dhabi',
  'saudi', 'riyadh', 'jeddah',
  'qatar', 'doha',
  'israel', 'tel aviv', 'jerusalem',
  'turkey', 'istanbul', 'ankara',
  '阿联酋', '迪拜', '沙特', '卡塔尔', '以色列', '土耳其',

  // South America
  'brazil', 'sao paulo', 'rio de janeiro',
  'argentina', 'buenos aires',
  'chile', 'santiago',
  'colombia', 'bogota',
  'peru', 'lima',
  'uruguay', 'montevideo',
  'latam', 'latin america',
  '巴西', '阿根廷', '智利', '哥伦比亚', '秘鲁', '乌拉圭', '南美',

  // Others
  'russia', 'moscow', 'st petersburg',
  'africa', 'egypt', 'cairo', 'south africa', 'cape town', 'nigeria', 'kenya',
  '俄罗斯', '非洲', '埃及', '南非'
]

// Combined whitelist for validation
const ALL_VALID_LOCATIONS = [
  ...GLOBAL_KEYWORDS,
  ...MAINLAND_KEYWORDS,
  ...GREATER_CHINA_KEYWORDS,
  ...APAC_KEYWORDS,
  ...OVERSEAS_KEYWORDS
];

// Helper: Check if text contains a valid location
function isValidLocation(text) {
  if (!text || text.length < 2) return false;
  const lower = text.toLowerCase().trim();
  
  return ALL_VALID_LOCATIONS.some(keyword => {
    // Check if keyword contains non-ASCII characters (likely Chinese/Japanese/Korean)
    const isNonAscii = /[^\x00-\x7F]/.test(keyword);

    if (!isNonAscii && keyword.length <= 3) {
      // Strict word boundary for short English keywords (uk, us, cn, hk, etc.)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lower);
    } else {
      // For longer keywords OR non-ASCII keywords, simple inclusion is safe
      return lower.includes(keyword);
    }
  });
}

export function extractLocation(text) {
  if (!text) return null
  
  // Strip HTML tags for regex matching
  const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

  // 0. Check for "Title - Location" pattern (common in job titles)
  // e.g., "Software Engineer - Uruguay (Remote)", "DevOps - UK"
  const titleLocMatch = cleanText.match(/-\s*([A-Za-z\u4e00-\u9fa5\s]+)(?:\s*[\(\（].*?[\)\）])?$/);
  if (titleLocMatch && titleLocMatch[1]) {
     const potentialLoc = titleLocMatch[1].trim();
     if (isValidLocation(potentialLoc)) {
         return potentialLoc;
     }
  }

  // 1. Check for locations in parentheses/brackets e.g., "Software Engineer (UK)", "[China]"
  const parenMatches = cleanText.match(/[\(\[\{\（\【](.*?)[\)\]\}\）\】]/g)
  if (parenMatches) {
    for (const match of parenMatches) {
      const content = match.slice(1, -1).trim()
      if (content.length < 50 && isValidLocation(content)) {
        return content
      }
    }
  }

  // 2. Common "Location:" pattern in description
  const locPattern = /(?:Location|Based in|Remote form|Remote in|地点|工作地点|城市):\s*([^\n\.<,;]+)/i
  const locMatch = cleanText.match(locPattern)
  if (locMatch && locMatch[1]) {
    const content = locMatch[1].trim();
    if (content.length < 50 && isValidLocation(content)) {
        return content;
    }
  }
  
  // 3. Remote variations
  if (/\b(remote|wfh|work from home|distributed|anywhere|远程|在家办公)\b/i.test(cleanText)) {
      // Try to find if it's "Remote - [Region]"
      const remoteRegion = cleanText.match(/(?:remote|远程)\s*[-–—]\s*([A-Za-z\u4e00-\u9fa5\s]+)/i);
      if (remoteRegion && remoteRegion[1]) {
          const content = remoteRegion[1].trim();
          if (isValidLocation(content)) {
             return `Remote - ${content}`;
          }
      }
      return 'Remote';
  }

  return null
}

/**
 * 自动判断岗位的区域类型
 * @param {string} location - 岗位地点
 * @returns {'domestic' | 'overseas' | 'both'}
 */
export function classifyRegion(location) {
  const loc = (location || '').toLowerCase().trim()

  // 空地点默认为both
  if (!loc) return 'both'

  const isOverseas = OVERSEAS_KEYWORDS.some(k => loc.includes(k)) || 
                     ['us', 'uk', 'eu'].some(k => new RegExp(`\\b${k}\\b`, 'i').test(loc));

  const isMainland = MAINLAND_KEYWORDS.some(k => loc.includes(k))
  const isGreaterChina = GREATER_CHINA_KEYWORDS.some(k => loc.includes(k))
  const isAPAC = APAC_KEYWORDS.some(k => loc.includes(k))
  const isGlobal = GLOBAL_KEYWORDS.some(k => loc.includes(k))

  // 优先级分类逻辑

  // 1. 中国/大中华区 - 绝对的国内可申
  if (isMainland || isGreaterChina) {
    // 如果同时有海外或全球属性，标记为 both 以便在海外列表也能看到
    if (isOverseas || isGlobal || isAPAC) {
      return 'both'
    }
    return 'domestic'
  }

  // 2. APAC/亚太时区 - 用户指定归为"中国可申"
  if (isAPAC) {
    return 'both'
  }

  // 3. 明确的海外地点 - 归为海外
  if (isOverseas) {
    return 'overseas'
  }

  // 4. Global/Remote/Anywhere - 归为"中国可申" (Both)
  if (isGlobal) {
    return 'both'
  }

  // 默认: 如果完全无法判断，归为海外
  return 'overseas'
}

export const ClassificationService = {
    classifyJob,
    determineExperienceLevel,
    classifyCompany,
    extractSalary,
    extractLocation,
    classifyRegion
};
