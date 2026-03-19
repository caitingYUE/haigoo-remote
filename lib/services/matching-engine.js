/**
 * 人岗匹配引擎
 * 纯本地规则与统计特征匹配引擎，不依赖第三方 AI
 */

import { removeStopwords, eng, zho } from 'stopword';
import neonHelper from '../../server-utils/dal/neon-helper.js';

// 表名常量
const MATCHES_TABLE = 'user_job_matches';
const JOBS_TABLE = 'jobs';
const USERS_TABLE = 'users';
const RESUMES_TABLE = 'resumes';

const MATCH_SCORE_BASELINE = 60;
const MATCH_SCORE_RANGE = 40;

// 权重配置：职业方向和岗位角色类型优先，其次才是技能与语义，关键词不再主导分数。
const DETAIL_WEIGHTS = {
    title: 0.32,
    roleType: 0.24,
    skill: 0.18,
    keyword: 0.12,
    experience: 0.08,
    preference: 0.06
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
            .split(/[\/,，、|()（）]/)
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

    const df = new Map();
    [tfA, tfB].forEach(tf => {
        tf.forEach((_, term) => df.set(term, (df.get(term) || 0) + 1));
    });

    const buildVector = (tf) => {
        const vector = new Map();
        let norm = 0;
        tf.forEach((count, term) => {
            const idf = Math.log((2 + 1) / ((df.get(term) || 0) + 1)) + 1;
            const weight = count * idf;
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

/**
 * 从文本中提取关键词
 */
function extractKeywords(text) {
    if (!text) return [];

    const words = normalizeText(text)
        .split(/\s+/)
        .filter(w => w.length > 1 || ['c#', 'c++', 'go', 'ai', 'ml'].includes(w));

    const filtered = removeStopwords(words, [...eng, ...zho]);

    return [...new Set(filtered)];
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

    if (!normalizedUser.length && !normalizedJob.length) return 22;
    if (!normalizedJob.length) return normalizedUser.length ? 35 : 18;
    if (!normalizedUser.length) return 14;

    const userSet = new Set(normalizedUser);
    const matchedCount = normalizedJob.filter(s => userSet.has(s)).length;
    const recall = matchedCount / normalizedJob.length; // 站在岗位要求视角
    const precision = matchedCount / normalizedUser.length; // 站在候选人技能视角

    const rawScore = recall * 0.75 + precision * 0.25;
    // 使用开方进行平滑提分 (e.g. 0.5 -> 0.70)
    const score = Math.sqrt(rawScore) * 100;
    return clampScore(score);
}

/**
 * 文本相似度（TF-IDF 余弦 + 适度关键词交集 + 标题命中）
 * @returns {number} 0-100
 */
function calculateTextSimilarity(text1, text2, titleText = '', prioritizedTerms = []) {
    if (!text1 || !text2) return 10;

    const keywords1 = extractKeywords(text1).slice(0, 220);
    const keywords2 = extractKeywords(text2).slice(0, 260);
    if (!keywords1.length || !keywords2.length) return 12;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    let intersection = 0;
    for (const token of set1) {
        if (set2.has(token)) intersection++;
    }
    const overlap = Math.min(set1.size, set2.size) > 0 ? intersection / Math.min(set1.size, set2.size) : 0;
    const cosine = cosineSimilarity(keywords1, keywords2);

    const title = normalizeText(titleText);
    const priority = buildRoleTerms(prioritizedTerms).map(normalizeSkill).filter(Boolean);
    const titleHits = priority.filter(token => token && title.includes(token)).length;
    const titleBonus = priority.length ? Math.min(0.22, titleHits / Math.max(3, priority.length)) : 0;

    const rawScore = cosine * 0.55 + overlap * 0.25 + titleBonus * 0.20;
    const score = Math.sqrt(rawScore) * 100;
    return clampScore(score);
}

function calculateTitleMatch(userProfile, jobFeatures) {
    const userSignals = toArray(userProfile.roleSignals);
    const jobSignals = uniqueStrings([jobFeatures.title, jobFeatures.category], 6);
    if (!userSignals.length) return 18;

    const normalizedUserSignals = userSignals.map(normalizeText).filter(Boolean);
    const normalizedJobSignals = jobSignals.map(normalizeText).filter(Boolean);

    const exactPhraseMatch = normalizedUserSignals.some(userSignal =>
        userSignal.length >= 3 && normalizedJobSignals.some(jobSignal =>
            jobSignal.includes(userSignal) || userSignal.includes(jobSignal)
        )
    );
    if (exactPhraseMatch) return 98;

    const userTerms = toArray(userProfile.roleTerms);
    const jobTerms = toArray(jobFeatures.roleTerms);
    const sharedTerms = countOverlap(userTerms, jobTerms);
    const sharedFamilies = countOverlap(toArray(userProfile.roleFamilies), toArray(jobFeatures.roleFamilies));
    const adjacentFamilies = hasAdjacentRoleFamily(
        toArray(userProfile.roleFamilies),
        toArray(jobFeatures.roleFamilies)
    );

    let score = 18 + sharedTerms * 10;
    if (sharedFamilies > 0) {
        score = Math.max(score, 88 + Math.min(10, sharedTerms * 4));
    } else if (adjacentFamilies) {
        score = Math.max(score, 72 + Math.min(10, sharedTerms * 3));
    } else if (sharedTerms >= 2) {
        score = Math.max(score, 62);
    } else if (sharedTerms === 1) {
        score = Math.max(score, 46);
    }

    return clampScore(score);
}

function calculateRoleTypeMatch(userProfile, jobFeatures) {
    const userFamilies = toArray(userProfile.roleFamilies);
    const jobFamilies = toArray(jobFeatures.roleFamilies);
    const userTerms = toArray(userProfile.roleTerms);
    const jobTerms = toArray(jobFeatures.roleTerms);

    if (!userFamilies.length && !userTerms.length) return 18;

    const familyOverlap = countOverlap(userFamilies, jobFamilies);
    if (familyOverlap > 0) {
        return clampScore(90 + Math.min(10, familyOverlap * 5));
    }

    if (hasAdjacentRoleFamily(userFamilies, jobFamilies)) {
        return 76;
    }

    const sharedTerms = countOverlap(userTerms, jobTerms);
    if (sharedTerms >= 2) return 64;
    if (sharedTerms === 1) return 42;
    return 20;
}

/**
 * 计算经验匹配度
 * @returns {number} 0-100
 */
function calculateExperienceMatch(userExp, jobLevel) {
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
    const levelRange = expMapping[normalizedLevel] || { min: 0, max: 100 };
    const normalizedUserExp = Number(userExp);

    if (!Number.isFinite(normalizedUserExp) || normalizedUserExp <= 0) {
        return 35;
    }

    if (normalizedUserExp >= levelRange.min && normalizedUserExp <= levelRange.max) {
        return 100;
    } else if (normalizedUserExp < levelRange.min) {
        const gap = levelRange.min - normalizedUserExp;
        return clampScore(Math.max(18, Math.round(100 - gap * 18)));
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
    if (!preferences) return 18;

    let score = 0;
    let factors = 0;
    const isRemote = Boolean(job.is_remote ?? job.isRemote);

    // 工作类型匹配
    if (preferences.jobTypes?.length) {
        factors++;
        const jobType = job.job_type || job.jobType || 'full-time';
        if (preferences.jobTypes.includes(jobType) ||
            (isRemote && preferences.jobTypes.includes('remote'))) {
            score += 100;
        } else if (jobType === 'contract' || jobType === 'freelance') {
            score += 45;
        }
    }

    // 行业匹配
    if (preferences.industries?.length) {
        factors++;
        const industry = job.industry || job.category || '';
        if (preferences.industries.some(ind =>
            industry.toLowerCase().includes(ind.toLowerCase())
        )) {
            score += 100;
        } else if (industry) {
            score += 20;
        }
    }

    // 地点匹配
    if (preferences.locations?.length) {
        factors++;
        const location = job.location || '';
        if (isRemote ||
            preferences.locations.includes('anywhere') ||
            preferences.locations.some(loc =>
                location.toLowerCase().includes(loc.toLowerCase())
            )) {
            score += 100;
        } else if (location) {
            score += 18;
        }
    }

    // 级别匹配
    if (preferences.levels?.length) {
        factors++;
        const level = job.experience_level || job.experienceLevel || 'Mid';
        if (preferences.levels.includes(level)) {
            score += 100;
        } else if (level) {
            score += 30;
        }
    }

    return factors > 0 ? clampScore(score / factors) : 18;
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

        if (resume) {
            const parsed = safeJsonParse(resume.parse_result, {}) || {};
            parsedResume = parsed;
            skills = toArray(parsed.skills);
            experienceYears = Number(parsed.total_experience || parsed.experienceYears || 0) || 0;
            resumeText = parsed.content || parsed.text || resume.content_text || '';
        }

        const profileSkills = toArray(profile.skills);
        if (profileSkills.length) {
            skills = [...new Set([...skills, ...profileSkills])];
        }

        if (!experienceYears) {
            experienceYears = extractExperienceYearsFromText(resumeText);
        }

        if (!skills.length && resumeText) {
            const extracted = extractKeywords(resumeText).map(normalizeSkill).filter(Boolean);
            skills = [...new Set(extracted)].slice(0, 40);
        }

        const normalizedSkills = [...new Set(skills.map(normalizeSkill).filter(Boolean))];
        const roleSignals = uniqueStrings([
            profile.targetRole,
            profile.title,
            parsedResume.targetRole,
            parsedResume.target_role,
            parsedResume.title,
            ...(Array.isArray(preferences.categories) ? preferences.categories : []),
            ...(Array.isArray(preferences.roles) ? preferences.roles : [])
        ], 10);
        const roleTerms = buildRoleTerms(roleSignals);
        const roleFamilies = inferRoleFamilies([
            ...roleSignals,
            ...toArray(preferences.categories),
            ...toArray(preferences.roles)
        ]);

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
            roleFamilies
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
    const requirements = toArray(jobRow?.requirements).filter(item => typeof item === 'string' && item.length <= 40);
    const rawSkills = [...tags, ...requirements, ...toArray(jobRow?.skills)];
    const skills = rawSkills
        .map(normalizeSkill)
        .filter(Boolean)
        .slice(0, 50);

    const title = jobRow?.title || '';
    const description = jobRow?.description || '';
    const category = jobRow?.category || '';
    const industry = jobRow?.industry || '';
    const jobText = `${title} ${category} ${industry} ${description}`;
    const roleSignals = uniqueStrings([title, category, industry], 8);
    const roleTerms = buildRoleTerms(roleSignals);
    const roleFamilies = inferRoleFamilies(roleSignals);

    return {
        jobId: jobRow?.job_id || jobRow?.jobId,
        title,
        skills,
        jobText,
        experienceLevel: jobRow?.experience_level || jobRow?.experienceLevel || 'mid',
        isRemote: Boolean(jobRow?.is_remote ?? jobRow?.isRemote),
        location: jobRow?.location || '',
        category,
        industry,
        jobType: jobRow?.job_type || jobRow?.jobType || 'full-time',
        canRefer: Boolean(jobRow?.can_refer ?? jobRow?.canRefer),
        isTrusted: Boolean(jobRow?.is_trusted ?? jobRow?.isTrusted),
        sourceType: jobRow?.source_type || jobRow?.sourceType || 'rss',
        roleSignals,
        roleTerms,
        roleFamilies
    };
}

function applyHardConstraintCaps(userProfile, jobFeatures, score, scoreParts = {}) {
    let cappedScore = score;
    const skillScore = Number(scoreParts.skillScore) || 0;
    const titleScore = Number(scoreParts.titleScore) || 0;
    const roleTypeScore = Number(scoreParts.roleTypeScore) || 0;

    const pref = userProfile?.preferences || {};
    const remoteOnly = Boolean(pref.remoteOnly);
    if (remoteOnly && !jobFeatures.isRemote) {
        cappedScore = Math.min(cappedScore, 66);
    }

    const hasStrictLocations = Array.isArray(pref.locations) && pref.locations.length > 0;
    if (hasStrictLocations && !jobFeatures.isRemote) {
        const locationText = String(jobFeatures.location || '').toLowerCase();
        const matched = pref.locations.some(loc =>
            locationText.includes(String(loc || '').toLowerCase())
        );
        if (!matched) cappedScore = Math.min(cappedScore, 68);
    }

    if (userProfile.roleSignals?.length && titleScore < 35 && roleTypeScore < 40) {
        cappedScore = Math.min(cappedScore, 68);
    }

    if (userProfile.skills?.length && jobFeatures.skills?.length >= 3 && skillScore < 20) {
        cappedScore = Math.min(cappedScore, 69);
    }

    return clampScore(cappedScore, MATCH_SCORE_BASELINE, 100);
}

/**
 * 计算综合匹配分数
 */
function calculateMatchScore(userProfile, jobFeatures) {
    const titleScore = calculateTitleMatch(userProfile, jobFeatures);
    const roleTypeScore = calculateRoleTypeMatch(userProfile, jobFeatures);
    const skillScore = calculateSkillMatch(
        userProfile.skills,
        jobFeatures.skills
    );

    const keywordScore = calculateTextSimilarity(
        userProfile.resumeText,
        jobFeatures.jobText,
        jobFeatures.title,
        [...toArray(userProfile.roleSignals), ...toArray(userProfile.skills).slice(0, 6)]
    );

    const expScore = calculateExperienceMatch(
        userProfile.experienceYears,
        jobFeatures.experienceLevel
    );

    const prefScore = calculatePreferenceMatch(
        userProfile.preferences,
        jobFeatures
    );

    const detailScore =
        titleScore * DETAIL_WEIGHTS.title +
        roleTypeScore * DETAIL_WEIGHTS.roleType +
        skillScore * DETAIL_WEIGHTS.skill +
        keywordScore * DETAIL_WEIGHTS.keyword +
        expScore * DETAIL_WEIGHTS.experience +
        prefScore * DETAIL_WEIGHTS.preference;

    let unCappedScore = MATCH_SCORE_BASELINE + (detailScore / 100) * MATCH_SCORE_RANGE;

    if (titleScore >= 92 && roleTypeScore >= 90) {
        unCappedScore += 4;
    } else if (titleScore >= 82 && roleTypeScore >= 80) {
        unCappedScore += 2;
    }

    if (skillScore >= 78 && keywordScore >= 66) {
        unCappedScore += 2;
    }

    const totalScore = applyHardConstraintCaps(
        userProfile,
        jobFeatures,
        unCappedScore,
        { skillScore, titleScore, roleTypeScore }
    );

    return {
        totalScore,
        breakdown: {
            titleMatch: titleScore,
            roleTypeMatch: roleTypeScore,
            skillMatch: skillScore,
            keywordSimilarity: keywordScore,
            experienceMatch: expScore,
            preferenceMatch: prefScore,
            baselineScore: MATCH_SCORE_BASELINE
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

export function scoreJobForUserProfile(userProfile, jobRowOrFeatures) {
    if (!userProfile || !jobRowOrFeatures) {
        return { totalScore: 0, breakdown: {} };
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

            // 检查是否过期
            if (Date.now() - cachedAt < CACHE_TTL) {
                return {
                    matchScore: cached.match_score,
                    breakdown: cached.match_details || {},
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
        const data = {
            user_id: userId,
            job_id: jobId,
            match_score: matchResult.totalScore,
            match_details: matchResult.breakdown,
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
        console.error('[matching-engine] 保存缓存失败:', error.message);
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
            matchScore: matchResult.totalScore,
            breakdown: matchResult.breakdown,
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
    const results = [];

    for (const jobId of jobIds) {
        const result = await calculateMatch(userId, jobId);
        results.push({ jobId, ...result });
    }

    return results;
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
                scoredJobs.push({
                    ...job,
                    matchScore: matchResult.totalScore,
                    breakdown: matchResult.breakdown
                });
            }
        } else if (userProfile?.preferences && Object.keys(userProfile.preferences).length) {
            // 无简历有偏好: 基于偏好推荐
            strategy = 'preference_match';

            for (const job of jobs) {
                const prefScore = calculatePreferenceMatch(userProfile.preferences, job);
                scoredJobs.push({
                    ...job,
                    matchScore: clampScore(MATCH_SCORE_BASELINE + (prefScore / 100) * MATCH_SCORE_RANGE, MATCH_SCORE_BASELINE, 100),
                    breakdown: { preferenceMatch: prefScore }
                });
            }
        } else if (searchQuery) {
            // 有搜索词: 基于搜索相关度
            strategy = 'search_relevance';

            for (const job of jobs) {
                const jobText = `${job.title || ''} ${job.description || ''} ${(job.tags || []).join(' ')}`;
                const relevance = calculateTextSimilarity(searchQuery, jobText);
                scoredJobs.push({
                    ...job,
                    matchScore: clampScore(MATCH_SCORE_BASELINE + (relevance / 100) * MATCH_SCORE_RANGE, MATCH_SCORE_BASELINE, 100),
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

                return {
                    ...job,
                    matchScore: clampScore(MATCH_SCORE_BASELINE + (Math.min(score, 100) / 100) * MATCH_SCORE_RANGE, MATCH_SCORE_BASELINE, 100),
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

        // 按分数排序并限制数量
        scoredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
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
    try {
        // 删除该用户的所有缓存
        await neonHelper.delete(MATCHES_TABLE, { user_id: userId });

        console.log(`[matching-engine] 已清除用户 ${userId} 的匹配缓存`);
        return { success: true };
    } catch (error) {
        console.error('[matching-engine] 重新计算失败:', error.message);
        return { success: false, error: error.message };
    }
}

export default {
    calculateMatch,
    batchCalculateMatches,
    getPersonalizedRecommendations,
    recalculateUserMatches,
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
