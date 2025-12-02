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

    // Priority 1: Check title for exact matches first (Higher precision)
    for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
        if (keyword.length <= 3 && /^[a-zA-Z0-9]+$/.test(keyword)) {
            const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
            if (regex.test(titleLower)) return category;
        } else {
            if (titleLower.includes(keyword)) return category;
        }
    }

    // Fallback: Check description for strong signals
    for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
        if (keyword.length > 4 && text.includes(keyword)) {
            return category;
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
