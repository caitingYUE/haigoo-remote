/**
 * 用户认证系统类型定义
 * 支持 Google OAuth 和邮箱密码登录
 */

// 用户基本信息
export interface User {
  user_id: string // 唯一用户ID
  email: string // 邮箱（唯一标识）
  username: string // 用户名（随机生成或从简历提取）
  avatar: string // 头像URL（随机生成或Gravatar）

  // 认证信息
  authProvider: 'google' | 'email' // 认证提供方
  googleId?: string // Google OAuth ID
  passwordHash?: string // 密码哈希（仅邮箱登录）

  // 邮箱验证
  emailVerified: boolean // 邮箱是否已验证
  verificationToken?: string // 验证令牌
  verificationExpires?: string // 验证令牌过期时间

  // 从简历提取的信息（可选）
  profile?: {
    fullName?: string // 真实姓名
    title?: string // 职位/职称
    location?: string // 地点
    targetRole?: string // 求职意向
    phone?: string // 电话
    bio?: string // 个人简介
  }

  // 时间戳
  createdAt: string // 注册时间
  updatedAt: string // 更新时间
  lastLoginAt?: string // 最后登录时间

  // 状态
  status: 'active' | 'suspended' | 'deleted' // 账户状态
  roles?: {
    admin?: boolean
  }

  // 会员信息
  membershipLevel?: 'none' | 'club_go' | 'goo_plus'; // Deprecated
  membershipStartAt?: string; // Deprecated
  membershipExpireAt?: string; // Deprecated but might be reused or migrated
  
  // New Unified Member System
  memberStatus?: 'free' | 'active' | 'expired';
  memberExpireAt?: string;
  memberSince?: string;
  memberDisplayId?: number;

  // 求职偏好
  jobPreferences?: {
    jobTypes: string[]
    industries: string[]
    locations: string[]
    levels: string[]
    contactEmail?: string
    contactWechat?: string
    notes?: string
  }
  preferencesUpdatedAt?: string
  
  // API Token Usage
  apiUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    lastUsedAt?: string;
  }
}

// 登录请求
export interface LoginRequest {
  email: string
  password: string
}

// 注册请求
export interface RegisterRequest {
  email: string
  password: string
  username?: string // 可选，不提供则随机生成
}

// Google OAuth 回调数据
export interface GoogleAuthData {
  id: string
  email: string
  name: string
  picture: string
  verified_email: boolean
}

// JWT Token payload
export interface TokenPayload {
  userId: string
  email: string
  iat: number // 签发时间
  exp: number // 过期时间
}

// 认证响应
export interface AuthResponse {
  success: boolean
  token?: string // JWT token
  user?: Partial<User> // 用户信息（不含敏感数据）
  error?: string
  message?: string
}

// 邮箱验证请求
export interface VerifyEmailRequest {
  email: string
  token: string
}

// 发送验证码请求
export interface SendVerificationRequest {
  email: string
}

// 重置密码请求
export interface ResetPasswordRequest {
  email: string
  token: string
  newPassword: string
}

// 前端认证上下文状态
export interface AuthContextState {
  user: User | null // 当前登录用户
  token: string | null // JWT token
  isAuthenticated: boolean // 是否已登录
  isLoading: boolean // 是否正在加载
  login: (email: string, password: string) => Promise<AuthResponse>
  loginWithGoogle: (googleToken: string) => Promise<AuthResponse>
  register: (email: string, password: string, username?: string) => Promise<AuthResponse>
  logout: () => void
  verifyEmail: (email: string, token: string) => Promise<AuthResponse>
  sendVerificationEmail: (email: string) => Promise<{ success: boolean; message?: string }>
  updateProfile: (updates: Partial<User['profile']>) => Promise<boolean>
  refreshUser: () => Promise<void>
}

// 随机头像生成选项
export interface AvatarOptions {
  seed: string // 用于生成随机头像的种子
  style: 'initials' | 'bottts' | 'fun-emoji' | 'adventurer' | 'avataaars' | 'personas' | 'pixel-art' // DiceBear 风格
  size?: number // 尺寸
}

