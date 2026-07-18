import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoPng from '../assets/logo.webp'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const { resetPassword } = useAuth()
  const { text } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token || !email) {
      setError(text('无效的重置链接，请重新请求', 'Invalid reset link. Please request a new one.'))
    }
  }, [token, email, text])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !email) return

    if (password !== confirmPassword) {
      setError(text('两次密码输入不一致', 'Passwords do not match'))
      return
    }

    if (password.length < 8) {
      setError(text('密码至少需要8位', 'Password must be at least 8 characters'))
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const result = await resetPassword(token, password, email)
      if (result.success) {
        setIsSuccess(true)
        // 3秒后自动跳转
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } else {
        setError(result.error || text('重置密码失败，链接可能已过期', 'Could not reset the password. The link may have expired.'))
      }
    } catch (err) {
      setError(text('重置密码失败，请稍后重试', 'Could not reset the password. Please try again later.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <LanguageToggle showIcon className="fixed right-4 top-4 z-20" />
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{text('链接无效', 'Invalid link')}</h3>
          <p className="text-slate-600 mb-6">
            {text('重置链接无效或已过期，请重新发起请求。', 'This reset link is invalid or expired. Please request a new one.')}
          </p>
          <Link 
            to="/forgot-password"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {text('重新请求', 'Request a new link')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <LanguageToggle showIcon className="fixed right-4 top-4 z-20" />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoPng} alt="Haigoo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{text('设置新密码', 'Set a new password')}</h1>
          <p className="text-slate-600 mt-2">{text('请为您的账户设置一个新的安全密码', 'Choose a secure new password for your account')}</p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{text('密码重置成功', 'Password reset successfully')}</h3>
              <p className="text-slate-600 mb-6">
                {text('您的密码已更新，正在跳转到登录页面...', 'Your password has been updated. Redirecting to login...')}
              </p>
              <Link 
                to="/login"
                className="inline-block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-all"
              >
                {text('立即登录', 'Log in now')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 错误提示 */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* 新密码 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  {text('新密码', 'New password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder={text('至少8位', 'At least 8 characters')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 确认新密码 */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  {text('确认新密码', 'Confirm new password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder={text('再次输入密码', 'Enter your password again')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? text('重置中...', 'Resetting...') : text('重置密码', 'Reset password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
