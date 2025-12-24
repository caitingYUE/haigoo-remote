import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoPng from '../assets/logo.png'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const { requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setError('')

    try {
      const result = await requestPasswordReset(email)
      if (result.success) {
        setIsSuccess(true)
      } else {
        setError(result.error || '发送重置邮件失败，请稍后重试')
      }
    } catch (err) {
      setError('发送重置邮件失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoPng} alt="Haigoo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">重置密码</h1>
          <p className="text-slate-600 mt-2">我们将向您发送重置密码的链接</p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">邮件已发送</h3>
              <p className="text-slate-600 mb-6">
                如果 <strong>{email}</strong> 已注册，我们已向其发送了重置密码的说明，请查收邮件（包括垃圾邮件箱）。
              </p>
              <Link 
                to="/login"
                className="inline-block w-full bg-violet-600 text-white py-3 rounded-lg font-medium hover:bg-violet-700 transition-all"
              >
                返回登录
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

              {/* 邮箱 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  邮箱地址
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '发送中...' : '发送重置链接'}
              </button>
            </form>
          )}

          {/* 返回登录 */}
          {!isSuccess && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> 返回登录
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
