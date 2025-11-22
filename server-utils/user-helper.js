/**
 * 用户管理助手
 * 合并用户API和用户存储功能，使用PostgreSQL/Neon作为存储
 */

import neonHelper from './dal/neon-helper.js'
import { extractToken, verifyToken } from './auth-helpers.js'

// 超级管理员邮箱
const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'

/**
 * 用户管理器
 * 提供用户CRUD操作和权限验证
 */
const userHelper = {
  // ===== 用户存储相关功能 =====
  
  /**
   * 通过邮箱获取用户
   * @param {string} email - 用户邮箱
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async getUserByEmail(email) {
    try {
      if (!neonHelper.isConfigured) {
        console.warn('[user-helper] Neon/PostgreSQL not configured')
        return null
      }
      
      const result = await neonHelper.select('users', { email })
      const user = result?.rows?.[0] || null
      
      if (user) {
        console.log(`[user-helper] Found user by email: ${email}`)
      }
      
      return user
    } catch (error) {
      console.error('[user-helper] Error getting user by email:', error.message)
      return null
    }
  },
  
  /**
   * 通过用户ID获取用户
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async getUserById(userId) {
    try {
      if (!neonHelper.isConfigured) {
        console.warn('[user-helper] Neon/PostgreSQL not configured')
        return null
      }
      
      const result = await neonHelper.select('users', { id: userId })
      const user = result?.rows?.[0] || null
      
      if (user) {
        console.log(`[user-helper] Found user by ID: ${userId}`)
      }
      
      return user
    } catch (error) {
      console.error('[user-helper] Error getting user by ID:', error.message)
      return null
    }
  },
  
  /**
   * 保存或更新用户
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 保存结果
   */
  async saveUser(user) {
    try {
      if (!neonHelper.isConfigured) {
        console.warn('[user-helper] Neon/PostgreSQL not configured')
        return { success: false, error: 'Neon/PostgreSQL not configured' }
      }
      
      // 确保有更新时间
      const userToSave = {
        ...user,
        updatedAt: new Date().toISOString()
      }
      
      // 如果没有创建时间，则添加
      if (!userToSave.createdAt) {
        userToSave.createdAt = new Date().toISOString()
      }
      
      // 如果存在ID，更新；否则插入
      if (userToSave.id) {
        const result = await neonHelper.update('users', userToSave, { id: userToSave.id })
        const success = !!result?.rows?.[0]
        console.log(`[user-helper] Updated user: ${userToSave.email} - ${success ? 'success' : 'failed'}`)
        return { success, provider: 'neon' }
      } else {
        // 插入新用户
        const result = await neonHelper.insert('users', userToSave)
        const success = !!result?.rows?.[0]
        console.log(`[user-helper] Inserted new user: ${userToSave.email} - ${success ? 'success' : 'failed'}`)
        return { success, provider: 'neon' }
      }
    } catch (error) {
      console.error('[user-helper] Error saving user:', error.message)
      return { success: false, error: error.message, provider: 'neon' }
    }
  },
  
  /**
   * 通过ID删除用户
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteUserById(userId) {
    try {
      if (!neonHelper.isConfigured) {
        console.warn('[user-helper] Neon/PostgreSQL not configured')
        return false
      }
      
      // 检查是否为超级管理员
      const user = await this.getUserById(userId)
      if (user && user.email === SUPER_ADMIN_EMAIL) {
        console.warn('[user-helper] Cannot delete super admin user')
        return false
      }
      
      // 删除用户
      const result = await neonHelper.delete('users', { id: userId })
      const success = !!result?.rows?.[0]
      
      // 如果删除成功，清理相关数据
      if (success) {
        // 删除用户收藏
        await neonHelper.delete('favorites', { userId })
        console.log(`[user-helper] Deleted user and related data: ${userId}`)
      } else {
        console.log(`[user-helper] Failed to delete user: ${userId}`)
      }
      
      return success
    } catch (error) {
      console.error('[user-helper] Error deleting user:', error.message)
      return false
    }
  },
  
  /**
   * 检查邮箱是否已被注册
   * @param {string} email - 用户邮箱
   * @returns {Promise<boolean>} 是否已被注册
   */
  async isEmailTaken(email) {
    const user = await this.getUserByEmail(email)
    return !!user
  },
  
  // ===== 用户API相关功能 =====
  
  /**
   * 清理用户敏感信息
   * @param {Object} user - 用户对象
   * @returns {Object|null} 清理后的用户对象
   */
  sanitizeUser(user) {
    if (!user) return null
    const { passwordHash, verificationToken, ...safeUser } = user
    return safeUser
  },
  
  /**
   * 获取所有用户（管理员功能）
   * @returns {Promise<Array|null>} 用户列表
   */
  async getAllUsers() {
    try {
      if (!neonHelper.isConfigured) return null
      
      // 查询所有用户，排除敏感信息
      const result = await neonHelper.query(`
        SELECT id, email, username, status, roles, createdAt, updatedAt 
        FROM users 
        ORDER BY createdAt DESC
      `)
      
      if (!result?.rows) return null
      
      // 为每个用户获取收藏信息
      const usersWithFavorites = await Promise.all(
        result.rows.map(async (user) => {
          try {
            // 获取用户收藏的职位
            const favResult = await neonHelper.select('favorites', { userId: user.id })
            const favorites = favResult?.rows || []
            return {
              ...user,
              favorites: favorites.map(fav => fav.jobId),
              favoritesCount: favorites.length
            }
          } catch (e) {
            console.error(`[user-helper] Error fetching favorites for user ${user.id}:`, e.message)
            return {
              ...user,
              favorites: [],
              favoritesCount: 0
            }
          }
        })
      )

      return usersWithFavorites
    } catch (error) {
      console.error('[user-helper] Error getting all users:', error.message)
      return null
    }
  },
  
  /**
   * 获取单个用户详情（管理员功能，包含收藏信息）
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 用户详情
   */
  async getUserDetails(userId) {
    try {
      if (!neonHelper.isConfigured) return null
      
      // 获取用户信息
      const userResult = await neonHelper.query(`
        SELECT id, email, username, status, roles, createdAt, updatedAt 
        FROM users 
        WHERE id = $1
      `, [userId])
      
      const user = userResult?.rows?.[0]
      if (!user) return null
      
      // 获取用户收藏的职位
      try {
        const favResult = await neonHelper.select('favorites', { userId })
        const favorites = favResult?.rows || []
        return {
          ...user,
          favorites: favorites.map(fav => fav.jobId),
          favoritesCount: favorites.length
        }
      } catch (e) {
        console.error(`[user-helper] Error fetching favorites for user ${userId}:`, e.message)
        return {
          ...user,
          favorites: [],
          favoritesCount: 0
        }
      }
    } catch (error) {
      console.error(`[user-helper] Error getting user details for ${userId}:`, error.message)
      return null
    }
  },
  
  /**
   * 更新用户信息（管理员功能）
   * @param {string} userId - 用户ID
   * @param {Object} updates - 更新字段
   * @returns {Promise<Object>} 更新结果
   */
  async updateUser(userId, updates) {
    try {
      if (!neonHelper.isConfigured) {
        return { success: false, error: 'Neon/PostgreSQL not configured' }
      }
      
      const { status, username, roles } = updates || {}
      
      // 查找用户
      const user = await this.getUserById(userId)
      if (!user) {
        return { success: false, error: 'User not found' }
      }
      
      // 构建更新字段
      const updateFields = { updatedAt: new Date().toISOString() }
      
      if (status && ['active', 'suspended'].includes(status)) {
        updateFields.status = status
      }
      
      if (typeof username === 'string' && username.trim()) {
        updateFields.username = username.trim()
      }
      
      if (roles && typeof roles === 'object') {
        // 超级管理员不可更改权限
        if (user.email === SUPER_ADMIN_EMAIL) {
          updateFields.roles = { ...(user.roles || {}), admin: true }
        } else {
          updateFields.roles = { ...(user.roles || {}), ...roles }
        }
      }
      
      // 执行更新
      const result = await neonHelper.update('users', updateFields, { id: userId })
      
      if (!result?.rows?.[0]) {
        return { success: false, error: '更新失败，请稍后重试' }
      }
      
      // 获取更新后的用户信息
      const userResult = await neonHelper.query(`
        SELECT id, email, username, status, roles, createdAt, updatedAt 
        FROM users 
        WHERE id = $1
      `, [userId])
      
      const updatedUser = userResult?.rows?.[0]
      return { success: true, user: updatedUser }
    } catch (error) {
      console.error('[user-helper] Error updating user:', error.message)
      return { success: false, error: '服务器错误' }
    }
  },
  
  // ===== 权限验证相关 =====
  
  /**
   * 验证用户是否为管理员
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否为管理员
   */
  async isAdmin(userId) {
    try {
      const user = await this.getUserById(userId)
      if (!user) return false
      
      return !!(user.roles?.admin || user.email === SUPER_ADMIN_EMAIL)
    } catch (error) {
      console.error('[user-helper] Error checking admin status:', error.message)
      return false
    }
  },
  
  /**
   * 从请求中验证管理员身份
   * @param {Object} req - HTTP请求对象
   * @returns {Promise<Object>} 验证结果对象
   */
  async validateAdminRequest(req) {
    try {
      const token = extractToken(req)
      if (!token) {
        return { valid: false, error: 'No token provided' }
      }
      
      const payload = verifyToken(token)
      if (!payload?.userId) {
        return { valid: false, error: 'Invalid token' }
      }
      
      const user = await this.getUserById(payload.userId)
      if (!user) {
        return { valid: false, error: 'User not found' }
      }
      
      const isAdmin = !!(user.roles?.admin || user.email === SUPER_ADMIN_EMAIL)
      if (!isAdmin) {
        return { valid: false, error: 'Forbidden' }
      }
      
      return { valid: true, user }
    } catch (error) {
      console.error('[user-helper] Error validating admin request:', error.message)
      return { valid: false, error: 'Invalid authentication' }
    }
  },
  
  /**
   * 设置CORS头部
   * @param {Object} res - HTTP响应对象
   */
  setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  },
  
  /**
   * 检查Neon/PostgreSQL配置状态
   * @returns {boolean} 是否已配置
   */
  isConfigured() {
    return neonHelper.isConfigured
  }
}

// 导出用户管理器
export default userHelper

// 导出常用方法（保持向后兼容）
export const getUserById = (userId) => userHelper.getUserById(userId)
export const saveUser = (user) => userHelper.saveUser(user)
export const deleteUserById = (userId) => userHelper.deleteUserById(userId)
export const getUserByEmail = (email) => userHelper.getUserByEmail(email)
export const isEmailTaken = (email) => userHelper.isEmailTaken(email)