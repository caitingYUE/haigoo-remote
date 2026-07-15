/**
 * 人岗匹配引擎
 * 纯本地规则与统计特征匹配引擎，不依赖第三方 AI
 */

import { removeStopwords, eng, zho } from 'stopword';
import neonHelper from '../../server-utils/dal/neon-helper.js';
import {
    MATCH_ALGORITHM_VERSION,
    MATCH_CALIBRATION_VERSION,
    calibrateDisplayScore
} from './match-score-calibration.js';
import { extractStructuredResume } from './resume-structure-extractor.js';

// 表名常量
const MATCHES_TABLE = 'user_job_matches';
const JOBS_TABLE = 'jobs';
const USERS_TABLE = 'users';
const RESUMES_TABLE = 'resumes';

// Evidence-based v3 weights. Missing dimensions are excluded from the weighted
// mean and reflected separately through evidence coverage.
const DETAIL_WEIGHTS = {
    title: 0.18,
    roleType: 0.12,
    requiredSkill: 0.25,
    preferredSkill: 0.10,
    experience: 0.15,
    domain: 0.07,
    preference: 0.08,
    keyword: 0.05
};

// 缓存有效期(毫秒)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
export const MATCH_CACHE_TTL = CACHE_TTL;

const SKILL_ALIASES = {
    javascript: ['javascript', 'js', 'ecmascript'],
    typescript: ['typescript', 'ts'],
    nodejs: ['nodejs', 'node.js', 'node'],
    react: ['react', 'reactjs', 'react.js'],
    vue: ['vue', 'vuejs'],
    angular: ['angular', 'angularjs'],
    golang: ['golang', 'go'],
    csharp: ['c#', 'csharp', '.net', 'dotnet', 'asp.net'],
    cpp: ['c++', 'cpp'],
    aws: ['aws', 'amazon web services'],
    gcp: ['gcp', 'google cloud', 'google cloud platform'],
    kubernetes: ['kubernetes', 'k8s'],
    postgres: ['postgres', 'postgresql'],
    ml: ['machine learning', 'ml'],
    ai: ['artificial intelligence', 'ai']
};

const SKILL_ALIAS_LOOKUP = (() => {
    const map = new Map();
    Object.entries(SKILL_ALIASES).forEach(([canonical, aliases]) => {
        aliases.forEach(alias => {
            map.set(alias.replace(/[^a-z0-9+#.]/gi, '').toLowerCase(), canonical);
        });
    });
    return map;
})();

const ROLE_FAMILY_KEYWORDS = {
    frontend: ['frontend', 'front-end', '前端', 'web 前端', 'react', 'vue', 'javascript', 'typescript'],
    backend: ['backend', 'back-end', '后端', 'server', 'api', 'java', 'golang', 'python', 'node', 'php', 'ruby'],
    fullstack: ['fullstack', 'full-stack', 'full stack', '全栈'],
    mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', '移动开发'],
    product: ['product manager', 'product owner', 'pm', '产品经理', '产品'],
    design: ['designer', 'design', 'ux', 'ui', 'product design', 'visual design', '设计师', '设计'],
    data: ['data', 'analytics', 'analyst', 'bi', '数据分析', '数据科学', '商业分析', 'sql'],
    ai: ['ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'cv', '算法', '大模型', '人工智能'],
    qa: ['qa', 'test', 'testing', 'sdet', 'quality assurance', '测试'],
    devops: ['devops', 'sre', 'platform', 'infrastructure', 'cloud', '运维'],
    operations: ['operations', 'ops', '运营', 'community', 'growth ops'],
    marketing: ['marketing', 'growth', 'seo', 'content marketing', '市场', '品牌'],
    sales: ['sales', 'account executive', 'business development', 'bd', '销售'],
    support: ['support', 'customer success', 'customer service', '客服', '技术支持'],
    hr: ['hr', 'recruiter', 'talent acquisition', 'people', '招聘', '人力资源'],
    finance: ['finance', 'accounting', 'fp&a', 'controller', '财务'],
    content: ['content', 'copywriter', 'writer', 'editor', '内容', '文案']
};

const ROLE_FAMILY_ADJACENCY = {
    frontend: ['fullstack', 'design'],
    backend: ['fullstack', 'data', 'devops', 'ai'],
    fullstack: ['frontend', 'backend', 'devops'],
    mobile: ['frontend', 'fullstack', 'design'],
    product: ['design', 'operations', 'data'],
    design: ['product', 'frontend', 'content'],
    data: ['backend', 'ai', 'product'],
    ai: ['data', 'backend'],
    qa: ['frontend', 'backend', 'fullstack', 'devops'],
    devops: ['backend', 'fullstack', 'qa'],
    operations: ['product', 'marketing', 'support'],
    marketing: ['sales', 'content', 'operations'],
    sales: ['marketing', 'support'],
    support: ['sales', 'operations'],
    hr: ['operations'],
    finance: ['operations'],
    content: ['marketing', 'design']
};

function safeJsonParse(value, fallback) {
    if (value == null) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function toArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
        const parsed = safeJsonParse(input, null);
        if (Array.isArray(parsed)) return parsed;
        return input
            .split(/[,\n;|、，]/)
            .map(v => v.trim())
            .filter(Boolean);
    }
    return [];
}

function clampScore(value, min = 0, max = 100) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function uniqueStrings(values = [], maxItems = 16) {
    const seen = new Set();
    const result = [];

    for (const value of values.flatMap(item => Array.isArray(item) ? item : [item])) {
        if (typeof value !== 'string') continue;
        const text = value.trim();
        if (!text) continue;

        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(text);

        if (result.length >= maxItems) break;
    }

    return result;
}

function buildRoleTerms(values = []) {
    const rawValues = uniqueStrings(values, 12);
    const terms = new Set();

    rawValues.forEach(value => {
        const normalizedPhrase = normalizeText(value);
        if (normalizedPhrase.length >= 2) {
            terms.add(normalizedPhrase);
        }

        value
            .split(/[/,，、|()（）]/)
            .map(part => normalizeText(part))
            .filter(Boolean)
            .forEach(part => {
                if (part.length >= 2) terms.add(part);
            });

        extractKeywords(value).forEach(token => {
            if (token.length >= 2) terms.add(token);
        });
    });

    return [...terms].slice(0, 20);
}

function inferRoleFamilies(values = []) {
    const texts = uniqueStrings(values, 14).map(value => normalizeText(value));
    if (!texts.length) return [];

    const families = new Set();

    Object.entries(ROLE_FAMILY_KEYWORDS).forEach(([family, keywords]) => {
        const matched = keywords.some(keyword => {
            const normalizedKeyword = normalizeText(keyword);
            return texts.some(text => text.includes(normalizedKeyword));
        });

        if (matched) families.add(family);
    });

    return [...families];
}

function enrichRoleFamilies(families = [], terms = []) {
    const enriched = new Set([...(families || [])]);
    const termSet = new Set((terms || []).map(term => normalizeText(term)).filter(Boolean));

    if ((enriched.has('frontend') && enriched.has('backend')) ||
        (termSet.has('react') && (termSet.has('nodejs') || termSet.has('node') || termSet.has('java') || termSet.has('python') || termSet.has('golang')))) {
        enriched.add('fullstack');
    }

    if (enriched.has('product') && enriched.has('design')) {
        enriched.add('design');
    }

    return [...enriched];
}

function countOverlap(listA = [], listB = []) {
    if (!listA.length || !listB.length) return 0;
    const setB = new Set(listB);
    let count = 0;
    for (const item of listA) {
        if (setB.has(item)) count++;
    }
    return count;
}

function hasAdjacentRoleFamily(userFamilies = [], jobFamilies = []) {
    if (!userFamilies.length || !jobFamilies.length) return false;
    const jobSet = new Set(jobFamilies);

    return userFamilies.some(family =>
        (ROLE_FAMILY_ADJACENCY[family] || []).some(adjacent => jobSet.has(adjacent))
    );
}

function cosineSimilarity(tokensA = [], tokensB = []) {
    if (!tokensA.length || !tokensB.length) return 0;

    const tfA = new Map();
    const tfB = new Map();
    tokensA.forEach(token => tfA.set(token, (tfA.get(token) || 0) + 1));
    tokensB.forEach(token => tfB.set(token, (tfB.get(token) || 0) + 1));

    const buildVector = (tf) => {
        const vector = new Map();
        let norm = 0;
        tf.forEach((count, term) => {
            // Log-scaled term frequency is stable across job pairs. Corpus-level
            // relevance is handled by the database retrieval stage.
            const weight = 1 + Math.log(count);
            vector.set(term, weight);
            norm += weight * weight;
        });
        return { vector, norm: Math.sqrt(norm) };
    };

    const a = buildVector(tfA);
    const b = buildVector(tfB);
    if (!a.norm || !b.norm) return 0;

    const smaller = a.vector.size <= b.vector.size ? a.vector : b.vector;
    const larger = a.vector.size <= b.vector.size ? b.vector : a.vector;
    let dot = 0;

    smaller.forEach((weight, term) => {
        const other = larger.get(term);
        if (other) dot += weight * other;
    });

    return dot / (a.norm * b.norm);
}

/**
 * 标准化技能名称
 */
function normalizeSkill(skill) {
    if (!skill) return '';
    const normalized = String(skill)
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5+#.]/g, '')
        .trim();
    return SKILL_ALIAS_LOOKUP.get(normalized) || normalized;
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5+#.\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeText(text) {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    const tokens = [];
    for (const part of normalized.split(/\s+/)) {
        if (!part) continue;
        if (/^[\u3400-\u9fff]+$/.test(part)) {
            if (part.length <= 4) tokens.push(part);
            for (let index = 0; index < part.length - 1; index += 1) {
                tokens.push(part.slice(index, index + 2));
            }
            continue;
        }
        tokens.push(part);
    }
    return removeStopwords(tokens, [...eng, ...zho])
        .filter(word => word.length > 1 || ['c#', 'c++', 'go', 'ai', 'ml'].includes(word));
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text) {
    if (!text) return [];
    return [...new Set(tokenizeText(text))];
}

function extractExperienceYearsFromText(text) {
    if (!text) return 0;
    const expMatches = [...String(text).matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?|年)/gi)];
    if (!expMatches.length) return 0;
    const years = expMatches.map(m => Number(m[1])).filter(n => Number.isFinite(n));
    return years.length ? Math.max(...years) : 0;
}

/**
 * 计算两个技能列表的匹配度
 * @returns {number} 0-100
 */
function calculateSkillMatch(userSkills, jobSkills) {
    const normalizedUser = [...new Set(toArray(userSkills).map(normalizeSkill).filter(Boolean))];
    const normalizedJob = [...new Set(toArray(jobSkills).map(normalizeSkill).filter(Boolean))];

    if (!normalizedJob.length || !normalizedUser.length) return null;

    const userSet = new Set(normalizedUser);
    const matchedCount = normalizedJob.filter(s => userSet.has(s)).length;
    // Candidate extras are not a negative signal. Score from the job's needs.
    return clampScore((matchedCount / normalizedJob.length) * 100);
}

/**
 * 文本相似度（TF-IDF 余弦 + 适度关键词交集 + 标题命中）
 * @returns {number} 0-100
 */
function calculateTextSimilarity(text1, text2, titleText = '', prioritizedTerms = []) {
    if (!text1 || !text2) return null;

    const keywords1 = tokenizeText(text1).slice(0, 320);
    const keywords2 = tokenizeText(text2).slice(0, 420);
    if (!keywords1.length || !keywords2.length) return null;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    let intersection = 0;
    for (const token of set1) {
        if (set2.has(token)) intersection++;
    }
    const overlap = set1.size > 0 ? intersection / set1.size : 0;
    const cosine = cosineSimilarity(keywords1, keywords2);

    const title = normalizeText(titleText);
    const priority = buildRoleTerms(prioritizedTerms).map(normalizeSkill).filter(Boolean);
    const titleHits = priority.filter(token => token && title.includes(token)).length;
    const titleBonus = priority.length ? Math.min(1, titleHits / Math.max(1, priority.length)) : 0;

    const rawScore = cosine * 0.55 + overlap * 0.30 + titleBonus * 0.15;
    return clampScore(rawScore * 100);
}

function calculateTitleMatch(userProfile, jobFeatures) {
    const userSignals = toArray(userProfile.roleSignals);
    const jobSignals = uniqueStrings([jobFeatures.title, jobFeatures.category], 6);
    if (!userSignals.length || !jobSignals.length) return null;

    const normalizedUserSignals = userSignals.map(normalizeText).filter(Boolean);
    const normalizedJobSignals = jobSignals.map(normalizeText).filter(Boolean);

    const exactPhraseMatch = normalizedUserSignals.some(userSignal =>
        userSignal.length >= 3 && normalizedJobSignals.some(jobSignal =>
            jobSignal.includes(userSignal) || userSignal.includes(jobSignal)
        )
    );
    if (exactPhraseMatch) return 100;

    const userTerms = toArray(userProfile.roleTerms);
    const jobTerms = toArray(jobFeatures.roleTerms);
    const sharedTerms = countOverlap(userTerms, jobTerms);
    const sharedFamilies = countOverlap(toArray(userProfile.roleFamilies), toArray(jobFeatures.roleFamilies));
    const adjacentFamilies = hasAdjacentRoleFamily(
        toArray(userProfile.roleFamilies),
        toArray(jobFeatures.roleFamilies)
    );

    if (sharedFamilies > 0) {
        if (sharedTerms >= 2) return 90;
        if (sharedTerms === 1) return 82;
        return 65;
    }
    if (adjacentFamilies) return sharedTerms > 0 ? 58 : 42;
    if (sharedTerms >= 2) return 68;
    if (sharedTerms === 1) return 45;
    return 8;
}

function calculateRoleTypeMatch(userProfile, jobFeatures) {
    const userFamilies = toArray(userProfile.roleFamilies);
    const jobFamilies = toArray(jobFeatures.roleFamilies);
    const userTerms = toArray(userProfile.roleTerms);
    const jobTerms = toArray(jobFeatures.roleTerms);

    if ((!userFamilies.length && !userTerms.length) || (!jobFamilies.length && !jobTerms.length)) return null;

    const familyOverlap = countOverlap(userFamilies, jobFamilies);
    if (familyOverlap > 0) {
        const sharedTerms = countOverlap(userTerms, jobTerms);
        return sharedTerms >= 2 ? 92 : sharedTerms === 1 ? 86 : 78;
    }

    if (hasAdjacentRoleFamily(userFamilies, jobFamilies)) {
        if ((userFamilies.includes('fullstack') && (jobFamilies.includes('frontend') || jobFamilies.includes('backend'))) ||
            (jobFamilies.includes('fullstack') && (userFamilies.includes('frontend') || userFamilies.includes('backend')))) {
            return 72;
        }
        return 52;
    }

    const sharedTerms = countOverlap(userTerms, jobTerms);
    if (sharedTerms >= 2) return 70;
    if (sharedTerms === 1) return 42;
    return 5;
}

/**
 * 计算经验匹配度
 * @returns {number} 0-100
 */
function calculateExperienceMatch(userExp, jobLevel, requiredYears = 0) {
    const expMapping = {
        entry: { min: 0, max: 2 },
        junior: { min: 0, max: 2 },
        intern: { min: 0, max: 1 },
        mid: { min: 2, max: 5 },
        senior: { min: 5, max: 10 },
        lead: { min: 5, max: 15 },
        executive: { min: 10, max: 30 }
    };

    const normalizedLevel = String(jobLevel || '').toLowerCase();
    const explicitRequiredYears = Number(requiredYears) || 0;
    const levelRange = explicitRequiredYears > 0
        ? { min: explicitRequiredYears, max: explicitRequiredYears + 8 }
        : expMapping[normalizedLevel];
    const normalizedUserExp = Number(userExp);

    if (!levelRange || !Number.isFinite(normalizedUserExp) || normalizedUserExp < 0) return null;

    if (normalizedUserExp >= levelRange.min && normalizedUserExp <= levelRange.max) {
        return 100;
    } else if (normalizedUserExp < levelRange.min) {
        const gap = levelRange.min - normalizedUserExp;
        return clampScore(Math.max(10, Math.round(100 - gap * 22)));
    } else {
        const gap = normalizedUserExp - levelRange.max;
        return clampScore(Math.max(52, Math.round(100 - gap * 4)));
    }
}

/**
 * 计算偏好匹配度
 * @returns {number} 0-100
 */
function calculatePreferenceMatch(preferences, job) {
    if (!preferences) return null;

    let score = 0;
    let factors = 0;

    // 工作类型匹配
    if (preferences.jobTypes?.length) {
        factors++;
        const jobType = job.job_type || job.jobType || '';
        if (!jobType) {
            factors--;
        } else if (preferences.jobTypes.includes(jobType)) {
            score += 100;
        } else if (jobType === 'contract' || jobType === 'freelance') {
            score += 45;
        }
    }

    const preferredTimezones = toArray(preferences.timezones || preferences.timezone);
    const jobTimezone = String(job.timezone || '').trim();
    if (preferredTimezones.length && jobTimezone) {
        factors++;
        const normalizedTimezone = jobTimezone.toLowerCase();
        score += preferredTimezones.some(zone => normalizedTimezone.includes(String(zone).toLowerCase())) ? 100 : 35;
    }

    return factors > 0 ? clampScore(score / factors) : null;
}

function calculateDomainMatch(preferences, userIndustries, job) {
    const desiredIndustries = uniqueStrings([
        ...toArray(preferences?.industries),
        ...toArray(userIndustries)
    ], 12);
    const jobIndustry = normalizeText(`${job.industry || ''} ${job.category || ''}`);
    if (!desiredIndustries.length || !jobIndustry) return null;
    return desiredIndustries.some(industry => jobIndustry.includes(normalizeText(industry))) ? 100 : 20;
}

/**
 * 获取用户画像数据
 */
async function getUserProfile(userId) {
    try {
        const userResult = await neonHelper.select(USERS_TABLE, { user_id: userId });
        const user = userResult?.[0];

        if (!user) return null;

        const profile = safeJsonParse(user.profile, {}) || {};
        const preferences = profile.jobPreferences || profile.preferences || {};

        const resumeRows = await neonHelper.query(
            `SELECT parse_result, content_text, created_at
             FROM ${RESUMES_TABLE}
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );
        const resume = resumeRows?.[0];

        let skills = [];
        let experienceYears = 0;
        let resumeText = '';
        let parsedResume = {};
        let structuredResume = {};

        if (resume) {
            const parsed = safeJsonParse(resume.parse_result, {}) || {};
            parsedResume = parsed;
            skills = toArray(parsed.skills);
            experienceYears = Number(parsed.total_experience || parsed.experienceYears || 0) || 0;
            resumeText = parsed.content || parsed.text || resume.content_text || '';
            structuredResume = resumeText ? extractStructuredResume(resumeText) : {};
            if (!skills.length) skills = toArray(structuredResume.skills);
            if (!experienceYears) experienceYears = Number(structuredResume.experienceYears) || 0;
        }

        const profileSkills = toArray(profile.skills);
        if (profileSkills.length) {
            skills = [...new Set([...skills, ...profileSkills])];
        }

        if (!experienceYears && !structuredResume.experienceYears) {
            experienceYears = extractExperienceYearsFromText(resumeText);
        }

        const normalizedSkills = [...new Set(skills.map(normalizeSkill).filter(Boolean))];
        const roleSignals = uniqueStrings([
            profile.targetRole,
            profile.title,
            parsedResume.targetRole,
            parsedResume.target_role,
            parsedResume.title,
            ...toArray(parsedResume.roles),
            structuredResume.targetRole,
            ...toArray(structuredResume.roles),
            ...(Array.isArray(preferences.categories) ? preferences.categories : []),
            ...(Array.isArray(preferences.roles) ? preferences.roles : [])
        ], 16);
        const roleTerms = buildRoleTerms(roleSignals);
        const roleFamilies = enrichRoleFamilies(
            inferRoleFamilies([
                ...roleSignals,
                ...toArray(preferences.categories),
                ...toArray(preferences.roles),
                ...toArray(parsedResume.roleFamilies || parsedResume.role_families),
                ...toArray(structuredResume.roleFamilies)
            ]),
            roleTerms
        );

        const parsedCoverage = Number(parsedResume.evidence_coverage ?? parsedResume.evidenceCoverage);
        const deterministicCoverage = Number(structuredResume.evidence_coverage);
        const evidenceCoverage = Math.max(
            Number.isFinite(parsedCoverage) ? parsedCoverage : 0,
            Number.isFinite(deterministicCoverage) ? deterministicCoverage : 0,
            roleSignals.length && normalizedSkills.length ? 0.55 : 0
        );

        return {
            userId,
            skills: normalizedSkills,
            experienceYears,
            resumeText,
            preferences,
            hasResume: !!resume,
            profile,
            roleSignals,
            roleTerms,
            roleFamilies,
            industries: uniqueStrings([
                ...toArray(parsedResume.industries),
                ...toArray(structuredResume.industries),
                ...toArray(profile.industries)
            ], 12),
            languages: uniqueStrings([
                ...toArray(parsedResume.languages),
                ...toArray(structuredResume.languages),
                ...toArray(profile.languages)
            ], 12),
            eligibleLocations: uniqueStrings([
                ...toArray(preferences.eligibleLocations),
                ...toArray(preferences.locations),
                profile.location,
                user.location
            ], 12),
            evidenceCoverage: Math.max(0, Math.min(1, evidenceCoverage)),
            profileVersion: parsedResume.parser_version || parsedResume.parserVersion || structuredResume.parser_version || 'legacy-profile'
        };
    } catch (error) {
        console.error('[matching-engine] 获取用户画像失败:', error.message);
        return null;
    }
}

/**
 * 获取岗位特征数据
 */
async function getJobFeatures(jobId) {
    try {
        const result = await neonHelper.select(JOBS_TABLE, { job_id: jobId });
        const job = result?.[0];

        if (!job) return null;

        return buildJobFeaturesFromRow(job);
    } catch (error) {
        console.error('[matching-engine] 获取岗位特征失败:', error.message);
        return null;
    }
}

function buildJobFeaturesFromRow(jobRow) {
    const tags = toArray(jobRow?.tags);
    const requirements = toArray(jobRow?.requirements).filter(item => typeof item === 'string');
    const declaredSkills = toArray(jobRow?.skills);
    const requiredText = requirements.join(' ');
    const requiredStructured = extractStructuredResume(requiredText);
    const preferredSkills = [...tags, ...declaredSkills]
        .map(normalizeSkill)
        .filter(Boolean)
        .slice(0, 50);
    const requiredSkills = toArray(requiredStructured.skills).map(normalizeSkill).filter(Boolean).slice(0, 40);
    const skills = [...new Set([...requiredSkills, ...preferredSkills])];

    const title = jobRow?.title || '';
    const description = jobRow?.description || '';
    const category = jobRow?.category || '';
    const industry = jobRow?.industry || '';
    const jobText = `${title} ${category} ${industry} ${description}`;
    const structuredJob = extractStructuredResume(`${title}\n${category}\n${description}`);
    const roleSignals = uniqueStrings([title, category, ...toArray(structuredJob.roles)], 14);
    const roleTerms = buildRoleTerms(roleSignals);
    const roleFamilies = enrichRoleFamilies([
        ...inferRoleFamilies(roleSignals),
        ...toArray(structuredJob.roleFamilies)
    ], roleTerms);
    const location = jobRow?.location || jobRow?.region || '';
    const normalizedLocation = normalizeText(location);
    const globalRemoteTerms = ['remote', 'worldwide', 'anywhere', 'global', '全球', '不限地区', '全球远程'];
    const hasExplicitRemoteRestriction = /\bonly\b|must be based|based in|within\s+[a-z]|仅限|限于|地区限制/i.test(normalizedLocation);
    const hasGlobalRemoteSignal = globalRemoteTerms.some(term => normalizedLocation.includes(term));
    const looksLikeTimezoneOnly = /\b(?:utc|gmt|est|edt|cst|cdt|mst|mdt|pst|pdt)\b|time\s*zone|时区/i.test(normalizedLocation);
    const remainingLocation = globalRemoteTerms
        .reduce((value, term) => value.replaceAll(term, ' '), normalizedLocation)
        .replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
        .trim();
    const remoteScope = !normalizedLocation
        ? 'unknown'
        : looksLikeTimezoneOnly
            ? 'unknown'
        : hasGlobalRemoteSignal && !hasExplicitRemoteRestriction && !remainingLocation
            ? 'global'
            : 'restricted';

    return {
        jobId: jobRow?.job_id || jobRow?.jobId,
        title,
        skills,
        requiredSkills,
        preferredSkills,
        jobText,
        experienceLevel: jobRow?.experience_level || jobRow?.experienceLevel || '',
        requiredExperienceYears: Number(requiredStructured.experienceYears) || 0,
        isRemote: true,
        remoteScope,
        location,
        timezone: jobRow?.timezone || '',
        category,
        industry,
        jobType: jobRow?.job_type || jobRow?.jobType || '',
        canRefer: Boolean(jobRow?.can_refer ?? jobRow?.canRefer),
        isTrusted: Boolean(jobRow?.is_trusted ?? jobRow?.isTrusted),
        sourceType: jobRow?.source_type || jobRow?.sourceType || 'rss',
        roleSignals,
        roleTerms,
        roleFamilies,
        featureCoverage: {
            role: Boolean(title || category),
            requiredSkill: requiredSkills.length > 0,
            preferredSkill: preferredSkills.length > 0,
            experience: Boolean(jobRow?.experience_level || jobRow?.experienceLevel || requiredStructured.experienceYears),
            domain: Boolean(industry || category),
            preference: Boolean(jobRow?.job_type || jobRow?.jobType || jobRow?.timezone),
            keyword: Boolean(description)
        }
    };
}

const REGION_GROUPS = [
    ['northamerica', 'north america', 'us', 'usa', 'united states', 'canada', '美国', '加拿大', '北美'],
    ['europe', 'eu', 'eea', 'emea', 'united kingdom', 'uk', 'germany', 'france', 'spain', '欧洲', '欧盟', '英国', '德国', '法国'],
    ['asia', 'apac', 'china', 'japan', 'singapore', 'india', '亚洲', '亚太', '中国', '日本', '新加坡', '印度'],
    ['latinamerica', 'latin america', 'latam', 'south america', '拉美', '南美'],
    ['oceania', 'australia', 'new zealand', '大洋洲', '澳大利亚', '新西兰'],
];

function regionKeys(value) {
    const normalized = normalizeText(value).replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
    if (!normalized || ['anywhere', 'worldwide', 'global', 'remote', '不限地区', '全球'].includes(normalized)) return [];
    const keys = new Set([normalized]);
    REGION_GROUPS.forEach((aliases, index) => {
        if (aliases.some(alias => normalized.includes(normalizeText(alias).replace(/\s+/g, '')))) {
            keys.add(`region-${index}`);
        }
    });
    return [...keys];
}

function matchesRemoteRegion(userLocations = [], jobLocation = '') {
    const userKeys = new Set(toArray(userLocations).flatMap(regionKeys));
    const jobKeys = new Set(regionKeys(jobLocation));
    if (!userKeys.size || !jobKeys.size) return null;
    return [...jobKeys].some(key => userKeys.has(key)) || [...userKeys].some(userKey =>
        [...jobKeys].some(jobKey => userKey.includes(jobKey) || jobKey.includes(userKey))
    );
}

function applyHardConstraintCaps(userProfile, jobFeatures, score, scoreParts = {}) {
    let cappedScore = score;
    const skillScore = Number(scoreParts.skillScore) || 0;
    const titleScore = Number(scoreParts.titleScore) || 0;
    const roleTypeScore = Number(scoreParts.roleTypeScore) || 0;
    const hasStrongRoleAlignment = roleTypeScore >= 90 || (titleScore >= 85 && roleTypeScore >= 82);
    const constraintFlags = {
        remoteOnlyMismatch: false,
        strictLocationMismatch: false,
        remoteRegionMismatch: false,
        timezoneMismatch: false,
        severeRoleMismatch: false,
        severeSkillMismatch: false,
        strongRoleAlignment: hasStrongRoleAlignment
    };

    const pref = userProfile?.preferences || {};
    if (jobFeatures.remoteScope === 'restricted') {
        const regionMatch = matchesRemoteRegion(userProfile?.eligibleLocations, jobFeatures.location);
        if (regionMatch === false) {
            cappedScore = Math.min(cappedScore, 54);
            constraintFlags.remoteRegionMismatch = true;
        }
    }

    if (pref.strictTimezone === true && jobFeatures.timezone && toArray(pref.timezones || pref.timezone).length) {
        const timezone = normalizeText(jobFeatures.timezone);
        const matchesTimezone = toArray(pref.timezones || pref.timezone)
            .some(value => timezone.includes(normalizeText(value)));
        if (!matchesTimezone) {
            cappedScore = Math.min(cappedScore, 54);
            constraintFlags.timezoneMismatch = true;
        }
    }

    if (userProfile.roleSignals?.length && titleScore < 35 && roleTypeScore < 40) {
        cappedScore = Math.min(cappedScore, 57);
        constraintFlags.severeRoleMismatch = true;
    }

    if (userProfile.skills?.length && jobFeatures.requiredSkills?.length >= 2 && skillScore < 20) {
        cappedScore = Math.min(cappedScore, 57);
        constraintFlags.severeSkillMismatch = true;
    }

    return {
        trueScore: clampScore(cappedScore, 0, 100),
        constraintFlags
    };
}

/**
 * 计算综合匹配分数
 */
function calculateMatchScore(userProfile, jobFeatures) {
    const titleScore = calculateTitleMatch(userProfile, jobFeatures);
    const roleTypeScore = calculateRoleTypeMatch(userProfile, jobFeatures);
    const requiredSkillScore = calculateSkillMatch(
        userProfile.skills,
        jobFeatures.requiredSkills
    );
    const preferredSkillScore = calculateSkillMatch(
        userProfile.skills,
        jobFeatures.preferredSkills
    );

    const keywordScore = calculateTextSimilarity(
        userProfile.resumeText,
        jobFeatures.jobText,
        jobFeatures.title,
        [...toArray(userProfile.roleSignals), ...toArray(userProfile.skills).slice(0, 6)]
    );

    const expScore = calculateExperienceMatch(
        userProfile.experienceYears,
        jobFeatures.experienceLevel,
        jobFeatures.requiredExperienceYears
    );

    const prefScore = calculatePreferenceMatch(
        userProfile.preferences,
        jobFeatures
    );
    const domainScore = calculateDomainMatch(userProfile.preferences, userProfile.industries, jobFeatures);

    const dimensions = [
        ['title', titleScore],
        ['roleType', roleTypeScore],
        ['requiredSkill', requiredSkillScore],
        ['preferredSkill', preferredSkillScore],
        ['experience', expScore],
        ['domain', domainScore],
        ['preference', prefScore],
        ['keyword', keywordScore],
    ];
    let weightedScore = 0;
    let availableWeight = 0;
    for (const [name, value] of dimensions) {
        if (value == null || !Number.isFinite(Number(value))) continue;
        const weight = DETAIL_WEIGHTS[name];
        weightedScore += Number(value) * weight;
        availableWeight += weight;
    }
    const evidenceScore = availableWeight > 0 ? weightedScore / availableWeight : 0;
    const dimensionCoverage = Math.max(0, Math.min(1, availableWeight));
    const inferredProfileCoverage = userProfile.roleSignals?.length && userProfile.skills?.length ? 0.65 : 0.35;
    const profileCoverage = Math.max(0, Math.min(1,
        Number.isFinite(Number(userProfile.evidenceCoverage))
            ? Number(userProfile.evidenceCoverage)
            : inferredProfileCoverage
    ));
    const evidenceCoverage = Math.round((dimensionCoverage * (0.7 + 0.3 * profileCoverage)) * 100) / 100;
    const trueScore = evidenceScore * (0.70 + 0.30 * evidenceCoverage);

    const constrained = applyHardConstraintCaps(
        userProfile,
        jobFeatures,
        trueScore,
        { skillScore: requiredSkillScore ?? preferredSkillScore ?? 0, titleScore, roleTypeScore }
    );

    return {
        totalScore: constrained.trueScore,
        trueScore: constrained.trueScore,
        constraintFlags: constrained.constraintFlags,
        algorithmVersion: MATCH_ALGORITHM_VERSION,
        breakdown: {
            titleMatch: titleScore,
            roleTypeMatch: roleTypeScore,
            skillMatch: requiredSkillScore ?? preferredSkillScore,
            requiredSkillMatch: requiredSkillScore,
            preferredSkillMatch: preferredSkillScore,
            keywordSimilarity: keywordScore,
            experienceMatch: expScore,
            preferenceMatch: prefScore,
            domainMatch: domainScore,
            evidenceScore: clampScore(evidenceScore),
            evidenceCoverage,
            availableWeight: Math.round(availableWeight * 100) / 100,
            rawDetailScore: clampScore(evidenceScore)
        }
    };
}

export function isMatchCacheFresh(calculatedAt, ttlMs = CACHE_TTL) {
    if (!calculatedAt) return false;
    const ts = new Date(calculatedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < ttlMs;
}

export async function getUserProfileForMatching(userId) {
    return getUserProfile(userId);
}

export function buildMatchingProfile(input = {}) {
    const roleSignals = uniqueStrings([
        input.targetRole,
        ...toArray(input.roles),
        ...toArray(input.roleSignals)
    ], 16);
    const roleTerms = buildRoleTerms(roleSignals);
    const roleFamilies = enrichRoleFamilies([
        ...toArray(input.roleFamilies),
        ...inferRoleFamilies(roleSignals)
    ], roleTerms);
    const skills = [...new Set([
        ...toArray(input.skills),
        ...toArray(input.tools)
    ].map(normalizeSkill).filter(Boolean))];
    const evidenceCoverage = Number.isFinite(Number(input.evidenceCoverage))
        ? Number(input.evidenceCoverage)
        : roleSignals.length && skills.length ? 0.7 : roleSignals.length ? 0.6 : 0.3;

    return {
        userId: input.userId,
        skills,
        experienceYears: Number(input.experienceYears || input.years_of_experience) || 0,
        resumeText: String(input.resumeText || ''),
        preferences: input.preferences || {},
        hasResume: Boolean(input.hasResume || input.resumeText),
        profile: input.profile || {},
        roleSignals,
        roleTerms,
        roleFamilies,
        industries: uniqueStrings(toArray(input.industries), 12),
        languages: uniqueStrings(toArray(input.languages), 12),
        eligibleLocations: uniqueStrings(toArray(input.eligibleLocations), 12),
        evidenceCoverage: Math.max(0, Math.min(1, evidenceCoverage)),
        profileVersion: input.profileVersion || 'ad-hoc-v1'
    };
}

export function scoreJobForUserProfile(userProfile, jobRowOrFeatures) {
    if (!userProfile || !jobRowOrFeatures) {
        return { totalScore: 0, trueScore: 0, breakdown: {}, constraintFlags: {} };
    }
    const features = jobRowOrFeatures.jobText
        ? jobRowOrFeatures
        : buildJobFeaturesFromRow(jobRowOrFeatures);
    return calculateMatchScore(userProfile, features);
}

/**
 * 从缓存获取匹配结果
 */
async function getCachedMatch(userId, jobId) {
    try {
        const result = await neonHelper.select(MATCHES_TABLE, {
            user_id: userId,
            job_id: jobId
        });

        if (result?.[0]) {
            const cached = result[0];
            const cachedAt = new Date(cached.calculated_at).getTime();
            const breakdown = safeJsonParse(cached.score_breakdown || cached.match_details, {}) || {};
            const hasCurrentVersion = cached.algorithm_version === MATCH_ALGORITHM_VERSION &&
                cached.calibration_version === MATCH_CALIBRATION_VERSION;

            // 检查是否过期
            if (hasCurrentVersion && Date.now() - cachedAt < CACHE_TTL) {
                const trueScore = Number(cached.true_match_score ?? cached.match_score) || 0;
                const calibrated = calibrateDisplayScore({
                    trueScore,
                    constraintFlags: cached.constraint_flags || {},
                    evidenceCoverage: breakdown.evidenceCoverage
                });
                return {
                    matchScore: calibrated.displayScore,
                    trueMatchScore: trueScore,
                    displayMatchScore: calibrated.displayScore,
                    displayBand: calibrated.displayBand,
                    breakdown,
                    constraintFlags: calibrated.constraintFlags,
                    fromCache: true
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[matching-engine] 读取缓存失败:', error.message);
        return null;
    }
}

/**
 * 保存匹配结果到缓存
 */
async function saveMatchCache(userId, jobId, matchResult) {
    try {
        const calibrated = calibrateDisplayScore({
            trueScore: matchResult.trueScore ?? matchResult.totalScore,
            constraintFlags: matchResult.constraintFlags || {},
            evidenceCoverage: matchResult.breakdown?.evidenceCoverage
        });
        const data = {
            user_id: userId,
            job_id: jobId,
            match_score: matchResult.trueScore ?? matchResult.totalScore,
            true_match_score: matchResult.trueScore ?? matchResult.totalScore,
            display_match_score: calibrated.displayScore,
            display_band: calibrated.displayBand,
            match_details: matchResult.breakdown,
            score_breakdown: matchResult.breakdown,
            constraint_flags: matchResult.constraintFlags || {},
            algorithm_version: MATCH_ALGORITHM_VERSION,
            calibration_version: MATCH_CALIBRATION_VERSION,
            calculated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_TTL).toISOString()
        };

        // Upsert (插入或更新)
        const existing = await neonHelper.select(MATCHES_TABLE, {
            user_id: userId,
            job_id: jobId
        });

        if (existing?.length) {
            await neonHelper.update(MATCHES_TABLE, data, {
                user_id: userId,
                job_id: jobId
            });
        } else {
            await neonHelper.insert(MATCHES_TABLE, data);
        }
    } catch (error) {
        if (error?.message?.includes('true_match_score') ||
            error?.message?.includes('display_match_score') ||
            error?.message?.includes('display_band') ||
            error?.message?.includes('score_breakdown') ||
            error?.message?.includes('constraint_flags') ||
            error?.message?.includes('algorithm_version') ||
            error?.message?.includes('calibration_version')) {
            try {
                const legacyData = {
                    user_id: userId,
                    job_id: jobId,
                    match_score: matchResult.trueScore ?? matchResult.totalScore,
                    match_details: matchResult.breakdown,
                    calculated_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + CACHE_TTL).toISOString()
                };

                const existing = await neonHelper.select(MATCHES_TABLE, {
                    user_id: userId,
                    job_id: jobId
                });

                if (existing?.length) {
                    await neonHelper.update(MATCHES_TABLE, legacyData, {
                        user_id: userId,
                        job_id: jobId
                    });
                } else {
                    await neonHelper.insert(MATCHES_TABLE, legacyData);
                }
                return;
            } catch (legacyError) {
                console.error('[matching-engine] 保存缓存降级失败:', legacyError.message);
            }
        }
        console.error('[matching-engine] 保存缓存失败:', error.message);
    }
}

async function saveMatchCachesBulk(userId, rows = []) {
    if (!userId || !rows.length) return;
    const values = [];
    const placeholders = [];
    let index = 1;

    rows.forEach(({ jobId, result }) => {
        const calibrated = calibrateDisplayScore({
            trueScore: result.trueScore,
            constraintFlags: result.constraintFlags,
            evidenceCoverage: result.breakdown?.evidenceCoverage
        });
        placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11})`);
        values.push(
            userId,
            jobId,
            result.trueScore,
            result.trueScore,
            calibrated.displayScore,
            calibrated.displayBand,
            JSON.stringify(result.breakdown || {}),
            JSON.stringify(result.breakdown || {}),
            JSON.stringify(result.constraintFlags || {}),
            MATCH_ALGORITHM_VERSION,
            MATCH_CALIBRATION_VERSION,
            new Date().toISOString()
        );
        index += 12;
    });

    try {
        await neonHelper.query(
            `INSERT INTO ${MATCHES_TABLE} (
                user_id, job_id, match_score, true_match_score, display_match_score, display_band,
                match_details, score_breakdown, constraint_flags, algorithm_version, calibration_version, calculated_at
             ) VALUES ${placeholders.join(', ')}
             ON CONFLICT (user_id, job_id) DO UPDATE SET
                match_score = EXCLUDED.match_score,
                true_match_score = EXCLUDED.true_match_score,
                display_match_score = EXCLUDED.display_match_score,
                display_band = EXCLUDED.display_band,
                match_details = EXCLUDED.match_details,
                score_breakdown = EXCLUDED.score_breakdown,
                constraint_flags = EXCLUDED.constraint_flags,
                algorithm_version = EXCLUDED.algorithm_version,
                calibration_version = EXCLUDED.calibration_version,
                calculated_at = EXCLUDED.calculated_at`,
            values
        );
    } catch (error) {
        console.warn('[matching-engine] 批量缓存写入失败，降级为兼容写入:', error.message);
        await Promise.all(rows.map(({ jobId, result }) => saveMatchCache(userId, jobId, result)));
    }
}

/**
 * 计算单个用户和岗位的匹配度
 */
export async function calculateMatch(userId, jobId) {
    try {
        // 1. 先查缓存
        const cached = await getCachedMatch(userId, jobId);
        if (cached) {
            return cached;
        }

        // 2. 获取用户画像
        const userProfile = await getUserProfile(userId);
        if (!userProfile) {
            return { matchScore: 0, breakdown: {}, error: '用户不存在' };
        }

        // 3. 获取岗位特征
        const jobFeatures = await getJobFeatures(jobId);
        if (!jobFeatures) {
            return { matchScore: 0, breakdown: {}, error: '岗位不存在' };
        }

        // 4. 计算匹配分数
        const matchResult = calculateMatchScore(userProfile, jobFeatures);

        // 5. 保存到缓存
        await saveMatchCache(userId, jobId, matchResult);

        return {
            matchScore: calibrateDisplayScore({
                trueScore: matchResult.trueScore,
                constraintFlags: matchResult.constraintFlags,
                evidenceCoverage: matchResult.breakdown?.evidenceCoverage
            }).displayScore,
            trueMatchScore: matchResult.trueScore,
            breakdown: matchResult.breakdown,
            constraintFlags: matchResult.constraintFlags,
            hasResume: userProfile.hasResume,
            fromCache: false
        };
    } catch (error) {
        console.error('[matching-engine] 计算匹配度失败:', error.message);
        return { matchScore: 0, breakdown: {}, error: error.message };
    }
}

/**
 * 批量计算匹配度
 */
export async function batchCalculateMatches(userId, jobIds) {
    const ids = [...new Set(toArray(jobIds).map(value => String(value)).filter(Boolean))];
    if (!ids.length) return [];

    const userProfile = await getUserProfile(userId);
    if (!userProfile) return ids.map(jobId => ({ jobId, matchScore: 0, error: '用户不存在' }));

    const jobs = await neonHelper.query(
        `SELECT * FROM ${JOBS_TABLE} WHERE job_id = ANY($1)`,
        [ids]
    ) || [];
    const jobsById = new Map(jobs.map(job => [String(job.job_id), job]));
    const calculatedRows = [];
    const response = ids.map(jobId => {
        const job = jobsById.get(jobId);
        if (!job) return { jobId, matchScore: 0, error: '岗位不存在' };
        const result = calculateMatchScore(userProfile, buildJobFeaturesFromRow(job));
        const calibrated = calibrateDisplayScore({
            trueScore: result.trueScore,
            constraintFlags: result.constraintFlags,
            evidenceCoverage: result.breakdown?.evidenceCoverage
        });
        calculatedRows.push({ jobId, result });
        return {
            jobId,
            matchScore: calibrated.displayScore,
            trueMatchScore: result.trueScore,
            displayMatchScore: calibrated.displayScore,
            displayBand: calibrated.displayBand,
            breakdown: result.breakdown,
            constraintFlags: result.constraintFlags,
            fromCache: false
        };
    });

    await saveMatchCachesBulk(userId, calculatedRows);
    return response;
}

/**
 * 获取用户的个性化推荐列表
 * 实现降级策略: 简历匹配 → 偏好 → 搜索 → 内推 → 人工精选 → 其他
 */
export async function getPersonalizedRecommendations(userId, options = {}) {
    const { limit = 20, searchQuery = '', filters = {} } = options;

    try {
        // 获取用户画像
        const userProfile = await getUserProfile(userId);

        // 获取所有活跃岗位
        const jobsResult = await neonHelper.query(
            `SELECT * FROM ${JOBS_TABLE} WHERE status = 'active' ORDER BY published_at DESC LIMIT 500`
        );
        const jobs = jobsResult || [];

        if (!jobs.length) {
            return { jobs: [], strategy: 'no_jobs' };
        }

        // 确定推荐策略
        let strategy = 'default';
        let scoredJobs = [];

        if (userProfile?.hasResume && userProfile.skills?.length) {
            // 有简历: 使用匹配算法
            strategy = 'resume_match';

            for (const job of jobs) {
                const jobFeatures = buildJobFeaturesFromRow(job);
                const matchResult = calculateMatchScore(userProfile, jobFeatures);
                const calibrated = calibrateDisplayScore({
                    trueScore: matchResult.trueScore,
                    constraintFlags: matchResult.constraintFlags,
                    evidenceCoverage: matchResult.breakdown?.evidenceCoverage
                });
                scoredJobs.push({
                    ...job,
                    matchScore: calibrated.displayScore,
                    trueMatchScore: matchResult.trueScore,
                    displayMatchScore: calibrated.displayScore,
                    displayBand: calibrated.displayBand,
                    breakdown: matchResult.breakdown
                });
            }
        } else if (userProfile?.preferences && Object.keys(userProfile.preferences).length) {
            // 无简历有偏好: 基于偏好推荐
            strategy = 'preference_match';

            for (const job of jobs) {
                const prefScore = calculatePreferenceMatch(userProfile.preferences, job);
                const calibrated = calibrateDisplayScore({ trueScore: prefScore });
                scoredJobs.push({
                    ...job,
                    matchScore: calibrated.displayScore,
                    trueMatchScore: prefScore,
                    displayMatchScore: calibrated.displayScore,
                    displayBand: calibrated.displayBand,
                    breakdown: { preferenceMatch: prefScore }
                });
            }
        } else if (searchQuery) {
            // 有搜索词: 基于搜索相关度
            strategy = 'search_relevance';

            for (const job of jobs) {
                const jobText = `${job.title || ''} ${job.description || ''} ${(job.tags || []).join(' ')}`;
                const relevance = calculateTextSimilarity(searchQuery, jobText);
                const calibrated = calibrateDisplayScore({ trueScore: relevance });
                scoredJobs.push({
                    ...job,
                    matchScore: calibrated.displayScore,
                    trueMatchScore: relevance,
                    displayMatchScore: calibrated.displayScore,
                    displayBand: calibrated.displayBand,
                    breakdown: { searchRelevance: relevance }
                });
            }
        } else {
            // 完全冷启动: 按优先级排序 (内推 > 人工精选 > 其他)
            strategy = 'priority_fallback';

            scoredJobs = jobs.map(job => {
                let score = 0; // 取消基础50分，防止非精准推荐的岗位打分过高导致错误展示“一般匹配”

                // 内推岗位加分最高
                if (job.can_refer) score += 40;
                // 人工精选(trusted)次之
                else if (job.is_trusted || job.source_type === 'trusted') score += 30;
                // 远程岗位
                if (job.is_remote) score += 10;
                // 有标签的岗位
                if (job.tags?.length) score += 5;
                const calibrated = calibrateDisplayScore({ trueScore: Math.min(score, 100) });

                return {
                    ...job,
                    matchScore: calibrated.displayScore,
                    trueMatchScore: Math.min(score, 100),
                    displayMatchScore: calibrated.displayScore,
                    displayBand: calibrated.displayBand,
                    breakdown: {
                        canRefer: job.can_refer,
                        isTrusted: job.is_trusted
                    }
                };
            });
        }

        // 应用筛选条件
        if (filters.category) {
            scoredJobs = scoredJobs.filter(j => j.category === filters.category);
        }
        if (filters.region) {
            scoredJobs = scoredJobs.filter(j => j.region === filters.region);
        }

        // 排序始终使用真实分，展示分只用于前端呈现
        scoredJobs.sort((a, b) => {
            const trueDiff = (b.trueMatchScore || b.matchScore || 0) - (a.trueMatchScore || a.matchScore || 0);
            if (trueDiff !== 0) return trueDiff;
            return (b.matchScore || 0) - (a.matchScore || 0);
        });
        scoredJobs = scoredJobs.slice(0, limit);

        return {
            jobs: scoredJobs,
            strategy,
            hasResume: userProfile?.hasResume || false,
            hasPreferences: !!(userProfile?.preferences && Object.keys(userProfile.preferences).length)
        };
    } catch (error) {
        console.error('[matching-engine] 获取推荐失败:', error.message);
        return { jobs: [], strategy: 'error', error: error.message };
    }
}

/**
 * 触发重新计算用户的所有匹配分数
 */
export async function recalculateUserMatches(userId) {
    return invalidateUserMatchCache(userId, 'manual_recalculate');
}

export async function invalidateUserMatchCache(userId, reason = 'resume_changed') {
    try {
        if (!userId) {
            return { success: false, error: '缺少用户ID' };
        }

        // 删除该用户的所有缓存
        await neonHelper.delete(MATCHES_TABLE, { user_id: userId });

        console.log(`[matching-engine] 已清除用户 ${userId} 的匹配缓存，原因: ${reason}`);
        return { success: true };
    } catch (error) {
        console.error('[matching-engine] 清除匹配缓存失败:', error.message);
        return { success: false, error: error.message };
    }
}

export default {
    calculateMatch,
    batchCalculateMatches,
    getPersonalizedRecommendations,
    recalculateUserMatches,
    invalidateUserMatchCache,
    getUserProfileForMatching,
    scoreJobForUserProfile,
    isMatchCacheFresh,
    // 工具函数也导出供测试
    calculateSkillMatch,
    calculateTextSimilarity,
    calculateExperienceMatch,
    calculatePreferenceMatch,
    extractKeywords,
    buildJobFeaturesFromRow
};
