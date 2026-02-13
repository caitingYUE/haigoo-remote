/**
 * 用户管理助手
 * 合并用户API和用户存储功能，使用PostgreSQL/Neon作为存储
 */

import neonHelper from './dal/neon-helper.js'
import { extractToken, verifyToken } from './auth-helpers.js'

// 超级管理员邮箱
const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'
const SUPER_ADMIN_EMAIL_2 = 'mrzhangzy1996@gmail.com'

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
            const user = result?.[0] || null

            if (user) {
                console.log(`[user-helper] Found user by email: ${email}`)
                // 转换字段名以便前端使用驼峰命名
                if (user.user_id) user.userId = user.user_id
                if (user.password_hash) user.passwordHash = user.password_hash
                if (user.google_id) user.googleId = user.google_id
                if (user.verification_token) user.verificationToken = user.verification_token
                if (user.verification_expires) user.verificationExpires = user.verification_expires
                if (user.email_verified !== undefined) user.emailVerified = user.email_verified
                if (user.last_login_at) user.lastLoginAt = user.last_login_at
                if (user.created_at) user.createdAt = user.created_at
                if (user.updated_at) user.updatedAt = user.updated_at
                if (user.roles && typeof user.roles === 'string') {
                    try { user.roles = JSON.parse(user.roles) } catch (e) { console.warn('[user-helper] Failed to parse roles JSON', e); user.roles = {} }
                }
                if (user.profile && typeof user.profile === 'string') {
                    try { user.profile = JSON.parse(user.profile) } catch (e) { console.warn('[user-helper] Failed to parse profile JSON', e); user.profile = {} }
                }

                if (user.membership_level) user.membershipLevel = user.membership_level
                if (user.membership_start_at) user.membershipStartAt = user.membership_start_at
                if (user.membership_expire_at) user.membershipExpireAt = user.membership_expire_at
                // New Member System
                if (user.member_status) user.memberStatus = user.member_status
                if (user.member_expire_at) user.memberExpireAt = user.member_expire_at
                if (user.member_since) user.memberSince = user.member_since
                if (user.member_display_id) user.memberDisplayId = user.member_display_id
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

            const result = await neonHelper.select('users', { user_id: userId })
            const user = result?.[0] || null

            if (user) {
                console.log(`[user-helper] Found user by ID: ${userId}`)
                // 转换字段名以便前端使用驼峰命名
                if (user.user_id) user.userId = user.user_id
                if (user.password_hash) user.passwordHash = user.password_hash
                if (user.google_id) user.googleId = user.google_id
                if (user.verification_token) user.verificationToken = user.verification_token
                if (user.verification_expires) user.verificationExpires = user.verification_expires
                if (user.email_verified !== undefined) user.emailVerified = user.email_verified
                if (user.last_login_at) user.lastLoginAt = user.last_login_at
                if (user.created_at) user.createdAt = user.created_at
                if (user.updated_at) user.updatedAt = user.updated_at
                if (user.membership_level) user.membershipLevel = user.membership_level
                if (user.membership_start_at) user.membershipStartAt = user.membership_start_at
                if (user.membership_expire_at) user.membershipExpireAt = user.membership_expire_at
                // New Member System
                if (user.member_status) user.memberStatus = user.member_status
                if (user.member_expire_at) user.memberExpireAt = user.member_expire_at
                if (user.member_since) user.memberSince = user.member_since
                if (user.member_display_id) user.memberDisplayId = user.member_display_id
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

            // 转换字段名为数据库使用的下划线格式
            const userToSave = {
                // 保留user_id作为用户标识
                user_id: user.userId || user.user_id,
                // 转换驼峰命名为下划线命名
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                auth_provider: user.authProvider || user.auth_provider,
                password_hash: user.passwordHash || user.password_hash,
                google_id: user.googleId || user.google_id,
                verification_token: user.verificationToken || user.verification_token,
                verification_expires: user.verificationExpires || user.verification_expires,
                email_verified: user.emailVerified || user.email_verified || false,
                status: user.status || 'active',
                roles: JSON.stringify(user.roles || {}),
                last_login_at: user.lastLoginAt || user.last_login_at,
                profile: JSON.stringify(user.profile || {}),
                // 时间戳
                updated_at: new Date().toISOString()
            }

            // 如果没有创建时间，则添加
            if (!user.createdAt && !user.created_at) {
                userToSave.created_at = new Date().toISOString()
            } else {
                userToSave.created_at = user.createdAt || user.created_at
            }

            // 插入新用户
            const result = await neonHelper.insert('users', userToSave)
            const success = !!result?.[0]
            console.log(`[user-helper] Inserted new user: ${userToSave.email} - ${success ? 'success' : 'failed'}`)
            return { success, provider: 'neon' }
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
            const result = await neonHelper.delete('users', { user_id: userId })
            const success = !!result?.[0]

            // 如果删除成功，清理相关数据
            if (success) {
                // 删除用户关联数据
                // 1. 核心业务数据
                await neonHelper.delete('favorites', { user_id: userId })
                await neonHelper.delete('resumes', { user_id: userId })
                await neonHelper.delete('subscriptions', { user_id: userId })
                
                // 2. 互动数据
                await neonHelper.delete('feedbacks', { user_id: userId })
                await neonHelper.delete('recommendations', { user_id: userId })
                await neonHelper.delete('bug_reports', { user_id: userId })
                
                // 3. 会员与支付数据
                await neonHelper.delete('club_applications', { user_id: userId })
                await neonHelper.delete('payment_records', { user_id: userId })
                
                // 4. 分析数据
                await neonHelper.delete('analytics_events', { user_id: userId })

                console.log(`[user-helper] Deleted user and all related data: ${userId}`)
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
        SELECT user_id, email, username, status, roles, created_at, updated_at,
               member_status, member_expire_at, member_since, member_display_id
        FROM users 
        ORDER BY created_at DESC
      `)

            if (!result?.[0]) return null

            // 为每个用户获取收藏信息
            const usersWithFavorites = await Promise.all(
                result.map(async (user) => {
                    try {
                        // 确保使用正确的字段名
                        const userId = user.userId || user.user_id
                        // 获取用户收藏的职位
                        const favResult = await neonHelper.select('favorites', { user_id: userId })
                        const favorites = favResult || []
                        
                        // 转换字段名为驼峰格式
                        const mappedUser = {
                            ...user,
                            userId: user.user_id,
                            createdAt: user.created_at,
                            updatedAt: user.updated_at,
                            memberStatus: user.member_status,
                            memberExpireAt: user.member_expire_at,
                            memberSince: user.member_since,
                            memberDisplayId: user.member_display_id
                        }

                        return {
                            ...mappedUser,
                            favorites: favorites.map(fav => fav.job_id || fav.jobId),
                            favoritesCount: favorites.length
                        }
                    } catch (e) {
                        console.error(`[user-helper] Error fetching favorites for user ${user.userId || user.user_id}:`, e.message)
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

            // Use getUserById to ensure consistent field mapping
            const user = await this.getUserById(userId)
            if (!user) return null

            // 获取用户收藏的职位
            try {
                // Note: favorites table uses user_id, but select helper expects keys to match column names
                const favResult = await neonHelper.select('favorites', { user_id: userId })
                const favorites = favResult || []
                return {
                    ...user,
                    favorites: favorites.map(fav => fav.job_id || fav.jobId),
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
     * 更新用户信息（统一更新函数）
     * @param {string} userId - 用户ID
     * @param {Object} updates - 更新字段
     * @param {Object} options - 更新选项
     * @returns {Promise<Object>} 更新结果
     */
    async updateUser(userId, updates, options = {}) {
        try {
            if (!neonHelper.isConfigured) {
                return { success: false, error: 'Neon/PostgreSQL not configured' }
            }

            const {
                status,
                username,
                roles,
                avatar,
                profile,
                fullName,
                title,
                location,
                targetRole,
                phone,
                bio,
                lastLoginAt,
                emailVerified,
                verificationToken,
                verificationExpires,
                passwordHash
            } = updates || {}

            const { isAdmin = false } = options

            // 查找用户
            const user = await this.getUserById(userId)
            if (!user) {
                return { success: false, error: '用户不存在' }
            }

            // 构建更新字段（使用下划线命名）
            const updateFields = { updated_at: new Date().toISOString() }

            // 密码哈希更新
            if (passwordHash) {
                updateFields.password_hash = passwordHash
            }

            // 邮箱验证状态更新
            if (emailVerified === true || emailVerified === false) {
                updateFields.email_verified = emailVerified
            }

            // 验证令牌更新
            if (verificationToken !== undefined) {
                updateFields.verification_token = verificationToken
            }

            // 验证过期时间更新
            if (verificationExpires !== undefined) {
                updateFields.verification_expires = verificationExpires
            }

            // 基本字段更新（所有用户都可以更新）
            if (typeof username === 'string' && username.trim()) {
                updateFields.username = username.trim()
            }

            if (typeof avatar === 'string' && avatar.trim()) {
                updateFields.avatar = avatar.trim()
            }

            // 处理个人资料字段
            let profileData = user.profile || {}

            if (typeof fullName === 'string') {
                profileData.fullName = fullName.trim()
            } else if (fullName === null || fullName === undefined) {
                profileData.fullName = undefined
            }

            if (typeof title === 'string') {
                profileData.title = title.trim()
            } else if (title === null || title === undefined) {
                profileData.title = undefined
            }

            if (typeof location === 'string') {
                profileData.location = location.trim()
            } else if (location === null || location === undefined) {
                profileData.location = undefined
            }

            if (typeof targetRole === 'string') {
                profileData.targetRole = targetRole.trim()
            } else if (targetRole === null || targetRole === undefined) {
                profileData.targetRole = undefined
            }

            if (typeof phone === 'string') {
                profileData.phone = phone.trim()
            } else if (phone === null || phone === undefined) {
                profileData.phone = undefined
            }

            if (typeof bio === 'string') {
                profileData.bio = bio.trim()
            } else if (bio === null || bio === undefined) {
                profileData.bio = undefined
            }

            // 如果提供了完整的profile对象，则合并
            if (profile && typeof profile === 'object') {
                profileData = { ...profileData, ...profile }
            }

            updateFields.profile = JSON.stringify(profileData)

            // 管理员专用字段
            if (isAdmin) {
                if (status && ['active', 'suspended'].includes(status)) {
                    updateFields.status = status
                }
                
                // Member System Updates
                if (updates.memberStatus) updateFields.member_status = updates.memberStatus
                if (updates.memberExpireAt !== undefined) updateFields.member_expire_at = updates.memberExpireAt
                if (updates.memberSince !== undefined) updateFields.member_since = updates.memberSince

                if (roles && typeof roles === 'object') {
                    // 超级管理员不可更改权限
                    if (user.email === SUPER_ADMIN_EMAIL) {
                        updateFields.roles = JSON.stringify({ ...(user.roles || {}), admin: true })
                    } else {
                        updateFields.roles = JSON.stringify({ ...(user.roles || {}), ...roles })
                    }
                }
            }

            // 特殊字段处理
            if (lastLoginAt === true) {
                updateFields.last_login_at = new Date().toISOString()
            } else if (lastLoginAt instanceof Date) {
                updateFields.last_login_at = lastLoginAt.toISOString()
            }

            // 执行更新
            const result = await neonHelper.update('users', updateFields, { user_id: userId })

            if (!result?.[0]) {
                return { success: false, error: '更新失败，请稍后重试' }
            }

            // 获取更新后的用户信息
            const updatedUser = await this.getUserById(userId)
            return {
                success: true,
                user: this.sanitizeUser(updatedUser),
                message: '更新成功'
            }
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

            return !!(user.roles?.admin || user.email === SUPER_ADMIN_EMAIL || user.email === SUPER_ADMIN_EMAIL_2)
        } catch (error) {
            console.error('[user-helper] Error checking admin status:', error.message)
            return false
        }
    },

    /**
     * 验证用户是否为超级管理员
     * @param {string} userId - 用户ID
     * @returns {Promise<boolean>} 是否为超级管理员
     */
    async isSuperAdmin(userId) {
        try {
            const user = await this.getUserById(userId)
            if (!user) return false

            return user.email === SUPER_ADMIN_EMAIL || user.email === SUPER_ADMIN_EMAIL_2
        } catch (error) {
            console.error('[user-helper] Error checking super admin status:', error.message)
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
export const updateUser = (userId, updates) => userHelper.updateUser(userId, updates)
export const isSuperAdmin = (userId) => userHelper.isSuperAdmin(userId)