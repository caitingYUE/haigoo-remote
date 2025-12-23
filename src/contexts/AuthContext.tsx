/**
 * 用户认证上下文
 * 管理全局认证状态、token、用户信息
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, AuthResponse } from '../types/auth-types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isMember: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthResponse>
  loginWithGoogle: (idToken: string) => Promise<AuthResponse>
  register: (email: string, password: string, username?: string) => Promise<AuthResponse>
  logout: () => void
  verifyEmail: (email: string, token: string) => Promise<AuthResponse>
  sendVerificationEmail: (email: string) => Promise<{ success: boolean; message?: string }>
  updateProfile: (updates: Partial<User['profile']>) => Promise<boolean>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const API_BASE = '/api/auth'
const TOKEN_KEY = 'haigoo_auth_token'
const USER_KEY = 'haigoo_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    console.log('[AuthContext] User logged out')
  }, [])

  const refreshUserSilently = useCallback(async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE}?action=me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        }
      } else {
        logout()
      }
    } catch (error) {
      console.error('[AuthContext] Silent refresh failed:', error)
    }
  }, [logout])

  // 从 localStorage 恢复认证状态
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(parsedUser)
        // 验证 token 并刷新用户信息
        refreshUserSilently(storedToken)
      } catch (error) {
        console.error('[AuthContext] Failed to parse stored user:', error)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setIsLoading(false)
  }, [refreshUserSilently])

  

  // 刷新用户信息（显式调用）
  const refreshUser = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}?action=me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        }
      } else {
        logout()
      }
    } catch (error) {
      console.error('[AuthContext] Refresh failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [token, logout])

  // 邮箱密码登录
  const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_BASE}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()

      if (data.success && data.token && data.user) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error('[AuthContext] Login failed:', error)
      return { success: false, error: '网络错误，请稍后重试' }
    }
  }, [])

  // Google 登录
  const loginWithGoogle = useCallback(async (idToken: string): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_BASE}?action=google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      })
      const data = await response.json()

      if (data.success && data.token && data.user) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error('[AuthContext] Google login failed:', error)
      return { success: false, error: '网络错误，请稍后重试' }
    }
  }, [])

  // 注册
  const register = useCallback(async (email: string, password: string, username?: string): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_BASE}?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      })
      const data = await response.json()

      if (data.success && data.token && data.user) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error('[AuthContext] Register failed:', error)
      return { success: false, error: '网络错误，请稍后重试' }
    }
  }, [])


  // 验证邮箱
  const verifyEmail = useCallback(async (email: string, verificationToken: string): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_BASE}?action=verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: verificationToken })
      })
      const data = await response.json()

      if (data.success && data.user) {
        // 更新用户信息
        setUser(data.user)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }

      return data
    } catch (error) {
      console.error('[AuthContext] Verify email failed:', error)
      return { success: false, error: '网络错误，请稍后重试' }
    }
  }, [])

  // 发送验证邮件
  const sendVerificationEmail = useCallback(async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(`${API_BASE}?action=resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await response.json()
      return data
    } catch (error) {
      console.error('[AuthContext] Send verification email failed:', error)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }, [])

  // 更新用户资料
  const updateProfile = useCallback(async (updates: Partial<User['profile']>): Promise<boolean> => {
    if (!token) return false

    try {
      const response = await fetch(`${API_BASE}?action=update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })
      const data = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        return true
      }

      return false
    } catch (error) {
      console.error('[AuthContext] Update profile failed:', error)
      return false
    }
  }, [token])

  // Calculate derived permissions
  const isAdmin = !!(user?.roles?.admin || user?.email === 'caitlinyct@gmail.com')
  const isSuperAdmin = user?.email === 'caitlinyct@gmail.com' || user?.email === 'mrzhangzy1996@gmail.com'
  const isMember = user?.memberStatus === 'active' && (!user.memberExpireAt || new Date(user.memberExpireAt) > new Date())

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isAdmin,
    isSuperAdmin,
    isMember,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    verifyEmail,
    sendVerificationEmail,
    updateProfile,
    refreshUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
