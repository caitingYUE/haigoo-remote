import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import logoSvg from '../assets/logo.svg'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('正在验证您的邮箱...')

  // 添加组件挂载标记，防止React.StrictMode下的双重调用
  const mounted = React.useRef(false);

  useEffect(() => {
    // 确保只在首次挂载时执行
    if (mounted.current) return;
    mounted.current = true;

    if (!token || !email) {
      setStatus('error')
      setMessage('验证链接无效，缺少必要参数')
      return
    }

    const verify = async () => {
      try {
        const result = await verifyEmail(email, token)
        if (result.success) {
          setStatus('success')
          setMessage('邮箱验证成功！')
          // 3秒后自动跳转
          setTimeout(() => {
            navigate('/')
          }, 3000)
        } else {
          // 如果返回"邮箱已验证"，也视为成功
          if (result.message === '邮箱已验证') {
             setStatus('success')
             setMessage('您的邮箱此前已验证成功')
             setTimeout(() => {
                navigate('/')
             }, 3000)
          } else {
             setStatus('error')
             setMessage(result.error || '验证失败，链接可能已过期')
          }
        }
      } catch (err) {
        setStatus('error')
        setMessage('网络错误，请稍后重试')
      }
    }

    verify()
  }, [token, email, verifyEmail, navigate])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <img src={logoSvg} alt="Haigoo" className="h-12 mx-auto mb-6" />
        
        {status === 'verifying' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">正在验证</h2>
            <p className="text-slate-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">验证成功</h2>
            <p className="text-slate-600 mb-6">您的邮箱已成功验证，正在跳转至首页...</p>
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              立即进入 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">验证失败</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <div className="flex gap-3">
              <Link 
                to="/login" 
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                返回登录
              </Link>
              <Link 
                to="/" 
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                返回首页
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
