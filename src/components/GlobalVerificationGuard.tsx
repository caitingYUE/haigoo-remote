import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, Navigate } from 'react-router-dom'
import { Mail, LogOut, RefreshCw, AlertTriangle, Send } from 'lucide-react'

interface GlobalVerificationGuardProps {
  children: React.ReactNode
}

export default function GlobalVerificationGuard({ children }: GlobalVerificationGuardProps) {
  const { user, logout, sendVerificationEmail } = useAuth()
  const location = useLocation()
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState('')

  // 白名单路由，不需要验证即可访问
  // 注意：如果是 hash router 或有 base path，可能需要调整
  const whitelist = [
    '/login', 
    '/register', 
    '/verify-email', 
    '/logout', 
    '/no-permission',
    '/unsubscribe'
  ]
  
  // 如果当前路径在白名单内，直接放行
  if (whitelist.some(path => location.pathname.startsWith(path))) {
    return <>{children}</>
  }

  // 如果用户未登录，也直接放行（由 ProtectedRoute 处理权限）
  if (!user) {
    return <>{children}</>
  }

  const isVerified = user.emailVerified
  // 如果没有 createdAt，默认不限制（兼容旧数据）
  if (!user.createdAt) return <>{children}</>

  const createdAt = new Date(user.createdAt).getTime()
  const now = Date.now()
  const hoursSinceRegistration = (now - createdAt) / (1000 * 60 * 60)
  
  // 阈值：24小时
  const RESTRICTION_THRESHOLD_HOURS = 24

  // 如果已验证，或者未超过24小时，放行
  if (isVerified || hoursSinceRegistration < RESTRICTION_THRESHOLD_HOURS) {
    return <>{children}</>
  }

  // -----------------------------------------------------------
  // 阻断页面
  // -----------------------------------------------------------

  const handleResend = async () => {
    if (isResending) return
    setIsResending(true)
    setMessage('')
    try {
      const res = await sendVerificationEmail(user.email)
      if (res.success) {
        setMessage('验证邮件已发送，请查收！')
      } else {
        setMessage('发送失败，请稍后重试')
      }
    } catch (e) {
      setMessage('发送失败，网络错误')
    } finally {
      setIsResending(false)
    }
  }

  const handleLogout = () => {
    logout()
    // 强制刷新或跳转
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-amber-50 p-6 flex flex-col items-center text-center border-b border-amber-100">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">账户需验证</h2>
          <p className="text-slate-600 mt-2 text-sm">
            为了保障账户安全，您的账户在注册 24 小时后需要验证邮箱才能继续使用。
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
              <Mail className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900">当前邮箱</p>
                <p className="text-sm text-slate-600 break-all">{user.email}</p>
              </div>
            </div>

            {message && (
              <div className={`text-sm text-center p-2 rounded-lg ${message.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={isResending}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isResending ? (
                <span className="flex items-center gap-2">发送中...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  重新发送验证邮件
                </>
              )}
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              我已验证，刷新页面
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
