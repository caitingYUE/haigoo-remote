/**
 * 人岗匹配引擎
 * 基于TF-IDF + 余弦相似度算法,纯本地计算,不发送第三方
 */

import natural from 'natural';
import { removeStopwords, eng, zho } from 'stopword';
import neonHelper from '../../server-utils/dal/neon-helper.js';

const TfIdf = natural.TfIdf;

// 表名常量
const MATCHES_TABLE = 'user_job_matches';
const JOBS_TABLE = 'jobs';
const USERS_TABLE = 'users';
const RESUMES_TABLE = 'resumes';

// 权重配置
const WEIGHTS = {
    skill: 0.40,      // 技能匹配 40%
    keyword: 0.30,    // 关键词相似度 30%
    experience: 0.15, // 经验匹配 15%
    preference: 0.15  // 偏好匹配 15%
};

// 缓存有效期(毫秒)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 标准化技能名称
 */
function normalizeSkill(skill) {
    if (!skill) return '';
    return skill.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
        .trim();
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text) {
    if (!text) return [];

    // 分词
    const words = text.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    // 移除停用词
    const filtered = removeStopwords(words, [...eng, ...zho]);

    // 去重
    return [...new Set(filtered)];
}

/**
 * 计算两个技能列表的匹配度
 * @returns {number} 0-100
 */
function calculateSkillMatch(userSkills, jobSkills) {
    if (!userSkills?.length || !jobSkills?.length) return 0;

    const normalizedUser = userSkills.map(normalizeSkill).filter(Boolean);
    const normalizedJob = jobSkills.map(normalizeSkill).filter(Boolean);

    if (!normalizedUser.length || !normalizedJob.length) return 0;

    // 计算交集
    const matched = normalizedUser.filter(skill =>
        normalizedJob.some(js => js.includes(skill) || skill.includes(js))
    );

    // 匹配度 = 匹配数 / 岗位要求数 * 100
    const score = (matched.length / normalizedJob.length) * 100;
    return Math.min(Math.round(score), 100);
}

/**
 * 使用TF-IDF计算文本相似度
 * @returns {number} 0-100
 */
function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    try {
        const tfidf = new TfIdf();

        // 添加文档
        tfidf.addDocument(text1.toLowerCase());
        tfidf.addDocument(text2.toLowerCase());

        // 获取所有词项
        const terms = new Set();
        tfidf.listTerms(0).forEach(t => terms.add(t.term));
        tfidf.listTerms(1).forEach(t => terms.add(t.term));

        if (terms.size === 0) return 0;

        // 构建向量
        const termsArray = Array.from(terms);
        const vec1 = termsArray.map(term => tfidf.tfidf(term, 0));
        const vec2 = termsArray.map(term => tfidf.tfidf(term, 1));

        // 计算余弦相似度
        const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
        const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
        const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));

        if (mag1 === 0 || mag2 === 0) return 0;

        const similarity = dotProduct / (mag1 * mag2);
        return Math.round(similarity * 100);
    } catch (error) {
        console.error('[matching-engine] TF-IDF计算失败:', error.message);
        return 0;
    }
}

/**
 * 计算经验匹配度
 * @returns {number} 0-100
 */
function calculateExperienceMatch(userExp, jobLevel) {
    const expMapping = {
        'Entry': { min: 0, max: 2 },
        'Junior': { min: 0, max: 2 },
        'Mid': { min: 2, max: 5 },
        'Senior': { min: 5, max: 10 },
        'Lead': { min: 5, max: 15 },
        'Executive': { min: 10, max: 30 }
    };

    const levelRange = expMapping[jobLevel] || { min: 0, max: 100 };

    if (userExp >= levelRange.min && userExp <= levelRange.max) {
        return 100;
    } else if (userExp < levelRange.min) {
        // 经验不足
        const gap = levelRange.min - userExp;
        return Math.max(0, 100 - gap * 20);
    } else {
        // 经验超出(可能overqualified)
        const gap = userExp - levelRange.max;
        return Math.max(60, 100 - gap * 5); // 经验丰富仍有一定匹配度
    }
}

/**
 * 计算偏好匹配度
 * @returns {number} 0-100
 */
function calculatePreferenceMatch(preferences, job) {
    if (!preferences) return 50; // 无偏好返回中等分数

    let score = 0;
    let factors = 0;

    // 工作类型匹配
    if (preferences.jobTypes?.length) {
        factors++;
        const jobType = job.job_type || job.jobType || 'full-time';
        if (preferences.jobTypes.includes(jobType) ||
            (job.is_remote && preferences.jobTypes.includes('remote'))) {
            score += 100;
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
        }
    }

    // 地点匹配
    if (preferences.locations?.length) {
        factors++;
        const location = job.location || '';
        if (job.is_remote ||
            preferences.locations.includes('anywhere') ||
            preferences.locations.some(loc =>
                location.toLowerCase().includes(loc.toLowerCase())
            )) {
            score += 100;
        }
    }

    // 级别匹配
    if (preferences.levels?.length) {
        factors++;
        const level = job.experience_level || job.experienceLevel || 'Mid';
        if (preferences.levels.includes(level)) {
            score += 100;
        }
    }

    return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * 获取用户画像数据
 */
async function getUserProfile(userId) {
    try {
        // 获取用户基础信息和偏好
        const userResult = await neonHelper.select(USERS_TABLE, { user_id: userId });
        const user = userResult?.[0];

        if (!user) return null;

        const profile = user.profile || {};
        const preferences = profile.jobPreferences || {};

        // 获取用户简历
        const resumeResult = await neonHelper.select(RESUMES_TABLE, { user_id: userId });
        const resume = resumeResult?.[0];

        let skills = [];
        let experienceYears = 0;
        let resumeText = '';

        if (resume?.parse_result) {
            const parsed = typeof resume.parse_result === 'string'
                ? JSON.parse(resume.parse_result)
                : resume.parse_result;

            skills = parsed.skills || [];
            experienceYears = parsed.total_experience || parsed.experienceYears || 0;
            resumeText = parsed.content || parsed.text || resume.content_text || '';
        }

        // 合并profile中的技能
        if (profile.skills?.length) {
            skills = [...new Set([...skills, ...profile.skills])];
        }

        return {
            userId,
            skills,
            experienceYears,
            resumeText,
            preferences,
            hasResume: !!resume
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

        // 提取技能标签
        const skills = job.tags || [];

        // 合并标题和描述作为文本
        const jobText = `${job.title || ''} ${job.description || ''}`;

        return {
            jobId,
            title: job.title,
            skills,
            jobText,
            experienceLevel: job.experience_level,
            isRemote: job.is_remote,
            location: job.location,
            category: job.category,
            industry: job.industry,
            jobType: job.job_type,
            canRefer: job.can_refer,
            isTrusted: job.is_trusted,
            sourceType: job.source_type
        };
    } catch (error) {
        console.error('[matching-engine] 获取岗位特征失败:', error.message);
        return null;
    }
}

/**
 * 计算综合匹配分数
 */
function calculateMatchScore(userProfile, jobFeatures) {
    // 技能匹配
    const skillScore = calculateSkillMatch(
        userProfile.skills,
        jobFeatures.skills
    );

    // 关键词相似度
    const keywordScore = calculateTextSimilarity(
        userProfile.resumeText,
        jobFeatures.jobText
    );

    // 经验匹配
    const expScore = calculateExperienceMatch(
        userProfile.experienceYears,
        jobFeatures.experienceLevel
    );

    // 偏好匹配
    const prefScore = calculatePreferenceMatch(
        userProfile.preferences,
        jobFeatures
    );

    // 加权计算总分
    const totalScore = Math.round(
        skillScore * WEIGHTS.skill +
        keywordScore * WEIGHTS.keyword +
        expScore * WEIGHTS.experience +
        prefScore * WEIGHTS.preference
    );

    return {
        totalScore: Math.min(totalScore, 100),
        breakdown: {
            skillMatch: skillScore,
            keywordSimilarity: keywordScore,
            experienceMatch: expScore,
            preferenceMatch: prefScore
        }
    };
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
                const jobFeatures = {
                    jobId: job.job_id,
                    skills: job.tags || [],
                    jobText: `${job.title || ''} ${job.description || ''}`,
                    experienceLevel: job.experience_level,
                    isRemote: job.is_remote,
                    location: job.location,
                    category: job.category,
                    industry: job.industry,
                    jobType: job.job_type,
                    canRefer: job.can_refer,
                    isTrusted: job.is_trusted,
                    sourceType: job.source_type
                };

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
                    matchScore: prefScore,
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
                    matchScore: relevance,
                    breakdown: { searchRelevance: relevance }
                });
            }
        } else {
            // 完全冷启动: 按优先级排序 (内推 > 人工精选 > 其他)
            strategy = 'priority_fallback';

            scoredJobs = jobs.map(job => {
                let score = 50; // 基础分

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
                    matchScore: Math.min(score, 100),
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
    // 工具函数也导出供测试
    calculateSkillMatch,
    calculateTextSimilarity,
    calculateExperienceMatch,
    calculatePreferenceMatch,
    extractKeywords
};
