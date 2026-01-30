/**
 * 用户扩展资料 API
 * GET/POST /api/user-profile - 获取/更新用户完整资料
 * 包括工作经历、教育背景、技能、简历等
 */

import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { getUserById, saveUser, deleteUserById } from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

// Neon 数据库配置
const NEON_CONFIGURED = !!neonHelper?.isConfigured

// 表名常量
const USERS_TABLE = 'users'
const FAVORITES_TABLE = 'favorites'
const FEEDBACKS_TABLE = 'feedbacks'
const RECOMMENDATIONS_TABLE = 'recommendations'
const LOCATION_CATEGORIES_TABLE = 'location_categories'

// CORS headers
function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://haigoo-admin.vercel.app',
    'https://www.haigooremote.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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
      jobPreferences: profileData.jobPreferences,  // Added this field
      privacy: profileData.privacy,
      preferencesUpdatedAt: profileData.preferencesUpdatedAt
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
    // Modify to select snapshot data and filter by 1 year
    // Note: older records might have null created_at if not migrated perfectly, 
    // but migration added default current_timestamp. 
    // We'll filter by 1 year to meet requirement.
    const query = `
      SELECT job_id, job_title_snapshot, company_name_snapshot, created_at 
      FROM favorites 
      WHERE user_id = $1 
      AND created_at > NOW() - INTERVAL '1 year'
    `
    const result = await neonHelper.query(query, [userId])
    return result ? result.map(row => ({
      jobId: row.job_id,
      titleSnapshot: row.job_title_snapshot,
      companySnapshot: row.company_name_snapshot,
      createdAt: row.created_at
    })) : []
  } catch (error) {
    console.error('[user-profile] Neon favorites read error:', error.message)
    return []
  }
}

/**
 * 添加收藏
 */
async function addFavorite(userId, jobId, jobSnapshot = {}) {
  if (!NEON_CONFIGURED) return false

  try {
    await neonHelper.insert(FAVORITES_TABLE, {
      user_id: userId,
      job_id: jobId,
      job_title_snapshot: jobSnapshot.title || null,
      company_name_snapshot: jobSnapshot.company || null,
      created_at: new Date().toISOString()
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

  setCorsHeaders(res, req)

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

    // 获取反馈列表 (仅管理员)
    if (action === 'feedbacks_list') {
      // 严格鉴权：检查管理员权限
      const isAdmin = !!(user.roles?.admin || SUPER_ADMIN_EMAILS.includes(user.email))
      if (!isAdmin) {
        console.warn('[user-profile] Unauthorized feedbacks_list attempt:', user.email)
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
      }

      try {
        let feedbacks = []
        if (NEON_CONFIGURED) {
          const query = `
            SELECT f.*, u.username, u.email 
            FROM feedbacks f 
            LEFT JOIN users u ON f.user_id = u.user_id 
            ORDER BY f.created_at DESC
          `;
          const result = await neonHelper.query(query);
          feedbacks = result ? result.map(row => ({
            id: row.id,
            userId: row.user_id,
            username: row.username || 'Unknown',
            email: row.email || 'Unknown',
            jobId: row.job_id,
            accuracy: row.accuracy === 1 ? 'accurate' : row.accuracy === -1 ? 'inaccurate' : 'unknown',
            content: row.content,
            contact: row.contact,
            source: row.source,
            sourceUrl: row.source_url,
            createdAt: row.created_at,
            replyContent: row.reply_content,
            repliedAt: row.replied_at,
            companyName: row.company_name,
            companyWebsite: row.company_website,
            recruitmentNeeds: row.recruitment_needs
          })) : []
        }

        return res.status(200).json({ success: true, feedbacks })
      } catch (e) {
        console.error('[user-profile] feedbacks_list error:', e)
        return res.status(500).json({ success: false, error: 'Failed to fetch feedbacks' })
      }
    }

    // 获取当前用户的反馈列表
    if (action === 'my_feedbacks') {
      if (!payload || !payload.userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

      try {
        let feedbacks = []
        if (NEON_CONFIGURED) {
          const query = `
            SELECT * FROM feedbacks 
            WHERE user_id = $1 
            ORDER BY created_at DESC
          `;
          const result = await neonHelper.query(query, [payload.userId]);
          feedbacks = result ? result.map(row => ({
            id: row.id,
            userId: row.user_id,
            jobId: row.job_id,
            accuracy: row.accuracy === 1 ? 'accurate' : row.accuracy === -1 ? 'inaccurate' : 'unknown',
            content: row.content,
            contact: row.contact,
            source: row.source,
            sourceUrl: row.source_url,
            createdAt: row.created_at,
            replyContent: row.reply_content,
            repliedAt: row.replied_at
          })) : []
        }

        return res.status(200).json({ success: true, feedbacks })
      } catch (e) {
        console.error('[user-profile] my_feedbacks error:', e)
        return res.status(500).json({ success: false, error: 'Failed to fetch feedbacks' })
      }
    }

    // 获取通知列表
    if (action === 'notifications') {
      try {
        if (!NEON_CONFIGURED) return res.status(200).json({ success: true, notifications: [] })

        const result = await neonHelper.query(
          'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
          [user.user_id]
        )

        const notifications = result ? result.map(row => ({
          id: row.id,
          type: row.type,
          title: row.title,
          content: row.content,
          isRead: row.is_read,
          createdAt: row.created_at
        })) : []

        return res.status(200).json({ success: true, notifications })
      } catch (e) {
        console.error('[user-profile] notifications error:', e)
        return res.status(500).json({ success: false, error: 'Failed to fetch notifications' })
      }
    }

    // 标记通知为已读
    if (action === 'notifications_mark_read' && req.method === 'POST') {
      try {
        if (!NEON_CONFIGURED) return res.status(200).json({ success: true })

        const { id } = req.body || {}

        if (id) {
          await neonHelper.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [id, user.user_id]
          )
        } else {
          // Mark all as read
          await neonHelper.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [user.user_id]
          )
        }
        return res.status(200).json({ success: true })
      } catch (e) {
        console.error('[user-profile] notifications_mark_read error:', e)
        return res.status(500).json({ success: false, error: 'Failed to mark notifications read' })
      }
    }

    // 删除通知
    if (action === 'notifications_delete' && req.method === 'POST') {
      try {
        if (!NEON_CONFIGURED) return res.status(200).json({ success: true })

        const { id } = req.body || {}
        if (id) {
          await neonHelper.query(
            'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
            [id, user.user_id]
          )
        } else {
          // Clear all
          await neonHelper.query(
            'DELETE FROM notifications WHERE user_id = $1',
            [user.user_id]
          )
        }
        return res.status(200).json({ success: true })
      } catch (e) {
        console.error('[user-profile] notifications_delete error:', e)
        return res.status(500).json({ success: false, error: 'Failed to delete notifications' })
      }
    }

    // 删除账号
    if (action === 'delete_account' && req.method === 'POST') {
      try {
        console.log(`[API delete_account] User requesting deletion: ${user.user_id}`)
        const success = await deleteUserById(user.user_id)

        if (success) {
          console.log(`[API delete_account] Successfully deleted user: ${user.user_id}`)
          return res.status(200).json({ success: true, message: '账号已永久删除' })
        } else {
          console.error(`[API delete_account] Failed to delete user: ${user.user_id}`)
          return res.status(500).json({ success: false, error: '删除失败，请稍后重试' })
        }
      } catch (e) {
        console.error('[API delete_account] Error:', e)
        return res.status(500).json({ success: false, error: '系统错误' })
      }
    }

    // 地址分类写入 (需要认证且仅管理员)
    if (action === 'location_categories_set' && (req.method === 'POST' || req.method === 'PUT')) {
      // 鉴权：检查管理员权限
      const isAdmin = !!(user.roles?.admin || SUPER_ADMIN_EMAILS.includes(user.email))
      if (!isAdmin) {
        console.warn('[user-profile] Unauthorized location categories set attempt:', user.email)
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }

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

    // 收藏列表
    if (action === 'favorites') {
      console.log('[API] favorites GET called', { userId: user.user_id })

      const favoriteItems = await getUserFavorites(user.user_id)
      const ids = favoriteItems.map(f => f.jobId)
      console.log('[API] Total favorite IDs from Neon:', ids.length)

      const normalizeJob = (row, snapshot = {}) => {
        // Use snapshot if row is null/missing
        if (!row) {
             return {
                id: snapshot.jobId,
                title: snapshot.titleSnapshot || '此岗位已下架',
                company: snapshot.companySnapshot || '已下架',
                location: '-',
                type: 'full-time',
                tags: [],
                isSaved: true,
                status: '已失效',
                publishedAt: null
              }
        }
        
        const status = row.status === 'active' ? '进行中' : (row.status === 'expired' ? '已结束' : (row.status || '进行中'))
        return {
          id: row.job_id,
          title: row.title || snapshot.titleSnapshot || '未知岗位',
          company: row.company || snapshot.companySnapshot || '未知企业',
          location: row.location || 'Remote',
          type: row.job_type || 'full-time',
          salary: row.salary ? { min: 0, max: 0, currency: 'USD', display: row.salary } : undefined,
          description: row.description,
          requirements: typeof row.requirements === 'string' ? JSON.parse(row.requirements || '[]') : (row.requirements || []),
          responsibilities: typeof row.responsibilities === 'string' ? JSON.parse(row.responsibilities || '[]') : (row.responsibilities || []),
          benefits: typeof row.benefits === 'string' ? JSON.parse(row.benefits || '[]') : (row.benefits || []),
          skills: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
          publishedAt: row.published_at || null,
          postedAt: row.published_at || null,
          expiresAt: row.expires_at || undefined,
          source: row.source,
          sourceUrl: row.url,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
          status,
          isRemote: row.is_remote,
          isTrusted: row.is_trusted || false,
          canRefer: row.can_refer || false,
          sourceType: row.source_type || 'rss',
          experienceLevel: row.experience_level,
          category: row.category,
          logo: row.company_logo || row.logo, // Map company_logo to logo for frontend
          region: row.region,
          recommendationScore: 0,
          translations: typeof row.translations === 'string' ? JSON.parse(row.translations || '{}') : (row.translations || {}),
          isTranslated: row.is_translated || false,
          translatedAt: row.translated_at || undefined,
          isSaved: true
        }
      }

      let results = []
      try {
        if (NEON_CONFIGURED && ids.length > 0) {
          // 使用 IN 查询直接从数据库获取收藏的岗位
          const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
          const query = `SELECT * FROM jobs WHERE job_id IN (${placeholders}) ORDER BY published_at DESC`

          const result = await neonHelper.query(query, ids)
          
          const jobMap = new Map((result || []).map(row => [String(row.job_id), row]))
          
          results = favoriteItems.map(item => {
              const job = jobMap.get(String(item.jobId))
              return normalizeJob(job, item)
          })
        } else {
          results = []
        }
      } catch (e) {
        console.error('[API] Database query error:', e)
        results = favoriteItems.map(item => ({
          id: item.jobId,
          title: item.titleSnapshot || '加载失败',
          company: item.companySnapshot || '-',
          location: '-',
          type: 'full-time',
          tags: [],
          isSaved: true,
          status: '已失效',
          publishedAt: null
        }))
      }

      console.log('[API] Returning favorites:', results.length)
      return res.status(200).json({ success: true, favorites: results })
    }

    // 收藏添加
    if (action === 'favorites_add' && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId, jobId: jobIdFromJSON, job } = req.body || {}
      const targetJobId = jobId || jobIdFromJSON || req.query.jobId
      if (!targetJobId) return res.status(400).json({ success: false, error: 'Missing jobId' })

      try {
        // Check membership status for favorites limit
        const isMember = user.memberStatus === 'active' &&
          user.memberExpireAt && new Date(user.memberExpireAt) > new Date();

        // Free users have a limit of 5 favorites
        const MAX_FREE_FAVORITES = 5;

        if (!isMember) {
          const currentFavorites = await getUserFavorites(user.user_id);
          if (currentFavorites.length >= MAX_FREE_FAVORITES) {
            return res.status(403).json({
              success: false,
              error: '免费用户收藏数量已达上限',
              upgradeRequired: true,
              limit: MAX_FREE_FAVORITES,
              current: currentFavorites.length
            });
          }
        }
        
        const jobSnapshot = {
            title: job?.title || '',
            company: job?.company || ''
        }

        if (NEON_CONFIGURED && job) {
          // Upsert Job Logic: Ensure job exists in DB before favoriting
          // ... (existing upsert logic) ...
          const jobData = {
            job_id: job.id,
            title: job.title || 'Unknown Job',
            company: job.company || 'Unknown Company',
            location: job.location || 'Remote',
            job_type: job.type || 'full-time',
            salary: job.salary ? (typeof job.salary.display === 'string' ? job.salary.display : '') : '',
            description: job.description || '',
            requirements: JSON.stringify(job.requirements || []),
            benefits: JSON.stringify(job.benefits || []),
            tags: JSON.stringify(job.tags || []),
            published_at: job.publishedAt ? new Date(job.publishedAt).toISOString() : new Date().toISOString(),
            expires_at: job.expiresAt ? new Date(job.expiresAt).toISOString() : null,
            source: job.source || 'rss',
            url: job.sourceUrl || '',
            company_logo: job.logo || job.companyLogo || '',
            region: job.region || '',
            translations: job.translations ? JSON.stringify(job.translations) : '{}',
            is_remote: job.isRemote !== false,
            experience_level: job.experienceLevel || '',
            category: job.category || '',
            status: 'active' // Ensure it's active when saving
          }

          const columns = Object.keys(jobData)
          const values = Object.values(jobData)

          // Generate UPDATE set clause
          const updateSet = columns
            .filter(col => col !== 'job_id') // Don't update primary key
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ')

          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

          const upsertQuery = `
                INSERT INTO jobs (${columns.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT (job_id) 
                DO UPDATE SET ${updateSet}
            `

          await neonHelper.query(upsertQuery, values)
          console.log('[API] Upserted job for favorite:', jobId)
        }

        const added = await addFavorite(user.user_id, targetJobId, jobSnapshot)
        if (!added) {
          return res.status(503).json({ success: false, error: 'Service unavailable: Database not configured' })
        }
        console.log('[API] Added to Neon favorites:', targetJobId)
        return res.status(200).json({ success: true, jobId: targetJobId })
      } catch (e) {
        console.error('[API] Neon error:', e)
        return res.status(500).json({ success: false, error: 'Failed to add favorite' })
      }
    }

    // 反馈提交
    if (action === 'submit_feedback' && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId, accuracy, content, contact, source, sourceUrl } = req.body || {}

      if (!user.user_id) {
        return res.status(401).json({ success: false, error: '用户ID缺失' });
      }

      // 如果没有 jobId，默认为平台反馈
      const targetJobId = jobId || 'platform'

      try {
        const feedbackId = crypto.randomUUID()
        if (NEON_CONFIGURED) {
          await neonHelper.insert(FEEDBACKS_TABLE, {
            feedback_id: feedbackId,
            user_id: user.user_id,
            job_id: targetJobId,
            accuracy: accuracy === 'accurate' ? 1 : accuracy === 'inaccurate' ? -1 : 0,
            content: content || '',
            contact: contact || '',
            source: source || '',
            source_url: sourceUrl || '',
            // New Recruitment Fields (will be ignored by NeonHelper if column doesn't exist, unless using raw query)
            // But NeonHelper usually builds query dynamically based on keys.
            // If the user hasn't run the migration yet, this might error if neonHelper doesn't verify columns.
            // Assuming we will provide the SQL script to the user.
            company_name: req.body.companyName || null,
            company_website: req.body.companyWebsite || null,
            recruitment_needs: req.body.recruitmentNeeds || null,
            created_at: new Date().toISOString()
          })
        }

        console.log('[API] Feedback submitted:', { jobId: targetJobId, userId: user.user_id })
        return res.status(200).json({
          success: true, feedback: {
            id: feedbackId,
            userId: user.user_id,
            jobId: targetJobId,
            accuracy: accuracy || 0,
            content: content || '',
            contact: contact || '',
            source: source || '',
            sourceUrl: sourceUrl || '',
            createdAt: new Date().toISOString()
          }
        })
      } catch (e) {
        console.error('[API] Feedback submit error:', e)
        return res.status(500).json({ success: false, error: 'Failed to submit feedback' })
      }
    }

    // 推荐提交（企业/岗位/用户）
    if (action === 'submit_recommendation' && req.method === 'POST') {
      const body = req.body || {}

      try {
        if (NEON_CONFIGURED) {
          await neonHelper.insert(RECOMMENDATIONS_TABLE, {
            recommendation_id: crypto.randomUUID(),
            user_id: user.user_id,
            job_id: body.jobId || '',
            content: String(body.description || ''),
            contact: String(body.contact || ''),
            source: String(body.name || ''),
            source_url: String(body.link || ''),
            created_at: new Date().toISOString()
          })
        }
        console.log('[API] Recommendation submitted:', { userId: user.user_id })
        return res.status(200).json({ success: true, message: '推荐已提交' })
      } catch (e) {
        console.error('[API] Recommendation submit error:', e)
        return res.status(500).json({ success: false, error: 'Failed to submit recommendation' })
      }
    }

    // 收藏移除
    if ((action === 'favorite_remove' || action === 'favorites_remove') && (req.method === 'POST' || req.method === 'PUT')) {
      const { jobId, jobId: jobIdFromJSON } = req.body || {}
      const targetJobId = jobId || jobIdFromJSON || req.query.jobId
      if (!targetJobId) return res.status(400).json({ success: false, error: 'Missing jobId' })

      try {
        const removed = await removeFavorite(user.user_id, targetJobId)
        if (!removed) {
          return res.status(503).json({ success: false, error: 'Service unavailable: Database not configured' })
        }
        console.log('[API] Removed from Neon favorites:', targetJobId)
        return res.status(200).json({ success: true, jobId: targetJobId })
      } catch (e) {
        console.error('[API] Neon error:', e)
        return res.status(500).json({ success: false, error: 'Failed to remove favorite' })
      }
    }

    // 保存求职期望
    if (action === 'save_preferences' && req.method === 'POST') {
      const body = req.body || {}
      const preferences = body.preferences || {}

      console.log(`[API save_preferences] User: ${user.user_id}`)
      console.log(`[API save_preferences] Received preferences:`, JSON.stringify(preferences))

      const existingProfile = await getUserProfile(user.user_id) || {}
      console.log(`[API save_preferences] Existing profile:`, JSON.stringify(existingProfile))

      const updatedProfile = {
        ...existingProfile,
        jobPreferences: preferences,
        preferencesUpdatedAt: new Date().toISOString(),
        user_id: user.user_id,
        updatedAt: new Date().toISOString()
      }

      console.log(`[API save_preferences] Updated profile to save:`, JSON.stringify(updatedProfile))

      const saved = await saveUserProfile(user.user_id, updatedProfile)
      console.log(`[API save_preferences] Save result: ${saved}`)

      if (!saved) {
        return res.status(503).json({ success: false, error: 'Service unavailable: Database not configured' })
      }

      // Verify the save by reading back
      const verifyProfile = await getUserProfile(user.user_id)
      console.log(`[API save_preferences] Verification read:`, JSON.stringify(verifyProfile?.jobPreferences))

      return res.status(200).json({ success: true, message: '求职期望已保存' })
    }

    // 获取求职期望
    if (action === 'get_preferences') {
      console.log(`[API get_preferences] User: ${user.user_id}`)

      const profile = await getUserProfile(user.user_id) || {}
      console.log(`[API get_preferences] Retrieved profile:`, JSON.stringify(profile))
      console.log(`[API get_preferences] Job preferences:`, JSON.stringify(profile.jobPreferences))

      const preferencesToReturn = profile.jobPreferences || {
        jobTypes: [],
        industries: [],
        locations: [],
        levels: []
      }

      console.log(`[API get_preferences] Returning:`, JSON.stringify(preferencesToReturn))

      return res.status(200).json({
        success: true,
        preferences: preferencesToReturn
      })
    }

    // 记录用户与岗位的互动 (Apply/View/etc.)
    if (action === 'record_interaction' && req.method === 'POST') {
      const { jobId, type, notes, source } = req.body || {}
      if (!jobId || !type) return res.status(400).json({ success: false, error: 'Missing jobId or type' })

      try {
        if (NEON_CONFIGURED) {
          // Upsert interaction with snapshots
          // Try to get job title/company from jobs table if not provided?
          // For now, we use a subquery or just leave it null if we can't find it easily.
          // Better: Use a CTE or join in the INSERT?
          // "INSERT INTO ... SELECT ..., j.title, j.company FROM jobs j WHERE j.job_id = $2"
          
          await neonHelper.query(`
                    INSERT INTO user_job_interactions (user_id, job_id, interaction_type, notes, application_source, updated_at, job_title_snapshot, company_name_snapshot, status)
                    SELECT $1, $2, $3, $4, $5, NOW(), j.title, j.company, 'pending_apply'
                    FROM (SELECT $2::text as job_id) as input
                    LEFT JOIN jobs j ON j.job_id = input.job_id
                    ON CONFLICT (user_id, job_id, interaction_type) 
                    DO UPDATE SET 
                        updated_at = NOW(), 
                        notes = EXCLUDED.notes, 
                        application_source = EXCLUDED.application_source,
                        job_title_snapshot = COALESCE(EXCLUDED.job_title_snapshot, user_job_interactions.job_title_snapshot),
                        company_name_snapshot = COALESCE(EXCLUDED.company_name_snapshot, user_job_interactions.company_name_snapshot)
                `, [user.user_id, jobId, type, notes || '', source || null]);

          return res.status(200).json({ success: true });
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] record_interaction error:', e);
        return res.status(500).json({ success: false, error: 'Failed to record interaction' });
      }
    }

    // 提交会员申请
    if (action === 'submit_application' && req.method === 'POST') {
      const { nickname, experience, career_ideal, portfolio, expectations, contribution, contact, contact_type } = req.body || {}

      try {
        if (NEON_CONFIGURED) {
          // Check if already applied
          const existing = await neonHelper.query(
            'SELECT id FROM club_applications WHERE user_id = $1 AND status = \'pending\'',
            [user.user_id]
          )

          if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, error: '您已有正在审核中的申请' })
          }

          await neonHelper.insert('club_applications', {
            user_id: user.user_id,
            // nickname: nickname || user.username || '', // Column does not exist in schema, removing
            experience: experience || '',
            career_ideal: career_ideal || '',
            portfolio: portfolio || '',
            expectations: expectations || '',
            contribution: contribution || '',
            contact: contact || '',
            contact_type: contact_type || 'wechat',
            status: 'pending',
            created_at: new Date().toISOString()
          })

          // Also update user profile with nickname if provided
          if (nickname && nickname !== user.username) {
            // We don't want to override username directly maybe? 
            // Or update profile.fullName?
            // Let's just update the profile part
            const currentProfile = await getUserProfile(user.user_id) || {}
            if (!currentProfile.fullName) {
              await saveUserProfile(user.user_id, { ...currentProfile, fullName: nickname })
            }
          }

          return res.status(200).json({ success: true, message: '申请已提交' })
        }
        return res.status(503).json({ success: false, error: 'Database not configured' })
      } catch (e) {
        console.error('[user-profile] submit_application error:', e)
        return res.status(500).json({ success: false, error: 'Failed to submit application' })
      }
    }

    // 提交内推申请
    if (action === 'submit_referral' && req.method === 'POST') {
      const { jobId, resumeId, notes } = req.body || {}
      if (!jobId || !resumeId) return res.status(400).json({ success: false, error: 'Missing jobId or resumeId' })

      try {
        if (NEON_CONFIGURED) {
          // 1. Check Membership Status
          const isMember = user.memberStatus === 'active' &&
            user.memberExpireAt &&
            new Date(user.memberExpireAt) > new Date();

          if (!isMember) {
            return res.status(403).json({
              success: false,
              error: 'Only members can submit referral applications. Please upgrade your membership.',
              upgradeRequired: true
            });
          }

          // Insert referral application
          // Use upsert to prevent duplicates for same job
          await neonHelper.query(`
                    INSERT INTO user_job_interactions (user_id, job_id, interaction_type, resume_id, notes, status, application_source, updated_at, job_title_snapshot, company_name_snapshot)
                    SELECT $1, $2, 'referral', $3, $4, 'applied', 'referral', NOW(), j.title, j.company
                    FROM (SELECT $2::text as job_id) as input
                    LEFT JOIN jobs j ON j.job_id = input.job_id
                    ON CONFLICT (user_id, job_id, interaction_type) 
                    DO UPDATE SET 
                        resume_id = EXCLUDED.resume_id, 
                        notes = EXCLUDED.notes, 
                        status = 'applied',
                        application_source = 'referral',
                        updated_at = NOW(),
                        job_title_snapshot = COALESCE(EXCLUDED.job_title_snapshot, user_job_interactions.job_title_snapshot),
                        company_name_snapshot = COALESCE(EXCLUDED.company_name_snapshot, user_job_interactions.company_name_snapshot)
                `, [user.user_id, jobId, resumeId, notes || '']);

          return res.status(200).json({ success: true });
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] submit_referral error:', e);
        return res.status(500).json({ success: false, error: 'Failed to submit referral' });
      }
    }

    // 删除申请记录
    if (action === 'delete_application' && req.method === 'POST') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' })

      try {
        if (NEON_CONFIGURED) {
          // Verify ownership and delete
          const result = await neonHelper.query(
            'DELETE FROM user_job_interactions WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, user.user_id]
          );

          if (result && result.length > 0) {
            console.log(`[API delete_application] Deleted application ${id} for user ${user.user_id}`);
            return res.status(200).json({ success: true });
          } else {
            return res.status(404).json({ success: false, error: 'Record not found or unauthorized' });
          }
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] delete_application error:', e);
        return res.status(500).json({ success: false, error: 'Failed to delete application' });
      }
    }

    // 获取我的投递记录
    if (action === 'my_applications') {
      try {
        if (NEON_CONFIGURED) {
          const query = `
                    SELECT 
                        uji.id, 
                        uji.job_id as "jobId", 
                        COALESCE(j.title, uji.job_title_snapshot, '职位已失效') as "jobTitle", 
                        COALESCE(j.company, uji.company_name_snapshot, '未知企业') as "company", 
                        uji.interaction_type as "interactionType", 
                        uji.status, 
                        uji.updated_at as "updatedAt", 
                        uji.notes,
                        uji.resume_id as "resumeId",
                        r.file_name as "resumeName",
                        CASE 
                            WHEN j.job_id IS NULL THEN 'expired'
                            WHEN uji.application_source IS NOT NULL THEN uji.application_source
                            WHEN j.can_refer = true THEN 'referral'
                            WHEN j.is_trusted = true OR j.source_type = 'official' THEN 'official'
                            WHEN j.source_type = 'trusted' THEN 'trusted_platform'
                            ELSE 'trusted_platform'
                        END as "applicationSource"
                    FROM user_job_interactions uji
                    LEFT JOIN jobs j ON uji.job_id = j.job_id
                    LEFT JOIN resumes r ON uji.resume_id = r.resume_id
                    WHERE uji.user_id = $1 
                    AND uji.interaction_type IN ('apply', 'referral', 'apply_redirect')
                    AND uji.updated_at > NOW() - INTERVAL '1 year'
                    ORDER BY uji.updated_at DESC
                `;
          const result = await neonHelper.query(query, [user.user_id]);

          const applications = result ? result.map(row => ({
            id: row.id,
            jobId: row.jobId,
            jobTitle: row.jobTitle,
            company: row.company,
            interactionType: row.interactionType,
            status: row.status,
            updatedAt: row.updatedAt,
            notes: row.notes,
            resumeId: row.resumeId,
            resumeName: row.resumeName,
            applicationSource: row.applicationSource
          })) : [];

          return res.status(200).json({ success: true, applications });
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] my_applications error:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch applications' });
      }
    }

    // 删除申请记录
    if (action === 'delete_application' && req.method === 'POST') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' })

      try {
        if (NEON_CONFIGURED) {
          // Verify ownership and delete
          const result = await neonHelper.query(
            'DELETE FROM user_job_interactions WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, user.user_id]
          );
          
          if (result && result.length > 0) {
            return res.status(200).json({ success: true });
          } else {
            return res.status(404).json({ success: false, error: 'Record not found or unauthorized' });
          }
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] delete_application error:', e);
        return res.status(500).json({ success: false, error: 'Failed to delete application' });
      }
    }

    // 更新申请状态
    if (action === 'update_application_status' && req.method === 'POST') {
      const { id, status } = req.body || {}
      if (!id || !status) return res.status(400).json({ success: false, error: 'Missing id or status' })

      try {
        if (NEON_CONFIGURED) {
          // Verify ownership
          const verify = await neonHelper.query('SELECT user_id FROM user_job_interactions WHERE id = $1', [id]);
          if (!verify || verify.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });
          if (verify[0].user_id !== user.user_id) return res.status(403).json({ success: false, error: 'Unauthorized' });

          await neonHelper.query(
            'UPDATE user_job_interactions SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, id]
          );
          return res.status(200).json({ success: true });
        }
        return res.status(503).json({ success: false, error: 'Database not configured' });
      } catch (e) {
        console.error('[user-profile] update_application_status error:', e);
        return res.status(500).json({ success: false, error: 'Failed to update status' });
      }
    }

    // 获取会员申请状态
    if (action === 'application_status') {
      try {
        if (!NEON_CONFIGURED) return res.status(200).json({ success: true, status: 'none' })

        const result = await neonHelper.query(
          'SELECT status, created_at FROM club_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.user_id]
        )

        if (result && result.length > 0) {
          return res.status(200).json({ success: true, status: result[0].status, appliedAt: result[0].created_at })
        } else {
          return res.status(200).json({ success: true, status: 'none' })
        }
      } catch (e) {
        console.error('[user-profile] application_status error:', e)
        return res.status(500).json({ success: false, error: 'Failed to fetch application status' })
      }
    }

    // GET - 获取用户资料
    if (req.method === 'GET') {
      const profile = await getUserProfile(user.user_id)

      // 从 resumes 表获取用户的简历
      let userResumes = []
      try {
        const resumeResult = await neonHelper.query(
          'SELECT resume_id, file_name, file_size, file_type, parse_status, parse_result, content_text, created_at FROM resumes WHERE user_id = $1 ORDER BY created_at DESC',
          [user.user_id]
        )
        if (resumeResult && resumeResult.length > 0) {
          userResumes = resumeResult.map(r => ({
            id: r.resume_id,
            fileName: r.file_name,
            size: r.file_size,
            fileType: r.file_type,
            parseStatus: r.parse_status,
            parseResult: r.parse_result,
            contentText: r.content_text,
            uploadedAt: r.created_at
          }))
        }
      } catch (e) {
        console.warn('[user-profile] Failed to fetch user resumes:', e.message)
      }

      // 合并基础用户信息和扩展资料
      const fullProfile = {
        // 基础信息
        id: user.user_id,
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
        resumeFiles: userResumes.length > 0 ? userResumes : (profile?.resumeFiles || []),
        jobApplications: profile?.jobApplications || [],
        savedJobs: profile?.savedJobs || [],

        preferences: profile?.preferences || {
          jobAlerts: true,
          emailNotifications: true,
          pushNotifications: false,
          weeklyDigest: true,
          applicationUpdates: true
        },

        jobPreferences: profile?.jobPreferences || {
          jobTypes: [],
          industries: [],
          locations: [],
          levels: []
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
      const existingProfile = await getUserProfile(user.user_id) || {}

      // 合并更新
      const updatedProfile = {
        ...existingProfile,
        ...updates,
        userId: user.user_id,
        updatedAt: new Date().toISOString()
      }

      // 保存扩展资料
      const saved = await saveUserProfile(user.user_id, updatedProfile)
      if (!saved) {
        return res.status(503).json({ success: false, error: 'Service unavailable: Database not configured' })
      }

      // 同时更新基础用户信息（如果有）
      if (updates.fullName || updates.title || updates.location || updates.targetRole || updates.bio) {
        if (!user.profile) user.profile = {}
        if (updates.fullName) user.profile.fullName = updates.fullName
        if (updates.title) user.profile.title = updates.title
        if (updates.location) user.profile.location = updates.location
        if (updates.targetRole) user.profile.targetRole = updates.targetRole
        if (updates.bio) user.profile.bio = updates.bio
        user.updatedAt = new Date().toISOString()
        const userSaved = await saveUser(user)
        if (!userSaved) console.warn('[user-profile] Base user update failed but profile saved')
      }

      // 计算新的完整度
      const completeness = calculateProfileCompleteness(user, updatedProfile)

      console.log(`[user-profile] Profile updated for user ${user.user_id}, completeness: ${completeness}%`)

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
