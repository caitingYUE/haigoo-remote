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

export function determineJobType(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    if (/\b(contract|contractor|freelance|temp|temporary)\b/.test(text)) return 'contract';
    if (/\b(part-time|part time)\b/.test(text)) return 'part-time';
    if (/\b(intern|internship)\b/.test(text)) return 'internship';
    return 'full-time';
}

export function determineRegion(location, title, description) {
    const text = (location + ' ' + title + ' ' + description).toLowerCase();
    
    if (/\b(china|beijing|shanghai|shenzhen|hangzhou|guangzhou|chengdu)\b/.test(text)) return 'china';
    if (/\b(asia|apac|singapore|japan|korea|india|vietnam|thailand)\b/.test(text)) return 'asia';
    if (/\b(europe|uk|london|berlin|paris|amsterdam|emea|germany|france)\b/.test(text)) return 'europe';
    if (/\b(north america|usa|us|united states|canada|new york|san francisco|sf|bay area)\b/.test(text)) return 'north_america';
    if (/\b(latin america|latam|brazil|mexico)\b/.test(text)) return 'latam';
    if (/\b(africa)\b/.test(text)) return 'africa';
    if (/\b(australia|nz|new zealand|sydney|melbourne)\b/.test(text)) return 'oceania';
    
    return 'overseas'; // Default
}

export function extractJobTags(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    const tags = new Set();

    // Iterate over JOB_KEYWORDS to find skills
    for (const [keyword] of Object.entries(JOB_KEYWORDS)) {
        // Skip long phrases or very common words if needed, but most keys seem like good tags
        if (keyword.length < 2) continue; 
        
        // Simple boundary check
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
            // Capitalize for better display? Or just keep lowercase? 
            // Let's Capitalize first letter
            tags.add(keyword.charAt(0).toUpperCase() + keyword.slice(1));
        }
    }
    
    // Add some extra common tags not in category mapping
    const extras = ['SQL', 'NoSQL', 'Redis', 'MongoDB', 'PostgreSQL', 'MySQL', 'GraphQL', 'REST API', 'CI/CD', 'Git', 'Agile', 'Scrum', 'Jira'];
    for (const extra of extras) {
        if (new RegExp(`\\b${extra}\\b`, 'i').test(text)) {
            tags.add(extra);
        }
    }

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
}

export function extractRequirements(description) {
    const text = description.toLowerCase();
    const reqs = [];
    
    // Language requirements
    if (/\b(english)\b/.test(text)) reqs.push('English');
    if (/\b(mandarin|chinese)\b/.test(text)) reqs.push('Chinese');
    if (/\b(japanese)\b/.test(text)) reqs.push('Japanese');
    if (/\b(spanish)\b/.test(text)) reqs.push('Spanish');
    if (/\b(french)\b/.test(text)) reqs.push('French');
    if (/\b(german)\b/.test(text)) reqs.push('German');
    
    // Degree requirements
    if (/\b(bachelor|bs|ba|degree)\b/.test(text)) reqs.push('Bachelor Degree');
    if (/\b(master|ms|ma)\b/.test(text)) reqs.push('Master Degree');
    if (/\b(phd|doctorate)\b/.test(text)) reqs.push('PhD');
    
    // Experience requirements (rough guess)
    const yearsMatch = text.match(/(\d+)\+?\s*years?/);
    if (yearsMatch) {
        reqs.push(`${yearsMatch[1]}+ Years Experience`);
    }

    return reqs;
}

export const ClassificationService = {
    classifyJob,
    determineExperienceLevel,
    classifyCompany,
    determineJobType,
    determineRegion,
    extractJobTags,
    extractRequirements
};
