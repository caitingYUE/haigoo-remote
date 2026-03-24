/**
 * 用户管理助手
 * 合并用户API和用户存储功能，使用PostgreSQL/Neon作为存储
 */

import neonHelper from './dal/neon-helper.js'
import { extractToken, verifyToken } from './auth-helpers.js'
import { systemSettingsService } from '../lib/services/system-settings-service.js'
import {
    calculateMembershipWindow,
    getDefaultMembershipPlanConfig,
    getLegacyMembershipLevel,
    getPlanConfigByType,
    normalizeMemberType
} from '../lib/shared/membership.js'

// 超级管理员邮箱
const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'
const SUPER_ADMIN_EMAIL_2 = 'mrzhangzy1996@gmail.com'
const LOCAL_TEST_PASSWORD_HASH = '$2b$10$A1aJl03alRTYeGBoDveiD.1o03jnu1Fd5lbHEKNQvDnWNzDFvHHaG'
const LOCAL_USERS = new Map([
    ['test_member@haigoo.com', {
        user_id: 'test-member-uuid-001',
        email: 'test_member@haigoo.com',
        username: 'Test Member (VIP)',
        auth_provider: 'email',
        password_hash: LOCAL_TEST_PASSWORD_HASH,
        email_verified: true,
        status: 'active',
        roles: { user: true },
        membership_level: 'club_go',
        member_status: 'active',
        member_expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        member_type: 'quarter',
        profile: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }],
    ['test_free@haigoo.com', {
        user_id: 'test-free-uuid-002',
        email: 'test_free@haigoo.com',
        username: 'Test Free User',
        auth_provider: 'email',
        password_hash: LOCAL_TEST_PASSWORD_HASH,
        email_verified: true,
        status: 'active',
        roles: { user: true },
        membership_level: null,
        member_status: 'inactive',
        member_expire_at: null,
        member_type: 'none',
        profile: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }],
    ['test_admin@haigoo.com', {
        user_id: 'test-admin-uuid-003',
        email: 'test_admin@haigoo.com',
        username: 'Test Admin',
        auth_provider: 'email',
        password_hash: LOCAL_TEST_PASSWORD_HASH,
        email_verified: true,
        status: 'active',
        roles: { user: true, admin: true },
        membership_level: 'club_go',
        member_status: 'active',
        member_expire_at: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
        member_type: 'year',
        profile: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }]
])

function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

function enrichUserFields(user) {
    if (!user) return null
    const u = clone(user)
    if (u.user_id) u.userId = u.user_id
    if (u.password_hash) u.passwordHash = u.password_hash
    if (u.google_id) u.googleId = u.google_id
    if (u.verification_token) u.verificationToken = u.verification_token
    if (u.verification_expires) u.verificationExpires = u.verification_expires
    if (u.email_verified !== undefined) u.emailVerified = u.email_verified
    if (u.last_login_at) u.lastLoginAt = u.last_login_at
    if (u.created_at) u.createdAt = u.created_at
    if (u.updated_at) u.updatedAt = u.updated_at
    if (u.membership_level) u.membershipLevel = u.membership_level
    if (u.membership_start_at) u.membershipStartAt = u.membership_start_at
    if (u.membership_expire_at) u.membershipExpireAt = u.membership_expire_at
    if (u.member_status) u.memberStatus = u.member_status
    if (u.member_expire_at) u.memberExpireAt = u.member_expire_at
    if (u.member_since) u.memberSince = u.member_since
    if (u.member_display_id) u.memberDisplayId = u.member_display_id
    if (u.member_type) u.memberType = u.member_type
    if (u.member_cycle_start_at) u.memberCycleStartAt = u.member_cycle_start_at
    return u
}

async function getMembershipPlanConfig() {
    const config = await systemSettingsService.getSetting('membership_plan_config')
    return config || getDefaultMembershipPlanConfig()
}

async function ensureMemberDisplayId(userId, existingValue = null) {
    if (existingValue) return existingValue

    try {
        await neonHelper.query(`CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1`)
        const seqRes = await neonHelper.query(`SELECT nextval('member_id_seq') AS id`)
        return seqRes?.[0]?.id || Math.floor(Math.random() * 100000) + 900000
    } catch (e) {
        console.error('[user-helper] Failed to generate member_display_id:', e.message)
        return Math.floor(Math.random() * 100000) + 900000
    }
}

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
                const local = LOCAL_USERS.get(String(email || '').toLowerCase())
                return enrichUserFields(local || null)
            }

            const result = await neonHelper.query('SELECT * FROM users WHERE email ILIKE $1', [email])
            const user = result?.[0] || null
            if (!user) {
                const localFallback = LOCAL_USERS.get(String(email || '').toLowerCase())
                return enrichUserFields(localFallback || null)
            }

            if (user?.roles && typeof user.roles === 'string') {
                try { user.roles = JSON.parse(user.roles) } catch (e) { user.roles = {} }
            }
            if (user?.profile && typeof user.profile === 'string') {
                try { user.profile = JSON.parse(user.profile) } catch (e) { user.profile = {} }
            }
            return enrichUserFields(user)
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
                const local = Array.from(LOCAL_USERS.values()).find(u => u.user_id === userId)
                return enrichUserFields(local || null)
            }

            const result = await neonHelper.select('users', { user_id: userId })
            const user = result?.[0] || null
            if (!user) {
                const localFallback = Array.from(LOCAL_USERS.values()).find(u => u.user_id === userId)
                return enrichUserFields(localFallback || null)
            }

            if (user?.roles && typeof user.roles === 'string') {
                try { user.roles = JSON.parse(user.roles) } catch (e) { user.roles = {} }
            }
            if (user?.profile && typeof user.profile === 'string') {
                try { user.profile = JSON.parse(user.profile) } catch (e) { user.profile = {} }
            }
            return enrichUserFields(user)
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
                const now = new Date().toISOString()
                const localUser = {
                    user_id: user.userId || user.user_id || `local-${Date.now()}`,
                    email: String(user.email || '').toLowerCase(),
                    username: user.username || 'Local User',
                    avatar: user.avatar || null,
                    auth_provider: user.authProvider || user.auth_provider || 'email',
                    password_hash: user.passwordHash || user.password_hash || null,
                    google_id: user.googleId || user.google_id || null,
                    verification_token: user.verificationToken || user.verification_token || null,
                    verification_expires: user.verificationExpires || user.verification_expires || null,
                    email_verified: user.emailVerified ?? user.email_verified ?? false,
                    status: user.status || 'active',
                    roles: user.roles || {},
                    last_login_at: user.lastLoginAt || user.last_login_at || null,
                    profile: user.profile || {},
                    membership_level: user.membershipLevel || user.membership_level || null,
                    member_status: user.memberStatus || user.member_status || 'inactive',
                    member_expire_at: user.memberExpireAt || user.member_expire_at || null,
                    member_type: normalizeMemberType(user.memberType || user.member_type, user.membershipLevel || user.membership_level),
                    member_cycle_start_at: user.memberCycleStartAt || user.member_cycle_start_at || null,
                    created_at: user.createdAt || user.created_at || now,
                    updated_at: now
                }
                LOCAL_USERS.set(localUser.email, localUser)
                return { success: true, provider: 'local-memory' }
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
                membership_level: user.membershipLevel || user.membership_level || null,
                member_status: user.memberStatus || user.member_status || 'inactive',
                member_expire_at: user.memberExpireAt || user.member_expire_at || null,
                member_since: user.memberSince || user.member_since || null,
                member_display_id: user.memberDisplayId || user.member_display_id || null,
                member_type: normalizeMemberType(user.memberType || user.member_type, user.membershipLevel || user.membership_level),
                member_cycle_start_at: user.memberCycleStartAt || user.member_cycle_start_at || null,
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
        SELECT user_id, email, username, auth_provider, email_verified, profile,
               status, roles, created_at, updated_at, last_login_at,
               member_status, member_expire_at, member_since, member_display_id,
               member_type, member_cycle_start_at
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
                            authProvider: user.auth_provider,
                            emailVerified: user.email_verified,
                            profile: (() => {
                                if (typeof user.profile !== 'string') return user.profile || {}
                                try {
                                    return JSON.parse(user.profile || '{}')
                                } catch {
                                    return {}
                                }
                            })(),
                            createdAt: user.created_at,
                            updatedAt: user.updated_at,
                            lastLoginAt: user.last_login_at,
                            memberStatus: user.member_status,
                            memberExpireAt: user.member_expire_at,
                            memberSince: user.member_since,
                            memberDisplayId: user.member_display_id,
                            memberType: user.member_type,
                            memberCycleStartAt: user.member_cycle_start_at
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
                const local = Array.from(LOCAL_USERS.values()).find(u => u.user_id === userId)
                if (!local) return { success: false, error: '用户不存在' }
                if (updates.passwordHash) local.password_hash = updates.passwordHash
                if (updates.emailVerified === true || updates.emailVerified === false) local.email_verified = updates.emailVerified
                if (updates.verificationToken !== undefined) local.verification_token = updates.verificationToken
                if (updates.verificationExpires !== undefined) local.verification_expires = updates.verificationExpires
                if (typeof updates.username === 'string' && updates.username.trim()) local.username = updates.username.trim()
                if (typeof updates.avatar === 'string' && updates.avatar.trim()) local.avatar = updates.avatar.trim()
                const profileData = local.profile || {}
                if (typeof updates.fullName === 'string') profileData.fullName = updates.fullName.trim()
                if (typeof updates.title === 'string') profileData.title = updates.title.trim()
                if (typeof updates.location === 'string') profileData.location = updates.location.trim()
                if (typeof updates.targetRole === 'string') profileData.targetRole = updates.targetRole.trim()
                if (typeof updates.phone === 'string') profileData.phone = updates.phone.trim()
                if (typeof updates.bio === 'string') profileData.bio = updates.bio.trim()
                if (updates.profile && typeof updates.profile === 'object') Object.assign(profileData, updates.profile)
                local.profile = profileData
                if (updates.lastLoginAt === true) local.last_login_at = new Date().toISOString()
                if (options.isAdmin) {
                    if (updates.memberStatus) local.member_status = updates.memberStatus
                    if (updates.memberExpireAt !== undefined) local.member_expire_at = updates.memberExpireAt
                    if (updates.memberCycleStartAt !== undefined) local.member_cycle_start_at = updates.memberCycleStartAt
                    if (updates.memberType !== undefined) {
                        const nextType = normalizeMemberType(updates.memberType, local.membership_level)
                        local.member_type = nextType
                        if (nextType === 'none') {
                            local.member_status = 'free'
                            local.member_expire_at = null
                            local.member_cycle_start_at = null
                        }
                    }
                    if (updates.roles && typeof updates.roles === 'object') local.roles = { ...(local.roles || {}), ...updates.roles }
                    if (updates.status && ['active', 'suspended'].includes(updates.status)) local.status = updates.status
                }
                local.updated_at = new Date().toISOString()
                LOCAL_USERS.set(local.email, local)
                return { success: true, user: this.sanitizeUser(enrichUserFields(local)), message: '更新成功' }
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
                passwordHash,
                memberType,
                autoApplyMemberDuration,
                memberCycleStartAt
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

                if (memberType !== undefined) {
                    const nextMemberType = normalizeMemberType(memberType, user.membershipLevel || user.membership_level)
                    updateFields.member_type = nextMemberType
                    updateFields.membership_level = getLegacyMembershipLevel(nextMemberType)

                    if (nextMemberType === 'none') {
                        updateFields.member_status = 'free'
                        updateFields.member_expire_at = null
                        updateFields.member_cycle_start_at = null
                    } else {
                        const shouldAutoExtend = autoApplyMemberDuration !== false
                        if (shouldAutoExtend && updates.memberExpireAt === undefined) {
                            const planConfig = await getMembershipPlanConfig()
                            const plan = getPlanConfigByType(nextMemberType, planConfig)
                            const durationDays = Number(plan?.duration_days || 0)
                            const membershipWindow = calculateMembershipWindow(
                                user,
                                durationDays,
                                new Date(),
                                memberCycleStartAt || updates.member_cycle_start_at || null
                            )
                            updateFields.member_status = updates.memberStatus || 'active'
                            updateFields.member_cycle_start_at = membershipWindow.startAtIso
                            updateFields.member_expire_at = membershipWindow.expireAtIso
                            if (!user.memberSince && !user.member_since) {
                                updateFields.member_since = membershipWindow.startAtIso
                            }
                            if (!user.memberDisplayId && !user.member_display_id) {
                                updateFields.member_display_id = await ensureMemberDisplayId(userId, null)
                            }
                        } else if (updates.memberExpireAt !== undefined) {
                            updateFields.member_status = updates.memberStatus || (updates.memberExpireAt ? 'active' : 'free')
                            if (updates.memberExpireAt) {
                                updateFields.member_cycle_start_at =
                                    memberCycleStartAt ||
                                    updates.member_cycle_start_at ||
                                    user.member_cycle_start_at ||
                                    user.memberCycleStartAt ||
                                    new Date().toISOString()
                            }
                            if (updates.memberExpireAt && !user.memberSince && !user.member_since) {
                                updateFields.member_since = updateFields.member_cycle_start_at || new Date().toISOString()
                            }
                            if (updates.memberExpireAt && !user.memberDisplayId && !user.member_display_id) {
                                updateFields.member_display_id = await ensureMemberDisplayId(userId, null)
                            }
                        }
                    }
                }

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

            const isAdmin = !!(
                user.roles?.admin ||
                user.email === SUPER_ADMIN_EMAIL ||
                user.email === SUPER_ADMIN_EMAIL_2
            )
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
