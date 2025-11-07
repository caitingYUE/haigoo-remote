/**
 * 用户扩展资料类型定义
 * 用于个人主页、简历管理等功能
 */

import { User } from './auth-types'

// 工作经历
export interface Experience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  current: boolean
  description: string
  location?: string
}

// 教育背景
export interface Education {
  id: string
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa?: string
  description?: string
}

// 技能
export interface Skill {
  id: string
  name: string
  level: number // 1-100
  category: string // 前端框架、后端技术、数据库、工具等
  yearsOfExperience?: number
}

// 简历文件
export interface ResumeFile {
  id: string
  name: string
  size: number
  type: string
  uploadDate: string
  url?: string
  parsed?: boolean
  aiScore?: number
  isPrimary?: boolean // 是否为主简历
}

// 职位申请记录
export interface JobApplication {
  id: string
  jobId: string
  jobTitle: string
  company: string
  appliedAt: string
  status: 'pending' | 'reviewing' | 'interviewed' | 'offered' | 'rejected' | 'accepted'
  notes?: string
  resumeUsed?: string // 使用的简历ID
}

// 收藏的职位
export interface SavedJob {
  id: string
  jobId: string
  jobTitle: string
  company: string
  savedAt: string
  notes?: string
}

// 用户偏好设置
export interface UserPreferences {
  jobAlerts: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  weeklyDigest: boolean
  applicationUpdates: boolean
}

// 隐私设置
export interface PrivacySettings {
  profileVisible: boolean
  contactInfoVisible: boolean
  resumeVisible: boolean
  allowRecruiterContact: boolean
}

// 完整的用户资料（扩展自基础User）
export interface UserProfile extends User {
  // 基础信息由 User 提供：id, email, username, avatar, profile (fullName, title, location, etc.)
  
  // 扩展信息
  phone?: string
  website?: string
  linkedin?: string
  github?: string
  summary?: string
  
  // 职业信息
  experience: Experience[]
  education: Education[]
  skills: Skill[]
  
  // 简历和申请
  resumeFiles: ResumeFile[]
  jobApplications: JobApplication[]
  savedJobs: SavedJob[]
  
  // 设置
  preferences: UserPreferences
  privacy: PrivacySettings
  
  // 统计信息
  profileCompleteness: number // 0-100
  resumeScore?: number // AI评分
  lastActive?: string
}

// 用户资料更新请求
export interface UserProfileUpdateRequest {
  phone?: string
  website?: string
  linkedin?: string
  github?: string
  summary?: string
  fullName?: string
  title?: string
  location?: string
  targetRole?: string
  experience?: Experience[]
  education?: Education[]
  skills?: Skill[]
  preferences?: Partial<UserPreferences>
  privacy?: Partial<PrivacySettings>
}

// 管理后台用户列表项
export interface AdminUserListItem {
  id: string // UUID
  email: string
  username: string
  avatar: string
  authProvider: 'email' | 'google'
  emailVerified: boolean
  createdAt: string
  lastLoginAt?: string
  status: 'active' | 'suspended' | 'deleted'
  profileCompleteness: number
  applicationCount: number
  resumeCount: number
}

// 管理后台用户详情
export interface AdminUserDetail extends UserProfile {
  // 额外的管理信息
  ipAddress?: string
  loginHistory?: Array<{
    timestamp: string
    ipAddress: string
    userAgent: string
  }>
  activityLog?: Array<{
    timestamp: string
    action: string
    details: string
  }>
}

