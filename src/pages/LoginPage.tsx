/**
 * 登录页面
 * 支持邮箱密码登录和 Google OAuth 登录
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoSvg from '../assets/logo.svg'

// Google Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 获取重定向目标（登录后跳转到原页面）
  const from = (location.state as any)?.from?.pathname || '/'

  // 初始化 Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('[LoginPage] Google Client ID not configured')
      return
    }

    // 等待 Google Identity Services 库加载
    const checkGoogleLoaded = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleLoaded)
        initializeGoogleSignIn()
      }
    }, 100)

    // 10秒超时
    const timeout = setTimeout(() => {
      clearInterval(checkGoogleLoaded)
      if (!window.google?.accounts?.id) {
        console.error('[LoginPage] Google Identity Services failed to load')
      }
    }, 10000)

    return () => {
      clearInterval(checkGoogleLoaded)
      clearTimeout(timeout)
    }
  }, [])

  const initializeGoogleSignIn = () => {
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
      const container = document.getElementById('googleSignInBtn')
      if (container) {
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular'
        })
      }
      setGoogleReady(true)
      window.google.accounts.id.prompt()
    } catch (error) {
      console.error('[LoginPage] Failed to initialize Google Sign-In:', error)
    }
  }

  const handleGoogleCallback = async (response: any) => {
    if (!response.credential) {
      setError('Google 登录失败：未获取到凭证')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('[LoginPage] Processing Google login...')
      const result = await loginWithGoogle(response.credential)
      
      if (result.success) {
        console.log('[LoginPage] Google login successful')
        navigate(from, { replace: true })
      } else {
        console.error('[LoginPage] Google login failed:', result.error)
        setError(result.error || 'Google 登录失败')
      }
    } catch (err) {
      console.error('[LoginPage] Google login error:', err)
      setError('Google 登录失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(email, password)
      if (result.success) {
        navigate(from, { replace: true })
      } else {
        setError(result.error || '登录失败')
      }
    } catch (err) {
      setError('登录失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    if (!googleReady || !window.google?.accounts?.id) {
      setError('Google 登录服务未就绪，请稍后重试')
      return
    }
    try {
      window.google.accounts.id.prompt()
    } catch (error) {
      setError('无法启动 Google 登录，请稍后重试')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoSvg} alt="Haigoo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
          <p className="text-gray-600 mt-2">登录您的 Haigoo 账户</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 错误提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
              />
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或</span>
            </div>
          </div>

          <div className="w-full">
            <div id="googleSignInBtn" className="flex justify-center" />
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full mt-3 flex items-center justify-center gap-3 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-all"
            >
              使用 Google 登录
            </button>
          </div>

          {/* 注册链接 */}
          <p className="text-center mt-6 text-sm text-gray-600">
            还没有账户？{' '}
            <Link to="/register" className="text-violet-600 font-medium hover:text-violet-700">
              立即注册
            </Link>
          </p>
        </div>

        {/* 返回首页 */}
        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}

