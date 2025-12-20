/**
 * 用户认证辅助函数
 * 提供 JWT、密码加密、随机用户名生成等功能
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// JWT 密钥（从环境变量读取，或使用默认值）
const JWT_SECRET = process.env.JWT_SECRET || 'haigoo-jwt-secret-key-change-in-production'
const JWT_EXPIRES_IN = '30d' // Token 有效期 30 天

// 密码加密轮次
const BCRYPT_ROUNDS = 10

/**
 * 生成 JWT token
 * @param {Object} payload - Token payload (userId, email)
 * @returns {string} JWT token
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} 解码后的 payload，失败返回 null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    console.error('[auth-helpers] JWT verification failed:', error.message)
    return null
  }
}

/**
 * 从请求头中提取 JWT token
 * @param {Object} req - 请求对象
 * @returns {string|null} Token 或 null
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * 密码加密
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 密码哈希
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 密码哈希
 * @returns {Promise<boolean>} 是否匹配
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

/**
 * 生成随机用户名
 * @returns {string} 随机用户名（例如：User_a7f3e9）
 */
export function generateRandomUsername() {
  const randomHex = crypto.randomBytes(3).toString('hex')
  return `User_${randomHex}`
}

/**
 * 生成随机头像 URL (使用 DiceBear Avatars API)
 * @param {string} seed - 用于生成头像的种子
 * @param {string} style - 头像风格 (avataaars, bottts, personas, pixel-art 等)
 * @returns {string} 头像 URL
 */
export function generateRandomAvatar(seed, style = 'avataaars-neutral') {
  // DiceBear Avatars API: https://avatars.dicebear.com/
  // 使用 avataaars-neutral 风格（无性别、抽象、中性）
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

/**
 * 生成邮箱验证令牌
 * @returns {string} 32 字符的随机令牌
 */
export function generateVerificationToken() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 生成重置密码令牌
 * @returns {string} 32 字符的随机令牌
 */
export function generateResetToken() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证密码强度（至少8位，包含字母和数字）
 * @param {string} password - 密码
 * @returns {boolean} 是否满足强度要求
 */
export function isValidPassword(password) {
  if (!password || password.length < 8) return false
  // 至少包含一个字母和一个数字
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasLetter && hasNumber
}

/**
 * 清理用户对象，移除敏感字段（用于返回给前端）
 * @param {Object} user - 用户对象
 * @returns {Object} 清理后的用户对象
 */
export function sanitizeUser(user) {
  if (!user) return null

  // 统一处理可能的不同命名格式
  const safeUser = {
    // 基本信息
    userId: user.userId || user.user_id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    status: user.status,
    roles: user.roles,
    // 时间信息（转换为驼峰命名）
    createdAt: user.createdAt || user.created_at,
    updatedAt: user.updatedAt || user.updated_at,
    lastLoginAt: user.lastLoginAt || user.last_login_at,
    // 其他非敏感字段
    profile: user.profile,
    authProvider: user.authProvider || user.auth_provider,
    emailVerified: user.emailVerified ?? user.email_verified ?? false,
    // 会员字段
    membershipLevel: user.membershipLevel || user.membership_level || 'none',
    membershipStartAt: user.membershipStartAt || user.membership_start_at,
    membershipExpireAt: user.membershipExpireAt || user.membership_expire_at,
    // New Member System
    memberStatus: user.memberStatus || user.member_status || 'free',
    memberExpireAt: user.memberExpireAt || user.member_expire_at,
    memberSince: user.memberSince || user.member_since,
    memberDisplayId: user.memberDisplayId || user.member_display_id
  }

  // 移除所有值为undefined的属性
  Object.keys(safeUser).forEach(key => {
    if (safeUser[key] === undefined) {
      delete safeUser[key]
    }
  })

  return safeUser
}

/**
 * 生成验证码到期时间（15分钟后）
 * @returns {string} ISO 时间字符串
 */
export function generateVerificationExpiry() {
  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + 15) // 15 分钟有效
  return expiry.toISOString()
}

/**
 * 检查验证码是否过期
 * @param {string} expiryTime - ISO 时间字符串
 * @returns {boolean} 是否已过期
 */
export function isTokenExpired(expiryTime) {
  if (!expiryTime) return true
  return new Date(expiryTime) < new Date()
}

