import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import logoPng from '../assets/logo.webp'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const { text } = useLanguage()
  
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState(() => text('正在验证您的邮箱...', 'Verifying your email...'))

  // 添加组件挂载标记，防止React.StrictMode下的双重调用
  const mounted = React.useRef(false);

  useEffect(() => {
    // 确保只在首次挂载时执行
    if (mounted.current) return;
    mounted.current = true;

    if (!token || !email) {
      setStatus('error')
      setMessage(text('验证链接无效，缺少必要参数', 'The verification link is missing required information.'))
      return
    }

    const verify = async () => {
      try {
        const result = await verifyEmail(email, token)
        if (result.success) {
          setStatus('success')
          setMessage(text('邮箱验证成功！', 'Email verified successfully!'))
          setTimeout(() => { navigate('/') }, 3000)
        } else {
          // 如果返回"邮箱已验证"，也视为成功
          if (result.message === '邮箱已验证' || result.message?.includes('already verified')) {
             setStatus('success')
             setMessage(text('您的邮箱此前已验证成功', 'Your email has already been verified.'))
             setTimeout(() => { navigate('/') }, 3000)
          } else if (result.error?.includes('expired') || result.error?.includes('invalid')) {
             // 二次确认：如果Token失效，可能是因为已经验证过了（Strict Mode双重请求导致）
             // 尝试获取最新的用户信息（如果已登录）或者提示用户登录检查
             // 由于 verifyEmail 可能会自动登录或更新状态，我们检查 AuthContext 中的 user
             // 但这里是在 async 函数中，useAuth 的 user 可能还没更新
             // 我们简单提示一个友好的错误，或者尝试假定成功如果时间很短？不，这不安全。
             // 更好的做法是提示："验证链接已失效或已使用。如果您已完成验证，请直接登录。"
             setStatus('error')
             setMessage(text('验证链接已失效或已使用。如果您刚刚已验证，请直接登录。', 'This verification link is invalid or has already been used. If you already verified, please log in.'))
          } else {
             setStatus('error')
             setMessage(result.error || text('验证失败，链接可能已过期', 'Verification failed. The link may have expired.'))
          }
        }
      } catch (err) {
        setStatus('error')
        setMessage(text('网络错误，请稍后重试', 'Network error. Please try again later.'))
      }
    }

    verify()
  }, [token, email, verifyEmail, navigate, text])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <LanguageToggle showIcon className="fixed right-4 top-4 z-20" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <img src={logoPng} alt="Haigoo" className="h-12 mx-auto mb-6" />
        
        {status === 'verifying' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">{text('正在验证', 'Verifying')}</h2>
            <p className="text-slate-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{text('验证成功', 'Verification successful')}</h2>
            <p className="text-slate-600 mb-6">{text('您的邮箱已成功验证，正在跳转至首页...', 'Your email is verified. Redirecting to home...')}</p>
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {text('立即进入', 'Continue now')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{text('验证失败', 'Verification failed')}</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <div className="flex gap-3">
              <Link 
                to="/login" 
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                {text('返回登录', 'Back to login')}
              </Link>
              <Link 
                to="/" 
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                {text('返回首页', 'Back to home')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
