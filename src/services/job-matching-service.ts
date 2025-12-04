/**
 * 人岗匹配服务 (前端)
 * 调用后端匹配API获取个性化推荐和匹配分数
 */

// 获取API基础路径
const getApiUrl = (): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    return `${baseUrl}/api/job-matching`;
};

export interface MatchBreakdown {
    skillMatch?: number;
    keywordSimilarity?: number;
    experienceMatch?: number;
    preferenceMatch?: number;
}

export interface JobMatchResult {
    jobId: string;
    matchScore: number;
    breakdown: MatchBreakdown;
    hasResume?: boolean;
    fromCache?: boolean;
}

export interface PersonalizedRecommendations {
    success: boolean;
    jobs: any[];
    strategy: 'resume_match' | 'preference_match' | 'search_relevance' | 'priority_fallback' | 'error' | 'no_jobs';
    hasResume: boolean;
    hasPreferences: boolean;
    error?: string;
}

/**
 * 获取个性化推荐岗位列表
 */
export async function getPersonalizedRecommendations(
    token: string,
    options: {
        limit?: number;
        search?: string;
        category?: string;
        region?: string;
    } = {}
): Promise<PersonalizedRecommendations> {
    try {
        const params = new URLSearchParams();
        if (options.limit) params.set('limit', String(options.limit));
        if (options.search) params.set('search', options.search);
        if (options.category) params.set('category', options.category);
        if (options.region) params.set('region', options.region);

        const response = await fetch(`${getApiUrl()}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[job-matching-service] 获取推荐失败:', error);
        return {
            success: false,
            jobs: [],
            strategy: 'error',
            hasResume: false,
            hasPreferences: false,
            error: error instanceof Error ? error.message : '未知错误'
        };
    }
}

/**
 * 计算单个岗位的匹配分数
 */
export async function calculateJobMatch(
    token: string,
    jobId: string
): Promise<JobMatchResult | null> {
    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ jobId })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            jobId,
            matchScore: data.matchScore || 0,
            breakdown: data.breakdown || {},
            hasResume: data.hasResume,
            fromCache: data.fromCache
        };
    } catch (error) {
        console.error('[job-matching-service] 计算匹配度失败:', error);
        return null;
    }
}

/**
 * 批量计算岗位匹配分数
 */
export async function batchCalculateMatches(
    token: string,
    jobIds: string[]
): Promise<JobMatchResult[]> {
    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ jobIds })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.matches || [];
    } catch (error) {
        console.error('[job-matching-service] 批量计算失败:', error);
        return [];
    }
}

/**
 * 触发重新计算匹配分数
 */
export async function recalculateMatches(token: string): Promise<boolean> {
    try {
        const response = await fetch(`${getApiUrl()}?action=recalculate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('[job-matching-service] 重新计算失败:', error);
        return false;
    }
}

export default {
    getPersonalizedRecommendations,
    calculateJobMatch,
    batchCalculateMatches,
    recalculateMatches
};
