/**
 * Vercel Serverless Function - 简历数据管理
 * 支持存储到 Redis / Vercel KV
 */

import { kv } from '@vercel/kv'
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
    console.log('[Resumes API] Connected to Redis')
    return redisClient
  } catch (error) {
    console.error('[Resumes API] Redis connection failed:', error.message)
    return null
  }
}

// 检查 KV 是否可用
function isKVAvailable() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(status).json(body)
}

// 获取所有简历
async function getResumes() {
  let provider = 'memory'
  let resumes = []

  // 优先尝试 KV
  if (isKVAvailable()) {
    try {
      const data = await kv.get(RESUMES_KEY)
      if (data) {
        resumes = Array.isArray(data) ? data : []
        provider = 'kv'
        console.log('[Resumes API] Loaded from KV:', resumes.length)
      }
    } catch (error) {
      console.warn('[Resumes API] KV read failed:', error.message)
    }
  }

  // 回退到 Redis
  if (resumes.length === 0) {
    const redis = await getRedisClient()
    if (redis) {
      try {
        const data = await redis.get(RESUMES_KEY)
        if (data) {
          resumes = JSON.parse(data)
          provider = 'redis'
          console.log('[Resumes API] Loaded from Redis:', resumes.length)
        }
      } catch (error) {
        console.warn('[Resumes API] Redis read failed:', error.message)
      }
    }
  }

  return { resumes, provider }
}

// 保存简历
async function saveResumes(resumes) {
  let provider = 'memory'
  let success = false

  // 去重和清理
  const uniqueResumes = deduplicateResumes(resumes)
  const limitedResumes = uniqueResumes.slice(0, 10000) // 最多保留 10000 份

  // 优先保存到 KV
  if (isKVAvailable()) {
    try {
      await kv.set(RESUMES_KEY, limitedResumes)
      provider = 'kv'
      success = true
      console.log('[Resumes API] Saved to KV:', limitedResumes.length)
    } catch (error) {
      console.error('[Resumes API] KV save failed:', error.message)
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
        console.log('[Resumes API] Saved to Redis:', limitedResumes.length)
      } catch (error) {
        console.error('[Resumes API] Redis save failed:', error.message)
      }
    }
  }

  // 更新统计信息
  if (success) {
    await updateStats(limitedResumes, provider)
  }

  return { success, provider, count: limitedResumes.length }
}

// 去重
function deduplicateResumes(resumes) {
  const seen = new Map()
  return resumes.filter(resume => {
    const key = `${resume.fileName}_${resume.size}`
    if (seen.has(key)) {
      return false
    }
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
    console.warn('[Resumes API] Stats update failed:', error.message)
  }
}

// 获取统计信息
async function getStats() {
  try {
    if (isKVAvailable()) {
      const stats = await kv.get(STATS_KEY)
      return stats || null
    } else {
      const redis = await getRedisClient()
      if (redis) {
        const data = await redis.get(STATS_KEY)
        return data ? JSON.parse(data) : null
      }
    }
  } catch (error) {
    console.warn('[Resumes API] Stats read failed:', error.message)
  }
  return null
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return sendJson(res, {}, 200)
  }

  try {
    // GET - 获取所有简历
    if (req.method === 'GET') {
      const { resumes, provider } = await getResumes()
      
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-KV-Configured', isKVAvailable() ? 'true' : 'false')
      res.setHeader('X-Diag-Redis-Configured', (await getRedisClient()) ? 'true' : 'false')
      
      return sendJson(res, {
        success: true,
        data: resumes,
        provider,
        count: resumes.length
      })
    }

    // POST - 保存简历（批量或追加）
    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString())

      if (!body.resumes || !Array.isArray(body.resumes)) {
        return sendJson(res, {
          success: false,
          error: 'Invalid request: resumes array required'
        }, 400)
      }

      const mode = body.mode || 'append' // append 或 replace

      let finalResumes = []
      if (mode === 'append') {
        const { resumes: existingResumes } = await getResumes()
        finalResumes = [...body.resumes, ...existingResumes]
      } else {
        finalResumes = body.resumes
      }

      const result = await saveResumes(finalResumes)

      res.setHeader('X-Storage-Provider', result.provider)
      
      return sendJson(res, {
        success: result.success,
        provider: result.provider,
        count: result.count,
        mode
      })
    }

    // DELETE - 删除简历
    if (req.method === 'DELETE') {
      const { id } = req.query

      if (id) {
        // 删除单个
        const { resumes } = await getResumes()
        const filtered = resumes.filter(r => r.id !== id)
        const result = await saveResumes(filtered)
        
        return sendJson(res, {
          success: result.success,
          deletedId: id,
          remainingCount: result.count
        })
      } else {
        // 清空所有
        const result = await saveResumes([])
        
        return sendJson(res, {
          success: result.success,
          message: 'All resumes cleared',
          count: 0
        })
      }
    }

    return sendJson(res, {
      success: false,
      error: 'Method not allowed'
    }, 405)

  } catch (error) {
    console.error('[Resumes API] Error:', error)
    return sendJson(res, {
      success: false,
      error: error.message || 'Internal server error'
    }, 500)
  }
}

