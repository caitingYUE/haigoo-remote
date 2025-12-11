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
    const cleanText = text.replace(/,/g, '').replace(/\s+/g, ' ');
    
    // 1. 匹配带有货币符号的范围: $100k - $150k, $100k-$150k, €50k-€80k
    const symbolKPattern = /([$€£¥])\s*(\d{1,4})\s*k\s*(?:-|to|–)\s*(?:[$€£¥])?\s*(\d{1,4})\s*k/i;
    const symbolKMatch = cleanText.match(symbolKPattern);
    if (symbolKMatch) {
        const currency = symbolKMatch[1];
        return `${currency}${symbolKMatch[2]}k - ${currency}${symbolKMatch[3]}k`;
    }

    // 2. 匹配带有货币代码的范围: USD 100k - 150k, 100k-150k USD
    const codeKPattern = /\b(USD|EUR|GBP|CNY|RMB|AUD|CAD)\s*(\d{1,4})\s*k\s*(?:-|to|–)\s*(\d{1,4})\s*k/i;
    const codeKMatch = cleanText.match(codeKPattern);
    if (codeKMatch) {
        return `${codeKMatch[1]} ${codeKMatch[2]}k - ${codeKMatch[3]}k`;
    }
    
    // 后置货币代码: 100k - 150k USD
    const kCodePattern = /(\d{1,4})\s*k\s*(?:-|to|–)\s*(\d{1,4})\s*k\s*(USD|EUR|GBP|CNY|RMB|AUD|CAD)/i;
    const kCodeMatch = cleanText.match(kCodePattern);
    if (kCodeMatch) {
        return `${kCodeMatch[3]} ${kCodeMatch[1]}k - ${kCodeMatch[2]}k`;
    }

    // 3. 匹配完整数字: $100000 - $150000
    const fullNumPattern = /([$€£¥])\s*(\d{4,7})\s*(?:-|to|–)\s*(?:[$€£¥])?\s*(\d{4,7})/i;
    const fullNumMatch = cleanText.match(fullNumPattern);
    if (fullNumMatch) {
        const currency = fullNumMatch[1];
        const min = parseInt(fullNumMatch[2]);
        const max = parseInt(fullNumMatch[3]);
        
        // 只有当数字看起来像年薪时才转换 (e.g. > 10000)
        if (min >= 10000 && max >= 10000) {
            // 转换为k
            return `${currency}${Math.round(min/1000)}k - ${currency}${Math.round(max/1000)}k`;
        }
        return `${currency}${min} - ${currency}${max}`;
    }

    // 3b. 匹配完整数字 + 后置货币: 100000 - 150000 USD
    const fullNumSuffixPattern = /(\d{4,7})\s*(?:-|to|–)\s*(\d{4,7})\s*(USD|EUR|GBP|CNY|RMB|AUD|CAD)/i;
    const fullNumSuffixMatch = cleanText.match(fullNumSuffixPattern);
    if (fullNumSuffixMatch) {
        const min = parseInt(fullNumSuffixMatch[1]);
        const max = parseInt(fullNumSuffixMatch[2]);
        const currency = fullNumSuffixMatch[3] + ' ';

        if (min >= 10000 && max >= 10000) {
            return `${currency}${Math.round(min/1000)}k - ${Math.round(max/1000)}k`;
        }
        return `${currency}${min} - ${max}`;
    }

    // 4. 关键词引导的提取 (e.g. "Salary: 100k-150k", "Compensation package of 100,000 - 120,000 USD")
    // 匹配: 关键词 ... (连接词)? ... 数字(k?) ... 分隔符 ... 数字(k?) ... 货币代码?
    const keywordPattern = /(?:salary|compensation|pay|remuneration|rate|薪资|薪水|月薪|年薪|待遇)(?:\s+(?:package|range|of|is|from|estimated|approx|starting))*\s*[:：]?\s*([$€£¥])?\s*(\d{1,7}k?)\s*(?:-|to|–|~)\s*([$€£¥])?\s*(\d{1,7}k?)\s*(USD|EUR|GBP|CNY|RMB|AUD|CAD)?/i;
    const keywordMatch = cleanText.match(keywordPattern);
    
    if (keywordMatch) {
        const currencySym1 = keywordMatch[1];
        const val1 = keywordMatch[2];
        const currencySym2 = keywordMatch[3];
        const val2 = keywordMatch[4];
        const currencyCode = keywordMatch[5];
        
        // Determine currency
        let currency = '$'; // Default
        if (currencyCode) currency = currencyCode + ' ';
        else if (currencySym1) currency = currencySym1;
        else if (currencySym2) currency = currencySym2;
        else if (/(?:薪|元|¥|CNY|RMB)/.test(cleanText)) currency = '¥'; // Infer from text context if possible, or default

        // Helper to format value (handle 'k' or raw number)
        const formatVal = (val) => {
            const v = val.toLowerCase();
            if (v.includes('k')) return v;
            const num = parseInt(v);
            if (num >= 10000) return Math.round(num/1000) + 'k';
            return num; // If small number, return as is (hourly rate?)
        };

        return `${currency}${formatVal(val1)} - ${formatVal(val2)}`;
    }

    return null;
}

export function extractLocation(text) {
    if (!text) return null;
    
    // 0. 关键词引导提取 (e.g. "Location: New York", "工作地点: 北京")
    // Use raw text to preserve structure before normalization if needed, but cleanText is usually fine for short extracts.
    // Here we use the raw 'text' but limit the capture to avoid grabbing too much.
    const locationKeywordPattern = /(?:location|based in|loc|地点|工作地点)\s*[:：]\s*([a-zA-Z\u4e00-\u9fa5\s,]+)(?:[\n\r]|$|\.|;)/i;
    const locMatch = text.match(locationKeywordPattern);
    if (locMatch) {
        let loc = locMatch[1].trim();
        // Simple validation: length and remove common noise
        if (loc.length > 2 && loc.length < 50 && !/salary|pay|description|requirement/i.test(loc)) {
            return loc;
        }
    }

    const lowerText = text.toLowerCase();
    
    // 优先匹配明确的 Remote 模式
    if (/\b(remote worldwide|remote global|work from anywhere|anywhere in the world|anywhere)\b/i.test(lowerText)) {
        return 'Remote (Global)';
    }

    // 定义常见地区映射
    const regions = [
        { label: 'US', pattern: /\b(united states|usa|us|america|north america)\b/i },
        { label: 'UK', pattern: /\b(united kingdom|uk|britain|london)\b/i },
        { label: 'Canada', pattern: /\b(canada|toronto|vancouver)\b/i },
        { label: 'Europe', pattern: /\b(europe|eu|germany|france|spain|italy|netherlands|berlin|paris|amsterdam|london|uk)\b/i }, // UK often grouped in Europe context
        { label: 'APAC', pattern: /\b(asia|apac|singapore|japan|china|australia|india|sydney|melbourne|tokyo|beijing|shanghai)\b/i },
        { label: 'LATAM', pattern: /\b(latin america|latam|brazil|mexico|argentina)\b/i }
    ];

    // 检查 "Remote in [Region]" 或 "Remote - [Region]"
    for (const region of regions) {
        // Pattern: Remote in US, Remote (Europe), Remote - APAC
        const specificRemotePattern = new RegExp(`remote\\s*(?:in|from|-|\\()\\s*.*${region.pattern.source}`, 'i');
        if (specificRemotePattern.test(lowerText)) {
            return `Remote (${region.label})`;
        }
    }
    
    // 如果没有明确的 "Remote in ...", 尝试从标题中提取
    // 这里我们假设传入的 text 主要是 title + description，但如果只是 description，可能不太准
    // 为了简单，我们只做最安全的匹配：如果出现了地区词，且出现了 remote，则标记
    
    for (const region of regions) {
        if (region.pattern.test(lowerText) && /\bremote\b/i.test(lowerText)) {
             // 避免误判：比如 "Remote job, company is based in US" -> Remote (US) 也可以接受
             return `Remote (${region.label})`;
        }
    }

    if (/\bremote\b/i.test(lowerText)) {
        return 'Remote';
    }

    return null; // 如果无法确定，返回null，调用者可以保留原值或设为默认值
}

export const ClassificationService = {
    classifyJob,
    determineExperienceLevel,
    classifyCompany,
    extractSalary,
    extractLocation
};
