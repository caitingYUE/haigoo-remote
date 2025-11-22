
/**
 * 简历数据存储服务
 * 支持存储到 Redis / Vercel KV / 内存
 */

import { kv } from './kv-client.js'
import { createClient } from 'redis'

const RESUMES_KEY = 'haigoo:resumes'
const STATS_KEY = 'haigoo:resume_stats'

// 全局 Redis 客户端缓存
let redisClient = null

// 获取 Redis 客户端
async function getRedisClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient
    }

    const redisUrl =
        process.env.REDIS_URL ||
        process.env.haigoo_REDIS_URL ||
        process.env.HAIGOO_REDIS_URL ||
        process.env.UPSTASH_REDIS_URL

    if (!redisUrl) {
        return null
    }

    try {
        redisClient = createClient({ url: redisUrl })
        await redisClient.connect()
        console.log('[Resume Storage] Connected to Redis')
        return redisClient
    } catch (error) {
        console.error('[Resume Storage] Redis connection failed:', error.message)
        return null
    }
}

// 检查 KV 是否可用
function isKVAvailable() {
    return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// 内存存储（作为最后的回退）
let memoryResumes = []

// 获取所有简历
export async function getResumes() {
    let provider = 'memory'
    let resumes = []

    // 优先尝试 KV
    if (isKVAvailable()) {
        try {
            const data = await kv.get(RESUMES_KEY)
            if (data) {
                resumes = Array.isArray(data) ? data : []
                provider = 'kv'
                // 同步到内存
                memoryResumes = resumes
            }
        } catch (error) {
            console.warn('[Resume Storage] KV read failed:', error.message)
        }
    }

    // 回退到 Redis
    if (provider !== 'kv' && resumes.length === 0) {
        const redis = await getRedisClient()
        if (redis) {
            try {
                const data = await redis.get(RESUMES_KEY)
                if (data) {
                    resumes = JSON.parse(data)
                    provider = 'redis'
                    // 同步到内存
                    memoryResumes = resumes
                }
            } catch (error) {
                console.warn('[Resume Storage] Redis read failed:', error.message)
            }
        }
    }

    // 回退到内存
    if (resumes.length === 0 && memoryResumes.length > 0) {
        resumes = memoryResumes
        provider = 'memory'
    }

    return { resumes, provider }
}

// 保存简历列表
export async function saveResumes(resumes) {
    let provider = 'memory'
    let success = false

    // 去重和清理
    const uniqueResumes = deduplicateResumes(resumes)
    const limitedResumes = uniqueResumes.slice(0, 10000) // 最多保留 10000 份

    // 更新内存
    memoryResumes = limitedResumes

    // 优先保存到 KV
    if (isKVAvailable()) {
        try {
            await kv.set(RESUMES_KEY, limitedResumes)
            provider = 'kv'
            success = true
        } catch (error) {
            console.error('[Resume Storage] KV save failed:', error.message)
        }
    }

    // 回退到 Redis
    if (!success) {
        const redis = await getRedisClient()
        if (redis) {
            try {
                await redis.set(RESUMES_KEY, JSON.stringify(limitedResumes))
                provider = 'redis'
                success = true
            } catch (error) {
                console.error('[Resume Storage] Redis save failed:', error.message)
            }
        }
    }

    // 如果都失败，至少内存里有
    if (!success) {
        success = true
        provider = 'memory'
    }

    // 更新统计信息
    if (success) {
        await updateStats(limitedResumes, provider)
    }

    return { success, provider, count: limitedResumes.length }
}

// 保存单个用户简历（覆盖旧的）
export async function saveUserResume(userId, resumeData) {
    const { resumes } = await getResumes()

    // 移除该用户旧的简历
    const otherResumes = resumes.filter(r => r.userId !== userId)

    // 添加新简历
    const newResume = {
        ...resumeData,
        userId,
        updatedAt: new Date().toISOString(),
        id: resumeData.id || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const newResumes = [newResume, ...otherResumes]

    return await saveResumes(newResumes)
}

// 去重
function deduplicateResumes(resumes) {
    const seen = new Map()
    return resumes.filter(resume => {
        // 如果有 userId，优先按 userId 去重（每个用户只能有一份）
        if (resume.userId) {
            if (seen.has(resume.userId)) return false
            seen.set(resume.userId, true)
            return true
        }

        // 否则按文件名和大小（旧逻辑兼容）
        const key = `${resume.fileName}_${resume.size}`
        if (seen.has(key)) return false
        seen.set(key, true)
        return true
    })
}

// 更新统计信息
async function updateStats(resumes, provider) {
    const stats = {
        totalCount: resumes.length,
        successCount: resumes.filter(r => r.parseStatus === 'success').length,
        failedCount: resumes.filter(r => r.parseStatus === 'failed').length,
        lastUpdate: new Date().toISOString(),
        storageProvider: provider,
        estimatedSize: JSON.stringify(resumes).length
    }

    try {
        if (isKVAvailable()) {
            await kv.set(STATS_KEY, stats)
        } else {
            const redis = await getRedisClient()
            if (redis) {
                await redis.set(STATS_KEY, JSON.stringify(stats))
            }
        }
    } catch (error) {
        console.warn('[Resume Storage] Stats update failed:', error.message)
    }
}
