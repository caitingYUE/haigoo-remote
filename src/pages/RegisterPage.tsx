/**
 * 注册页面
 * 支持邮箱密码注册和 Google OAuth 注册
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoPng from '../assets/logo.png'

// Google Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleGoogleCallback = useCallback(async (response: any) => {
    if (!response.credential) {
      setError('Google 注册失败：未获取到凭证')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('[RegisterPage] Processing Google signup...')
      const result = await loginWithGoogle(response.credential)
      
      if (result.success) {
        console.log('[RegisterPage] Google signup successful')
        navigate('/', { replace: true })
      } else {
        console.error('[RegisterPage] Google signup failed:', result.error)
        setError(result.error || 'Google 注册失败')
      }
    } catch (err) {
      console.error('[RegisterPage] Google signup error:', err)
      setError('Google 注册失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }, [loginWithGoogle, navigate])

  const initializeGoogleSignIn = useCallback(() => {
    try {
      if (!window.google?.accounts?.id) {
        return
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: false,
        cancel_on_tap_outside: true
      })
      const container = document.getElementById('googleSignupBtn')
      if (container) {
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signup_with',
          shape: 'rectangular'
        })
      }
      
    } catch (error) {
      console.error('[RegisterPage] Failed to initialize Google Sign-In:', error)
    }
  }, [handleGoogleCallback])

  // 初始化 Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('[RegisterPage] Google Client ID not configured')
      return
    }

    const checkGoogleLoaded = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleLoaded)
        initializeGoogleSignIn()
      }
    }, 100)

    const timeout = setTimeout(() => {
      clearInterval(checkGoogleLoaded)
      if (!window.google?.accounts?.id) {
        console.error('[RegisterPage] Google Identity Services failed to load')
      }
    }, 10000)

    return () => {
      clearInterval(checkGoogleLoaded)
      clearTimeout(timeout)
    }
  }, [initializeGoogleSignIn])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 密码确认
    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }

    // 密码强度检查（前端）
    if (password.length < 8) {
      setError('密码至少需要8位')
      return
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('密码必须包含字母和数字')
      return
    }

    setIsLoading(true)

    try {
      const result = await register(email, password, username || undefined)
      if (result.success) {
        // 注册成功，跳转到首页
        navigate('/', { replace: true })
      } else {
        setError(result.error || '注册失败')
      }
    } catch (err) {
      setError('注册失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoPng} alt="Haigoo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">创建账户</h1>
          <p className="text-slate-600 mt-2">开启您的远程工作之旅</p>
        </div>

        {/* 注册表单 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 错误提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                邮箱地址 *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
              />
            </div>

            {/* 用户名（可选） */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                用户名（可选）
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="不填写将随机生成"
              />
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                密码 *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="至少8位，包含字母和数字"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                确认密码 *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="再次输入密码"
              />
            </div>

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '注册中...' : '注册'}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">或</span>
            </div>
          </div>

          {/* Google 注册 */}
          <div id="googleSignupBtn" className="flex justify-center" />

          {/* 登录链接 */}
          <p className="text-center mt-6 text-sm text-slate-600">
            已有账户？{' '}
            <Link to="/login" className="text-violet-600 font-medium hover:text-violet-700">
              立即登录
            </Link>
          </p>
        </div>

        {/* 返回首页 */}
        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* 注册成功提示模态框 */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">注册成功！</h3>
              <p className="text-slate-600 mb-6">
                请务必在 <strong>24小时内</strong> 前往邮箱验证您的账号，否则账号将被锁定无法登录。
              </p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full bg-violet-600 text-white py-3 rounded-xl font-medium hover:bg-violet-700 transition-colors"
              >
                我知道了，前往首页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
