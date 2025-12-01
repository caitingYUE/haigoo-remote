/**
 * 用户扩展资料 API
 * GET/POST /api/user-profile - 获取/更新用户完整资料
 * 包括工作经历、教育背景、技能、简历等
 */

import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { getUserById, saveUser } from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'

// Neon 数据库配置
const NEON_CONFIGURED = !!neonHelper?.isConfigured

// 表名常量
const USERS_TABLE = 'users'
const FAVORITES_TABLE = 'favorites'
const FEEDBACKS_TABLE = 'feedbacks'
const RECOMMENDATIONS_TABLE = 'recommendations'
const LOCATION_CATEGORIES_TABLE = 'location_categories'

// 初始化表结构（如果不存在）
async function initializeTables() {
  if (!NEON_CONFIGURED) return false
  
  try {
    
    // 反馈表
    await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS ${FEEDBACKS_TABLE} (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        job_id VARCHAR(255),
        accuracy VARCHAR(50) DEFAULT 'unknown',
        content TEXT,
        contact VARCHAR(500),
        source VARCHAR(100),
        source_url VARCHAR(2000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 推荐表
    await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS ${RECOMMENDATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        type VARCHAR(50) DEFAULT 'enterprise',
        name VARCHAR(500),
        link VARCHAR(2000),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 地址分类表
    await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS ${LOCATION_CATEGORIES_TABLE} (
        id SERIAL PRIMARY KEY,
        config_type VARCHAR(50) UNIQUE NOT NULL,
        config_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    console.log('✅ 用户资料相关表初始化完成')
    return true
  } catch (error) {
    console.error('表初始化错误:', error)
    return false
  }
}

// 初始化表
initializeTables()

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// 地址分类默认值
const DEFAULT_LOCATION_CATEGORIES = {
  domesticKeywords: ['china', '中国', 'cn', 'apac', 'asia', 'east asia', 'greater china', 'utc+8', 'gmt+8', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chongqing', 'chengdu', 'nanjing', '不限地点'],
  overseasKeywords: ['usa', 'united states', 'us', 'uk', 'england', 'britain', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia', 'latam', 'europe', 'eu', 'emea', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'ireland', 'switzerland', 'australia', 'new zealand', 'oceania', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'japan', 'korea', 'south korea', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'uae', 'saudi', 'turkey', 'russia', 'israel', 'africa'],
  globalKeywords: ['anywhere', 'everywhere', 'worldwide', 'global', '不限地点']
}

/**
 * 获取用户扩展资料
 */
async function getUserProfile(userId) {
  if (!NEON_CONFIGURED) return null
  
  try {
    const result = await neonHelper.select(USERS_TABLE, { user_id: userId })
    if (result && result.length > 0) {
      const user = result[0]
      // 返回 profile 字段中的数据，如果不存在则返回空对象
      return user.profile || {}
    }
    return null
  } catch (error) {
    console.error('[user-profile] Neon read error:', error.message)
    return null
  }
}

/**
 * 保存用户扩展资料
 */
async function saveUserProfile(userId, profileData) {
  if (!NEON_CONFIGURED) return false
  
  try {
    // 构建要更新的 profile 数据
    const profileUpdate = {
      phone: profileData.phone,
      website: profileData.website,
      linkedin: profileData.linkedin,
      github: profileData.github,
      summary: profileData.summary,
      experience: profileData.experience,
      education: profileData.education,
      skills: profileData.skills,
      resumeFiles: profileData.resumeFiles,
      jobApplications: profileData.jobApplications,
      preferences: profileData.preferences,
      privacy: profileData.privacy
    }
    
    // 更新 users 表的 profile 字段
    await neonHelper.update(USERS_TABLE, {
      profile: profileUpdate,
      updated_at: new Date().toISOString()
    }, { user_id: userId })
    
    return true
  } catch (error) {
    console.error('[user-profile] Neon write error:', error.message)
    return false
  }
}

/**
 * 获取用户收藏的岗位列表
 */
async function getUserFavorites(userId) {
  if (!NEON_CONFIGURED) return []
  
  try {
    const result = await neonHelper.select(FAVORITES_TABLE, { user_id: userId })
    return result ? result.map(row => row.job_id) : []
  } catch (error) {
    console.error('[user-profile] Neon favorites read error:', error.message)
    return []
  }
}

/**
 * 添加收藏
 */
async function addFavorite(userId, jobId) {
  if (!NEON_CONFIGURED) return false
  
  try {
    await neonHelper.insert(FAVORITES_TABLE, {
      user_id: userId,
      job_id: jobId
    })
    return true
  } catch (error) {
    // 忽略重复收藏的错误
    if (error.message?.includes('duplicate key')) {
      return true
    }
    console.error('[user-profile] Neon add favorite error:', error.message)
    return false
  }
}

/**
 * 移除收藏
 */
async function removeFavorite(userId, jobId) {
  if (!NEON_CONFIGURED) return false
  
  try {
    await neonHelper.delete(FAVORITES_TABLE, { user_id: userId, job_id: jobId })
    return true
  } catch (error) {
    console.error('[user-profile] Neon remove favorite error:', error.message)
    return false
  }
}

/**
 * 获取地址分类配置
 */
async function getLocationCategories() {
  if (!NEON_CONFIGURED) return DEFAULT_LOCATION_CATEGORIES
  
  try {
    const result = await neonHelper.select(LOCATION_CATEGORIES_TABLE, { config_id: 'location_categories' })
    return result && result.length > 0 ? result[0].categories : DEFAULT_LOCATION_CATEGORIES
  } catch (error) {
    console.error('[user-profile] Neon get location categories error:', error.message)
    return DEFAULT_LOCATION_CATEGORIES
  }
}

/**
 * 保存地址分类配置
 */
async function saveLocationCategories(categories) {
  if (!NEON_CONFIGURED) return false
  
  try {
    const existing = await neonHelper.select(LOCATION_CATEGORIES_TABLE, { config_id: 'location_categories' })
    
    if (existing && existing.length > 0) {
      await neonHelper.update(LOCATION_CATEGORIES_TABLE, {
        categories: categories,
        updated_at: new Date().toISOString()
      }, { config_id: 'location_categories' })
    } else {
      await neonHelper.insert(LOCATION_CATEGORIES_TABLE, {
        config_id: 'location_categories',
        categories: categories
      })
    }
    
    return true
  } catch (error) {
    console.error('[user-profile] Neon save location categories error:', error.message)
    return false
  }
}

/**
 * 计算资料完整度
 */
function calculateProfileCompleteness(user, profile) {
  let score = 0
  const weights = {
    basicInfo: 20, // 基础信息（姓名、邮箱、电话）
    professionalInfo: 15, // 职业信息（职位、地点）
    summary: 10, // 个人简介
    experience: 20, // 工作经历
    education: 15, // 教育背景
    skills: 10, // 技能
    resume: 10 // 简历
  }

  // 基础信息
  if (user.email) score += weights.basicInfo * 0.5
  if (profile?.phone) score += weights.basicInfo * 0.5

  // 职业信息
  if (user.profile?.title) score += weights.professionalInfo * 0.5
  if (user.profile?.location) score += weights.professionalInfo * 0.5

  // 个人简介
  if (profile?.summary && profile.summary.length > 20) score += weights.summary

  // 工作经历
  if (profile?.experience && profile.experience.length > 0) {
    score += weights.experience
  }

  // 教育背景
  if (profile?.education && profile.education.length > 0) {
    score += weights.education
  }

  // 技能
  if (profile?.skills && profile.skills.length >= 3) {
    score += weights.skills
  }

  // 简历
  if (profile?.resumeFiles && profile.resumeFiles.length > 0) {
    score += weights.resume
  }

  return Math.round(score)
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
  console.log('[user-profile] Handler called', { method: req.method, url: req.url })

  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    console.log('[user-profile] OPTIONS request, returning 200')
    return res.status(200).end()
  }

  try {
    // 解析 action（Vercel Node 环境无 req.query 时兼容）
    const rawQuery = req.url && req.url.includes('?') ? req.url.split('?')[1] : ''
    const params = new URLSearchParams(rawQuery)
    const action = params.get('action') || ''
    console.log('[user-profile] Action parsed:', action, 'from URL:', req.url)

    // 地址分类读取 (无需认证)
    if (action === 'location_categories_get') {
      try {
        const cats = await getLocationCategories()
        return res.status(200).json({ success: true, categories: cats })
      } catch (e) {
        console.error('[user-profile] location_categories_get error:', e)
        const cats = DEFAULT_LOCATION_CATEGORIES
        return res.status(200).json({ success: true, categories: cats })
      }
    }

    // 验证用户身份
    const token = extractToken(req)
    console.log('[user-profile] Token extracted:', !!token)

    if (!token) {
      console.log('[user-profile] No token provided')
      return res.status(401).json({ success: false, error: '未提供认证令牌' })
    }

    const payload = verifyToken(token)
    console.log('[user-profile] Token verified:', !!payload, payload?.userId)

    if (!payload || !payload.userId) {
      console.log('[user-profile] Invalid token payload')
      return res.status(401).json({ success: false, error: '认证令牌无效或已过期' })
    }

    // 获取反馈列表 (仅管理员)
    if (action === 'feedbacks_list') {
      // 简单鉴权：检查是否有 token 且 userId 存在 (更严格的鉴权应检查角色)
      if (!payload || !payload.userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

      try {
        let feedbacks = []
        if (NEON_CONFIGURED) {
          const result = await neonHelper.select(FEEDBACKS_TABLE, {}, {
            orderBy: 'created_at',
            orderDirection: 'DESC'
          })
          feedbacks = result ? result.map(row => ({
            id: row.id,
            userId: row.user_id,
            jobId: row.job_id,
            accuracy: row.accuracy,
            content: row.content,
            contact: row.contact,
            source: row.source,
            sourceUrl: row.source_url,
            createdAt: row.created_at
          })) : []
        }

        return res.status(200).json({ success: true, feedbacks })
      } catch (e) {
        console.error('[user-profile] feedbacks_list error:', e)
        return res.status(500).json({ success: false, error: 'Failed to fetch feedbacks' })
      }
    }

    // 地址分类写入 (需要认证)
    if (action === 'location_categories_set' && (req.method === 'POST' || req.method === 'PUT')) {
      const payload = req.body && typeof req.body === 'object' ? req.body : {}
      const next = { ...DEFAULT_LOCATION_CATEGORIES, ...payload }
      try {
        await saveLocationCategories(next)
        return res.status(200).json({ success: true, categories: next })
      } catch (e) {
        console.error('[user-profile] location_categories_set error:', e)
        return res.status(200).json({ success: true, categories: next })
      }
    }

    const user = await getUserById(payload.userId)
    console.log('[user-profile] User fetched:', !!user, user?.id)

    if (!user) {
      console.log('[user-profile] User not found:', payload.userId)
      return res.status(404).json({ success: false, error: '用户不存在' })
    }

    if (user.status !== 'active') {
      console.log('[user-profile] User not active:', user.status)
      return res.status(403).json({ success: false, error: '账户已被停用' })
    }

    // 收藏列表
    if (action === 'favorites') {
      console.log('[API] favorites GET called', { userId: user.id })

      const ids = await getUserFavorites(user.id)
      console.log('[API] Total favorite IDs from Neon:', ids.length, ids)

      const originProto = req.headers['x-forwarded-proto'] || 'https'
      const originHost = req.headers.host || process.env.VERCEL_URL || ''
      const batchUrl = `${originProto}://${originHost}/api/data/processed-jobs?ids=${encodeURIComponent(ids.join(','))}&page=1&limit=${Math.max(ids.length, 1)}`

      const normalizeJob = (job) => {
        if (!job) return null
        let status = '有效中'
        if (job.expiresAt) {
          const exp = new Date(job.expiresAt).getTime()
          status = !Number.isNaN(exp) && exp < Date.now() ? '已失效' : '有效中'
        }
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          type: job.jobType || job.type || 'full-time',
          salary: job.salary ? { min: 0, max: 0, currency: 'USD', display: job.salary } : undefined,
          description: job.description,
          requirements: job.requirements || [],
          responsibilities: job.responsibilities || [],
          benefits: job.benefits || [],
          skills: job.tags || [],
          postedAt: job.publishedAt,
          expiresAt: job.expiresAt || undefined,
          source: job.source,
          sourceUrl: job.url,
          tags: job.tags || [],
          status,
          isRemote: job.isRemote,
          category: job.category,
          recommendationScore: 0,
          translations: job.translations || undefined,
          isTranslated: job.isTranslated || false,
          translatedAt: job.translatedAt || undefined,
          isSaved: true
        }
      }

      let results = []
      try {
        const r = await fetch(batchUrl)
        if (r.ok) {
          const d = await r.json()
          const jobs = Array.isArray(d) ? d : (Array.isArray(d.jobs) ? d.jobs : [])
          const map = new Map(jobs.map(j => [String(j.id), j]))
          results = ids.map(jid => {
            const job = map.get(String(jid))
            return job ? normalizeJob(job) : {
              id: jid,
              title: '该岗位已失效或被删除',
              company: '-',
              location: '-',
              type: 'full-time',
              tags: [],
              isSaved: true,
              status: '已失效'
            }
          })
        } else {
          console.warn('[API] batch fetch failed:', r.status)
          results = []
        }
      } catch (e) {
        console.error('[API] batch fetch error:', e)
        results = []
      }

      console.log('[API] Returning favorites:', results.length)
      return res.status(200).json({ success: true, favorites: results })
    }

    // 收藏添加
    if (action === 'favorite_add' && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId } = req.body || {}
      if (!jobId) return res.status(400).json({ success: false, error: 'Missing jobId' })

      try {
        await addFavorite(user.id, jobId)
        console.log('[API] Added to Neon favorites:', jobId)
        return res.status(200).json({ success: true, jobId })
      } catch (e) {
        console.error('[API] Neon error:', e)
        return res.status(500).json({ success: false, error: 'Failed to add favorite' })
      }
    }

    // 反馈提交（岗位或平台）
    if (action === 'submit_feedback' && req.method === 'POST') {
      const body = req.body || {}
      const entry = {
        id: `${payload.userId}:${Date.now()}`,
        userId: payload.userId,
        jobId: body.jobId || null,
        accuracy: body.accuracy || 'unknown',
        content: String(body.content || ''),
        contact: String(body.contact || ''),
        source: body.source || '',
        sourceUrl: body.sourceUrl || '',
        createdAt: new Date().toISOString()
      }

      const key = `haigoo:feedbacks`
      try {
        const client = await getRedisClient()
        if (client) {
          const prev = await client.get(key)
          const arr = prev ? JSON.parse(prev) : []
          arr.push(entry)
          await client.set(key, JSON.stringify(arr))
        }
      } catch (e) {
        console.error('[user-profile] Redis feedback write error:', e?.message || e)
      }
      if (KV_CONFIGURED) {
        try {
          const prev = await kv.get(key)
          const arr = Array.isArray(prev) ? prev : []
          arr.push(entry)
          await kv.set(key, arr)
        } catch (e) {
          console.error('[user-profile] KV feedback write error:', e?.message || e)
        }
      }
      memoryFeedbacks = Array.isArray(memoryFeedbacks) ? memoryFeedbacks : []
      memoryFeedbacks.push(entry)
      globalThis.__haigoo_feedbacks = memoryFeedbacks

      return res.status(200).json({ success: true, message: '反馈已提交' })
    }

    // 反馈提交
    if (action === 'feedback_submit' && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId, accuracy, content, contact, source, sourceUrl } = req.body || {}
      if (!jobId) return res.status(400).json({ success: false, error: 'Missing jobId' })

      try {
        if (NEON_CONFIGURED) {
          await neonHelper.insert(FEEDBACKS_TABLE, {
            id: crypto.randomUUID(),
            user_id: user.id,
            job_id: jobId,
            accuracy: accuracy || 0,
            content: content || '',
            contact: contact || '',
            source: source || '',
            source_url: sourceUrl || '',
            created_at: new Date().toISOString()
          })
        }

        console.log('[API] Feedback submitted:', { jobId, userId: user.id })
        return res.status(200).json({ success: true, feedback: {
          id: crypto.randomUUID(),
          userId: user.id,
          jobId,
          accuracy: accuracy || 0,
          content: content || '',
          contact: contact || '',
          source: source || '',
          sourceUrl: sourceUrl || '',
          createdAt: new Date().toISOString()
        } })
      } catch (e) {
        console.error('[API] Feedback submit error:', e)
        return res.status(500).json({ success: false, error: 'Failed to submit feedback' })
      }
    }

    // 推荐提交（企业/岗位/用户）
    if (action === 'submit_recommendation' && req.method === 'POST') {
      const body = req.body || {}
      const entry = {
        id: `${payload.userId}:${Date.now()}`,
        userId: payload.userId,
        type: String(body.type || 'enterprise'),
        name: String(body.name || ''),
        link: String(body.link || ''),
        description: String(body.description || ''),
        createdAt: new Date().toISOString()
      }

      const key = `haigoo:recommendations`
      try {
        const client = await getRedisClient()
        if (client) {
          const prev = await client.get(key)
          const arr = prev ? JSON.parse(prev) : []
          arr.push(entry)
          await client.set(key, JSON.stringify(arr))
        }
      } catch (e) {
        console.error('[user-profile] Redis recommendation write error:', e?.message || e)
      }
      if (KV_CONFIGURED) {
        try {
          const prev = await kv.get(key)
          const arr = Array.isArray(prev) ? prev : []
          arr.push(entry)
          await kv.set(key, arr)
        } catch (e) {
          console.error('[user-profile] KV recommendation write error:', e?.message || e)
        }
      }
      memoryRecommendations = Array.isArray(memoryRecommendations) ? memoryRecommendations : []
      memoryRecommendations.push(entry)
      globalThis.__haigoo_recommendations = memoryRecommendations

      return res.status(200).json({ success: true, message: '推荐已提交' })
    }

    // 收藏移除
    if (action === 'favorite_remove' && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId } = req.body || {}
      if (!jobId) return res.status(400).json({ success: false, error: 'Missing jobId' })

      try {
        await removeFavorite(user.id, jobId)
        console.log('[API] Removed from Neon favorites:', jobId)
        return res.status(200).json({ success: true, jobId })
      } catch (e) {
        console.error('[API] Neon error:', e)
        return res.status(500).json({ success: false, error: 'Failed to remove favorite' })
      }
    }

    // 移除收藏相关 action，准备后续重新设计收藏方案

    // GET - 获取用户资料
    if (req.method === 'GET') {
      const profile = await getUserProfile(user.id)

      // 合并基础用户信息和扩展资料
      const fullProfile = {
        // 基础信息
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        status: user.status,

        // profile中的信息
        fullName: user.profile?.fullName || '',
        title: user.profile?.title || '',
        location: user.profile?.location || '',
        targetRole: user.profile?.targetRole || '',
        bio: user.profile?.bio || '',

        // 扩展资料
        phone: profile?.phone || '',
        website: profile?.website || '',
        linkedin: profile?.linkedin || '',
        github: profile?.github || '',
        summary: profile?.summary || '',

        experience: profile?.experience || [],
        education: profile?.education || [],
        skills: profile?.skills || [],
        resumeFiles: profile?.resumeFiles || [],
        jobApplications: profile?.jobApplications || [],
        savedJobs: profile?.savedJobs || [],

        preferences: profile?.preferences || {
          jobAlerts: true,
          emailNotifications: true,
          pushNotifications: false,
          weeklyDigest: true,
          applicationUpdates: true
        },

        privacy: profile?.privacy || {
          profileVisible: true,
          contactInfoVisible: false,
          resumeVisible: true,
          allowRecruiterContact: true
        },

        profileCompleteness: 0
      }

      // 计算资料完整度
      fullProfile.profileCompleteness = calculateProfileCompleteness(user, profile)

      return res.status(200).json({
        success: true,
        profile: fullProfile
      })
    }

    // POST - 更新用户资料
    if (req.method === 'POST') {
      const updates = req.body

      // 验证数据
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, error: '无效的数据格式' })
      }

      // 获取现有资料
      const existingProfile = await getUserProfile(user.id) || {}

      // 合并更新
      const updatedProfile = {
        ...existingProfile,
        ...updates,
        userId: user.id,
        updatedAt: new Date().toISOString()
      }

      // 保存扩展资料
      await saveUserProfile(user.id, updatedProfile)

      // 同时更新基础用户信息（如果有）
      if (updates.fullName || updates.title || updates.location || updates.targetRole || updates.bio) {
        if (!user.profile) user.profile = {}
        if (updates.fullName) user.profile.fullName = updates.fullName
        if (updates.title) user.profile.title = updates.title
        if (updates.location) user.profile.location = updates.location
        if (updates.targetRole) user.profile.targetRole = updates.targetRole
        if (updates.bio) user.profile.bio = updates.bio
        user.updatedAt = new Date().toISOString()
        await saveUser(user)
      }

      // 计算新的完整度
      const completeness = calculateProfileCompleteness(user, updatedProfile)

      console.log(`[user-profile] Profile updated for user ${user.id}, completeness: ${completeness}%`)

      return res.status(200).json({
        success: true,
        message: '资料更新成功',
        profileCompleteness: completeness
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[user-profile] Error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}
