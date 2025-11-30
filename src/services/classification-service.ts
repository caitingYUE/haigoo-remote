import { JobCategory, CompanyIndustry, CompanyTag } from '../types/rss-types';

/**
 * Classification Service
 * Provides keyword-based classification for Jobs and Companies
 */

// Job Category Keywords
const JOB_KEYWORDS: Record<string, JobCategory> = {
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

// Company Industry Keywords - Expanded
const INDUSTRY_KEYWORDS: Record<string, CompanyIndustry> = {
    // AI & Data
    'ai': '人工智能',
    'artificial intelligence': '人工智能',
    'machine learning': '人工智能',
    'deep learning': '人工智能',
    'computer vision': '人工智能',
    'nlp': '人工智能',
    'llm': '人工智能',
    'generative ai': '人工智能',
    'neural network': '人工智能',
    'data science': '人工智能',
    'big data': '人工智能',
    'analytics': '人工智能',

    // Web3 & Blockchain
    'blockchain': 'Web3/区块链',
    'crypto': 'Web3/区块链',
    'web3': 'Web3/区块链',
    'bitcoin': 'Web3/区块链',
    'ethereum': 'Web3/区块链',
    'defi': 'Web3/区块链',
    'nft': 'Web3/区块链',
    'smart contract': 'Web3/区块链',
    'wallet': 'Web3/区块链',
    'exchange': 'Web3/区块链',
    'dao': 'Web3/区块链',

    // SaaS & Enterprise
    'saas': '企业服务/SaaS',
    'enterprise': '企业服务/SaaS',
    'b2b': '企业服务/SaaS',
    'crm': '企业服务/SaaS',
    'erp': '企业服务/SaaS',
    'cloud platform': '企业服务/SaaS',
    'productivity': '企业服务/SaaS',
    'collaboration': '企业服务/SaaS',
    'workflow': '企业服务/SaaS',
    'automation': '企业服务/SaaS',
    'hr tech': '企业服务/SaaS',
    'marketing tech': '企业服务/SaaS',

    // Fintech
    'fintech': '金融/Fintech',
    'finance': '金融/Fintech',
    'banking': '金融/Fintech',
    'payment': '金融/Fintech',
    'trading': '金融/Fintech',
    'investment': '金融/Fintech',
    'insurance': '金融/Fintech',
    'insurtech': '金融/Fintech',
    'wealth': '金融/Fintech',
    'lending': '金融/Fintech',

    // Healthcare
    'health': '大健康/医疗',
    'medical': '大健康/医疗',
    'biotech': '大健康/医疗',
    'pharma': '大健康/医疗',
    'therapeutics': '大健康/医疗',
    'digital health': '大健康/医疗',
    'medtech': '大健康/医疗',
    'life sciences': '大健康/医疗',
    'fitness': '大健康/医疗',
    'wellness': '大健康/医疗',

    // E-commerce
    'ecommerce': '电子商务',
    'e-commerce': '电子商务',
    'retail': '电子商务',
    'marketplace': '电子商务',
    'shopping': '电子商务',
    'dtc': '电子商务',
    'consumer goods': '电子商务',
    'fashion': '电子商务',
    'apparel': '电子商务',

    // Gaming
    'game': '游戏',
    'gaming': '游戏',
    'esports': '游戏',
    'video game': '游戏',
    'mobile game': '游戏',
    'console': '游戏',
    'unity': '游戏',
    'unreal engine': '游戏',

    // Hardware & IoT
    'hardware': '硬件/物联网',
    'iot': '硬件/物联网',
    'robotics': '硬件/物联网',
    'semiconductor': '硬件/物联网',
    'chip': '硬件/物联网',
    'electronics': '硬件/物联网',
    'manufacturing': '硬件/物联网',
    'autonomous': '硬件/物联网',
    'drone': '硬件/物联网',

    // Education
    'education': '教育',
    'edtech': '教育',
    'learning': '教育',
    'university': '教育',
    'school': '教育',
    'training': '教育',
    'course': '教育',

    // Media & Entertainment
    'media': '媒体/娱乐',
    'entertainment': '媒体/娱乐',
    'news': '媒体/娱乐',
    'video': '媒体/娱乐',
    'music': '媒体/娱乐',
    'streaming': '媒体/娱乐',
    'social media': '媒体/娱乐',
    'content': '媒体/娱乐',

    // Consumer
    'consumer': '消费生活',
    'lifestyle': '消费生活',
    'travel': '消费生活',
    'food': '消费生活',
    'beverage': '消费生活',
    'hospitality': '消费生活',

    // General Tech (Fallback)
    'software': '互联网/软件',
    'internet': '互联网/软件',
    'technology': '互联网/软件',
    'app': '互联网/软件',
    'mobile app': '互联网/软件',
    'platform': '互联网/软件'
};

// Company Tag Keywords - Expanded
const TAG_KEYWORDS: Record<string, CompanyTag> = {
    // AI Related
    'companion': 'AI+陪伴',
    'chatbot': 'AI+陪伴',
    'character ai': 'AI+陪伴',
    'virtual friend': 'AI+陪伴',

    'healthcare ai': 'AI+健康',
    'medical ai': 'AI+健康',
    'health tech': 'AI+健康',

    'infrastructure': 'AI基础设施',
    'gpu': 'AI基础设施',
    'compute': 'AI基础设施',
    'vector db': 'AI基础设施',
    'model training': 'AI基础设施',

    'copilot': 'AI+工具',
    'assistant': 'AI+工具',
    'productivity ai': 'AI+工具',

    // Industry Specific
    'pharmaceutical': '医药',
    'drug discovery': '医药',
    'clinical': '医药',

    // Work Culture
    'remote first': '远程优先',
    'remote-first': '远程优先',
    'distributed team': '远程优先',
    'fully remote': '远程优先',
    'work from anywhere': '远程优先',
    'async': '远程优先',

    'global': '全球招聘',
    'worldwide': '全球招聘',
    'international': '全球招聘',

    // Company Stage/Type
    'startup': '初创公司',
    'early stage': '初创公司',
    'seed': '初创公司',
    'series a': '初创公司',
    'fast-growing': '初创公司',
    'yc': '初创公司',
    'y combinator': '初创公司',

    'unicorn': '独角兽',
    'billion valuation': '独角兽',
    'ipo': '独角兽',
    'public company': '独角兽',

    'foreign': '外企',
    'mnc': '外企',
    'global 500': '外企',
    'fortune 500': '外企',

    'cross-border': '出海',
    'global expansion': '出海',
    'overseas': '出海'
};

export const ClassificationService = {
    /**
     * Classify a job based on title and description
     */
    classifyJob(title: string, description: string = ''): JobCategory {
        const text = (title + ' ' + description).toLowerCase();
        const titleLower = title.toLowerCase();

        // Helper to escape regex special characters
        const escapeRegExp = (string: string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // Priority 1: Check title for exact matches first (Higher precision)
        for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
            // Use word boundary check for short keywords to avoid false positives
            // But be careful with special chars like C++ or .NET where \b might not work as expected with symbols
            // For keywords with symbols, simple includes check is safer or specific regex

            if (keyword.length <= 3 && /^[a-zA-Z0-9]+$/.test(keyword)) {
                const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
                if (regex.test(titleLower)) return category;
            } else {
                // For longer keywords or keywords with symbols (c++, .net), use simple includes
                if (titleLower.includes(keyword)) return category;
            }
        }

        // Priority 2: Check description if title didn't match
        // We only check description for keywords that are very specific to avoid noise
        // For now, let's stick to title-heavy classification for safety, or use a scoring system
        // A simple fallback is to check description for same keywords but return '软件开发' if ambiguous

        // Fallback: Check description for strong signals
        for (const [keyword, category] of Object.entries(JOB_KEYWORDS)) {
            if (keyword.length > 4 && text.includes(keyword)) {
                return category;
            }
        }

        return '其他';
    },

    /**
     * Classify a company based on name and description
     */
    classifyCompany(name: string, description: string = ''): { industry: CompanyIndustry; tags: CompanyTag[] } {
        const n = name.toLowerCase();
        const d = description.toLowerCase();
        const scores: Record<CompanyIndustry, number> = {
            '互联网/软件': 0,
            '人工智能': 0,
            '大健康/医疗': 0,
            '教育': 0,
            '金融/Fintech': 0,
            '电子商务': 0,
            'Web3/区块链': 0,
            '游戏': 0,
            '媒体/娱乐': 0,
            '企业服务/SaaS': 0,
            '硬件/物联网': 0,
            '消费生活': 0,
            '其他': 0
        };

        for (const [kw, ind] of Object.entries(INDUSTRY_KEYWORDS)) {
            let w = 0;
            if (n.includes(kw)) w += 2;
            if (d.includes(kw)) w += 1;
            if (kw.length >= 7 || kw.includes(' ')) w += 1;
            if (w > 0) scores[ind] += w;
        }

        let industry: CompanyIndustry = '其他';
        let max = -1;
        for (const [ind, score] of Object.entries(scores)) {
            if (score > max) {
                max = score;
                industry = ind as CompanyIndustry;
            }
        }

        if (max <= 0) {
            const techHints = ['software','internet','technology','app','mobile app','platform','cloud'];
            const t = (n + ' ' + d);
            if (techHints.some(h => t.includes(h))) industry = '互联网/软件';
        }

        const tags: Set<CompanyTag> = new Set();
        for (const [kw, tag] of Object.entries(TAG_KEYWORDS)) {
            if (n.includes(kw) || d.includes(kw)) tags.add(tag);
        }

        return { industry, tags: Array.from(tags) };
    },

    /**
     * Determine experience level based on title and description
     */
    determineExperienceLevel(title: string, description: string): 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' {
        const text = (title + ' ' + description).toLowerCase();
        const titleLower = title.toLowerCase();

        // Priority 1: Executive (C-level, VP, Director, Head)
        // Check title first for higher precision
        if (/\b(c[t|e|o|f]o|vp|vice president|director|head of)\b/.test(titleLower)) {
            return 'Executive';
        }

        // Priority 2: Lead / Principal / Staff / Architect
        if (/\b(lead|principal|staff|architect|manager)\b/.test(titleLower)) {
            return 'Lead';
        }

        // Priority 3: Senior
        if (/\b(senior|sr\.?|iii|iv)\b/.test(titleLower)) {
            return 'Senior';
        }

        // Priority 4: Entry / Junior
        if (/\b(junior|jr\.?|entry|intern|internship|graduate)\b/.test(titleLower)) {
            return 'Entry';
        }

        // Fallback checks in description if title didn't match
        // Be more conservative with description matching
        if (/\b(executive|director|vp)\b/.test(text)) return 'Executive';
        if (/\b(principal|staff|architect)\b/.test(text)) return 'Lead';

        // Default to Mid if no strong signals
        return 'Mid';
    }
};
