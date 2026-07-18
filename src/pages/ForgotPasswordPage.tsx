import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoPng from '../assets/logo.webp'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const { requestPasswordReset } = useAuth()
  const { text } = useLanguage()
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
        setError(result.error || text('发送重置邮件失败，请稍后重试', 'Could not send the reset email. Please try again later.'))
      }
    } catch (err) {
      setError(text('发送重置邮件失败，请稍后重试', 'Could not send the reset email. Please try again later.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <LanguageToggle showIcon className="fixed right-4 top-4 z-20" />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoPng} alt="Haigoo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{text('重置密码', 'Reset your password')}</h1>
          <p className="text-slate-600 mt-2">{text('我们将向您发送重置密码的链接', 'We will email you a password reset link')}</p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{text('邮件已发送', 'Email sent')}</h3>
              <p className="text-slate-600 mb-6">
                {text(`如果 ${email} 已注册，我们已向其发送了重置密码的说明，请查收邮件（包括垃圾邮件箱）。`, `If ${email} is registered, we sent password reset instructions. Please check your inbox and spam folder.`)}
              </p>
              <Link
                to="/login"
                className="inline-block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                {text('返回登录', 'Back to login')}
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
                  {text('邮箱地址', 'Email address')}
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
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? text('发送中...', 'Sending...') : text('发送重置链接', 'Send reset link')}
              </button>
            </form>
          )}

          {/* 返回登录 */}
          {!isSuccess && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> {text('返回登录', 'Back to login')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
