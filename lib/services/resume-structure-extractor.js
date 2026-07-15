/**
 * Deterministic resume structure extraction.
 *
 * The extractor intentionally uses local dictionaries and date/section rules only.
 * It is shared by resume upload and Copilot matching so both paths see the same
 * profile shape without calling a generative model.
 */

export const RESUME_PARSER_VERSION = 'resume-structure-v1';

const SKILL_GROUPS = {
    javascript: ['javascript', 'java script', 'ecmascript', 'js'],
    typescript: ['typescript', 'type script', 'ts'],
    react: ['react.js', 'reactjs', 'react'],
    vue: ['vue.js', 'vuejs', 'vue'],
    angular: ['angularjs', 'angular'],
    nodejs: ['node.js', 'nodejs'],
    python: ['python'],
    java: ['java'],
    golang: ['golang', 'go language'],
    csharp: ['c#', 'c sharp', '.net', 'dotnet'],
    cpp: ['c++', 'cpp'],
    php: ['php'],
    ruby: ['ruby', 'ruby on rails'],
    sql: ['sql'],
    mysql: ['mysql'],
    postgres: ['postgresql', 'postgres'],
    mongodb: ['mongodb', 'mongo db'],
    redis: ['redis'],
    elasticsearch: ['elasticsearch', 'elastic search'],
    aws: ['amazon web services', 'aws'],
    gcp: ['google cloud platform', 'google cloud', 'gcp'],
    azure: ['microsoft azure', 'azure'],
    docker: ['docker'],
    kubernetes: ['kubernetes', 'k8s'],
    terraform: ['terraform'],
    git: ['github', 'gitlab', 'git'],
    linux: ['linux'],
    figma: ['figma'],
    sketch: ['sketch'],
    photoshop: ['photoshop'],
    product_management: ['product management', '产品管理'],
    product_strategy: ['product strategy', '产品策略'],
    roadmap: ['product roadmap', 'roadmap', '产品路线图'],
    user_research: ['user research', 'customer research', '用户研究'],
    ux_design: ['user experience design', 'ux design', '交互设计', '用户体验设计'],
    ui_design: ['user interface design', 'ui design', '界面设计', '视觉设计'],
    prototyping: ['prototyping', 'prototype', '原型设计'],
    data_analysis: ['data analysis', 'data analytics', '数据分析'],
    statistics: ['statistics', 'statistical analysis', '统计分析', '统计学'],
    machine_learning: ['machine learning', '机器学习', 'ml'],
    deep_learning: ['deep learning', '深度学习'],
    nlp: ['natural language processing', 'nlp', '自然语言处理'],
    computer_vision: ['computer vision', '计算机视觉', 'cv'],
    llm: ['large language model', 'large language models', 'llm', '大语言模型', '大模型'],
    tableau: ['tableau'],
    powerbi: ['power bi', 'powerbi'],
    excel: ['microsoft excel', 'excel'],
    looker: ['looker'],
    amplitude: ['amplitude'],
    mixpanel: ['mixpanel'],
    google_analytics: ['google analytics', 'ga4'],
    ab_testing: ['a/b testing', 'ab testing', 'experimentation', '实验设计'],
    seo: ['search engine optimization', 'seo', '搜索引擎优化'],
    sem: ['search engine marketing', 'sem'],
    content_marketing: ['content marketing', '内容营销'],
    social_media: ['social media marketing', 'social media', '社交媒体'],
    crm: ['customer relationship management', 'crm'],
    salesforce: ['salesforce'],
    hubspot: ['hubspot'],
    project_management: ['project management', '项目管理'],
    agile: ['agile', '敏捷开发', '敏捷'],
    scrum: ['scrum'],
    jira: ['jira'],
    leadership: ['team leadership', 'people management', '团队管理', '团队领导'],
    recruiting: ['talent acquisition', 'recruiting', '招聘'],
    customer_success: ['customer success', '客户成功'],
    customer_support: ['customer support', 'customer service', '客户支持', '客服'],
    copywriting: ['copywriting', '文案写作', '文案'],
    localization: ['localization', '本地化'],
    translation: ['translation', '翻译'],
    accounting: ['accounting', '会计'],
    financial_analysis: ['financial analysis', '财务分析'],
};

const TOOL_SKILLS = new Set([
    'figma', 'sketch', 'photoshop', 'tableau', 'powerbi', 'excel', 'looker',
    'amplitude', 'mixpanel', 'google_analytics', 'salesforce', 'hubspot', 'jira',
]);

const ROLE_DEFINITIONS = [
    { family: 'product', label: 'Product Manager', patterns: ['product manager', 'product owner', '产品经理', '产品负责人'] },
    { family: 'product', label: 'Product Operations', patterns: ['product operations', 'product ops', '产品运营'] },
    { family: 'frontend', label: 'Frontend Engineer', patterns: ['frontend engineer', 'front-end engineer', 'frontend developer', '前端工程师', '前端开发'] },
    { family: 'backend', label: 'Backend Engineer', patterns: ['backend engineer', 'back-end engineer', 'backend developer', '后端工程师', '后端开发'] },
    { family: 'fullstack', label: 'Full Stack Engineer', patterns: ['full stack engineer', 'full-stack engineer', 'fullstack developer', '全栈工程师', '全栈开发'] },
    { family: 'mobile', label: 'Mobile Engineer', patterns: ['mobile engineer', 'ios engineer', 'android engineer', '移动端开发', '移动开发'] },
    { family: 'software', label: 'Software Engineer', patterns: ['software engineer', 'software developer', '软件工程师', '软件开发'] },
    { family: 'data', label: 'Data Analyst', patterns: ['data analyst', 'business intelligence analyst', 'bi analyst', '数据分析师', '商业分析师'] },
    { family: 'data', label: 'Data Scientist', patterns: ['data scientist', '数据科学家'] },
    { family: 'data', label: 'Data Engineer', patterns: ['data engineer', '数据工程师'] },
    { family: 'ai', label: 'Machine Learning Engineer', patterns: ['machine learning engineer', 'ml engineer', '算法工程师', '机器学习工程师'] },
    { family: 'design', label: 'Product Designer', patterns: ['product designer', 'ux designer', 'ui/ux designer', '产品设计师', '交互设计师'] },
    { family: 'design', label: 'Visual Designer', patterns: ['visual designer', 'graphic designer', '视觉设计师', '平面设计师'] },
    { family: 'qa', label: 'QA Engineer', patterns: ['qa engineer', 'test engineer', 'quality assurance engineer', '测试工程师'] },
    { family: 'devops', label: 'DevOps Engineer', patterns: ['devops engineer', 'site reliability engineer', 'sre', '运维工程师'] },
    { family: 'operations', label: 'Operations Manager', patterns: ['operations manager', 'operation manager', '运营经理', '运营负责人'] },
    { family: 'marketing', label: 'Marketing Manager', patterns: ['marketing manager', 'growth marketer', '市场经理', '增长营销'] },
    { family: 'sales', label: 'Sales Manager', patterns: ['sales manager', 'account executive', 'business development manager', '销售经理', '商务拓展'] },
    { family: 'support', label: 'Customer Success Manager', patterns: ['customer success manager', '客户成功经理'] },
    { family: 'support', label: 'Customer Support', patterns: ['customer support', 'customer service', '客户支持', '客服'] },
    { family: 'hr', label: 'Recruiter', patterns: ['technical recruiter', 'recruiter', 'talent acquisition', '招聘专员', '招聘经理'] },
    { family: 'finance', label: 'Financial Analyst', patterns: ['financial analyst', 'finance analyst', '财务分析师'] },
    { family: 'content', label: 'Content Manager', patterns: ['content manager', 'content strategist', 'copywriter', '内容运营', '内容策略', '文案'] },
];

const INDUSTRY_PATTERNS = {
    saas: ['saas', 'software as a service'],
    ecommerce: ['e-commerce', 'ecommerce', '电商', '电子商务'],
    fintech: ['fintech', '金融科技'],
    gaming: ['gaming', 'game industry', '游戏行业'],
    healthcare: ['healthcare', 'health tech', '医疗', '健康科技'],
    education: ['edtech', 'education technology', '教育科技', '教育行业'],
    ai: ['artificial intelligence', '人工智能', 'ai company'],
    crypto: ['web3', 'blockchain', 'crypto', '区块链'],
    advertising: ['advertising', 'adtech', '广告'],
};

function normalizeText(value = '') {
    return String(value)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text, term) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    if (/[\u3400-\u9fff]/.test(normalizedTerm)) return text.includes(normalizedTerm);
    const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(normalizedTerm)}(?=$|[^a-z0-9+#.])`, 'i');
    return pattern.test(text);
}

function unique(values = [], limit = 50) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

function findExplicitTargetRole(text) {
    const patterns = [
        /(?:target\s+(?:role|position)|desired\s+(?:role|position))\s*[:：-]\s*([^\n|]{2,80})/i,
        /(?:求职意向|目标岗位|期望职位|意向岗位)\s*[:：-]\s*([^\n|]{2,40})/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return '';
}

function extractRoles(normalizedText, rawText) {
    const explicitTarget = findExplicitTargetRole(rawText);
    const matches = [];
    for (const definition of ROLE_DEFINITIONS) {
        const hitCount = definition.patterns.reduce((count, pattern) => {
            return count + (containsTerm(normalizedText, pattern) ? 1 : 0);
        }, 0);
        if (hitCount > 0) matches.push({ ...definition, hitCount });
    }
    matches.sort((a, b) => b.hitCount - a.hitCount);

    const explicitDefinition = explicitTarget
        ? ROLE_DEFINITIONS.find(definition => definition.patterns.some(pattern => containsTerm(normalizeText(explicitTarget), pattern)))
        : null;
    const ordered = explicitDefinition
        ? [explicitDefinition, ...matches.filter(item => item.label !== explicitDefinition.label)]
        : matches;

    const roles = unique(ordered.map(item => item.label), 8);
    const roleFamilies = unique(ordered.map(item => item.family), 6);
    return {
        roles,
        roleFamilies,
        targetRole: explicitTarget || roles[0] || '',
        explicitTarget: Boolean(explicitTarget),
    };
}

function extractSkills(normalizedText) {
    const skills = [];
    for (const [canonical, aliases] of Object.entries(SKILL_GROUPS)) {
        if (aliases.some(alias => containsTerm(normalizedText, alias))) skills.push(canonical);
    }
    return unique(skills, 60);
}

function parseDateToken(yearValue, monthValue, currentDate) {
    const year = Number(yearValue);
    if (!Number.isInteger(year) || year < 1970 || year > currentDate.getFullYear() + 1) return null;
    const month = monthValue ? Math.max(1, Math.min(12, Number(monthValue))) : 1;
    return year * 12 + (month - 1);
}

function isolateExperienceSection(rawText) {
    const startMatch = rawText.match(/(?:^|\n)\s*(?:work experience|professional experience|employment history|工作经历|职业经历|实习经历)\s*[:：]?\s*(?:\n|$)/i);
    if (!startMatch || startMatch.index == null) return rawText;
    const sectionStart = startMatch.index + startMatch[0].length;
    const remaining = rawText.slice(sectionStart);
    const endMatch = remaining.match(/\n\s*(?:education|academic background|skills|projects|certifications|教育经历|教育背景|技能|项目经历|证书)\s*[:：]?\s*(?:\n|$)/i);
    const section = endMatch?.index != null ? remaining.slice(0, endMatch.index) : remaining;
    return section.trim().length >= 40 ? section : rawText;
}

function extractExperienceYears(rawText, currentDate = new Date()) {
    const experienceText = isolateExperienceSection(rawText);
    const ranges = [];
    const dateRangePattern = /(19\d{2}|20\d{2})(?:[/.年-]\s*(0?[1-9]|1[0-2])月?)?\s*(?:-|–|—|至|到|~)\s*(present|current|now|至今|目前|(19\d{2}|20\d{2})(?:[/.年-]\s*(0?[1-9]|1[0-2])月?)?)/gi;
    let match;
    while ((match = dateRangePattern.exec(experienceText)) !== null) {
        const start = parseDateToken(match[1], match[2], currentDate);
        const endIsCurrent = /present|current|now|至今|目前/i.test(match[3]);
        const end = endIsCurrent
            ? currentDate.getFullYear() * 12 + currentDate.getMonth()
            : parseDateToken(match[4], match[5], currentDate);
        if (start == null || end == null || end < start || end - start > 600) continue;
        ranges.push([start, end + 1]);
    }

    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (!last || range[0] > last[1]) merged.push([...range]);
        else last[1] = Math.max(last[1], range[1]);
    }
    const months = merged.reduce((sum, range) => sum + (range[1] - range[0]), 0);
    if (months > 0) return { years: Math.round((months / 12) * 10) / 10, source: 'timeline', ranges: merged.length };

    const explicitPatterns = [
        /(?:over|more than|at least)?\s*(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|work\s+)?experience/i,
        /(?:拥有|具备|超过|至少)?\s*(\d{1,2})\+?\s*年(?:以上)?(?:相关|工作|从业)?经验/i,
    ];
    for (const pattern of explicitPatterns) {
        const explicit = experienceText.match(pattern) || rawText.match(pattern);
        const years = Number(explicit?.[1]);
        if (Number.isFinite(years) && years >= 0 && years <= 40) return { years, source: 'statement', ranges: 0 };
    }
    return { years: 0, source: 'unknown', ranges: 0 };
}

function extractIndustries(normalizedText) {
    return Object.entries(INDUSTRY_PATTERNS)
        .filter(([, aliases]) => aliases.some(alias => containsTerm(normalizedText, alias)))
        .map(([industry]) => industry);
}

function extractLanguages(normalizedText) {
    const languages = [];
    if (['english', '英语', 'ielts', 'toefl', 'toeic'].some(term => containsTerm(normalizedText, term))) languages.push('English');
    if (['mandarin', 'chinese', '普通话', '中文'].some(term => containsTerm(normalizedText, term))) languages.push('Chinese');
    if (['spanish', '西班牙语'].some(term => containsTerm(normalizedText, term))) languages.push('Spanish');
    if (['french', '法语'].some(term => containsTerm(normalizedText, term))) languages.push('French');
    if (['german', '德语'].some(term => containsTerm(normalizedText, term))) languages.push('German');
    if (['japanese', '日语'].some(term => containsTerm(normalizedText, term))) languages.push('Japanese');
    return languages;
}

function resolveCareerLevel(years, rawText) {
    if (/\b(?:director|head of|vice president|vp)\b|总监|负责人/i.test(rawText)) return '专家';
    if (/\b(?:lead|principal|staff|senior)\b|高级|资深|专家/i.test(rawText) || years >= 6) return '高级';
    if (years >= 3) return '中级';
    return '初级';
}

export function extractStructuredResume(text, options = {}) {
    const rawText = String(text || '').replace(/\r\n?/g, '\n').trim();
    const normalizedText = normalizeText(rawText);
    const roles = extractRoles(normalizedText, rawText);
    const skills = extractSkills(normalizedText);
    const experience = extractExperienceYears(rawText, options.currentDate || new Date());
    const industries = extractIndustries(normalizedText);
    const languages = extractLanguages(normalizedText);
    const tools = skills.filter(skill => TOOL_SKILLS.has(skill));

    const fieldConfidence = {
        text: rawText.length >= 300 ? 1 : rawText.length >= 80 ? 0.6 : 0.2,
        roles: roles.explicitTarget ? 1 : roles.roles.length ? 0.72 : 0,
        skills: skills.length >= 5 ? 0.9 : skills.length >= 2 ? 0.65 : skills.length ? 0.4 : 0,
        experience: experience.source === 'timeline' ? 0.9 : experience.source === 'statement' ? 0.7 : 0,
        industries: industries.length ? 0.65 : 0,
        languages: languages.length ? 0.7 : 0,
    };
    const evidenceCoverage = Math.round((
        fieldConfidence.roles * 0.3 +
        fieldConfidence.skills * 0.3 +
        fieldConfidence.experience * 0.2 +
        fieldConfidence.industries * 0.08 +
        fieldConfidence.languages * 0.05 +
        fieldConfidence.text * 0.07
    ) * 100) / 100;

    return {
        parser_version: RESUME_PARSER_VERSION,
        parserVersion: RESUME_PARSER_VERSION,
        targetRole: roles.targetRole,
        target_role: roles.targetRole,
        roles: roles.roles,
        roleFamilies: roles.roleFamilies,
        role_families: roles.roleFamilies,
        skills,
        tools,
        industries,
        languages,
        experienceYears: experience.years,
        total_experience: experience.years,
        years_of_experience: experience.years,
        experience_source: experience.source,
        career_level: resolveCareerLevel(experience.years, rawText),
        field_confidence: fieldConfidence,
        evidence_coverage: evidenceCoverage,
        extraction_method: 'deterministic',
    };
}
